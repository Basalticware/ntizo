"""Put a mockup's app area beside a render of its HTML twin, for review.

python3 compare.py <mockup.png> <x0,y0,x1,y1> <render.png> <out.png>

The rect is the app's viewport inside the mockup's browser frame; the render
must have been taken at exactly that width and height. The output is the
mockup crop on the left, the render on the right, and a 50/50 blend under
both, where any misalignment shows as a double image.
"""
import sys
from PIL import Image

mock_path, rect, render_path, out_path = sys.argv[1:5]
x0, y0, x1, y1 = map(int, rect.split(","))
mock = Image.open(mock_path).convert("RGB").crop((x0, y0, x1, y1))
render = Image.open(render_path).convert("RGB").crop((0, 0, x1 - x0, y1 - y0))
w, h = mock.size
blend = Image.blend(mock, render.resize(mock.size), 0.5)
sheet = Image.new("RGB", (w * 2 + 12, h * 2 + 12), "#ff00ff")
sheet.paste(mock, (0, 0))
sheet.paste(render, (w + 12, 0))
sheet.paste(blend, (w // 2 + 6, h + 12))
sheet.save(out_path)
