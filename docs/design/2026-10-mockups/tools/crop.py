"""Cut a photo or avatar out of a mockup, for the HTML twin to use.

python3 crop.py <mockup.png> <x0,y0,x1,y1> <out.jpg|png> [circle]

The mockups' people and service photos have no other source; cropping them
is what lets the HTML show the same pictures. `circle` masks to a circle
(avatars) and writes PNG.
"""
import sys
from PIL import Image, ImageDraw

src, rect, out = sys.argv[1:4]
x0, y0, x1, y1 = map(int, rect.split(","))
im = Image.open(src).convert("RGB").crop((x0, y0, x1, y1))
if len(sys.argv) > 4 and sys.argv[4] == "circle":
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, im.size[0] - 1, im.size[1] - 1), fill=255)
    im.putalpha(mask)
    im.save(out if out.endswith(".png") else out.rsplit(".", 1)[0] + ".png")
else:
    im.save(out, quality=92)
