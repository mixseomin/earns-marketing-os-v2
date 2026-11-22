#!/usr/bin/env python3
"""ĐẾM CỬA SỔ + GỜ NGANG trên ẢNH CHỤP đã nắn về mặt tường (scripts/nan-mat.mjs, 24 px/m) — xử lý ảnh, không AI (20/11/2026, nửa còn thiếu của do-anh.mjs).
Khác scripts/do-cua-so.py (viết cho ảnh 3D Google nhoè, dò theo lưới hồ sơ tối): ảnh chụp đủ nét để tách TỪNG ô cửa thành một vùng liền:
  Ô CỬA  = vùng liền "khác tường": tối hơn tường rõ (lòng cửa) HOẶC ngả xanh (kính phản trời), rộng 0,3–1,8 m, cao 0,7–3,2 m, cao / rộng ≥ 1,15,
           lấp ≥ 50 % khung bao (loại neo sắt hình hoa, vệt bẩn), không dính mép ảnh / vùng bị che (ô bị cắt không tính);
  HÀNG   = các ô chồng nhau ≥ 50 % theo chiều đứng; CỤM = các ô cùng hàng hở nhau < 0,6 m (cửa đôi / ba) → [s0, s1, n] (mét dọc cạnh từ đỉnh đầu);
  GỜ NGANG (chỉ tường gạch) = dải đá chạy ≥ 80 % bề ngang phần thấy, dày 0,12–0,7 m, trên dưới đều là gạch → độ cao tuyệt đối tâm dải.
Mỗi hàng / gờ một độ tin 0–1. Ghi <thư mục>/cua-<nhãn>.json { "khối#cạnh": { hang: [{ y0, y1, cum, tin }], go_y: [[y, tin]], phu } }.

  python3 apps/castle/scripts/dem-cua-so.py <thư mục nan-mat> <nhãn> [--anh] [--khong-deu]
  python3 apps/castle/scripts/dem-cua-so.py --tu-kiem [--khong-deu]      mặt vẽ có đáp án: 2 cửa đôi + 3 cửa đơn kính xanh + gờ đá; mồi nhử: ống thoát nước, neo sắt, mảng tối không khung đá, ô bị cắt ở mép
"""
import json, sys, pathlib
import numpy as np
from PIL import Image, ImageDraw

TU_KIEM, VE = '--tu-kiem' in sys.argv, '--anh' in sys.argv

def vung_lien(mask):
    """các vùng liền 4 hướng của mặt nạ → [(x0, y0, x1, y1, diện tích)] (ảnh nhỏ ~200 × 400: duyệt ngăn xếp thuần Python đủ nhanh)"""
    H, W = mask.shape; da = np.zeros_like(mask, bool); ra = []
    for y, x in zip(*np.nonzero(mask)):
        if da[y, x]: continue
        ngan = [(y, x)]; da[y, x] = True; x0 = x1 = x; y0 = y1 = y; n = 0
        while ngan:
            cy, cx = ngan.pop(); n += 1; x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not da[ny, nx]: da[ny, nx] = True; ngan.append((ny, nx))
        ra.append((x0, y0, x1 + 1, y1 + 1, n))
    return ra

def loc(mask, n):
    """đóng rồi mở n điểm ảnh bằng dịch mảng (không cần scipy): lấp khe đố cửa mảnh, bỏ nhiễu lẻ"""
    def no(m):
        r = m.copy()
        for d in range(1, n + 1): r[d:] |= m[:-d]; r[:-d] |= m[d:]; r[:, d:] |= m[:, :-d]; r[:, :-d] |= m[:, d:]
        return r
    def co(m): return ~no(~m)
    return no(co(co(no(mask))))

DEU = '--khong-deu' not in sys.argv
def deu_hoa(cum, o, sang, tuong, nguong):
    """ĐIỀU HOÀ THEO NHỊP LẶP (23/11/2026, cùng ý nhap-mat-tien.py --deu): cửa cùng hàng trên một mặt lặp cùng một mẫu (đôi / ba ô). Ô kính phản sáng / bóng đổ
    lọt ngưỡng tối → cụm đó đếm hụt. Cụm mẫu = cụm nhiều ô nhất hàng; cụm hụt thử đặt mẫu sao cho một ô đã thấy trùng một ô mẫu, các ô còn thiếu phải
    nằm trọn trên tường, không chồng ô khác, và tối hơn tường (< nguong — nới hơn ngưỡng dò, vẫn chặt hơn tường trơn). Không đặt được → giữ nguyên."""
    if len(cum) < 2: return 0
    mau = max(cum, key=len); n = len(mau)
    if n < 2: return 0
    lech = [(b[0] - mau[0][0], b[1] - mau[0][1], b[2] - b[0], b[3] - b[1]) for b in mau]; them = 0
    for ci, c in enumerate(cum):
        if len(c) >= n: continue
        tot = None
        for b in c:
            for j in range(n):
                gx, gy = b[0] - lech[j][0], b[1] - lech[j][1]; moi = []; ok = True; tong = 0
                for k, (dx, dy, w, h) in enumerate(lech):
                    x0, y0 = int(gx + dx), int(gy + dy); x1, y1 = x0 + w, y0 + h
                    if any(abs(x0 - q[0]) < w * 0.5 and abs(y0 - q[1]) < h * 0.5 for q in c): continue        # ô này đã thấy
                    if x0 < 0 or y0 < 0 or x1 > sang.shape[1] or y1 > sang.shape[0] or tuong[y0:y1, x0:x1].mean() < 0.96: ok = False; break
                    if any(min(x1, q[2]) - max(x0, q[0]) > 0 and min(y1, q[3]) - max(y0, q[1]) > 0 for q in o): ok = False; break
                    t = float(sang[y0:y1, x0:x1].mean())
                    if t >= nguong: ok = False; break
                    moi.append((x0, y0, x1, y1, 0.5)); tong += t
                if ok and moi and len(c) + len(moi) == n and (tot is None or tong < tot[0]): tot = (tong, moi)
        if tot: cum[ci] = sorted(c + tot[1], key=lambda q: q[0]); o.extend(tot[1]); them += len(tot[1])
    return them

def dem_mat(m):
    PX = m['px']; im = np.asarray(Image.open(m['tep']).convert('RGBA')).astype(float); H, W = im.shape[:2]
    a = im[..., 3] > 0; rgb = im[..., :3]; R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]; sang = rgb.mean(-1)
    xam = (np.abs(rgb - 128).max(-1) < 2) & a
    troi = a & ~xam & (((sang > 200) & (rgb.max(-1) - rgb.min(-1) < 40)) | ((B > R + 25) & (B > 120)))
    # trời chỉ là trời khi nối lên mép trên: kính xanh giữa tường không phải trời
    lien = np.zeros_like(troi); lien[0] = troi[0]
    for y in range(1, H): lien[y] = troi[y] & (lien[y - 1] | np.roll(lien[y - 1], 1) | np.roll(lien[y - 1], -1))
    tuong = a & ~xam & ~lien; kq = {'khoi': m['khoi'], 'canh': m['canh'], 'L': round(m['L'], 2), 'phu': round(float((a & ~xam).any(0).mean()), 2), 'thay': round(float((a & ~xam).mean()), 2), 'hang': [], 'go_y': []}
    if tuong.sum() < 4 * PX * PX: return kq, []
    nen = np.median(rgb[tuong], 0); Lw = float(nen.mean()); do_ = tuong & (R - G > 25); gach = do_.sum() >= 0.2 * tuong.sum()   # mặt có ≥ 20 % gạch đỏ (mặt nửa gạch nửa tháp đá: trung vị màu không nói lên gì)
    mo = tuong & ((sang < Lw * (0.72 if not gach else 0.6)) | ((B > R + 18) & (B > G + 2)))
    mo = loc(mo, max(1, int(0.06 * PX))); o = []
    for x0, y0, x1, y1, n in vung_lien(mo):
        w, h = (x1 - x0) / PX, (y1 - y0) / PX
        if not (0.3 <= w <= 1.8 and 0.7 <= h <= 3.2 and h / w >= 1.15 and n / ((x1 - x0) * (y1 - y0)) >= 0.5): continue
        if x0 <= 1 or x1 >= W - 1 or y1 >= H - 1: continue                                             # dính mép ảnh = ô bị cắt
        vien = (~a | xam)[max(0, y0 - 2):y1 + 2, max(0, x0 - 2):x1 + 2]
        if vien.mean() > 0.04: continue                                                                # dính vùng bị che / ngoài ảnh
        if gach:                                                                                       # tường gạch: cửa thật nằm trong KHUNG ĐÁ; neo sắt / vệt tối nằm giữa gạch (đo 20/11/2026: neo sắt hình hoa lọt bài lấp khung)
            v_ = int(0.18 * PX); vong = np.ones((y1 - y0 + 2 * v_, x1 - x0 + 2 * v_), bool); vong[v_:-v_, v_:-v_] = False
            kh = do_[max(0, y0 - v_):y1 + v_, max(0, x0 - v_):x1 + v_]
            if kh.shape == vong.shape and kh[vong].mean() > 0.5: continue                              # vòng 0,18 m quanh ô toàn gạch đỏ = không có khung đá
        o.append((x0, y0, x1, y1, n / ((x1 - x0) * (y1 - y0))))
    o.sort(key=lambda b: (b[1] + b[3]) / 2); hang = []
    for b in o:                                                                                        # gom hàng theo chồng đứng
        for hg in hang:
            t, d = max(b[1], hg[0][1]), min(b[3], hg[0][3])
            if d - t >= 0.5 * min(b[3] - b[1], hg[0][3] - hg[0][1]): hg.append(b); break
        else: hang.append([b])
    bu = 0
    for hg in hang:
        hg.sort(key=lambda b: b[0]); cum = [[hg[0]]]
        for b in hg[1:]:
            if (b[0] - cum[-1][-1][2]) / PX < 0.6: cum[-1].append(b)
            else: cum.append([b])
        if DEU: bu += deu_hoa(cum, o, sang, tuong, Lw * 0.85)
        cao = np.array([b[3] - b[1] for b in hg]) / PX; tin = float(np.mean([b[4] for b in hg])) * (1 - min(1, float(cao.std()) / float(cao.mean())))
        kq['hang'].append({'y0': round(m['y1'] - float(np.median([b[3] for b in hg])) / PX, 2), 'y1': round(m['y1'] - float(np.median([b[1] for b in hg])) / PX, 2),
                           'cum': [[round(c[0][0] / PX, 2), round(c[-1][2] / PX, 2), len(c)] for c in cum], 'tin': round(tin, 2)})
    kq['hang'].sort(key=lambda h_: -h_['y0'])
    if gach:                                                                                           # gờ đá ngang trên tường gạch
        da = tuong & (R - G < 12) & (sang > 110); do = do_; cot = do_.sum(0) >= 0.25 * np.maximum(1, tuong.sum(0))   # chỉ cột thuộc mảng gạch
        ti = np.array([da[y, cot].mean() if cot.any() else 0 for y in range(H)]); y = 0
        while y < H:
            if ti[y] >= 0.8:
                e = y
                while e < H and ti[e] >= 0.8: e += 1
                day = (e - y) / PX; tren = do[max(0, y - int(0.5 * PX)):y][:, cot]; duoi = do[e:e + int(0.5 * PX)][:, cot]
                if 0.12 <= day <= 0.7 and tren.size and duoi.size and tren.mean() > 0.4 and duoi.mean() > 0.4: kq['go_y'].append([round(m['y1'] - (y + e) / 2 / PX, 2), round(float(ti[y:e].mean()), 2)])
                y = e
            else: y += 1
    return kq, o

if TU_KIEM:
    import tempfile
    thu, PX = pathlib.Path(tempfile.mkdtemp(prefix='cua-tk-')), 24; W_, H_ = 10 * PX, 12 * PX; im = Image.new('RGBA', (W_, H_), (250, 250, 250, 255)); g = ImageDraw.Draw(im)
    gach, da, toi, kinh = (170, 70, 55, 255), (190, 185, 170, 255), (35, 38, 45, 255), (150, 175, 215, 255); hop = lambda x, y, w, h, mau: g.rectangle([x * PX, y * PX, (x + w) * PX - 1, (y + h) * PX - 1], fill=mau)
    hop(0, 1.5, 10, 10.5, gach); hop(0, 6.0, 10, 0.3, da)                                               # tường gạch từ y 1,5 m (trên là trời) + gờ đá ở 6,0–6,3 m
    for x in (2.0, 6.0): hop(x - 0.15, 2.85, 1.5, 2.0, da); hop(x, 3.0, 0.5, 1.7, toi); hop(x + 0.7, 3.0, 0.5, 1.7, toi)   # 2 cửa đôi (lòng tối) trong khung đá
    hop(6.7, 3.0, 0.5, 1.7, (78, 74, 72, 255))                                                          # ô phải cửa đôi thứ hai phản sáng: ngưỡng dò bỏ sót, điều hoà theo nhịp phải bù lại (--khong-deu thì hỏng)
    for x in (1.5, 4.5, 7.5): hop(x - 0.12, 7.38, 0.84, 1.64, da); hop(x, 7.5, 0.6, 1.4, kinh)             # 3 cửa đơn kính xanh
    hop(9.0, 1.5, 0.12, 9, toi)                                                                          # mồi: ống thoát nước
    for x in (3.3, 5.2): hop(x, 5.0, 0.5, 0.08, toi); hop(x + 0.21, 4.7, 0.08, 0.7, toi)                  # mồi: neo sắt chữ thập
    hop(8.2, 3.2, 0.5, 0.9, toi)                                                                         # mồi: mảng tối đặc giữa gạch, KHÔNG khung đá (neo sắt to / vệt bẩn)
    hop(9.7, 7.5, 0.3, 1.4, toi)                                                                         # mồi: ô bị cắt ở mép phải
    tep = thu / 'mat-tk-0.png'; im.save(tep); kq, _ = dem_mat({'khoi': 'tk', 'canh': 0, 'L': 10, 'px': PX, 'tep': str(tep), 'y1': 30.0})
    hg = kq['hang']; loi = []
    if [sorted(c[2] for c in h_['cum']) for h_ in hg] != [[2, 2], [1, 1, 1]]: loi.append(f"hàng / cụm {[[c[2] for c in h_['cum']] for h_ in hg]} ≠ [[2, 2], [1, 1, 1]]")
    elif abs(hg[0]['y0'] - 25.3) > 0.15 or abs(hg[0]['y1'] - 27.0) > 0.15 or abs(hg[0]['cum'][0][0] - 2.0) > 0.1 or abs(hg[0]['cum'][0][1] - 3.2) > 0.1: loi.append(f'vị trí cửa đôi lệch: {hg[0]}')
    if len(kq['go_y']) != 1 or abs(kq['go_y'][0][0] - 23.85) > 0.15: loi.append(f"gờ {kq['go_y']} ≠ một gờ ở 23,85")
    for d in loi: print('✗', d)
    print('dem-cua-so tự kiểm:', 'ĐẠT — 2 cửa đôi + 3 cửa đơn + 1 gờ, không dính ống nước / neo sắt / ô bị cắt' if not loi else 'HỎNG'); sys.exit(1 if loi else 0)

thu, I = pathlib.Path(sys.argv[1]), sys.argv[2]; ra = {}
for k, m in enumerate(json.load(open(thu / f'mat-{I}.json'))):
    kq, o = dem_mat(m); ra[f"{m['khoi']}#{m['canh']}"] = {x: v for x, v in kq.items() if x not in ('khoi', 'canh')}
    if VE and (o or kq['go_y']):
        im = Image.open(m['tep']).convert('RGB'); g = ImageDraw.Draw(im)
        for x0, y0, x1, y1, _ in o: g.rectangle([x0, y0, x1 - 1, y1 - 1], outline=(255, 0, 0))
        for y, _ in kq['go_y']: yy = (m['y1'] - y) * m['px']; g.line([0, yy, im.width, yy], fill=(255, 220, 0))
        im.save(thu / f'cua-{I}-{k}.png')
json.dump(ra, open(thu / f'cua-{I}.json', 'w'), ensure_ascii=False, indent=1)
for khoa, v in ra.items():
    if v['hang'] or v['go_y']: print(khoa, json.dumps({'thay': v['thay'], 'hang': [[h_['y0'], h_['y1'], [c[2] for c in h_['cum']], h_['tin']] for h_ in v['hang']], 'go_y': v['go_y'], 'phu': v['phu']}, ensure_ascii=False))
