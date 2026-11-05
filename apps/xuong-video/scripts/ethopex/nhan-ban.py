#!/usr/bin/env python3
"""NHÂN BẢN CAMP THẮNG (luật NB — anh 22/10/2026: "rule clone camp thắng ko bị giới hạn bởi số camp trong ngày. Làm sao để áp dụng tự động luôn";
"mỗi phim tối đa 30 camp thắng. Nếu có camp thua thì sẽ dành slot cho creative mới"; "nhân bản thì cũng báo lên tele").
Cùng đường nút Duplicate của Ethopex (form create-facebook?sourceCampId= → POST /api/v1/campaigns/facebook): dựng payload từ CHÍNH camp gốc
(tài khoản, Page, pixel, cấu hình Ad Set, creative, phim) — chỉ đổi tên + ngân sách $1 + lịch chạy. 1 nhóm 1 ad như mọi camp.
Chặn: camp gốc phải đang bật; phim đã có ≥ TRAN_PHIM camp ĐANG CHẠY thì thôi (camp đã tắt không tính — camp thua tắt đi là nhường chỗ).
Chạy trên box3 (khoá ở studio):
  python3 nhan-ban.py <camp_gốc>            → in payload (chạy khô, không tạo gì)
  python3 nhan-ban.py <camp_gốc> --that [--luat "…"] [--ai "…"]   → tạo, đọc lại, ghi nhật ký (ethopex_nhat_ky)
    Clone GIỮ NGUYÊN creative gốc tới trần tran_trung camp chạy / đoạn (28/10/2026), đủ trần mới đổi creative khác cùng phim; mọi camp mới / clone chỉ dùng creative máy chấm SẠCH; chỉ clone camp gốc
    đã chạm trần ngân sách (etp.cau_hinh.tran_camp, $30) (anh 25/10/2026).
  python3 nhan-ban.py <camp_khuôn> --creative <id> --content <id> --ten "<tên>" [--that …]   → camp MỚI cho creative khác trên khuôn camp đó
    (creative phải qua trước kiem-studio.sh + kiem-thoai-creative.sh; khuôn phải cùng ngôn ngữ với phim)
  python3 nhan-ban.py <camp_gốc> --thang <$> --that …   → THANG NHÂN BẢN bộ 2 (anh 25/10/2026): bản mới ở bậc ngân sách cao hơn camp gốc
    (GIỮ creative camp gốc như mọi clone — đoạn đủ trần tran_trung mới sang creative khác cùng phim; tên "(thang $X cua <gốc>)"); không đòi gốc chạm trần — camp gốc giữ nguyên ngân sách
  python3 nhan-ban.py <camp_gốc> --bo <bộ> --ep --that   → CLONE SANG BỘ KHÁC theo lệnh đích danh của anh (anh 27/10/2026: "clone 1 camp tốt
    nhất sang bộ tk 03"): giữ NGUYÊN creative camp gốc (bản CTA sửa nếu có), bỏ qua 4 cổng chỉ dành cho nhân camp trong cùng bộ — mỗi phim một bộ, chạm trần $30,
    bão hoà phim, buộc đổi creative khác (và trần 30 camp/phim); vẫn qua cổng chấm sạch + rào chắn etp. --ep chỉ dùng khi anh ra lệnh trong lượt đó.
  python3 nhan-ban.py <camp_gốc> --roas <1.0–1.4> [--ns 20] [--tam-dung] [--nhan "chay ngay"] [--mien-cham] --that …   → CAMP ROAS (tài liệu Support 26/10/2026, anh duyệt 26/10/2026):
    nhân bản camp gốc (chi all time > $100, ROI > 50%) với bid ROAS goal (LOWEST_COST_WITH_MIN_ROAS + roas_average_floor ở Ad Set),
    ad = BÀI ĐĂNG CŨ của camp gốc (use existing post — giữ tương tác), ngân sách $15–20, lịch do lich_len quyết, tên "… roas X duplicate by <gốc>".
    Camp ROAS là loại riêng: KHÔNG qua luật clone-khác-creative / cổng chấm / chạm trần / bão hoà (dùng lại đúng bài cũ); vẫn qua cổng etp; miễn trần 30 camp/phim và không chiếm chỗ camp thường (anh 26/10/2026).
    Tạo xong đọc lại: mức ROAS sai → tạm dừng camp ngay + báo lỗi (Support: "nhập sai là lỗi camp"). --tam-dung = để PAUSED chờ anh review.
  ETP_SUA_NGUOI=<nguoi_id> python3 nhan-ban.py <camp_gốc> [--roas …] --that …   → CAMP CỦA NGƯỜI TRONG TEAM (Luật tự động, anh 31/10/2026: "giống hệt nhà nhưng chỉ
    áp dụng cho tk của Sơn"; creative nhà dùng được vì cùng co-founder): lệnh đi bằng phiên Ethopex riêng của người đó, cổng chung chỉ cho tạo vào tài khoản của họ.
    Đúng luật nhà (chạm trần $30, bão hoà phim, trần đoạn, cổng chấm, 18+, bài học, rào chắn dừng khẩn / Âu-Mỹ / phim cất), trừ những thứ chỉ có nghĩa với nhà:
    sổ bộ tài khoản (mỗi phim một bộ, bộ chặn mở camp, đổi bộ), sổ CTA xưởng nhà (vẫn soát chữ QC), dựng lại CTA bằng xưởng, lịch giờ (lich-gio.py bật lại bằng
    khoá nhà → không bật được camp người khác), trần ngày / trần bộ của nhà, nhật ký nhà (worker nhắn riêng kết quả). Đếm camp đang chạy đọc kho etp.camp_ngoai.
In một dòng JSON {ok, goc, moi, ten, loi}."""
import datetime as dt, importlib.util, json, os, re, subprocess, sys, time, urllib.request

# RÀO CHẮN etp (etp.on.tc bước 3, 24/10/2026): dừng khẩn / trần camp / trần ngày / trần bộ — apps/etp/cong.py
import importlib.util as _iuc
_sc = _iuc.spec_from_file_location("etp_cong", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp", "cong.py")); CONG = _iuc.module_from_spec(_sc); _sc.loader.exec_module(CONG)
# TRẦN CAMP / PHIM: BỎ (anh 28/10/2026: "ko set tối đa … vì có rule tắt và giảm bậc rồi" — trần 30 từ 22/10 bỏ cùng trần 3 camp/đoạn; giới hạn còn lại = trần camp trùng đoạn
# tran_trung (điểm bão hoà) + cổng bão hoà phim). etp.cau_hinh.tran_phim > 0 thì đặt lại trần; 0 / không có = không trần
# 02/11/2026 anh đặt lại tran_phim = 30, tính THEO TỪNG TÀI KHOẢN NHÀ (dem_tk); tài khoản team không áp
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
TRAN_PHIM = int(float(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'tran_phim'), '0')") or 0)) or 10**6
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp")); import ethopex_api as EA   # cổng chung: chỉ tài khoản nhà (anh 28/10/2026)
def api(duong, body=None):
    r = urllib.request.Request("https://api.ethopex.dev" + duong, data=json.dumps(body).encode() if body is not None else None, method="POST" if body is not None else "GET",
                               headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-ethopex"})
    return json.load(urllib.request.urlopen(r, timeout=60))
api = lambda p, b=None: EA.api(p, b)   # mọi lệnh Ethopex qua cổng chung apps/etp/ethopex_api.py: danh sách đủ mọi trang + chỉ camp tài khoản nhà, lệnh ghi vào camp ngoài bị chặn (anh 28/10/2026)
js = lambda v: json.loads(v) if isinstance(v, str) and v.strip().startswith("{") else (v or {})
BANG_LUAT = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "web", "src", "lib", "etp-bang-luat.json")))   # sổ luật chung: khung giờ lên camp (khung_doi.len)
def lich_len(_bo_qua=None, luc=None):
    """GIỜ LÊN CAMP — MỘT CHỖ cho mọi đường lên (dòng phim · worker phim mới / KT · nhân bản · ROAS · anh bấm tay). Anh 05/11/2026 chốt theo số toàn đội
    (apps/etp/phan-tich-gio.py mục D): đồng chi đầu rơi 08–12h VN lãi 72h +$2,85/camp, chiều +$1,25, tối +$0,13, đêm +$0,32 — Meta dồn 53–62% chi 24h đầu
    vào 6 giờ đầu nên giờ lên quyết định camp học ở khung tốt hay xấu. Tạo trong khung `len` của sổ luật (07–12h VN) → chạy ngay (today); ngoài khung →
    hẹn 07:00 hôm sau (tomorrow), KỂ CẢ nhân bản ("nhân bản cũng hẹn sáng hôm sau nếu không đúng khung giờ"). --lich today|tomorrow của nơi gọi chỉ là
    gợi ý cũ bị bỏ qua — KHÔNG đường nào ép chạy ngay (anh 05/11/2026 "không cho lên ngay mà phải 100% tuân thủ")."""
    a, b = BANG_LUAT["khung_doi"]["len"]; h = ((luc or dt.datetime.now(dt.timezone.utc)).hour + 7) % 24
    return "today" if (a <= h < b if a <= b else (h >= a or h < b)) else "tomorrow"
NGOAI = EA.SUA or EA.XEM   # camp của người trong team (xem docstring) — 0 = nhà; ETP_XEM_NGUOI = chạy khô trên camp thật của người đó (cổng chặn mọi lệnh ghi)
_TK_SQL = ",".join(str(int(x)) for x in sorted(EA.TK)) or "0"

DEM_CR = {}
def dem_dang_chay(content_id):
    """số camp ĐANG CHẠY (ACTIVE hoặc chưa đồng bộ xong) của phim; kèm DEM_CR {creative: số camp đó dùng creative} (luật 1 đoạn ≤ 3 camp).
    Đọc KHO etp (dong-bo.py 10 phút/lần) + camp vừa tạo trong 15 phút qua (nhật ký luật) — trước 25/10/2026 đọc chi tiết từng camp qua API
    (~500 lượt gọi, 3–4 phút mỗi lần tạo camp)."""
    n = 0; DEM_CR.clear()
    if NGOAI:   # kho camp người trong team (dong-bo.py) — không có cột đồng bộ; camp ROAS (mọi kiểu tên) không chiếm chỗ; camp máy vừa tạo đọc lại ở nhịp sau
        for l in q(f"select camp_id, coalesce(creative_id, 0) from etp.camp_ngoai where content_id = {int(content_id)} and ad_account_id in ({_TK_SQL}) and trang_thai = 'ACTIVE' and not la_roas").splitlines():
            _, cr = l.split("|", 1)
            n += 1; DEM_CR[int(cr)] = DEM_CR.get(int(cr), 0) + 1
        return n
    rows = q(f"""select camp_id, coalesce(creative_id, 0) from etp.camp c where content_id = {int(content_id)}
                 and (camp_id in (select camp_id from etp.camp_dang_chay) or coalesce(dong_bo, '') not in ('done', 'synced'))
                 and not la_roas""").splitlines()   # view gồm camp tạm dừng theo lịch giờ · camp ROAS ★ không chiếm chỗ (dạng riêng, anh 26/10/2026)
    for l in rows:
        _, cr = l.split("|"); n += 1; DEM_CR[int(cr)] = DEM_CR.get(int(cr), 0) + 1
    # camp vừa tạo chưa vào kho (đồng bộ 10 phút): lấy từ sổ nhật ký studio
    try:
        moi = json.loads(q("""select coalesce(jsonb_agg(x), '[]'::jsonb)::text from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x where ten = 'ethopex_nhat_ky'
                              and x->>'viec' in ('tao_camp', 'nhan_ban') and (x->>'ok')::boolean and to_timestamp(x->>'luc', 'HH24:MI DD/MM/YYYY') > (now() at time zone 'Asia/Ho_Chi_Minh') - interval '15 minutes'
                              and x->>'nguoi' is null""") or "[]")   # dòng của tài khoản team (nguoi) không tính vào trần Nhà
        da = {int(l.split("|")[0]) for l in rows}
        for x in moi:
            if int(x.get("content") or x.get("content_id") or 0) == int(content_id) and int(x.get("moi") or x.get("id") or 0) not in da:
                n += 1; c = int(x.get("creative") or x.get("creative_id") or 0); DEM_CR[c] = DEM_CR.get(c, 0) + 1
    except Exception: pass
    return n

def trang_chua_san(content_id, tk):
    """CỔNG TRANG PHIM (anh 02/11/2026, tab Phim etp.on.tc): camp chỉ có trang đích khi phim đã được "thêm content" vào workspace Ethopex của NGƯỜI SỞ HỮU
    tài khoản (etp.trang_phim, apps/etp/trang_phim.py) và bản đó đủ mô tả + cốt truyện + ảnh + link tập 1 còn sống (view trang_phim_v.thieu — Ethopex tự
    sinh, có lúc trượt: 174841 Merman 02/11). → lý do chặn, hoặc None. Kho trang phim quá 2 giờ chưa đồng bộ → không chặn (lỗi đồng bộ không khoá mọi camp).
    CHƯA THÊM bản chỉ chặn ở tài khoản NHÀ: đo 7 ngày tới 02/11 — Nhà 101/101 phim lên camp đều có bản của chính Nhà, còn camp đội chạy cả phim không có bản
    (Sơn 23/110, Kiên 12/35) → với đội thiếu bản không phải thiếu trang đích; bản CÓ mà thiếu mô tả / link thì chặn mọi tài khoản."""
    if q("select coalesce(max(cap_nhat), 'epoch') > now() - interval '2 hours' from etp.trang_phim") != "t": return None
    ng = q(f"select nguoi_id || '|' || case when nha then 't' else 'f' end || '|' || nguoi from etp.tai_khoan where ad_account_id = {int(tk or 0)}") if str(tk or "").isdigit() else ""
    if ng.count("|") < 2: return None
    ng_id, nha_, ng_ten = ng.split("|", 2)
    r = q(f"select content_id || '|' || array_to_string(thieu, ', ') from etp.trang_phim_v where ref_id = {int(content_id)} and nguoi_id = {int(ng_id)} order by cardinality(thieu), sua desc limit 1")
    if not r:
        if nha_ != "t": return None
        # TỰ THÊM VÀO WORKSPACE (anh 03/11/2026: "Mày ko thêm thì đợi bố mày làm à?") — đúng nút Clone của app Ethopex: POST api-multi-be /api/v2/contents/<id>/ensure-clone
        # (đọc từ mã app 03/11/2026, idempotent). Thêm xong Ethopex sinh trang (mô tả / cốt truyện / link) — lượt đồng bộ kế (dong-bo, 10 phút) thấy bản mới thì camp lên.
        ws = them_ws(content_id)
        return (f"phim {content_id} vừa được máy thêm vào workspace Ethopex của {ng_ten} (bản #{ws}) — chờ đồng bộ trang phim rồi lên camp ở lượt sau" if ws
                else f"phim {content_id} chưa có trong workspace Ethopex của {ng_ten} và máy thêm không được (ensure-clone lỗi) — tài khoản nhà chỉ lên camp phim đã thêm")
    ws, thieu = r.split("|", 1)
    if thieu and nha_ == "t" and ("mô tả" in thieu or "cốt truyện" in thieu) and dien_trang(ws):
        # TỰ ĐIỀN MÔ TẢ / CỐT TRUYỆN (anh 03/11/2026 — bản gốc thư viện không có mô tả thì Ethopex không tự sinh cho bản workspace): từ tóm tắt của phim, $0
        # PUT lưu được = trang đủ ngay → chỉ thiếu 2 trường đó thì lên camp luôn, không chờ lượt đồng bộ (03/11/2026: 5 phim lô pm-03110155 nằm chờ vô ích)
        con = [x.strip() for x in thieu.split(",") if x.strip() and x.strip() not in ("mô tả", "cốt truyện")]
        if not con: return None
        return f"trang phim {content_id} (bản workspace #{ws}) vừa được máy điền mô tả + cốt truyện từ tóm tắt — chờ đồng bộ trang phim rồi lên camp ở lượt sau"
    return f"trang phim {content_id} (bản workspace #{ws} của {ng_ten}) còn thiếu: {thieu} — mở lại trên Ethopex cho máy sinh / sửa rồi mới lên camp" if thieu else None

def dien_trang(ws):
    """bản workspace thiếu mô tả / cốt truyện → điền từ tóm tắt (short_description) bằng PUT api-multi-be /api/v2/movie/contents/<ws> (lệnh lưu của app Ethopex,
    gửi lại nguyên bản + 2 trường) → True khi lưu được. Không gọi AI ($0)."""
    import html, urllib.request
    T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'"); H = {"authorization": "Bearer " + T, "user-agent": "mos2-etp", "content-type": "application/json"}
    u = f"https://api-multi-be.ethopex.dev/api/v2/movie/contents/{int(ws)}"
    try:
        it = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=H), timeout=60))["item"]
        tt = (it.get("short_description") or "").strip(); ten = (it.get("title") or "").strip()
        if not tt: return False
        moi = {}
        if not (it.get("storyline") or "").strip(): moi["storyline"] = tt
        if not (it.get("description") or "").strip():
            doan = "".join(f"<p>{html.escape(x.strip())}</p>" for x in tt.split("\n") if x.strip())
            moi["description"] = (f"<h2>Introduction</h2><p><strong>{html.escape(ten)}</strong> is a short drama series.</p><h2>The Story</h2>{doan}"
                                  f"<h2>Watch Now</h2><p>Watch the full series of {html.escape(ten)} free.</p>")
        if not moi: return False
        urllib.request.urlopen(urllib.request.Request(u, data=json.dumps({**it, **moi}).encode(), headers=H, method="PUT"), timeout=60)
        return True
    except Exception:
        return False

def them_ws(content_id):
    """thêm phim thư viện vào workspace Nhà (ensure-clone, idempotent) → mã bản workspace, None khi lỗi"""
    import urllib.request
    T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
    try:
        r = urllib.request.urlopen(urllib.request.Request(f"https://api-multi-be.ethopex.dev/api/v2/contents/{int(content_id)}/ensure-clone", method="POST",
                                                          headers={"authorization": "Bearer " + T, "user-agent": "mos2-etp"}), timeout=60)
        d = json.load(r); d = d.get("data", d) if isinstance(d, dict) else {}
        return int(d.get("id") or 0) or None
    except Exception:
        return None

def giu_boi_nguoi_khac(content_id, tk):
    """NHẬN PHIM (anh 02/11/2026: thành viên nhận phim, giữ quyền 24 giờ, quá hạn chưa lên camp thì nhả): phim đang được NGƯỜI KHÁC giữ (etp.phim_nhan_v giu)
    → lý do chặn; người sở hữu tài khoản đang giữ / đã lên / chưa ai nhận → None"""
    ng = q(f"select nguoi_id from etp.tai_khoan where ad_account_id = {int(tk or 0)}") if str(tk or "").isdigit() else ""
    if not ng.isdigit(): return None
    r = q(f"select coalesce(nguoi, '?') || '|' || to_char(het_luc at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') from etp.phim_nhan_v where content_id = {int(content_id)} and trang_thai = 'giu' and nguoi_id <> {int(ng)} order by nhan_luc desc limit 1")
    return f"phim {content_id} đang được {r.split('|')[0]} giữ quyền lên camp tới {r.split('|')[1]} (nhận phim trên etp.on.tc)" if "|" in r else None

def nhan_boi_chu_tk(content_id, tk):
    """phim đang được CHÍNH người sở hữu tài khoản này giữ (nhận phim trên etp.on.tc) → True. Anh 02/11/2026 "Bộ 2": phim Nhà nhận lên bộ 2,
    người đã chọn phim thì miễn cổng bo_chi_phim_lai (cổng đó chặn phim tự trôi vào bộ 2, không chặn phim có người nhận)"""
    ng = q(f"select nguoi_id from etp.tai_khoan where ad_account_id = {int(tk or 0)}") if str(tk or "").isdigit() else ""
    return ng.isdigit() and q(f"select 1 from etp.phim_nhan_v where content_id = {int(content_id)} and trang_thai = 'giu' and nguoi_id = {int(ng)} limit 1") == "1"

def dem_tk(content_id, tk):
    """TRẦN 30 CAMP / PHIM THEO TỪNG TÀI KHOẢN NHÀ (anh 02/11/2026 "Set lại 30 cho mọi camp nhà. Và theo từng tk"): camp đang chạy / đang đồng bộ
    của phim ở ĐÚNG tài khoản sẽ nhận camp mới; camp ROAS ★ không chiếm chỗ. Thiếu tài khoản trong payload → đếm cả phim (chặt hơn, không lọt)."""
    loc = f" and ad_account_id = {int(tk)}" if str(tk or "").isdigit() else ""
    return int(q(f"""select count(*) from etp.camp where content_id = {int(content_id)}{loc}
                     and (camp_id in (select camp_id from etp.camp_dang_chay) or coalesce(dong_bo, '') not in ('done', 'synced'))
                     and not la_roas""") or 0)

# MỘT ĐOẠN VIDEO TỐI ĐA 3 CAMP ĐANG CHẠY (anh duyệt 23/10/2026 sau Step Back: 12 camp cùng đoạn 692–757s tự đấu giá với nhau, ROI +199% → −11% trong một ngày).
# Nhân bản mà creative đã đủ 3 camp → tự đổi sang creative khác CÙNG PHIM (đạt CTA, chưa bị Meta từ chối, còn < 3 camp, mới nhất trước);
# phim chưa có creative nào như vậy → xếp hàng cắt GÓC MỚI ['ethopex_can_goc_moi'] (sua-cta.py trên iMac cắt + đẩy, rồi nhân bản lại) và dừng.
# 28/10/2026 anh: "ko nhất thiết phải cắt bản mới và ko set tối đa 3 camp mỗi đoạn nữa vì có rule tắt và giảm bậc rồi. Tuy nhiên tìm điểm bão hoà hợp lý để set max camp trùng"
# → trần = etp.cau_hinh.tran_trung (mặc định 20): đo 22–27/10 trên creative thắng (nhà + team), bản 1–20 ROI +58…+72% tiêu ~$30/camp, bản 21–30 chỉ tiêu $13, 31+ $5 / ROI +28% — Meta hết phân phối
CLONE_KHAC_CR_DEN = dt.date(2026, 11, 9)   # tạm dừng clone đổi creative (anh 02/11/2026) — hết ngày này máy tự mở lại
TRAN_DOAN = int(float(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'tran_trung'), '20')") or 20))
def doan_cua():
    """creative → đoạn (content, tu, den) từ studio — hai creative cùng mốc là CÙNG ĐOẠN (bản CTA cũ + bản sửa CTA của Step Back #52951 / #53594, 24/10/2026)"""
    m = {}
    for l in q("select (kinh_thanh->'ethopex'->>'creative_id'), kinh_thanh->'ethopex'->>'content_id', round((kinh_thanh->'ethopex'->>'tu')::numeric), round((kinh_thanh->'ethopex'->>'den')::numeric) from xv_phim where project='ethopex' and kinh_thanh->'ethopex' ? 'tu' and coalesce(kinh_thanh->'ethopex'->>'tu','') <> ''").splitlines():
        x = l.split("|")
        if len(x) == 4 and x[0].isdigit(): m[int(x[0])] = (x[1], x[2], x[3])
    # bản sửa CTA cắt lại cùng cảnh từ tập sạch → mốc khác bản cũ: nối theo ethopex_cta_thay {cũ: mới} (cũ mang đoạn của mới)
    t = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_thay'") or "{}")
    for cu, moi in t.items(): m[int(cu)] = m.get(int(moi), ("cr", str(moi), ""))
    return m
_DOAN = None
def dem_doan(cr):
    """số camp đang chạy dùng cùng ĐOẠN với creative cr (gộp mọi creative cùng phim + cùng mốc); creative không rõ đoạn → đếm theo creative"""
    global _DOAN
    if _DOAN is None: _DOAN = doan_cua()
    d = _DOAN.get(cr)
    return sum(n for c, n in DEM_CR.items() if (_DOAN.get(c) == d if d else c == cr))
def cung_doan_dang_chay(cr):
    """creative mới cr trùng ĐOẠN (cùng phim + cùng mốc giây) với camp đang chạy / vừa tạo dù creative mang mã khác → mã creative đó, không thì None.
    03/11/2026 lô pm-03110155: máy tự lên 8 camp lúc 03:12–03:51, Claude chạy tay `phim-moi.py len` lại → tải lại thành creative mới #64996–#65005, cổng
    'một creative một camp' chỉ so mã nên lên trùng 8 camp (Elf King 4 camp cho 2 đoạn), anh bắt tắt. Đoạn lấy từ etp.creative.doan, thiếu thì từ studio."""
    global _DOAN
    if _DOAN is None: _DOAN = doan_cua()
    ids = [c for c, n in DEM_CR.items() if n > 0 and c != cr] + [cr]
    db = dict(l.split("|", 1) for l in q(f"select creative_id || '|' || doan from etp.creative where doan is not null and creative_id in ({','.join(str(int(c)) for c in ids)})").splitlines() if "|" in l)
    def d(c):
        if db.get(str(c)): return db[str(c)]
        x = _DOAN.get(c)
        return f"{x[0]}:{x[1]}-{x[2]}" if x and x[0] != "cr" else None
    dc = d(cr)
    return next((c for c in ids[:-1] if dc and d(c) == dc), None) if dc else None
def camp_moi_hom_nay(content_id):
    """LUẬT MỘT CAMP MỖI LẦN (anh 03/11/2026: "Chỉ đc lên từng camp mỗi lần. Luật."): phim đã có một camp MỚI (tao_camp, không tính nhân bản thang) trong
    ngày (giờ VN) hoặc camp của phim còn đang đồng bộ → mã camp đó, creative khác của phim chờ lượt sau. Gốc: lô pm-03110155 lên 2 đoạn = 2 camp cùng lúc,
    rồi lượt chạy lại thêm 2 nữa → Elf King 4 camp một lúc."""
    r = q(f"""select coalesce((select x->>'id' from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x where ten = 'ethopex_nhat_ky' and x->>'viec' = 'tao_camp'
              and (x->>'ok')::boolean and x->>'nguoi' is null and (x->>'content')::text = '{int(content_id)}'
              and to_timestamp(x->>'luc', 'HH24:MI DD/MM/YYYY')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date order by x->>'luc' desc limit 1),
              (select camp_id::text from etp.camp where content_id = {int(content_id)} and coalesce(dong_bo, '') not in ('done', 'synced', 'error') limit 1), '')""")
    return r or None
def creative_khac(content_id, bo_qua):
    dat = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_dat'") or "{}")
    tc = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_tu_choi'") or "{}")
    ds = [int(x) for x in q(f"select (kinh_thanh->'ethopex'->>'creative_id') from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {int(content_id)} order by 1 desc").split() if x.isdigit()]
    return next((c for c in ds if c not in bo_qua and str(c) in dat and str(c) not in tc and dem_doan(c) < TRAN_DOAN), None)
# CỔNG CHẤM CREATIVE: view etp.cham_cong (migration 0341 — MỘT nguồn, anh 26/10/2026): bất kỳ tiêu chí Meta / GG (afs.*) ≤ 4 → chặn;
# có tiêu chí = 5 → chặn tới khi người duyệt Đạt (Telegram / lich-gio.py --duyet). Chưa chấm → xếp hàng etp.cham_hang.
def cham_sach(cr):
    k = q(f"select duoc_len::text || '|' || coalesce(chan_boi, '') from etp.cham_cong where creative_id = {int(cr)}")
    if not k:
        q(f"insert into etp.cham_hang (creative_id, nguon, ai) values ({int(cr)}, 'moi', 'nhan-ban: chờ chấm trước khi lên') on conflict (creative_id) do nothing")
        return f"creative #{cr} chưa được máy chấm — đã xếp hàng chấm, lượt sau mới lên"
    duoc, chan = k.split("|", 1)
    return None if duoc == "true" else f"creative #{cr} bị cổng chấm chặn ({chan}) — không lên"

# CLONE PHẢI KHÁC CREATIVE (anh 25/10/2026: "clone camp thì phải khác creative một chút, chặt chẽ hơn"): bản nhân bản KHÔNG dùng lại creative
# của camp gốc, cũng không dùng creative đang có camp chạy của cùng phim — chọn creative khác cùng phim (đạt CTA, chưa bị Meta từ chối,
# đoạn < 3 camp, chấm sạch, mới nhất trước); không có → xếp hàng cắt góc mới, không clone y nguyên.
def creative_clone(content_id, cr_goc):
    dat = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_dat'") or "{}")
    tc = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_tu_choi'") or "{}")
    ds = [int(x) for x in q(f"select (kinh_thanh->'ethopex'->>'creative_id') from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {int(content_id)} order by 1 desc").split() if x.isdigit()]
    for c in ds:
        if c == cr_goc or DEM_CR.get(c, 0) > 0 or str(c) not in dat or str(c) in tc or dem_doan(c) >= TRAN_DOAN: continue
        if cham_sach(c) is None: return c
    return None

def xep_goc_moi(goc_id, content_id, ten):
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_can_goc_moi', '{}'::jsonb) on conflict (ten) do nothing")
    v = json.dumps({"goc": goc_id, "ten": ten, "luc": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")}, ensure_ascii=False).replace("'", "''")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{int(content_id)}', '{v}'::jsonb) where ten='ethopex_can_goc_moi' and not gia_tri ? '{int(content_id)}'")

def _nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(os.path.dirname(os.path.abspath(__file__)), tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m

def cong(content_id, creative_id, ten=""):
    """cổng phim 18+ (kiem-phim-18.py) + cổng CTA (kiem-cta.py) + sổ bài học (bai-hoc.py: không lên lại đúng đoạn/dạng đã lỗ) — anh 22/10/2026"""
    chan = _nap("p18", "kiem-phim-18.py").kiem(content_id) or _nap("cta", "kiem-cta.py").kiem(creative_id, so=not NGOAI)
    if chan: return chan
    c, w = _nap("bh", "bai-hoc.py").da_lo(content_id, ten)
    if w: print(w, file=sys.stderr)
    return c

# NHÂN BẢN CAMP THẮNG MANG CTA CŨ (anh 23/10/2026: "việc nhân bản một camp CTA sai rồi sửa lại thì vẫn gọi là nhân bản"): creative của camp gốc
# chưa đạt luật CTA → dùng BẢN SỬA đúng luật của chính đoạn đó (studio xv_khoa_ngoai['ethopex_cta_thay'] {creative cũ: creative sửa}, ghi bởi
# ghi-cta-thay.py — len-creative.py gọi khi dựng lại cho camp_cu). Chưa có bản sửa → xếp hàng dựng lại ['ethopex_cho_dung_lai'] thay vì chặn rồi bỏ.
def ban_sua(creative_id):
    v = q(f"select gia_tri->>'{int(creative_id)}' from xv_khoa_ngoai where ten='ethopex_cta_thay'")
    return int(v) if v and v.isdigit() else None
def xep_dung_lai(goc_id, creative_id, content_id, ten):
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_cho_dung_lai', '{}'::jsonb) on conflict (ten) do nothing")
    v = json.dumps({"goc": goc_id, "content_id": content_id, "ten": ten, "luc": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")}, ensure_ascii=False).replace("'", "''")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{int(creative_id)}', '{v}'::jsonb) where ten='ethopex_cho_dung_lai' and not gia_tri ? '{int(creative_id)}'")

# BỘ TÀI KHOẢN QC + FANPAGE (anh 23/10/2026: "1 bộ tk fb ads - fanpage mới: chỉ dành cho các phim mới, ko liên quan đến phim bộ tk khác; nhịp đăng,
# giới hạn camp, ngân sách vẫn như tk đầu tiên"). Sổ studio xv_khoa_ngoai['ethopex_bo_tk'] {bộ: {tk, ext, page, ten}}; mỗi PHIM thuộc đúng MỘT bộ —
# sổ ['ethopex_phim_tk'] {content_id: bộ}, ghi khi tạo camp; phim đã ở bộ này thì không lên bộ kia (cổng chan_bo).
def bo_tk(bo):
    v = q(f"select gia_tri->'{bo}' from xv_khoa_ngoai where ten='ethopex_bo_tk'")
    if not v: raise ValueError(f"không có bộ tài khoản '{bo}' trong ethopex_bo_tk")
    return json.loads(v)
def bo_cua_camp(c):
    v = q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_bo_tk'")
    return next((k for k, b in (json.loads(v) if v else {}).items() if int(b["tk"]) == int(c.get("ad_account_id") or 0)), None)
def chan_bo(content_id, bo):
    v = q(f"select gia_tri->>'{int(content_id)}' from xv_khoa_ngoai where ten='ethopex_phim_tk'")
    return f"phim {content_id} thuộc bộ tài khoản {v} — không lên bộ {bo} (mỗi phim một bộ, anh 23/10/2026)" if v and v != str(bo) else None
def ghi_bo(content_id, bo):
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_phim_tk', '{}'::jsonb) on conflict (ten) do nothing")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{int(content_id)}', '{bo}') where ten='ethopex_phim_tk' and not gia_tri ? '{int(content_id)}'")

def lich_ap(moi, content_id):
    """CAMP MỚI THEO LỊCH GIỜ NGAY KHI TẠO (anh 26/10/2026: "nếu camp thuộc luồng tắt như đang kế hoạch thì camp mới lên cũng phải áp dụng luôn"): thể loại của phim đang ở
    khung TẮT (hoặc 15 phút nữa sang khung TẮT — cùng TRUOC_PHUT với apps/etp/lich-gio.py) thì tạm dừng ngay + ghi etp.lich_tat → lich-gio tự bật lại khi tới khung BẬT.
    Không đợi lượt đồng bộ kế (camp mới vào kho chậm 10–20 phút, chạy giữa khung lỗ)."""
    import datetime as dt
    if q("select gia_tri::text from etp.cau_hinh where khoa = 'lich_gio'") != "true": return None
    tl = q(f"select coalesce(the_loai, '_khac') from etp.phim where content_id = {int(content_id)}") or "_khac"
    vn = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)
    tat = [k for k in {q(f"select etp.khung_vn({vn.hour})"), q(f"select etp.khung_vn({(vn + dt.timedelta(minutes=15)).hour})")}
           if q(f"select coalesce((select bat from etp.lich_gio where the_loai = '{tl}' and khung = '{k}'), (select bat from etp.lich_gio where the_loai = '_khac' and khung = '{k}'), true)") == "f"]
    if not tat: return None
    r = api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [int(moi)], "status": "paused"}])
    d0 = (r.get("data") or [{}])[0]
    if d0 and d0.get("ok") is False: return f"chưa tạm dừng theo lịch: {d0.get('error')}"
    q(f"insert into etp.lich_tat (camp_id, the_loai, khung) values ({int(moi)}, '{tl}', '{tat[0]}') on conflict do nothing")
    return f"tạm dừng theo lịch giờ ({tl} · khung {tat[0]} TẮT) — máy tự bật lại khi tới khung BẬT"

def _cau_hinh(khoa, mac):   # một sổ với luat-ethopex.py: etp.cau_hinh thang_bo / thang_muc (migration 0333)
    v = q(f"select gia_tri::text from etp.cau_hinh where khoa = '{khoa}'")
    return json.loads(v) if v else mac
THANG_BO = [str(x) for x in _cau_hinh("thang_bo", ["2"])]
THANG_MUC = {float(x) for x in _cau_hinh("thang_muc", [1, 3, 7, 15, 30]) if float(x) > 1}   # bậc mở bản mới (trừ bậc đầu $1)
BO_DANG_CHAN = {str(k): set(v) for k, v in _cau_hinh("bo_dang_chan", {}).items()}   # bộ → dạng creative không lên camp mới (migration 0394, anh 01/11/2026 "bộ 2 chỉ lên cảnh cuối")
BO_CHI_PHIM_LAI = {str(x) for x in _cau_hinh("bo_chi_phim_lai", [])}   # bộ chỉ mở camp cho phim đã lãi 7 ngày ở bộ đó (migration 0399, anh 02/11/2026 "chặn mở camp phim mới" ở bộ 2)
ROAS_MIN, ROAS_MAX = 1.0, 1.4
def payload(goc_id, lich, moi=None, bo=None, thang=None, roas=None, ns_roas=20, nhan=None, ep=False):
    """moi = {creative, content, ten}: KHÔNG nhân bản mà dựng camp MỚI cho creative khác trên khuôn camp gốc (cùng tài khoản/Page/pixel/Ad Set/ngôn ngữ)
    — anh 22/10/2026 "camp cùng phim thì chủ động thêm góc khác"; trước đó phải đi br form (dung-camp.sh)."""
    d = api(f"/api/v1/campaigns/{goc_id}"); c = d["campaign"]; g = (d.get("ad_groups") or [{}])[0]; a = (g.get("ads") or [{}])[0]
    # ROAS: chọn theo số all time, camp gốc tắt rồi vẫn dùng được bài đăng. moi (--creative): camp gốc chỉ là KHUÔN cấu hình (Ad Set, pixel, nước, ngôn ngữ),
    # creative thay hẳn → khuôn tạm dừng vẫn dùng được (26/10/2026: khuôn #65110 / #65734 bị tắt vì creative QC spy → mọi lượt lên camp mới gãy "camp gốc đang PAUSED")
    # ep (sang bộ khác theo lệnh anh, 28/10/2026 "lên bộ 3 như bộ 1"): camp thắng bộ 1 đã bị luật chấm tắt vẫn là khuôn + bài đăng dùng được
    if c.get("state") != "ACTIVE" and not roas and not moi and not ep: raise ValueError(f"camp gốc đang {c.get('state')}")
    if len(d.get("ad_groups") or []) != 1 or len(g.get("ads") or []) != 1: raise ValueError("camp gốc không đúng khuôn 1 nhóm 1 ad")
    if roas:
        # mức ROAS ĐẦU tên (anh 26/10/2026 "đặt thêm chỉ số ROAS vào tên camp để kiểm tra cho tiện" — bảng Ethopex cắt mất đuôi); đuôi "roas X duplicate by <gốc>" giữ cho máy đọc
        ten = f"★ ROAS {roas:g} · {re.sub(r'^\d+:\s*', '', c['name'])}{f' {nhan}' if nhan else ''} roas {roas:g} duplicate by {goc_id}"   # nhan: phân biệt bản cùng mức (vd "chay ngay")   # ★ = dấu camp ROAS (anh 26/10/2026), cong.la_roas nhận theo tên
    elif moi:
        ten = moi["ten"]; a = {**a, "creative_id": moi["creative"], "content_id": moi["content"]}
    else:
        goc_ten = re.sub(r"\s*\((nhan ban \d+|thang \$\d+) cua \d+\)$", "", c["name"])
        so = 1 + sum(1 for x in api("/api/v1/campaigns?page_size=500")["data"] if re.search(rf"\(nhan ban \d+ cua {goc_id}\)$", x.get("name", "")))
        ten = f"{goc_ten} (thang ${thang:g} cua {goc_id})" if thang else f"{goc_ten} (nhan ban {so} cua {goc_id})"
        # NHÂN BẢN GIỮ NGUYÊN CREATIVE CỦA CAMP GỐC (anh 02/11/2026 "$1. Lên đi" — nhân bản từ bản CTA cũ): trước đây CTA cũ bị đổi sang bản sửa CTA
        # (ethopex_cta_thay, nút đè từ giây 3) hoặc chặn + xếp hàng dựng lại → đo cùng phim 25/10–02/11: bản sửa −7% vs CTA cũ +33%, thua 9/10 phim. Bỏ đổi.
    # BỎ mọi mã định danh + mốc thời gian của camp GỐC (chạy khô 22/10/2026: source_payload Ad Set mang campaign_id FB + start_time của camp gốc
    # → gửi nguyên là gắn nhầm vào camp gốc / chạy theo lịch cũ). Lịch của bản mới do type_run quyết.
    BO = {"id", "campaign_id", "adset_id", "account_id", "start_time", "end_time", "stop_time", "created_time", "updated_time", "effective_status", "configured_status", "issues_info"}
    sp_c = {k: v for k, v in js(c.get("source_payload")).items() if k not in BO}; sp_c.update(name=ten, daily_budget=int(thang) if thang else 1, status="PAUSED")   # số nguyên như lam-ethopex tang (bậc thang đều là $ nguyên)
    tk, ext, page = c.get("ad_account_id"), c.get("external_account_id"), a.get("facebook_page_id")
    bo = None if NGOAI else (bo or bo_cua_camp(c) or "1")   # người trong team: không có bộ — dựng đúng tài khoản / Page của camp gốc
    if bo and bo_cua_camp(c) != str(bo):   # dựng trên khuôn camp của bộ khác → đổi đúng 3 trường tài khoản / Page (pixel dùng chung, bài đăng FB tạo mới)
        b = bo_tk(bo); tk, ext, page = int(b["tk"]), str(b["ext"]), int(b["page"])
    sp_g = {k: v for k, v in js(g.get("source_payload")).items() if k not in BO}; sp_g.update(name=f"{ten} · adset")
    if roas:   # đúng đường form Ethopex (bid strategy cấp campaign + roas_average_floor cấp Ad Set, tối ưu VALUE) — đọc từ mã app 26/10/2026
        sid = (a.get("effective_object_story_id") or "").strip()
        if not re.fullmatch(r"\d+_\d+", sid): raise ValueError(f"camp gốc #{goc_id} không có mã bài đăng (effective_object_story_id) để dùng lại")
        if bo and str(bo) != str(bo_cua_camp(c)): raise ValueError("camp ROAS dùng bài đăng của camp gốc → phải cùng bộ tài khoản / Page với camp gốc")
        sp_c.update(bid_strategy="LOWEST_COST_WITH_MIN_ROAS", daily_budget=int(ns_roas))
        sp_g.update(optimization_goal="VALUE", bid_constraints={"roas_average_floor": roas}); sp_g.pop("bid_amount", None)
        return d, ten, a.get("content_id"), {
            "name": ten, "pixel_id_arb": d.get("pixel_id"), "ad_account_id": tk, "facebook_page_id": page, "bo": str(bo) if bo else None,
            "external_account_id": ext,
            "campaign": {"source_payload": sp_c, "ad_groups": [{"type_run": lich, "source_payload": sp_g,
                "ads": [{"effective_object_story_id": sid, "source_payload": {"name": ten, "status": "ACTIVE"}}]}]}}
    return d, ten, a.get("content_id"), {
        "name": ten, "pixel_id_arb": d.get("pixel_id"), "ad_account_id": tk, "facebook_page_id": page, "bo": str(bo) if bo else None,
        "external_account_id": ext,
        "campaign": {"source_payload": sp_c, "ad_groups": [{"type_run": lich, "source_payload": sp_g,
            "ads": [{"content_id": a.get("content_id"), "creative_id": a.get("creative_id"), "facebook_page_id": page, "domain": a.get("domain") or "",
                     "source_payload": {"name": ten, "status": "ACTIVE"}}]}]}}

class ChanLuat(ValueError):
    """LUẬT CHẶN, KHÔNG PHẢI LỖI (anh 27/10/2026: ⚠302 trên cây camp gồm cả "chưa chạm trần $30" — máy đúng luật mà bị đếm là nhân bản hỏng):
    cổng trần ngân sách / trần phim / bão hoà / cổng chấm / chặn bộ… → nhật ký ghi ok = NULL (bỏ qua); ValueError thường vẫn là lỗi thật (ok = false)"""

def ghi_nhat_ky(kq, luat, ai):
    import nhat_ky   # apps/etp/nhat_ky.py — một đường ghi, chặn dòng lỗi lặp (nhịp gọi lại mỗi phút khi cổng chặn)
    nhat_ky.ghi(q, {"viec": kq.get("viec") or "nhan_ban", "id": kq.get("moi") or kq.get("goc"), "goc": kq.get("goc"),
                    "truoc": None, "sau": (kq.get("ns") or 1) if kq.get("ok") else None, "ok": kq.get("ok"), "loi": kq.get("loi"), "luat": luat or "(không ghi luật)", "ai": ai or "?", "content": kq.get("content"), "creative": kq.get("creative"),
                    **({"nguoi": EA.SUA or EA.XEM} if NGOAI else {})})   # team cũng ghi (anh 02/11/2026: sổ luật đo được việc máy làm cho Sơn / Kiên); nguoi tách khỏi đếm Nhà

def main(a):
    goc = int(a[0]); that = "--that" in a
    tay = "--tay" in a   # camp anh yêu cầu bằng tay (dòng phim etp.on.tc) → miễn luật không trùng phim với đội (cong.kiem tay=True), 04/11/2026
    lay = lambda k, md=None: next((a[i + 1] for i, x in enumerate(a[:-1]) if x == k), md)
    lich, luat, ai = lich_len(), lay("--luat"), lay("--ai")   # giờ chạy do lich_len quyết, --lich của nơi gọi không còn nghĩa (anh 05/11/2026)
    moi = {"creative": int(lay("--creative")), "content": int(lay("--content")), "ten": lay("--ten")} if lay("--creative") else None
    ep = "--ep" in a and bool(lay("--bo")); mien_cham = "--mien-cham" in a   # clone sang bộ khác theo lệnh anh — xem docstring
    bo = lay("--bo"); thang = float(lay("--thang")) if lay("--thang") else None
    if thang and (moi or thang not in THANG_MUC): raise SystemExit(f"--thang phải là một trong {sorted(THANG_MUC)} và không đi kèm --creative")
    if moi and not (moi["content"] and moi["ten"]): raise SystemExit("--creative cần kèm --content và --ten")
    roas = float(lay("--roas")) if lay("--roas") else None
    if roas is not None:
        if moi or thang: raise SystemExit("--roas không đi kèm --creative / --thang")
        if not ROAS_MIN <= roas <= ROAS_MAX: raise SystemExit(f"--roas phải trong {ROAS_MIN}–{ROAS_MAX} (Support 26/10/2026)")
        return roas_main(goc, roas, int(float(lay("--ns", "20"))), lich, that, "--tam-dung" in a, luat, ai, lay("--nhan"), "--mien-cham" in a, tay)
    kq = {"ok": False, "goc": goc, "moi": None, "ten": None, "loi": None, "chay": lich}
    try:
        d, ten, cid, pl = payload(goc, lich, moi, bo, thang, ep=ep); kq["ten"] = ten; bo = pl.pop("bo")
        ly = None if NGOAI else (None if ep else chan_bo(cid, bo)) or (None if moi or ep else q(f"select etp.bo_chan_mo_camp('{bo}', {int(goc)})"))   # bộ có camp ĐÃ TĂNG vẫn lỗ 3 ngày khép → ngừng nhân bản / thang; camp mới $1 không chặn (0339); camp gốc tự thắng (3 ngày khép ROI ≥ 30%) thì miễn (0372, anh 30/10/2026)
        if ly: raise ChanLuat(ly)
        if moi: kq["viec"] = "tao_camp"
        if moi and not NGOAI and BO_DANG_CHAN.get(str(bo)):
            dg = q(f"select coalesce(dang, '') from etp.creative where creative_id = {int(moi['creative'])}")
            if dg in BO_DANG_CHAN[str(bo)]: raise ChanLuat(f"bộ {bo} chỉ lên dạng khác {', '.join(sorted(BO_DANG_CHAN[str(bo)]))} — creative #{moi['creative']} là {dg} (etp.cau_hinh.bo_dang_chan, anh 01/11/2026)")
        if not NGOAI and not ep and str(bo) in BO_CHI_PHIM_LAI and not nhan_boi_chu_tk(cid, pl.get("ad_account_id")):   # phim chủ tài khoản đang nhận thì miễn (anh 02/11/2026 "Bộ 2") · mọi đường mở camp (creative mới, clone, thang) — phim mới / phim lỗ ở bộ này không mở thêm
            pc, pt = (float(x or 0) for x in (q(f"select coalesce(sum(s.chi), 0), coalesce(sum(s.thu), 0) from etp.so_ngay s join etp.camp c using (camp_id) where c.bo = '{bo}' and c.content_id = {int(cid)} and s.ngay between (now() at time zone 'UTC')::date - 7 and (now() at time zone 'UTC')::date - 1") or "0|0").split("|"))
            if pt <= pc: raise ChanLuat(f"bộ {bo} chỉ mở camp cho phim đã lãi 7 ngày ở bộ này — phim {cid}: chi ${pc:.2f} · lãi ${pt - pc:+.2f} (etp.cau_hinh.bo_chi_phim_lai, anh 02/11/2026)")
        _nhan_bb = q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'nhan_bat_buoc'), 'true')") != "false"   # anh 04/11/2026 tạm bỏ nhận (chỉ anh chạy) — migration 0418
        if _nhan_bb and not NGOAI and not ep and moi and q(f"select 1 from etp.camp where content_id = {int(cid)} limit 1") != "1" and not nhan_boi_chu_tk(cid, pl.get("ad_account_id")):   # NHẬN PHIM BẮT BUỘC (anh 02/11/2026 "cho vào luật bắt buộc"): phim mới của Nhà phải được nhận trước khi lên camp đầu
            raise ChanLuat(f"phim mới {cid} chưa nhận — nhận phim trên etp.on.tc (tab Phim) trước khi lên camp (luật bắt buộc, anh 02/11/2026)")
        if not ep and (ly_ := trang_chua_san(cid, pl.get("ad_account_id")) or giu_boi_nguoi_khac(cid, pl.get("ad_account_id"))): raise ChanLuat(ly_)   # + phim người khác đang giữ (anh 02/11/2026)   # cổng trang phim (anh 02/11/2026); ROAS đi roas_main, không qua đây
        chan = cong(cid, pl["campaign"]["ad_groups"][0]["ads"][0]["creative_id"], ten)
        if chan: raise ChanLuat(chan)
        n = dem_dang_chay(cid)
        if moi and DEM_CR.get(int(moi["creative"]), 0) > 0:   # một creative một camp mới (25/10/2026: hai lượt lên camp chạy cùng lúc tạo trùng 3 camp)
            raise ChanLuat(f"creative #{moi['creative']} đã có camp đang chạy / vừa tạo — không tạo camp thứ hai")
        _lt = json.loads(q(f"select coalesce((select gia_tri->'{int(cid)}' from etp.cau_hinh where khoa = 'lo_trinh'), '{{}}'::jsonb)::text") or "{}")   # phim ở lộ trình test rộng, anh đã bắt đầu → miễn luật một camp (anh 03/11/2026 chọn A)
        _mr = q(f"select 1 from etp.dong_phim where content_id = {int(cid)} and trang_thai = 'chay' and coalesce(so_camp, 0) > 0 limit 1") == "1"   # anh bấm mở rộng, chọn số camp (04/11/2026) → miễn luật một camp
        _cr = int(moi["creative"]) in [int(v) for v in (_lt.get("cr") or [])] if moi else False   # anh bấm lên camp ĐÚNG creative này ở tab Sản xuất (#1520, 04/11/2026) → miễn luật một camp
        if moi and not ep and not _lt.get("bat_dau") and not _mr and not _cr and (cm := camp_moi_hom_nay(cid)):
            raise ChanLuat(f"phim {cid} đã lên camp mới #{cm} hôm nay — mỗi lần chỉ lên MỘT camp cho một phim, creative #{moi['creative']} chờ lượt sau (luật anh 03/11/2026)")
        if moi and not ep and (tr := cung_doan_dang_chay(int(moi["creative"]))):
            raise ChanLuat(f"creative #{moi['creative']} cùng đoạn với creative #{tr} đã có camp đang chạy / vừa tạo — không lên trùng đoạn (anh 03/11/2026)")
        if not ep and not NGOAI and (ntk := dem_tk(cid, pl.get("ad_account_id"))) >= TRAN_PHIM:   # trần tính theo TỪNG tài khoản nhà (anh 02/11/2026)
            raise ChanLuat(f"phim {cid} đã {ntk} camp đang chạy ở tài khoản {pl.get('ad_account_id')} (trần {TRAN_PHIM}/tài khoản) — chỗ còn lại để creative mới khi camp thua tắt")
        if thang:   # thang nhân bản: chỉ bộ 2, bậc mới phải cao hơn ngân sách camp gốc
            ns = float((d.get("campaign") or {}).get("budget_daily") or 0)
            if str(bo) not in THANG_BO: raise ChanLuat(f"thang nhân bản chỉ áp dụng bộ {', '.join(THANG_BO)} (camp gốc thuộc bộ {bo}) — bộ khác giữ tăng bậc (etp.cau_hinh.thang_bo)")
            # bản thang của BẢN THANG phải cao hơn nó; camp gốc thường thì bản thang đầu đi từ đáy (≤ bậc thứ hai) — anh 27/10/2026 "phải nhân từ $1 - $3 lên"
            la_ban_thang = bool(re.search(r"\(thang \$\d+ cua \d+\)$", (d.get("campaign") or {}).get("name") or ""))
            tran_dau = sorted(THANG_MUC | {1.0})[1] if len(THANG_MUC) else 3
            if la_ban_thang and thang <= ns: raise ValueError(f"bậc ${thang:g} không cao hơn bản thang gốc ${ns:g}")
            if not la_ban_thang and thang > tran_dau: raise ChanLuat(f"bản thang đầu của camp gốc thường tối đa ${tran_dau:g} (đi từ đáy $1–$3), không mở thẳng ${thang:g}")
        elif not moi and not ep:   # CHỈ CLONE CAMP ĐÃ CHẠM TRẦN NGÂN SÁCH (anh 25/10/2026: "không tạo trùng nếu camp hiện tại chưa đạt $30 budget tối đa") — trần = etp.cau_hinh.tran_camp
            tran = float(q("select coalesce((select gia_tri::text::numeric from etp.cau_hinh where khoa = 'tran_camp'), 30)") or 30)
            ns = float((d.get("campaign") or {}).get("budget_daily") or 0)
            if ns < tran: raise ChanLuat(f"camp gốc #{goc} mới ${ns:g}/ngày, chưa chạm trần ${tran:g} — chưa clone (tăng ngân sách camp gốc trước)")
        if not ep and not NGOAI:   # CỔNG BÃO HOÀ PHIM (B, anh 25/10/2026): mọi đường mở camp thường của nhà — nhân bản, thang, góc mới, CREATIVE MỚI (02/11/2026 "không lên camp mới"); camp ROAS đi roas_main, không qua cổng này; tài khoản team chỉ cảnh báo (canh-bao.py bao_hoa_team)
            try: bh = q(f"select chan_nb from etp.phim_bao_hoa where content_id = {int(cid)} and chan_nb is not null")
            except Exception: bh = ""
            if bh and (not moi or bh.startswith("bão hoà")): raise ChanLuat(f"phim {cid} đang bão hoà — {bh} → không mở thêm camp (dồn tiền sang phim khác)")   # creative mới chỉ chặn khi đúng lý do bão hoà (lên thêm camp mà ROI giảm / giảm 2 ngày liền)
        ad0 = pl["campaign"]["ad_groups"][0]["ads"][0]; cr = ad0["creative_id"]
        if ep: kq["viec"] = "sang_bo"
        elif not moi:   # clone GIỮ NGUYÊN creative gốc tới trần TRAN_DOAN camp chạy / đoạn (anh 28/10/2026); đoạn đã đủ trần → creative khác cùng phim
            if dem_doan(cr) >= TRAN_DOAN:
                # TẠM DỪNG CLONE SANG CREATIVE KHÁC (anh 02/11/2026 duyệt review luật: 74 clone đổi creative ROI −1%, clone giữ creative +46%) tới hết
                # CLONE_KHAC_CR_DEN để đo lại — đoạn đủ trần thì chặn, vẫn xếp hàng cắt góc mới; creative mới đi đường --creative (camp mới), không qua đây.
                if dt.date.today() <= CLONE_KHAC_CR_DEN:
                    xep_goc_moi(goc, cid, ten)
                    raise ChanLuat(f"đoạn creative #{cr} đã {dem_doan(cr)} camp chạy (trần {TRAN_DOAN}) — clone sang creative khác tạm dừng tới {CLONE_KHAC_CR_DEN:%d/%m} (đo lại), đã xếp hàng cắt góc mới")
                khac = creative_clone(cid, cr)
                if not khac:
                    xep_goc_moi(goc, cid, ten)
                    raise ChanLuat(f"đoạn creative #{cr} đã {dem_doan(cr)} camp chạy (trần {TRAN_DOAN}, điểm bão hoà) và phim chưa có creative khác sạch — đã xếp hàng cắt góc mới")
                chan = cong(cid, khac, ten)
                if chan: raise ChanLuat(chan)
                ad0["creative_id"] = khac; kq["doi_creative"] = {"tu": cr, "sang": khac}; cr = khac
        elif dem_doan(cr) >= TRAN_DOAN:
            khac = creative_khac(cid, {cr})
            if not khac:
                xep_goc_moi(goc, cid, ten)
                raise ChanLuat(f"đoạn creative #{cr} đã {dem_doan(cr)} camp chạy (trần {TRAN_DOAN}/đoạn), phim chưa có góc khác — đã xếp hàng cắt góc mới (ethopex_can_goc_moi)")
            chan = cong(cid, khac, ten)
            if chan: raise ChanLuat(chan)
            ad0["creative_id"] = khac; kq["doi_creative"] = {"tu": cr, "sang": khac}
        kq["content"], kq["creative"] = cid, ad0["creative_id"]   # nhật ký mang phim + creative → dem_dang_chay đếm được camp vừa tạo chưa vào kho
        ly = cham_sach(ad0["creative_id"])   # cổng chấm: creative cuối cùng phải SẠCH
        if ly and ep and mien_cham: kq["mien_cham"] = ly; ly = None   # --mien-cham chỉ đi cùng --ep (lệnh đích danh của anh)
        if ly: raise ChanLuat(ly)
        kq["phim_dang_chay"] = n
        ly = CONG.kiem("tao_camp" if moi else "nhan_ban", None, thang or 1, 0, str(bo) if bo else None, content_id=cid, ngoai=bool(NGOAI), tay=tay)
        if ly: raise ChanLuat(ly)
        if not that:
            print(json.dumps({**kq, "ok": True, "chay_kho": True, "payload": pl}, ensure_ascii=False)); return
        r = api("/api/v1/campaigns/facebook", pl)
        moi = r.get("id") or (r.get("data") or {}).get("id") or (r.get("campaign") or {}).get("id")
        if not moi:   # đọc lại theo tên nếu API không trả id
            time.sleep(3); moi = next((x["id"] for x in api("/api/v1/campaigns?page_size=20")["data"] if x.get("name") == ten), None)
        if not moi: raise ValueError(f"Ethopex không trả camp mới: {str(r)[:160]}")
        for _ in range(12):
            time.sleep(5); c = api(f"/api/v1/campaigns/{moi}")["campaign"]
            if c.get("sync_status") in ("done", "synced") or c.get("error"): break
        kq.update(ok=not c.get("error"), moi=moi, dong_bo=c.get("sync_status"), loi=c.get("error") or None, bo=bo, ns=c.get("budget_daily"))
        if mien_cham and ep: q(f"update etp.cau_hinh set gia_tri = gia_tri || to_jsonb({int(moi)}), luc = now() where khoa = 'cham_mien' and not gia_tri @> to_jsonb({int(moi)})")
        if thang and kq["ok"] and float(c.get("budget_daily") or 0) != thang:   # Ethopex không nhận ngân sách lúc tạo → đặt lại ngay (camp mới chưa học gì)
            api("/api/v1/campaigns/update", {"campaign": {"campaign_id": moi, "source_payload": {"daily_budget": int(thang)}}}); time.sleep(8)
            kq["ns"] = api(f"/api/v1/campaigns/{moi}")["campaign"].get("budget_daily")
        if kq["ok"] and not NGOAI:
            ghi_bo(cid, bo)
            try: kq["lich"] = lich_ap(moi, cid)
            except Exception as e: kq["lich"] = f"lỗi áp lịch giờ: {str(e)[:80]}"
    except ChanLuat as e:
        kq.update(ok=None, chan=True, loi=str(e)[:240])   # bỏ qua theo luật — nhật ký ok NULL
    except Exception as e:
        loi_may(kq, e)
    if that: ghi_nhat_ky(kq, luat, ai)
    print(json.dumps(kq, ensure_ascii=False))

def loi_may(kq, e):
    """PHÂN LOẠI LỖI (05/11/2026: 3 lượt ROAS chết NameError lúc 00:09 bị worker coi như "luật từ chối" → nghỉ gốc cả ngày, không ai sửa).
    ValueError = luật / trạng thái từ chối có lý do (worker giữ gốc tới hết ngày). OSError (mạng, HTTP 502, hết giờ) = máy → may, nhịp sau thử lại.
    Mọi lỗi khác (NameError, TypeError, KeyError…) = LỖI MÃ → may (thử lại, bản sửa tự lên ở nhịp sau) + chữ "LỖI MÃ" để Mạnh mục 7 báo Telegram ngay."""
    ma = not isinstance(e, (ValueError, OSError))
    kq.update(loi=(f"LỖI MÃ {type(e).__name__}: " if ma else "") + str(e)[:220], may=ma or isinstance(e, OSError))

def roas_main(goc, roas, ns, lich, that, tam_dung, luat, ai, nhan=None, mien_cham=False, tay=False):   # tay truyền từ main (05/11/2026: thiếu → NameError, 3 lượt ROAS 00:09 chết)
    """CAMP ROAS — loại riêng (anh 26/10/2026: "Camp ROAS là 1 dạng riêng"): bỏ các luật nhân bản thường, giữ cổng etp + trần phim + mỗi phim một bộ."""
    kq = {"ok": False, "viec": "roas", "goc": goc, "moi": None, "ten": None, "roas": roas, "loi": None, "chay": lich}
    try:
        if not 15 <= ns <= 20: raise ValueError("ngân sách camp ROAS $15–20 (Support 26/10/2026)")
        d, ten, cid, pl = payload(goc, lich, bo=None, roas=roas, ns_roas=ns, nhan=nhan); kq["ten"] = ten; bo = pl.pop("bo")
        ly = None if NGOAI else chan_bo(cid, bo)
        if ly: raise ValueError(ly)
        # CAMP ROAS KHÔNG QUA CỔNG CHẤM (anh 29/10/2026: "Camp roas lên ko cần chấm lại" — thay luật 26/10 "áp cho mọi loại camp"): ad ROAS = đúng bài đăng
        # của camp gốc đang chạy lãi (lãi 30 ngày ≥ $75), không phải creative mới. Điểm chấm chỉ ghi vào nhật ký để xem; luật chấm lich-gio cũng bỏ qua camp ★.
        cr_goc = q(f"select creative_id from {'etp.camp_ngoai' if NGOAI else 'etp.camp'} where camp_id = {int(goc)}")
        ly = cham_sach(int(cr_goc)) if cr_goc.isdigit() and int(cr_goc) > 0 else None
        if ly: kq["mien_cham"] = ly
        # camp ROAS là dạng riêng, miễn mọi luật (anh 26/10/2026) — kể cả trần 30 camp/phim: không bị chặn, cũng không chiếm chỗ camp thường (dem_dang_chay bỏ ★)
        if any(x.get("name") == ten for x in api("/api/v1/campaigns?page_size=500")["data"]): raise ValueError(f"đã có camp '{ten}' — không tạo trùng")
        ly = CONG.kiem("nhan_ban", None, ns, 0, str(bo) if bo else None, content_id=cid, ngoai=bool(NGOAI), tay=tay)
        if ly: raise ValueError(ly)
        kq["content"] = cid
        if not that:
            print(json.dumps({**kq, "ok": True, "chay_kho": True, "payload": pl}, ensure_ascii=False)); return
        r = api("/api/v1/campaigns/facebook", pl)
        moi = r.get("id") or (r.get("data") or {}).get("id") or (r.get("campaign") or {}).get("id")
        if not moi:
            time.sleep(3); moi = next((x["id"] for x in api("/api/v1/campaigns?page_size=20")["data"] if x.get("name") == ten), None)
        if not moi: raise ValueError(f"Ethopex không trả camp mới: {str(r)[:160]}")
        kq["moi"] = moi
        if mien_cham: q(f"update etp.cau_hinh set gia_tri = gia_tri || to_jsonb({int(moi)}), luc = now() where khoa = 'cham_mien' and not gia_tri @> to_jsonb({int(moi)})")
        # ĐỢI ĐỒNG BỘ XONG HẲN (#70162, 26/10/2026: lệnh tạm dừng gửi lúc còn 'creating_adset' bị Ethopex đè — đồng bộ xong camp tự về ACTIVE)
        for _ in range(150):   # Meta kiểm ad (checking_ads) có lúc > 15 phút (#70162, #70174 26/10/2026) — chờ tới 20 phút
            time.sleep(8); d2 = api(f"/api/v1/campaigns/{moi}"); c = d2["campaign"]
            if c.get("sync_status") in ("done", "error") or c.get("error"): break
        if c.get("error"): raise ValueError("Ethopex báo lỗi: " + str(c.get("error"))[:200])
        if c.get("sync_status") != "done": raise ValueError(f"camp #{moi} chưa đồng bộ xong sau 20 phút ({c.get('sync_status')}) — chưa đọc lại / tạm dừng được, kiểm tay")
        if float(c.get("budget_daily") or 0) != ns:   # Ethopex có lúc không nhận ngân sách lúc tạo → đặt lại
            api("/api/v1/campaigns/update", {"campaign": {"campaign_id": moi, "source_payload": {"daily_budget": ns}}}); time.sleep(8)
            d2 = api(f"/api/v1/campaigns/{moi}"); c = d2["campaign"]
        g = js(((d2.get("ad_groups") or [{}])[0]).get("source_payload"))
        san = (g.get("bid_constraints") or {}).get("roas_average_floor")
        san = float(san) / 10000 if san is not None and float(san) > 100 else (float(san) if san is not None else None)   # Meta lưu ×10000
        kq.update(ns=c.get("budget_daily"), chien_luoc=c.get("source_bidding_strategy"), roas_doc_lai=san, target_roas=c.get("target_roas"), trang_thai=c.get("state"), dong_bo=c.get("sync_status"))
        sai = c.get("source_bidding_strategy") not in (None, "", "LOWEST_COST_WITH_MIN_ROAS") or san is None or abs(san - roas) > 1e-6
        if sai or tam_dung:
            api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [moi], "status": "paused"}])
            for _ in range(15):
                time.sleep(5); tt = api(f"/api/v1/campaigns/{moi}")["campaign"]
                if tt.get("state") == "PAUSED" and tt.get("source_status") == "PAUSED": break
            kq["tam_dung"] = tt.get("state") == "PAUSED"; kq["trang_thai"] = tt.get("state")
            if not kq["tam_dung"]: raise ValueError(f"đã gửi lệnh tạm dừng nhưng camp #{moi} vẫn {tt.get('state')} — tắt tay ngay")
        if sai: raise ValueError(f"đọc lại sai ROAS (đặt {roas}, Ethopex {san}, chiến lược {c.get('source_bidding_strategy')}) — đã tạm dừng camp")
        kq["ok"] = True
        if not NGOAI: ghi_bo(cid, bo)
    except Exception as e:
        loi_may(kq, e)
    if that: ghi_nhat_ky(kq, luat, ai)
    print(json.dumps(kq, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1:])
