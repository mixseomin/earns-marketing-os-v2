"""CỔNG RÀO CHẮN etp (anh 24/10/2026 — bước 3 etp.on.tc): MỌI lệnh tự động gọi kiem() trước khi gửi lên Ethopex.
kiem(viec, camp_id=None, ns_moi=None, ns_cu=0, bo=None, content_id=None, ngoai=False, tay=False, roas=False, lenh_anh=False, bac=False) → None (cho qua) | câu lý do chặn.
  ngoai=True: camp trong tài khoản QC của người trong team (Luật tự động, apps/cty/worker/etp-tu-dong.mjs) — vẫn qua dừng khẩn / Âu-Mỹ / phim cất / trần camp,
  bỏ trần NGÀY + trần BỘ (hai trần đó cộng ngân sách camp NHÀ trong etp.camp — tiền của người đó không tính vào, cũng không bị trần nhà chặn).
  CHỈ PHIM ÂU-MỸ (anh 29/10/2026 "dừng các phim ngoài âu mỹ … chặn thể loại này khi lên camp target US"): phim có etp.phim.nhom_goc khác au_my
  (trung / an / latin / hoat_hinh / dong_a / da_mau) → chặn mọi việc tăng chi (tạo camp, nhân bản kể cả ROAS, bật lại, tăng). Phim chưa chấm nhóm → chấm poster ngay, thiếu poster thì 4 khung video creative đã chấm (apps/etp/nhom_goc.py, ckey ~13–36₫), không chấm được → chặn (anh 29/10/2026 "làm cho kín").
  TRÙNG PHIM VỚI ĐỘI: BỎ (anh 06/11/2026 "Bỏ tiêu chí ko lên camp cùng người trong đội") — luật 02/11/2026 chặn camp mới phim người khác trong đội đang chạy; nay lên bình thường.
  PHIM ĐÃ CẤT (anh 31/10/2026): etp.phim.thu_vong = 'cat' (apps/etp/cat_phim.py) → chặn tạo camp / nhân bản phim đó; camp đang chạy vẫn để luật tắt xử.
  viec: tang | bat | nhan_ban | tao_camp (làm tăng chi) · giam | tat (luôn cho qua — dừng khẩn vẫn phải hạ được chi)
Đọc etp.cau_hinh (dung_khan · tran_ngay · tran_camp · tran_bo · tran_camp_moi_ngay) + etp.camp (tổng ngân sách camp đang bật). Lỗi đọc kho → CHẶN (an toàn trước, không đoán).
Dùng trong script khác: sys.path.insert(0, '/opt/earns-marketing-os-v2/apps/etp'); import cong; ly = cong.kiem('tang', cid, 15, 10)"""
import json, os, subprocess, datetime as dt
TANG = {"tang", "bat", "nhan_ban", "tao_camp"}
# NẮP NGÂN SÁCH THEO ROI 3 NGÀY KHÉP — một nguồn với máy luật (sổ luật chung apps/web/src/lib/etp-bang-luat.json nap_tang; Dol 09/11/2026, anh duyệt: chỉ lần tăng mới)
_BL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "src", "lib", "etp-bang-luat.json")))
_BAC = [x for x in _BL["thang"] if x <= 20]
NAP_TANG = sorted((float(m), float(n)) for m, n in _BL["nap_tang"]["bac"])
NAP_DUOI = max([x for x in _BAC if x < NAP_TANG[0][1]] or [_BAC[0]])
def nap_tang(r3): return max([n for m, n in NAP_TANG if r3 is not None and r3 >= m], default=NAP_DUOI)
SQL_ROI3 = ("select case when sum(chi) > 0 then round(100 * (sum(thu) - sum(chi)) / sum(chi)) end from etp.so_ngay where camp_id = {cid}"
            " and ngay between (now() at time zone 'utc')::date - 3 and (now() at time zone 'utc')::date - 1")
# TRẦN CAMP MỚI / NGÀY — một nguồn cho cổng này và máy dòng phim (dong_phim.mo_tran_ngay nhận dòng dừng vì trần bằng KHOA_TRAN_NGAY có trong lý do, đếm chỗ còn bằng SQL_TAO_HOM_NAY)
KHOA_TRAN_NGAY = "tran_camp_moi_ngay"
# BỘ LÊN CAMP MỚI — một nguồn (anh 08/11/2026 "Bộ 1 = 50% Kiên… Sửa đi" + "1 phim ở nhiều bộ thoải mái"): camp mới của creative (dòng phim, worker phim mới,
# nút lên camp etp.on.tc, len-sau-cham, thay-the) lên bộ etp.cau_hinh.bo_phim_moi, phim đã chạy bộ khác cũng vậy. Nhân bản / thang / ROAS ở bộ camp gốc.
SQL_BO_PHIM = ("select coalesce((select thu_bo from etp.phim where content_id = {cid} and thu_vong = 'doi_bo' and coalesce(thu_bo, '') <> ''),"
               " (select gia_tri#>>'{{}}' from etp.cau_hinh where khoa = 'bo_phim_moi'))")   # phim thang cất đang ở vòng đổi bộ (cat_phim.py thu_bo) → bộ đó; còn lại bo_phim_moi (anh 09/11/2026: camp thay thế bỏ, bộ đổi đi theo mọi đường lên camp)
# DÒNG HỎNG THẬT ≠ DÒNG DỪNG ĐÚNG LUẬT (09/11/2026 rà xung đột: lộ trình đếm mọi dòng 'dung' là hỏng → 3 dòng là bỏ hẳn dạng đó cho phim; 46 phim mất CC, 37 mất AT
# chỉ vì dòng bị gác theo gac_dang, 33 mất PO vì chạm trần camp/ngày hay trang phim hỏng). Hỏng thật = 'loi' (máy), hoặc 'dung' không do một luật chặn:
# gác dạng (dong_phim.gac_ly), trần camp mới/ngày (kiem → mo_tran_ngay tự mở lại), trang phim Nhà hỏng (ly_trang_hong), nhóm gốc ngoài Âu-Mỹ (bước nhận).
SQL_DONG_HONG = ("(trang_thai = 'loi' or (trang_thai = 'dung' and coalesce(ly_do, '') not like 'tạm gác dòng%' and strpos(coalesce(ly_do, ''), 'chạm trần') = 0"
                 " and strpos(coalesce(ly_do, ''), 'DỪNG LÊN CAMP MỚI') = 0 and coalesce(ly_do, '') not like 'ws: trang phim Nhà%' and coalesce(ly_do, '') not like 'nhan: nhóm gốc%'))")
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
def _sql_test(cid):
    """dòng (n: camp test đang chạy + camp vừa tạo chưa vào kho, on: phim lãi ổn định) — cid: số hoặc biểu thức SQL"""
    po = TT["phim_on"]
    return f"""(select (select count(*) from (select c.camp_id, coalesce(sum(n.chi), 0) chi, coalesce(sum(n.thu), 0) thu from etp.camp c left join etp.so_ngay n using (camp_id)
            where c.content_id = {cid} and not coalesce(c.la_roas, false)
              and (c.camp_id in (select camp_id from etp.camp_dang_chay) or coalesce(c.dong_bo, '') not in ('done', 'synced', 'error', 'DISAPPROVED')) group by 1) s
            where not (s.chi > 0 and (s.thu > s.chi or (s.chi >= {_NB_MIN[0]} and (s.thu - s.chi) / s.chi * 100 >= {_NB_MIN[1]}))))
          + (select count(distinct x->>'id') from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x where ten = 'ethopex_nhat_ky' and x->>'viec' in ('tao_camp', 'nhan_ban') and (x->>'ok')::boolean
              and x->>'nguoi' is null and x->>'content' = ({cid})::text and coalesce(x->>'id', '') ~ '^[0-9]+$'
              and to_timestamp(x->>'luc', 'HH24:MI DD/MM/YYYY') > (now() at time zone 'Asia/Ho_Chi_Minh') - interval '15 minutes'
              and not exists (select 1 from etp.camp k where k.camp_id = (x->>'id')::int)) n,
        coalesce((select sum(n.chi) >= {float(po['chi'])} and sum(n.thu) > sum(n.chi) from etp.so_ngay n join etp.camp k using (camp_id) where k.content_id = {cid}
            and n.ngay between (now() at time zone 'utc')::date - {int(po['ngay'])} and (now() at time zone 'utc')::date - 1), false) "on")"""
def sql_test_con(cid):
    """câu SQL con → số chỗ camp test còn lại của phim (null = phim lãi ổn định, không trần) — lộ trình đọc để không sản xuất creative cho phim đã đủ camp test"""
    return f"(select case when t.on then null else greatest({int(TT['so'])} - t.n, 0) end from {_sql_test(cid)} t)"
def giu_test(cid):
    """(số camp test đang chạy kể cả chỗ đang giữ, phim lãi ổn định?, được qua?) — đếm + giữ chỗ trong MỘT giao dịch có khoá (cùng cách giu_cho)"""
    cid, tran = int(cid), int(TT["so"])
    r = _q(f"""select pg_advisory_xact_lock(74611118);
        with t as {_sql_test(cid)},
        cu as (select coalesce((select jsonb_agg(x) from etp.cau_hinh, jsonb_array_elements(case when jsonb_typeof(gia_tri->'{cid}') = 'array' then gia_tri->'{cid}' else '[]'::jsonb end) x
                                where khoa = 'giu_test_phim' and (x#>>'{{}}')::float > extract(epoch from now()) - {GIU_GIAY}), '[]'::jsonb) ds),
        vua as (select count(*) n from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x where ten = 'ethopex_nhat_ky' and x->>'viec' in ('tao_camp', 'nhan_ban') and (x->>'ok')::boolean
                and x->>'nguoi' is null and x->>'content' = '{cid}' and to_timestamp(x->>'luc', 'HH24:MI DD/MM/YYYY') > (now() at time zone 'Asia/Ho_Chi_Minh') - interval '{GIU_GIAY + 60} seconds'),
        q as (select t.n + greatest(jsonb_array_length(cu.ds) - vua.n, 0) so, t.on, cu.ds from t, cu, vua),
        ghi as (insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) select 'giu_test_phim', jsonb_build_object('{cid}', q.ds || to_jsonb(extract(epoch from now())::float)),
                    'chỗ đang giữ dưới trần camp test / phim (cong.giu_test) — {{phim: [mốc giây]}}, tự nhả sau {GIU_GIAY} giây', 'cong.py' from q where not q.on and q.so < {tran}
                on conflict (khoa) do update set gia_tri = etp.cau_hinh.gia_tri || excluded.gia_tri, luc = now() returning 1)
        select q.so || '|' || q.on || '|' || (select count(*) from ghi) from q""").strip().splitlines()[-1]
    so, on, ok = r.split("|"); return int(so), on == "t", on == "t" or ok == "1"
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

LY_AU_MY = "phim nhóm gốc '{}' — chỉ chạy phim Âu-Mỹ (anh 29/10/2026: dừng các phim ngoài Âu-Mỹ, chặn khi lên camp; nhóm chấm trên poster, etp.phim.nhom_goc)"
LY_CAT = "phim #{0} đã cất ({1}) — thử đủ creative + đủ bộ mà chưa camp nào lãi; tự mở lại khi camp nhà / team lãi, mở tay: python3 apps/etp/cat_phim.py --mo {0}"

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
    for l in _q("select content_id, coalesce(nhom_goc, ''), coalesce(thu_vong, ''), coalesce(thu_ly, '') from etp.phim where (nhom_goc is not null and nhom_goc <> 'au_my') or thu_vong = 'cat'").splitlines():
        cid, ng, tv, tl = l.split("|", 3)
        ra[int(cid)] = LY_AU_MY.format(ng) if ng and ng != "au_my" else LY_CAT.format(cid, tl)
    return ra

# NHÂN BẢN BÀI CŨ (anh 11/11/2026, Dol: "chạy lại post cũ để $2 luôn cũng được" — anh chốt "$2 cho camp dùng bài cũ thắng"): bản nhân bản camp thắng thường
# dùng LẠI bài đăng của camp gốc (Use existing post, ad chỉ mang effective_object_story_id) được lên tới NS_BAI_CU; mọi camp mới khác vẫn $1.
NS_BAI_CU = 2
TRAN_TUYET = 30   # trần tuyệt đối $/camp/ngày (anh 14/11/2026) — kiem() chặn trước mọi miễn trừ
# VÉ THAO TÁC TAY (anh 18/11/2026 "kiểm soát tuyệt đối" — thay cho chữ ai / cờ anh_bam: 17/11 dòng phim gọi nhan-ban --tay lọt 91 camp, 18/11 máy AT ghi ai
# "anh (chat 05/11/2026: …)" lọt 31 camp — mọi chữ người gọi tự khai đều giả được). Nút người bấm (etp2 · nút Telegram · nút etp) xin MỘT vé ngay lúc bấm
# (xin_ve — CHỈ các tệp nút trong VE_XIN được gọi, gop-y-luat.mjs giữ), vé đi qua biến môi trường ETP_VE vào tiến trình làm việc. Cổng chỉ miễn PHANH CHỢ /
# BẢO TRÌ / TRẦN CAMP TEST khi vé hợp lệ: đúng việc, đúng camp (hoặc camp gốc / phim của lệnh tạo), chưa hết hạn VE_PHUT phút, chưa dùng. Cửa API
# (ethopex_api.api) đốt vé lúc gửi lệnh — một vé một lệnh. Lỗi đọc vé = không vé (an toàn trước).
VE_PHUT = int(_BL["mot_cua"]["ve_phut"])   # sổ luật chung mot_cua (anh 18/11/2026)
assert _BL["mot_cua"]["mien_phanh"] == ["ve_tay"], "phanh chợ chỉ miễn thao tác tay có vé (anh 18/11/2026) — sổ luật mot_cua lệch mã"
VE_VIEC = {"tang": "tang", "bat": "bat", "nhan_ban": "nhan_ban", "tao_camp": "nhan_ban"}   # tạo camp từ creative = cùng loại vé lên camp
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
def ve_hop_le(viec, camp_ids=(), content_id=None, dung=False, cho="", ma=None):
    """người bấm (chữ ai của vé) nếu vé ETP_VE hợp lệ cho lệnh này, None nếu không. dung=True: đốt vé (cửa API, lúc gửi)."""
    ma, v = _ma_ve(ma), VE_VIEC.get(viec)
    if not ma or not v: return None
    ids = sorted({int(x) for x in camp_ids or () if str(x).isdigit()})
    khop = " or ".join(([f"camp_id in ({','.join(map(str, ids))})"] if ids else []) + ([f"content_id = {int(content_id)}"] if content_id not in (None, "") else [])) or "false"
    dk = f"ma = '{ma}' and viec = '{v}' and da_dung is null and het_han > now() and ({khop})"
    try:
        if dung: return _q(f"update etp.ve_tay set da_dung = now(), dung_cho = $C${str(cho).replace('$', '')[:200]}$C$ where {dk} returning ai") or None
        return _q(f"select ai from etp.ve_tay where {dk}") or None
    except Exception: return None

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
def chan_cua(viec, ch, camp_id=None, thay=False, ve=False, lich=False):
    """PHẦN CỔNG KHÔNG TIN LỜI NGƯỜI GỌI (anh 18/11/2026) — một hàm cho kiem() và cửa API (ethopex_api.api, đọc dữ kiện từ chính lệnh gửi đi):
    dừng khẩn · camp ít nước / lô team tắt không bật lại · Ethopex bảo trì lên camp · PHANH CHỢ. ch = etp.cau_hinh {khoá: giá trị}.
    ve = vé thao tác tay hợp lệ (ve_hop_le) — thứ DUY NHẤT miễn phanh / bảo trì. ANH CHỐT 18/11/2026: trong phanh chợ máy KHÔNG còn được miễn ở ★ ROAS
    (tự lên ROAS, tăng ROAS), camp đội chạy Luật tự động, lệnh chat — chỉ thao tác tay có vé. thay = camp thay bài bị Meta từ chối (thay chỗ, không thêm chi).
    lich = bật lại camp tạm dừng theo LỊCH GIỜ (etp.lich_tat, apps/etp/lich-gio.py): việc hợp lệ, chỉ dừng khẩn chặn."""
    if viec not in TANG: return None
    if ch.get("dung_khan"): return LY_DUNG_KHAN
    if lich: return None
    if viec == "bat" and camp_id and str(int(camp_id)) in _q(SQL_IT_NUOC).split(): return LY_IT_NUOC
    # ETHOPEX BẢO TRÌ LÊN CAMP (anh 17/11/2026: "bên Etho team báo là đang bảo trì việc lên camp nên sẽ dừng tạo camp mới từ giờ đến ít nhất là sáng mai + báo lại"):
    # etp.cau_hinh.bao_tri_len {bat, tu, ly_do} → MỌI đường máy tạo camp / nhân bản dừng, kể cả ★ ROAS, camp team, bản thang — đứng trước mọi miễn trừ. KHÔNG tự hết hạn:
    # chỉ tắt khi Ethopex báo lại. Anh bấm tay (có vé) vẫn gửi được (anh 16/11/2026 không chặn thao tác thủ công — Ethopex có thể tự từ chối).
    bt = ch.get("bao_tri_len") or {}
    if viec in ("tao_camp", "nhan_ban") and bt.get("bat") and not ve: return f"ETHOPEX BẢO TRÌ LÊN CAMP từ {bt.get('tu') or '?'} — dừng tạo camp / nhân bản tới khi Ethopex báo lại (etp.cau_hinh.bao_tri_len)"
    # PHANH CHỢ (anh 16/11/2026 "Làm theo đề xuất" — sổ luật phanh_cho, apps/etp/gia_adsense.py xet_phanh chốt 20h VN): không tăng bậc tới den_tang, không tạo camp / nhân bản
    # tới den_len. ANH BẤM TAY KHÔNG BỊ PHANH (anh 16/11/2026: "mày ko đc chặn với thao tác thủ công. Chỉ được cảnh báo thêm 1 lần nữa") — người bấm thật = có VÉ.
    ly_pc = phanh_cho(ch.get("phanh_cho"), viec, thay=thay)
    if ly_pc and not ve: return ly_pc
    return None

def kiem(viec, camp_id=None, ns_moi=None, ns_cu=0, bo=None, content_id=None, ngoai=False, tay=False, roas=False, lenh_anh=False, bac=False, bai_cu=False, thay=False, anh_bam=False):
    """anh_bam: BỎ (18/11/2026) — giữ tham số cho người gọi cũ, KHÔNG còn miễn gì; người bấm thật = vé ETP_VE (ve_hop_le). tay: chỉ còn nghĩa cũ (miễn trùng phim đội, đã bỏ)."""
    if viec not in TANG: return None
    try:
        ct = content_id if content_id is not None else (_q(f"select content_id from etp.camp where camp_id = {int(camp_id)}") or None) if camp_id else None
        ng = _q(f"select coalesce(nhom_goc, '') from etp.phim where content_id = {int(ct)}") if ct else ''
        if ct and not ng:   # KÍN (anh 29/10/2026 "làm cho kín"): phim chưa chấm → chấm poster NGAY (nhom_goc.py, ckey ~36₫/phim); không chấm được → CHẶN
            import importlib.util as _iu
            _s = _iu.spec_from_file_location("nhom_goc", os.path.join(os.path.dirname(os.path.abspath(__file__)), "nhom_goc.py")); NG = _iu.module_from_spec(_s); _s.loader.exec_module(NG)
            ng, _chi, _ly = NG.cham(int(ct))
            if not ng: return f"phim #{ct} chưa chấm được nhóm gốc ({_ly}) — chỉ lên camp phim Âu-Mỹ đã chấm (anh 29/10/2026 'làm cho kín')"
        if ng and ng != 'au_my': return LY_AU_MY.format(ng)
        if ct and viec in ("nhan_ban", "tao_camp"):   # PHIM ĐÃ CẤT (anh 31/10/2026): thử đủ creative + đủ bộ, team không lãi → thôi lên camp mới (apps/etp/cat_phim.py)
            cl = _q(f"select coalesce(thu_ly, '') from etp.phim where content_id = {int(ct)} and thu_vong = 'cat'")
            if cl: return LY_CAT.format(ct, cl)
        ch = doc_cau_hinh()
        # NGƯỜI BẤM THẬT = VÉ (anh 18/11/2026): chỉ vé ETP_VE hợp lệ cho đúng việc + camp / phim này mới miễn phanh / bảo trì / trần camp test — không đọc chữ ai, cờ anh_bam / tay / roas
        ve = bool(ve_hop_le(viec, [camp_id] if camp_id else (), ct))
        # TRẦN TUYỆT ĐỐI $30 / CAMP (anh 14/11/2026: "Ko bao giờ tăng ngân sách vượt trần $30") — đứng trước mọi miễn trừ (ROAS, A/B, lệnh anh, bản thang):
        # không đường nào trong máy đặt một camp nhà / team quá TRAN_TUYET, kể cả khi tran_camp trong cấu hình bị sửa cao hơn
        if ns_moi is not None and float(ns_moi) > TRAN_TUYET: return f"vượt trần tuyệt đối ${TRAN_TUYET:g}/camp (anh 14/11/2026: không bao giờ vượt $30) — đang gửi ${float(ns_moi):g}"
        # DỪNG KHẨN · ÍT NƯỚC · BẢO TRÌ · PHANH CHỢ — chan_cua (cùng hàm cửa API dùng). Miễn phanh CHỈ bằng vé (anh 18/11/2026); camp thay bài bị từ chối (thay) không bị phanh.
        # Lịch sử lọt: 17/11 00:01–00:12 dòng phim máy gọi nhan-ban --tay → 91 camp; 18/11 00:46–12:51 máy AT ghi ai "anh (chat 05/11/2026: …)" → 31 camp; ★ ROAS / ngoai / lenh_anh miễn bằng cờ.
        ly_cua = chan_cua(viec, ch, camp_id, thay=thay, ve=ve)
        if ly_cua: return ly_cua
        # HOÃN TĂNG THEO GIÁ ADSENSE: ĐÃ BỎ (anh 13/11/2026 "bỏ rule Hoãn đang áp dụng") — giá AdSense tụt không còn chặn tăng / nhân bản; máy đo giá
        # (apps/etp/gia_adsense.py) vẫn đo và vẫn bù giá cho luật cắt camp mới. Tham số thay= giữ cho người gọi cũ (nhan-ban.py --thay), không còn tác dụng.
        if viec == "tang" and not roas and (ch.get("mua_le") or {}).get("khoa_tang"):   # mùa lễ Mỹ (apps/etp/mua_le.py, anh 08/11/2026): Meta học lại đúng tuần giá cao là tốn nhất
            return f"mùa lễ Mỹ: khoá tăng bậc ({(ch.get('mua_le') or {}).get('ly_do') or '25–30/11'}) — giảm / tắt / camp mới vẫn chạy (etp.cau_hinh.mua_le, apps/etp/mua_le.py)"
        # CAMP MỚI = $1 (anh 08/11/2026: "Ai cho mày lên camp mới ngân sách hơn $1" · "AB test vẫn phải đi từ $1. Nếu khác thì phải xin phép"): tạo camp / nhân bản thường
        # (kể cả camp A/B, clone sang bộ khác) gửi ngân sách > $1 → chặn. Miễn: camp ROAS (roas=True, loại anh duyệt 26/10/2026) · bản thang (bac=True, thang nhân bản anh duyệt 25/10/2026)
        if viec in ("tao_camp", "nhan_ban") and not roas and not bac and ns_moi is not None and float(ns_moi) > (NS_BAI_CU if bai_cu and viec == "nhan_ban" else 1):
            return f"camp mới phải $1 — đang gửi ${float(ns_moi):g} (anh 08/11/2026); ngân sách khác phải xin anh"
        # NẮP ROI 3 NGÀY (Dol 09/11/2026): camp thường tăng lên $X mà X > trần của dải ROI 3 ngày khép → chặn; camp ★ ROAS không áp; camp đang chạy không bị hạ (chỉ chặn tăng)
        if viec == "tang" and not roas and camp_id and ns_moi is not None and _q(f"select 1 from etp.camp where camp_id = {int(camp_id)} and la_roas") != "1":
            r3 = _q(SQL_ROI3.format(cid=int(camp_id))); nap = nap_tang(float(r3) if r3 not in ("", None) else None)
            if float(ns_moi) > nap: return f"nắp ROI 3 ngày khép ({(r3 + '%') if r3 else 'chưa có số'}) → camp thường trần ${nap:g}, không lên ${float(ns_moi):g} (Dol 09/11/2026: 30–50% ~$10 · 50–80% ~$15 · >80% ~$20, anh duyệt chỉ áp lần tăng mới)"
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
        if ct and viec in ("tao_camp", "nhan_ban") and not ve and not lenh_anh and not roas and not thay:
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
def camp_roas():
    """tập camp ROAS trong kho etp (đồng bộ 10 phút) — luật đọc API trực tiếp thì cộng thêm la_roas(tên)"""
    return {int(x) for x in _q("select camp_id from etp.camp where la_roas").split() if x.isdigit()}

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
    elif bai: tran, loai = float(NS_BAI_CU), "nhân bản bài cũ"   # theo VẬT: mọi ad chỉ mang bài đăng cũ, không creative mới
    else: tran, loai = 1.0, "camp mới"
    vuot = [(k, v) for k, v in so if v > tran]
    if vuot: return f"{loai} '{ten[:60]}' gửi {', '.join(f'{k}=${v:g}' for k, v in vuot)} > ${tran:g} — camp mới phải $1 (anh 08/11/2026), ngân sách khác phải xin anh", tran
    if not any(k == "daily_budget" for k, _ in so): return f"lệnh tạo camp '{ten[:60]}' không có daily_budget — không gửi (Ethopex có thể tự đặt mức khác)", tran
    return None, tran

def _tu_kiem():
    # PHÁ THỬ MỘT CỬA (anh 18/11/2026): phanh đang chạy → mọi lệnh máy bị chặn bất kể cờ / chữ ai; chỉ vé (ve=True) qua; thay bài bị từ chối qua; dừng khẩn chặn cả vé
    _bay = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=6)).isoformat()
    _ch = {"phanh_cho": {"phanh": {"den_tang": _bay, "den_len": _bay, "ly_do": "thử"}}}
    for _v in ("tang", "nhan_ban", "tao_camp"):
        assert chan_cua(_v, _ch, ve=False).startswith("PHANH CHỢ"), f"máy {_v} khi phanh phải bị chặn"
        assert chan_cua(_v, _ch, ve=True) is None, f"vé tay {_v} phải qua phanh"
    assert chan_cua("nhan_ban", _ch, thay=True) is None and chan_cua("giam", _ch) is None and chan_cua("tat", _ch) is None
    assert chan_cua("nhan_ban", {**_ch, "dung_khan": True}, ve=True) == LY_DUNG_KHAN and chan_cua("bat", {"dung_khan": True}, lich=True) == LY_DUNG_KHAN, "dừng khẩn chặn cả vé, cả lịch"
    assert chan_cua("bat", _ch, lich=True) is None, "bật theo lịch giờ là việc hợp lệ"
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
    assert int(TT["so"]) == 2 and _NB_MIN == (3.0, 50.0), "trần camp test / phim lệch sổ luật (anh 18/11/2026: 2 camp test, camp lãi = nấc NB $3 & +50% hoặc ROI cộng dồn dương)"
    assert la_lai(5, 6) and la_lai(3, 4.5) and la_lai(0.5, 0.6) and not la_lai(3, 3) and not la_lai(0, 0) and not la_lai(10, 4) and not la_lai(None, None), "camp lãi = thu > chi (chi > 0)"
    assert "tran_test_phim" in ly_tran_test(1, 2) and "chạm trần" in ly_tran_test(1, 2), "câu chặn phải mang khoá (dòng phim mo_tran_test) + 'chạm trần' (SQL_DONG_HONG không đếm là dòng hỏng)"
    assert '"on"' in _sql_test(1) and "camp_dang_chay" in _sql_test(1) and "la_roas" in _sql_test(1) and "ethopex_nhat_ky" in _sql_test(1)
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
    assert ns_tao(_pl(1))[0] is None
    assert ns_tao(_pl(3))[0], "camp mới $3 phải chặn"
    assert ns_tao(_pl(1, g={"daily_budget": 3}))[0], "ngân sách $3 nấp ở Ad Set phải chặn"
    assert ns_tao(_pl(1, g={"lifetime_budget": "50"}))[0], "lifetime_budget ở Ad Set phải chặn"
    assert ns_tao({"name": "X", "campaign": {"source_payload": {"name": "X"}, "ad_groups": []}})[0], "thiếu daily_budget phải chặn"
    assert ns_tao(_pl(18, bid="LOWEST_COST_WITH_MIN_ROAS"))[0] is None and ns_tao(_pl(25, bid="LOWEST_COST_WITH_MIN_ROAS"))[0], "ROAS tới $20"
    assert ns_tao(_pl(18, ten="★ ROAS 1.1 · X duplicate by 1"))[0], "tên ROAS mà không có chiến lược thầu ROAS → vẫn là camp mới $1"
    assert ns_tao(_pl(5, ten="X (thang $5 cua 87811)")) == (None, 5.0) and ns_tao(_pl(10, ten="X (thang $5 cua 87811)"))[0], "bản thang tới đúng $X"
    assert ns_tao(_pl(3, ten="X (thang $5 cua 87811) copy"))[0], "chữ thang giữa tên không tính"
    assert ns_tao(_pl(1, g={"is_adset_budget_sharing_enabled": True}))[0] is None, "cờ boolean không phải ngân sách"
    _bc = lambda ns, ad: {"name": "X", "campaign": {"source_payload": {"name": "X", "daily_budget": ns}, "ad_groups": [{"source_payload": {}, "ads": [ad]}]}}
    assert ns_tao(_bc(2, {"effective_object_story_id": "1_2"})) == (None, 2.0) and ns_tao(_bc(3, {"effective_object_story_id": "1_2"}))[0], "bài cũ tới đúng $2"
    assert ns_tao(_bc(2, {"effective_object_story_id": "1_2", "creative_id": 5}))[0] and ns_tao(_bc(2, {"creative_id": 5}))[0], "có creative mới → vẫn camp mới $1"
    print("✓ cong.py tự kiểm (nhận camp ROAS mọi kiểu tên + gốc đã có ROAS + camp mới $1 trên payload: 10 ca)")

if __name__ == "__main__":
    import sys; a = sys.argv[1:]
    if a[:1] == ["--tu-kiem"]: _tu_kiem(); sys.exit(0)
    if a[:1] == ["--xin-ve"]:   # --xin-ve <tang|bat|nhan_ban|tao_camp> <camp_id|-> <content_id|-> <người bấm> — CHỈ đường nút (VE_XIN) gọi; in mã vé
        print(xin_ve(a[1], a[2], a[3], " ".join(a[4:]))); sys.exit(0)
    if a[:1] == ["--tu-kiem-ve"]:   # trên box3: vé thật trong etp.ve_tay (camp giả 999999991, ai 'tự kiểm') — đúng / sai camp, sai việc, đốt hai lần, hết hạn
        m = xin_ve("tang", 999999991, None, "tự kiểm cong.py"); m2 = xin_ve("nhan_ban", None, 999999992, "tự kiểm cong.py")
        assert ve_hop_le("tang", [999999991], ma=m) and not ve_hop_le("tang", [999999990], ma=m) and not ve_hop_le("bat", [999999991], ma=m), "vé phải đúng việc + đúng camp"
        assert ve_hop_le("tao_camp", [], 999999992, ma=m2) and ve_hop_le("nhan_ban", [5], 999999992, ma=m2) and not ve_hop_le("nhan_ban", [5], 1, ma=m2), "vé lên camp khớp phim"
        assert ve_hop_le("tang", [999999991], dung=True, cho="tự kiểm", ma=m) and not ve_hop_le("tang", [999999991], dung=True, ma=m), "vé chỉ dùng một lần"
        _q(f"update etp.ve_tay set het_han = now() - interval '1 second' where ma = '{m2}'"); assert not ve_hop_le("nhan_ban", [], 999999992, ma=m2), "vé hết hạn"
        print("✓ vé thao tác tay: đúng việc / camp / phim, một lần, hết hạn"); sys.exit(0)
    if a[:1] == ["--xem-test"]:   # chỉ đọc: số camp test / phim lãi ổn định / chỗ còn của các phim đang chạy (trần camp test / phim, anh 18/11/2026) — không giữ chỗ
        print(_q(f"""select p.content_id || ' test ' || t.n || ' · lãi ổn định ' || t.on || ' · chỗ còn ' || coalesce({sql_test_con('p.content_id')}::text, 'không trần')
                     from (select distinct content_id from etp.camp where trang_thai = 'ACTIVE' and content_id is not null) p, lateral {_sql_test('p.content_id')} t order by t.n desc, 1 limit {int(a[1]) if len(a) > 1 else 15}""")); sys.exit(0)
    print(kiem(a[0], int(a[1]) if len(a) > 1 and a[1].isdigit() else None, float(a[2]) if len(a) > 2 else None, float(a[3]) if len(a) > 3 else 0) or "CHO QUA")
