"""LỘ TRÌNH TỰ ĐỘNG TỪNG PHIM — THÍ ĐIỂM (anh 07/11/2026 "làm đầy đủ với riêng phim này Dragonborn để follow và update đầy đủ trước khi chính thức chạy trên toàn hệ thống").
dong-bo.py gọi chay(q) mỗi lượt (10 phút), CHỈ cho phim trong etp.cau_hinh 'lo_trinh_tu_dong' {"phim": [...], "tran_camp_ngay": 4, "bat_dau": "..."}.
Mỗi phim một BƯỚC KẾ, ghi etp.cau_hinh 'lo_trinh_tt' {phim: {ma, chu, ke, dang, luc}} cho thẻ phim; đổi bước thì ghi Log (etp.nhat_ky viec 'lo_trinh'), xếp dòng thì báo Telegram (etp.canh_bao).
Không tự tạo camp: chỉ xếp dòng etp.dong_phim, máy dòng phim iMac làm tiếp qua đủ cổng (soát · chấm · cong.kiem · nhan-ban.lich_len). Tắt / tăng bậc / G10 vẫn do máy luật.
Thứ tự: phim đã cất → dừng · đang có dòng → chờ · có camp cơ hội → mở rộng theo etp.mo_rong · thiếu dạng → sản xuất dạng đó · còn lại để cat_phim kết luận."""
import json

CAN = {"CC": "cảnh cuối", "KT": "kể chuyện"}   # dạng có máy tự sản xuất (dong_phim.LOAI); CT chưa có máy
TEN_CT, SO_MOI_DANG, SO_LOI_BO = "cảnh thật", 2, 2   # mỗi dạng 2 camp có chi (cat_phim.so_moi_dang) · 2 dòng hỏng thì thôi dạng đó

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
        (select coalesce(array_agg(distinct loai), '{{}}') from etp.dong_phim where content_id = {cid} and tao_luc > now() - interval '24 hours') dong_24h,
        (select count(*) from etp.camp where content_id = {cid} and tao > now() - interval '24 hours') camp_24h) x"""))

def xet(s, tran):
    """dữ liệu một phim → (mã bước, câu cho người đọc, số camp kế hoạch, dòng cần xếp (loại, số camp) | None). Hàm thuần — bài tự kiểm ở cuối tệp."""
    p, mo, dang = s.get("phim") or {}, s.get("mo") or {}, s.get("dang") or {}
    con = max(0, tran - int(s.get("camp_24h") or 0))
    if p.get("thu_vong") == "cat": return "cat", f"Đã cất phim: {p.get('thu_ly') or ''}"[:160], 0, None
    if s.get("chay"):
        d = s["chay"][0]; return "sx", f"Đang sản xuất {d['loai']} × {d.get('so') or 1}, xong tự lên camp", 0, None
    if s.get("co_hoi"):
        if mo.get("pha") == "bao_hoa": return "giu", "Có camp lãi nhưng vượt sức chứa, giữ nguyên, không mở thêm", 0, None
        if mo.get("trang_thai") == "cho_do": return "cho_do", "Có camp lãi, chờ đo đủ 1 ngày khép rồi mở thêm", int(mo.get("k") or 0), None
        if mo.get("trang_thai") != "them": return "giu", f"Có camp lãi, chưa mở thêm: {mo.get('ly') or ''}"[:160], 0, None
        k = int(mo.get("k") or 0)
        if "CC" in (s.get("dong_24h") or []): return "cho_24h", "Vừa mở đợt trong 24 giờ, đợt sau tự xếp", k, None
        if not con: return "tran", f"Chạm trần {tran} camp mới / 24 giờ, đợt sau tự xếp", k, None
        return "mo_rong", f"Mở rộng CC × {min(k, con)} theo camp lãi", k, ("CC", min(k, con))
    for ma, ten in CAN.items():
        da, loi = int((dang.get(ten) or {}).get("tao") or 0), int((s.get("hong") or {}).get(ma) or 0)
        if da >= SO_MOI_DANG or loi >= SO_LOI_BO: continue
        thieu = SO_MOI_DANG - da
        if ma in (s.get("dong_24h") or []): return "cho_24h", f"Đang thử {ma} {da}/{SO_MOI_DANG}, đợt sau tự xếp sau 24 giờ", thieu, None
        if not con: return "tran", f"Chạm trần {tran} camp mới / 24 giờ, đợt {ma} tự xếp sau", thieu, None
        so_ = 1 if ma == "KT" else min(thieu, con)   # máy sinh kể chuyện làm mỗi lượt một video
        return "thu_dang", f"Thử dạng {ma}: sản xuất {so_} camp", thieu, (ma, so_)
    cho = [m for m, t in CAN.items() if int((dang.get(t) or {}).get("tao") or 0) > int((dang.get(t) or {}).get("chi") or 0)]
    if cho: return "cho_so", f"Chờ camp {', '.join(cho)} tiêu đủ $1 để có số", 0, None
    if int((dang.get(TEN_CT) or {}).get("chi") or 0) < SO_MOI_DANG: return "het_may", "Đã thử hết dạng máy làm được, CT chưa có máy tự sản xuất; luật cất sẽ kết luận", 0, None
    return "het_may", "Đã thử đủ dạng, luật cất sẽ kết luận", 0, None

def chay(q):
    ch = cau_hinh(q); ds = [int(x) for x in ch.get("phim") or []]
    if not ds: return {}
    try: cu = json.loads(q("select gia_tri::text from etp.cau_hinh where khoa = 'lo_trinh_tt'") or "{}")
    except Exception: cu = {}
    xep = 0
    for cid in ds:
        s = so(q, cid, ch.get("bat_dau") or "2026-11-07"); ma, chu, ke, dong = xet(s, int(ch.get("tran_camp_ngay") or 4))
        ten = (s.get("phim") or {}).get("ten") or f"phim {cid}"; hong = s.get("hong") or {}
        dang = {m: {"da": int((s["dang"].get(t) or {}).get("tao") or 0), "chi": int((s["dang"].get(t) or {}).get("chi") or 0), "bo": int(hong.get(m) or 0) >= SO_LOI_BO} for m, t in {**CAN, "CT": TEN_CT}.items()}
        if dong:
            ten_sql = ten.replace("'", "''"); ai = f"máy: lộ trình tự động thí điểm (anh 07/11/2026) · {chu}".replace("'", "''")
            # dong_phim_mot (mỗi phim một dòng chạy mỗi loại) chặn xếp đôi nếu hai lượt đồng bộ chồng nhau
            if q(f"""insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp) select {cid}, '{ten_sql}', (select the_loai from etp.phim where content_id = {cid}), '{dong[0]}', '{ai}', {int(dong[1])}
                     on conflict do nothing returning id"""): xep += 1
            q(f"""insert into etp.canh_bao (loai, muc, khoa, noi_dung) values ('lo_trinh', 'info', 'lo_trinh:{cid}:' || extract(epoch from now())::bigint, '🤖 Thí điểm lộ trình · {ten_sql}: {chu.replace("'", "''")}') on conflict do nothing""")
        if (cu.get(str(cid)) or {}).get("chu") != chu:
            q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) values (now(), 'lo_trinh', true, 'phim {cid} · {chu.replace("'", "''")}', 'máy lộ trình tự động')""")
        cu[str(cid)] = {"ma": ma, "chu": chu, "ke": ke, "dang": dang}
    q(f"""insert into etp.cau_hinh (khoa, gia_tri) values ('lo_trinh_tt', $J${json.dumps(cu, ensure_ascii=False)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri""")
    return {"lo_trinh_phim": len(ds), "lo_trinh_xep": xep}

if __name__ == "__main__":
    goc = {"phim": {}, "mo": {}, "dang": {}, "chay": None, "hong": {}, "dong_24h": [], "camp_24h": 0, "co_hoi": False}
    t = lambda **k: xet({**goc, **k}, 4)
    assert t()[0] == "thu_dang" and t()[3] == ("CC", 2)
    assert t(phim={"thu_vong": "cat"})[0] == "cat"
    assert t(chay=[{"loai": "CC", "so": 2}])[0] == "sx"
    assert t(dong_24h=["CC"])[0] == "cho_24h"
    assert t(camp_24h=4)[0] == "tran"
    cc = {"cảnh cuối": {"tao": 2, "chi": 2}}
    assert t(dang=cc)[3] == ("KT", 1)
    assert t(dang=cc, hong={"KT": 2})[0] == "het_may"
    assert t(hong={"CC": 2})[3] == ("KT", 1)
    assert t(dang={"cảnh cuối": {"tao": 2, "chi": 0}, "kể chuyện": {"tao": 2, "chi": 2}})[0] == "cho_so"
    assert t(co_hoi=True, mo={"trang_thai": "them", "k": 6})[3] == ("CC", 4)
    assert t(co_hoi=True, mo={"trang_thai": "them", "k": 6, "pha": "bao_hoa"})[3] is None
    assert t(co_hoi=True, mo={"trang_thai": "cho_do", "k": 6})[0] == "cho_do"
    print("tự kiểm đạt")
