#!/usr/bin/env python3
# NÓN THEO TIA (anh 21/11/2026 "ko chắp vá, làm thành chuẩn"): mái nón / chóp OSM chỉ có roof:height — không nói nón mảnh hay bè. Tháp tròn 223140028 dựng
# nón OSM r 2,8 m · cao 10 m (bè, thấp) trong khi ảnh thật là chóp mảnh, cao. Bước này đo đỉnh + độ mảnh của MỌI khối mái nón / chóp bằng ảnh đã định vị
# (<lâu>-do-anh.json, camera do-anh.mjs LightGlue + PnP), cùng mặt nạ trời của loc-chop-troi.py:
#   1. chiếu trục khối (tâm mặt bằng, đứng) vào ảnh từ chân mái y1 lên y1 + 45 m; ảnh chỉ dùng khi chân mái nằm trên vật và phía trên trục có trời (nền trời)
#   2. đỉnh = độ cao thấp nhất mà từ đó lên 3 m dải ±TOL px quanh trục toàn trời (TOL bù lệch camera ~20 px); ảnh có khối khác cao hơn ló vào dải → bỏ (lẫn)
#   3. bề ngang: dải không-trời liền trục ở mỗi hàng trên thân chóp, px × độ sâu / f → mét; khớp w = a·(đỉnh − h) → bán kính chân = a·(đỉnh − y1)/2
#   4. trung vị qua các ảnh dùng được (≥ 2 ảnh mới ghi); ghi <lâu>-non-tia.json { khoi: { id: { y_dinh, r_chan, anh, chi_tiet } } } — ns.js dựng nón theo tệp
#   node apps/castle/scripts/non-theo-tia.mjs [--ghi] [--khoi way/…]   (mjs đọc khối từ trang rồi gọi tệp này)
#   ... --anh-ra <thư mục>   lưới ô kiểm mỗi khối (ảnh dùng được, chân mái / đỉnh mô hình / đỉnh đo) — xem trước khi --ghi
#   ~/.venvs/castle-khop/bin/python apps/castle/scripts/non-theo-tia.py --tu-kiem   bài kiểm có thể hỏng: chóp vẽ giả trên ảnh trời phải đo ra đúng đỉnh + bề ngang
# tra-repo-ok: keo nội bộ — camera ảnh từ do-anh.mjs, mặt nạ trời OpenCV; không thư viện nào đo chóp OSM trên ảnh định vị.
import json, math, sys
from pathlib import Path
import numpy as np, cv2
sys.path.insert(0, str(Path(__file__).resolve().parent))

GOC = Path(__file__).resolve().parent.parent
DL = GOC / 'public' / 'du-lieu'
LAU = 'neuschwanstein'
TOL, BUOC, TREN, CHOP_DU, VIEN_PX = 25, 0.2, 45.0, 10.0, 7  # CHOP_DU: chóp chưa đo cao hơn OSM tối đa chừng này (lượt 1); lượt 2 dùng đỉnh đã đo


def ma_tran(yaw, pitch, roll):  # three.js Euler 'YXZ'
    cy, sy, cp, sp, cr, sr = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    return (np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]) @ np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
            @ np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]]))


def may(a, W, H):
    c = a['camera']; M = ma_tran(c['yaw'], c['pitch'], c['roll']); f = (H / 2) / math.tan(math.radians(c['fov']) / 2); O = np.array([a['x'], c['y'], a['z']])
    def chieu(P):
        q = M.T @ (np.asarray(P, float) - O)
        return None if q[2] > -1 else (W / 2 + f * q[0] / -q[2], H / 2 - f * q[1] / -q[2], -q[2])
    return chieu, f


def mat_troi(anh):  # cùng luật loc-chop-troi.py: vùng phẳng sáng nối liền mép trên
    xam = cv2.GaussianBlur(cv2.cvtColor(anh, cv2.COLOR_BGR2GRAY), (5, 5), 0).astype(np.float32)
    doc = cv2.magnitude(cv2.Sobel(xam, cv2.CV_32F, 1, 0), cv2.Sobel(xam, cv2.CV_32F, 0, 1))
    phang = cv2.morphologyEx(((doc < 18) & (xam > 110)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, nhan = cv2.connectedComponents(phang, connectivity=4)
    tren = set(np.unique(nhan[0][phang[0] > 0]).tolist()) - {0}
    return np.isin(nhan, list(tren)) if tren else np.zeros(phang.shape, bool)


def trong_da(px, pz, v):  # điểm (mảng) trong đa giác v — đếm cắt tia
    v = np.asarray(v, float); x0, z0 = v[:, 0], v[:, 1]; x1, z1 = np.roll(x0, -1), np.roll(z0, -1); kq = np.zeros(px.shape, bool)
    for i in range(len(v)):
        cat = ((z0[i] > pz) != (z1[i] > pz)) & (px < (x1[i] - x0[i]) * (pz - z0[i]) / (z1[i] - z0[i] + 1e-12) + x0[i]); kq ^= cat
    return kq


def cao_mai(o, x, z):  # độ cao mặt trên khối o tại các điểm (x, z) — hình khối đúng như ns.js dựng: nón/chóp thu về tâm, mái hai dốc theo trục dài, còn lại hộp
    y1, dinh = o.get('y1'), o.get('dinh', o['yTren'])
    if y1 is None or dinh <= y1 + 0.1 or o.get('mai') not in ('cone', 'pyramidal', 'gabled'): return np.full(np.shape(x), dinh)
    if o['mai'] == 'gabled':  # nóc chạy theo trục chính của mặt bằng (cạnh dài), dốc xuống hai mép
        v = np.asarray(o['v'], float); c = v.mean(0); u, s_, vt = np.linalg.svd(v - c); n_ = vt[1]; nua = np.abs((v - c) @ n_).max() + 1e-6
        return y1 + (dinh - y1) * np.clip(1 - np.abs((np.stack([x, z], -1) - c) @ n_) / nua, 0, 1)
    r = max(math.hypot(px - o['x'], pz - o['z']) for px, pz in o['v']) + 1e-6
    return y1 + (dinh - y1) * np.clip(1 - np.hypot(x - o['x'], z - o['z']) / r, 0, 1)


def che_boi(k, khac, a, f, sau, cao):  # cao: các độ cao trên trục cần kiểm → id khối che (hoặc None)
    # Tia camera → trục (lệch ngang ±TOL px) chỉ xét đoạn NGOÀI chân khối k (k.r + 0,3 m): khối bao quanh k (mái Palas 221599090 bao cả tháp cầu thang lẫn
    # chóp 223116018) cũng che được — chóp thấp hơn nóc thì ảnh nhìn thấy đầu hồi + tượng sư tử, không phải chóp.
    O = np.array([a['x'], a['camera']['y'], a['z']]); P0 = np.array([k['x'], 0.0, k['z']])
    nhin = P0 - O; nhin[1] = 0; nhin /= np.linalg.norm(nhin) + 1e-9; ngang = np.array([-nhin[2], 0, nhin[0]]) * TOL * sau / f
    t = np.linspace(0.02, 0.995, 500)[:, None]
    for o in khac:
        if o.get('vo') or o.get('yTren') is None or not o.get('v'): continue
        if math.hypot(o['x'] - O[0], o['z'] - O[2]) > sau + 5 + max(math.hypot(px - o['x'], pz - o['z']) for px, pz in o['v']): continue
        day = o.get('yDuoi') if o.get('yDuoi') is not None else -1e9
        for h in cao:
            for lech in (-1, 0, 1):
                Q = O + t * (np.array([k['x'], h, k['z']]) + lech * ngang - O)
                ngoai = np.hypot(Q[:, 0] - k['x'], Q[:, 2] - k['z']) > k.get('r', 1.0) + 0.3
                trong = ngoai & trong_da(Q[:, 0], Q[:, 2], o['v']) & (Q[:, 1] >= day)
                if trong.any() and (Q[trong, 1] <= cao_mai(o, Q[trong, 0], Q[trong, 2])).any(): return o['id']
    return None


def do_mot(k, khac, a, im, mt):
    Hh, Ww = im.shape[:2]; chieu, f = may(a, Ww, Hh)
    hs = np.arange(k['y1'], k['y1'] + TREN, BUOC); pts = [chieu((k['x'], h, k['z'])) for h in hs]
    if any(p is None or not (TOL <= p[0] < Ww - TOL and 0 <= p[1] < Hh) or p[2] > 450 for p in pts[:5]): return None, 'ngoài khung'
    if pts[0][2] > 450: return None, 'xa'
    d0 = pts[0]
    # CHE theo hình khối mô hình, từng độ cao: tia camera → trục (lệch ngang ±TOL px) xuyên khối khác nằm giữa thì hàng đó là của khối che (tháp góc 223145712
    # đỉnh 61,6 m thấp hơn chân nón 223140028 64,3 m mà vẫn che nó ở mọi ảnh sân trong vì gần camera). Dải đỉnh bị che → bỏ ảnh; hàng bề ngang bị che → bỏ hàng.
    # Khối mái chóp: thân tới chân mái rồi nón tới đỉnh + CHOP_DU (chóp thật thường cao hơn OSM).
    gan = [o for o in khac if o.get('v') and not o.get('vo') and o.get('yTren') is not None and math.hypot(o['x'] - a['x'], o['z'] - a['z']) < d0[2] + 5]
    def troi_dai(p):
        u, v = int(round(p[0])), int(round(p[1]))
        return v >= 0 and mt[v, max(0, u - TOL):u + TOL + 1].all()
    if troi_dai(d0): return None, 'chân mái là trời (camera lệch)'
    n3 = int(3 / BUOC); dinh = None
    for i, p in enumerate(pts):
        if p is None or p[1] < 0: break
        if all(q is not None and q[1] >= 0 and troi_dai(q) for q in pts[i:i + n3]) and len(pts[i:i + n3]) == n3: dinh = i; break
    if dinh is None: return None, 'không có nền trời trên trục'
    h_dinh = float(hs[dinh]) - BUOC / 2 - (VIEN_PX / 2) * d0[2] / f  # viền mờ mặt nạ trời ăn lên trên đầu mũi nửa VIEN_PX
    # Trục phải LIỀN từ đỉnh mô hình tới đầu trời: khúc giữa bị khối khác che (chóp 223116018 nằm sau đầu hồi Palas, trên nóc là tượng sư tử) thì đầu trời
    # thuộc vật khác — bỏ ảnh. Kiểm từ đỉnh mô hình (yTren) lên tới trên đầu trời 3 m.
    o_che = che_boi(k, gan, a, f, d0[2], np.arange(min(k.get('yTren', h_dinh), h_dinh - 2), h_dinh + 3.1, 1.0))
    if o_che: return None, f"đỉnh bị che {o_che}"
    # bề ngang mỗi hàng từ 30% thân tới đầu mũi: dải không-trời liền điểm gần trục nhất
    rong = []
    for i in range(int(dinh * 0.3), dinh):
        p = pts[i]; u, v = int(round(p[0])), int(round(p[1])); hang = ~mt[v]
        lo = [x for x in range(u - TOL, u + TOL + 1) if 0 <= x < Ww and hang[x]]
        if not lo: continue
        x0 = min(lo, key=lambda x: abs(x - u)); l = r = x0
        while l - 1 >= 0 and hang[l - 1]: l -= 1
        while r + 1 < Ww and hang[r + 1]: r += 1
        if r - l > 4 * TOL: continue  # dính khối khác
        if che_boi(k, gan, a, f, d0[2], [float(hs[i])]): continue
        rong.append((float(hs[i]), (r - l + 1) * p[2] / f))
    hong = {'y_dinh': round(float(h_dinh), 2), 'y_mui': round(float(h_dinh), 2), 'r_chan': None, 'tach_mui': False}
    if len(rong) < 8: return hong, 'ít hàng đo bề ngang'
    # Đầu trời h_dinh là đầu MŨI (thánh giá / chong chóng / quả cầu; ảnh thật 712 cao hơn mũi nón ~1,5 m). Bề ngang theo độ cao: trên mũi nón gần như hằng
    # (cột mũi + viền mờ mặt nạ), dưới mũi nón tăng tuyến tính → w = wm + a·max(0, T − h). Dò T trong [h_dinh − 6, h_dinh], mỗi T bình phương nhỏ nhất (wm, a),
    # bỏ hàng lệch > 2,5 × trung vị lệch (tay thánh giá, chong chóng) rồi khớp lại; T sai số nhỏ nhất = mũi nón. Không có mũi thì T = h_dinh.
    H_ = np.array([h for h, _ in rong]); W_ = np.array([x for _, x in rong])
    def khop(T, m):
        A = np.stack([np.ones(m.sum()), np.maximum(0, T - H_[m])], 1); q = np.linalg.lstsq(A, W_[m], rcond=None)[0]
        return q, W_ - (q[0] + q[1] * np.maximum(0, T - H_))
    tot = None
    for T in np.arange(h_dinh, h_dinh - 6, -BUOC):
        m = np.ones(len(H_), bool); q, du = khop(T, m)
        m = np.abs(du) <= 2.5 * (np.median(np.abs(du)) + 1e-6); q, du = khop(T, m); e = float(np.mean(du[m] ** 2))
        if tot is None or e < tot[0] - 1e-9: tot = (e, T, q)
    _, gay, (wm, a_) = tot
    # chỗ gãy là nơi nón hẹp bằng cột mũi, chưa phải mũi nón: nón còn thu tiếp tới bề ngang viền mờ b0 (mặt nạ trời ăn ~7 px mỗi cạnh vật tương phản cao:
    # đo trên chóp vẽ giả — bề ngang đo = thật + 7 px ở mọi độ cao) → mũi nón = gãy + (wm − b0)/a
    b0 = VIEN_PX * d0[2] / f; non = min(h_dinh, gay + max(0.0, wm - b0) / max(a_, 1e-6))
    rc = a_ * (non - k['y1']) / 2
    if a_ <= 0.02 or not (0.15 < rc < 1.5 * k['r'] + 0.5): return hong, 'bề ngang vô lý (dính khối khác)'
    return {'y_dinh': round(float(non), 2), 'y_mui': round(float(h_dinh), 2), 'r_chan': round(float(rc), 2), 'tach_mui': True, 'px': [round(d0[0]), round(d0[1]), round(pts[dinh][1])]}, 'ok'


def ve_kiem(k, tep, a, im, mt, r):  # ô kiểm 300×300: trời tô cam, chân mái xanh lá, đỉnh mô hình vàng, đầu mũi đo tím, đỉnh nón đo đỏ
    Hh, Ww = im.shape[:2]; ch, f = may(a, Ww, Hh); v = im.copy(); v[mt] = (v[mt] * 0.55 + np.array([255, 160, 60]) * 0.45).astype(np.uint8)
    for h, c in ((k['y1'], (0, 255, 0)), (k['yTren'], (0, 255, 255)), (r['y_mui'], (255, 0, 255)), (r['y_dinh'], (0, 0, 255))):
        p = ch((k['x'], h, k['z'])); cv2.line(v, (int(p[0]) - TOL, int(p[1])), (int(p[0]) + TOL, int(p[1])), c, 2)
    p0, p1 = ch((k['x'], k['y1'], k['z'])), ch((k['x'], max(r['y_mui'], k['yTren']) + 6, k['z']))
    s_ = max(50, int(abs(p0[1] - p1[1]) * 0.75)); cx, cy = int(p0[0]), int((p0[1] + p1[1]) / 2)
    o = cv2.resize(v[max(0, cy - s_):cy + s_, max(0, cx - s_):cx + s_], (300, 300))
    cv2.putText(o, f"{str(tep).split('/')[-1][:26]} {r['y_dinh']} r{r['r_chan']}", (3, 14), 0, 0.4, (0, 0, 255), 1); return o


def cum(xs, sai=1.0):  # trung vị cụm đông nhất (giá trị có nhiều giá trị khác trong ±sai nhất): ảnh mây trắng / tháp khác lẫn vào không kéo lệch
    if not xs: return None
    x = np.asarray(xs, float); dem = [(np.abs(x - v) <= sai).sum() for v in x]; tam = x[int(np.argmax(dem))]
    return float(np.median(x[np.abs(x - tam) <= sai]))


def do_het(khoi, tat_ca, anh_ds, in_ra=True, anh_ra=None):
    # Hai lượt: lượt 1 khối che mái chóp cao tới đỉnh OSM + CHOP_DU (chưa biết thật); lượt 2 khối che đã đo dùng đúng đầu mũi đo được — tháp góc 712 đo 63,1 m
    # thì không còn "che" chóp 028 chân 64,3 m như lượt 1 tưởng (712 cao tới 71,6).
    for o in tat_ca:
        if o.get('yTren') is not None: o['dinh'] = o['yTren'] + (CHOP_DU if o.get('mai') in ('cone', 'pyramidal') else 0)
    kq = do_luot(khoi, tat_ca, anh_ds, False, None)
    for o in tat_ca:
        r = kq.get(o['id'])
        if r and r['y_mui'] is not None: o['dinh'] = r['y_mui']
    return do_luot(khoi, tat_ca, anh_ds, in_ra, anh_ra)


def do_luot(khoi, tat_ca, anh_ds, in_ra, anh_ra, cache={}):
    kq = {}
    for k in khoi:
        khac = [o for o in tat_ca if o['id'] != k['id']]
        ds, o_kiem = [], []
        for tep, a in anh_ds:
            if tep not in cache:
                im = cv2.imread(str(DL / tep)) if isinstance(tep, str) else tep
                cache[tep] = (im, mat_troi(im) if im is not None else None)
            im, mt = cache[tep]
            if im is None: continue
            r, ly = do_mot(k, khac, a, im, mt)
            if in_ra: print(f"    {str(tep).split('/')[-1][:48]:48s} {ly:28s} {r if r else ''}")
            if r and ly in ('ok', 'ít hàng đo bề ngang', 'bề ngang vô lý (dính khối khác)'):
                ds.append((tep, r))
                if anh_ra is not None: o_kiem.append(ve_kiem(k, tep, a, im, mt, r))
        mui = cum([r['y_mui'] for _, r in ds]); tach = [r for _, r in ds if r['tach_mui'] and mui is not None and abs(r['y_mui'] - mui) <= 1.0]
        # ĐỦ CĂN CỨ = ≥ 3 ảnh tách mũi cùng ra một đỉnh nón (±1 m) và chiếm ≥ 2/3 số ảnh tách: camera lệch vài chục điểm ảnh có thể đặt trục đúng lên chóp
        # bên cạnh (nón Treppenturm 1573767747: 2 ảnh sân trên trúng tháp con 93 m, ảnh phía bắc thấy nón thật 95,6 m r 4,6) — trùng ngẫu nhiên hiếm khi đủ 3.
        non0 = cum([r['y_dinh'] for r in tach]); hop = [r for r in tach if non0 is not None and abs(r['y_dinh'] - non0) <= 1.0]
        tin = len(hop) >= 3 and len(hop) * 3 >= len(tach) * 2
        non = cum([r['y_dinh'] for r in hop]) if tin else None; rr = cum([r['r_chan'] for r in hop], 0.4) if tin else None
        du = len(ds) >= 2
        kq[k['id']] = {'y_mui': round(mui, 2) if du else None, 'y_dinh': round(non, 2) if non is not None else None, 'r_chan': round(rr, 2) if rr is not None else None,
                       'so_anh': len(ds), 'so_anh_tach': len(tach), 'chi_tiet': [[str(t).split('/')[-1], r['y_mui'], r['y_dinh'], r['r_chan']] for t, r in ds]}
        if anh_ra is not None and o_kiem:
            while len(o_kiem) % 4: o_kiem.append(np.zeros((300, 300, 3), np.uint8))
            anh_ra.mkdir(parents=True, exist_ok=True); cv2.imwrite(str(anh_ra / f"{k['id'].replace('/', '-')}.jpg"), np.vstack([np.hstack(o_kiem[i:i + 4]) for i in range(0, len(o_kiem), 4)]))
        if in_ra: print(f"  {k['id']}: mô hình đỉnh {k['yTren']:.2f} r {k['r']:.2f} → mũi {kq[k['id']]['y_mui']} · đỉnh nón {kq[k['id']]['y_dinh']} · r chân {kq[k['id']]['r_chan']} ({len(ds)} ảnh, {len(tach)} tách mũi)")
    return kq


def tu_kiem():
    # ảnh trời giả 1200×900, camera nhìn ngang về −Z; vẽ chóp đen mảnh: chân y 60 r 1,2 · đỉnh 80 tại (0, ·, −100); khối mô hình nói đỉnh 70 r 2,8
    W, H = 1200, 900; im = np.full((H, W, 3), (235, 200, 160), np.uint8); im[int(H * 0.85):] = (60, 90, 60)
    a = {'x': 0.0, 'z': 0.0, 'camera': {'y': 60.0, 'yaw': 0.0, 'pitch': 0.25, 'roll': 0.0, 'fov': 40.0}}
    chieu, f = may(a, W, H)
    poly = [chieu((x, y, -100))[:2] for x, y in ((-1.2, 60), (1.2, 60), (0, 80))]
    than = [chieu((x, y, -100))[:2] for x, y in ((-2.8, 40), (2.8, 40), (2.8, 60), (-2.8, 60))]
    cv2.fillPoly(im, [np.int32(than)], (180, 180, 170)); cv2.fillPoly(im, [np.int32(poly)], (40, 50, 45))
    m0, m1 = chieu((0, 80, -100)), chieu((0, 82, -100)); cv2.line(im, (int(m0[0]), int(m0[1])), (int(m1[0]), int(m1[1])), (40, 50, 45), 3)  # thánh giá cao 2 m
    k = {'id': 'thu', 'x': 0.0, 'z': -100.0, 'y1': 60.0, 'yTren': 70.0, 'r': 2.8}
    r, ly = do_mot(k, [], a, im, mat_troi(im))
    ok = ly == 'ok' and abs(r['y_dinh'] - 80) < 0.8 and abs(r['y_mui'] - 82) < 0.5 and abs(r['r_chan'] - 1.2) < 0.35
    # phá: chóp bè (r 2,8, đỉnh 70) phải đo ra khác
    im2 = np.full((H, W, 3), (235, 200, 160), np.uint8); im2[int(H * 0.85):] = (60, 90, 60)
    cv2.fillPoly(im2, [np.int32(than)], (180, 180, 170)); cv2.fillPoly(im2, [np.int32([chieu((x, y, -100))[:2] for x, y in ((-2.8, 60), (2.8, 60), (0, 70))])], (40, 50, 45))
    r2, ly2 = do_mot(k, [], a, im2, mat_troi(im2))
    ok2 = ly2 == 'ok' and abs(r2['y_dinh'] - 70) < 0.8 and abs(r2['y_mui'] - 70) < 0.5 and abs(r2['r_chan'] - 2.8) < 0.5
    # khối bao quanh (mái hai dốc nóc 75 chạy dọc hướng nhìn, bao cả chóp) che chóp thấp hơn nóc → ảnh không được dùng; nóc 65 thấp hơn chân chóp → không che
    bao = lambda nóc: {'id': 'bao', 'x': 0.0, 'z': -100.0, 'yTren': nóc, 'y1': 50.0, 'yDuoi': 0.0, 'mai': 'gabled', 'v': [(-4, -85), (4, -85), (4, -115), (-4, -115)]}
    r3, ly3 = do_mot(k, [bao(75.0)], a, im2, mat_troi(im2)); r4, ly4 = do_mot(k, [bao(65.0)], a, im2, mat_troi(im2))
    ok3 = ly3.startswith('đỉnh bị che') and ly4 == 'ok'
    print('  chóp mảnh + thánh giá:', ly, r, '· chóp bè:', ly2, r2, '· bị mái bao che:', ly3, '· mái bao thấp:', ly4)
    print('tự kiểm:', 'ĐẠT' if ok and ok2 and ok3 else 'HỎNG'); return 0 if ok and ok2 and ok3 else 1


def main():
    if '--tu-kiem' in sys.argv: sys.exit(tu_kiem())
    vao = json.loads(sys.stdin.read())  # { khoi: [...nón cần đo], tat_ca: [...mọi khối {id,x,z,yTren}] }
    S = json.loads((DL / f'{LAU}-do-anh.json').read_text())['anh']
    ds = [(t, a) for t, a in S.items() if a.get('camera') and (DL / t).exists()]
    print(f"{len(vao['khoi'])} khối nón / chóp · {len(ds)} ảnh có camera")
    kq = do_het(vao['khoi'], vao['tat_ca'], ds, anh_ra=Path(sys.argv[sys.argv.index('--anh-ra') + 1]) if '--anh-ra' in sys.argv else None)
    if '--ghi' in sys.argv:
        tep = DL / f'{LAU}-non-tia.json'; cu = json.loads(tep.read_text()) if tep.exists() else {'khoi': {}}
        for i, r in kq.items():
            k = next(x for x in vao['khoi'] if x['id'] == i)
            if r.get('y_dinh') is None or r.get('r_chan') is None: cu['khoi'].pop(i, None); continue  # chưa tách được mũi / nón ở ≥ 2 ảnh → không đủ căn cứ
            cu['khoi'][i] = {'y_dinh': r['y_dinh'], 'y_mui': r['y_mui'], 'r_chan': r['r_chan'], 'y1': round(k['y1'], 2), 'so_anh': r['so_anh'], 'so_anh_tach': r['so_anh_tach'],
                             'ly_do': f"đầu mũi + đỉnh nón + bán kính chân đo bằng tia ảnh định vị (non-theo-tia.py), {r['so_anh_tach']}/{r['so_anh']} ảnh tách mũi"}
        cu['luat'] = ('ns.js chỉ áp khi đỉnh nón đo lệch mô hình > 1,5 m hoặc bán kính chân < 80% mặt bằng: nón chân r_chan tới đỉnh y_dinh; y_mui > y_dinh + 0,4 m thì thêm cột mũi '
                      '(thánh giá / chong chóng / quả cầu) tới y_mui. ?non_tia=0 tắt.')
        tep.write_text(json.dumps(cu, ensure_ascii=False, indent=1) + '\n'); print('đã ghi', tep)


main()
