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
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); import doc_mat
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

    # mặt NẰM NGANG cách đường tường ≤ GO_SAU là mặt trên / dưới của gờ, phào, bậu cửa — thuộc MẶT TƯỜNG, không phải mái.
    # Trước đây mọi điểm |pháp tuyến y| > 0,7 đều gán 'mái' rồi bị bỏ khỏi đo mặt: gờ dựng theo sổ chỉ còn mặt đứng (sáng như tường) → mô hình
    # không bao giờ thấy gờ mình vừa dựng, vòng đo → dựng không khép (21/11/2026 khối 223140032: 1.025 điểm mặt trên phào 33 m bị bỏ, gờ 33,05 THIẾU mãi)
    GO_SAU = 0.6

    # TƯỜNG CHUNG (21/11/2026): hai khối áp nhau có hai cạnh trùng một đường, pháp tuyến ngược nhau (221599101#14 ↔ 223140032#9). Phần tường khối cao lộ trên mái khối thấp
    # nằm đúng đường đó → ô lưới có thể thuộc khối thấp → điểm bị gán mặt khối thấp (mặt QUAY LƯNG camera, bị khối cao che) → chi tiết dựng lên cả hai khối, khung chồng.
    # Mặt thấy được phải quay về camera: cạnh đã chọn quay lưng (pháp tuyến ngoài · (camera − điểm) < 0) → tìm cạnh khối khác trong GO_SAU quay về camera.
    def phap_ngoai(s, kk):
        v = np.array(s.khoi[kk]['v'], float); ab = np.roll(v, -1, 0) - v; dt = (v[:, 0] * np.roll(v[:, 1], -1) - np.roll(v[:, 0], -1) * v[:, 1]).sum()
        n = np.stack([ab[:, 1], -ab[:, 0]], 1) * (1 if dt > 0 else -1); return v, ab, n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)

    def mat(s, P, nhan_mai, cam=None):
        """P (N,3) → mảng chuỗi tên mặt ('' = không thuộc khối); cam (x, y, z) = vị trí camera → sửa điểm trên tường chung về mặt quay về camera"""
        i = np.clip(np.round((P[:, 2] - s.z0) / s.b).astype(int), 0, s.lab.shape[0] - 1); j = np.clip(np.round((P[:, 0] - s.x0) / s.b).astype(int), 0, s.lab.shape[1] - 1)
        k = s.lab[i, j].astype(int) - 1; ra = np.full(len(P), '', dtype=object)
        for kk in np.unique(k[k >= 0]):
            c = np.where(k == kk)[0]; v = np.array(s.khoi[kk]['v'], float); a, b = v, np.roll(v, -1, 0); q = P[c][:, [0, 2]]
            ab = b - a; t = np.clip(((q[:, None, :] - a[None]) * ab[None]).sum(-1) / np.maximum((ab ** 2).sum(-1), 1e-9)[None], 0, 1)
            d2 = ((a[None] + t[..., None] * ab[None] - q[:, None, :]) ** 2).sum(-1); canh = np.argmin(d2, 1); sat_tuong = d2.min(1) <= s.GO_SAU ** 2
            ra[c] = [f"{s.khoi[kk]['id']}#{'mái' if m and not g else e}" for e, m, g in zip(canh, nhan_mai[c], sat_tuong)]
            if cam is None: continue
            _, _, nn = s.phap_ngoai(kk); toi = np.asarray(cam, float)[[0, 2]] - q
            lung = np.where(sat_tuong & ~(nhan_mai[c] & ~sat_tuong) & ((nn[canh] * toi).sum(1) < 0))[0]
            for kj in range(len(s.khoi)) if len(lung) else ():
                if kj == kk or not len(lung): continue
                v2, ab2, n2 = s.phap_ngoai(kj); q2 = q[lung]; t2 = np.clip(((q2[:, None, :] - v2[None]) * ab2[None]).sum(-1) / np.maximum((ab2 ** 2).sum(-1), 1e-9)[None], 0, 1)
                d2b = ((v2[None] + t2[..., None] * ab2[None] - q2[:, None, :]) ** 2).sum(-1); d2b[(n2[None] * toi[lung][:, None, :]).sum(-1) <= 0] = np.inf
                e2 = np.argmin(d2b, 1); hop = d2b[np.arange(len(lung)), e2] <= s.GO_SAU ** 2
                for a_, e_ in zip(lung[hop], e2[hop]): ra[c[a_]] = f"{s.khoi[kj]['id']}#{e_}"
                lung = lung[~hop]
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
CAM_TV = 10  # px — lệch 2D trung vị viền DOM20 ↔ viền ảnh mà dưới mức đó camera THÔ coi là đúng (khop-camera-dom.py dùng cùng thước để nhận camera)


def ban_khoang(vA, W, H):
    """viền trời ảnh → bản đồ khoảng cách 2D (px) tới viền gần nhất. Đo theo chiều đứng thì sườn mái dốc lệch ngang 3 px thành lệch đứng 30 px
    (san-tren: trung vị đứng 28 px, 2D 10 px) — dò theo thước đứng bị kéo lệch hướng."""
    m = np.full((H, W), 255, np.uint8); xs = [x for x in range(W) if vA[x] < H]
    for a, b in zip(xs, xs[1:]):
        if b - a == 1: cv2.line(m, (a, int(vA[a])), (b, int(vA[b])), 0, 1)
    return cv2.distanceTransform(m, cv2.DIST_L2, 5)


def dom_tv(d, vA, buoc=8):
    """lệch 2D trung vị (px) viền DOM20 của camera THÔ (không canh khung) ↔ viền ảnh; DOM20 thấy < 40 % cột → inf (không chứng được)"""
    if not DOM.ok: return float('inf')
    W, H = d['W'], d['H']; xs = np.arange(4, W - 4, buoc); vD = DOM.vien(d, xs, np.float32([[1, 0, 0], [0, 1, 0]]), [H] * len(xs))
    ok = (vD >= 0) & (vD < H)
    if ok.sum() < 0.4 * len(xs): return float('inf')
    return float(np.median(ban_khoang(vA, W, H)[vD[ok].astype(int), xs[ok]]))


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
    H, W = eA.shape; vung0 = cv2.dilate(co_mh.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
    def lop(k):  # nét hai bên thu nhỏ k lần + bản đồ khoảng cách; dời (dx, dy) tính bằng điểm ảnh GỐC ở mọi lớp
        a = cv2.dilate(eA.astype(np.uint8), np.ones((k, k), np.uint8))[::k, ::k] > 0; m = cv2.dilate(eM.astype(np.uint8), np.ones((k, k), np.uint8))[::k, ::k] > 0
        h, w = a.shape; ys, xs = np.where(m); ya, xa = np.where(a & vung0[::k, ::k])
        return dict(k=k, h=h, w=w, xs=xs, ys=ys, xa=xa, ya=ya, dA=cv2.distanceTransform((~a).astype(np.uint8), cv2.DIST_L2, 3), dM=cv2.distanceTransform((~m).astype(np.uint8), cv2.DIST_L2, 3))
    def diem(L, s, r, dx, dy):
        k, h, w, xs, ys, xa, ya = L['k'], L['h'], L['w'], L['xs'], L['ys'], L['xa'], L['ya']
        M = cv2.getRotationMatrix2D((w / 2, h / 2), r, s); M[:, 2] += (dx / k, dy / k)
        X = M[0, 0] * xs + M[0, 1] * ys + M[0, 2]; Y = M[1, 0] * xs + M[1, 1] * ys + M[1, 2]; ok = (X >= 0) & (X < w) & (Y >= 0) & (Y < h)
        if ok.mean() < 0.5: return -1
        tr = float((L['dA'][Y[ok].astype(int), X[ok].astype(int)] <= 2).mean())
        Mi = cv2.invertAffineTransform(M); X2 = Mi[0, 0] * xa + Mi[0, 1] * ya + Mi[0, 2]; Y2 = Mi[1, 0] * xa + Mi[1, 1] * ya + Mi[1, 2]; o2 = (X2 >= 0) & (X2 < w) & (Y2 >= 0) & (Y2 < h)
        nguoc = float((L['dM'][Y2[o2].astype(int), X2[o2].astype(int)] <= 2).mean()) if o2.any() else 0
        return 2 * tr * nguoc / max(tr + nguoc, 1e-9)
    T = lop(4)
    if len(T['xs']) < 50 or len(T['xa']) < 50: return np.float32([[1, 0, 0], [0, 1, 0]]), 0.0
    # THÔ (¼ khổ, dung sai 2 ô = 8 px): tìm vùng đúng — đáy rộng, không kẹt cực trị địa phương; bước 12 px
    g0 = diem(T, 1, 0, 0, 0); tot = (g0, 1.0, 0.0, 0.0, 0.0); D = 0.08
    for s in np.arange(0.85, 1.19, 0.03):
        for dx in np.arange(-D * W, D * W + 1, 12):
            for dy in np.arange(-D * H, D * H + 1, 12):
                f = diem(T, s, 0, dx, dy)
                if f > tot[0]: tot = (f, s, 0.0, dx, dy)
    # MỊN (½ khổ, dung sai 2 ô = 4 px): ở lớp thô điểm F gần phẳng trong ±8 px quanh đỉnh — chọn bừa một điểm lệch 6 px (tự kiểm 21/11/2026,
    # mặt cửa sổ lặp đều) → viền sau canh 45 %. Lớp mịn đủ nét để phân biệt; dò dời ±12 px bước 2 rồi tỉ lệ / xoay, hai vòng
    M2 = lop(2); _, s0, r0, x0, y0 = tot; tot = (diem(M2, s0, r0, x0, y0), s0, r0, x0, y0); f_tho = diem(M2, 1, 0, 0, 0)
    for _ in range(2):
        f0, s0, r0, x0, y0 = tot
        for dx in np.arange(x0 - 12, x0 + 13, 2):
            for dy in np.arange(y0 - 12, y0 + 13, 2):
                f = diem(M2, s0, r0, dx, dy)
                if f > tot[0]: tot = (f, s0, r0, dx, dy)
        f0, s0, r0, x0, y0 = tot
        for s in (s0 - 0.015, s0, s0 + 0.015):
            for r in (r0 - 1, r0, r0 + 1):
                if abs(r) <= 2:
                    f = diem(M2, s, r, x0, y0)
                    if f > tot[0]: tot = (f, s, r, x0, y0)
    # GỐC (khổ thật, dung sai 2 px): viền trời so từng cột với dung sai ~5 px — lệch 2 px ngang ở mép tháp dốc đứng đã đủ làm viền 98 % → 66 % (tự kiểm 21/11/2026)
    G = lop(1); _, s0, r0, x0, y0 = tot; tot = (diem(G, s0, r0, x0, y0), s0, r0, x0, y0); f_tho = diem(G, 1, 0, 0, 0)
    for dx in np.arange(x0 - 3, x0 + 4, 1):
        for dy in np.arange(y0 - 3, y0 + 4, 1):
            f = diem(G, s0, r0, dx, dy)
            if f > tot[0]: tot = (f, s0, r0, dx, dy)
    f, s, r, dx, dy = tot
    if f < f_tho + 0.03: return np.float32([[1, 0, 0], [0, 1, 0]]), 0.0  # không hơn rõ → giữ camera đo
    M = cv2.getRotationMatrix2D((W / 2, H / 2), r, s); M[:, 2] += (dx, dy); return M.astype(np.float32), round(f - f_tho, 3)


# phiên bản thuật toán canh khung: đổi cách giải (21/11/2026 ck2: dò nhiều tầng tới 1 px, bản cũ lệch tới 6 px) → tăng số này, mọi khoá cũ tự hết hiệu lực
CK_BAN = 'ck2'


def khoa_khung(d):
    """khoá canh khung: tệp ảnh + camera (ma trận, ống kính, khổ) + phiên bản thuật toán — camera đo lại hay cách giải đổi thì khoá cũ tự hết hiệu lực"""
    return d['tep'] + '|' + ','.join(f'{v:.2f}' for v in d['m']) + f"|{d['fov']}|{d['W']}x{d['H']}|{CK_BAN}"


def ck_ghi(CK, W, H, loi):
    """ghi canh khung ra số người đọc được + ma trận gốc — đúng nghịch đảo của ck_tu_so (tự kiểm: khứ hồi ma trận)"""
    a, b = float(CK[0, 0]), float(CK[0, 1])
    return {'ti_le': round(float(np.hypot(a, b)), 3), 'xoay': round(float(np.degrees(np.arctan2(b, a))), 2),
            'doi_px': [round(float(CK[0, 2] - (1 - a) * W / 2 + b * H / 2)), round(float(CK[1, 2] - (1 - CK[1, 1]) * H / 2 + CK[1, 0] * W / 2))],
            'tang_F': loi, 'M': np.asarray(CK, dtype=float).round(6).tolist(), 'ban': CK_BAN}


def ck_tu_so(c, W, H):
    """dựng lại ma trận 2×3 từ canh_khung đã ghi. Có 'M' → dùng thẳng. Bản ghi cũ (trước 21/11/2026, không có M) ghi sai quy ước:
    xoay ngược dấu và dời dọc cộng thừa 2·s·sin(góc)·W/2 → quy đổi về đúng góc / dời trước khi dựng (Castillo-XV: dựng nhầm xoay +2° thay vì −2°, nét 0,64 → 0,50)"""
    if not c.get('tang_F'): return np.float32([[1, 0, 0], [0, 1, 0]])
    if c.get('M'): return np.float32(c['M'])
    r = -c['xoay']; dx, dy = c['doi_px']; dy -= 2 * c['ti_le'] * np.sin(np.radians(r)) * W / 2
    M = cv2.getRotationMatrix2D((W / 2, H / 2), r, c['ti_le']); M[:, 2] += (dx, dy); return M.astype(np.float32)


def phan_tich(anh, d, thu, bd, chon, khoa=None):
    """khoa: sổ canh khung dùng chung mọi lượt (dict). Canh khung bù SAI SỐ CAMERA — thuộc về ảnh + camera, không thuộc mô hình: giải một lần rồi khoá.
    Không khoá thì mỗi lần thêm chi tiết (nét mới) khung lại trôi 3–7 % → mọi mặt xê dịch, TRƯỚC/SAU so hai khung khác nhau, chỗ thiếu dò ra lệch chỗ
    (21/11/2026: dựng 32 chi tiết, ảnh mapillary-1956… khung ×0,865 → ×0,895, nét F 0,95 → 0,63 dù camera y nguyên)."""
    H, W = d['H'], d['W']; ten = d['ten']
    mh = cv2.imread(str(thu / f'{ten}-mo-hinh.jpg')); sau = giai_sau(thu / f'{ten}-sau.png', d['xa'])
    troiM = (sau <= 1e-6) | (sau >= 0.999 * d['xa']); sau = np.where(troiM, 0, sau)
    P = diem3d(sau, d); n = phap_tuyen(P); mai = np.abs(n[..., 1]) > 0.7
    co = ~troiM; idx = np.where(co.ravel())[0]
    MAT = np.full(H * W, '', dtype=object); MAT[idx] = bd.mat(P.reshape(-1, 3)[idx], mai.ravel()[idx], np.array(d['m']).reshape(4, 4).T[:3, 3]); MAT = MAT.reshape(H, W)
    # canh khung: dời / phóng mọi lớp mô hình cho nét trùng nét ảnh, rồi mới đo
    # canh khung chỉ bằng nét HÌNH (lượt vẽ màu pháp tuyến <ten>-hinh.png, không vân / vật liệu): vân đá, mạch vữa đổi theo vật liệu — nếu được kéo khung thì mỗi lần
    # sửa vật liệu khung lại trôi, viền so với TRƯỚC tụt mà hình khối không đổi (21/11/2026: viền 66 → 6 %, khung dời 130 px chỉ vì thêm vân đá)
    hinh = cv2.imread(str(thu / f'{ten}-hinh.png')); hinh = mh if hinh is None else hinh  # thư mục cũ chưa có lượt hình
    eM0 = net_mo_hinh(hinh, sau, n) & (MAT != ''); eA0 = net_anh(anh) & ~(troiM & (np.arange(H)[:, None] < vien(troiM)[None, :] - 0.08 * H))
    # canh khung chỉ để bù SAI SỐ CAMERA: DOM20 (độc lập mô hình) xác nhận camera thô khớp ảnh thì không còn sai số nào để bù — canh khung lúc đó kéo mô hình
    # cho khớp ảnh, tức là che LỖI MÔ HÌNH, và kéo luôn tia DOM20 lệch theo (23/11/2026, camera khop-camera-dom: DOM20 thô khớp 2D 75/81/48 %, sau canh ×1,15
    # nhân chứng chỉ còn 9/25/10 % → "CAMERA CHƯA TIN" oan cả ba ảnh)
    tv0 = dom_tv(d, vien(troi_anh(anh, troiM, vien(troiM))))
    kk = khoa_khung(d) if khoa is not None else None
    if tv0 <= CAM_TV: CK, loi_ck = np.float32([[1, 0, 0], [0, 1, 0]]), 0
    elif kk and kk in khoa: CK = ck_tu_so(khoa[kk], W, H); loi_ck = khoa[kk]['tang_F']
    else: CK, loi_ck = canh_khung(eA0, eM0, MAT != '')
    che = cv2.imread(str(thu / f'{ten}-che.png'))  # mặt nạ VẬT CHE (tranh, ban công) — thư mục cũ chưa có thì None
    goc = (P, MAT.copy(), mai, hinh, mh.copy(), sau.copy())  # khung mô hình CHƯA canh: dò chi tiết mặt cần toạ độ 3D gốc, tra ảnh qua CK
    if loi_ck:
        wa = lambda x, nen=0: cv2.warpAffine(x, CK, (W, H), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=nen)
        mh = cv2.warpAffine(mh, CK, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE); sau = wa(sau.astype(np.float32)).astype(np.float64)
        troiM = wa(troiM.astype(np.uint8), 1).astype(bool); n = np.stack([wa(n[..., i].astype(np.float32)) for i in range(3)], -1)
        _, inv = np.unique(MAT, return_inverse=True); ten_m = np.unique(MAT); MAT = ten_m[wa(inv.reshape(H, W).astype(np.float32), float(np.where(ten_m == '')[0][0]) if '' in ten_m else 0).astype(int)]
        MAT[troiM] = ''
    vM = vien(troiM); troiA = troi_anh(anh, troiM, vM); vA = vien(troiA)
    chi_tiet = doc_mat.trai_mat(anh, troiA, CK, goc[0], goc[1], goc[2], goc[3], goc[4], goc[5], d, bd.khoi, che)
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
        nhan_chung['tv_2d'] = round(tv0, 1) if tv0 != float('inf') else None
        nhan_chung['camera_tin'] = tv0 <= CAM_TV or nhan_chung['cot'] < 8 or nhan_chung['anh_khop'] >= 0.7 or nhan_chung['anh_khop'] >= nhan_chung['mh_khop'] - 0.1
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
    ck = ck_ghi(CK, W, H, loi_ck)
    if kk and (kk not in khoa or 'M' not in khoa[kk]): khoa[kk] = ck  # bản ghi cũ không ma trận → thay bằng ma trận đã quy đổi
    return {'ten': ten, 'tep': d['tep'], 'canh_khung': ck, 'tacGia': d.get('tacGia', ''), 'giayPhep': d.get('giayPhep', ''), 'vien_khop': round(vien_khop, 3), 'net_chon': round(F_chon, 3),
            'doan': ra_doan, 'dom': nhan_chung, 'mat': mats, 'kem': kem,
            'chi_tiet': [{'khoi': m['khoi'], 'rho': round(m['rho'], 1), 'go_anh': len(m['do_A']['bang']), 'day_anh': len(m['do_A']['day']), 'lo_anh': len(m['do_A']['lo']),
                          'go_mh': len(m['do_M']['bang']), 'day_mh': len(m['do_M']['day']), 'lo_mh': len(m['do_M']['lo']), 'lech': [doc_mat.mo_ta(m, x) for x in m['lech']], 'thay': doc_mat.thay(m)} for m in chi_tiet],
            '_ct': chi_tiet, '_ve': {'vA': vA.tolist(), 'vM': vM.tolist(), 'eM': eM, 'eA': eA, 'mh': mh}}


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


def day_net(mt, mk, chon):
    # ĐỘ DÀY NÉT trên mặt chung (khối chọn trước): Σ nét mô hình / Σ nét ảnh. F chấm "nét mô hình nằm gần nét ảnh" trong r px → khung thứ hai đặt sát / đè ô cửa đã có
    # vẫn "đúng chỗ" nên F không tụt (21/11/2026 mặt Palas chi chít khung chồng mà nét còn tăng). Mô hình dày nét hơn ảnh quá NGUONG_DAY và dày lên so với TRƯỚC = THỪA CHI TIẾT
    chung = set(mt) & set(mk); trong = [m for m in chung if m.split('#')[0] in chon] or list(chung)
    def r(ms): return sum(ms[m]['net_mh'] for m in trong) / max(1, sum(ms[m]['net_anh'] for m in trong))
    return r(mt), r(mk)


NGUONG_DAY = 1.3  # mô hình được dày nét hơn ảnh tối đa 30 % (ảnh thật có bóng / nhoè mất nét mảnh) — quá thế mà còn dày thêm 15 % so TRƯỚC = KÉM


def thua_chi_tiet(dt, dk):
    return dk > NGUONG_DAY and dk > dt * 1.15


def mat_day_len(mt, mk, them=40):
    # mặt nào gây THỪA: dày nét quá NGUONG_DAY × ảnh VÀ dày thêm > 15 % + ≥ them px so TRƯỚC → khối của mặt đó (lam-mat.mjs chỉ trả sổ khối này, giữ chi tiết tốt khối khác)
    return sorted({m.split('#')[0] for m in set(mt) & set(mk)
                   if mk[m]['net_mh'] > NGUONG_DAY * max(1, mk[m]['net_anh']) and mk[m]['net_mh'] > 1.15 * mt[m]['net_mh'] and mk[m]['net_mh'] - mt[m]['net_mh'] >= them})


TEP_DUNG = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'du-lieu' / 'neuschwanstein-chi-tiet-do.json'
LOAI_DUNG = {'gờ': 'go', 'dãy': 'day', 'lỗ': 'lo'}


def dung(xn, xn_thua, thay=(), tep=TEP_DUNG):
    """BƯỚC DỰNG: chi tiết THIẾU đã xác nhận (≥ 2 ảnh, camera tin) → sổ CỘNG DỒN chi tiết dựng theo đo (mattien.js datChiTietDo dựng lên đúng đoạn tường).
    Cộng dồn: chi tiết đã dựng thì lượt sau hết THIẾU → không còn trong xn nhưng vẫn giữ; chỉ gỡ khi THỪA xác nhận đúng chỗ (dựng nhầm).
    Gặp lại chỗ đã có → hợp đoạn (ảnh mới thấy thêm phần mặt). SAI_NHIP chỉ sửa nhịp dãy do chính sổ này dựng (dãy viết tay trong mattien: báo, không dựng chồng)."""
    so = json.loads(tep.read_text()) if tep.exists() else {'muc': []}; muc = so['muc']; moi = sua = go_ = giu = 0
    def dau_muc(o):  # dấu so sánh: số chuẩn về float làm tròn mm (0 với 0.0, nhiễu dấu phẩy động không tính là đổi)
        if isinstance(o, dict): return {k: dau_muc(v) for k, v in sorted(o.items())}
        if isinstance(o, list): return [dau_muc(v) for v in o]
        return round(float(o), 3) if isinstance(o, (int, float)) and not isinstance(o, bool) else o
    def doi_cua(m, x):  # đổi loại cửa KÈM cỡ của cùng lượt đo (loại mới, cỡ cũ = lỗ không có thật: cửa vào 0,52 m 21/11/2026) rồi chốt bằng ngưỡng chung
        m['cua'] = x['cua']; m.update({k: x[k] for k in ('w', 'h', 'y0', 'y1', 'doan') if x.get(k) is not None}); doc_mat.chot_cua(m)  # đoạn = bề rộng ô → đổi cỡ phải đổi đoạn
    def tim(x):
        y = x.get('y', (x.get('y0', 0) + x.get('y1', 0)) / 2)
        return next((m for m in muc if doc_mat.cung_cho({**m, 'loai': 'THIẾU'}, {**x, 'loai': 'THIẾU'}, y)), None)
    def la_hang_cua(m):  # dãy mà ≥ 2 ảnh thấy là HÀNG CỬA (lỗ cùng khối, cùng cạnh) — dùng cả lúc THÊM lẫn lúc dọn: trước đây chỉ dọn → mỗi vòng +1 rồi gỡ 1 (21/11/2026)
        canh = {o['canh'] for o in m.get('doan', [])}
        return len({a for a in {a for a, _ in thay} if doc_mat.hang_cua(m['y0'], m['y1'], [(t['y0'], t['y1']) for a2, t in thay if a2 == a and t['chi_tiet'] == 'lỗ' and t['khoi'] == m['khoi'] and canh & {o['canh'] for o in t.get('doan', [])}])}) >= 2
    for x in xn:
        if x['chi_tiet'] not in LOAI_DUNG or not x.get('doan'): continue
        if x['chi_tiet'] == 'dãy' and x.get('y0') is not None and la_hang_cua(x): continue
        m = tim(x); truoc = dau_muc(m) if m else None
        doi = lambda: int(dau_muc(m) != truoc)  # chỉ tính "cập nhật" khi mục THẬT SỰ đổi: ghi đè cùng giá trị mỗi vòng làm vòng không bao giờ khép (22/11/2026: 10 vòng "2 cập nhật" mà sổ y nguyên)
        if x['loai'] == 'SAI_NHIP':
            if m and m['chi_tiet'] == 'dãy': m['p'] = x['p']; sua += doi()
            continue
        if x['loai'] == 'SAI_LOAI':  # cửa vào ↔ cửa sổ: lỗ do sổ dựng → đổi loại; lỗ viết tay trong mattien → chỉ báo (như dãy viết tay SAI_NHIP)
            if m and m['chi_tiet'] == 'lỗ' and x.get('cua'): doi_cua(m, x); sua += doi()
            else: print(f"      ⚠ SAI_LOAI lỗ viết tay {x['khoi']} y {x.get('y0')}–{x.get('y1')} m: ảnh {x.get('cua')} · mô hình {x.get('cua_mh')} — sửa bố cục trong mattien.js")
            continue
        if m:
            # lỗ: đoạn = BỀ RỘNG lỗ (mattien đặt lỗ giữa đoạn) → ảnh còn báo THIẾU đúng chỗ = lỗ trong sổ đặt lệch: dời về chỗ ảnh đo, không hợp đoạn
            # (hợp đoạn làm đoạn nở 5,85–6,92 m với lỗ 0,35 m → lỗ dựng ở 6,2–6,6 trong khi ảnh thấy 6,48–6,88, THIẾU mãi — 22/11/2026 Palas #23)
            if m['chi_tiet'] == 'lỗ' and x['loai'] == 'THIẾU': m['doan'] = x['doan']; m.update({k: x[k] for k in ('y0', 'y1', 'w', 'h') if x.get(k) is not None}); m['y'] = round(x.get('y', (m['y0'] + m['y1']) / 2), 2)
            else: m['doan'] = doc_mat.hop_doan(m['doan'], x['doan'])
            if x.get('cua') and x['so_anh'] >= m['so_anh']: doi_cua(m, x)  # loại cửa theo lượt nhiều ảnh hơn
            m['so_anh'] = max(m['so_anh'], x['so_anh']); m['anh'] = sorted(set(m['anh']) | set(x['anh'])); sua += doi(); continue
        y = x.get('y', (x.get('y0', 0) + x.get('y1', 0)) / 2)
        muc.append({k: v for k, v in {'chi_tiet': x['chi_tiet'], 'loai': LOAI_DUNG[x['chi_tiet']], 'khoi': x['khoi'], 'y': round(y, 2), 'y0': x.get('y0'), 'y1': x.get('y1'), 'p': x.get('p'),
                                       'w': x.get('w'), 'h': x.get('h'), 'cua': x.get('cua'), 'doan': x['doan'], 'so_anh': x['so_anh'], 'anh': x['anh']}.items() if v is not None}); doc_mat.chot_cua(muc[-1]); moi += 1
    # THỪA = mô hình có mà ảnh không thấy. Gỡ chỉ khi ảnh báo THỪA NHIỀU HƠN ảnh thấy đúng chi tiết đó (bỏ phiếu theo ảnh, camera tin):
    # trước đây ≥ 2 ảnh THỪA là gỡ, bỏ qua 3 ảnh đang thấy rõ → gỡ / dựng lại luân phiên, vòng không bao giờ khép (21/11/2026 gờ 33,15 khối 223140032)
    for x in xn_thua:
        m = tim(x)
        if not m: continue
        co = {a for a, t in thay if doc_mat.cung_cho({**m, 'loai': 'THIẾU'}, {**t, 'loai': 'THIẾU'}, t.get('y', (t.get('y0', 0) + t.get('y1', 0)) / 2))}
        # ảnh đã đo ra THIẾU để sổ dựng chi tiết này mà nay báo THỪA đúng nó = ảnh TỰ MÂU THUẪN (canh khung đổi khi mô hình thêm nét → dời mốc đo) → phiếu đó không tính;
        # trước đây cùng 2 ảnh vòng lẻ đòi dựng, vòng chẵn đòi gỡ → +2 / −2 mãi (22/11/2026 gờ 37,0 + 41,6 m way/1573767747, 6 vòng không khép)
        phieu = set(x['anh']) - set(m.get('anh', []))
        if len(phieu) >= 2 and len(phieu) > len(co - set(x['anh'])): muc.remove(m); go_ += 1; print(f"      gỡ {m['chi_tiet']} {m['khoi']} y {m['y']} m: THỪA {sorted(phieu)} · thấy {sorted(co)} · sổ dựng từ {m.get('anh')}")
        else: giu += 1; print(f"      giữ {m['chi_tiet']} {m['khoi']} y {m['y']} m: ảnh tự mâu thuẫn {sorted(set(x['anh']) & set(m.get('anh', [])))} không tính phiếu") if set(x['anh']) & set(m.get('anh', [])) else None
    # dãy trong sổ mà ≥ 2 ảnh thấy là HÀNG CỬA (≥ 2 lỗ chiếm ≥ nửa dải, cùng cạnh) → dựng nhầm từ bộ dò cũ: gỡ (dải đá vắt ngang cửa che ô cửa → THIẾU lỗ mãi)
    for m in [m for m in muc if m['chi_tiet'] == 'dãy' and la_hang_cua(m)]: muc.remove(m); go_ += 1
    so.update({'ghi': 'sinh bởi scripts/so-anh-that.py --dung (bước dựng) — chi tiết THIẾU xác nhận ≥ 2 ảnh; mattien.js datChiTietDo dựng; không sửa tay', 'nguong': doc_mat.NGUONG, 'muc': muc})
    for m in muc: doc_mat.chuan_lo(m)  # sổ không bao giờ ghi lỗ tự mâu thuẫn (h ≠ y1 − y0, đoạn rộng hơn ô)
    tep.write_text(json.dumps(so, ensure_ascii=False, indent=1)); print(f"   BƯỚC DỰNG: +{moi} chi tiết mới · {sua} cập nhật · {go_} gỡ (THỪA thắng phiếu) · {giu} giữ (ảnh thấy ≥ ảnh THỪA) → {len(muc)} trong sổ {tep}")
    return moi, sua, go_


def da_dung(x, tep=TEP_DUNG):
    """chi tiết ảnh báo THIẾU / SAI mà sổ ĐÃ dựng đúng chỗ đó: áp lại vào sổ không đổi gì → mô hình đã có, chỉ là ảnh chụp mô hình không lộ
    (gờ 0,22 m cùng màu tường, không nắng → bộ dò dải trên ảnh mô hình không bắt; ảnh thật thấy nhờ bóng). Trước 22/11/2026 tính là còn thiếu →
    'THIẾU gờ Palas #23 y 43,6' báo mãi dù sổ có, mã thoát CHƯA XONG mãi trong khi sổ đã khép. Không khớp mục nào trong sổ (dãy viết tay…) → vẫn thiếu."""
    if not tep.exists() or x['chi_tiet'] not in LOAI_DUNG or not x.get('doan'): return False
    so = json.loads(tep.read_text()); y = x.get('y', (x.get('y0', 0) + x.get('y1', 0)) / 2)
    if not any(doc_mat.cung_cho({**m, 'loai': 'THIẾU'}, {**x, 'loai': 'THIẾU'}, y) for m in so['muc']): return False
    import tempfile, io, contextlib
    with tempfile.TemporaryDirectory() as td:
        st = pathlib.Path(td) / 's.json'; st.write_text(json.dumps(so, ensure_ascii=False))
        with contextlib.redirect_stdout(io.StringIO()): moi, sua, _ = dung([x], [], tep=st)
    return moi + sua == 0


MA_KEM, MA_CHUA_XONG = 1, 3
def chay(thu_goc, nhan, lam_dung=False):
    thu = thu_goc / nhan; meta = json.loads((thu / 'ds.json').read_text()); bd = BanDo(meta['khoi']); chon = set(meta['chon']); tong, hong, ds_ct, ds_thua, ds_thay = [], 0, [], [], []; khoi_thua = {}
    # sổ khoá canh khung dùng chung mọi khối (.so-anh/canh-khung.json): ảnh nào đã canh một lần thì mọi lượt sau — TRƯỚC, SAU, khối khác — dùng đúng khung đó.
    # Lượt SAU gặp ảnh chưa có trong sổ mà TRƯỚC cùng khối đã đo với cùng camera → nhận khung của TRƯỚC (thư mục cũ trước khi có sổ)
    tk = thu_goc.parent / 'canh-khung.json'; khoa = json.loads(tk.read_text()) if tk.exists() else {}
    ds_t = {x['ten']: x for x in json.loads((thu_goc / 'truoc' / 'ds.json').read_text())['ds']} if nhan == 'sau' and (thu_goc / 'truoc' / 'ds.json').exists() else {}
    for d in meta['ds']:
        kk = khoa_khung(d); cu = thu_goc / 'truoc' / f"{d['ten']}.json"
        if kk not in khoa and d['ten'] in ds_t and khoa_khung(ds_t[d['ten']]) == kk and cu.exists() and json.loads(cu.read_text())['canh_khung'].get('ban') == CK_BAN: khoa[kk] = json.loads(cu.read_text())['canh_khung']
        anh = cv2.resize(cv2.imread(d['anh']), (d['W'], d['H']), interpolation=cv2.INTER_AREA); kq = phan_tich(anh, d, thu, bd, chon, khoa)
        tk.write_text(json.dumps(khoa, ensure_ascii=False, indent=1))
        if not kq: print(f"   {d['ten']}: khung không có khối nào — bỏ"); continue
        anh_pil = Image.fromarray(cv2.cvtColor(anh, cv2.COLOR_BGR2RGB)); ImageDraw.Draw(anh_pil).line([(x, kq['_ve']['vA'][x]) for x in range(d['W']) if kq['_ve']['vA'][x] < d['H']], fill=(255, 60, 60), width=2)
        mh = Image.fromarray(cv2.cvtColor(kq['_ve']['mh'], cv2.COLOR_BGR2RGB)); ImageDraw.Draw(mh).line([(x, kq['_ve']['vM'][x]) for x in range(d['W']) if kq['_ve']['vM'][x] < d['H']], fill=(60, 230, 60), width=2)
        chong = ve_chong(anh, kq); ghep([anh_pil, mh, chong], ['ẢNH THẬT', 'MÔ HÌNH', 'CHỒNG: xanh = nét mô hình · đỏ = thiếu · lam = thừa · vàng = mặt kém'], chan_kq(kq)).save(thu / f"{d['ten']}-so.png")
        chong.save(thu / f"{d['ten']}-chong.png")
        for m in kq['_ct']: cv2.imwrite(str(thu / f"{d['ten']}-mat-{m['khoi'].replace('/', '_')}.png"), doc_mat.ve(m, d['ten']))
        tin = kq['dom']['camera_tin'] if kq['dom']['co'] else True
        ds_ct += [(d['ten'], x) for m in kq['chi_tiet'] for x in m['lech'] if tin and x['loai'] != 'THỪA']; ds_thua += [(d['ten'], x) for m in kq['chi_tiet'] for x in m['lech'] if tin and x['loai'] == 'THỪA']
        ds_thay += [(d['ten'], x) for m in kq['chi_tiet'] for x in m['thay'] if tin]
        for m in kq['chi_tiet']:
            lt = [x for x in m['lech'] if x['loai'] != 'THỪA']
            print(f"      chi tiết {m['khoi']}: ảnh gờ {m['go_anh']} · dãy {m['day_anh']} · lỗ {m['lo_anh']} | mô hình gờ {m['go_mh']} · dãy {m['day_mh']} · lỗ {m['lo_mh']} → {len(lt)} lệch{'' if tin else ' (camera chưa tin — không tính)'}")
        luu = {k: v for k, v in kq.items() if k not in ('_ve', '_ct')}; (thu / f"{d['ten']}.json").write_text(json.dumps(luu, ensure_ascii=False, indent=1)); tong.append(luu)
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
            # camera chui trong vật (đất / tường) → khung độ sâu không có trời → viền lượt đó là rác (cột nào cũng "khớp" ở hàng 0): không so viền với lượt rác
            rac = lambda nh: (lambda s: float(((s <= 1e-6) | (s >= 0.999 * d['xa'])).mean()) < 0.005)(giai_sau(thu_goc / nh / f"{d['ten']}-sau.png", d['xa']))
            rac_t, rac_k = rac('truoc'), rac('sau')
            if rac_t or rac_k: dong.insert(0, f"viền không so: camera {'TRƯỚC' if rac_t else 'SAU'} nằm trong vật (khung độ sâu không có trời)")
            dt_, dk_ = day_net(t['mat'], kq['mat'], chon); thua = thua_chi_tiet(dt_, dk_)
            dong.insert(1, f"độ dày nét mô hình / ảnh {dt_:.2f} → {dk_:.2f}{'  ✗ THỪA CHI TIẾT (khung chồng / nét không có trong ảnh)' if thua else ''}")
            kem = (not (rac_t or rac_k) and kq['vien_khop'] < t['vien_khop'] - 0.02) or rac_k and not rac_t or nk < nt - 0.03 or thua
            print(f"      TRƯỚC → SAU: viền {t['vien_khop'] * 100:.0f}{' (rác: camera trong vật)' if rac_t else ''} → {kq['vien_khop'] * 100:.0f}{' (rác: camera trong vật)' if rac_k else ''} % · nét (mặt chung) {nt:.2f} → {nk:.2f}{f' · dày nét {dt_:.2f} → {dk_:.2f}'}{'  ✗ THỪA CHI TIẾT' if thua else ''}{'  ✗ KÉM HƠN TRƯỚC' if kem else ''}{'  · mặt không còn: ' + ', '.join(mat_mat[:4]) if mat_mat else ''} → {thu_goc / (d['ten'] + '-truoc-sau.png')}")
            ghep([anh_pil, tc, chong], ['ẢNH THẬT', 'TRƯỚC', 'SAU'], list(dict.fromkeys(dong))).save(thu_goc / f"{d['ten']}-truoc-sau.png")
            hong += kem
            if thua:
                for k in mat_day_len(t['mat'], kq['mat']): khoi_thua[k] = khoi_thua.get(k, 0) + 1
    (thu / 'tong.json').write_text(json.dumps(tong, ensure_ascii=False, indent=1))
    if nhan == 'sau':  # khối gây THỪA CHI TIẾT, đếm số ảnh — lam-mat.mjs đọc để trả sổ đúng khối
        (thu_goc / 'thua-khoi.json').write_text(json.dumps(khoi_thua, ensure_ascii=False, indent=1))
        if khoi_thua: print('   KHỐI GÂY THỪA: ' + ', '.join(f'{k} ({n} ảnh)' for k, n in sorted(khoi_thua.items(), key=lambda kv: -kv[1])))
    # CHI TIẾT MẶT gộp mọi ảnh: cùng chỗ thấy trên ≥ 2 ảnh = xác nhận (một ảnh = nghi: bóng đổ / người đứng / camera lệch)
    g = doc_mat.gop(ds_ct); (thu / 'chi-tiet.json').write_text(json.dumps(g, ensure_ascii=False, indent=1))
    xn = [x for x in g if x['so_anh'] >= 2]
    print(f"   CHI TIẾT MẶT: {len(xn)} chỗ xác nhận (≥ 2 ảnh), {len(g) - len(xn)} nghi → {thu / 'chi-tiet.json'}")
    for x in xn[:40]:
        cho = f"y {x['y']:.1f} m" if x['chi_tiet'] == 'gờ' else f"y {x['y0']:.1f}–{x['y1']:.1f} m"
        print(f"      {x['loai']} {x['chi_tiet']}{' ' + x['cua'] if x.get('cua') else ''} {x['khoi']} {cho}" + (f" nhịp {x['p']} m" + (f" (mô hình {x['p_mh']})" if x.get('p_mh') else '') + f" dài {x['dai_m']} m" if x['chi_tiet'] == 'dãy' else '')
              + (f" mặt {','.join(x['mat'][:3])}" if x['mat'] else '') + f" · {x['so_anh']} ảnh")
    if lam_dung: dung(xn, [x for x in doc_mat.gop(ds_thua) if x['so_anh'] >= 2], ds_thay)
    con = [x for x in xn if x['khoi'] in chon and x['loai'] in ('THIẾU', 'SAI_NHIP', 'SAI_LOAI')]; thieu_chon = [x for x in con if not da_dung(x)]
    if len(con) > len(thieu_chon): print(f"   ✓ {len(con) - len(thieu_chon)} chi tiết ảnh báo thiếu mà sổ đã dựng đúng chỗ đó (mô hình có, ảnh chụp mô hình chưa lộ — gờ cùng màu tường, không nắng): không tính còn thiếu")
    if thieu_chon: print(f"   ✗ khối đang làm còn {len(thieu_chon)} chi tiết THIẾU / SAI NHỊP đã xác nhận")
    # mã thoát: 1 = KÉM ĐI (cổng đỏ, trả sổ) · 3 = CHƯA XONG (còn THIẾU đã xác nhận → vòng kế dựng tiếp, KHÔNG phải hỏng) · 0 = xong
    # 21/11/2026 gộp chung mã 1 → lam-mat 18/18 ảnh đạt vẫn trả sổ vì 'còn 12 chi tiết THIẾU'
    return MA_KEM if hong else MA_CHUA_XONG if thieu_chon else 0


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
    # 0b. bước dựng cân phiếu THỪA: 2 ảnh THỪA mà 3 ảnh thấy → giữ; 3 THỪA, 1 thấy → gỡ (sổ tạm, không đụng sổ thật)
    import tempfile
    dn = {'canh': 1, 't0': 0, 't1': 5, 'a0': [0, 0], 'u': [1, 0], 'n': [0, -1], 'ra': 0}; g_ = lambda y: {'chi_tiet': 'gờ', 'khoi': 'k', 'y': y, 'doan': [dn]}
    with tempfile.TemporaryDirectory() as td:
        st = pathlib.Path(td) / 's.json'
        for n_thua, n_thay, con in ((2, 3, True), (3, 1, False)):
            st.write_text(json.dumps({'muc': [{**g_(33.15), 'loai': 'go', 'so_anh': 3, 'anh': []}]}))
            dung([], [{**g_(33.1), 'loai': 'THỪA', 'so_anh': n_thua, 'anh': [f't{i}' for i in range(n_thua)]}], [(f'c{i}', {**g_(33.12), 'loai': 'CÓ'}) for i in range(n_thay)], tep=st)
            ok(bool(json.loads(st.read_text())['muc']) == con, f"cân phiếu THỪA {n_thua} ảnh · thấy {n_thay} ảnh → {'giữ' if con else 'gỡ'}")
        # 0b'. ảnh đã đòi dựng (trong 'anh' của mục) quay sang báo THỪA đúng mục đó → không tính phiếu, giữ (vòng +2/−2 mãi, 22/11/2026)
        st.write_text(json.dumps({'muc': [{**g_(37.04), 'loai': 'go', 'so_anh': 2, 'anh': ['a', 'b']}]}))
        dung([], [{**g_(37.0), 'loai': 'THỪA', 'so_anh': 2, 'anh': ['a', 'b']}], [], tep=st)
        ok(len(json.loads(st.read_text())['muc']) == 1, "THỪA từ chính 2 ảnh đã đòi dựng → giữ (ảnh tự mâu thuẫn)")
        # 0c. đổi loại cửa phải kèm cỡ cùng lượt đo, rồi chốt bằng ngưỡng chung (sổ từng giữ cửa vào 0,52 m — 21/11/2026)
        lo_ = lambda **k: {'chi_tiet': 'lỗ', 'khoi': 'k', 'y0': 0, 'y1': 2.0, 'y': 1.0, 'doan': [{**dn, 't0': 2, 't1': 2.6}], **k}
        for w_moi, cua_ra in ((0.8, 'cua_vao'), (0.5, 'cua_so')):
            st.write_text(json.dumps({'muc': [{**lo_(w=0.52, h=2.0, cua='cua_so'), 'loai': 'lo', 'so_anh': 2, 'anh': []}]}))
            dung([{**lo_(w=w_moi, h=2.0, cua='cua_vao'), 'doan': [{**dn, 't0': 2.3 - w_moi / 2, 't1': 2.3 + w_moi / 2}], 'loai': 'SAI_LOAI', 'so_anh': 2, 'anh': ['a', 'b']}], [], tep=st); m0 = json.loads(st.read_text())['muc'][0]
            ok((m0['cua'], m0['w']) == (cua_ra, w_moi), f"SAI_LOAI → cửa vào, cỡ mới {w_moi} m → sổ {cua_ra}, rộng {w_moi}: {(m0['cua'], m0['w'])}")
        import io, contextlib, re
        # 0e. lỗ trong sổ đặt lệch (đoạn nở rộng), ảnh báo THIẾU lỗ hẹp đúng chỗ → sổ dời lỗ về chỗ ảnh, không nở thêm
        st.write_text(json.dumps({'muc': [{**lo_(w=0.35, h=0.8, cua='cua_so'), 'doan': [{**dn, 't0': 5.85, 't1': 6.92}], 'loai': 'lo', 'so_anh': 3, 'anh': []}]}))
        with contextlib.redirect_stdout(io.StringIO()): dung([{**lo_(w=0.35, h=0.8, cua='cua_so'), 'doan': [{**dn, 't0': 6.48, 't1': 6.83}], 'loai': 'THIẾU', 'so_anh': 2, 'anh': ['a', 'b']}], [], tep=st)
        d0 = json.loads(st.read_text())['muc'][0]['doan'][0]; ok((d0['t0'], d0['t1']) == (6.48, 6.83), f"lỗ lệch → dời về chỗ ảnh 6.48–6.83: {(d0['t0'], d0['t1'])}")
        # 0d. gặp lại ĐÚNG mục đã có → 0 cập nhật (vòng khép được); ảnh mới thấy thêm đoạn → 1 cập nhật
        import io, contextlib, re
        for t1, n_ra in ((5, 0), (7, 1)):
            st.write_text(json.dumps({'muc': [{**g_(33.15), 'loai': 'go', 'so_anh': 2, 'anh': ['a', 'b']}]}))
            with contextlib.redirect_stdout(io.StringIO()) as f_: dung([{**g_(33.15), 'doan': [{**dn, 't1': t1}], 'loai': 'THIẾU', 'so_anh': 2, 'anh': ['a', 'b']}], [], tep=st)
            n = int(re.search(r'(\d+) cập nhật', f_.getvalue()).group(1)); ok(n == n_ra, f"gặp lại gờ (đoạn tới {t1} m) → {n_ra} cập nhật: {n}")
        # 0f. ảnh báo THIẾU đúng chỗ sổ đã dựng (áp lại không đổi) = đã dựng, không tính còn thiếu; chỗ khác / đoạn dài hơn / sổ không có → vẫn thiếu
        st.write_text(json.dumps({'muc': [{**g_(33.15), 'loai': 'go', 'so_anh': 2, 'anh': ['a', 'b']}]}))
        x_ = lambda y, t1=5: {**g_(y), 'doan': [{**dn, 't1': t1}], 'loai': 'THIẾU', 'so_anh': 2, 'anh': ['a', 'b']}
        kq_ = (da_dung(x_(33.15), tep=st), da_dung(x_(33.15, 7), tep=st), da_dung(x_(36.0), tep=st), da_dung(x_(33.15), tep=pathlib.Path(td) / 'khong.json'))
        ok(kq_ == (True, False, False, False), f"THIẾU trùng mục sổ đã dựng → đã dựng; đoạn dài hơn / chỗ khác / không sổ → còn thiếu: {kq_}")
    # 0. mặt ngang sát tường (mặt trên phào nhô 0,14 m) thuộc mặt tường; mặt ngang sâu trong khối là mái
    bv = BanDo([{'id': 'vuong', 'v': [[0, 0], [10, 0], [10, 10], [0, 10]]}]); nh = bv.mat(np.array([[5.0, 20, -0.14], [5.0, 20, 0.3], [5.0, 20, 5.0], [5.0, 20, 0.3]]), np.array([True, True, True, False]))
    ok(list(nh) == ['vuong#0', 'vuong#0', 'vuong#mái', 'vuong#0'], f"mặt trên phào / bậu → cạnh tường, giữa khối → mái: {list(nh)}")
    # 0b. tường chung: khối cao A [0..10] và khối thấp B [10..20] chung đường x = 10, camera ở x = 30 — điểm trên tường A lộ phía trên B thuộc A (mặt quay về camera), không thuộc B
    bc = BanDo([{'id': 'A', 'v': [[0, 0], [10, 0], [10, 10], [0, 10]]}, {'id': 'B', 'v': [[10, 0], [20, 0], [20, 10], [10, 10]]}])
    for x_ in (10.0, 10.1):
        nb = bc.mat(np.array([[x_, 30, 5.0]]), np.array([False]), np.array([30.0, 20, 5])); ok(nb[0] == 'A#1', f"tường chung x={x_}: điểm lộ trên khối thấp gán mặt khối cao quay về camera A#1: {nb[0]}")
    nb = bc.mat(np.array([[20.0, 5, 5.0]]), np.array([False]), np.array([30.0, 20, 5])); ok(nb[0] == 'B#1', f"mặt ngoài khối thấp quay về camera giữ nguyên B#1: {nb[0]}")
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
    ok(c2['tang_F'] and abs(c2['doi_px'][1] - 20) <= 2 and abs(c2['doi_px'][0]) <= 2 and abs(c2['ti_le'] - 1) < 0.02, f"cả khung dời 20 px: canh khung tìm ra dời {c2['doi_px']} · tỉ lệ ×{c2['ti_le']}")
    # khoá canh khung: ghi ↔ dựng phải khứ hồi đúng ma trận (cả bản ghi cũ sai quy ước), lượt sau dùng đúng khung đã khoá, camera đổi thì khoá cũ hết hiệu lực
    W_, H_ = d['W'], d['H']; sai = 0.0
    for r, sc, dx, dy in [(2, 0.9, 0, -40), (-1.5, 1.1, 25, 10), (0.7, 0.95, -30, 5)]:
        M = cv2.getRotationMatrix2D((W_ / 2, H_ / 2), r, sc); M[:, 2] += (dx, dy); c = ck_ghi(M, W_, H_, 0.1)
        cu = {'ti_le': c['ti_le'], 'xoay': -r, 'doi_px': [dx, round(dy + 2 * sc * np.sin(np.radians(r)) * W_ / 2)], 'tang_F': 0.1}  # đúng cách ghi trước 21/11/2026
        sai = max(sai, float(np.abs(ck_tu_so(c, W_, H_) - M).max()), float(np.abs(ck_tu_so(cu, W_, H_) - M).max()), abs(c['xoay'] - r), abs(c['doi_px'][1] - dy))
    ok(sai < 1.5, f"canh khung ghi ↔ dựng khứ hồi (xoay, dời, bản ghi cũ): sai lớn nhất {sai:.2f}")
    kh = {}; k3 = phan_tich(dich, d, thu, bd, chon, kh); k4 = phan_tich(gia, d, thu, bd, chon, kh)
    ok(len(kh) == 1 and k4['canh_khung']['M'] == k3['canh_khung']['M'], f"khoá: lượt sau (ảnh đổi) dùng đúng khung đã khoá {k4['canh_khung']['doi_px']}")
    d2 = {**d, 'fov': d['fov'] + 3}; ok(khoa_khung(d2) not in kh, "khoá: camera đổi ống kính → khoá cũ không áp")
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
    # 5. THỪA CHI TIẾT: khung chồng làm nét mô hình dày gấp đôi mà F vẫn y nguyên → phải KÉM; nét dày vừa phải (≤ 1,3 × ảnh) hay không dày thêm → không
    B = {'k/1#0': {'F': 0.8, 'net_anh': 300, 'net_mh': 330}}
    dt_, dk_ = day_net(B, {'k/1#0': {**B['k/1#0'], 'net_mh': 660}}, {'k/1'})
    ok(thua_chi_tiet(dt_, dk_), f"khung chồng: dày nét {dt_:.2f} → {dk_:.2f} = THỪA")
    dt_, dk_ = day_net(B, {'k/1#0': {**B['k/1#0'], 'net_mh': 370}}, {'k/1'})
    ok(not thua_chi_tiet(dt_, dk_), f"thêm vừa đủ: dày nét {dt_:.2f} → {dk_:.2f} không THỪA")
    dt_, dk_ = day_net({'k/1#0': {**B['k/1#0'], 'net_mh': 600}}, {'k/1#0': {**B['k/1#0'], 'net_mh': 600}}, {'k/1'})
    ok(not thua_chi_tiet(dt_, dk_), f"đã dày từ trước, không dày thêm: {dt_:.2f} → {dk_:.2f} không chặn")
    T = {'k/1#0': {'net_anh': 300, 'net_mh': 330}, 'k/2#0': {'net_anh': 300, 'net_mh': 330}}
    ok(mat_day_len(T, {'k/1#0': {'net_anh': 300, 'net_mh': 660}, 'k/2#0': {'net_anh': 300, 'net_mh': 360}}) == ['k/1'], "chỉ khối có mặt dày lên bị quy THỪA (k/1), khối thêm vừa phải (k/2) giữ")
    return 1 if loi else 0


if __name__ == '__main__':
    if '--tu-kiem' in sys.argv: sys.exit(tu_kiem())
    sys.exit(chay(pathlib.Path(sys.argv[1]), sys.argv[2], '--dung' in sys.argv))
