#!/usr/bin/env python3
"""LƯỢT 2 CHO CREATIVE BỊ LUẬT RS TẮT (anh 26/11/2026: "Các creative này sẽ được lên camp mới ở khung giờ 22h tiếp ngay sau đó với kiểu lên camp còn lại.
Hiện tại có 2 kiểu là dol và kien. Camp âm này là dạng dol thì lượt 2 sẽ là dạng kien hoặc ngược lại … Ko đc bật lại camp đã tắt kia. Camp lượt này sẽ lên ở
1 tk khác. Đây là lượt 2 cho cùng 1 creative.") — sổ luật chung etp-bang-luat.json luot2, sổ việc etp.luot2 (migration 0479).
Camp ★ ROAS nhà bị luật RS tắt (etp.nhat_ky viec 'tat', luat 'RS …') → creative của nó được lên MỘT camp ★ ROAS mới:
  · kiểu chữ CÒN LẠI (sổ luot2.doi: dol ↔ kien) — chữ khác kiểu nên là bản creative Ethopex MỚI cùng video (ap-form-chu.ban_nha, đích kien thì .kieu);
    chữ chỉ lấy từ form-chu.json / chu-kieu.json, phim chưa có chữ kiểu đích → bỏ, không tự viết
  · ở bộ tài khoản KHÁC (sổ luot2.bo: 1 ↔ 2), bộ gốc ngoài sổ → bỏ + kêu to, không tự chọn tài khoản
  · giờ chạy do nhan-ban.gio_len quyết: tạo trong khung luot2.khung (giờ VN) → hẹn khung 22h VN cùng ngày
  · camp RS đã tắt KHÔNG bật lại (cong.chan_cua LY_RS_TAT); creative lượt 2 mà lại bị RS tắt thì HẾT — không có lượt 3
  · bản gốc không qua cổng chấm / duyệt (etp.cham_cong.duoc_len) thì không có lượt 2
  · kiểu đích trong sổ luot2.duyet (kien = camp kiểu K) → tt 'cho_duyet': chưa tạo gì tới khi anh bấm ✓ ở etp2 › Camp (anh 26/11/2026 "các camp + creative đều phải
    chờ duyệt mới được push lên" · "Camp lên kiểu Dol cũng ko cần duyệt nếu Creative đã passed"); kiểu dol đi thẳng (bản clone của creative đã duyệt)
Mọi cổng etp vẫn áp trong nhan-ban (chấm Sạch, 18+, bài học, trang phim, phim cấm, dừng khẩn, bảo trì, phanh chợ); riêng cổng "chỉ lên theo lệnh" mở đúng cho phim
đang có dòng etp.luot2 tt 'dang' (cong.luot2_dang). Worker gọi qua nuoi_bo.py mỗi nhịp; mỗi nhịp tối đa luot2.moi_nhip camp, từng lô luot2.song_song phim khác nhau chạy song song, không bắt đầu lô mới sau luot2.phut phút.
  python3 apps/etp/luot2.py --xem      → ứng viên + hàng đang chờ (không ghi, không tạo gì)
  python3 apps/etp/luot2.py --tu-kiem  → bài tự kiểm hàm thuần + sổ
tra-repo-ok: mã dán keo nội bộ etp (gọi nhan-ban.py / ap-form-chu.py / cong.py của nhà), không có thư viện ngoài nào làm việc này"""
import datetime as dt, importlib.util as iu, json, os, subprocess, sys, time
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import cong as CG
L2 = CG._BL["luot2"]
NB = os.path.join(D, "..", "xuong-video", "scripts", "ethopex", "nhan-ban.py")
KHUON = {"en": 65110, "es": 65734}   # khuôn ★ ROAS creative mới theo ngôn ngữ (như nút ▶ Lên etp2)
AI = "anh (chat 26/11/2026: lượt 2 cho creative RS tắt — kiểu còn lại, tài khoản khác, khung 22h kế) — máy chạy"
DUYET = "anh 26/11/2026: lượt 2 cho cùng 1 creative — bản gốc đã qua chấm / duyệt, bản lượt 2 cùng video chỉ đổi kiểu chữ"
q = CG._q
s = lambda v: "null" if v in (None, "") else "'" + str(v).replace("'", "''") + "'"

def trong_khung(h, k=None):
    a, b = k or L2["khung"]
    return a <= h < b

def kieu_cua(c, EA):
    """hàm thuần: creative Ethopex → 'dol' (chữ + link form-chu.json) | kiểu trong chu-kieu.json (chữ cùng phim + link của kiểu) | None (chữ lệch mọi sổ)"""
    a = c.get("asset_spec") or {}
    a = json.loads(a) if isinstance(a, str) and a.strip().startswith("{") else (a if isinstance(a, dict) else {})
    F = EA.FORM
    if c.get("call_to_action") != F["call_to_action"]: return None
    lk = c.get("link_url") or ""; bo = (EA.ds_l(a.get("primaryTexts")), EA.ds_l(a.get("headlines")), EA.ds_l(a.get("descriptions")))
    if bo == (F["primaryTexts"], F["headlines"], F["descriptions"]) and lk == F["link_url"]: return "dol"
    return next((k for k in EA.KIEU_DOI if lk == EA.link_kieu(k) and any(bo == x for x in EA.chu_doi(k, c["content_id"]))), None)

def xep(r, kieu, co_chu):
    """hàm thuần: một ứng viên r {duoc, chan, la_l2, bo, lang} + kiểu chữ gốc + co_chu(kiểu) → (tt, kiểu đích, bộ đích, lý do)"""
    if r["la_l2"]: return "bo", None, None, "đã là bản lượt 2 — không có lượt 3"
    if not r["duoc"]: return "bo", None, None, f"bản gốc không qua cổng chấm / duyệt ({r['chan'] or 'chưa chấm'})"
    if not kieu: return "bo", None, None, "chữ creative gốc không khớp kiểu nào trong sổ (form-chu / chu-kieu) — không biết kiểu còn lại"
    dich = L2["doi"].get(kieu)
    if not dich: return "bo", None, None, f"sổ luot2.doi chưa có kiểu còn lại của '{kieu}'"
    if dich != "dol" and not co_chu(dich): return "bo", dich, None, f"sổ chu-kieu.json chưa có chữ kiểu {dich} cho phim này — không tự viết chữ"
    bo = L2["bo"].get(str(r["bo"] or ""))
    if not bo: return "bo", dich, None, f"bộ gốc '{r['bo']}' không có trong sổ luot2.bo — không tự chọn tài khoản"
    if (r["lang"] or "en") not in KHUON: return "bo", dich, bo, f"chưa có khuôn ★ ROAS cho ngôn ngữ '{r['lang']}'"
    if dich in L2.get("duyet", []): return "cho_duyet", dich, bo, f"camp kiểu {dich} — chờ anh duyệt ở etp2 › Camp"
    return "dang", dich, bo, None

SQL_UV = f"""select c.camp_id, c.creative_id, c.content_id, coalesce(r.lang, 'en'), coalesce(c.bo, ''), coalesce(g.duoc_len, false),
    regexp_replace(left(coalesce(g.chan_boi::text, ''), 120), '[|[:cntrl:]]', '/', 'g'), exists(select 1 from etp.luot2 l where l.cr_moi = c.creative_id)
  from etp.camp c join etp.creative r using (creative_id) left join etp.cham_cong g using (creative_id)
  where c.camp_id in ({CG.SQL_RS_TAT}) and c.la_roas and not exists(select 1 from etp.luot2 l where l.cr_goc = c.creative_id) order by c.camp_id"""

def ung_vien():
    return [dict(zip(("camp", "cr", "phim", "lang", "bo"), (int(x[0]), int(x[1]), int(x[2]), x[3], x[4])), duoc=x[5] == "t", chan=x[6], la_l2=x[7] == "t")
            for x in (l.split("|") for l in q(SQL_UV).splitlines()) if len(x) == 8]

def ghi_so(EA, xem):
    """mỗi creative RS tắt chưa có dòng sổ → xếp (dang / bo) rồi ghi etp.luot2; xem = chỉ trả danh sách"""
    ra = []
    for r in ung_vien():
        try:
            c = EA.api(f"/api/v1/creatives/{r['cr']}"); c = c.get("data", c); k = kieu_cua(c, EA)
        except Exception as e:
            ra.append({**r, "tt": "cho", "ly": f"chưa đọc được creative: {str(e)[:100]}"}); continue   # nhịp sau xếp lại, không ghi sổ
        tt, dich, bo, ly = xep(r, k, lambda kk: bool(EA.chu_doi(kk, r["phim"])))
        ra.append({"camp": r["camp"], "cr": r["cr"], "phim": r["phim"], "kieu": k, "bo": r["bo"], "tt": tt, "kieu_moi": dich, "bo_moi": bo, "ly": ly})
        if not xem:
            q(f"""insert into etp.luot2 (cr_goc, camp_goc, content_id, lang, kieu_goc, bo_goc, kieu_moi, bo_moi, tt, ly)
                  values ({r['cr']}, {r['camp']}, {r['phim']}, {s(r['lang'])}, {s(k)}, {s(r['bo'])}, {s(dich)}, {s(bo)}, '{tt}', {s(ly)}) on conflict (cr_goc) do nothing""")
    return ra

def cho():
    return [dict(zip(("cr", "camp", "phim", "lang", "kieu", "bo", "kieu_moi", "bo_moi", "cr_moi", "lan"), x))
            for x in (l.split("|") for l in q("""select cr_goc, camp_goc, content_id, coalesce(lang, 'en'), coalesce(kieu_goc, ''), coalesce(bo_goc, ''), kieu_moi, bo_moi,
                coalesce(cr_moi, 0), lan from etp.luot2 where tt = 'dang' order by lan, luc, cr_goc""").splitlines()) if len(x) == 10]

def chep_so(goc, moi):
    """bản lượt 2 cùng video với gốc → chép dòng kho + phiếu chấm của gốc cho id mới (cổng chấm Sạch của nhan-ban đọc etp.cham_cong); ghi duyệt theo lệnh anh"""
    q(f"""insert into etp.creative (creative_id, content_id, dang, tu, den, doan, lang, lo, video, anh, cta_dat, cap_nhat)
          select {moi}, content_id, dang, tu, den, doan, lang, lo, video, anh, cta_dat, now() from etp.creative where creative_id = {goc} on conflict (creative_id) do nothing""")
    q(f"""insert into etp.cham (creative_id, doan, luc, may, lop, diem, ly_do, meta, afs, ket, loi, khung)
          select {moi}, doan, luc, may, lop, diem, ly_do, meta, afs, ket, loi, khung from etp.cham where creative_id = {goc} on conflict (creative_id) do nothing""")
    q(f"insert into etp.diem_cham (creative_id, cham, nguon, luc) select {moi}, cham, nguon, luc from etp.diem_cham where creative_id = {goc} on conflict (creative_id) do nothing")
    q(f"insert into etp.cham_duyet (creative_id, ok, ai, ghi) values ({moi}, true, 'máy · lượt 2', {s(DUYET)}) on conflict (creative_id) do nothing")

def nb(args, luat):
    try:
        r = subprocess.run(["python3", NB, *args, "--that", "--luat", luat, "--ai", AI], capture_output=True, text=True, timeout=1500, cwd=os.path.dirname(NB),
                           env={**os.environ, "ETP_NGUON": "luot2"})   # cong.luat_cu_chan (NGUON_MOI) + cong.luot2_dang đọc biến này
        return json.loads(next((l for l in reversed(r.stdout.strip().splitlines()) if l.startswith("{")), "{}")) or {"ok": False, "loi": (r.stderr or "không có kết quả")[-200:]}
    except Exception as e: return {"ok": False, "loi": str(e)[:200]}

def mot(v, AF, EA):
    """một dòng sổ tt 'dang' → tạo bản creative (nếu chưa) + lên camp; trả {ok, moi, loi}. Ghi lần thử TRƯỚC khi gọi: nhịp bị cắt giữa chừng không tạo trùng."""
    goc, moi = int(v["cr"]), int(v["cr_moi"])
    q(f"update etp.luot2 set lan = lan + 1, cap_nhat = now() where cr_goc = {goc}")
    if moi:
        da = q(f"select camp_id from etp.cr_co_camp where creative_id = {moi} limit 1")
        if da.isdigit(): return {"ok": True, "moi": int(da), "da_co": True}   # lượt trước tạo xong camp rồi mới bị cắt
    else:
        moi = AF.ban_nha(goc, " - luot 2")   # bản mới mang chữ form (dol)
        q(f"update etp.luot2 set cr_moi = {int(moi)}, cap_nhat = now() where cr_goc = {goc}")
    if v["kieu_moi"] != "dol":
        k = AF.kieu(moi, v["kieu_moi"])
        if k[1] != "ok":
            c = EA.api(f"/api/v1/creatives/{moi}"); c = c.get("data", c)
            if kieu_cua(c, EA) != v["kieu_moi"]: return {"ok": False, "loi": f"đổi chữ sang kiểu {v['kieu_moi']} hỏng: {k[1]}"}
    chep_so(goc, moi)
    ten = q(f"select regexp_replace(coalesce((select ten from etp.phim where content_id = {int(v['phim'])}), ''), '[^A-Za-z0-9 .,:!?#-]', '', 'g')")
    hc = CG._BL["hoi_cho"]
    return nb([str(KHUON[v["lang"]]), "--roas", CG.ROAS_DAN, "--ns", f"{int(hc['ns'])}", "--bo", str(v["bo_moi"]), "--creative", str(moi), "--content", str(int(v["phim"])),
               "--ten", f"l2 {ten} {v['lang'].upper()} - cr moi #{moi}"],
              f"lượt 2: RS tắt #{v['camp']} (kiểu {v['kieu']} · bộ {v['bo']}) → kiểu {v['kieu_moi']} · bộ {v['bo_moi']}, creative gốc #{goc}")

def lo(hang, n):
    """một lô chạy song song: tối đa n dòng đầu hàng, MỖI PHIM MỘT DÒNG — nhan-ban.camp_moi_hom_nay chặn phim đang có camp chưa đồng bộ xong, hai bản cùng phim
    chạy cùng lúc thì bản sau hỏng và ăn một lần thử (26/11/2026: tuần tự 2 camp / 53 phút không kịp 32 creative trước 21h VN)"""
    ra, phim = [], set()
    for v in hang:
        if len(ra) >= n: break
        if v["phim"] not in phim: ra.append(v); phim.add(v["phim"])
    return ra

def chay(xem=False):
    if L2.get("tat") and not xem: return {"chay": False, "ly": "luot2 đang tắt (sổ luật)"}
    import ethopex_api as EA
    bay = dt.datetime.now(dt.timezone.utc); h = (bay + dt.timedelta(hours=7)).hour
    moi_xep = ghi_so(EA, xem)
    kq = {"chay": True, "moi_xep": moi_xep[:60], "lam": []}
    hang = cho(); kq["cho"] = len(hang)
    if xem: kq["hang"] = hang[:60]; return kq
    if not trong_khung(h): kq["ly"] = f"ngoài khung {L2['khung'][0]:02d}–{L2['khung'][1]:02d}h VN — hàng chờ nhịp trong khung"; return kq
    sp = iu.spec_from_file_location("ap_form_chu", os.path.join(D, "ap-form-chu.py")); AF = iu.module_from_spec(sp); sp.loader.exec_module(AF)
    han = time.time() + float(L2["phut"]) * 60
    def thu(v):
        try: return mot(v, AF, EA)
        except Exception as e: return {"ok": False, "loi": f"{type(e).__name__}: {str(e)[:200]}"}
    from concurrent.futures import ThreadPoolExecutor
    def ghi(v, r):   # ghi sổ ngay sau mỗi lô: nhịp bị cắt giữa chừng không mất kết quả lô trước
        ok = bool(r.get("ok") and r.get("moi"))
        if ok: q(f"update etp.luot2 set tt = 'xong', camp_moi = {int(r['moi'])}, ly = null, cap_nhat = now() where cr_goc = {int(v['cr'])}")
        else: q(f"update etp.luot2 set tt = case when lan >= {int(L2['thu'])} then 'loi' else 'dang' end, ly = {s(str(r.get('loi') or 'không rõ')[:300])}, cap_nhat = now() where cr_goc = {int(v['cr'])}")
        kq["lam"].append({"cr": int(v["cr"]), "camp_goc": int(v["camp"]), "kieu": v["kieu_moi"], "bo": v["bo_moi"], "ok": ok, "moi": r.get("moi"), "loi": r.get("loi"), "gio": r.get("gio_anh")})
    con, n = list(hang), 0
    while con and n < int(L2["moi_nhip"]) and time.time() <= han:   # từng lô song song, mỗi lô các phim KHÁC nhau; dòng hỏng không thử lại trong nhịp này
        l = lo(con, min(int(L2.get("song_song", 1)), int(L2["moi_nhip"]) - n))
        with ThreadPoolExecutor(len(l)) as ex: rs = list(ex.map(thu, l))
        for v, r in zip(l, rs): ghi(v, r)
        con = [v for v in con if v not in l]; n += len(l)
    xong = [x for x in kq["lam"] if x["ok"]]; hong = [x for x in kq["lam"] if not x["ok"]]
    if xong or hong:
        chu = (f"🔁 LƯỢT 2 (creative RS tắt → kiểu còn lại, tài khoản khác): lên {len(xong)} camp ★ ROAS"
               + "".join(f"\n· #{x['moi']} kiểu {x['kieu']} · bộ {x['bo']} ← RS tắt #{x['camp_goc']}" + (f" · {x['gio']}" if x.get("gio") else "") for x in xong)
               + "".join(f"\n✗ creative #{x['cr']}: {str(x['loi'])[:160]}" for x in hong) + f"\nCòn chờ: {max(0, len(hang) - len(xong))}")
        q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) values ('luot2', 'luot2:{bay:%Y%m%d%H%M}', '{'warn' if hong else 'info'}', $N${chu}$N$) on conflict (khoa) do nothing""")
    return kq

def _tu_kiem():
    assert L2["doi"] == {"dol": "kien", "kien": "dol"}, "anh 26/11/2026: 2 kiểu dol và kien — lượt 2 là kiểu còn lại"
    assert all(a != b and L2["bo"].get(b) == a for a, b in L2["bo"].items()), "lượt 2 lên ở tài khoản KHÁC (sổ luot2.bo đi cặp)"
    assert L2["khung"][0] >= 7 and L2["khung"][1] <= 21, "tạo trong 07–21h VN thì nhan-ban.gio_len hẹn khung 22h VN cùng ngày"
    assert CG._BL["hoi_cho"]["ns"] == CG.NS_MOI and "luot2" in CG.NGUON_MOI
    assert 1 <= int(L2.get("song_song", 1)) <= 2, "song song không vượt số khe nhan-ban.SONG_SONG (2) — bản dư chỉ ngủ chờ khe"
    h = [{"cr": 1, "phim": "9"}, {"cr": 2, "phim": "9"}, {"cr": 3, "phim": "8"}, {"cr": 4, "phim": "7"}]
    assert [v["cr"] for v in lo(h, 2)] == [1, 3] and [v["cr"] for v in lo(h, 3)] == [1, 3, 4] and [v["cr"] for v in lo(h[:2], 2)] == [1] and lo([], 2) == [], "một lô không có hai dòng cùng phim"
    assert trong_khung(7) and trong_khung(20) and not trong_khung(21) and not trong_khung(6) and not trong_khung(23)
    r = {"duoc": True, "chan": "", "la_l2": False, "bo": "1", "lang": "es"}; co = lambda k: True
    assert L2.get("duyet", []) == [], "anh 26/11/2026 13:30: bỏ duyệt camp K — lượt 2 đi thẳng"
    assert xep(r, "dol", co)[:3] == ("dang", "kien", "2") and xep({**r, "bo": "2"}, "kien", co) == ("dang", "dol", "1", None), "kiểu còn lại + bộ khác; đích kien chờ anh duyệt"
    assert xep({**r, "la_l2": True}, "dol", co)[0] == "bo", "không có lượt 3"
    assert xep({**r, "duoc": False, "chan": "người duyệt loại"}, "dol", co)[0] == "bo", "bản gốc bị loại thì không lên lại"
    assert xep(r, None, co)[0] == "bo" and xep(r, "dol", lambda k: False)[0] == "bo", "chữ lệch sổ / phim chưa có chữ kiểu đích → bỏ, không tự viết"
    assert xep(r, "kien", lambda k: False)[:2] == ("dang", "dol"), "đích dol dùng chữ form, không cần sổ chu-kieu, không chờ duyệt"
    assert xep({**r, "bo": "3"}, "dol", co)[0] == "bo" and xep({**r, "lang": "fr"}, "dol", co)[0] == "bo", "bộ ngoài sổ / ngôn ngữ không có khuôn → bỏ"
    class E:
        FORM = {"call_to_action": "LEARN_MORE", "link_url": "f.com", "primaryTexts": ["a"], "headlines": ["b"], "descriptions": ["c"]}; KIEU_DOI = ["kien"]
        ds_l = staticmethod(lambda v: list(v or [])); link_kieu = staticmethod(lambda k: "s.com"); chu_doi = staticmethod(lambda k, ct: [(["x"], ["y"], ["z"])] if ct == 9 else [])
    c = lambda pt, lk, ct=9: {"call_to_action": "LEARN_MORE", "link_url": lk, "content_id": ct, "asset_spec": {"primaryTexts": pt, "headlines": ["b"] if pt == ["a"] else ["y"], "descriptions": ["c"] if pt == ["a"] else ["z"]}}
    assert kieu_cua(c(["a"], "f.com"), E) == "dol" and kieu_cua(c(["x"], "s.com"), E) == "kien"
    assert kieu_cua(c(["x"], "f.com"), E) is None and kieu_cua(c(["x"], "s.com", 8), E) is None and kieu_cua({**c(["a"], "f.com"), "call_to_action": "X"}, E) is None
    print("✓ luot2.py tự kiểm (sổ kiểu / bộ, khung giờ, xếp ứng viên, đọc kiểu chữ)")

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv: _tu_kiem(); sys.exit(0)
    print(json.dumps(chay("--xem" in sys.argv), ensure_ascii=False, default=str))
