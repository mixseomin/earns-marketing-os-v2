#!/usr/bin/env python3
# ĐO EYE TRACE CỦA PHIM MẪU (anh 26/10/2026: học ReelShort mà "cái liền mạch eyetrace đéo thấy mày nói"). 0đ, chạy CPU.
# Mỗi cú cắt: khung ngay TRƯỚC và ngay SAU cắt → mặt to nhất (chỗ mắt người xem bám) → điểm giữa hai mắt (0..1 theo bề ngang / cao khung).
# Báo: độ dịch điểm nhìn qua cú cắt (đơn vị = bề ngang khung) so với nền ngẫu nhiên (ghép bừa điểm trước / sau của các cú cắt khác) — dịch
# nhỏ hơn hẳn nền = người dựng CỐ Ý đặt mặt shot sau đúng chỗ mắt đang nhìn ở shot trước. Phim của studio đo bằng diem-nhin-tap.ts (cùng ý, gắn xuất).
#   python do-diem-nhin-mau.py <video> [--mo <thư mục chứa face_detection_yunet_2023mar.onnx>] [--anh <ra.jpg>] [--json <ra.json>]
# Cần opencv-python + numpy + ffmpeg. Mô hình: box3 /opt/xv-soi-mat/models (cùng mô hình scripts/soi-mat/soi-mat.py).
import argparse, json, math, os, random, re, subprocess, sys, tempfile
import numpy as np, cv2

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('--mo', default='/opt/xv-soi-mat/models'); ap.add_argument('--anh'); ap.add_argument('--json')
ap.add_argument('--nguong', type=float, default=0.3)
a = ap.parse_args()
det = cv2.FaceDetectorYN.create(f'{a.mo}/face_detection_yunet_2023mar.onnx', '', (320, 320), 0.8, 0.3, 5000)

def tim_mat(im):
    """Mặt to nhất (người xem nhìn vào nó trước). Thử 1, 1/2, 1/3 cỡ ảnh — YuNet bỏ sót mặt quá to (cùng cách soi-mat.py)."""
    for s in (1.0, 0.5, 0.33):
        x = im if s == 1.0 else cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        det.setInputSize((x.shape[1], x.shape[0])); _, f = det.detect(x)
        if f is not None and len(f):
            f = f.copy(); f[:, :14] /= s
            m = max(f, key=lambda r: r[2] * r[3])
            return ((m[4] + m[6]) / 2 / im.shape[1], (m[5] + m[7]) / 2 / im.shape[0], m[3] / im.shape[0])   # giữa hai mắt + cao mặt
    return None

dai = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.video], capture_output=True, text=True).stdout)
r = subprocess.run(['ffmpeg', '-i', a.video, '-vf', f"select='gt(scene,{a.nguong})',showinfo", '-f', 'null', '-'], capture_output=True, text=True).stderr
cat = [float(x) for x in re.findall(r'pts_time:([0-9.]+)', r)]
W = H = None; thu = tempfile.mkdtemp()

def khung(t, ten):
    f = f'{thu}/{ten}.jpg'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{max(0, t):.3f}', '-i', a.video, '-frames:v', '1', '-q:v', '3', f])
    return cv2.imread(f)

ds = []
for i, t in enumerate(cat):
    if t < 0.3 or t > dai - 0.3: continue
    A, B = khung(t - 0.12, f'{i}a'), khung(t + 0.12, f'{i}b')
    if A is None or B is None: continue
    H, W = A.shape[:2]
    ds.append({'t': round(t, 2), 'truoc': tim_mat(A), 'sau': tim_mat(B), 'fa': f'{thu}/{i}a.jpg', 'fb': f'{thu}/{i}b.jpg'})

def lech(p, q): return math.hypot(p[0] - q[0], (p[1] - q[1]) * H / W)   # đơn vị: bề ngang khung
hai = [d for d in ds if d['truoc'] and d['sau']]
that = sorted(lech(d['truoc'], d['sau']) for d in hai)
random.seed(1); nen = []
for _ in range(20):
    sau = [d['sau'] for d in hai]; random.shuffle(sau); nen += [lech(d['truoc'], s) for d, s in zip(hai, sau)]
nen.sort()
tv = lambda x: x[len(x) // 2] if x else float('nan')
ty = lambda x, n: sum(v <= n for v in x) / len(x) if x else float('nan')
kq = {'video': os.path.basename(a.video), 'cat': len(ds), 'mat_mat': len(hai), 'trung_vi': round(tv(that), 3), 'nen_trung_vi': round(tv(nen), 3),
      'duoi_0_1': round(ty(that, 0.1), 2), 'duoi_0_2': round(ty(that, 0.2), 2), 'nen_duoi_0_2': round(ty(nen, 0.2), 2),
      'ngang_tb': round(float(np.mean([d['truoc'][0] for d in hai] + [d['sau'][0] for d in hai])), 3) if hai else None,
      'doc_tb': round(float(np.mean([d['truoc'][1] for d in hai] + [d['sau'][1] for d in hai])), 3) if hai else None}
print(json.dumps(kq, ensure_ascii=False))
if a.json: json.dump({**kq, 'cat_chi_tiet': [{k: v for k, v in d.items() if k not in ('fa', 'fb')} for d in ds]}, open(a.json, 'w'), default=float)
if a.anh and hai:   # tờ soát: 8 cú cắt mặt → mặt, mỗi cặp trước | sau, chấm đỏ = điểm nhìn trước, xanh = sau (vẽ cả hai lên khung sau)
    o = []
    for d in hai[:: max(1, len(hai) // 8)][:8]:
        x, y = cv2.imread(d['fa']), cv2.imread(d['fb'])
        for im in (x, y): cv2.circle(im, (int(d['truoc'][0] * W), int(d['truoc'][1] * H)), 18, (0, 0, 255), -1)
        cv2.circle(y, (int(d['sau'][0] * W), int(d['sau'][1] * H)), 18, (255, 160, 0), -1)
        o.append(cv2.resize(np.hstack([x, y]), (360, 320)))
    cv2.imwrite(a.anh, np.vstack([np.hstack(o[i:i + 4]) for i in range(0, len(o) - len(o) % 4 or len(o), 4)] if len(o) >= 4 else [np.hstack(o)]))
