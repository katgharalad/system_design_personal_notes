# Manim visual learning pipeline

This directory holds the source of truth for programmatic teaching animations. The React app remains responsible for playback, checkpoints, architecture editing, sliders, and calculations.

## Render the Lambda scene

From the repository root on macOS or Linux:

```bash
uv venv animations/.venv --python 3.12
uv pip install --python animations/.venv/bin/python -r animations/requirements.txt
animations/.venv/bin/python animations/render.py
cd aws/compute-app
npm ci
npm test
npm run build
```

Manim Community 0.22.0 and imageio-ffmpeg 0.6.0 are pinned. The bundled FFmpeg binary avoids dependence on a system FFmpeg path. A source hash skips rendering when scene, theme, storyboard, requirements, and render script are unchanged. Manim also caches partial movies in ignored `animations/build/`. Use `animations/.venv/bin/python animations/render.py --force` to render again. For a new scene, pass `--storyboard new-scene.json`; the script reads its scene file, timing output, poster time, and stable ID from that JSON. Rendered entries merge into the shared manifest.

The render publishes MP4, WebM, poster PNG, and WebVTT to `aws/compute-app/public/animations/`. It generates `animations/manifest.json` and a copy at `aws/compute-app/src/animation-manifest.json`. Stable ID `lambda-execution-lifecycle-v1` links the files, Lambda lesson, timeline chapters, checkpoints, and question sequence. The Vite build copies media into `aws/compute/animations/`; the service worker caches it and handles byte-range requests for offline seeking.

## Review contract for each future scene

Add a storyboard JSON with objectives, technical assumptions, Hinglish explanation, and direct source URLs. Show a mechanism and a consequence. Each chapter needs a lesson anchor. Each checkpoint needs a correct answer, explanation, and interview question. Render first, inspect frames and timing, run asset tests, then add the scene to the manifest. Keep live controls and architecture edits in React/TypeScript.

Only the Lambda scene has passed this workflow. Planned next mechanisms: EC2 Auto Scaling, SQS redelivery, VPC routing, database connection pooling, and JavaScript event loop.
