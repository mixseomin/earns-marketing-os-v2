#!/usr/bin/env python3
# LỌC CHÓP BẰNG ẢNH THẬT ĐÃ ĐỊNH VỊ (anh 21/11/2026 "ko chắp vá, làm thành chuẩn"): chóp trong <lâu>-chop.json do them-chop.mjs dò từ MỘT ảnh vẫn được giữ
# nếu chân trùng tâm khối OSM — chóp 223140028 (mũi 79,9 m) lọt kiểu đó, mọi ảnh thật nhìn chỗ ấy đều thấy TRỜI. Bước này chiếu nửa trên mỗi chóp
# vào MỌI ảnh có camera (<lâu>-do-anh.json, do-anh.mjs LightGlue + PnP): điểm chiếu nằm trong vùng trời (vùng phẳng nối liền mép trên ảnh) thì ảnh đó
# chứng minh chóp KHÔNG có (không vật nào đứng trước lại là trời). Ảnh "có vật" KHÔNG chứng minh chóp có (núi / rừng phía sau cũng là vật), nên bỏ chóp
# khi ≥ 2 ảnh trời (một ảnh có thể lệch camera).
#   ~/.venvs/castle-khop/bin/python apps/castle/scripts/loc-chop-troi.py [--ghi] [--anh-ra <thư mục>]   (them-chop.mjs gọi với --ghi)
#   ... --tu-kiem   bài kiểm có thể hỏng: chóp giả giữa trời phải bị bỏ, chóp nhiều ảnh thấy có vật phải giữ
# tra-repo-ok: keo nội bộ — camera ảnh từ do-anh.mjs, mặt nạ trời bằng OpenCV floodFill; không thư viện nào làm việc này trên dữ liệu cảnh.
import json, math, sys
from pathlib import Path
import numpy as np, cv2

GOC = Path(__file__).resolve().parent.parent
DL = GOC / 'public' / 'du-lieu'
LAU = 'neuschwanstein'


def ma_tran(yaw, pitch, roll):  # three.js Euler 'YXZ'
    cy, sy, cp, sp, cr, sr = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    return (np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]) @ np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
            @ np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]]))


def chieu(a, W, H, P):
    c = a['camera']; M = ma_tran(c['yaw'], c['pitch'], c['roll']); f = (H / 2) / math.tan(math.radians(c['fov']) / 2)
    q = M.T @ (np.asarray(P, float) - np.array([a['x'], c['y'], a['z']]))
    if q[2] > -1: return None
    return W / 2 + f * q[0] / -q[2], H / 2 - f * q[1] / -q[2], -q[2]


def mat_troi(anh):
    # trời = vùng nối liền mép trên, độ dốc sáng thấp, sáng (mây trắng / trời xanh); floodFill từ mọi điểm phẳng ở hàng trên cùng
    xam = cv2.GaussianBlur(cv2.cvtColor(anh, cv2.COLOR_BGR2GRAY), (5, 5), 0).astype(np.float32)
    doc = cv2.magnitude(cv2.Sobel(xam, cv2.CV_32F, 1, 0), cv2.Sobel(xam, cv2.CV_32F, 0, 1))
    phang = ((doc < 18) & (xam > 110)).astype(np.uint8)
    phang = cv2.morphologyEx(phang, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, nhan = cv2.connectedComponents(phang, connectivity=4)
    tren = set(np.unique(nhan[0][phang[0] > 0]).tolist()) - {0}
    return np.isin(nhan, list(tren)) if tren else np.zeros(phang.shape, bool)


def danh_gia(c, anh_ds, mat_cache):
    troi, vat, chi_tiet = 0, 0, []
    h = c['yDinh'] - c['yChan']
    for tep, a in anh_ds:
        if tep not in mat_cache:
            im = cv2.imread(str(DL / tep)); mat_cache[tep] = (im, mat_troi(im) if im is not None else None)
        im, mt = mat_cache[tep]
        if im is None: continue
        Hh, Ww = im.shape[:2]
        diem = [chieu(a, Ww, Hh, (c['x'], c['yChan'] + h * t, c['z'])) for t in (0.55, 0.7, 0.85)]
        if any(d is None or not (2 <= d[0] < Ww - 2 and 2 <= d[1] < Hh - 2) or d[2] > 450 for d in diem): continue
        trung = [bool(mt[int(d[1]), int(d[0])]) for d in diem]
        kq = 'trời' if sum(trung) >= 2 else 'vật'
        troi += kq == 'trời'; vat += kq == 'vật'; chi_tiet.append((tep, kq, [(round(d[0]), round(d[1])) for d in diem]))
    return troi, vat, chi_tiet


def loc(chops, anh_ds, in_ra=True):
    cache, giu, bo = {}, [], []
    for c in chops:
        t, v, ct = danh_gia(c, anh_ds, cache)
        (bo if t >= 2 else giu).append(c)
        if in_ra:
            print(f"  chóp ({c['x']}, {c['z']}) mũi {c['yDinh']}: {t} ảnh trời · {v} ảnh có vật → {'BỎ' if t >= 2 else 'giữ'}")
            for tep, kq, d in ct: print(f"      {kq:4s} {tep.split('/')[-1]} {d}")
    return giu, bo, cache


def tu_kiem():
    S = json.loads((DL / f'{LAU}-do-anh.json').read_text())['anh']
    ds = [(t, a) for t, a in S.items() if a.get('camera') and (DL / t).exists()]
    # chóp giả giữa trời trên đỉnh đầu hồi Palas, giữa hai tháp góc (phải bỏ) + chóp (-75,05; 18,34) mà 13 ảnh thật đều thấy có vật (phải giữ)
    gia = {'x': -35.0, 'z': 13.4, 'yChan': 71.0, 'yDinh': 79.0, 'r': 1.0}
    that = {'x': -75.05, 'z': 18.34, 'yChan': 82.47, 'yDinh': 87.42, 'r': 0.92}
    giu, bo, _ = loc([gia, that], ds, in_ra=False)
    ok = gia in bo and that in giu
    print('tự kiểm:', 'ĐẠT' if ok else 'HỎNG'); return 0 if ok else 1


def main():
    if '--tu-kiem' in sys.argv: sys.exit(tu_kiem())
    tep_chop = DL / f'{LAU}-chop.json'; D = json.loads(tep_chop.read_text())
    S = json.loads((DL / f'{LAU}-do-anh.json').read_text())['anh']
    ds = [(t, a) for t, a in S.items() if a.get('camera') and (DL / t).exists()]
    print(f"{len(D['chop'])} chóp · {len(ds)} ảnh có camera")
    giu, bo, cache = loc(D['chop'], ds)
    if '--anh-ra' in sys.argv:
        ra = Path(sys.argv[sys.argv.index('--anh-ra') + 1]); ra.mkdir(parents=True, exist_ok=True)
        for c in bo:
            for tep, kq, d in danh_gia(c, ds, cache)[2]:
                im = cache[tep][0].copy(); im[cache[tep][1]] = (im[cache[tep][1]] * 0.6 + np.array([255, 160, 60]) * 0.4).astype(np.uint8)
                for x, y in d: cv2.circle(im, (x, y), 6, (0, 0, 255) if kq == 'trời' else (0, 200, 0), 2)
                cv2.imwrite(str(ra / f"chop-{c['x']}_{c['z']}-{tep.split('/')[-1]}"), im)
    print(f"giữ {len(giu)} · bỏ {len(bo)}")
    if '--ghi' in sys.argv and bo:
        D['chop'] = giu; D['loc_troi'] = {'bo': bo, 'luat': 'nửa trên chóp chiếu vào ảnh thật đã định vị rơi vào trời ở ≥ 2 ảnh (loc-chop-troi.py)'}
        tep_chop.write_text(json.dumps(D, ensure_ascii=False, indent=1) + '\n'); print('đã ghi', tep_chop)


main()
