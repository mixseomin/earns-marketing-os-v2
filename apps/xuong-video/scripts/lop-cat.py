#!/usr/bin/env python3
# CẮT – DÁN một người cho keyframe GHÉP TỪNG NGƯỜI (sinh-anh.ts › ghepTungNguoi). Nano Banana sửa nhân dạng trên CẢ khung thì vẽ lại bố cục (tập 122 #12:
# Hạ nhỏ ở góc thành chân dung giữa khung, Vivian quay lưng thành quay mặt) → cắt đúng hộp bao người (đo từ lớp độ sâu 3D), phóng lên cho người lấp khung,
# sửa trên ảnh cắt, rồi thu về đúng hộp và dán lên nền xanh cùng cỡ khung. 0đ (OpenCV, venv /opt/xv-soi-mat).
#   stdin {"op":"cat","sau":"<url độ sâu người>","anh":"<url ảnh FLUX>","ra":"<tệp jpg>","le":0.15} → {"hop":[x0,y0,x1,y1] (px trên ảnh), "w","h"}
#   stdin {"op":"dan","anh":"<url ảnh đã sửa>","hop":[…],"w":W,"h":H,"sau":"<url độ sâu người>","ra":"<tệp png>"[,"nen":"<url plate>"]} → {"ok":true} (nền xanh #00FF00 cùng cỡ khung; có nen = dán lên plate)
import json, sys, urllib.request, os
import numpy as np, cv2
def doc(u, mau=cv2.IMREAD_COLOR):
    b = open(u, 'rb').read() if os.path.exists(u) else urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'xv-lop-cat'}), timeout=60).read()
    im = cv2.imdecode(np.frombuffer(b, np.uint8), mau)
    if im is None: raise ValueError(f'không đọc được {u}')
    return im
v = json.load(sys.stdin)
if v['op'] == 'cat':
    sau = doc(v['sau'], cv2.IMREAD_GRAYSCALE); anh = doc(v['anh']); H, W = anh.shape[:2]
    ys, xs = np.nonzero(sau > 8)
    if not len(xs): print(json.dumps({'loi': 'lớp độ sâu không có người'})); sys.exit(0)
    sx, sy = W / sau.shape[1], H / sau.shape[0]
    x0, x1, y0, y1 = xs.min() * sx, (xs.max() + 1) * sx, ys.min() * sy, (ys.max() + 1) * sy
    le = float(v.get('le', 0.15)); dx, dy = (x1 - x0) * le, (y1 - y0) * le
    x0, y0, x1, y1 = x0 - dx, y0 - dy, x1 + dx, y1 + dy
    # HỘP CÙNG TỶ LỆ ẢNH MODEL TRẢ (ti = rộng/cao, mặc định 9:16): Nano Banana luôn trả khung cố định — hộp cắt hẹp cao (người đứng) mà dán ngược
    # về hộp cũ là kéo dãn lệch hai chiều, người méo (anh 18/10/2026: "sao ảnh người thật cứ méo"). Nới hộp về đúng tỷ lệ quanh tâm người; phần
    # vượt mép ảnh độn nền xanh.
    A = float(v.get('ti', 9 / 16)); cx, cy, bw, bh = (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0
    if bw / bh < A: bw = bh * A
    else: bh = bw / A
    x0, y0, x1, y1 = [int(round(t)) for t in (cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)]
    p0, q0, p1, q1 = max(0, -x0), max(0, -y0), max(0, x1 - W), max(0, y1 - H)
    cat = cv2.copyMakeBorder(anh[max(0, y0):min(H, y1), max(0, x0):min(W, x1)], q0, q1, p0, p1, cv2.BORDER_CONSTANT, value=(0, 255, 0)); k = 1024 / max(cat.shape[:2])
    cv2.imwrite(v['ra'], cv2.resize(cat, None, fx=k, fy=k, interpolation=cv2.INTER_LANCZOS4), [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(json.dumps({'hop': [x0, y0, x1, y1], 'w': W, 'h': H}))
elif v['op'] == 'dan':
    # KHỚP BÓNG NGƯỜI: tách nền xanh ảnh đã sửa → bóng người model vẽ ra; co giãn + dời cho khớp HỘP BÓNG NGƯỜI của lớp độ sâu 3D (khớp chiều cao,
    # chân chạm cùng đáy, giữa theo chiều ngang). Model hay phóng / thu người trong ảnh cắt (#12 Thần thành nửa người) → dán thẳng thì sai cỡ, cụt.
    x0, y0, x1, y1 = v['hop']; W, H = int(v['w']), int(v['h'])
    sua = cv2.resize(doc(v['anh']), (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA)   # hộp đã cùng tỷ lệ ảnh model (op cat) → co đều hai chiều
    ox0, oy0, ox1, oy1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)   # hộp vượt mép ảnh (phần độn xanh) → cắt về trong khung
    sua = sua[oy0 - y0:oy1 - y0, ox0 - x0:ox1 - x0]; x0, y0, x1, y1 = ox0, oy0, ox1, oy1
    nen = np.zeros((H, W, 3), np.uint8); nen[:] = (0, 255, 0)
    if v.get('nen'):   # DỰNG TẠI CHỖ: dán về đúng ô trên chính ảnh plate (theo mặt nạ người 3D), không khớp bóng / không co
        g = doc(v['nen']); nen = cv2.resize(g, (W, H), interpolation=cv2.INTER_AREA) if g.shape[:2] != (H, W) else g
    hsv = cv2.cvtColor(sua, cv2.COLOR_BGR2HSV); xanh = cv2.inRange(hsv, (35, 90, 70), (85, 255, 255)) > 0
    nguoi = cv2.morphologyEx((~xanh).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    ok = False; cut = False
    # CỤT: người model vẽ chạm mép dưới ảnh cắt mà bóng 3D thì kết trước mép (còn chân) → model tự cắt nửa người (#12 Thần) — giãn ra là sai tỷ lệ:
    # dùng người của ảnh FLUX gốc (đủ người, đúng dáng) thay cho bản sửa
    if not v.get('nen') and v.get('sau') and v.get('goc') and nguoi.mean() < 0.9 and nguoi[-3:].mean() > 0.02:
        m3 = cv2.resize(doc(v['sau'], cv2.IMREAD_GRAYSCALE), (W, H), interpolation=cv2.INTER_NEAREST) > 8
        if m3[y1 - 3:y1].mean() < 0.005:
            g = doc(v['goc']); g = cv2.resize(g, (W, H)) if g.shape[:2] != (H, W) else g
            sua = g[y0:y1, x0:x1]; cut = True
            r = max(3, int(H * 0.012)); m = cv2.dilate(m3.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))[y0:y1, x0:x1] > 0
            vung = nen[y0:y1, x0:x1]; vung[m] = sua[m]; ok = True
    if ok: pass
    elif not v.get('nen') and v.get('sau') and nguoi.mean() < 0.9:   # có nền xanh thật thì khớp bóng; không (model bỏ nền xanh) → dán theo mặt nạ cũ
        m3 = cv2.resize(doc(v['sau'], cv2.IMREAD_GRAYSCALE), (W, H), interpolation=cv2.INTER_NEAREST) > 8
        ty, tx = np.nonzero(m3); sy, sx = np.nonzero(nguoi)
        # BÓNG 3D BỊ MÉP KHUNG CẮT (cú qua vai: chỉ lộ vai / lưng người tiền cảnh, #14 Vivian) → chiều cao bóng không phải chiều cao người; co người
        # model vẽ cho bằng nó là người tí hon. Bỏ khớp bóng, dán ảnh sửa đúng hộp (đã cùng tỷ lệ, không méo).
        cham_mep = len(tx) and (tx.min() <= 1 or ty.min() <= 1 or tx.max() >= W - 2 or ty.max() >= H - 2)
        if len(tx) and len(sx) and not cham_mep:
            th = ty.max() - ty.min() + 1; sh = sy.max() - sy.min() + 1; k = th / sh
            cat = sua[sy.min():sy.max() + 1, sx.min():sx.max() + 1]; mk = nguoi[sy.min():sy.max() + 1, sx.min():sx.max() + 1].astype(np.uint8)
            cat = cv2.resize(cat, None, fx=k, fy=k, interpolation=cv2.INTER_LANCZOS4); mk = cv2.resize(mk, (cat.shape[1], cat.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
            cx = int((tx.min() + tx.max()) / 2); bx = cx - cat.shape[1] // 2; by = ty.max() + 1 - cat.shape[0]
            ax0, ay0 = max(0, bx), max(0, by); ax1, ay1 = min(W, bx + cat.shape[1]), min(H, by + cat.shape[0])
            vung = nen[ay0:ay1, ax0:ax1]; c2 = cat[ay0 - by:ay1 - by, ax0 - bx:ax1 - bx]; m2 = mk[ay0 - by:ay1 - by, ax0 - bx:ax1 - bx]
            vung[m2] = c2[m2]; ok = True
    if not ok:
        vung = nen[y0:y1, x0:x1]
        if v.get('sau'):
            m = cv2.resize(doc(v['sau'], cv2.IMREAD_GRAYSCALE), (W, H), interpolation=cv2.INTER_NEAREST) > 8
            r = max(3, int(H * 0.025)); m = cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))[y0:y1, x0:x1] > 0
            vung[m] = sua[m]
        else: vung[:] = sua
    cv2.imwrite(v['ra'], nen, [cv2.IMWRITE_JPEG_QUALITY, 95]) if v['ra'].endswith('.jpg') else cv2.imwrite(v['ra'], nen); print(json.dumps({'ok': True, 'khop': ok, 'cut': cut}))
