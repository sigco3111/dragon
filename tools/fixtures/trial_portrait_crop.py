"""Owned synthetic JPEG sources / independent Pillow 128-output check for Trial crop."""
import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image

if len(sys.argv) != 3 or not re.fullmatch(r'\.dragon-analysis/editor-phase/trial-portrait-crop-r1/attempt[1-9][0-9]{0,2}', sys.argv[1]):
    raise SystemExit('owned scope and explicit mode required')
scope = Path(sys.argv[1]).resolve(strict=True)
mode = sys.argv[2]


def load(name):
    try:
        return json.loads((scope / name).read_text(encoding='utf8'))
    except (OSError, ValueError) as error:
        raise SystemExit('owned JSON unavailable or invalid') from error


def digest(data):
    return hashlib.sha256(data).hexdigest()


if mode == 'generate':
    records = []
    # Flat gray/neutral only: lossy chroma colors decode differently across JPEG
    # decoders (prior lane registers the difference), so exact oracles stay gray.
    for width, height, channels, color in [(256, 64, 'L', 96), (129, 127, 'RGB', (96, 96, 96)), (64, 256, 'L', 200)]:
        image = Image.new(channels, (width, height), color)
        name = f'crop-{len(records)}.jpg'
        with (scope / name).open('xb') as stream:
            image.save(stream, format='JPEG', quality=90, subsampling=0, progressive=False)
        with Image.open(scope / name) as decoded:
            pixels = decoded.convert('RGBA').tobytes()
        expect = pixels[:4] * (width * height)
        assert pixels == expect, name  # flat source required for exact oracle
        side = min(width, height)
        records.append({'file': name, 'width': width, 'height': height,
                        'crop': {'x': (width - side) // 2, 'y': (height - side) // 2, 'side': side},
                        'flat': list(pixels[:4]), 'name': f'{width}x{height}-{channels}'})
    with (scope / 'crop-jpeg.json').open('x', encoding='utf8') as stream:
        json.dump(records, stream, indent=2)
    print('Pillow Trial crop JPEG generation', len(records))
elif mode == 'check':
    items = load('oracle.json')
    assert isinstance(items, list) and 1 <= len(items) <= 100
    for item in items:
        assert set(item) == {'file', 'width', 'height', 'pixelSHA'}
        assert re.fullmatch(r'crop-[0-9]+\.png', item['file'])
        assert item['width'] == 128 and item['height'] == 128
        path = (scope / item['file']).resolve(strict=True)
        assert path.parent == scope
        with Image.open(path) as image:
            assert image.format == 'PNG'
            assert getattr(image, 'n_frames', 1) == 1
            assert image.size == (128, 128)
            pixels = image.convert('RGBA').tobytes()
        assert digest(pixels) == item['pixelSHA'], item['file']
    print('Pillow Trial crop 128-output exact RGBA PASS', len(items))
else:
    raise SystemExit('unknown mode')
