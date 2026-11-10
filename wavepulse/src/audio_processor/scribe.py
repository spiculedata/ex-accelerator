# NOTE: Derived from NYU-DICE-Lab/WavePulse (Apache-2.0, Copyright 2024 New York University).
# Modified by Social Explorer contributors (see git history for changes). See NOTICE and README.md.
"""
Transcribe audio files from the buffer folder and save as JSON.
Uses configurable transcription backends (local Whisper, Scaleway API, or Scaleway GPU).
Deletes the temporary audio file after transcription is complete.
"""

import contextlib
import json
import os
import time

from args import get_args
from audio_processor.transcription_backends import get_transcription_backend
from loguru import logger
from typing import Dict, Tuple


def transcribe_audio(
    audio_files: Tuple[str],
    model_parameters: Dict[str, str],
    models_dir: str = "assets/models",
    transcripts_dir: str = "assets/data/transcripts",
) -> int:
    """
    Transcribe audio files using the configured backend and save them.

    Parameters:
        audio_files: Tuple of audio file paths to transcribe.
        model_parameters: Dict with device, batch_size, compute_type, whisper_model, etc.
        models_dir: Directory for model cache (local backend only).
        transcripts_dir: Path to directory that stores transcripts.

    Returns:
        Number of files transcribed in current batch.
    """
    logger.info(f"transcribing for {len(audio_files)} audio files")

    args = get_args()

    # Build backend parameters
    backend_params = {
        **model_parameters,
        "models_dir": models_dir,
        "diarize": args.diarize,
        "hf_token": args.hf_token,
    }

    # Get the configured transcription backend
    backend = get_transcription_backend(
        model_parameters=backend_params,
        backend_override=getattr(args, "transcription_backend", None),
    )
    logger.info(f"Using transcription backend: {backend.name()}")

    number_of_files_transcribed = 0

    for audio_file in audio_files:
        try:
            start_time = time.time()
            logger.info(f"starting transcription for {audio_file}")

            # Transcribe using the backend
            result = backend.transcribe(audio_file)

            elapsed = time.time() - start_time
            segment_count = len(result.get("segments", []))
            logger.info(
                f"Transcription completed in {elapsed:.1f}s ({segment_count} segments)"
            )

            # Save result to JSON in unclassified_buffer for classification
            audio_file_name = os.path.basename(audio_file)
            output_json_file = os.path.join(
                transcripts_dir,
                "unclassified_buffer",
                f"{audio_file_name[:-4]}.json",
            )

            os.makedirs(os.path.dirname(output_json_file), exist_ok=True)

            with open(output_json_file, "w") as json_file:
                json.dump(result.get("segments", []), json_file, indent=4)

            logger.info(f"Saved transcript to {output_json_file}")
            number_of_files_transcribed += 1

        except Exception as e:
            logger.error(f"Error transcribing {audio_file}: {e}", exc_info=True)
            # Still delete the file to avoid infinite retry loop
            with contextlib.suppress(FileNotFoundError):
                os.remove(audio_file)
            continue

        # Delete the audio file from buffer after successful transcription
        with contextlib.suppress(FileNotFoundError):
            os.remove(audio_file)
            logger.info(f"Deleted buffer file {audio_file}")

    # Cleanup backend resources
    backend.cleanup()

    return number_of_files_transcribed


# Driver code for standalone testing
if __name__ == "__main__":
    args = get_args()
    models_dir = os.path.join(args.assets_dir, args.models_dir)
    transcripts_dir = os.path.join(args.assets_dir, args.data_dir, args.transcripts_dir)
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(transcripts_dir, exist_ok=True)

    model_parameters = {
        "batch_size": args.whisper_batch_size,
        "compute_type": args.whisper_compute_type,
        "device": args.device,
        "whisper_model": args.whisper_model,
    }

    logger.info(f"whisper model parameters: {model_parameters}")

    # Get audio files from buffer
    buffer_dir = os.path.join(args.assets_dir, args.data_dir, args.temp_file_dir)
    audio_files = []
    if os.path.exists(buffer_dir):
        for f in os.listdir(buffer_dir):
            if f.endswith((".wav", ".mp3")):
                audio_files.append(os.path.join(buffer_dir, f))

    if audio_files:
        transcribe_audio(
            tuple(audio_files), model_parameters, models_dir, transcripts_dir
        )
    else:
        logger.info("No audio files found to transcribe")
