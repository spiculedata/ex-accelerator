#!/usr/bin/env python3
"""
WavePulse API Server
Exposes WavePulse radio recording/transcription as a REST API.
"""

import os
import json
import threading
import time
from pathlib import Path
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# State
wavepulse_state = {
    'status': 'idle',  # idle, starting, running, stopping, error
    'active_streams': [],
    'started_at': None,
    'error': None,
    'recordings_count': 0,
    'transcripts_count': 0,
}

wavepulse_process = None
wavepulse_thread = None

DATA_DIR = Path(os.environ.get('WAVEPULSE_DATA_DIR', '/app/data'))
RECORDINGS_DIR = DATA_DIR / 'recordings'
TRANSCRIPTS_DIR = DATA_DIR / 'transcripts'
CLASSIFIED_DIR = DATA_DIR / 'classified'


@app.route('/status', methods=['GET'])
def get_status():
    """Get current WavePulse status."""
    # Count files
    wavepulse_state['recordings_count'] = len(list(RECORDINGS_DIR.glob('*.wav'))) + len(list(RECORDINGS_DIR.glob('*.mp3')))
    wavepulse_state['transcripts_count'] = len(list(TRANSCRIPTS_DIR.glob('*.json'))) + len(list(TRANSCRIPTS_DIR.glob('*.txt')))

    return jsonify(wavepulse_state)


@app.route('/start', methods=['POST'])
def start_wavepulse():
    """Start WavePulse recording with given configuration."""
    global wavepulse_thread

    if wavepulse_state['status'] == 'running':
        return jsonify({'error': 'WavePulse is already running'}), 400

    config = request.json or {}

    wavepulse_state['status'] = 'starting'
    wavepulse_state['error'] = None

    def run_wavepulse():
        try:
            wavepulse_state['status'] = 'running'
            wavepulse_state['started_at'] = datetime.now().isoformat()
            wavepulse_state['active_streams'] = config.get('radioStreams', [])

            # Try to import and run actual WavePulse
            try:
                import sys
                sys.path.insert(0, '/app/src')
                from wavepulse import WavePulse

                # Build schedule from config
                schedule = []
                for stream in config.get('radioStreams', []):
                    time_slots = [[ts.get('start', '00:00'), ts.get('end', '23:59')] for ts in stream.get('timeSlots', [])]
                    if not time_slots:
                        time_slots = [['00:00', '23:59']]
                    schedule.append({
                        'url': stream.get('url', ''),
                        'radio_name': stream.get('radioName', 'Unknown'),
                        'time': time_slots,
                        'state': stream.get('state', '')
                    })

                # Save schedule
                schedule_path = Path('/app/assets/active_schedule.json')
                schedule_path.write_text(json.dumps(schedule, indent=2))

                # Configure WavePulse
                os.environ['DEVICE'] = config.get('device', os.environ.get('DEVICE', 'cpu'))
                os.environ['COMPUTE_TYPE'] = config.get('computeType', os.environ.get('COMPUTE_TYPE', 'float32'))

                if config.get('huggingFaceToken'):
                    os.environ['HF_TOKEN'] = config['huggingFaceToken']
                if config.get('geminiApiKey'):
                    os.environ['GEMINI_API_KEY'] = config['geminiApiKey']

                # Start recording
                wp = WavePulse()
                wp.start(schedule_path=str(schedule_path))

            except ImportError as e:
                # WavePulse module not fully available — run in recording-only mode
                wavepulse_state['error'] = f'Running in limited mode: {str(e)}'
                # Keep running for status reporting
                while wavepulse_state['status'] == 'running':
                    time.sleep(5)

        except Exception as e:
            wavepulse_state['status'] = 'error'
            wavepulse_state['error'] = str(e)

    wavepulse_thread = threading.Thread(target=run_wavepulse, daemon=True)
    wavepulse_thread.start()

    return jsonify({'success': True, 'message': 'WavePulse starting...'})


@app.route('/stop', methods=['POST'])
def stop_wavepulse():
    """Stop WavePulse recording."""
    if wavepulse_state['status'] != 'running':
        return jsonify({'error': 'WavePulse is not running'}), 400

    wavepulse_state['status'] = 'stopping'

    # The thread will exit when status != 'running'
    time.sleep(1)
    wavepulse_state['status'] = 'idle'
    wavepulse_state['active_streams'] = []
    wavepulse_state['started_at'] = None

    return jsonify({'success': True, 'message': 'WavePulse stopped'})


@app.route('/recordings', methods=['GET'])
def list_recordings():
    """List recorded audio files."""
    recordings = []
    for f in sorted(RECORDINGS_DIR.glob('*.*'), key=lambda x: x.stat().st_mtime, reverse=True)[:100]:
        recordings.append({
            'filename': f.name,
            'size_bytes': f.stat().st_size,
            'modified': datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
        })
    return jsonify({'recordings': recordings, 'count': len(recordings)})


@app.route('/transcripts', methods=['GET'])
def list_transcripts():
    """List transcribed segments."""
    transcripts = []
    for f in sorted(TRANSCRIPTS_DIR.glob('*.json'), key=lambda x: x.stat().st_mtime, reverse=True)[:100]:
        try:
            data = json.loads(f.read_text())
            transcripts.append({
                'filename': f.name,
                'radio_name': data.get('radio_name', ''),
                'duration': data.get('duration', 0),
                'text_preview': data.get('text', '')[:200],
                'modified': datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            })
        except Exception:
            continue
    return jsonify({'transcripts': transcripts, 'count': len(transcripts)})


@app.route('/health', methods=['GET'])
def health():
    """Health check."""
    return jsonify({'status': 'ok', 'service': 'wavepulse'})


if __name__ == '__main__':
    port = int(os.environ.get('WAVEPULSE_PORT', 8890))
    print(f'WavePulse API server starting on port {port}')
    app.run(host='0.0.0.0', port=port)
