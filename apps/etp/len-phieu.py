#!/usr/bin/env python3
"""LÊN CAMP THEO PHIẾU (anh 27/11/2026: "Khi submit thì mày sẽ sx với các thông tin đó … để tao review lại creative 1 lần nữa trc khi đẩy camp lên.
Ko cần bước review camp thứ 2 nữa").

    python3 apps/etp/len-phieu.py <cho_len_id>        # etp2 › Chờ lên ✓ Duyệt thẻ có phiếu chạy tách (ETP_VE = vé TRỰC TIẾP 'tao_camp' anh vừa bấm)
    python3 apps/etp/len-phieu.py --tu-kiem

Duyệt = duyệt creative + lệnh lên camp. Máy dòng phim (iMac, cho_len.py) tải creative lên Ethopex với ĐÚNG chữ + link của phiếu → 'da_len' + creative_id;
tệp này chờ creative_id (≤ CHO_GIAY, vé sống ve_phut phút) rồi gọi nhan-ban MỘT lần với đúng phiếu: khuôn theo ngôn ngữ · bộ bo_phim_moi · ROAS (dàn / số) · ngân sách ·
domain (--mien) · giờ (khung cố định hoặc giờ anh đặt, --gio-tu-do khi ngoài khung). Kết quả ghi etp.cho_len.camp_id / camp_loi + etp.phieu_len.camp_ids / trang_thai.
Không tự xin vé (máy luật không bao giờ xin) — chờ quá hạn vé thì ghi camp_loi, thẻ hiện nút Lên camp để anh bấm lại (vé mới).
"""
import json, os, re, subprocess, sys, time

D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
SC = os.path.join(D, "..", "xuong-video", "scripts", "ethopex")
KHUON_CR = {"en": 65110, "es": 65734}   # trùng lenh_cho.KHUON_CR + apps/etp2/src/lib/etp-ke-cr.ts KHUON_CR
import cong as CG
CHO_GIAY = CG.VE_PHUT * 60 - 45   # vé trực tiếp sống ve_phut phút — gọi nhan-ban trước khi vé hết
HET_VE = "chờ creative tải lên quá hạn vé — bấm Lên camp lại trên thẻ (vé mới)"

def q(s): return CG._q(s)

def ten_camp(phim, lang, cr):   # cùng etp2 lib/etp-ke-cr.ts tenCampCr
    return f"duyet {re.sub(r'[^A-Za-z0-9 .,:!?#-]', '', phim or '')} {lang.upper()} - cr moi #{cr}"

def lenh(p, cr, bo):
    """dòng lệnh nhan-ban cho phiếu p (dict hàng etp.phieu_len + content_id/lang/phim) và creative cr"""
    lang = "es" if (p.get("lang") or "").startswith("es") else "en"
    a = [os.path.join(SC, "nhan-ban.py"), str(KHUON_CR[lang]), "--roas", "dan" if p["roas"] == "dan" else f"{float(p['roas']):g}", "--ns", str(int(p["ns"])),
         "--tay", "--bo", str(bo), "--creative", str(cr), "--content", str(p["content_id"]), "--ten", ten_camp(p.get("phim"), lang, cr)]
    if p.get("mien"): a += ["--mien", p["mien"]]
    if p.get("gio") and p["gio"] != "lich": a += ["--gio", p["gio"]] + (["--gio-tu-do"] if p.get("tu_do") else [])
    k = "K" if p.get("kieu") == "kien" else "D"
    chu = f"phiếu #{p['id']}: {k} · {p.get('link')} · {p.get('dang')} · {p.get('mien') or 'domain mặc định'} · ROAS {p['roas']} · ${int(p['ns'])} · giờ {p.get('gio')}"
    return a + ["--that", "--luat", f"anh duyệt creative #{cr} ở etp2 › Chờ lên ({chu})", "--ai", f"anh (etp2 phiếu lên camp #{p['id']})"]

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
            p.mien, p.roas, p.ns, p.gio, p.tu_do, f.ten phim from etp.cho_len c join etp.phieu_len p on p.id = c.phieu_id left join etp.phim f on f.content_id = p.content_id
          where c.id = {int(cl)}) t""")
    if not r: raise SystemExit(f"cho_len #{cl} không có phiếu — không lên")
    p = json.loads(r)
    if p.get("camp_id"): print(f"cho_len #{cl} đã có camp #{p['camp_id']}"); return
    q(f"update etp.phieu_len set trang_thai = 'len', cap_nhat = now() where id = {int(p['id'])} and trang_thai in ('cho_duyet', 'loi')")
    t0 = time.time()
    while True:
        x = json.loads(q(f"select row_to_json(t) from (select trang_thai, creative_id, loi from etp.cho_len where id = {int(cl)}) t"))
        if x["trang_thai"] == "bo": ghi_kq(cl, p["id"], None, "anh đã bỏ bản này"); return
        if x["trang_thai"] == "da_len" and x.get("creative_id"): break
        if time.time() - t0 > CHO_GIAY: ghi_kq(cl, p["id"], None, HET_VE + (f" (tải lỗi: {x['loi']})" if x.get("loi") else "")); return
        time.sleep(15)
    cr = int(x["creative_id"])
    bo = q("select gia_tri#>>'{}' from etp.cau_hinh where khoa = 'bo_phim_moi'")
    if not bo: ghi_kq(cl, p["id"], None, "thiếu bộ lên camp (etp.cau_hinh bo_phim_moi)"); return
    a = lenh(p, cr, bo); print("nhan-ban " + " ".join(a[1:]), flush=True)
    try:
        r = subprocess.run(["python3", *a], capture_output=True, text=True, timeout=1500, cwd=SC)
        print(r.stdout[-3000:], r.stderr[-1500:], sep="\n", flush=True)
        kq = json.loads(next((l for l in reversed(r.stdout.strip().splitlines()) if l.startswith("{")), "{}") or "{}")
    except Exception as e: kq = {"ok": False, "loi": str(e)[:300]}
    if not kq and r.returncode: kq = {"ok": False, "loi": (r.stderr.strip().splitlines() or ["nhan-ban lỗi"])[-1]}
    ghi_kq(cl, p["id"], kq.get("moi") if kq.get("ok") else None, None if kq.get("ok") else (kq.get("loi") or "nhan-ban không trả kết quả"))
    print(json.dumps({"ok": bool(kq.get("ok")), "camp": kq.get("moi"), "cr": cr, "loi": kq.get("loi")}, ensure_ascii=False))

def tu_kiem():
    p = {"id": 7, "content_id": 123, "lang": "es", "phim": "Café: Ñ!", "kieu": "kien", "link": "search.com", "dang": "AD", "mien": "maybic.com", "roas": "dan", "ns": 5, "gio": "lich", "tu_do": False}
    a = lenh(p, 999, "42")
    assert a[1] == "65734" and a[a.index("--roas") + 1] == "dan" and "--gio" not in a and a[a.index("--mien") + 1] == "maybic.com" and a[a.index("--ten") + 1] == "duyet Caf: ! ES - cr moi #999", a
    b = lenh({**p, "lang": "en", "roas": "1.1", "ns": 8, "mien": None, "gio": "2026-11-28 03:30", "tu_do": True}, 5, "42")
    assert b[1] == "65110" and b[b.index("--roas") + 1] == "1.1" and b[b.index("--ns") + 1] == "8" and "--mien" not in b and b[b.index("--gio") + 1] == "2026-11-28 03:30" and "--gio-tu-do" in b
    assert "--gio-tu-do" not in lenh({**p, "gio": "2026-11-28 22:00", "tu_do": False}, 5, "42") and "--that" in a and "Kiên" not in " ".join(a) and "Dol" not in " ".join(a)
    assert CHO_GIAY > 60
    print("len-phieu tự kiểm: ok")

if __name__ == "__main__":
    if sys.argv[1:2] == ["--tu-kiem"]: tu_kiem()
    elif len(sys.argv) > 1 and sys.argv[1].isdigit(): chay(int(sys.argv[1]))
    else: print(__doc__); sys.exit(2)
