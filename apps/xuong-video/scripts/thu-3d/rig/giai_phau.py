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
    return _dau_duoi(V, lo, hi, H, hong, nguc, chan, tam_than)


def _dau_duoi(V, lo, hi, H, hong, nguc, chan, tam_than):
    """Đầu + cổ + đuôi chung cho mọi thân có sống nằm ngang. ĐẦU = vùng TRƯỚC NHẤT trên tầm thân (không phải điểm cao nhất: ankylosaur / thú
    có phiến lưng thì lưng cao hơn đầu — bản đầu bắt nhầm phiến lưng làm đầu). Cổ cắt lát theo CHIỀU CAO nếu đầu cao hơn ngực rõ (cổ dài
    dựng đứng), không thì theo CHIỀU DỌC (cổ ngắn nằm ngang)."""
    L = hi.y - lo.y
    truoc = [p for p in V if p.y < lo.y + 0.16 * L and p.z > 0.3 * H]
    dinh_truoc = max(p.z for p in truoc)
    dung = dinh_truoc - nguc.z > 0.35 * H
    if dung:   # cổ dài dựng đứng (bronto): đầu = vùng CAO NHẤT phía trước (vùng trước nhất lẫn cả cổ → đầu bẹp khi cúi, 22/10/2026)
        dinh = max(V, key=lambda p: p.z)
        dau_ds = [p for p in V if p.z > dinh.z - 0.22 * H and p.y < tam_than.y]
        td = tb(dau_ds); dau_goc = Vector((0, td.y + 0.05 * H, dinh.z - 0.22 * H))
        mui = Vector((0, min(p.y for p in dau_ds), dau_goc.z + 0.05 * H))
    else:      # cổ ngắn nằm ngang: đầu = vùng TRƯỚC NHẤT trên tầm thân
        tam_dau = tb(truoc); dau_goc = Vector((0, lo.y + 0.2 * L, tam_dau.z)); mui = Vector((0, lo.y, tam_dau.z))
    if dung:
        co = _duong_tam(V, nguc.z + 0.05 * H, dau_goc.z, 2, lambda p: p.y < tam_than.y - 0.05 * H, 4)
    else:
        co = _duong_tam(V, nguc.y, dau_goc.y, 1, lambda p: p.z > 0.3 * H, 3)
    co = [nguc + Vector((0, -0.02 * H, 0.05 * H))] + [Vector((0, c.y, c.z)) for c in co[1:-1]] + [dau_goc]
    chop = max(V, key=lambda p: p.y)
    duoi = _duong_tam(V, hong.y, chop.y, 1, lambda p: p.z < 0.7 * H and abs(p.x) < 0.25 * (hi.x - lo.x) + 0.01, 5)
    duoi = [hong] + [Vector((0, c.y, c.z)) for c in duoi[1:-1]] + [Vector((0, chop.y, chop.z))]
    return {'H': H, 'hong': hong, 'nguc': nguc, 'co': co, 'dau_goc': dau_goc, 'mui': mui, 'duoi': duoi, 'chan': chan}


def hai_chan(V, lo, hi):
    """Thú / khủng long đứng HAI CHÂN sau (raptor, chim không bay…), thân nằm ngang, tay nhỏ bỏ qua. Chân = 2 cụm đỉnh thấp nhất trái / phải;
    hông = tâm thân ngay trên chân; ngực lùi về phía đầu 1/5 bề dài; đầu / cổ / đuôi như bon_chan."""
    H = hi.z - lo.z; L = hi.y - lo.y
    thap = [p for p in V if p.z < 0.12 * H]
    chan = {}
    for ten, s in (('chan_sau.L', 1), ('chan_sau.R', -1)):
        c = tb([p for p in thap if p.x * s > 0]); chan[ten] = (Vector((c.x, c.y, 0.0)), Vector((c.x, c.y, 0.5 * H)))
    yc = (chan['chan_sau.L'][0].y + chan['chan_sau.R'][0].y) / 2
    than = [p for p in V if abs(p.y - yc) < 0.1 * L and p.z > 0.35 * H]
    zt = tb(than).z if than else 0.6 * H
    for ten in chan: d, _ = chan[ten]; chan[ten] = (d, Vector((d.x, d.y, zt - 0.05 * H)))
    hong = Vector((0, yc, zt)); nguc = Vector((0, yc - 0.2 * L, zt + 0.03 * H))
    return _dau_duoi(V, lo, hi, H, hong, nguc, chan, tb(than) if than else hong)
    return {'H': H, 'hong': hong, 'nguc': nguc, 'co': co, 'dau_goc': dau_goc, 'mui': Vector((0, mui.y, dau_goc.z + 0.05 * H)), 'duoi': duoi, 'chan': chan}


def do_vat(V, lo, hi):
    """Đồ vật CỨNG (cốc, hộp, ghế, điện thoại…): một khối, mốc = đáy giữa + đỉnh. Bản lề (cửa, nắp) sau này thêm loại riêng."""
    H = hi.z - lo.z
    return {'H': H, 'day': Vector((0, 0, 0)), 'dinh': Vector((0, 0, H))}


LOAI = {'bon_chan': bon_chan, 'hai_chan': hai_chan, 'do_vat': do_vat}
