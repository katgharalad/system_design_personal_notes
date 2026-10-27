# Manim visual learning pipeline

This directory holds the source of truth for programmatic teaching animations. The React app remains responsible for playback, checkpoints, architecture editing, sliders, and calculations.

## Render reviewed scenes

From the repository root on macOS or Linux:

```bash
uv venv animations/.venv --python 3.12
uv pip install --python animations/.venv/bin/python -r animations/requirements.txt
animations/.venv/bin/python animations/render.py
animations/.venv/bin/python animations/render.py --storyboard sqs-redelivery.json
animations/.venv/bin/python animations/render.py --storyboard ec2-asg.json
animations/.venv/bin/python animations/render.py --storyboard ecs-task-reconciliation.json
cd aws/compute-app
npm ci
npm test
npm run build
```

Manim Community 0.22.0 and imageio-ffmpeg 0.6.0 are pinned. The bundled FFmpeg binary avoids dependence on a system FFmpeg path. A source hash skips rendering when scene, theme, storyboard, requirements, and render script are unchanged. Manim also caches partial movies in ignored `animations/build/`. Use `animations/.venv/bin/python animations/render.py --force` to render again. For a new scene, pass `--storyboard new-scene.json`; the script reads its scene file, timing output, poster time, and stable ID from that JSON. Rendered entries merge into the shared manifest.

The render publishes MP4, WebM, poster PNG, and WebVTT to `aws/compute-app/public/animations/`. It generates `animations/manifest.json` and a copy at `aws/compute-app/src/animation-manifest.json`. Stable ID `lambda-execution-lifecycle-v1` links the files, Lambda lesson, timeline chapters, checkpoints, and question sequence. The Vite build copies media into `aws/compute/animations/`; the service worker caches it and handles byte-range requests for offline seeking.

## Review contract for each future scene

Add a storyboard JSON with objectives, technical assumptions, Hinglish explanation, and direct source URLs. Show a mechanism and a consequence. Each chapter needs a lesson anchor. Each checkpoint needs a correct answer, explanation, and interview question. Render first, inspect frames and timing, run asset tests, then add the scene to the manifest. Keep live controls and architecture edits in React/TypeScript.

Four scenes have passed this workflow: Lambda execution lifecycle, SQS redelivery/idempotency, EC2 Auto Scaling capacity, and ECS task reconciliation. The ECS scene distinguishes placement, image pull, process startup, `RUNNING`, and ALB target health; it shows why replacing a task with unchanged invalid inputs repeats the incident. The SQS scene shows a partial side effect followed by batch replay, then contrasts whole-batch failure with partial batch response. The Auto Scaling scene distinguishes desired from ALB-healthy capacity and tests an AZ-loss capacity gap. Timelines and capacities are illustrative, not AWS service timing guarantees. Planned mechanisms include ALB registration, VPC routing, database connection pooling, and JavaScript event loop.
