#!/usr/bin/env python3
"""
upscale-images.py
4x AI upscale (Real-ESRGAN) for the source photos used in the map-quiz
YouTube video's full-screen image carousel (gen-map-video-carousel.js).

Run on a machine with an NVIDIA GPU for speed (CPU works, just slow).

Setup:
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r scripts/requirements-upscale.txt

Usage:
    python3 scripts/upscale-images.py \
        --input-dir infograph/maps/images \
        --output-dir infograph/maps/images-4x

Options:
    --input-dir    Directory of source images (required)
    --output-dir   Directory to write upscaled images (required)
    --scale        Upscale factor (default: 4)
    --tile         Tile size for low-VRAM GPUs, 0 = no tiling (default: 0)
    --weights-dir  Where to cache downloaded model weights (default: scripts/weights)
    --format       Output format: png | jpg (default: png, lossless)
"""

import argparse
import sys
import types
from pathlib import Path
from urllib.request import urlretrieve

# ── Compat shim ──────────────────────────────────────────────────────────────
# torchvision >= 0.17 removed transforms.functional_tensor, which basicsr
# (a realesrgan dependency) still imports. Patch it back in before basicsr
# loads so this works regardless of which torchvision got installed.
try:
    import torchvision.transforms.functional_tensor  # noqa: F401
except ImportError:
    import torchvision.transforms.functional as _F
    _shim = types.ModuleType("torchvision.transforms.functional_tensor")
    _shim.rgb_to_grayscale = _F.rgb_to_grayscale
    sys.modules["torchvision.transforms.functional_tensor"] = _shim

import cv2
import numpy as np
from PIL import Image

MODEL_URL = (
    "https://github.com/xinntao/Real-ESRGAN/releases/download/"
    "v0.1.0/RealESRGAN_x4plus.pth"
)
MODEL_NAME = "RealESRGAN_x4plus.pth"
NATIVE_SCALE = 4  # this model's native upscale factor
IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def ensure_weights(weights_dir: Path) -> Path:
    weights_dir.mkdir(parents=True, exist_ok=True)
    weights_path = weights_dir / MODEL_NAME
    if not weights_path.exists():
        print(f"Downloading {MODEL_NAME}...")
        urlretrieve(MODEL_URL, weights_path)
    return weights_path


def load_upsampler(weights_path: Path, tile: int):
    import torch
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    model = RRDBNet(
        num_in_ch=3, num_out_ch=3, num_feat=64,
        num_block=23, num_grow_ch=32, scale=NATIVE_SCALE,
    )
    return RealESRGANer(
        scale=NATIVE_SCALE,
        model_path=str(weights_path),
        model=model,
        tile=tile,
        tile_pad=10,
        pre_pad=0,
        half=torch.cuda.is_available(),
    )


def upscale_one(upsampler, src: Path, dst: Path, outscale: float, fmt: str):
    # Read via PIL (reliable webp support), convert to the BGR array cv2/realesrgan expect.
    with Image.open(src) as im:
        rgb = np.array(im.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    out_bgr, _ = upsampler.enhance(bgr, outscale=outscale)

    out_rgb = cv2.cvtColor(out_bgr, cv2.COLOR_BGR2RGB)
    out_im = Image.fromarray(out_rgb)
    dst = dst.with_suffix(".png" if fmt == "png" else ".jpg")
    if fmt == "png":
        out_im.save(dst)
    else:
        out_im.save(dst, quality=95)
    print(f"{src.name} ({rgb.shape[1]}x{rgb.shape[0]}) -> {dst.name} ({out_im.width}x{out_im.height})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input-dir", required=True, type=Path)
    ap.add_argument("--output-dir", required=True, type=Path)
    ap.add_argument("--scale", type=float, default=4.0)
    ap.add_argument("--tile", type=int, default=0)
    ap.add_argument("--weights-dir", type=Path, default=Path(__file__).parent / "weights")
    ap.add_argument("--format", choices=["png", "jpg"], default="png")
    args = ap.parse_args()

    images = sorted(p for p in args.input_dir.iterdir() if p.suffix.lower() in IMG_EXTS)
    if not images:
        print(f"No images found in {args.input_dir}", file=sys.stderr)
        sys.exit(1)

    weights_path = ensure_weights(args.weights_dir)

    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}  |  {len(images)} image(s)  |  outscale={args.scale}x")

    upsampler = load_upsampler(weights_path, args.tile)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for src in images:
        dst = args.output_dir / src.name
        upscale_one(upsampler, src, dst, args.scale, args.format)


if __name__ == "__main__":
    main()
