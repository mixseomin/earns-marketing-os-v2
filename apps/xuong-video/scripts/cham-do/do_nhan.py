"""ĐO BỘ CHẤM ẢNH TRÊN BỘ GẮN NHÃN (chuẩn apps/xuong-video/docs/chuan-cham-diem.md).

Một bộ chấm chỉ được CHẶN / TỰ CHỌN ảnh khi đo trên bộ nhãn đạt ngưỡng. Lệnh này đo hai bộ chấm keyframe ↔ khung 3D
trên cùng một bộ nhãn (scripts/cham-do/nhan/<tập>.json, nhãn gắn trước khi xem kết quả bộ chấm):
  - gemini : giám khảo bóc tách + đối chiếu đã lưu (xv_canh.doi_chieu_uv) — 'đạt' = 0 mục lệch
  - so_do  : bộ chấm số đo cham_do.py (Grounding DINO + Depth Anything) chạy lại trên iMac, 0đ

Báo: độ chính xác (trong các ảnh bộ chấm cho đạt, bao nhiêu % đạt thật), độ bắt lỗi (trong các ảnh xấu, bắt được bao
nhiêu %), độ nhận ảnh tốt, AUC xếp hạng, và CHỌN-THỬ (mỗi shot bộ chấm chọn một ảnh — bao nhiêu shot chọn trúng ảnh đạt,
so với chọn bừa). Ảnh bộ chấm không chấm được tính là 'chưa chấm', không tính là đạt.

  ~/.venvs/cham-do/bin/python apps/xuong-video/scripts/cham-do/do_nhan.py --tap 3074 [--bo gemini,so_do] [--chi 2,9]
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(__file__))
from cham_do import sql  # noqa: E402

# NGƯỠNG ĐƯỢC QUYỀN (chuẩn chấm điểm): dưới mức này bộ chấm chỉ được hiển thị
NGUONG_CHINH_XAC = 0.90   # bộ chấm nói đạt thì ≥ 90 % đạt thật — mới được tự chọn ảnh
NGUONG_BAT_LOI = 0.80     # ảnh xấu bị bắt ≥ 80 % — mới được chặn
NGUONG_NHAN_TOT = 0.80    # ảnh tốt được cho qua ≥ 80 % — chặn không được loại oan


def bo_gemini(shots):
    dc = sql("SELECT json_build_object('id', id, 'uv', doi_chieu_uv) FROM xv_canh WHERE id = ANY('{%s}'::int[])" % ','.join(str(s['id']) for s in shots))
    uv = {r['id']: (r['uv'] or {}) for r in dc}
    ra = {}
    for s in shots:
        for a in s['anh']:
            r = uv.get(s['id'], {}).get(a['url'])
            if r:
                lech = sum(1 for k in r['chieu'] if k.get('muc') not in ('khớp', 'gần'))
                ra[a['job']] = {'dat': lech == 0, 'diem': -lech}
    return ra


def bo_so_do(shots):
    from cham_do import May, cham_shot
    nv = {r['ten']: r for r in sql("SELECT json_build_object('ten', ten, 'loai', loai, 'mo_ta', mo_ta) FROM xv_nhan_vat WHERE phim_id = (SELECT phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = %d)" % shots[0]['id'])}
    may = May(); ra = {}
    for s in shots:
        for a in s['anh']:
            try:
                x = cham_shot(may, {**s['du'], 'kf': a['url']}, nv)
                ra[a['job']] = {'dat': bool(x['dat']), 'diem': (1 if x['dat'] else 0) * 100 - len(x['loi']) * 10 + (x['do_sau'] or 0)}
            except Exception as e:
                print(f"  #{s['so']} job {a['job']}: không chấm được — {e}", flush=True)
    return ra


def do(ten, ra, shots, dat):
    hang = [(a['job'], a['job'] in dat, ra.get(a['job'])) for s in shots for a in s['anh']]
    co = [h for h in hang if h[2]]
    tp = sum(1 for _, d, r in co if r['dat'] and d); fp = sum(1 for _, d, r in co if r['dat'] and not d)
    fn = sum(1 for _, d, r in co if not r['dat'] and d); tn = sum(1 for _, d, r in co if not r['dat'] and not d)
    pos = [r['diem'] for _, d, r in co if d]; neg = [r['diem'] for _, d, r in co if not d]
    auc = sum((1 if p > n else .5 if p == n else 0) for p in pos for n in neg) / (len(pos) * len(neg)) if pos and neg else None
    # chọn-thử: mỗi shot có ≥ 1 ảnh đạt, bộ chấm chọn ảnh điểm cao nhất
    trung = bua = n = 0
    for s in shots:
        ds = [(a['job'] in dat, ra[a['job']]['diem']) for a in s['anh'] if a['job'] in ra]
        if not ds or not any(d for d, _ in ds):
            continue
        n += 1; cao = max(x for _, x in ds); top = [d for d, x in ds if x == cao]
        trung += sum(top) / len(top); bua += sum(d for d, _ in ds) / len(ds)
    cx = tp / (tp + fp) if tp + fp else None; bl = tn / (tn + fp) if tn + fp else None; nh = tp / (tp + fn) if tp + fn else None
    f = lambda x: '—' if x is None else f'{x * 100:.0f} %'
    print(f"\n== {ten}: chấm được {len(co)}/{len(hang)} ảnh (chưa chấm {len(hang) - len(co)})")
    print(f"   cho đạt {tp + fp} ảnh → đạt thật {tp} · độ chính xác {f(cx)}")
    print(f"   ảnh xấu {tn + fp} → bắt được {tn} · độ bắt lỗi {f(bl)}")
    print(f"   ảnh tốt {tp + fn} → nhận ra {tp} · độ nhận ảnh tốt {f(nh)}")
    print(f"   AUC xếp hạng {'—' if auc is None else f'{auc:.2f}'} (0,50 = đoán bừa)")
    if n:
        print(f"   chọn-thử {n} shot có ảnh đạt: chọn trúng {trung:.1f} ({f(trung / n)}) · chọn bừa trung bình {bua:.1f} ({f(bua / n)})")
    duoc_chon = cx is not None and cx >= NGUONG_CHINH_XAC and len(co) == len(hang)
    # chặn mà loại oan ảnh tốt thì cũng hỏng: cần cả bắt lỗi lẫn nhận ảnh tốt (Gemini 13/11: bắt 98 % ảnh xấu nhưng loại oan 83 % ảnh tốt)
    duoc_chan = bl is not None and nh is not None and bl >= NGUONG_BAT_LOI and nh >= NGUONG_NHAN_TOT and len(co) == len(hang)
    print(f"   QUYỀN: tự chọn ảnh {'ĐƯỢC' if duoc_chon else 'KHÔNG'} (cần độ chính xác ≥ {NGUONG_CHINH_XAC:.0%}, chấm đủ mọi ảnh) · chặn {'ĐƯỢC' if duoc_chan else 'KHÔNG'} (cần bắt lỗi ≥ {NGUONG_BAT_LOI:.0%} và nhận ảnh tốt ≥ {NGUONG_NHAN_TOT:.0%})")
    return dict(bo=ten, cham=len(co), tong=len(hang), tp=tp, fp=fp, fn=fn, tn=tn, chinh_xac=cx, bat_loi=bl, nhan_tot=nh, auc=auc, chon_trung=trung, chon_bua=bua, so_shot=n, duoc_chon=duoc_chon, duoc_chan=duoc_chan)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tap', type=int, required=True)
    ap.add_argument('--bo', default='gemini,so_do')
    ap.add_argument('--chi', default='')
    ap.add_argument('--json', default='')
    a = ap.parse_args()
    nhan = json.load(open(os.path.join(os.path.dirname(__file__), 'nhan', f'{a.tap}.json')))
    dat = set(nhan['dat'])
    chi = {int(x) for x in a.chi.split(',') if x.strip()}
    du = sql(f"SELECT json_build_object('id', id, 'so', thu_tu::int, 'kf', keyframe_url, 'uv', keyframe_uv, 'sau', khung_xam->>'sau', 'thay', khung_xam->'thay', 'kiem', khung_xam->'kiem', 'vt', may_3d->'vi_tri', 'hop3', khung_xam->'hop') FROM xv_canh WHERE tap_id = {a.tap} ORDER BY thu_tu")
    for i, s in enumerate(du, 1):
        s['so'] = i
    # ảnh = mọi job ảnh xong của shot, trừ ảnh bước 1 FLUX (ảnh trung gian, không bao giờ là keyframe)
    jobs = sql(f"SELECT json_build_object('canh', canh_id, 'job', id, 'url', output_url) FROM xv_job WHERE loai = 'anh' AND output_url IS NOT NULL AND model NOT LIKE 'fal:%' AND canh_id IN (SELECT id FROM xv_canh WHERE tap_id = {a.tap}) ORDER BY id")
    shots = [{'id': s['id'], 'so': s['so'], 'du': s, 'anh': [j for j in jobs if j['canh'] == s['id']]} for s in du if not chi or s['so'] in chi]
    # chỉ đo trên ảnh ĐÃ gắn nhãn; ảnh sinh sau lần gắn nhãn phải gắn thêm vào nhan/<tập>.json (da_gan + dat) rồi mới tính
    da_gan = set(nhan['da_gan'])
    moi = [x['job'] for s in shots for x in s['anh'] if x['job'] not in da_gan]
    if moi:
        print(f'⚠ {len(moi)} ảnh chưa gắn nhãn, bỏ khỏi phép đo: {moi[:12]}')
    for s in shots:
        s['anh'] = [x for x in s['anh'] if x['job'] in da_gan]
    kq = []
    for b in a.bo.split(','):
        ra = {'gemini': bo_gemini, 'so_do': bo_so_do}[b.strip()](shots)
        kq.append(do(b.strip(), ra, shots, dat))
    if a.json:
        open(a.json, 'w').write(json.dumps(kq, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
