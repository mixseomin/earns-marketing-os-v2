"""KHỚP CAMERA ẢNH THẬT THEO DOM20 (23/11/2026) — thước không phụ thuộc mô hình lẫn ảnh 3D Google.
Lý do: so-anh-that phân xử "camera chưa tin" (viền DOM20 trùng viền mô hình, không trùng viền ảnh) cho ảnh sân trên / Seko; camera PnP đo độ cao kém
(Seko 26,25 m, san-tren 24,33 m trong khi DOM20 mặt sân ≈ 27,4 m) → so-anh-that nâng bù lên mặt sân mô hình, khung còn lệch ×0,85–0,91 và 45–82 px.
Cách làm: viền trời ẢNH (troi_anh, quét từng cột) ↔ viền trời DOM20 bắn tia từ camera thử (Dom.vien). Dò toạ độ (yaw, pitch, roll, fov, cao, x, z) bằng
dò từng trục thô → mịn, dò theo lệch trung bình chặn trần (trơn), thước = khoảng cách 2D viền DOM20 → viền ảnh (sườn mái dốc không bị phạt oan), nhận camera khi trung vị ≤ 10 px. Camera đứng phải trên mặt DOM20 (mắt ≥ mặt + 1,2 m).
Chạy: ~/.venvs/castle-khop/bin/python apps/castle/scripts/khop-camera-dom.py <thư mục so-anh-that>/<nhãn> [--ten <tên ảnh,…>] [--ghi]
  in camera cũ / mới + điểm; --ghi = ghi vào du-lieu (neuschwanstein-do-anh.json .anh[tep].camera + x/z, hoặc tệp bố cục có anh.tep = tệp ảnh).
Tự kiểm: --tu-kiem (camera giả lệch biết trước trên DOM20 → dò về đúng trong 0,3° / 0,5 m)."""
import sys, json, math, pathlib, importlib.util
import numpy as np, cv2

GOC = pathlib.Path(__file__).resolve().parent.parent
sp = importlib.util.spec_from_file_location('so_anh_that', GOC / 'scripts' / 'so-anh-that.py'); S = importlib.util.module_from_spec(sp); sp.loader.exec_module(S)
D = S.DOM


def ma_tran(x, y, z, yaw, pitch, roll):
    """three.js Euler 'YXZ' → matrixWorld (cột chính, 16 số) như so-anh-that ghi"""
    cy, sy, cx, sx, cz, sz = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]); Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    R = Ry @ Rx @ Rz; M = np.eye(4); M[:3, :3] = R; M[:3, 3] = (x, y, z); return M.T.ravel().tolist()


def euler(m):
    """matrixWorld → (x, y, z, yaw, pitch, roll) — nghịch đảo ma_tran (YXZ)"""
    M = np.array(m).reshape(4, 4).T; R = M[:3, :3]; pitch = math.asin(max(-1, min(1, -R[1, 2])))
    return (*M[:3, 3].tolist(), math.atan2(R[0, 2], R[2, 2]), pitch, math.atan2(R[1, 0], R[1, 1]))


CI = np.float32([[1, 0, 0], [0, 1, 0]])


def vien_dom(c, W, H, xs):
    d = {'W': W, 'H': H, 'fov': c[6], 'm': ma_tran(*c[:6])}
    return D.vien(d, xs, CI, np.full(len(xs), H))


ban_khoang = S.ban_khoang  # một thước 2D cho cả dò camera lẫn nhân chứng DOM20 của so-anh-that


def lech(c, W, H, xs, dt):
    """khoảng cách 2D từng cột viền DOM20 tới viền ảnh; cột DOM20 không thấy viền → NaN"""
    vD = vien_dom(c, W, H, xs); ok = (vD >= 0) & (vD < H); e = np.full(len(xs), np.nan); e[ok] = dt[vD[ok].astype(int), xs[ok]]; return e


def diem(c, W, H, xs, dt, tol):
    """(khớp = tỉ lệ cột lệch 2D ≤ tol, J = lệch trung bình chặn trần 8 % khung — hàm trơn để dò; cột không biết tính bằng trần)"""
    e = lech(c, W, H, xs, dt); ok = ~np.isnan(e); tran = 0.08 * H
    if ok.sum() < 0.4 * len(xs): return 0.0, tran
    return float((e[ok] <= tol).sum() / len(xs)), float((np.minimum(e[ok], tran).sum() + tran * (~ok).sum()) / len(xs))


def trung_vi(c, W, H, xs, dt):
    """lệch 2D trung vị (px) — thước nhận camera (≤ 10 px); chóp nhọn mảnh / tán cây chỉ làm lệch vài cột lẻ"""
    e = lech(c, W, H, xs, dt); return float(np.nanmedian(e)) if (~np.isnan(e)).sum() >= 0.4 * len(xs) else float('inf')


def dung_tren_dat(c):
    h = D.cao(np.array([c[0]], float), np.array([c[2]], float))[0]
    return np.isnan(h) or c[1] >= h + 1.2


def mat_dat(x, z):
    """mặt DOM20 dưới chỗ đứng: trung vị ô 3 × 3 m (mép tường / lan can không kéo lệch); không biết → NaN"""
    g = np.array([(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1)], float); return float(np.nanmedian(D.cao(x + g[:, 0], z + g[:, 1])))


TRUC = ((3, 4, 6, 5), (3, 4, 6, 5, 0, 2))  # chặng 1: yaw, ngẩng, ống, nghiêng · chặng 2: thêm x, z — cao không dò riêng: luôn = mặt DOM20 dưới chân + 1,6 m


def khop(c0, W, H, dt, xs, in_=print):
    """dò từng trục, bước giảm dần; c = [x, y, z, yaw, pitch, roll, fov].
    Chỉ viền trời thì cao ↔ ngẩng đổi chỗ được cho nhau (tự kiểm: lệch 0,9 m cao bù bằng 1,2° ngẩng) → không dò cao: người chụp đứng trên mặt →
    cao = mặt DOM20 dưới chân + 1,6 m, dời x / z thì cao đi theo mặt. x / z vẫn dò: ảnh ống hẹp (sân trên, fov ~30°) PnP lệch vài mét là viền lệch 30 px.
    Hai chặng: dò x / z cùng lúc với góc ngay từ đầu thì rơi cực tiểu giả (tự kiểm lệch 1°) → góc trước, x / z sau khi góc đã về gần."""
    tol = max(4, round(0.01 * H)); c = list(c0); f, md = diem(c, W, H, xs, dt, tol); in_(f'   bắt đầu: khớp {f * 100:.0f} % · lệch TB {md:.1f} px')
    for chang, truc in enumerate(TRUC):
      buoc = [1.5, 2.0, 1.5, math.radians(2), math.radians(2), math.radians(1.5), 4.0]
      for vong in range(6):
        tot_hon = True
        while tot_hon:
            tot_hon = False
            for i in truc:
                for dau in (-1, 1):
                    t = list(c); t[i] += dau * buoc[i]
                    if i in (0, 2):
                        h = mat_dat(t[0], t[2])
                        if not np.isnan(h): t[1] = h + 1.6
                    if t[6] < 10 or t[6] > 90 or not dung_tren_dat(t): continue
                    ft, mt = diem(t, W, H, xs, dt, tol)
                    if mt < md - 0.05: c, f, md, tot_hon = t, ft, mt, True; break
        buoc = [b / 2 for b in buoc]
        in_(f'   chặng {chang + 1} vòng {vong + 1}: khớp {f * 100:.0f} % · lệch TB {md:.1f} px · cao {c[1]:.2f} · fov {c[6]:.1f}')
    return c, f, md


def vien_anh(d, thu):
    anh = cv2.resize(cv2.imread(d['anh']), (d['W'], d['H']), interpolation=cv2.INTER_AREA)
    sau = S.giai_sau(thu / f"{d['ten']}-sau.png", d['xa']); troiM = (sau <= 1e-6) | (sau >= 0.999 * d['xa'])
    return S.vien(S.troi_anh(anh, troiM, S.vien(troiM)))


def ghi(d, c, f, md, tv):
    """ghi camera mới về đúng chỗ camera ảnh đang nằm (cùng chỗ so-anh-that.mjs đọc)"""
    du = GOC / 'public/du-lieu'; x, y, z, yaw, pitch, roll, fov = c
    moi = {'y': round(y, 2), 'yaw': round(yaw, 4), 'pitch': round(pitch, 4), 'roll': round(roll, 4), 'fov': round(fov, 1)}
    nguon = f'scripts/khop-camera-dom.py (viền trời ảnh ↔ viền trời DOM20, 23/11/2026): lệch 2D trung vị {tv:.1f} px, {f * 100:.0f} % cột trong 1 % khung'
    for p in sorted(du.glob('*.json')):
        try: j = json.loads(p.read_text())
        except Exception: continue
        if not isinstance(j, dict): continue
        if isinstance(j.get('anh'), dict) and isinstance(j['anh'].get(d['tep']), dict) and 'camera' in j['anh'][d['tep']]:
            a = j['anh'][d['tep']]; a['camera'] = {**a['camera'], **moi, 'nguon': nguon}; a['x'], a['z'] = round(x, 2), round(z, 2)
        elif isinstance(j.get('anh'), dict) and j['anh'].get('tep') == d['tep'] and 'camera' in j['anh']:
            cu = {k: v for k, v in j['anh']['camera'].items() if k not in ('lech_px', 'tach_m', 'kiem', 'dung')}  # số đo của lượt khớp cũ (khop-lg) — không còn đúng camera mới
            j['anh']['camera'] = {**cu, **moi, 'x': round(x, 4), 'z': round(z, 4), 'nguon': nguon}
        else: continue
        p.write_text(json.dumps(j, ensure_ascii=False, indent=1) + '\n'); return p
    return None


def chay(thu, chon, lam_ghi):
    meta = json.loads((thu / 'ds.json').read_text())
    for d in meta['ds']:
        if chon and d['ten'] not in chon: continue
        W, H = d['W'], d['H']; dt = ban_khoang(vien_anh(d, thu), W, H); xs = np.arange(4, W - 4, max(4, W // 90))
        x, y, z, yaw, pitch, roll = euler(d['m']); h = mat_dat(x, z); y0 = y
        if not np.isnan(h) and abs(y - (h + 1.6)) > 0.3: y = h + 1.6  # mắt người đứng trên mặt thật
        c0 = [x, y, z, yaw, pitch, roll, d['fov']]
        print(f"{d['ten']}: camera cũ cao {y0:.2f} (DOM20 mặt {h:.2f} → cao {y:.2f}) · yaw {yaw:.4f} · ngẩng {pitch:.4f} · nghiêng {roll:.4f} · fov {d['fov']}")
        c, f, md = khop(c0, W, H, dt, xs); tv0, tv = trung_vi(c0, W, H, xs, dt), trung_vi(c, W, H, xs, dt)
        if tv > S.CAM_TV:  # dò từng trục rơi cực tiểu giả (san-tren: lượt này fov 24 → 21,8 px, lượt trước fov 32 → 10 px) → thử thêm điểm xuất phát
            g = math.radians(4)
            for k, dc in enumerate(((0, 0, 0.85), (0, 0, 1.15), (0, g, 1), (0, -g, 1), (g, 0, 1), (-g, 0, 1))):
                s0 = list(c0); s0[3] += dc[0]; s0[4] += dc[1]; s0[6] *= dc[2]
                ct, ft, mt = khop(s0, W, H, dt, xs, in_=lambda *_: None); tt = trung_vi(ct, W, H, xs, dt)
                print(f'   xuất phát {k + 1}/6: lệch 2D trung vị {tt:.1f} px · fov {ct[6]:.1f}')
                if tt < tv: c, f, md, tv = ct, ft, mt, tt
        print(f"   lệch 2D trung vị {tv0:.1f} → {tv:.1f} px (ngưỡng nhận {S.CAM_TV} px)")
        print(f"   → camera mới ({c[0]:.2f}, {c[1]:.2f}, {c[2]:.2f}) yaw {c[3]:.4f} · ngẩng {c[4]:.4f} · nghiêng {c[5]:.4f} · fov {c[6]:.1f} · khớp {f * 100:.0f} % · lệch TB {md:.1f} px")
        if lam_ghi:
            if tv > S.CAM_TV: print(f'   KHÔNG ghi: lệch 2D trung vị > {S.CAM_TV} px — viền trời ảnh hoặc DOM20 không đủ tin'); continue
            p = ghi(d, c, f, md, tv); print(f'   ghi → {p}' if p else '   KHÔNG tìm thấy chỗ ghi camera của ảnh này')


def tu_kiem():
    """camera thật biết trước trên sân trên → viền DOM20 làm "ảnh"; camera lệch yaw 3°, ngẩng 2°, ống +5° → dò về trong 0,3°"""
    W, H = 400, 300; xs = np.arange(4, W - 4, 6); that = [14.1, 29.3, 0.6, 1.83, 0.5, 0.0, 30.0]
    assert abs(euler(ma_tran(*that[:6]))[3] - 1.83) < 1e-9 and abs(euler(ma_tran(*that[:6]))[4] - 0.5) < 1e-9, 'khứ hồi Euler'
    xa = np.arange(W); vA = vien_dom(that, W, H, xa); vA[vA < 0] = H; assert (vA < H).mean() > 0.3, 'DOM20 không thấy gì từ camera thử'
    c, f, _ = khop([14.1, 29.3, 0.6, 1.83 + math.radians(3), 0.5 - math.radians(2), 0.0, 35.0], W, H, ban_khoang(vA, W, H), xs, in_=lambda *_: None)
    lech_g = max(abs(c[3] - that[3]), abs(c[4] - that[4])); print(f'tự kiểm: khớp {f * 100:.0f} % · lệch góc {math.degrees(lech_g):.2f}° · cao {c[1] - that[1]:+.2f} m · fov {c[6] - that[6]:+.1f}')
    assert f > 0.9 and math.degrees(lech_g) < 0.3 and abs(c[1] - that[1]) < 0.5, 'dò không về camera thật'
    print('khop-camera-dom: tự kiểm đạt')


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--tu-kiem' in a: tu_kiem(); sys.exit(0)
    ten = a[a.index('--ten') + 1].split(',') if '--ten' in a else []
    chay(pathlib.Path(a[0]), set(ten), '--ghi' in a)
