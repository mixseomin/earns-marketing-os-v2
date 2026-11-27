#!/usr/bin/env python3
"""LÊN CAMP THEO PHIẾU (anh 27/11/2026: "Khi submit thì mày sẽ sx với các thông tin đó … để tao review lại creative 1 lần nữa trc khi đẩy camp lên.
Ko cần bước review camp thứ 2 nữa").

    python3 apps/etp/len-phieu.py <cho_len_id>        # etp2 › Chờ lên ✓ Duyệt thẻ có phiếu chạy tách (ETP_VE = vé TRỰC TIẾP 'tao_camp' anh vừa bấm)
    python3 apps/etp/len-phieu.py --tu-kiem

Duyệt = duyệt creative + lệnh lên camp. Máy dòng phim (iMac, cho_len.py) tải creative lên Ethopex với ĐÚNG chữ + link của phiếu → 'da_len' + creative_id;
tệp này chờ creative_id (≤ CHO_GIAY, vé sống ve_phut phút) rồi gọi nhan-ban MỘT lần với đúng phiếu: khuôn theo ngôn ngữ · bộ bo_phim_moi · ROAS (dàn / số) · ngân sách ·
domain (--mien) · giờ (khung cố định hoặc giờ anh đặt, --gio-tu-do khi ngoài khung). Kết quả ghi etp.cho_len.camp_id / camp_loi + etp.phieu_len.camp_ids / trang_thai.
Không tự xin vé (máy luật không bao giờ xin) — chờ quá hạn vé thì ghi camp_loi, thẻ hiện nút Lên camp để anh bấm lại (vé mới).

CREATIVE CŨ (phiếu dạng CU, anh 27/11/2026 "chọn creative cũ … ko phải tạo creative mới nữa"): thẻ mang muc.cr_cu = creative nguồn; cho_len.py KHÔNG tải thẻ này.
Luật 25/11 cấm gắn creative_id cũ vào camp mới → tệp này tạo BẢN MỚI cùng video với chữ + link của phiếu (ap-form-chu.ban_nha), chép sổ chấm của nguồn
(luot2.chep_so — cổng chấm Sạch của nhan-ban), đặt thẻ 'da_len' rồi đi tiếp đường nhan-ban như AD. Không dựng, không tốn tiền AI.
"""
import json, os, re, subprocess, sys, time

D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
SC = os.path.join(D, "..", "xuong-video", "scripts", "ethopex")
KHUON_CR = {"en": 65110, "es": 65734}   # trùng lenh_cho.KHUON_CR + repo etp2 › src/lib/etp-ke-cr.ts KHUON_CR
import cong as CG
import importlib.util as iu
def _nap(ten):   # ap-form-chu.py / luot2.py tên có gạch → nạp bằng đường dẫn
    sp = iu.spec_from_file_location(ten.replace("-", "_"), os.path.join(D, ten + ".py")); m = iu.module_from_spec(sp); sp.loader.exec_module(m); return m
CHO_GIAY = CG.VE_PHUT * 60 - 45   # vé trực tiếp sống ve_phut phút — gọi nhan-ban trước khi vé hết
HET_VE = "chờ creative tải lên quá hạn vé — bấm Lên camp lại trên thẻ (vé mới)"

def q(s): return CG._q(s)

def ten_camp(phim, lang, cr):   # cùng etp2 lib/etp-ke-cr.ts tenCampCr
    return f"duyet {re.sub(r'[^A-Za-z0-9 .,:!?#-]', '', phim or '')} {lang.upper()} - cr moi #{cr}"

def lenh(p, cr, bo):
    """dòng lệnh nhan-ban cho phiếu p (dict hàng etp.phieu_len + content_id/lang/phim; roas = mức của ĐÚNG thẻ — cho_len.phieu_roas, 0489) và creative cr"""
    if not re.fullmatch(r"dan|\d+(\.\d+)?", str(p["roas"])): raise SystemExit(f"camp đang sản xuất #{p['id']}: mức ROAS lạ {p['roas']!r} — không lên")
    lang = "es" if (p.get("lang") or "").startswith("es") else "en"
    a = [os.path.join(SC, "nhan-ban.py"), str(KHUON_CR[lang]), "--roas", "dan" if p["roas"] == "dan" else f"{float(p['roas']):g}", "--ns", str(int(p["ns"])),
         "--tay", "--bo", str(bo), "--creative", str(cr), "--content", str(p["content_id"]), "--ten", ten_camp(p.get("phim"), lang, cr)]
    if p.get("mien"): a += ["--mien", p["mien"]]
    if p.get("gio") and p["gio"] != "lich": a += ["--gio", p["gio"]] + (["--gio-tu-do"] if p.get("tu_do") else [])
    k = "K" if p.get("kieu") == "kien" else "D"
    chu = f"camp đang sản xuất #{p['id']}: {k} · {p.get('link')} · {p.get('dang')} · {p.get('mien') or 'domain mặc định'} · ROAS {p['roas']} · ${int(p['ns'])} · giờ {p.get('gio')}"
    return a + ["--that", "--luat", f"anh duyệt creative #{cr} ở etp2 › Chờ lên ({chu})", "--ai", f"anh (etp2 lên camp #{p['id']})"]

def lenh_bai(p):
    """DÙNG LẠI POST (anh 27/11/2026): ★ ROAS clone bài đăng của camp nhà goc — không --creative / --bo (bộ + Page + bài của camp gốc), chữ / link / nút là của bài"""
    if not re.fullmatch(r"dan|\d+(\.\d+)?", str(p["roas"])): raise SystemExit(f"camp đang sản xuất #{p['id']}: mức ROAS lạ {p['roas']!r} — không lên")
    if not (re.fullmatch(r"\d+_\d+", str(p.get("bai") or "")) and str(p.get("goc") or "").isdigit()): raise SystemExit(f"camp đang sản xuất #{p['id']}: thẻ dùng lại post thiếu mã bài / camp gốc — không lên")
    a = [os.path.join(SC, "nhan-ban.py"), str(int(p["goc"])), "--roas", "dan" if p["roas"] == "dan" else f"{float(p['roas']):g}", "--ns", str(int(p["ns"])), "--tay"]
    if p.get("mien"): a += ["--mien", p["mien"]]
    if p.get("gio") and p["gio"] != "lich": a += ["--gio", p["gio"]] + (["--gio-tu-do"] if p.get("tu_do") else [])
    chu = f"camp đang sản xuất #{p['id']}: dùng lại post {p['bai']} (camp #{p['goc']}) · {p.get('mien') or 'domain mặc định'} · ROAS {p['roas']} · ${int(p['ns'])} · giờ {p.get('gio')}"
    return a + ["--that", "--luat", f"anh duyệt dùng lại post ở etp2 › Chờ lên ({chu})", "--ai", f"anh (etp2 lên camp #{p['id']})"]

def chay_lenh(cl, p, a, cr):
    print("nhan-ban " + " ".join(a[1:]), flush=True)
    r = None
    try:
        r = subprocess.run(["python3", *a], capture_output=True, text=True, timeout=1500, cwd=SC)
        print(r.stdout[-3000:], r.stderr[-1500:], sep="\n", flush=True)
        kq = json.loads(next((l for l in reversed(r.stdout.strip().splitlines()) if l.startswith("{")), "{}") or "{}")
    except Exception as e: kq = {"ok": False, "loi": str(e)[:300]}
    if not kq and r is not None and r.returncode: kq = {"ok": False, "loi": (r.stderr.strip().splitlines() or ["nhan-ban lỗi"])[-1]}
    ghi_kq(cl, p["id"], kq.get("moi") if kq.get("ok") else None, None if kq.get("ok") else (kq.get("loi") or "nhan-ban không trả kết quả"))
    print(json.dumps({"ok": bool(kq.get("ok")), "camp": kq.get("moi"), "cr": cr, "bai": p.get("bai"), "loi": kq.get("loi")}, ensure_ascii=False))

def ghi_kq(cl, pid, camp, loi):
    loi_s = (loi or "").replace("$", "")[:400]
    q(f"update etp.cho_len set camp_id = {int(camp) if camp else 'null'}, camp_loi = {('$L$' + loi_s + '$L$') if loi else 'null'}, cap_nhat = now() where id = {int(cl)}")
    if not pid: return
    if camp: q(f"update etp.phieu_len set camp_ids = array_append(camp_ids, {int(camp)}), cap_nhat = now() where id = {int(pid)} and not ({int(camp)} = any(camp_ids))")
    # phiếu xong khi mọi bản (không bỏ) đã có camp; có bản lỗi → loi (thẻ có nút Lên camp lại)
    q(f"""update etp.phieu_len p set trang_thai = case when exists (select 1 from etp.cho_len c where c.phieu_id = p.id and c.trang_thai <> 'bo' and c.camp_loi is not null) then 'loi'
            when not exists (select 1 from etp.cho_len c where c.phieu_id = p.id and c.trang_thai <> 'bo' and c.camp_id is null) then 'xong' else 'len' end,
          loi = {('$L$' + loi_s + '$L$') if loi else 'null'}, cap_nhat = now() where id = {int(pid)}""")

def chay(cl):
    r = q(f"""select row_to_json(t) from (select c.id cl, c.trang_thai, c.creative_id, c.camp_id, c.loi, p.id, p.content_id, coalesce(p.lang, c.lang) lang, p.kieu, p.link, p.dang,
            p.mien, coalesce(c.phieu_roas, p.roas_ds[1], p.roas) roas, p.ns, p.gio, p.tu_do, p.chu, p.bo, (c.muc ->> 'cr_cu')::int cr_cu, c.muc ->> 'bai' bai, (c.muc ->> 'goc')::int goc, f.ten phim from etp.cho_len c join etp.phieu_len p on p.id = c.phieu_id left join etp.phim f on f.content_id = p.content_id
          where c.id = {int(cl)}) t""")
    if not r: raise SystemExit(f"cho_len #{cl} không gắn camp đang sản xuất nào — không lên")
    p = json.loads(r)
    if p.get("camp_id"): print(f"cho_len #{cl} đã có camp #{p['camp_id']}"); return
    q(f"update etp.phieu_len set trang_thai = 'len', cap_nhat = now() where id = {int(p['id'])} and trang_thai in ('cho_duyet', 'loi')")
    if p.get("bai"):   # dùng lại post: không tải / không tạo bản — nhận thẻ (một máy một thẻ) rồi clone bài
        if not q(f"""update etp.cho_len set trang_thai = 'dang_len', loi = null, cap_nhat = now() where id = {int(cl)}
                  and (trang_thai = 'duyet' or (trang_thai = 'dang_len' and cap_nhat < now() - interval '15 minutes')) returning id"""):
            ghi_kq(cl, p["id"], None, f"thẻ #{cl} không ở trạng thái duyệt (đang có máy khác lên?) — không lên trùng"); return
        try: a = lenh_bai(p)
        except SystemExit as e:
            ghi_kq(cl, p["id"], None, str(e)); q(f"update etp.cho_len set trang_thai = 'duyet', cap_nhat = now() where id = {int(cl)} and trang_thai = 'dang_len'"); return
        chay_lenh(cl, p, a, None)
        q(f"update etp.cho_len set trang_thai = case when camp_id is not null then 'da_len' else 'duyet' end, cap_nhat = now() where id = {int(cl)} and trang_thai = 'dang_len'")   # lỗi → về duyệt để Lên camp lại
        return
    if p.get("cr_cu") and not p.get("creative_id"):
        loi = ban_cu(p)
        if loi: ghi_kq(cl, p["id"], None, loi); return
    t0 = time.time()
    while True:
        x = json.loads(q(f"select row_to_json(t) from (select trang_thai, creative_id, loi from etp.cho_len where id = {int(cl)}) t"))
        if x["trang_thai"] == "bo": ghi_kq(cl, p["id"], None, "anh đã bỏ bản này"); return
        if x["trang_thai"] == "da_len" and x.get("creative_id"): break
        if time.time() - t0 > CHO_GIAY: ghi_kq(cl, p["id"], None, HET_VE + (f" (tải lỗi: {x['loi']})" if x.get("loi") else "")); return
        time.sleep(15)
    cr = int(x["creative_id"])
    bo = chon_bo(p)   # anh chọn bộ trên phiếu (0491 phieu_len.bo, anh 27/11/2026) — trống = bộ mặc định phim mới
    if not bo: ghi_kq(cl, p["id"], None, "thiếu bộ lên camp (camp đang sản xuất không chọn bộ và etp.cau_hinh bo_phim_moi trống)"); return
    chay_lenh(cl, p, lenh(p, cr, bo), cr)

def chon_bo(p):
    """bộ tk của phiếu: phieu_len.bo (anh chọn) hoặc etp.cau_hinh bo_phim_moi"""
    b = str(p.get("bo") or "").strip()
    if b:
        if not b.isdigit(): raise SystemExit(f"bộ tk lạ trên camp đang sản xuất: {b}")
        return b
    return q("select gia_tri#>>'{}' from etp.cau_hinh where khoa = 'bo_phim_moi'")

def body_cu(p):
    """chữ + link của phiếu cho bản mới từ creative cũ (CTA theo form như mọi bản nhà)"""
    c = p.get("chu") or {}
    if not (c.get("pt") and c.get("hl")): raise SystemExit(f"camp đang sản xuất #{p['id']}: thiếu chữ — không tạo bản")
    return {"call_to_action": CG_FORM()["call_to_action"], "link_url": p.get("link") or CG_FORM()["link_url"],
            "asset_spec": {"primaryTexts": list(c["pt"]), "headlines": list(c["hl"]), "descriptions": list(c.get("de") or [])}}

def CG_FORM():
    import ethopex_api as EA
    return EA.FORM

def ban_cu(p):
    """creative cũ → bản mới cùng video (chữ phiếu) → thẻ 'da_len'. Trả câu lỗi hoặc None. Nhận thẻ trước (một máy một thẻ), lỗi thì trả thẻ về 'duyet'."""
    cl, nguon, pid = int(p["cl"]), int(p["cr_cu"]), int(p["id"])
    if not q(f"""update etp.cho_len set trang_thai = 'dang_len', loi = null, cap_nhat = now() where id = {cl} and creative_id is null
              and (trang_thai = 'duyet' or (trang_thai = 'dang_len' and cap_nhat < now() - interval '15 minutes')) returning id"""):
        return f"thẻ #{cl} không ở trạng thái duyệt (đang có máy khác tạo bản?) — không tạo trùng"
    try:
        AF, L2 = _nap("ap-form-chu"), _nap("luot2")
        moi = AF.ban_nha(nguon, f" - phieu {pid}", body_cu(p))
        L2.chep_so(nguon, moi, ghi=f"anh duyệt creative cũ #{nguon} ở etp2 › Chờ lên (camp đang sản xuất #{pid}, thẻ #{cl})", ai=f"anh (etp2 lên camp #{pid})")
        q(f"""update etp.cho_len set trang_thai = 'da_len', creative_id = {int(moi)}, ket = '{json.dumps({"ok": True, "creative_id": int(moi), "tu": nguon})}'::jsonb, loi = null, cap_nhat = now()
              where id = {cl}""")
        print(f"creative cũ #{nguon} → bản mới #{moi} (chữ camp đang sản xuất #{pid})", flush=True)
        return None
    except BaseException as e:
        ly = str(e)[:300].replace("'", "")
        q(f"update etp.cho_len set trang_thai = 'duyet', loi = '{ly}', cap_nhat = now() where id = {cl} and trang_thai = 'dang_len'")
        return f"không tạo được bản mới từ creative cũ #{nguon}: {ly}"

def tu_kiem():
    p = {"id": 7, "content_id": 123, "lang": "es", "phim": "Café: Ñ!", "kieu": "kien", "link": "search.com", "dang": "AD", "mien": "maybic.com", "roas": "dan", "ns": 5, "gio": "lich", "tu_do": False}
    a = lenh(p, 999, "42")
    assert a[1] == "65734" and a[a.index("--roas") + 1] == "dan" and "--gio" not in a and a[a.index("--mien") + 1] == "maybic.com" and a[a.index("--ten") + 1] == "duyet Caf: ! ES - cr moi #999", a
    b = lenh({**p, "lang": "en", "roas": "1.1", "ns": 8, "mien": None, "gio": "2026-11-28 03:30", "tu_do": True}, 5, "42")
    c = lenh_bai({**p, "bai": "146_122", "goc": 91637, "roas": "1", "mien": None})
    assert c[1] == "91637" and c[c.index("--roas") + 1] == "1" and "--creative" not in c and "--bo" not in c and "--mien" not in c and "--that" in c, c
    try: lenh_bai({**p, "bai": "", "goc": 91637}); raise AssertionError("thiếu bài phải chặn")
    except SystemExit: pass
    assert b[1] == "65110" and b[b.index("--roas") + 1] == "1.1" and b[b.index("--ns") + 1] == "8" and "--mien" not in b and b[b.index("--gio") + 1] == "2026-11-28 03:30" and "--gio-tu-do" in b
    assert "--gio-tu-do" not in lenh({**p, "gio": "2026-11-28 22:00", "tu_do": False}, 5, "42") and "--that" in a and "Kiên" not in " ".join(a) and "Dol" not in " ".join(a)
    assert CHO_GIAY > 60
    assert chon_bo({"bo": "3"}) == "3"
    try: chon_bo({"bo": "3; drop"}); raise AssertionError("bộ lạ phải chặn")
    except SystemExit: pass
    assert lenh(p, 5, chon_bo({"bo": "4"}))[lenh(p, 5, "4").index("--bo") + 1] == "4"
    try: lenh({**p, "roas": "dan,1.1"}, 5, "42"); raise AssertionError("danh sách mức phải bị từ chối — mỗi thẻ một mức")
    except SystemExit: pass
    b = body_cu({"id": 7, "link": "search.com", "chu": {"pt": ["a"], "hl": ["b"], "de": []}})
    assert b["link_url"] == "search.com" and b["asset_spec"]["primaryTexts"] == ["a"] and b["call_to_action"], b
    try: body_cu({"id": 7, "link": "x", "chu": {"pt": [], "hl": []}}); raise AssertionError("phiếu thiếu chữ phải bị từ chối")
    except SystemExit: pass
    AF, L2 = _nap("ap-form-chu"), _nap("luot2")
    import inspect
    assert "body" in inspect.signature(AF.ban_nha).parameters and "ghi" in inspect.signature(L2.chep_so).parameters
    print("len-phieu tự kiểm: ok")

if __name__ == "__main__":
    if sys.argv[1:2] == ["--tu-kiem"]: tu_kiem()
    elif len(sys.argv) > 1 and sys.argv[1].isdigit(): chay(int(sys.argv[1]))
    else: print(__doc__); sys.exit(2)
