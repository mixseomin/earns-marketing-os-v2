# Bộ nhận diện kênh "Yesterday's News Tonight" (kênh lịch sử parody, S08 — kenh.json › parody), vẽ bằng PIL, 0đ. Khuôn: hotel-arb ve-brand.py.
# Chạy: python3 ve-brand.py  →  ra/ avatar-800.png · yt-banner-2560x1440.png
# LUẬT (anh 17/10 + 29/10/2026): ảnh bìa và ảnh đại diện là ẢNH THẬT free (Pexels) — thiếu ảnh thì dừng. Nguồn: anh-nen/nguon.txt.
# Màu theo theme lá cải của kênh (ban-do.html LC): đỏ #e8352b · vàng #ffe14d · đen #111.
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageEnhance

GOC = Path(__file__).parent
RA = GOC / 'ra'
ANTON = str(GOC / 'fonts/Anton-Regular.ttf')
DO, VANG, DEN, TRANG = (232, 53, 43), (255, 225, 77), (17, 17, 17), (255, 255, 255)
NEN_BIA = GOC / 'anh-nen/pe-27794812.jpg'    # bó báo cũ, không người, không chữ đọc được
NEN_AVT = GOC / 'anh-nen/pe-14759050.jpg'    # micro chrome cổ — "phát thanh viên"
for f in (NEN_BIA, NEN_AVT):
    if not f.exists(): sys.exit(f'thiếu ảnh thật {f} — luật nền ảnh thật, không vẽ nền trơn')


def phu(im, w, h, tam=(0.5, 0.5)):
    return ImageOps.fit(im.convert('RGB'), (w, h), Image.LANCZOS, centering=tam)


def chu_dam(d, xy, t, size, mau=TRANG, vien=DEN, lech=0.07):
    f = ImageFont.truetype(ANTON, size)
    x, y = xy
    d.text((x + size * lech, y + size * lech), t, font=f, fill=vien, anchor='mm', stroke_width=int(size * .09), stroke_fill=vien)
    d.text((x, y), t, font=f, fill=mau, anchor='mm', stroke_width=int(size * .09), stroke_fill=vien)


def nhan(d, cx, cy, t, size, nen, mau, nghieng_px=0):
    """Dải tít lá cải: khối màu + bóng cứng đen lệch, chữ Anton."""
    f = ImageFont.truetype(ANTON, size)
    l, tp, r, b = d.textbbox((0, 0), t, font=f)
    w, h = r - l + size * .7, size * 1.3
    x0, y0 = cx - w / 2, cy - h / 2
    d.polygon([(x0 + 14, y0 + 16 + nghieng_px), (x0 + w + 14, y0 + 16), (x0 + w + 14, y0 + h + 16), (x0 + 14, y0 + h + 16 + nghieng_px)], fill=DEN)
    d.polygon([(x0, y0 + nghieng_px), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h + nghieng_px)], fill=nen)
    d.text((cx, cy + nghieng_px / 2 + size * .04), t, font=f, fill=mau, anchor='mm')


def banner():
    """YouTube 2560x1440 — vùng an toàn mọi thiết bị ở giữa 1546x423: tên kênh + dòng mô tả nằm gọn trong đó."""
    W, H = 2560, 1440
    im = phu(Image.open(NEN_BIA), W, H, (0.5, 0.45))
    im = ImageEnhance.Color(im).enhance(0.55)
    lop = Image.new('RGBA', (W, H), DO + (0,))
    dl = ImageDraw.Draw(lop)
    # dải đỏ giữa (vùng an toàn) đậm, hai bên nhạt để thấy ảnh báo thật
    for y in range(H):
        k = 1 - min(1, abs(y - H / 2) / 420)
        dl.line([(0, y), (W, y)], fill=DO + (int(70 + 140 * k),))
    im = Image.alpha_composite(im.convert('RGBA'), lop)
    d = ImageDraw.Draw(im)
    # vùng an toàn mọi thiết bị: y 508–931 → cả cụm nằm trong 560–880
    nhan(d, W / 2, H / 2 - 105, "YESTERDAY'S NEWS", 125, VANG, DEN, -16)
    nhan(d, W / 2, H / 2 + 40, 'TONIGHT', 125, DEN, VANG, -8)
    chu_dam(d, (W / 2, H / 2 + 150), 'HISTORY, REPORTED LIKE IT JUST HAPPENED', 40)
    return im.convert('RGB')


def avatar():
    """800x800, soát bản cắt tròn: micro nằm giữa vòng, viền vàng + dải chữ YNT dưới."""
    S = 800
    im = phu(Image.open(NEN_AVT), S, S, (0.5, 0.5))
    im = ImageEnhance.Contrast(im).enhance(1.15)
    lop = Image.new('RGBA', (S, S), DO + (55,))
    im = Image.alpha_composite(im.convert('RGBA'), lop)
    d = ImageDraw.Draw(im)
    nhan(d, S / 2, S * 0.74, 'YNT', 120, VANG, DEN, -10)
    return im.convert('RGB')


def soat_tron(im):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).ellipse([0, 0, im.size[0], im.size[1]], fill=255)
    out = Image.new('RGB', im.size, (240, 240, 240)); out.paste(im, (0, 0), m); return out


RA.mkdir(exist_ok=True)
b = banner(); b.save(RA / 'yt-banner-2560x1440.png')
a = avatar(); a.save(RA / 'avatar-800.png'); soat_tron(a).save(RA / 'avatar-soat-tron.png')
print('\n'.join(str(p) for p in sorted(RA.glob('*.png'))))
