#!/usr/bin/env python3
"""SO MÔ HÌNH VỚI ẢNH THẬT ĐÚNG CAMERA — nửa đo của scripts/so-anh-that.mjs (nửa vẽ). Không AI: OpenCV.

  python3 so-anh-that.py <thư mục .so-anh/<khối>> truoc|sau      (so-anh-that.mjs gọi)
  python3 so-anh-that.py --tu-kiem                                bài kiểm có thể hỏng (mô hình so với chính nó / dời 20 px)

Mỗi ảnh:
  - độ sâu → toạ độ 3D từng điểm ảnh → khối OSM chứa điểm đó (mặt bằng tô lên lưới 0,25 m) → mặt: tường gần nhất 'khối#cạnh' hoặc 'khối#mái' (pháp tuyến đứng)
  - VIỀN TRỜI: ảnh (trời xanh / mây sáng phẳng, nối từ mép trên) ↔ mô hình (không có gì phía sau) theo từng cột trong dải lâu đài
    → đoạn THIẾU (ảnh cao hơn: chóp, mái, tháp còn thiếu) / THỪA (mô hình cao hơn), kèm khối#cạnh dưới đoạn + độ lệch đổi ra mét
  - NÉT: nét ảnh (Canny) ↔ nét mô hình (Canny ảnh màu + gãy độ sâu + gãy pháp tuyến) từng mặt: tỉ lệ nét ảnh có nét mô hình trong r px (đủ chi tiết),
    tỉ lệ nét mô hình có nét ảnh (đúng chỗ) → F; mặt kém nhất dò thêm độ dời (dx, dy) cho F lớn nhất = lệch vị trí
  - ảnh ghép <ảnh>-so.png: ẢNH THẬT (viền đỏ) · MÔ HÌNH (viền xanh) · CHỒNG (đoạn thiếu đỏ / thừa xanh dương, 6 mặt kém nhất khung vàng đánh số)
  - nhãn 'sau' + có 'truoc' → <ảnh>-truoc-sau.png: ẢNH THẬT · TRƯỚC · SAU + bảng điểm; SAU kém TRƯỚC (viền −2 điểm % hoặc nét khối chọn −0,03) → mã thoát 1
"""
import json, sys, math, pathlib
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
fo = lambda s: ImageFont.truetype(FONT, s)


def giai_sau(tep, xa):
    s = cv2.imread(str(tep)).astype(np.float64)
    return (s[..., 2] * 65536 + s[..., 1] * 256 + s[..., 0]) / 16777215 * xa


def diem3d(sau, d):
    """độ sâu dọc trục → toạ độ cảnh (H, W, 3); camera three.js nhìn −Z"""
    H, W = sau.shape; t = math.tan(math.radians(d['fov']) / 2); M = np.array(d['m']).reshape(4, 4).T
    u = ((np.arange(W) + 0.5) / W * 2 - 1) * t * W / H; v = (1 - (np.arange(H) + 0.5) / H * 2) * t
    P = np.stack([np.broadcast_to(u[None, :], (H, W)) * sau, np.broadcast_to(v[:, None], (H, W)) * sau, -sau], -1)
    return P @ M[:3, :3].T + M[:3, 3]


class BanDo:
    """mặt bằng các khối tô lên lưới 0,25 m (khối nhỏ tô sau đè khối lớn: tháp trong thân) + tra mặt"""
    def __init__(s, khoi):
        s.khoi = khoi; xs = [p[0] for k in khoi for p in k['v']]; zs = [p[1] for k in khoi for p in k['v']]
        s.x0, s.z0, s.b = min(xs) - 5, min(zs) - 5, 0.25
        s.lab = np.zeros((int((max(zs) + 5 - s.z0) / s.b) + 1, int((max(xs) + 5 - s.x0) / s.b) + 1), np.uint16)
        dt = lambda v: abs(sum(v[i][0] * v[(i + 1) % len(v)][1] - v[(i + 1) % len(v)][0] * v[i][1] for i in range(len(v)))) / 2
        for i in sorted(range(len(khoi)), key=lambda i: -dt(khoi[i]['v'])):
            cv2.fillPoly(s.lab, [np.round((np.array(khoi[i]['v']) - [s.x0, s.z0]) / s.b).astype(np.int32)], i + 1)
        s.lab = np.where(s.lab > 0, s.lab, cv2.dilate(s.lab, np.ones((9, 9), np.uint8)))  # điểm sát chân tường (độ sâu lệch vài tấc) vẫn thuộc khối

    def mat(s, P, nhan_mai):
        """P (N,3) → mảng chuỗi tên mặt ('' = không thuộc khối)"""
        i = np.clip(np.round((P[:, 2] - s.z0) / s.b).astype(int), 0, s.lab.shape[0] - 1); j = np.clip(np.round((P[:, 0] - s.x0) / s.b).astype(int), 0, s.lab.shape[1] - 1)
        k = s.lab[i, j].astype(int) - 1; ra = np.full(len(P), '', dtype=object)
        for kk in np.unique(k[k >= 0]):
            c = np.where(k == kk)[0]; v = np.array(s.khoi[kk]['v'], float); a, b = v, np.roll(v, -1, 0); q = P[c][:, [0, 2]]
            ab = b - a; t = np.clip(((q[:, None, :] - a[None]) * ab[None]).sum(-1) / np.maximum((ab ** 2).sum(-1), 1e-9)[None], 0, 1)
            canh = np.argmin(((a[None] + t[..., None] * ab[None] - q[:, None, :]) ** 2).sum(-1), 1)
            ra[c] = [f"{s.khoi[kk]['id']}#{'mái' if m else e}" for e, m in zip(canh, nhan_mai[c])]
        return ra


class Dom:
    """NHÂN CHỨNG THỨ BA (21/11/2026): ảnh ↔ mô hình lệch thì chưa biết bên nào sai — camera PnP lệch 1 m ở 25 m (ảnh chụp trong sân) đủ làm mái thật
    "biến mất" khỏi tia (Castelul-16: mô hình khớp DOM20 trong 1 m dọc cánh 223069513, ảnh vẫn thấy nhà nơi tia đi qua trời). DOM20 (mặt trên thật 20 cm, Bavaria)
    không phụ thuộc camera ảnh lẫn mô hình: bắn tia của chính điểm ảnh vào DOM20 → viền trời DOM20 vD từng cột. vD ≈ vA, ≠ vM → lỗi MÔ HÌNH;
    vD ≈ vM, ≠ vA → lỗi CAMERA (ảnh chưa tin, không sửa mô hình theo nó). Thiếu tệp DOM20 (du-lieu-goc/bayern, scripts/tai-bayern.sh) → bỏ qua, báo một dòng."""
    def __init__(s):
        G = pathlib.Path(__file__).resolve().parent.parent / 'du-lieu-goc/bayern'; s.ok = (G / 'dom20-32631_5268.tif').exists() and (G / 'so-dom20.json').exists()
        if not s.ok: return
        import tifffile
        s.a = tifffile.imread(G / 'dom20-32631_5268.tif').astype(np.float32); S = json.loads((G / 'so-dom20.json').read_text())
        s.goc = json.loads((G / 'diem-mo-hinh.json').read_text())['goc']; s.dx, s.dz, s.bu = S['dx'], S['dz'], S['bu']
        g = math.radians(1.7498 * math.sin(math.radians(47.5576))); s.c, s.s = math.cos(g), math.sin(g)
        s.tran = float(np.nanmax(np.where(s.a < -1000, np.nan, s.a))) - s.goc - s.bu  # mặt cao nhất trong ô: tia lên quá mức này chắc chắn là trời
        # bước tia: 0,5 m tới 100 m, sau đó 0,5 % quãng (ảnh chụp từ Hohenschwangau / Marienbrücke cách 0,5–2 km)
        T = [0.5]
        while T[-1] < 2500: T.append(T[-1] + max(0.5, 0.005 * T[-1]))
        s.T = np.array(T, np.float32)

    def cao(s, x, z):  # độ cao cảnh của DOM20 tại các điểm (mảng); ngoài ô / ô trống → NaN (không biết)
        x, z = x + s.dx, -(z + s.dz); E = 631637.44 + (s.c * x - s.s * z) * 0.99981; N = 5268614.78 + (s.s * x + s.c * z) * 0.99981
        j = ((E - 631000) / 0.2).astype(int); i = ((5269000 - N) / 0.2).astype(int); ok = (i >= 0) & (i < s.a.shape[0]) & (j >= 0) & (j < s.a.shape[1])
        h = np.full(x.shape, np.nan, np.float32); h[ok] = s.a[i[ok], j[ok]]; h[h < -1000] = np.nan; return h - s.goc - s.bu

    def vien(s, d, xs, Ci, y_max):
        """viền trời DOM20 ở các cột xs (khung ĐÃ canh): hàng đầu tiên mà tia điểm ảnh (đổi ngược về khung camera bằng Ci) chạm mặt DOM20.
        Hàng trên đó phải BIẾT là trời (tia lên quá mặt cao nhất của ô trước khi ra khỏi ô) — tia đi ra ngoài ô 1 km còn thấp (núi phía sau ô) thì cột đó −1 (không biết):
        DOM20 không thấy núi ngoài ô, đừng để nó "chứng" rằng ảnh sai."""
        H, W = d['H'], d['W']; t = math.tan(math.radians(d['fov']) / 2); M = np.array(d['m']).reshape(4, 4).T; o = M[:3, 3]; ra = []
        for x, ym in zip(xs, y_max):
            ys = np.arange(0, min(H, ym), 2, dtype=np.float32); X = Ci[0, 0] * x + Ci[0, 1] * ys + Ci[0, 2]; Y = Ci[1, 0] * x + Ci[1, 1] * ys + Ci[1, 2]
            v = np.stack([((X + 0.5) / W * 2 - 1) * t * W / H, (1 - (Y + 0.5) / H * 2) * t, -np.ones_like(X)], -1) @ M[:3, :3].T; v /= np.linalg.norm(v, axis=1, keepdims=True)
            c, biet = s.cham(o, v, True); k = int(np.argmax(c)) if c.any() else len(ys)
            ra.append(-1 if not biet[:k].all() else int(ys[k]) if k < len(ys) else H)
        return np.array(ra)

    def cham(s, o, v, biet=False, xa=2500):
        """tia từ o theo các hướng v (đơn vị): chạm mặt DOM20 trước khi ra khỏi ô không; biet=True trả thêm "không chạm là chắc trời"
        (mọi điểm trên tia hoặc trong ô dưới mặt, hoặc đã cao hơn mặt cao nhất của ô)"""
        T = s.T[s.T <= xa]; P = np.asarray(o, np.float32)[None, None] + v[:, None].astype(np.float32) * T[None, :, None]
        # chạm = đi từ TRÊN mặt xuống dưới mặt: camera đứng dưới mái hiên / tán cây / thấp hơn mặt sân DOM vài dm thì đoạn đầu tia nằm dưới mặt — không tính là chạm
        h = s.cao(P[..., 0], P[..., 2]); tren = h < P[..., 1]; da_tren = np.zeros_like(tren); da_tren[:, 1:] = np.maximum.accumulate(tren, 1)[:, :-1]
        cc = (h >= P[..., 1]) & da_tren; c = cc.any(1)
        if biet == 'diem': return np.where(c[:, None], P[np.arange(len(v)), np.argmax(cc, 1)], np.nan)  # điểm chạm đầu tiên (N, 3), không chạm → NaN
        if not biet: return c
        return c, c | (~np.isnan(h) | (P[..., 1] > s.tran)).all(1)


DOM = Dom()


def phap_tuyen(P):
    dx = np.zeros_like(P); dy = np.zeros_like(P); dx[:, 1:-1] = P[:, 2:] - P[:, :-2]; dy[1:-1] = P[2:] - P[:-2]
    n = np.cross(dx, dy); return n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-9)


def troi_anh(anh, troiM, vM):
    """trời trong ảnh chụp, QUÉT TỪNG CỘT từ mép trên (bản 3 — bản k-means toàn khung học nhầm màu tường khi trời giáp tường).
    Mẫu màu trời: chỉ ở 15 % khung trên cùng, nơi mô hình nói là trời và cao hẳn trên viền mô hình (≥ 8 % khung), điểm phẳng.
    Mỗi cột đi xuống: còn gần mẫu (Lab ≤ 12, hoặc mây / nắng loá rất sáng ít màu) thì còn là trời; gặp ≥ 6 điểm liền không phải trời thì dừng
    → cành cây mảnh, dây điện (≤ 5 điểm) đi xuyên qua. Viền thu được lọc trung vị 5 cột. Thiếu mẫu (< 300 điểm) → quy tắc trời xanh / mây sáng."""
    H, W = anh.shape[:2]; bl = cv2.GaussianBlur(anh, (5, 5), 0); lab = cv2.cvtColor(bl, cv2.COLOR_BGR2LAB).astype(np.float32)
    hang = np.arange(H)[:, None]; b, gg, r = [bl[..., i].astype(int) for i in range(3)]; mx, mn = np.maximum(np.maximum(r, gg), b), np.minimum(np.minimum(r, gg), b)
    sang = (mn > 200) & (mx - mn < 30)
    g = cv2.cvtColor(bl, cv2.COLOR_BGR2GRAY).astype(np.float32); phang = cv2.blur(cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)), (7, 7)) < 60
    mau = troiM & (hang < np.array(vM)[None, :] - 0.08 * H) & (hang < 0.15 * H) & phang
    if mau.sum() >= 300:
        X = lab[mau][:: max(1, int(mau.sum() // 8000))]; _, _, tam = cv2.kmeans(X, min(12, len(X) // 25), None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5), 2, cv2.KMEANS_PP_CENTERS)
        nho = cv2.resize(lab, (W // 2, H // 2), interpolation=cv2.INTER_AREA).reshape(-1, 3)
        dmin = np.min(((nho[:, None, :] - tam[None]) ** 2).sum(-1), 1).reshape(H // 2, W // 2)
        ung = cv2.resize((dmin <= 12 ** 2).astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST).astype(bool) | sang
    else:
        ung = ((b > r + 12) & (b > 90)) | sang
    khong = (~ung).astype(np.int32); cs = np.vstack([np.zeros((1, W), np.int32), np.cumsum(khong, 0)])
    RUN = 6; chay_ = cs[RUN:] - cs[:-RUN] >= RUN  # hàng y: y … y+5 đều không phải trời
    co = chay_.any(0); y = np.where(co, np.argmax(chay_, 0), H)
    y = cv2.medianBlur(y.astype(np.float32).reshape(1, -1), 5).ravel().astype(int)
    return hang < y[None, :]


def vien(mask_troi):
    """viền = hàng đầu tiên không phải trời, từng cột"""
    kh = ~mask_troi; c = kh.any(0); y = np.argmax(kh, 0); y[~c] = mask_troi.shape[0]; return y


def net_mo_hinh(mh, sau, n):
    e = cv2.Canny(cv2.GaussianBlur(cv2.cvtColor(mh, cv2.COLOR_BGR2GRAY), (3, 3), 0), 40, 110) > 0
    dg = np.zeros(sau.shape, bool); s = np.maximum(sau, 1e-3)
    dg[:, 1:] |= np.abs(np.diff(sau, axis=1)) / s[:, 1:] > 0.03; dg[1:] |= np.abs(np.diff(sau, axis=0)) / s[1:] > 0.03
    gn = np.zeros(sau.shape, bool); gn[:, 1:] |= (n[:, 1:] * n[:, :-1]).sum(-1) < 0.85; gn[1:] |= (n[1:] * n[:-1]).sum(-1) < 0.85
    return net_cau_truc(e | dg | (gn & (sau > 0)), max(14, 0.02 * mh.shape[0]))


def net_cau_truc(e, dai):
    """chỉ giữ nét dài (mép tường, khung cửa, gờ, mái) — bỏ vân đá, mạch vữa, lá: thành phần nối liền có đường chéo khung ≥ dai px"""
    n, lab, st, _ = cv2.connectedComponentsWithStats(e.astype(np.uint8), connectivity=8)
    giu = np.hypot(st[:, cv2.CC_STAT_WIDTH], st[:, cv2.CC_STAT_HEIGHT]) >= dai; giu[0] = False
    return giu[lab]


def net_anh(anh):
    """nét cấu trúc của ảnh chụp: lọc song phương (xoá vân đá giữ mép) → Canny ngưỡng theo trung vị → nét dài"""
    g = cv2.bilateralFilter(anh, 9, 60, 7); g = cv2.createCLAHE(2.0, (8, 8)).apply(cv2.cvtColor(g, cv2.COLOR_BGR2GRAY)); md = float(np.median(g))
    return net_cau_truc(cv2.Canny(g, max(20, int(0.5 * md)), min(255, int(1.1 * md))) > 0, max(14, 0.02 * anh.shape[0]))


def canh_khung(eA, eM, co_mh):
    """KHUNG TRƯỚC, CHI TIẾT SAU: camera định vị còn sai vài phần trăm (ống kính, hướng) → mọi mặt lệch cùng một kiểu, đọc thành lỗi mô hình là sai.
    Dò phép đồng dạng (tỉ lệ 0,85–1,18 · xoay ±2° · dời ±8 % khung) đưa nét mô hình trùng nét ảnh nhiều nhất (chamfer hai chiều, thô → mịn) → trả ma trận 2×3.
    Phần lệch còn lại sau khi canh mới là lỗi hình khối của từng mặt."""
    H, W = eA.shape; k = 4; h, w = H // k, W // k
    a = cv2.dilate(eA.astype(np.uint8), np.ones((k, k), np.uint8))[::k, ::k] > 0; m = cv2.dilate(eM.astype(np.uint8), np.ones((k, k), np.uint8))[::k, ::k] > 0
    dA = cv2.distanceTransform((~a).astype(np.uint8), cv2.DIST_L2, 3); ys, xs = np.where(m); vung = cv2.dilate(co_mh.astype(np.uint8), np.ones((25, 25), np.uint8))[::k, ::k] > 0
    ya, xa = np.where(a & vung)
    if len(xs) < 50 or len(xa) < 50: return np.float32([[1, 0, 0], [0, 1, 0]]), 0.0
    dM0 = cv2.distanceTransform((~m).astype(np.uint8), cv2.DIST_L2, 3)
    def diem(s, r, dx, dy):
        M = cv2.getRotationMatrix2D((w / 2, h / 2), r, s); M[:, 2] += (dx, dy)
        X = M[0, 0] * xs + M[0, 1] * ys + M[0, 2]; Y = M[1, 0] * xs + M[1, 1] * ys + M[1, 2]; ok = (X >= 0) & (X < w) & (Y >= 0) & (Y < h)
        if ok.mean() < 0.5: return -1
        tr = float((dA[Y[ok].astype(int), X[ok].astype(int)] <= 2).mean())
        Mi = cv2.invertAffineTransform(M); X2 = Mi[0, 0] * xa + Mi[0, 1] * ya + Mi[0, 2]; Y2 = Mi[1, 0] * xa + Mi[1, 1] * ya + Mi[1, 2]; o2 = (X2 >= 0) & (X2 < w) & (Y2 >= 0) & (Y2 < h)
        nguoc = float((dM0[Y2[o2].astype(int), X2[o2].astype(int)] <= 2).mean()) if o2.any() else 0
        return 2 * tr * nguoc / max(tr + nguoc, 1e-9)
    g0 = diem(1, 0, 0, 0); tot = (g0, 1.0, 0.0, 0, 0); D = 0.08
    for s in np.arange(0.85, 1.19, 0.03):
        for dx in np.arange(-D * w, D * w + 1, 3):
            for dy in np.arange(-D * h, D * h + 1, 3):
                f = diem(s, 0, dx, dy)
                if f > tot[0]: tot = (f, s, 0.0, dx, dy)
    for _ in range(2):  # mịn: tỉ lệ ±0,015, xoay ±2°, dời ±2 ô nhỏ
        f0, s0, r0, x0, y0 = tot
        for s in (s0 - 0.015, s0, s0 + 0.015):
            for r in (r0 - 1, r0, r0 + 1):
                for dx in (x0 - 1.5, x0, x0 + 1.5):
                    for dy in (y0 - 1.5, y0, y0 + 1.5):
                        if abs(r) <= 2:
                            f = diem(s, r, dx, dy)
                            if f > tot[0]: tot = (f, s, r, dx, dy)
    f, s, r, dx, dy = tot
    if f < g0 + 0.03: return np.float32([[1, 0, 0], [0, 1, 0]]), 0.0  # không hơn rõ → giữ camera đo
    M = cv2.getRotationMatrix2D((W / 2, H / 2), r, s); M[:, 2] += (dx * k, dy * k); return M.astype(np.float32), round(f - g0, 3)


def phan_tich(anh, d, thu, bd, chon):
    H, W = d['H'], d['W']; ten = d['ten']
    mh = cv2.imread(str(thu / f'{ten}-mo-hinh.jpg')); sau = giai_sau(thu / f'{ten}-sau.png', d['xa'])
    troiM = (sau <= 1e-6) | (sau >= 0.999 * d['xa']); sau = np.where(troiM, 0, sau)
    P = diem3d(sau, d); n = phap_tuyen(P); mai = np.abs(n[..., 1]) > 0.7
    co = ~troiM; idx = np.where(co.ravel())[0]
    MAT = np.full(H * W, '', dtype=object); MAT[idx] = bd.mat(P.reshape(-1, 3)[idx], mai.ravel()[idx]); MAT = MAT.reshape(H, W)
    # canh khung: dời / phóng mọi lớp mô hình cho nét trùng nét ảnh, rồi mới đo
    eM0 = net_mo_hinh(mh, sau, n) & (MAT != ''); eA0 = net_anh(anh) & ~(troiM & (np.arange(H)[:, None] < vien(troiM)[None, :] - 0.08 * H))
    CK, loi_ck = canh_khung(eA0, eM0, MAT != '')
    if loi_ck:
        wa = lambda x, nen=0: cv2.warpAffine(x, CK, (W, H), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=nen)
        mh = cv2.warpAffine(mh, CK, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE); sau = wa(sau.astype(np.float32)).astype(np.float64)
        troiM = wa(troiM.astype(np.uint8), 1).astype(bool); n = np.stack([wa(n[..., i].astype(np.float32)) for i in range(3)], -1)
        _, inv = np.unique(MAT, return_inverse=True); ten_m = np.unique(MAT); MAT = ten_m[wa(inv.reshape(H, W).astype(np.float32), float(np.where(ten_m == '')[0][0]) if '' in ten_m else 0).astype(int)]
        MAT[troiM] = ''
    vM = vien(troiM); vA = vien(troi_anh(anh, troiM, vM))
    lau = MAT != ''
    cot = np.where(lau.any(0))[0]
    if not len(cot): return None
    x0, x1 = int(cot.min()), int(cot.max()); tol = max(5, round(0.007 * H)); m_px = lambda y, x: 2 * sau[min(H - 1, y), x] * math.tan(math.radians(d['fov']) / 2) / H
    xet = [x for x in range(x0, x1 + 1) if vM[x] < H or vA[x] < H]
    doan, cur = [], None
    for x in xet:
        dy = int(vM[x]) - int(vA[x]); kieu = 'THIẾU' if dy > tol else 'THỪA' if dy < -tol else None
        if kieu and cur and cur['kieu'] == kieu and x - cur['x1'] <= 2: cur['x1'] = x; cur['cot'].append((x, dy))
        else:
            if cur: doan.append(cur)
            cur = {'kieu': kieu, 'x0': x, 'x1': x, 'cot': [(x, dy)]} if kieu else None
    if cur: doan.append(cur)
    ra_doan = []
    for s_ in doan:
        if s_['x1'] - s_['x0'] < 2: continue
        xm, dym = max(s_['cot'], key=lambda c: abs(c[1])); yk = min(H - 1, int(vM[xm]) + 3)
        nhan = [MAT[min(H - 1, int(vM[x]) + 3), x] for x, _ in s_['cot'] if vM[x] < H]; nhan = [m for m in nhan if m]
        mat_ = max(set(nhan), key=nhan.count) if nhan else '(ngoài khối — địa hình / cây)'
        ra_doan.append({'kieu': s_['kieu'], 'x0': s_['x0'], 'x1': s_['x1'], 'lech_px': abs(dym), 'lech_m': round(abs(dym) * m_px(yk, xm), 2) if vM[xm] < H and nhan else None,
                        'mat': mat_, 'y': int(min(vA[xm], vM[xm]))})
    cot_lau = [x for x in xet if lau[:, x].any()]
    vien_khop = sum(1 for x in cot_lau if abs(int(vM[x]) - int(vA[x])) <= tol) / max(1, len(cot_lau))
    # nhân chứng DOM20: mỗi đoạn lệch xét 3 cột (tứ phân vị + cột lệch nhất), cả khung xét mỗi 16 cột lâu đài → độ tin camera
    dom, tolD, Ci = DOM, round(1.5 * tol), cv2.invertAffineTransform(CK)
    nhan_chung = {'co': bool(dom and dom.ok)}
    if nhan_chung['co']:
        ym = lambda xs: [int(max(vA[x], vM[x])) + 3 * tolD for x in xs]
        for s_ in ra_doan:
            xs = sorted({s_['x0'] + (s_['x1'] - s_['x0']) // 4, (s_['x0'] + s_['x1']) // 2, s_['x1'] - (s_['x1'] - s_['x0']) // 4})
            vD = dom.vien(d, xs, Ci, ym(xs)); khop_a = sum(abs(int(vD[i]) - int(vA[x])) <= tolD for i, x in enumerate(xs)); khop_m = sum(abs(int(vD[i]) - int(vM[x])) <= tolD for i, x in enumerate(xs))
            s_['dom'] = 'mo_hinh' if khop_a >= 2 and khop_m == 0 else 'camera' if khop_m >= 2 and khop_a == 0 else 'chua_ro'; s_['vD'] = [[int(x), int(vD[i])] for i, x in enumerate(xs)]
            if s_['dom'] == 'mo_hinh': s_['sua'] = cho_sua(s_, d, Ci, vA, vM, sau, dom)
        mau = cot_lau[::16]; vD = dom.vien(d, mau, Ci, ym(mau)); co_d = [i for i, x in enumerate(mau) if 0 <= vD[i] < H]
        nhan_chung.update({'cot': len(co_d), 'anh_khop': round(sum(abs(int(vD[i]) - int(vA[mau[i]])) <= tolD for i in co_d) / max(1, len(co_d)), 3),
                           'mh_khop': round(sum(abs(int(vD[i]) - int(vM[mau[i]])) <= tolD for i in co_d) / max(1, len(co_d)), 3), 'vD': [[int(mau[i]), int(vD[i])] for i in co_d]})
        nhan_chung['camera_tin'] = nhan_chung['cot'] < 8 or nhan_chung['anh_khop'] >= 0.7 or nhan_chung['anh_khop'] >= nhan_chung['mh_khop'] - 0.1
    # nét theo mặt
    eM = net_mo_hinh(mh, sau, n); eA = net_anh(anh) & cv2.dilate(lau.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~troiM
    eM &= lau; r = max(3, round(0.004 * H))
    dM = cv2.distanceTransform((~eM).astype(np.uint8), cv2.DIST_L2, 3); dA = cv2.distanceTransform((~eA).astype(np.uint8), cv2.DIST_L2, 3)
    mats = {}
    for m in np.unique(MAT[lau]):
        vung = MAT == m; dt = int(vung.sum())
        if dt < 1500: continue
        a, b = eA & vung, eM & vung; na, nb = int(a.sum()), int(b.sum())
        if na < 60: continue
        R = float((dM[a] <= r).mean()); Pp = float((dA[b] <= r).mean()) if nb else 0.0
        ys, xs = np.where(vung); mats[m] = {'dien_tich': dt, 'net_anh': na, 'net_mh': nb, 'du': round(R, 3), 'dung': round(Pp, 3), 'F': round(2 * R * Pp / max(R + Pp, 1e-9), 3),
                                            'hop': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], 'm_px': round(float(np.median(sau[vung])) * 2 * math.tan(math.radians(d['fov']) / 2) / H, 4)}
    kem = sorted(mats, key=lambda m: mats[m]['F'])[:6]
    for m in kem:  # dò độ dời cho mặt kém: dời nét mô hình (dx, dy) ±10 px, F lớn nhất
        x_, y_, X_, Y_ = mats[m]['hop']; pad = 12; sl = (slice(max(0, y_ - pad), Y_ + pad + 1), slice(max(0, x_ - pad), X_ + pad + 1))
        a = eA[sl] & (MAT[sl] == m); bM = (eM & (MAT == m))[sl]; tot, best = -1, (0, 0)
        for dx in range(-10, 11, 2):
            for dy in range(-10, 11, 2):
                bb = np.roll(np.roll(bM, dy, 0), dx, 1); dB = cv2.distanceTransform((~bb).astype(np.uint8), cv2.DIST_L2, 3); f = float((dB[a] <= r).mean()) if a.any() else 0
                if f > tot + 0.02 or (abs(f - tot) <= 0.02 and abs(dx) + abs(dy) < abs(best[0]) + abs(best[1])): tot, best = max(tot, f), (dx, dy)
        mats[m]['doi_px'] = list(best); mats[m]['doi_m'] = [round(best[0] * mats[m]['m_px'], 2), round(-best[1] * mats[m]['m_px'], 2)]
    trong = [m for m in mats if m.split('#')[0] in chon] or list(mats)
    F_chon = sum(mats[m]['F'] * mats[m]['net_anh'] for m in trong) / max(1, sum(mats[m]['net_anh'] for m in trong))
    ck = {'ti_le': round(float(np.hypot(CK[0, 0], CK[0, 1])), 3), 'xoay': round(float(np.degrees(np.arctan2(CK[1, 0], CK[0, 0]))), 2), 'doi_px': [round(float(CK[0, 2] - (1 - CK[0, 0]) * W / 2 + CK[0, 1] * H / 2)), round(float(CK[1, 2] - (1 - CK[1, 1]) * H / 2 - CK[1, 0] * W / 2))], 'tang_F': loi_ck}
    return {'ten': ten, 'tep': d['tep'], 'canh_khung': ck, 'tacGia': d.get('tacGia', ''), 'giayPhep': d.get('giayPhep', ''), 'vien_khop': round(vien_khop, 3), 'net_chon': round(F_chon, 3),
            'doan': ra_doan, 'dom': nhan_chung, 'mat': mats, 'kem': kem, '_ve': {'vA': vA.tolist(), 'vM': vM.tolist(), 'eM': eM, 'eA': eA, 'mh': mh}}


def cho_sua(s_, d, Ci, vA, vM, sau, dom):
    """đoạn DOM20 đã xác nhận lỗi mô hình → CHỖ SỬA trong cảnh (mét), mỗi cột tứ phân vị:
    THỪA: điểm viền mô hình (độ sâu ngay dưới viền) — mô hình cao y_mh, thật (DOM20 cùng x, z) cao y_dom → hạ bao nhiêu / chỗ đó thật là trời
    THIẾU: tia của viền ẢNH chạm DOM20 ở (x, y_dom, z) — thật có vật tới độ cao đó mà mô hình không có"""
    H, W = d['H'], d['W']; t = math.tan(math.radians(d['fov']) / 2); M = np.array(d['m']).reshape(4, 4).T; o = M[:3, 3]; ra = []
    for x in sorted({s_['x0'] + (s_['x1'] - s_['x0']) // 4, (s_['x0'] + s_['x1']) // 2, s_['x1'] - (s_['x1'] - s_['x0']) // 4}):
        y = int(vA[x]) + 1 if s_['kieu'] == 'THIẾU' else int(vM[x]) + 2
        if y >= H: continue
        X = Ci[0, 0] * x + Ci[0, 1] * y + Ci[0, 2]; Y = Ci[1, 0] * x + Ci[1, 1] * y + Ci[1, 2]
        v = np.array([((X + 0.5) / W * 2 - 1) * t * W / H, (1 - (Y + 0.5) / H * 2) * t, -1.0]) @ M[:3, :3].T
        if s_['kieu'] == 'THỪA':
            if sau[y, x] <= 0: continue
            P = o + v * sau[y, x]; yd = float(dom.cao(np.array([P[0]]), np.array([P[2]]))[0])
            ra.append({'x': round(float(P[0]), 1), 'z': round(float(P[2]), 1), 'y_mh': round(float(P[1]), 1), 'y_dom': None if np.isnan(yd) else round(yd, 1)})
        else:
            P = dom.cham(o, (v / np.linalg.norm(v))[None], 'diem')[0]
            if not np.isnan(P[0]): ra.append({'x': round(float(P[0]), 1), 'z': round(float(P[2]), 1), 'y_dom': round(float(P[1]), 1)})
    return ra


def ve_chong(anh, kq, chu=True):
    v = kq['_ve']; H, W = anh.shape[:2]
    g = cv2.cvtColor(cv2.cvtColor(anh, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR); g = (g * 0.65).astype(np.uint8)
    g[v['eM']] = (60, 230, 60)
    im = Image.fromarray(cv2.cvtColor(g, cv2.COLOR_BGR2RGB)); dr = ImageDraw.Draw(im, 'RGBA')
    for s in kq['doan']:
        c = (150, 150, 150, 120) if s.get('dom') == 'camera' else (255, 40, 40, 110) if s['kieu'] == 'THIẾU' else (40, 120, 255, 110)
        dr.polygon([(x, v['vA'][x]) for x in range(s['x0'], s['x1'] + 1)] + [(x, v['vM'][x]) for x in range(s['x1'], s['x0'] - 1, -1)], fill=c)
    dr.line([(x, v['vA'][x]) for x in range(W) if v['vA'][x] < H], fill=(255, 60, 60, 255), width=2)
    for x, y in kq['dom'].get('vD', []) + [p for s in kq['doan'] for p in s.get('vD', [])]:
        if y < H: dr.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(255, 0, 255, 255))
    for i, m in enumerate(kq['kem']):
        x0, y0, x1, y1 = kq['mat'][m]['hop']; dr.rectangle([x0, y0, x1, y1], outline=(255, 220, 0, 255), width=3)
        if chu: dr.rectangle([x0, y0, x0 + 34, y0 + 30], fill=(255, 220, 0, 255)); dr.text((x0 + 9, y0 + 2), str(i + 1), fill=(0, 0, 0, 255), font=fo(24))
    return im


def ghep(cot, nhan, chan, cao=640):
    cot = [c.resize((round(c.width * cao / c.height), cao)) for c in cot]; Wt = sum(c.width for c in cot) + 12 * (len(cot) - 1)
    out = Image.new('RGB', (Wt, cao + 52 + 30 * len(chan)), (18, 20, 24)); dr = ImageDraw.Draw(out); x = 0
    for c, t in zip(cot, nhan): out.paste(c, (x, 44)); dr.text((x + 8, 8), t, fill=(240, 240, 240), font=fo(26)); x += c.width + 12
    for i, t in enumerate(chan): dr.text((10, cao + 54 + 30 * i), t, fill=(225, 225, 225), font=fo(21))
    return out


def chan_kq(kq):
    c = kq['canh_khung']; ra = [f"canh khung (lỗi camera đo): tỉ lệ ×{c['ti_le']:.3f} · xoay {c['xoay']:+.1f}° · dời {c['doi_px']} px · F +{c['tang_F']:.2f}" if c['tang_F'] else 'canh khung: camera đo đã khớp, giữ nguyên']
    D = kq['dom']
    if not D['co']: ra.append('nhân chứng DOM20: thiếu tệp du-lieu-goc/bayern (scripts/tai-bayern.sh) — chưa phân xử được lệch là camera hay mô hình')
    else: ra.append(f"DOM20 (chấm tím): khớp viền ẢNH {D['anh_khop'] * 100:.0f} % · khớp viền MÔ HÌNH {D['mh_khop'] * 100:.0f} % trên {D['cot']} cột"
                    + (' (ít cột DOM20 biết chắc — chưa phân xử)' if D['cot'] < 8 else '') + ('' if D['camera_tin'] else ' → CAMERA CHƯA TIN: lệch ở ảnh này phần lớn do camera đo, không sửa mô hình theo nó'))
    ra += [f"viền khớp {kq['vien_khop'] * 100:.0f} % · nét khớp khối chọn F {kq['net_chon']:.2f} · ảnh {kq['tacGia'] or '?'} ({kq['giayPhep'] or '?'})"]
    for i, m in enumerate(kq['kem']):
        q = kq['mat'][m]; ra.append(f"{i + 1}. {m}: F {q['F']:.2f} (đủ nét {q['du']:.2f}, đúng chỗ {q['dung']:.2f}) · dời khớp nhất {q['doi_m'][0]:+.2f} m ngang, {q['doi_m'][1]:+.2f} m đứng")
    for s in sorted(kq['doan'], key=lambda s: -s['lech_px'])[:4]:
        ra.append(f"{s['kieu']} cột {s['x0']}–{s['x1']} lệch {s['lech_px']} px" + (f" ≈ {s['lech_m']:.1f} m" if s['lech_m'] else '') + f" trên {s['mat']}"
                  + {'mo_hinh': ' · DOM20 xác nhận: LỖI MÔ HÌNH', 'camera': ' · DOM20 khớp mô hình: lỗi CAMERA (xám)', 'chua_ro': ' · DOM20 chưa rõ'}.get(s.get('dom'), ''))
        for q in s.get('sua', []): ra.append(f"      chỗ sửa ({q['x']}, {q['z']}): " + (f"mô hình {q['y_mh']} m · DOM20 {q['y_dom'] if q['y_dom'] is not None else '?'} m" if 'y_mh' in q else f"thật có vật tới {q['y_dom']} m"))
    return ra


def net_chung(mt, mk, chon):
    # nét F gộp trọng số net_anh trên mặt có ở CẢ HAI lượt (ưu tiên mặt của khối chọn, không có thì mọi mặt chung) → (F trước, F sau, mặt chọn biến mất)
    chung = set(mt) & set(mk); trong = [m for m in chung if m.split('#')[0] in chon] or list(chung)
    def F(ms): return sum(ms[m]['F'] * ms[m]['net_anh'] for m in trong) / max(1, sum(ms[m]['net_anh'] for m in trong))
    return F(mt), F(mk), sorted(m for m in set(mt) - set(mk) if m.split('#')[0] in chon)


def chay(thu_goc, nhan):
    thu = thu_goc / nhan; meta = json.loads((thu / 'ds.json').read_text()); bd = BanDo(meta['khoi']); chon = set(meta['chon']); tong, hong = [], 0
    for d in meta['ds']:
        anh = cv2.resize(cv2.imread(d['anh']), (d['W'], d['H']), interpolation=cv2.INTER_AREA); kq = phan_tich(anh, d, thu, bd, chon)
        if not kq: print(f"   {d['ten']}: khung không có khối nào — bỏ"); continue
        anh_pil = Image.fromarray(cv2.cvtColor(anh, cv2.COLOR_BGR2RGB)); ImageDraw.Draw(anh_pil).line([(x, kq['_ve']['vA'][x]) for x in range(d['W']) if kq['_ve']['vA'][x] < d['H']], fill=(255, 60, 60), width=2)
        mh = Image.fromarray(cv2.cvtColor(kq['_ve']['mh'], cv2.COLOR_BGR2RGB)); ImageDraw.Draw(mh).line([(x, kq['_ve']['vM'][x]) for x in range(d['W']) if kq['_ve']['vM'][x] < d['H']], fill=(60, 230, 60), width=2)
        chong = ve_chong(anh, kq); ghep([anh_pil, mh, chong], ['ẢNH THẬT', 'MÔ HÌNH', 'CHỒNG: xanh = nét mô hình · đỏ = thiếu · lam = thừa · vàng = mặt kém'], chan_kq(kq)).save(thu / f"{d['ten']}-so.png")
        chong.save(thu / f"{d['ten']}-chong.png")
        luu = {k: v for k, v in kq.items() if k != '_ve'}; (thu / f"{d['ten']}.json").write_text(json.dumps(luu, ensure_ascii=False, indent=1)); tong.append(luu)
        print(f"   {d['ten']}: viền khớp {kq['vien_khop'] * 100:.0f} % · nét F {kq['net_chon']:.2f} · {len(kq['doan'])} đoạn viền lệch → {thu / (d['ten'] + '-so.png')}")
        for t in chan_kq(kq)[:2] + chan_kq(kq)[3:]: print('      ' + t)
        cu = thu_goc / 'truoc' / f"{d['ten']}.json"
        if nhan == 'sau' and cu.exists():
            t = json.loads(cu.read_text()); tc = Image.open(thu_goc / 'truoc' / f"{d['ten']}-chong.png")
            # so nét CHỈ trên mặt có ở cả hai lượt: sửa làm một mặt biến mất (vd bỏ chóp giả) thì net_chon từng lượt gộp tập mặt khác nhau → tụt / tăng giả
            nt, nk, mat_mat = net_chung(t['mat'], kq['mat'], chon)
            dong = [f"TRƯỚC viền {t['vien_khop'] * 100:.0f} % · nét F {nt:.2f}   →   SAU viền {kq['vien_khop'] * 100:.0f} % · nét F {nk:.2f} (mặt chung hai lượt)"]
            if mat_mat: dong.append('mặt không còn ở SAU: ' + ', '.join(mat_mat[:4]))
            for m in sorted(set(t['mat']) & set(kq['mat']), key=lambda m: kq['mat'][m]['F'] - t['mat'][m]['F'])[:3] + sorted(set(t['mat']) & set(kq['mat']), key=lambda m: t['mat'][m]['F'] - kq['mat'][m]['F'])[:3]:
                dong.append(f"{m}: F {t['mat'][m]['F']:.2f} → {kq['mat'][m]['F']:.2f}")
            ghep([anh_pil, tc, chong], ['ẢNH THẬT', 'TRƯỚC', 'SAU'], list(dict.fromkeys(dong))).save(thu_goc / f"{d['ten']}-truoc-sau.png")
            kem = kq['vien_khop'] < t['vien_khop'] - 0.02 or nk < nt - 0.03
            print(f"      TRƯỚC → SAU: viền {t['vien_khop'] * 100:.0f} → {kq['vien_khop'] * 100:.0f} % · nét (mặt chung) {nt:.2f} → {nk:.2f}{'  ✗ KÉM HƠN TRƯỚC' if kem else ''}{'  · mặt không còn: ' + ', '.join(mat_mat[:4]) if mat_mat else ''} → {thu_goc / (d['ten'] + '-truoc-sau.png')}")
            hong += kem
    (thu / 'tong.json').write_text(json.dumps(tong, ensure_ascii=False, indent=1))
    return 1 if hong else 0


def tu_kiem():
    """bài kiểm có đáp án, phải hỏng được: ảnh "chụp" giả = chính ảnh mô hình với trời xanh phẳng.
    1. so với chính nó: viền ≥ 95 %, nét F ≥ 0,6, canh khung giữ nguyên
    2. cả khung dời xuống 20 px (lỗi CAMERA): canh khung phải tìm ra dời ≈ +20 px đứng và viền sau canh vẫn ≥ 90 % (không đổ cho mô hình)
    3. cắt đỉnh 25 px trên một dải cột (lỗi MÔ HÌNH cục bộ: mô hình cao hơn ảnh): phải ra đoạn THỪA đúng dải đó, lệch ≈ 25 px, viền tụt"""
    goc = pathlib.Path(__file__).resolve().parent.parent / '.so-anh'; ds = sorted(goc.glob('*/truoc/ds.json'))
    if not ds: print('– chưa có lượt so nào (.so-anh/*/truoc): chạy so-anh-that.mjs --khoi … một lần rồi tự kiểm'); return 0
    thu = ds[0].parent; meta = json.loads(ds[0].read_text()); bd = BanDo(meta['khoi']); chon = set(meta['chon']); loi = 0; XANH = (235, 190, 140)
    def ok(c, t):
        nonlocal loi; print(('✓ ' if c else '✗ ') + t); loi += not c
    # chọn ảnh có viền lâu đài dài nhất (dải cột cắt phải nằm trên lâu đài)
    tot = None
    for d in meta['ds']:
        sau = giai_sau(thu / f"{d['ten']}-sau.png", d['xa']); tr = (sau <= 1e-6) | (sau >= 0.999 * d['xa']); vm = vien(tr); n_ = int(((vm > 0.05 * d['H']) & (vm < 0.9 * d['H'])).sum())
        if tot is None or n_ > tot[0]: tot = (n_, d, tr, vm)
    _, d, troi, vm = tot; print(f"ảnh mẫu: {d['ten']}")
    gia = cv2.imread(str(thu / f"{d['ten']}-mo-hinh.jpg")); gia[troi] = XANH
    k1 = phan_tich(gia, d, thu, bd, chon)
    ok(k1['vien_khop'] >= 0.95, f"so với chính nó: viền khớp {k1['vien_khop'] * 100:.0f} % ≥ 95 %")
    ok(k1['net_chon'] >= 0.6, f"so với chính nó: nét F {k1['net_chon']:.2f} ≥ 0,6")
    ok(not k1['canh_khung']['tang_F'], f"so với chính nó: canh khung giữ nguyên ({k1['canh_khung']})")
    dich = np.roll(gia, 20, 0); dich[:20] = XANH; k2 = phan_tich(dich, d, thu, bd, chon); c2 = k2['canh_khung']
    ok(c2['tang_F'] and abs(c2['doi_px'][1] - 20) <= 6 and abs(c2['ti_le'] - 1) < 0.04, f"cả khung dời 20 px: canh khung tìm ra dời {c2['doi_px']} · tỉ lệ ×{c2['ti_le']}")
    ok(k2['vien_khop'] >= 0.9, f"cả khung dời 20 px: viền sau canh {k2['vien_khop'] * 100:.0f} % ≥ 90 % (lỗi camera không đổ cho mô hình)")
    # 5. nhân chứng DOM20: điểm mái đã đo (-19,4; 47; -1,5) — tia từ camera ảnh mẫu tới điểm phải chạm, tới điểm cao hơn 3 m phải không chạm (nằm trên mái → trời)
    if DOM.ok:
        o = np.array(d['m']).reshape(4, 4).T[:3, 3]; tg = np.array([-19.4, 47.0, -1.5]); h = float(DOM.cao(tg[[0]], tg[[2]])[0])
        ok(abs(h - 47) < 2.5, f"DOM20 tại điểm mái đã đo: {h:.1f} m (mong 47 ± 2,5)")
        hu = lambda p: (p - o) / np.linalg.norm(p - o)
        ok(bool(DOM.cham(o, hu(tg - [0, 0.6, 0])[None], np.linalg.norm(tg - o) + 2)[0]) and not bool(DOM.cham(o, hu(tg + [0, 3, 0])[None], np.linalg.norm(tg - o) + 2)[0]),
           'tia tới mái (−0,6 m) chạm DOM20, tia tới điểm cao hơn 3 m không chạm')
    else: print('– tự kiểm DOM20 bỏ qua: thiếu du-lieu-goc/bayern')
    hop = np.where((vm > 0.05 * d['H']) & (vm < 0.9 * d['H']))[0]; a0 = int(np.percentile(hop, 40)); a1 = a0 + max(30, d['W'] // 12)
    cat = gia.copy()
    for x in range(a0, a1):
        if vm[x] < d['H']: cat[: vm[x] + 25, x] = XANH
    k3 = phan_tich(cat, d, thu, bd, chon); th = [s_ for s_ in k3['doan'] if s_['kieu'] == 'THỪA' and s_['x1'] >= a0 + 5 and s_['x0'] <= a1 - 5]
    ok(bool(th) and any(18 <= s_['lech_px'] <= 32 for s_ in th), f"cắt đỉnh 25 px cột {a0}–{a1}: đoạn THỪA {[(s_['x0'], s_['x1'], s_['lech_px']) for s_ in th]}")
    ok(k3['vien_khop'] < k1['vien_khop'] - 0.03, f"cắt đỉnh: viền tụt {k1['vien_khop'] * 100:.0f} → {k3['vien_khop'] * 100:.0f} %")
    # 4. TRƯỚC/SAU so trên mặt chung: bỏ một mặt (chóp giả) mà mặt còn lại y nguyên → không tụt; mặt chung tụt thật → tụt
    A = {'k/1#0': {'F': 0.8, 'net_anh': 300}, 'k/1#1': {'F': 0.3, 'net_anh': 100}, 'k/2#0': {'F': 0.5, 'net_anh': 200}}
    nt, nk, mm = net_chung(A, {m: v for m, v in A.items() if m != 'k/1#0'}, {'k/1'})
    ok(abs(nt - nk) < 1e-9 and mm == ['k/1#0'], f"bỏ một mặt: nét mặt chung {nt:.2f} → {nk:.2f}, mặt không còn {mm}")
    nt, nk, _ = net_chung(A, {**A, 'k/1#1': {'F': 0.1, 'net_anh': 100}}, {'k/1'})
    ok(nk < nt - 0.03, f"mặt chung tụt thật: {nt:.2f} → {nk:.2f}")
    return 1 if loi else 0


if __name__ == '__main__':
    if '--tu-kiem' in sys.argv: sys.exit(tu_kiem())
    sys.exit(chay(pathlib.Path(sys.argv[1]), sys.argv[2]))
