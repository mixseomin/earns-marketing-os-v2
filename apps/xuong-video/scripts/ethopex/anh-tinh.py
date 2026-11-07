#!/usr/bin/env python3
"""KIỂU CREATIVE "ẢNH TĨNH" (anh 05/11/2026, mẫu video của đội: một khung đẹp nét trong phim + tên phim + giọng ~9s).
Giọng: bốc ngẫu nhiên một trong các mẫu CAU (EN 4 mẫu anh đưa 05–06/11/2026, ES 1 mẫu "¡Mira {title} gratis ahora! ¡Mira más ahora!").
Áp trước cho PHIM MỚI BẮT ĐẦU LÃI của nhà: camp đầu ≤ NGAY_MOI ngày, 3 ngày gần nhất thu > chi (chi ≥ $3) HOẶC có camp cơ hội (etp.camp_co_hoi — anh 06/11/2026
"thấy camp cơ hội thì tập trung scale từ nó": một camp ROI ≥ 50% giữa các camp thử lỗ vẫn là phim cần creative), còn camp ACTIVE, chưa có bản ảnh tĩnh,
cổng không chặn (apps/etp/cong.phim_chan_len). Mới nhất lên trước.
MỘT lệnh lo trọn, mỗi phim:
  1. tải 3 tập miễn phí (tai-tap.py) → khung mỗi 1,5 giây → doc-chu --mat (Vision: điểm mặt Apple + chữ) → chọn khung mặt to, nét, không chữ in cứng
  2. khung gốc độ phân giải đầy đủ → 1080x1920 + tên phim chữ vàng nửa dưới (không che mặt) + phóng chậm 5%
  3. giọng ElevenLabs v3 qua cổng giọng chung scripts/lich-su/giong-ckey.mjs (ckey 156₫/câu theo mã giọng → fal khi hỏng)
  4. cổng chữ trên video (kiem-thoai.py) → thư viện etp (thu-vien-them.mts, dạng "ảnh tĩnh", nguồn anh_tinh) → creative (thu-vien-len.py)
Từ đó nhịp ethopex (apps/cty/worker/ethopex.mjs) thấy creative ảnh tĩnh chấm Sạch của phim đang chạy → lên camp $1, giờ chạy theo lịch chung (nhan-ban.lich_len).
Dùng (iMac): python3 anh-tinh.py [content_id …] [--so N] [--ban N bản / phim] [--xem] [--giong ky_di|gao|cam_xuc|hao_hung|thuong|theo-phim]
  giọng mặc định XOAY giữa 5 kiểu (kể cả "thuong" = như bản gốc), dấu kiểu ghi vào etp.diem_cham.cham.voice.giong để đo
  không id = tự chọn N phim (mặc định 10) · --xem = chỉ dựng + tờ khung (~/.cache/ethopex/anh-tinh/to-<giờ>.jpg), không nạp thư viện / tạo creative"""
import hashlib, json, os, random, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import cam_box3; cam_box3.cam()   # CẤM dựng video trên box3 (anh 03/11/2026)
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageStat

D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex/anh-tinh")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
XV = f"{ENV}; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx"
DANG, NGUON, NGAY_MOI, GIAY_MIN, W, H = "ảnh tĩnh", "anh_tinh", 14, 9.0, 1080, 1920
# MẪU CÂU GIỌNG — mỗi mẫu 3 vế (vế nào cũng được chứa {t} = tên phim · c = câu chốt, thẻ hét đặt trước nó) để KIEU_GIONG chèn thẻ cách đọc. Mỗi creative BỐC NGẪU NHIÊN một mẫu của ngôn ngữ
# (anh 06/11/2026 "Thêm các mẫu voice này vào AT !!! Khi lên camp dạng AT, switch random giữa chúng"), số mẫu ghi vào etp.diem_cham.cham.voice.mau để đo. Chữ giữ nguyên văn anh đưa.
CAU = {"en": [("Watch {t}", "for Free Now.", "Watch More Now!"),   # form anh chốt 05/11/2026
              ("For Free.", "Watch the entire series: {t}.", "“Watch More” to continue the story!"),
              ("Watch the {t}", "for free.", "“Learn More” to enjoy the series!"),
              ("Watch the series {t}", "for free now.", "“See more” to continue watching!")],
       "es": [("¡Mira {t}", "gratis ahora!", "¡Mira más ahora!")]}
# GIỌNG THEO PHIM (anh 05/11/2026: "giọng kỳ dị, gào thét, ấn tượng … tuỳ theo film"): kiểu đọc chọn theo thể loại phim (etp.phim.the_loai);
# chữ giữ nguyên form, chỉ chèn thẻ cách đọc ElevenLabs v3 ([shouting]…) — thẻ không thành tiếng. Thể loại chưa có → giọng thường.
KIEU_GIONG = {
    "ky_di":    ("Brian",   "[whispers] {a}... [sinister laugh] {b} [shouting] {c}"),
    "gao":      ("Callum",  "[shouting] {a} {b} [screaming] {c}"),
    "cam_xuc":  ("Jessica", "[crying] {a} {b} [shouting] {c}"),
    "hao_hung": ("Laura",   "[excited] {a} {b} [screams] {c}"),
    "thuong":   ("George",  "{a} {b} {c}"),
}
THE_LOAI_GIONG = {"fantasy": "ky_di", "soi": "ky_di", "vien_tuong": "ky_di", "he_thong": "ky_di",
                  "vo_danh": "gao", "ty_phu": "gao", "mafia": "gao", "doi_thuong": "gao",
                  "hoi_han": "cam_xuc", "me_con": "cam_xuc", "tinh_cam": "hao_hung", "hoc_duong": "hao_hung", "co_trang": "hao_hung"}
UNG_VIEN = 20   # số khung ứng viên gửi AI xếp hạng
# BẢN MỚI (08/11/2026: AI chọn khung + tên từ poster + HD 8 Mb/s)
MOI = "--cu" not in sys.argv   # anh DUYỆT mẫu 08/11/2026 → bản mới là mặc định; --cu = cách cũ (khung điểm máy, chữ vàng, 3 Mb/s)
LOC = "fps=2/3"   # khung ứng viên: mỗi 1,5 giây (từ giây 3) — một chuỗi lọc cho cả khung nhỏ lẫn khung gốc
FONT = "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf"
MA_HOA = ["-c:v", "h264_videotoolbox", "-b:v", "8M" if MOI else "3M", "-maxrate", "10M" if MOI else "4500k",   # HD (anh 08/11/2026 "nhớ là dạng HD"): 1080x1920, 8 Mb/s (trước 3M)
           "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "44100"]   # như cat-canh.MA_HOA (Mac)

def sql(q):
    return subprocess.run(["ssh", B, f"{ENV}; psql \"$DATABASE_URL\" -tAq"], input=q, capture_output=True, text=True, check=True).stdout.strip()
def sh(*a, han=900): return subprocess.run(list(a), capture_output=True, text=True, timeout=han)
def ten_sach(t): return re.sub(r"\s*[（(](?:DUBBED|Doblado)[)）]\s*", " ", t or "").strip()

def chon(so):
    """phim mới bắt đầu lãi (nhà) — cổng chặn lấy từ apps/etp/cong.phim_chan_len (một nguồn với thay-the / nhan-ban)"""
    chan = json.loads(subprocess.run(["ssh", B, f"{ENV}; cd apps/etp && python3 -c 'import json, cong; print(json.dumps(cong.phim_chan_len()))'"],
                                     capture_output=True, text=True, check=True).stdout.strip() or "{}")
    ds = json.loads(sql(f"""with p as (select c.content_id, min(c.tao) dau, sum(n.chi) filter (where n.ngay >= current_date - 3) chi3, sum(n.thu) filter (where n.ngay >= current_date - 3) thu3
        from etp.camp c join etp.so_ngay n using (camp_id) where c.content_id is not null group by 1)
      select coalesce(json_agg(x order by x.dau desc), '[]') from (select p.content_id, f.ten, coalesce(f.locale, 'en') locale, f.url, f.the_loai, p.dau, round(p.thu3 - p.chi3, 2) lai3 from p join etp.phim f using (content_id)
        where p.dau > now() - interval '{NGAY_MOI} days' and ((p.chi3 >= 3 and p.thu3 > p.chi3) or exists (select 1 from etp.camp_co_hoi h where h.content_id = p.content_id)) and f.url is not null
          and exists (select 1 from etp.camp k where k.content_id = p.content_id and k.trang_thai = 'ACTIVE')
          and not exists (select 1 from etp.thu_vien v where v.content_id = p.content_id and v.dang = '{DANG}')) x""") or "[]")
    for x in ds:
        if str(x["content_id"]) in chan: print(f"bỏ {x['content_id']} {x['ten']}: cổng chặn — {chan[str(x['content_id'])]}")
    return [x for x in ds if str(x["content_id"]) not in chan][:so]

def phim(ids):
    return json.loads(sql(f"select coalesce(json_agg(x), '[]') from (select content_id, ten, coalesce(locale, 'en') locale, url, the_loai from etp.phim where content_id in ({','.join(map(str, ids))})) x") or "[]")

def may_doc():
    import importlib.util
    s = importlib.util.spec_from_file_location("kt", os.path.join(D, "kiem-thoai.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m.may_doc()

def goc_nho(k):
    """hộp chữ là logo nhỏ ở góc (chữ "R" ReelShort…) — xoá được, không loại khung"""
    return k[3] * k[4] < 0.006 and (k[1] < 0.2 or k[1] + k[3] > 0.8)

def diem(anh, mat, chu):
    """điểm một khung: mặt chính to + Apple chấm nét/sáng/nhìn thẳng (≥ 0,45: dưới mức đó Vision nhận nhầm đồ vật — chiếc giày 172316, 05/11/2026).
    Chữ in cứng chỉ được nằm DƯỚI mặt ở nửa dưới (phụ đề, tên nhân vật) hoặc là logo nhỏ ở góc — anh() xoá hết; chữ đè mặt / nửa trên = loại.
    Mặt phải xong trước 62% chiều cao để tên phim nằm dưới mặt. → (điểm, hộp mặt, hộp chữ cần xoá)"""
    mat = [m for m in mat or [] if m[4] >= 0.45]
    if not mat or len(mat) > 3: return 0, None, None
    x, y, w, h, q = max(mat, key=lambda m: m[2] * m[3])
    cx = x + w / 2
    if not 0.14 < h < 0.5 or y < 0.04 or y + h > 0.62 or not 0.25 < cx < 0.75: return 0, None, None
    if any(not goc_nho(k) and k[2] < max(0.5, y + h) for k in chu): return 0, None, None
    im = Image.open(anh).convert("L"); X, Y = im.size
    o = im.crop((int(x * X), int(y * Y), int((x + w) * X), int((y + h) * Y)))
    sang = ImageStat.Stat(o).mean[0]
    if not 55 < sang < 210: return 0, None, None
    net = ImageStat.Stat(o.filter(ImageFilter.FIND_EDGES)).stddev[0]
    return q * (0.6 + 0.4 * min(1, h / 0.25)) * (0.6 + 0.4 * min(1, net / 40)) * (1 if not chu else 0.92), (x, y, w, h), \
        [[k[1] - k[3] / 2, k[2] - k[4] / 2, k[3] * 2, k[4] * 2] if goc_nho(k) else k[1:] for k in chu]   # khung sạch chữ nhỉnh hơn · logo góc: OCR chỉ bắt chữ "R", ô vuông bao quanh rộng gấp đôi

def dau_tinh(kd, tap):
    """logo / watermark ĐỨNG YÊN của app gốc ở 4 góc: trung bình các khung một tập — nội dung nhoè đi, logo giữ nét (đo 05/11/2026: "R" ReelShort
    nhảy giữa góc trên-trái và dưới-phải, cả hai hiện rõ trên ảnh trung bình) → [x, y, rộng, cao] 0–1"""
    fs = sorted(f for f in os.listdir(kd) if f.startswith(tap))[::2][:80]; tb = None
    for i, f in enumerate(fs):
        im = Image.open(os.path.join(kd, f)).convert("L"); tb = im if tb is None else Image.blend(tb, im, 1 / (i + 1))
    if tb is None: return []
    e = tb.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(9)).resize((tb.width // 4, tb.height // 4))
    X, Y = e.size; px = e.load(); thay = set(); ra = []
    for sx in range(X):
        for sy in range(Y):
            if px[sx, sy] < 128 or (sx, sy) in thay: continue
            hang, cum = [(sx, sy)], []; thay.add((sx, sy))
            while hang:   # mảng liền (4 hướng)
                a, b = hang.pop(); cum.append((a, b))
                for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= c < X and 0 <= d < Y and (c, d) not in thay and px[c, d] >= 128: thay.add((c, d)); hang.append((c, d))
            x0, x1, y0, y1 = min(a for a, _ in cum) / X, (max(a for a, _ in cum) + 1) / X, min(b for _, b in cum) / Y, (max(b for _, b in cum) + 1) / Y
            goc = (x1 < 0.3 or x0 > 0.7) and (y1 < 0.2 or y0 > 0.8)   # nằm trọn trong một góc
            if goc and 0.04 < x1 - x0 < 0.16 and 0.02 < y1 - y0 < 0.09: ra.append([x0, y0, x1 - x0, y1 - y0])   # cỡ logo; lớn hơn = cảnh đứng yên
    return ra

def xoa(im, hop):
    """xoá chữ in cứng / logo trong các hộp (0–1) bằng LẤP TỪ VIỀN VÀO: lòng hộp đổ màu trung bình của vành quanh nó rồi làm mờ lặp nhiều lượt,
    mỗi lượt giữ nguyên phần ngoài hộp → màu xung quanh lan vào. Lọc trung vị (bản đầu) nuốt được nét chữ nhưng để lại viền ô logo mờ (05/11/2026)."""
    X, Y = im.size
    for x, y, w, h in hop:
        p = int(0.012 * X); b = (int(x * X) - p, int(y * Y) - p, int((x + w) * X) + p, int((y + h) * Y) + p)
        v = max(b[2] - b[0], b[3] - b[1]) // 2 + p; n = (max(0, b[0] - v), max(0, b[1] - v), min(X, b[2] + v), min(Y, b[3] + v))
        if b[2] - b[0] < 4 or b[3] - b[1] < 4: continue
        o = im.crop(n); m = Image.new("L", o.size, 0); ImageDraw.Draw(m).rectangle((b[0] - n[0], b[1] - n[1], b[2] - n[0], b[3] - n[1]), fill=255)
        nen = Image.new("RGB", o.size, tuple(int(c) for c in ImageStat.Stat(o, ImageChops.invert(m)).mean))
        r = Image.composite(nen, o, m)
        bk = max(5, min(b[2] - b[0], b[3] - b[1]) // 6)   # hộp to thì lan xa hơn, không để mảng phẳng
        for _ in range(30): r = Image.composite(r.filter(ImageFilter.GaussianBlur(bk)), o, m)
        im.paste(Image.composite(r, o, m.filter(ImageFilter.GaussianBlur(p / 2))), n[:2])
    return im

def khung(cid, url, tm):
    """→ (tập, giây, khung mặt, điểm, ảnh nhỏ) của khung đẹp nhất trong 3 tập miễn phí"""
    sh("python3", os.path.join(D, "tai-tap.py"), url, tm, "3", han=1800)
    taps = sorted(f for f in os.listdir(tm) if re.fullmatch(r"tap\d+\.mp4", f))[:3]
    if not taps: raise RuntimeError("không tải được tập miễn phí")
    kd = os.path.join(tm, "khung"); os.makedirs(kd, exist_ok=True)
    for f in os.listdir(kd): os.remove(os.path.join(kd, f))
    for t in taps:   # bỏ 3 giây đầu (logo app / tóm tắt tập trước)
        sh("ffmpeg", "-v", "error", "-ss", "3", "-i", os.path.join(tm, t), "-vf", f"{LOC},scale=540:-2", "-q:v", "3", os.path.join(kd, f"{t[:-4]}_%04d.jpg"))
    fs = sorted(os.path.join(kd, f) for f in os.listdir(kd) if f.endswith(".jpg"))
    ra = []
    for i in range(0, len(fs), 200):
        for l in subprocess.run([may_doc(), "--mat", *fs[i:i + 200]], capture_output=True, text=True, timeout=900).stdout.splitlines():
            j = json.loads(l); d, m, ch = diem(j["anh"], j.get("mat"), j.get("khung") or [])
            if d: tap, so = re.match(r".*/(tap\d+)_(\d+)\.jpg", j["anh"]).groups(); ra.append((d, tap, int(so), m, j["anh"], ch))
    if not ra: raise RuntimeError(f"không khung nào đạt (mặt to nét, chữ không đè mặt) trong {len(fs)} khung")
    # ỨNG VIÊN ĐA DẠNG (anh 08/11/2026 "chọn các góc, khung hình ấn tượng nhất, đẹp nhất"): điểm máy cao → thấp, cách nhau ≥ 4 khung (6 giây) trong cùng tập,
    # tối đa UNG_VIEN → AI xếp hạng (xep-khung.py, box3) → lấy N khung đầu cho N bản creative
    uv = []
    for d, tap, g, m, nho, ch in sorted(ra, key=lambda r: -r[0]):
        if any(u["tap"] == tap and abs(u["so"] - g) < 4 for u in uv): continue
        uv.append({"tap": tap, "so": g, "mat": m, "diem": round(d, 3), "nho": nho, "so_khung": len(fs), "dat": len(ra), "xoa": ch + dau_tinh(kd, tap)})
        if len(uv) >= UNG_VIEN: break
    return uv

def xep_ai(ten, uv):
    """AI xếp hạng ứng viên theo độ ấn tượng / đẹp (box3 xep-khung.py, ckey) → (danh sách theo thứ tự, lý do, ₫). Lỗi → giữ thứ tự điểm máy."""
    import base64, io
    anh = []
    for u in uv:
        b = io.BytesIO(); Image.open(u["nho"]).convert("RGB").save(b, "JPEG", quality=80); anh.append("data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode())
    r = subprocess.run(["ssh", B, f"{ENV}; python3 apps/xuong-video/scripts/ethopex/xep-khung.py"], input=json.dumps({"ten": ten, "anh": anh}), capture_output=True, text=True, timeout=300)
    try: j = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: j = {"thu_tu": [], "ly_do": (r.stderr or r.stdout)[-200:], "vnd": 0}
    tt = j.get("thu_tu") or list(range(len(uv)))
    return [uv[i] for i in tt], j.get("ly_do", ""), int(j.get("vnd") or 0)

def ten_poster(ten, poster, ra):
    """TÊN PHIM TÁCH TỪ POSTER (anh 08/11/2026 "tách phần tên phim từ poster ra và gắn lên creative"): Vision đọc chữ poster → các dòng chữ khớp từ
    của tên phim → cắt vùng đó, chỉ giữ nét chữ (màu nhiều trong lõi dòng chữ, ít ở viền vùng cắt), thêm viền tối để đọc rõ trên mọi khung.
    Không có poster / không dòng nào khớp ≥ 60% từ của tên → None (anh() quay về chữ vàng)."""
    if not os.path.exists(poster): return None
    from collections import Counter
    j = json.loads(subprocess.run([may_doc(), poster], capture_output=True, text=True, timeout=120).stdout.strip() or "{}")
    tu = lambda x: set(re.findall(r"[a-z0-9áéíóúñü]+", x.lower()))
    can = tu(ten); hop = [k[1:] for k in j.get("khung") or [] if tu(k[0]) and len(tu(k[0]) & can) / len(tu(k[0])) >= 0.6]
    if not hop or len(set().union(*[tu(k[0]) for k in j.get("khung") or [] if k[1:] in hop]) & can) < 0.6 * len(can): return None
    im = Image.open(poster).convert("RGB"); X, Y = im.size
    x0 = max(0, int(min(b[0] for b in hop) * X) - 12); y0 = max(0, int(min(b[1] for b in hop) * Y) - 12)
    x1 = min(X, int(max(b[0] + b[2] for b in hop) * X) + 12); y1 = min(Y, int(max(b[1] + b[3] for b in hop) * Y) + 12)
    c = im.crop((x0, y0, x1, y1)); w, h = c.size; px = list(c.getdata()); q = lambda p: (p[0] // 32, p[1] // 32, p[2] // 32)
    loi, vien, trong = Counter(), Counter(), set()
    for bx, by, bw, bh in hop:
        for yy in range(int(by * Y) - y0 - 6, int((by + bh) * Y) - y0 + 6):
            for xx in range(int(bx * X) - x0 - 6, int((bx + bw) * X) - x0 + 6): trong.add((xx, yy))
        for yy in range(int(by * Y) - y0 + int(bh * Y * .3), int(by * Y) - y0 + int(bh * Y * .7)):
            for xx in range(max(0, int(bx * X) - x0), min(w, int((bx + bw) * X) - x0), 2):
                if 0 <= yy < h: loi[q(px[yy * w + xx])] += 1
    for yy in range(h):
        for xx in (range(w) if yy < 8 or yy >= h - 8 else (*range(8), *range(w - 8, w))): vien[q(px[yy * w + xx])] += 1
    nl, nv = sum(loi.values()) or 1, sum(vien.values()) or 1
    chon = [k for k, v in sorted(((k, loi[k] / nl - 2 * vien.get(k, 0) / nv) for k in loi), key=lambda x: -x[1])[:6] if v > 0.01]
    if not chon: return None
    tong = {k: [0, 0, 0, 0] for k in chon}
    for p in px:
        t = tong.get(q(p))
        if t: t[0] += p[0]; t[1] += p[1]; t[2] += p[2]; t[3] += 1
    mau = [(t[0] / t[3], t[1] / t[3], t[2] / t[3]) for t in tong.values() if t[3]]
    a = [0 if (i % w, i // w) not in trong else max(0, min(255, int(255 * (1 - (min(((p[0]-m[0])**2+(p[1]-m[1])**2+(p[2]-m[2])**2) ** .5 for m in mau) - 40) / 40))))
         for i, p in enumerate(px)]
    m = Image.new("L", (w, h)); m.putdata(a); m = m.filter(ImageFilter.MedianFilter(3))
    # bỏ VỤN NỀN: mảng liền (trên ảnh thu 1/2) nhỏ hơn 0,4% vùng cắt, tâm NGOÀI hộp chữ OCR = đốm đèn / vạch nền trùng màu chữ, không phải nét chữ (mẫu 94344: vệt tím góc trên-phải)
    nho = m.resize((w // 2, h // 2)); W2, H2 = nho.size; pp = nho.load(); thay = set(); bo = Image.new("L", (W2, H2), 0); pb = bo.load()
    for sx in range(W2):
        for sy in range(H2):
            if pp[sx, sy] < 100 or (sx, sy) in thay: continue
            hang, cum = [(sx, sy)], []; thay.add((sx, sy))
            while hang:
                x_, y_ = hang.pop(); cum.append((x_, y_))
                for c_ in ((x_ + 1, y_), (x_ - 1, y_), (x_, y_ + 1), (x_, y_ - 1)):
                    if 0 <= c_[0] < W2 and 0 <= c_[1] < H2 and c_ not in thay and pp[c_] >= 100: thay.add(c_); hang.append(c_)
            tx, ty = 2 * sum(c_[0] for c_ in cum) / len(cum) + x0, 2 * sum(c_[1] for c_ in cum) / len(cum) + y0   # tâm mảng, toạ độ poster
            ngoai = not any(bx * X <= tx <= (bx + bw) * X and by * Y <= ty <= (by + bh) * Y for bx, by, bw, bh in hop)
            if (len(cum) < 0.004 * W2 * H2 and ngoai) or len(cum) < 0.0008 * W2 * H2:   # dấu câu (",") nằm TRONG hộp chữ, to hơn chấm li ti → giữ
                for c_ in cum: pb[c_] = 255
    m = Image.composite(Image.new("L", (w, h), 0), m, bo.resize((w, h)).filter(ImageFilter.MaxFilter(5)))
    if sum(1 for v in m.getdata() if v > 128) < 0.05 * w * h: return None   # gần như không còn nét → tách hỏng
    out = c.convert("RGBA"); out.putalpha(m)
    nen = Image.new("RGBA", out.size, (0, 0, 0, 0)); nen.putalpha(m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3)).point(lambda v: min(230, int(v * 1.3))))
    Image.alpha_composite(nen, out).save(ra); return ra

def anh(cid, ten, k, tm, ban=0):
    """khung gốc → nền 1080x1920 (nền.png, sẽ phóng chậm) + lớp tên phim (chu.png, đứng yên) đặt dưới mặt"""
    goc = os.path.join(tm, f"goc-{ban}.png")
    # khung gốc lấy bằng ĐÚNG chuỗi lọc đã trích khung nhỏ + số thứ tự khung (05/11/2026: tính giây tay lệch sang cảnh khác — chấm mặt cận, dựng ra cảnh đám đông)
    sh("ffmpeg", "-v", "error", "-y", "-ss", "3", "-i", os.path.join(tm, k["tap"] + ".mp4"), "-vf", f"{LOC},select=eq(n\\,{k['so'] - 1})", "-frames:v", "1", goc)
    if not os.path.exists(goc): raise RuntimeError(f"không lấy được khung gốc {k['tap']} #{k['so']}")
    j = json.loads(subprocess.run([may_doc(), goc], capture_output=True, text=True, timeout=120).stdout.strip() or "{}")   # đọc chữ lại trên khung gốc: chữ nhỏ ("R") ảnh 540px bỏ sót
    k["xoa"] += [[x - w / 2, y - h / 2, w * 2, h * 2] if goc_nho([t, x, y, w, h]) else [x, y, w, h] for t, x, y, w, h in j.get("khung") or []]
    im = xoa(Image.open(goc).convert("RGB"), k["xoa"]); s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x0 = min(max(0, round((k["mat"][0] + k["mat"][2] / 2) * im.width - W / 2)), im.width - W); y0 = (im.height - H) // 2
    im = im.crop((x0, y0, x0 + W, y0 + H)).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    toi = Image.new("L", (1, 256)); toi.putdata([0 if i < 140 else min(190, (i - 140) * 2) for i in range(256)])   # dải tối nửa dưới cho chữ đọc rõ
    im = Image.composite(Image.new("RGB", (W, H)), im, toi.resize((W, H)))
    nen = os.path.join(tm, f"nen-{ban}.png"); im.save(nen); mat_day = (k["mat"][1] + k["mat"][3]) * H
    tp = None if not MOI else ten_poster(ten, os.path.join(tm, "poster.jpg"), os.path.join(tm, "ten-poster.png")) if ban == 0 or not os.path.exists(os.path.join(tm, "ten-poster.png")) else os.path.join(tm, "ten-poster.png")
    if tp:   # tên phim đúng kiểu chữ poster: rộng ≤ W − 120, cao ≤ 22% màn, đặt dưới mặt, chừa ~20% đáy
        t_ = Image.open(tp); s_ = min((W - 120) / t_.width, H * 0.22 / t_.height); t_ = t_.resize((round(t_.width * s_), round(t_.height * s_)), Image.LANCZOS)
        y = int(min(max(H * 0.66 - t_.height / 2, mat_day + 60), H * 0.80 - t_.height)); lop = Image.new("RGBA", (W, H)); lop.paste(t_, ((W - t_.width) // 2, y), t_)
        k["ten_poster"] = True; lop.save(os.path.join(tm, f"chu-{ban}.png")); return nen, os.path.join(tm, f"chu-{ban}.png")
    t, c = ten.upper() if len(ten) <= 18 else ten, 120
    while True:
        f = ImageFont.truetype(FONT, c); dong, cur = [], ""
        for w_ in t.split():
            thu = f"{cur} {w_}".strip()
            if cur and f.getlength(thu) > W - 140: dong.append(cur); cur = w_
            else: cur = thu
        dong.append(cur)
        if len(dong) <= 3 or c <= 64: break
        c -= 8
    cao = int(c * 1.12) * len(dong)
    y = int(min(max(H * 0.66 - cao / 2, mat_day + 60), H * 0.80 - cao))   # dưới mặt; chừa ~20% đáy cho khung ứng dụng (tên trang, nút)
    lop = Image.new("RGBA", (W, H)); bong = Image.new("RGBA", (W, H)); d, db = ImageDraw.Draw(lop), ImageDraw.Draw(bong)
    mask = Image.new("L", (W, H)); dm = ImageDraw.Draw(mask)
    for i, x in enumerate(dong):
        xx, yy = (W - f.getlength(x)) / 2, y + i * int(c * 1.12)
        db.text((xx + 6, yy + 8), x, font=f, fill=(0, 0, 0, 200)); dm.text((xx, yy), x, font=f, fill=255)
        d.text((xx, yy), x, font=f, fill=(0, 0, 0, 0), stroke_width=7, stroke_fill=(40, 20, 0, 255))
    vang = Image.new("RGBA", (1, H)); vang.putdata([(255, 236 - int(60 * max(0, min(1, (r - y) / max(1, cao)))), 150 - int(110 * max(0, min(1, (r - y) / max(1, cao)))), 255) for r in range(H)])
    lop.paste(vang.resize((W, H)), (0, 0), mask)
    Image.alpha_composite(bong.filter(ImageFilter.GaussianBlur(8)), lop).save(os.path.join(tm, f"chu-{ban}.png"))
    return nen, os.path.join(tm, f"chu-{ban}.png")

def xoay_giong(ds, yeu_cau):
    """kiểu giọng cho từng phim → {content_id: kiểu}. Anh 05/11/2026: "khi ren nếu ko yêu cầu thì xoay giữa các giọng. Kể cả giọng như bản gốc là 1 loại".
    Mặc định XOAY: kiểu ít creative ảnh tĩnh nhất (đếm trong sổ điểm chạm) lên trước, không lặp kiểu phim đó đã có. --giong <kiểu> ép một kiểu,
    --giong theo-phim chọn theo thể loại (THE_LOAI_GIONG)."""
    if yeu_cau == "theo-phim": return {int(p["content_id"]): THE_LOAI_GIONG.get(p.get("the_loai") or "", "thuong") for p in ds}
    if yeu_cau: return {int(p["content_id"]): yeu_cau for p in ds}
    # đếm trong CHÍNH sổ điểm chạm (hook.dang + noi_dung.content_id do len-creative ghi) — etp.creative chỉ có creative mới sau lượt đồng bộ 10 phút
    da = json.loads(sql(f"select coalesce(json_agg(x), '[]') from (select (cham->'noi_dung'->>'content_id')::int content_id, cham->'voice'->>'giong' giong from etp.diem_cham "
                        f"where cham->'hook'->>'dang' = '{DANG}' and cham->'voice'->>'giong' is not null) x") or "[]")
    dem = {k: sum(1 for x in da if x["giong"] == k) for k in KIEU_GIONG}; ra = {}
    for p in ds:
        cid = int(p["content_id"]); co = {x["giong"] for x in da if x["content_id"] == cid}
        k = min(KIEU_GIONG, key=lambda k: (k in co, dem[k], list(KIEU_GIONG).index(k))); ra[cid] = k; dem[k] += 1
    return ra

def danh_dau(tv, kieu, lang, ten, so_mau=0, them=None):
    """DẤU KIỂU GIỌNG vào sổ điểm chạm của creative (etp.diem_cham.cham) để đo kiểu nào tốt / xấu — anh 05/11/2026. len-creative ghi khuôn
    cảnh cắt (thoại gốc, nút CTA mẫu Kiên); ảnh tĩnh không có những thứ đó → ghi đúng cái creative này có."""
    v, mau = KIEU_GIONG[kieu]; a_, b_, c_ = CAU[lang][so_mau]
    j = json.dumps({"voice": {"thoai": "khong", "giong": kieu, "nguoi_doc": v, "mau": so_mau, "cau": mau.format(a=a_.format(t=ten), b=b_.format(t=ten), c=c_.format(t=ten))},
                    "chu_video": {"bo_cuc": "anh_tinh_ten_phim", "phu_de": "xoa", **({"ten": "poster" if them.get("ten_poster") else "chu_vang"} if them else {})},
                    "cta": {"mau": "khong_nut"}, **({"anh_tinh": {"ban": them.get("ban"), "khung": f"{them.get('tap')}#{them.get('khung_so')}", "chon": "ai" if MOI else "may", "hd": MOI}} if them else {})}, ensure_ascii=False).replace("$J$", "")
    return sql(f"update etp.diem_cham d set cham = d.cham || $J${j}$J$::jsonb, luc = now() from etp.thu_vien v where v.id = {int(tv)} and d.creative_id = v.creative_id returning d.creative_id")

# GIỌNG = CỔNG GIỌNG CHUNG scripts/lich-su/giong-ckey.mjs trên box3 (anh 08/11/2026 "chuyển vào cơ chế chung. Mọi AI API đều phải qua fallback"):
# ckey ElevenLabs v3 theo MÃ giọng (156₫ / câu) → fal eleven-v3 khi ckey hỏng. Không gọi API giọng riêng ở đây.
def doc_giong(cid, lang, v, cau, tm):
    """một câu → mp3 trong tm (dùng lại khi cùng giọng + câu) → (tệp, ₫ thật theo dòng cuối của cổng)"""
    h = hashlib.sha1(f"{v}|{cau}".encode()).hexdigest()[:10]; f = os.path.join(tm, f"giong-{h}.mp3")
    if os.path.exists(f) and os.path.getsize(f) > 3000: return f, 0
    xa = f"/var/tmp/anh-tinh/{cid}"; job = os.path.join(tm, "giong.json")
    json.dump({"giong": v, "engine": "v3", "language": lang, "cau": [{"khoa": h, "chu": cau}]}, open(job, "w"), ensure_ascii=False)
    sh("ssh", B, f"mkdir -p {xa}"); sh("scp", "-q", job, f"{B}:{xa}/giong.json")
    r = sh("ssh", B, f"{ENV}; node apps/xuong-video/scripts/lich-su/giong-ckey.mjs {xa}/giong.json {xa}", han=600)
    if r.returncode != 0: raise RuntimeError(f"giọng: {(r.stderr or r.stdout)[-200:]}")
    if r.stderr.strip(): print(r.stderr.strip()[-200:], file=sys.stderr)   # câu xuống tuyến fal — kêu ra
    sh("scp", "-q", f"{B}:{xa}/{h}.mp3", f)
    m = re.search(r"tiền (\d+)₫", r.stdout); return f, int(m.group(1)) if m else 156

def giong(cid, lang, ten, kieu, tm, so_mau=0):
    """giọng đọc mẫu câu CAU theo kiểu → (giong.mp3, ₫ đã chi, kiểu)"""
    v, mau = KIEU_GIONG[kieu]; a_, b_, c_ = CAU[lang][so_mau]
    f, vnd = doc_giong(cid, lang, v, mau.format(a=a_.format(t=ten), b=b_.format(t=ten), c=c_.format(t=ten)), tm)
    return f, vnd, kieu

def dung(nen, chu, mp3, ra):
    L = max(GIAY_MIN, float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3).stdout) + 1.4); n = int(L * 30)
    r = sh("ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", nen, "-loop", "1", "-i", chu, "-i", mp3, "-filter_complex",
           f"[0:v]scale={W * 2}:{H * 2}:flags=lanczos,zoompan=z='1+0.05*on/{n}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={W}x{H}:fps=30,setsar=1[n];"
           f"[1:v]format=rgba,fade=in:st=0.2:d=0.4:alpha=1[c];[n][c]overlay=0:0:shortest=1[v];[2:a]adelay=400|400,apad[a]",
           "-map", "[v]", "-map", "[a]", "-t", f"{L:.2f}", *MA_HOA, ra)
    if r.returncode != 0: raise RuntimeError(f"ffmpeg: {r.stderr[-300:]}")
    return round(L, 1)

def mot(p, xem, kieu, ban=1):
    """một phim → `ban` creative (anh 08/11/2026 "3 camp mỗi loại"): mỗi bản một khung khác (AI xếp hạng), mẫu câu giọng xoay vòng → danh sách kq"""
    cid, lang = int(p["content_id"]), "es" if str(p.get("locale")).startswith("es") else "en"; ten = ten_sach(p["ten"])
    tm = os.path.join(C, str(cid)); os.makedirs(tm, exist_ok=True)
    try:
        uv = khung(cid, p["url"], tm); uv, ly_ai, vnd_ai = xep_ai(ten, uv) if MOI and len(uv) > 1 else (uv, "", 0)
    except Exception as e:
        return [{"content_id": cid, "ten": ten, "loi": str(e)[-300:]}]
    mau0 = random.randrange(len(CAU[lang])); ra = []
    for b, k in enumerate(uv[:ban]):
        try:
            so_mau = (mau0 + b) % len(CAU[lang])   # bốc ngẫu nhiên mẫu đầu, các bản sau xoay vòng (anh 06/11/2026)
            # MỖI BẢN MỘT KIỂU GIỌNG (anh 08/11/2026 "nhớ có nhiều kiểu voice … để còn tối ưu về sau"): bản 1 = kiểu xoay_giong chọn, bản sau lần lượt các kiểu kế
            ks = list(KIEU_GIONG); kieu_b = ks[(ks.index(kieu) + b) % len(ks)]
            nen, chu = anh(cid, ten, k, tm, b); mp3, vnd, kieu_ = giong(cid, lang, ten, kieu_b, tm, so_mau)
            out = os.path.join(tm, f"anh-tinh-{cid}-{b + 1}.mp4"); giay = dung(nen, chu, mp3, out)
            r = sh("python3", os.path.join(D, "kiem-thoai.py"), out, "0", str(giay))   # cổng chữ trên video (tên phim) — cùng cổng mọi creative
            if r.returncode != 0: raise RuntimeError(r.stdout.strip()[-200:])
            kq = {"content_id": cid, "ten": ten, "lang": lang, "file": out, "ban": b + 1, "giay": giay, "vnd": vnd + (vnd_ai if b == 0 else 0), "giong": kieu_, "mau": so_mau,
                  "ten_poster": bool(k.get("ten_poster")), "ai": ly_ai[:200] if b == 0 else "", **{x: k[x] for x in ("tap", "diem", "dat", "so_khung", "nho")}, "xoa": len(k["xoa"]), "khung_so": k["so"]}
            if not xem:
                xa = f"/var/tmp/anh-tinh/{cid}"; sh("ssh", B, f"mkdir -p {xa}"); sh("rsync", "-a", out, f"{B}:{xa}/", han=900)
                ghi = (f"ảnh tĩnh bản {b + 1}/{ban} · giọng {kieu_} · mẫu câu {so_mau + 1} ({p.get('the_loai') or '?'}): {k['tap']} khung #{k['so']} (mỗi 1,5 giây từ giây 3) · "
                       f"điểm mặt {k['diem']} ({k['dat']}/{k['so_khung']} khung đạt) · AI xếp hạng {b + 1} · tên {'từ poster' if k.get('ten_poster') else 'chữ vàng'}")
                r = sh("ssh", B, f"{XV} scripts/ethopex/thu-vien-them.mts 0 {xa}/{os.path.basename(out)} --content={cid} --dang='{DANG}' --nguon={NGUON} --lang={lang} --chi-vnd={kq['vnd']} --ghi='{ghi}' --them", han=600)   # --them: mỗi bản một dòng thư viện
                if r.returncode != 0: raise RuntimeError(f"thư viện: {(r.stderr or r.stdout)[-200:]}")
                kq["tv"] = int(sql(f"select id from etp.thu_vien where content_id = {cid} and dang = '{DANG}' and nguon = '{NGUON}' and creative_id is null order by id desc limit 1") or 0)
            ra.append(kq)
        except Exception as e:
            ra.append({"content_id": cid, "ten": ten, "ban": b + 1, "loi": str(e)[-300:]})
    return ra

def to_khung(kq, ra):
    """tờ khung: mỗi phim một ô (khung đã chọn + tên) để người xem soát trước"""
    ok = [x for x in kq if not x.get("loi")]
    if not ok: return None
    o = 270; to = Image.new("RGB", (o * min(5, len(ok)), int(o * 16 / 9) * ((len(ok) + 4) // 5)), "black")
    for i, x in enumerate(ok):
        f = os.path.join(C, str(x["content_id"]), f"xem-{x.get('ban', 1)}.jpg"); sh("ffmpeg", "-v", "error", "-y", "-ss", "3", "-i", x["file"], "-frames:v", "1", "-vf", f"scale={o}:-2", f)
        to.paste(Image.open(f), ((i % 5) * o, (i // 5) * int(o * 16 / 9)))
    to.save(ra, quality=88); return ra

if __name__ == "__main__":
    a = sys.argv[1:]; xem = "--xem" in a
    so = int(a[a.index("--so") + 1]) if "--so" in a else 10
    yc = a[a.index("--giong") + 1] if "--giong" in a else None
    if yc and yc != "theo-phim" and yc not in KIEU_GIONG: sys.exit(f"--giong phải là một trong: {', '.join(KIEU_GIONG)} · theo-phim")
    ids = [int(x) for i, x in enumerate(a) if x.isdigit() and (i == 0 or a[i - 1] not in ("--so", "--ban"))]
    ds = phim(ids) if ids else chon(so)
    if not ds: sys.exit("không có phim nào hợp (mới bắt đầu lãi, chưa có ảnh tĩnh)")
    print(f"{len(ds)} phim: " + " · ".join(f"{x['content_id']} {ten_sach(x['ten'])[:30]}" for x in ds), flush=True)
    gk = xoay_giong(ds, yc); print("giọng: " + " · ".join(f"{c} {k}" for c, k in gk.items()), flush=True)
    ban = int(a[a.index("--ban") + 1]) if "--ban" in a else 1
    with ThreadPoolExecutor(3) as ex: kq = [x for r in ex.map(lambda p: mot(p, xem, gk[int(p["content_id"])], ban), ds) for x in r]
    for x in kq: print(json.dumps(x, ensure_ascii=False), flush=True)
    print("tờ khung:", to_khung(kq, os.path.join(C, f"to-{time.strftime('%d%m%H%M')}.jpg")))
    print(f"giọng: {sum(x.get('vnd', 0) for x in kq)}₫")
    tv = [str(x["tv"]) for x in kq if x.get("tv")]
    if tv: subprocess.run(["python3", os.path.join(D, "thu-vien-len.py"), *tv])   # thư viện → creative; chấm Sạch thì nhịp ethopex lên camp theo lịch chung
    for x in kq:
        if x.get("tv"): print(f"dấu giọng tv{x['tv']} {x['giong']} → creative", danh_dau(x["tv"], x["giong"], x["lang"], x["ten"], x.get("mau", 0), x) or "(chưa thành creative)")
