#!/usr/bin/env python3
"""HOOK GIỮ CHÂN của câu đọc — MỘT lõi cho máy dựng (anh-tinh / dung-mau / bu-vo, iMac) và nút ✨ Sinh hook của ngăn Lên camp etp2 (box3).
Tách khỏi anh-tinh.py 27/11/2026 (anh: "Phải sinh được Hook. Có nút để sinh hook" · "câu đọc + hook phải là 1"): anh-tinh nạp PIL + cấm chạy trên box3, nên nút
etp2 không gọi được; mô-đun này chỉ cần thư viện chuẩn, tự biết đang ở box3 (psql cục bộ) hay iMac (ssh box3).
SỔ: etp.cau_hinh 'hook_phim' {cid: {lang: [hook câu 0, hook câu 1, …]}} — hook vị trí i đọc TRƯỚC lời mời câu lc:i, thành MỘT câu liền.
SỔ: etp.cau_hinh 'cau_doc_an' ["en:5", …] — câu đọc anh xoá ở ngăn Lên camp: id giữ nguyên vị trí (dung-mau g_ghim / etp2 dsCau), máy chỉ không xoay vào.
Dùng (box3 hoặc iMac): python3 hook_phim.py <content_id> --thu 0,1,2 [--lai] [--form-tep <tệp chữ form>] --json
  --thu = các vị trí câu cần hook (mặc định: mọi câu đang hiện chưa có hook) · --lai = viết lại hook đã có · --form-tep = chữ form text (chữ chính + tiêu đề) làm đầu vào
  in một dòng JSON: {"hook": {"<i>": "câu" | null}, "loi": {"<i>": "lý do"}, "vnd": ₫}"""
import json, os, re, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(D, "..", "..", "..", "etp")); import ai_chu as AI
B = "root@167.233.241.16"; MONO_BOX3 = "/opt/earns-marketing-os-v2"
TREN_BOX3 = os.path.exists(f"{MONO_BOX3}/.env.production") and os.path.exists("/root/.secrets/spy.env")
ENV = f"cd {MONO_BOX3} && set -a; . ./.env.production; set +a"

def sql(q):
    lenh = f"{ENV}; psql \"$DATABASE_URL\" -tAq"
    return subprocess.run(["bash", "-c", lenh] if TREN_BOX3 else ["ssh", B, lenh], input=q, capture_output=True, text=True, check=True).stdout.strip()

def _mo_ta(url):
    """tóm tắt thật của phim (tai-tap.mo_ta) — lỗi thì rỗng"""
    try:
        import importlib.util
        s = importlib.util.spec_from_file_location("tt_mo_ta", os.path.join(D, "tai-tap.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m.mo_ta(url)
    except Exception as e: print("không đọc được tóm tắt phim:", e, file=sys.stderr); return ""

def cau_an():
    """id câu đọc anh đã xoá (etp.cau_hinh cau_doc_an) — lỗi đọc thì KÊU và coi như không ẩn câu nào"""
    try: return set(map(str, json.loads(sql("select gia_tri::text from etp.cau_hinh where khoa = 'cau_doc_an'") or "[]")))
    except Exception as e: print(f"⚠ không đọc được câu đọc đã xoá (cau_doc_an): {str(e)[:120]}", file=sys.stderr); return set()
def mau_hien(lang, so, an=None):
    """vị trí câu đọc máy được xoay vào: mọi câu trừ câu anh xoá; xoá hết thì vẫn trả đủ (không để máy kẹt) và KÊU"""
    keu = an is None; an = cau_an() if an is None else an
    ds = [i for i in range(so) if f"{lang}:{i}" not in an]
    if not ds and keu: print(f"⚠ mọi câu đọc {lang} đều đã xoá — máy tạm dùng lại cả sổ", file=sys.stderr)
    if not ds: return list(range(so))
    return ds
assert mau_hien("en", 4, {"en:1", "es:0"}) == [0, 2, 3] and mau_hien("en", 2, {"en:0", "en:1"}) == [0, 1]

# HOOK GIỮ CHÂN CỦA CÂU ĐỌC (anh 27/11/2026 "Nội dung câu đọc phải là hook giữ chân"): câu đọc chỉ có mời xem ("Watch X for free now. Watch more now.") không giữ ai;
# creative đội lãi đọc thêm MỘT câu cốt truyện ("They mocked this old man… Big mistake. Their son owns the airline."). Luật hook 31/10/2026: chữ từ nguồn THẬT, AI không tự nghĩ:
#   NỘI DUNG = chữ thật của CHÍNH phim: QC spy của phim (qc-spy-phim.sql) + tóm tắt app (tai-tap.mo_ta) — hook giữ ≥ HOOK_GIU chữ của nguồn này.
#   NHỊP = câu mở QC phim ngắn chạy lâu nhất cùng tiếng (qc-spy-hook.sql) — chỉ làm khuôn, KHÔNG lấy truyện: đó là tóm tắt phim khác
#   (thử 27/11/2026: lấy truyện từ kho này thì AI chép nguyên tóm tắt phim khác vào phim Bugatti — sai truyện).
# Kết quả ghi sổ etp.cau_hinh 'hook_phim' {cid: {lang: [hook câu 0, hook câu 1, …]}} — VỊ TRÍ i = hook của câu đọc lc:i (null = chưa có) — mọi bản dựng sau của phim dùng lại, không gọi AI lần hai. Hỏng → không có hook, KÊU TO.
HOOK_GIU, HOOK_CHU = 0.5, 30
HOOK_CTA = re.compile(r"(?i)\b(watch|click|free|download|episode|mira|gratis|descarga|haz clic|ver m[aá]s|serie completa)\b")
def _chu(t): return [w for w in re.findall(r"[^\W\d_]{3,}", (t or "").lower())]
def hook_dat(cau, goc, ten, mau=()):
    """→ lỗi (chuỗi) hoặc None: hook ngắn, không mời xem, không nhắc tên phim, giữ đủ chữ của nguồn thật CỦA PHIM (goc), không chép nguyên câu khuôn của phim khác"""
    if not cau or len(cau.split()) > HOOK_CHU: return f"dài {len((cau or '').split())} chữ > {HOOK_CHU}"
    if HOOK_CTA.search(cau): return "có chữ mời xem / free"
    t = re.sub(r"[^\w\s]", "", (ten or "").lower()).strip()
    if t and t in re.sub(r"[^\w\s]", "", cau.lower()): return "nhắc tên phim"
    c, g = _chu(cau), set(_chu(goc))
    giu = sum(1 for w in c if w in g) / max(1, len(c))
    if giu < HOOK_GIU: return f"chỉ {giu:.0%} chữ có trong tóm tắt / QC thật của phim < {HOOK_GIU:.0%} — chữ tự nghĩ"
    for m in mau:
        mm = set(_chu(m))
        if mm and sum(1 for w in c if w in mm and w not in g) / max(1, len(c)) > 0.25: return "chép chữ truyện của phim khác (câu khuôn)"
    return None
assert hook_dat("They mocked Leo on the plane. Big mistake. His son owns the airline.", "Leo, an old man mocked on the plane; his son owns the airline.", "Sky") is None
assert hook_dat("A brand new story nobody wrote before about dragons.", "Leo, an old man mocked on the plane.", "Sky") and hook_dat("Watch it free now.", "Watch it free now.", "Sky")
assert hook_dat("Leo hid that he was the Sinclair heiress magnate.", "Leo hid his past.", "Sky", ["She hid that she was the Sinclair heiress and made him a magnate."])

def hook_khac(cau, da):
    """→ lỗi hoặc None: hook mới na ná hook đã dùng của cùng phim (≥ 60% chữ trùng) — các bản cùng phim chạy cùng lúc phải nghe khác nhau"""
    c = set(_chu(cau))
    for h in da:
        d = set(_chu(h))
        if c and d and len(c & d) / min(len(c), len(d)) >= 0.6: return f"na ná hook đã dùng của phim: {h[:60]!r}"
    return None
assert hook_khac("They mocked Leo on the plane. His son owns the airline.", ["They mocked Leo on the plane. Big mistake, his son owns the airline."]) and hook_khac("Evelyn collapsed while Jack destroyed her heart medicine.", ["They mocked Leo on the plane."]) is None

def _spy(tep, **v):
    """chạy một tệp .sql trên DB spy (box3) → các dòng TSV"""
    vs = " ".join(f"-v {k}={str(x)}" for k, x in v.items())
    lenh = f". /root/.secrets/spy.env; psql \"$DATABASE_URL\" {vs} -tA -F'\t' -f -"
    r = subprocess.run(["bash", "-c", lenh] if TREN_BOX3 else ["ssh", B, lenh], input=open(os.path.join(D, tep)).read(), capture_output=True, text=True, timeout=180)
    if r.returncode != 0: raise RuntimeError(f"{tep}: {r.stderr[-200:]}")
    return [l.split("\t") for l in r.stdout.splitlines() if l.strip()]

def _cong_ai(de, viec, model="haiku", toi=160):
    """cổng AI chung (spy /api/ai — donk → ckey → fal, tự lùi; địa chỉ + khoá theo máy: ai_chu.cong_url / cong_khoa) → (chữ, ₫)"""
    import urllib.request
    k = AI.cong_khoa()
    if not k: raise RuntimeError("thiếu CONG_AI_KEY (box3: /root/.secrets/spy.env · iMac: ~/.secrets/cong-ai.env)")
    r = urllib.request.urlopen(urllib.request.Request(AI.cong_url(), method="POST", headers={"authorization": f"Bearer {k}", "content-type": "application/json", "user-agent": "Mozilla/5.0 hook-phim"},
        data=json.dumps({"viec": viec, "model": model, "max_tokens": toi, "noi_dung": de, "bo_chinh_hang": True}).encode()), timeout=120)
    j = json.loads(r.read()); return str(j.get("kq") or ""), round((j.get("chi_usd") or 0) * 26000)

def _ds_hook(so, cid, lang):
    """sổ hook_phim[cid][lang] → danh sách THEO VỊ TRÍ (vị trí i = hook của câu đọc i, None = chưa có). Bản cũ một dict → [dict]"""
    x = (so.get(str(cid)) or {}).get(lang)
    if isinstance(x, dict): return [x]
    return [h if isinstance(h, dict) and h.get("cau") else None for h in (x or [])]
assert _ds_hook({"1": {"en": {"cau": "a"}}}, 1, "en") == [{"cau": "a"}] and _ds_hook({"1": {"en": [{"cau": "a"}, {"cau": "b"}]}}, 1, "en")[1]["cau"] == "b" and _ds_hook({}, 1, "en") == []
assert _ds_hook({"1": {"en": [None, {"cau": "b"}]}}, 1, "en") == [None, {"cau": "b"}], "ô trống phải giữ vị trí, không dồn hook câu sau lên"

def hook_phim(cid, lang, ten, ghi=True, thu=0, form=None, lai=False):
    """→ ({cau, nguon, mau} | None, ₫). Sổ trước; chữ từ QC spy của phim + tóm tắt app; nhịp từ câu mở QC phim ngắn chạy lâu nhất.
    thu = VỊ TRÍ CÂU ĐỌC (lc:thu) mà hook này đứng trước — hook[i] + lời mời câu i = MỘT câu liền (anh 27/11/2026 "câu đọc + hook phải là 1");
    câu khác nhau → hook khác góc / xung đột (hook_khac chặn câu na ná) nên 3 creative cùng phim không đọc y một câu ("Ko cho chạy đồng thời như vậy").
    form = chữ Form text (chữ chính + tiêu đề) của lần lên — hook kể cùng khoảnh khắc với chữ người xem đọc (anh 27/11/2026) · lai = viết lại ô đã có."""
    cid, lang, thu = int(cid), (lang or "en")[:2].lower(), max(0, int(thu or 0))
    try: so = json.loads(sql("select gia_tri::text from etp.cau_hinh where khoa = 'hook_phim'") or "{}")
    except Exception as e: print(f"⚠ không đọc được sổ hook_phim: {str(e)[:120]}", file=sys.stderr); so = {}
    da = _ds_hook(so, cid, lang)
    if not lai and thu < len(da) and da[thu]: return da[thu], 0
    khac = [h for i, h in enumerate(da) if h and i != thu]   # hook các câu KHÁC của phim — câu mới phải khác góc
    url = sql(f"select coalesce((select url from etp.phim where content_id = {cid}), (select url from etp.thu_vien_phim where content_id = {cid}), '')")
    mo = _mo_ta(url) if url else ""
    rieng = []
    try:   # QC spy của chính phim — câu mở
        for r in _spy("qc-spy-phim.sql", ids=cid):
            c = re.match(r"^(.{30,220}?[.!?])(\s|$)", r[6] if len(r) > 6 else "")
            if c and not HOOK_CTA.search(c.group(1)): rieng.append((c.group(1), r[1]))
    except Exception as e: print(f"⚠ QC spy của phim {cid}: {e}", file=sys.stderr)
    goc = " ".join([mo] + [c for c, _ in rieng]).strip()
    if len(goc) < 40: print(f"✗ HOOK phim {cid}: không có tóm tắt / QC thật của phim (url {url or 'trống'}) — câu đọc KHÔNG có hook", file=sys.stderr); return None, 0
    try: mau = [{"cau": r[3], "id": r[0], "so_ngay": int(r[2] or 0)} for r in _spy("qc-spy-hook.sql", lang=lang) if len(r) > 3][:20]
    except Exception as e: print(f"⚠ kho câu khuôn spy: {e}", file=sys.stderr); mau = []
    chi, loi = 0, ""
    de = (f"Short drama: {ten}\nREAL synopsis of THIS drama (from the app):\n{mo[:1200]}\n"
          + ("REAL ads of THIS drama (opening lines):\n" + "\n".join(f"- {c}" for c, _ in rieng[:6]) + "\n" if rieng else "")
          + ("\nOpening lines of long-running ads for OTHER dramas — use ONLY as rhythm / hook style examples, NEVER copy their story, names or facts:\n"
             + "\n".join(f"{i + 1}. {m['cau']}" for i, m in enumerate(mau)) + "\n" if mau else "")
          + f"\nWrite ONE spoken hook line for a video ad of THIS drama: the most gripping conflict / twist from its synopsis, built mostly from the synopsis' own words "
          f"(names, roles, facts exactly as in the synopsis), at most {HOOK_CHU - 4} words, present the setup and the stakes, no spoiler of the ending, no title, "
          f"no 'watch' / 'free' / call to action, in {'Spanish (Latin America)' if lang == 'es' else 'English'}.\n"
          + ("\nHooks ALREADY used for this drama — yours must show a DIFFERENT moment / conflict / character angle, sharing no phrase with them:\n"
             + "\n".join(f"- {h['cau']}" for h in khac) + "\n" if khac else "")
          + ("\nThe ad's ON-SCREEN TEXT (Facebook primary text / headline the viewer reads next to the video) — the hook must tell the SAME moment / conflict / angle as this text, so what they hear matches what they read (do not copy it word for word; facts still only from the synopsis):\n" + form.strip()[:1500] + "\n" if form and form.strip() else "")
          +
          "Answer EXACTLY two lines:\nSTYLE: <number of the example whose rhythm you followed, or 0>\nHOOK: <line>")
    for lan in range(2):
        try:
            t, v = _cong_ai(de + (f"\n\nYour previous answer was rejected: {loi}. Use the synopsis' own words." if loi else ""), "etp-hook-cau-doc"); chi += v
            p = re.search(r"STYLE:\s*(\d+)", t); h = re.search(r"HOOK:\s*(.+)", t)
            if not h: loi = f"không đúng khuôn: {t[:100]!r}"; continue
            cau = h.group(1).strip().strip('"“”')
            loi = hook_dat(cau, goc, ten, [m["cau"] for m in mau]) or hook_khac(cau, [h["cau"] for h in khac]) or ""
            if loi: print(f"✗ hook phim {cid} lần {lan + 1}: {loi} — {cau!r}", file=sys.stderr, flush=True); continue
            k = int(p.group(1)) if p else 0; m = mau[k - 1] if 1 <= k <= len(mau) else None
            ra = {"cau": cau, "nguon": "tóm tắt app" + (" + QC spy phim " + ",".join(i for _, i in rieng[:3]) if rieng else ""),
                  **({"mau": {"cau": m["cau"], "spy": m["id"], "so_ngay": m["so_ngay"]}} if m else {})}
            if ghi:
                so = json.loads(sql("select gia_tri::text from etp.cau_hinh where khoa = 'hook_phim'") or "{}"); ds = _ds_hook(so, cid, lang)
                if not lai and thu < len(ds) and ds[thu]: return ds[thu], chi   # phiên khác vừa ghi đúng ô này
                ds = ds + [None] * (thu + 1 - len(ds)); ds[thu] = ra; so.setdefault(str(cid), {})[lang] = ds   # ghi ĐÚNG vị trí câu i, không nối đuôi
                sql(f"insert into etp.cau_hinh (khoa, gia_tri) values ('hook_phim', $J${json.dumps(so, ensure_ascii=False).replace('$J$', '')}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri")
            return ra, chi
        except Exception as e: loi = str(e)[:120]; print(f"✗ hook phim {cid} lần {lan + 1} lỗi: {loi}", file=sys.stderr, flush=True)
    print(f"✗ HOOK phim {cid}: AI hai lần không ra hook đạt ({loi}) — câu đọc KHÔNG có hook", file=sys.stderr); return None, chi


def _phim(cid):
    r = sql(f"select coalesce(p.ten, v.ten, ''), coalesce(p.locale, v.locale, '') from (select {int(cid)}::int content_id) k left join etp.phim p using (content_id) left join etp.thu_vien_phim v using (content_id)")
    ten, loc = (r.split("|") + [""])[:2]
    return re.sub(r"\s*[（(](?:DUBBED|Doblado)[)）]\s*", " ", ten).strip(), ("es" if re.match(r"\s*(es|span)", loc, re.I) else "en")

if __name__ == "__main__":
    a = sys.argv[1:]
    def lay(k):
        return a[a.index(k) + 1] if k in a and a.index(k) + 1 < len(a) else None
    cid = int(a[0]); ten, lang = _phim(cid)
    if not ten: print("JSON:" + json.dumps({"loi_chung": f"phim #{cid} không có trong etp.phim / thư viện phim"}, ensure_ascii=False)); sys.exit(0)
    form = open(lay("--form-tep"), encoding="utf-8").read() if lay("--form-tep") else None
    so_cau = int(lay("--so-cau") or 0)
    if lay("--thu"): thu = [int(x) for x in lay("--thu").split(",") if x.strip().isdigit()]
    else:
        da = _ds_hook(json.loads(sql("select gia_tri::text from etp.cau_hinh where khoa = 'hook_phim'") or "{}"), cid, lang)
        thu = [i for i in mau_hien(lang, so_cau) if not (i < len(da) and da[i])]
    ra, loi, vnd = {}, {}, 0
    for i in thu[:12]:   # trần 12 ô một lần bấm (~12 lượt haiku, vài trăm ₫)
        h, v = hook_phim(cid, lang, ten, thu=i, form=form, lai="--lai" in a); vnd += v
        ra[str(i)] = (h or {}).get("cau")
        if not h: loi[str(i)] = "AI hai lần không ra hook đạt luật (giữ chữ tóm tắt phim, không mời xem, không tên phim) — xem nhật ký"
    print("JSON:" + json.dumps({"hook": ra, "loi": loi, "vnd": vnd, "lang": lang}, ensure_ascii=False))
