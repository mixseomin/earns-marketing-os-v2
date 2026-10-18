#!/usr/bin/env python3
# SOI MẶT (chuẩn bị phim người thật — anh 16/10/2026 "nhân vật làm sao giữ được đúng khuôn mặt"): so mặt trong keyframe với ảnh mẫu nhân vật.
# OpenCV YuNet (tìm mặt) + SFace (vân mặt 128 chiều), chạy CPU trên máy chủ, 0đ. Ngưỡng cosine 0,363 = ngưỡng cùng người OpenCV công bố cho SFace.
#   stdin  {"mau": {"<tên>": ["<url ảnh mẫu>", …]}, "anh": [{"id": 1, "url": "<keyframe>", "ten": ["<tên phải có mặt>", …]}]}
#   stdout {"mau": {"<tên>": <số ảnh mẫu có mặt>}, "anh": [{"id": 1, "mat": <số mặt tìm thấy>, "ket": [{"ten", "giong", "dat"}]}]}
# Nhân vật mà ảnh mẫu không có mặt người (hoạt hình, đồ vật) → không theo dõi (không có trong ket). Tự kiểm: soi-mat.py --tu-kiem <ảnh A> <ảnh B>
import base64, json, os, sys, urllib.request
import numpy as np, cv2

MO = os.environ.get('XV_SOI_MAT_MO', '/opt/xv-soi-mat/models')
NGUONG = 0.363
NHO = 64   # mặt thấp dưới 64 px: SFace (đầu vào 112 px) chấm không tin được, người xem cũng khó nhận — ghi 'nho', không chặn (Jett #11)
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

def nghieng(x):
    """Mặt QUAY NGHIÊNG nhiều (từ 5 điểm mốc YuNet: hai mắt + mũi): khoảng hai mắt hẹp so với bề rộng mặt, hoặc mũi lệch hẳn khỏi giữa hai mắt.
    Bộ so mặt (SFace) chỉ tin được với mặt gần chính diện — Jett #11 Frank cười nghiêng: cả bản gốc lẫn bản sửa đều 27–37%, mắt người thấy đúng người."""
    re_, le_, mu = x[4:6], x[6:8], x[8:10]; d = abs(le_[0] - re_[0]) + 1e-6
    return bool(d / x[2] < 0.26 or abs(mu[0] - (re_[0] + le_[0]) / 2) / d > 0.5)   # đo Jett 16/10: chính diện 0,37–0,51 / mũi 0,11–0,27; nghiêng ≤ 0,25 / ≥ 0,55

def van(im, ti_mat=0.4, ti_khung=0.0):
    """Vân các mặt ĐỦ LỚN trong ảnh (to trước): cao ≥ ti_mat × mặt lớn nhất và ≥ ti_khung × chiều cao ảnh — người qua đường nhỏ ở nền bỏ qua
    (Jett #12: cận cạp quần, mặt khách tí xíu phía sau bị gán cho Frank)."""
    det.setInputSize((im.shape[1], im.shape[0])); _, f = det.detect(im)
    if f is None: return []
    f = sorted(f, key=lambda x: -x[3]); h0 = f[0][3]
    return [(rec.feature(rec.alignCrop(im, x)).flatten(), float(x[3]), x[:4], nghieng(x)) for x in f if x[3] >= ti_mat * h0 and x[3] >= ti_khung * im.shape[0]]

def cos(a, b): return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

if len(sys.argv) == 4 and sys.argv[1] == '--tu-kiem':
    a, b = van(doc(sys.argv[2])), van(doc(sys.argv[3]))
    print(json.dumps({'mat_a': len(a), 'mat_b': len(b), 'giong': round(cos(a[0][0], b[0][0]), 3) if a and b else None, 'nghieng': [a[0][3] if a else None, b[0][3] if b else None]})); sys.exit(0)

def cat_mat(im, hop, co=512):
    """Ảnh cắt SÁT MẶT (cả tóc + cằm, vuông) để kèm vào lượt sinh: mô hình bám mặt tốt hơn khi mặt chiếm nhiều điểm ảnh."""
    x, y, w, h = [float(t) for t in hop]; c = max(w, h) * 1.45; cx, cy = x + w / 2, y + h / 2 - h * 0.1
    x0, y0 = int(max(0, cx - c / 2)), int(max(0, cy - c / 2)); x1, y1 = int(min(im.shape[1], cx + c / 2)), int(min(im.shape[0], cy + c / 2))
    ok, b = cv2.imencode('.jpg', cv2.resize(im[y0:y1, x0:x1], (co, co)), [cv2.IMWRITE_JPEG_QUALITY, 92])
    return base64.b64encode(b.tobytes()).decode() if ok else None

def vung_dau(im, o):
    """Vùng ĐẦU vuông quanh mặt gần điểm o (phần khung) — cắt ra cho mô hình sửa (kiểu face detailer: mặt to → giữ đúng người hơn)."""
    det.setInputSize((im.shape[1], im.shape[0])); _, f = det.detect(im)
    if f is None: return None
    H, W = im.shape[:2]; x, y, w, h = min(f, key=lambda r: ((r[0] + r[2] / 2) / W - o['x']) ** 2 + ((r[1] + r[3] / 2) / H - o['y']) ** 2)[:4]
    c = max(w, h) * 2.6; cx, cy = x + w / 2, y + h / 2 - h * 0.15
    x0, y0 = int(max(0, cx - c / 2)), int(max(0, cy - c / 2)); x1, y1 = int(min(W, x0 + c)), int(min(H, y0 + c))
    return [x0, y0, x1, y1]

def b64jpg(im, q=93):
    ok, b = cv2.imencode('.jpg', im, [cv2.IMWRITE_JPEG_QUALITY, q]); return base64.b64encode(b.tobytes()).decode()

def doc_goc(u):
    """Ảnh ở ĐỘ PHÂN GIẢI GỐC (dán lại phải đúng điểm ảnh của keyframe)."""
    b = open(u, 'rb').read() if os.path.exists(u) else urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'xv-soi-mat'}), timeout=30).read()
    return cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)

vao = json.load(sys.stdin)
if vao.get('op') == 'dem':        # {op, url, nguong} → {mat}: ĐẾM mặt người, ngưỡng tin cậy riêng (0,5) — cổng sau bước 1 keyframe chỉ hỏi "có mặt người không";
    # ngưỡng 0,8 của so mặt bỏ sót mặt ~70 px ở khung rộng (tập 122 #12: ba người, đếm ra 0 → chặn oan)
    im = doc(vao['url']); det.setScoreThreshold(float(vao.get('nguong', 0.5))); det.setInputSize((im.shape[1], im.shape[0])); _, f = det.detect(im)
    print(json.dumps({'mat': 0 if f is None else len(f)})); sys.exit(0)
if vao.get('op') == 'cat_vung':   # {op, url, o:{x,y}} → {hop:[x0,y0,x1,y1] px gốc, b64: vùng đầu 1024²}
    im = doc_goc(vao['url']); hop = vung_dau(im, vao['o'])
    print(json.dumps({'hop': hop, 'b64': b64jpg(cv2.resize(im[hop[1]:hop[3], hop[0]:hop[2]], (1024, 1024))) if hop else None})); sys.exit(0)
if vao.get('op') == 'dan':        # {op, goc, sua, hop} → {b64: khung gốc với vùng đầu đã sửa dán lại, mặt nạ elip mờ biên, khớp màu}
    im = doc_goc(vao['goc']); x0, y0, x1, y1 = vao['hop']; vg = im[y0:y1, x0:x1]
    sua = cv2.resize(doc_goc(vao['sua']), (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA)
    # khớp màu (LAB, trung bình + độ lệch) về vùng gốc — mô hình sửa hay lệch tông nhẹ, dán vào sẽ thành mảng
    a, b = cv2.cvtColor(sua, cv2.COLOR_BGR2LAB).astype(np.float32), cv2.cvtColor(vg, cv2.COLOR_BGR2LAB).astype(np.float32)
    a = (a - a.mean((0, 1))) / (a.std((0, 1)) + 1e-6) * b.std((0, 1)) + b.mean((0, 1))
    sua = cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
    hh, ww = vg.shape[:2]; m = np.zeros((hh, ww), np.float32)
    cv2.ellipse(m, (ww // 2, int(hh * 0.47)), (int(ww * 0.33), int(hh * 0.4)), 0, 0, 360, 1.0, -1)
    k = max(3, int(min(hh, ww) * 0.12) | 1); m = cv2.GaussianBlur(m, (k, k), 0)[..., None]
    im[y0:y1, x0:x1] = (sua * m + vg * (1 - m)).astype(np.uint8)
    print(json.dumps({'b64': b64jpg(im)})); sys.exit(0)
ra = {'mau': {}, 'anh': [], 'cat': {}}
mau = {}
for ten, urls in vao.get('mau', {}).items():
    vs, ung = [], []
    for u in urls:
        try: im = doc(u); v = [x for x in van(im, 0.0) if x[1] >= 40]   # ảnh mẫu: MỌI mặt đủ rõ, kể cả mặt nghiêng nhỏ của dáng toàn thân (Jett #11 Frank cười nghiêng)
        except Exception as e: print(f'bỏ ảnh mẫu {u}: {e}', file=sys.stderr); continue
        vs.extend(x for x, _, _, _ in v[:16])
        ung.extend((x, h, hop, im) for x, h, hop, ng in v[:16] if h >= 80 and not ng)
    # cat: mặt ĐIỂN HÌNH nhất của ảnh mẫu (gần trung bình mọi mặt — thường là mặt trung tính nhìn thẳng, không phải mặt "ngạc nhiên"),
    # cộng một mặt khác góc nhất → ảnh sát mặt kèm lượt sinh keyframe / sửa mặt.
    if vao.get('cat') and ung:
        tb = np.mean([x / np.linalg.norm(x) for x, _, _, _ in ung], axis=0)
        xep = sorted(ung, key=lambda u: -cos(u[0], tb))
        chon = [xep[0]] + ([xep[-1]] if len(xep) > 2 else [])
        ra['cat'][ten] = [b for b in (cat_mat(im_, hop) for _, _, hop, im_ in chon) if b]   # ảnh mẫu / bảng nhân vật nhiều góc + biểu cảm: mọi mặt cỡ lớn đều là nhân vật — so với mặt gần nhất
    ra['mau'][ten] = len(vs)
    if vs: mau[ten] = vs
for a in vao.get('anh', []):
    try: im = doc(a['url']); H, W = im.shape[:2]; mat = van(im, 0.4, 0.05)
    except Exception as e: ra['anh'].append({'id': a['id'], 'loi': str(e)}); continue
    # GÁN mỗi mặt cho TỐI ĐA một nhân vật (cặp giống nhất trước): shot qua vai thấy lưng A + mặt B thì A không thấy mặt (giong null, không lệch),
    # không phải "mặt B không giống A". Nhân vật được gán một mặt dưới ngưỡng = mặt lệch ảnh mẫu (AI vẽ người khác).
    ten = [t for t in a.get('ten', []) if t in mau]
    cap = sorted(((max(cos(m, r) for r in mau[t]), i, t) for i, (m, _, _, _) in enumerate(mat) for t in ten), reverse=True)
    gan, dung = {}, set()
    for g, i, t in cap:
        if t in gan or i in dung: continue
        gan[t] = (g, mat[i][1], mat[i][2], mat[i][3]); dung.add(i)
    ket = []
    for t in ten:
        if t not in gan: ket.append({'ten': t, 'giong': None, 'dat': True}); continue
        g, h, hop, ng = gan[t]; nho = h < NHO
        # tâm mặt theo phần khung (0..1) — để lệnh sửa mặt chỉ đúng mặt nào khi khung có nhiều người
        o = {'x': round((float(hop[0]) + float(hop[2]) / 2) / W, 3), 'y': round((float(hop[1]) + float(hop[3]) / 2) / H, 3)}
        ket.append({'ten': t, 'giong': round(g, 3), 'dat': nho or ng or g >= NGUONG, 'o': o, **({'nho': True} if nho else {}), **({'nghieng': True} if ng else {})})
    ra['anh'].append({'id': a['id'], 'mat': len(mat), 'ket': ket})
print(json.dumps(ra, ensure_ascii=False))
