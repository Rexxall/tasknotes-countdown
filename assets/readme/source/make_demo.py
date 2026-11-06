"""Turn recorded keyframes into the README demo: cursor, click ripples, highlight rings and a camera that follows the action.

    python3 make_demo.py <frames dir> <light|dark> <boxes.json> <out.gif>

The frames dir holds start.png and sidebar.png (2x screenshots of a 1280x780 window) and card.png (the share image).
boxes.json holds element boxes in CSS px.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

BG = {"light": (247, 246, 251), "dark": (21, 20, 27)}
PAGE = {"light": (255, 255, 255), "dark": (13, 17, 23)}
LINE = {"light": (228, 225, 238), "dark": (44, 42, 54)}
ACCENT = {"light": (122, 90, 240), "dark": (164, 139, 255)}
ORANGE = {"light": (196, 110, 20), "dark": (240, 160, 70)}
RED = {"light": (201, 58, 64), "dark": (240, 124, 128)}
W, PAD, RADIUS, SCALE = 1200, 40, 22, 2


def smooth(t):
    return t * t * (3 - 2 * t)


class Film:
    def __init__(self, mode, size):
        self.mode, self.frames, self.durations = mode, [], []
        sw, sh = size
        self.full = (0, 0, sw, sh)
        self.aspect = sw / sh
        self.inner = W - 2 * PAD
        self.height = round(self.inner / self.aspect)

    def around(self, box, w):
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        h = w / self.aspect
        x = min(max(cx - w / 2, 0), self.full[2] - w)
        y = min(max(cy - h / 2, 0), self.full[3] - h)
        return (x, y, x + w, y + h)

    @staticmethod
    def mix(a, b, t):
        return tuple(p + (q - p) * t for p, q in zip(a, b))

    def to_out(self, cam, x, y):
        s = self.inner / (cam[2] - cam[0])
        return (x - cam[0]) * s, (y - cam[1]) * s

    def add(self, shot, cam, ms, cursor=None, ripple=None, ring=None, ring_color=None, card=None, card_t=1.0):
        crop = shot.crop(tuple(round(v) for v in cam)).resize((self.inner, self.height), Image.LANCZOS).convert("RGBA")
        layer = Image.new("RGBA", crop.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        if ring:
            (x0, y0), (x1, y1) = self.to_out(cam, ring[0] - 10, ring[1] - 8), self.to_out(cam, ring[2] + 10, ring[3] + 8)
            d.rounded_rectangle((x0, y0, x1, y1), 12, outline=(*ring_color, 235), width=4)
        if ripple:
            (x, y), p = self.to_out(cam, *ripple[:2]), ripple[2]
            r = 10 + 26 * p
            d.ellipse((x - r, y - r, x + r, y + r), fill=(*ACCENT[self.mode], round(110 * (1 - p))))
        if cursor:
            x, y = self.to_out(cam, *cursor)
            pts = [(0, 0), (0, 26), (6.5, 20), (11, 30), (15.5, 28), (11, 18.5), (19, 18.5)]
            d.polygon([(x + a * 1.35, y + b * 1.35) for a, b in pts], fill=(20, 20, 24, 255), outline=(255, 255, 255, 255), width=2)
        crop = Image.alpha_composite(crop, layer)
        if card is not None:  # the share image rises over a dimmed window
            dim = Image.new("RGBA", crop.size, (0, 0, 0, round(120 * card_t)))
            crop = Image.alpha_composite(crop, dim)
            h = round(self.height * 0.86 * (0.92 + 0.08 * card_t))
            c = card.resize((round(h * card.width / card.height), h), Image.LANCZOS)
            mask = Image.new("L", c.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, c.width - 1, c.height - 1), 18, fill=round(255 * card_t))
            ox, oy = (crop.width - c.width) // 2, (crop.height - c.height) // 2 + round(12 * (1 - card_t))
            crop.paste(c, (ox, oy), mask)
            edge = (255, 255, 255, round(70 * card_t)) if self.mode == "dark" else (*LINE[self.mode], round(255 * card_t))
            ImageDraw.Draw(crop).rounded_rectangle((ox, oy, ox + c.width - 1, oy + c.height - 1), 18, outline=edge, width=2)
        self.frames.append(self.frame(crop.convert("RGB")))
        self.durations.append(ms)

    def frame(self, shot):
        H = shot.height + 2 * PAD
        canvas = Image.new("RGB", (W, H), BG[self.mode])
        shadow = Image.new("L", (W, H), 0)
        ImageDraw.Draw(shadow).rounded_rectangle((PAD, PAD + 8, PAD + self.inner, PAD + shot.height + 8), RADIUS, fill=70 if self.mode == "light" else 140)
        canvas.paste((0, 0, 0) if self.mode == "dark" else (60, 50, 110), (0, 0), shadow.filter(ImageFilter.GaussianBlur(18)))
        mask = Image.new("L", shot.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width - 1, shot.height - 1), RADIUS, fill=255)
        canvas.paste(shot, (PAD, PAD), mask)
        ImageDraw.Draw(canvas).rounded_rectangle((PAD, PAD, PAD + self.inner - 1, PAD + shot.height - 1), RADIUS, outline=LINE[self.mode], width=2)
        card = Image.new("L", (W, H), 0)
        ImageDraw.Draw(card).rounded_rectangle((0, 0, W - 1, H - 1), 28, fill=255)
        page = Image.new("RGB", (W, H), PAGE[self.mode])
        page.paste(canvas, (0, 0), card)
        return page

    def glide(self, shot, cam, a, b, n=10, ms=35):
        for k in range(1, n + 1):
            self.add(shot, cam, ms, cursor=self.mix(a, b, smooth(k / n)))

    def click(self, shot, cam, at):
        for k in range(4):
            self.add(shot, cam, 45, cursor=at, ripple=(*at, k / 3))

    def move(self, shot, a, b, n=10, ms=55, cursor=None):
        for k in range(1, n + 1):
            self.add(shot, self.mix(a, b, smooth(k / n)), ms, cursor=cursor)

    def save(self, out):
        # One shared palette, built from every frame, keeps the small coloured dots and labels in colour.
        sample = Image.new("RGB", (self.frames[0].width, self.frames[0].height * 4))
        for i, f in enumerate(self.frames[:: max(1, len(self.frames) // 4)][:4]):
            sample.paste(f, (0, i * f.height))
        ref = sample.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        pal = [f.quantize(palette=ref, dither=Image.Dither.NONE) for f in self.frames]
        pal[0].save(out, save_all=True, append_images=pal[1:], duration=self.durations, loop=0, optimize=True, disposal=1)
        print(out, Path(out).stat().st_size // 1024, "KB", len(self.frames), "frames", sum(self.durations) / 1000, "s")


def main(frames_dir, mode, boxes_file, out):
    d = Path(frames_dir)
    b = {k: [v * SCALE for v in box] for k, box in json.loads(Path(boxes_file).read_text()).items()}
    start, sidebar, card = (Image.open(d / f).convert("RGB") for f in ("start.png", "sidebar.png", "card.png"))
    film = Film(mode, start.size)
    centre = lambda box: ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)
    full, hero = film.full, film.around(b["hero"], 1500)
    share, ribbon = centre(b["share"]), centre(b["ribbon"])
    rest = (hero[0] + 1200, hero[1] + 880)

    film.add(start, full, 1000)
    film.move(start, full, hero)  # in on the nearest deadline
    film.add(start, hero, 500)
    for key, color, ms in (("time", ACCENT, 1100), ("pace", ORANGE, 1300), ("late", RED, 1200), ("waiting", ACCENT, 1200)):
        film.add(start, hero, ms, ring=b[key], ring_color=color[mode])
    film.add(start, hero, 250)
    film.glide(start, hero, rest, share)
    film.add(start, hero, 200, cursor=share)
    film.click(start, hero, share)
    for k in range(1, 7):
        film.add(start, hero, 45, card=card, card_t=smooth(k / 6))
    film.add(start, hero, 2400, card=card)
    for k in range(5, -1, -1):
        film.add(start, hero, 40, card=card, card_t=smooth(k / 6))
    film.move(start, hero, full, n=8)  # out, and over to the ribbon
    film.glide(start, full, (1100, 700), ribbon, n=12)
    film.add(start, full, 200, cursor=ribbon)
    film.click(start, full, ribbon)
    film.add(sidebar, full, 900, cursor=ribbon)
    side = film.around((1880, 160, 2560, 1000), 1500)
    film.move(sidebar, full, side)  # the same plan, always open beside your notes
    film.add(sidebar, side, 1800)
    film.move(sidebar, side, full, n=8)
    film.add(sidebar, full, 2400)
    film.save(out)


if __name__ == "__main__":
    main(*sys.argv[1:5])
