"""
rooms.py

Labels each frame from frames.py with a room type (bedroom, kitchen, ...)
using CLIP zero-shot classification. No training needed: CLIP compares each
image to text like "a photo of a bedroom" and picks the closest match.

Input:  a frames folder made by frames.py (frame_XXXX.jpg + manifest.json)
Output: rooms.json in the same folder, with
  * a label and confidence for every frame
  * "chapters": stretches of the video that stay in one room

Video frames come in time order and people don't teleport between rooms,
so scores are smoothed over neighboring frames before picking a label.
That stops one odd frame from flipping "kitchen" to "bathroom" for half a second.

Usage:
  python rooms.py out_listing
  python rooms.py out_listing --sort       # also copy frames into room subfolders

First run downloads the CLIP model (about 600 MB), so it takes a while.
"""

import argparse
import json
import shutil
from pathlib import Path

import numpy as np

# Each room gets a few phrasings. CLIP scores are averaged across them,
# which is more reliable than a single prompt.
# Describe each room by things only that room has. Shared objects (a sink is
# in both kitchens and bathrooms) pull rooms together and cause confusions.
ROOM_PROMPTS = {
    "bedroom": ["a photo of a bedroom", "a bed with pillows and a blanket",
                "a small dorm bedroom with a bed and a desk"],
    "kitchen": ["a photo of a kitchen", "a kitchen with a stove and oven",
                "a stainless steel fridge in a kitchen", "a microwave above a stove",
                "kitchen cabinets above a countertop"],
    "bathroom": ["a photo of a bathroom", "a white toilet in a bathroom",
                 "a shower curtain over a bathtub", "a bathtub with a shower head",
                 "a bathroom with a toilet and tiled walls"],
    "living room": ["a photo of a living room", "a living room with a sofa and coffee table",
                    "a couch in an apartment living room"],
    "dining area": ["a photo of a dining area", "a dining table with chairs",
                    "a table set with plates"],
    "hallway": ["a photo of a hallway", "a long narrow hallway with doors on the side",
                "an empty apartment corridor with wood floors"],
    "closet": ["a photo of a closet", "clothes on hangers in a closet", "an open wardrobe",
               "shelves with folded clothes", "an empty closet with a clothes rod and wire shelf"],
    "entrance": ["a photo of an apartment entrance", "an apartment front door seen from inside"],
    "balcony": ["a photo of a balcony", "an outdoor balcony with a railing"],
}

# Decoys: things that show up in walkthrough videos but are not a room. They
# compete with the rooms so that, e.g., a city view through a window doesn't
# get forced into "balcony". Names start with "_" and are never output.
DECOY_PROMPTS = {
    "_window": ["a view of a city through a window", "a window with blinds",
                "an air conditioner unit under a window"],
    "_wall": ["a blank wall", "a close-up of a white door", "a framed poster on a wall"],
}

# What a frame is labeled when a decoy wins. Missing or None = "unsure".
# Map a decoy to a room name to count it as that room instead.
DECOY_SHADOWS = {
    "_window": None,
    "_wall": None,
}

DEFAULT_MODEL = "openai/clip-vit-base-patch32"


class ClipRoomClassifier:
    """Wraps a CLIP model. Returns room probabilities for a batch of images."""

    def __init__(self, model_name: str = DEFAULT_MODEL):
        import torch
        from transformers import CLIPModel, CLIPProcessor

        self.torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = CLIPModel.from_pretrained(model_name).to(self.device).eval()
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.rooms = list(ROOM_PROMPTS)
        prompts = {**ROOM_PROMPTS, **DECOY_PROMPTS}
        # Rooms first, then decoys. predict() returns one column per class.
        self.classes = list(prompts)

        # Encode every prompt once, then average per class.
        texts, owner = [], []
        for i, name in enumerate(self.classes):
            for t in prompts[name]:
                texts.append(t)
                owner.append(i)
        with torch.no_grad():
            tok = self.processor(text=texts, return_tensors="pt", padding=True).to(self.device)
            t_emb = self.model.get_text_features(**tok)
            t_emb = t_emb / t_emb.norm(dim=-1, keepdim=True)
        owner = torch.tensor(owner, device=self.device)
        room_emb = torch.stack([t_emb[owner == i].mean(0) for i in range(len(self.classes))])
        self.room_emb = room_emb / room_emb.norm(dim=-1, keepdim=True)
        self.scale = self.model.logit_scale.exp()

    def predict(self, images) -> np.ndarray:
        """images: list of PIL images. Returns (n_images, n_classes) probabilities,
        columns in self.classes order (rooms, then decoys)."""
        with self.torch.no_grad():
            inp = self.processor(images=images, return_tensors="pt").to(self.device)
            i_emb = self.model.get_image_features(**inp)
            i_emb = i_emb / i_emb.norm(dim=-1, keepdim=True)
            logits = self.scale * i_emb @ self.room_emb.T
            return logits.softmax(dim=-1).cpu().numpy()


def smooth(probs: np.ndarray, window: int) -> np.ndarray:
    """Average each frame's probabilities with its neighbors (time order)."""
    if window <= 1 or len(probs) < 2:
        return probs
    half = window // 2
    out = np.empty_like(probs)
    for i in range(len(probs)):
        lo, hi = max(0, i - half), min(len(probs), i + half + 1)
        out[i] = probs[lo:hi].mean(0)
    return out


def make_chapters(frames: list[dict]) -> list[dict]:
    """Group consecutive frames with the same room into chapters."""
    chapters = []
    for f in frames:
        if chapters and chapters[-1]["room"] == f["room"]:
            ch = chapters[-1]
            ch["end_sec"] = f["time_sec"]
            ch["files"].append(f["file"])
        else:
            chapters.append({"room": f["room"], "start_sec": f["time_sec"],
                             "end_sec": f["time_sec"], "files": [f["file"]]})
    return chapters


def run(frames_dir: str, model_name: str = DEFAULT_MODEL, window: int = 5,
        min_conf: float = 0.35, batch: int = 16, sort: bool = False,
        classifier=None) -> dict:
    from PIL import Image

    folder = Path(frames_dir)
    manifest_path = folder / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"No manifest.json in {folder}. Run frames.py first.")
    manifest = json.loads(manifest_path.read_text())
    records = manifest["frames"]
    if not records:
        raise SystemExit("Manifest has no frames.")

    clf = classifier or ClipRoomClassifier(model_name)
    classes = getattr(clf, "classes", clf.rooms)

    def label(name: str) -> str:
        if name.startswith("_"):
            return DECOY_SHADOWS.get(name) or "unsure"
        return name

    probs = []
    for i in range(0, len(records), batch):
        imgs = [Image.open(folder / r["file"]).convert("RGB") for r in records[i:i + batch]]
        probs.append(clf.predict(imgs))
        print(f"  classified {min(i + batch, len(records))}/{len(records)}")
    raw = np.concatenate(probs)
    smoothed = smooth(raw, window)

    out_frames = []
    for r, p_raw, p in zip(records, raw, smoothed):
        top = np.argsort(p)[::-1][:3]
        conf = float(p[top[0]])
        out_frames.append({
            "file": r["file"],
            "time_sec": r["time_sec"],
            "room": label(classes[top[0]]) if conf >= min_conf else "unsure",
            "confidence": round(conf, 3),
            "raw_room": label(classes[int(np.argmax(p_raw))]),
            "top3": {classes[k]: round(float(p[k]), 3) for k in top},
        })

    result = {
        "frames_dir": str(folder),
        "model": model_name,
        "smoothing_window": window,
        "min_confidence": min_conf,
        "counts": {k: sum(f["room"] == k for f in out_frames)
                   for k in sorted({f["room"] for f in out_frames})},
        "chapters": make_chapters(out_frames),
        "frames": out_frames,
    }
    (folder / "rooms.json").write_text(json.dumps(result, indent=2))

    if sort:
        for f in out_frames:
            dest = folder / "by_room" / f["room"].replace(" ", "_")
            dest.mkdir(parents=True, exist_ok=True)
            shutil.copy2(folder / f["file"], dest / f["file"])

    return result


def main():
    p = argparse.ArgumentParser(description="Label frames by room type with CLIP.")
    p.add_argument("frames_dir", help="folder made by frames.py")
    p.add_argument("--model", default=DEFAULT_MODEL, help="Hugging Face CLIP model")
    p.add_argument("--window", type=int, default=5,
                   help="smooth over this many neighboring frames (1 = off)")
    p.add_argument("--min-conf", type=float, default=0.35,
                   help="below this confidence the label is 'unsure'")
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--sort", action="store_true",
                   help="also copy frames into by_room/<room>/ folders")
    a = p.parse_args()

    r = run(a.frames_dir, a.model, a.window, a.min_conf, a.batch, a.sort)
    print(f"\nRooms: {r['counts']}")
    print("Chapters:")
    for ch in r["chapters"]:
        print(f"  {ch['start_sec']:6.1f}s to {ch['end_sec']:6.1f}s  {ch['room']} "
              f"({len(ch['files'])} frames)")
    print(f"Saved {a.frames_dir}/rooms.json")
    if a.sort:
        print(f"Sorted copies in {a.frames_dir}/by_room/")


if __name__ == "__main__":
    main()
