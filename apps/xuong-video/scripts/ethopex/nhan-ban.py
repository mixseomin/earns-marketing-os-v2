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
    có ngân sách ≥ etp.cau_hinh.nb_ns_goc ($9, anh 06/11/2026; 25/10–06/11 = chạm trần tran_camp).
  python3 nhan-ban.py <camp_khuôn> --creative <id> --content <id> --ten "<tên>" [--that …]   → camp MỚI cho creative khác trên khuôn camp đó
    (creative phải qua trước kiem-studio.sh + kiem-thoai-creative.sh; khuôn phải cùng ngôn ngữ với phim)
  python3 nhan-ban.py <camp_gốc> --thang <$> --that …   → THANG NHÂN BẢN bộ 2 (anh 25/10/2026): bản mới ở bậc ngân sách cao hơn camp gốc
    (GIỮ creative camp gốc như mọi clone — đoạn đủ trần tran_trung mới sang creative khác cùng phim; tên "(thang $X cua <gốc>)"); không đòi gốc chạm trần — camp gốc giữ nguyên ngân sách
  python3 nhan-ban.py <camp_gốc> --bo <bộ> --ep --that   → CLONE SANG BỘ KHÁC theo lệnh đích danh của anh (anh 27/10/2026: "clone 1 camp tốt
    nhất sang bộ tk 03"): giữ NGUYÊN creative camp gốc (bản CTA sửa nếu có), bỏ qua 4 cổng chỉ dành cho nhân camp trong cùng bộ — mỗi phim một bộ, chạm trần $30,
    bão hoà phim, buộc đổi creative khác (và trần 30 camp/phim); vẫn qua cổng chấm sạch + rào chắn etp. --ep chỉ dùng khi anh ra lệnh trong lượt đó.
  python3 nhan-ban.py <camp_gốc> --roas <0.9–1.4> [--ns 5] [--tam-dung] [--nhan "chay ngay"] [--mien-cham] --that …   → CAMP ROAS (tài liệu Support 26/10/2026, anh duyệt 26/10/2026):
    nhân bản camp gốc (chi all time > $100, ROI > 50%) với bid ROAS goal (LOWEST_COST_WITH_MIN_ROAS + roas_average_floor ở Ad Set),
    ad = BÀI ĐĂNG CŨ của camp gốc (use existing post — giữ tương tác), ngân sách $5–20 (Dol 22/11/2026: camp mới $5; trước $15–20), lịch do lich_len quyết, tên "… roas X duplicate by <gốc>".
    Camp ROAS là loại riêng: KHÔNG qua luật clone-khác-creative / cổng chấm / chạm trần / bão hoà (dùng lại đúng bài cũ); vẫn qua cổng etp; miễn trần 30 camp/phim và không chiếm chỗ camp thường (anh 26/10/2026).
    Tạo xong đọc lại: mức ROAS sai → tạm dừng camp ngay + báo lỗi (Support: "nhập sai là lỗi camp"). --tam-dung = để PAUSED chờ anh review.
  python3 nhan-ban.py <camp_khuôn> --roas 1 --creative <id> --content <id> --ten "<tên>" [--bo <bộ>] [--ns 5] --that …   → ★ ROAS TỪ CREATIVE MỚI (anh 18/11/2026,
    đợt lên hồi chợ apps/etp/hoi_cho.py — sổ luật hoi_cho): ad = creative mới (chấm Sạch, chưa có camp), ngân sách $5–10 (ns_khoang), tên "★ ROAS 1 · <tên> roas 1".
  python3 nhan-ban.py <camp_gốc> --hoi-cho --nac --that …   → NHÂN BẢN BÀI CŨ của camp từng lãi trước đợt sụt (đợt hồi chợ): gốc đã tắt vẫn dùng được bài đăng; không dùng được bài cũ thì thôi.
  ETP_SUA_NGUOI=<nguoi_id> python3 nhan-ban.py <camp_gốc> [--roas …] --that …   → CAMP CỦA NGƯỜI TRONG TEAM (Luật tự động, anh 31/10/2026: "giống hệt nhà nhưng chỉ
    áp dụng cho tk của Sơn"; creative nhà dùng được vì cùng co-founder): lệnh đi bằng phiên Ethopex riêng của người đó, cổng chung chỉ cho tạo vào tài khoản của họ.
    Đúng luật nhà (chạm trần $30, bão hoà phim, trần đoạn, cổng chấm, 18+, bài học, rào chắn dừng khẩn / Âu-Mỹ / phim cất), trừ những thứ chỉ có nghĩa với nhà:
    sổ bộ tài khoản (mỗi phim một bộ, bộ chặn mở camp, đổi bộ), sổ CTA xưởng nhà (vẫn soát chữ QC), dựng lại CTA bằng xưởng, lịch giờ (lich-gio.py bật lại bằng
    khoá nhà → không bật được camp người khác), trần ngày / trần bộ của nhà, nhật ký nhà (worker nhắn riêng kết quả). Đếm camp đang chạy đọc kho etp.camp_ngoai.
In một dòng JSON {ok, goc, moi, ten, loi}."""
import datetime as dt, importlib.util, json, os, re, subprocess, sys, time, urllib.request

# TRẦN SONG SONG + NHƯỜNG CPU — đặt TRƯỚC mọi việc nặng của tệp (nạp cong.py, psql, Ethopex), chỉ khi chạy như lệnh (dong_phim.py nạp tệp làm module thì bỏ qua).
# 19/11 và 20/11/2026 19:40 VN box3 rỗi 0% suốt 80 giây: dong_phim.py mở mỗi dòng một tiến trình → 10–18 bản nhan-ban.py cùng lúc, chồng nạp spy + next build.
# Bản trước chỉ nice 10 ở đầu main() — lúc đó phần nạp đầu tệp đã chạy ở nice 0, và không có trần số bản. Giờ: nice 10 ngay đây + tối đa SONG_SONG bản cùng
# lúc (flock khe /run/lock/etp-nhan-ban.<k>), bản dư ngủ chờ khe (không ăn CPU). Chờ quá hạn thì chạy luôn (không làm hỏng lượt lên camp / nút anh bấm có hạn
# 120–170 giây); cờ --anh (anh bấm tay) chờ ngắn hơn. Không đổi luật lên camp — chỉ xếp hàng.
SONG_SONG = 2
def _giu_khe(cho_toi_da):
    import fcntl
    thu_muc = "/run/lock" if os.access("/run/lock", os.W_OK) else "/tmp"
    het = time.time() + cho_toi_da
    while True:
        for k in range(SONG_SONG):
            f = open(os.path.join(thu_muc, f"etp-nhan-ban.{k}"), "a")
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB); return f   # giữ tệp mở tới hết tiến trình = giữ khe
            except OSError:
                f.close()
        if time.time() >= het:
            print(f"nhan-ban: chờ khe quá {cho_toi_da}s ({SONG_SONG} bản đang chạy) — chạy luôn", file=sys.stderr); return None
        time.sleep(0.5)
if __name__ == "__main__":
    if sys.platform.startswith("linux") and os.nice(0) < 10: os.nice(10 - os.nice(0))
    if sys.platform.startswith("linux"): _KHE = _giu_khe(20 if "--anh" in sys.argv else 90)

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
HOI_CHO = BANG_LUAT["hoi_cho"]   # đợt lên hồi chợ (anh 18/11/2026): ★ ROAS creative mới — mức ROAS + ngân sách ns trong ns_khoang
def chay_luc(lich, luc=None):
    """LÚC CAMP THỰC SỰ CHẠY (anh 10/11/2026 "khi nhân bản phải ghi rõ ngày, giờ sẽ thực sự active"): today = ngay khi Ethopex / Meta đồng bộ xong · tomorrow = 07:00 VN hôm sau"""
    now = luc or dt.datetime.now(dt.timezone.utc); vn = now + dt.timedelta(hours=7)
    if lich == "today": return f"chạy ngay khi Ethopex / Meta đồng bộ xong (~2–20 phút, từ {vn:%H:%M %d/%m} giờ VN)"
    mai = (vn + dt.timedelta(days=1)) if vn.hour >= int(BANG_LUAT["khung_doi"]["len"][0]) else vn
    return f"hẹn chạy 07:00 {mai:%d/%m} giờ VN (ngoài khung lên {BANG_LUAT['khung_doi']['len'][0]}–{BANG_LUAT['khung_doi']['len'][1]}h)"

def lich_len(_bo_qua=None, luc=None):
    """GIỜ LÊN CAMP — MỘT CHỖ cho mọi đường lên (dòng phim · worker phim mới / KT · nhân bản · ROAS · anh bấm tay). Anh 05/11/2026 chốt theo số toàn đội
    (apps/etp/phan-tich-gio.py mục D): đồng chi đầu rơi 08–12h VN lãi 72h +$2,85/camp, chiều +$1,25, tối +$0,13, đêm +$0,32 — Meta dồn 53–62% chi 24h đầu
    vào 6 giờ đầu nên giờ lên quyết định camp học ở khung tốt hay xấu. Tạo trong khung `len` của sổ luật (07–12h VN) → chạy ngay (today); ngoài khung →
    hẹn 07:00 hôm sau (tomorrow), KỂ CẢ nhân bản ("nhân bản cũng hẹn sáng hôm sau nếu không đúng khung giờ"). --lich today|tomorrow của nơi gọi chỉ là
    gợi ý cũ bị bỏ qua — KHÔNG đường nào ép chạy ngay (anh 05/11/2026 "không cho lên ngay mà phải 100% tuân thủ")."""
    a, b = BANG_LUAT["khung_doi"]["len"]; h = ((luc or dt.datetime.now(dt.timezone.utc)).hour + 7) % 24
    return "today" if (a <= h < b if a <= b else (h >= a or h < b)) else "tomorrow"
def gio_roas(luc=None):
    """GIỜ LÊN ★ ROAS (anh 22/11/2026 "Làm luôn" — so Sơn ↔ Nhà sau reset 20/11: ★ ROAS của Sơn lên ~23h VN, camp nhà 07–08h): khung_doi.len_roas [từ, tới) giờ VN.
    Tạo trong khung → None (chạy ngay); ngoài khung → "YYYY-MM-DD HH:MM" giờ VN của lần mở khung kế tiếp (Ad Set lịch Custom qua dat_gio).
    Chỉ áp camp ★ ROAS (roas_main); giờ anh đặt (--gio) và bản nhân đôi ROAS của roas_doi.py (--roas-doi, lên sáng theo lich_len) đứng trên."""
    a, b = BANG_LUAT["khung_doi"]["len_roas"]; vn = (luc or dt.datetime.now(dt.timezone.utc)) + dt.timedelta(hours=7)
    if (a <= vn.hour < b if a <= b else (vn.hour >= a or vn.hour < b)): return None
    d = vn.date() if vn.hour < a else vn.date() + dt.timedelta(days=1)
    return f"{d.isoformat()} {int(a):02d}:00"
def gio_len(tu=None, luc=None):
    """GIỜ LÊN CAMP = HAI KHUNG CỐ ĐỊNH (anh 24/11/2026 "Tất cả đều phải lên theo 1 trong 2 khung giờ cố định như vậy. Cái nào gần nhất thì lên vào khung đó.
    Cấm tự lên ngay !!" — khuôn giờ lên của Kiên: start_time Ad Set 15:00 UTC = 22:00 VN, đọc API 40 camp Kiên 24/11; anh chốt "chuyển về khung 22h đêm" 24/11/2026; anh 25/11/2026 thêm khung 07h sáng: "2 khung gần nhất là 22h tối và 7h sáng hôm sau"): trả "YYYY-MM-DD HH:MM" giờ VN của khung khung_doi.len_gio GẦN NHẤT, không sớm hơn
    bây giờ + len_gio_cach_phut và không sớm hơn `tu` (giờ anh đặt, giờ VN). MỌI đường lên (thường · ★ ROAS · vé trực tiếp · đổi giờ · bản nhân · A/B) đi qua đây
    rồi dat_gio → Ad Set lịch Custom; không đường nào trả "chạy ngay"."""
    if isinstance(tu, GioTuDo): return tu   # #1869 giờ anh tự đặt ngoài khung (vé trực tiếp, đã cảnh báo ở nút) — giữ đúng giờ
    kd = BANG_LUAT["khung_doi"]; ds = sorted(int(x) for x in kd["len_gio"])
    som = (luc or dt.datetime.now(dt.timezone.utc)).replace(tzinfo=None) + dt.timedelta(hours=7, minutes=int(kd.get("len_gio_cach_phut", 10)))
    if tu: som = max(som, dt.datetime.strptime(tu.strip().replace("T", " ")[:16], "%Y-%m-%d %H:%M"))
    for n in range(3):
        for h in ds:
            k = dt.datetime.combine(som.date() + dt.timedelta(days=n), dt.time(h))
            if k >= som: return f"{k:%Y-%m-%d %H:%M}"
    raise ValueError("khung_doi.len_gio rỗng")
def gio_chay(gio=None, ngay=False, tu_do=False, luc=None):
    """GIỜ CHẠY CỦA MỘT LỆNH: --ngay → None (chạy ngay) · --gio-tu-do (etp2 #1869, anh 25/11/2026 "Vẫn cho edit tự do nhưng sẽ cảnh báo !!": anh gõ giờ ngoài
    hai khung, nút đã cảnh báo) → GIỮ ĐÚNG giờ anh đặt · còn lại → khung cố định gio_len. Tự do chỉ đến từ vé TRỰC TIẾP (main kiểm) — máy tự lên vẫn hai khung."""
    if ngay: return None
    return gio_len(GioTuDo(gio.strip().replace("T", " ")[:16]) if tu_do and gio else gio, luc)
class GioTuDo(str):
    """chuỗi "YYYY-MM-DD HH:MM" giờ VN anh tự đặt (--gio-tu-do) — mang theo ý "đừng dời về khung" qua mọi lần gọi gio_len (main → roas_main)."""
NGOAI =EA.SUA or EA.XEM   # camp của người trong team (xem docstring) — 0 = nhà; ETP_XEM_NGUOI = chạy khô trên camp thật của người đó (cổng chặn mọi lệnh ghi)
_TK_SQL = ",".join(str(int(x)) for x in sorted(EA.TK)) or "0"
def _ap_nuoc(pl, nh):   # A/B kieu 'nuoc': danh sách nước của nhánh vào Ad Set
    sp = pl["campaign"]["ad_groups"][0]["source_payload"]; tg = dict(sp.get("targeting") or {})
    tg["geo_locations"] = {**(tg.get("geo_locations") or {}), "countries": list(nh["nuoc"])}; sp["targeting"] = tg
def _ap_gio(pl, nh):   # A/B kieu 'gio' (AB05, anh 10/11/2026 "lên 10% theo khung mới để test"): nhánh có gio_utc → Ad Set lịch Custom, chạy lúc gio_utc:00 UTC kế tiếp
    # (Ethopex: type_run 'custom' + start_time "YYYY-MM-DD HH:MM:00" — đúng dạng form Budget & schedule › Custom gửi, app.ethopex.dev Un/Vn). Nhánh không có gio_utc = lịch lich_len.
    if nh.get("gio_utc") is None: return
    g = int(nh["gio_utc"]); bay = dt.datetime.now(dt.timezone.utc); ngay = bay.date() if bay.hour < g else bay.date() + dt.timedelta(days=1)
    ag = pl["campaign"]["ad_groups"][0]; ag["type_run"] = "custom"; ag["start_time"] = f"{ngay.isoformat()} {g:02d}:00:00"
    ag.get("source_payload", {}).pop("start_time", None)
def dat_gio(pl, gio_vn, ai="anh đặt"):
    """GIỜ CHẠY ANH ĐẶT (nút etp2 ▶ Lên / 🕒 đổi giờ — anh 22/11/2026 "tao có thể điều chỉnh ngày, giờ lên camp"): "YYYY-MM-DD HH:MM" giờ VN → Ad Set lịch Custom
    start_time UTC (cùng dạng _ap_gio). Chỉ gọi khi lệnh mang vé TRỰC TIẾP. Trả chữ lúc chạy cho kq.chay_luc."""
    vn = dt.datetime.strptime(gio_vn.strip()[:16], "%Y-%m-%d %H:%M"); utc = vn - dt.timedelta(hours=7)
    if utc < dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) - dt.timedelta(minutes=2): raise ValueError(f"giờ chạy {vn:%H:%M %d/%m} VN đã qua — chọn giờ sau bây giờ")
    ag = pl["campaign"]["ad_groups"][0]; ag["type_run"] = "custom"; ag["start_time"] = f"{utc:%Y-%m-%d %H:%M}:00"
    ag.get("source_payload", {}).pop("start_time", None)
    return f"hẹn chạy {vn:%H:%M %d/%m} giờ VN ({ai})"
def thay_cho(cu, moi, gio):
    """ĐỔI GIỜ CAMP ĐÃ ĐẨY LÊN ETHOPEX (anh 22/11/2026 "dừng hẳn rồi lên camp mới với giờ đã set, nếu ko thể xoá"): Ethopex không có lệnh sửa start_time Ad Set →
    camp mới đúng giờ đã tạo xong thì TẠM DỪNG camp cũ, gỡ khỏi etp.lich_tat (lich-gio không bật lại), ghi sổ etp.cau_hinh 'camp_doi_gio'. Trả chữ kết quả."""
    r = api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [int(cu)], "status": "paused"}])
    d0 = (r.get("data") or [{}])[0]
    if d0 and d0.get("ok") is False: raise ValueError(f"đã tạo camp mới #{moi} nhưng CHƯA tạm dừng được camp cũ #{cu}: {d0.get('error')} — tắt #{cu} ngay")
    q(f"delete from etp.lich_tat where camp_id = {int(cu)}")
    q("insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('camp_doi_gio', '{}'::jsonb, 'camp chờ chạy anh đổi giờ trên etp2: cũ → mới (cũ đã tạm dừng)', 'nhan-ban.py') on conflict (khoa) do nothing")
    j = json.dumps({str(int(cu)): {"moi": int(moi), "gio": gio, "luc": dt.datetime.now(dt.timezone.utc).isoformat()}}, ensure_ascii=False).replace("'", "''")
    q(f"update etp.cau_hinh set gia_tri = gia_tri || '{j}'::jsonb, luc = now() where khoa = 'camp_doi_gio'")
    return f"đã tạm dừng camp cũ #{cu}"
AP = {"nuoc": _ap_nuoc}
AP["gio"] = _ap_gio   # mỗi KIỂU A/B một hàm đặt tham số nhánh vào payload — thêm kiểu mới = thêm một dòng ở đây + một dòng etp.ab
def ab_ap(pl, lich, goc, moi, roas=False, cr=None):
    """SỔ A/B etp.ab (migration 0426 — anh 05/11/2026 "nhiều kiểu thử khác nhau … đặt tên lần thử này để dễ nắm bắt"): mã AB01, AB02… · kieu = biến thử · nhánh thu / doi.
    Camp nhà (không ROAS) có ngày chạy đầu trong [bat_dau, ket_thuc] của một lần A/B đang chạy → chia nhánh theo tên camp (crc32 chẵn = thu, lẻ = doi), đặt tham số nhánh vào payload.
    Ngoài khung ngày: clone / thang của camp nhánh thu giữ tham số (payload chép Ad Set gốc) + mang cùng mã; camp MỚI dựng trên khuôn nhánh thu trả về tham số nhánh doi.
    roas=True (camp ★ ROAS): không chia nhánh, chỉ NỐI mã của camp gốc nhánh thu — payload ROAS chép nguyên Ad Set gốc nên đã mang tham số nhánh.
    Trả (ma, nhanh) để ghi etp.camp_ab sau khi tạo, hoặc None. Lỗi đọc sổ KHÔNG nuốt ở đây — nơi gọi ghi kq["ab_loi"]."""
    if NGOAI: return None
    # ngày chạy đầu = NGÀY ETHOPEX (UTC): "tomorrow" = 00:00 UTC kế tiếp. Bản cũ lấy ngày VN → camp tạo 00:00–07:00 VN (hẹn 07:00 cùng ngày VN) bị tính sang hôm sau, lọt khung A/B (06/11/2026)
    hn = dt.datetime.now(dt.timezone.utc).date(); chay = (hn if lich == "today" else hn + dt.timedelta(days=1)).isoformat()
    ab = None if roas else json.loads(q(f"select row_to_json(a)::text from etp.ab a where trang_thai = 'dang' and kieu in ({','.join(repr(k) for k in AP)}) and '{chay}'::date between bat_dau and coalesce(ket_thuc, bat_dau) order by ma limit 1") or "null")
    if ab:
        import zlib
        dang = (q(f"select coalesce(dang, '') from etp.creative where creative_id = {int(cr)}") or "") if cr else ""
        if ab.get("moi_dang"):
            # HẠN MỨC MỖI ĐỊNH DẠNG (anh 05/11/2026 "AB01 chỉ áp dụng hạn chế ở mỗi định dạng đến khi chứng minh được hiệu quả. Còn mặc định vẫn là các nước như hiện tại"):
            # đếm camp đang chạy / chờ chạy / vừa tạo của từng nhánh cùng định dạng; nhánh thử còn chỗ (và không nhiều hơn đối chứng) → thử, đối chứng còn chỗ → đối chứng,
            # đủ cặp → camp KHÔNG vào A/B và mang tham số mặc định (= nhánh đối chứng) — clone của camp nhánh thử không giữ 4 nước
            dem = dict(l.split("|") for l in q(f"""select a.nhanh, count(*) from etp.camp_ab a left join etp.camp c using (camp_id)
                where a.ab = '{ab['ma']}' and coalesce(a.dang, '') = '{dang.replace("'", "''")}' and (c.camp_id is null or c.camp_id in (select camp_id from etp.camp_dang_chay)
                  or coalesce(c.dong_bo, '') not in ('done', 'synced', 'error') or (c.lich > now() and c.trang_thai = 'ACTIVE')) group by 1""").splitlines() if "|" in l)   # chờ giờ = ACTIVE + hẹn tương lai (camp đã tắt còn giờ hẹn không tính) — cùng định nghĩa lib/etp-chay.choGio
            t, d, m = int(dem.get("thu", 0)), int(dem.get("doi", 0)), int(ab["moi_dang"])
            nh = "thu" if t < m and t <= d else "doi" if d < m else None
            if not nh: AP[ab["kieu"]](pl, ab["nhanh"]["doi"]); return None
        else:   # ty_le ở nhánh thu (AB05: 0.1 = 10% camp mới vào nhánh thử); không khai = chia đôi chẵn / lẻ như cũ
            tl = (ab["nhanh"].get("thu") or {}).get("ty_le")
            nh = ("thu" if zlib.crc32(pl["name"].encode()) % 100 < round(float(tl) * 100) else "doi") if tl is not None else ("thu" if zlib.crc32(pl["name"].encode()) % 2 == 0 else "doi")
        AP[ab["kieu"]](pl, ab["nhanh"][nh])
        # CAMP A/B VẪN ĐI TỪ $1 (anh 08/11/2026: "AB test vẫn phải đi từ $1. Nếu khác thì phải xin phép" — AB01 từng khai ns $3 ở nhánh, 52 camp mới lên $3):
        # máy KHÔNG đặt ngân sách theo nhánh nữa; ngân sách camp mới khác $1 bị cổng chặn (cong.kiem, luật camp mới $1)
        return ab["ma"], nh, dang, None
    g = q(f"select a.ma || '|' || a.kieu || '|' || a.trang_thai || '|' || (a.nhanh->'doi')::text from etp.camp_ab c join etp.ab a on a.ma = c.ab where c.camp_id = {int(goc)} and c.nhanh = 'thu'") if goc else ""
    if not g: return None
    ma, kieu, tt, doi = g.split("|", 3)
    # A/B ĐÃ ĐÓNG (vd AB01 nhắm nước bỏ 09/11/2026: team Ethopex yêu cầu target đủ danh sách nước): bản nhân / thang của camp nhánh thử trả về tham số đối chứng,
    # không mang tham số thử (4 nước) sang camp mới, không gán mã A/B
    if tt != "dang":
        if kieu in AP: AP[kieu](pl, json.loads(doi))
        return None
    # CHỈ KIỂU MANG THAM SỐ TRONG PAYLOAD MỚI THỪA HƯỞNG (anh 08/11/2026 "sửa đi"): bản nhân của camp nhánh thu AB02 (G10 hồi) từng bị gán vào AB02 —
    # #86256 #86824 là bản $1 của #65722, chưa từng qua G10 hồi, làm bẩn nhánh thử. Kiểu nước (AP) chép Ad Set nên bản nhân vẫn mang 4 nước → thừa hưởng đúng;
    # kiểu khác (g10_hoi, roas_nhan_doi, roas_tang…) là CÁCH XỬ camp chứ không nằm trong payload → bản nhân không thuộc thử nghiệm.
    if kieu not in AP or kieu == "gio": return None   # 'gio' = giờ lên của chính camp đó, bản nhân không mang lịch Custom → không thuộc thử nghiệm
    if moi:
        if kieu in AP: AP[kieu](pl, json.loads(doi))
        return None
    return ma, "thu", None
def ab_lay(kq, pl, lich, goc, moi, roas=False, cr=None):   # một chỗ gọi ab_ap cho mọi đường tạo camp: lỗi sổ A/B không chặn tạo camp nhưng LỘ ra kq (nhật ký / tin)
    try: tn = ab_ap(pl, lich, goc, moi, roas, cr)
    except Exception as e: kq["ab_loi"] = f"{type(e).__name__}: {str(e)[:120]}"; return None
    if tn: kq["ab"] = {"ma": tn[0], "nhanh": tn[1]}
    return tn
def ghi_kho_ngay(moi, pl, ten, goc, cid, bo, roas=None):
    """CAMP MỚI HIỆN NGAY Ở BẢNG CAMP etp2 (anh 26/11/2026 "bấm Tạo camp xong và duyệt thì phải thấy ngay camp đó trong tab camp"): trước đây camp chỉ vào kho
    etp.camp ở lượt dong-bo.py kế (10 phút) trong khi lượt này còn chờ Meta tới 20 phút. Ghi hàng tạm ngay khi Ethopex trả mã: dong_bo 'creating' → trang hiện
    "🚀 đang lên" (hoặc "chờ X nữa" khi Ad Set hẹn giờ); dong-bo.py upsert đè số thật ở lượt sau. Lỗi ghi không chặn tạo camp."""
    if NGOAI: return
    try:
        ag = ((pl.get("campaign") or {}).get("ad_groups") or [{}])[0]; st = ag.get("start_time") if ag.get("type_run") == "custom" else None
        ns_ = float(((pl.get("campaign") or {}).get("source_payload") or {}).get("daily_budget") or 0) or "null"
        tk = int(pl.get("ad_account_id")) if str(pl.get("ad_account_id") or "").isdigit() else "null"
        lich_ = f"'{st}'::timestamp at time zone 'UTC'" if st and re.fullmatch(r"[\d\- :]+", st) else "null"
        q(f"""insert into etp.camp (camp_id, ten, bo, ad_account_id, trang_thai, dong_bo, ngan_sach, content_id, goc, lich, tao, roas, chien_luoc)
              values ({int(moi)}, $t${ten}$t$, {f"'{bo}'" if bo and str(bo).isalnum() else "null"}, {tk}, 'PAUSED', 'creating', {ns_}, {int(cid) if str(cid or '').isdigit() else "null"},
              {int(goc) if str(goc or '').isdigit() else "null"}, {lich_}, now(), {float(roas) if roas is not None else "null"}, {"'LOWEST_COST_WITH_MIN_ROAS'" if roas is not None else "null"})
              on conflict (camp_id) do nothing""")
    except Exception as e: print(f"ghi_kho_ngay #{moi}: {e}", file=sys.stderr)
def ghi_kho_tt(moi, c):   # đồng bộ xong trong lượt → trạng thái thật vào hàng tạm (dong-bo.py vẫn đè đủ cột ở lượt sau)
    if NGOAI or not moi or not c: return
    try: q(f"update etp.camp set trang_thai = $t${c.get('state') or ''}$t$, dong_bo = $t${c.get('sync_status') or ''}$t$, cap_nhat = now() where camp_id = {int(moi)} and cap_nhat_etp is null")
    except Exception as e: print(f"ghi_kho_tt #{moi}: {e}", file=sys.stderr)
def ab_ghi(moi, tn):   # dang: định dạng lúc chia (hạn mức mỗi định dạng đếm cả camp chưa đồng bộ); None = clone ngoài khung ngày → định dạng của camp gốc lúc đồng bộ
    dg = f"'{tn[2].replace(chr(39), chr(39) * 2)}'" if len(tn) > 2 and tn[2] is not None else "null"
    q(f"insert into etp.camp_ab (camp_id, ab, nhanh, dang) values ({int(moi)}, '{tn[0]}', '{tn[1]}', {dg}) on conflict (camp_id) do nothing")

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
                else f"phim {content_id} chưa có trong workspace Ethopex của {ng_ten} và máy thêm không được (ensure-clone lỗi: {them_ws.loi or '?'}) — tài khoản nhà chỉ lên camp phim đã thêm")
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
    """thêm phim thư viện vào workspace Nhà (ensure-clone, idempotent) → mã bản workspace, None khi lỗi.
    THỬ LẠI 3 LẦN (26/11/2026: api-multi-be timeout / 525 từng lúc → 6 dòng CC2 dừng hẳn ở bước ws vì một lần timeout; gọi lại sau đó trả đúng bản cũ).
    Lỗi cuối ghi vào them_ws.loi để lý do chặn nói đúng câu API trả."""
    import urllib.request, urllib.error, time
    T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
    for lan in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(f"https://api-multi-be.ethopex.dev/api/v2/contents/{int(content_id)}/ensure-clone", method="POST",
                                                              headers={"authorization": "Bearer " + T, "user-agent": "mos2-etp"}), timeout=60)
            d = json.load(r); d = d.get("data", d) if isinstance(d, dict) else {}
            if int(d.get("id") or 0): them_ws.loi = ""; return int(d["id"])
            them_ws.loi = f"API trả không có id: {str(d)[:120]}"
        except urllib.error.HTTPError as e:
            them_ws.loi = f"HTTP {e.code}"
            if e.code < 500 and e.code != 429: return None   # 4xx = API từ chối thật, thử lại vô ích
        except Exception as e:
            them_ws.loi = type(e).__name__
        if lan < 2: time.sleep(15 * (lan + 1))
    return None
them_ws.loi = ""

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
import so_dang as DG   # SỔ DẠNG một nơi (etp-dang.json) — apps/etp đã ở sys.path
DANG_TINH = tuple(x["dang"] for x in DG.DS if x.get("tinh") or x.get("khong_doan"))   # + dạng dựng từ MỘT khung (sổ khong_doan, vd AD ảnh động 24/11/2026: #113993 bị chặn "cùng đoạn" với bản AT #113295 cùng phim) — mốc giây không phải đoạn phim
def cung_doan_dang_chay(cr):
    """creative mới cr trùng ĐOẠN (cùng phim + cùng mốc giây) với camp đang chạy / vừa tạo dù creative mang mã khác → mã creative đó, không thì None.
    03/11/2026 lô pm-03110155: máy tự lên 8 camp lúc 03:12–03:51, Claude chạy tay `phim-moi.py len` lại → tải lại thành creative mới #64996–#65005, cổng
    'một creative một camp' chỉ so mã nên lên trùng 8 camp (Elf King 4 camp cho 2 đoạn), anh bắt tắt. Đoạn lấy từ etp.creative.doan, thiếu thì từ studio."""
    global _DOAN
    # DẠNG TĨNH (08/11/2026 dòng #277 CTS: bản 2 bị chặn "cùng đoạn" với bản 1): mốc giây 0–9 của video ảnh / poster + giọng không phải đoạn phim —
    # các bản khác khung / câu / giọng là creative khác nhau thật. Luật "một creative một camp" vẫn giữ.
    if q(f"select dang from etp.creative where creative_id = {int(cr)}") in DANG_TINH: return None
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
              (select camp_id::text from etp.camp where content_id = {int(content_id)} and coalesce(dong_bo, '') not in ('done', 'synced', 'error', 'DISAPPROVED') limit 1), '')""")   # DISAPPROVED = Meta đã từ chối xong, không phải đang đồng bộ (12/11/2026: #68850 chặn chính camp thay thế của nó)
    return r or None
def creative_khac(content_id, bo_qua):
    dat = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_cta_dat'") or "{}")
    tc = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_tu_choi'") or "{}")
    ds = [int(x) for x in q(f"select (kinh_thanh->'ethopex'->>'creative_id') from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {int(content_id)} order by 1 desc").split() if x.isdigit()]
    return next((c for c in ds if c not in bo_qua and str(c) in dat and str(c) not in tc and dem_doan(c) < TRAN_DOAN), None)
# CỔNG CHẤM CREATIVE: view etp.cham_cong (migration 0341 — MỘT nguồn, anh 26/10/2026): bất kỳ tiêu chí Meta / GG (afs.*) ≤ 4 → chặn;
# có tiêu chí = 5 → chặn tới khi người duyệt Đạt (Telegram / lich-gio.py --duyet). Chưa chấm → xếp hàng etp.cham_hang.
def cham_sach(cr, bo_cta=False):
    k = q(f"select duoc_len::text || '|' || coalesce(chan_boi, '') from etp.cham_cong where creative_id = {int(cr)}")
    if not k:
        q(f"insert into etp.cham_hang (creative_id, nguon, ai) values ({int(cr)}, 'moi', 'nhan-ban: chờ chấm trước khi lên') on conflict (creative_id) do nothing")
        return f"creative #{cr} chưa được máy chấm — đã xếp hàng chấm, lượt sau mới lên"
    duoc, chan = k.split("|", 1)
    if duoc != "true":   # bỏ tiêu chí CTA (afs.cta) cho MỌI nhân bản (anh 23/11/2026 "bỏ ngay cổng này"; trước chỉ bài cũ, 11/11/2026) · BÀI CŨ (anh 11/11/2026 "ko bắt buộc cta mới khi dùng bài cũ"): bỏ riêng tiêu chí CTA (afs.cta) — tiêu chí khác vẫn chặn
        con = [x.strip() for x in chan.split(",") if x.strip() and not x.strip().startswith("afs.cta")]
        if not con: return None
        chan = ", ".join(con)
    return None if duoc == "true" else f"creative #{cr} bị cổng chấm chặn ({chan}) — không lên"

# CLONE PHẢI KHÁC CREATIVE (anh 25/10/2026: "clone camp thì phải khác creative một chút, chặt chẽ hơn"): bản nhân bản KHÔNG dùng lại creative
# của camp gốc, cũng không dùng creative đang có camp chạy của cùng phim — chọn creative khác cùng phim (đạt CTA, chưa bị Meta từ chối,
# đoạn < 3 camp, chấm sạch, mới nhất trước); không có → xếp hàng cắt góc mới, không clone y nguyên.
def creative_clone(content_id, cr_goc):
    tc = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_tu_choi'") or "{}")
    ds = [int(x) for x in q(f"select (kinh_thanh->'ethopex'->>'creative_id') from xv_phim where project='ethopex' and (kinh_thanh->'ethopex'->>'content_id')::int = {int(content_id)} order by 1 desc").split() if x.isdigit()]
    for c in ds:
        if c == cr_goc or DEM_CR.get(c, 0) > 0 or str(c) in tc or dem_doan(c) >= TRAN_DOAN: continue
        if cham_sach(c) is None: return c
    return None

def xep_goc_moi(goc_id, content_id, ten):
    q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_can_goc_moi', '{}'::jsonb) on conflict (ten) do nothing")
    v = json.dumps({"goc": goc_id, "ten": ten, "luc": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")}, ensure_ascii=False).replace("'", "''")
    q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{int(content_id)}', '{v}'::jsonb) where ten='ethopex_can_goc_moi' and not gia_tri ? '{int(content_id)}'")

def _nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(os.path.dirname(os.path.abspath(__file__)), tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m

def cong(content_id, creative_id, ten="", cta=True):
    """cổng phim 18+ (kiem-phim-18.py) + cổng CTA (kiem-cta.py) + sổ bài học (bai-hoc.py: không lên lại đúng đoạn/dạng đã lỗ) — anh 22/10/2026.
    Creative clone từ camp ĐỘI (etp.creative.dang='team') bỏ bước soát hình 18+ (anh 07/11/2026 "camp của đội clone sang thì không cần soát"): camp đội đã chạy thật trên Meta."""
    # NGUỒN ĐỘI = lo 'team' (nap-creative-ngoai.py ghi), KHÔNG đọc dang: từ 12/11/2026 phan_loai_cr.py đổi dang 'team' → dạng thật (ảnh tĩnh, cảnh thật…) nên
    # creative đội mất dấu, bị đòi soát hình như creative nhà (tiendo E24 bước 6, anh 13/11/2026 "Fix triệt để cái đó")
    doi = "team" in (q(f"select coalesce(lo, '') || '|' || coalesce(dang, '') from etp.creative where creative_id = {int(creative_id)}") or "").split("|")
    # cta=False: nhân bản BÀI CŨ — bài đăng đã chạy giữ CTA của nó, đòi CTA mới là mất kế thừa (anh 11/11/2026 "ko bắt buộc cta mới khi dùng bài cũ")
    # cổng CTA bỏ hẳn (anh 23/11/2026 "bỏ ngay cổng này") — tham số cta giữ cho chỗ gọi cũ, không còn tác dụng
    chan = _nap("p18", "kiem-phim-18.py").kiem(content_id, soat_hinh=not doi)
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
# sổ ['ethopex_phim_tk'] {content_id: bộ} ghi bộ ĐẦU TIÊN của phim (thống kê). MỘT PHIM NHIỀU BỘ (anh 08/11/2026 "1 phim ở nhiều bộ thoải mái"): bỏ cổng chan_bo —
# camp mới của creative lên bộ etp.cau_hinh.bo_phim_moi (cong.SQL_BO_PHIM), nhân bản / thang / ROAS ở bộ camp gốc.
def bo_tk(bo):
    v = q(f"select gia_tri->'{bo}' from xv_khoa_ngoai where ten='ethopex_bo_tk'")
    if not v: raise ValueError(f"không có bộ tài khoản '{bo}' trong ethopex_bo_tk")
    return json.loads(v)
def bo_cua_camp(c):
    v = q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_bo_tk'")
    return next((k for k, b in (json.loads(v) if v else {}).items() if int(b["tk"]) == int(c.get("ad_account_id") or 0)), None)
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
ROAS_MIN, ROAS_MAX = 0.9, 1.4   # 0.9 (Dol 22/11/2026: "ngoài mức bid roas 1, lên camp test thêm mức 0.9, 1.1")
MIEN_LEN = str(_cau_hinh("mien_len", "") or "").strip()   # miền trang đích MỌI camp mới (anh 25/11/2026 "marcusbeilby.com : tất cả đổi hết sang domain này") — rỗng thì cửa API chặn
def mien_goc(goc_id, a):   # miền link của bài đăng camp gốc: ad.domain trên Ethopex, không có thì sổ etp.camp.mien
    return (a.get("domain") or (q(f"select mien from etp.camp where camp_id = {int(goc_id)}") if str(goc_id).isdigit() else "") or "").strip()
KHUON_ES = 65734   # camp mẫu ES (cùng sổ lenh_cho.KHUON_CR / dot-phim-moi.KHUON) — mang locales [1002] trong targeting Ad Set
def phim_es(content_id, goc_id=None):
    """Phim tiếng Tây Ban Nha? Đọc etp.phim.locale; không đọc được thì coi khuôn ES là phim ES (nghiêng về bỏ khoá ngôn ngữ)."""
    try:
        l = q(f"select locale from etp.phim where content_id = {int(content_id)}") if str(content_id or "").isdigit() else ""
    except Exception: l = ""
    return l.lower().startswith("es") if l else str(goc_id) == str(KHUON_ES)
def bo_ngon_ngu(sp_g, content_id=None, goc_id=None):
    """KHÔNG CAMP NÀO TARGET NGÔN NGỮ — LUẬT CỐ ĐỊNH, CẤM THAY ĐỔI (anh 24/11/2026 "Sửa toàn bộ phần ngôn ngữ người xem và ngôn ngữ link phim giống của Kiên.
    Và set đây là rule cố định, cấm thay đổi"; trước đó 23/11 chỉ phim ES): 64 camp Kiên đọc API không camp nào có targeting.locales, phim EN lẫn ES. Khuôn EN
    mang [6], khuôn ES #65734 mang [1002] → bỏ trường locales khỏi targeting Ad Set của MỌI camp (nước giữ nguyên). Cửa API chặn lần nữa (ethopex_api.CamNgonNgu).
    Trả True khi đã bỏ."""
    tg = dict(sp_g.get("targeting") or {}); co = "locales" in tg; tg.pop("locales", None); sp_g["targeting"] = tg
    return co
def la_doi(goc_id):   # camp gốc của người trong đội (kho etp.camp_ngoai)
    return q(f"select 1 from etp.camp_ngoai where camp_id = {int(goc_id)}") == "1"
# CLONE CAMP ĐỘI = DÙNG LẠI MỌI THỨ TRỪ NGÂN SÁCH (anh 23/11/2026: "Lên camp là phải dùng lại mọi thứ từ camp của đội từ creative, text, cấu hình,... trừ ngân sách").
# Chặn TRƯỚC khi gửi: so gói sẽ gửi với camp gốc, lệch trường nào ngoài tên / ngân sách / trạng thái thì không lên. Tài khoản + Page đổi theo bộ (vật đang thử);
# trang đích + video do Ethopex tự gán theo người lên camp (landing 34778 của đội trả 404 với tài khoản nhà, cùng site + cùng mẫu trang).
GIONG_DOI_MIEN_C = {"name", "daily_budget", "status"}
GIONG_DOI_MIEN_G = {"name"}
def giong_doi(d, pl):
    c = d["campaign"]; g = (d.get("ad_groups") or [{}])[0]; a = (g.get("ads") or [{}])[0]
    BO = {"id", "campaign_id", "adset_id", "account_id", "start_time", "end_time", "stop_time", "created_time", "updated_time", "effective_status", "configured_status", "issues_info"}
    pc = pl["campaign"]["source_payload"]; pg = pl["campaign"]["ad_groups"][0]["source_payload"]; pa = pl["campaign"]["ad_groups"][0]["ads"][0]
    lech = []
    sg = js(g.get("source_payload"))
    if isinstance(sg.get("targeting"), dict):   # luật cố định không nhắm ngôn ngữ (anh 24/11/2026, mọi phim) vẫn áp — chỉ trường locales được khác
        sg = {**sg, "targeting": {k: v for k, v in sg["targeting"].items() if k != "locales"}}
    for ten, goc, moi, mien in (("camp", js(c.get("source_payload")), pc, GIONG_DOI_MIEN_C), ("adset", sg, pg, GIONG_DOI_MIEN_G)):
        for k in sorted((set(goc) | set(moi)) - BO - mien):
            if goc.get(k) != moi.get(k): lech.append(f"{ten}.{k}: {str(goc.get(k))[:60]} → {str(moi.get(k))[:60]}")
    for k in ("creative_id", "content_id"):   # miền KHÔNG so: mọi camp mới đi miền MIEN_LEN (anh 25/11/2026 — lệnh trực tiếp đè "giống hệt đội")
        if (a.get(k) or "") != (pa.get(k) or ""): lech.append(f"ad.{k}: {a.get(k)} → {pa.get(k)}")
    if pl.get("pixel_id_arb") != d.get("pixel_id"): lech.append(f"pixel: {d.get('pixel_id')} → {pl.get('pixel_id_arb')}")
    if lech: raise ValueError("clone camp đội phải giống hệt gốc trừ ngân sách (anh 23/11/2026) — lệch: " + "; ".join(lech))
def payload(goc_id, lich, moi=None, bo=None, thang=None, roas=None, ns_roas=20, nhan=None, ep=False, hoi_cho=False, ns_tay=None):
    """moi = {creative, content, ten}: KHÔNG nhân bản mà dựng camp MỚI cho creative khác trên khuôn camp gốc (cùng tài khoản/Page/pixel/Ad Set/ngôn ngữ)
    — anh 22/10/2026 "camp cùng phim thì chủ động thêm góc khác"; trước đó phải đi br form (dung-camp.sh).
    roas + moi (anh 18/11/2026, đợt lên hồi chợ — sổ luật hoi_cho): camp ★ ROAS từ CREATIVE MỚI trên khuôn (ad = creative mới, không phải bài cũ; bộ đổi được).
    hoi_cho (đợt lên hồi chợ): nhân bản BÀI CŨ của camp từng lãi trước đợt sụt — camp gốc đã tắt vẫn dùng được bài đăng (như ROAS)."""
    d = api(f"/api/v1/campaigns/{goc_id}"); c = d["campaign"]; g = (d.get("ad_groups") or [{}])[0]; a = (g.get("ads") or [{}])[0]
    # AD KHÔNG MANG PHIM (24/11/2026, camp #108852 ★ ROAS creative mới): Ethopex trả content_id = 0 trên ad dựng từ creative, dù creative + phim có thật
    # → nhánh ROAS "dùng lại creative + content" bỏ qua, gãy "không có mã bài đăng"; nhánh nhân bản thường gửi content 0. Sổ etp.camp giữ phim
    # (dong-bo lấp từ camp gốc) → lấp content_id từ sổ trước mọi nhánh, một chỗ cho cả lớp.
    if not int(a.get("content_id") or 0) and str(goc_id).isdigit():
        ct = q(f"select coalesce(nullif(c.content_id, 0), (select nullif(g.content_id, 0) from etp.camp g where g.camp_id = c.goc)) from etp.camp c where c.camp_id = {int(goc_id)}")
        if ct.isdigit() and int(ct): a = {**a, "content_id": int(ct)}
    # ROAS: chọn theo số all time, camp gốc tắt rồi vẫn dùng được bài đăng. moi (--creative): camp gốc chỉ là KHUÔN cấu hình (Ad Set, pixel, nước, ngôn ngữ),
    # creative thay hẳn → khuôn tạm dừng vẫn dùng được (26/10/2026: khuôn #65110 / #65734 bị tắt vì creative QC spy → mọi lượt lên camp mới gãy "camp gốc đang PAUSED")
    # ep (sang bộ khác theo lệnh anh, 28/10/2026 "lên bộ 3 như bộ 1"): camp thắng bộ 1 đã bị luật chấm tắt vẫn là khuôn + bài đăng dùng được
    if c.get("state") != "ACTIVE" and not roas and not moi and not ep and not hoi_cho: raise ValueError(f"camp gốc đang {c.get('state')}")
    # NHÂN BẢN BÀI CŨ (anh 11/11/2026 "khi dup camp lãi ổn định dạng ko phải roas thì chọn Use existing post"): clone camp thường CÙNG BỘ (bài đăng thuộc Page của bộ)
    # → ad dùng lại bài đăng của camp gốc (giữ tương tác), ngân sách CONG.NS_MOI ($5), không đòi CTA mới. Creative mới (--creative), sang bộ khác, camp team → đăng bài mới như cũ.
    sid_goc = (a.get("effective_object_story_id") or "").strip()
    bai = (not roas and not moi and not NGOAI and bool(re.fullmatch(r"\d+_\d+", sid_goc)) and (not bo or str(bo) == str(bo_cua_camp(c)))
           and mien_goc(goc_id, a) == MIEN_LEN)   # bài cũ mang link miền của camp gốc → chỉ dùng lại khi đúng miền lên camp, không thì đăng bài mới miền MIEN_LEN (anh 25/11/2026)
    if len(d.get("ad_groups") or []) != 1 or len(g.get("ads") or []) != 1: raise ValueError("camp gốc không đúng khuôn 1 nhóm 1 ad")
    if roas and moi:   # ★ ROAS creative mới (đợt hồi chợ): không có gốc để "duplicate by" — tên mang mức ROAS đầu + đuôi, cong.la_roas nhận bằng ★ và chiến lược thầu
        ten = f"★ ROAS {roas:g} · {moi['ten']} roas {roas:g}"; a = {**a, "creative_id": moi["creative"], "content_id": moi["content"]}
    elif roas:
        # mức ROAS ĐẦU tên (anh 26/10/2026 "đặt thêm chỉ số ROAS vào tên camp để kiểm tra cho tiện" — bảng Ethopex cắt mất đuôi); đuôi "roas X duplicate by <gốc>" giữ cho máy đọc
        # gốc là camp ★ ROAS (anh 06/11/2026 "duplicate camp roas chạm trần"): bỏ đầu "★ ROAS x · " + đuôi " roas x duplicate by N" của gốc, không lặp hai lần
        lo = re.sub(r"\s+roas [\d.]+( duplicate by \d+)?$", "", re.sub(r"^★ ROAS [\d.]+ · ", "", re.sub(r'^\d+:\s*', '', c['name'])))
        lo = ten_sach_roas(lo)   # bỏ ghi chú nội bộ trong ngoặc (anh 10/11/2026 "sao lại có chữ Son trong đó … lên camp phải bỏ hết những thông tin kia")
        ten = f"★ ROAS {roas:g} · {lo}{f' {nhan}' if nhan else ''} roas {roas:g} duplicate by {goc_id}"   # nhan: phân biệt bản cùng mức (vd "chay ngay")   # ★ = dấu camp ROAS (anh 26/10/2026), cong.la_roas nhận theo tên
    elif moi:
        ten = moi["ten"]; a = {**a, "creative_id": moi["creative"], "content_id": moi["content"]}
    else:
        goc_ten = re.sub(r"(\s+bai-cu)+$", "", re.sub(r"\s*\((nhan ban \d+|thang \$\d+) cua \d+\)$", "", c["name"]))
        so = 1 + sum(1 for x in api("/api/v1/campaigns?page_size=500")["data"] if re.search(rf"\(nhan ban \d+ cua {goc_id}\)$", x.get("name", "")))
        ten = f"{goc_ten} (thang ${thang:g} cua {goc_id})" if thang else f"{goc_ten} (nhan ban {so} cua {goc_id})"
        # CAMP THẮNG MANG CTA CŨ → DÙNG BẢN SỬA CTA (anh 06/11/2026 "Dùng bản sửa CTA"): 02/11 bỏ đổi để giữ CTA cũ, nhưng cổng cong() vẫn đòi luật CTA
        # → mọi camp thắng CTA cũ bị chặn hẳn ("chưa đạt luật CTA mới"), 6 camp ⚠ lỗi ở tin 🧬. Có bản sửa thì dùng, chưa có thì xếp hàng dựng lại.
        # BỎ CỔNG CTA CŨ (anh 23/11/2026 "creative còn CTA cũ <- bỏ ngay cổng này"): nhân bản giữ đúng creative của camp gốc, không đổi bản sửa, không chặn
        if bai: ten = f"{goc_ten} bai-cu " + (f"(thang ${thang:g} cua {goc_id})" if thang else f"(nhan ban {so} cua {goc_id})")
    # BỎ mọi mã định danh + mốc thời gian của camp GỐC (chạy khô 22/10/2026: source_payload Ad Set mang campaign_id FB + start_time của camp gốc
    # → gửi nguyên là gắn nhầm vào camp gốc / chạy theo lịch cũ). Lịch của bản mới do type_run quyết.
    BO = {"id", "campaign_id", "adset_id", "account_id", "start_time", "end_time", "stop_time", "created_time", "updated_time", "effective_status", "configured_status", "issues_info"}
    sp_c = {k: v for k, v in js(c.get("source_payload")).items() if k not in BO}; sp_c.update(name=ten, daily_budget=int(thang) if thang else (int(ns_tay) if ns_tay else CONG.NS_MOI), status="PAUSED")   # số nguyên như lam-ethopex tang (bậc thang đều là $ nguyên)
    tk, ext, page = c.get("ad_account_id"), c.get("external_account_id"), a.get("facebook_page_id")
    bo = None if NGOAI else (bo or bo_cua_camp(c) or "1")   # người trong team: không có bộ — dựng đúng tài khoản / Page của camp gốc
    if bo and bo_cua_camp(c) != str(bo):   # dựng trên khuôn camp của bộ khác → đổi đúng 3 trường tài khoản / Page (pixel dùng chung, bài đăng FB tạo mới)
        b = bo_tk(bo); tk, ext, page = int(b["tk"]), str(b["ext"]), int(b["page"])
    sp_g = {k: v for k, v in js(g.get("source_payload")).items() if k not in BO}; sp_g.update(name=f"{ten} · adset")
    bo_ngon_ngu(sp_g, a.get("content_id"), goc_id)
    if roas:   # đúng đường form Ethopex (bid strategy cấp campaign + roas_average_floor cấp Ad Set, tối ưu VALUE) — đọc từ mã app 26/10/2026
        sp_c.update(bid_strategy="LOWEST_COST_WITH_MIN_ROAS", daily_budget=int(ns_roas))
        sp_g.update(optimization_goal="VALUE", bid_constraints={"roas_average_floor": roas}); sp_g.pop("bid_amount", None)
        # GỐC KHÔNG CÓ BÀI ĐĂNG (anh 22/11/2026, nhân đôi ★ ROAS lãi qua đêm): ad dựng từ creative (★ ROAS creative mới, is_existing_post false) → Ethopex không giữ
        # effective_object_story_id → bản ROAS dùng lại đúng creative + content của gốc (đăng bài mới, như nút Duplicate trên Ethopex) thay vì gãy "không có mã bài đăng"
        sid = (a.get("effective_object_story_id") or "").strip()
        # CẤM DÙNG LẠI CREATIVE CŨ (anh 25/11/2026 "Mỗi camp mới đều phải có creative mới !! Cấm dùng lại … nhân bản thì clone post đang viral"): bỏ nhánh 22/11
        # "gốc không có bài đăng → dùng lại creative + content của gốc". ★ ROAS nhân bản = clone bài đăng của gốc (đúng miền lên camp), không có bài thì không lên.
        if not moi and re.fullmatch(r"\d+_\d+", sid) and mien_goc(goc_id, a) != MIEN_LEN:
            # LUẬT CHẶN, không phải lỗi máy (26/11/2026: plan 22h có #110239 / #109261 bài miền maybic.com → ValueError bị đếm "lệnh roas lỗi", kêu cảnh báo) — cùng lớp dòng 771 đường thường
            raise ChanLuat(f"bài đăng {sid} của camp gốc #{goc_id} mang miền {mien_goc(goc_id, a) or 'chưa biết'} ≠ {MIEN_LEN} — không clone (creative cũ cấm dùng lại, anh 25/11/2026)")
        if moi:   # ★ ROAS creative mới: ad = creative mới (đăng bài mới, như camp mới thường) — khuôn chỉ cho cấu hình
            return d, ten, moi["content"], {
                "name": ten, "pixel_id_arb": d.get("pixel_id"), "ad_account_id": tk, "facebook_page_id": page, "bo": str(bo) if bo else None,
                "external_account_id": ext,
                "campaign": {"source_payload": sp_c, "ad_groups": [{"type_run": lich, "source_payload": sp_g,
                    "ads": [{"content_id": moi["content"], "creative_id": moi["creative"], "facebook_page_id": page, "domain": MIEN_LEN,
                             "source_payload": {"name": ten, "status": "ACTIVE"}}]}]}}
        # LUẬT CHẶN, không phải lỗi máy (27/11/2026: 11 lệnh tay ★ ROAS từ camp dựng bằng creative mới — Ethopex không giữ mã bài, luật 25/11 cấm dùng lại creative
        # → không có đường lên; ValueError bị đếm "lệnh roas lỗi" + cảnh báo). Cùng lớp dòng 602 + 704; etp2 nhanBanTay chặn sớm ngay lúc bấm.
        if not re.fullmatch(r"\d+_\d+", sid): raise ChanLuat(f"camp gốc #{goc_id} không có mã bài đăng (effective_object_story_id) để dùng lại — camp dựng từ creative mới, Ethopex không giữ bài; creative cũ cấm dùng lại (anh 25/11/2026) → nhân bản bằng creative mới")
        if bo and str(bo) != str(bo_cua_camp(c)): raise ChanLuat("camp ROAS dùng bài đăng của camp gốc → phải cùng bộ tài khoản / Page với camp gốc")
        return d, ten, a.get("content_id"), {
            "name": ten, "pixel_id_arb": d.get("pixel_id"), "ad_account_id": tk, "facebook_page_id": page, "bo": str(bo) if bo else None,
            "external_account_id": ext,
            "campaign": {"source_payload": sp_c, "ad_groups": [{"type_run": lich, "source_payload": sp_g,
                "ads": [{"effective_object_story_id": sid, "source_payload": {"name": ten, "status": "ACTIVE"}}]}]}}
    return d, ten, a.get("content_id"), {
        "name": ten, "pixel_id_arb": d.get("pixel_id"), "ad_account_id": tk, "facebook_page_id": page, "bo": str(bo) if bo else None, "bai_cu": sid_goc if bai else None,
        "external_account_id": ext,
        "campaign": {"source_payload": sp_c, "ad_groups": [{"type_run": lich, "source_payload": sp_g,
            "ads": [{"content_id": a.get("content_id"), "creative_id": a.get("creative_id"), "facebook_page_id": page, "domain": MIEN_LEN,
                     "source_payload": {"name": ten, "status": "ACTIVE"}}]}]}}

class ChanLuat(ValueError):
    """LUẬT CHẶN, KHÔNG PHẢI LỖI (anh 27/10/2026: ⚠302 trên cây camp gồm cả "chưa chạm trần $30" — máy đúng luật mà bị đếm là nhân bản hỏng):
    cổng trần ngân sách / trần phim / bão hoà / cổng chấm / chặn bộ… → nhật ký ghi ok = NULL (bỏ qua); ValueError thường vẫn là lỗi thật (ok = false)"""

def ghi_nhat_ky(kq, luat, ai):
    import nhat_ky   # apps/etp/nhat_ky.py — một đường ghi, chặn dòng lỗi lặp (nhịp gọi lại mỗi phút khi cổng chặn)
    nhat_ky.ghi(q, {"viec": kq.get("viec") or "nhan_ban", "id": kq.get("moi") or kq.get("goc"), "goc": kq.get("goc"),
                    "truoc": None, "sau": (kq.get("ns") or 1) if kq.get("ok") else None, "ok": kq.get("ok"), "loi": kq.get("loi"), "luat": luat or "(không ghi luật)", "ai": ai or "?", "content": kq.get("content"), "creative": kq.get("creative"), **({"bai_cu": kq["bai_cu"]} if kq.get("bai_cu") else {}),
                    **({"nguoi": EA.SUA or EA.XEM} if NGOAI else {})})   # team cũng ghi (anh 02/11/2026: sổ luật đo được việc máy làm cho Sơn / Kiên); nguoi tách khỏi đếm Nhà

def main(a):
    # NHƯỜNG CPU + TRẦN SONG SONG: đã làm ở ĐẦU TỆP (_giu_khe), trước phần nạp nặng — không lặp ở đây.
    goc = int(a[0]); that = "--that" in a
    tay = "--tay" in a   # camp anh yêu cầu bằng tay (dòng phim etp.on.tc) → miễn luật không trùng phim với đội (cong.kiem tay=True), 04/11/2026
    lay = lambda k, md=None: next((a[i + 1] for i, x in enumerate(a[:-1]) if x == k), md)
    lich, luat, ai = lich_len(), lay("--luat"), lay("--ai")   # giờ chạy do lich_len quyết, --lich của nơi gọi không còn nghĩa (anh 05/11/2026)
    moi = {"creative": int(lay("--creative")), "content": int(lay("--content")), "ten": lay("--ten")} if lay("--creative") else None
    # LỆNH TRỰC TIẾP TỪ NÚT ETP2 (anh 22/11/2026 "nút bấm Lên ngay = Tao ra lệnh sao phải xin mày ?"): vé TRỰC TIẾP của đúng camp gốc / phim → chạy ngay (today) hoặc đúng
    # giờ anh đặt (--gio, giờ VN) thay cho khung lich_len; không có vé thì --gio / --thay-cho bị từ chối. Camp trực tiếp không áp lịch giờ TẮT (lich_ap).
    gio, cu = lay("--gio"), lay("--thay-cho")
    # 👁 XEM TRƯỚC (etp2 xemTruocLen — anh 22/11/2026 "tao cần xem mọi thứ mày sẽ submit thì mới gọi là review"): chạy KHÔ đúng đường vé trực tiếp của nút ▶ Lên
    # (cổng chỉ cảnh báo, cùng giờ chạy) để in payload THẬT sẽ gửi — cấm đi cùng --that, nên không bao giờ tạo camp.
    xem_truoc = "--xem-truoc" in a
    if xem_truoc and that: raise SystemExit("--xem-truoc là chạy khô — không đi cùng --that")
    # vé nút etp2 gắn PHIM (lenTheoPhieu xin 'tao_camp' --phim) → bản clone camp gốc (dùng lại post) khớp vé qua phim của camp gốc, đúng như cửa API (ethopex_api.py: ct = content_id camp gốc).
    # Thiếu dòng này: thẻ BAI #90 (phiếu #37, 28/11/2026) anh đã duyệt mà "--mien chỉ đi cùng vé TRỰC TIẾP" vì vé phim 57545 không khớp camp #110876
    ct_ve = moi["content"] if moi else (q(f"select content_id from etp.camp where camp_id = {int(goc)}") or None)
    truc = xem_truoc or bool(CONG.truc_tiep("tao_camp" if moi else "nhan_ban", [] if moi else [goc], ct_ve))
    xt_lich = xem_truoc and "--theo-lich" in a   # 👁 xem trước của nút "⏱ Lên theo lịch" (etp2 #1772): chạy khô ĐI ĐƯỜNG LỊCH (lich_len / gio_roas) như vé thường, không như vé trực tiếp
    if xt_lich: truc = False
    if (gio or cu) and not truc: raise SystemExit("--gio / --thay-cho chỉ đi cùng vé TRỰC TIẾP (ETP_VE từ nút etp2, cong.py --ve-truc-tiep)")
    # DOMAIN ANH CHỌN Ở PHIẾU LÊN CAMP (etp2, anh 27/11/2026 "Các trường link thì cũng cho chọn… Tương tự với domain"): --mien đè MIEN_LEN cho đúng lệnh này,
    # CHỈ đi cùng vé trực tiếp và chỉ nhận miền nhà đã từng chạy (etp.camp.mien) hoặc mien_len — gõ sai một ký tự là camp trỏ trang lạ
    m_ = (lay("--mien") or "").strip().lower()
    if m_:
        global MIEN_LEN
        if not truc: raise SystemExit("--mien chỉ đi cùng vé TRỰC TIẾP (ngăn Lên camp etp2)")
        if not re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)+", m_) or (m_ != MIEN_LEN and not q(f"select 1 from etp.camp where mien = '{m_}' limit 1")):
            raise SystemExit(f"--mien {m_!r} không phải miền nhà (mien_len / etp.camp.mien)")
        MIEN_LEN = m_
    # LÊN NGAY THEO LỆNH ANH (anh 24/11/2026 22:26 VN "Cho nhóm đó về $1 ngân sách và leen luôn bây giờ"): --ngay CHỈ đi cùng vé TRỰC TIẾP — bỏ khung gio_len, chạy ngay (today).
    # Máy tự lên / vé thường không có đường này (luật khung cố định "Cấm tự lên ngay" giữ nguyên).
    ngay = "--ngay" in a
    if ngay and not truc: raise SystemExit("--ngay chỉ đi cùng vé TRỰC TIẾP (cong.py --ve-truc-tiep theo câu anh)")
    # HAI KHUNG CỐ ĐỊNH (gio_len, anh 24/11/2026 "Cấm tự lên ngay"): giờ chạy = khung 22h VN gần nhất (từ giờ anh đặt nếu có) — cả vé trực tiếp, không còn "chạy ngay"
    tu_do = "--gio-tu-do" in a   # #1869: giờ anh gõ ngoài hai khung (đã cảnh báo ở nút) → giữ đúng giờ đó; chỉ vé trực tiếp + có --gio
    if tu_do and not (truc and gio): raise SystemExit("--gio-tu-do chỉ đi cùng --gio và vé TRỰC TIẾP (nút etp2)")
    gio = gio_chay(gio, ngay, tu_do)
    lich = "today" if ngay or (dt.datetime.strptime(gio, "%Y-%m-%d %H:%M") - dt.timedelta(hours=7)).date() == dt.datetime.now(dt.timezone.utc).date() else "tomorrow"
    ep = "--ep" in a and bool(lay("--bo")); mien_cham = "--mien-cham" in a   # clone sang bộ khác theo lệnh anh — xem docstring
    # ANH NHÂN BẢN TAY (--anh, nút etp2 — anh 10/11/2026 "nếu tao nhân bản bằng tay thì mày không được phép chặn. Đánh dấu camp đó lại, tao chịu trách nhiệm"):
    # đi như lệnh đích danh (ep): bỏ trần phim / ngân sách gốc / trần đoạn / cổng chấm / trần camp ngày; CHỈ còn dừng khẩn (anh tự bật) và cổng tài khoản nhà + $ của API.
    # Camp mới vào sổ etp.cau_hinh 'camp_anh_tay' (anh chịu trách nhiệm) + kq.chay_luc = lúc camp thực sự chạy.
    # --anh CHỈ CÓ NGHĨA KHI MANG VÉ (anh 18/11/2026 "kiểm soát tuyệt đối"): cờ dòng lệnh thì máy nào cũng gõ được — không có vé thao tác tay của đúng camp gốc
    # (ETP_VE, nút etp2 xin lúc anh bấm) thì --anh bị bỏ, lệnh chấm như lệnh máy
    anh = "--anh" in a and bool(CONG.ve_hop_le("nhan_ban", [goc])); ep = ep or anh
    if truc and cu: anh = ep = True   # ĐỔI GIỜ = bản sao ĐÚNG camp đang chờ (anh đã lên nó) → đi như anh nhân bản tay: không trần / ngân sách gốc / chấm lại
    nac = "--nac" in a   # NHÂN THEO NẤC (anh 07/11/2026, luật NB hai nấc trong luat-ethopex): gốc tiêu ≥ $10/+50% hay $45/+100% → không đòi ngân sách gốc ≥ nb_ns_goc
    bo = lay("--bo"); thang = float(lay("--thang")) if lay("--thang") else None; bo_doi = bool(lay("--bo"))
    if thang and (moi or thang not in THANG_MUC): raise SystemExit(f"--thang phải là một trong {sorted(THANG_MUC)} và không đi kèm --creative")
    if moi and not (moi["content"] and moi["ten"]): raise SystemExit("--creative cần kèm --content và --ten")
    # MẶC ĐỊNH ★ ROAS (anh 24/11/2026 "Từ giờ mặc định là roas"): lên creative MỚI (--creative) mà không nói --roas → ★ ROAS · $hoi_cho.ns, không còn camp $1
    # DÀN MỨC (anh 26/11/2026 "Sửa từ gốc để đa dạng level ROAS"): --roas dan / mặc định → mức chọn ĐÚNG lúc tạo bằng etp.muc_roas (cong.muc_roas — mức sổ hoi_cho.muc
    # ít camp ★ ROAS nhất của phim), không còn mức cứng 1; --roas <số> (anh chỉnh tay / khối etp.ke_cr) giữ nguyên số anh đặt
    r_ = lay("--roas")
    dan = r_ == CONG.ROAS_DAN or (moi and r_ is None and not thang and "--hoi-cho" not in a)
    if dan and not (moi and moi["content"]): raise SystemExit("--roas dan chỉ đi cùng --creative + --content (mức dàn theo phim)")
    roas = CONG.muc_roas(moi["content"]) if dan else float(r_) if r_ else None
    # NGÂN SÁCH ANH CHỈNH cho bản không bid / sang bộ khác (anh 22/11/2026 "Ngân sách cho điều chỉnh"): chỉ khi anh bấm tay (vé), $1–20 nguyên; thiếu = CONG.NS_MOI ($5 mọi camp mới, anh 25/11/2026)
    ns_tay = int(float(lay("--ns"))) if lay("--ns") and roas is None and not thang else None
    if ns_tay is not None and not (anh and 1 <= ns_tay <= 20): raise SystemExit("--ns cho bản không bid / sang bộ khác chỉ đi cùng vé thao tác tay, $1–20")
    hoi_cho = "--hoi-cho" in a   # ĐỢT LÊN HỒI CHỢ (anh 18/11/2026, apps/etp/hoi_cho.py): nhân bản BÀI CŨ của camp từng lãi trước đợt sụt — gốc tắt vẫn được, BẮT BUỘC bài cũ
    if roas is not None:
        if thang or hoi_cho: raise SystemExit("--roas không đi kèm --thang / --hoi-cho")
        if not ROAS_MIN <= roas <= ROAS_MAX: raise SystemExit(f"--roas phải trong {ROAS_MIN}–{ROAS_MAX} (Support 26/10/2026)")
        return roas_main(goc, roas, int(float(lay("--ns", str(CONG.NS_MOI)))), lich, that, "--tam-dung" in a, luat, ai, lay("--nhan"), "--mien-cham" in a, tay, moi=moi, bo=bo, lenh_cho="--lenh-cho" in a, gio=gio, cu=cu, doi="--roas-doi" in a, truc=truc, ngay=ngay)
    kq = {"ok": False, "goc": goc, "moi": None, "ten": None, "loi": None, "chay": lich}
    try:
        d, ten, cid, pl = payload(goc, lich, moi, bo, thang, ep=ep, hoi_cho=hoi_cho and not moi and not thang, ns_tay=ns_tay); kq["ten"] = ten; bo = pl.pop("bo"); bai0 = bai = pl.pop("bai_cu", None); cr_bai = pl["campaign"]["ad_groups"][0]["ads"][0]["creative_id"]
        if la_doi(goc) and not moi and not roas: giong_doi(d, pl)   # clone camp đội: giống hệt gốc trừ ngân sách, lệch thì không gửi
        if hoi_cho and not bai0: raise ChanLuat(f"camp gốc #{goc} không dùng được bài đăng cũ (không có mã bài / khác bộ) — đợt hồi chợ chỉ nhân bản bài cũ (anh 18/11/2026)")
        ly = None if NGOAI else (None if moi or ep else q(f"select etp.bo_chan_mo_camp('{bo}', {int(goc)})"))   # bộ có camp ĐÃ TĂNG vẫn lỗ 3 ngày khép → ngừng nhân bản / thang; camp mới $1 không chặn (0339); camp gốc tự thắng (3 ngày khép ROI ≥ 30%) thì miễn (0372, anh 30/10/2026)
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
        chan = cong(cid, pl["campaign"]["ad_groups"][0]["ads"][0]["creative_id"], ten, cta=not bai)
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
        elif not moi and not ep and not nac:   # CHỈ CLONE CAMP GỐC ĐỦ NGÂN SÁCH (trừ --nac: nấc theo tiền đã tiêu, anh 07/11/2026) — mốc etp.cau_hinh.nb_ns_goc ($9, anh 06/11/2026 "Áp thêm 2 luật mới luôn": gốc $9–19 nhân ra ROI +16%, gốc không sụt);
            # 25/10–06/11 mốc = chạm trần tran_camp (anh 25/10/2026 "không tạo trùng nếu camp hiện tại chưa đạt budget tối đa"). Thiếu khoá thì về trần như cũ
            tran = float(q("select coalesce((select gia_tri::text::numeric from etp.cau_hinh where khoa = 'nb_ns_goc'), (select gia_tri::text::numeric from etp.cau_hinh where khoa = 'tran_camp'), 20)") or 20)
            ns = float((d.get("campaign") or {}).get("budget_daily") or 0)
            if ns < tran: raise ChanLuat(f"camp gốc #{goc} mới ${ns:g}/ngày, chưa tới ${tran:g} (etp.cau_hinh.nb_ns_goc) — chưa clone (tăng ngân sách camp gốc trước)")
        if not NGOAI:   # PHIM BÃO HOÀ CHỈ CẢNH BÁO (anh 06/11/2026 "bỏ tiêu chí ko lên camp phim bão hoà") — cổng chặn 25/10–06/11 bỏ; câu bão hoà ghi vào kết quả cho tin / nhật ký
            try: bh = q(f"select chan_nb from etp.phim_bao_hoa where content_id = {int(cid)} and chan_nb is not null")
            except Exception: bh = ""
            if bh: kq["canh_bao"] = f"phim {cid} đang bão hoà — {bh} (chỉ cảnh báo)"
        ad0 = pl["campaign"]["ad_groups"][0]["ads"][0]; cr = ad0["creative_id"]
        if ep: kq["viec"] = "nhan_ban" if anh and not bo_doi else "sang_bo"
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
        if ad0["creative_id"] != cr_bai: bai = None   # BÀI CŨ chỉ khi creative cuối = creative của bài gốc — đổi creative (đoạn đủ trần) là đăng bài mới, cổng chấm đủ tiêu chí CTA
        ly = cham_sach(ad0["creative_id"], bo_cta=bool(bai))   # cổng chấm: creative cuối cùng phải SẠCH (bài cũ: bỏ tiêu chí CTA)
        if ly and ep and (mien_cham or anh): kq["mien_cham"] = ly; ly = None   # --mien-cham chỉ đi cùng --ep (lệnh đích danh của anh) · --anh: anh chịu trách nhiệm
        # CLONE BỊ CỔNG CHẤM CHẶN → THAY CREATIVE HOẶC BỎ (anh 07/11/2026 "bỏ hoặc thay creative luôn"): creative khác cùng phim chấm sạch, chưa có camp thì dùng
        # (đè tạm dừng đổi creative tới CLONE_KHAC_CR_DEN — chỉ ca bị chấm chặn); không có thì bỏ qua lặng: nhật ký vẫn ghi, tin 🧬 không báo lỗi (kq.bo_qua)
        if ly and not moi and not ep:
            khac = creative_clone(cid, int(ad0["creative_id"]))
            if khac and not cong(cid, khac, ten):
                kq["doi_creative"] = {"tu": ad0["creative_id"], "sang": khac}; ad0["creative_id"] = khac; kq["creative"] = khac; ly = None
                pl = json.loads(json.dumps(pl, ensure_ascii=False).replace(" cta-sua ", " doi-cr ")); ad0 = pl["campaign"]["ad_groups"][0]["ads"][0]
                ten = ten.replace(" cta-sua ", " doi-cr "); kq["ten"] = ten
            else: kq["bo_qua"] = True
        if ly: raise ChanLuat(ly)
        kq["phim_dang_chay"] = n
        if ad0["creative_id"] != cr_bai: bai = None   # cổng chấm vừa thay creative (nhánh trên) → cũng không còn là bài cũ
        if hoi_cho and not bai: raise ChanLuat(f"bản nhân của #{goc} phải đổi creative (đoạn đủ trần / cổng chấm) → không còn là bài cũ — đợt hồi chợ chỉ nhân bản bài cũ (anh 18/11/2026)")
        # NHÂN BẢN = CLONE BÀI ĐĂNG, KHÔNG BAO GIỜ ĐĂNG LẠI CREATIVE CŨ (anh 25/11/2026 "Nếu là camp nhân bản thì sẽ clone post đang viral thì đúng luật, còn CẤM
        # ko bao giờ dùng creative cũ"): gốc không có bài đăng dùng được (khác bộ / khác miền / không mã bài) hay đã phải đổi creative → không nhân bản.
        # Creative chưa từng có camp thì lên đường camp mới (--creative); cửa ethopex_api.thieu_tin chặn creative cũ ở mọi đường.
        if not moi and not bai:
            raise ChanLuat(f"camp gốc #{goc} không clone được bài đăng (không mã bài / khác bộ / miền khác {MIEN_LEN} / đã đổi creative) — nhân bản chỉ clone bài đăng, creative cũ cấm dùng lại (anh 25/11/2026)")
        if bai:   # ad = CHỈ bài đăng cũ (Ethopex chặn trộn effective_object_story_id với creative_id / content_id — mã form app.ethopex.dev 11/11/2026)
            pl["campaign"]["ad_groups"][0]["ads"][0] = {"effective_object_story_id": bai, "source_payload": {"name": ten, "status": "ACTIVE"}}
            kq["bai_cu"] = bai
        # CLONE SANG BỘ KHÁC THEO LỆNH ANH (--bo --ep) = bản sao ĐÚNG camp gốc: không chia vào A/B đang chạy (08/11/2026: dup 50 camp bộ 2 → bộ 4 bị AB01 gán nhánh
        # và đặt ngân sách $3 của nhánh; anh: "Sao dup sang bộ 4 lại set ngân sách $3 ngay") — giữ $1 + tham số Ad Set của gốc
        tn = None if ep else ab_lay(kq, pl, lich, goc, moi, cr=ad0["creative_id"])
        kq["gio_anh"] = dat_gio(pl, gio, "khung lên 22h VN") if gio else None   # --ngay (vé trực tiếp) = chạy ngay · khung cố định thắng lịch A/B (sau ab_lay) — anh 24/11/2026   # sổ A/B etp.ab — đặt tham số nhánh trước khi tạo (anh 05/11/2026) · bài cũ cũng qua: A/B chỉ đổi Ad Set, ad0 vẫn giữ creative gốc để xếp định dạng
        # CỔNG đọc NGÂN SÁCH THẬT sẽ gửi (payload sau A/B), không phải số giả định — 08/11/2026 cổng nhận "1" trong khi payload mang $3 của nhánh AB01
        ns_gui = thang or float((pl["campaign"].get("source_payload") or {}).get("daily_budget") or 1)
        ly = CONG.kiem("tao_camp" if moi else "nhan_ban", None, ns_gui, 0, str(bo) if bo else None, content_id=cid, ngoai=bool(NGOAI), tay=tay, lenh_anh=ep, bac=bool(thang), bai_cu=bool(bai), thay="--thay" in sys.argv, goc=None if moi else goc)   # phanh chợ chỉ miễn khi lệnh mang VÉ thao tác tay (ETP_VE, anh 18/11/2026) — chữ --ai / cờ --tay không miễn
        if ly and anh and "DỪNG KHẨN" not in ly: kq["anh_bo_qua"] = ly; ly = None   # anh nhân bản tay: luật mềm chỉ ghi lại, không chặn
        if ly: raise ChanLuat(ly)
        if not that:
            print(json.dumps({**kq, "ok": True, "chay_kho": True, "payload": pl}, ensure_ascii=False)); return
        r = api("/api/v1/campaigns/facebook", pl)
        moi = r.get("id") or (r.get("data") or {}).get("id") or (r.get("campaign") or {}).get("id")
        if not moi:   # đọc lại theo tên nếu API không trả id
            time.sleep(3); moi = next((x["id"] for x in api("/api/v1/campaigns?page_size=20")["data"] if x.get("name") == ten), None)
        if not moi: raise ValueError(f"Ethopex không trả camp mới: {str(r)[:160]}")
        ghi_kho_ngay(moi, pl, ten, goc, cid, bo)
        for _ in range(12):
            time.sleep(5); c = api(f"/api/v1/campaigns/{moi}")["campaign"]
            if c.get("sync_status") in ("done", "synced") or c.get("error"): break
        kq.update(ok=not c.get("error"), moi=moi, dong_bo=c.get("sync_status"), loi=c.get("error") or None, bo=bo, ns=c.get("budget_daily")); ghi_kho_tt(moi, c)
        if mien_cham and ep: q(f"update etp.cau_hinh set gia_tri = gia_tri || to_jsonb({int(moi)}), luc = now() where khoa = 'cham_mien' and not gia_tri @> to_jsonb({int(moi)})")
        ns_dich = thang or ns_tay or CONG.NS_MOI   # camp mới đều $5 (anh 25/11/2026) — Ethopex không nhận ngân sách lúc tạo thì đặt lại
        if ns_dich and kq["ok"] and float(c.get("budget_daily") or 0) != ns_dich:   # Ethopex không nhận ngân sách lúc tạo → đặt lại ngay (camp mới chưa học gì)
            api("/api/v1/campaigns/update", {"campaign": {"campaign_id": moi, "source_payload": {"daily_budget": int(ns_dich)}}}); time.sleep(8)
            kq["ns"] = api(f"/api/v1/campaigns/{moi}")["campaign"].get("budget_daily")
        if kq["ok"] and tn: ab_ghi(moi, tn)
        kq["chay_luc"] = kq.get("gio_anh") or kq.get("gio_roas") or chay_luc(lich)
        if kq["ok"] and cu: kq["thay_cho"] = thay_cho(cu, moi, gio)
        if kq["ok"] and anh:   # ĐÁNH DẤU camp anh nhân bản tay — anh chịu trách nhiệm (10/11/2026)
            q("insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('camp_anh_tay', '{}'::jsonb, 'camp anh nhân bản tay trên etp2 — anh chịu trách nhiệm, máy không chặn lúc tạo', 'nhan-ban.py') on conflict (khoa) do nothing")
            j = json.dumps({str(moi): {"goc": int(goc), "luc": dt.datetime.now(dt.timezone.utc).isoformat(), "chay": kq["chay_luc"], "bo_qua": kq.get("anh_bo_qua")}}, ensure_ascii=False).replace("'", "''")
            q(f"update etp.cau_hinh set gia_tri = gia_tri || '{j}'::jsonb, luc = now() where khoa = 'camp_anh_tay'")
        if kq["ok"] and not NGOAI:
            ghi_bo(cid, bo)
            try: kq["lich"] = None if truc else lich_ap(moi, cid)
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
    # HTTP 4xx = Ethopex / Meta TỪ CHỐI có lý do (không phải mạng) → giữ gốc trong ngày như ValueError, không thử lại mỗi nhịp (anh 10/11/2026 "tele lắm lỗi");
    # câu lỗi giữ ĐỦ (tới 1500 ký tự, gồm lý do Ethopex trả về — anh 10/11/2026 "lý do thật là gì phải lưu đầy đủ"); Telegram tự cắt khi hiện
    kq.update(loi=(f"LỖI MÃ {type(e).__name__}: " if ma else "") + str(e)[:220], may=ma or isinstance(e, OSError))
    kq["loi"] = (f"LỖI MÃ {type(e).__name__}: " if ma else "") + str(e)[:1500]   # câu đủ (dòng trên giữ nguyên cho điều kiện #roas-0511)
    if getattr(e, "code", None) is not None and 400 <= int(getattr(e, "code") or 0) < 500: kq["may"] = False   # 4xx = từ chối có lý do → giữ trong ngày
    # LỖI CẤU HÌNH WORKSPACE ETHOPEX (10/11/2026: "domain is not enabled for this traffic source" chặn MỌI lệnh tạo camp 00:20–09:43, bật lại là chạy): không phải lỗi của
    # camp → không giữ gốc, nhịp sau tự thử lại; canh-bao.py báo đỏ Telegram một lần để người bật lại tên miền
    if "is not enabled for this traffic source" in str(e): kq["may"] = True

def ten_sach_roas(t):
    """TÊN CAMP ROAS SẠCH (anh 10/11/2026): bỏ mọi ghi chú nội bộ trong ngoặc của tên camp gốc — "(cr tk Son 54757)", "(thay 81599)", "(nhan ban 1 cua 65725)",
    "(thang $X cua N)"… — chỉ giữ tên phim · dạng · đoạn. Đuôi "roas X duplicate by <gốc>" do roas_main gắn sau (máy đọc)."""
    return re.sub(r"\s{2,}", " ", re.sub(r"\s*\([^()]*\)", "", t or "")).strip(" -·")
assert ten_sach_roas("3010 The Dragon Lord Comes Home EN - tap nguyen ep8 (cr tk Son 54757)") == "3010 The Dragon Lord Comes Home EN - tap nguyen ep8"
assert ten_sach_roas("dp20lt Bound to the Wrong Dragon Prince EN - canh that 267-394s (thay 81599)") == "dp20lt Bound to the Wrong Dragon Prince EN - canh that 267-394s"
assert ten_sach_roas("2110 Number One Nobody EN - ke chuyen (nhan ban 1 cua 65725)") == "2110 Number One Nobody EN - ke chuyen"
_u = lambda s: dt.datetime.fromisoformat(s + "+00:00")   # gio_roas: 23–03h VN chạy ngay, ngoài khung hẹn 23:00 kế (anh 22/11/2026)
assert BANG_LUAT["khung_doi"]["len_roas"] == [23, 3], "★ ROAS lên ban tối 23–03h VN (anh 22/11/2026)"
assert gio_roas(_u("2026-11-22T16:30:00")) is None and gio_roas(_u("2026-11-22T19:59:00")) is None, "23:30 / 02:59 VN trong khung → chạy ngay"
assert gio_roas(_u("2026-11-22T00:14:00")) == "2026-11-22 23:00" and gio_roas(_u("2026-11-22T15:59:00")) == "2026-11-22 23:00" and gio_roas(_u("2026-11-22T20:00:00")) == "2026-11-23 23:00", "ngoài khung → 23:00 VN kế tiếp"
# HAI KHUNG CỐ ĐỊNH 22h tối + 07h sáng VN (anh 25/11/2026 "Giờ lên camp cũng set theo 2 khung gần nhất là 22h tối và 7h sáng hôm sau !!"; trước: chỉ 22h, anh 24/11) — không bao giờ None / chạy ngay
assert BANG_LUAT["khung_doi"]["len_gio"] == [7, 22], "khung lên camp 07h + 22h VN (anh 25/11/2026)"
assert gio_len(luc=_u("2026-11-24T05:58:00")) == "2026-11-24 22:00", "12:58 VN → khung 22:00 hôm nay, không chạy ngay"
assert gio_len(luc=_u("2026-11-24T14:30:00")) == "2026-11-24 22:00", "21:30 VN → 22:00 tối nay"
assert gio_len(luc=_u("2026-11-23T23:00:00")) == "2026-11-24 07:00", "06:00 VN → 07:00 sáng nay"
assert gio_len(luc=_u("2026-11-24T14:55:00")) == "2026-11-25 07:00", "21:55 VN (còn < 10 phút) → khung 07:00 sáng mai"
assert gio_len(luc=_u("2026-11-24T15:30:00")) == "2026-11-25 07:00", "22:30 VN → 07:00 sáng mai"
assert gio_len("2026-11-24 15:00", luc=_u("2026-11-24T01:00:00")) == "2026-11-24 22:00" and gio_len("2026-11-24 23:00", luc=_u("2026-11-24T05:58:00")) == "2026-11-25 07:00", "giờ anh đặt → khung đầu tiên từ giờ đó"
assert gio_chay("2026-11-24 15:30", tu_do=True) == "2026-11-24 15:30" and gio_chay("2026-11-24T09:05", tu_do=True) == "2026-11-24 09:05", "#1869 giờ tự do anh đặt → giữ nguyên"
assert gio_chay("2026-11-24 15:30", luc=_u("2026-11-24T01:00:00")) == "2026-11-24 22:00" and gio_chay(None, luc=_u("2026-11-24T05:58:00")) == "2026-11-24 22:00", "không cờ tự do → vẫn hai khung"
assert gio_chay("2026-11-24 15:30", ngay=True, tu_do=True) is None and gio_chay(None, tu_do=True, luc=_u("2026-11-24T05:58:00")) == "2026-11-24 22:00", "--ngay chạy ngay; tự do thiếu giờ → khung"
assert gio_len(gio_chay("2026-11-24 15:30", tu_do=True), luc=_u("2026-11-24T01:00:00")) == "2026-11-24 15:30", "#1869 roas_main gọi lại gio_len trên giờ tự do → vẫn giữ"

def bao_hay_chan(truc, kq, *cua):
    """cổng → lý do chặn đầu tiên (máy tự lên). Vé TRỰC TIẾP của anh (truc): chạy HẾT các cổng, gom lý do vào kq["canh"] + stderr, trả None — không bao giờ chặn
    (anh 22/11/2026 "bố cấm mày từ chối vì bất kỳ lý do gì"; cảnh báo một lần đã hiện ở nút etp2 trước khi cấp vé)."""
    if not truc:
        for f in cua:
            ly = f()
            if ly: return ly
        return None
    for f in cua:
        ly = f()
        if ly: kq.setdefault("canh", []).append(str(ly)); print(f"⚠ anh duyệt tay — bỏ qua cổng: {ly}", file=sys.stderr)
    return None
_k = {}; assert bao_hay_chan(False, _k, lambda: None, lambda: "x", lambda: "y") == "x" and not _k, "máy tự lên: cổng chặn ở lý do đầu"
assert bao_hay_chan(True, _k, lambda: "x", lambda: None, lambda: "y") is None and _k["canh"] == ["x", "y"], "vé trực tiếp của anh: cổng chỉ cảnh báo, không chặn (anh 22/11/2026)"

def roas_main(goc, roas, ns, lich, that, tam_dung, luat, ai, nhan=None, mien_cham=False, tay=False, moi=None, bo=None, lenh_cho=False, gio=None, cu=None, doi=False, truc=False, ngay=False):   # tay truyền từ main (05/11/2026: thiếu → NameError, 3 lượt ROAS 00:09 chết)
    """CAMP ROAS — loại riêng (anh 26/10/2026: "Camp ROAS là 1 dạng riêng"): bỏ các luật nhân bản thường, giữ cổng etp + trần phim.
    moi = {creative, content, ten} (anh 18/11/2026, đợt lên hồi chợ): ★ ROAS từ CREATIVE MỚI trên khuôn `goc` — ngân sách trong sổ luật hoi_cho.ns_khoang ($5–10),
    creative mới nên PHẢI qua cổng chấm Sạch + cổng 18+ / CTA / bài học + trang phim + một creative một camp (khác ★ ROAS bài cũ)."""
    # GIỜ LÊN ★ ROAS BAN TỐI (gio_roas, sổ khung_doi.len_roas): trong khung chạy ngay, ngoài khung hẹn lần mở khung kế — thay khung sáng lich_len cho ★ ROAS
    # HAI KHUNG CỐ ĐỊNH (anh 24/11/2026 "Cấm tự lên ngay"): ★ ROAS cũng hẹn khung 22h VN gần nhất (gio_len) — bỏ khung tối 23h (gio_roas) và lối chạy liền của vé trực tiếp
    if ngay and not truc: raise ValueError("--ngay chỉ đi cùng vé TRỰC TIẾP")
    if isinstance(gio, GioTuDo) and not truc: raise ValueError("--gio-tu-do chỉ đi cùng --gio và vé TRỰC TIẾP")   # #1869
    gio = None if ngay else gio_len(gio); ro = None   # --ngay: lệnh trực tiếp của anh "lên luôn bây giờ" (24/11/2026) — chạy ngay, không hẹn khung
    lich = "today" if ngay or (dt.datetime.strptime(gio, "%Y-%m-%d %H:%M") - dt.timedelta(hours=7)).date() == dt.datetime.now(dt.timezone.utc).date() else "tomorrow"
    kq = {"ok": False, "viec": "roas", "goc": goc, "moi": None, "ten": None, "roas": roas, "loi": None, "chay": lich}
    try:
        if moi:
            lo_, hi_ = HOI_CHO["ns_khoang"]
            if not lo_ <= ns <= hi_ and not (truc and 1 <= ns <= 20): raise ValueError(f"ngân sách ★ ROAS creative mới ${lo_:g}–{hi_:g} (anh 18/11/2026, sổ luật hoi_cho) — vé trực tiếp của anh: $1–20 (anh 24/11/2026 \"về $1 ngân sách\")")
        elif lenh_cho:
            # LỆNH CHỜ PHANH NHẢ (anh 20/11/2026 "Làm 1": ★ ROAS bài cũ $5–10 từ #66055 / #70189) — chỉ khi hàng apps/etp/lenh_cho.py đang chạy ĐÚNG lệnh
            # (gốc, roas, ns) này; ngân sách vẫn trong hoi_cho.ns_khoang. Mọi cổng sau (phanh, trần, phim cấm) giữ nguyên.
            lo_, hi_ = HOI_CHO["ns_khoang"]
            _sl = _iuc.spec_from_file_location("etp_lenh_cho", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp", "lenh_cho.py")); LC = _iuc.module_from_spec(_sl); _sl.loader.exec_module(LC)
            if not (lo_ <= ns <= hi_ and LC.hop_le(goc, roas, ns)): raise ValueError(f"--lenh-cho: không có lệnh chờ phanh đang chạy cho #{goc} roas {roas:g} ${ns} (hoặc ngoài ${lo_:g}–{hi_:g})")
        elif ns != CONG.NS_MOI and not CONG.truc_tiep("nhan_ban", [goc]): raise ValueError(f"camp ★ ROAS mới bắt đầu ${CONG.NS_MOI} (anh 25/11/2026 \"các camp mới đều bắt đầu từ $5\"; lãi thì nuôi dần lên) — mức khác chỉ bằng vé trực tiếp của anh")   # LỆNH TRỰC TIẾP (anh 20/11/2026 09:35) miễn khoảng $15–20
        d, ten, cid, pl = payload(goc, lich, moi=moi, bo=bo if moi else None, roas=roas, ns_roas=ns, nhan=nhan); kq["ten"] = ten; bo = pl.pop("bo")
        if moi:
            kq["content"], kq["creative"] = cid, int(moi["creative"])
            # ANH DUYỆT TAY Ở ETP2 (anh 22/11/2026 "tao sẽ duyệt = tay !! Khi đó bố cấm mày từ chối vì bất kỳ lý do gì"): có vé TRỰC TIẾP (nút ▶ Lên, cảnh báo một lần ở
            # xinVeTrucTiep) thì mọi cổng creative (chấm Sạch, 18+, CTA, bài học, trang phim, giữ bởi người khác, đã có camp) chỉ CẢNH BÁO (kq.canh + stderr), không chặn.
            ly = bao_hay_chan(truc, kq, lambda: cham_sach(int(moi["creative"])), lambda: cong(cid, int(moi["creative"]), ten),
                              lambda: trang_chua_san(cid, pl.get("ad_account_id")), lambda: giu_boi_nguoi_khac(cid, pl.get("ad_account_id")))
            if ly: raise ChanLuat(ly)
            dem_dang_chay(cid)
            if DEM_CR.get(int(moi["creative"]), 0) > 0 or (cu := EA.creative_cu(int(moi["creative"]))):   # cứng, vé trực tiếp không miễn (anh 25/11/2026 "CẤM ko bao giờ dùng creative cũ")
                raise ChanLuat(f"creative #{moi['creative']} đã có camp ({cu if DEM_CR.get(int(moi['creative']), 0) == 0 else 'vừa tạo'}) — camp mới chỉ lên creative chưa từng có camp")
        else:
            # CAMP ROAS KHÔNG QUA CỔNG CHẤM (anh 29/10/2026: "Camp roas lên ko cần chấm lại" — thay luật 26/10 "áp cho mọi loại camp"): ad ROAS = đúng bài đăng
            # của camp gốc đang chạy lãi (lãi 30 ngày ≥ $75), không phải creative mới. Điểm chấm chỉ ghi vào nhật ký để xem; luật chấm lich-gio cũng bỏ qua camp ★.
            cr_goc = q(f"select creative_id from {'etp.camp_ngoai' if NGOAI else 'etp.camp'} where camp_id = {int(goc)}")
            ly = cham_sach(int(cr_goc)) if cr_goc.isdigit() and int(cr_goc) > 0 else None
            if ly: kq["mien_cham"] = ly
        # camp ROAS là dạng riêng, miễn mọi luật (anh 26/10/2026) — kể cả trần 30 camp/phim: không bị chặn, cũng không chiếm chỗ camp thường (dem_dang_chay bỏ ★)
        if any(x.get("name") == ten for x in api("/api/v1/campaigns?page_size=500")["data"]): raise ChanLuat(f"đã có camp '{ten}' — không tạo trùng")
        ly = bao_hay_chan(truc, kq, lambda: CONG.kiem("tao_camp" if moi else "nhan_ban", None, ns, 0, str(bo) if bo else None, content_id=cid, ngoai=bool(NGOAI), tay=tay, roas=True))   # ROAS miễn luật trùng phim với đội (anh 05/11/2026); vé trực tiếp → chỉ cảnh báo
        if ly: raise ChanLuat(ly)   # luật chặn → nhật ký ok NULL như đường thường (05/11/2026: chặn trùng phim bị đếm là lỗi 3–6 lần/ngày)
        kq["content"] = cid
        tn = ab_lay(kq, pl, lich, goc, None, roas=True) if not moi else None
        if ro: kq["gio_roas"] = dat_gio(pl, ro, f"★ ROAS lên ban tối {BANG_LUAT['khung_doi']['len_roas'][0]}h")
        kq["gio_anh"] = dat_gio(pl, gio, "khung lên 22h VN") if gio else None   # khung cố định (gio_len) — mọi đường trừ --ngay của vé trực tiếp   # gốc nhánh thu A/B → camp ★ mang cùng mã (Ad Set chép từ gốc đã mang tham số nhánh); creative mới trên khuôn không thuộc A/B của khuôn
        if not that:
            print(json.dumps({**kq, "ok": True, "chay_kho": True, "payload": pl}, ensure_ascii=False)); return
        r = api("/api/v1/campaigns/facebook", pl)
        moi = r.get("id") or (r.get("data") or {}).get("id") or (r.get("campaign") or {}).get("id")
        if not moi:
            time.sleep(3); moi = next((x["id"] for x in api("/api/v1/campaigns?page_size=20")["data"] if x.get("name") == ten), None)
        if not moi: raise ValueError(f"Ethopex không trả camp mới: {str(r)[:160]}")
        kq["moi"] = moi; ghi_kho_ngay(moi, pl, ten, goc, cid, bo, roas=roas)
        # GHI SỔ CHỜ ĐỌC NGAY khi có camp (24/11/2026): bên gọi có trần giờ (dong_phim box 900s…) giết tiến trình giữa 20 phút chờ đồng bộ → camp mồ côi; doc_lai_roas.py vẫn đọc lại
        q(f"insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_roas_cho_doc', '{{}}'::jsonb) on conflict (ten) do nothing")
        q(f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{int(moi)}', jsonb_build_object('goc', {int(goc)}, 'roas', {float(roas)}, 'ns', {float(ns)}, 'luc_s', {int(time.time())})) where ten = 'ethopex_roas_cho_doc'")
        if mien_cham: q(f"update etp.cau_hinh set gia_tri = gia_tri || to_jsonb({int(moi)}), luc = now() where khoa = 'cham_mien' and not gia_tri @> to_jsonb({int(moi)})")
        # ĐỢI ĐỒNG BỘ XONG HẲN (#70162, 26/10/2026: lệnh tạm dừng gửi lúc còn 'creating_adset' bị Ethopex đè — đồng bộ xong camp tự về ACTIVE)
        for _ in range(150):   # Meta kiểm ad (checking_ads) có lúc > 15 phút (#70162, #70174 26/10/2026) — chờ tới 20 phút
            time.sleep(8); d2 = api(f"/api/v1/campaigns/{moi}"); c = d2["campaign"]
            if c.get("sync_status") in ("done", "error") or c.get("error"): break
        if c.get("error"): raise ValueError("Ethopex báo lỗi: " + str(c.get("error"))[:200])
        if c.get("sync_status") != "done":   # MÁY PHỤ TRÁCH ĐỌC LẠI (anh 10/11/2026 "lỗi này ai phụ trách"): sổ chờ đã ghi ngay lúc tạo, apps/etp/doc_lai_roas.py đọc lại mỗi nhịp worker — không báo "kiểm tay"
            kq.update(ok=True, cho_dong_bo=True, dong_bo=c.get("sync_status")); raise ChanLuat(f"đã tạo #{moi}, Ethopex / Meta chưa đồng bộ xong sau 20 phút ({c.get('sync_status')}) — máy tự đọc lại mỗi nhịp")
        q(f"update xv_khoa_ngoai set gia_tri = gia_tri - '{int(moi)}' where ten = 'ethopex_roas_cho_doc'")   # đồng bộ xong trong lượt → lượt này tự đọc lại, gỡ sổ chờ
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
            kq["tam_dung"] = tt.get("state") == "PAUSED"; kq["trang_thai"] = tt.get("state"); ghi_kho_tt(moi, tt)
            if not kq["tam_dung"]: raise ValueError(f"đã gửi lệnh tạm dừng nhưng camp #{moi} vẫn {tt.get('state')} — tắt tay ngay")
        if sai: raise ValueError(f"đọc lại sai ROAS (đặt {roas}, Ethopex {san}, chiến lược {c.get('source_bidding_strategy')}) — đã tạm dừng camp")
        kq["ok"] = True
        if not (sai or tam_dung): ghi_kho_tt(moi, c)
        kq["chay_luc"] = kq.get("gio_anh") or kq.get("gio_roas") or chay_luc(lich)
        if cu: kq["thay_cho"] = thay_cho(cu, moi, gio)
        if tn: ab_ghi(moi, tn)
        if not NGOAI: ghi_bo(cid, bo)
    except ChanLuat as e:
        if kq.get("cho_dong_bo") and cu and kq.get("moi"):   # camp mới đã tạo, còn chờ Meta đồng bộ → vẫn dừng camp cũ, không để hai camp cùng chạy
            try: kq["thay_cho"] = thay_cho(cu, kq["moi"], gio)
            except Exception as e2: kq["thay_cho"] = f"LỖI dừng camp cũ #{cu}: {str(e2)[:200]}"
        if kq.get("cho_dong_bo"): kq.update(ok=True, loi=None, ghi=str(e)[:240])   # đã tạo, chờ đồng bộ — máy đọc lại (doc_lai_roas.py), không phải lỗi
        else: kq.update(ok=None, chan=True, loi=str(e)[:240])
    except Exception as e:
        loi_may(kq, e)
    if that: ghi_nhat_ky(kq, luat, ai)
    print(json.dumps(kq, ensure_ascii=False))

if __name__ == "__main__":
    main(sys.argv[1:])
