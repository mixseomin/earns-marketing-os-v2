#!/usr/bin/env python3
"""SINH CHỮ KIỂU KIÊN CHO PHIM CHƯA CÓ (anh 27/11/2026: "Mày phải sinh luôn text cho kiểu Kiên lúc review Ảnh").
Khuôn Kiên (apps/etp/chu-kieu.json "_"): chữ chính = hook cốt truyện + câu hỏi + đuôi "Watch Free! Stream The Full Series"; tiêu đề cảm thán ngắn; mô tả một dòng.
Nguồn sự thật: mô tả + cốt truyện Ethopex của chính phim (GET api-multi-be /api/v2/movie/contents/<id>, chỉ đọc) + 3 bộ chữ tay cùng ngôn ngữ làm mẫu giọng.
Qua cổng AI chung (apps/etp/ai_chu.py, haiku, ~100–300₫ / phim), soát thoại cấm (kiem-thoai.soat) + khuôn, sai → thử lại tuyến khác, vẫn sai → KHÔNG ghi.
Ghi etp.chu_kieu (0487); mọi nơi đọc qua apps/etp/so_kieu.py. Phim đã có (sổ tay hoặc bảng) → bỏ qua, trừ --lai.
  python3 apps/etp/sinh-chu-kien.py <content_id> … [--lai] [--xem]   (--xem: in, không ghi)
  python3 apps/etp/sinh-chu-kien.py --cho       mọi phim đang ở etp.cho_len 'cho' / 'duyet' mà chưa có chữ Kiên
  python3 apps/etp/sinh-chu-kien.py --tu-kiem"""
import html, importlib.util, json, os, re, sys, urllib.request
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import ai_chu as AI, so_kieu as SK
_s = importlib.util.spec_from_file_location("kt", os.path.join(D, "..", "xuong-video", "scripts", "ethopex", "kiem-thoai.py")); KT = importlib.util.module_from_spec(_s); _s.loader.exec_module(KT)
q = SK.q_mac
DUOI = "Watch Free! Stream The Full Series"
MB = "https://api-multi-be.ethopex.dev"
TEN_NN = {"en": "English", "es": "Spanish"}

def s(v): return "null" if v is None else "$S$" + str(v).replace("$S$", "") + "$S$"

def phim(cid):
    """→ (tên, ngôn ngữ, mô tả Ethopex) — chỉ đọc"""
    r = q(f"select coalesce(ten, '') || E'\\t' || coalesce(locale, substring(url from 'dramaboxdb[.]com/([a-z][a-z])/(?:ep|movie)/'), '') from etp.phim where content_id = {int(cid)}")
    ten, lang = (r.split("\t") + [""])[:2] if r else ("", "")
    tay = cot_tay(cid)   # anh dán ở phiếu lên camp (#1952) = nguồn sự thật, đứng trước Ethopex / trang nguồn
    if len(tay) >= 80: return ten, ("es" if lang.lower().startswith("es") else "en"), tay
    mo = ""
    try:
        T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
        it = json.load(urllib.request.urlopen(urllib.request.Request(f"{MB}/api/v2/movie/contents/{int(cid)}", headers={"authorization": "Bearer " + T, "user-agent": "mos2-etp"}), timeout=60)).get("item") or {}
        ten = ten or it.get("title") or it.get("name") or ""
        lang = lang or str(it.get("locale") or it.get("language") or "")
        mo = " ".join(str(it.get(k) or "") for k in ("description", "storyline", "synopsis")).strip()
    except Exception as e: print(f"phim {cid}: đọc mô tả Ethopex lỗi ({str(e)[:100]})", file=sys.stderr)
    if len(mo) < 80: mo = truyen(q(f"select coalesce(url, '') from etp.phim where content_id = {int(cid)}"), ten) or mo
    lang = "es" if lang.lower().startswith("es") else "en"
    return ten, lang, mo

_BO = set("the a an of to and in on my his her by for with is be from at no not".split()) | set("el la los las de del y en mi su un una por con".split())
def tu_ten(ten):
    """từ khoá của tên phim (bỏ từ nối, ≥ 3 chữ cái)"""
    return {w for w in re.findall(r"[^\W\d_]{3,}", ten.lower()) if w not in _BO}

def chon_truyen(ds, ten, meta=()):
    """trang nguồn chứa cả đoạn giới thiệu của PHIM GỢI Ý (DramaBox 27/11/2026: phim 157026 'Claimed by the Prince' bốc nhầm truyện
    'billionaire professor Colton' của phim khác vì lấy đoạn DÀI NHẤT) → chỉ nhận đoạn nhắc tên phim, rồi đoạn trùng nhiều từ khoá tên nhất (≥ 1);
    không đoạn nào khớp → mô tả <meta> của CHÍNH trang (meta chỉ tả phim của trang, không chứa phim gợi ý — ReelShort 61412 'Falling for the
    Cowboy Dad' tóm tắt không nhắc chữ nào trong tên, #1952); không có cả meta → '' (từ chối sinh, không đoán)"""
    tt, kt = re.sub(r"\W+", " ", ten.lower()).strip(), tu_ten(ten)
    co_ten = [d for d in ds if tt and tt in re.sub(r"\W+", " ", d.lower())]
    if co_ten: return max(co_ten, key=len)
    diem = [(len(kt & tu_ten(d)), len(d), d) for d in ds]
    diem = [x for x in diem if x[0] >= 1]
    if diem: return max(diem)[2]
    return max(meta, key=len) if meta else ""

def truyen(url, ten=""):
    """cốt truyện trên trang nguồn của phim (ReelShort meta description · DramaBox "introduction" trong dữ liệu trang) — chỉ đọc; không có / không khớp tên phim → ''"""
    if not url.startswith("http"): return ""
    try: t = urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": "Mozilla/5.0"}), timeout=30).read().decode("utf8", "ignore")
    except Exception as e: print(f"trang nguồn {url[:80]}: lỗi {str(e)[:80]}", file=sys.stderr); return ""
    me = [html.unescape(m) for m in re.findall(r'<meta[^>]+(?:name|property)="(?:og:)?description"[^>]+content="([^"]+)"', t)]
    ds = me + [json.loads('"' + m + '"') for m in re.findall(r'"(?:introduction|intro|synopsis|description)"\s*:\s*"((?:[^"\\]|\\.){80,3000})"', t)]
    sach = lambda xs: [d.strip() for d in xs if len(d.strip()) >= 80 and not re.search(r"watch online\s*$", d, re.I)]
    return chon_truyen(sach(ds), ten, sach(me)) if ten else ""

def cot_tay(cid):
    """cốt truyện anh bổ sung trên phiếu lên camp etp2 (etp.cot_truyen_tay, 0498) — chưa có → ''"""
    try: return (q(f"select chu from etp.cot_truyen_tay where content_id = {int(cid)}") or "").strip()
    except Exception as e: print(f"phim {cid}: đọc cốt truyện tay lỗi ({str(e)[:80]})", file=sys.stderr); return ""

def mau(lang, n=3):
    """bộ chữ tay cùng ngôn ngữ (sổ chu-kieu.json) làm mẫu giọng"""
    es = lambda t: bool(re.search(r"[¿¡]", t))
    ds = [v for k, v in (SK.so_tay().get("kien") or {}).items() if k.isdigit() and es(v["primaryTexts"][0].rsplit(DUOI, 1)[0]) == (lang == "es")]
    return ds[:n]

def _tu(t): return set(re.findall(r"[^\W_]+", t.lower().replace(DUOI.lower(), "")))
def trung(a, b):
    """tỉ lệ từ của b nằm trong a (0–1) — đo chữ sinh lại có khác chữ cũ không"""
    x, y = _tu(a), _tu(b)
    return len(x & y) / max(1, min(len(x), len(y)))

def kiem(a, lang, soat=True, khac=None):
    """bộ chữ máy trả → lỗi đầu tiên hoặc None (khuôn Kiên + thoại cấm; soat=False chỉ soát khuôn — bộ tay anh đã duyệt có thể mang chữ như 'killer')"""
    if not isinstance(a, dict): return "không phải đối tượng"
    pt, hl, de = (str(a.get(k) or "").strip() for k in ("hook", "headline", "description"))
    if not pt or not hl or not de: return "thiếu phần"
    if DUOI.lower() in pt.lower(): return "hook không được tự kèm đuôi"
    if not re.search(r"\?\s*$", pt): return "hook phải kết bằng câu hỏi"
    if lang == "es" and "¿" not in pt: return "câu hỏi tiếng Tây Ban Nha thiếu ¿"
    if not 80 <= len(pt) <= 230: return f"hook dài {len(pt)} ký tự (80–230)"
    if len(hl) > 45 or not hl.endswith("!"): return f"tiêu đề phải ≤ 45 ký tự, kết bằng '!' ({hl!r})"
    if len(de) > 60 or "\n" in de: return f"mô tả phải một dòng ≤ 60 ký tự ({de!r})"
    for t in ((pt, hl, de) if soat else ()):
        m = KT.soat(t)
        if m: return f"chữ cấm {m!r}"
    if khac:   # nút ↻ sinh lại: chữ mới phải KHÁC chữ đang có (anh 27/11/2026 "bấm vào thì giống hệt lúc trước")
        for t in (pt, hl, de):
            if trung(t, khac) >= 0.6: return f"chữ mới trùng {round(trung(t, khac) * 100)}% chữ đang có ({t[:60]!r}) — phải viết khác hẳn"
    return None

LUAT = """You write Facebook ad copy for the short drama "{ten}" in {nn}, in the exact house style shown in the examples.
Story facts (from the drama's own page — use ONLY these facts, invent nothing beyond them):
{mo}

House style examples (same language):
{vd}

Write ONE new set for "{ten}":
- hook: 2 sentences, {nn}. Sentence 1 = the core conflict / hidden identity / humiliation set-up in one punchy line. Sentence 2 = a question about what happens next, ending with "?" (Spanish: ¿…?). 80–200 characters total. Do NOT add any "Watch Free" tail.
- headline: one short exclamation in {nn}, max 40 characters, ends with "!" (Spanish: ¡…!).
- description: one plain line in {nn}, max 55 characters, no ending question.
Facebook-safe: no sexual words or innuendo (no breast, naked, bed, seduce, sleep with, wet nurse, milk), no violence words (kill, dead, blood, murder), no slurs, no emojis, no hashtags, no click/tap words."""

def sinh(cid, nn=None, khac=None):
    ten, lang, mo = phim(cid)
    if nn in ("en", "es"): lang = nn   # phiếu lên camp etp2: anh chọn ngôn ngữ chữ (--lang)
    if not ten: return None, 0, f"phim {cid}: không có trong etp.phim / Ethopex"
    if len(mo) < 80: return None, 0, f"phim {cid}: không đọc được cốt truyện (Ethopex + trang nguồn) — không sinh để khỏi bịa"
    vd = "\n".join(f"- hook: {v['primaryTexts'][0].rsplit(DUOI, 1)[0].strip()}\n  headline: {v['headlines'][0]}\n  description: {v['descriptions'][0]}" for v in mau(lang))
    de_bai = LUAT.format(ten=ten, nn=TEN_NN[lang], mo=mo[:2500], vd=vd)
    if khac: de_bai += f"\n\nThe current version is below. Write a CLEARLY DIFFERENT one: a different angle of the story, different wording, no sentence reused:\n{khac}"
    a, vnd, mh, loi = AI.goi(de_bai, max_tokens=500, timeout=120, viec="sinh-chu-kien",
                             cong_cu=("ghi", {"type": "object", "required": ["hook", "headline", "description"],
                                              "properties": {"hook": {"type": "string"}, "headline": {"type": "string"}, "description": {"type": "string"}}}),
                             kiem=lambda a: kiem(a, lang, khac=khac))
    if not a: return None, vnd, f"phim {cid}: máy không ra bộ chữ đạt khuôn ({loi})"
    return {"content_id": int(cid), "lang": lang, "ten": ten, "mo_hinh": mh, "primaryTexts": [a["hook"].strip() + " " + DUOI],
            "headlines": [a["headline"].strip()], "descriptions": [a["description"].strip()]}, vnd, None

def ghi(b, vnd):
    j = lambda v: "$J$" + json.dumps(v, ensure_ascii=False).replace("$J$", "") + "$J$::jsonb"
    q(f"""insert into etp.chu_kieu (content_id, kieu, pt, hl, de, lang, mo_hinh, vnd) values ({b['content_id']}, 'kien', {j(b['primaryTexts'])}, {j(b['headlines'])}, {j(b['descriptions'])},
          {s(b['lang'])}, {s(b['mo_hinh'])}, {round(vnd)}) on conflict (content_id, kieu) do update set pt = excluded.pt, hl = excluded.hl, de = excluded.de,
          lang = excluded.lang, mo_hinh = excluded.mo_hinh, vnd = excluded.vnd, tao = now()""")

def chay(ids, lai=False, xem=False, js=False, nn=None, khac=None):
    tong, loi = 0.0, 0
    for c in dict.fromkeys(int(x) for x in ids):
        if not lai and SK.bo("kien", c): print(f"phim {c}: đã có chữ Kiên — bỏ qua"); continue
        b, vnd, l = sinh(c, nn, khac); tong += vnd
        if l: print(f"✗ {l}", flush=True); loi += 1; continue
        if not xem: ghi(b, vnd)
        if js: print("JSON:" + json.dumps({**b, "vnd": round(vnd)}, ensure_ascii=False), flush=True)   # phiếu lên camp etp2 (sinh lại chữ K, --xem: không ghi sổ) đọc dòng này
        print(f"{'(xem) ' if xem else '✓ '}phim {c} {b['ten']!r} [{b['lang']}] {round(vnd)}₫ · {b['mo_hinh']}\n  chữ chính: {b['primaryTexts'][0]}\n  tiêu đề:   {b['headlines'][0]}\n  mô tả:     {b['descriptions'][0]}", flush=True)
    print(f"tổng chi AI: {round(tong)}₫ · lỗi {loi}", flush=True)
    return loi

def cho():
    r = q("select string_agg(distinct content_id::text, ' ') from etp.cho_len where trang_thai in ('cho', 'duyet')")
    return [int(x) for x in (r or "").split()]

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv:
        ok = {"hook": "She mocked the janitor for months. What will she do when he walks in as the new CEO?", "headline": "She mocked the real boss!", "description": "The janitor owned the company all along."}
        assert kiem(ok, "en") is None, kiem(ok, "en")
        assert "câu hỏi" in kiem({**ok, "hook": "She mocked the janitor for months and he was secretly the new CEO of it all."}, "en")
        assert "đuôi" in kiem({**ok, "hook": ok["hook"] + " " + DUOI}, "en")
        assert "¿" in kiem(ok, "es")
        assert "tiêu đề" in kiem({**ok, "headline": "She mocked the real boss of the whole company today"}, "en")
        assert "chữ cấm" in kiem({**ok, "hook": "He was drugged at the party by his own wife. What will she do when he finds out the truth?"}, "en")
        assert "thiếu" in kiem({}, "en")
        assert "trùng" in kiem(ok, "en", khac=ok["hook"] + " " + DUOI), "sinh lại ra y chữ cũ phải bị trả về"
        assert kiem(ok, "en", khac="A billionaire heiress hides her name to test her fiance. Will he pass?") is None, "chữ khác hẳn phải qua"
        for c, v in (SK.so_tay().get("kien") or {}).items():   # mọi bộ chữ tay phải qua chính cổng khuôn này (cổng không chặn oan khuôn anh đã duyệt)
            if not c.isdigit(): continue
            l = "es" if re.search(r"[¿¡]", v["primaryTexts"][0].rsplit(DUOI, 1)[0]) else "en"
            e = kiem({"hook": v["primaryTexts"][0].rsplit(DUOI, 1)[0].strip(), "headline": v["headlines"][0], "description": v["descriptions"][0]}, l, soat=False)
            assert e is None, f"bộ tay {c} không qua khuôn: {e}"
        assert len(mau("en")) and len(mau("es")), "sổ tay phải có mẫu cả en lẫn es"
        # trang nguồn có đoạn của phim gợi ý dài hơn → vẫn chọn đúng đoạn của phim; không đoạn nào khớp → rỗng (từ chối)
        _dung = "A commoner widow, Clara, spends one night with a stranger, never knowing he's Crown Prince Gabriel, then is chosen as the castle wet nurse."
        _khac = "She kissed a stranger to get back at her cheating ex, never guessing he's Colton Denizen, the billionaire professor she respects, and now a dangerous hunt begins for everyone."
        assert chon_truyen([_khac, _dung], "Claimed by the Prince:The Forbidden Wet Nurse") == _dung
        assert chon_truyen([_khac, "Claimed by the Prince The Forbidden Wet Nurse Episode 1 " + _dung], "Claimed by the Prince:The Forbidden Wet Nurse").startswith("Claimed")
        assert chon_truyen([_khac], "Claimed by the Prince:The Forbidden Wet Nurse") == ""
        # #1952: ReelShort 61412 tả phim không nhắc chữ nào của tên → meta của chính trang vẫn nhận; đoạn JSON phim gợi ý thì không
        _meta = "Forced into marriage by her scheming grandmother and sister, Natalia becomes the wife of Leonardo, a rugged rural rancher and devoted single father."
        assert chon_truyen([_meta, _khac], "Falling for the Cowboy Dad", [_meta]) == _meta
        assert chon_truyen([_khac], "Falling for the Cowboy Dad", []) == ""
        assert chon_truyen([_meta, _dung], "Claimed by the Prince:The Forbidden Wet Nurse", [_meta]) == _dung
        assert callable(cot_tay)
        assert truyen("https://x", "") == "" and truyen("khong-phai-link", "Ten") == ""
        print("sinh-chu-kien tự kiểm ok"); sys.exit(0)
    ids = cho() if "--cho" in sys.argv else [x for x in sys.argv[1:] if x.isdigit()]
    if not ids: raise SystemExit(__doc__)
    _nn = sys.argv[sys.argv.index("--lang") + 1] if "--lang" in sys.argv[:-1] else None
    if _nn not in (None, "en", "es"): raise SystemExit(f"--lang phải là en hoặc es (nhận {_nn})")
    _kh = sys.argv[sys.argv.index("--khac") + 1] if "--khac" in sys.argv[:-1] else None   # nút ↻ phiếu etp2: chữ đang có, máy phải viết khác
    sys.exit(1 if chay(ids, "--lai" in sys.argv, "--xem" in sys.argv, "--json" in sys.argv, _nn, _kh) else 0)
