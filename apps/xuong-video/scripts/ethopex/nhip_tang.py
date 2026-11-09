"""NHỊP TĂNG NGÂN SÁCH (anh 21/10/2026 hỏi "có camp nào âm do tăng budget nhanh hơn bình thường"): ngày 21/10 phòng Ethopex chấm luật 30 phút/lần
mà không có khoảng nghỉ → cùng một camp hiện nút đầu phiên $2 rồi nút tăng $3, $5 → nhiều camp $1→$3→$5 trong 1–3 giờ, có camp $1→$2→$3 trong 2 phút;
7 camp âm hôm đó đều thuộc nhóm tăng dồn. Luật (kb #261 mục 8: tối đa 2–3 lần tăng/ngày, ưu tiên mốc 21h/24h/8h) → máy giữ:
  - hai lần tăng cách nhau ít nhất NGHI_GIO giờ (24 từ 05/11/2026)
  - KHÔNG giới hạn số lần tăng/ngày (anh 21/10/2026: "ko nhất thiết phải giới hạn ngày tăng max 2 lần") — TOI_DA_NGAY = None; đặt số thì bật lại
Đọc lịch sử camp Ethopex (/campaigns/<id>/history — mỗi lần đổi có 2 dòng requested + status_changed → gộp các dòng cách nhau < 10 phút).
Dùng chung: luat-ethopex.py (không hiện nút) + lam-ethopex.py (nút cũ bấm muộn vẫn bị chặn)."""
import datetime as dt, json, os, subprocess
BANG_LUAT = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "web", "src", "lib", "etp-bang-luat.json")))   # sổ luật chung: thang bậc

# NGHI_GIO 3 → 24 (anh 05/11/2026 duyệt: ROI sau tăng tụt ngay và không hồi suốt 48 giờ — một bậc mỗi 24 giờ)
NGHI_GIO, TOI_DA_NGAY = int(BANG_LUAT["khung_doi"]["nghi_gio"]), None   # sổ luật chung (trang đọc cùng số)
# NGOẠI LỆ TĂNG DỒN (anh 05/11/2026 "sửa đi"; số toàn đội 20/10–05/11: tăng lần nữa < 24h khi camp đã tiêu ≥ 90% ngân sách MỚI (07/11/2026 hạ còn ≥ 50% — sổ luật chung nap_chi) + ROI hôm nay ≥ 100%,
# bước ≤ ×1,5 → lãi 24h hơn để nguyên $12,77/camp, 0% âm, n=9; mọi tăng dồn < 6h +$6,58): đạt cổng thì được tăng tiếp sau NGHI_DON_GIO giờ.
# Cổng = khung_doi.nap_chi / sang_roi của sổ luật chung (cùng cổng tăng trong ngày của máy luật — du_so là MỘT công thức cho cả hai).
NGHI_DON_GIO = int(BANG_LUAT["khung_doi"]["nghi_don_gio"])
KD = BANG_LUAT["khung_doi"]
# TIÊU DỒN (anh 05/11/2026 "Ok. Làm đi"): tới 13:00 VN (DON_GIO giờ đầu ngày Ethopex) camp đã tiêu ≥ DON_13H × ngân sách lúc đó → HOÃN tăng tối nay,
# giữ nguyên ngân sách; hôm sau tiêu đều thì tăng như thường. Số nhà 20/10–04/11, 466 lần máy tăng: ≥ 75% NS tới 13h → hôm sau +17% (39% lãi),
# < 75% → +30…+39% (54–67% lãi). Một chỗ cho máy luật (_du_tang), máy làm (du_don), trang (thẻ xét luật + biểu đồ giờ). Không áp ★ ROAS, không chạm giảm/tắt.
DON_13H, DON_GIO = float(KD["don_13h"]), int(KD["don_gio"])
# KHUNG TĂNG NHANH (anh 10/11/2026 — sổ luật chung khung_doi.nhanh): đạt cổng du_so thì tăng ngay, không chờ nhịp, không hoãn tiêu dồn
NHANH = [tuple(x) for x in KD.get("nhanh") or []]
def trong_nhanh(bay_gio=None):
    h = ((bay_gio or dt.datetime.now(dt.timezone.utc)) + dt.timedelta(hours=7)).hour
    return any((a <= h < b) if a <= b else (h >= a or h < b) for a, b in NHANH)
def tieu_don(chi_13h, ns_13h):
    """chi tới 13h VN ≥ DON_13H × ngân sách lúc 13h → True (hoãn tăng); thiếu số (None) → False, không chặn oan"""
    return chi_13h is not None and bool(ns_13h) and float(chi_13h) >= DON_13H * float(ns_13h)
def so_13h(cid, ngay_utc):
    """(chi tới 13h hôm nay, ngân sách lúc 13h) của camp từ kho — ngân sách lúc 13h = ngân sách TRƯỚC lần máy tăng đầu tiên trong ngày (nhật ký tang), None nếu không tăng"""
    if not os.environ.get("DATABASE_URL"): return None, None
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", f"""select coalesce((select sum(chi) from etp.so_gio_camp where camp_id = {int(cid)} and ngay = '{ngay_utc}' and gio < {DON_GIO}), 0),
        (select min(nullif(regexp_replace(truoc, '[^0-9.]', '', 'g'), '')::numeric) from etp.nhat_ky where ok and viec = 'tang' and camp_id = {int(cid)} and (luc at time zone 'utc')::date = '{ngay_utc}')"""], capture_output=True, text=True)
    p = (r.stdout.strip().split("|") + [""])[:2]
    return (float(p[0]) if p[0] else None), (float(p[1]) if p[1] else None)
def du_so(chi, thu, ns, chi_13h=None, ns_13h=None):
    """đạt cổng tăng: hôm nay đã tiêu ≥ nap_chi × ngân sách đang chạy và ROI hôm nay ≥ sang_roi%; KHÔNG tiêu dồn (chi_13h / ns_13h — None = không xét)"""
    if not trong_nhanh():   # khung tăng nhanh (anh 10/11/2026): không hoãn tiêu dồn; ngoài khung giữ nguyên
        if tieu_don(chi_13h, ns_13h or ns): return False
    chi, thu, ns = float(chi or 0), float(thu or 0), float(ns or 0)
    return ns > 0 and chi >= float(KD["nap_chi"]) * ns and thu >= (1 + float(KD["sang_roi"]) / 100) * chi
def du_don(api, cid, bay_gio=None):
    """đọc số HÔM NAY (ngày Ethopex = ngày UTC) + ngân sách đang chạy của camp từ API rồi chấm du_so — cho máy làm (lam-ethopex) khi không có sẵn số"""
    now = bay_gio or dt.datetime.now(dt.timezone.utc); d = now.date().isoformat()
    rows = (api("/api/v1/report", {"columns": ["campaign_name", "cost", "revenue"], "filters": {"campaign_id": [int(cid)]}, "metric_conditions": [], "limit": 100, "page": 1, "page_size": 100, "date_from": d, "date_to": d}) or {}).get("rows") or []
    c = (api(f"/api/v1/campaigns/{cid}") or {}).get("campaign") or {}
    c13, n13 = so_13h(cid, d)
    return du_so(sum(float(x.get("cost") or 0) for x in rows), sum(float(x.get("revenue") or 0) for x in rows), c.get("budget_daily"), chi_13h=c13, ns_13h=n13 or c.get("budget_daily"))
# GIẢM BẬC (anh 21/10/2026: "camp âm mà budget cao do set vội… giảm dần theo bậc… tránh giảm xong lại bị tăng đệ quy"):
#   giảm chỉ chấm trên số TRỌN ngày hôm qua (doanh thu về trễ), cách lần đổi ngân sách trước ≥ NGHI_GIAM_GIO; sau khi giảm khoá tăng KHOA_SAU_GIAM_GIO
#   và muốn tăng lại phải đạt ROI ≥ 50% trên số SAU lần giảm (luat-ethopex.py) — không dùng ROI tháng cũ → hết vòng tăng–giảm.
# KHOÁ SAU GIẢM 24 → 6 giờ (anh 24/10/2026: "về $15 mà tăng lại thì không bị mất nhịp"): giảm từng bậc $20 → $15, hồi lại (ROI từ ngày giảm ≥ 50%) thì lên lại sau 6 giờ
# GIẢM GIỐNG TĂNG (anh 25/10/2026: "sao phải đợi đến mai"): giảm tiếp sau một lần GIẢM cách ≥ 3 giờ (bằng nhịp tăng); camp vừa TĂNG mà âm thì giảm NGAY
# (không chờ) — chỉ khoá TĂNG sau giảm 6 giờ để không vòng tăng–giảm.
NGHI_GIAM_GIO, KHOA_SAU_GIAM_GIO = 3, int(BANG_LUAT["khung_doi"]["khoa_sau_giam_gio"])   # khoá tăng sau giảm: sổ luật chung (trang etp tính mốc tăng cùng số)
BAC = list(BANG_LUAT["thang"])   # thang bậc = sổ luật chung (gồm $30 — đích T30)
def xuong(ns, buoc=1):
    """mức thấp hơn ns `buoc` bậc trên thang (tối thiểu $1)"""
    duoi = [b for b in BAC if b < ns - 1e-9]
    return duoi[max(0, len(duoi) - buoc)] if duoi else None
def chan_giam(api, cid, bay_gio=None):
    """→ lý do chưa được giảm (vừa đổi ngân sách < NGHI_GIAM_GIO giờ), None nếu được"""
    now = bay_gio or dt.datetime.now(dt.timezone.utc); vn = lambda x: x + dt.timedelta(hours=7)
    g = lan_giam(api, cid)   # chỉ lần GIẢM gần nhất mới khoá giảm tiếp; vừa tăng mà âm thì giảm luôn
    if g and (now - g[0]).total_seconds() < NGHI_GIAM_GIO * 3600: return f"vừa giảm lúc {vn(g[0]):%H:%M} — chờ đủ {NGHI_GIAM_GIO} giờ số liệu"
    return None

_CACHE = {}
def _lan(api, cid, chieu):
    """→ thời điểm (UTC) các lần đổi ngân sách theo chiều (+1 tăng / −1 giảm), mới nhất trước; 2 dòng lịch sử cách < 10 phút = một lần"""
    if cid not in _CACHE: _CACHE[cid] = (api(f"/api/v1/campaigns/{cid}/history") or {}).get("data") or []
    t = []
    for h in _CACHE[cid]:
        for ch in h.get("changes") or []:
            if "budget" in (ch.get("field") or ""):
                try:
                    if (float(ch.get("new") or 0) - float(ch.get("old") or 0)) * chieu > 0: t.append(dt.datetime.fromisoformat(str(h["created_at"]).replace("Z", "+00:00")))
                except (TypeError, ValueError): pass
    t.sort(reverse=True); gop = []
    for x in t:
        if not gop or (gop[-1] - x).total_seconds() > 600: gop.append(x)
    return gop
def lan_tang(api, cid): return _lan(api, cid, +1)
def lan_giam(api, cid): return _lan(api, cid, -1)

def cho_tang(api, cid, bay_gio=None, du=None):
    """→ (câu lý do, mốc UTC được tăng) nếu CHƯA được tăng (vừa tăng / vừa giảm / đủ lần trong ngày), (None, None) nếu được.
    MỘT luật cho lệnh tăng (chan_tang) và thẻ xét luật (luat-ethopex: dòng "Nhịp tăng" + cho_toi — trang etp ghi còn bao lâu máy tăng, anh 06/11/2026).
    du = camp đạt cổng tăng dồn (None → tự đọc API khi cần)"""
    now = bay_gio or dt.datetime.now(dt.timezone.utc); vn = lambda x: x + dt.timedelta(hours=7)
    g = lan_giam(api, cid)
    if g and (now - g[0]).total_seconds() < KHOA_SAU_GIAM_GIO * 3600:   # CHỐNG TĂNG–GIẢM QUA LẠI: vừa giảm thì khoá tăng KHOA_SAU_GIAM_GIO giờ
        mo = g[0] + dt.timedelta(hours=KHOA_SAU_GIAM_GIO)
        return f"vừa giảm lúc {vn(g[0]):%H:%M %d/%m} — khoá tăng tới {vn(mo):%H:%M %d/%m}", mo
    ls = lan_tang(api, cid)
    if ls and (now - ls[0]).total_seconds() < NGHI_GIO * 3600:
        gap = (now - ls[0]).total_seconds() / 3600
        if gap >= NGHI_DON_GIO and du is None:
            try: du = du_don(api, cid, now)
            except Exception: du = False
        if du and trong_nhanh(now): return None, None   # KHUNG TĂNG NHANH: đạt cổng → tăng ngay, không chờ nhịp (anh 10/11/2026)
        if gap < NGHI_DON_GIO or not du:
            return ((f"vừa tăng lúc {vn(ls[0]):%H:%M} — chờ tới {vn(ls[0] + dt.timedelta(hours=NGHI_GIO)):%H:%M} (cách nhau ≥ {NGHI_GIO} giờ; "
                     f"đã tiêu ≥ {float(KD['nap_chi']):.0%} ngân sách mới + ROI hôm nay ≥ {KD['sang_roi']}% thì được từ {vn(ls[0] + dt.timedelta(hours=NGHI_DON_GIO)):%H:%M})"),
                    ls[0] + dt.timedelta(hours=NGHI_DON_GIO if gap < NGHI_DON_GIO and du else NGHI_GIO))
    hom = [x for x in ls if vn(x).date() == vn(now).date()]
    if TOI_DA_NGAY and len(hom) >= TOI_DA_NGAY:
        return f"đã tăng {len(hom)} lần hôm nay (tối đa {TOI_DA_NGAY}/ngày) — để sang mốc 8h mai", None
    return None, None

def chan_tang(api, cid, bay_gio=None, du=None):
    """→ câu lý do nếu CHƯA được tăng, None nếu được (cho_tang là luật)"""
    return cho_tang(api, cid, bay_gio, du)[0]

if __name__ == "__main__":   # tự kiểm (không gọi mạng)
    u = lambda s: dt.datetime.fromisoformat(s + "+00:00")
    gia = {"data": [{"created_at": "2026-10-21T07:37:10Z", "changes": [{"field": "budget_daily", "old": 3, "new": 5}]}, {"created_at": "2026-10-21T07:36:50Z", "changes": [{"field": "budget_daily", "old": 3, "new": 5}]},
                    {"created_at": "2026-10-21T04:01:00Z", "changes": [{"field": "budget_daily", "old": 1, "new": 3}]}, {"created_at": "2026-10-20T04:01:00Z", "changes": [{"field": "name", "old": "", "new": "x"}]}]}
    api = lambda p: gia
    assert len(lan_tang(api, 1)) == 2, "2 dòng cách 20 giây là MỘT lần tăng"
    assert chan_tang(api, 1, u("2026-10-21T08:00:00")).startswith("vừa tăng"), "23 phút sau lần tăng phải chặn"
    assert chan_tang(api, 1, u("2026-10-21T08:00:00"), du=True).startswith("vừa tăng"), "15h VN (ngoài khung nhanh): đạt cổng nhưng chưa đủ 3 giờ vẫn chặn"
    assert chan_tang(api, 1, u("2026-10-21T14:00:00"), du=True) is None, "21h VN (khung nhanh) + đạt cổng → tăng ngay dù vừa tăng"
    assert chan_tang(api, 1, u("2026-10-21T14:00:00"), du=False).startswith("vừa tăng"), "khung nhanh mà KHÔNG đạt cổng → vẫn theo nhịp"
    assert trong_nhanh(u("2026-10-21T01:30:00")) and trong_nhanh(u("2026-10-21T22:00:00")) and not trong_nhanh(u("2026-10-21T05:30:00")) and not trong_nhanh(u("2026-10-21T23:30:00")), "8h30 / 5h VN trong khung; 12h30 / 6h30 VN ngoài khung"
    assert chan_tang(api, 1, u("2026-10-21T11:00:00"), du=False).startswith("vừa tăng"), "3–24 giờ mà KHÔNG đạt cổng thì chặn (nhịp 24 giờ)"
    assert chan_tang(api, 1, u("2026-10-21T11:00:00"), du=True) is None, "3 giờ + đạt cổng (tiêu ≥ nap_chi × NS mới, ROI ≥ 100%) → tăng dồn được"
    assert chan_tang(api, 1, u("2026-10-22T08:00:00"), du=False) is None, "đủ 24 giờ thì tăng, không cần cổng dồn"
    _n = float(KD["nap_chi"]); assert du_so(_n + 0.01, 2 * (_n + 0.01), 1) and not du_so(_n - 0.01, 2, 1) and not du_so(1, 1.9, 1) and not du_so(1, 2, 0), "cổng: chi ≥ nap_chi × NS (sổ luật chung) + thu ≥ 2 × chi"
    assert chan_tang(api, 1, u("2026-10-22T01:30:00"), du=False).startswith("vừa tăng"), "18 giờ sau (8h30 VN hôm sau), không đạt cổng → còn chặn (nhịp 24 giờ, 05/11/2026)"
    assert chan_tang(api, 1, u("2026-10-22T01:30:00"), du=True) is None, "18 giờ sau + đạt cổng → được"
    _CACHE.clear()
    gia2 = {"data": [{"created_at": "2026-10-22T01:00:00Z", "changes": [{"field": "budget_daily", "old": 5, "new": 3}]}]}
    api2 = lambda p: gia2
    assert chan_tang(api2, 2, u("2026-10-22T04:00:00")).startswith("vừa giảm"), "vừa giảm 3 giờ trước → khoá tăng"
    assert chan_tang(api2, 2, u("2026-10-22T07:30:00")) is None, "sau 6 giờ hết khoá — hồi lại thì lên lại không mất nhịp (điều kiện ROI từ ngày giảm do luat-ethopex chấm)"
    assert chan_giam(api2, 2, u("2026-10-22T03:00:00")) is not None and chan_giam(api2, 2, u("2026-10-22T04:30:00")) is None, "giảm tiếp cách lần GIẢM trước ≥ 3 giờ"
    _CACHE.clear()
    assert chan_giam(api, 1, u("2026-10-21T08:00:00")) is None, "vừa TĂNG 23 phút trước mà âm → được giảm ngay (không chờ)"
    assert xuong(5) == 4 and xuong(7, 2) == 4 and xuong(2) == 1 and xuong(1) is None and xuong(30) == 20, "thang sổ luật [1,2,3,4,6,9,13,20,30]"
    api0 = lambda p: {"data": []}
    assert chan_tang(api0, 1) is None
    print("nhip_tang tự kiểm: đạt")
