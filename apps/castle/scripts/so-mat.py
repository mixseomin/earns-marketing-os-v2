#!/usr/bin/env python3
"""SO MẶT ĐỨNG: ảnh 3D Google ↔ mô hình, cùng camera trực giao, cùng thước mét (scripts/nan-google.mjs --mo-hinh) → số đo hình khối mà mặt bằng OSM không có — 21/11/2026.
Không tốn tiền: chỉ đếm điểm ảnh. Đo hai thứ, ghi public/du-lieu/<lâu>-mat-dung.json, ns.js dựng thẳng từ tệp (không số viết tay trong mã):
  1. CHÂN XOÈ (anh 21/11/2026: "chân các tháp còn có xu hướng xoè rộng hơn"): mỗi mép bóng của một khối (s0 trái / s1 phải trong khung) so vị trí mép theo từng hàng
     — Google lấn ra ngoài mép mô hình bao nhiêu mét. Trừ độ lệch nền (trung vị phần trên thân, OSM lệch ảnh 3D cả mảng) → còn phần XOÈ ở chân:
     y_tren (đỉnh đoạn xoè), doc (m ngang / m đứng). Khối có ≥ một nửa số mép đo được xoè → ghi chan_xoe.
  2. CỔNG XUYÊN: mảng nền hồng tím (nhìn xuyên) nằm GIỮA tường trên ảnh Google, chỗ mô hình là tường đặc, có tường phía trên (vòm) → cong: tâm (x, z), pháp tuyến,
     bề rộng, đáy, đỉnh vòm. ns.js đưa vào cong() như một lối đi → khoét lỗ mọi tường lối đó cắt + khung đá vòm (VOM_CONG).
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/so-mat.py <thư mục mat-g.json> [<thư mục> …] [--ghi] [--anh ra.png]
  ~/.venvs/castle-khop/bin/python apps/castle/scripts/so-mat.py --tu-kiem      # ảnh giả có chân xoè + cổng biết trước, phải đo ra đúng
Không --ghi: chỉ in bảng. --ghi gộp vào tệp (khối / cổng đo lại thì thay, cái khác giữ).
tra-repo-ok: đếm điểm ảnh trên ảnh của chính công cụ nan-google (numpy + PIL), không có thư viện cho đúng phép so này."""
import json, sys, pathlib
import numpy as np

NEN = np.array([255, 0, 255])
def phan_loai(a):  # 0 = nền (hồng tím), 1 = công trình / đá, 2 = cây (xanh lá, che mép → hàng đó bỏ)
    a = a[..., :3].astype(int); nen = (np.abs(a - NEN).sum(-1) < 120)
    cay = (a[..., 1] > a[..., 0] + 12) & (a[..., 1] > a[..., 2] + 12)
    o = np.ones(a.shape[:2], 'uint8'); o[cay] = 2; o[nen] = 0; return o

def mep(row, x, huong, xa):
    """đi từ cột x (trong thân) về phía `huong` (-1 trái / +1 phải) tối đa xa điểm ảnh; trả cột cuối còn là công trình trước khi gặp nền ≥ 3 điểm liền,
    None nếu gặp cây hay tới giới hạn mà chưa thấy nền (mép bị che / khối khác liền)."""
    W = len(row); c = x
    for _ in range(xa):
        n = c + huong
        if n < 0 or n >= W: return None
        if row[n] == 2: return None
        if row[n] == 0 and all(0 <= n + huong * j < W and row[n + huong * j] == 0 for j in range(3)): return c
        c = n
    return None

def do_xoe(G, M, px, y0, y1, s_mep, phia, y_chan, y_than):
    """một mép khối: s_mep (m từ trái), phia -1 = mép trái, +1 = mép phải. y_chan = chân khối (đất), y_than = đỉnh thân (mép mái).
    → { lech: [(y, m)], nen, xoe: (y_tren, ra) | None }"""
    H, W = G.shape; xc = int(round(s_mep * px)); vao, ra_ = int(1.0 * px), int(3.5 * px)
    x_trong = xc - phia * vao
    if not (0 <= x_trong < W): return None
    lech = []
    for r in range(H):
        y = y1 - r / px
        if y < y_chan - 0.5 or y > y_than: continue
        if M[r, x_trong] != 1 or G[r, x_trong] != 1: continue
        em, eg = mep(M[r], x_trong, phia, vao + ra_), mep(G[r], x_trong, phia, vao + ra_)
        if em is None or eg is None: continue
        lech.append((y, (eg - em) * phia / px))  # dương = ảnh thật lấn RA ngoài mép mô hình
    if len(lech) < 3 * px: return None
    L = np.array(lech); cao = L[:, 0].max() - L[:, 0].min()
    tren = L[L[:, 0] >= L[:, 0].min() + 0.55 * cao]
    if len(tren) < px: return None
    nen = float(np.median(tren[:, 1])); f = L.copy(); f[:, 1] -= nen
    # gom ô 0,5 m từ thấp lên; đoạn xoè = các ô liền nhau từ ô thấp nhất có trung vị > 0,2 m
    o = {}
    for y, v in f: o.setdefault(int((y - L[:, 0].min()) // 0.5), []).append(v)
    ds = sorted((k, float(np.median(v))) for k, v in o.items() if len(v) >= 3)
    chay = []
    for k, v in ds:
        if chay and k != chay[-1][0] + 1: break
        if v <= 0.2: break
        chay.append((k, v))
    y_day = float(L[:, 0].min())
    if len(chay) < 3: return {'lech': lech, 'nen': nen, 'xoe': None, 'y_day': y_day}
    # đường thẳng qua các ô trong đoạn xoè (v = a·y + b) → đỉnh xoè = chỗ đường cắt 0, ra = giá trị ở chân (ngưỡng 0,2 m cắt sớm, không lấy làm đỉnh)
    yc = np.array([y_day + (k + 0.5) * 0.5 for k, _ in chay]); vc = np.array([v for _, v in chay]); a, b = np.polyfit(yc, vc, 1)
    if a >= -0.02: return {'lech': lech, 'nen': nen, 'xoe': None, 'y_day': y_day}
    y_tren = min(-b / a, yc[-1] + 3); ra = a * y_day + b
    return {'lech': lech, 'nen': nen, 'xoe': (round(float(y_tren), 2), round(float(ra), 2)) if ra >= 0.3 else None, 'y_day': y_day}

def gom(m):  # vùng liền 4 hướng (venv không có scipy)
    nh = np.zeros(m.shape, int); sl = 0
    for i0, j0 in np.argwhere(m):
        if nh[i0, j0]: continue
        sl += 1; nh[i0, j0] = sl; ds = [(i0, j0)]
        while ds:
            i, j = ds.pop()
            for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if 0 <= a < m.shape[0] and 0 <= b < m.shape[1] and m[a, b] and not nh[a, b]: nh[a, b] = sl; ds.append((a, b))
    return nh, sl

def do_cong(G, M, px, y1):
    """mảng nền trong ảnh thật, không chạm mép trên ảnh, mô hình che ≥ 70 % (tường đặc), có công trình ≥ 1,5 m ngay trên đỉnh, rộng 1,5–8 m, cao ≥ 2 m."""
    H, W = G.shape; nh, sl = gom(G == 0); ra = []
    for q in range(1, sl + 1):
        o = np.argwhere(nh == q); r0, r1 = o[:, 0].min(), o[:, 0].max()
        if r0 == 0 or len(o) < 2 * px * px: continue
        if (M[o[:, 0], o[:, 1]] == 1).mean() < 0.7: continue
        cao = (r1 - r0 + 1) / px
        if cao < 2: continue
        rong_h = []
        for r in range(r0 + int((r1 - r0) * 0.3), r1 + 1):
            c = o[o[:, 0] == r][:, 1]
            if len(c): rong_h.append((c.min(), c.max()))
        if not rong_h: continue
        c0 = int(np.median([a for a, _ in rong_h])); c1 = int(np.median([b for _, b in rong_h])); rong = (c1 - c0 + 1) / px
        if not (1.5 <= rong <= 8): continue
        cm = (c0 + c1) // 2; tren = G[max(0, r0 - int(1.5 * px)):r0, max(0, cm - 2):cm + 3]
        if tren.size == 0 or (tren == 1).mean() < 0.8: continue
        ra.append({'s0': c0 / px, 's1': (c1 + 1) / px, 'y_dinh': round(y1 - r0 / px, 2), 'y_day': round(y1 - (r1 + 1) / px, 2), 'cham_day': bool(r1 >= H - 2)})
    return ra

def nap(p):
    from PIL import Image
    return phan_loai(np.asarray(Image.open(p).convert('RGB')))

def do_thu_muc(d):
    meta = json.load(open(pathlib.Path(d) / 'mat-g.json')); xoe, cong = [], []
    for m in meta:
        if not m.get('tepMH'): continue
        G, M = nap(m['tep']), nap(m['tepMH']); px, L = m['px'], m['L']
        x1, z1, x2, z2 = m['x1'], m['z1'], m['x2'], m['z2']
        the_gioi = lambda s: (x2 + (x1 - x2) * s / L, z2 + (z1 - z2) * s / L)  # s mét từ mép TRÁI ảnh (= điểm 2 của đoạn)
        for k in m.get('khoiMat', []):
            if k['d1'] - k['d0'] > 40: continue  # vỏ lớn (cả lâu đài) — mép không phải mép tháp
            if k['id'] != m['khoi'] and any(q['id'] == m['khoi'] for q in m['khoiMat']): continue  # khung chụp cho một tháp (--thap) → chỉ đo mép của chính tháp đó; mép khối bên cạnh lẫn mái / tường khác
            for s, phia in ((k['s0'], -1), (k['s1'], 1)):
                if s < 0.5 or s > L - 0.5: continue
                r = do_xoe(G, M, px, m['y0'], m['y1'], s, phia, max(m['y0'], k.get('dat') or m['y0']), min(m['y1'], k['yTren']))
                dat = k.get('dat') or m['y0']
                if r and r['y_day'] > dat + 3: r = None  # chân mép bị khối khác che → mép này không đo được chân, không tính vào số mép đo
                if r and r['xoe'] and (r['xoe'][0] - r['y_day'] > 16 or r['xoe'][1] / max(0.5, r['xoe'][0] - r['y_day']) > 0.35): r['xoe'] = None  # xoè cao ≤ 16 m và thoải (≤ 0,35): dài hơn = cả thân thuôn / cánh nhà, dốc hơn = cổng / tường chắn chứ không phải chân xoè
                if r: xoe.append({'khoi': k['id'], 'mat': f"{m['khoi']}#{m['canh']}", 's': round(s, 2), 'phia': phia, 'nen': round(r['nen'], 2), 'xoe': r['xoe'], 'y_day': round(r['y_day'], 2)})
        for c in do_cong(G, M, px, m['y1']):
            sm = (c['s0'] + c['s1']) / 2; x, z = the_gioi(sm)
            cong.append({'x': round(x, 2), 'z': round(z, 2), 'nx': round(m.get('nx', (z2 - z1) / L), 4), 'nz': round(m.get('nz', -(x2 - x1) / L), 4), 'rong': round(c['s1'] - c['s0'], 2),
                         'y_day': c['y_day'], 'y_dinh': c['y_dinh'], 'cham_day': c['cham_day'], 'mat': f"{m['khoi']}#{m['canh']}"})
    return xoe, cong

def gop_xoe(xoe):
    """mỗi khối: số mép đo được, số mép xoè; ≥ một nửa xoè (và ≥ 1) → đỉnh xoè = trung vị y_tren, độ dốc = trung vị ra / (y_tren − y_day)"""
    kq = {}
    for k in sorted({e['khoi'] for e in xoe}):
        e = [a for a in xoe if a['khoi'] == k]; c = [a for a in e if a['xoe']]
        if not c or len(c) * 2 < len(e): kq[k] = {'do': len(e), 'xoe': len(c)}; continue
        yt = float(np.median([a['xoe'][0] for a in c])); doc = float(np.median([a['xoe'][1] / max(0.5, a['xoe'][0] - a['y_day']) for a in c]))
        kq[k] = {'do': len(e), 'xoe': len(c), 'y_tren': round(yt, 2), 'doc': round(doc, 3), 'ra': round(float(np.median([a['xoe'][1] for a in c])), 2), 'mat': sorted({a['mat'] for a in c})}
    return kq

def gop_cong(cong):  # cùng một cổng chụp từ nhiều mặt (tâm cách ≤ 2 m) → một
    kq = []
    for c in sorted(cong, key=lambda c: -c['rong']):
        if any(abs(c['x'] - d['x']) < 2 and abs(c['z'] - d['z']) < 2 for d in kq): continue
        kq.append(c)
    return kq

def tu_kiem():
    """ảnh giả 16 px/m: tháp rộng 6 m cao 20 m, chân xoè 1,2 m mỗi bên từ đáy tới 6 m; tường bên phải có lỗ cổng rộng 3 m cao 5 m, đỉnh có tường"""
    px, Wm, Hm = 16, 30, 24; H, W = Hm * px, Wm * px; y0, y1 = 0.0, float(Hm)
    G = np.zeros((H, W), 'uint8'); M = np.zeros((H, W), 'uint8')
    for r in range(H):
        y = y1 - r / px
        if y <= 20:
            M[r, 4 * px:10 * px] = 1; xo = max(0.0, 1.2 * (6 - y) / 6) if y < 6 else 0.0
            G[r, int((4 - xo + 0.3) * px):int((10 + xo + 0.3) * px)] = 1  # +0,3 m lệch nền cả khối (OSM lệch ảnh 3D) — phải bị trừ
        if y <= 16: M[r, 14 * px:28 * px] = 1; G[r, 14 * px:28 * px] = 1
    G[H - 5 * px:H, 19 * px:22 * px] = 0
    ok = True
    for s, phia in ((4, -1), (10, 1)):
        r = do_xoe(G, M, px, y0, y1, s, phia, 0, 20)
        x = r and r['xoe']; d = x and abs(x[0] - 6) <= 0.75 and abs(x[1] - 1.1) <= 0.35
        print(f"  mép {'trái' if phia < 0 else 'phải'}: xoè {x} nền {r and round(r['nen'], 2)} {'✓' if d else '✗ (cần ~(6, 1.1))'}"); ok &= bool(d)
    c = do_cong(G, M, px, y1); d = len(c) == 1 and abs(c[0]['s0'] - 19) < 0.2 and abs(c[0]['s1'] - 22) < 0.2 and abs(c[0]['y_dinh'] - 5) < 0.2
    print(f"  cổng: {c} {'✓' if d else '✗ (cần s 19–22, đỉnh 5)'}"); ok &= d
    # phá thử: tháp KHÔNG xoè → không được báo xoè
    G2 = G.copy()
    for r in range(H):
        y = y1 - r / px
        if y < 6: G2[r, :12 * px] = 0; G2[r, int(4.3 * px):int(10.3 * px)] = 1
    r = do_xoe(G2, M, px, y0, y1, 4, -1, 0, 20); d = r is not None and r['xoe'] is None
    print(f"  phá thử (thẳng): xoè {r and r['xoe']} {'✓' if d else '✗ (phải None)'}"); ok &= d
    print('TỰ KIỂM', 'ĐẠT' if ok else 'HỎNG'); sys.exit(0 if ok else 1)

if __name__ == '__main__':
    arg = sys.argv[1:]
    if '--tu-kiem' in arg: tu_kiem()
    ghi = '--ghi' in arg; tep_anh = arg[arg.index('--anh') + 1] if '--anh' in arg else None
    dirs = [a for i, a in enumerate(arg) if not a.startswith('--') and not (i and arg[i - 1] == '--anh')]
    xoe, cong = [], []
    for d in dirs: a, b = do_thu_muc(d); xoe += a; cong += b
    kx, kc = gop_xoe(xoe), gop_cong(cong)
    print('CHÂN XOÈ — mép đo được / mép xoè · đỉnh xoè · ra ở chân · dốc')
    for k, v in kx.items(): print(f"  {k:<28} {v['do']}/{v['xoe']}" + (f"  y_tren {v['y_tren']:.1f}  ra {v['ra']:.2f} m  doc {v['doc']:.3f}" if 'doc' in v else ''))
    print('CỔNG XUYÊN')
    for c in kc: print(f"  ({c['x']:.1f}, {c['z']:.1f}) rộng {c['rong']:.1f} m · đáy {c['y_day']:.1f}{'(chạm đáy ảnh)' if c['cham_day'] else ''} · đỉnh {c['y_dinh']:.1f} · {c['mat']}")
    if tep_anh:
        from PIL import Image, ImageDraw
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        ks = [k for k, v in kx.items() if 'doc' in v][:12] or list(kx)[:12]
        f, ax = plt.subplots(1, max(1, len(ks)), figsize=(2.2 * max(1, len(ks)), 4), sharey=False)
        for a, k in zip(np.atleast_1d(ax), ks):
            for e in [e for e in xoe if e['khoi'] == k]:
                pass
            a.set_title(k.split('/')[-1], fontsize=7)
        f.savefig(tep_anh, dpi=80)
    if ghi:
        sys.path.insert(0, str(pathlib.Path(__file__).parent)); p = pathlib.Path(__file__).resolve().parent.parent / 'public/du-lieu/neuschwanstein-mat-dung.json'
        D = json.load(open(p)) if p.exists() else {'ghi_chu': 'Số đo mặt đứng ảnh 3D Google ↔ mô hình (scripts/so-mat.py): chan_xoe theo khối: lop = các lớp xoè cộng dồn (y_tren đỉnh đoạn, doc m ngang / m đứng, ra m ở chân), cong = cổng xuyên (tâm, pháp tuyến, rộng, đáy, đỉnh vòm).', 'chan_xoe': {}, 'cong': []}
        # ảnh mô hình chụp khi mô hình ĐÃ có chân xoè (mo-hinh-xoe.json do nan-google.mjs --mo-hinh ghi) → số đo là phần CÒN LỆCH: cộng thêm một lớp lên các lớp đã có;
        # thư mục chụp trước khi có tệp đó = mô hình thẳng, lớp cũ bỏ. Khối hết lệch giữ nguyên lớp đang có (đã khớp), khối chưa từng xoè mà đo không xoè thì bỏ.
        nen = {}
        for d in dirs:
            f = pathlib.Path(d) / 'mo-hinh-xoe.json'
            if f.exists(): nen.update(json.load(open(f)))
        for k, v in kx.items():
            lop = [{a: l[a] for a in ('y_tren', 'doc', 'ra')} for l in (nen[k].get('lop') or [nen[k]])] if k in nen else []
            if 'doc' in v: lop.append({a: v[a] for a in ('y_tren', 'doc', 'ra')})
            if lop: D['chan_xoe'][k] = {'lop': lop, 'do': v['do'], 'xoe': v['xoe'], 'mat': v.get('mat') or D['chan_xoe'].get(k, {}).get('mat', [])}
            else: D['chan_xoe'].pop(k, None)
        kc = [c for c in kc if not c['cham_day']]  # cổng chạm đáy ảnh = khe giữa hai khối, không phải cổng — không ghi
        D['cong'] = [d for d in D['cong'] if not d.get('cham_day') and not any(abs(c['x'] - d['x']) < 2 and abs(c['z'] - d['z']) < 2 for c in kc)] + kc
        json.dump(D, open(p, 'w'), ensure_ascii=False, indent=1); print('ghi', p)
