#!/usr/bin/env python3
"""NHÁP BỐ CỤC MẶT TIỀN BẰNG MÁY (23/11/2026) — máy dò ô cửa tối trên ảnh đã nắn, Claude chỉ soát MỘT ảnh phủ số thay vì đọc toạ độ bằng mắt qua hàng chục lưới.
Lý do: đo tay một mặt tốn 40–60 lần gọi (mỗi lần xem lại lưới / phóng to). Máy làm phần đếm + đo, người soát phần hiểu (ô nào là cửa thật, cụm nào gộp).
Cách dò: ô cửa = vùng TỐI hơn tường quanh nó (so với ảnh làm mờ cửa sổ lớn) → mở / đóng hình thái → thành phần liên thông → lọc cỡ + dáng đứng
→ gộp ô cùng hàng (đỉnh / bậu gần nhau, khe ngang hẹp) thành cụm. Ra:
  - nháp JSON dạng "cum" của <lâu>-mat-*.json (ten, o, dinhO, bau) — toạ độ điểm ảnh của ảnh nắn, như kiem-mat-tien.py đọc
  - một ảnh phủ ≤ 1600 px: khung xanh từng ô, khung vàng + số từng cụm
  ~/.venvs/castle-khop/bin/python -I apps/castle/scripts/nhap-mat-tien.py <ảnh nắn> [--vung x0,y0,x1,y1] [--ra nhap.json] [--phu phu.jpg] [--so mat.json] [--toi 0.72] [--o-min 8]
  --so <tệp bố cục đã đo>: so nháp với cụm đã đo (khớp theo tâm), in tỉ lệ trúng — dùng để kiểm chính máy dò.
tra-repo-ok: dò vùng tối bằng OpenCV (connectedComponents) + numpy; luật khớp ô giống kiem-mat-tien.py."""
import sys, json, cv2, numpy as np

a = sys.argv[1:]
def opt(k, d=None): return a[a.index(k) + 1] if k in a else d
anh = cv2.imread(a[0]); H, W = anh.shape[:2]
x0, y0, x1, y1 = map(int, opt('--vung', f'0,0,{W},{H}').split(','))
TOI, OMIN = float(opt('--toi', 0.72)), int(opt('--o-min', 8))
xam = cv2.cvtColor(anh, cv2.COLOR_BGR2GRAY).astype(np.float32)
# nền tường cục bộ: mờ rộng gấp ~4 ô cửa — ô tối dưới TOI × nền là lòng cửa / kính trong bóng
nen = cv2.blur(xam, (61, 61))   # nền tính trên CẢ ảnh: cắt trước thì dải hẹp toàn bóng râm làm nền tối theo
def mat_na(thr, vx0, vy0, vx1, vy1):   # vùng tối dưới thr × nền, toạ độ trong vùng cắt
    m = (xam[y0 + vy0:y0 + vy1, x0 + vx0:x0 + vx1] < nen[y0 + vy0:y0 + vy1, x0 + vx0:x0 + vx1] * thr).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)); return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 3), np.uint8))
# lá cây: xanh lá trội (G > R, G > B) — ô tối giữa tán là bóng lá, không phải cửa
bgr = anh[y0:y1, x0:x1].astype(np.int16); la = ((bgr[..., 1] > bgr[..., 2] + 8) & (bgr[..., 1] > bgr[..., 0] + 4)).astype(np.float32)
la = cv2.blur(la, (31, 31))
o = []
def them(x, y, w, h):
    if w < OMIN or h < OMIN * 1.2 or w > W * 0.1 or h > H * 0.2 or h < w * 0.9: return   # trần theo CẢ ảnh, không theo vùng cắt
    if la[y + h // 2, x + w // 2] > 0.35: return
    o.append([x + x0, y + y0, x + x0 + w - 1, y + y0 + h - 1])
def do(thr, vx0, vy0, vx1, vy1, sau):
    n, nhan, st, _ = cv2.connectedComponentsWithStats(mat_na(thr, vx0, vy0, vx1, vy1), 8)
    for k in range(1, n):
        x, y, w, h, s = st[k]; x += vx0; y += vy0
        if w < OMIN or h < OMIN * 1.2: continue
        f = (nhan[y - vy0:y - vy0 + h, x - vx0:x - vx0 + w] == k)[h // 3:].mean(0)   # độ tối từng cột, bỏ 1/3 trên (lòng vòm chung)
        tru = len(f) > 3 * OMIN and f[OMIN:-OMIN].min() < 0.35 and f[:len(f) // 2].max() > 0.6 and f[len(f) // 2:].max() > 0.6   # cột sáng giữa hai mảng tối = trụ
        if h >= w * 0.9 and s >= w * h * 0.45 and h <= H * 0.2 and w <= W * 0.1 and not (tru and sau): them(x, y, w, h)
        # mảng dính (hai ô kính nối qua lòng vòm tối, hay ô kính liền tường trong bóng râm): dò lại riêng mảng đó với ngưỡng gắt hơn —
        # ô kính tối hơn hẳn đá bóng râm nên tách ra ở nấc sau; tối đa 3 nấc
        elif sau: do(thr * 0.82, x, y, x + w, y + h, sau - 1)
do(TOI, 0, 0, x1 - x0, y1 - y0, 3)
o.sort(key=lambda b: (b[1], b[0]))
# gộp cụm: cùng hàng (đỉnh lệch ≤ 25 % cao, bậu lệch ≤ 25 %) + khe ngang ≤ 0,8 × bề rộng ô
cum, da = [], [False] * len(o)
for i, b in enumerate(o):
    if da[i]: continue
    c = [b]; da[i] = True; doi = True
    while doi:
        doi = False
        for j, d in enumerate(o):
            if da[j]: continue
            e = c[-1] if d[0] > c[-1][0] else c[0]
            h = max(e[3] - e[1], d[3] - d[1]); w = max(e[2] - e[0], d[2] - d[0])
            khe = max(d[0] - max(q[2] for q in c), min(q[0] for q in c) - d[2])
            if abs(d[1] - e[1]) <= 0.25 * h and abs(d[3] - e[3]) <= 0.25 * h and khe <= 1.2 * w:
                c.append(d); da[j] = True; doi = True; c.sort(key=lambda q: q[0])
    cum.append(c)
cum.sort(key=lambda c: (round(np.median([q[1] for q in c]) / 40), c[0][0]))
ra = [{'ten': f'nháp {i + 1} — {len(c)} ô', 'o': [[q[0], q[2]] for q in c], 'dinhO': int(np.median([q[1] for q in c])), 'bau': int(np.median([q[3] for q in c]))} for i, c in enumerate(cum)]
print(f'{len(o)} ô · {len(ra)} cụm · ảnh {W} × {H} · vùng {x0},{y0}–{x1},{y1}')
for i, c in enumerate(ra): print(f'  {i + 1:2d}  {len(c["o"])} ô  x {c["o"][0][0]}–{c["o"][-1][1]}  đỉnh {c["dinhO"]}  bậu {c["bau"]}')
if opt('--ra'): json.dump({'anh': a[0], 'cum': ra}, open(opt('--ra'), 'w'), ensure_ascii=False, indent=1)
if opt('--phu'):
    v = anh.copy()
    for b in o: cv2.rectangle(v, (b[0], b[1]), (b[2], b[3]), (60, 220, 60), 1)
    for i, c in enumerate(ra):
        p = (c['o'][0][0] - 3, c['dinhO'] - 3, c['o'][-1][1] + 3, c['bau'] + 3); cv2.rectangle(v, p[:2], p[2:], (0, 220, 255), 2)
        cv2.putText(v, str(i + 1), (p[0], p[1] - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 4); cv2.putText(v, str(i + 1), (p[0], p[1] - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 220, 255), 1)
    v = v[y0:y1, x0:x1]; k = min(1, 1600 / max(v.shape[:2])); cv2.imwrite(opt('--phu'), cv2.resize(v, None, fx=k, fy=k, interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
if opt('--so'):
    da_do = json.load(open(opt('--so')))['cum']; trung = 0; dung_o = 0
    for d in da_do:
        cx, cy = (d['o'][0][0] + d['o'][-1][1]) / 2, (d['dinhO'] + d['bau']) / 2; h = d['bau'] - d['dinhO']
        g = [c for c in ra if abs((c['o'][0][0] + c['o'][-1][1]) / 2 - cx) <= max(12, 0.4 * (d['o'][-1][1] - d['o'][0][0])) and abs((c['dinhO'] + c['bau']) / 2 - cy) <= 0.5 * h]
        tt = 'TRÚNG' if g else 'SÓT'; trung += bool(g); dung_o += bool(g and len(g[0]['o']) == len(d['o']))
        print(f'  {tt:5s} {d["ten"][:50]:50s} {len(d["o"])} ô' + (f' → nháp {ra.index(g[0]) + 1} ({len(g[0]["o"])} ô)' if g else ''))
    print(f'trúng cụm {trung}/{len(da_do)} · đúng số ô {dung_o}/{len(da_do)} · nháp thừa {len(ra) - trung}')
