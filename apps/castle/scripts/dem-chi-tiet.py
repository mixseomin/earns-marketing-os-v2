#!/usr/bin/env python3
"""ĐẾM CHI TIẾT MẶT TIỀN BẰNG XỬ LÝ ẢNH (không AI) trên ảnh chụp đã NẮN về mặt tường (scripts/nan-mat.mjs, PX điểm ảnh / mét):
  rang_cua — răng cưa: viền trên của tường (cột nào cao tới đâu) → hai mức (răng / khe) → đếm đoạn RĂNG rộng ≥ 0,25 m;
  vom_nho  — cung vòm nhỏ dưới răng cưa: dải 0,3–1,3 m dưới chân khe răng, độ sáng theo cột → tự tương quan → chu kỳ 0,35–1,6 m → số vòm = bề ngang / chu kỳ;
  da_goc   — hàng đá góc ở ĐẦU cạnh: dải 0,15–0,85 m tính từ đầu cạnh, độ "đỏ gạch" (R − G) theo hàng → đoạn đá sa thạch (không đỏ) cao ≥ 0,15 m → đếm.
Mỗi số kèm độ tin 0–1 (đủ phần thấy được, độ tương phản / độ rõ chu kỳ); độ tin < 0,5 thì KHÔNG ghi số (in ra "không chắc").

  python3 apps/castle/scripts/dem-chi-tiet.py <thư mục nan-mat> <chỉ số ảnh> [--anh]   → <thư mục>/dem-<ảnh>.json (+ dem-<ảnh>-<k>.png khi --anh)
"""
import json, sys, pathlib
import numpy as np
from PIL import Image, ImageDraw

TU_KIEM = '--tu-kiem' in sys.argv
VE = '--anh' in sys.argv
if TU_KIEM:
    # mặt tường vẽ bằng máy, đáp án biết trước: (1) 8,4 m · răng nhịp 1,2 m → 7 · vòm nhịp 0,7 m → 12; (2) 6 m · răng 1,0 → 6 · vòm 0,6 → 10, một phần ba bị che xám;
    # (3) tường phẳng không răng không vòm → không được ghi số nào (bài phá: bộ đếm "thấy" chi tiết ở chỗ không có = hỏng)
    import tempfile
    thu, I, PXK = pathlib.Path(tempfile.mkdtemp(prefix='dem-tk-')), 'tk', 24; meta = []; DAP = []
    for k, (L, pr, pv, che) in enumerate([(8.4, 1.2, 0.7, 0), (6.0, 1.0, 0.6, 0.33), (7.0, 0, 0, 0)]):
        W_, H_ = int(L * PXK), 6 * PXK; im = Image.new('RGBA', (W_, H_), (250, 250, 250, 255)); g = ImageDraw.Draw(im); da_, gach = (190, 185, 170, 255), (170, 70, 55, 255)
        g.rectangle([0, 2.0 * PXK, W_, H_], fill=gach); g.rectangle([0, 2.0 * PXK, W_, 2.5 * PXK], fill=da_)
        x = 0.0
        while pr and x < L: g.rectangle([x * PXK, 1.5 * PXK, (x + pr / 2) * PXK, 2.0 * PXK], fill=da_); x += pr
        x = 0.0
        while pv and x < L: g.rectangle([(x - 0.1) * PXK, 2.5 * PXK, (x + 0.1) * PXK, 3.0 * PXK], fill=da_); x += pv
        if che: g.rectangle([0, 0, che * W_, H_], fill=(128, 128, 128, 255))
        tep = thu / f'mat-tk-{k}.png'; im.save(tep); meta.append({'khoi': 'tk', 'canh': k, 'L': L, 'px': PXK, 'tep': str(tep)}); DAP.append((round(L / pr) if pr else None, round(L / pv) if pv else None))
else:
    thu, I = pathlib.Path(sys.argv[1]), sys.argv[2]
    meta = json.load(open(thu / f'mat-{I}.json'))
ra = {}

def doan(mask, toi_thieu):
    """các đoạn liền True dài ≥ toi_thieu → [(đầu, cuối)]"""
    ds, i, n = [], 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j < n and mask[j]: j += 1
            if j - i >= toi_thieu: ds.append((i, j))
            i = j
        else: i += 1
    return ds

for k, m in enumerate(meta):
    PX = m['px']; im = np.asarray(Image.open(m['tep']).convert('RGBA')).astype(float)
    H, W = im.shape[:2]; a = im[..., 3] > 0; rgb = im[..., :3]
    xam = (np.abs(rgb - 128).max(-1) < 2) & a                       # bị khối khác che (nan-mat tô xám 128)
    sang = rgb.mean(-1); bh = rgb.max(-1) - rgb.min(-1)
    troi = a & ~xam & (((sang > 200) & (bh < 40)) | ((rgb[..., 2] > rgb[..., 0] + 25) & (rgb[..., 2] > 120)))   # trời trắng xám / xanh
    tuong = a & ~xam & ~troi
    kq = {'khoi': m['khoi'], 'canh': m['canh'], 'L': round(m['L'], 2), 'thay': round(float(tuong.mean()), 2)}
    # RĂNG CƯA: hàng trên cùng là tường ở mỗi cột (chỉ cột có trời phía trên → viền thật, không phải mép ảnh)
    dinh = np.full(W, -1)
    for x in range(W):
        col = tuong[:, x]
        if col.any() and troi[:max(1, col.argmax()), x].any(): dinh[x] = col.argmax()
    co = dinh >= 0
    phu = float((a & ~xam).any(0).mean())                              # phần bề ngang cạnh ảnh này phủ tới (cột có điểm ảnh thật)
    kq['phu'] = round(phu, 2)
    # 20/11/2026: mặt nắn thường bị khối khác che một phần (tháp tròn trước cánh Torbau) → không đòi viền trời phủ cả cạnh; đo trên ĐOẠN thấy viền:
    # răng = đoạn viền cao, NHỊP răng = trung vị khoảng cách tâm hai răng liền nhau; số răng cả cạnh = bề ngang cạnh / nhịp (mật độ đo được, phần khuất theo cùng nhịp)
    if co.sum() >= 2 * PX:
        d = dinh[co]; cao, thap = np.percentile(d, 15), np.percentile(d, 85)   # y nhỏ = cao
        bien = (thap - cao) / PX
        if bien >= 0.25:
            ds = doan(co & (dinh < (cao + thap) / 2), int(0.2 * PX)); tam = [(s_ + e_) / 2 for s_, e_ in ds]
            kc = np.array([b_ - a_ for a_, b_ in zip(tam, tam[1:]) if co[int(a_):int(b_)].mean() > 0.9]) / PX   # chỉ cặp răng liền nhau trong cùng đoạn thấy trời
            kq['_rang'] = ds; kq['_chan_khe'] = float(thap); kq['rang_thay'] = len(ds)
            if len(kc) >= 2:
                nhip = float(np.median(kc)); deu = 1 - min(1, float(kc.std()) / nhip)
                kq['rang_cua'] = int(round(m['L'] / nhip)); kq['rang_nhip_m'] = round(nhip, 2); kq['tin_rang'] = round(deu * min(1, bien / 0.5), 2)
            else: kq['rang_cua_khong_chac'] = f'chỉ thấy {len(ds)} răng liền nhau — chưa đủ đo nhịp'
        else: kq['rang_cua_khong_chac'] = f'viền trên phẳng (chênh {bien:.2f} m) — không thấy răng hoặc chỉ là mái'
    else: kq['rang_cua_khong_chac'] = f'chỉ {co.sum() / PX:.1f} m thấy viền trời'
    # VÒM NHỎ dưới chân khe răng
    if '_chan_khe' in kq:
        # đo 20/11/2026 (cạnh #7 ảnh pročelje): độ sáng thô bắt chu kỳ VIÊN GẠCH 0,33 m, không phải vòm → dùng "độ đá" (G − R: đá sa thạch xám sáng,
        # gạch đỏ thấp), làm mượt 0,15 m, tìm DẢI 0,3 m (trong 0,2–2,2 m dưới chân khe) xen kẽ đá / gạch mạnh nhất = chân con sơn giữa các vòm, rồi ĐẾM ĐỈNH cách nhau ≥ 0,45 m
        da = (rgb[..., 1] - rgb[..., 0])
        y_a, y_b, h = int(kq['_chan_khe'] + 0.2 * PX), int(kq['_chan_khe'] + 2.2 * PX), max(2, int(0.3 * PX))
        cot = (a & ~xam).any(0) & co; k_mo = max(1, int(0.15 * PX)); tot = None   # chỉ cột nằm dưới đoạn răng thấy trời (cột của tháp che phía trước: mạch đá đều nhau bị nhận nhầm là vòm)
        do = (rgb[..., 0] - rgb[..., 1]) > 25                                      # gạch đỏ
        for y in range(y_a, max(y_a + 1, y_b - h), max(1, h // 3)):
            dai = np.where(tuong[y:y + h], da[y:y + h], np.nan)
            if not dai.size or np.isfinite(dai).mean() < 0.5: continue
            p = np.nanmean(dai, 0); hop_ = np.isfinite(p) & cot
            if hop_.sum() < 2 * PX: continue
            ti_do = float(do[y:y + h][:, hop_].mean())
            if not 0.2 <= ti_do <= 0.8: continue                                 # dải vòm = gạch (lòng vòm) xen đá (chân con sơn); toàn đá / toàn gạch thì không phải
            p = np.convolve(np.nan_to_num(p - np.nanmean(p[hop_])), np.ones(k_mo) / k_mo, 'same'); p[~hop_] = 0
            nguong = 0.5 * p[hop_].std(); dinh_ = []
            for x in range(1, W - 1):
                if hop_[x] and p[x] > nguong and p[x] >= p[x - 1] and p[x] >= p[x + 1] and (not dinh_ or x - dinh_[-1] >= 0.45 * PX): dinh_.append(x)
            if len(dinh_) >= 3 and (len(dinh_) - 1) * 0.45 * PX <= hop_.sum():
                kc = np.diff(dinh_) / PX; deu = float((np.abs(kc - np.median(kc)) <= 0.2 * np.median(kc)).mean())   # phần khoảng cách đỉnh nằm trong ±20 % nhịp trung vị (một đỉnh nhiễu không kéo sập cả dãy)
                diem = deu * float(p[hop_].std())                                  # đều VÀ tương phản mạnh (gờ đá liền một màu: tương phản thấp → thua)
                if tot is None or diem > tot[4]: tot = (deu, dinh_, y, float(kc.mean()), diem)
        if tot:
            deu, dinh_, y, kc, _ = tot
            nhip = float(np.median(np.diff(dinh_))) / PX   # số vòm cả cạnh = bề ngang / nhịp (như răng cưa)
            kq['vom_thay'] = len(dinh_) - 1; kq['vom_nho'] = int(round(m['L'] / nhip)); kq['vom_nhip_m'] = round(nhip, 2); kq['tin_vom'] = round(deu, 2); kq['_vom'] = (dinh_, y, h)
    # ĐÁ GÓC ở đầu cạnh
    x0, x1 = int(0.15 * PX), int(0.85 * PX)
    if W > x1:
        dai = tuong[:, x0:x1]; r_g = np.where(dai, rgb[:, x0:x1, 0] - rgb[:, x0:x1, 1], np.nan)
        hang = np.nanmean(r_g, 1); hop = np.isfinite(hang)
        if hop.mean() > 0.5:
            nguong = np.nanmedian(hang[hop]); da = hop & (hang < nguong - 12)
            ds = doan(da, int(0.15 * PX))
            if 2 <= len(ds):
                kq['da_goc'] = len(ds); kq['tin_da'] = round(float(hop.mean()) * min(1, (np.nanmax(hang) - np.nanmin(hang)) / 60), 2); kq['_da'] = ds
            else: kq['da_goc_khong_chac'] = f'không thấy dải đá xen gạch ở đầu cạnh ({len(ds)} đoạn)'
    for ten in ('rang_cua', 'vom_nho', 'da_goc'):
        tin = kq.get({'rang_cua': 'tin_rang', 'vom_nho': 'tin_vom', 'da_goc': 'tin_da'}[ten])
        if tin is not None and tin < 0.5 and ten in kq: kq[ten + '_khong_chac'] = f'{kq.pop(ten)} (độ tin {tin})'
    if VE:
        o = Image.open(m['tep']).convert('RGB'); g = ImageDraw.Draw(o)
        for s, e in kq.get('_rang', []): g.rectangle([s, 0, e - 1, 3], fill=(255, 0, 0))
        if '_chan_khe' in kq: g.line([0, kq['_chan_khe'], W, kq['_chan_khe']], fill=(0, 255, 0))
        if '_vom' in kq:
            ds_, y_, h_ = kq['_vom']; g.rectangle([0, y_, W - 1, y_ + h_], outline=(0, 160, 255))
            for x in ds_: g.line([x, y_ - 6, x, y_ + h_ + 6], fill=(0, 160, 255), width=2)
        for s, e in kq.get('_da', []): g.rectangle([x0, s, x1, e - 1], outline=(255, 255, 0))
        o.save(thu / f'dem-{I}-{k}.png')
    ra[f"{m['khoi']}#{m['canh']}"] = {x: v for x, v in kq.items() if not x.startswith('_')}
if TU_KIEM:
    hong = 0
    for k, (r_, v_) in enumerate(DAP):
        d = ra[f'tk#{k}']; dat = d.get('rang_cua') == r_ and d.get('vom_nho') == v_; hong += not dat
        print(f"{'✓' if dat else '✗'} mặt thử {k}: răng {d.get('rang_cua')} (đáp án {r_}) · vòm {d.get('vom_nho')} (đáp án {v_})")
    print('dem-chi-tiet tự kiểm:', 'ĐẠT' if not hong else f'HỎNG {hong} mặt'); sys.exit(1 if hong else 0)
json.dump(ra, open(thu / f'dem-{I}.json', 'w'), ensure_ascii=False, indent=1)
for khoa, v in ra.items(): print(khoa, json.dumps({x: y for x, y in v.items() if x not in ('khoi', 'canh')}, ensure_ascii=False))
