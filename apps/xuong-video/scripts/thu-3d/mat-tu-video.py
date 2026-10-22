# DIỄN MẶT TỪ VIDEO NGƯỜI THẬT → hệ số ARKit theo từng khung (anh 22/10/2026: "diễn cảnh buồn, khóc, cười"). 0đ, chạy trên máy:
# MediaPipe Face Landmarker (Google) trả đúng 52 blendshape tên ARKit → đổ thẳng vào thanh trượt rig['…'] của mọi nhân vật (người MPFB lẫn thú
# rig/mat_hoat_hinh.py) — một bản diễn lái được mọi mặt. Kèm xoay đầu (gật / lắc / nghiêng, độ) từ ma trận biến đổi mặt.
#   ~/.venvs/mediapipe/bin/python -I mat-tu-video.py <video.mp4> <ra.json> [--tu=giây] [--den=giây]
# Mô hình: tai-san/mediapipe/face_landmarker.task (storage.googleapis.com/mediapipe-models/face_landmarker/…/float16/1/).
import sys, os, json, math
import cv2, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions

a = sys.argv[1:]; VAO, RA = a[0], a[1]
opt = {x.lstrip('-').split('=')[0]: float(x.split('=')[1]) for x in a[2:] if '=' in x}
MO = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tai-san', 'mediapipe', 'face_landmarker.task')
lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=MO), running_mode=vision.RunningMode.VIDEO, num_faces=1,
    output_face_blendshapes=True, output_facial_transformation_matrixes=True))
cap = cv2.VideoCapture(VAO); fps = cap.get(cv2.CAP_PROP_FPS) or 25
tu, den = opt.get('tu', 0), opt.get('den', 1e9)
khung, i, mat = [], 0, 0
while True:
    ok, im = cap.read()
    if not ok: break
    t = i / fps; i += 1
    if t < tu or t > den: continue
    r = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)), int(t * 1000))
    if not r.face_blendshapes: khung.append(None); mat += 1; continue
    bs = {c.category_name: round(c.score, 3) for c in r.face_blendshapes[0] if c.category_name != '_neutral'}
    m = r.facial_transformation_matrixes[0]   # 4×4, cột 0..2 = trục xoay đầu
    bs['_gat'] = round(math.degrees(math.atan2(m[2][1], m[2][2])), 1)      # gật (quanh x)
    bs['_lac'] = round(math.degrees(math.asin(max(-1, min(1, -m[2][0])))), 1)   # lắc (quanh y)
    bs['_nghieng'] = round(math.degrees(math.atan2(m[1][0], m[0][0])), 1)  # nghiêng (quanh z)
    khung.append(bs)
# khung mất mặt: lấy khung gần nhất (bản diễn liền, không giật về 0)
for k in range(len(khung)):
    if khung[k] is None: khung[k] = next((khung[j] for d in range(1, len(khung)) for j in (k - d, k + d) if 0 <= j < len(khung) and khung[j]), {})
json.dump({'nguon': os.path.basename(VAO), 'fps': fps, 'tu': tu, 'khung': khung}, open(RA, 'w'))
dinh = {k: max(f.get(k, 0) for f in khung) for k in ('jawOpen', 'mouthSmileLeft', 'mouthFrownLeft', 'browInnerUp', 'eyeBlinkLeft', 'eyeSquintLeft')}
print('RA', RA, '| khung', len(khung), '| mất mặt', mat, '| đỉnh', dinh)
