#!/usr/bin/env python3
"""CỔNG THOẠI NHẠY CẢM cho creative cảnh thật (bài học 20/10/2026, anh: "phải học để rút kn lần sau"):
Meta từ chối #65717 (Number One 1136–1200s) + #65719 (1280–1352s) vì "Adult Sexual Exploitation — suggested sexual threat or violence".
Gốc: phụ đề in cứng của app gốc nói thẳng chuyện mua bán dâm / quan hệ ("banged", "prostitute yourself", "manwhore", "dirty prostitute
money", "sells himself") + đe doạ lột đồ trước đám đông ("Let's strip this fraud down"). Các đoạn cùng phim không có những chữ đó thì qua.
Máy duyệt Meta không nhất quán (đoạn có "gigolo" vẫn qua) → không trông may rủi: đoạn nào phụ đề dính từ dưới đây thì KHÔNG cắt.
Đọc phụ đề: mỗi giây một khung → doc-chu.swift (Vision macOS, 0đ) · Linux (box3): tesseract hai lượt (doc_linux).
Dùng:  kiem-thoai.py <video> <tu_giay> <den_giay>   → "THOAI OK" (mã 0) hoặc "THOAI CHAN: <giây> <câu>" (mã 2)
Tự kiểm: kiem-thoai.py --tu-kiem"""
import json, os, re, subprocess, sys, tempfile

D = os.path.dirname(os.path.abspath(__file__))
# EN + ES. Mỗi mẫu là một lớp nội dung Meta xếp vào "Adult Sexual Exploitation" / "Adult Sexual Solicitation".
CAM = [
    r"prostitut", r"\bman ?whore", r"\bwhore", r"\bhooker", r"\bslut", r"\bescort(s|ing)?\b", r"\bgigolo", r"\bgigoló",
    r"\bsex ?work", r"\bsells? (him|her)sel(f|ves)", r"\bsold (him|her)self", r"\bbang(ed|ing)? (out|her|him|you)|\bbanged\b",
    r"\brap(e|ed|ist)\b", r"\bmolest(ed|ing|er|ers|ation|s)?\b", r"\bgrop(e|ed|ing)\b",
    r"\bstrip\w*\b.{0,25}\b(down|naked|off|him|her|you|them|this)\b", r"\b(take|took) off (your|his|her) clothes", r"\bnaked\b",
    r"\bputa\b", r"\bputo\b", r"\bviol(ar|ación|ó|aron)\b", r"\bdesn[uú]d", r"\bacost(arte|arse|ó) con", r"\bvende su cuerpo",
]
# Nhóm BẠO LỰC / CHẾT CHÓC (Dol Dang 21/10/2026: "mấy từ 'dead',… cũng có thể bị meta quét") — chặn khi cắt đoạn MỚI, camp đang chạy không động
CAM += [r"\bdead\b", r"\bkill(s|ed|ing|er)?\b", r"\bmurder", r"\bsuicid", r"\bbehead", r"\bslaughter",
        r"\bmuert[oa]s?\b", r"\bmat(ar|aré|arte|arlo|arla|ó)\b", r"\basesin", r"\bsuicid"]
# Ám chỉ tình dục trong chữ QC / phụ đề (21/10/2026: QC spy "Basketball 1 vs 5" — omegaverse "drugged, triggering his heat… ruts";
# "The Godfather's Secret Lover" — "slept with … her boyfriend's father")
CAM += [r"\bdrugg(ed|ing)\b", r"\b(his|her|in) heat\b", r"\bruts\b", r"\bslept with\b", r"\bsleep(s|ing)? with\b", r"\bin (my|his|her|their) bed\b", r"\bseduc", r"\bone[- ]night stand"]
# CHỬI TỤC + ĐÁNH ĐẬP (21/10/2026 lô cắt cuối: phụ đề app gốc "who in the flying fuck are you?", "teach this bitch a lesson!", "Beat up that fat pig!"
# — Meta cấm ngôn từ tục tĩu trong QC; bạo lực thể xác cùng lớp với nhóm trên)
CAM += [r"\bf+u+c+k", r"\bshit", r"\bbitch", r"\bbastards?\b", r"\bass ?hole", r"\bmotherf", r"\bbeat(s|ing)? (\w+ ){0,2}up\b", r"\bstab(bed|bing|s)?\b",
        r"\bmierda", r"\bpendej", r"\bcabr[oó]n", r"\bperra\b", r"\bjoder\b", r"\bco[ñn]o\b", r"\bhijo de p"]
# CTA DỤ NHẤP (Support Ads 22/10/2026: "tránh không dùng những từ CTA dụ nhấp như Click, Tap… hoặc các icon, mũi tên") — chữ nút cũ
# "WATCH FREE · TAP LEARN MORE" / "TOCA MÁS INFORMACIÓN" in trên video bị chặn ở đây; nguồn mẫu: cta_qc.MAU_CTA
import importlib.util as _iu
_c = _iu.spec_from_file_location("cta_qc", os.path.join(D, "cta_qc.py")); CQ = _iu.module_from_spec(_c); _c.loader.exec_module(CQ)
CAM += [CQ.MAU_CTA.pattern]
# BÌNH PHẨM THÂN THỂ / GỢI DỤC (anh 22/10/2026 "câu thoại nhạy cảm thì làm méo giống TV": El gran y poderoso genio "Tu esposa tiene un cuerpazo")
CAM += [r"\bcuerpaz", r"\bqu[eé] cuerpo\b", r"\b(hot|nice|sexy) body\b", r"\bhorny\b", r"\bsexy\b"]
MAU = re.compile("|".join(CAM), re.I)

def mau_js():
    """luật thoại cấm dạng JS cho Worker chấm creative (anh 25/10/2026: một nguồn luật — danh sách CAM ở trên là gốc) → {thoai, thoai_hoa, cta…}"""
    t, th = CQ.tach_hoa("|".join(x for x in CAM if x != CQ.MAU_CTA.pattern))
    return {"thoai": t, "thoai_hoa": th, **CQ.mau_js()}

def soat(cau):
    """→ từ khớp đầu tiên hoặc None (thoại cấm · CTA dụ nhấp · lớp phủ CTA kích thích của QC app gốc — cta_qc.phu_kich_thich)"""
    m = MAU.search(cau or "")
    return m.group(0) if m else CQ.phu_kich_thich(cau)

def may_doc():
    """doc-chu.swift biên dịch MỘT lần thành ~/.cache/ethopex/doc-chu (dịch lại khi tệp nguồn mới hơn). 20/10/2026: chạy `swift doc-chu.swift`
    (thông dịch) 4 lượt song song thì treo nhau hơn 1 giờ ở khoá module cache → luôn dùng bản đã biên dịch."""
    src = os.path.join(D, "doc-chu.swift"); bin_ = os.path.expanduser("~/.cache/ethopex/doc-chu")
    if not os.path.exists(bin_) or os.path.getmtime(bin_) < os.path.getmtime(src):
        os.makedirs(os.path.dirname(bin_), exist_ok=True); tmp = bin_ + ".%d" % os.getpid()
        subprocess.run(["swiftc", "-O", src, "-o", tmp], check=True, capture_output=True, timeout=600); os.replace(tmp, bin_)
    return bin_

def bo_doc_san(video):
    """chữ đã đọc sẵn của một nguồn: {giây nguyên: chữ} ở <nguồn bỏ đuôi>.chu.json (doc-khung.py ghi — box3 cắt, iMac đọc bằng Vision, 23/10/2026)"""
    f = os.path.splitext(video)[0] + ".chu.json"
    try: return json.load(open(f)) if os.path.exists(f) and os.path.getmtime(f) >= os.path.getmtime(video) - 5 else None
    except Exception: return None

# ĐỌC CHỮ TRÊN LINUX (anh 31/10/2026 "sao vẫn có tiến trình dựng phim ffmpeg trên iMac" → chọn đưa dựng lên box3): tesseract eng+spa, HAI lượt mỗi khung
# — ngưỡng 185 (giữ chữ phụ đề trắng, nền thành trắng) + ảnh xám thô — rồi hợp chữ. Đo 31/10/2026 trên 5 phim box3 đã có bản Vision (<nguồn>.chu.json):
# một lượt xám thô bắt 45% từ Vision · ngưỡng 185 bắt 67–98% · hợp hai lượt 81–91%; giây bị cổng thoại chặn khớp Vision (xem tu_kiem_linux). ~0,22s/khung, 4 luồng.
NGUONG = (185, 0)
def _tess(anh):
    from PIL import Image, ImageFilter
    ra = []
    for ng in NGUONG:
        im = Image.open(anh).convert("L")
        if ng: im = im.point(lambda p: 0 if p > ng else 255).filter(ImageFilter.MedianFilter(3))
        f = f"{anh}.{ng}.png"; im.resize((im.width * 2, im.height * 2), Image.LANCZOS).save(f)
        r = subprocess.run(["tesseract", f, "-", "-l", "eng+spa", "--psm", "11", "--oem", "1"], capture_output=True, text=True, timeout=120, env={**os.environ, "OMP_THREAD_LIMIT": "1"})
        if r.returncode: raise RuntimeError(f"tesseract lỗi {r.stderr.strip()[-150:]}")
        ra += [l.strip() for l in r.stdout.splitlines() if len(l.strip()) > 2]
    return " | ".join(dict.fromkeys(ra))

def doc_linux(anhs):
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(int(os.environ.get("ETP_OCR_LUONG", "4"))) as ex: return list(ex.map(_tess, anhs))

def doc(video, tu, den):
    san = bo_doc_san(video)
    if san is not None:
        ks = [str(round(tu + i)) for i in range(max(1, int(-(-(den - tu) // 1))))]
        thieu = [k for k in ks if k not in san]
        if not thieu: return [(tu + i, san[k]) for i, k in enumerate(ks)]
    with tempfile.TemporaryDirectory(dir="/var/tmp" if sys.platform != "darwin" else None) as t:
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(tu), "-t", str(den - tu), "-i", video, "-vf", "fps=1,scale=540:-2", f"{t}/k%04d.png"], check=True)
        anh = [f"{t}/{a}" for a in sorted(os.listdir(t))]
        if sys.platform != "darwin": return [(tu + i, c) for i, c in enumerate(doc_linux(anh))]   # box3: không có Vision → tesseract
        r = subprocess.run([may_doc()] + anh, capture_output=True, text=True, check=True, timeout=600)
        return [(tu + i, json.loads(l)["chu"]) for i, l in enumerate(r.stdout.splitlines())]

def tu_kiem():
    chan = ["Lord knows how many old grannies you banged out there.", "You really thought you could just run off and prostitute yourself,",
            "is that you're a *** manwhore!", "How could you afford them if not with your dirty prostitute money?", "from those old women he sells himself to.",
            "Let's strip this fraud down and donate his gear to the church!", "Everyone knows he got locked up for doing sex work for old hags.",
            "Malik— you're just a cheap gigolo.", "¡Eres una puta!", "Quítale la ropa, desnúdalo", "You're dead to me!", "I'll kill you", "Lo voy a matar", "Zane quits but is drugged, triggering his heat.", "she slept with the man who rules the underworld", "As ruts near, they obsess over him.", "Ponle un dedo encima y estás muerto."]
    chan += ["WATCH FREE · TAP LEARN MORE", "MÍRALA GRATIS · TOCA MÁS INFORMACIÓN", "Tap to watch more episodes!", "Click the link below", "Watch now 👇"]
    chan += ["00:43 Limited time offer", "11:30 Watch for free for a limited time", "FREE", "Gratis", "Download now", "Continue Watching"]
    qua_cta = ["parents are like. | WÂTCH FREE • LEARN MORE", "WATCH FREE • LEARN MORÉ", "Little girl | WATCH FREE • LEARN MORE", "WATCH FREE - LEARN MORE", "MIRALA GRATIS • MAS INFORMACION", "WATCH FREE · LEARN MORE", "MÍRALA GRATIS · MÁS INFORMACIÓN", "WHAT HAPPENS NEXT? | WATCH FREE · LEARN MORE", "You're free to go.", "Ella es libre y gratis no hay nada.", "Minker taP the people closest to you.", "Ahora te toca a ti.", "No me presiones.", "Click.", "He tapped the glass."]
    chan += ["Tu esposa tiene un cuerpazo.", "bunch of horny bastards like you!"]
    chan += ["By the way, who in the flying fuck are you?", "Neil, get over here and teach this bitch a lesson!", "Beat up that fat pig!", "¡Eres una perra!", "Qué mierda"]
    qua = ["You've humiliated this whole town!", "Kneel before the Lord and beg forgiveness for your sins!", "The top pick in the mba Draft Combine",
           "His clothes are drenched in sin!", "stripped of his title", "No money, no help, no nothing.", "¿De verdad me acabas de golpear?",
           "sé que estás molesto.", "deadline is tomorrow", "Matarazzo", "skilled player", "the heat of the game", "stuck in a rut", "go to bed early", "Your stepbrother is a bully", "beautiful assessment", "a classic passage", "Watch Mr. Bastardo", "the beat goes on", "Hitchcock"] + qua_cta
    for c in chan: assert soat(c), "phải chặn: " + c
    for c in qua: assert not soat(c), "không được chặn: %s (khớp %s)" % (c, soat(c))
    print("tự kiểm: %d/%d đạt" % (len(chan) + len(qua), len(chan) + len(qua)))

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv: tu_kiem(); sys.exit(0)
    video, tu, den = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    loi = [(g, c, soat(c)) for g, c in doc(video, tu, den) if soat(c)]
    for g, c, k in loi: print("THOAI CHAN: %ds «%s» (từ: %s)" % (g, c[:120], k))
    print("THOAI OK" if not loi else "THOAI CHAN: %d khung — đoạn %s–%ss không cắt (Meta: Adult Sexual Exploitation)" % (len(loi), tu, den))
    sys.exit(2 if loi else 0)
