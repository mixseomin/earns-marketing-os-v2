"""LỘ TRÌNH TỰ ĐỘNG TỪNG PHIM — THÍ ĐIỂM (anh 07/11/2026 "làm đầy đủ với riêng phim này Dragonborn để follow và update đầy đủ trước khi chính thức chạy trên toàn hệ thống").
dong-bo.py gọi chay(q) mỗi lượt (10 phút) cho phim trong etp.cau_hinh 'lo_trinh_tu_dong' {"phim": [...], "tran_camp_ngay": 4, "bat_dau": "...", "phim_moi_ngay": 12, "phim_them": {cid: ngày}, "phim_cuu_ngay": 10, "phim_cuu": {cid: {ngay, luc}}}
— "phim_moi_ngay" > 0 thì mỗi ngày máy tự thêm bấy nhiêu phim chưa có camp nhà (chon_phim_moi) vào danh sách (anh 07/11/2026, roadmap E13 bước 3).
Mỗi phim một BƯỚC KẾ, ghi etp.cau_hinh 'lo_trinh_tt' {phim: {ma, chu, ke, dang, luc}} cho thẻ phim; đổi bước thì ghi Log (etp.nhat_ky viec 'lo_trinh'), xếp dòng thì báo Telegram (etp.canh_bao).
Không tự tạo camp: chỉ xếp dòng etp.dong_phim, máy dòng phim iMac làm tiếp qua đủ cổng (soát · chấm · cong.kiem · nhan-ban.lich_len). Tắt / tăng bậc / G10 vẫn do máy luật.
Thứ tự: phim đã cất → dừng · vượt sức chứa → giữ · có camp cơ hội → mở rộng theo etp.mo_rong, ĐỒNG THỜI dạng còn thiếu → sản xuất song song · còn lại để cat_phim kết luận."""
import json, re

import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); import so_dang as DG
import cong as CG   # cong.sql_trang_hong: trang phim Nhà hỏng hẳn (anh 09/11/2026)
CAN = {k: DG.DONG[k] for k in ("PO", "CC", "AT")}   # PO TRƯỚC (anh 08/11/2026 "dạng Poster Động có vẻ đang hiệu quả cao hơn": camp từ 06/11 PO ROI +30%, 8/11 camp có chi lãi — mọi dạng khác âm); thứ tự = thứ tự chia chỗ trần camp / 24 giờ   # dạng lộ trình tự xếp (dong_phim.LOAI); CT chưa có máy. KT TẠM KHÔNG XẾP (anh 07/11/2026 "lượt này không sinh dòng phim KT cho nhanh" —
# máy sinh VideoExpress 1–4 giờ + lỗi Meta 389), thay bằng AT (anh-tinh.py ~10 phút/phim, anh 07/11/2026 "sử dụng cả ảnh tĩnh để lên camp cho nhanh hơn"); dòng KT đang chạy giữ nguyên
MOT_LUOT = {"KT", "AT", "PO"}
GAC = set()   # dạng anh tạm gác (etp.cau_hinh.gac_dang, đọc đầu mỗi lượt chay) — không xếp; mở rộng camp lãi đổi CC → PO khi CC bị gác (anh 08/11/2026)   # máy làm mỗi lượt một video → mỗi dòng 1 camp
HIEN = {**CAN, "KT": "kể chuyện"}   # dạng hiện trên thẻ phim (lo_trinh_tt.dang): cả KT để thấy số đã thử
TEN_CT, SO_MOI_DANG, SO_LOI_BO = "cảnh thật", 2, 3   # mỗi dạng 2 camp có chi (cat_phim.so_moi_dang) · 3 dòng hỏng thì thôi dạng đó (hỏng thường do máy quá tải, 2 lần là bỏ oan cả dạng)

def cau_hinh(q):
    try: return json.loads(q("select gia_tri::text from etp.cau_hinh where khoa = 'lo_trinh_tu_dong'") or "{}")
    except Exception: return {}

# DÒNG CHỜ CỔNG (18/11/2026: 1.197 dòng huỷ "FIX bỏ qua: phim đã có dòng cùng loại đang chạy" / 24 giờ): dòng đã làm xong creative, dừng ở bước camp vì một cổng
# đóng (phanh chợ / bảo trì / trần ngày / trần test / dừng lên camp mới) KHÔNG phải dòng hỏng — Mạnh / mo_tran_* mở lại nó khi cổng mở. Trước: lộ trình thấy dạng không
# có dòng 'chay' → xếp dòng mới chạy lại cả nhận / poster / chấm, rồi lúc dòng cũ được FIX thì một trong hai bị huỷ. Nay dạng có dòng chờ cổng (3 ngày) = đang có, không xếp.
SQL_CHO_CONG = ("(select coalesce(array_agg(distinct d.loai), '{{}}') from etp.dong_phim d where d.content_id = {cid} and d.trang_thai = 'dung' and d.tao_luc > now() - interval '3 days'"
                " and split_part(coalesce(d.ly_do, ''), ':', 1) = 'camp' and coalesce(d.ly_do, '') ~ '(PHANH|BẢO TRÌ|RÚT KHỎI CHỢ|chạm trần|DỪNG LÊN CAMP MỚI|" + CG.KHOA_TRAN_NGAY + "|" + CG.KHOA_TRAN_TEST + ")')")

def so(q, cid, bat_dau):
    return json.loads(q(f"""select row_to_json(x)::text from (select
        (select row_to_json(p) from (select ten, the_loai, thu_vong, thu_ly, nhom_goc, coalesce(url, '') <> '' co_url, coalesce((select gia_tri ? '{cid}' from xv_khoa_ngoai where ten = 'ethopex_phim_cam'), false) cam from etp.phim where content_id = {cid}) p) phim,
        (select row_to_json(m) from (select trang_thai, k, can_sx, pha, ly from etp.mo_rong where content_id = {cid}) m) mo,
        exists (select 1 from etp.camp_co_hoi where content_id = {cid}) co_hoi,
        (select coalesce(jsonb_object_agg(d, jsonb_build_object('tao', tao, 'chi', chi)), '{{}}') from (select r.dang d, count(*) tao, count(*) filter (where s.chi >= 1) chi from etp.camp c join etp.creative r using (creative_id)
            left join (select camp_id, sum(chi) chi from etp.so_ngay group by 1) s using (camp_id) where c.content_id = {cid} group by 1) a) dang,
        (select json_agg(json_build_object('loai', loai, 'so', so_camp)) from etp.dong_phim where content_id = {cid} and trang_thai = 'chay') chay,
        (select coalesce(jsonb_object_agg(loai, n), '{{}}') from (select loai, count(*) n from etp.dong_phim where content_id = {cid} and {CG.SQL_DONG_HONG} and tao_luc >= '{bat_dau}' group by 1) a) hong,   -- hỏng THẬT (cong.SQL_DONG_HONG): dòng gác / chạm trần / trang hỏng không đốt lượt thử của dạng
        (select coalesce(array_agg(distinct loai), '{{}}') from etp.dong_phim where content_id = {cid} and trang_thai = 'xong' and tao_luc > now() - interval '24 hours') dong_24h,
        {SQL_CHO_CONG.format(cid=int(cid))} cho_cong,
        (select count(*) from etp.camp where content_id = {cid} and tao > now() - interval '24 hours') camp_24h,
        {CG.sql_test_con(int(cid))} test_con,   -- chỗ camp test còn của phim (cong.KHOA_TRAN_TEST, anh 18/11/2026); null = phim lãi ổn định, không trần
        {CG.sql_trang_hong(int(cid))} trang) x"""))

def xet(s, tran, con_toi_da=None):
    """dữ liệu một phim → (mã bước, câu cho người đọc, số camp kế hoạch, các dòng cần xếp [(loại, số camp)]). Hàm thuần — bài tự kiểm ở cuối tệp.
    THỬ ĐỦ DẠNG TRONG THỜI GIAN NGẮN NHẤT (anh 07/11/2026): các dạng chạy SONG SONG, dạng này không chờ dạng kia; camp lãi vẫn mở rộng đồng thời với dạng chưa thử."""
    p, mo, dang = s.get("phim") or {}, s.get("mo") or {}, s.get("dang") or {}
    con = max(0, tran - int(s.get("camp_24h") or 0)); dang_sx = {d["loai"]: d.get("so") or 1 for d in s.get("chay") or []}; gan = s.get("dong_24h") or []
    cho_cong = set(s.get("cho_cong") or []) - set(dang_sx)   # dòng đã có creative, dừng ở bước camp vì cổng đóng (SQL_CHO_CONG) — không xếp dòng thứ hai
    if p.get("thu_vong") == "cat": return "cat", f"Đã cất phim: {p.get('thu_ly') or ''}"[:160], 0, []
    # BƯỚC NHẬN CHẤM RA NGOÀI ÂU-MỸ / CẤM 18+ (15:25 07/11: 9 dòng dừng vì 'hoat_hinh' / sổ cấm) → dừng hẳn, không xếp lại tới 3 lần hỏng mỗi dạng
    if p.get("cam"): return "cam", CHU_CAM, 0, []
    if p.get("nhom_goc") and p.get("nhom_goc") != "au_my": return "ngoai", f"Phim ngoài Âu-Mỹ (nhóm {p['nhom_goc']}) — không lên camp", 0, []
    # PHIM KHÔNG CÓ LINK TẢI TẬP (09/11/2026: dòng PO / AT chết ở bước tải tập, 29 dòng / 24 giờ — spy + trang phim đều không có link): mọi dạng máy làm đều tải tập
    if p and p.get("co_url") is False: return "khong_nguon", "Phim không có link tải tập (spy + trang phim đều trống) — máy không dựng được creative; có link thì tự xếp", 0, []
    # TRANG PHIM HỎNG HẲN (09/11/2026: 91648 xếp lại dòng mỗi 2 giờ suốt 24 giờ, dòng nào cũng đứng ở bước Trang phim) → không xếp; Ethopex sinh đủ thì lượt sau tự xếp
    if s.get("trang"): return "trang", f"Trang phim Nhà {CG.ly_trang_hong(s['trang'])} — không có trang đích, không lên camp; trang đủ thì tự xếp", 0, []
    # PHIM CỨU (anh 09/11/2026 "cho mở thêm 2 camp $1 nếu film chưa thực sự đuối hoặc bão hoà"): phim sắp hết camp vào lộ trình với trần CUU_CAMP camp mới tính từ lúc vào
    if con_toi_da is not None:
        if con_toi_da <= 0: return "cuu_du", f"Đã lên đủ {CUU_CAMP} camp cứu phim sắp hết camp (anh 09/11/2026) — để luật đo, không thêm", 0, []
        con = min(con, con_toi_da)
    # TRẦN CAMP TEST MỖI PHIM (anh 18/11/2026, cong.KHOA_TRAN_TEST): phim đã đủ camp test (chưa lãi) đang chạy → không sản xuất creative mới cho camp mới (cổng
    # cong.kiem cũng chặn lúc lên — xếp dòng ở đây chỉ đốt tiền dựng creative rồi đứng ở bước camp); còn chỗ thì số camp lượt này không vượt số chỗ
    if s.get("test_con") is not None:
        if int(s["test_con"]) <= 0: return "tran_test", f"Phim đã đủ {CG.TT['so']} camp test chưa lãi đang chạy (anh 18/11/2026) — chờ một camp tắt hoặc lãi rồi tự xếp", 0, []
        con = min(con, int(s["test_con"]))
    if s.get("co_hoi") and mo.get("pha") == "bao_hoa": return "giu", "Có camp lãi nhưng vượt sức chứa, giữ nguyên, không mở thêm", 0, []
    xep, chu, ke = [], [], 0
    if s.get("co_hoi"):
        k = int(mo.get("k") or 0)
        if mo.get("trang_thai") == "cho_do": ke += k; chu.append("Có camp lãi, chờ đo đủ 1 ngày khép rồi mở thêm")
        elif mo.get("trang_thai") != "them": chu.append(f"Có camp lãi, chưa mở thêm: {mo.get('ly') or ''}"[:120])
        elif "CC" in dang_sx or "CC" in gan: ke += k; chu.append("Vừa mở đợt CC, đợt sau tự xếp")
        elif "CC" in cho_cong: ke += k; chu.append("Đợt CC đã có creative, chờ cổng lên camp mở")
        elif not con: ke += k; chu.append(f"Chạm trần {tran} camp mới / 24 giờ, đợt sau tự xếp")
        elif "CC" in GAC: ke += k; con -= 1; xep.append(("PO", 1)); chu.append("Mở rộng theo camp lãi bằng PO (CC đang gác)")
        else: n = min(k, con); ke += k; con -= n; xep.append(("CC", n)); chu.append(f"Mở rộng CC × {n} theo camp lãi")
    for ma, ten in CAN.items():
        da, loi = int((dang.get(ten) or {}).get("tao") or 0), int((s.get("hong") or {}).get(ma) or 0)
        if ma in dang_sx and da < SO_MOI_DANG and not any(x[0] == ma for x in xep): ke += SO_MOI_DANG - da; chu.append(f"Đang sản xuất {ma} × {dang_sx[ma]}, xong tự lên camp"); continue   # dòng đang chạy thì nói đang chạy, kể cả dạng đã bỏ vì hỏng / vừa gác (09/11/2026: 25 phim có dòng chạy mà thẻ ghi 'đã thử hết')
        if ma in cho_cong and da < SO_MOI_DANG and not any(x[0] == ma for x in xep): ke += SO_MOI_DANG - da; chu.append(f"Creative {ma} đã làm xong, chờ cổng lên camp mở (không làm lại)"); continue
        if ma in GAC or da >= SO_MOI_DANG or loi >= SO_LOI_BO or any(x[0] == ma for x in xep): continue
        thieu = SO_MOI_DANG - da; ke += thieu
        if ma in gan: chu.append(f"Đang thử {ma} {da}/{SO_MOI_DANG}, đợt sau tự xếp sau 24 giờ")
        elif not con: chu.append(f"Chạm trần {tran} camp mới / 24 giờ, đợt {ma} tự xếp sau")
        else:
            n = 1 if ma in MOT_LUOT else min(thieu, con)   # máy sinh kể chuyện / ảnh tĩnh làm mỗi lượt một video
            con -= n; xep.append((ma, n)); chu.append(f"Thử dạng {ma}: sản xuất {n} camp" + (f" (lần thử lại sau {loi} dòng hỏng)" if loi else ""))
    if chu: return ("mo_rong" if any("Mở rộng" in c for c in chu) else "thu_dang" if xep else "sx" if dang_sx else "cho_cong" if any("chờ cổng" in c for c in chu) else "cho_24h" if any("24 giờ" in c and "trần" not in c for c in chu) else "tran" if any("trần" in c for c in chu) else "giu"), " · ".join(chu), ke, xep
    cho = [m for m, t in CAN.items() if int((dang.get(t) or {}).get("tao") or 0) > int((dang.get(t) or {}).get("chi") or 0)]
    if cho: return "cho_so", f"Chờ camp {', '.join(cho)} tiêu đủ $1 để có số", 0, []
    if int((dang.get(TEN_CT) or {}).get("chi") or 0) < SO_MOI_DANG: return "het_may", "Đã thử hết dạng máy làm được, CT chưa có máy tự sản xuất; luật cất sẽ kết luận", 0, []
    return "het_may", "Đã thử đủ dạng, luật cất sẽ kết luận", 0, []

# MÙA LỄ MỸ (anh 08/11/2026 "Sắp 27/11 thì có plan gì để tận dụng trend này"): 15/11–05/01 phim chủ đề gia đình / lễ (tâm lý sum họp Lễ Tạ ơn 26/11 – Giáng sinh)
# xếp trước trong cùng nhóm thứ tự — kho Âu-Mỹ 08/11: ~200 phim gia đình, 1 phim Giáng sinh. Hết mùa tự về thứ tự cũ.
MUA_LE = ("2026-11-15", "2027-01-05")
MUA_LE_TEN = r"\m(christmas|xmas|navidad|santa|holiday|thanksgiving|family|mom|mommy|dad|daddy|father|mother|son|daughter|brother|sister|wife|husband|baby|twins)\M"   # \m \M = ranh giới từ Postgres: không bắt Prison / Season / Moment
CUU_CAMP, CUU_NGAY_MAC = 2, 10   # phim cứu: tối đa 2 camp mới / phim (anh 09/11/2026) · tối đa CUU_NGAY_MAC phim / ngày (etp.cau_hinh.lo_trinh_tu_dong.phim_cuu_ngay ghi đè)
def chon_phim_cuu(q, ch, da):
    """PHIM SẮP HẾT CAMP VÀO LỘ TRÌNH (anh 09/11/2026 "cho mở thêm 2 camp $1 nếu film chưa thực sự đuối hoặc bão hoà" — thay vế 'thay bằng camp test' của camp thay thế đã bỏ):
    phim có camp nhà, không còn camp chạy hoặc camp chạy cuối đang lỗ (ngày khép chi ≥ $1, thu < chi), camp cuối tạo trong 14 ngày (còn đang chăm, không vét phim cũ),
    KHÔNG đuối (thu_vong không phải cat / sap_cat), KHÔNG bão hoà (etp.phim_bao_hoa), cùng cổng với phim mới (Âu-Mỹ, có link tải, có poster, không cấm, không dòng 3 ngày).
    Mỗi phim vào một lần (ghi phim_cuu {cid: {ngay, luc}}); chay() giới hạn CUU_CAMP camp mới tính từ luc."""
    tran = int(ch.get("phim_cuu_ngay") if ch.get("phim_cuu_ngay") is not None else CUU_NGAY_MAC)
    if tran <= 0: return []
    cuu = ch.get("phim_cuu") or {}; hom = q("select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text")
    con = tran - sum(1 for v in cuu.values() if v.get("ngay") == hom)
    if con <= 0: return []
    loai = ",".join(str(int(x)) for x in list(da) + [int(k) for k in cuu]) or "0"
    r = q(f"""with c as (select c.content_id, c.trang_thai, c.tao, coalesce(sum(n.chi), 0) chi, coalesce(sum(n.thu), 0) thu from etp.camp c
            left join etp.so_ngay n on n.camp_id = c.camp_id and n.ngay < (now() at time zone 'utc')::date where c.content_id is not null group by c.content_id, c.camp_id, c.trang_thai, c.tao),
        f as (select content_id, count(*) filter (where trang_thai = 'ACTIVE') act, max(tao) tao_cuoi, bool_and(chi >= 1 and thu < chi) filter (where trang_thai = 'ACTIVE') act_lo from c group by 1)
        select string_agg(content_id::text, ',') from (select p.content_id from f join etp.phim p using (content_id)
        where (f.act = 0 or (f.act = 1 and f.act_lo)) and f.tao_cuoi > now() - interval '14 days'
          and coalesce(p.thu_vong, '') not in ('cat', 'sap_cat') and coalesce(p.nhom_goc, 'au_my') = 'au_my' and coalesce(p.url, '') <> ''
          and not exists (select 1 from etp.phim_bao_hoa b where b.content_id = p.content_id and coalesce(b.bao_hoa, '') <> '')
          and not coalesce((select gia_tri ? p.content_id::text from xv_khoa_ngoai where ten = 'ethopex_phim_cam'), false)
          and exists (select 1 from etp.thu_vien_phim t where t.content_id = p.content_id and t.anh is not null)
          and not exists (select 1 from etp.dong_phim x where x.content_id = p.content_id and (x.trang_thai = 'chay' or x.tao_luc > now() - interval '3 days'))
          and {CG.sql_trang_hong('p.content_id')} is null
          and p.content_id not in ({loai})
        order by f.tao_cuoi desc limit {con}) x""")
    moi = [int(x) for x in (r or "").split(",") if x.strip().isdigit()]
    luc = q("select now()::text")
    for c in moi: cuu[str(c)] = {"ngay": hom, "luc": luc}
    if moi: ch["phim"] = [int(x) for x in ch.get("phim") or []] + moi; ch["phim_cuu"] = cuu
    return moi

def chon_phim_moi(q, ch, da):
    """MỞ CHO MỌI PHIM CHƯA CÓ CAMP NHÀ (anh 07/11/2026 "Tập trung các phim mới", roadmap E13 bước 3): mỗi ngày VN thêm tới cau_hinh.phim_moi_ngay phim vào lộ trình.
    Thứ tự: đội đã chạy LÃI (tiêu ≥ $10, thu > chi) → chưa ai chạy → đội chạy chưa đủ số (< $10). Bỏ: đội lỗ ≥ $10, phim cất, ngoài Âu-Mỹ, phim cấm 18+, phim không có poster trong kho,
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
          and exists (select 1 from etp.thu_vien_phim t where t.content_id = p.content_id and t.anh is not null)   -- có poster trong kho: bước nhận chấm nhóm gốc trên poster, thiếu là dòng hỏng ngay (15:18 07/11: 3/12 phim đầu hỏng vì thế; 272 phim không poster)
          and not exists (select 1 from etp.dong_phim x where x.content_id = p.content_id and (x.trang_thai = 'chay' or x.tao_luc > now() - interval '3 days'))
          and not exists (select 1 from etp.cho_len_v v where v.content_id = p.content_id and v.team_lai and v.ly_do is null)
          and not coalesce((select gia_tri ? p.content_id::text from xv_khoa_ngoai where ten = 'ethopex_phim_cam'), false)
          and coalesce(p.url, '') <> ''   -- có link tải tập (mọi dạng máy làm đều tải tập, 09/11/2026)
          and {CG.sql_trang_hong('p.content_id')} is null   -- trang phim Nhà hỏng hẳn (cong.sql_trang_hong, 09/11/2026)
          and p.content_id not in ({loai})
        order by case when d.chi >= 10 and d.thu > d.chi then 0 when d.content_id is null then 1 else 2 end,
          case when current_date >= '{MUA_LE[0]}' and current_date <= '{MUA_LE[1]}' and p.ten ~* '{MUA_LE_TEN}' then 0 else 1 end,   -- mùa lễ Mỹ: phim gia đình / lễ lên trước
          d.thu - d.chi desc nulls last, p.content_id desc limit {con}) x""")
    moi = [int(x) for x in (r or "").split(",") if x.strip().isdigit()]
    for c in moi: them[str(c)] = hom
    if moi: ch["phim"] = [int(x) for x in ch.get("phim") or []] + moi; ch["phim_them"] = them
    return moi

# ẢNH TĨNH ƯU TIÊN (anh 08/11/2026 "lên loại ảnh tĩnh ưu tiên cho nhanh"): phim ĐANG có camp chạy mà chưa có creative ảnh tĩnh, chưa có dòng AT (2 ngày),
# không trong sổ cấm 18+ → xếp dòng AT (máy dòng phim chạy anh-tinh.py, ~160–290₫ giọng / phim). Giữ tối đa AT_HANG dòng AT chưa xong để lượt sau
# lấy phim mới nhất; phim LÃI NHẤT 3 ngày (thu − chi, nhà + đội) lên trước (anh 08/11/2026 "ưu tiên các phim có camp lãi trước"), hoà thì phim nhiều camp. Bật bằng etp.cau_hinh 'at_uu_tien' {"bat": true} — tắt thì không xếp gì (tiền giọng > 5.000₫/đợt cần anh bật).
AT_HANG = 6
# MỖI PHIM ĐANG CHẠY MỘT CAMP POSTER ĐỘNG (anh 08/11/2026 "Mỗi bộ phim đều cần có 1 camp như thế này" · "Vẫn phải thêm cho các phim đang chạy"): PO giữ tới 20 dòng
# cùng lúc (dòng ~65 phút; các dạng khác đang gác nên iMac rảnh) — 87 phim đang chạy chưa có PO ≈ 5 giờ. Camp PO mới theo dõi đủ 1 ngày trước khi chấm.
HANG = {"PO": 20, "AT": AT_HANG}
UU_TIEN = ("PO", "AT")   # dạng tĩnh xếp ưu tiên cho phim đang chạy — PO trước (anh 08/11/2026 PO ROI +30%)
def xep_at(q, ma="AT", toi_da=None):
    """toi_da = số dòng tối đa lượt này theo ngân sách chỗ lên (ghi_sx / ngan_sx); None = không giới hạn thêm"""
    dang = DG.DONG[ma]
    if ma in GAC or (toi_da is not None and toi_da <= 0): return 0
    ch = json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'at_uu_tien'), '{}')") or "{}")
    if not ch.get("bat"): return 0
    # chỉ đếm dòng CỦA BƯỚC NÀY: 15 dòng AT phim mới (lộ trình, lãi 0) không được chặn phim lãi vào hàng (08/11/2026)
    con = int(q(f"select count(*) from etp.dong_phim where loai = '{ma}' and trang_thai = 'chay' and ai like 'máy: {dang} ưu tiên%'") or 0)
    if con >= HANG.get(ma, AT_HANG): return 0
    r = q(f"""insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp)
        select c.content_id, max(f.ten), max(f.the_loai), '{ma}', 'máy: {dang} ưu tiên (anh 08/11/2026 "lên loại ảnh tĩnh ưu tiên cho nhanh" · "Poster Động hiệu quả cao hơn") — phim đang chạy chưa có {dang}', 1
        from etp.camp_dang_chay c left join etp.phim f using (content_id)
        where c.content_id is not null
          and not exists (select 1 from etp.creative r where r.content_id = c.content_id and r.dang = '{dang}')
          and not exists (select 1 from etp.dong_phim d where d.content_id = c.content_id and d.loai = '{ma}' and (d.trang_thai = 'chay' or d.tao_luc > now() - interval '2 days'
                          or (d.trang_thai = 'dung' and d.tao_luc > now() - interval '3 days' and d.loai = any({SQL_CHO_CONG.format(cid='c.content_id')}))))
          and not coalesce((select k.gia_tri ? c.content_id::text from xv_khoa_ngoai k where k.ten = 'ethopex_phim_cam'), false)
        group by c.content_id order by (select coalesce(sum(s.thu - s.chi), 0) from (select k.content_id, s.ngay, s.chi, s.thu from etp.so_ngay s join etp.camp k using (camp_id) union all select k.content_id, s.ngay, s.chi, s.thu from etp.so_ngay_ngoai s join etp.camp_ngoai k using (camp_id)) s where s.content_id = c.content_id and s.ngay >= current_date - 3) desc, count(*) desc limit {min(HANG.get(ma, AT_HANG) - con, toi_da if toi_da is not None else 10 ** 6)} on conflict do nothing returning id""")
    return len([l for l in (r or "").splitlines() if l.strip()])

def xep_bu(q, con_sx=None):
    """BÙ CAMP (anh 09/11/2026, mo_rong.tinh_bu ghi etp.cau_hinh.bu_camp): mỗi phim cần bù chưa có dòng bù đang chạy → một dòng PO đúng k camp
    (dong_phim không ép 3 bản cho dòng bù: dùng creative sạch có sẵn trước, thiếu mới dựng). Dạng gác (gac_dang) thì không xếp dạng đó.
    con_sx = [ngân sách camp còn] (chay) — hết thì thôi xếp, mỗi dòng trừ k"""
    if "PO" in GAC: return 0
    bu = json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'bu_camp'), '{}')") or "{}")
    n = 0
    for cid, v in bu.items():
        if cid.startswith("_") or int(v.get("k") or 0) <= 0: continue
        if con_sx and con_sx[0] is not None and con_sx[0] < int(v["k"]): continue
        r = q(f"""insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp)
            select f.content_id, f.ten, f.the_loai, 'PO', 'máy: bù camp (anh 09/11/2026) — 24 giờ qua tắt {int(v.get("tat") or 0)} · giảm ${int(v.get("giam") or 0)} · đã tạo {int(v.get("tao") or 0)}', {int(v["k"])}
            from etp.phim f where f.content_id = {int(cid)}
              and not exists (select 1 from etp.dong_phim d where d.content_id = f.content_id and d.loai = 'PO' and d.trang_thai = 'chay')
              and not ('PO' = any({SQL_CHO_CONG.format(cid=int(cid))}))   -- dòng PO chờ cổng ở bước camp = đang có (18/11/2026)
            on conflict do nothing returning id""")
        m = len([l for l in (r or "").splitlines() if l.strip()]); n += m
        if m and con_sx and con_sx[0] is not None: con_sx[0] -= int(v["k"])
    return n

# SẢN XUẤT THEO CHỢ (anh 18/11/2026 "cứ sx rồi để đấy hay theo plan?" — sổ luật chung san_xuat_theo_cho). Đo 24 giờ tới 23:40 18/11: phanh chợ bật mà 521 dòng chạy hết
# nhận / poster / cắt / soát / chấm rồi đứng ở bước camp, 618 creative chấm / ngày, kho chờ lên 4.213. Nay:
#   phanh (cong.phanh_sx — đúng cổng lên camp của máy) → không xếp dòng nào; dòng đang chạy dừng trước bước tốn AI (dong_phim); máy chấm chỉ chấm nút anh + kho dự trữ hồi chợ
#   phanh nhả → chỉ sản xuất trong ~1 ngày chỗ lên THẬT: chỗ / ngày = trần camp mới / ngày (+ trần ★ ROAS hồi chợ khi đang đợt); trừ kho creative Sạch chờ lên
#   (etp.cho_len_v, mỗi phim tối đa số chỗ camp test còn) và số camp các dòng đang sản xuất → còn ≤ 0 thì không xếp thêm.
AT_BAN = int(re.search(r"^AT_BAN = (\d+)", open(_o.path.join(_o.path.dirname(_o.path.abspath(__file__)), "dong_phim.py")).read(), re.M).group(1))   # một nguồn: mỗi dòng tĩnh = AT_BAN camp
SQL_KHO_SAN = (f"select coalesce(sum(least(kx.n, coalesce({CG.sql_test_con('kx.content_id')}, {int(CG.TT['so'])}))), 0) from"
               " (select content_id, count(*) n from etp.cho_len_v where ly_do is null and content_id is not null group by 1) kx")   # kx: _sql_test dùng sẵn bí danh x
SQL_DANG_SX = ("select coalesce(sum(case when loai in (" + ", ".join(f"'{k}'" for k in sorted(DG.TINH)) + f") and coalesce(ai, '') not like 'máy: bù camp%'"
               f" then greatest(coalesce(so_camp, 1), {AT_BAN}) else greatest(coalesce(so_camp, 1), 1) end), 0) from etp.dong_phim where trang_thai = 'chay'")

def ngan_sx(cho_ngay, kho, dang):
    """hàm thuần: số camp lộ trình còn được sản xuất lượt này (≤ 0 = không xếp). cho_ngay None = không có trần ngày → không giới hạn"""
    return None if cho_ngay is None else int(cho_ngay) - int(kho or 0) - int(dang or 0)

def ghi_sx(q):
    """đọc cổng MỘT lần mỗi lượt đồng bộ → etp.cau_hinh cong.KHOA_SX {phanh, du_tru, kho, het} cho dòng phim (iMac), Mạnh, cửa máy chấm, nạp creative đội"""
    import hoi_cho as HC
    ch = CG.doc_cau_hinh(); ly = CG.phanh_sx(ch)
    sx = {"phanh": ly, "du_tru": [], "luc": q("select now()::text")}
    # DỪNG KHẨN (anh 20/11/2026 "off hết các camp 2-3 ngày, ngừng mọi việc từ sx, lên camp mới, nhân bản… đến khi có thông báo"): khan = ngừng MỌI sản xuất —
    # không kho dự trữ hồi chợ, không miễn phim chỉ-sx, không máy dựng theo mẫu / cứu creative (dong_phim đọc sx.khan); hàng chấm giữ hết trừ nút anh bấm
    if ch.get("dung_khan"): sx["khan"] = True
    elif ly: sx["du_tru_tt"] = HC.du_tru(q); sx["du_tru"] = sx["du_tru_tt"]["thieu"]
    else:
        tcm = ch.get(CG.KHOA_TRAN_NGAY)
        dot = False
        try: dot = HC.dot(ch.get("phanh_cho"), q("select max(split_part(khoa, ':', 3)) from etp.canh_bao where khoa like 'phanh_cho:phanh:%'") or None, __import__("datetime").datetime.now(__import__("datetime").timezone.utc))[0]
        except Exception: pass
        cho_ngay = None if tcm is None else int(tcm) + (int(HC.HC["tran_ngay"]) if dot else 0)
        kho, dang = int(q(SQL_KHO_SAN) or 0), int(q(SQL_DANG_SX) or 0)
        sx["kho"] = {"cho_ngay": cho_ngay, "kho_san": kho, "dang_sx": dang, "hoi_cho": dot, "con": ngan_sx(cho_ngay, kho, dang)}
    q(f"""insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('{CG.KHOA_SX}', $J${json.dumps(sx, ensure_ascii=False)}$J$::jsonb || jsonb_build_object('het', (now() + interval '{CG.SX_PHUT} minutes')::text),
            'sản xuất theo chợ (anh 18/11/2026, sổ luật san_xuat_theo_cho): phanh = câu cổng lên camp đang đóng, du_tru = phim hồi chợ còn được chấm, kho = ngân sách chỗ', 'lo_trinh_phim.ghi_sx')
          on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()""")
    # GIỮ HÀNG CHẤM KHI PHANH: cửa máy chấm (/api/ext/etp-cham) chỉ nhận việc 'cho' → mọi việc 'cho' (xếp mới, xếp lại, thử lại — mọi nguồn: dòng phim, đội, lịch giờ,
    # nhan-ban) trừ nút anh bấm + creative phim hồi chợ còn thiếu kho dự trữ đổi sang 'giu_phanh' (không xoá); phanh nhả / phim vào du_tru thì trả về 'cho'
    du = ",".join(str(int(x)) for x in sx["du_tru"]) or "0"
    # + phim anh vừa LỆNH TRỰC TIẾP (vé loai 'truc_tiep' cấp trong 24 giờ, cong.py --ve-truc-tiep): anh 20/11/2026 "Không PHANH nào được hạn chế quyền trực tiếp" —
    # 22/11/2026 Genie EN 49869 + Bugatti ES 82854 đã có vé lên camp mà creative kẹt giu_phanh ở hàng chấm, dòng phim chờ máy chấm mãi
    o_du = (f"exists (select 1 from etp.creative c where c.creative_id = h.creative_id and (c.content_id in ({du}) or exists (select 1 from etp.ve_tay v"
            f" where v.loai = 'truc_tiep' and v.content_id = c.content_id and v.tao > now() - interval '24 hours')))")
    if ly: sx["giu_cham"] = int(q(f"""with g as (update etp.cham_hang h set trang_thai = 'giu_phanh', buoc = 'chờ phanh nhả (sổ luật san_xuat_theo_cho)'
                                         where h.trang_thai = 'cho' and h.nguon not in ('nut', 'giong') and not {o_du} returning 1) select count(*) from g""") or 0)
    sx["tra_cham"] = int(q(f"""with g as (update etp.cham_hang h set trang_thai = 'cho', buoc = null where h.trang_thai = 'giu_phanh' and ({'false' if ly else 'true'} or {o_du})
                                returning 1) select count(*) from g""") or 0)
    return sx

def ghi_ngung(q, chu):
    """nhật ký lộ trình ngưng xếp — một dòng / ngày VN / kiểu (khoá = 40 ký tự đầu)"""
    dau = chu[:40].replace("'", "''").replace("%", "")
    q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) select now(), 'lo_trinh', true, $L${chu}$L$, 'máy lộ trình tự động'
          where not exists (select 1 from etp.nhat_ky where viec = 'lo_trinh' and left(luat, 40) = '{dau}' and (luc at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date)""")

AT_KQ = [0]
CHU_CAM = "Phim trong sổ cấm 18+ — không lên camp"
def sql_cam_tt(goc):
    """PHIM CẤM (etp:phim-cam-cho-3-2011): biểu thức jsonb = lo_trinh_tt <goc> với MỌI khoá phim nằm trong sổ ethopex_phim_cam đổi ma 'cam' (giữ dang).
    Gốc lỗi #143938 (cấm 10:30 19/11, vẫn 'thu_dang'): chay() chỉ tính lại phim còn trong lo_trinh_tu_dong.phim — phim đã rời danh sách giữ mã cũ mãi."""
    return (f"({goc}) || coalesce((select jsonb_object_agg(e.key, e.value || jsonb_build_object('ma', 'cam', 'chu', $C${CHU_CAM}$C$, 'ke', 0)) from jsonb_each({goc}) e"
            f" join xv_khoa_ngoai k on k.ten = 'ethopex_phim_cam' and jsonb_typeof(k.gia_tri) = 'object' and k.gia_tri ? e.key where e.value->>'ma' is distinct from 'cam'), '{{}}'::jsonb)")
def dong_cam_tt(q):   # đầu MỖI nhịp, trước mọi return sớm (ngừng sx / đủ hàng / dừng camp mới / trần ngày) → phim vào sổ cấm có mã cam ở nhịp kế
    return q(f"update etp.cau_hinh set gia_tri = {sql_cam_tt('gia_tri')} where khoa = 'lo_trinh_tt' and gia_tri <> {sql_cam_tt('gia_tri')} returning 1")

def chay(q):
    try: dong_cam_tt(q)
    except Exception as e: print(f"lo_trinh_tt phim cấm: {e}"[:200], file=_s.stderr)
    try: GAC.clear(); GAC.update(str(x) for x in json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'gac_dang'), '[]')") or "[]"))
    except Exception: pass
    kq = {}
    try: sx = ghi_sx(q)
    except Exception as e: sx = {"loi": f"{type(e).__name__}: {e}"[:200]}   # đọc hỏng → lộ trình chạy như cũ (cổng lên camp vẫn chặn khi lên)
    if sx.get("phanh"):
        ghi_ngung(q, f"ngừng sản xuất — {sx['phanh']} — lộ trình không xếp dòng mới (sổ luật san_xuat_theo_cho, anh 18/11/2026)")
        return {"lo_trinh": f"ngừng sản xuất: {sx['phanh']}"[:200], "du_tru": sx.get("du_tru_tt")}
    ngan = (sx.get("kho") or {}).get("con")
    if ngan is not None and ngan <= 0:
        k = sx["kho"]
        ghi_ngung(q, f"đủ hàng ~1 ngày chỗ lên — kho Sạch chờ lên {k['kho_san']} + đang sản xuất {k['dang_sx']} camp ≥ {k['cho_ngay']} chỗ / ngày — lộ trình không xếp thêm (sổ luật san_xuat_theo_cho)")
        return {"lo_trinh": f"đủ hàng: kho {k['kho_san']} + đang sx {k['dang_sx']} ≥ {k['cho_ngay']} chỗ / ngày", "kho": k}
    if CG.LUAT_CU_DUNG:   # LUẬT CŨ DỪNG (anh 22/11/2026): lộ trình / AT-poster ưu tiên / bù camp / phim cứu đều là luật trước 20/11 → không xếp dòng
        q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) select now(), 'lo_trinh', true, '{CG.LY_LUAT_CU} — lộ trình ngưng xếp dòng', 'máy lộ trình tự động'
              where not exists (select 1 from etp.nhat_ky where viec = 'lo_trinh' and luat like 'LUẬT CŨ DỪNG%' and (luc at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date)""")
        return {"lo_trinh": "luật cũ dừng — không xếp dòng"}
    if q(CG.SQL_DUNG_CAMP_MOI) == "t":   # anh dừng lên camp mới để review (cong.KHOA_DUNG_CAMP_MOI) → không xếp dòng nào
        q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) select now(), 'lo_trinh', true, 'đang dừng lên camp mới (etp.cau_hinh.{CG.KHOA_DUNG_CAMP_MOI}) — lộ trình ngưng xếp dòng', 'máy lộ trình tự động'
              where not exists (select 1 from etp.nhat_ky where viec = 'lo_trinh' and luat like 'đang dừng lên camp mới%' and (luc at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date)""")
        return {"lo_trinh": "đang dừng lên camp mới — không xếp dòng"}
    # CHẠM TRẦN CAMP MỚI / NGÀY (cong.KHOA_TRAN_NGAY) → lượt này KHÔNG xếp dòng nào (09/11/2026: 108 camp lên lúc 00:00–00:30, trần chạm; mỗi lượt 10 phút
    # lộ trình xếp lại dòng PO → dòng sản xuất xong dừng vì trần → lượt sau xếp lại: 279 dòng huỷ + 772 dòng nhật ký 'lo_trinh' trong 10 giờ, đẩy dòng tạo camp
    # khỏi tab Log). Dòng đã dừng vì trần được dong_phim.mo_tran_ngay tự FIX sang ngày mới — không mất gì khi ngưng xếp.
    try: tcm = json.loads(q(f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{CG.KHOA_TRAN_NGAY}'), 'null')") or "null")
    except Exception: tcm = None
    da_tao = int(q(CG.SQL_TAO_HOM_NAY) or 0) if tcm is not None else 0
    if tcm is not None and da_tao >= int(tcm):
        q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) select now(), 'lo_trinh', true, 'hôm nay đã tạo {da_tao} camp, chạm trần {int(tcm)} camp mới / ngày — lộ trình ngưng xếp dòng tới 00:00 giờ VN', 'máy lộ trình tự động'
              where not exists (select 1 from etp.nhat_ky where viec = 'lo_trinh' and luat like 'hôm nay đã tạo % chạm trần %' and (luc at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date)""")
        return {"lo_trinh": f"chạm trần {da_tao}/{tcm} camp mới hôm nay — không xếp dòng"}
    con_sx = [ngan]   # ngân sách camp lượt này (None = không trần) — mỗi dòng xếp trừ số camp của nó
    for ma in UU_TIEN:   # đầu lượt: không phụ thuộc phim lộ trình
        try: kq[ma] = xep_at(q, ma, None if con_sx[0] is None else max(0, con_sx[0] // AT_BAN)); con_sx[0] = None if con_sx[0] is None else con_sx[0] - kq[ma] * AT_BAN
        except Exception as e: kq[ma] = f"lỗi: {e}"[:200]
    try: kq["bu"] = xep_bu(q, con_sx)
    except Exception as e: kq["bu"] = f"lỗi: {e}"[:200]
    AT_KQ[0] = kq
    ch = cau_hinh(q); ds = [int(x) for x in ch.get("phim") or []]
    moi = chon_phim_moi(q, ch, ds)
    cuu = chon_phim_cuu(q, ch, ds + moi)
    if moi or cuu:
        ds += moi + cuu
        q(f"""update etp.cau_hinh set gia_tri = $J${json.dumps(ch, ensure_ascii=False)}$J$::jsonb where khoa = 'lo_trinh_tu_dong'""")
        if moi: q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) values (now(), 'lo_trinh', true, 'thêm {len(moi)} phim mới vào lộ trình tự động: {" ".join(map(str, moi))}', 'máy lộ trình tự động (anh 07/11/2026: tập trung phim mới)')""")
        if cuu: q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) values (now(), 'lo_trinh', true, 'thêm {len(cuu)} phim sắp hết camp vào lộ trình (tối đa {CUU_CAMP} camp mới / phim): {" ".join(map(str, cuu))}', 'máy lộ trình tự động (anh 09/11/2026: cho mở thêm 2 camp $1 nếu phim chưa đuối / bão hoà)')""")
    if not ds: return {"at_uu_tien": AT_KQ[0]}
    try: cu = json.loads(q("select gia_tri::text from etp.cau_hinh where khoa = 'lo_trinh_tt'") or "{}")
    except Exception: cu = {}
    xep = 0
    for cid in ds:
        s = so(q, cid, ch.get("bat_dau") or "2026-11-07"); c_ = (ch.get("phim_cuu") or {}).get(str(cid))
        con_cuu = max(0, CUU_CAMP - int(q(f"select count(*) from etp.camp where content_id = {cid} and tao >= '{c_['luc']}'") or 0)) if c_ else None   # phim cứu: trần CUU_CAMP camp mới từ lúc vào
        ma, chu, ke, cac_dong = xet(s, int(ch.get("tran_camp_ngay") or 4), con_cuu)
        ten = (s.get("phim") or {}).get("ten") or f"phim {cid}"; hong = s.get("hong") or {}
        dang = {m: {"da": int((s["dang"].get(t) or {}).get("tao") or 0), "chi": int((s["dang"].get(t) or {}).get("chi") or 0), "bo": int(hong.get(m) or 0) >= SO_LOI_BO} for m, t in {**HIEN, "CT": TEN_CT}.items()}
        ten_sql = ten.replace("'", "''"); ai = f"máy: lộ trình tự động thí điểm (anh 07/11/2026) · {chu}".replace("'", "''")
        xep_phim = 0
        for loai, so_camp in cac_dong:
            camp_dong = max(int(so_camp), AT_BAN) if loai in DG.TINH else int(so_camp)
            if con_sx[0] is not None and con_sx[0] < camp_dong: continue   # hết ~1 ngày chỗ lên (ghi_sx) → lượt sau
            # KIỂM NGAY LÚC XẾP (anh 18/11/2026: 1.197 dòng huỷ trùng / ngày): phim đã có dòng cùng loại đang chạy HOẶC dòng cùng loại chờ cổng ở bước camp
            # (SQL_CHO_CONG — Mạnh / mo_tran_* sẽ mở lại nó) → không xếp; dong_phim_mot vẫn chặn khi hai lượt đồng bộ chồng nhau
            if q(f"""insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp) select {cid}, '{ten_sql}', (select the_loai from etp.phim where content_id = {cid}), '{loai}', '{ai}', {int(so_camp)}
                     where not exists (select 1 from etp.dong_phim x where x.content_id = {cid} and x.loai = '{loai}' and x.trang_thai = 'chay')
                       and not ('{loai}' = any({SQL_CHO_CONG.format(cid=int(cid))}))
                     on conflict do nothing returning id"""):
                xep += 1; xep_phim += 1
                if con_sx[0] is not None: con_sx[0] -= camp_dong
        if xep_phim:   # chỉ báo khi lượt này THẬT xếp dòng mới (trước: báo mỗi lượt kể cả khi on conflict không xếp gì)
            # khoá bỏ phần đếm lần thử lại (09/11/2026: mỗi lượt thử lại PO đổi "sau 1 → 2 dòng hỏng" → tin mới, 18 tin / 37 phút trong CẢNH BÁO KHO)
            # khoá = phim + nội dung (07/11/2026: khoá theo giây → mỗi lượt 10 phút gửi lại y hệt, 72 tin/ngày trên Telegram); đổi kế hoạch mới báo lại
            q(f"""insert into etp.canh_bao (loai, muc, khoa, noi_dung) values ('lo_trinh', 'info', 'lo_trinh:{cid}:' || md5($C${re.sub(r' \(lần thử lại sau \d+ dòng hỏng\)', '', chu)}$C$), '🤖 Thí điểm lộ trình · {ten_sql}: {chu.replace("'", "''")}') on conflict do nothing""")
        if (cu.get(str(cid)) or {}).get("chu") != chu:
            q(f"""insert into etp.nhat_ky (luc, viec, ok, luat, ai) values (now(), 'lo_trinh', true, 'phim {cid} · {chu.replace("'", "''")}', 'máy lộ trình tự động')""")
        cu[str(cid)] = {"ma": ma, "chu": chu, "ke": ke, "dang": dang}
    q(f"""insert into etp.cau_hinh (khoa, gia_tri) values ('lo_trinh_tt', $J${json.dumps(cu, ensure_ascii=False)}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri""")
    return {"lo_trinh_phim": len(ds), "lo_trinh_xep": xep, "at_uu_tien": AT_KQ[0]}

if __name__ == "__main__" and "--tu-kiem-phim-cam" in _s.argv:   # trên box3, SỔ THẬT, không ghi: 167292 'thu_dang' → 'cam' (giữ dang), phim thường giữ nguyên
    _thuong = CG._q("select content_id from etp.phim where not coalesce((select gia_tri ? content_id::text from xv_khoa_ngoai where ten = 'ethopex_phim_cam'), false) order by content_id desc limit 1").strip()
    _g = f"""'{json.dumps({"167292": {"ma": "thu_dang", "dang": {"PO": 1}}, _thuong: {"ma": "thu_dang"}})}'::jsonb"""
    _r = json.loads(CG._q(f"select ({sql_cam_tt(_g)})::text"))
    assert _r["167292"] == {"ma": "cam", "chu": CHU_CAM, "ke": 0, "dang": {"PO": 1}} and _r[_thuong] == {"ma": "thu_dang"}, _r
    print(f"lo_trinh phim cấm: 167292 thu_dang → cam, phim thường #{_thuong} giữ thu_dang"); _s.exit()

if __name__ == "__main__":
    # bài tự kiểm theo CAN = PO → CC → AT (anh 08/11/2026 PO trước; bộ cũ viết khi chưa có PO nên đỏ từ 08/11 — sửa lại 09/11/2026 cùng lượt rà xung đột luật)
    goc = {"phim": {}, "mo": {}, "dang": {}, "chay": None, "hong": {}, "dong_24h": [], "camp_24h": 0, "co_hoi": False}
    t = lambda **k: xet({**goc, **k}, 4)
    assert t()[0] == "thu_dang" and t()[3] == [("PO", 1), ("CC", 2), ("AT", 1)]   # song song, PO trước; KT không xếp (anh 07/11/2026)
    assert t(phim={"thu_vong": "cat"})[0] == "cat"
    assert t(phim={"co_url": False})[0] == "khong_nguon" and t(phim={"co_url": True})[0] == "thu_dang"
    assert t(trang="link tập 1")[0] == "trang" and t(trang="link tập 1")[3] == [] and t(trang=None)[0] == "thu_dang"
    assert t(test_con=0)[0] == "tran_test" and t(test_con=0)[3] == [], "phim đủ camp test → không xếp dòng (anh 18/11/2026)"
    assert sum(n for _, n in t(test_con=1)[3]) == 1 and t(test_con=None)[3] == t()[3], "còn 1 chỗ test → tối đa 1 camp; phim lãi ổn định (null) không trần"
    assert t(phim={"cam": True})[0] == "cam" and t(phim={"nhom_goc": "hoat_hinh"})[0] == "ngoai" and t(phim={"nhom_goc": "au_my"})[0] == "thu_dang"
    assert t(chay=[{"loai": "CC", "so": 2}])[3] == [("PO", 1), ("AT", 1)]   # CC đang làm không chặn dạng khác
    r = t(hong={"PO": 3}, chay=[{"loai": "PO", "so": 1}]); assert "Đang sản xuất PO" in r[1] and r[3] == [("CC", 2), ("AT", 1)]   # dạng đã bỏ vì hỏng mà còn dòng chạy → báo đang chạy, không 'đã thử hết'
    assert t(hong={"PO": 3})[3] == [("CC", 2), ("AT", 1)] and t(hong={"PO": 2})[3] == [("PO", 1), ("CC", 2), ("AT", 1)]   # 3 dòng hỏng THẬT (cong.SQL_DONG_HONG) mới bỏ dạng
    sx3 = [{"loai": "PO", "so": 1}, {"loai": "CC", "so": 2}, {"loai": "AT", "so": 1}]
    assert t(chay=sx3)[0] == "sx" and t(chay=sx3)[3] == []
    assert t(chay=[{"loai": "CC", "so": 2}, {"loai": "KT", "so": 1}])[3] == [("PO", 1), ("AT", 1)]   # dòng KT cũ đang chạy không thay được AT
    assert t(dong_24h=["CC"])[3] == [("PO", 1), ("AT", 1)]
    assert t(dong_24h=["PO", "CC", "AT"])[0] == "cho_24h"
    assert t(camp_24h=4)[0] == "tran" and t(camp_24h=3)[3] == [("PO", 1)]   # còn 1 chỗ → dạng đứng đầu lấy
    assert t(hong={"CC": 2})[3] == [("PO", 1), ("CC", 2), ("AT", 1)]   # 2 dòng hỏng vẫn thử lại
    assert t(hong={"CC": 3})[3] == [("PO", 1), ("AT", 1)]
    cc = {"cảnh cuối": {"tao": 2, "chi": 2}}
    assert t(dang=cc)[3] == [("PO", 1), ("AT", 1)]
    assert t(dang=cc, hong={"AT": 3, "PO": 3})[0] == "het_may"
    assert t(dang={"cảnh cuối": {"tao": 2, "chi": 0}, "ảnh tĩnh": {"tao": 2, "chi": 2}, "poster động": {"tao": 2, "chi": 2}})[0] == "cho_so"
    du = {"cảnh cuối": {"tao": 2, "chi": 2}, "ảnh tĩnh": {"tao": 2, "chi": 2}, "poster động": {"tao": 2, "chi": 2}}
    assert t(co_hoi=True, dang=du, mo={"trang_thai": "them", "k": 6})[3] == [("CC", 4)]
    assert t(co_hoi=True, dang=cc, mo={"trang_thai": "them", "k": 2})[3] == [("CC", 2), ("PO", 1), ("AT", 1)]   # có camp lãi vẫn thử dạng chưa thử
    assert t(co_hoi=True, mo={"trang_thai": "them", "k": 6, "pha": "bao_hoa"})[3] == []
    tc = lambda n, **k: xet({**goc, **k}, 4, n)   # phim cứu (anh 09/11/2026): trần 2 camp mới
    assert tc(0)[0] == "cuu_du" and tc(0)[3] == [] and tc(1)[3] == [("PO", 1)] and tc(2)[3] == [("PO", 1), ("CC", 1)]
    assert tc(2, co_hoi=True, dang=du, mo={"trang_thai": "them", "k": 6})[3] == [("CC", 2)]   # mở rộng cũng không vượt trần cứu
    assert tc(0, phim={"thu_vong": "cat"})[0] == "cat"   # cổng cất / cấm đứng trước trần cứu
    # SẢN XUẤT THEO CHỢ (anh 18/11/2026): dạng có dòng chờ cổng ở bước camp không xếp dòng thứ hai; ngân sách ~1 ngày chỗ lên
    r = t(cho_cong=["PO"]); assert r[3] == [("CC", 2), ("AT", 1)] and "chờ cổng lên camp mở" in r[1], "PO đã có creative chờ cổng → không xếp PO mới"
    assert t(cho_cong=["PO", "CC", "AT"])[0] == "cho_cong" and t(cho_cong=["PO", "CC", "AT"])[3] == []
    assert t(cho_cong=["PO"], chay=[{"loai": "PO", "so": 1}])[3] == [("CC", 2), ("AT", 1)], "dòng đang chạy đứng trước dòng chờ cổng"
    assert tc(2, co_hoi=True, dang=du, mo={"trang_thai": "them", "k": 6}, cho_cong=["CC"])[3] == [], "đợt CC mở rộng đang chờ cổng → không mở đợt mới"
    assert ngan_sx(24, 150, 30) == -156 and ngan_sx(29, 3, 10) == 16 and ngan_sx(None, 999, 999) is None, "chỗ / ngày − kho Sạch − đang sản xuất"
    assert AT_BAN == 3 and "PHANH" in SQL_CHO_CONG and CG.KHOA_TRAN_TEST in SQL_CHO_CONG and "'{}'" in SQL_CHO_CONG.format(cid=1)
    print("lo_trinh_phim: tự kiểm đạt")
