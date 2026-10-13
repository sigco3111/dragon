"""Independent Pillow pixel oracle. Only new synthetic Trial PNG scope files."""
import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image

if len(sys.argv) != 2 or not re.fullmatch(r'\.dragon-analysis/editor-phase/trial-portrait-png-r1/attempt[1-9][0-9]{0,2}', sys.argv[1]):
    raise SystemExit('owned scope required')
try:
    scope = Path(sys.argv[1]).resolve(strict=True)
    items = json.loads((scope / 'oracle.json').read_text(encoding='utf8'))
except (OSError, ValueError) as error:
    raise SystemExit('owned scope manifest unavailable or invalid') from error
assert isinstance(items, list) and 1 <= len(items) <= 100
for item in items:
    assert set(item) == {'file', 'width', 'height', 'pixelSHA'}
    assert re.fullmatch(r'image-[0-9]+\.png', item['file'])
    p = (scope / item['file']).resolve(strict=True)
    assert p.parent == scope
    with Image.open(p) as im:
        assert im.format == 'PNG' and getattr(im, 'n_frames', None) == 1
        assert im.size == (item['width'], item['height'])
        assert 1 <= im.width <= 8192 and 1 <= im.height <= 8192 and im.width * im.height <= 4 * 1024 * 1024
        pixels = im.convert('RGBA').tobytes()
    assert hashlib.sha256(pixels).hexdigest() == item['pixelSHA'], item['file']
print('Pillow Trial PNG exact RGBA PASS', len(items))
