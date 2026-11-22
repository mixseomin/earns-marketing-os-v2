#!/usr/bin/env python3
"""DÒ CHI TIẾT MẶT TƯỜNG TỰ ĐỘNG — ảnh thật ↔ mô hình, mọi ảnh, mọi khối, không AI (numpy + OpenCV).
tra-repo-ok: mã dán keo nội bộ — dùng độ sâu / camera / bản đồ mặt / canh khung của so-anh-that.py; bộ dò là lọc ảnh cơ bản (trung vị hàng, tự tương quan, thành phần liền), không thư viện nào làm đúng việc so hai bản nắn.

Mỗi ảnh, mỗi khối nhìn thấy (so-anh-that.py gọi trai_mat):
  NẮN: điểm ảnh tường (không mái, không nhìn xiên quá) → toạ độ mặt (s = quãng dọc chu vi mặt bằng khối, y = độ cao thật) bằng toạ độ 3D từ độ sâu
       → hai lưới trùng khít: ẢNH THẬT (độ sáng ảnh tại đúng điểm sau canh khung) và MÔ HÌNH (bóng đổ theo pháp tuyến × độ lõm so mặt tường + màu vật liệu mờ)
       — mô hình KHÔNG lấy vân đá (vân vẽ lặp đều sẽ giả làm dãy vòm).
  DÒ (cùng một bộ cho cả hai lưới, đơn vị mét):
    bang — gờ / phào / dải ngang: trung vị theo cột (khúc 1 m) của độ lệch hàng so với trung bình trượt 0,5 m, ≥ 2 m bề ngang đồng ý; lớp mạch đá đều (≥ 4 vạch cách đều < 0,7 m) bỏ
    day  — dãy lặp (vòm nhỏ, răng cưa, con-xon, cửa sổ): dải cao 0,4 / 0,8 / 1,4 m, hồ sơ theo cột → tự tương quan → chu kỳ 0,3–4 m, r ≥ 0,45
    lo   — lỗ tối (cửa, ô kính, hốc): thành phần tối hơn nền ≥ 35 %, ≥ 0,15 m², rộng ≥ 0,2 m
  SO: ảnh có mà mô hình không → THIẾU (gờ ở độ cao y · dãy nhịp p ở y0–y1 · lỗ ở s, y); mô hình có nhịp khác → SAI_NHIP; gờ thiếu nằm trong dãy thiếu thì gộp vào dãy.

  python3 doc_mat.py --tu-kiem     tường tổng hợp có đáp án + bài phá (chỉ vân đá → không được thấy gì) + bài so (mô hình thiếu dãy vòm và một gờ → đúng 2 mục)
"""
import math, sys
import numpy as np, cv2, warnings
warnings.filterwarnings('ignore', 'All-NaN slice', RuntimeWarning); warnings.filterwarnings('ignore', 'Mean of empty slice', RuntimeWarning)

# NGƯỠNG NHỎ NHẤT bên đo nhận — sổ chi tiết ghi kèm (so-anh-that.py dung → 'nguong'), mattien.js datChiTietDo dựng đúng ngưỡng này:
# một nguồn, nên chỗ nào bên đo báo THIẾU thì bên dựng dựng được, vòng đo → dựng → đo lại luôn khép
NGUONG = {'lo_w': 0.2, 'lo_h': 0.3, 'doan': 0.5,
          # CỬA VÀO (bước qua được) ≠ cửa sổ: đáy lỗ chạm chân tường (≤ cua_chan m), cao ≥ cua_h, rộng ≥ cua_w — còn lại là cửa sổ (có bậu, cao hơn đất)
          'cua_chan': 0.45, 'cua_h': 1.8, 'cua_w': 0.7}
GO_CAO = 0.8  # gờ cao hơn mức này (theo chiều đứng) là khối nhô, không phải gờ — go_nho
ANH_SANG = np.array([-0.35, 0.55, 0.76]) / np.linalg.norm([-0.35, 0.55, 0.76])


def mo_mask(X, V, r):
    """trung bình trượt hộp vuông cạnh 2r+1 chỉ trên điểm hợp lệ"""
    k = (2 * r + 1, 2 * r + 1); a = cv2.blur((X * V).astype(np.float32), k); b = cv2.blur(V.astype(np.float32), k)
    return np.where(b > 1e-3, a / np.maximum(b, 1e-3), 0)


def chuan_hoa(X, V, rho):
    """độ sáng tương đối: X / nền 1,5 m − 1 → bỏ chênh sáng tối do nắng, giữ chi tiết"""
    nen = mo_mask(X, V, max(2, int(1.5 * rho))); return np.where(V, X / np.maximum(nen, 1e-3) - 1, 0).astype(np.float32)


def tron_nan(P, k):
    """trung bình trượt cửa sổ 2k+1 dọc trục 1, bỏ NaN"""
    v = ~np.isnan(P); x = np.where(v, P, 0); cs = np.cumsum(np.pad(x, ((0, 0), (k + 1, k))), 1); cn = np.cumsum(np.pad(v.astype(float), ((0, 0), (k + 1, k))), 1)
    s = cs[:, 2 * k + 1:] - cs[:, :-2 * k - 1]; n = cn[:, 2 * k + 1:] - cn[:, :-2 * k - 1]; return np.where(v & (n > 0), s / np.maximum(n, 1), np.nan)


def bang(N, V, rho):
    """gờ ngang → [{'r': hàng, 'manh', 'dong'}] + hàng nào đủ bề ngang để xét"""
    H, W = N.shape; cw = max(3, int(rho)); nc = W // cw
    if nc < 2: return [], np.zeros(H, bool)
    P = np.full((nc, H), np.nan)
    for c in range(nc):
        v = V[:, c * cw:(c + 1) * cw]; ok = v.mean(1) >= 0.6; P[c, ok] = ((N[:, c * cw:(c + 1) * cw] * v).sum(1) / np.maximum(v.sum(1), 1))[ok]
    Dc = P - tron_nan(P, max(2, int(0.25 * rho))); nv = (~np.isnan(Dc)).sum(0); du = nv >= max(2, math.ceil(2.0 * rho / cw))
    if not du.any(): return [], du
    D = np.where(du, np.nanmedian(np.where(np.isnan(Dc), np.nan, Dc), 0) if nc else 0, 0); D = np.nan_to_num(D)
    thr = max(0.1, 3 * 1.4826 * float(np.median(np.abs(D[du] - np.median(D[du])))))
    w = max(1, int(0.1 * rho)); pk = []
    for r in range(H):
        if not du[r] or abs(D[r]) < thr or abs(D[r]) < np.abs(D[max(0, r - w):r + w + 1]).max(): continue
        sg = np.sign(D[r]); cot = Dc[:, max(0, r - 1):r + 2]; dong = float(np.nanmean(np.nanmax(np.where(np.isnan(cot), -9, cot * sg), 1) >= thr / 2)) if nv[r] else 0
        if dong < 0.5: continue
        hop = np.where(np.nanmax(np.where(np.isnan(cot), -9, cot * sg), 1) >= thr / 2)[0]; cum_ = np.split(hop, np.where(np.diff(hop) > 3)[0] + 1); cm = max(cum_, key=len)  # bề ngang gờ: cụm khúc cột đồng ý đông nhất, hở ≤ 2 khúc (cửa sổ cắt ngang)
        pk.append({'r': r, 'manh': round(float(abs(D[r])), 3), 'dong': round(dong, 2), 'j0': int(cm[0] * cw), 'j1': int((cm[-1] + 1) * cw)})
    kq = []
    for p in sorted(pk, key=lambda p: -p['manh']):
        if all(abs(p['r'] - q['r']) >= 0.2 * rho for q in kq): kq.append(p)
    kq.sort(key=lambda p: p['r'])
    # lớp mạch đá: ≥ 4 vạch liền cách đều (độ lệch < 25 %) khoảng < 0,7 m → bỏ, trừ vạch mạnh gấp đôi trung vị lớp
    bo = set(); i = 0
    while i < len(kq) - 3:
        j = i + 1
        while j < len(kq):
            kc = np.diff([q['r'] for q in kq[i:j + 1]])
            if kc.mean() < 0.7 * rho and kc.std() <= 0.25 * kc.mean(): j += 1
            else: break
        if j - i >= 4:
            md = np.median([q['manh'] for q in kq[i:j]]); bo |= {k for k in range(i, j) if kq[k]['manh'] < 2 * md}; i = j
        else: i += 1
    kq = [q for k, q in enumerate(kq) if k not in bo]
    # lớp mạch đá bị gờ thật cắt thành khúc ngắn (< 4 vạch): vạch dày đặc (khoảng trung vị < 0,7 m) → chỉ giữ vạch mạnh gấp đôi trung vị
    if len(kq) >= 4 and np.median(np.diff([q['r'] for q in kq])) < 0.7 * rho:
        md = np.median([q['manh'] for q in kq]); kq = [q for q in kq if q['manh'] >= 2 * md]
    return kq, du


def chay_dai(ok):
    """đoạn True dài nhất → (đầu, cuối)"""
    best, i, n = (0, 0), 0, len(ok)
    while i < n:
        if ok[i]:
            j = i
            while j < n and ok[j]: j += 1
            if j - i > best[1] - best[0]: best = (i, j)
            i = j
        else: i += 1
    return best


def day(N, V, rho):
    """dãy lặp → [{'r0','r1','p' (m),'tin','j0','j1'}]"""
    H, W = N.shape; ra = []
    for hm in (0.4, 0.8, 1.4):
        h = max(3, int(hm * rho)); st = max(2, int(0.2 * rho))
        for y0 in range(0, H - h + 1, st):
            v = V[y0:y0 + h]; okc = v.mean(0) >= 0.6; j0, j1 = chay_dai(okc)
            if j1 - j0 < 2.5 * rho: continue
            x = ((N[y0:y0 + h] * v).sum(0) / np.maximum(v.sum(0), 1))[j0:j1].astype(np.float64); n = len(x)
            wn = min(n - 1 + n % 2, max(3, int(5 * rho)) | 1); x = x - np.convolve(np.pad(x, wn // 2, mode='edge'), np.ones(wn) / wn, 'valid')
            if x.std() < 0.03: continue
            lmin, lmax = max(2, int(0.3 * rho)), min(int(4 * rho), n // 3)
            if lmax <= lmin + 2: continue
            r = np.array([np.corrcoef(x[:-L], x[L:])[0, 1] for L in range(lmin, lmax + 1)]); r = np.nan_to_num(r)
            dinh = [i for i in range(1, len(r) - 1) if r[i] >= r[i - 1] and r[i] >= r[i + 1] and r[i] >= 0.45]
            if not dinh: continue
            mx = max(r[i] for i in dinh); i = min(i for i in dinh if r[i] >= 0.7 * mx)  # nhịp nhỏ nhất — bội 2p luôn tương quan gần bằng p
            ra.append({'r0': y0, 'r1': y0 + h, 'p': round((i + lmin) / rho, 3), 'tin': round(float(r[i]), 2), 'j0': int(j0), 'j1': int(j1)})
    hoa = lambda a, b: any(abs(a / b - h) <= 0.12 * h for h in (1, 0.5, 2))  # cùng nhịp hoặc bội đôi
    kq = []
    for a in sorted(ra, key=lambda a: -a['tin']):
        for b in kq:
            if min(a['r1'], b['r1']) - max(a['r0'], b['r0']) > 0 and min(a['j1'], b['j1']) - max(a['j0'], b['j0']) > 0 and hoa(a['p'], b['p']):
                b['p'] = min(a['p'], b['p']); break  # cùng một dãy: giữ dải tin nhất, nhịp nhỏ nhất
        else: kq.append(dict(a))
    return sorted(kq, key=lambda a: a['r0'])


def lo(N, V, rho):
    """lỗ tối → [{'r0','r1','j0','j1'}]"""
    t = ((N < -0.35) & V).astype(np.uint8); k = max(1, int(0.08 * rho)); t = cv2.morphologyEx(t, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    n, _, st, _ = cv2.connectedComponentsWithStats(t, connectivity=8); ra = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a >= 0.15 * rho * rho and NGUONG['lo_w'] * rho <= w <= 4 * rho and NGUONG['lo_h'] * rho <= h <= 6 * rho and a >= 0.4 * w * h: ra.append({'r0': int(y), 'r1': int(y + h), 'j0': int(x), 'j1': int(x + w)})
    return ra


def hang_cua(y0, y1, cac_lo):
    """dải [y0, y1] là HÀNG CỬA khi ≥ 2 lỗ cao ≥ 1,5× dải chiếm ≥ nửa bề cao dải: nhịp lặp đến từ chính các ô cửa (đã so riêng bằng lỗ), không phải dãy vòm / răng cưa.
    Trước 21/11/2026 bộ dò dãy coi hàng cửa Palas là dãy → bước dựng đắp dải đá ngang vắt qua cửa → lượt sau cửa bị che, báo THIẾU lỗ mãi (vòng tự nuôi lỗi)"""
    h = abs(y1 - y0); lo_, hi = min(y0, y1) - h, max(y0, y1) + h  # nới một bề dải mỗi phía: mép trên / dưới hàng cửa cũng lặp theo nhịp cửa
    # lỗ phải CAO HƠN hẳn dải (≥ 1,5×): hốc vòm mù cao đúng bằng dải là thân dãy vòm, không phải cửa
    return sum(1 for a, b in cac_lo if abs(b - a) >= 1.5 * h and min(hi, max(a, b)) - max(lo_, min(a, b)) >= 0.5 * h) >= 2


def do_ca(N, V, rho):
    b, du = bang(N, V, rho); L = lo(N, V, rho)
    D = [d for d in day(N, V, rho) if not hang_cua(d['r0'], d['r1'], [(o['r0'], o['r1']) for o in L if d['j0'] <= (o['j0'] + o['j1']) / 2 <= d['j1']])]
    return {'bang': b, 'day': D, 'lo': L, 'du': du}


def loai_lo(o, chan, rho):
    """lỗ → 'cua_vao' (cửa đi: đáy chạm chân tường, đủ cao, đủ rộng để người bước qua) hay 'cua_so' (có bậu / cao hơn đất).
    chan[j] = hàng thấp nhất còn tường ở cột j (chân tường trên lưới); −1 = cột trống. Một luật cho cả ảnh lẫn mô hình → so được SAI_LOAI.
    Chân tường thấy trên ảnh có thể là chỗ vật che / khung ảnh cắt — bước dựng còn kiểm đất thật trước cửa (mattien.js cuaDiDuoc), và cần nhiều ảnh đồng ý"""
    c = [chan[j] for j in range(max(0, o['j0']), min(len(chan), o['j1'])) if chan[j] >= 0]
    if not c: return 'cua_so'
    h, w, gap = (o['r1'] - o['r0']) / rho, (o['j1'] - o['j0']) / rho, (min(c) - o['r1']) / rho
    return 'cua_vao' if gap <= NGUONG['cua_chan'] and h >= NGUONG['cua_h'] and w >= NGUONG['cua_w'] else 'cua_so'


def gan_loai(D, chan, rho):
    """gắn 'cua' cho mọi lỗ của một lần đo"""
    for o in D['lo']: o['cua'] = loai_lo(o, chan, rho)
    return D


def la_bong(o, rho):
    """lỗ tối dẹt (cao < 0,6 m hoặc cao < 0,6 × rộng) = bóng dưới phần nhô, không phải ô cửa — một luật duy nhất cho cả dò lẫn dựng"""
    h, w = (o['r1'] - o['r0']) / rho, (o['j1'] - o['j0']) / rho
    return h < 0.6 or h < 0.6 * w


def chong(a, b):
    """phần chồng hai hộp lỗ / diện tích hộp nhỏ hơn (0 = rời, 1 = hộp nhỏ nằm trọn trong hộp lớn)"""
    h = min(a['r1'], b['r1']) - max(a['r0'], b['r0']); w = min(a['j1'], b['j1']) - max(a['j0'], b['j0'])
    if h <= 0 or w <= 0: return 0.0
    return h * w / max(1e-9, min((a['r1'] - a['r0']) * (a['j1'] - a['j0']), (b['r1'] - b['r0']) * (b['j1'] - b['j0'])))


CHE_KHE = 1.2  # m: khe giữa hai vật che cùng hàng (con-xon dưới ban công cách ~1,1 m) cũng tính là che — bóng tối trong khe không phải cửa (22/11/2026 Palas #23 y 47,5)


def che_dong(che, rho):
    """mặt nạ vật che (lưới R×C, 0–1) → đóng khe ngang ≤ CHE_KHE: ảnh nhìn qua khe con-xon chỉ thấy bóng hốc dưới ban công, không đo được tường sau"""
    if che is None: return None
    k = max(1, int(CHE_KHE * rho)) | 1
    return np.maximum(che, cv2.morphologyEx((che >= 0.5).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((1, k), np.uint8)).astype(np.float32))


def sau_che(o, che):
    return che is not None and float(che[o['r0']:o['r1'] + 1, o['j0']:o['j1'] + 1].mean()) >= CHE_PHU


CHE_PHU = 0.3  # lỗ ảnh có ≥ 30 % diện tích nằm sau VẬT CHE của mô hình (tranh tường, ban công — mặt nạ <ảnh>-che.png) = không phải cửa thiếu


def so(A, M, rho, che=None):
    """phát hiện trên ảnh (A) đối chiếu mô hình (M) → danh sách lệch (đơn vị hàng / cột của lưới).
    che: phần VẬT CHE thấy được (0–1, lưới R×C; lượt mặt nạ của máy chụp đọc cờ userData.che) — lỗ ảnh nằm sau tranh / ban công không báo THIẾU.
    Trước dùng độ NHÔ hình khối: tranh dán sát tường nhô 0 → lọt (21/11/2026 Palas #23 y 51,5), nên vật che phải do mô hình TỰ KHAI"""
    ra = []
    for d in A['day']:
        cung = [m for m in M['day'] if min(d['r1'], m['r1']) - max(d['r0'], m['r0']) > 0 and min(d['j1'], m['j1']) - max(d['j0'], m['j0']) > 0]
        khop = [m for m in cung if 0.85 <= d['p'] / m['p'] <= 1.18]  # hai bên đều đã lấy nhịp nhỏ nhất → so thẳng, bội đôi là SAI_NHIP thật (mô hình thưa vòm một nửa)
        if khop: continue
        ra.append({'loai': 'SAI_NHIP' if cung else 'THIẾU', 'chi_tiet': 'dãy', 'r0': d['r0'], 'r1': d['r1'], 'j0': d['j0'], 'j1': d['j1'], 'p': d['p'], 'tin': d['tin'],
                   'p_mh': sorted({m['p'] for m in cung}) or None})
    for b in A['bang']:
        if not M['du'][b['r']] or any(abs(b['r'] - m['r']) <= 0.25 * rho for m in M['bang']): continue
        if any(x['chi_tiet'] == 'dãy' and x['r0'] - 0.3 * rho <= b['r'] <= x['r1'] + 0.3 * rho for x in ra): continue  # mép dãy thiếu — dãy đã nói
        ra.append({'loai': 'THIẾU', 'chi_tiet': 'gờ', 'r': b['r'], 'j0': b['j0'], 'j1': b['j1'], 'tin': round(min(1, b['manh'] / 0.2) * b['dong'], 2)})
    for b in M['bang']:
        if A['du'][b['r']] and not any(abs(b['r'] - a['r']) <= 0.25 * rho for a in A['bang']): ra.append({'loai': 'THỪA', 'chi_tiet': 'gờ', 'r': b['r'], 'j0': b['j0'], 'j1': b['j1'], 'tin': round(min(1, b['manh'] / 0.2) * b['dong'], 2)})
    p = int(0.3 * rho)
    # ô cửa MÔ HÌNH nằm sau vật che: ảnh không bao giờ xác nhận được (chỉ thấy bóng) → THỪA; sổ đo tự gỡ ô dựng nhầm từ lượt trước khi có mặt nạ che (lỗ viết tay không có trong sổ → không bị gỡ)
    ra += [{'loai': 'THỪA', 'chi_tiet': 'lỗ', **m, 'tin': 0.5, 'tu': 'che'} for m in M['lo'] if sau_che(m, che)]
    for o in A['lo']:
        cy, cx = (o['r0'] + o['r1']) / 2, (o['j0'] + o['j1']) / 2
        if any(x['chi_tiet'] == 'dãy' and x['r0'] - p <= cy <= x['r1'] + p and x['j0'] <= cx <= x['j1'] for x in ra): continue  # hốc của dãy thiếu — dãy đã nói
        if sau_che(o, che): continue  # mảng tối trong tranh / bóng ban công: dựng cửa ở đó cũng bị vật che che → THIẾU mãi
        if la_bong(o, rho):
            # dải tối dẹt = BÓNG dưới phần nhô ra (gờ, ban công), không phải ô cửa: mép trên của dải là chỗ gờ. Mô hình đã có gờ / dải tối ở đó → đã giải thích;
            # chưa có → THIẾU gờ (trước 21/11/2026 báo "THIẾU lỗ" mà bước dựng bỏ qua dải dẹt → mãi còn THIẾU, vòng dò → dựng không bao giờ khép)
            if any(abs(o['r0'] - m['r']) <= 0.25 * rho for m in M['bang']) or any(abs(o['r0'] - x['r']) <= 0.25 * rho for x in ra if x['chi_tiet'] == 'gờ'): continue
            if any(m['r0'] - p <= cy <= m['r1'] + p and m['j0'] - p <= cx <= m['j1'] + p for m in M['lo']): continue
            ra.append({'loai': 'THIẾU', 'chi_tiet': 'gờ', 'r': o['r0'], 'j0': o['j0'], 'j1': o['j1'], 'tin': 0.5, 'tu': 'bóng'}); continue
        mm = [m for m in M['lo'] if m['r0'] - p <= cy <= m['r1'] + p and m['j0'] - p <= cx <= m['j1'] + p]
        if not mm:
            # tâm lệch quá đệm nhưng HAI HỘP CHỒNG NHAU = mô hình đã có ô cửa ở đó, chỉ lệch chỗ → LỆCH (không dựng thêm). Trước 21/11/2026 báo THIẾU → bước dựng
            # đặt khung + kính thứ hai sát / đè lên ô cửa đã có (mặt chi chít khung chồng, nét tăng giả)
            ch = [m for m in M['lo'] if chong(o, m) >= 0.25]
            if ch: ra.append({'loai': 'LỆCH', 'chi_tiet': 'lỗ', **o, 'tin': 0.5, 'lech_px': [round(cy - (ch[0]['r0'] + ch[0]['r1']) / 2), round(cx - (ch[0]['j0'] + ch[0]['j1']) / 2)]}); continue
            ra.append({'loai': 'THIẾU', 'chi_tiet': 'lỗ', **o, 'tin': 0.5}); continue
        # có lỗ ở đó nhưng KHÁC LOẠI: ảnh là cửa sổ có bậu mà mô hình khoét vòm xuống tận đất (hoặc ngược lại) — người chơi đi xuyên chỗ tường thật
        if o.get('cua') and not any(m.get('cua') == o['cua'] for m in mm): ra.append({'loai': 'SAI_LOAI', 'chi_tiet': 'lỗ', **o, 'cua_mh': mm[0].get('cua'), 'tin': 0.5})
    return ra


def go_nho(R, V, rho):
    """gờ / phào của MÔ HÌNH đọc từ HÌNH HỌC, không từ bóng giả lập: sống nhô ra khỏi mặt tường (≥ 0, đo bằng R = khoảng cách ra ngoài đường tường)
    mảnh hơn GO_CAO theo chiều đứng → 0…1 (nhô 0,12 m = 1). Bóng giả lập một hướng nắng làm phào cao 0,22 m chỉ thành dải mờ rộng 0,5 m biên độ 0,08 —
    dưới ngưỡng bang 0,1 — trong khi ảnh thật là vệt sáng mảnh 0,3: mô hình dựng gờ mà máy đo không thấy (21/11/2026 khối 223140032, gờ 33,05 THIẾU mãi).
    Khối nhô lớn (tháp góc, ô văng cao) rộng hơn GO_CAO nên phép mở bỏ đi; chỗ lõm (cửa) kẹp về 0 nên tường giữa hai cửa không thành sống."""
    if not V.any(): return np.zeros_like(R, dtype=np.float32)
    d = np.where(V, np.maximum(R - np.median(R[V]), 0), 0).astype(np.float32); k = max(3, int(GO_CAO * rho)) | 1
    return np.clip((d - cv2.morphologyEx(d, cv2.MORPH_OPEN, np.ones((k, 1), np.uint8))) / 0.12, 0, 1) * V


def trai_mat(anh, troiA, CK, P, MAT, mai, hinh, mh, sau, d, khoi_ds, che=None):
    """nắn từng khối nhìn thấy → [{khoi, rho, ytop, s0, chu_vi, cum, A, M, V, do_A, do_M, lech}]"""
    H, W = MAT.shape; tg = math.tan(math.radians(d['fov']) / 2); cam = np.array(d['m']).reshape(4, 4).T[:3, 3]
    gA = cv2.cvtColor(anh, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    nv = hinh.astype(np.float32)[..., ::-1] / 255 * 2 - 1; bong = np.clip(nv @ ANH_SANG.astype(np.float32), 0.05, 1)
    gM = cv2.cvtColor(mh, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    cheM = np.zeros(gM.shape, np.float32) if che is None else (che[..., :3].max(-1) > 127).astype(np.float32)  # mặt nạ vật che (thư mục cũ chưa có lượt này → không che)
    ys, xs = np.where((MAT != '') & ~mai)
    if not len(ys): return []
    Xp = np.round(CK[0, 0] * xs + CK[0, 1] * ys + CK[0, 2]).astype(int); Yp = np.round(CK[1, 0] * xs + CK[1, 1] * ys + CK[1, 2]).astype(int)
    vao = (Xp >= 0) & (Xp < W) & (Yp >= 0) & (Yp < H); vao[vao] &= ~troiA[Yp[vao], Xp[vao]]; ys, xs, Xp, Yp = ys[vao], xs[vao], Xp[vao], Yp[vao]
    ten = MAT[ys, xs]; kid = np.array([t.rsplit('#', 1)[0] for t in ten]); ca = np.array([t.rsplit('#', 1)[1] for t in ten]); theo_id = {k['id']: k for k in khoi_ds}; ra = []
    for k_id in np.unique(kid):
        c = np.where((kid == k_id) & (ca != 'mái'))[0]
        if len(c) < 400 or k_id not in theo_id: continue
        v = np.array(theo_id[k_id]['v'], float); a = v; b = np.roll(v, -1, 0); seg = b - a; Ls = np.maximum(np.linalg.norm(seg, axis=1), 1e-6); u = seg / Ls[:, None]
        dt = float((a[:, 0] * b[:, 1] - b[:, 0] * a[:, 1]).sum()) / 2; no = np.stack([u[:, 1], -u[:, 0]], 1) * (1 if dt > 0 else -1); cum = np.concatenate([[0], np.cumsum(Ls)]); chu = float(cum[-1])
        e = ca[c].astype(int) % len(v); q = P[ys[c], xs[c]][:, [0, 2]]; t = np.clip(((q - a[e]) * u[e]).sum(1), 0, Ls[e]); s = cum[e] + t; rr = ((q - a[e]) * no[e]).sum(1); yy = P[ys[c], xs[c], 1]
        nh = np.stack([no[e][:, 0], np.zeros(len(e)), no[e][:, 1]], 1); hu = cam - P[ys[c], xs[c]]; cosv = np.abs((nh * hu).sum(1)) / np.maximum(np.linalg.norm(hu, axis=1), 1e-6)
        g = cosv >= 0.25
        if g.sum() < 400: continue
        c, s, rr, yy = c[g], s[g], rr[g], yy[g]
        # xoay chu vi: khe trống dài nhất ra hai đầu (mặt nhìn thấy vắt qua điểm đầu đa giác vẫn liền)
        bn = max(1, int(math.ceil(chu / 0.5))); hs = np.bincount(np.minimum((s / chu * bn).astype(int), bn - 1), minlength=bn) > 0; tr = np.concatenate([hs, hs])
        best, i0 = (0, 0), None
        for i in range(2 * bn):
            if not tr[i] and i0 is None: i0 = i
            if tr[i] and i0 is not None:
                if i - i0 > best[1] - best[0]: best = (i0, i)
                i0 = None
        s0 = (best[1] % bn) * chu / bn; s = (s - s0) % chu
        mpx = float(np.median(2 * sau[ys[c], xs[c]] * tg / H)); rho = float(np.clip(0.9 / max(mpx, 1e-3), 6, 30))
        smin, smax, ymin, ymax = float(s.min()), float(s.max()), float(np.percentile(yy, 0.5)), float(np.percentile(yy, 99.5))
        if smax - smin < 2.5 or ymax - ymin < 1.5: continue
        R, C = int((ymax - ymin) * rho) + 1, min(4000, int((smax - smin) * rho) + 1)
        ii = np.clip(((ymax - yy) * rho).astype(int), 0, R - 1); jj = np.clip(((s - smin) * rho).astype(int), 0, C - 1); ix = ii * C + jj
        dem = np.bincount(ix, minlength=R * C).reshape(R, C).astype(np.float32); tong = lambda w: np.bincount(ix, weights=w, minlength=R * C).reshape(R, C).astype(np.float32)
        lop = [tong(gA[Yp[c], Xp[c]]), tong(bong[ys[c], xs[c]]), tong(gM[ys[c], xs[c]]), tong(rr), tong(cheM[ys[c], xs[c]])]
        for _ in range(2):  # lấp lỗ một hai ô do lưới mịn hơn điểm ảnh
            b3 = cv2.blur(dem, (3, 3)); trong = (dem == 0) & (b3 > 0)
            for L in lop: L[trong] = (cv2.blur(L, (3, 3)) / np.maximum(b3, 1e-6))[trong]
            dem = np.where(trong, 1, dem)
        V = dem > 0; dem = np.maximum(dem, 1)
        chan = np.where(V.any(0), V.shape[0] - 1 - np.argmax(V[::-1], 0), -1)  # chân tường từng cột — lấy TRƯỚC khi gọt mép (gọt rồi thì cửa đi trông như hở 0,15 m trên đất)
        gAm, bm, mm, rm, cm = [L / dem for L in lop]
        V = cv2.erode(V.astype(np.uint8), np.ones((max(1, int(0.15 * rho)) * 2 + 1, 1), np.uint8)).astype(bool)  # bỏ mép trên / dưới: chỗ giáp mái, giáp đất
        if V.sum() < 6 * rho * rho: continue
        lom = np.clip(-(rm - np.median(rm[V])), 0, 0.6) / 0.6; sm = max(1, int(0.15 * rho)) * 2 + 1
        Mg = 0.6 * bm * (1 - 0.7 * lom) + 0.4 * cv2.GaussianBlur(mm, (sm, sm), 0) + 0.3 * go_nho(rm, V, rho)
        A_, M_ = chuan_hoa(gAm, V, rho), chuan_hoa(Mg, V, rho); dA, dM = do_ca(A_, V, rho), do_ca(M_, V, rho)
        dM['lo'] += lo(chuan_hoa(mm, V, rho), V, rho) + lo(np.where(lom > 0.3, -1.0, 0.0), V, rho)  # lỗ mô hình = màu VẬT LIỆU (kính tối, chưa trộn bóng / chưa nhoè) hoặc HÌNH lõm ≥ 0,18 m; Mg trộn bóng làm ô kính chỉ còn N −0,2 nên trước đây mô hình có cửa mà máy đếm 0
        gan_loai(dA, chan, rho); gan_loai(dM, chan, rho)
        ra.append({'khoi': k_id, 'chan': chan, 'pa': a.tolist(), 'pu': u.tolist(), 'pn': no.tolist(), 'R': rm, 'rho': rho, 'ytop': ymax, 'smin': smin, 's0': s0, 'chu_vi': chu, 'cum': cum.tolist(), 'A': A_, 'M': M_, 'V': V, 'do_A': dA, 'do_M': dM, 'che': che_dong(cm, rho), 'lech': so(dA, dM, rho, che_dong(cm, rho))})
    return ra


def canh_cua(m, j):
    """cột lưới → cạnh đa giác khối ('khối#cạnh')"""
    sg = (m['smin'] + j / m['rho'] + m['s0']) % m['chu_vi']; return f"{m['khoi']}#{max(0, int(np.searchsorted(m['cum'], sg, 'right')) - 1)}"


def doan(m, j0, j1, r0, r1):
    """cột j0..j1 của lưới nắn → đoạn trên từng cạnh đa giác khối: {canh, t0, t1 (m từ đỉnh đầu cạnh), a0 (đỉnh đầu), u (hướng cạnh), n (pháp tuyến ra ngoài), ra (mặt tường mô hình nhô khỏi đa giác, m)}
    — bước dựng (mattien.js datChiTietDo) đặt chi tiết thẳng lên đoạn này, không cần biết khối dựng ra sao"""
    rho = m['rho']; js = np.arange(max(0, j0), min(j1, m['V'].shape[1])); ra = []
    if not len(js): return ra
    sg = (m['smin'] + (js + 0.5) / rho + m['s0']) % m['chu_vi']; e = np.clip(np.searchsorted(m['cum'], sg, 'right') - 1, 0, len(m['pa']) - 1); t = sg - np.array(m['cum'])[e]
    r0, r1 = max(0, r0), min(m['V'].shape[0], max(r1, r0 + 1))
    lon = np.bincount(e).argmax()  # cạnh giữ nhiều cột nhất luôn giữ — chi tiết hẹp (< 0,4 m: khe cửa, trụ) mất hết đoạn là không dựng được, lượt sau báo THIẾU mãi
    for ee in np.unique(e):
        k = e == ee
        if k.sum() < 0.4 * rho and ee != lon: continue
        o = m['V'][r0:r1, js[k]]; R = m['R'][r0:r1, js[k]][o]
        ra.append({'canh': int(ee), 't0': round(float(t[k].min()), 2), 't1': round(float(t[k].max() + 1 / rho), 2), 'a0': [round(v, 3) for v in m['pa'][ee]], 'u': [round(v, 4) for v in m['pu'][ee]],
                   'n': [round(v, 4) for v in m['pn'][ee]], 'ra': round(float(np.median(R)), 3) if len(R) else 0.0})
    return ra


def mo_ta(m, x):
    """mục lệch → toạ độ thật để đọc / gộp giữa ảnh / dựng"""
    rho, yt = m['rho'], m['ytop']
    if x['chi_tiet'] == 'gờ': return {'loai': x['loai'], 'chi_tiet': 'gờ', 'khoi': m['khoi'], 'y': round(yt - x['r'] / rho, 2), 'tin': x['tin'],
                                      'mat': sorted({canh_cua(m, j) for j in range(x['j0'], x['j1'], max(1, int(rho)))}) if 'j0' in x else [],
                                      'doan': doan(m, x['j0'], x['j1'], x['r'] - 2, x['r'] + 3) if 'j0' in x else []}
    o = {'loai': x['loai'], 'chi_tiet': x['chi_tiet'], 'khoi': m['khoi'], 'y0': round(yt - x['r1'] / rho, 2), 'y1': round(yt - x['r0'] / rho, 2), 'tin': x['tin'],
         'mat': sorted({canh_cua(m, j) for j in range(x['j0'], x['j1'], max(1, int(rho)))})}
    if x['chi_tiet'] == 'dãy': o.update({'p': x['p'], 'p_mh': x['p_mh'], 'dai_m': round((x['j1'] - x['j0']) / rho, 1)})
    if x['chi_tiet'] == 'lỗ':
        o.update({'w': round((x['j1'] - x['j0']) / rho, 2), 'h': round((x['r1'] - x['r0']) / rho, 2)})
        if x.get('cua'): o['cua'] = x['cua']
        if x.get('cua_mh'): o['cua_mh'] = x['cua_mh']
    o['doan'] = doan(m, x['j0'], x['j1'], x['r0'], x['r1']); return o


def thay(m):
    """mọi chi tiết ẢNH thấy trên mặt này (khớp mô hình hay THIẾU đều tính) → toạ độ thật — phiếu "có" khi bước dựng cân THỪA:
    một ảnh không thấy gờ (nắng gắt, xa, nghiêng) không được gỡ chi tiết mà ảnh khác thấy rõ (21/11/2026: gỡ gờ 33,15 xong lượt sau 3 ảnh lại báo THIẾU → dao động)"""
    A = m['do_A']; ra = [mo_ta(m, {'loai': 'CÓ', 'chi_tiet': 'gờ', 'r': b['r'], 'j0': b['j0'], 'j1': b['j1'], 'tin': 1}) for b in A['bang']]
    ra += [mo_ta(m, {'loai': 'CÓ', 'chi_tiet': 'dãy', **{k: d[k] for k in ('r0', 'r1', 'j0', 'j1', 'p')}, 'p_mh': None, 'tin': 1}) for d in A['day']]
    return ra + [mo_ta(m, {'loai': 'CÓ', 'chi_tiet': 'lỗ', **{k: o[k] for k in ('r0', 'r1', 'j0', 'j1')}, 'cua': o.get('cua'), 'tin': 1}) for o in A['lo'] if not sau_che(o, m.get('che'))]  # bóng sau vật che không phải phiếu "có"


# màu từng loại lệch trên ảnh ghép — MỘT bảng; bài tự kiểm đòi mọi loại so() sinh ra đều có màu (21/11/2026 thêm LỆCH mà quên màu → so-anh-that.py sập giữa vòng)
MAU_LOAI = {'THIẾU': (40, 40, 255), 'SAI_NHIP': (0, 220, 255), 'THỪA': (255, 120, 40), 'SAI_LOAI': (255, 0, 255), 'LỆCH': (0, 160, 255)}


def ve(m, ten):
    """hai bản nắn chồng dọc: ẢNH (trên) · MÔ HÌNH (dưới); gờ khớp xanh lá / thiếu đỏ / thừa lam; dãy thiếu khung đỏ, sai nhịp vàng; lỗ thiếu đỏ"""
    h = lambda X: cv2.cvtColor(np.clip((X + 0.6) / 1.2 * 255, 0, 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
    A, M = h(m['A']), h(m['M']); A[~m['V']] = M[~m['V']] = (90, 60, 60); rho = m['rho']
    for b in m['do_M']['bang']: cv2.line(M, (0, b['r']), (M.shape[1], b['r']), (80, 200, 80), 1)
    for b in m['do_A']['bang']: cv2.line(A, (0, b['r']), (A.shape[1], b['r']), (80, 200, 80), 1)
    for x in m['lech']:
        mau = MAU_LOAI[x['loai']]
        if x['chi_tiet'] == 'gờ': cv2.line(A if x['loai'] != 'THỪA' else M, (0, x['r']), (A.shape[1], x['r']), mau, 2)
        else: cv2.rectangle(A, (x['j0'], x['r0']), (x['j1'], x['r1']), mau, 2)
    for d in m['do_M']['day']: cv2.rectangle(M, (d['j0'], d['r0']), (d['j1'], d['r1']), (80, 200, 80), 1)
    s = min(1.0, 1400 / max(1, A.shape[1])); im = np.vstack([A, np.full((6, A.shape[1], 3), 255, np.uint8), M])
    im = cv2.resize(im, (max(1, int(im.shape[1] * s)), max(1, int(im.shape[0] * s))), interpolation=cv2.INTER_AREA)
    cv2.putText(im, f"{ten} · {m['khoi']} · tren ANH, duoi MO HINH", (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA); return im


def tam_doan(x):
    """tâm đoạn dài nhất → (cạnh, t giữa)"""
    d = max(x.get('doan') or [{'canh': -1, 't0': 0, 't1': 0}], key=lambda d: d['t1'] - d['t0']); return d['canh'], (d['t0'] + d['t1']) / 2


def hop_doan(A, B):
    """hợp đoạn hai mục theo cạnh: t0 nhỏ nhất, t1 lớn nhất, ra trung bình"""
    o = {d['canh']: dict(d) for d in A}
    for d in B:
        if d['canh'] in o: c = o[d['canh']]; c['t0'], c['t1'], c['ra'] = min(c['t0'], d['t0']), max(c['t1'], d['t1']), round((c['ra'] + d['ra']) / 2, 3)
        else: o[d['canh']] = dict(d)
    return sorted(o.values(), key=lambda d: d['canh'])


def cung_cho(g, x, y):
    """hai mục cùng một chi tiết: cùng khối + loại + độ cao ± 0,3 m; dãy cùng nhịp ± 20 %; lỗ cùng cạnh, tâm cách ≤ 0,8 m (lỗ khác nhau cùng tầng là cửa sổ khác nhau)"""
    if g['khoi'] != x['khoi'] or g['chi_tiet'] != x['chi_tiet'] or g['loai'] != x['loai'] or abs(g['y'] - y) > 0.3: return False
    if x['chi_tiet'] == 'dãy' and not 0.8 <= x['p'] / g['p'] <= 1.25: return False
    if x['chi_tiet'] == 'lỗ': (cg, tg), (cx, tx) = tam_doan(g), tam_doan(x); return cg == cx and abs(tg - tx) <= 0.8
    return True


def chuan_lo(g):
    """lỗ trong sổ phải TỰ KHỚP: h = y1 − y0, đoạn (một khúc) = bề rộng ô. Bản ghi lệch → chỉnh theo đúng cái mattien đang dựng
    (tâm đứng (y0+y1)/2 cao h, tâm ngang giữa đoạn rộng min(w, đoạn)) nên nhìn không đổi; ảnh đo vòng sau dời tiếp nếu ô sai chỗ.
    Gốc: gop cũ lấy y0/y1 của ảnh đầu + h trung vị + hợp đoạn (52/85 lỗ sổ lệch, 22/11/2026)."""
    if g.get('chi_tiet') != 'lỗ' or g.get('y0') is None or g.get('y1') is None: return g
    yc = (g['y0'] + g['y1']) / 2
    if g.get('h') is not None and abs(g['h'] - (g['y1'] - g['y0'])) > 0.01: g['y0'], g['y1'] = round(yc - g['h'] / 2, 2), round(yc + g['h'] / 2, 2)
    g['h'] = round(g['y1'] - g['y0'], 2); g['y'] = round((g['y0'] + g['y1']) / 2, 2)
    d = g.get('doan') or []
    if len(d) == 1 and g.get('w'):
        L = d[0]['t1'] - d[0]['t0']; w = min(g['w'], L); tc = (d[0]['t0'] + d[0]['t1']) / 2
        if L - w > 0.01: g['doan'] = [{**d[0], 't0': round(tc - w / 2, 2), 't1': round(tc + w / 2, 2)}]
        g['w'] = round(w, 2)
    return g


def chot_cua(g):
    """loại và cỡ phải cùng một lỗ: 'cua_vao' mà cỡ (trung vị gộp / cỡ mới ghi vào sổ) dưới ngưỡng cửa đi → 'cua_so'. Gộp nhiều ảnh và cập nhật sổ đều gọi hàm này"""
    if g.get('cua') == 'cua_vao' and (g.get('w', 0) < NGUONG['cua_w'] or g.get('h', 0) < NGUONG['cua_h']): g['cua'] = 'cua_so'
    return g


def gop(ds):
    """mục lệch của mọi ảnh → gộp cùng chỗ (cung_cho) → số ảnh đồng ý; đoạn trên cạnh = hợp các ảnh (mỗi ảnh thấy một phần mặt)"""
    nhom = []
    for anh, x in ds:
        y = x.get('y', (x.get('y0', 0) + x.get('y1', 0)) / 2)
        for g in nhom:
            if cung_cho(g, x, y):
                g['anh'].add(anh); g['tin'] = max(g['tin'], x['tin']); g['mat'] = sorted(set(g['mat']) | set(x.get('mat', []))); g['doan'] = hop_doan(g.get('doan', []), x.get('doan', []))
                for k in ('w', 'h', 'cua', 'y0', 'y1'):
                    if k in x: g['_' + k].append(x[k])
                g['_tam'] += [(d['canh'], (d['t0'] + d['t1']) / 2, d) for d in x.get('doan', [])[:1]]
                break
        else: nhom.append({**x, 'y': round(y, 2), 'anh': {anh}, 'mat': x.get('mat', []), 'doan': x.get('doan', []), '_tam': [(d['canh'], (d['t0'] + d['t1']) / 2, d) for d in x.get('doan', [])[:1]],
                           **{'_' + k: [x[k]] if k in x else [] for k in ('w', 'h', 'cua', 'y0', 'y1')}})
    for g in nhom:
        g['so_anh'] = len(g['anh']); g['anh'] = sorted(g['anh'])
        for k in ('w', 'h', 'y0', 'y1'):
            v = g.pop('_' + k)
            if v: g[k] = round(float(np.median(v)), 2)
        tam = g.pop('_tam')
        # LỖ là một ô có kích thước: mỗi ảnh đo một bản → mọi số lấy trung vị, rồi suy ra cho khớp nhau (h = y1 − y0, đoạn = tâm ± w/2).
        # Trước: y0/y1 của ảnh ĐẦU, h trung vị, đoạn = HỢP các ảnh → bản ghi tự mâu thuẫn (Palas #23 22/11/2026: y 47,57–48,39 mà h 1,66, đoạn nở 5,85–6,92 với w 0,35
        # → mattien dựng ô cao 47,15–48,81 lệch ngang, ảnh báo THIẾU mãi). Gờ / dãy giữ hợp đoạn (dải dài, mỗi ảnh thấy một khúc).
        if g['chi_tiet'] == 'lỗ' and 'y0' in g and 'y1' in g:
            g['h'] = round(g['y1'] - g['y0'], 2); g['y'] = round((g['y0'] + g['y1']) / 2, 2)
            if tam:
                c = max(sorted({t[0] for t in tam}), key=[t[0] for t in tam].count); ts = [t for t in tam if t[0] == c]; tc = float(np.median([t[1] for t in ts]))
                w = g.get('w') or float(np.median([t[2]['t1'] - t[2]['t0'] for t in ts]))
                g['doan'] = [{**ts[0][2], 't0': round(tc - w / 2, 2), 't1': round(tc + w / 2, 2), 'ra': round(float(np.median([t[2].get('ra', 0) for t in ts])), 3)}]
        v = g.pop('_cua')
        if v: g['cua'] = max(sorted(set(v)), key=v.count)  # đa số ảnh; hoà thì 'cua_so' (chữ cái trước) — không khoét tường khi ảnh chưa chắc
        chot_cua(g); chuan_lo(g)
    return sorted(nhom, key=lambda g: (-g['so_anh'], -g['tin']))


def tu_kiem():
    """tường tổng hợp 30 × 12 m, 15 px/m, có đáp án — phải hỏng được"""
    rho, Wm, Hm = 15, 30, 12; R, C = Hm * rho, Wm * rho; rng = np.random.default_rng(7); loi = 0
    def ok(c, t):
        nonlocal loi; print(('✓ ' if c else '✗ ') + t); loi += not c
    def da():  # đá xây: lớp cao 0,3–0,4 m, viên dài 0,5–1,1 m, sáng ngẫu nhiên ±12 %, mạch tối 12 %, nắng chênh trái → phải
        X = np.ones((R, C), np.float32); y = 0
        while y < R:
            h = int(rng.uniform(0.3, 0.4) * rho); x = int(rng.uniform(0, 0.8) * rho)
            X[y:y + h, :x] *= rng.uniform(0.88, 1.12)
            while x < C: w = int(rng.uniform(0.5, 1.1) * rho); X[y:y + h, x:x + w] *= rng.uniform(0.88, 1.12); X[y:y + h, x] *= 0.88; x += w
            X[y] *= 0.88; y += h
        return X * np.linspace(0.7, 1.0, C)[None, :] + rng.normal(0, 0.02, (R, C)).astype(np.float32)
    rr = lambda ym: int((Hm - ym) * rho)
    def go(X, ym):  # gờ: mặt trên sáng 0,1 m, bóng dưới tối 0,12 m
        X[rr(ym) - int(0.1 * rho):rr(ym)] *= 1.25; X[rr(ym):rr(ym) + int(0.12 * rho)] *= 0.55
    def vom(X, y0, y1, p):  # dãy vòm mù: hốc tối rộng nửa nhịp
        for x in np.arange(0.2, Wm - p, p): X[rr(y1):rr(y0), int(x * rho):int((x + p / 2) * rho)] *= 0.62
    def cua(X):
        for x in (6, 15, 24): X[rr(4.6):rr(3), int(x * rho):int((x + 1) * rho)] *= 0.35
    V = np.ones((R, C), bool)
    full = da(); go(full, 2.5); go(full, 7.0); vom(full, 9.0, 9.8, 0.7); cua(full)
    D = do_ca(chuan_hoa(full, V, rho), V, rho)
    yb = sorted(round(Hm - b['r'] / rho, 2) for b in D['bang'])
    ok(any(abs(y - 2.5) <= 0.25 for y in yb) and any(abs(y - 7.0) <= 0.25 for y in yb), f"gờ ở 2,5 và 7,0 m: thấy {yb}")
    dd = [(round(Hm - x['r1'] / rho, 1), round(Hm - x['r0'] / rho, 1), x['p'], x['tin']) for x in D['day']]
    ok(any(abs(p - 0.7) <= 0.07 and y0 >= 8.6 and y1 <= 10.2 for y0, y1, p, _ in dd), f"dãy vòm nhịp 0,7 ở 9–9,8 m: thấy {dd}")
    lc = [o for o in D['lo'] if 3 - 0.3 <= Hm - o['r1'] / rho and Hm - o['r0'] / rho <= 4.6 + 0.3]
    ok(len(lc) == 3, f"3 cửa sổ ở 3–4,6 m: thấy {len(lc)} (cả hốc vòm: {len(D['lo'])} lỗ)")
    tron = da(); D0 = do_ca(chuan_hoa(tron, V, rho), V, rho)
    ok(not D0['bang'] and not D0['day'] and not D0['lo'], f"bài phá — chỉ đá xây: gờ {[round(Hm - b['r'] / rho, 2) for b in D0['bang']]} · dãy {[(x['p'], x['tin']) for x in D0['day']]} · lỗ {len(D0['lo'])} (phải rỗng)")
    mo = da(); go(mo, 2.5); cua(mo); DM = do_ca(chuan_hoa(mo, V, rho), V, rho); L = [x for x in so(D, DM, rho) if x['loai'] != 'THỪA']
    ok(len(L) == 2 and {x['chi_tiet'] for x in L} == {'gờ', 'dãy'} and any(x['chi_tiet'] == 'gờ' and abs(Hm - x['r'] / rho - 7.0) <= 0.25 for x in L),
       f"mô hình thiếu dãy vòm + gờ 7 m → đúng 2 mục: {[(x['loai'], x['chi_tiet'], round(Hm - x.get('r', x.get('r0', 0)) / rho, 2)) for x in L]}")
    ok(not [x for x in so(D, D, rho) if x['loai'] != 'THỪA'], 'tự so chính nó → không thiếu gì')
    mo2 = da(); go(mo2, 2.5); go(mo2, 7.0); vom(mo2, 9.0, 9.8, 1.4); cua(mo2); L2 = so(D, do_ca(chuan_hoa(mo2, V, rho), V, rho), rho)
    ok(any(x['chi_tiet'] == 'dãy' and x['loai'] == 'SAI_NHIP' for x in L2), f"mô hình vòm nhịp 1,4 (ảnh 0,7): {[(x['loai'], x['chi_tiet'], x.get('p'), x.get('p_mh')) for x in L2 if x['chi_tiet'] == 'dãy']}")
    # hàng cửa thật (8 cửa cao 2,3 m, nhịp 3,5 m) KHÔNG được báo là dãy: 21/11/2026 dãy đắp ngang vắt qua cửa Palas → cửa bị che, THIẾU lỗ mãi
    hc = da()
    for x in np.arange(1.0, Wm - 1.5, 3.5): hc[rr(6.3):rr(4.0), int(x * rho):int((x + 1.0) * rho)] *= 0.35
    DH = do_ca(chuan_hoa(hc, V, rho), V, rho)
    ok(not [x for x in DH['day'] if Hm - x['r0'] / rho <= 6.6 and Hm - x['r1'] / rho >= 3.7] and len(DH['lo']) >= 6, f"hàng cửa → không có dãy: dãy {[(round(Hm - x['r1'] / rho, 1), round(Hm - x['r0'] / rho, 1), x['p']) for x in DH['day']]} · lỗ {len(DH['lo'])}")
    ok(hang_cua(39.0, 39.4, [(38.3, 40.6), (38.3, 40.6)]) and not hang_cua(9.0, 9.8, [(9.0, 9.8), (9.0, 9.8)]), 'hang_cua: cửa cao hơn dải → hàng cửa; hốc vòm cao bằng dải → không')
    # lỗ ảnh nằm trên vật nhô của mô hình (tranh treo 0,13 m) → không THIẾU; cùng lỗ trên mặt phẳng → vẫn THIẾU
    tr = da(); tr[rr(6.3):rr(4.0), int(10 * rho):int(11 * rho)] *= 0.35; DT = do_ca(chuan_hoa(tr, V, rho), V, rho); DP = do_ca(chuan_hoa(da(), V, rho), V, rho)
    nho = np.zeros((R, C), np.float32); nho[rr(7.0):rr(3.5), int(9 * rho):int(12 * rho)] = 1.0  # mặt nạ vật che: tranh phủ trọn lỗ
    ok(len([x for x in so(DT, DP, rho) if x['chi_tiet'] == 'lỗ']) == 1 and not [x for x in so(DT, DP, rho, nho) if x['chi_tiet'] == 'lỗ'], f'lỗ sau vật che (tranh dán sát, mặt nạ che) → không THIẾU; trên mặt phẳng → THIẾU: phẳng {[(x["loai"], x["chi_tiet"]) for x in so(DT, DP, rho)]} · nhô {[(x["loai"], x["chi_tiet"]) for x in so(DT, DP, rho, nho)]}')
    # khe giữa hai con-xon (che 0,8 m mỗi bên, khe 0,6 m) → đóng khe: lỗ ảnh trong khe không THIẾU; khe rộng 3 m (ngoài CHE_KHE) → vẫn THIẾU
    cx = np.zeros((R, C), np.float32); cx[rr(7.0):rr(3.5), int(9.6 * rho):int(10.0 * rho)] = 1; cx[rr(7.0):rr(3.5), int(11.0 * rho):int(11.4 * rho)] = 1
    ok(not [x for x in so(DT, DP, rho, che_dong(cx, rho)) if x['chi_tiet'] == 'lỗ' and x['loai'] != 'THỪA'], 'lỗ trong khe con-xon (khe 1 m) → không THIẾU')
    cr = np.zeros((R, C), np.float32); cr[rr(7.0):rr(3.5), int(8.0 * rho):int(8.4 * rho)] = 1; cr[rr(7.0):rr(3.5), int(12.6 * rho):int(13.0 * rho)] = 1
    ok([x['loai'] for x in so(DT, DP, rho, che_dong(cr, rho)) if x['chi_tiet'] == 'lỗ'] == ['THIẾU'], 'bài phá — khe 4,2 m (ngoài CHE_KHE) → vẫn THIẾU')
    # ô cửa MÔ HÌNH sau vật che → THỪA (sổ tự gỡ ô dựng nhầm); không che → không THỪA
    ok([x['loai'] for x in so(DP, DT, rho, nho) if x['chi_tiet'] == 'lỗ'] == ['THỪA'] and not [x for x in so(DP, DT, rho) if x['chi_tiet'] == 'lỗ' and x['loai'] == 'THỪA'],
       f"ô mô hình sau vật che → THỪA: che {[x['loai'] for x in so(DP, DT, rho, nho) if x['chi_tiet'] == 'lỗ']} · không che {[x['loai'] for x in so(DP, DT, rho) if x['chi_tiet'] == 'lỗ']}")
    # dải tối dẹt (bóng ban công 4 × 0,4 m) ở ảnh, mô hình chưa có gờ → THIẾU gờ ở mép trên dải, KHÔNG báo lỗ (bước dựng không dựng dải dẹt thành cửa)
    bo = {'r0': rr(5.6), 'r1': rr(5.2), 'j0': 10 * rho, 'j1': 14 * rho}; cu_a = {'day': [], 'bang': [], 'lo': [bo], 'du': np.ones(R, bool)}
    L3 = so(cu_a, {'day': [], 'bang': [], 'lo': [], 'du': np.ones(R, bool)}, rho)
    ok(len(L3) == 1 and L3[0]['chi_tiet'] == 'gờ' and abs(Hm - L3[0]['r'] / rho - 5.6) <= 0.1, f"dải tối dẹt → THIẾU gờ 5,6 m: {[(x['chi_tiet'], round(Hm - x.get('r', x.get('r0', 0)) / rho, 2)) for x in L3]}")
    L4 = so(cu_a, {'day': [], 'bang': [{'r': rr(5.62), 'j0': 0, 'j1': C, 'manh': 0.3, 'dong': 1}], 'lo': [], 'du': np.ones(R, bool)}, rho)
    ok(not [x for x in L4 if x['loai'] != 'THỪA'], f"mô hình đã có gờ trên dải tối → không thiếu gì: {L4}")
    ok(not la_bong({'r0': rr(4.6), 'r1': rr(3), 'j0': 6 * rho, 'j1': 7 * rho}, rho), 'cửa sổ 1 × 1,6 m không bị coi là bóng')
    mg = {'rho': rho, 'smin': 0.0, 's0': 0.0, 'chu_vi': 60.0, 'cum': [0.0, 20.0], 'pa': [[0, 0], [20, 0]], 'pu': [[1, 0], [0, 1]], 'pn': [[0, -1], [1, 0]],
          'V': np.ones((R, C), bool), 'R': np.zeros((R, C))}
    dh = doan(mg, 10 * rho, 10 * rho + 5, rr(5), rr(3))
    ok(len(dh) == 1 and dh[0]['canh'] == 0 and 9.9 <= dh[0]['t0'] <= 10.1, f"khe hẹp 0,33 m vẫn có đoạn để dựng: {dh}")
    dg = doan(mg, 20 * rho - 2, 20 * rho + 3, rr(5), rr(3))
    ok([d['canh'] for d in dg] == [1], f"khe hẹp vắt góc: giữ cạnh nhiều cột, bỏ mẩu lẻ: {dg}")
    # gờ mô hình đọc từ hình học: phào nhô 0,14 m cao 0,25 m ở 7 m → một gờ; ô văng nhô 0,5 m cao 2 m (3–5 m) và tường kẹp giữa hai hàng cửa lõm (9,4–10 m) → không gờ
    Rg = np.zeros((R, C), np.float32); rr = lambda y: int((Hm - y) * rho)
    Rg[rr(7.12):rr(6.88), :] = 0.14; Rg[rr(5):rr(3), :] = 0.5
    for x0 in range(1, 28, 3): Rg[rr(10.6):rr(10), x0 * rho:(x0 + 2) * rho] = -0.3; Rg[rr(9.4):rr(8.8), x0 * rho:(x0 + 2) * rho] = -0.3
    Vg = np.ones((R, C), bool); Bg, _ = bang(chuan_hoa(0.5 + 0.3 * go_nho(Rg, Vg, rho), Vg, rho), Vg, rho); yg = [round(Hm - b['r'] / rho, 2) for b in Bg]
    ok(len(yg) == 1 and abs(yg[0] - 7.0) <= 0.15, f"gờ mô hình từ độ nhô: chỉ phào 7 m (không ô văng, không tường giữa cửa): {yg}")
    # CỬA VÀO ≠ CỬA SỔ: chân tường ở hàng R−1 (y = 0); cửa đi 1,2 × 2,4 m chạm đất · cửa sổ 1 × 1,6 m bậu 1 m · lỗ thấp 0,9 × 1,2 m chạm đất (lỗ thông hơi, không phải cửa)
    chan = np.full(C, R - 1); cv = lambda y0, y1, x, w: {'r0': rr(y1), 'r1': rr(y0) - int(0.15 * rho), 'j0': int(x * rho), 'j1': int((x + w) * rho)}  # đáy bị gọt 0,15 m như trai_mat
    ok(loai_lo(cv(0, 2.4, 3, 1.2), chan, rho) == 'cua_vao', 'cửa đi chạm đất 1,2 × 2,4 m → cua_vao')
    ok(loai_lo(cv(1.0, 2.6, 8, 1.0), chan, rho) == 'cua_so', 'cửa sổ bậu 1 m → cua_so')
    ok(loai_lo(cv(0, 1.2, 12, 0.9), chan, rho) == 'cua_so', 'lỗ thấp 1,2 m chạm đất → cua_so (không đủ cao để đi)')
    ok(loai_lo(cv(0, 2.4, 16, 0.4), chan, rho) == 'cua_so', 'khe 0,4 m chạm đất → cua_so (không đủ rộng)')
    ch2 = chan.copy(); ch2[int(20 * rho):int(22 * rho)] = rr(1.0)  # tường cột đó dừng ở 1 m (vật che chân) → cửa sổ bậu 1 m trông như chạm "chân"
    ok(loai_lo(cv(1.0, 3.4, 20, 1.2), ch2, rho) == 'cua_vao', 'chân bị che → máy đo nhận cua_vao (bước dựng phải chặn bằng đất thật: cuaDiDuoc)')
    # ảnh: cửa sổ có bậu; mô hình: vòm xuống tận đất cùng chỗ → SAI_LOAI (đúng lỗi sân Palas 21/11/2026)
    A5 = gan_loai({'day': [], 'bang': [], 'lo': [cv(1.0, 2.6, 8, 1.0)], 'du': np.ones(R, bool)}, chan, rho)
    M5 = gan_loai({'day': [], 'bang': [], 'lo': [cv(0, 2.6, 7.8, 1.4)], 'du': np.ones(R, bool)}, chan, rho)
    L5 = so(A5, M5, rho); ok([x['loai'] for x in L5] == ['SAI_LOAI'] and L5[0]['cua'] == 'cua_so' and L5[0]['cua_mh'] == 'cua_vao', f"ảnh cửa sổ / mô hình vòm chạm đất → SAI_LOAI: {[(x['loai'], x.get('cua'), x.get('cua_mh')) for x in L5]}")
    ok(not so(A5, A5, rho), 'cùng loại → không SAI_LOAI')
    g = gop([('a', {'loai': 'THIẾU', 'chi_tiet': 'lỗ', 'khoi': 'k', 'y0': 0, 'y1': 2.4, 'tin': 0.5, 'cua': c, 'doan': [{'canh': 0, 't0': 3, 't1': 4.2, 'ra': 0}]}) for c in ('cua_vao', 'cua_so')])
    ok(len(g) == 1 and g[0]['cua'] == 'cua_so', f"hai ảnh bất đồng loại → cua_so (không khoét khi chưa chắc): {[x.get('cua') for x in g]}")
    g = gop([(n, {'loai': 'THIẾU', 'chi_tiet': 'lỗ', 'khoi': 'k', 'y0': 0, 'y1': 2.4, 'tin': 0.5, 'cua': 'cua_vao', 'w': w, 'h': 2.4, 'doan': [{'canh': 0, 't0': 3, 't1': 4.2, 'ra': 0}]}) for n, w in (('a', 0.8), ('b', 0.4), ('c', 0.5))])
    ok(len(g) == 1 and g[0]['cua'] == 'cua_so' and g[0]['w'] == 0.5, f"ba ảnh cùng nói cửa đi nhưng rộng gộp 0,5 m < ngưỡng → cua_so: {[(x.get('cua'), x.get('w')) for x in g]}")
    g = gop([(n, {'loai': 'THIẾU', 'chi_tiet': 'lỗ', 'khoi': 'k', 'y0': 0, 'y1': 2.4, 'tin': 0.5, 'cua': 'cua_vao', 'w': 1.1, 'h': 2.4, 'doan': [{'canh': 0, 't0': 3, 't1': 4.2, 'ra': 0}]}) for n in 'ab'])
    ok(len(g) == 1 and g[0]['cua'] == 'cua_vao', f"hai ảnh cửa đi 1,1 × 2,4 m → giữ cua_vao: {[x.get('cua') for x in g]}")
    # lỗ hai ảnh đo hai bản → một ô tự khớp: y0/y1 trung vị, h = y1 − y0, đoạn = tâm trung vị ± w/2 (không hợp đoạn)
    g = gop([(n, {'loai': 'THIẾU', 'chi_tiet': 'lỗ', 'khoi': 'k', 'y0': a0, 'y1': a1, 'tin': 0.5, 'cua': 'cua_so', 'w': 0.35, 'h': a1 - a0, 'doan': [{'canh': 0, 't0': t0, 't1': t0 + 0.4, 'ra': 0}]})
             for n, a0, a1, t0 in (('a', 47.57, 48.39, 6.48), ('b', 47.5, 49.0, 6.1))])
    x = g[0] if len(g) == 1 else {}; ok(x.get('h') == round(x.get('y1', 0) - x.get('y0', 0), 2) and abs(x['doan'][0]['t1'] - x['doan'][0]['t0'] - 0.35) < 0.011,
                                         f"lỗ gộp tự khớp (h = y1 − y0, đoạn = w): {[(x.get('y0'), x.get('y1'), x.get('h'), x.get('doan'))]}")
    c = chuan_lo({'chi_tiet': 'lỗ', 'y0': 47.57, 'y1': 48.39, 'h': 1.66, 'w': 0.35, 'doan': [{'canh': 23, 't0': 5.85, 't1': 6.92}]})
    ok((c['y0'], c['y1'], c['h'], c['doan'][0]['t0'], c['doan'][0]['t1']) == (47.15, 48.81, 1.66, 6.21, 6.56), f"chuan_lo giữ đúng hình đang dựng, bản ghi tự khớp: {c}")
    # vệt tối ảnh 1,6 m (hai ô cửa nhoè thành một) phủ lên ô cửa 0,6 m mô hình đã có ở mép cụm: tâm ngoài đệm 0,3 m nhưng hộp chồng → LỆCH, không THIẾU
    # (không dựng ô thứ hai đè lên ô đã có); hộp rời hẳn → vẫn THIẾU
    A6 = {'day': [], 'bang': [], 'lo': [cv(1.0, 2.6, 7, 1.6)], 'du': np.ones(R, bool)}; M6 = {'day': [], 'bang': [], 'lo': [cv(1.0, 2.6, 8.3, 0.6)], 'du': np.ones(R, bool)}
    L6 = so(A6, M6, rho); ok([x['loai'] for x in L6] == ['LỆCH'], f"vệt cửa ảnh chồng ô cửa đã có → LỆCH: {[x['loai'] for x in L6]}")
    M7 = {'day': [], 'bang': [], 'lo': [cv(1.0, 2.6, 11, 1.0)], 'du': np.ones(R, bool)}
    L7 = so(A6, M7, rho); ok([x['loai'] for x in L7] == ['THIẾU'], f"bài phá — ô mô hình cách 2,5 m (rời) → vẫn THIẾU: {[x['loai'] for x in L7]}")
    import inspect, re as _re
    sinh = set(_re.findall(r"'loai': '([^']+)'", inspect.getsource(so))); thieu_mau = sinh - set(MAU_LOAI)
    ok(not thieu_mau, f"mọi loại so() sinh ra có màu vẽ: {sorted(sinh)} · thiếu màu {sorted(thieu_mau)}")
    return 1 if loi else 0


if __name__ == '__main__':
    if '--tu-kiem' in sys.argv: sys.exit(tu_kiem())
