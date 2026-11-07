"""LỘ TRÌNH TỰ ĐỘNG TỪNG PHIM — THÍ ĐIỂM (anh 07/11/2026 "làm đầy đủ với riêng phim này Dragonborn để follow và update đầy đủ trước khi chính thức chạy trên toàn hệ thống").
dong-bo.py gọi chay(q) mỗi lượt (10 phút) cho phim trong etp.cau_hinh 'lo_trinh_tu_dong' {"phim": [...], "tran_camp_ngay": 4, "bat_dau": "...", "phim_moi_ngay": 12, "phim_them": {cid: ngày}}
— "phim_moi_ngay" > 0 thì mỗi ngày máy tự thêm bấy nhiêu phim chưa có camp nhà (chon_phim_moi) vào danh sách (anh 07/11/2026, roadmap E13 bước 3).
Mỗi phim một BƯỚC KẾ, ghi etp.cau_hinh 'lo_trinh_tt' {phim: {ma, chu, ke, dang, luc}} cho thẻ phim; đổi bước thì ghi Log (etp.nhat_ky viec 'lo_trinh'), xếp dòng thì báo Telegram (etp.canh_bao).
Không tự tạo camp: chỉ xếp dòng etp.dong_phim, máy dòng phim iMac làm tiếp qua đủ cổng (soát · chấm · cong.kiem · nhan-ban.lich_len). Tắt / tăng bậc / G10 vẫn do máy luật.
Thứ tự: phim đã cất → dừng · vượt sức chứa → giữ · có camp cơ hội → mở rộng theo etp.mo_rong, ĐỒNG THỜI dạng còn thiếu → sản xuất song song · còn lại để cat_phim kết luận."""
import json

CAN = {"CC": "cảnh cuối", "KT": "kể chuyện"}   # dạng có máy tự sản xuất (dong_phim.LOAI); CT chưa có máy
TEN_CT, SO_MOI_DANG, SO_LOI_BO = "cảnh thật", 2, 3   # mỗi dạng 2 camp có chi (cat_phim.so_moi_dang) · 3 dòng hỏng thì thôi dạng đó (hỏng thường do máy quá tải, 2 lần là bỏ oan cả dạng)

def cau_hinh(q):
    try: return json.loads(q("select gia_tri::text from etp.cau_hinh where khoa = 'lo_trinh_tu_dong'") or "{}")
    except Exception: return {}

def so(q, cid, bat_dau):
    return json.loads(q(f"""select row_to_json(x)::text from (select
        (select row_to_json(p) from (select ten, the_loai, thu_vong, thu_ly from etp.phim where content_id = {cid}) p) phim,
        (select row_to_json(m) from (select trang_thai, k, can_sx, pha, ly from etp.mo_rong where content_id = {cid}) m) mo,
        exists (select 1 from etp.camp_co_hoi where content_id = {cid}) co_hoi,
        (select coalesce(jsonb_object_agg(d, jsonb_build_object('tao', tao, 'chi', chi)), '{{}}') from (select r.dang d, count(*) tao, count(*) filter (where s.chi >= 1) chi from etp.camp c join etp.creative r using (creative_id)
            left join (select camp_id, sum(chi) chi from etp.so_ngay group by 1) s using (camp_id) where c.content_id = {cid} group by 1) a) dang,
        (select json_agg(json_build_object('loai', loai, 'so', so_camp)) from etp.dong_phim where content_id = {cid} and trang_thai = 'chay') chay,
        (select coalesce(jsonb_object_agg(loai, n), '{{}}') from (select loai, count(*) n from etp.dong_phim where content_id = {cid} and trang_thai in ('loi', 'dung') and tao_luc >= '{bat_dau}' group by 1) a) hong,
        (select coalesce(array_agg(distinct loai), '{{}}') from etp.dong_phim where content_id = {cid} and trang_thai = 'xong' and tao_luc > now() - interval '24 hours') dong_24h,
        (select count(*) from etp.camp where content_id = {cid} and tao > now() - interval '24 hours') camp_24h) x"""))

def xet(s, tran):
    """dữ liệu một phim → (mã bước, câu cho người đọc, số camp kế hoạch, các dòng cần xếp [(loại, số camp)]). Hàm thuần — bài tự kiểm ở cuối tệp.
    THỬ ĐỦ DẠNG TRONG THỜI GIAN NGẮN NHẤT (anh 07/11/2026): các dạng chạy SONG SONG, dạng này không chờ dạng kia; camp lãi vẫn mở rộng đồng thời với dạng chưa thử."""
    p, mo, dang = s.get("phim") or {}, s.get("mo") or {}, s.get("dang") or {}
    con = max(0, tran - int(s.get("camp_24h") or 0)); dang_sx = {d["loai"]: d.get("so") or 1 for d in s.get("chay") or []}; gan = s.get("dong_24h") or []
    if p.get("thu_vong") == "cat": return "cat", f"Đã cất phim: {p.get('thu_ly') or ''}"[:160], 0, []
    if s.get("co_hoi") and mo.get("pha") == "bao_hoa": return "giu", "Có camp lãi nhưng vượt sức chứa, giữ nguyên, không mở thêm", 0, []
    xep, chu, ke = [], [], 0
    if s.get("co_hoi"):
        k = int(mo.get("k") or 0)
        if mo.get("trang_thai") == "cho_do": ke += k; chu.append("Có camp lãi, chờ đo đủ 1 ngày khép rồi mở thêm")
        elif mo.get("trang_thai") != "them": chu.append(f"Có camp lãi, chưa mở thêm: {mo.get('ly') or ''}"[:120])
        elif "CC" in dang_sx or "CC" in gan: ke += k; chu.append("Vừa mở đợt CC, đợt sau tự xếp")
        elif not con: ke += k; chu.append(f"Chạm trần {tran} camp mới / 24 giờ, đợt sau tự xếp")
        else: n = min(k, con); ke += k; con -= n; xep.append(("CC", n)); chu.append(f"Mở rộng CC × {n} theo camp lãi")
    for ma, ten in CAN.items():
        da, loi = int((dang.get(ten) or {}).get("tao") or 0), int((s.get("hong") or {}).get(ma) or 0)
        if da >= SO_MOI_DANG or loi >= SO_LOI_BO or any(x[0] == ma for x in xep): continue
        thieu = SO_MOI_DANG - da; ke += thieu
        if ma in dang_sx: chu.append(f"Đang sản xuất {ma} × {dang_sx[ma]}, xong tự lên camp")
        elif ma in gan: chu.append(f"Đang thử {ma} {da}/{SO_MOI_DANG}, đợt sau tự xếp sau 24 giờ")
        elif not con: chu.append(f"Chạm trần {tran} camp mới / 24 giờ, đợt {ma} tự xếp sau")
        else:
            n = 1 if ma == "KT" else min(thieu, con)   # máy sinh kể chuyện làm mỗi lượt một video
            con -= n; xep.append((ma, n)); chu.append(f"Thử dạng {ma}: sản xuất {n} camp" + (f" (lần thử lại sau {loi} dòng hỏng)" if loi else ""))
    if chu: return ("mo_rong" if any("Mở rộng" in c for c in chu) else "thu_dang" if xep else "sx" if dang_sx else "cho_24h" if any("24 giờ" in c and "trần" not in c for c in chu) else "tran" if any("trần" in c for c in chu) else "giu"), " · ".join(chu), ke, xep
    cho = [m for m, t in CAN.items() if int((dang.get(t) or {}).get("tao") or 0) > int((dang.get(t) or {}).get("chi") or 0)]
    if cho: return "cho_so", f"Chờ camp {', '.join(cho)} tiêu đủ $1 để có số", 0, []
    if int((dang.get(TEN_CT) or {}).get("chi") or 0) < SO_MOI_DANG: return "het_may", "Đã thử hết dạng máy làm được, CT chưa có máy tự sản xuất; luật cất sẽ kết luận", 0, []
    return "het_may", "Đã thử đủ dạng, luật cất sẽ kết luận", 0, []

def chon_phim_moi(q, ch, da):
    """MỞ CHO MỌI PHIM CHƯA CÓ CAMP NHÀ (anh 07/11/2026 "Tập trung các phim mới", roadmap E13 bước 3): mỗi ngày VN thêm tới cau_hinh.phim_moi_ngay phim vào lộ trình.
    Thứ tự: đội đã chạy LÃI (tiêu ≥ $10, thu > chi) → chưa ai chạy → đội chạy chưa đủ số (< $10). Bỏ: đội lỗ ≥ $10, phim cất, ngoài Âu-Mỹ, phim cấm 18+,
    phim đang có dòng / có dòng trong 3 ngày, phim đang có creative đội chờ lên (đợt 0 đi đường etp.cho_len_v, không sản xuất đôi). Trả danh sách content_id mới."""
    tran = int(ch.get("phim_moi_ngay") or 0)
    if not tran: return []
    them = ch.get("phim_them") or {}; hom = q("select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text")
    con = tran - sum(1 for v in them.values() if v == hom)
    if con <= 0: return []
    loai = ",".join(str(int(x)) for x in da) or "0"
    r = q(f"""with doi as (select k.content_id, sum(s.chi) chi, sum(s.thu) thu from etp.camp_ngoai k join etp.so_ngay_ngoai s using (camp_id) where s.ngay < current_date group by 1)
        select string_agg(content_id::text, ',') from (select p.content_id from etp.phim p left join doi d using (content_id)
        where not exists (select 1 from etp.camp c where c.content_id = p.content_id) and p.thu_vong is distinct from 'cat' and coalesce(p.nhom_goc, 'au_my') = 'au_my'
          and not coalesce(d.chi >= 10 and d.thu <= d.chi, false)   -- đội chưa chạy: d null → NOT NULL loại oan 246 phim (sửa 07/11)
          and not exists (select 1 from etp.dong_phim x where x.content_id = p.content_id and (x.trang_thai = 'chay' or x.tao_luc > now() - interval '3 days'))
          and not exists (select 1 from etp.cho_len_v v where v.content_id = p.content_id and v.team_lai and v.ly_do is null)
          and not coalesce((select gia_tri ? p.content_id::text from xv_khoa_ngoai where ten = 'ethopex_phim_cam'), false)
          and p.content_id not in ({loai})
        order by case when d.chi >= 10 and d.thu > d.chi then 0 when d.content_id is null then 1 else 2 end, d.thu - d.chi desc nulls last, p.content_id desc limit {con}) x""")
    moi = [int(x) for x in (r or "").split(",") if x.strip().isdigit()]
    for c in moi: them[str(c)] = hom
    if moi: ch["phim"] = [int(x) for x in ch.get("phim") or []] + moi; ch["phim_them"] = them
    return moi

def chay(q):
    ch = cau_hinh(q); ds = [int(x) for x in ch.get("phim") or []]
    moi = chon_phim_moi(q, ch, ds)
    if moi:
        ds += moi
        q(f"""update etp.cau_hinh set gia_tri = $J${json.dumps(ch, ensure_ascii=False)}$J$::jsonb where khoa = 'lo_trinh_tu_dong'""")
        q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) values (now(), 'lo_trinh', true, 'thêm {len(moi)} phim mới vào lộ trình tự động: {" ".join(map(str, moi))}', 'máy lộ trình tự động (anh 07/11/2026: tập trung phim mới)')""")
    if not ds: return {}
    try: cu = json.loads(q("select gia_tri::text from etp.cau_hinh where khoa = 'lo_trinh_tt'") or "{}")
    except Exception: cu = {}
    xep = 0
    for cid in ds:
        s = so(q, cid, ch.get("bat_dau") or "2026-11-07"); ma, chu, ke, cac_dong = xet(s, int(ch.get("tran_camp_ngay") or 4))
        ten = (s.get("phim") or {}).get("ten") or f"phim {cid}"; hong = s.get("hong") or {}
        dang = {m: {"da": int((s["dang"].get(t) or {}).get("tao") or 0), "chi": int((s["dang"].get(t) or {}).get("chi") or 0), "bo": int(hong.get(m) or 0) >= SO_LOI_BO} for m, t in {**CAN, "CT": TEN_CT}.items()}
        ten_sql = ten.replace("'", "''"); ai = f"máy: lộ trình tự động thí điểm (anh 07/11/2026) · {chu}".replace("'", "''")
        for loai, so_camp in cac_dong:
            # dong_phim_mot (mỗi phim một dòng chạy mỗi loại) chặn xếp đôi nếu hai lượt đồng bộ chồng nhau
            if q(f"""insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp) select {cid}, '{ten_sql}', (select the_loai from etp.phim where content_id = {cid}), '{loai}', '{ai}', {int(so_camp)}
                     on conflict do nothing returning id"""): xep += 1
        if cac_dong:
            q(f"""insert into etp.canh_bao (loai, muc, khoa, noi_dung) values ('lo_trinh', 'info', 'lo_trinh:{cid}:' || extract(epoch from now())::bigint, '🤖 Thí điểm lộ trình · {ten_sql}: {chu.replace("'", "''")}') on conflict do nothing""")
        if (cu.get(str(cid)) or {}).get("chu") != chu:
            q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) values (now(), 'lo_trinh', true, 'phim {cid} · {chu.replace("'", "''")}', 'máy lộ trình tự động')""")
        cu[str(cid)] = {"ma": ma, "chu": chu, "ke": ke, "dang": dang}
    q(f"""insert into etp.cau_hinh (khoa, gia_tri) values ('lo_trinh_tt', $J${json.dumps(cu, ensure_ascii=False)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri""")
    return {"lo_trinh_phim": len(ds), "lo_trinh_xep": xep}

if __name__ == "__main__":
    goc = {"phim": {}, "mo": {}, "dang": {}, "chay": None, "hong": {}, "dong_24h": [], "camp_24h": 0, "co_hoi": False}
    t = lambda **k: xet({**goc, **k}, 4)
    assert t()[0] == "thu_dang" and t()[3] == [("CC", 2), ("KT", 1)]   # song song
    assert t(phim={"thu_vong": "cat"})[0] == "cat"
    r = t(chay=[{"loai": "CC", "so": 2}]); assert r[3] == [("KT", 1)]   # CC đang làm không chặn KT
    assert t(chay=[{"loai": "CC", "so": 2}, {"loai": "KT", "so": 1}])[:1] == ("sx",) and t(chay=[{"loai": "CC", "so": 2}, {"loai": "KT", "so": 1}])[3] == []
    assert t(dong_24h=["CC"])[3] == [("KT", 1)]
    assert t(dong_24h=["CC", "KT"])[0] == "cho_24h"
    assert t(camp_24h=4)[0] == "tran" and t(camp_24h=3)[3] == [("CC", 1)]
    assert t(hong={"CC": 2})[3] == [("CC", 2), ("KT", 1)]   # 2 dòng hỏng vẫn thử lại
    assert t(hong={"CC": 3})[3] == [("KT", 1)]
    cc = {"cảnh cuối": {"tao": 2, "chi": 2}}
    assert t(dang=cc)[3] == [("KT", 1)]
    assert t(dang=cc, hong={"KT": 3})[0] == "het_may"
    assert t(dang={"cảnh cuối": {"tao": 2, "chi": 0}, "kể chuyện": {"tao": 2, "chi": 2}})[0] == "cho_so"
    du = {"cảnh cuối": {"tao": 2, "chi": 2}, "kể chuyện": {"tao": 2, "chi": 2}}
    assert t(co_hoi=True, dang=du, mo={"trang_thai": "them", "k": 6})[3] == [("CC", 4)]
    assert t(co_hoi=True, dang=cc, mo={"trang_thai": "them", "k": 2})[3] == [("CC", 2), ("KT", 1)]   # có camp lãi vẫn thử dạng chưa thử
    assert t(co_hoi=True, mo={"trang_thai": "them", "k": 6, "pha": "bao_hoa"})[3] == []
    assert t(co_hoi=True, dang=du, mo={"trang_thai": "cho_do", "k": 6})[0] == "giu"
    print("tự kiểm đạt")
