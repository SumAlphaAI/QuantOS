from PIL import Image, ImageDraw
from pathlib import Path
import json
import hashlib
import struct

f = Path(__file__).resolve().parent
root = f.parents[3]
p = root / "tests/e2e/visual-baselines.json"
m = json.loads(p.read_text())
names = json.loads((f / "captured-visual-paths.json").read_text())["new_paths"]
for name in names:
    b = (root / name).read_bytes()
    width, height = struct.unpack(">II", b[16:24])
    assert width == 1440
    m["entries"].append(
        {
            "path": name,
            "sha256": hashlib.sha256(b).hexdigest(),
            "width": width,
            "height": height,
            "scope": "PRE-06 macOS browser visual baseline; engineering comparison 2026-10-02; formal design/G0 sign-off independent",
        }
    )
m["entries"].sort(key=lambda e: e["path"])
assert len(m["entries"]) == 24
p.write_text(json.dumps(m, indent=2) + "\n")

sheet = Image.new("RGB", (1000, len(names) * 350), "white")
draw = ImageDraw.Draw(sheet)
for i, name in enumerate(names):
    other = name.replace("-firefox-darwin", "-chromium-darwin").replace(
        "-webkit-darwin", "-chromium-darwin"
    )
    for j, path in enumerate([other, name]):
        im = Image.open(root / path).convert("RGB")
        im.thumbnail((480, 315))
        sheet.paste(im, (j * 500, i * 350 + 30))
        draw.text((j * 500 + 5, i * 350 + 5), Path(path).name, fill="black")
sheet.save(f / "visual-comparison.png")
