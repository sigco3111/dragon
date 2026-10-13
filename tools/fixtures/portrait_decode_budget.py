"""Owned max-budget decode fixtures for the resource-budget probe (B slice)."""
import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image

if len(sys.argv) != 3 or not re.fullmatch(r'\.dragon-analysis/editor-phase/trial-portrait-budget-r1/attempt[1-9][0-9]{0,2}', sys.argv[1]):
    raise SystemExit('owned scope and explicit mode required')
scope = Path(sys.argv[1]).resolve(strict=True)
mode = sys.argv[2]


def digest(data):
    return hashlib.sha256(data).hexdigest()


if mode == 'generate':
    records = []
    flat = Image.new('L', (8192, 2), 128)
    flat.save(scope / 'budget-max.jpg', format='JPEG', quality=90, subsampling=0, progressive=False)
    with Image.open(scope / 'budget-max.jpg') as decoded:
        assert decoded.size == (8192, 2)
        pixels = decoded.convert('RGBA').tobytes()
    assert pixels == bytes([128, 128, 128, 255]) * (8192 * 2)
    records.append({'file': 'budget-max.jpg', 'width': 8192, 'height': 2,
                    'pixelSHA': digest(pixels), 'kind': 'jpeg-max-pixels'})
    prog = Image.new('L', (256, 64), 128)
    prog.save(scope / 'budget-prog.jpg', format='JPEG', quality=90, subsampling=0, progressive=True)
    with Image.open(scope / 'budget-prog.jpg') as decoded:
        assert decoded.size == (256, 64)
        assert decoded.convert('RGBA').tobytes() == bytes([128, 128, 128, 255]) * (256 * 64)
    records.append({'file': 'budget-prog.jpg', 'width': 256, 'height': 64,
                    'pixelSHA': digest(bytes([128, 128, 128, 255]) * (256 * 64)), 'kind': 'jpeg-progressive'})
    sheet = Image.new('L', (2048, 2048), 200)
    sheet.save(scope / 'budget-flat4mp.png', format='PNG')
    with Image.open(scope / 'budget-flat4mp.png') as decoded:
        assert decoded.size == (2048, 2048)
        assert decoded.convert('RGBA').tobytes() == bytes([200, 200, 200, 255]) * (2048 * 2048)
    records.append({'file': 'budget-flat4mp.png', 'width': 2048, 'height': 2048,
                    'pixelSHA': digest(bytes([200, 200, 200, 255]) * (2048 * 2048)), 'kind': 'png-4mp'})
    with (scope / 'budget-fixtures.json').open('x', encoding='utf8') as stream:
        json.dump(records, stream, indent=2)
    print('budget fixtures', len(records))
else:
    raise SystemExit('unknown mode')
