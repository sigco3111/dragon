"""Owned synthetic JPEG generation / independent Pillow full-RGBA check only."""
import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image

if len(sys.argv) != 3 or not re.fullmatch(r'\.dragon-analysis/editor-phase/trial-portrait-jpeg-r1/attempt[1-9][0-9]{0,2}', sys.argv[1]):
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
    for width, height in [(128, 128), (256, 64), (64, 256), (129, 127), (1, 1), (8192, 2), (2, 8192)]:
        for channels in ['L', 'RGB']:
            for progressive in [False, True]:
                image = Image.new(channels, (width, height), 96 if channels == 'L' else (96, 96, 96))
                exif = Image.Exif()
                exif[270] = 'Synthetic Trial JPEG metadata to remove'
                name = f'fixture-{len(records)}.jpg'
                with (scope / name).open('xb') as stream:
                    image.save(stream, format='JPEG', quality=90, subsampling=0, progressive=progressive, exif=exif)
                with Image.open(scope / name) as decoded:
                    pixels = decoded.convert('RGBA').tobytes()
                assert pixels == bytes([96, 96, 96, 255]) * (width * height)
                records.append({'file': name, 'width': width, 'height': height, 'pixelSHA': digest(pixels),
                                'name': f'{width}x{height}-{channels}-{progressive}'})
    with (scope / 'fixtures.json').open('x', encoding='utf8') as stream:
        json.dump(records, stream, indent=2)
    print('Pillow synthetic JPEG generation', len(records))
elif mode == 'check':
    items = load('oracle.json')
    assert isinstance(items, list) and 1 <= len(items) <= 100
    for item in items:
        assert set(item) == {'file', 'width', 'height', 'pixelSHA'}
        assert re.fullmatch(r'(fixture-[0-9]+\.jpg|image-[0-9]+\.png)', item['file'])
        path = (scope / item['file']).resolve(strict=True)
        assert path.parent == scope
        with Image.open(path) as image:
            assert image.format in {'PNG', 'JPEG'}  # MPO is not JPEG here.
            # Pillow's static JpegImageFile has no n_frames attribute; PNG does.
            assert getattr(image, 'n_frames', 1) == 1
            assert image.size == (item['width'], item['height'])
            assert 1 <= image.width <= 8192 and 1 <= image.height <= 8192 and image.width * image.height <= 16384
            pixels = image.convert('RGBA').tobytes()
        assert digest(pixels) == item['pixelSHA'], item['file']
    print('Pillow Trial JPEG exact RGBA PASS', len(items))
else:
    raise SystemExit('unknown mode')
