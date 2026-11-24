#!/usr/bin/env python3
"""KHỐI NHÀ THIẾU THEO DOM20 (không AI, 22/11/2026): chỗ ngoài đời có nhà mà mô hình KHÔNG có khối nào.
Lý do: ban-do-lech.py / so-dom20.py chỉ so ở ô mô hình có điểm → nhà OSM chưa vẽ (hoặc vẽ hụt mép vài mét) không bao giờ hiện trong bảng lệch;
ảnh 13 (Ritterhaus tây) lộ ra: khối thấp 11–17 m ở x −46..−40 thiếu hẳn, mặt tây thật ở x ≈ −39 mà mô hình dừng ở −36 → đất DGM dốc lên thành gò cỏ.
Máy: lưới 0,5 m; ô là "nhà thiếu" khi DOM20 − DGM1 > CAO (mặc định 4 m) · không xanh (DOP20, chỉ số xanh chuẩn hoá ≤ 0,09 — loại cây) ·
cách mọi mặt bằng khối của trang (window.__ns.dsKhoi, đúng vị trí đang dựng, đã dời) ≥ 0,5 m. Gom ô liền nhau, vùng ≥ DT m² (mặc định 8) →
mặt bằng = hình chữ nhật theo trục chính (PCA, mép p1..p99 + 0,25 m), bỏ vùng lấp < 60 % (hình chữ L, chưa tách được — in ra để xem);
đỉnh = p95 DOM, mái = p95 − p5 (≤ 1,5 m → mái bằng), thẻ vật liệu lấy theo khối gần nhất. Mốc cảnh ↔ DHHN tự đo: trung vị DGM1 − (matDat + GOC_Y) ở ô trống.
Ghi khoá "them/thieu-<x>_<z>" vào public/du-lieu/<lâu>-sua.json (chen-json.mjs); --xem chỉ in + vẽ --anh.
  ~/.venvs/castle-khop/bin/python -I apps/castle/scripts/khoi-thieu-dom20.py [--hop x0 z0 x1 z1] [--cao 4] [--dt 8] [--xem] [--anh ra.png]
tra-repo-ok: phân loại raster + gom vùng bằng numpy trên dữ liệu riêng của cảnh, cùng phép đổi toạ độ với be-mat-dop20.py."""
import json, math, sys, pathlib, subprocess, tempfile, numpy as np, tifffile
from matplotlib.path import Path as P
G = pathlib.Path(__file__).resolve().parent.parent; BY = G / 'du-lieu-goc/bayern'
arg = sys.argv[1:]
def so(ten, md): return float(arg[arg.index(ten) + 1]) if ten in arg else md
HOP = [float(v) for v in arg[arg.index('--hop') + 1:arg.index('--hop') + 5]] if '--hop' in arg else [-140, -120, 100, 100]
CAO, DT, B = so('--cao', 4), so('--dt', 8), 0.5
dop = tifffile.imread(BY / 'dop20-32631_5268.tif'); dom = tifffile.imread(BY / 'dom20-32631_5268.tif'); dgm = tifffile.imread(BY / 'dgm1-631_5268.tif')
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from toa_do_bayern import EN, canh, E0, N0, C as c, S as s   # độ dời OSM → DOM20 đọc từ so-dom20.json

# mặt bằng khối + mặt đất ĐÚNG như trang đang dựng
xs = np.arange(HOP[0] + B / 2, HOP[2], B); zs = np.arange(HOP[1] + B / 2, HOP[3], B)
with tempfile.TemporaryDirectory() as td:
    ra = pathlib.Path(td) / 'trang.json'
    subprocess.run(['node', '--input-type=module', '-e', f'''import {{ moTrang }} from '{G}/scripts/chung.mjs'; import {{ writeFileSync }} from 'node:fs';
const {{ pg, dong }} = await moTrang({{ anh3d: false }});
const r = await pg.evaluate((H) => {{ const n = window.__ns, d = [];
  for (let z = H[1] + 1; z < H[3]; z += 2) for (let x = H[0] + 1; x < H[2]; x += 2) d.push([x, z, n.matDat(x, z) + n.GOC_Y]);
  return {{ goc: n.GOC_Y, dat: d, khoi: n.dsKhoi.map((k) => ({{ id: k.id, v: k.ngoai?.[0] || k.v, t: k.tags }})).filter((k) => k.v?.length > 2) }}; }}, {json.dumps(HOP)});
writeFileSync('{ra}', JSON.stringify(r)); await dong();'''], check=True)
    T = json.load(open(ra))
# khối máy này đã dựng ở lượt trước (them/lod2-*, them/thieu-*) là KẾT QUẢ, không phải nhà có sẵn: tính vào KH thì đo lại không bao giờ thấy vùng đó nữa
# → khối dựng sai (vd độ dời cũ) không sửa được. Bỏ ra để mỗi lượt đo lại từ đầu; lượt ghi thay số của chúng, vùng nào nay không còn thì in ra.
CU = [k['id'] for k in T['khoi'] if k['id'].startswith(('them/lod2-', 'them/thieu-'))]
GOC_Y = T['goc']; KH = [(k, P(np.array(k['v'], float))) for k in T['khoi'] if k['id'] not in CU]
def dgmAt(x, z): E, N = EN(x, z); return float(dgm[int(5269000 - N), int(E - 631000)])
def gan(x, z):  # khoảng tới khối gần nhất (âm = trong) + khối đó
    best = (1e9, None)
    for k, p in KH:
        v = p.vertices; a, b = v[:-1] if np.allclose(v[0], v[-1]) else v, None
        q = np.vstack([a, a[:1]]); d = q[1:] - q[:-1]; w = np.array([x, z]) - q[:-1]
        t = np.clip((w * d).sum(1) / np.maximum((d * d).sum(1), 1e-9), 0, 1); m = float(np.min(np.linalg.norm(w - d * t[:, None], axis=1)))
        if p.contains_point((x, z)): m = -m
        if m < best[0]: best = (m, k)
    return best
# mốc cảnh ↔ DHHN: ô trống (không trong khối, cách ≥ 3 m) có DOM ≈ DGM (đất trần)
mm = []
for x, z, y in T['dat']:
    if any(p.contains_point((x, z), radius=-6) or p.contains_point((x, z)) for _, p in KH): continue
    E, N = EN(x, z); a, b = int((5269000 - N) / 0.2), int((E - 631000) / 0.2)
    if abs(float(dom[a, b]) - dgmAt(x, z)) < 0.3: mm.append(dgmAt(x, z) - y)
MOC = float(np.median(mm)); print(f'mốc cảnh ↔ DHHN (trung vị {len(mm)} ô đất trần): {MOC:+.2f} m · GOC_Y {GOC_Y}')

# ô nhà thiếu. NGUỒN mặc định = mặt bằng LoD2 chính thức (GroundSurface lod2-lau-dai.json, dời sang cảnh − DOI_LOD2): ô trong LoD2 mà ngoài mọi khối;
# --nguon dom = cách cũ (DOM − DGM > CAO, không xanh, cách khối ≥ 1 m) cho nhà ngoài phạm vi LoD2 đã tách. Dải hẹp (LoD2 lệch mô hình < ~1 m dọc tường) bị loại bằng phép mở hình thái.
NGUON = arg[arg.index('--nguon') + 1] if '--nguon' in arg else 'lod2'; DOI_LOD2 = (6.25, 1.0)
W, H = len(xs), len(zs); M = np.zeros((H, W), bool); DOMc = np.zeros((H, W))
X_, Z_ = np.meshgrid(xs, zs); PTS = np.c_[X_.ravel(), Z_.ravel()]
for j, z in enumerate(zs):
    for i, x in enumerate(xs):
        E, N = EN(x, z); a, b = int((5269000 - N) / 0.2), int((E - 631000) / 0.2); DOMc[j, i] = float(np.median(dom[a - 1:a + 2, b - 1:b + 2]))
if NGUON == 'lod2':
    L2 = json.load(open(BY / 'lod2-lau-dai.json')); inL = np.zeros(len(PTS), bool); inK = np.zeros(len(PTS), bool)
    TOA = arg[arg.index('--toa') + 1] if '--toa' in arg else 'Schloss Neuschwanstein'  # chỉ toà này: nhà khác trong ô LoD2 lệch vị trí so OSM, cộng vào = nhà đôi
    for b_ in L2:
        if TOA == 'tat-ca' or b_['ten'] == TOA: inL |= P(np.array(b_['day']) - DOI_LOD2).contains_points(PTS)
    for _, p in KH: inK |= p.contains_points(PTS)
    M = (inL & ~inK).reshape(H, W)
    import cv2
    k_ = np.ones((5, 5), np.uint8)  # 5 ô × 0,5 m: vùng hẹp hơn ~2,5 m (dải lệch dọc tường) không phải khối thiếu
    M = cv2.morphologyEx(M.astype(np.uint8), cv2.MORPH_OPEN, k_).astype(bool)
    M &= (DOMc - np.array([[dgmAt(x, z) for x in xs] for z in zs])) > 2  # LoD2 có mà DOM sát đất = đã phá / sân
else:
    for j, z in enumerate(zs):
        for i, x in enumerate(xs):
            E, N = EN(x, z); a, b = int((5269000 - N) / 0.2), int((E - 631000) / 0.2)
            if DOMc[j, i] - dgmAt(x, z) <= CAO: continue
            r_, g_, b_ = np.median(dop[a - 1:a + 2, b - 1:b + 2, :3].reshape(-1, 3).astype(float), axis=0)
            if (2 * g_ - r_ - b_) / max(r_ + g_ + b_, 1) > 0.09: continue
            M[j, i] = True
    # bỏ ô trong / sát khối
    for j, i in np.argwhere(M):
        x, z = xs[i], zs[j]
        if any(p.contains_point((x, z), radius=1.0) or p.contains_point((x, z), radius=-1.0) or p.contains_point((x, z)) for _, p in KH): M[j, i] = False
BAC = 2.0  # m: hai ô kề nhau chênh DOM hơn số này = hai khối khác nhau (mảnh LoD2 ở mép tây Ritterhaus: cánh thấp 964–968 m + mép mái 980 m của khối kề;
           # gom chung rồi lấy p75 ra một khối 20 m chỗ thật chỉ có tường 5–10 m) → tách vùng theo bậc độ cao, mỗi bậc một khối
def gom(m):
    nh = np.zeros(m.shape, int); sl = 0
    for i0, j0 in np.argwhere(m):
        if nh[i0, j0]: continue
        sl += 1; nh[i0, j0] = sl; ds = [(i0, j0)]
        while ds:
            i, j = ds.pop()
            for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if 0 <= a < m.shape[0] and 0 <= b < m.shape[1] and m[a, b] and not nh[a, b] and abs(DOMc[a, b] - DOMc[i, j]) < BAC: nh[a, b] = sl; ds.append((a, b))
    return nh, sl
nh, sl = gom(M); RA, bo = {}, []
for q in range(1, sl + 1):
    o = np.argwhere(nh == q)
    if len(o) * B * B < DT: continue
    pts = np.c_[xs[o[:, 1]], zs[o[:, 0]]]; tam = pts.mean(0); u = np.linalg.eigh(np.cov((pts - tam).T))[1][:, 1]; w = np.array([-u[1], u[0]])
    tu, tw = (pts - tam) @ u, (pts - tam) @ w
    lu = np.percentile(tu, [1, 99]) + [-0.25 - B / 2, 0.25 + B / 2]; lw = np.percentile(tw, [1, 99]) + [-0.25 - B / 2, 0.25 + B / 2]
    lap = len(o) * B * B / ((lu[1] - lu[0]) * (lw[1] - lw[0]))
    h = np.array([DOMc[j, i] for j, i in o]); p95, p5 = np.percentile(h, 95), np.percentile(h, 5)
    ten = f'them/{"lod2" if NGUON == "lod2" else "thieu"}-{round(tam[0])}_{round(tam[1])}'
    cu = [k['id'] for k in T['khoi'] if k['id'] in CU and P(np.array(k['v'], float)).contains_point(tuple(tam))]
    if cu: ten = cu[0]  # vùng nằm trong khối lượt trước → giữ khoá cũ, ghi đè số (không đẻ khối đôi)
    if NGUON == 'lod2':  # đường viền thật của vùng (cạnh ô lưới), rút gọn 0,4 m — hình chữ L giữ nguyên
        import cv2
        mk = (nh == q).astype(np.uint8); cs_, _ = cv2.findContours(mk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); cc = max(cs_, key=cv2.contourArea)
        cc = cv2.approxPolyDP(cc, 0.8, True)[:, 0, :].astype(float)
        goc = [np.array([HOP[0] + (i_ + 0.5) * B, HOP[1] + (j_ + 0.5) * B]) for i_, j_ in cc]
        tg = np.mean(goc, 0); goc = [g_ + (g_ - tg) / max(np.linalg.norm(g_ - tg), 1e-6) * B / 2 for g_ in goc]  # nở nửa ô ra mép ô
        o = np.array([(j_, i_) for j_, i_ in o if cv2.erode(mk, np.ones((3, 3), np.uint8))[j_, i_]]) if (cv2.erode(mk, np.ones((3, 3), np.uint8))).sum() >= 8 else o  # đo độ cao lùi 0,5 m khỏi mép (tường láng giềng)
        h = np.array([DOMc[j, i] for j, i in o]); p95, p5 = np.percentile(h, 95), np.percentile(h, 5); pts = np.c_[xs[o[:, 1]], zs[o[:, 0]]]
        tu, tw = (pts - tam) @ u, (pts - tam) @ w; lap = 1.0
    elif lap < 0.6: bo.append(f'{ten}: {len(o) * B * B:.0f} m² lấp {lap:.0%} < 60 % (hình chữ L / rời) — chưa dựng'); continue
    else: goc = [tam + u * a_ + w * b_ for a_, b_ in ((lu[0], lw[0]), (lu[1], lw[0]), (lu[1], lw[1]), (lu[0], lw[1]))]
    dk, kg = gan(*tam); t = {a_: b_ for a_, b_ in (kg or {}).get('t', {}).items() if a_ in ('building:colour', 'building:material', 'roof:colour')}
    mai = round(float(p95 - p5), 1); y = round(float(p95 - MOC - GOC_Y), 2)
    if NGUON == 'lod2':  # mảnh LoD2 ngoài khối = phần mái / tường mà khối OSM bên cạnh vẽ hụt: hẹp, dốc mái thuộc khối kề → khối mái bằng ở p75 (không dựng một mái dốc 15 m trên mảnh 5 m)
        y = round(float(np.percentile(h, 75) - MOC - GOC_Y), 2); mai = 0.0
    e = {'building': 'yes', **t, 'roof:shape': 'flat' if mai <= 1.5 else 'gabled', 'ngoai': [[round(float(a_), 2), round(float(b_), 2)] for a_, b_ in goc], 'y_tren': y}
    if mai > 1.5:
        e['roof:height'] = mai; du_ = abs(np.corrcoef(abs(tu - np.median(tu)), h)[0, 1]); dw = abs(np.corrcoef(abs(tw - np.median(tw)), h)[0, 1])
        e['roof:orientation'] = 'along' if dw > du_ else 'across'
    e['ly_do'] = (f'máy đo {__import__("datetime").date.today()} (scripts/khoi-thieu-dom20.py, không AI): ' + (f'mặt bằng LoD2 chính thức Bavaria (GroundSurface, dời {DOI_LOD2}) có {(nh == q).sum() * B * B:.0f} m² ngoài mọi khối mô hình '
                  f'(bỏ dải hẹp < 2,5 m); mặt bằng = đường viền vùng đó; ' if NGUON == 'lod2' else f'DOM20 − DGM1 chính thức Bavaria > {CAO:g} m trên {len(o) * B * B:.0f} m² không xanh (DOP20) '
                  f'ngoài mọi khối mô hình → nhà có thật mà OSM không vẽ; mặt bằng = chữ nhật trục chính (lấp {lap:.0%}); ') + f'đỉnh = p95 DOM20, mái = p95 − p5 = {mai} m, '
                  f'mốc cảnh {MOC:+.2f} m; vật liệu theo khối gần nhất {kg["id"] if kg else "-"} ({dk:.1f} m)')
    RA[ten] = e
    print(f'{ten}: {len(o) * B * B:.0f} m² · {lu[1] - lu[0]:.1f} × {lw[1] - lw[0]:.1f} m · lấp {lap:.0%} · đỉnh y {y} (cao trên đất {p95 - np.median([dgmAt(*p_) for p_ in pts]):.1f} m) · mái {mai} · gần {kg["id"] if kg else "-"} {dk:.1f} m')
for b_ in bo: print('  bỏ ' + b_)
for k in CU:
    if k not in RA: print(f'  ⚠ {k}: lượt trước đã dựng, lượt này không còn vùng thiếu — khối cũ sai, cần gỡ khỏi neuschwanstein-sua.json')
if '--anh' in arg:
    from PIL import Image, ImageDraw
    p = 4; im = np.full((H, W, 3), 245, 'uint8'); im[M] = (220, 40, 40)
    I = Image.fromarray(im).resize((W * p, H * p), Image.NEAREST); v = ImageDraw.Draw(I)
    for _, pp in KH: v.line([((a_ - HOP[0]) / B * p, (b_ - HOP[1]) / B * p) for a_, b_ in pp.vertices], fill=(40, 40, 40), width=1)
    for e in RA.values(): v.polygon([((a_ - HOP[0]) / B * p, (b_ - HOP[1]) / B * p) for a_, b_ in e['ngoai']], outline=(0, 90, 220), width=2)
    I.save(arg[arg.index('--anh') + 1]); print('ảnh:', arg[arg.index('--anh') + 1])
if '--xem' not in arg and RA:
    subprocess.run(['node', '--input-type=module', '-e', f'''import {{readFileSync, writeFileSync}} from 'node:fs'; import {{chenTruong}} from '{G}/scripts/chen-json.mjs';
const f = '{G}/public/du-lieu/neuschwanstein-sua.json', R = JSON.parse(readFileSync(0, 'utf8')); let t = readFileSync(f, 'utf8');
for (const [k, v] of Object.entries(R)) t = chenTruong(t, k, v); JSON.parse(t); writeFileSync(f, t); console.log('đã ghi', Object.keys(R).length, 'khoá');'''], input=json.dumps(RA), text=True, check=True)
