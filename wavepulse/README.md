# WavePulse radio service

Radio recording, transcription and analysis service used by ex-accelerator.

## Attribution

This directory is a derivative work of **[WavePulse](https://github.com/NYU-DICE-Lab/WavePulse)**
by Govind Mittal, Chinmay Hegde et al., New York University, licensed under the
[Apache License 2.0](LICENSE). See the upstream paper/README for the research behind it.

- Upstream copyright and notices are preserved verbatim in [`NOTICE`](NOTICE).
- Files we changed carry a "Modified by ex-accelerator contributors" header (see git history
  for details). `src/audio_processor/transcription_backends.py`, `api_server.py` and
  `local_classifier.py` are additions that are not part of upstream.

### Important: patent and commercial-use notice

The upstream `NOTICE` states that the software "includes technology covered under a pending
U.S. provisional patent application" (assignee: New York University) and that "commercial use
of this software may require additional licensing arrangements". Anyone using this component
commercially should read `NOTICE` and contact NYU's Technology Transfer Office.
This is not legal advice.
