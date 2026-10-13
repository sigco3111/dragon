"""Synthetic JPEG for a new, isolated public-API lifecycle (not production I/O)."""
from pathlib import Path
import hashlib
import json
import re
import sys
from PIL import Image

if len(sys.argv) != 2 or not re.fullmatch(r"[A-Za-z0-9-]{1,64}", sys.argv[1]):
    raise ValueError("new owned lifecycle scope required")
root = Path(".dragon-analysis/editor-phase") / sys.argv[1]
if not root.is_dir():
    raise ValueError("runner must create its own scope first")
image = Image.new("RGB", (128, 128), (96, 96, 96))
exif = Image.Exif()
exif[270] = "Synthetic portrait API fixture; not user metadata"
with (root / "raw-api-jpeg.jpg").open("xb") as output:
    image.save(output, format="JPEG", quality=90, subsampling=0, exif=exif)
raw = (root / "raw-api-jpeg.jpg").read_bytes()
assert len(raw) <= 100 * 1024 and b"Exif\0\0" in raw
with Image.open(root / "raw-api-jpeg.jpg") as decoded:
    pixels = decoded.convert("RGBA").tobytes()
assert pixels == bytes((96, 96, 96, 255)) * (128 * 128)
print(json.dumps({"sourceSha256": hashlib.sha256(raw).hexdigest(),
                  "sourceByteLength": len(raw),
                  "referenceRGBASha256": hashlib.sha256(pixels).hexdigest()}))
