#!/usr/bin/env python3
"""ĐỊNH VỊ ẢNH CHỤP KHÔNG CÓ GPS vào cảnh (20/11/2026): ghép điểm đặc trưng ảnh thật ↔ kho góc nhìn ảnh 3D Google có độ sâu (scripts/kho-goc-nhin.mjs)
bằng ALIKED + LightGlue (cvg/LightGlue, Apache-2.0; ALIKED BSD-3 — chạy tại máy, không gọi API), mỗi cặp điểm khớp cho một điểm 3D → giải camera bằng PnP + RANSAC
(OpenCV), dò luôn tiêu cự. Ra: chỗ đứng (x, y, z cảnh), yaw / pitch / roll kiểu three.js 'YXZ', góc nhìn dọc, số điểm khớp đúng, sai số chiếu lại.

  ~/.venvs/castle-khop/bin/python apps/castle/scripts/khop-lg.py <thư mục kho> <thư mục ảnh> [--ra kq.json] [--chi tệp.jpg,…]
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/khop-lg.py <thư mục kho> --tu-kiem     lấy 6 góc nhìn của chính kho làm "ảnh chụp" (bỏ góc đó khỏi kho khi ghép):
      camera giải ra phải trùng camera thật của góc (≤ 1,5 m, ≤ 3°) — bài kiểm có thể hỏng của cả chuỗi ghép + độ sâu + PnP + đổi hệ trục
Chạy bằng venv /Users/htuan/.venvs/castle-khop (torch + lightglue + opencv).
tra-repo-ok: dùng thư viện có sẵn (LightGlue + OpenCV solvePnPRansac); tệp này chỉ là keo nối kho góc nhìn của cảnh với hai thư viện đó.
"""
import json, sys, time, pathlib, math
import numpy as np, cv2, torch
from lightglue import LightGlue, ALIKED
from lightglue.utils import rbd

TU_KIEM = '--tu-kiem' in sys.argv
KHO = pathlib.Path(sys.argv[1]); ANH = KHO if TU_KIEM else pathlib.Path(sys.argv[2])
RA = pathlib.Path(sys.argv[sys.argv.index('--ra') + 1]) if '--ra' in sys.argv else ANH / 'khop.json'
CHI = set(sys.argv[sys.argv.index('--chi') + 1].split(',')) if '--chi' in sys.argv else None
# --truoc <tệp.json>: { tệp ảnh: [x, z, hướng la bàn °] } — chỗ đứng + hướng BIẾT TRƯỚC (Mapillary: GPS + la bàn). Chỉ ghép các góc nhìn của kho cách chỗ đó ≤ 30 m và
# quay cùng phía (≤ 80°); kết quả thêm lech_gps = khoảng cách chỗ đứng giải ra ↔ GPS (20/11/2026: thử thay bài "tách đôi" bằng GPS cho ảnh Mapillary)
TRUOC = json.load(open(sys.argv[sys.argv.index('--truoc') + 1])) if '--truoc' in sys.argv else {}
may = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
rut = ALIKED(max_num_keypoints=2048).eval().to(may); ghep = LightGlue(features='aliked').eval().to(may)

def doc(tep, canh=1024):
    im = cv2.imread(str(tep)); h, w = im.shape[:2]; s = canh / max(h, w)
    if s < 1: im = cv2.resize(im, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    t = torch.from_numpy(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)).permute(2, 0, 1).float().div(255).to(may)
    return im, t

@torch.no_grad()
def dac(t): return rut.extract(t, resize=None)

# KHO: đặc trưng + độ sâu từng góc nhìn (nhớ đệm đặc trưng cạnh kho)
kho = json.load(open(KHO / 'kho.json')); t0 = time.time(); dem = KHO / 'dac-aliked.pt'
nho = torch.load(dem) if dem.exists() else {}
for g in kho:
    if g['ten'] not in nho:
        _, t = doc(KHO / (g['ten'] + '.jpg')); f = dac(t); nho[g['ten']] = {k: v.cpu() for k, v in f.items()}
    s = cv2.imread(str(KHO / (g["ten"] + "-sau.png"))).astype(np.float32)   # BGR
    g['sau'] = (s[..., 2] * 65536 + s[..., 1] * 256 + s[..., 0]) / 16777215 * g['xa']
    g['M'] = np.array(g['m']).reshape(4, 4).T
if not dem.exists(): torch.save(nho, dem)
print(f'kho {len(kho)} góc nhìn · nạp {time.time() - t0:.0f} giây · máy {may}', flush=True)

def diem3d(g, uv):
    """điểm ảnh góc nhìn → toạ độ cảnh; bỏ điểm trời / quá xa / mép vật (độ sâu quanh điểm chênh > 6 %)"""
    W, H = g['w'], g['h']; f = (H / 2) / math.tan(math.radians(g['fov']) / 2); ra, giu = [], []
    for k, (u, v) in enumerate(uv):
        x, y = int(round(u)), int(round(v))
        if not (2 <= x < W - 2 and 2 <= y < H - 2): continue
        o = g['sau'][y - 2:y + 3, x - 2:x + 3]; d = g['sau'][y, x]
        if d <= 0.5 or d >= g['xa'] * 0.98 or (o.max() - o.min()) > 0.06 * d: continue
        p = np.array([(u - W / 2) / f * d, -(v - H / 2) / f * d, -d, 1.0]); ra.append((g['M'] @ p)[:3]); giu.append(k)
    return np.array(ra), giu

def giai(p2, p3, w, h):
    tot = None
    for fov in np.arange(24, 100, 4):
        f = (h / 2) / math.tan(math.radians(fov) / 2); K = np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]])
        try: ok, r, t, inl = cv2.solvePnPRansac(p3, p2, K, None, iterationsCount=1500, reprojectionError=5.0, confidence=0.999, flags=cv2.SOLVEPNP_SQPNP)
        except cv2.error: continue   # bộ điểm suy biến (SQPNP báo lỗi) ở tiêu cự này → thử tiêu cự kế
        if ok and inl is not None and (tot is None or len(inl) > len(tot[3])): tot = (fov, r, t, inl[:, 0])
    if tot is None or len(tot[3]) < 8: return None
    fov0, r, t, inl = tot; a3, a2 = p3[inl], p2[inl]; tot2 = None
    for fov in np.arange(max(15, fov0 - 6), fov0 + 6.1, 0.5):   # dò mịn tiêu cự trên tập điểm khớp đúng
        f = (h / 2) / math.tan(math.radians(fov) / 2); K = np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]])
        ok, r2, t2 = cv2.solvePnP(a3, a2, K, None, r.copy(), t.copy(), True, cv2.SOLVEPNP_ITERATIVE)
        if not ok: continue
        e = np.linalg.norm(cv2.projectPoints(a3, r2, t2, K, None)[0][:, 0] - a2, axis=1)
        if tot2 is None or np.median(e) < tot2[0]: tot2 = (float(np.median(e)), fov, r2, t2)
    e, fov, r, t = tot2; R = cv2.Rodrigues(r)[0]; C = (-R.T @ t)[:, 0]
    Rw = R.T @ np.diag([1.0, -1, -1])   # camera three.js: x phải, y lên, nhìn −z
    return {'x': C[0], 'y': C[1], 'z': C[2], 'pitch': math.asin(-max(-1, min(1, Rw[1, 2]))), 'yaw': math.atan2(Rw[0, 2], Rw[2, 2]), 'roll': math.atan2(Rw[1, 0], Rw[1, 1]),
            'fov': float(fov), 'dung': int(len(inl)), 'lech_px': e}

kq = {}; hong = 0; tk = []   # tk: kết quả tự kiểm từng góc, --ra <tệp> thì ghi ra để do-anh.mjs chấm bằng ĐÚNG cổng anhDat của đường đo thật
DS = [KHO / (g['ten'] + '.jpg') for g in kho[len(kho) // 12::len(kho) // 6][:6]] if TU_KIEM else [ANH / t for t in sorted(CHI)] if CHI else sorted(ANH.glob('*.jpg'))
for tep in DS:
    if not tep.exists(): print('không có', tep); continue
    if cv2.imread(str(tep)) is None: kq[str(tep.relative_to(ANH))] = {'hong': 'tệp ảnh không đọc được'}; print(tep.name, 'không đọc được — bỏ', flush=True); continue   # tệp tải hỏng / không phải JPEG (lô 73 ảnh 20/11/2026 chết giữa chừng vì một tệp)
    t1 = time.time(); im, t = doc(tep); h, w = im.shape[:2]; fa = dac(t); cap = []
    with torch.no_grad():
        def ghep1(g):
            fb = {k: v.to(may) for k, v in nho[g['ten']].items()}
            m = rbd(ghep({'image0': fa, 'image1': fb}))['matches'].cpu().numpy()
            if len(m) >= 12: cap.append((len(m), g, m))
        # HAI TẦNG (20/11/2026: kho 444 góc ghép hết = ~70 giây / ảnh): tầng thô ghép 1/3 số điểm đứng, tầng kỹ chỉ ghép các góc cách 5 góc tốt nhất ≤ 22 m
        ung = [g for g in kho if not (TU_KIEM and g['ten'][:4] == tep.stem[:4])]   # tự kiểm: bỏ mọi góc cùng điểm đứng với ảnh đang thử
        tr = TRUOC.get(tep.name)
        if tr:
            lech_goc = lambda g: abs((g['yaw'] + math.radians(tr[2]) + math.pi) % (2 * math.pi) - math.pi) if tr[2] is not None else 0   # yaw three.js = −hướng la bàn
            for g in ung:
                if math.hypot(g['p'][0] - tr[0], g['p'][2] - tr[1]) <= 30 and lech_goc(g) <= math.radians(80): ghep1(g)
        else:
            tho = [g for g in ung if int(g['ten'][1:4]) % 3 == 0]
            for g in tho: ghep1(g)
            tam = [c[1]['p'] for c in sorted(cap, key=lambda c: -c[0])[:5]]; da = {id(g) for g in tho}
            for g in ung:
                if id(g) not in da and any(math.hypot(g['p'][0] - t[0], g['p'][2] - t[2]) <= 22 for t in tam): ghep1(g)
    cap.sort(key=lambda c: -c[0]); ka = rbd(fa)['keypoints'].cpu().numpy(); p2, p3, goc = [], [], []
    for n, g, m in cap[:10]:
        kb = rbd(nho[g['ten']])['keypoints'].numpy()[m[:, 1]]; d3, giu = diem3d(g, kb)
        if len(giu): p2.append(ka[m[giu, 0]]); p3.append(d3); goc.append([g['ten'], int(n), len(giu)])
    r = None
    if p2 and sum(len(a) for a in p2) >= 12: r = giai(np.concatenate(p2).astype(np.float64), np.concatenate(p3).astype(np.float64), w, h)
    if r and len(p2) >= 2:
        # TÁCH ĐÔI (20/11/2026: ảnh Mapillary nhìn xa "đạt" 254 điểm · 2 px mà chỗ đứng lệch GPS 133 m — cảnh xa, phẳng, lời giải trượt dọc trục nhìn):
        # chia các góc nhìn thành hai nửa chẵn / lẻ, giải riêng từng nửa với cùng tiêu cự; hai chỗ đứng cách nhau = độ vững của lời giải
        f = (h / 2) / math.tan(math.radians(r['fov']) / 2); K = np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]]); tam2 = []
        for le in (0, 1):
            a2 = np.concatenate(p2[le::2]).astype(np.float64); a3 = np.concatenate(p3[le::2]).astype(np.float64)
            try: ok, rv, tv, inl = cv2.solvePnPRansac(a3, a2, K, None, iterationsCount=800, reprojectionError=5.0, flags=cv2.SOLVEPNP_SQPNP)
            except cv2.error: ok = False
            if ok and inl is not None and len(inl) >= 10: tam2.append((-cv2.Rodrigues(rv)[0].T @ tv)[:, 0])
        r['tach_m'] = float(np.linalg.norm(tam2[0] - tam2[1])) if len(tam2) == 2 else 999.0
    elif r: r['tach_m'] = 999.0
    if r and len(p2) >= 2:   # ĐỒNG THUẬN (23/11/2026): giải riêng từng góc nguồn (cùng tiêu cự) → bao nhiêu CHỖ ĐỨNG nguồn tự cho ra gần đúng chỗ lời giải chung (≤ 3 m).
        # Lời giải sai lọt cổng cũ (tự kiểm g044-5 lệch 18 m, g027-0 lệch 4,3 m: tách ≤ 3 m, lệch ≤ 3 px) chỉ được 1–2 chỗ đứng đồng ý; lời giải đúng 4–10. do-anh.mjs anhDat đòi ≥ min(3, số chỗ đứng giải được)
        f = (h / 2) / math.tan(math.radians(r['fov']) / 2); K = np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1.0]]); C0 = np.array([r['x'], r['y'], r['z']]); mg = []
        for a2, a3, gg in zip(p2, p3, goc):
            if len(a2) < 10: continue
            try: ok, rv, tv, inl = cv2.solvePnPRansac(a3.astype(np.float64), a2.astype(np.float64), K, None, iterationsCount=500, reprojectionError=5.0, flags=cv2.SOLVEPNP_SQPNP)
            except cv2.error: ok = False
            if ok and inl is not None and len(inl) >= 8: mg.append([gg[0], int(len(inl)), round(float(np.linalg.norm((-cv2.Rodrigues(rv)[0].T @ tv)[:, 0] - C0)), 2)])
        r['moi_goc'] = mg; r['dong_thuan'] = len({m[0][:4] for m in mg if m[2] <= 3}); r['cho_dung'] = len({m[0][:4] for m in mg})
    if r and TRUOC.get(tep.name): r['lech_gps'] = float(math.hypot(r['x'] - TRUOC[tep.name][0], r['z'] - TRUOC[tep.name][1]))
    kq[str(tep.relative_to(ANH))] = {'w': w, 'h': h, 'cap': sum(len(a) for a in p2) if p2 else 0, 'goc': goc[:4], 'giay': round(time.time() - t1, 1), **({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()} if r else {'hong': 'không đủ điểm khớp'})}
    if TU_KIEM:
        g = next(x for x in kho if x['ten'] == tep.stem); c = g['M'][:3, 3]
        if not r: tk.append({'ten': tep.stem, 'hong': True}); trong_ = globals().get('trong_', 0) + 1; globals()['trong_'] = trong_; hong += trong_ > 1; print(f'– {tep.stem}: không giải được camera (góc nhìn vào rừng / trời — cho phép MỘT góc)'); continue
        kc = float(np.linalg.norm(np.array([r['x'], r['y'], r['z']]) - c)); goc_ = math.degrees(abs((r['yaw'] - g['yaw'] + math.pi) % (2 * math.pi) - math.pi)) + math.degrees(abs(r['pitch'] - g['pitch']))
        dat = kc <= 1.5 and goc_ <= 3 and abs(r['fov'] - g['fov']) <= 4; hong += not dat; tk.append({**r, 'ten': tep.stem, 'dung_goc': bool(dat), 'kc': round(kc, 2)})
        if not dat: print('   giải', {k: round(r[k], 3) for k in ('yaw', 'pitch', 'roll', 'fov')}, 'thật', g['yaw'], g['pitch'])
        print(f"{'✓' if dat else '✗'} {tep.stem}: lệch chỗ đứng {kc:.2f} m · lệch hướng {goc_:.1f}° · góc nhìn {r['fov']:.1f}° (thật {g['fov']}°) · {r['dung']} điểm", flush=True); continue
    json.dump(kq, open(RA, 'w'), ensure_ascii=False, indent=1)   # ghi dần: lô dài hỏng giữa chừng không mất phần đã chạy
    print(tep.name[:44].ljust(44), json.dumps({k: v for k, v in kq[str(tep.relative_to(ANH))].items() if k not in ('goc', 'w', 'h')}), flush=True)
if TU_KIEM and '--ra' in sys.argv: json.dump(tk, open(RA, 'w'), ensure_ascii=False, default=float)   # chỉ khi gọi rõ --ra: mặc định RA = khop.json của kho, không được đè
if TU_KIEM: print('khop-lg tự kiểm:', 'ĐẠT' if not hong else f'HỎNG {hong} góc'); sys.exit(1 if hong else 0)
json.dump(kq, open(RA, 'w'), ensure_ascii=False, indent=1); print('ghi', RA)
