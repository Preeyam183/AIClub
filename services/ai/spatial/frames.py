"""
frames.py

Shared base for RentCheck NB CV features.
Pulls clean frames out of a phone video for:
  * listing mode: walkthrough video -> distinct, sharp frames for listing photos
  * pano mode:    spin-in-place video -> evenly spaced, sharp frames for stitching

How it works:
  1. Split the video into short time windows (1 / fps seconds each).
  2. In each window, keep only the sharpest frame (Laplacian variance).
  3. Drop frames that are too blurry or too dark/bright compared to the rest.
  4. Listing mode only: drop near duplicates (perceptual hash), since a
     walkthrough has lots of frames of the same wall.
     Pano mode keeps neighbors, because stitching needs overlap.
  5. Save frames as JPGs plus a manifest.json with scores for each frame.

Usage:
  python frames.py video.mp4 out_dir --mode listing
  python frames.py spin.mp4 out_dir --mode pano --fps 3
"""

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


# ---------- scoring ----------

def sharpness(gray: np.ndarray) -> float:
    """Higher = sharper. Variance of the Laplacian (edge strength)."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def brightness(gray: np.ndarray) -> float:
    """Mean pixel value, 0 (black) to 255 (white)."""
    return float(gray.mean())


def dhash(gray: np.ndarray, size: int = 8) -> int:
    """Difference hash. Similar images give similar hashes."""
    small = cv2.resize(gray, (size + 1, size), interpolation=cv2.INTER_AREA)
    diff = small[:, 1:] > small[:, :-1]
    return int("".join("1" if b else "0" for b in diff.flatten()), 2)


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


# ---------- main steps ----------

def sample_sharpest(video_path: str, fps: float, max_side: int):
    """Return the sharpest frame from each 1/fps second window."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise SystemExit(f"Could not open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    window = max(1, int(round(video_fps / fps)))  # frames per window

    picks, best, idx = [], None, 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        h, w = frame.shape[:2]
        scale = max_side / max(h, w)
        if scale < 1:
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)),
                               interpolation=cv2.INTER_AREA)

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        s = sharpness(gray)
        if best is None or s > best["sharpness"]:
            best = {"frame": frame, "gray": gray, "index": idx,
                    "time": idx / video_fps, "sharpness": s}

        idx += 1
        if idx % window == 0:
            picks.append(best)
            best = None

    if best is not None:
        picks.append(best)
    cap.release()
    return picks, video_fps, idx


def filter_quality(frames, blur_ratio: float, dark: float, bright: float):
    """Drop frames much blurrier than the video's median, or badly exposed."""
    if not frames:
        return [], []
    median_sharp = float(np.median([f["sharpness"] for f in frames]))
    keep, dropped = [], []
    for f in frames:
        f["brightness"] = brightness(f["gray"])
        if f["brightness"] < dark:
            f["dropped"] = "too dark"
        elif f["brightness"] > bright:
            f["dropped"] = "too bright"
        elif f["sharpness"] < blur_ratio * median_sharp:
            f["dropped"] = "blurry"
        else:
            keep.append(f)
            continue
        dropped.append(f)
    return keep, dropped


def remove_duplicates(frames, max_dist: int):
    """Keep a frame only if it looks different from every frame already kept."""
    keep, dropped, hashes = [], [], []
    for f in frames:
        h = dhash(f["gray"])
        if any(hamming(h, k) <= max_dist for k in hashes):
            f["dropped"] = "duplicate"
            dropped.append(f)
        else:
            hashes.append(h)
            keep.append(f)
    return keep, dropped


def save(frames, dropped, out_dir: Path, meta: dict):
    out_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for n, f in enumerate(frames):
        name = f"frame_{n:04d}.jpg"
        cv2.imwrite(str(out_dir / name), f["frame"],
                    [cv2.IMWRITE_JPEG_QUALITY, 92])
        records.append({
            "file": name,
            "source_frame": f["index"],
            "time_sec": round(f["time"], 2),
            "sharpness": round(f["sharpness"], 1),
            "brightness": round(f["brightness"], 1),
        })

    manifest = {
        **meta,
        "kept": len(records),
        "dropped": len(dropped),
        "dropped_reasons": {
            r: sum(1 for d in dropped if d["dropped"] == r)
            for r in sorted({d["dropped"] for d in dropped})
        },
        "frames": records,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def run(video: str, out: str, mode: str, fps: float | None = None,
        max_side: int = 1600, blur_ratio: float = 0.4,
        dark: float = 35, bright: float = 225, dup_dist: int = 10) -> dict:
    """Run the whole pipeline. Importable from other modules."""
    if fps is None:
        fps = 2.0 if mode == "listing" else 3.0

    sampled, video_fps, total = sample_sharpest(video, fps, max_side)
    kept, dropped = filter_quality(sampled, blur_ratio, dark, bright)
    if mode == "listing":
        kept, dups = remove_duplicates(kept, dup_dist)
        dropped += dups

    meta = {"video": str(video), "mode": mode, "sample_fps": fps,
            "video_fps": round(video_fps, 2), "video_frames": total,
            "sampled": len(sampled)}
    return save(kept, dropped, Path(out), meta)


def main():
    p = argparse.ArgumentParser(description="Extract clean frames from a video.")
    p.add_argument("video", help="input video file")
    p.add_argument("out", help="output folder")
    p.add_argument("--mode", choices=["listing", "pano"], default="listing")
    p.add_argument("--fps", type=float, default=None,
                   help="frames to keep per second (default: listing 2, pano 3)")
    p.add_argument("--max-side", type=int, default=1600,
                   help="resize so the longest side is at most this many pixels")
    p.add_argument("--blur-ratio", type=float, default=0.4,
                   help="drop frames below this fraction of median sharpness")
    p.add_argument("--dark", type=float, default=35, help="min mean brightness")
    p.add_argument("--bright", type=float, default=225, help="max mean brightness")
    p.add_argument("--dup-dist", type=int, default=10,
                   help="listing mode: hash distance at or below this = duplicate")
    a = p.parse_args()

    m = run(a.video, a.out, a.mode, a.fps, a.max_side,
            a.blur_ratio, a.dark, a.bright, a.dup_dist)
    print(f"{m['video_frames']} video frames -> {m['sampled']} sampled -> "
          f"{m['kept']} kept. Dropped: {m['dropped_reasons'] or 'none'}")
    print(f"Saved to {a.out}/ (see manifest.json)")


if __name__ == "__main__":
    main()
