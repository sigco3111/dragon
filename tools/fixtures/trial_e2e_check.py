"""Owned Pillow check for Trial browser-E2E served crops (E slice)."""
import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image

if len(sys.argv) != 3 or not re.fullmatch(r'\.dragon-analysis/editor-phase/trial-portrait-e2e-r1/attempt[1-9][0-9]{0,2}', sys.argv[1]):
    raise SystemExit('owned scope and explicit mode required')
scope = Path(sys.argv[1]).resolve(strict=True)
mode = sys.argv[2]


def load(name):
    try:
        return json.loads((scope / name).read_text(encoding='utf8'))
    except (OSError, ValueError) as error:
        raise SystemExit('owned JSON unavailable or invalid') from error


if mode == 'check':
    items = load('oracle.json')
    assert isinstance(items, list) and 1 <= len(items) <= 10
    for item in items:
        assert set(item) == {'file', 'width', 'height', 'pixelSHA'}
        assert re.fullmatch(r'e2e-[0-9]+\.png', item['file'])
        assert item['width'] == 128 and item['height'] == 128
        path = (scope / item['file']).resolve(strict=True)
        assert path.parent == scope
        with Image.open(path) as image:
            assert image.format == 'PNG'
            assert getattr(image, 'n_frames', 1) == 1
            assert image.size == (128, 128)
            pixels = image.convert('RGBA').tobytes()
        assert hashlib.sha256(pixels).hexdigest() == item['pixelSHA'], item['file']
    print('Pillow browser-E2E 128-output exact RGBA PASS', len(items))
else:
    raise SystemExit('unknown mode')
