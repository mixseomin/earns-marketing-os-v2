# GIẢI PHẪU TỪ HÌNH KHỐI: tìm các MỐC của một loại cơ thể từ đỉnh lưới (không cần người chấm tay). Mỗi loại một hàm, cùng đầu ra:
# dict mốc tên → Vector (hoặc danh sách Vector cho chuỗi). khung_rigify.py đọc đúng các tên này.
# Thêm loại mới (hai chân, chim, cá…) = thêm một hàm ở đây + một hàm dựng khung ở khung_rigify.py; phần gắn da / thử dáng dùng chung.
from mathutils import Vector

tb = lambda ds: sum(ds, Vector()) / len(ds) if ds else None


def _duong_tam(V, tu, den, truc, dk, n):
    """Tâm các lát cắt vuông góc trục `truc` (1 = y, 2 = z) từ tu tới den, n+1 điểm (lát rỗng bỏ qua)."""
    ra = []
    for i in range(n + 1):
        t = tu + (den - tu) * i / n; w = abs(den - tu) / n * 0.6
        c = tb([p for p in V if abs(p[truc] - t) < w and dk(p)])
        if c is not None: ra.append(c)
    return ra


def bon_chan(V, lo, hi):
    """Thú bốn chân (khủng long, chó, mèo, ngựa…), mặt −y. Mốc: hong, nguc, co[] (vai → gốc đầu), dau_goc, mui, duoi[] (hông → chóp),
    chan[ten] = (đáy, đỉnh) cho chan_truoc.L/R, chan_sau.L/R; H = chiều cao."""
    H = hi.z - lo.z
    than = [p for p in V if 0.3 * H < p.z < 0.6 * H]; tam_than = tb(than)
    thap = [p for p in V if p.z < 0.18 * H]
    y_giua = sorted(p.y for p in thap)[len(thap) // 2]
    chan = {}
    for ten, dk in (('chan_truoc.L', lambda p: p.x > 0 and p.y < y_giua), ('chan_truoc.R', lambda p: p.x <= 0 and p.y < y_giua),
                    ('chan_sau.L', lambda p: p.x > 0 and p.y >= y_giua), ('chan_sau.R', lambda p: p.x <= 0 and p.y >= y_giua)):
        c = tb([p for p in thap if dk(p)])
        # đỉnh chân = chỗ chân nhập thân: lát cao nhất quanh cột chân còn hẹp (≤ 1,6 lần bề ngang ở đáy)
        chan[ten] = (Vector((c.x, c.y, 0.0)), Vector((c.x, c.y, 0.36 * H)))
    hong = Vector((0, (chan['chan_sau.L'][0].y + chan['chan_sau.R'][0].y) / 2, 0.45 * H))
    nguc = Vector((0, (chan['chan_truoc.L'][0].y + chan['chan_truoc.R'][0].y) / 2, 0.5 * H))
    dinh = max(V, key=lambda p: p.z)
    dau_ds = [p for p in V if p.z > dinh.z - 0.22 * H and p.y < tam_than.y]
    tam_dau = tb(dau_ds)
    dau_goc = Vector((0, tam_dau.y + 0.05 * H, dinh.z - 0.22 * H))
    co = _duong_tam(V, nguc.z + 0.05 * H, dau_goc.z, 2, lambda p: p.y < tam_than.y - 0.05 * H, 4)
    co = [nguc + Vector((0, -0.02 * H, 0.05 * H))] + [Vector((0, c.y, c.z)) for c in co[1:-1]] + [dau_goc]
    mui = min(dau_ds, key=lambda p: p.y)
    chop = max(V, key=lambda p: p.y)
    duoi = _duong_tam(V, hong.y, chop.y, 1, lambda p: p.z < 0.7 * H and abs(p.x) < 0.25 * (hi.x - lo.x) + 0.01, 5)
    duoi = [hong] + [Vector((0, c.y, c.z)) for c in duoi[1:-1]] + [Vector((0, chop.y, chop.z))]
    return {'H': H, 'hong': hong, 'nguc': nguc, 'co': co, 'dau_goc': dau_goc, 'mui': Vector((0, mui.y, dau_goc.z + 0.05 * H)), 'duoi': duoi, 'chan': chan}


def do_vat(V, lo, hi):
    """Đồ vật CỨNG (cốc, hộp, ghế, điện thoại…): một khối, mốc = đáy giữa + đỉnh. Bản lề (cửa, nắp) sau này thêm loại riêng."""
    H = hi.z - lo.z
    return {'H': H, 'day': Vector((0, 0, 0)), 'dinh': Vector((0, 0, H))}


LOAI = {'bon_chan': bon_chan, 'do_vat': do_vat}
