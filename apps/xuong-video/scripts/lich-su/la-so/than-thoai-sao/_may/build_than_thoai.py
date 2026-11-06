"""Dung + kiem thu vien 'The Myth Behind': tai lai trang Wikipedia, kiem moi cau nguyen van
(ca ban explaintext lan ban HTML render), ghi JSON vao OUT.  Chay: python3 -I build_than_thoai.py [--chi-kiem]"""
import json, re, sys, html, time, urllib.request, urllib.parse, os
from html.parser import HTMLParser
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from than_thoai_data import SAO

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # la-so/than-thoai-sao/
UA = {"User-Agent": "AstrolasResearch/1.0 (admin@mixseo.net)"}
CHI_KIEM = "--chi-kiem" in sys.argv

def get(url):
    for i in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8")
        except Exception as e:
            time.sleep(2 + i * 3); err = e
    raise err

class Txt(HTMLParser):
    SKIP = {"style", "script"}
    def __init__(s):
        super().__init__(); s.out = []; s.skip = 0
    def handle_starttag(s, tag, a):
        a = dict(a); cls = a.get("class") or ""
        if s.skip:
            if tag not in ("br","img","link","meta","wbr","hr"): s.skip += 1
            return
        if tag in s.SKIP or (tag == "sup" and ("reference" in cls or "noprint" in cls)) or "mw-ref" in cls:
            s.skip = 1; return
        if tag in ("p", "li", "h1", "h2", "h3", "h4", "h5", "dd", "dt", "blockquote", "tr", "div", "section"):
            s.out.append("\n")
    def handle_endtag(s, tag):
        if s.skip: s.skip -= 1
    def handle_data(s, d):
        if not s.skip: s.out.append(d)

def norm(t):
    t = re.sub(r"\[(?:\d+|[a-z]|[ivx]+|note \d+|citation needed|nb \d+)\]", "", t)
    t = t.replace(" ", " ").replace("​", "")
    return re.sub(r"\s+", " ", t).strip()

CACHE = {}
def page(title):
    if title in CACHE: return CACHE[title]
    q = urllib.parse.quote(title.replace(" ", "_"))
    ex = json.loads(get(f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles={q}"))
    p = ex["query"]["pages"][0]
    raw = p.get("extract", "")
    h = get(f"https://en.wikipedia.org/api/rest_v1/page/html/{urllib.parse.quote(p['title'].replace(' ', '_'), safe='')}")
    tp = Txt(); tp.feed(h)
    CACHE[title] = dict(title=p["title"], raw=raw, ex=norm(raw), html=norm("".join(tp.out)))
    time.sleep(0.3)
    return CACHE[title]

def url(title, sec=None):
    u = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"), safe="(),_'")
    return u + ("#" + urllib.parse.quote(sec.replace(" ", "_"), safe="(),_'") if sec else "")

def section(p, s):
    """Ten muc gan nhat dung truoc cau trong ban explaintext; None = phan mo dau."""
    pos = p["raw"].find(s)
    if pos < 0:
        pos = p["raw"].find(s[:60])
    sec = None
    for m in re.finditer(r"^(=+) (.*?) =+$", p["raw"], re.M):
        if 0 <= m.start() < pos: sec = m.group(2)
    return sec

def check(title, s):
    p = page(title); n = norm(s)
    return dict(ex=n in p["ex"], html=n in p["html"], p=p)

ket = []; so = []
os.makedirs(OUT, exist_ok=True)
for b in SAO:
    nguon = []
    def src(title):
        t = page(title)["title"]
        if url(t) not in nguon: nguon.append(url(t))
        return t
    rec = dict(ma=b["ma"], sao=b["sao"], ten=b["ten"], nguon=nguon, doc_luc="2026-11-05")
    tt, tc, loai = b["ten_goi"]
    c = check(tt, tc)
    t_title = page(tt)["title"]
    if c["ex"] and c["html"]:
        rec["ten_goi"] = dict(chu=tc, nguon=url(t_title, section(c["p"], tc)), loai=loai)
    else:
        rec["ten_goi"] = None
    ket.append((b["ma"], "ten_goi", tc[:70], c["ex"], c["html"]))
    moc = []
    for title, s, nv in b["moc"]:
        c = check(title, s)
        ket.append((b["ma"], "moc", s[:70], c["ex"], c["html"]))
        if c["ex"] and c["html"]:
            t = src(title)
            moc.append(dict(chu=s, nguon=url(t, section(c["p"], s)), nhan_vat=nv))
    rec["moc"] = moc
    dung = {n for m in moc for n in m["nhan_vat"]}
    nvs = []
    for ten, title, phrase in b["nhan_vat"]:
        if ten not in dung: continue
        c = check(title, phrase)
        ket.append((b["ma"], "nhan_vat:" + ten, phrase[:70], c["ex"], c["html"]))
        if c["ex"] and c["html"]:
            t = page(title)["title"]
            nvs.append(dict(ten=ten, mo_ta=phrase, nguon=url(t, section(c["p"], phrase))))
    rec["nhan_vat"] = nvs
    # nguon: trang hanh tinh truoc
    if rec["ten_goi"]:
        tg = url(t_title)
        if tg not in nguon: nguon.insert(0, tg)
    if not CHI_KIEM:
        with open(f"{OUT}/{b['ma']}.json", "w") as f:
            json.dump(rec, f, ensure_ascii=False, indent=2); f.write("\n")
    so.append(dict(ma=b["ma"], sao=b["sao"], ten=b["ten"], tep=f"{b['ma']}.json", so_cau=len(moc)))

if not CHI_KIEM:
    with open(f"{OUT}/_so.json", "w") as f:
        json.dump({"_ghi": "Thần thoại đằng sau tên các thiên thể — câu nguyên văn Wikipedia (The Myth Behind)", "sao": so}, f, ensure_ascii=False, indent=2); f.write("\n")

bad = [k for k in ket if not (k[3] and k[4])]
print(f"tong {len(ket)} muc, dat {len(ket)-len(bad)}, hong {len(bad)}")
for k in bad: print("HONG", k)
for s in so: print(s["ma"], s["so_cau"])
