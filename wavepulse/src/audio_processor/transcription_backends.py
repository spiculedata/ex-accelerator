# NOTE: This file was added by ex-accelerator contributors and is not part of upstream
# NYU-DICE-Lab/WavePulse (Apache-2.0). It is distributed with that derived work; see NOTICE and README.md.
"""
Configurable transcription backends for WavePulse.

Supports three modes:
- local: WhisperX/faster-whisper running on local GPU or CPU
- scaleway-api: Scaleway Generative APIs (managed Whisper-large-v3)
- scaleway-gpu: On-demand Scaleway L4 GPU instance
- auto: Detect best available backend (GPU → API → CPU fallback)

Configure via TRANSCRIPTION_BACKEND env var or --transcription-backend CLI arg.
"""

import gc
import json
import os
import subprocess
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Optional

import requests
import torch
from loguru import logger


class TranscriptionBackend(ABC):
    """Base class for transcription backends."""

    @abstractmethod
    def transcribe(self, audio_file: str) -> dict:
        """
        Transcribe an audio file.

        Returns:
            dict with "segments" key containing list of
            {"start": float, "end": float, "text": str} dicts
        """
        raise NotImplementedError

    @abstractmethod
    def name(self) -> str:
        raise NotImplementedError


class LocalWhisperBackend(TranscriptionBackend):
    """
    Transcribe using faster-whisper/WhisperX locally.
    Auto-detects CUDA GPU; falls back to CPU with smaller model.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        compute_type: Optional[str] = None,
        device: Optional[str] = None,
        batch_size: int = 16,
        device_index: int = 0,
        models_dir: str = "assets/models",
        diarize: bool = False,
        hf_token: Optional[str] = None,
    ):
        self.has_cuda = torch.cuda.is_available()
        self.device = device or ("cuda" if self.has_cuda else "cpu")
        self.model_name = model or ("large-v3" if self.has_cuda else "small.en")
        self.compute_type = compute_type or ("float16" if self.has_cuda else "float32")
        self.batch_size = batch_size
        self.device_index = device_index
        self.models_dir = models_dir
        self.diarize = diarize
        self.hf_token = hf_token or os.environ.get("HF_TOKEN", "")
        self._model = None

        logger.info(
            f"LocalWhisperBackend: device={self.device}, model={self.model_name}, "
            f"compute_type={self.compute_type}, diarize={self.diarize}"
        )

    def name(self) -> str:
        return f"local-whisper ({self.model_name} on {self.device})"

    def _load_model(self):
        if self._model is not None:
            return

        import whisperx

        asr_options = {
            "max_new_tokens": None,
            "clip_timestamps": None,
            "hallucination_silence_threshold": None,
        }

        self._model = whisperx.load_model(
            self.model_name,
            self.device,
            self.device_index,
            compute_type=self.compute_type,
            language="en",
            download_root=self.models_dir,
            asr_options=asr_options,
        )

        if self.diarize:
            torch_device = f"{self.device}:{self.device_index}"
            self._align_model, self._align_metadata = whisperx.load_align_model(
                "en", device=torch_device
            )
            self._diarize_model = whisperx.DiarizationPipeline(
                use_auth_token=self.hf_token, device=torch_device
            )

        logger.info("LocalWhisperBackend: models loaded")

    def transcribe(self, audio_file: str) -> dict:
        import whisperx

        self._load_model()

        audio = whisperx.load_audio(audio_file)
        logger.info(
            f"Transcribing {audio_file} ({len(audio)} samples) with {self.model_name}"
        )

        start_time = time.time()
        result = self._model.transcribe(
            audio, batch_size=self.batch_size, language="en"
        )

        if self.diarize:
            torch_device = f"{self.device}:{self.device_index}"
            result = whisperx.align(
                result["segments"],
                self._align_model,
                self._align_metadata,
                audio,
                torch_device,
                return_char_alignments=False,
            )
            diarize_segments = self._diarize_model(audio)
            result = whisperx.assign_word_speakers(diarize_segments, result)
            for segment in result["segments"]:
                segment.pop("words", None)

        elapsed = time.time() - start_time
        logger.info(f"Transcription completed in {elapsed:.1f}s")

        del audio
        gc.collect()
        if self.has_cuda:
            torch.cuda.empty_cache()

        return result

    def cleanup(self):
        """Release model memory."""
        self._model = None
        if self.diarize:
            self._align_model = None
            self._diarize_model = None
        gc.collect()
        if self.has_cuda:
            torch.cuda.empty_cache()


class ScalewayAPIBackend(TranscriptionBackend):
    """
    Transcribe using Scaleway Generative APIs (managed Whisper-large-v3).
    Requires SCW_SECRET_KEY environment variable.
    EUR 0.003 per audio minute.
    """

    API_URL = "https://api.scaleway.ai/v1/audio/transcriptions"
    MAX_RETRIES = 3
    RETRY_DELAY = 5  # seconds

    def __init__(self, api_key: Optional[str] = None, model: str = "whisper-large-v3"):
        self.api_key = api_key or os.environ.get("SCW_SECRET_KEY", "")
        self.model = model

        if not self.api_key:
            raise ValueError(
                "ScalewayAPIBackend requires SCW_SECRET_KEY environment variable"
            )

        logger.info(f"ScalewayAPIBackend: model={self.model}")

    def name(self) -> str:
        return f"scaleway-api ({self.model})"

    def transcribe(self, audio_file: str) -> dict:
        file_size = os.path.getsize(audio_file)
        logger.info(
            f"Sending {audio_file} ({file_size / 1024 / 1024:.1f}MB) to Scaleway API"
        )

        start_time = time.time()

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                with open(audio_file, "rb") as f:
                    response = requests.post(
                        self.API_URL,
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        files={"file": (os.path.basename(audio_file), f)},
                        data={
                            "model": self.model,
                            "response_format": "json",
                            "language": "en",
                        },
                        timeout=600,  # 10 min timeout for large files
                    )

                if response.status_code == 200:
                    result = response.json()
                    elapsed = time.time() - start_time
                    logger.info(
                        f"Scaleway API transcription completed in {elapsed:.1f}s"
                    )
                    return self._convert_response(result)

                elif response.status_code == 429:
                    wait = self.RETRY_DELAY * attempt
                    logger.warning(
                        f"Rate limited (429), retrying in {wait}s (attempt {attempt}/{self.MAX_RETRIES})"
                    )
                    time.sleep(wait)
                    continue

                else:
                    logger.error(
                        f"Scaleway API error {response.status_code}: {response.text[:500]}"
                    )
                    if attempt < self.MAX_RETRIES:
                        time.sleep(self.RETRY_DELAY)
                        continue
                    raise RuntimeError(
                        f"Scaleway API failed after {self.MAX_RETRIES} attempts: {response.status_code}"
                    )

            except requests.exceptions.Timeout:
                logger.error(f"Scaleway API timeout (attempt {attempt}/{self.MAX_RETRIES})")
                if attempt < self.MAX_RETRIES:
                    time.sleep(self.RETRY_DELAY)
                    continue
                raise

        raise RuntimeError("Scaleway API failed after all retries")

    def _convert_response(self, api_response: dict) -> dict:
        """Convert Scaleway API response to WhisperX segment format."""
        # Scaleway returns {"text": "...", "usage": {"seconds": N}}
        # If segments are available, use them; otherwise create a single segment
        if "segments" in api_response and api_response["segments"]:
            segments = [
                {
                    "start": seg.get("start", 0.0),
                    "end": seg.get("end", 0.0),
                    "text": seg.get("text", "").strip(),
                }
                for seg in api_response["segments"]
            ]
        else:
            # Full text as single segment
            duration = api_response.get("usage", {}).get("seconds", 0)
            text = api_response.get("text", "").strip()
            segments = [{"start": 0.0, "end": float(duration), "text": text}] if text else []

        return {
            "segments": segments,
            "language": api_response.get("language", "en"),
        }

    def cleanup(self):
        pass


class ScalewayGPUBackend(TranscriptionBackend):
    """
    Transcribe using an on-demand Scaleway L4 GPU instance.
    Starts the instance, runs transcription via SSH, stops when done.
    Requires SCW_SECRET_KEY, SCW_GPU_INSTANCE_ID, and SSH access.
    """

    def __init__(
        self,
        instance_id: Optional[str] = None,
        zone: str = "fr-par-2",
        ssh_key_path: Optional[str] = None,
    ):
        self.instance_id = instance_id or os.environ.get("SCW_GPU_INSTANCE_ID", "")
        self.zone = zone
        self.ssh_key_path = ssh_key_path or os.environ.get(
            "SCW_GPU_SSH_KEY", os.path.expanduser("~/.ssh/id_rsa")
        )

        if not self.instance_id:
            raise ValueError(
                "ScalewayGPUBackend requires SCW_GPU_INSTANCE_ID environment variable"
            )

        logger.info(
            f"ScalewayGPUBackend: instance={self.instance_id}, zone={self.zone}"
        )

    def name(self) -> str:
        return f"scaleway-gpu (instance {self.instance_id[:8]}...)"

    def _run_scw(self, *args) -> str:
        cmd = ["scw", "instance", "server", *args, f"zone={self.zone}"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"scw command failed: {result.stderr}")
        return result.stdout.strip()

    def _get_ip(self) -> str:
        output = self._run_scw("get", self.instance_id, "-o", "json")
        data = json.loads(output)
        return data.get("public_ip", {}).get("address", "")

    def _wait_for_ssh(self, ip: str, timeout: int = 180):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                result = subprocess.run(
                    [
                        "ssh",
                        "-o",
                        "ConnectTimeout=5",
                        "-o",
                        "StrictHostKeyChecking=no",
                        "-i",
                        self.ssh_key_path,
                        f"root@{ip}",
                        "true",
                    ],
                    capture_output=True,
                    timeout=10,
                )
                if result.returncode == 0:
                    return
            except subprocess.TimeoutExpired:
                pass
            time.sleep(5)
        raise TimeoutError(f"SSH to {ip} not available after {timeout}s")

    def transcribe(self, audio_file: str) -> dict:
        logger.info(f"Starting GPU instance {self.instance_id}")
        start_time = time.time()

        try:
            # Start instance
            self._run_scw("start", self.instance_id, "--wait")
            ip = self._get_ip()
            logger.info(f"GPU instance started at {ip}")

            # Wait for SSH
            self._wait_for_ssh(ip)

            ssh_base = [
                "ssh",
                "-o",
                "StrictHostKeyChecking=no",
                "-i",
                self.ssh_key_path,
                f"root@{ip}",
            ]
            scp_base = [
                "scp",
                "-o",
                "StrictHostKeyChecking=no",
                "-i",
                self.ssh_key_path,
            ]

            # Upload audio file
            remote_audio = f"/tmp/{os.path.basename(audio_file)}"
            remote_output = f"/tmp/transcript.json"
            subprocess.run(
                [*scp_base, audio_file, f"root@{ip}:{remote_audio}"],
                check=True,
                timeout=120,
            )

            # Run transcription on GPU
            cmd = (
                f"docker run --rm --gpus all "
                f"-v /tmp:/data "
                f"ghcr.io/fedirz/faster-whisper-server:latest-cuda "
                f"python -c \""
                f"from faster_whisper import WhisperModel; "
                f"import json; "
                f"m = WhisperModel('large-v3', device='cuda', compute_type='float16'); "
                f"segs, info = m.transcribe('/data/{os.path.basename(audio_file)}', beam_size=5, language='en'); "
                f"result = [{{'start': s.start, 'end': s.end, 'text': s.text}} for s in segs]; "
                f"json.dump({{'segments': result, 'language': 'en'}}, open('/data/transcript.json', 'w'))"
                f"\""
            )
            subprocess.run(
                [*ssh_base, cmd],
                check=True,
                timeout=600,
            )

            # Download result
            local_output = f"/tmp/transcript_{os.path.basename(audio_file)}.json"
            subprocess.run(
                [*scp_base, f"root@{ip}:{remote_output}", local_output],
                check=True,
                timeout=60,
            )

            with open(local_output) as f:
                result = json.load(f)

            elapsed = time.time() - start_time
            logger.info(f"GPU transcription completed in {elapsed:.1f}s")
            return result

        finally:
            # Always power off to avoid charges
            try:
                logger.info(f"Powering off GPU instance {self.instance_id}")
                self._run_scw("stop", self.instance_id)
            except Exception as e:
                logger.error(f"Failed to stop GPU instance: {e}")

    def cleanup(self):
        pass


def get_transcription_backend(
    model_parameters: Optional[Dict] = None,
    backend_override: Optional[str] = None,
) -> TranscriptionBackend:
    """
    Factory function to create the appropriate transcription backend.

    Priority for 'auto' mode:
    1. Local GPU (CUDA available) → local with large-v3
    2. Scaleway API (SCW_SECRET_KEY set) → managed API
    3. Local CPU fallback → local with small.en
    """
    backend_name = (
        backend_override
        or os.environ.get("TRANSCRIPTION_BACKEND", "auto")
    ).lower()

    model_params = model_parameters or {}

    if backend_name == "auto":
        if torch.cuda.is_available():
            logger.info("Auto-detected CUDA GPU → using local Whisper with large-v3")
            return LocalWhisperBackend(
                model="large-v3",
                compute_type="float16",
                device="cuda",
                batch_size=model_params.get("batch_size", 16),
                models_dir=model_params.get("models_dir", "assets/models"),
                diarize=model_params.get("diarize", False),
                hf_token=model_params.get("hf_token"),
            )
        elif os.environ.get("SCW_SECRET_KEY"):
            logger.info("No GPU, SCW_SECRET_KEY found → using Scaleway API")
            return ScalewayAPIBackend()
        else:
            logger.info("No GPU, no API key → using local Whisper with small.en on CPU")
            return LocalWhisperBackend(
                model="small.en",
                compute_type="float32",
                device="cpu",
                batch_size=model_params.get("batch_size", 16),
                models_dir=model_params.get("models_dir", "assets/models"),
            )

    elif backend_name == "local":
        return LocalWhisperBackend(
            model=model_params.get("whisper_model", "small.en"),
            compute_type=model_params.get("compute_type", "float32"),
            device=model_params.get("device", "cpu"),
            batch_size=model_params.get("batch_size", 16),
            device_index=model_params.get("device_index", 0),
            models_dir=model_params.get("models_dir", "assets/models"),
            diarize=model_params.get("diarize", False),
            hf_token=model_params.get("hf_token"),
        )

    elif backend_name == "scaleway-api":
        return ScalewayAPIBackend()

    elif backend_name == "scaleway-gpu":
        return ScalewayGPUBackend()

    else:
        raise ValueError(
            f"Unknown transcription backend: {backend_name}. "
            f"Valid options: auto, local, scaleway-api, scaleway-gpu"
        )
