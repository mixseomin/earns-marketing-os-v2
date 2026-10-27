# Chạy: xuất ngay.csv bằng câu SQL trong phiên 27/10/2026 (etp.so_ngay × camp × creative × chấm, psql -A -F",") rồi: python3 som.py ngay.csv <hôm nay YYYY-MM-DD>
"""Tìm tín hiệu SỚM (ngày 1–2 của camp) báo trước lỗ thực / lãi thực ở các ngày SAU (ngày 3+).
Không dùng bộ luật đang có. Dữ liệu: ngay.csv (etp.so_ngay × camp × creative × chấm), bỏ ngày đang chạy dở (hôm nay)."""
import csv, sys, collections, statistics as st
F = sys.argv[1]; HOM_NAY = sys.argv[2] if len(sys.argv) > 2 else '2026-10-27'
rows = collections.defaultdict(list); info = {}
for r in csv.DictReader(open(F)):
    if not r.get('ngay') or r['ngay'] >= HOM_NAY: continue
    rows[int(r['camp_id'])].append((r['ngay'], float(r['chi']), float(r['thu']), float(r['ns'] or 0)))
    info[int(r['camp_id'])] = r
roi = lambda c, t: (t - c) / c * 100 if c > 0 else None

# film prior: ROI của các camp KHÁC cùng phim trong những ngày TRƯỚC ngày đầu của camp này
phim_ngay = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
for cid, ds in rows.items():
    for d, c, t, ns in ds: x = phim_ngay[info[cid]['content_id']][d]; x[0] += c; x[1] += t

mau = []
for cid, ds in rows.items():
    ds.sort(); ds = [x for x in ds if x[1] > 0 or x[2] > 0]
    if len(ds) < 3: continue
    d1, d2, sau = ds[0], ds[1], ds[2:]
    cs, ts = sum(x[1] for x in sau), sum(x[2] for x in sau)
    if cs < 2: continue
    ra = roi(cs, ts)
    kq = 'LAI' if ra >= 20 else 'LO' if ra <= -20 else 'HOA'
    pr = [v for d, v in phim_ngay[info[cid]['content_id']].items() if d < d1[0]]
    pc, pt = sum(v[0] for v in pr) - 0, sum(v[1] for v in pr)
    mau.append(dict(cid=cid, kq=kq, ra=ra, chi_sau=cs,
        r1=roi(d1[1], d1[2]), r2=roi(d2[1], d2[2]), r12=roi(d1[1] + d2[1], d1[2] + d2[2]),
        v1=d1[1] / d1[3] if d1[3] else None, v2=d2[1] / d2[3] if d2[3] else None, thu1=d1[2] > 0, thu12=(d1[2] + d2[2]) > 0,
        ns1=d1[3], chi12=d1[1] + d2[1], phim=roi(pc, pt) if pc >= 3 else None, dang=info[cid]['dang'], tl=info[cid]['tl'],
        bo=info[cid]['bo'], roas=info[cid]['roas'] == 't', meta=int(info[cid]['meta']), afs=int(info[cid]['afs'])))

N = len(mau); dem = collections.Counter(m['kq'] for m in mau)
print(f"mẫu {N} camp (≥3 ngày có chi, chi từ ngày 3 ≥ $2) · LÃI thực {dem['LAI']} · LỖ thực {dem['LO']} · hoà {dem['HOA']}")
goc_lai, goc_lo = dem['LAI'] / N, dem['LO'] / N
def bang(ten, f, nhom):
    print(f"\n== {ten}")
    print(f"{'nhóm':<22}{'n':>4}{'%LÃI':>7}{'%LỖ':>7}{'ROI sau':>9}")
    for nh in nhom:
        g = [m for m in mau if f(m) is not None and nh[1](f(m))]
        if len(g) < 5: continue
        c = sum(m['chi_sau'] for m in g); t = sum(m['chi_sau'] * (1 + m['ra'] / 100) for m in g)
        l = sum(m['kq'] == 'LAI' for m in g) / len(g); o = sum(m['kq'] == 'LO' for m in g) / len(g)
        print(f"{nh[0]:<22}{len(g):>4}{l*100:>6.0f}%{o*100:>6.0f}%{(t-c)/c*100:>8.0f}%")
print(f"(tỷ lệ gốc: LÃI {goc_lai*100:.0f}% · LỖ {goc_lo*100:.0f}%)")
B = lambda a, b: (lambda v: a <= v < b)
bang('ROI ngày 1', lambda m: m['r1'], [('< -60%', B(-1e9, -60)), ('-60..-20%', B(-60, -20)), ('-20..+20%', B(-20, 20)), ('+20..+80%', B(20, 80)), ('>= +80%', B(80, 1e9))])
bang('ROI ngày 1+2', lambda m: m['r12'], [('< -60%', B(-1e9, -60)), ('-60..-20%', B(-60, -20)), ('-20..+20%', B(-20, 20)), ('+20..+80%', B(20, 80)), ('>= +80%', B(80, 1e9))])
bang('ROI ngày 2', lambda m: m['r2'], [('< -60%', B(-1e9, -60)), ('-60..-20%', B(-60, -20)), ('-20..+20%', B(-20, 20)), ('+20..+80%', B(20, 80)), ('>= +80%', B(80, 1e9))])
bang('Tốc độ tiêu ngày 1 (chi/ngân sách)', lambda m: m['v1'], [('< 50%', B(0, .5)), ('50-90%', B(.5, .9)), ('90-130%', B(.9, 1.3)), ('>= 130%', B(1.3, 99))])
bang('Tốc độ tiêu ngày 2', lambda m: m['v2'], [('< 50%', B(0, .5)), ('50-90%', B(.5, .9)), ('90-130%', B(.9, 1.3)), ('>= 130%', B(1.3, 99))])
bang('Có doanh thu ngày 1+2', lambda m: m['thu12'], [('không có đồng nào', lambda v: not v), ('có', lambda v: v)])
bang('Phim trước đó (camp khác)', lambda m: m['phim'], [('phim lỗ < -20%', B(-1e9, -20)), ('phim -20..+20%', B(-20, 20)), ('phim lãi >= +20%', B(20, 1e9))])
bang('Loại creative', lambda m: m['dang'], [(k, (lambda k: lambda v: v == k)(k)) for k in sorted({m['dang'] for m in mau})])
bang('Bộ', lambda m: m['bo'], [(f'bộ {k}', (lambda k: lambda v: v == k)(k)) for k in sorted({m['bo'] for m in mau})])
bang('Điểm chấm Meta', lambda m: m['meta'], [('chưa chấm', lambda v: v < 0), ('<= 6', B(0, 7)), ('7-8', B(7, 9)), ('9-10', B(9, 11))])
# kết hợp: ROI 1+2 × tốc độ tiêu
bang('ROI 1+2 thấp × tiêu nhanh', lambda m: (m['r12'], m['v2']) if m['r12'] is not None and m['v2'] is not None else None,
     [('ROI<-40 & tiêu>=90%', lambda v: v[0] < -40 and v[1] >= .9), ('ROI<-40 & tiêu<90%', lambda v: v[0] < -40 and v[1] < .9),
      ('ROI>=+40 & tiêu>=90%', lambda v: v[0] >= 40 and v[1] >= .9), ('ROI>=+40 & tiêu<90%', lambda v: v[0] >= 40 and v[1] < .9)])
bang('ROI 1+2 × phim trước', lambda m: (m['r12'], m['phim']) if m['r12'] is not None and m['phim'] is not None else None,
     [('cả hai lỗ', lambda v: v[0] < -20 and v[1] < 0), ('camp lỗ, phim lãi', lambda v: v[0] < -20 and v[1] >= 20),
      ('camp lãi, phim lãi', lambda v: v[0] >= 20 and v[1] >= 20), ('camp lãi, phim lỗ', lambda v: v[0] >= 20 and v[1] < 0)])

# ---- KIỂM: chia theo NGÀY ĐẦU của camp (nửa trước / nửa sau) + kiểm tốc độ tiêu theo cỡ ngân sách
ngay_dau = {}
for cid, ds in rows.items():
    ds2 = sorted(x for x in ds if x[1] > 0 or x[2] > 0)
    if ds2: ngay_dau[cid] = ds2[0][0]
mocs = sorted(ngay_dau[m['cid']] for m in mau); moc = mocs[len(mocs) // 2]
def ty(g):
    if len(g) < 4: return f'{"(ít)":>18}'
    l = sum(m['kq'] == 'LAI' for m in g) / len(g); o = sum(m['kq'] == 'LO' for m in g) / len(g); return f'{len(g):>4} lãi{l*100:>4.0f}% lỗ{o*100:>4.0f}%'
print(f"\n== KIỂM CHIA THỜI GIAN (mốc ngày đầu {moc}): nửa TRƯỚC | nửa SAU")
for ten, f in [('ROI1+2 >= +80%', lambda m: m['r12'] is not None and m['r12'] >= 80), ('ROI1+2 +40..+80%', lambda m: m['r12'] is not None and 40 <= m['r12'] < 80),
               ('ROI1+2 -60..-20%', lambda m: m['r12'] is not None and -60 <= m['r12'] < -20), ('ROI1+2 < -60%', lambda m: m['r12'] is not None and m['r12'] < -60),
               ('tiêu ngày1 >= 90%', lambda m: m['v1'] is not None and m['v1'] >= .9), ('tiêu ngày1 < 50%', lambda m: m['v1'] is not None and m['v1'] < .5),
               ('camp lỗ, phim lãi', lambda m: m['r12'] is not None and m['phim'] is not None and m['r12'] < -20 and m['phim'] >= 20)]:
    a = [m for m in mau if f(m) and ngay_dau[m['cid']] < moc]; b = [m for m in mau if f(m) and ngay_dau[m['cid']] >= moc]
    print(f"{ten:<22}{ty(a)}  |{ty(b)}")
print("\n== TỐC ĐỘ TIÊU NGÀY 1 theo cỡ ngân sách ngày 1")
for nsn, nsf in [('$1', lambda v: v <= 1), ('$2-5', lambda v: 1 < v <= 5), ('> $5', lambda v: v > 5)]:
    for ten, f in [('tiêu >= 90%', lambda m: m['v1'] >= .9), ('tiêu < 90%', lambda m: m['v1'] < .9)]:
        g = [m for m in mau if m['v1'] is not None and nsf(m['ns1']) and f(m)]
        print(f"ns {nsn:<6}{ten:<14}{ty(g)}")

print("\n== TIỀN nếu cắt sau ngày 2 khi ROI 1+2 < -20% (số các ngày SAU đó của chính các camp này)")
g = [m for m in mau if m['r12'] is not None and m['r12'] < -20]
c = sum(m['chi_sau'] for m in g); lai = sum(m['chi_sau'] * m['ra'] / 100 for m in g)
lai_bo = sum(m['chi_sau'] * m['ra'] / 100 for m in g if m['kq'] == 'LAI')
print(f"{len(g)} camp · chi sau ngày 2 ${c:.2f} · lãi/lỗ sau ngày 2 ${lai:+.2f} · trong đó {sum(m['kq']=='LAI' for m in g)} camp thành lãi thực, bỏ lỡ ${lai_bo:+.2f}")
g = [m for m in mau if m['r12'] is not None and m['r12'] >= 80]
print(f"ROI 1+2 >= +80%: {len(g)} camp · chi sau ${sum(m['chi_sau'] for m in g):.2f} · lãi sau ${sum(m['chi_sau']*m['ra']/100 for m in g):+.2f}")
