"""CỔNG RÀO CHẮN etp (anh 24/10/2026 — bước 3 etp.on.tc): MỌI lệnh tự động gọi kiem() trước khi gửi lên Ethopex.
kiem(viec, camp_id=None, ns_moi=None, ns_cu=0, bo=None, content_id=None, ngoai=False, tay=False, roas=False, lenh_anh=False, bac=False) → None (cho qua) | câu lý do chặn.
  ngoai=True: camp trong tài khoản QC của người trong team (Luật tự động, apps/cty/worker/etp-tu-dong.mjs) — vẫn qua dừng khẩn / Âu-Mỹ / phim cất / trần camp,
  bỏ trần NGÀY + trần BỘ (hai trần đó cộng ngân sách camp NHÀ trong etp.camp — tiền của người đó không tính vào, cũng không bị trần nhà chặn).
  CHỈ PHIM ÂU-MỸ (anh 29/10/2026 "dừng các phim ngoài âu mỹ … chặn thể loại này khi lên camp target US"): phim có etp.phim.nhom_goc khác au_my
  (trung / an / latin / hoat_hinh / dong_a / da_mau) → chặn mọi việc tăng chi (tạo camp, nhân bản kể cả ROAS, bật lại, tăng). Phim chưa chấm nhóm → chấm poster ngay, thiếu poster thì 4 khung video creative đã chấm (apps/etp/nhom_goc.py, ckey ~13–36₫), không chấm được → chặn (anh 29/10/2026 "làm cho kín").
  TRÙNG PHIM VỚI ĐỘI: BỎ (anh 06/11/2026 "Bỏ tiêu chí ko lên camp cùng người trong đội") — luật 02/11/2026 chặn camp mới phim người khác trong đội đang chạy; nay lên bình thường.
  PHIM ĐÃ CẤT: điều kiện đã BỎ (anh 23/11/2026 "Bỏ điều kiện 'Cất phim' đi") — cổng không còn chặn tạo camp / nhân bản theo etp.phim.thu_vong.
  viec: tang | bat | nhan_ban | tao_camp (làm tăng chi) · giam | tat (luôn cho qua — dừng khẩn vẫn phải hạ được chi)
Đọc etp.cau_hinh (dung_khan · tran_ngay · tran_camp · tran_bo · tran_camp_moi_ngay) + etp.camp (tổng ngân sách camp đang bật). Lỗi đọc kho → CHẶN (an toàn trước, không đoán).
Dùng trong script khác: sys.path.insert(0, '/opt/earns-marketing-os-v2/apps/etp'); import cong; ly = cong.kiem('tang', cid, 15, 10)"""
import json, os, subprocess, datetime as dt
TANG = {"tang", "bat", "nhan_ban", "tao_camp"}
# KIỂU CHỮ MẶC ĐỊNH CỦA KHỐI CREATIVE (anh 27/11/2026 "Sinh kiểu Kiên là default và có option chọn sang Dol" — thay 3 K : 1 D cùng ngày, trước nữa nửa-nửa 26/11):
# mọi creative K (chữ Kiên của phim, search.com); D (form Dol, info.com) CHỈ khi anh chọn D lúc duyệt ở etp2 › Camp › Chờ lên (etp.cho_len.kieu).
# Một nguồn cho dong_phim.b_creative_khoi (áp chữ) và bao-plan.kd_dong (K/D dự kiến). Phim chưa có chữ Kiên (chu-kieu.json) → D, không tự viết chữ.
TL_KD = 3
def la_k(i, n): return True
# NẮP NGÂN SÁCH THEO ROI 3 NGÀY KHÉP — một nguồn với máy luật (sổ luật chung apps/web/src/lib/etp-bang-luat.json nap_tang; Dol 09/11/2026, anh duyệt: chỉ lần tăng mới)
_BL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "src", "lib", "etp-bang-luat.json")))
_BAC = [x for x in _BL["thang"] if x <= 20]
NAP_TANG = sorted((float(m), float(n)) for m, n in _BL["nap_tang"]["bac"])
NAP_DUOI = max([x for x in _BAC if x < NAP_TANG[0][1]] or [_BAC[0]])
def nap_tang(r3): return max([n for m, n in NAP_TANG if r3 is not None and r3 >= m], default=NAP_DUOI)
SQL_ROI3 = ("select case when sum(chi) > 0 then round(100 * (sum(thu) - sum(chi)) / sum(chi)) end from etp.so_ngay where camp_id = {cid}"
            " and ngay between (now() at time zone 'utc')::date - 3 and (now() at time zone 'utc')::date - 1")
# NẮP CAMP TRẺ (thang phiên, anh duyệt 22/11/2026): camp < 3 ngày khép có chi → nắp theo ROI HÔM NAY (≥50% $9 · ≥80% $13 · ≥100% + lãi ≥ $10 → $20);
# camp đủ 3 ngày khép → nắp ROI 3 ngày như cũ. Không đọc được số ngày → coi là camp già (an toàn: nắp cũ).
NAP_TRE = sorted((float(m), float(n)) for m, n in _BL["nap_tre"]["bac"]); NAP_TRE_LAI20 = float(_BL["nap_tre"]["lai_20"]); NAP_TRE_NGAY = int(_BL["nap_tre"]["ngay"])
def nap_tre(r, lai): return max([n for m, n in NAP_TRE if r is not None and r >= m and (n < 20 or (lai or 0) >= NAP_TRE_LAI20)], default=None)
def nap_camp(r3, ngay_chi=None, r_nay=None, lai_nay=None):
    n = nap_tang(r3)
    return max(n, nap_tre(r_nay, lai_nay) or 0) if ngay_chi is not None and ngay_chi < NAP_TRE_NGAY else n
SQL_NGAY_CHI = "select count(*) from etp.so_ngay where camp_id = {cid} and chi > 0 and ngay < (now() at time zone 'utc')::date"
SQL_NAY = "select chi, thu from etp.so_ngay where camp_id = {cid} and ngay = (now() at time zone 'utc')::date"
# TRẦN CAMP MỚI / NGÀY — một nguồn cho cổng này và máy dòng phim (dong_phim.mo_tran_ngay nhận dòng dừng vì trần bằng KHOA_TRAN_NGAY có trong lý do, đếm chỗ còn bằng SQL_TAO_HOM_NAY)
KHOA_TRAN_NGAY = "tran_camp_moi_ngay"
# BỘ LÊN CAMP MỚI — một nguồn (anh 08/11/2026 "Bộ 1 = 50% Kiên… Sửa đi" + "1 phim ở nhiều bộ thoải mái"): camp mới của creative (dòng phim, worker phim mới,
# nút lên camp etp.on.tc, len-sau-cham, thay-the) lên bộ etp.cau_hinh.bo_phim_moi, phim đã chạy bộ khác cũng vậy. Nhân bản / thang / ROAS ở bộ camp gốc.
SQL_BO_PHIM = ("select coalesce((select thu_bo from etp.phim where content_id = {cid} and thu_vong = 'doi_bo' and coalesce(thu_bo, '') <> ''),"
               " (select gia_tri#>>'{{}}' from etp.cau_hinh where khoa = 'bo_phim_moi'))")   # phim thang cất đang ở vòng đổi bộ (cat_phim.py thu_bo) → bộ đó; còn lại bo_phim_moi (anh 09/11/2026: camp thay thế bỏ, bộ đổi đi theo mọi đường lên camp)
# DÒNG HỎNG THẬT ≠ DÒNG DỪNG ĐÚNG LUẬT (09/11/2026 rà xung đột: lộ trình đếm mọi dòng 'dung' là hỏng → 3 dòng là bỏ hẳn dạng đó cho phim; 46 phim mất CC, 37 mất AT
# chỉ vì dòng bị gác theo gac_dang, 33 mất PO vì chạm trần camp/ngày hay trang phim hỏng). Hỏng thật = 'loi' (máy), hoặc 'dung' không do một luật chặn:
# gác dạng (dong_phim.gac_ly), trần camp mới/ngày (kiem → mo_tran_ngay tự mở lại), trang phim Nhà hỏng (ly_trang_hong), nhóm gốc ngoài Âu-Mỹ (bước nhận).
# + PHANH CHỢ / BẢO TRÌ / RÚT (18/11/2026): dòng dừng ở bước camp vì phanh cũng là dừng đúng luật — trước đếm là hỏng, 3 lần thì lộ trình bỏ hẳn dạng đó của phim
SQL_DONG_HONG = ("(trang_thai = 'loi' or (trang_thai = 'dung' and coalesce(ly_do, '') not like 'tạm gác dòng%' and strpos(coalesce(ly_do, ''), 'chạm trần') = 0"
                 " and strpos(coalesce(ly_do, ''), 'DỪNG LÊN CAMP MỚI') = 0 and strpos(coalesce(ly_do, ''), 'PHANH') = 0 and strpos(coalesce(ly_do, ''), 'BẢO TRÌ') = 0"
                 " and strpos(coalesce(ly_do, ''), 'RÚT KHỎI CHỢ') = 0 and strpos(coalesce(ly_do, ''), 'CHỈ SẢN XUẤT') = 0 and coalesce(ly_do, '') not like 'ws: trang phim Nhà%' and coalesce(ly_do, '') not like 'nhan: nhóm gốc%'))")
# CAMP ÍT NƯỚC KHÔNG BẬT LẠI (anh 09/11/2026 theo Dol / Ethopex: "phải target đúng cả list quốc gia" — team tắt camp ít nước, "Ko bật lại", bỏ A/B nước):
# camp nhánh THỬ của mọi lần A/B kiểu 'nuoc' (AB01 "4 nước") → mọi đường bật (lam-ethopex bat, lịch giờ, máy thay creative bị từ chối) đều chặn.
# + LÔ TEAM ETHOPEX TẮT (anh 09/11/2026 "1 lô vừa tắt từ bên team etho thì ko tự bật lại"): etp.cau_hinh.team_tat = mảng camp_id (201 camp tắt 15:46 09/11) — thêm lô mới = nối vào mảng
SQL_IT_NUOC = ("select c.camp_id from etp.camp_ab c join etp.ab a on a.ma = c.ab where a.kieu = 'nuoc' and c.nhanh = 'thu'"
               " union select x::int from etp.cau_hinh, jsonb_array_elements_text(gia_tri) x where khoa = 'team_tat'")
LY_IT_NUOC = "camp ít nước (nhánh thử A/B nhắm nước) hoặc trong lô team Ethopex đã tắt (etp.cau_hinh.team_tat) — không bật lại (anh 09/11/2026)"
# DỪNG LÊN CAMP MỚI — công tắc tổng etp.cau_hinh.dung_camp_moi (anh 25/10/2026 lần đầu; 09/11/2026 "kế hoạch lên 100 camp / ngày dừng lại … để review lại toàn bộ"):
# cổng kiem chặn camp MỚI $1 từ creative (tao_camp) — nhân bản camp có sẵn vẫn chạy (anh 10/11/2026); lộ trình (lo_trinh_phim), mở lại dòng chạm trần (dong_phim.mo_tran_ngay), mở rộng phim đội lãi (dong_phim.mo_doi_lai) đọc cùng khoá
# này để không xếp dòng mới — dòng đang dừng giữ nguyên chờ review. Mở lại = đặt false. CHỈ tk David / Nhà (ngoai=True — camp tk người trong team — không bị chặn; anh 09/11/2026).
KHOA_DUNG_CAMP_MOI = "dung_camp_moi"
SQL_DUNG_CAMP_MOI = f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{KHOA_DUNG_CAMP_MOI}'), 'false') = 'true'"
LY_DUNG_CAMP_MOI = "ĐANG DỪNG LÊN CAMP MỚI"
# camp ★ ROAS không phải camp thử → không đếm, không bị trần chặn (anh 12/11/2026: camp đủ lên ROAS bị vướng "Trần camp mới hôm nay 116/35")
# Đếm cả camp đã ghi nhật ký tạo mà CHƯA đồng bộ về etp.camp (dong-bo 10 phút/lượt) — 16/11/2026 00:01–00:15: 148 camp lọt trần 61 vì các luồng song song
# đọc etp.camp còn 0 camp của ngày mới (09/11 cũng 108 camp 00:00–00:30). nhat_ky.camp_id = id camp mới, ghi ngay sau khi tạo (nhan-ban.ghi_nhat_ky).
SQL_TAO_HOM_NAY = ("select count(*) from (select camp_id from etp.camp where (tao at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date"
                   " and not coalesce(la_roas, false) union select n.camp_id from etp.nhat_ky n where n.ok and n.viec in ('tao_camp', 'nhan_ban') and n.camp_id is not null"
                   " and (n.luc at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date"
                   " and not exists (select 1 from etp.camp c where c.camp_id = n.camp_id and c.la_roas)) x")
# GIỮ CHỖ DƯỚI TRẦN (16/11/2026): mỗi camp tạo mất 1–4 phút (chờ Ethopex đồng bộ) rồi mới ghi nhật ký → hàng chục luồng song song cùng đọc một số đếm cũ và cùng lọt.
# Đếm + giữ chỗ trong MỘT giao dịch có khoá: số đã dùng = camp đã tạo hôm nay + chỗ đang giữ trong GIU_GIAY giây chưa thành dòng nhật ký. Chỗ giữ tự nhả sau GIU_GIAY
# (lượt chạy thử / lượt hỏng sau cổng không ăn mất chỗ cả ngày). Trả (số đã dùng, được qua hay không).
GIU_GIAY = 480
def giu_cho(tcm):
    r = _q(f"""select pg_advisory_xact_lock(74611116);
        with dem as (select ({SQL_TAO_HOM_NAY}) n),
        cu as (select coalesce((select jsonb_agg(x) from etp.cau_hinh, jsonb_array_elements(gia_tri) x where khoa = 'giu_cho_camp' and jsonb_typeof(gia_tri) = 'array'
                                and (x#>>'{{}}')::float > extract(epoch from now()) - {GIU_GIAY}), '[]'::jsonb) ds),
        vua as (select count(*) n from etp.nhat_ky where ok and viec in ('tao_camp', 'nhan_ban') and luc > now() - interval '{GIU_GIAY} seconds'),
        q as (select dem.n + greatest(jsonb_array_length(cu.ds) - vua.n, 0) so, cu.ds from dem, cu, vua),
        ghi as (insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) select 'giu_cho_camp', q.ds || to_jsonb(extract(epoch from now())::float),
                    'chỗ đang giữ dưới trần camp mới / ngày (cong.giu_cho) — mốc giây, tự nhả sau {GIU_GIAY} giây', 'cong.py' from q where q.so < {int(tcm)}
                on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now() returning 1)
        select q.so || '|' || (select count(*) from ghi) from q""").strip().splitlines()[-1]
    so, ok = r.split("|"); return int(so), ok == "1"
# TRẦN CAMP TEST MỖI PHIM (anh 18/11/2026, hướng dẫn Dol khi chợ kém — sổ luật chung tran_test_phim): một phim chỉ có tối đa `so` camp TEST (camp CHƯA LÃI) đang chạy.
# Camp LÃI không tính: ROI cộng dồn dương (thu > chi, chi > 0) hoặc đạt nấc NB thấp nhất (sổ nhan_ban.nac: tiêu ≥ $3 & ROI ≥ +50%). Phim LÃI ỔN ĐỊNH (phim_on: `ngay` ngày đã khép,
# camp nhà, chi ≥ $chi, thu > chi) không bị trần. ★ ROAS không tính, cũng không bị trần (dạng riêng, đợt hồi chợ có trần riêng). Đếm cả camp vừa tạo chưa đồng bộ về kho
# (nhật ký studio 15 phút, như nhan-ban.dem_dang_chay) + chỗ đang giữ (cùng cách giu_cho: hàng chục luồng song song cùng đọc một số đếm cũ thì cùng lọt).
# MỘT câu SQL cho cổng (giu_test) và lộ trình (sql_test_con — không xếp dòng sản xuất cho phim đã đủ camp test) + dòng phim (mo_tran_test tự mở lại khi có chỗ).
KHOA_TRAN_TEST = "tran_test_phim"
TT = _BL[KHOA_TRAN_TEST]
_NB_MIN = min(((float(c), float(m)) for c, m, _n in _BL["nhan_ban"]["nac"]), key=lambda x: x[0])
def la_lai(chi, thu):
    """camp lãi (không phải camp test) theo sổ luật — hàm thuần, cùng điều kiện câu SQL _sql_test"""
    chi, thu = float(chi or 0), float(thu or 0)
    return chi > 0 and (thu > chi or (chi >= _NB_MIN[0] and (thu - chi) / chi * 100 >= _NB_MIN[1]))
# BẢN NHÂN TỪ CAMP GỐC ĐÃ ĐẠT NẤC KHÔNG TÍNH TRẦN (anh 19/11/2026 rà xung đột luật, xung đột 5): nhân bản theo nấc (nhan_ban.nac) là đường scale camp ĐÃ LÃI —
# đếm bản nhân vào trần camp test thì camp gốc đạt nấc 45 / 100 không bao giờ nhân được tới đủ nấc. Đếm theo CAMP GỐC (etp.camp.goc · nhật ký x.goc): gốc đạt nấc NB
# thấp nhất (số cộng dồn của gốc trong etp.so_ngay) → bản nhân không tính, cổng cũng không giữ chỗ. Phim không có camp nào đạt nấc vẫn trần tran_test_phim.so.
def goc_dat_nac(chi, thu):
    """camp gốc đã đạt nấc NB thấp nhất (bản nhân của nó không tính trần camp test) — hàm thuần, cùng điều kiện _sql_goc_nac"""
    chi, thu = float(chi or 0), float(thu or 0)
    return chi >= _NB_MIN[0] and (thu - chi) / chi * 100 >= _NB_MIN[1]
def _sql_goc_nac(goc):
    """điều kiện SQL: camp gốc (biểu thức SQL số camp) đã đạt nấc NB thấp nhất trên số cộng dồn etp.so_ngay"""
    return (f"exists (select 1 from etp.so_ngay g where g.camp_id = ({goc}) group by g.camp_id having sum(g.chi) >= {_NB_MIN[0]}"
            f" and (sum(g.thu) - sum(g.chi)) / nullif(sum(g.chi), 0) * 100 >= {_NB_MIN[1]})")
_NB_LOG_MIEN = "not (x->>'viec' = 'nhan_ban' and coalesce(x->>'goc', '') ~ '^[0-9]+$' and " + _sql_goc_nac("(x->>'goc')::int") + ")"
def _sql_test(cid):
    """dòng (n: camp test đang chạy + camp vừa tạo chưa vào kho, on: phim lãi ổn định) — cid: số hoặc biểu thức SQL"""
    po = TT["phim_on"]
    return f"""(select (select count(*) from (select c.camp_id, coalesce(sum(n.chi), 0) chi, coalesce(sum(n.thu), 0) thu from etp.camp c left join etp.so_ngay n using (camp_id)
            where c.content_id = {cid} and not coalesce(c.la_roas, false) and not (c.goc is not null and {_sql_goc_nac('c.goc')})
              and (c.camp_id in (select camp_id from etp.camp_dang_chay) or coalesce(c.dong_bo, '') not in ('done', 'synced', 'error', 'DISAPPROVED')) group by 1) s
            where not (s.chi > 0 and (s.thu > s.chi or (s.chi >= {_NB_MIN[0]} and (s.thu - s.chi) / s.chi * 100 >= {_NB_MIN[1]}))))
          + (select count(distinct x->>'id') from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x where ten = 'ethopex_nhat_ky' and x->>'viec' in ('tao_camp', 'nhan_ban') and (x->>'ok')::boolean
              and x->>'nguoi' is null and x->>'content' = ({cid})::text and coalesce(x->>'id', '') ~ '^[0-9]+$' and {_NB_LOG_MIEN}
              and to_timestamp(x->>'luc', 'HH24:MI DD/MM/YYYY') > (now() at time zone 'Asia/Ho_Chi_Minh') - interval '15 minutes'
              and not exists (select 1 from etp.camp k where k.camp_id = (x->>'id')::int)) n,
        coalesce((select sum(n.chi) >= {float(po['chi'])} and sum(n.thu) > sum(n.chi) from etp.so_ngay n join etp.camp k using (camp_id) where k.content_id = {cid}
            and n.ngay between (now() at time zone 'utc')::date - {int(po['ngay'])} and (now() at time zone 'utc')::date - 1), false) "on")"""
# BỎ TRẦN (anh 25/11/2026 "Ko set trần ngày hay số camp limit nào hết … Xoá hết"): sổ luật tran_test_phim.so = null → không trần camp test / phim:
# sql_test_con trả null (= không trần, như phim lãi ổn định), cổng kiem không đếm / giữ chỗ. Đặt lại số trong sổ thì trần chạy lại y như cũ.
CO_TRAN_TEST = TT.get("so") is not None
def sql_test_con(cid):
    """câu SQL con → số chỗ camp test còn lại của phim (null = không trần: sổ bỏ trần hoặc phim lãi ổn định) — lộ trình đọc để không sản xuất creative cho phim đã đủ camp test"""
    if not CO_TRAN_TEST: return "(select null::int)"
    return f"(select case when t.on then null else greatest({int(TT['so'])} - t.n, 0) end from {_sql_test(cid)} t)"
def giu_test(cid):
    """(số camp test đang chạy kể cả chỗ đang giữ, phim lãi ổn định?, được qua?) — đếm + giữ chỗ trong MỘT giao dịch có khoá (cùng cách giu_cho)"""
    cid, tran = int(cid), int(TT["so"])
    r = _q(f"""select pg_advisory_xact_lock(74611118);
        with t as {_sql_test(cid)},
        cu as (select coalesce((select jsonb_agg(x) from etp.cau_hinh, jsonb_array_elements(case when jsonb_typeof(gia_tri->'{cid}') = 'array' then gia_tri->'{cid}' else '[]'::jsonb end) x
                                where khoa = 'giu_test_phim' and (x#>>'{{}}')::float > extract(epoch from now()) - {GIU_GIAY}), '[]'::jsonb) ds),
        vua as (select count(*) n from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x where ten = 'ethopex_nhat_ky' and x->>'viec' in ('tao_camp', 'nhan_ban') and (x->>'ok')::boolean
                and x->>'nguoi' is null and x->>'content' = '{cid}' and to_timestamp(x->>'luc', 'HH24:MI DD/MM/YYYY') > (now() at time zone 'Asia/Ho_Chi_Minh') - interval '{GIU_GIAY + 60} seconds'
                and {_NB_LOG_MIEN}),
        q as (select t.n + greatest(jsonb_array_length(cu.ds) - vua.n, 0) so, t.on, cu.ds from t, cu, vua),
        ghi as (insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) select 'giu_test_phim', jsonb_build_object('{cid}', q.ds || to_jsonb(extract(epoch from now())::float)),
                    'chỗ đang giữ dưới trần camp test / phim (cong.giu_test) — {{phim: [mốc giây]}}, tự nhả sau {GIU_GIAY} giây', 'cong.py' from q where not q.on and q.so < {tran}
                on conflict (khoa) do update set gia_tri = etp.cau_hinh.gia_tri || excluded.gia_tri, luc = now() returning 1)
        select q.so || '|' || q.on || '|' || (select count(*) from ghi) from q""").strip().splitlines()[-1]
    so, on, ok = r.split("|"); return int(so), on == "t", on == "t" or ok == "1"
def mien_tran_goc(goc):
    """nhân bản từ camp gốc này không tính trần camp test (gốc đã đạt nấc NB, cùng câu _sql_goc_nac)"""
    return _q(f"select {_sql_goc_nac(int(goc))}").strip() == "t"
def ly_tran_test(ct, so):
    return (f"chạm trần {TT['so']} camp test / phim ({KHOA_TRAN_TEST}, anh 18/11/2026): phim #{ct} đang có {so} camp chưa lãi đang chạy / vừa tạo — camp mới / nhân bản chờ một camp test "
            f"tắt hoặc lãi (dòng phim tự mở lại); phim lãi ổn định {TT['phim_on']['ngay']} ngày khép (chi ≥ ${TT['phim_on']['chi']:g}, thu > chi) không bị trần")
# TRANG PHIM HỎNG HẲN (anh 09/11/2026 "Fix triệt để" — 91648 From Doomed Baby đứng bước Trang phim 01:26 08/11 → 01:27 09/11, hơn 20 lượt chờ 60 phút → Mạnh huỷ → FIX):
# bản workspace Nhà đã thêm quá TRANG_CHO_SINH giây mà Ethopex vẫn chưa sinh đủ (thường là link tập 1: thư viện phim không có nguồn tập 1, 7 phim 09/11) → chờ thêm vô ích.
# MỘT định nghĩa cho cổng Trang phim (dong_phim.b_ws dừng dòng), máy lộ trình (lo_trinh_phim không xếp dòng) và Mạnh (dấu cổng: Ethopex có link → tự mở lại dòng).
TRANG_CHO_SINH = 3600
def sql_trang_hong(cid):
    """câu SQL con → chữ các mục còn thiếu của trang phim Nhà đã quá hạn chờ sinh, null khi trang đủ / bản còn mới / chưa có bản. cid: số hoặc biểu thức SQL"""
    nha = "nguoi_id in (select nguoi_id from etp.tai_khoan where nha)"
    return (f"(select array_to_string(t.thieu, ', ') from etp.trang_phim_v t where t.ref_id = {cid} and t.{nha} and cardinality(t.thieu) > 0"
            f" and t.tao < now() - interval '{TRANG_CHO_SINH} seconds' and not exists (select 1 from etp.trang_phim_v x where x.ref_id = {cid} and x.{nha} and cardinality(x.thieu) = 0)"
            f" order by t.sua desc limit 1)")
def ly_trang_hong(thieu):
    """chữ cho người đọc từ kết quả sql_trang_hong — link chết khác hẳn thiếu link (thư viện không có nguồn)"""
    return ("có link tập 1 đã chết (máy kiểm link), Ethopex chưa thay" if thieu.strip() == "link tập 1 chết"
            else f"thiếu {thieu} sau {TRANG_CHO_SINH // 60} phút chờ Ethopex sinh")   # không ghi nguyên nhân: 53 phim thư viện không nguồn vẫn có link, đoán là sai

def _q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s], capture_output=True, text=True, timeout=30)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-200:])
    return r.stdout.strip()

# DÀN MỨC ★ ROAS (anh 26/11/2026 "Tại sao các camp đều là 1.0? … Sửa từ gốc để đa dạng level ROAS"): mọi đường lên ★ ROAS creative mới chọn mức qua MỘT hàm
# etp.muc_roas (migration 0481) — mức trong sổ hoi_cho.muc có ít camp ★ ROAS nhất của phim trong dan_ngay ngày. Bên gọi nhan-ban truyền --roas dan, nhan-ban chọn mức
# ĐÚNG lúc tạo (camp trước cùng phim đã vào etp.camp) → các camp cùng phim tự rải 1 / 0.9 / 1.1 / 1.2. etp2 gọi cùng hàm SQL với cùng danh sách.
MUC_ROAS = [float(m) for m in _BL["hoi_cho"]["muc"]]; DAN_NGAY = int(_BL["hoi_cho"]["dan_ngay"]); ROAS_DAN = "dan"
_MUC_TXT = ",".join(f"{m:g}" for m in MUC_ROAS)
def sql_muc_roas(cid): return f"select etp.muc_roas({int(cid)}, array[{_MUC_TXT}]::numeric[], {DAN_NGAY})"
def muc_roas(cid, q=None): return float((q or _q)(sql_muc_roas(cid)))
def so_roas(r): return ROAS_DAN if r == ROAS_DAN else f"{float(r):g}"   # đối số --roas cho nhan-ban
def chu_roas(r): return ("dàn " + "/".join(f"{m:g}" for m in MUC_ROAS)) if r == ROAS_DAN else f"{float(r):g}"   # nhãn cho người đọc

# AT CHỈ MỘT DẠNG — FREE (anh chốt 19/11/2026 theo mẫu team Dol, sổ luật at_chi_dang_free): creative ẢNH TĨNH (etp.diem_cham.cham.hook.dang / etp.creative.dang
# 'ảnh tĩnh') chỉ được lên camp khi cham.cta.mau = 'watch_for_free' (nhãn tím "All Episodes Released" + tên phim + nút "Watch For Free"). Mọi đường (dòng phim, AT,
# hồi chợ, nhân bản, đổi creative bài bị từ chối) gửi qua apps/etp/ethopex_api.api → chấm ở đó trên creative_id của CHÍNH lệnh. Creative AT của nhà chưa có sổ điểm
# chạm → chặn (không chứng minh được Free); creative do team dựng (etp.creative.lo = 'team', không có sổ) không chấm — không biết dạng của họ.
DANG_AT, CTA_AT = "ảnh tĩnh", "watch_for_free"
LY_AT = "creative #{0} dạng ảnh tĩnh mang CTA '{1}' — AT chỉ còn dạng Free (nhãn 'All Episodes Released' + tên phim + nút 'Watch For Free', anh chốt 19/11/2026, sổ luật at_chi_dang_free)"
def ly_at(rows):
    """rows = [(creative_id, dang kho, hook.dang sổ, cta.mau sổ | None, lo, có sổ)] → lý do chặn đầu tiên | None (hàm thuần, tự kiểm)"""
    for cid, dang, hook, mau, lo, co_so in rows:
        if DANG_AT not in (dang, hook): continue
        if not co_so and lo == "team": continue
        if mau != CTA_AT: return LY_AT.format(cid, mau or "chưa ghi sổ điểm chạm")
    return None
def at_sai_dang(creative_ids, q=None):
    """lý do chặn | None cho danh sách creative_id sắp lên camp — lỗi đọc sổ thì chặn (fail-closed)"""
    ids = sorted({int(i) for i in creative_ids or () if str(i).isdigit()})
    if not ids: return None
    try:
        r = (q or _q)(f"""select c.creative_id, coalesce(c.dang, ''), coalesce(d.cham->'hook'->>'dang', ''), coalesce(d.cham->'cta'->>'mau', ''), coalesce(c.lo, ''), d.creative_id is not null
            from etp.creative c left join etp.diem_cham d using (creative_id) where c.creative_id in ({','.join(map(str, ids))})""")
    except Exception as e: return f"không đọc được sổ điểm chạm để chấm dạng AT ({str(e)[:80]}) — chặn cho an toàn"
    rows = [(int(a), b, h, m or None, l, t == "t") for a, b, h, m, l, t in (x.split("|") for x in r.splitlines() if x.count("|") == 5)]
    return ly_at(rows)

LY_AU_MY = "phim nhóm gốc '{}' — chỉ chạy phim Âu-Mỹ (anh 29/10/2026: dừng các phim ngoài Âu-Mỹ, chặn khi lên camp; nhóm chấm trên poster, etp.phim.nhom_goc)"

# NGÀY THỊ TRƯỜNG XẤU (anh 09/11/2026 "Như hnay là ngày cả đội giảm sâu. Plan nên là gì" → "Làm đi"): ngày đã khép mà ROI CẢ ĐỘI (nhà + đội) thấp hơn
# trung bình 7 ngày khép trước đó từ NGAY_XAU_DIEM điểm trở lên. Luật L3 / L4 / G10 (luat-ethopex.py) không tính ngày này vào chuỗi lỗ của camp ≥ $10 và ★ ROAS
# (tầng camp chín — 08/11: $1 −47% kéo cả ngày, $10–20 vẫn +14%, ROAS +21%); camp nhỏ hơn vẫn bị T1 / T8 / L3 như thường. hen_do.py báo Telegram khi có ngày xấu.
NGAY_XAU_DIEM, NGAY_XAU_NS = 20, 10
def ngay_xau(q=None, so_ngay=21):
    """{ngày ISO: (ROI ngày, ROI nền 7 ngày trước)} — chỉ ngày đã khép (UTC). q mặc định _q của tệp này."""
    q = q or _q
    ds = [l.split("|") for l in q(f"""select ngay, sum(chi), sum(thu) from (select ngay, chi, thu from etp.so_ngay union all select ngay, chi, thu from etp.so_ngay_ngoai) s
        where ngay >= (now() at time zone 'utc')::date - {int(so_ngay)} and ngay < (now() at time zone 'utc')::date group by 1 order by 1""").splitlines() if l.count("|") == 2]
    roi = [(d, (float(t) - float(c)) / float(c) * 100) for d, c, t in ds if float(c or 0) > 0]
    ra = {}
    for i in range(7, len(roi)):
        nen = sum(r for _, r in roi[i - 7:i]) / 7
        if roi[i][1] <= nen - NGAY_XAU_DIEM: ra[roi[i][0]] = (round(roi[i][1]), round(nen))
    return ra

def phim_chan_len():
    """{content_id: lý do} — phim cổng CHẮC CHẮN chặn tạo camp / nhân bản, không phụ thuộc creative hay ngân sách (đã chấm nhóm ngoài Âu-Mỹ · đã cất).
    Máy chọn việc (thay-the.py) lọc trước bằng hàm này: 31/10/2026 máy thay camp thử 450 lần thì 445 lần bị chặn Âu-Mỹ — mỗi lần một lượt gọi Ethopex + một dòng nhật ký.
    Phim chưa chấm nhóm không có ở đây (kiem() chấm ngay lúc lên)."""
    ra = {}
    for l in _q("select content_id, coalesce(nhom_goc, ''), coalesce(thu_vong, ''), coalesce(thu_ly, '') from etp.phim where (nhom_goc is not null and nhom_goc <> 'au_my')").splitlines():   # phim đã cất không còn chặn (anh 23/11/2026 bỏ điều kiện cất phim)
        cid, ng, tv, tl = l.split("|", 3)
        ra[int(cid)] = LY_AU_MY.format(ng)
    # PHIM CẤM (etp:phim-cam-cho-3-2011): sổ ethopex_phim_cam cũng là chặn chắc — anh-tinh / thay-the lọc trước bằng hàm này nên không dựng / thay creative phim cấm
    for l in _q(f"select k.key || '|' || coalesce(k.value->>'ly_do', 'cấm') from xv_khoa_ngoai x, jsonb_each(x.gia_tri) k where x.ten = '{KHOA_PHIM_CAM}'"
                f" and jsonb_typeof(x.gia_tri) = 'object' and k.key ~ '^[0-9]+$'").splitlines():
        cid, ly = l.split("|", 1); ra[int(cid)] = LY_PHIM_CAM.format(cid, KHOA_PHIM_CAM, ly[:160])
    return ra

# NHÂN BẢN BÀI CŨ (anh 11/11/2026, Dol: "chạy lại post cũ để $2 luôn cũng được" — anh chốt "$2 cho camp dùng bài cũ thắng"): bản nhân bản camp thắng thường
# dùng LẠI bài đăng của camp gốc (Use existing post, ad chỉ mang effective_object_story_id) — từ 25/11/2026 cùng mức NS_MOI như mọi camp mới.
# NB $10 (anh 22/11/2026, Dol "Camp dup ra, anh có thể để luôn budget ~ 10$ thử" — anh: "duyệt nb vào $10 luôn ko cần nắp"): bản nhân dùng bài cũ lên thẳng $10;
# nắp camp trẻ / nắp ROI 3 ngày chỉ áp lệnh TĂNG, không áp mức khởi điểm của bản nhân. Camp mới từ creative vẫn $1.
NS_MOI = int(_BL["camp_moi"]["ns"])   # CAMP MỚI ĐỀU $5 (anh 25/11/2026 "các camp mới đều bắt đầu từ $5") — sổ luật chung camp_moi.ns, thay $1 camp mới / $10 nhân bản bài cũ
TRAN_TUYET = 30   # trần tuyệt đối $/camp/ngày (anh 14/11/2026) — kiem() chặn trước mọi miễn trừ
# VÉ THAO TÁC TAY (anh 18/11/2026 "kiểm soát tuyệt đối" — thay cho chữ ai / cờ anh_bam: 17/11 dòng phim gọi nhan-ban --tay lọt 91 camp, 18/11 máy AT ghi ai
# "anh (chat 05/11/2026: …)" lọt 31 camp — mọi chữ người gọi tự khai đều giả được). Nút người bấm (etp2 · nút Telegram · nút etp) xin MỘT vé ngay lúc bấm
# (xin_ve — CHỈ các tệp nút trong VE_XIN được gọi, gop-y-luat.mjs giữ), vé đi qua biến môi trường ETP_VE vào tiến trình làm việc. Cổng chỉ miễn PHANH CHỢ /
# BẢO TRÌ / TRẦN CAMP TEST khi vé hợp lệ: đúng việc, đúng camp (hoặc camp gốc / phim của lệnh tạo), chưa hết hạn VE_PHUT phút, chưa dùng. Cửa API
# (ethopex_api.api) đốt vé lúc gửi lệnh — một vé một lệnh. Lỗi đọc vé = không vé (an toàn trước).
VE_PHUT = int(_BL["mot_cua"]["ve_phut"])   # sổ luật chung mot_cua (anh 18/11/2026)
assert _BL["mot_cua"]["mien_phanh"] == ["ve_tay", "truc_tiep"], "phanh chợ chỉ miễn thao tác tay có vé (18/11) + vé lệnh trực tiếp của anh (20/11/2026) — sổ luật mot_cua lệch mã"
VE_VIEC = {"tang": "tang", "bat": "bat", "nhan_ban": "nhan_ban", "tao_camp": "nhan_ban", "doi_cr": "doi_cr"}   # tạo camp từ creative = cùng loại vé lên camp · doi_cr = gắn lại creative cho ad chưa bị từ chối (chỉ vé trực tiếp, anh 24/11/2026)
VE_XIN = ("apps/etp2/src/lib/actions/etp-tay.ts", "apps/etp2/src/lib/actions/etp-dong.ts", "apps/etp2/src/lib/actions/etp-sua.ts", "apps/etp2/src/lib/etp-ve.ts",
          "apps/web/src/lib/actions/etp-dong.ts", "apps/web/src/lib/actions/etp-sua.ts", "apps/web/src/lib/etp-ve.ts")   # + worker/ethopex.mjs xuNut (nút Telegram) ở repo cty
def _ma_ve(ma):
    import re
    ma = str(ma or os.environ.get("ETP_VE") or "").strip()
    return ma if re.fullmatch(r"[0-9a-f]{32}", ma) else None
def xin_ve(viec, camp_id=None, content_id=None, ai=""):
    """vé một lần cho thao tác TAY vừa bấm → mã 32 hex. Chỉ gọi từ đường nút (VE_XIN). camp_id / content_id ít nhất một."""
    import secrets
    v = VE_VIEC.get(viec)
    if not v: raise ValueError(f"vé không cho việc '{viec}' (chỉ {sorted(set(VE_VIEC.values()))})")
    cid = int(camp_id) if camp_id not in (None, "", "-") else None; ct = int(content_id) if content_id not in (None, "", "-") else None
    if cid is None and ct is None: raise ValueError("vé phải gắn camp hoặc phim")
    if not str(ai or "").strip(): raise ValueError("vé phải ghi người bấm")
    ma = secrets.token_hex(16); a = str(ai).replace("$", "")[:120]
    _q(f"""insert into etp.ve_tay (ma, viec, camp_id, content_id, ai, het_han) values ('{ma}', '{v}', {cid if cid is not None else 'null'},
        coalesce({ct if ct is not None else 'null'}, (select content_id from etp.camp where camp_id = {cid if cid is not None else 'null'}),
                 (select content_id from etp.camp_ngoai where camp_id = {cid if cid is not None else 'null'})), $A${a}$A$, now() + interval '{VE_PHUT} minutes')""")
    return ma
def ve_hop_le(viec, camp_ids=(), content_id=None, dung=False, cho="", ma=None, loai=None):
    """người bấm (chữ ai của vé) nếu vé ETP_VE hợp lệ cho lệnh này, None nếu không. dung=True: đốt vé (cửa API, lúc gửi). loai='truc_tiep': chỉ vé lệnh trực tiếp."""
    ma, v = _ma_ve(ma), VE_VIEC.get(viec)
    if not ma or not v: return None
    ids = sorted({int(x) for x in camp_ids or () if str(x).isdigit()})
    khop = " or ".join(([f"camp_id in ({','.join(map(str, ids))})"] if ids else []) + ([f"content_id = {int(content_id)}"] if content_id not in (None, "") else [])) or "false"
    dk = f"ma = '{ma}' and viec = '{v}' and da_dung is null and het_han > now() and loai in ('tay', 'truc_tiep') and ({khop})" + (" and loai = 'truc_tiep'" if loai == "truc_tiep" else "")
    try:
        if dung: return _q(f"update etp.ve_tay set da_dung = now(), dung_cho = $C${str(cho).replace('$', '')[:200]}$C$ where {dk} returning ai") or None
        return _q(f"select ai from etp.ve_tay where {dk}") or None
    except Exception: return None

# LỆNH TRỰC TIẾP CỦA ANH (anh 20/11/2026 09:35 VN, nguyên văn: "Không PHANH nào được hạn chế quyền trực tiếp từ tao cả. Sửa lại ngay lập tức. Các camp do tao yêu cầu
# thì đánh dấu là Trực tiếp !! PHANH chỉ được cảnh báo thêm 1 lần trước khi bắt buộc phải thực hiện mọi yêu cầu của tao") — THAY phần "lệnh chat không miễn phanh" (18/11).
# Vé loai 'truc_tiep' chỉ cấp từ CLI `cong.py --ve-truc-tiep` (gop-y-luat.mjs giữ danh sách nơi gọi VE_TRUC_TIEP_XIN — máy luật / worker / dòng phim / kỹ sư máy KHÔNG gọi),
# mỗi vé ghi nguyên văn câu lệnh + phiên + MỘT dòng Telegram. Miễn MỌI phanh (phanh chợ + báo sớm + rút chợ, bảo trì, khung giờ, nhịp 24 giờ, trần camp test / phim,
# trần camp mới / ngày, nắp ROI 3 ngày, tran_camp, trần $30, ngân sách ROAS ngoài $15–20, camp mới $1); KHÔNG miễn: phim cấm, camp đội (camp_ngoai), giới hạn của Ethopex / Meta.
# + nút etp2 ▶ Lên / 🕒 đổi giờ (anh 22/11/2026 "nút bấm Lên ngay = Tao ra lệnh sao phải xin mày ?"): anh bấm = lệnh trực tiếp, vỏ gọi apps/etp2/src/lib/etp-ve.ts xinVeTrucTiep
VE_TRUC_TIEP_XIN = ("apps/etp/cong.py", "apps/etp2/src/lib/etp-ve.ts")   # CLI của chính tệp này (Claude gõ theo câu anh trong chat) + nút anh bấm trên etp2
CANH_BAO_PHUT = int(_BL["mot_cua"]["truc_tiep"]["canh_bao_phut"])   # sổ luật mot_cua.truc_tiep (30 phút)
def truc_tiep(viec, camp_ids=(), content_id=None, ma=None):
    """chữ ai của vé TRỰC TIẾP hợp lệ cho lệnh này (chưa đốt) | None — mọi chỗ phanh hỏi hàm này để miễn"""
    return ve_hop_le(viec, camp_ids, content_id, ma=ma, loai="truc_tiep")
SQL_TRUC_TIEP_24H = "select camp_id from etp.ve_tay where loai = 'truc_tiep' and da_dung > now() - interval '24 hours' and camp_id is not null"
def camp_truc_tiep_24h(q=None):
    """camp vừa được anh lệnh trực tiếp (vé đã dùng) trong 24 giờ — máy luật không hạ / tắt lại (trừ phim cấm)"""
    try: return {int(x) for x in (q or _q)(SQL_TRUC_TIEP_24H).split() if x.isdigit()}
    except Exception: return set()
def ve_truc_tiep(viec, camp_id=None, content_id=None, lenh="", ns=None, phien="", ngay=False):
    """CLI --ve-truc-tiep: lần đầu có phanh → (None, [câu phanh]) + ghi dấu đã cảnh báo; gọi lại trong CANH_BAO_PHUT phút (hoặc không phanh) → (mã vé, [câu phanh đã bỏ qua])."""
    import secrets
    v = VE_VIEC.get(viec)
    if not v: raise ValueError(f"vé không cho việc '{viec}' (chỉ {sorted(VE_VIEC)})")
    cid = int(camp_id) if camp_id not in (None, "", "-") else None; ct = int(content_id) if content_id not in (None, "", "-") else None
    if cid is None and ct is None: raise ValueError("vé phải gắn --camp hoặc --phim")
    lenh = str(lenh or "").replace("$", "").strip()
    if len(lenh) < 4: raise ValueError("vé trực tiếp phải ghi NGUYÊN VĂN câu lệnh của anh (--lenh)")
    # NHÂN BẢN camp đội sang tài khoản nhà (anh 23/11/2026 "lên camp giống của đội thì liên quan gì đến mấy luật kia"): camp đội KHÔNG bị đụng, bản mới nằm ở nhà → được cấp vé
    if cid is not None and viec != "nhan_ban" and _q(f"select 1 from etp.camp_ngoai where camp_id = {cid}") == "1": raise ValueError(f"camp #{cid} là camp đội (camp_ngoai) — lệnh trực tiếp chỉ cho tài khoản nhà")
    ly_cam = phim_cam([cid] if cid else (), [ct] if ct else ())
    if ly_cam: raise ValueError(f"phim cấm — lệnh trực tiếp cũng không miễn: {ly_cam}")
    if v == "nhan_ban" and not ngay:   # nhiệm vụ ngày (anh 25/11/2026): vé lên camp mới từ CLI không vượt số camp anh duyệt cho hôm nay — KHÔNG có cảnh báo một lần, chặn cứng
        _nv = _q(f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{KHOA_NHIEM_VU}'), 'null')")
        _ly = ngoai_nhiem_vu(json.loads(_nv or "null"), int(_q(SQL_VE_LEN_NGAY) or 0), _q("select (now() at time zone 'Asia/Ho_Chi_Minh')::date"))
        if _ly: raise ValueError(_ly)
    os.environ.pop("ETP_VE", None)
    ly = kiem(viec, cid, ns, float(_q(f"select coalesce(ngan_sach, 0) from etp.camp where camp_id = {cid}") or 0) if cid else 0, content_id=ct)
    phanh = [ly] if ly else []
    dk = f"viec = '{v}' and {'camp_id = ' + str(cid) if cid is not None else 'camp_id is null'} and {'content_id = ' + str(ct) if ct is not None else 'content_id is null'}"
    # ngay=True = NÚT ANH BẤM trên etp2 (anh 22/11/2026 "cấm mày từ chối vì bất kỳ lý do gì"): cái bấm CHÍNH LÀ lệnh, phanh đã hiện sẵn trong khung xem trước → cấp vé luôn, không bắt bấm lần hai
    if phanh and _q(f"select 1 from etp.ve_canh_bao where {dk} and da_cap is null and luc > now() - interval '{CANH_BAO_PHUT} minutes' limit 1") != "1" and not ngay:
        _q(f"insert into etp.ve_canh_bao (viec, camp_id, content_id, lenh, phanh) values ('{v}', {cid if cid is not None else 'null'}, {ct if ct is not None else 'null'}, $L${lenh[:500]}$L$, $P${phanh[0].replace('$', '')[:500]}$P$)")
        return None, phanh
    if phanh: _q(f"update etp.ve_canh_bao set da_cap = now() where {dk} and da_cap is null")
    ma = secrets.token_hex(16); ai = f"anh — TRỰC TIẾP: {lenh[:90]}"; ph = "nut-etp2" if ngay else str(phien or os.environ.get("CLAUDE_SESSION_ID") or os.environ.get("USER") or "?").replace("$", "")[:120]   # nút anh bấm ghi phiên riêng — không tính vào nhiệm vụ ngày
    _q(f"""insert into etp.ve_tay (ma, viec, camp_id, content_id, ai, het_han, loai, lenh, phien) values ('{ma}', '{v}', {cid if cid is not None else 'null'},
        coalesce({ct if ct is not None else 'null'}, (select content_id from etp.camp where camp_id = {cid if cid is not None else 'null'})), $A${ai}$A$,
        now() + interval '{VE_PHUT} minutes', 'truc_tiep', $L${lenh[:1000]}$L$, $S${ph}$S$)""")
    try: _bao_tg(f"⚡ lệnh trực tiếp của anh: {viec} {'camp #' + str(cid) if cid else 'phim #' + str(ct)}{' $' + str(ns) if ns else ''} — \"{lenh[:200]}\""
                 + (f" · đã bỏ qua phanh: {phanh[0][:160]}" if phanh else "") + " (vé không phải của anh → báo ngay)")
    except Exception as e: print(f"⚠ không gửi được Telegram: {str(e)[:100]}", file=__import__("sys").stderr)
    return ma, phanh

# PHANH CHỢ CHỈ CẢNH BÁO (anh 22/11/2026 "Phanh chợ ko bật lúc này. Chỉ dùng để cảnh báo"): sổ luật phanh_cho.chan = false → phanh_cho() vẫn ra câu cảnh báo cho trang / thẻ,
# nhưng MỌI chỗ CHẶN (chan_cua, phanh_sx nấc rút, luat-ethopex bỏ khỏi danh sách tăng / rút CX) đọc PC_CHAN trước khi chặn.
PC_CHAN = bool(_BL["phanh_cho"].get("chan", True))
# LUẬT CŨ DỪNG HẲN (anh 22/11/2026, sổ luật luat_cu): luật máy lên camp mới / nhân bản / thử phim có từ trước LUAT_CU_MOC dừng hoàn toàn — chỉ lệnh từ mốc trở đi qua cổng
_LC = _BL.get("luat_cu") or {}
LUAT_CU_DUNG, LUAT_CU_MOC = bool(_LC.get("dung")), str(_LC.get("moc") or "2026-11-20")
LY_LUAT_CU = f"LUẬT CŨ DỪNG: luật máy thử phim / lên camp mới có từ trước {LUAT_CU_MOC[8:10]}/{LUAT_CU_MOC[5:7]} dừng hẳn (anh 22/11/2026) — chỉ lệnh mới của anh (vé trực tiếp / nút etp2 / hàng lệnh chờ) được lên"
# NGUỒN LỆNH MỚI (từ LUAT_CU_MOC trở đi): lenh_cho = hàng lệnh chờ của anh (20/11 lenh_cho + 22/11 len_cr_roas, apps/etp/lenh_cho.chay_script đặt);
# roas_doi = nhân đôi ★ ROAS lãi qua đêm (anh 22/11/2026 "Làm luôn", apps/etp/roas_doi.nb đặt)
NGUON_MOI = ("lenh_cho", "roas_doi")
NGUON_MOI += ("luot2",)   # luot2 = lượt 2 cho creative RS tắt (anh 26/11/2026, apps/etp/luot2.nb đặt)
# LƯỢT 2 (anh 26/11/2026: "Các creative này sẽ được lên camp mới ở khung giờ 22h tiếp ngay sau đó với kiểu lên camp còn lại … Hãy tạo tiếp rule này"):
# luật anh lệnh đích danh → cổng "chỉ lên theo lệnh" mở cho ĐÚNG phim đang có dòng sổ etp.luot2 tt 'dang' và chỉ khi tiến trình do luot2.py gọi; đọc sổ lỗi = không mở.
def luot2_dang(cts, q=None):
    if os.environ.get("ETP_NGUON") != "luot2": return False
    try:
        ds = [int(c) for c in cts if c]
        return bool(ds) and all((q or _q)(f"select count(*) from etp.luot2 where content_id = {c} and tt = 'dang'") not in ("", "0") for c in ds)
    except Exception: return False
# CAMP RS TẮT KHÔNG BẬT LẠI (anh 26/11/2026 "Ko đc bật lại camp đã tắt kia"): camp máy tắt theo luật RS → mọi đường bật (máy, lịch giờ, nút có vé thường) bị chặn;
# chỉ vé LỆNH TRỰC TIẾP của anh qua (đã cảnh báo một lần lúc cấp vé)
SQL_RS_TAT = "select camp_id from etp.nhat_ky where viec = 'tat' and ok and luat like 'RS %' and camp_id is not null"
LY_RS_TAT = "camp tắt theo luật RS — không bật lại (anh 26/11/2026 \"Ko đc bật lại camp đã tắt kia\"); creative của nó lên lượt 2 ở camp mới (apps/etp/luot2.py)"
def luat_cu_chan(viec, camp_ids=(), content_id=None):
    """LY_LUAT_CU nếu việc lên camp mới này đến từ luật máy cũ (trước LUAT_CU_MOC) | None — lệnh mới = vé ETP_VE hợp lệ (trực tiếp / anh bấm) hoặc hàng lệnh chờ lenh_cho"""
    if not LUAT_CU_DUNG or viec not in ("tao_camp", "nhan_ban"): return None
    if os.environ.get("ETP_NGUON") in NGUON_MOI: return None   # luật / lệnh anh ra từ mốc trở đi — mỗi máy tự đặt ETP_NGUON khi gọi nhan-ban
    if ve_hop_le(viec, camp_ids, content_id) or truc_tiep(viec, camp_ids, content_id): return None
    return LY_LUAT_CU
def phanh_cho(tt, viec, bay_gio=None, thay=False):
    """hàm thuần: trạng thái etp.cau_hinh.phanh_cho + việc → câu lý do chặn | None (miễn trừ ROAS / lệnh anh / ngoài do kiem() xét)"""
    pc = (tt or {}).get("phanh") or {}; bay = (bay_gio or dt.datetime.now(dt.timezone.utc)).isoformat()
    vn = lambda s: f"{dt.datetime.fromisoformat(s) + dt.timedelta(hours=7):%H:%M %d/%m}"
    if viec == "tang" and (pc.get("den_tang") or "") > bay: return f"PHANH CHỢ: không tăng bậc tới {vn(pc['den_tang'])} giờ VN — {pc.get('ly_do')} (sổ luật phanh_cho)"
    if viec in ("tao_camp", "nhan_ban") and not thay and (pc.get("den_len") or "") > bay: return f"PHANH CHỢ: không tạo camp mới / nhân bản tới {vn(pc['den_len'])} giờ VN — {pc.get('ly_do')} (sổ luật phanh_cho)"
    # ba nấc cảnh báo sớm (anh 17/11/2026, gia_adsense.xet_som): giá 6 giờ trượt · ROI sáng kém nền → phanh cả tăng lẫn camp mới / nhân bản
    if viec == "tang" or (viec in ("tao_camp", "nhan_ban") and not thay):
        g6, rs = (tt or {}).get("gia6") or {}, (tt or {}).get("roi_sang") or {}
        if (g6.get("den") or "") > bay: return f"PHANH CHỢ (báo sớm): giá chợ 6 giờ gần nhất {float(g6.get('ti') or 0) * 100:.0f}% mức thường — dừng mở rộng tới khi giá về lại (sổ luật phanh_cho.truot)"
        if (rs.get("den") or "") > bay: return f"PHANH MỞ RỘNG: ROI sáng {float(rs.get('roi') or 0):+.0f}%, kém nền {abs(float(rs.get('kem') or 0)):.0f} điểm — dừng mở rộng tới {vn(rs['den'])} giờ VN (sổ luật phanh_cho.roi_sang)"
    return None

def doc_cau_hinh():
    """etp.cau_hinh {khoá: giá trị JSON} — lỗi đọc thì ném (người gọi chặn cho an toàn)"""
    return {k: json.loads(v) for k, v in (l.split("|", 1) for l in _q("select khoa, gia_tri::text from etp.cau_hinh").splitlines() if l)}

LY_DUNG_KHAN = "ĐANG DỪNG KHẨN (etp.cau_hinh.dung_khan) — không tăng / bật / nhân bản / tạo camp"
# CHỈ LÊN CAMP MỚI THEO LỆNH ANH (anh 25/11/2026 "rà xem còn cái gì tự sinh camp mới ngoài kế hoạch ko để tắt cho triệt để … Chỉ lên camp mới nếu cần !!"):
# etp.cau_hinh.chi_len_theo_lenh = true → MỌI đường máy tạo camp mới / nhân bản (nhân đôi ★ ROAS qua đêm roas_doi, hàng lệnh chờ phanh nhả lenh_cho, bước camp dòng phim,
# hoi_cho, nuoi_bo, ab_mau, luật nhân bản theo nấc, thay bài bị từ chối, len-sau-cham, thu-vien-len, dot-phim-moi…) bị chặn ở chan_cua — một hàm cho kiem() và cửa API.
# Chỉ qua: vé lệnh trực tiếp (cong.py --ve-truc-tiep / nút ▶ Lên etp2) và vé tay của nút anh bấm. Bật / tăng / giảm / tắt camp đang có không đổi. Gỡ: đặt false.
KHOA_CHI_LENH = "chi_len_theo_lenh"
LY_CHI_LENH = "CHỈ LÊN CAMP MỚI THEO LỆNH ANH (etp.cau_hinh.chi_len_theo_lenh, anh 25/11/2026) — máy không tự tạo camp / nhân bản; lệnh trực tiếp hoặc nút anh bấm mới lên"
# NHIỆM VỤ NGÀY (anh 25/11/2026 01:2x "CẤM TỰ LÊN NGOÀI NHIỆM VỤ HÔM NAY"): một phiên Claude tự cấp 72 vé trực tiếp nhân bản cho cả danh sách camp (/tmp/thay-loat.sh)
# → Telegram báo nhân bản liên tục. Vé trực tiếp lên camp mới gõ từ CLI (không phải nút anh bấm trên etp2) chỉ cấp trong số camp của etp.cau_hinh.nhiem_vu_ngay
# {ngay: 'YYYY-MM-DD' giờ VN, so_camp: N, ly_do} của ĐÚNG ngày hôm nay; không có nhiệm vụ ngày nay = 0 vé. Mỗi lần ghi nhiệm vụ phải là câu anh duyệt trong chat.
KHOA_NHIEM_VU = "nhiem_vu_ngay"
SQL_VE_LEN_NGAY = ("select count(*) from etp.ve_tay where loai = 'truc_tiep' and viec = 'nhan_ban' and coalesce(phien, '') <> 'nut-etp2'"
                   " and (tao at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date"
                   # trần nhiệm vụ đếm CAMP, không đếm lần xin vé: vé hết hạn chưa dùng không lên camp nào → không ăn trần (26/11/2026: 18 vé cấp mà 12 camp, 6 vé bỏ không chặn 6 camp còn lại của nhiệm vụ)
                   " and (da_dung is not null or het_han > now())")
def ngoai_nhiem_vu(nv, da_cap, hom_nay):
    """hàm thuần: nhiệm vụ ngày (dict | None) + số vé lên camp đã cấp hôm nay + ngày VN 'YYYY-MM-DD' → câu chặn | None"""
    nv = nv if isinstance(nv, dict) else {}
    if str(nv.get("ngay") or "") != hom_nay:
        return f"NGOÀI NHIỆM VỤ HÔM NAY: chưa có nhiệm vụ lên camp cho ngày {hom_nay[8:10]}/{hom_nay[5:7]} (etp.cau_hinh.{KHOA_NHIEM_VU}) — anh 25/11/2026 cấm tự lên ngoài nhiệm vụ"
    tran = int(nv.get("so_camp") or 0)
    if da_cap >= tran:
        return f"NGOÀI NHIỆM VỤ HÔM NAY: đã cấp {da_cap}/{tran} vé lên camp của nhiệm vụ '{str(nv.get('ly_do') or '')[:80]}' — thêm camp phải anh duyệt nhiệm vụ mới"
    return None
# PHIM CẤM (anh 19/11/2026, Ethopex báo 10:07 "Number One, Nobody" 94344 + 143938 và "Me and Six Girls Against the Apocalypse" 173160 dính vi phạm: "tắt hết, KHÔNG lên mới,
# KHÔNG bật lại, kể cả ★ ROAS"): phim trong sổ studio xv_khoa_ngoai ten='ethopex_phim_cam' ({content_id: {ly_do, luc}} — cùng sổ cấm 18+ của kiem-phim-18.py) → MỌI việc
# tăng chi (tạo camp, nhân bản, ★ ROAS, bật lại kể cả lịch giờ, tăng) của camp / phim đó bị chặn ở chan_cua — kiem() lẫn cửa API (ethopex_api.cua) — KHÔNG miễn vé tay,
# KHÔNG miễn lịch giờ, KHÔNG miễn thay bài bị từ chối: phim cấm vì vi phạm nền tảng, chỉ gỡ khỏi sổ mới mở. Trước 19/11 sổ này chỉ được lộ trình / dòng phim / Mạnh /
# chọn phim mới đọc → ★ ROAS, nhân bản, hồi chợ, AT, lịch giờ bật lại, sua-ngoai, nút anh bấm vẫn lên / bật được phim cấm.
# Phim của lệnh đọc từ CHÍNH lệnh (content_id trong ad) + camp được bật / camp gốc (etp.camp, etp.camp_ngoai). Lỗi đọc sổ → CHẶN (an toàn trước).
KHOA_PHIM_CAM = "ethopex_phim_cam"
SQL_CAMP_PHIM_CAM = (f"select c.camp_id from (select camp_id, content_id from etp.camp union all select camp_id, content_id from etp.camp_ngoai) c join xv_khoa_ngoai k"
                     f" on k.ten = '{KHOA_PHIM_CAM}' and jsonb_typeof(k.gia_tri) = 'object' and c.content_id is not null and k.gia_tri ? c.content_id::text")
LY_PHIM_CAM = ("phim #{0} trong sổ cấm {1} ({2}) — không tạo / nhân bản / bật lại / tăng camp nào của phim này, kể cả ★ ROAS, kể cả vé tay, kể cả lịch giờ "
               "(anh 19/11/2026); chỉ gỡ phim khỏi sổ mới mở")
def phim_cam(camp_ids=(), cts=(), q=None):
    """lý do chặn | None: phim của lệnh (cts) hoặc của camp (camp_ids — camp được bật / tăng / camp gốc nhân bản) nằm trong sổ ethopex_phim_cam. Lỗi đọc → chặn."""
    ids = sorted({int(x) for x in camp_ids or () if str(x).strip().isdigit()}); ct = sorted({int(x) for x in cts or () if str(x).strip().isdigit()})
    if not ids and not ct: return None
    phan = ([f"select unnest(array[{','.join(map(str, ct))}]::int[]) c"] if ct else []) + \
           ([f"select content_id c from etp.camp where camp_id in ({','.join(map(str, ids))})", f"select content_id c from etp.camp_ngoai where camp_id in ({','.join(map(str, ids))})"] if ids else [])   # cột tên c ở MỌI nhánh: lệnh chỉ có camp (bật / tăng) thì nhánh đầu là etp.camp
    try:
        r = (q or _q)(f"""select x.c || '|' || coalesce(k.gia_tri->(x.c::text)->>'ly_do', 'cấm') from ({' union '.join(phan)}) x, xv_khoa_ngoai k
            where k.ten = '{KHOA_PHIM_CAM}' and jsonb_typeof(k.gia_tri) = 'object' and x.c is not null and k.gia_tri ? x.c::text order by 1 limit 1""")
    except Exception as e: return f"không đọc được sổ phim cấm {KHOA_PHIM_CAM} ({str(e)[:80]}) — chặn cho an toàn"
    r = (r or "").strip().splitlines()
    if not r or "|" not in r[0]: return None
    c, ly = r[0].split("|", 1)
    return LY_PHIM_CAM.format(c, KHOA_PHIM_CAM, ly[:160])
# MÁY QUÉT PHIM CẤM (anh 20/11/2026 01:10 "fix triệt để các phim cấm là ko đc bật !! Tắt, xoá,... mọi thứ ngay"): cổng phim_cam chỉ chặn lệnh ĐI QUA cổng — camp bị bật
# ngoài cổng (bấm thẳng web Ethopex, hẹn giờ cũ, lỗi máy) chạy mãi không ai tắt, phim MỚI vào sổ thì dòng phim / thay bài / hàng chờ của nó vẫn sống. don_phim_cam chạy MỖI
# lượt etp-dong-bo (dong-bo.py, ngay sau bước đồng bộ camp — trạng thái tươi): (a) camp NHÀ (CHỈ etp.camp, trừ mọi camp_id có trong etp.camp_ngoai — anh 19/11 "Chỉ tắt
# phía nhà thôi") của phim cấm đang ACTIVE hoặc còn lịch giờ bật lại (etp.lich_tat) → tat-loat --ep --bo-cam-bien ngay (kể cả ★ ROAS, không chờ khung giờ, không qua
# lich_tat; tat_loat tự gỡ dòng lich_tat của camp đã dừng); (b) dòng phim chay / dung / loi → huy, thay bài chay → huy, việc cắt chờ → huy, mở rộng them / cho_do → khong
# (đổi trạng thái + lý do, KHÔNG xoá dòng); (c) có làm gì → MỘT tin Telegram chủ đề Ethopex, không có gì → im. Chỉ TẮT / huỷ, không bật / tăng / tạo gì.
LY_DON = "phim trong sổ cấm (ethopex_phim_cam) — máy quét phim cấm tự huỷ (anh 20/11/2026)"
LUAT_DON = "phim cấm: tự tắt camp bị bật ngoài cổng (sổ ethopex_phim_cam, anh 20/11/2026)"
AI_DON = "anh (lệnh 20/11/2026 01:10: phim cấm tắt ngay — máy quét phim cấm)"
def _cam_join(bang, so="xv_khoa_ngoai"):
    return (f"join {so} k on k.ten = '{KHOA_PHIM_CAM}' and jsonb_typeof(k.gia_tri) = 'object' and {bang}.content_id is not null and k.gia_tri ? {bang}.content_id::text")
def sql_don_camp(camp="etp.camp", ngoai="etp.camp_ngoai", lich="etp.lich_tat", so="xv_khoa_ngoai"):
    """camp nhà phim cấm cần tắt: 'camp_id|content_id|trạng thái|đổi lúc VN|tên|lý do sổ' — tham số bảng để tự kiểm chạy đúng câu này trên bảng giả (CTE)"""
    return (f"select c.camp_id || '|' || c.content_id || '|' || coalesce(c.trang_thai, '') || '|' || coalesce(to_char(c.cap_nhat_etp at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'), '?')"
            f" || '|' || replace(coalesce(c.ten, ''), '|', '/') || '|' || replace(coalesce(k.gia_tri->(c.content_id::text)->>'ly_do', 'cấm'), '|', '/')"
            f" from {camp} c {_cam_join('c', so)} where (c.trang_thai = 'ACTIVE' or c.camp_id in (select camp_id from {lich}))"
            f" and c.camp_id not in (select camp_id from {ngoai} where camp_id is not null) order by c.camp_id")
# (bảng, cột trạng thái, trạng thái sống → trạng thái mới, cột lý do) — đổi trạng thái kèm lý do, giữ dòng
HUY_PHIM_CAM = (("etp.dong_phim", "trang_thai", ("chay", "dung", "loi"), "huy", "ly_do", "id"),
                ("etp.thay_the", "buoc", ("chay",), "huy", "ghi", "id"),
                ("etp.viec", "trang_thai", ("cho",), "huy", "loi", "id"),
                ("etp.mo_rong", "trang_thai", ("them", "cho_do"), "khong", "ly", "content_id"))
def _bao_tg(chu):
    import importlib.util as iu
    s = iu.spec_from_file_location("lich_gio", os.path.join(os.path.dirname(os.path.abspath(__file__)), "lich-gio.py")); m = iu.module_from_spec(s); s.loader.exec_module(m)
    m.bao_tg(chu)
def don_phim_cam(lam=True, q=None, tat=None, bao=None):
    """→ {"tat": [dòng camp], "da_tat": [...], "chua": {...}, "huy": {bảng: [(khoá, phim)]}}. lam=False: chỉ đọc (không tắt, không huỷ, không báo). Lỗi đọc sổ → ném."""
    import html, sys
    q = q or _q
    camps = [dict(zip(("camp_id", "ct", "tt", "luc", "ten", "ly"), l.split("|", 5))) for l in (q(sql_don_camp()) or "").splitlines() if l.count("|") >= 5]
    kq = {"tat": camps, "da_tat": [], "chua": {}, "huy": {}}
    for bang, cot, song, moi, ly, khoa in HUY_PHIM_CAM:
        dk = (f"x.{cot} in ({','.join(repr(x) for x in song)}) and x.content_id is not null and exists (select 1 from xv_khoa_ngoai k where k.ten = '{KHOA_PHIM_CAM}'"
              f" and jsonb_typeof(k.gia_tri) = 'object' and k.gia_tri ? x.content_id::text)")
        if lam: s = f"update {bang} x set {cot} = '{moi}', {ly} = '{LY_DON}' || coalesce(' · trước: ' || x.{ly}, '') where {dk} returning x.{khoa} || '|' || x.content_id"
        else: s = f"select x.{khoa} || '|' || x.content_id from {bang} x where {dk}"
        kq["huy"][bang] = [tuple(l.split("|", 1)) for l in (q(s) or "").splitlines() if "|" in l]
    if not lam: return kq
    if camps:
        ids = ",".join(c["camp_id"] for c in camps)
        r = (tat or (lambda ids: subprocess.run(["python3", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "lam-ethopex.py"),
                                                 "tat-loat", ids, "--ep", "--bo-cam-bien", "--luat", LUAT_DON, "--ai", AI_DON], capture_output=True, text=True, timeout=300)))(ids)
        try: j = json.loads((r.stdout or "").strip().splitlines()[-1])
        except Exception: j = {"loi": (r.stderr or r.stdout or "")[-300:]}
        kq["da_tat"] = [str(x) for x in j.get("da_tat", []) + j.get("lich", [])]
        kq["chua"] = {str(c): "đã gửi lệnh tắt, Ethopex chưa áp" for c in j.get("chua", [])} | {str(c): str(v) for c, v in (j.get("giu") or {}).items()}
        if j.get("loi"): kq["chua"] |= {c["camp_id"]: f"lệnh tắt lỗi: {j['loi']}" for c in camps if c["camp_id"] not in kq["da_tat"]}
    so_huy = sum(len(v) for v in kq["huy"].values())
    if camps or so_huy:
        e = html.escape; d = ["🚫 <b>MÁY QUÉT PHIM CẤM</b> (sổ ethopex_phim_cam — anh 20/11/2026: phim cấm không được chạy)"]
        for c in camps:
            d.append(f"• camp #{c['camp_id']} {e(c['ten'][:60])} · phim #{c['ct']} · {c['tt'] or '?'}" + (" (còn lịch bật lại)" if c["tt"] != "ACTIVE" else f" từ ~{c['luc']} VN")
                     + (" → ĐÃ TẮT" if c["camp_id"] in kq["da_tat"] else f" → CHƯA TẮT: {e(kq['chua'].get(c['camp_id'], 'không rõ'))[:160]}"))
        ten = {"etp.dong_phim": "dòng phim", "etp.thay_the": "việc thay bài", "etp.viec": "việc cắt chờ", "etp.mo_rong": "đề xuất mở rộng"}
        for bang, v in kq["huy"].items():
            if v: d.append(f"• huỷ {len(v)} {ten[bang]} · phim " + ", ".join(sorted({f'#{p}' for _, p in v})[:12]))
        try: (bao or _bao_tg)("\n".join(d))
        except Exception as x: print(f"báo Telegram lỗi: {x}", file=sys.stderr)
    return kq
# PHIM CHỈ SẢN XUẤT (anh 20/11/2026 "chỉ sx" — thêm American Sniper vào từng dạng để soát cách máy sinh creative, KHÔNG lên camp): sổ etp.cau_hinh.phim_chi_sx
# {content_id: {ly_do, luc, ai}} → máy vẫn cắt / dựng / chấm creative của phim, nhưng MỌI đường máy tạo camp MỚI từ creative (tao_camp: dòng phim, kho chờ lên, máy dựng theo
# mẫu, nuôi bộ) bị chặn ở chan_cua — một hàm cho kiem() và cửa API. Anh bấm tay (vé) / lệnh trực tiếp vẫn lên được; nhân bản / tăng / bật camp đang có không đổi.
# Dòng phim: bước sản xuất không chờ phanh chợ, tới bước camp thì khép dòng (dong_phim.vong). Gỡ: xoá khoá phim khỏi sổ. Lỗi đọc → chặn.
KHOA_CHI_SX = "phim_chi_sx"
LY_CHI_SX = "phim #{0} CHỈ SẢN XUẤT (etp.cau_hinh.phim_chi_sx: {1}) — máy dựng + chấm creative, không tự lên camp; anh bấm tay / lệnh trực tiếp vẫn lên được"
def ds_chi_sx(q=None):
    """{content_id: lý do} của sổ phim chỉ sản xuất — lỗi đọc thì NÉM (người gọi quyết: cổng chặn, dòng phim chạy như cũ + cổng vẫn chặn)"""
    r = (q or _q)(f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{KHOA_CHI_SX}' and jsonb_typeof(gia_tri) = 'object'), '{{}}')")
    return {int(k): str((v or {}).get("ly_do") or "chỉ sản xuất") if isinstance(v, dict) else "chỉ sản xuất" for k, v in json.loads(r or "{}").items() if str(k).isdigit()}
def phim_chi_sx(cts=(), q=None):
    """lý do chặn | None: phim của lệnh nằm trong sổ phim_chi_sx. Lỗi đọc → chặn."""
    ct = sorted({int(x) for x in cts or () if str(x).strip().isdigit()})
    if not ct: return None
    try: so = ds_chi_sx(q)
    except Exception as e: return f"không đọc được sổ {KHOA_CHI_SX} ({str(e)[:80]}) — chặn cho an toàn"
    return next((LY_CHI_SX.format(c, so[c][:120]) for c in ct if c in so), None)
def chan_cua(viec, ch, camp_id=None, thay=False, ve=False, lich=False, cts=(), goc=None, q=None, tt=False):
    """PHẦN CỔNG KHÔNG TIN LỜI NGƯỜI GỌI (anh 18/11/2026) — một hàm cho kiem() và cửa API (ethopex_api.api, đọc dữ kiện từ chính lệnh gửi đi):
    dừng khẩn · camp ít nước / lô team tắt không bật lại · Ethopex bảo trì lên camp · PHANH CHỢ. ch = etp.cau_hinh {khoá: giá trị}.
    ve = vé thao tác tay hợp lệ (ve_hop_le) — thứ DUY NHẤT miễn phanh / bảo trì. ANH CHỐT 18/11/2026: trong phanh chợ máy KHÔNG còn được miễn ở ★ ROAS
    (tự lên ROAS, tăng ROAS), camp đội chạy Luật tự động, lệnh chat — chỉ thao tác tay có vé. thay = camp thay bài bị Meta từ chối (thay chỗ, không thêm chi).
    lich = bật lại camp tạm dừng theo LỊCH GIỜ (etp.lich_tat, apps/etp/lich-gio.py): việc hợp lệ, chỉ dừng khẩn + phim cấm chặn.
    cts = phim trong chính lệnh, goc = camp gốc (nhân bản / ROAS) — cùng camp_id dùng để soát sổ phim cấm (phim_cam), đứng trước mọi miễn trừ (vé, lịch, thay)."""
    if viec not in TANG: return None
    ly_cam = phim_cam([x for x in (camp_id, goc) if x], cts, q=q)
    if ly_cam: return ly_cam
    # tt = vé LỆNH TRỰC TIẾP của anh (anh 20/11/2026 09:35): miễn dừng khẩn / ít nước / bảo trì / phanh chợ — đã cảnh báo một lần lúc cấp vé (cong.py --ve-truc-tiep)
    if tt: return None
    if viec == "bat" and camp_id and str(int(camp_id)) in (q or _q)(SQL_RS_TAT).split(): return LY_RS_TAT   # trước miễn lịch giờ / vé thường
    if ch.get(KHOA_CHI_LENH) and luot2_dang(cts, q): ch = {**ch, KHOA_CHI_LENH: False}   # lượt 2 = luật anh lệnh đích danh 26/11/2026, chỉ cho phim có dòng sổ đang chờ
    if viec in ("tao_camp", "nhan_ban") and ch.get(KHOA_CHI_LENH) and not ve: return LY_CHI_LENH   # đứng trước miễn thay bài / lịch: máy không tự sinh camp mới
    if ch.get("dung_khan"): return LY_DUNG_KHAN
    if lich: return None
    if viec == "tao_camp" and not ve and (ly_sx := phim_chi_sx(cts, q=q)): return ly_sx   # phim chỉ sản xuất: máy không tạo camp mới từ creative (vé tay / lệnh trực tiếp qua)
    if viec == "bat" and camp_id and str(int(camp_id)) in _q(SQL_IT_NUOC).split(): return LY_IT_NUOC
    # ETHOPEX BẢO TRÌ LÊN CAMP (anh 17/11/2026: "bên Etho team báo là đang bảo trì việc lên camp nên sẽ dừng tạo camp mới từ giờ đến ít nhất là sáng mai + báo lại"):
    # etp.cau_hinh.bao_tri_len {bat, tu, ly_do} → MỌI đường máy tạo camp / nhân bản dừng, kể cả ★ ROAS, camp team, bản thang — đứng trước mọi miễn trừ. KHÔNG tự hết hạn:
    # chỉ tắt khi Ethopex báo lại. Anh bấm tay (có vé) vẫn gửi được (anh 16/11/2026 không chặn thao tác thủ công — Ethopex có thể tự từ chối).
    bt = ch.get("bao_tri_len") or {}
    if viec in ("tao_camp", "nhan_ban") and bt.get("bat") and not ve: return f"ETHOPEX BẢO TRÌ LÊN CAMP từ {bt.get('tu') or '?'} — dừng tạo camp / nhân bản tới khi Ethopex báo lại (etp.cau_hinh.bao_tri_len)"
    # PHANH CHỢ (anh 16/11/2026 "Làm theo đề xuất" — sổ luật phanh_cho, apps/etp/gia_adsense.py xet_phanh chốt 20h VN): không tăng bậc tới den_tang, không tạo camp / nhân bản
    # tới den_len. ANH BẤM TAY KHÔNG BỊ PHANH (anh 16/11/2026: "mày ko đc chặn với thao tác thủ công. Chỉ được cảnh báo thêm 1 lần nữa") — người bấm thật = có VÉ.
    ly_pc = phanh_cho(ch.get("phanh_cho"), viec, thay=thay)
    if ly_pc and not ve and PC_CHAN: return ly_pc
    return None

# SẢN XUẤT THEO CHỢ (anh 18/11/2026 "cứ sx rồi để đấy hay theo plan? mấy hôm nay không cho lên camp mới thì sx cũng không bật lên được" — sổ luật chung san_xuat_theo_cho):
# cổng lên camp mới của máy đang đóng → máy KHÔNG sản xuất creative cho camp mới (lộ trình không xếp dòng, dòng phim dừng trước bước tốn AI, máy chấm chỉ chấm nút anh
# + kho dự trữ hồi chợ). MỘT hàm đọc, đúng cổng chan_cua('tao_camp') không vé (dừng khẩn · Ethopex bảo trì · phanh chợ + báo sớm gia6 / roi_sang) + nấc rút (phanh_cho.rut).
# lo_trinh_phim.ghi_sx (dong-bo 10 phút) ghi kết quả vào etp.cau_hinh KHOA_SX {phanh, du_tru, kho, het} — dòng phim (iMac), Mạnh, cửa máy chấm đọc khoá đó, không đọc lại phanh.
SXC = _BL["san_xuat_theo_cho"]   # sổ luật chung
KHOA_SX = SXC["khoa"]
# điều kiện chung cho mọi đường tự mở lại dòng phim d (dong_phim.mo_tran_*, manh muc5 / muc6): phim chưa có dòng CÙNG LOẠI đang chạy — kiểm lúc đặt fix
SQL_KHONG_TRUNG = "not exists (select 1 from etp.dong_phim y where y.content_id = d.content_id and y.loai is not distinct from d.loai and y.trang_thai = 'chay' and y.id <> d.id)"
SX_PHUT = int(SXC["het_phut"])   # khoá san_xuat_cho quá hạn (dong-bo chết) → coi như không phanh (máy chạy như cũ, cổng lên camp vẫn chặn)
SQL_SX = (f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{KHOA_SX}' and (gia_tri->>'het')::timestamptz > now()), '{{}}')")
def phanh_giu_cham_doi(sx):
    """hàm thuần: khoá KHOA_SX → có giữ chấm creative ĐỘI (nguồn 'ngoai') không. Chỉ phanh CHỢ giữ; phanh "chỉ lên camp mới theo lệnh anh" (chi_len_theo_lenh)
    gác việc LÊN CAMP, chấm creative đội không lên camp nào (anh 27/11/2026: 48 creative đội đang lãi kẹt chưa nghe lời đọc vì phanh này)"""
    ph = (sx or {}).get("phanh") or ""
    return bool(ph) and not ((sx or {}).get("chi_lenh") and KHOA_CHI_LENH in ph)

def phanh_sx(ch, bay_gio=None):
    """hàm thuần: etp.cau_hinh {khoá: giá trị} → câu 'chờ phanh nhả: …' | None"""
    bay = bay_gio or dt.datetime.now(dt.timezone.utc)   # bay_gio chỉ cho nấc rút (bài tự kiểm); cổng chan_cua xét giờ hiện tại như lúc lên camp
    ly = chan_cua("tao_camp", ch or {})
    rut = ((((ch or {}).get("phanh_cho") or {}).get("rut")) or {}).get("den") or ""
    if not ly and PC_CHAN and rut > bay.isoformat(): ly = f"RÚT KHỎI CHỢ tới {dt.datetime.fromisoformat(rut) + dt.timedelta(hours=7):%H:%M %d/%m} giờ VN (sổ luật phanh_cho.rut)"
    return f"chờ phanh nhả: {ly}" if ly else None

def kiem(viec, camp_id=None, ns_moi=None, ns_cu=0, bo=None, content_id=None, ngoai=False, tay=False, roas=False, lenh_anh=False, bac=False, bai_cu=False, thay=False, anh_bam=False, goc=None):
    """anh_bam: BỎ (18/11/2026) — giữ tham số cho người gọi cũ, KHÔNG còn miễn gì; người bấm thật = vé ETP_VE (ve_hop_le). tay: chỉ còn nghĩa cũ (miễn trùng phim đội, đã bỏ)."""
    if viec not in TANG: return None
    try:
        ct = content_id if content_id is not None else (_q(f"select content_id from etp.camp where camp_id = {int(camp_id)}") or None) if camp_id else None
        # PHIM CẤM (anh 19/11/2026) — trước bước chấm nhóm gốc (tốn AI): phim / camp trong sổ ethopex_phim_cam → chặn mọi việc tăng chi, kể cả ROAS / vé / lệnh anh / ngoai
        ly_cam = phim_cam([camp_id] if camp_id else (), [ct] if ct else ())
        if ly_cam: return ly_cam
        # LỆNH TRỰC TIẾP CỦA ANH (anh 20/11/2026 09:35): vé loai 'truc_tiep' (CLI --ve-truc-tiep, đã cảnh báo một lần lúc cấp) miễn MỌI phanh phía sau — chỉ phim cấm (trên) và camp đội chặn
        # nhân bản truyền camp_id=None + goc=<camp gốc>: vé trực tiếp của nút etp2 gắn camp GỐC → khớp cả goc (25/11/2026: trước chỉ khớp camp_id → vé nhân bản tay không miễn phanh)
        if not ngoai and truc_tiep(viec, [x for x in (camp_id, goc) if x], ct): return None
        ly_lc = luat_cu_chan(viec, [camp_id] if camp_id else (), ct)   # LUẬT CŨ DỪNG (anh 22/11/2026) — luật máy trước 20/11 không lên camp mới / nhân bản nữa
        if ly_lc: return ly_lc
        ng = _q(f"select coalesce(nhom_goc, '') from etp.phim where content_id = {int(ct)}") if ct else ''
        if ct and not ng:   # KÍN (anh 29/10/2026 "làm cho kín"): phim chưa chấm → chấm poster NGAY (nhom_goc.py, ckey ~36₫/phim); không chấm được → CHẶN
            import importlib.util as _iu
            _s = _iu.spec_from_file_location("nhom_goc", os.path.join(os.path.dirname(os.path.abspath(__file__)), "nhom_goc.py")); NG = _iu.module_from_spec(_s); _s.loader.exec_module(NG)
            ng, _chi, _ly = NG.cham(int(ct))
            if not ng: return f"phim #{ct} chưa chấm được nhóm gốc ({_ly}) — chỉ lên camp phim Âu-Mỹ đã chấm (anh 29/10/2026 'làm cho kín')"
        if ng and ng != 'au_my': return LY_AU_MY.format(ng)
        ch = doc_cau_hinh()
        # NGƯỜI BẤM THẬT = VÉ (anh 18/11/2026): chỉ vé ETP_VE hợp lệ cho đúng việc + camp / phim này mới miễn phanh / bảo trì / trần camp test — không đọc chữ ai, cờ anh_bam / tay / roas
        ve = bool(ve_hop_le(viec, [camp_id] if camp_id else (), ct))
        # TRẦN TUYỆT ĐỐI $30 / CAMP (anh 14/11/2026: "Ko bao giờ tăng ngân sách vượt trần $30") — đứng trước mọi miễn trừ (ROAS, A/B, lệnh anh, bản thang):
        # không đường nào trong máy đặt một camp nhà / team quá TRAN_TUYET, kể cả khi tran_camp trong cấu hình bị sửa cao hơn
        if ns_moi is not None and float(ns_moi) > TRAN_TUYET: return f"vượt trần tuyệt đối ${TRAN_TUYET:g}/camp (anh 14/11/2026: không bao giờ vượt $30) — đang gửi ${float(ns_moi):g}"
        # DỪNG KHẨN · ÍT NƯỚC · BẢO TRÌ · PHANH CHỢ — chan_cua (cùng hàm cửa API dùng). Miễn phanh CHỈ bằng vé (anh 18/11/2026); camp thay bài bị từ chối (thay) không bị phanh.
        # Lịch sử lọt: 17/11 00:01–00:12 dòng phim máy gọi nhan-ban --tay → 91 camp; 18/11 00:46–12:51 máy AT ghi ai "anh (chat 05/11/2026: …)" → 31 camp; ★ ROAS / ngoai / lenh_anh miễn bằng cờ.
        ly_cua = chan_cua(viec, ch, camp_id, thay=thay, ve=ve, cts=[ct] if ct else ())
        if ly_cua: return ly_cua
        # HOÃN TĂNG THEO GIÁ ADSENSE: ĐÃ BỎ (anh 13/11/2026 "bỏ rule Hoãn đang áp dụng") — giá AdSense tụt không còn chặn tăng / nhân bản; máy đo giá
        # (apps/etp/gia_adsense.py) vẫn đo và vẫn bù giá cho luật cắt camp mới. Tham số thay= giữ cho người gọi cũ (nhan-ban.py --thay), không còn tác dụng.
        if viec == "tang" and not roas and (ch.get("mua_le") or {}).get("khoa_tang"):   # mùa lễ Mỹ (apps/etp/mua_le.py, anh 08/11/2026): Meta học lại đúng tuần giá cao là tốn nhất
            return f"mùa lễ Mỹ: khoá tăng bậc ({(ch.get('mua_le') or {}).get('ly_do') or '25–30/11'}) — giảm / tắt / camp mới vẫn chạy (etp.cau_hinh.mua_le, apps/etp/mua_le.py)"
        # CAMP MỚI = $1 (anh 08/11/2026: "Ai cho mày lên camp mới ngân sách hơn $1" · "AB test vẫn phải đi từ $1. Nếu khác thì phải xin phép"): tạo camp / nhân bản thường
        # (kể cả camp A/B, clone sang bộ khác) gửi ngân sách > $1 → chặn. Miễn: camp ROAS (roas=True, loại anh duyệt 26/10/2026) · bản thang (bac=True, thang nhân bản anh duyệt 25/10/2026)
        if viec in ("tao_camp", "nhan_ban") and not roas and not bac and ns_moi is not None and float(ns_moi) > NS_MOI:
            return f"camp mới bắt đầu ${NS_MOI} — đang gửi ${float(ns_moi):g} (anh 25/11/2026 \"các camp mới đều bắt đầu từ $5\"); ngân sách khác chỉ bằng nút anh bấm"
        # NẮP ROI 3 NGÀY (Dol 09/11/2026): camp thường tăng lên $X mà X > trần của dải ROI 3 ngày khép → chặn; camp ★ ROAS không áp; camp đang chạy không bị hạ (chỉ chặn tăng)
        if viec == "tang" and not roas and camp_id and ns_moi is not None and _q(f"select 1 from etp.camp c where c.camp_id = {int(camp_id)} and {sql_roas_luat('c')}") != "1":
            r3 = _q(SQL_ROI3.format(cid=int(camp_id))); r3f = float(r3) if r3 not in ("", None) else None
            try: nc = int(_q(SQL_NGAY_CHI.format(cid=int(camp_id))) or 0)
            except Exception: nc = None
            cn, tn = ((_q(SQL_NAY.format(cid=int(camp_id))) or "").split("|") + ["", ""])[:2]
            cn, tn = float(cn or 0), float(tn or 0); rn = round(100 * (tn - cn) / cn) if cn > 0 else None
            nap = nap_camp(r3f, nc, rn, tn - cn)
            if float(ns_moi) > nap:
                if nc is not None and nc < NAP_TRE_NGAY: return f"nắp camp trẻ ({nc} ngày khép · ROI hôm nay {rn if rn is not None else '—'}% · lãi ${tn - cn:.2f}) → trần ${nap:g}, không lên ${float(ns_moi):g} (thang phiên 22/11/2026: ≥50% $9 · ≥80% $13 · ≥100% + lãi ≥ $10 → $20)"
                return f"nắp ROI 3 ngày khép ({(r3 + '%') if r3 else 'chưa có số'}) → camp thường trần ${nap:g}, không lên ${float(ns_moi):g} (Dol 09/11/2026: 30–50% ~$10 · 50–80% ~$15 · >80% ~$20, anh duyệt chỉ áp lần tăng mới)"
        # anh 09/11/2026: "ngày mai chỉ lên camp kiểu ROAS nếu có camp phù hợp. Chưa lên camp mới đợi các camp âm tắt hết" → công tắc dừng chặn camp thường, MIỄN camp ROAS
        # CHỈ chặn camp MỚI $1 từ creative (tao_camp) — anh 10/11/2026 "Nhân bản camp thắng vẫn đc. Chỉ chưa cho tạo camp mới $1": nhân bản (NB, thang, ROAS, clone sang bộ) vẫn chạy
        # CHỐT 3 (apps/etp/tran_len.py, anh 11/11/2026): bộ 3 ngày đã khép ROI < −20% (chi ≥ $10) → không tạo / nhân bản camp mới VÀO bộ đó (lệnh anh trong lượt, ROAS miễn)
        if viec in ("tao_camp", "nhan_ban") and bo and not ngoai and not roas and not lenh_anh and str(bo) in ((ch.get("tran_len") or {}).get("bo_dung") or []):
            return f"bộ {bo} đang dừng nhận camp mới — 3 ngày đã khép ROI < −20% (etp.cau_hinh.tran_len.bo_dung, apps/etp/tran_len.py); mở lại khi ROI 3 ngày của bộ hồi"
        if ch.get(KHOA_DUNG_CAMP_MOI) and viec == "tao_camp" and not ngoai and not roas: return f"{LY_DUNG_CAMP_MOI} $1 từ creative (etp.cau_hinh.{KHOA_DUNG_CAMP_MOI} — anh dừng để review) — nhân bản camp thắng / tăng / giảm / tắt vẫn chạy"
        them = float(ns_moi or 1) - float(ns_cu or 0)   # camp mới / nhân bản = $1
        tc = ch.get("tran_camp")
        # A/B ROAS TĂNG $30 (anh 08/11/2026 "Camp ROAS làm thêm thử nghiệm tăng bậc <=1.5 lần đến max $30 cho 1 vài camp"): camp nhánh THỬ của lần A/B
        # kiểu roas_tang đang chạy (etp.ab + etp.camp_ab, apps/etp/ab_mau.py) được qua trần tới $30 — chỉ đúng camp đó, mọi camp khác giữ tran_camp
        if tc is not None and ns_moi is not None and float(ns_moi) > float(tc) and camp_id and float(ns_moi) <= 30 and _q(f"""select 1 from etp.camp_ab a join etp.ab b on b.ma = a.ab
                where a.camp_id = {int(camp_id)} and a.nhanh = 'thu' and a.loai_tru is null and b.kieu = 'roas_tang' and b.trang_thai = 'dang' limit 1"""): tc = 30
        if tc is not None and ns_moi is not None and float(ns_moi) > float(tc): return f"vượt trần ${tc}/camp (etp.cau_hinh.tran_camp)"
        if ngoai: return None
        # TRẦN CAMP TEST MỖI PHIM (anh 18/11/2026, sổ luật tran_test_phim — xem giu_test): mọi đường máy tạo camp / nhân bản (dòng phim, AT, len-sau-cham, nhan-ban, nuôi bộ, thang).
        # Miễn: anh bấm tay (vé) / lệnh đích danh của anh (lenh_anh) · ★ ROAS (dạng riêng, trần riêng của đợt hồi chợ) · camp thay bài bị Meta từ chối (thay: thay chỗ, không thêm)
        # Miễn thêm (anh 19/11/2026, xung đột 5): nhân bản từ camp gốc ĐÃ ĐẠT NẤC NB (mien_tran_goc) — bản nhân không tính trần, không giữ chỗ
        if CO_TRAN_TEST and ct and viec in ("tao_camp", "nhan_ban") and not ve and not lenh_anh and not roas and not thay and not (viec == "nhan_ban" and (goc or camp_id) and mien_tran_goc(goc or camp_id)):
            so_t, _on, duoc_t = giu_test(int(ct))
            if not duoc_t: return ly_tran_test(ct, so_t)
        tcm = ch.get(KHOA_TRAN_NGAY)   # TRẦN CAMP MỚI MỖI NGÀY (anh 07/11/2026 chốt 100 camp thử / ngày): đếm camp nhà tạo trong ngày VN, kể cả bản nhân
        # lenh_anh: clone SANG BỘ KHÁC theo lệnh đích danh của anh trong lượt (nhan-ban.py --bo --ep; anh 08/11/2026 "50 camp này dup luôn sang tk số 4" — bản thay
        # cho camp bộ 2 không tiêu) → không tính vào trần camp mới / ngày; mọi cổng khác giữ nguyên
        if tcm is not None and viec in ("nhan_ban", "tao_camp") and not lenh_anh and not roas:
            so, duoc = giu_cho(int(tcm))
            if not duoc: return f"hôm nay đã tạo {so} camp (kể cả camp đang tạo dở), chạm trần {tcm} camp mới / ngày (etp.cau_hinh.{KHOA_TRAN_NGAY}) — mai lên tiếp (dong_phim.mo_tran_ngay tự FIX sang ngày mới)"
        tn = ch.get("tran_ngay")
        if tn is not None:
            tong = float(_q("select coalesce(sum(ngan_sach), 0) from etp.camp where trang_thai = 'ACTIVE'") or 0)
            if tong + them > float(tn): return f"tổng ngân sách ngày ${tong:.0f} + ${them:.0f} vượt trần ${tn} (etp.cau_hinh.tran_ngay)"
        tb = (ch.get("tran_bo") or {})
        if bo is None and camp_id: bo = _q(f"select coalesce(bo, '') from etp.camp where camp_id = {int(camp_id)}") or None
        if bo and str(bo) in tb:
            tong = float(_q(f"select coalesce(sum(ngan_sach), 0) from etp.camp where trang_thai = 'ACTIVE' and bo = '{str(bo)}'") or 0)
            if tong + them > float(tb[str(bo)]): return f"bộ {bo}: ${tong:.0f} + ${them:.0f} vượt trần ${tb[str(bo)]} (etp.cau_hinh.tran_bo)"
        return None
    except Exception as e:
        return f"không đọc được rào chắn etp ({str(e)[:80]}) — chặn cho an toàn"

# CAMP ROAS (tài liệu Support 26/10/2026; anh: "Camp ROAS là 1 dạng riêng, miễn hết các luật"): nhận diện bằng TÊN — nhan-ban.py --roas luôn đặt
# "★ … roas X duplicate by <gốc>" (★ hiện ở mọi nơi có tên camp: Report Ethopex, Telegram, etp.on.tc, Ads Manager). Mọi luật / lịch giờ lọc qua đây.
# Camp ROAS do NGƯỜI TRONG TEAM tự lên (31/10/2026, kho etp.camp_ngoai): "…_D69655_ROAS1" · "…_V1_D2 (ROAS)" · "Dup by 66168 ROAS 1.1" — chữ ROAS đứng riêng
# (không có camp nhà nào khớp mẫu này, đếm 31/10/2026: 0). Không nhận thì camp ROAS của team bị chấm như camp thường (L3 / T2 tắt) và máy lên ROAS trùng gốc.
import re as _re
_ROAS_TEAM = _re.compile(r"(?:^|[\s_(])ROAS[\d.]*(?=$|[\s_)])")   # [\d.]: "ROAS1.2_S_…" (Sơn) — bản \d* cũ bỏ sót
def la_roas(x):
    """camp ROAS? x = camp (dict API / kho) hoặc tên. CHIẾN LƯỢC THẦU THẬT trước (anh 02/11/2026 — camp Kiên không đặt tên vẫn nhận):
    source_bidding_strategy / chien_luoc = LOWEST_COST_WITH_MIN_ROAS; chưa có chiến lược thì mới đọc tên. Cùng luật cột etp.*.la_roas (0401) + lib/etp-roas.ts."""
    if isinstance(x, dict):
        cl = x.get("source_bidding_strategy") or x.get("chien_luoc")
        if cl: return cl == "LOWEST_COST_WITH_MIN_ROAS"
        x = x.get("name") or x.get("ten")
    ten = x or ""
    return " duplicate by " in ten or ten.lstrip().startswith("★") or bool(_ROAS_TEAM.search(ten))
_GOC_ID = _re.compile(r"(?:duplicate by|dup by|_D)\s*(\d{5,})", _re.I)
_DUOI = _re.compile(r"(?:_D\d+)?(?:[_\s]ROAS[\d.\s]*|\s*\(ROAS\))\s*$")
def goc_roas(camps):
    """camp gốc ĐÃ CÓ camp ROAS (đọc từ tên, mọi kiểu đặt tên: nhà "duplicate by <gốc>", team "_D<gốc>" / "Dup by <gốc>", hoặc tên camp ROAS bỏ đuôi
    "_D2 (ROAS)" trùng tên gốc) → máy không lên ROAS lại cho gốc đó. camps = [{id, name}] (danh sách camp Ethopex)."""
    ro = [c.get("name") or "" for c in camps if la_roas(c)]
    ids = {int(m.group(1)) for n in ro for m in [_GOC_ID.search(n)] if m}
    goc_ten = {_DUOI.sub("", n).strip() for n in ro}
    return ids | {int(c["id"]) for c in camps if not la_roas(c) and (c.get("name") or "").strip() in goc_ten}
# CLONE CAMP ĐỘI = CAMP THƯỜNG TRƯỚC MÁY LUẬT (anh 23/11/2026 "Camp roas lên kiểu trực tiếp này sẽ áp dụng các rule kiểm soát giống camp thông thường"):
# camp nhà nhân bản từ camp của đội (tên "(nhan ban N cua <gốc>)", gốc nằm trong etp.camp_ngoai — nhan-ban.py giữ nguyên thầu MIN_ROAS của đội nên la_roas = true)
# vẫn là ★ ROAS ở thầu / hiển thị, nhưng máy luật (luat-ethopex.py tắt / giảm / tăng, lich-gio.py lịch giờ + chấm, nắp ROI 3 ngày) xét như camp thường.
# Một định nghĩa: mọi chỗ luật hỏi "camp này có miễn luật ROAS không" gọi sql_roas_luat(alias) / camp_roas() — không gõ "la_roas" trần.
def sql_clone_doi(a="c"):
    return f"exists (select 1 from etp.camp_ngoai n_ where n_.camp_id::text = substring({a}.ten from 'nhan ban [0-9]+ cua ([0-9]+)[)]'))"
def sql_roas_luat(a="c"):
    return f"(coalesce({a}.la_roas, false) and not {sql_clone_doi(a)})"
def camp_clone_doi(q=None):
    """camp nhà clone từ camp đội — máy luật xét như camp thường (lỗi đọc kho thì để nổ, người gọi ghi loi_may)"""
    return {int(x) for x in (q or _q)(f"select c.camp_id from etp.camp c where {sql_clone_doi('c')}").split() if x.isdigit()}
def camp_roas():
    """tập camp ★ ROAS máy luật miễn (đồng bộ 10 phút; trừ clone camp đội) — luật đọc API trực tiếp thì cộng la_roas(tên) rồi trừ camp_clone_doi()"""
    return {int(x) for x in _q(f"select c.camp_id from etp.camp c where {sql_roas_luat('c')}").split() if x.isdigit()}

# CAMP MỚI = $1, ĐỌC NGAY TRÊN PAYLOAD GỬI ĐI (anh 08/11/2026 "Rà ngay" sau vụ 52 camp A/B lên $3): kiem() ở trên tin số ns_moi + cờ roas/bac do NGƯỜI GỌI
# tự khai — người gọi tính sai (A/B đặt $3 vào payload sau khi cổng đã nhận "1") là lọt. Hàm này đọc CHÍNH lệnh tạo camp ở cổng API chung
# (ethopex_api.api, POST /campaigns/facebook — mọi đường tạo camp đi qua đó): mọi trường *budget* ở mọi tầng (campaign + Ad Set). Miễn theo VẬT, không theo cờ:
#   camp ROAS = chiến lược thầu LOWEST_COST_WITH_MIN_ROAS, $15–20 (Support 26/10/2026) · bản thang = tên "(thang $X cua <gốc>)", tới đúng $X (anh 25/10/2026).
# Trả (lý do chặn | None, trần ngân sách cho camp vừa tạo) — trần dùng tiếp cho lệnh đặt lại ngân sách ngay sau khi tạo (ethopex_api: camp trong _TAO).
def ns_tao(body):
    import re
    cp = (body or {}).get("campaign") or {}
    sp = cp.get("source_payload") or {}
    if isinstance(sp, str): sp = json.loads(sp or "{}")
    so = []
    def di(o):
        if isinstance(o, str) and o.strip().startswith("{"):
            try: o = json.loads(o)
            except ValueError: return
        if isinstance(o, dict):
            for k, v in o.items():
                if "budget" in k.lower() and not isinstance(v, bool) and isinstance(v, (int, float, str)) and str(v).replace(".", "", 1).isdigit(): so.append((k, float(v)))
                else: di(v)
        elif isinstance(o, list):
            for x in o: di(x)
    di(body)
    ten = str(sp.get("name") or body.get("name") or "")
    m = re.search(r"\(thang \$(\d+(?:\.\d+)?) cua \d+\)\s*$", ten)
    ads = [ad for g in (cp.get("ad_groups") or []) if isinstance(g, dict) for ad in (g.get("ads") or []) if isinstance(ad, dict)]
    bai = bool(ads) and all(str(ad.get("effective_object_story_id") or "").strip() and ad.get("creative_id") is None and ad.get("content_id") is None for ad in ads)
    if sp.get("bid_strategy") == "LOWEST_COST_WITH_MIN_ROAS": tran, loai = 20.0, "camp ROAS"
    elif m: tran, loai = float(m.group(1)), "bản thang"
    elif bai: tran, loai = float(NS_MOI), "nhân bản bài cũ"   # theo VẬT: mọi ad chỉ mang bài đăng cũ, không creative mới
    else: tran, loai = float(NS_MOI), "camp mới"
    vuot = [(k, v) for k, v in so if v > tran]
    if vuot: return f"{loai} '{ten[:60]}' gửi {', '.join(f'{k}=${v:g}' for k, v in vuot)} > ${tran:g} — camp mới bắt đầu ${NS_MOI} (anh 25/11/2026), ngân sách khác chỉ bằng nút anh bấm", tran
    if not any(k == "daily_budget" for k, _ in so): return f"lệnh tạo camp '{ten[:60]}' không có daily_budget — không gửi (Ethopex có thể tự đặt mức khác)", tran
    return None, tran

def _tu_kiem():
    assert phanh_giu_cham_doi({"phanh": "chờ phanh nhả: CHỈ LÊN CAMP MỚI THEO LỆNH ANH (etp.cau_hinh.chi_len_theo_lenh, …)", "chi_lenh": True}) is False, "phanh chỉ-lên-theo-lệnh không giữ chấm đội"
    assert phanh_giu_cham_doi({"phanh": "chờ phanh nhả: phanh chợ ROAS thấp", "chi_lenh": True}) is True, "phanh chợ vẫn giữ chấm đội"
    assert phanh_giu_cham_doi({"phanh": "chờ phanh nhả: phanh chợ"}) is True and phanh_giu_cham_doi({}) is False
    assert all(la_k(i, n) for n in (1, 2, 4, 8) for i in range(n)), "mặc định mọi creative kiểu Kiên — D chỉ khi anh chọn ở Chờ lên"
    global PC_CHAN
    assert len(set(MUC_ROAS)) >= 3 and all(0.9 <= m <= 1.4 for m in MUC_ROAS) and "roas" not in _BL["hoi_cho"], "dàn mức ★ ROAS: ≥ 3 mức trong 0.9–1.4, không còn mức cứng hoi_cho.roas (anh 26/11/2026)"
    assert sql_muc_roas("12") == f"select etp.muc_roas(12, array[{_MUC_TXT}]::numeric[], {DAN_NGAY})" and muc_roas(5, lambda s: "1.1") == 1.1
    assert so_roas(ROAS_DAN) == "dan" and so_roas(1.0) == "1" and chu_roas(1.2) == "1.2" and chu_roas(ROAS_DAN).startswith("dàn ")
    _pc0 = PC_CHAN; PC_CHAN = False   # chỉ cảnh báo: phanh có mà không chặn gì
    _b = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=6)).isoformat(); _c = {"phanh_cho": {"phanh": {"den_tang": _b, "den_len": _b, "ly_do": "thử"}, "gia6": {"ti": 0.6, "den": _b}, "rut": {"den": _b}}}
    assert all(chan_cua(v, _c) is None for v in ("tang", "nhan_ban", "tao_camp")) and phanh_sx(_c) is None and phanh_cho(_c["phanh_cho"], "tang"), "chan=false: không chặn nhưng vẫn có câu cảnh báo"
    assert chan_cua("tang", {**_c, "dung_khan": True}) == LY_DUNG_KHAN, "dừng khẩn vẫn chặn khi phanh chợ chỉ cảnh báo"
    PC_CHAN = True
    # PHÁ THỬ MỘT CỬA (anh 18/11/2026): phanh đang chạy → mọi lệnh máy bị chặn bất kể cờ / chữ ai; chỉ vé (ve=True) qua; thay bài bị từ chối qua; dừng khẩn chặn cả vé
    _bay = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=6)).isoformat()
    _ch = {"phanh_cho": {"phanh": {"den_tang": _bay, "den_len": _bay, "ly_do": "thử"}}}
    for _v in ("tang", "nhan_ban", "tao_camp"):
        assert chan_cua(_v, _ch, ve=False).startswith("PHANH CHỢ"), f"máy {_v} khi phanh phải bị chặn"
        assert chan_cua(_v, _ch, ve=True) is None, f"vé tay {_v} phải qua phanh"
    assert chan_cua("nhan_ban", _ch, thay=True) is None and chan_cua("giam", _ch) is None and chan_cua("tat", _ch) is None
    assert chan_cua("nhan_ban", {**_ch, "dung_khan": True}, ve=True) == LY_DUNG_KHAN and chan_cua("bat", {"dung_khan": True}, lich=True) == LY_DUNG_KHAN, "dừng khẩn chặn cả vé, cả lịch"
    assert chan_cua("bat", _ch, lich=True) is None, "bật theo lịch giờ là việc hợp lệ"
    assert ngoai_nhiem_vu(None, 0, "2026-11-25") and ngoai_nhiem_vu({"ngay": "2026-11-24", "so_camp": 99}, 0, "2026-11-25"), "không có nhiệm vụ đúng ngày = 0 vé"
    assert ngoai_nhiem_vu({"ngay": "2026-11-25", "so_camp": 24}, 23, "2026-11-25") is None and ngoai_nhiem_vu({"ngay": "2026-11-25", "so_camp": 24}, 24, "2026-11-25"), "trần số camp nhiệm vụ"
    _cl = {KHOA_CHI_LENH: True}   # chỉ lên theo lệnh anh (25/11/2026): máy tạo / nhân bản / thay bài đều chặn; vé tay + lệnh trực tiếp qua; bật / tăng / tắt không đổi
    assert all(chan_cua(_v, _cl, **_k) == LY_CHI_LENH for _v in ("tao_camp", "nhan_ban") for _k in ({}, {"thay": True}, {"lich": True})), "máy tạo / nhân bản phải bị chặn"
    assert chan_cua("tao_camp", _cl, ve=True) is None and chan_cua("nhan_ban", _cl, tt=True) is None, "nút anh / lệnh trực tiếp vẫn lên"
    assert all(chan_cua(_v, _cl) is None for _v in ("tang", "bat", "giam", "tat")) and chan_cua("nhan_ban", {KHOA_CHI_LENH: False}) is None, "chỉ chặn tạo mới"
    _e0 = os.environ.pop("ETP_NGUON", None); _co = lambda s: "1" if "etp.luot2" in s else ""; _ko = lambda s: "0" if "etp.luot2" in s else ""   # lượt 2 (anh 26/11/2026): cổng chỉ mở cho luot2.py + phim đang có dòng sổ 'dang'
    assert chan_cua("tao_camp", _cl, cts=[9], q=_co) == LY_CHI_LENH, "không phải tiến trình luot2 thì sổ có dòng cũng không mở"
    os.environ["ETP_NGUON"] = "luot2"
    assert chan_cua("tao_camp", _cl, cts=[9], q=_co) != LY_CHI_LENH and chan_cua("tao_camp", _cl, cts=[9], q=_ko) == LY_CHI_LENH and chan_cua("tao_camp", _cl, q=_co) == LY_CHI_LENH, "luot2 chỉ mở cho phim có dòng 'dang'"
    assert chan_cua("tao_camp", {**_cl, "dung_khan": True}, cts=[9], q=_co) == LY_DUNG_KHAN, "lượt 2 vẫn dừng khi dừng khẩn"
    os.environ.pop("ETP_NGUON"); _e0 and os.environ.__setitem__("ETP_NGUON", _e0)
    _rs = lambda s: "7\n8" if s == SQL_RS_TAT else ""
    assert chan_cua("bat", {}, 7, q=_rs) == LY_RS_TAT and chan_cua("bat", {}, 7, lich=True, q=_rs) == LY_RS_TAT and chan_cua("bat", {}, 7, ve=True, q=_rs) == LY_RS_TAT, "camp RS tắt không bật lại (máy / lịch / vé thường)"
    assert chan_cua("bat", {}, 7, tt=True, q=_rs) is None, "lệnh trực tiếp của anh vẫn qua"
    assert phanh_sx(_cl) == "chờ phanh nhả: " + LY_CHI_LENH, "dòng phim / hàng chấm đọc cùng cổng"
    _bt = {"bao_tri_len": {"bat": True, "tu": "x"}}
    assert chan_cua("tao_camp", _bt).startswith("ETHOPEX BẢO TRÌ") and chan_cua("tao_camp", _bt, ve=True) is None
    _env = os.environ.pop("ETP_VE", None)
    assert _ma_ve(None) is None and _ma_ve("anh (chat 05/11/2026: …)") is None and _ma_ve("x" * 32) is None and _ma_ve("0" * 32) == "0" * 32, "vé chỉ là mã 32 hex — chữ ai không phải vé"
    assert ve_hop_le("tang", [1]) is None and ve_hop_le("giam", [1], ma="0" * 32) is None, "không vé / việc không cần vé → không miễn"
    if _env: os.environ["ETP_VE"] = _env
    assert VE_VIEC["tao_camp"] == "nhan_ban" and "tat" not in VE_VIEC
    _u = lambda s: dt.datetime.fromisoformat(s + "+00:00"); _pc = {"phanh": {"den_tang": "2026-11-17T00:00:00+00:00", "den_len": "2026-11-18T00:00:00+00:00", "ly_do": "x"}}
    assert phanh_cho(_pc, "tang", _u("2026-11-16T14:00:00")).startswith("PHANH CHỢ: không tăng bậc tới 07:00 17/11") and phanh_cho(_pc, "tang", _u("2026-11-17T01:00:00")) is None, "tăng chỉ bị chặn tới 07:00 sáng hôm sau"
    assert phanh_cho(_pc, "nhan_ban", _u("2026-11-17T12:00:00")) and phanh_cho(_pc, "tao_camp", _u("2026-11-17T23:59:00")) and phanh_cho(_pc, "tao_camp", _u("2026-11-18T00:00:01")) is None, "tạo camp / nhân bản bị chặn hết ngày Ethopex kế"
    assert phanh_cho(_pc, "nhan_ban", _u("2026-11-17T12:00:00"), thay=True) is None and phanh_cho(_pc, "giam", _u("2026-11-16T14:00:00")) is None and phanh_cho(_pc, "bat", _u("2026-11-16T14:00:00")) is None
    _s = {"gia6": {"ti": 0.6, "den": "2026-11-17T05:00:00+00:00"}, "roi_sang": {"roi": -14, "kem": -34, "den": "2026-11-18T00:00:00+00:00"}}
    assert phanh_cho(_s, "tang", _u("2026-11-17T04:00:00")).startswith("PHANH CHỢ (báo sớm)") and phanh_cho(_s, "nhan_ban", _u("2026-11-17T06:00:00")).startswith("PHANH MỞ RỘNG") and phanh_cho(_s, "tao_camp", _u("2026-11-18T00:01:00")) is None and phanh_cho(_s, "giam", _u("2026-11-17T04:00:00")) is None and phanh_cho(_s, "nhan_ban", _u("2026-11-17T04:00:00"), thay=True) is None
    assert phanh_cho({}, "tang") is None and phanh_cho(None, "tao_camp") is None and phanh_cho({"phanh": None, "som": True}, "tang") is None, "không phanh / chỉ cảnh báo sớm thì không chặn"
    # SẢN XUẤT THEO CHỢ (anh 18/11/2026): đúng cổng lên camp của máy + nấc rút; vé tay không làm máy sản xuất
    _x = lambda gio: (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=gio)).isoformat()
    assert phanh_sx({"phanh_cho": {"phanh": {"den_len": _x(5), "ly_do": "x"}}}).startswith("chờ phanh nhả: PHANH CHỢ") and phanh_sx({"phanh_cho": {"phanh": {"den_len": _x(-1), "ly_do": "x"}}}) is None, "phanh den_len → ngừng sản xuất tới khi nhả"
    assert phanh_sx({"phanh_cho": {"gia6": {"ti": 0.6, "den": _x(1)}}}).startswith("chờ phanh nhả: PHANH CHỢ (báo sớm)") and phanh_sx({"phanh_cho": {"roi_sang": {"roi": -14, "kem": -34, "den": _x(3)}}}).startswith("chờ phanh nhả: PHANH MỞ RỘNG"), "báo sớm gia6 / roi_sang cũng ngừng"
    assert phanh_sx({"phanh_cho": {"rut": {"den": "2026-11-18T00:00:00+00:00"}}}, _u("2026-11-17T04:00:00")).startswith("chờ phanh nhả: RÚT KHỎI CHỢ") and phanh_sx({}, _u("2026-11-17T04:00:00")) is None and phanh_sx(None) is None
    assert phanh_sx({"bao_tri_len": {"bat": True}}, _u("2026-11-17T04:00:00")).startswith("chờ phanh nhả: ETHOPEX BẢO TRÌ") and phanh_sx({"dung_khan": True}).startswith("chờ phanh nhả: ĐANG DỪNG KHẨN")
    assert TT["so"] is None and not CO_TRAN_TEST and sql_test_con(1) == "(select null::int)" and _NB_MIN == (3.0, 50.0), "anh 25/11/2026 bỏ trần camp test / phim: sổ tran_test_phim.so = null, sql_test_con không trần"
    assert la_lai(5, 6) and la_lai(3, 4.5) and la_lai(0.5, 0.6) and not la_lai(3, 3) and not la_lai(0, 0) and not la_lai(10, 4) and not la_lai(None, None), "camp lãi = thu > chi (chi > 0)"
    # xung đột 5 (anh 19/11/2026): camp gốc nấc 45 / 100 (tiêu $45, thu $100) → bản nhân không tính trần; gốc chưa đạt nấc ($2 / $10, $10 / $12) → vẫn tính, trần giữ nguyên
    assert goc_dat_nac(45, 100) and not goc_dat_nac(2, 10) and not goc_dat_nac(10, 12) and not goc_dat_nac(0, 0), "gốc đạt nấc NB thấp nhất mới miễn trần"
    assert "c.goc is not null" in _sql_test(1) and _NB_LOG_MIEN in _sql_test(1), "đếm trần bỏ bản nhân từ gốc đạt nấc (kho + nhật ký) — dùng khi sổ đặt lại trần"
    assert "having sum(g.chi) >= " + str(_NB_MIN[0]) in _sql_goc_nac(7), "SQL gốc đạt nấc cùng ngưỡng nấc NB thấp nhất của sổ"
    assert "tran_test_phim" in ly_tran_test(1, 2) and "chạm trần" in ly_tran_test(1, 2), "câu chặn phải mang khoá (dòng phim mo_tran_test) + 'chạm trần' (SQL_DONG_HONG không đếm là dòng hỏng)"
    assert '"on"' in _sql_test(1) and "camp_dang_chay" in _sql_test(1) and "la_roas" in _sql_test(1) and "ethopex_nhat_ky" in _sql_test(1)
    assert nap_tre(49, 0) is None and nap_tre(50, 0) == 9 and nap_tre(80, 1) == 13 and nap_tre(100, 9) == 13 and nap_tre(100, 10) == 20 and nap_tre(None, 50) is None, "nắp camp trẻ lệch sổ luật"
    assert nap_camp(None, 0, 120, 12) == 20 and nap_camp(None, 3, 120, 12) == 6 and nap_camp(None, None, 120, 12) == 6 and nap_camp(80, 1, 10, 0) == 20 and nap_camp(None, 2, 60, 1) == 9, "nắp camp: trẻ lấy max(3 ngày, hôm nay); già / không rõ ngày = nắp 3 ngày"
    assert nap_tang(None) == 6 and nap_tang(29) == 6 and nap_tang(30) == 9 and nap_tang(50) == 13 and nap_tang(79) == 13 and nap_tang(80) == 20 and nap_tang(500) == 20, "nắp ROI lệch sổ luật"
    for t in ("★ ROAS 1.1 · X roas 1.1 duplicate by 65720", "S_FB_The-Dragons_167292_EN_EP8_x10_D69655_ROAS1", "S_FB_Max_153695_EN_VD-FULL-EP1_V1_D2 (ROAS)", "Dup by 66168 ROAS 1.2"):
        assert la_roas(t), t
    for t in ("2110 Number One Nobody EN - canh that 1400-1470s", "S_FB_Prosaic_ROASTED_x2", "S_FB_Max_153695_EN_VD-FULL-EP1_V1"):
        assert not la_roas(t), t
    assert la_roas("ROAS1.2_S_FB_The-Dragons-Silly-Captive_167292_EN_EP8_x3_D_69343") and la_roas("ROAS1.1_S_2210 Step Back EN")
    assert la_roas({"name": "S_FB_Dragons_x10", "source_bidding_strategy": "LOWEST_COST_WITH_MIN_ROAS"})   # Kiên: không đặt tên vẫn là ROAS
    assert not la_roas({"name": "★ ROAS 1 · Y roas 1 duplicate by 65720", "source_bidding_strategy": "LOWEST_COST_WITHOUT_CAP"})   # chiến lược thật thắng tên
    assert la_roas({"ten": "x", "chien_luoc": "LOWEST_COST_WITH_MIN_ROAS"}) and la_roas({"name": "Dup by 66168 ROAS 1.1"}) and not la_roas({"name": "S_FB_x1"})
    cs = [{"id": 66420, "name": "S_FB_Max_153695_EN_VD-FULL-EP1_V1"}, {"id": 1, "name": "S_FB_Max_153695_EN_VD-FULL-EP1_V1_D2 (ROAS)"},
          {"id": 69655, "name": "S_FB_Dragons_x10"}, {"id": 2, "name": "S_FB_Dragons_x10_D69655_ROAS1"}, {"id": 3, "name": "Dup by 66168 ROAS 1.1"},
          {"id": 70000, "name": "S_FB_Khac_x1"}, {"id": 4, "name": "★ ROAS 1 · Y roas 1 duplicate by 65720"}]
    assert goc_roas(cs) == {66420, 69655, 66168, 65720}, goc_roas(cs)
    # camp mới $1 đọc trên payload — phá thử: mỗi ca sai phải đỏ
    _pl = lambda ns, ten="X EN - anh tinh 0-9s", bid=None, g=None: {"name": ten, "campaign": {"source_payload": {"name": ten, "daily_budget": ns, **({"bid_strategy": bid} if bid else {})},
                                                                       "ad_groups": [{"source_payload": g or {"name": ten + " · adset"}}]}}
    assert ns_tao(_pl(1))[0] is None and ns_tao(_pl(5))[0] is None, "camp mới tới đúng $5"
    assert ns_tao(_pl(6))[0], "camp mới $6 phải chặn"
    assert ns_tao(_pl(1, g={"daily_budget": 6}))[0], "ngân sách $6 nấp ở Ad Set phải chặn"
    assert ns_tao(_pl(1, g={"lifetime_budget": "50"}))[0], "lifetime_budget ở Ad Set phải chặn"
    assert ns_tao({"name": "X", "campaign": {"source_payload": {"name": "X"}, "ad_groups": []}})[0], "thiếu daily_budget phải chặn"
    assert ns_tao(_pl(18, bid="LOWEST_COST_WITH_MIN_ROAS"))[0] is None and ns_tao(_pl(25, bid="LOWEST_COST_WITH_MIN_ROAS"))[0], "ROAS tới $20"
    assert ns_tao(_pl(18, ten="★ ROAS 1.1 · X duplicate by 1"))[0], "tên ROAS mà không có chiến lược thầu ROAS → vẫn là camp mới $5"
    assert ns_tao(_pl(5, ten="X (thang $5 cua 87811)")) == (None, 5.0) and ns_tao(_pl(10, ten="X (thang $5 cua 87811)"))[0], "bản thang tới đúng $X"
    assert ns_tao(_pl(7, ten="X (thang $15 cua 87811) copy"))[0], "chữ thang giữa tên không tính"
    assert ns_tao(_pl(1, g={"is_adset_budget_sharing_enabled": True}))[0] is None, "cờ boolean không phải ngân sách"
    _bc = lambda ns, ad: {"name": "X", "campaign": {"source_payload": {"name": "X", "daily_budget": ns}, "ad_groups": [{"source_payload": {}, "ads": [ad]}]}}
    assert ns_tao(_bc(5, {"effective_object_story_id": "1_2"})) == (None, 5.0) and ns_tao(_bc(10, {"effective_object_story_id": "1_2"}))[0], "bài cũ (NB) tới đúng $5 như mọi camp mới (anh 25/11/2026)"
    assert ns_tao(_bc(6, {"effective_object_story_id": "1_2", "creative_id": 5}))[0] and ns_tao(_bc(6, {"creative_id": 5}))[0], "có creative mới → vẫn camp mới $5"
    # AT CHỈ DẠNG FREE (anh 19/11/2026) — phá thử: AT cta kien / khong_nut / chưa sổ phải đỏ; AT Free, cảnh thật mẫu Kiên, AT team không sổ qua
    assert ly_at([(1, "ảnh tĩnh", "ảnh tĩnh", "kien", "tv1", True)]) and "kien" in ly_at([(1, "ảnh tĩnh", "ảnh tĩnh", "kien", "tv1", True)]), "AT cta kien phải bị chặn"
    assert ly_at([(2, "ảnh tĩnh", "ảnh tĩnh", "khong_nut", "tv1", True)]) and ly_at([(3, "ảnh tĩnh", "", None, "tv1", False)]) and ly_at([(4, "cảnh thật", "ảnh tĩnh", "kien", "x", True)])
    assert ly_at([(5, "ảnh tĩnh", "ảnh tĩnh", "watch_for_free", "tv1", True), (6, "cảnh thật", "cảnh thật", "kien", "x", True), (7, "ảnh tĩnh", "", None, "team", False)]) is None
    assert ly_at([(5, "ảnh tĩnh", "ảnh tĩnh", "watch_for_free", "tv1", True), (8, "ảnh tĩnh", "ảnh tĩnh", "kien", "tv2", True)]).startswith("creative #8")
    assert at_sai_dang([9], q=lambda s: "9|ảnh tĩnh|ảnh tĩnh|kien|tv1|t") and at_sai_dang([9], q=lambda s: "9|ảnh tĩnh|ảnh tĩnh|watch_for_free|tv1|t") is None and at_sai_dang([]) is None
    assert "chặn cho an toàn" in at_sai_dang([9], q=lambda s: (_ for _ in ()).throw(RuntimeError("x"))), "lỗi đọc sổ phải chặn"
    # PHIM CẤM (anh 19/11/2026) — phá thử với sổ giả: chặn mọi việc tăng chi kể cả vé / lịch giờ / thay bài; giảm / tắt qua; không có phim / camp thì không đọc sổ; lỗi đọc → chặn
    _cam = lambda s: "94344|Ethopex báo vi phạm" if ("94344" in s or "73303" in s) else ""
    for _v in ("tao_camp", "nhan_ban", "bat", "tang"):
        assert phim_cam(cts=[94344], q=_cam).startswith("phim #94344 trong sổ cấm"), _v
        assert (chan_cua(_v, {}, None, cts=[94344], ve=True, q=_cam) or "").startswith("phim #94344"), f"{_v} phim cấm có vé phải bị chặn"
        assert (chan_cua(_v, {}, 73303, ve=True, lich=True, thay=True, q=_cam) or "").startswith("phim #94344"), f"{_v} camp phim cấm (lịch / thay / vé) phải bị chặn"
        assert (chan_cua(_v, {}, None, goc=73303, ve=True, q=_cam) or "").startswith("phim #94344"), f"{_v} camp gốc phim cấm (nhân bản / ROAS) phải bị chặn"
    assert chan_cua("tat", {}, 73303, q=_cam) is None and chan_cua("giam", {}, 73303, q=_cam) is None, "tắt / giảm phim cấm luôn qua"
    _sx = lambda s: '{"49428": {"ly_do": "soát cách sinh creative"}}' if "phim_chi_sx" in s else ""
    assert "CHỈ SẢN XUẤT" in chan_cua("tao_camp", {}, cts=[49428], q=_sx) and chan_cua("tao_camp", {}, cts=[49428], ve=True, q=_sx) is None and chan_cua("tao_camp", {}, cts=[49428], tt=True, q=_sx) is None, "phim chỉ sản xuất: máy bị chặn, vé tay / lệnh trực tiếp qua"
    assert chan_cua("tao_camp", {}, cts=[7], q=_sx) is None and chan_cua("nhan_ban", {}, cts=[49428], q=_sx) is None and chan_cua("tang", {}, cts=[49428], q=_sx) is None, "phim khác / nhân bản / tăng không bị sổ chỉ sản xuất chặn"
    assert "chặn cho an toàn" in phim_chi_sx([49428], q=lambda s: (_ for _ in ()).throw(RuntimeError("x"))) and phim_chi_sx([], q=lambda s: (_ for _ in ()).throw(RuntimeError("x"))) is None, "lỗi đọc sổ chỉ sản xuất phải chặn; không phim thì không đọc"
    assert chan_cua("tang", {}, 5, cts=[7], q=lambda s: "") is None and phim_cam(q=lambda s: (_ for _ in ()).throw(RuntimeError("không được đọc"))) is None, "không phim / camp thì không đọc sổ"
    assert "chặn cho an toàn" in phim_cam([5], q=lambda s: (_ for _ in ()).throw(RuntimeError("x"))), "lỗi đọc sổ phim cấm phải chặn"
    assert "ethopex_phim_cam" in SQL_CAMP_PHIM_CAM and "camp_ngoai" in SQL_CAMP_PHIM_CAM
    # MÁY QUÉT PHIM CẤM (anh 20/11/2026): 1 camp phim cấm ACTIVE → tắt đúng camp đó qua tat-loat --ep --bo-cam-bien, MỘT tin; không có gì → im, không gọi tắt
    _goi, _tin = [], []
    class _R: stdout = '{"da_tat": [9001], "lich": [], "chua": [], "giu": {}}'; stderr = ""
    _k = don_phim_cam(q=lambda s: "9001|501|ACTIVE|01:05 20/11|camp thử|vi phạm" if "select c.camp_id" in s else "", tat=lambda ids: _goi.append(ids) or _R, bao=_tin.append)
    assert _goi == ["9001"] and _k["da_tat"] == ["9001"] and len(_tin) == 1 and "#9001" in _tin[0] and "ĐÃ TẮT" in _tin[0] and "#501" in _tin[0], (_goi, _k, _tin)
    _goi, _tin = [], []; don_phim_cam(q=lambda s: "", tat=lambda ids: _goi.append(ids) or _R, bao=_tin.append)
    assert not _goi and not _tin, "không có camp / dòng phim cấm thì không tắt, không báo"
    assert sql_don_camp().count("etp.camp_ngoai") == 1 and "not in (select camp_id from etp.camp_ngoai" in sql_don_camp() and " from etp.camp c " in sql_don_camp(), "máy quét chỉ đọc camp NHÀ, trừ camp đội"
    print("✓ cong.py tự kiểm (nhận camp ROAS mọi kiểu tên + gốc đã có ROAS + camp mới $1 trên payload + phim cấm chặn cả vé / lịch / ROAS)")

if __name__ == "__main__":
    import sys; a = sys.argv[1:]
    if a[:1] == ["--tu-kiem"]: _tu_kiem(); sys.exit(0)
    if a[:1] == ["--xin-ve"]:   # --xin-ve <tang|bat|nhan_ban|tao_camp> <camp_id|-> <content_id|-> <người bấm> — CHỈ đường nút (VE_XIN) gọi; in mã vé
        print(xin_ve(a[1], a[2], a[3], " ".join(a[4:]))); sys.exit(0)
    if a[:1] == ["--ve-truc-tiep"]:   # --ve-truc-tiep <tang|bat|nhan_ban|tao_camp> --camp <id> | --phim <id> --lenh "<nguyên văn câu anh>" [--ns N] — CHỈ Claude gõ theo câu anh trong chat
        o = {k: (a[i + 1] if i + 1 < len(a) else "") for i, k in enumerate(a) if k in ("--camp", "--phim", "--lenh", "--ns")}
        ngay = "--ngay" in a   # --ngay: chỉ vỏ nút etp2 (etp-ve.ts) truyền — anh bấm là lệnh, cấp vé ngay
        if len(a) < 2 or not o.get("--lenh"): print('dùng: cong.py --ve-truc-tiep <việc> --camp <id> | --phim <id> --lenh "<câu lệnh của anh>" [--ns N]', file=sys.stderr); sys.exit(2)
        try: ma, ph = ve_truc_tiep(a[1], o.get("--camp"), o.get("--phim"), o["--lenh"], float(o["--ns"]) if o.get("--ns") else None, ngay=ngay)
        except ValueError as e: print(f"✗ không cấp: {e}", file=sys.stderr); sys.exit(3)
        if not ma:
            print(f"⚠ CẢNH BÁO MỘT LẦN — phanh sẽ bị bỏ qua: {ph[0]}\n   → báo anh câu này; anh vẫn muốn thì gõ lại đúng lệnh trong {CANH_BAO_PHUT} phút là cấp vé (anh 20/11/2026: phanh chỉ cảnh báo một lần)", file=sys.stderr); sys.exit(4)
        if ph: print(f"⚡ đã bỏ qua phanh (đã cảnh báo): {ph[0]}", file=sys.stderr)
        print(ma); sys.exit(0)
    if a[:1] == ["--tu-kiem-ve"]:   # trên box3: vé thật trong etp.ve_tay (camp giả 999999991, ai 'tự kiểm') — đúng / sai camp, sai việc, đốt hai lần, hết hạn
        m = xin_ve("tang", 999999991, None, "tự kiểm cong.py"); m2 = xin_ve("nhan_ban", None, 999999992, "tự kiểm cong.py")
        assert ve_hop_le("tang", [999999991], ma=m) and not ve_hop_le("tang", [999999990], ma=m) and not ve_hop_le("bat", [999999991], ma=m), "vé phải đúng việc + đúng camp"
        assert ve_hop_le("tao_camp", [], 999999992, ma=m2) and ve_hop_le("nhan_ban", [5], 999999992, ma=m2) and not ve_hop_le("nhan_ban", [5], 1, ma=m2), "vé lên camp khớp phim"
        assert ve_hop_le("tang", [999999991], dung=True, cho="tự kiểm", ma=m) and not ve_hop_le("tang", [999999991], dung=True, ma=m), "vé chỉ dùng một lần"
        _q(f"update etp.ve_tay set het_han = now() - interval '1 second' where ma = '{m2}'"); assert not ve_hop_le("nhan_ban", [], 999999992, ma=m2), "vé hết hạn"
        print("✓ vé thao tác tay: đúng việc / camp / phim, một lần, hết hạn"); sys.exit(0)
    if a[:1] == ["--phim-cam"]:   # python3 cong.py --phim-cam <content_id…> → mỗi phim cấm một dòng "cid|lý do" (len-creative.py gọi từ Mac qua ssh box3). Lỗi đọc → mã 2.
        ds = [x for x in a[1:] if x.strip().isdigit()]
        for c in ds:
            ly = phim_cam(cts=[c])
            if ly and "chặn cho an toàn" in ly: print(ly, file=sys.stderr); sys.exit(2)
            if ly: print(f"{int(c)}|{ly}")
        sys.exit(0)
    if a[:1] == ["--tu-kiem-phim-cam"]:   # trên box3, SỔ THẬT (anh 19/11/2026): camp + phim thật trong ethopex_phim_cam — bật / nhân bản / ★ ROAS / tăng đều bị chặn, kể cả vé thật.
        # KHÔNG gửi gì lên Ethopex (chỉ gọi kiem). Vé thử ghi etp.ve_tay (ai 'tự kiểm phim cấm') rồi đốt ngay.
        r = _q(f"select c.camp_id || '|' || c.content_id from etp.camp c where c.camp_id in ({SQL_CAMP_PHIM_CAM}) order by c.la_roas desc nulls last, 1 limit 1")
        if not r: print("sổ phim cấm không có camp nhà nào — bỏ qua"); sys.exit(0)
        cid, ct = map(int, r.split("|"))
        # CHỈ MÃ CAMP (lệnh bật / tăng không mang phim) trên sổ thật: camp phim cấm → chặn vì sổ cấm; camp thường → cho qua, KHÔNG được ra "không đọc được sổ" (19/11/2026 câu union sai tên cột chặn oan mọi bật / tăng)
        _sach = int(_q(f"select camp_id from etp.camp where content_id is not null and camp_id not in ({SQL_CAMP_PHIM_CAM}) order by camp_id desc limit 1"))
        assert "sổ cấm" in (phim_cam([cid]) or ""), f"camp phim cấm #{cid} chỉ mã camp phải bị chặn: {phim_cam([cid])}"
        assert phim_cam([_sach]) is None and phim_cam([_sach], [1]) is None, f"camp thường #{_sach} phải qua: {phim_cam([_sach])}"
        m = xin_ve("bat", cid, None, "tự kiểm phim cấm"); m2 = xin_ve("nhan_ban", cid, ct, "tự kiểm phim cấm"); m3 = xin_ve("tang", cid, None, "tự kiểm phim cấm")
        try:
            for viec, ve, kw in (("bat", m, {}), ("nhan_ban", m2, {"content_id": ct}), ("nhan_ban", m2, {"content_id": ct, "roas": True, "lenh_anh": True}),
                                 ("tao_camp", m2, {"content_id": ct, "tay": True, "anh_bam": True}), ("tang", m3, {"roas": True})):
                os.environ["ETP_VE"] = ve
                ly = kiem(viec, cid if viec in ("bat", "tang") else None, 2 if viec == "tang" else 1, 1, **kw)
                assert ly and "sổ cấm" in ly, f"LỌT: {viec} camp #{cid} phim #{ct} {kw} có vé → {ly}"
                print(f"chặn đúng: {viec} {kw or ''} camp #{cid} phim #{ct} (có vé) · {ly[:70]}")
        finally:
            os.environ.pop("ETP_VE", None)
            for x in (m, m2, m3): _q(f"update etp.ve_tay set da_dung = now(), dung_cho = 'tự kiểm phim cấm — đốt' where ma = '{x}' and da_dung is null")
        print("✓ phim cấm: bật / nhân bản / ★ ROAS / tạo / tăng đều bị chặn kể cả vé thật")
        # KHO CHỜ LÊN (etp:phim-cam-con-lai-2011): view etp.cho_len_v (migration 0448) khớp hai đầu với phim_cam — phim 167292 không còn creative tự lên,
        # mọi phim view cho tự lên đều qua phim_cam (một hàm), và vẫn còn phim thường đi qua
        assert "sổ cấm" in (phim_cam(cts=[167292]) or ""), "phim 167292 phải trong sổ cấm"
        assert _q("select count(*) from etp.cho_len_v where content_id = 167292 and ly_do is null") == "0", "LỌT: kho chờ lên còn creative tự lên của phim cấm 167292"
        _ds = [int(x) for x in (_q("select string_agg(distinct content_id::text, ',') from etp.cho_len_v where ly_do is null") or "").split(",") if x]
        assert _ds and phim_cam(cts=_ds) is None, f"LỌT: kho chờ lên cho tự lên phim cấm → {phim_cam(cts=_ds) if _ds else 'kho rỗng'}"
        print(f"✓ kho chờ lên: 167292 bị chặn, {len(_ds)} phim thường (vd #{_ds[0]}) đi qua phim_cam")
        # MÁY QUÉT PHIM CẤM (etp:phim-cam-quet-2011): ĐÚNG câu sql_don_camp chạy trên bảng giả với sổ cấm thật —
        # -1 phim cấm ACTIVE → tắt · -2 phim thường ACTIVE → không đụng · -3 phim cấm ACTIVE nhưng là camp ĐỘI → không đụng · -4 phim cấm PAUSED còn lịch bật lại → tắt
        _ct_sach = int(_q(f"select content_id from etp.camp where camp_id = {_sach}"))
        _gia = (f"with gia_camp(camp_id, content_id, trang_thai, cap_nhat_etp, ten) as (values (-1::bigint, {ct}, 'ACTIVE', now(), 'a'), (-2::bigint, {_ct_sach}, 'ACTIVE', now(), 'b'),"
                f" (-3::bigint, {ct}, 'ACTIVE', now(), 'c'), (-4::bigint, {ct}, 'PAUSED', now(), 'd')), gia_ngoai(camp_id) as (values (-3::bigint)), gia_lich(camp_id) as (values (-4::bigint)) ")
        _ra = [l.split("|")[0] for l in (_q(_gia + sql_don_camp("gia_camp", "gia_ngoai", "gia_lich")) or "").splitlines()]
        assert _ra == ["-4", "-1"] or sorted(_ra) == ["-1", "-4"], f"máy quét sai: {_ra} (mong -1, -4)"
        print(f"✓ máy quét: camp phim cấm ACTIVE / còn lịch bật → tắt; phim thường #{_ct_sach} và camp đội không đụng")
        _x = don_phim_cam(lam=False)
        _ngoai = set((_q("select string_agg(camp_id::text, ',') from etp.camp_ngoai") or "").split(","))
        assert not [c for c in _x["tat"] if c["camp_id"] in _ngoai], "LỌT: máy quét nhặt camp đội"
        print(f"✓ máy quét sổ thật (chỉ đọc): {len(_x['tat'])} camp nhà cần tắt · " + " · ".join(f"{b} {len(v)}" for b, v in _x["huy"].items()))
        sys.exit(0)
    if a[:1] == ["--don-phim-cam"]:   # nhịp etp-dong-bo (anh 20/11/2026): tắt camp nhà phim cấm bị bật ngoài cổng + huỷ dòng phim / việc chờ của phim cấm; --xem = chỉ đọc
        _x = don_phim_cam(lam="--xem" not in a)
        print(json.dumps({"tat": [c["camp_id"] for c in _x["tat"]], "da_tat": _x["da_tat"], "chua": _x["chua"], "huy": {b: len(v) for b, v in _x["huy"].items()}}, ensure_ascii=False))
        sys.exit(0)
    if a[:1] == ["--xem-test"]:   # chỉ đọc: số camp test / phim lãi ổn định / chỗ còn của các phim đang chạy (trần camp test / phim, anh 18/11/2026) — không giữ chỗ
        print(_q(f"""select p.content_id || ' test ' || t.n || ' · lãi ổn định ' || t.on || ' · chỗ còn ' || coalesce({sql_test_con('p.content_id')}::text, 'không trần')
                     from (select distinct content_id from etp.camp where trang_thai = 'ACTIVE' and content_id is not null) p, lateral {_sql_test('p.content_id')} t order by t.n desc, 1 limit {int(a[1]) if len(a) > 1 else 15}""")); sys.exit(0)
    print(kiem(a[0], int(a[1]) if len(a) > 1 and a[1].isdigit() else None, float(a[2]) if len(a) > 2 else None, float(a[3]) if len(a) > 3 else 0) or "CHO QUA")
