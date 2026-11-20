#!/usr/bin/env python3
"""KHỚP MÔ HÌNH THEO HÌNH VẼ — đo + chỉnh tự động, không gọi AI (anh 21/11/2026: "hệ thống tự đo và điều chỉnh mô hình 3D cho khớp với các hình vẽ cung cấp vào").
Sổ hình vẽ: public/du-lieu/<lâu>-hinh-ve.json — mỗi mục {tep, loai: mat_bang | mat_dung | anh, tin: hien_trang | thiet_ke, nguon, cat?: [x0,y0,x1,y1]}.
Bước 1 (tệp này): ĐĂNG KÝ — tự đặt bản vẽ mặt bằng vào toạ độ cảnh (tỉ lệ, xoay, dời, có lật) bằng chamfer hai chiều giữa mép tường vẽ và mép mặt bằng mô hình,
tối ưu bằng torch autograd (CPU). Ghi phép đổi vào sổ + ảnh chồng (đỏ = mép mô hình trên bản vẽ) để soát.
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/khop-hinh.py [--lau neuschwanstein] [--chi <tep>] [--anh <thư mục>]
tra-repo-ok: đã tra 21/11/2026 — OpenCV (distanceTransform, contours) + torch dùng làm lõi; fSpy / FloorplanToBlender3d (GPL) chỉ học cách; CubiCasa5k (mạng nhận phòng)
và pytorch3d / nvdiffrast (cần CUDA) không cần cho chamfer mép tường. Khớp camera ảnh chụp đã có ở scripts/khop-camera.mjs."""
import json, math, sys, pathlib
import numpy as np, cv2, torch

A = sys.argv[1:]
LAU = A[A.index('--lau') + 1] if '--lau' in A else 'neuschwanstein'
GOC = pathlib.Path(__file__).resolve().parent.parent
SO = GOC / 'public/du-lieu' / f'{LAU}-hinh-ve.json'
K = json.load(open(GOC / 'du-lieu-goc/bayern/diem-mo-hinh.json'))  # mặt bằng khối ĐÚNG như trang dựng (đã dời theo sua.json) — scripts/so-lod2.mjs xuất


def khoi_lau(ds):  # khối thuộc công trình: bỏ khối sát đất / ngoài cụm (nhà hàng, ki-ốt — bản vẽ không có)
    cao = [k for k in ds if k['yTren'] > 25]
    cx, cz = np.median([k['tam'][0] for k in cao]), np.median([k['tam'][1] for k in cao])
    r = np.percentile([math.hypot(k['tam'][0] - cx, k['tam'][1] - cz) for k in cao], 95) + 15
    return [k for k in cao if math.hypot(k['tam'][0] - cx, k['tam'][1] - cz) <= r]


def mep_mo_hinh(ds):  # đoạn mép NGOÀI hợp các mặt bằng (cạnh chung giữa hai khối không phải tường ngoài) — raster 0,1 m rồi lấy viền
    v = np.concatenate([np.array(k['v']) for k in ds]); o = v.min(0) - 2; B = 0.1
    W, H = (np.ceil((v.max(0) + 2 - o) / B)).astype(int)
    m = np.zeros((H, W), np.uint8)
    for k in ds: cv2.fillPoly(m, [np.round((np.array(k['v']) - o) / B).astype(np.int32)], 255)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    seg = []
    for c in cs:
        p = cv2.approxPolyDP(c, 1.5, True)[:, 0, :] * B + o  # bỏ bậc thang raster: 0,15 m — 4.092 đoạn → vài trăm, chiều ngược nhanh gấp chục lần
        for i in range(len(p)): seg.append([*p[i], *p[(i + 1) % len(p)]])
    return np.array(seg, float), m, o, B


def mau_doan(seg, buoc):  # điểm đều trên các đoạn
    ra = []
    for x0, z0, x1, z1 in seg:
        n = max(1, int(math.hypot(x1 - x0, z1 - z0) / buoc))
        for t in np.arange(n) / n: ra.append([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t])
    return np.array(ra)


def ban_ve(tep, cat):
    g = cv2.imread(str(tep), cv2.IMREAD_GRAYSCALE)
    if cat: g = g[cat[1]:cat[3], cat[0]:cat[2]]
    toi = (g < 110).astype(np.uint8)
    # bỏ chữ / chú thích: chỉ giữ thành phần liền đủ lớn (tường liền nhau thành mảng lớn)
    n, nh, st, _ = cv2.connectedComponentsWithStats(toi, 8)
    lon = st[1:, cv2.CC_STAT_AREA].max()
    giu = np.zeros_like(toi)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 0.002 * lon or st[i, cv2.CC_STAT_AREA] >= 400: giu[nh == i] = 1
    x, y, w, h = cv2.boundingRect(giu)
    # viền NGOÀI của khối nhà trên bản vẽ: đóng khe cửa / hành lang rồi lấp lỗ
    k = max(3, int(0.012 * max(w, h))) | 1
    dong = cv2.morphologyEx(giu * 255, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    cs, _ = cv2.findContours(dong, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cs = [c for c in cs if cv2.contourArea(c) > 0.01 * w * h]
    vien = np.concatenate([c[:, 0, :] for c in cs]).astype(float)
    dac = np.zeros_like(dong); cv2.drawContours(dac, cs, -1, 255, -1)
    D = cv2.distanceTransform((1 - giu).astype(np.uint8), cv2.DIST_L2, 5)  # khoảng cách tới nét tường gần nhất (px)
    return g, giu, vien, dac, D


def mo_men(m):  # tâm, góc trục chính, diện tích của mảng đặc
    ys, xs = np.nonzero(m); p = np.stack([xs, ys], 1).astype(float); c = p.mean(0)
    w, v = np.linalg.eigh(np.cov((p - c).T)); a = math.atan2(v[1, 1], v[0, 1])
    return c, a, len(p)


def doi(p, s, th, t, lat):  # cảnh (x, z) → điểm ảnh: lật z (tuỳ chọn) → xoay → tỉ lệ → dời
    z = -p[:, 1] if lat else p[:, 1]
    c, sn = torch.cos(th), torch.sin(th)
    return torch.stack([s * (c * p[:, 0] - sn * z) + t[0], s * (sn * p[:, 0] + c * z) + t[1]], 1)


def dang_ky(muc):
    g, giu, vien, dac, D = ban_ve(GOC / muc['tep'], muc.get('cat'))
    ds = khoi_lau(K['ds']); seg, mm, o, B = mep_mo_hinh(ds)
    P = torch.tensor(mau_doan(seg, 0.5), dtype=torch.float32)
    Dt = torch.tensor(D, dtype=torch.float32)[None, None]; H, W = D.shape
    Vt = torch.tensor(vien[:: max(1, len(vien) // 1500)], dtype=torch.float32)
    S = torch.tensor(seg, dtype=torch.float32)
    cm, am, nm = mo_men(mm); cv_, av, nv = mo_men(dac // 255)
    s0 = math.sqrt(nv / (nm * B * B))  # px / m
    cm = cm * B + o
    tot = None
    for lat in (False, True):
        for k in range(4):
            th0 = av - (-am if lat else am) + k * math.pi / 2
            s = torch.tensor(s0, requires_grad=True); th = torch.tensor(th0, requires_grad=True)
            c0 = doi(torch.tensor(np.array([cm]), dtype=torch.float32), torch.tensor(s0), torch.tensor(th0), torch.zeros(2), lat)[0]
            t = (torch.tensor(cv_, dtype=torch.float32) - c0).clone().requires_grad_(True)
            op = torch.optim.Adam([{'params': [t], 'lr': 1.0}, {'params': [th], 'lr': 2e-3}, {'params': [s], 'lr': 2e-3 * s0}])
            for it in range(400):
                q = doi(P, s, th, t, lat)
                gx = q[:, 0] / (W - 1) * 2 - 1; gy = q[:, 1] / (H - 1) * 2 - 1
                d1 = torch.nn.functional.grid_sample(Dt, torch.stack([gx, gy], 1)[None, None], align_corners=True)[0, 0, 0]
                d1 = torch.where((gx.abs() > 1) | (gy.abs() > 1), torch.full_like(d1, 40.0), d1)
                # chiều ngược: mỗi điểm viền bản vẽ → mép mô hình gần nhất (đổi đoạn mô hình sang px)
                a = doi(S[:, :2], s, th, t, lat); b = doi(S[:, 2:], s, th, t, lat); ab = b - a
                u = ((Vt[:, None, :] - a[None]) * ab[None]).sum(-1) / (ab * ab).sum(-1).clamp(min=1e-6)
                pr = a[None] + u.clamp(0, 1)[..., None] * ab[None]
                d2 = (Vt[:, None, :] - pr).norm(dim=-1).min(1).values
                tau = 0.02 * max(H, W)  # cắt đuôi: phần bản vẽ không có trong mô hình (và ngược lại) không kéo lệch cả bản
                loss = torch.minimum(d1, torch.tensor(tau)).mean() + torch.minimum(d2, torch.tensor(tau)).mean()
                op.zero_grad(); loss.backward(); op.step()
            r = (float(loss.detach()), lat, float(s), float(th), t.detach().numpy().tolist())
            if tot is None or r[0] < tot[0]: tot = r
    l, lat, s, th, t = tot
    # đo chất lượng: % mép mô hình nằm ≤ 1 m (theo tỉ lệ vừa tìm) từ nét tường vẽ
    q = doi(P, torch.tensor(s), torch.tensor(th), torch.tensor(t), lat).numpy()
    ok = (q[:, 0] >= 0) & (q[:, 0] < W) & (q[:, 1] >= 0) & (q[:, 1] < H)
    d = np.full(len(q), 1e9); d[ok] = D[q[ok, 1].astype(int), q[ok, 0].astype(int)]
    khop = float((d <= s * 1.0).mean())
    return {'s_px_m': round(s, 4), 'xoay': round(th, 5), 'doi': [round(v, 2) for v in t], 'lat': lat, 'khop_1m': round(khop, 3), 'loss': round(l, 2)}, (g, seg, ds)


def ve_chong(muc, dk, g, seg, ds, ra):
    im = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
    def px(x, z):
        q = doi(torch.tensor([[x, z]], dtype=torch.float32), torch.tensor(dk['s_px_m']), torch.tensor(dk['xoay']), torch.tensor(dk['doi']), dk['lat'])[0]
        return int(q[0]), int(q[1])
    for k in ds:
        p = np.array([px(x, z) for x, z in k['v']], np.int32); cv2.polylines(im, [p], True, (255, 140, 0), 1)
    for x0, z0, x1, z1 in seg: cv2.line(im, px(x0, z0), px(x1, z1), (0, 0, 255), 2)
    cv2.putText(im, f"khop 1 m: {dk['khop_1m']:.0%}  {dk['s_px_m']:.2f} px/m", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
    cv2.imwrite(str(ra), im)


so = json.load(open(SO))
chi = A[A.index('--chi') + 1] if '--chi' in A else None
anh = pathlib.Path(A[A.index('--anh') + 1]) if '--anh' in A else None
for muc in so['ds']:
    if muc['loai'] != 'mat_bang' or (chi and chi not in muc['tep']): continue
    dk, (g, seg, ds) = dang_ky(muc)
    muc['dang_ky'] = dk
    print(f"{pathlib.Path(muc['tep']).name:60} {muc['tin']:11} khớp ≤1 m {dk['khop_1m']:.0%} · {dk['s_px_m']:.2f} px/m · xoay {math.degrees(dk['xoay']):.1f}° · lật {dk['lat']}")
    if anh: anh.mkdir(parents=True, exist_ok=True); ve_chong(muc, dk, g, seg, ds, anh / (pathlib.Path(muc['tep']).stem + '.png'))
json.dump(so, open(SO, 'w'), ensure_ascii=False, indent=1)
