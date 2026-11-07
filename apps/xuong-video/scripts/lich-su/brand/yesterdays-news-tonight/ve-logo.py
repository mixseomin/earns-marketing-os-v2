# Logo kênh "Yesterday's News Tonight": trăng + kim đồng hồ quay lùi (anh chọn mẫu A 07/11/2026). Mọi hình là đường vẽ SVG, chữ Anton đã đổi thành đường vẽ, 0đ.
# Chạy: uv run --no-project --with fonttools python ve-logo.py && node ve-logo-png.mjs && python3 ve-brand.py
#   → ra/logo/*.svg + *.png, rồi ra/avatar-800.png + ra/yt-banner-2560x1440.png đặt logo lên ảnh thật.
# Màu theo theme lá cải của kênh (ve-brand.py): đỏ #e8352b · vàng #ffe14d · đen #111.
import math
from pathlib import Path
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

GOC = Path(__file__).parent
RA = GOC / 'ra/logo'
DO, VANG, DEN, TRANG = '#e8352b', '#ffe14d', '#111111', '#ffffff'
FONT = TTFont(GOC / 'fonts/Anton-Regular.ttf')
GLYPH, CMAP, UPM = FONT.getGlyphSet(), FONT.getBestCmap(), FONT['head'].unitsPerEm


def kim(cx, cy, dai1, dai2, rong, goc=-125):
    """Hai kim một khối, góc trong vát nhọn: kim phút thẳng lên, kim giờ quay lùi `goc` độ."""
    n = rong / 2
    r = math.radians(goc)
    d = (math.sin(r), -math.cos(r))
    pt = (-d[1], d[0])
    if pt[1] < 0: pt = (-pt[0], -pt[1])
    tren = (cx - n * pt[0], cy - n * pt[1])
    duoi = (cx + n * pt[0], cy + n * pt[1])
    t1 = (tren[0] - (cx - n)) / -d[0]
    t2 = (duoi[0] - (cx + n)) / -d[0]
    ds = [(cx - n, cy - dai1), (cx + n, cy - dai1), (cx + n, duoi[1] + t2 * d[1]),
          (duoi[0] + dai2 * d[0], duoi[1] + dai2 * d[1]), (tren[0] + dai2 * d[0], tren[1] + dai2 * d[1]), (cx - n, tren[1] + t1 * d[1])]
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in ds) + 'z'


TRANG_LON = 'M178 30A110 110 0 1 0 226 178A84 84 0 1 1 178 30z'
KIM_LON = kim(172, 94, 50, 60, 20)
TRANG_NHO = 'M186 26A112 112 0 1 0 230 170A80 80 0 1 1 186 26z'
KIM_NHO = kim(176, 92, 44, 44, 34)


def mark(mau, nho=False):
    return f'<path fill="{mau}" d="{TRANG_NHO if nho else TRANG_LON}"/><path fill="{mau}" d="{KIM_NHO if nho else KIM_LON}"/>'


def chu(t, co, x, y, mau):
    """Một dòng chữ Anton thành đường vẽ; trả (svg, bề rộng). y = đường chân chữ."""
    k = co / UPM
    bo, cx = [], x
    for c in t:
        g = CMAP[ord(c)]
        pen = SVGPathPen(GLYPH)
        GLYPH[g].draw(TransformPen(pen, (k, 0, 0, -k, cx, y)))
        bo.append(pen.getCommands())
        cx += GLYPH[g].width * k + co * 0.012
    return f'<path fill="{mau}" d="{"".join(bo)}"/>', cx - x


def rong(t, co):
    return chu(t, co, 0, 0, '#000')[1]


def luu(ten, w, h, than):
    (RA / f'{ten}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}">{than}</svg>\n')


def ngang(mau_mark, mau_chu):
    co1, co2 = 118, 118
    x = 290
    a, w1 = chu("YESTERDAY'S NEWS", co1, x, 118, mau_chu)
    b, w2 = chu('TONIGHT', co2, x, 248, mau_chu)
    return x + max(w1, w2) + 12, 256, mark(mau_mark) + a + b


def doc(mau_mark, mau_chu):
    co = 118
    w = rong("YESTERDAY'S NEWS", co) + 24
    a, _ = chu("YESTERDAY'S NEWS", co, 12, 400, mau_chu)
    t = rong('TONIGHT', co)
    b, _ = chu('TONIGHT', co, (w - t) / 2, 530, mau_chu)
    return w, 548, f'<g transform="translate({(w - 256) / 2:.1f} 0)">{mark(mau_mark)}</g>' + a + b


def huy_hieu(nen, mau, nho=False):
    """Vòng tròn cho ảnh nhỏ / dấu góc video: logo đặt lệch để khối trăng nằm giữa vòng."""
    return f'<circle cx="160" cy="160" r="160" fill="{nen}"/><g transform="translate(42 34) scale(.92)">{mark(mau, nho)}</g>'


RA.mkdir(parents=True, exist_ok=True)
for ten, mau in (('dau-vang', VANG), ('dau-do', DO), ('dau-den', DEN), ('dau-trang', TRANG)):
    luu(ten, 256, 256, mark(mau))
    luu(f'{ten}-nho', 256, 256, mark(mau, True))
for ten, (mm, mc) in {'ngang-nen-sang': (DO, DEN), 'ngang-nen-toi': (VANG, TRANG)}.items():
    w, h, s = ngang(mm, mc); luu(ten, w, h, s)
for ten, (mm, mc) in {'doc-nen-sang': (DO, DEN), 'doc-nen-toi': (VANG, TRANG)}.items():
    w, h, s = doc(mm, mc); luu(ten, w, h, s)
luu('huy-hieu', 320, 320, huy_hieu(DO, VANG))
luu('huy-hieu-nho', 320, 320, huy_hieu(DO, VANG, True))
print('\n'.join(str(p) for p in sorted(RA.glob('*.svg'))))
