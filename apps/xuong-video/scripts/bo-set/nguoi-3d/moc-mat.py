# 5 ĐIỂM MỐC MẶT (YuNet: mắt phải, mắt trái, mũi, khoé miệng phải, khoé miệng trái — theo ảnh) của ảnh người toàn thân → JSON tỉ lệ ảnh (0..1).
# gan-rig.py dùng để CĂN mặt MPFB trùng mặt da trước khi nướng biểu cảm (mắt da lệch mắt MPFB → cười kéo xuống cằm). Chạy bằng venv soi mặt trên
# máy chủ (soi-mat/cai.sh):  ssh box '/opt/xv-soi-mat/bin/python - /tmp/anh.png' < moc-mat.py
import sys, json, cv2
im = cv2.imread(sys.argv[1]); H, W = im.shape[:2]
det = cv2.FaceDetectorYN.create('/opt/xv-soi-mat/models/face_detection_yunet_2023mar.onnx', '', (W, H), 0.6, 0.3, 5000)
for k in (1, 2, 3):   # mặt nhỏ trong ảnh toàn thân: phóng ảnh lên cho YuNet thấy
    det.setInputSize((W * k, H * k)); _, f = det.detect(cv2.resize(im, (W * k, H * k)) if k > 1 else im)
    if f is not None and len(f): break
if f is None or not len(f): print(json.dumps({'loi': 'không thấy mặt'})); sys.exit(0)
f = [float(x) for x in max(f, key=lambda r: r[14]) / k]
print(json.dumps({'mat_p': [f[4] / W, f[5] / H], 'mat_t': [f[6] / W, f[7] / H], 'mui': [f[8] / W, f[9] / H], 'mieng_p': [f[10] / W, f[11] / H], 'mieng_t': [f[12] / W, f[13] / H]}))
