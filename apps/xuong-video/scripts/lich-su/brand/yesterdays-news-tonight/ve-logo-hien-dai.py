# Logo kênh "Yesterday's News Tonight", bản hiện đại (anh 07/11/2026: "làm cho nó đẹp và hiện đại hơn"): ba hướng cùng ý trăng + thời gian quay lùi.
# Chạy: uv run --no-project --with fonttools --with uharfbuzz python ve-logo-hien-dai.py && node ve-logo-hien-dai.mjs  →  ra/logo-hien-dai/
# Chữ Montserrat ExtraBold đổi thành đường vẽ, có kerning. Màu: chuyển sắc đỏ san hô → hổ phách (họ hàng đỏ + vàng của kênh) trên nền mực.
import math
from pathlib import Path
import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

GOC = Path(__file__).parent
RA = GOC / 'ra/logo-hien-dai'
FONT_TEP = GOC.parents[3] / 'public/fonts/Montserrat-ExtraBold.ttf'
TT = TTFont(FONT_TEP)
GS, UPM = TT.getGlyphSet(), TT['head'].unitsPerEm
HB = hb.Font(hb.Face(hb.Blob.from_file_path(str(FONT_TEP))))
MUC, KEM, DAU, CUOI = '#10131c', '#f6f1e7', '#ff4b3e', '#ffc23d'


def gia(id, x1=40, y1=236, x2=216, y2=20):
    return f'<linearGradient id="{id}" gradientUnits="userSpaceOnUse" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{DAU}"/><stop offset="1" stop-color="{CUOI}"/></linearGradient>'


def giao(c0, r0, c1, r1):
    """Hai giao điểm của hai đường tròn, điểm đầu ở phía trên."""
    dx, dy = c1[0] - c0[0], c1[1] - c0[1]
    d = math.hypot(dx, dy)
    a = (r0 * r0 - r1 * r1 + d * d) / (2 * d)
    h = math.sqrt(r0 * r0 - a * a)
    mx, my = c0[0] + a * dx / d, c0[1] + a * dy / d
    p = [(mx + h * dy / d, my - h * dx / d), (mx - h * dy / d, my + h * dx / d)]
    return sorted(p, key=lambda q: q[1])


def khuyet(c0, r0, c1, r1):
    p, q = giao(c0, r0, c1, r1)
    return f'M{p[0]:.2f} {p[1]:.2f}A{r0} {r0} 0 1 0 {q[0]:.2f} {q[1]:.2f}A{r1} {r1} 0 1 1 {p[0]:.2f} {p[1]:.2f}z'


def thanh(x1, y1, x2, y2, w):
    """Thanh hai đầu bo tròn, thành đường vẽ."""
    r = w / 2
    a = math.atan2(y2 - y1, x2 - x1)
    nx, ny = -math.sin(a) * r, math.cos(a) * r
    return (f'M{x1 + nx:.2f} {y1 + ny:.2f}L{x2 + nx:.2f} {y2 + ny:.2f}A{r} {r} 0 0 0 {x2 - nx:.2f} {y2 - ny:.2f}'
            f'L{x1 - nx:.2f} {y1 - ny:.2f}A{r} {r} 0 0 0 {x1 + nx:.2f} {y1 + ny:.2f}z')


def huong(cx, cy, goc, dai):
    r = math.radians(goc)
    return cx + dai * math.sin(r), cy - dai * math.cos(r)


def mau_a():
    """Trăng khuyết + hai kim bo tròn quay lùi, trục ở tâm khoảng khuyết."""
    c = (158, 108)
    return [khuyet((128, 128), 108, c, 80), thanh(*c, *huong(*c, 0, 50), 17), thanh(*c, *huong(*c, -128, 40), 17)]


def mau_b():
    """Vòng trăng thon dần thành mũi tên tua ngược, hai kim ở giữa."""
    c0, r0, c1, r1 = (128, 128), 108, (136, 118), 84
    def diem(c, r, g):
        return huong(*c, g, r)
    a1, a2 = 22, 74          # khoảng hở trên phải, độ theo chiều kim đồng hồ từ đỉnh
    o1, o2, i1, i2 = diem(c0, r0, a1), diem(c0, r0, a2), diem(c1, r1, a1), diem(c1, r1, a2)
    vong = (f'M{o1[0]:.2f} {o1[1]:.2f}A{r0} {r0} 0 1 0 {o2[0]:.2f} {o2[1]:.2f}L{i2[0]:.2f} {i2[1]:.2f}'
            f'A{r1} {r1} 0 1 1 {i1[0]:.2f} {i1[1]:.2f}z')
    m = ((o2[0] + i2[0]) / 2, (o2[1] + i2[1]) / 2)
    t = (math.cos(math.radians(a2)), math.sin(math.radians(a2)))
    # mũi tên tại mép a2, chỉ về khoảng hở
    px, py = -t[0], -t[1]
    nx, ny = t[1], -t[0]
    mui = (f'M{m[0] + nx * 30:.2f} {m[1] + ny * 30:.2f}L{m[0] - nx * 30:.2f} {m[1] - ny * 30:.2f}L{m[0] + px * 40:.2f} {m[1] + py * 40:.2f}z')
    c = (132, 132)
    return [vong, mui, thanh(*c, *huong(*c, 0, 42), 16), thanh(*c, *huong(*c, -128, 32), 16)]


def mau_c():
    """Trăng khuyết + ba kim tạo thành chữ Y của Yesterday."""
    c = (160, 104)
    return [khuyet((128, 128), 108, c, 82), thanh(*c, *huong(*c, -42, 46), 18), thanh(*c, *huong(*c, 42, 46), 18), thanh(*c, *huong(*c, 180, 50), 18)]


def dau(duong, to):
    return ''.join(f'<path fill="{to}" d="{d}"/>' for d in duong)


def chu(t, co, x, y, to, gian=0.0):
    """Dòng chữ thành đường vẽ có kerning; trả (svg, rộng). gian = giãn chữ theo em."""
    buf = hb.Buffer(); buf.add_str(t); buf.guess_segment_properties()
    hb.shape(HB, buf, {'kern': True, 'liga': False})
    k, cx, bo = co / UPM, x, []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(GS)
        GS[TT.getGlyphName(info.codepoint)].draw(TransformPen(pen, (k, 0, 0, -k, cx + pos.x_offset * k, y)))
        bo.append(pen.getCommands())
        cx += pos.x_advance * k + gian * co
    return f'<path fill="{to}" d="{"".join(bo)}"/>', cx - gian * co - x


def luu(ten, w, h, than, defs=''):
    (RA / f'{ten}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}"><defs>{defs}</defs>{than}</svg>\n')


def bo(ma, duong):
    g = f'g{ma}'
    luu(f'{ma}-dau', 256, 256, dau(duong, f'url(#{g})'), gia(g))
    luu(f'{ma}-dau-den', 256, 256, dau(duong, MUC))
    luu(f'{ma}-dau-kem', 256, 256, dau(duong, KEM))
    luu(f'{ma}-the', 256, 256, f'<rect width="256" height="256" rx="58" fill="{MUC}"/><g transform="translate(35 35) scale(.727)">{dau(duong, f"url(#{g})")}</g>', gia(g))
    for ten, to in (('toi', KEM), ('sang', MUC)):
        a, w1 = chu("YESTERDAY'S NEWS", 86, 288, 130, to, -0.012)
        b, w2 = chu('TONIGHT', 44, 290, 198, f'url(#{g}c)' if ten == 'toi' else '#e8352b', 0.42)   # nền sáng: hổ phách nhạt, dùng đỏ đặc
        luu(f'{ma}-ngang-{ten}', 288 + max(w1, w2) + 8, 256, dau(duong, f'url(#{g})') + a + b, gia(g) + gia(f'{g}c', 288, 0, 288 + w2, 0))


RA.mkdir(parents=True, exist_ok=True)
for ma, d in (('a', mau_a()), ('b', mau_b()), ('c', mau_c())):
    bo(ma, d)
print(len(list(RA.glob('*.svg'))), 'svg')
