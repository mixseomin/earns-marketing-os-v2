#!/opt/xv-camxuc/bin/python
# MÁY ĐO CẢM XÚC clip (0đ, CPU box3) — phần ĐO của Murch QC tự chấm; phần XÉT (so với kế hoạch biểu cảm) ở qc-cam-xuc.ts › chamMay.
# Dò mặt (YuNet) → nhận người theo ảnh mẫu (SFace) → cảm xúc 8 lớp (HSEmotion enet_b2_8) + valence/arousal (enet_b0_8_va_mtl).
# Môi trường: /opt/xv-camxuc (uv venv Python 3.12 + onnxruntime + opencv-python-headless), mô hình ở /opt/xv-camxuc/models.
# Vào (stdin JSON): { "nv": [{ "ten", "anh": [url…] }], "clips": [{ "id", "url", "phat"?, "truoc_url"? }], "khung"?: 10 }
# Ra (stdout JSON): { "<id>": { "dai", "khung": [{ "t", "mat": [{ "ten", "sim", "sims": {tên: cos}, "w", "emo": {lớp: xác suất}, "val", "aro" }] }], "noi"?: { "lech" } } }
import json, sys, os, urllib.request, tempfile
import numpy as np, cv2, onnxruntime as ort

M = '/opt/xv-camxuc/models'
LOP = ['Anger', 'Contempt', 'Disgust', 'Fear', 'Happiness', 'Neutral', 'Sadness', 'Surprise']
NGUONG_NGUOI = 0.30   # cosine SFace: ≥ 0.363 là cùng người theo OpenCV; AI vẽ lại mặt mỗi khung nên hạ nhẹ, lấy người khớp nhất
cv2.setNumThreads(2)
emo8 = ort.InferenceSession(f'{M}/enet_b2_8.onnx', providers=['CPUExecutionProvider'])
emoVa = ort.InferenceSession(f'{M}/enet_b0_8_va_mtl.onnx', providers=['CPUExecutionProvider'])
nhan = cv2.FaceRecognizerSF.create(f'{M}/sface.onnx', '')
_do = {}


def do_mat(img):
    h, w = img.shape[:2]
    if (w, h) not in _do:
        _do[(w, h)] = cv2.FaceDetectorYN.create(f'{M}/yunet.onnx', '', (w, h), 0.6, 0.3, 50)
    _, f = _do[(w, h)].detect(img)
    return [] if f is None else list(f)


def chuan(img, s):
    x = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), (s, s)).astype(np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    return x.transpose(2, 0, 1).astype(np.float32)[None]


def softmax(x):
    e = np.exp(x - x.max()); return e / e.sum()


def tai_anh(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return cv2.imdecode(np.frombuffer(r.read(), np.uint8), cv2.IMREAD_COLOR)


def tai_tep(url):
    p = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False).name
    urllib.request.urlretrieve(url, p)
    return p


def khung_tai(cap, t):
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0, t) * 1000)
    ok, img = cap.read()
    return img if ok else None


def dai(cap):
    n, fps = cap.get(cv2.CAP_PROP_FRAME_COUNT), cap.get(cv2.CAP_PROP_FPS) or 24
    return n / fps if n > 0 else 0


def dac_trung(img, f):
    return nhan.feature(nhan.alignCrop(img, f))


def main():
    vao = json.load(sys.stdin)
    mau = []   # (tên, đặc trưng) — mỗi ảnh mẫu lấy mặt lớn nhất
    for v in vao.get('nv', []):
        for u in v.get('anh', [])[:3]:
            try:
                img = tai_anh(u); fs = do_mat(img)
                if fs: mau.append((v['ten'], dac_trung(img, max(fs, key=lambda f: f[2] * f[3]))))
            except Exception as e:
                print(f'ảnh mẫu {v["ten"]}: {e}', file=sys.stderr)
    so_khung = int(vao.get('khung', 10))
    ra = {}
    for c in vao['clips']:
        tep = tai_tep(c['url']); cap = cv2.VideoCapture(tep)
        d = dai(cap); phat = min(c.get('phat') or d, d) if d else (c.get('phat') or 4)
        ds = []
        for i in range(so_khung):
            t = round(phat * i / (so_khung - 1) * 0.985, 2)
            img = khung_tai(cap, t)
            if img is None: continue
            mats = []
            for f in do_mat(img):
                x, y, w, h = [int(v) for v in f[:4]]
                if w < 28: continue   # mặt quá nhỏ (người nền) — không đọc nổi nét
                ft = dac_trung(img, f)
                ten, sim, sims = None, 0.0, {}
                for tn, m in mau:
                    s = float(nhan.match(ft, m, cv2.FaceRecognizerSF_FR_COSINE))
                    sims[tn] = round(max(sims.get(tn, -1), s), 3)
                    if s > sim: ten, sim = tn, s
                if sim < NGUONG_NGUOI: ten = None
                pad = int(0.08 * w)
                crop = img[max(0, y - pad):y + h + pad, max(0, x - pad):x + w + pad]
                if crop.size == 0: continue
                p8 = softmax(emo8.run(None, {'input': chuan(crop, 260)})[0][0])
                va = emoVa.run(None, {'input': chuan(crop, 224)})[0][0]
                mats.append({'ten': ten, 'sim': round(sim, 3), 'sims': sims, 'w': w, 'emo': {LOP[k]: round(float(p8[k]), 3) for k in range(8)},
                             'val': round(float(va[-2]), 3), 'aro': round(float(va[-1]), 3)})
            ds.append({'t': t, 'mat': mats})
        kq = {'khung': ds, 'dai': round(d, 2)}
        # Nối liền: khung cuối clip trước ↔ khung đầu clip này (xám 72×128, lệch tuyệt đối trung bình 0…255).
        if c.get('truoc_url'):
            try:
                tp = tai_tep(c['truoc_url']); cp = cv2.VideoCapture(tp)
                a = khung_tai(cp, dai(cp) - 0.06); b = khung_tai(cap, 0)
                if a is not None and b is not None:
                    g = lambda im: cv2.resize(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (72, 128)).astype(np.float32)
                    kq['noi'] = {'lech': round(float(np.abs(g(a) - g(b)).mean()), 2)}
                cp.release(); os.unlink(tp)
            except Exception as e:
                print(f'nối {c["id"]}: {e}', file=sys.stderr)
        cap.release(); os.unlink(tep)
        ra[str(c['id'])] = kq
    json.dump(ra, sys.stdout, ensure_ascii=False)


main()
