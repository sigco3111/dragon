"""Owned synthetic JPEG fixtures and independent libjpeg/Pillow RGBA references.
No DOS/profile/input images. This is not JPEG Part-2 conformance testing.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image, __version__

assert len(sys.argv) in (2, 3)
folder = sys.argv[1].replace('\\', '/')
assert re.fullmatch(r'\.dragon-analysis/editor-phase/portrait-jpeg-candidate-r1/attempt[1-9][0-9]{0,2}', folder)
root = Path(folder)
assert root.is_dir()
if len(sys.argv) == 3:
    assert sys.argv[2] == 'check'
    try:
        inputs = json.loads(sys.stdin.read())
    except json.JSONDecodeError as error:
        raise ValueError('owned JPEG reference request') from error
    results = []
    for record in inputs:
        path = record['path']
        assert re.fullmatch(re.escape(folder) + r'/(positive-[0-9]+\.jpg|stored-[0-9]+\.png)', path)
        with Image.open(path) as independent:
            independent.load()
            assert independent.size == (128, 128)
            pixels = independent.convert('RGBA').tobytes()
        digest = hashlib.sha256(pixels).hexdigest()
        if record['exact']:
            assert digest == record['pixelSha'], path
        results.append({'path': path, 'pixelSha': digest, 'exact': record['exact']})
    print(json.dumps({'pillow': __version__, 'results': results}))
    sys.exit(0)
records = []
for mode in ('L', 'RGB'):
    for progressive in (False, True):
        for subsampling in ((0,) if mode == 'L' else (0, 1, 2)):
            for pattern in ('neutral-blocks', 'color-pattern'):
                if mode == 'L' and pattern == 'color-pattern':
                    continue
                image = Image.new(mode, (128, 128))
                for y in range(128):
                    for x in range(128):
                        value = ((x // 8 + 2 * (y // 8)) % 4) * 64
                        sample = value if mode == 'L' else (value, value, value)
                        if pattern == 'color-pattern':
                            sample = ((x * 3) % 256, (y * 5) % 256, (x + y) % 256)
                        image.putpixel((x, y), sample)
                stem = f'fixture-{len(records)}'
                path = root / (stem + '.jpg')
                with path.open('xb') as stream:
                    image.save(stream, format='JPEG', quality=90, subsampling=subsampling, progressive=progressive, optimize=False)
                with Image.open(path) as independent:
                    independent.load()
                    pixels = independent.convert('RGBA').tobytes()
                with (root / (stem + '.rgba')).open('xb') as stream:
                    stream.write(pixels)
                records.append({'path': path.as_posix(), 'reference': (root / (stem + '.rgba')).as_posix(), 'mode': mode, 'progressive': progressive, 'subsampling': subsampling, 'pattern': pattern, 'pixelSha': hashlib.sha256(pixels).hexdigest()})
print(json.dumps({'pillow': __version__, 'records': records}))
