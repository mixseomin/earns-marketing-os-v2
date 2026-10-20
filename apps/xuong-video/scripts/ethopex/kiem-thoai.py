#!/usr/bin/env python3
"""CỔNG THOẠI NHẠY CẢM cho creative cảnh thật (bài học 20/10/2026, anh: "phải học để rút kn lần sau"):
Meta từ chối #65717 (Number One 1136–1200s) + #65719 (1280–1352s) vì "Adult Sexual Exploitation — suggested sexual threat or violence".
Gốc: phụ đề in cứng của app gốc nói thẳng chuyện mua bán dâm / quan hệ ("banged", "prostitute yourself", "manwhore", "dirty prostitute
money", "sells himself") + đe doạ lột đồ trước đám đông ("Let's strip this fraud down"). Các đoạn cùng phim không có những chữ đó thì qua.
Máy duyệt Meta không nhất quán (đoạn có "gigolo" vẫn qua) → không trông may rủi: đoạn nào phụ đề dính từ dưới đây thì KHÔNG cắt.
Đọc phụ đề: mỗi giây một khung → doc-chu.swift (Vision macOS, 0đ).
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
MAU = re.compile("|".join(CAM), re.I)

def soat(cau):
    """→ từ khớp đầu tiên hoặc None"""
    m = MAU.search(cau or "")
    return m.group(0) if m else None

def may_doc():
    """doc-chu.swift biên dịch MỘT lần thành ~/.cache/ethopex/doc-chu (dịch lại khi tệp nguồn mới hơn). 20/10/2026: chạy `swift doc-chu.swift`
    (thông dịch) 4 lượt song song thì treo nhau hơn 1 giờ ở khoá module cache → luôn dùng bản đã biên dịch."""
    src = os.path.join(D, "doc-chu.swift"); bin_ = os.path.expanduser("~/.cache/ethopex/doc-chu")
    if not os.path.exists(bin_) or os.path.getmtime(bin_) < os.path.getmtime(src):
        os.makedirs(os.path.dirname(bin_), exist_ok=True); tmp = bin_ + ".%d" % os.getpid()
        subprocess.run(["swiftc", "-O", src, "-o", tmp], check=True, capture_output=True, timeout=600); os.replace(tmp, bin_)
    return bin_

def doc(video, tu, den):
    with tempfile.TemporaryDirectory() as t:
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(tu), "-t", str(den - tu), "-i", video, "-vf", "fps=1,scale=540:-2", f"{t}/k%04d.png"], check=True)
        anh = sorted(os.listdir(t))
        r = subprocess.run([may_doc()] + [f"{t}/{a}" for a in anh], capture_output=True, text=True, check=True, timeout=600)
        return [(tu + i, json.loads(l)["chu"]) for i, l in enumerate(r.stdout.splitlines())]

def tu_kiem():
    chan = ["Lord knows how many old grannies you banged out there.", "You really thought you could just run off and prostitute yourself,",
            "is that you're a *** manwhore!", "How could you afford them if not with your dirty prostitute money?", "from those old women he sells himself to.",
            "Let's strip this fraud down and donate his gear to the church!", "Everyone knows he got locked up for doing sex work for old hags.",
            "Malik— you're just a cheap gigolo.", "¡Eres una puta!", "Quítale la ropa, desnúdalo", "You're dead to me!", "I'll kill you", "Lo voy a matar", "Ponle un dedo encima y estás muerto."]
    qua = ["You've humiliated this whole town!", "Kneel before the Lord and beg forgiveness for your sins!", "The top pick in the mba Draft Combine",
           "His clothes are drenched in sin!", "stripped of his title", "No money, no help, no nothing.", "¿De verdad me acabas de golpear?",
           "sé que estás molesto.", "deadline is tomorrow", "Matarazzo", "skilled player", "Your stepbrother is a bully"]
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
