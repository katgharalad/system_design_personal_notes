"""Render a reviewed storyboard and publish deterministic public asset paths.

Run from the repository root after installing requirements into animations/.venv:
animations/.venv/bin/python animations/render.py
"""
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import av
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
APP = ROOT.parent / "aws" / "compute-app"
PUBLIC = APP / "public" / "animations"
BUILD = ROOT / "build"
FPS = 24


def clock(seconds):
    millis = round(seconds * 1000)
    hours, rem = divmod(millis, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}.{ms:03}"


def run(command, **kwargs):
    subprocess.run(command, check=True, **kwargs)


def main():
    storyboard_arg = next((sys.argv[index+1] for index, value in enumerate(sys.argv[:-1]) if value == "--storyboard"), "lambda-execution-lifecycle.json")
    storyboard_path = ROOT / "storyboards" / storyboard_arg
    storyboard = json.loads(storyboard_path.read_text())
    asset_id = storyboard["id"]
    scene_path = ROOT / storyboard["sceneFile"]
    timing_path = BUILD / storyboard.get("timingFile", f"{asset_id}-timing.json")
    cache_path = BUILD / f"{asset_id}-render-cache.json"
    PUBLIC.mkdir(parents=True, exist_ok=True)
    BUILD.mkdir(exist_ok=True)
    inputs = [scene_path, ROOT / "theme.py", storyboard_path, ROOT / "requirements.txt", Path(__file__)]
    digest = hashlib.sha256(b"".join(path.read_bytes() for path in inputs)).hexdigest()
    mp4 = PUBLIC / f"{asset_id}.mp4"
    webm = PUBLIC / f"{asset_id}.webm"
    vtt = PUBLIC / f"{asset_id}.vtt"
    poster = PUBLIC / f"{asset_id}-poster.png"
    metadata_only = "--metadata-only" in sys.argv
    if cache_path.exists() and not "--force" in sys.argv and not metadata_only:
        cached = json.loads(cache_path.read_text())
        if cached.get("digest") == digest and all(path.exists() for path in (mp4, webm, vtt, poster, ROOT / "manifest.json", APP / "src" / "animation-manifest.json")):
            print(f"Cache hit: {asset_id}")
            return

    if not metadata_only:
        env = dict(os.environ, PYTHONPATH=str(ROOT), ANIMATION_TIMING_FILE=str(timing_path))
        media_dir = BUILD / "manim"
        run([str(ROOT / ".venv" / "bin" / "manim"), "-qm", "--fps", str(FPS),
             "--media_dir", str(media_dir), str(scene_path), storyboard["scene"]], env=env)
        rendered = media_dir / "videos" / scene_path.stem / "720p24" / f"{storyboard['scene']}.mp4"
        if not rendered.exists():
            raise FileNotFoundError(rendered)
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        staged_mp4 = BUILD / f"{asset_id}.mp4"
        staged_webm = BUILD / f"{asset_id}.webm"
        staged_poster = BUILD / f"{asset_id}-poster.png"
        run([ffmpeg, "-y", "-i", str(rendered), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
             "-movflags", "+faststart", "-crf", "23", str(staged_mp4)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        run([ffmpeg, "-y", "-i", str(rendered), "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "35",
             str(staged_webm)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        run([ffmpeg, "-y", "-ss", str(storyboard.get("posterAtSeconds", 6)), "-i", str(staged_mp4), "-frames:v", "1", str(staged_poster)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.replace(staged_mp4,mp4)
        os.replace(staged_webm,webm)
        os.replace(staged_poster,poster)
    elif not all(path.exists() for path in (mp4, webm, poster, timing_path)):
        raise FileNotFoundError("Metadata-only mode needs existing rendered assets and timing file")
    timing = json.loads(timing_path.read_text())
    marks = timing["marks"]
    with av.open(str(mp4)) as container:
        duration = float(container.duration / av.time_base)
    scale = duration / marks["end"]
    cues = timing["cues"]
    lines = ["WEBVTT", ""]
    for index, cue in enumerate(cues):
        end = cues[index + 1]["start"] * scale if index + 1 < len(cues) else duration
        lines.extend([str(index+1), f"{clock(cue['start'] * scale)} --> {clock(end)}", cue["text"], ""])
    vtt.write_text("\n".join(lines))
    entry = {key: storyboard[key] for key in ("id", "title", "lessonId", "interviewSequence", "status", "objectives", "assumptions", "hinglish", "sources")}
    entry.update({"mp4": f"/aws/compute/animations/{asset_id}.mp4", "webm": f"/aws/compute/animations/{asset_id}.webm",
                  "poster": f"/aws/compute/animations/{asset_id}-poster.png",
                  "captions": f"/aws/compute/animations/{asset_id}.vtt", "duration": duration,
                  "cues": [{"atSeconds": round(cue["start"] * scale, 3),
                            "endSeconds": round((cues[index+1]["start"] * scale if index+1<len(cues) else duration), 3),
                            "text": cue["text"]} for index, cue in enumerate(cues)],
                  "chapters": [{**chapter, "atSeconds": round(marks[chapter["mark"]] * scale, 3)} for chapter in storyboard["chapters"]],
                  "checkpoints": [{**checkpoint, "atSeconds": round(marks[checkpoint["mark"]] * scale, 3)} for checkpoint in storyboard["checkpoints"]]})
    old = json.loads((ROOT / "manifest.json").read_text()) if (ROOT / "manifest.json").exists() else {"animations": []}
    entries = [item for item in old["animations"] if item["id"] != asset_id] + [entry]
    manifest = {"schemaVersion": 1, "animations": sorted(entries, key=lambda item: item["id"])}
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (APP / "src" / "animation-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    cache_path.write_text(json.dumps({"digest": digest, "duration": duration}, indent=2) + "\n")
    print(f"Published {asset_id}: {duration:.2f}s, MP4 {mp4.stat().st_size:,} bytes, WebM {webm.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
