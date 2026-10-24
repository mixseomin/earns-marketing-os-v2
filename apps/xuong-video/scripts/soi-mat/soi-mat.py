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
SAT_NUT = 0.06   # chênh giống tối thiểu giữa tên được gán và tên kế tiếp để tin danh tính
NHO = 64   # mặt thấp dưới 64 px: SFace (đầu vào 112 px) chấm không tin được, người xem cũng khó nhận — ghi 'nho', không chặn (Jett #11)
cv2.setLogLevel(2) if hasattr(cv2, 'setLogLevel') else None
det = cv2.FaceDetectorYN.create(f'{MO}/face_detection_yunet_2023mar.onnx', '', (320, 320), 0.8, 0.3, 5000)
rec = cv2.FaceRecognizerSF.create(f'{MO}/face_recognition_sface_2021dec.onnx', '')

def tim_mat(im):
    """YuNet trên ảnh `im`; KHÔNG thấy mặt nào thì thử lại ở 1/2 rồi 1/3 cỡ ảnh, đổi toạ độ (khung + 5 điểm mốc) về cỡ gốc. Đo 19/10/2026: YuNet bỏ
    sót mặt QUÁ TO trong khung — chân dung mặt cao 600 px / ảnh 1024 px ra 0 mặt, thu 1/2 thấy ngay (tin 0,93). Cùng lỗi với keyframe cận mặt /
    đặc tả: trước đây báo 'không thấy mặt' → lọt khỏi soi mặt lẫn đo hướng nhìn."""
    for s in (1.0, 0.5, 0.33):
        x = im if s == 1.0 else cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        det.setInputSize((x.shape[1], x.shape[0])); _, f = det.detect(x)
        if f is not None and len(f):
            if s != 1.0: f = f.copy(); f[:, :14] /= s
            return f
    return None

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
    f = tim_mat(im)
    if f is None: return []
    f = sorted(f, key=lambda x: -x[3]); h0 = f[0][3]
    return [(rec.feature(rec.alignCrop(im, x)).flatten(), float(x[3]), x[:4], nghieng(x)) for x in f if x[3] >= ti_mat * h0 and x[3] >= ti_khung * im.shape[0]]

# HƯỚNG NHÌN (19/10/2026 — anh: "ánh nhìn, hướng nhìn rồi chuyển cảnh … làm mấy lần mà vẫn chưa ổn"): đo trên ẢNH ĐÃ SINH, không chỉ dặn trong prompt.
# MediaPipe Face Landmarker (478 điểm gồm con ngươi + ma trận hướng đầu). g = góc nhìn ngang (độ, + = phía PHẢI màn) ≈ quay đầu + asin(2,5 × lệch
# con ngươi khỏi giữa mắt) (hình học nhãn cầu, xem nhin_mat). Hiệu chỉnh trên keyframe tập 122 (19/10/2026): #3 Vivian nhìn ống kính +10° · #11 Thần nhìn ống kính +10° · #4 Hạ nhìn
# trái −48° · #10 Vivian nhìn trái −34° → |g| < 15° về phía cần nhìn = nhìn ống kính / sai phía. Không có mediapipe → bỏ qua (không đo).
_LM = None
def _lm():
    global _LM
    if _LM is None:
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mpt
            from mediapipe.tasks.python import vision as mv
            _LM = (mp, mv.FaceLandmarker.create_from_options(mv.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=f'{MO}/face_landmarker.task'), output_facial_transformation_matrixes=True, num_faces=6)))
        except Exception as e:
            print(f'không đo hướng nhìn: {e}', file=sys.stderr); _LM = False
    return _LM

_PO = None
def _pose():
    """Mô hình TƯ THẾ (MediaPipe pose landmarker, 0đ) — đo tay giơ / buông cho cổng nối cắt (soat-huong.mts)."""
    global _PO
    if _PO is None:
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mpt
            from mediapipe.tasks.python import vision as mv
            _PO = (mp, mv.PoseLandmarker.create_from_options(mv.PoseLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=f'{MO}/pose_landmarker_lite.task'), num_poses=4)))
        except Exception as e:
            print(f'không đo tư thế: {e}', file=sys.stderr); _PO = False
    return _PO

def tu_the(im):
    """Các người + tay: [{x, y (mũi, phần khung), tay: {phai, trai}}] — tay theo GIẢI PHẪU (tay phải của người đó): 'cao' cổ tay trên vai ·
    'giua' giữa vai và hông · 'thap' ngang / dưới hông (buông) · None không thấy cổ tay hoặc không đủ mốc để xếp."""
    po = _pose()
    if not po: return []
    mp, lm = po
    r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(im[:, :, ::-1])))
    out = []
    for L in r.pose_landmarks or []:
        thay = lambda i: L[i] if (L[i].visibility or 0) > 0.5 and 0 <= L[i].y <= 1 else None
        def tay(vai, co, hong):
            v, c, h = thay(vai), thay(co), thay(hong)
            if not v or not c: return None
            if c.y < v.y - 0.01: return 'cao'
            if not h: return None
            return 'thap' if c.y >= h.y - 0.15 * (h.y - v.y) else 'giua'
        mui = L[0]
        out.append({'x': round(mui.x, 3), 'y': round(mui.y, 3), 'tay': {'phai': tay(12, 16, 24), 'trai': tay(11, 15, 23)}})
    return out

def nhin_mat(im):
    """Các mặt + hướng nhìn: [{x, y (tâm mặt, phần khung), g (độ ngang, + = phải màn), dau (quay đầu), mat (lệch con ngươi −0,5..0,5), doc (độ CÚI: + = cúi xuống, − = ngẩng lên — đo trên clip #353: Hạ cúi mặt +13°, cụp mắt +23°)}]."""
    import math
    L = _lm()
    if not L: return []
    mp, lm = L
    r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(im, cv2.COLOR_BGR2RGB)))
    out = []
    for f, M in zip(r.face_landmarks, r.facial_transformation_matrixes):
        R = np.array(M)[:3, :3]; yaw = math.degrees(math.atan2(R[0, 2], R[2, 2])); doc_ = math.degrees(math.asin(-max(-1.0, min(1.0, R[1, 2]))))
        ti = lambda i, a, b: (f[i].x - f[a].x) / ((f[b].x - f[a].x) or 1e-6)
        ix = (ti(468, 33, 133) + ti(473, 362, 263)) / 2 - 0.5   # con ngươi: mắt phải người (33 ngoài → 133 trong) + mắt trái (362 trong → 263 ngoài)
        # mắt xoay θ: con ngươi lệch 12·sinθ mm trên mắt rộng ~30 mm → θ = asin(2,5 · lệch). Trước 19/10/2026 lấy 60 × lệch: ảnh sửa #2 con ngươi
        # lệch 0,17 (liếc rõ sang bên, ~25°) chỉ ra +10° → máy chấm "nhìn ống kính" một ảnh đã nhìn đúng phía.
        mat_ = math.degrees(math.asin(max(-1.0, min(1.0, 2.5 * ix))))
        out.append({'x': round(sum(p.x for p in f) / len(f), 3), 'y': round(sum(p.y for p in f) / len(f), 3), 'g': round(yaw + mat_, 1), 'dau': round(yaw, 1), 'mat': round(ix, 2), 'doc': round(doc_, 1)})
    return out

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
    f = tim_mat(im)
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
if vao.get('op') == 'dem':        # {op, url, nguong} → {mat}: ĐẾM mặt người, ngưỡng tin cậy riêng (0,7 — đo 18/10: #12 ba người 4 mặt, bình đồng 0; mặt tượng vàng vẫn đếm 1) — cổng sau bước 1 keyframe chỉ hỏi "có mặt người không";
    # ngưỡng 0,8 của so mặt bỏ sót mặt ~70 px ở khung rộng (tập 122 #12: ba người, đếm ra 0 → chặn oan)
    im = doc(vao['url']); det.setScoreThreshold(float(vao.get('nguong', 0.7))); f = tim_mat(im)
    print(json.dumps({'mat': 0 if f is None else len(f)})); sys.exit(0)
if vao.get('op') == 'cat_vung':   # {op, url, o:{x,y} | sau:<url lớp độ sâu một người>} → {hop:[x0,y0,x1,y1] px gốc, b64: vùng đầu 1024²}
    im = doc_goc(vao['url']); o = vao.get('o')
    if not o and vao.get('sau'):   # DỰNG TẠI CHỖ: mặt của ĐÚNG người này = mặt gần đỉnh bóng người trong lớp độ sâu 3D của họ (khung nhiều người)
        m = cv2.resize(doc_goc(vao['sau']), (im.shape[1], im.shape[0]), interpolation=cv2.INTER_NEAREST)
        m = (m.max(axis=2) if m.ndim == 3 else m) > 8; ys, xs = np.nonzero(m)
        if not len(ys): print(json.dumps({'hop': None, 'b64': None})); sys.exit(0)
        top, cao = ys.min(), ys.max() - ys.min() + 1; dai = ys < top + 0.15 * cao
        o = {'x': float(xs[dai].mean()) / im.shape[1], 'y': float(top + 0.07 * cao) / im.shape[0]}
        # MẶT PHẢI NẰM TRONG BÓNG CHÍNH NGƯỜI ĐÓ: người quay lưng (#12 Vivian) không có mặt → trước lấy mặt gần nhất (người khác / gáy) rồi vẽ "mặt"
        # lên gáy thành mảng nhoè. Không có mặt nào có tâm trong bóng (nới 3 %) → không cắt, lượt mặt bỏ qua người này.
        f = tim_mat(im)
        r_ = max(3, int(im.shape[0] * 0.03)); md = cv2.dilate(m.astype(np.uint8), np.ones((r_, r_), np.uint8)) > 0
        if f is None or not any(md[min(im.shape[0] - 1, int(x[1] + x[3] / 2)), min(im.shape[1] - 1, int(x[0] + x[2] / 2))] for x in f):
            print(json.dumps({'hop': None, 'b64': None})); sys.exit(0)
    hop = vung_dau(im, o)
    print(json.dumps({'hop': hop, 'b64': b64jpg(cv2.resize(im[hop[1]:hop[3], hop[0]:hop[2]], (1024, 1024))) if hop else None})); sys.exit(0)
if vao.get('op') == 'dan':        # {op, goc, sua, hop} → {b64: khung gốc với vùng đầu đã sửa dán lại, mặt nạ elip mờ biên, khớp màu}
    im = doc_goc(vao['goc']); x0, y0, x1, y1 = vao['hop']; vg = im[y0:y1, x0:x1]
    sua = cv2.resize(doc_goc(vao['sua']), (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA)
    # khớp màu (LAB, trung bình + độ lệch) về vùng gốc — mô hình sửa hay lệch tông nhẹ, dán vào sẽ thành mảng
    a, b = cv2.cvtColor(sua, cv2.COLOR_BGR2LAB).astype(np.float32), cv2.cvtColor(vg, cv2.COLOR_BGR2LAB).astype(np.float32)
    a = (a - a.mean((0, 1))) / (a.std((0, 1)) + 1e-6) * b.std((0, 1)) + b.mean((0, 1))
    sua = cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
    hh, ww = vg.shape[:2]; m = np.zeros((hh, ww), np.float32)
    # MẶT NẠ ĐẶT ĐÚNG CHỖ MẶT trong ô (tìm lại mặt trên vùng gốc): ô cắt sát mép khung bị kẹp (vung_dau) → mặt lệch về góc ô, elip cố định giữa ô
    # phủ lên ngực áo, mặt giữ ảnh cũ — 19/10/2026 tập 122 #13: mô hình vẽ rõ nụ cười nửa miệng mà ảnh dán ra không đổi (ô 768×994, mặt ở góc trên-trái).
    # Cỡ elip = như cũ khi mặt ở giữa (ô = 2,6 × mặt → bán trục 0,86 × rộng, 1,04 × cao mặt). Không thấy mặt → elip giữa ô như trước.
    f = tim_mat(vg)
    if f is not None and len(f):
        fx, fy, fw, fh = max(f, key=lambda r: r[2] * r[3])[:4]
        cv2.ellipse(m, (int(fx + fw / 2), int(fy + fh / 2 - 0.05 * fh)), (int(fw * 0.86), int(fh * 1.04)), 0, 0, 360, 1.0, -1)
    else:
        cv2.ellipse(m, (ww // 2, int(hh * 0.47)), (int(ww * 0.33), int(hh * 0.4)), 0, 0, 360, 1.0, -1)
    k = max(3, int(min(hh, ww) * 0.12) | 1); m = cv2.GaussianBlur(m, (k, k), 0)[..., None]
    im[y0:y1, x0:x1] = (sua * m + vg * (1 - m)).astype(np.uint8)
    print(json.dumps({'b64': b64jpg(im)})); sys.exit(0)
ra = {'mau': {}, 'anh': [], 'cat': {}}
mau = {}
for ten, urls in vao.get('mau', {}).items():
    vs, ung, to = [], [], []
    for u in urls:
        try: im = doc(u); v = [x for x in van(im, 0.0) if x[1] >= 40]   # ảnh mẫu: MỌI mặt đủ rõ, kể cả mặt nghiêng nhỏ của dáng toàn thân (Jett #11 Frank cười nghiêng)
        except Exception as e: print(f'bỏ ảnh mẫu {u}: {e}', file=sys.stderr); continue
        vs.extend(x for x, _, _, _ in v[:16])
        ung.extend((x, h, hop, im) for x, h, hop, ng in v[:16] if h >= 80 and not ng)
        to.extend((hop, im) for x, h, hop, ng in v[:16] if h >= 80)   # cả mặt NGHIÊNG — nguồn ảnh mặt quay trái / phải
    # cat: mặt ĐIỂN HÌNH nhất của ảnh mẫu (gần trung bình mọi mặt — thường là mặt trung tính nhìn thẳng, không phải mặt "ngạc nhiên"),
    # cộng một mặt khác góc nhất → ảnh sát mặt kèm lượt sinh keyframe / sửa mặt.
    # HƯỚNG ĐẦU (19/10/2026, sửa hướng nhìn): thêm mặt QUAY TRÁI và QUAY PHẢI rõ nhất (|quay đầu| ≥ 12°) — sửa mặt / hướng nhìn đưa ảnh mẫu cùng phía
    # cần nhìn; chỉ có mặt nhìn thẳng thì mô hình chép luôn ánh mắt nhìn ống kính. ra['cat_dau'][ten] = góc quay đầu từng ảnh (None = không đo được).
    if vao.get('cat') and ung:
        tb = np.mean([x / np.linalg.norm(x) for x, _, _, _ in ung], axis=0)
        xep = sorted(ung, key=lambda u: -cos(u[0], tb))
        chon = [xep[0]] + ([xep[-1]] if len(xep) > 2 else [])
        anh = [b for b in (cat_mat(im_, hop) for _, _, hop, im_ in chon) if b]   # ảnh mẫu / bảng nhân vật nhiều góc + biểu cảm: mọi mặt cỡ lớn đều là nhân vật — so với mặt gần nhất
        def _dau(b):
            q = nhin_mat(cv2.imdecode(np.frombuffer(base64.b64decode(b), np.uint8), cv2.IMREAD_COLOR)); return q[0]['dau'] if q else None
        dau = [_dau(b) for b in anh]
        if _lm():
            ung_ = [(b, _dau(b)) for b in (cat_mat(im_, hop) for hop, im_ in to[:24]) if b]
            for ben in (-1, 1):
                if any(d is not None and d * ben >= 12 for d in dau): continue
                tot = max(((b, d) for b, d in ung_ if d is not None and d * ben >= 12), key=lambda x: x[1] * ben, default=None)
                if tot: anh.append(tot[0]); dau.append(tot[1])
        ra['cat'][ten] = anh; ra.setdefault('cat_dau', {})[ten] = dau
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
        gan[t] = (g, mat[i][1], mat[i][2], mat[i][3], i); dung.add(i)
    nm = nhin_mat(im) if gan else []
    tt = tu_the(im) if gan and a.get('tu_the') else []   # chỉ khi được hỏi (cổng nối cắt) — đường soi thường không tốn thêm
    ket = []
    for t in ten:
        if t not in gan: ket.append({'ten': t, 'giong': None, 'dat': True}); continue
        g, h, hop, ng, i = gan[t]; nho = h < NHO
        # SÁT NÚT: mặt này giống người khác trong danh sách gần bằng (hai nữ chính AI vẽ na ná nhau) → không tin danh tính (cổng nối cắt bỏ qua)
        khac = [max(cos(mat[i][0], r) for r in mau[t2]) for t2 in ten if t2 != t]
        sat = bool(khac) and g - max(khac) < SAT_NUT
        # tâm mặt theo phần khung (0..1) — để lệnh sửa mặt chỉ đúng mặt nào khi khung có nhiều người
        o = {'x': round((float(hop[0]) + float(hop[2]) / 2) / W, 3), 'y': round((float(hop[1]) + float(hop[3]) / 2) / H, 3)}
        hn = min(nm, key=lambda q: (q['x'] - o['x']) ** 2 + (q['y'] - o['y']) ** 2, default=None)   # mặt MediaPipe trùng mặt YuNet đã gán
        hn = hn if hn and abs(hn['x'] - o['x']) < 0.08 and abs(hn['y'] - o['y']) < 0.08 else None
        pt = min(tt, key=lambda q: (q['x'] - o['x']) ** 2 + (q['y'] - o['y']) ** 2, default=None)   # tư thế có mũi gần tâm mặt đã gán
        pt = pt if pt and abs(pt['x'] - o['x']) < 0.12 and abs(pt['y'] - o['y']) < 0.12 else None
        ket.append({'ten': t, 'giong': round(g, 3), 'dat': nho or ng or g >= NGUONG, 'tin': g >= NGUONG and not sat, 'o': o, **({'tay': pt['tay']} if pt else {}), **({'nho': True} if nho else {}), **({'nghieng': True} if ng else {}), **({'nhin': {k: hn[k] for k in ('g', 'dau', 'mat', 'doc')}} if hn else {})})
    ra['anh'].append({'id': a['id'], 'mat': len(mat), 'ket': ket})
print(json.dumps(ra, ensure_ascii=False))
