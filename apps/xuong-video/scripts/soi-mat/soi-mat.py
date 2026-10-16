#!/usr/bin/env python3
# SOI MẶT (chuẩn bị phim người thật — anh 16/10/2026 "nhân vật làm sao giữ được đúng khuôn mặt"): so mặt trong keyframe với ảnh mẫu nhân vật.
# OpenCV YuNet (tìm mặt) + SFace (vân mặt 128 chiều), chạy CPU trên máy chủ, 0đ. Ngưỡng cosine 0,363 = ngưỡng cùng người OpenCV công bố cho SFace.
#   stdin  {"mau": {"<tên>": ["<url ảnh mẫu>", …]}, "anh": [{"id": 1, "url": "<keyframe>", "ten": ["<tên phải có mặt>", …]}]}
#   stdout {"mau": {"<tên>": <số ảnh mẫu có mặt>}, "anh": [{"id": 1, "mat": <số mặt tìm thấy>, "ket": [{"ten", "giong", "dat"}]}]}
# Nhân vật mà ảnh mẫu không có mặt người (hoạt hình, đồ vật) → không theo dõi (không có trong ket). Tự kiểm: soi-mat.py --tu-kiem <ảnh A> <ảnh B>
import json, os, sys, urllib.request
import numpy as np, cv2

MO = os.environ.get('XV_SOI_MAT_MO', '/opt/xv-soi-mat/models')
NGUONG = 0.363
cv2.setLogLevel(2) if hasattr(cv2, 'setLogLevel') else None
det = cv2.FaceDetectorYN.create(f'{MO}/face_detection_yunet_2023mar.onnx', '', (320, 320), 0.8, 0.3, 5000)
rec = cv2.FaceRecognizerSF.create(f'{MO}/face_recognition_sface_2021dec.onnx', '')

def doc(u):
    if os.path.exists(u): b = open(u, 'rb').read()
    else: b = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'xv-soi-mat'}), timeout=30).read()
    im = cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)
    if im is None: raise ValueError(f'không đọc được ảnh {u}')
    s = 1280 / max(im.shape[:2])
    return cv2.resize(im, None, fx=s, fy=s) if s < 1 else im

def van(im):
    """Vân mặt của mọi mặt trong ảnh (to trước)."""
    det.setInputSize((im.shape[1], im.shape[0])); _, f = det.detect(im)
    if f is None: return []
    f = sorted(f, key=lambda x: -x[2] * x[3])
    return [rec.feature(rec.alignCrop(im, x)).flatten() for x in f]

def cos(a, b): return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

if len(sys.argv) == 4 and sys.argv[1] == '--tu-kiem':
    a, b = van(doc(sys.argv[2])), van(doc(sys.argv[3]))
    print(json.dumps({'mat_a': len(a), 'mat_b': len(b), 'giong': round(cos(a[0], b[0]), 3) if a and b else None})); sys.exit(0)

vao = json.load(sys.stdin); ra = {'mau': {}, 'anh': []}
mau = {}
for ten, urls in vao.get('mau', {}).items():
    vs = []
    for u in urls:
        try: v = van(doc(u))
        except Exception as e: print(f'bỏ ảnh mẫu {u}: {e}', file=sys.stderr); continue
        if v: vs.append(v[0])   # ảnh mẫu: mặt to nhất là nhân vật
    ra['mau'][ten] = len(vs)
    if vs: mau[ten] = vs
for a in vao.get('anh', []):
    try: mat = van(doc(a['url']))
    except Exception as e: ra['anh'].append({'id': a['id'], 'loi': str(e)}); continue
    # GÁN mỗi mặt cho TỐI ĐA một nhân vật (cặp giống nhất trước): shot qua vai thấy lưng A + mặt B thì A không thấy mặt (giong null, không lệch),
    # không phải "mặt B không giống A". Nhân vật được gán một mặt dưới ngưỡng = mặt lệch ảnh mẫu (AI vẽ người khác).
    ten = [t for t in a.get('ten', []) if t in mau]
    cap = sorted(((max(cos(m, r) for r in mau[t]), i, t) for i, m in enumerate(mat) for t in ten), reverse=True)
    gan, dung = {}, set()
    for g, i, t in cap:
        if t in gan or i in dung: continue
        gan[t] = g; dung.add(i)
    ket = [{'ten': t, 'giong': round(gan[t], 3) if t in gan else None, 'dat': t not in gan or gan[t] >= NGUONG} for t in ten]
    ra['anh'].append({'id': a['id'], 'mat': len(mat), 'ket': ket})
print(json.dumps(ra, ensure_ascii=False))
