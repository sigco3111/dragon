"""Installed Pillow only: explicit owned PNG fixture paths, no product dependency."""
import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
try:
    files = json.load(sys.stdin)
except (json.JSONDecodeError, UnicodeDecodeError, OSError) as error:
    raise ValueError("invalid owned PNG oracle input JSON") from error
if not isinstance(files, list) or len(files) > 128:
    raise ValueError("bounded owned PNG oracle list required")
results = []
for name in files:
    if not isinstance(name, str) or not re.fullmatch(
        r"\.dragon-analysis/editor-phase/portrait-png-safety-r1/attempt[1-9][0-9]{0,2}/fixture-[0-9]+\.png", name
    ):
        raise ValueError("outside portrait PNG fixture whitelist")
    path = (ROOT / name).resolve(strict=True)
    if not path.is_relative_to(ROOT.resolve()):
        raise ValueError("fixture path escaped repository")
    with Image.open(path) as image:
        if image.format != "PNG" or image.size != (128, 128) or getattr(image, "n_frames", 1) != 1:
            raise ValueError("portrait fixture dimensions/frames")
        results.append({"path": name, "pixelSha": hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest()})
print(json.dumps({"oracle": "installed-Pillow", "results": results}))
