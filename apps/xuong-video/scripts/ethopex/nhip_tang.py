"""NHỊP TĂNG NGÂN SÁCH (anh 21/10/2026 hỏi "có camp nào âm do tăng budget nhanh hơn bình thường"): ngày 21/10 phòng Ethopex chấm luật 30 phút/lần
mà không có khoảng nghỉ → cùng một camp hiện nút đầu phiên $2 rồi nút tăng $3, $5 → nhiều camp $1→$3→$5 trong 1–3 giờ, có camp $1→$2→$3 trong 2 phút;
7 camp âm hôm đó đều thuộc nhóm tăng dồn. Luật (kb #261 mục 8: tối đa 2–3 lần tăng/ngày, ưu tiên mốc 21h/24h/8h) → máy giữ:
  - hai lần tăng cách nhau ít nhất NGHI_GIO giờ
  - KHÔNG giới hạn số lần tăng/ngày (anh 21/10/2026: "ko nhất thiết phải giới hạn ngày tăng max 2 lần") — TOI_DA_NGAY = None; đặt số thì bật lại
Đọc lịch sử camp Ethopex (/campaigns/<id>/history — mỗi lần đổi có 2 dòng requested + status_changed → gộp các dòng cách nhau < 10 phút).
Dùng chung: luat-ethopex.py (không hiện nút) + lam-ethopex.py (nút cũ bấm muộn vẫn bị chặn)."""
import datetime as dt

NGHI_GIO, TOI_DA_NGAY = 3, None
# GIẢM BẬC (anh 21/10/2026: "camp âm mà budget cao do set vội… giảm dần theo bậc… tránh giảm xong lại bị tăng đệ quy"):
#   giảm chỉ chấm trên số TRỌN ngày hôm qua (doanh thu về trễ), cách lần đổi ngân sách trước ≥ NGHI_GIAM_GIO; sau khi giảm khoá tăng KHOA_SAU_GIAM_GIO
#   và muốn tăng lại phải đạt ROI ≥ 50% trên số SAU lần giảm (luat-ethopex.py) — không dùng ROI tháng cũ → hết vòng tăng–giảm.
# KHOÁ SAU GIẢM 24 → 6 giờ (anh 24/10/2026: "về $15 mà tăng lại thì không bị mất nhịp"): giảm từng bậc $20 → $15, hồi lại (ROI từ ngày giảm ≥ 50%) thì lên lại sau 6 giờ
NGHI_GIAM_GIO, KHOA_SAU_GIAM_GIO = 6, 6
BAC = [1, 2, 3, 5, 7, 10, 15, 20, 30]
def xuong(ns, buoc=1):
    """mức thấp hơn ns `buoc` bậc trên thang (tối thiểu $1)"""
    duoi = [b for b in BAC if b < ns - 1e-9]
    return duoi[max(0, len(duoi) - buoc)] if duoi else None
def chan_giam(api, cid, bay_gio=None):
    """→ lý do chưa được giảm (vừa đổi ngân sách < NGHI_GIAM_GIO giờ), None nếu được"""
    now = bay_gio or dt.datetime.now(dt.timezone.utc); vn = lambda x: x + dt.timedelta(hours=7)
    ls = sorted(lan_tang(api, cid) + lan_giam(api, cid), reverse=True)
    if ls and (now - ls[0]).total_seconds() < NGHI_GIAM_GIO * 3600: return f"vừa đổi ngân sách lúc {vn(ls[0]):%H:%M} — chờ đủ {NGHI_GIAM_GIO} giờ số liệu"
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

def chan_tang(api, cid, bay_gio=None):
    """→ câu lý do nếu CHƯA được tăng (vừa tăng / đủ lần trong ngày), None nếu được"""
    now = bay_gio or dt.datetime.now(dt.timezone.utc); vn = lambda x: x + dt.timedelta(hours=7)
    g = lan_giam(api, cid)
    if g and (now - g[0]).total_seconds() < KHOA_SAU_GIAM_GIO * 3600:   # CHỐNG TĂNG–GIẢM QUA LẠI: vừa giảm thì khoá tăng KHOA_SAU_GIAM_GIO giờ
        return f"vừa giảm lúc {vn(g[0]):%H:%M %d/%m} — khoá tăng tới {vn(g[0] + dt.timedelta(hours=KHOA_SAU_GIAM_GIO)):%H:%M %d/%m}"
    ls = lan_tang(api, cid)
    if ls and (now - ls[0]).total_seconds() < NGHI_GIO * 3600:
        return f"vừa tăng lúc {vn(ls[0]):%H:%M} — chờ tới {vn(ls[0] + dt.timedelta(hours=NGHI_GIO)):%H:%M} (cách nhau ≥ {NGHI_GIO} giờ)"
    hom = [x for x in ls if vn(x).date() == vn(now).date()]
    if TOI_DA_NGAY and len(hom) >= TOI_DA_NGAY: return f"đã tăng {len(hom)} lần hôm nay (tối đa {TOI_DA_NGAY}/ngày) — để sang mốc 8h mai"
    return None

if __name__ == "__main__":   # tự kiểm (không gọi mạng)
    u = lambda s: dt.datetime.fromisoformat(s + "+00:00")
    gia = {"data": [{"created_at": "2026-10-21T07:37:10Z", "changes": [{"field": "budget_daily", "old": 3, "new": 5}]}, {"created_at": "2026-10-21T07:36:50Z", "changes": [{"field": "budget_daily", "old": 3, "new": 5}]},
                    {"created_at": "2026-10-21T04:01:00Z", "changes": [{"field": "budget_daily", "old": 1, "new": 3}]}, {"created_at": "2026-10-20T04:01:00Z", "changes": [{"field": "name", "old": "", "new": "x"}]}]}
    api = lambda p: gia
    assert len(lan_tang(api, 1)) == 2, "2 dòng cách 20 giây là MỘT lần tăng"
    assert chan_tang(api, 1, u("2026-10-21T08:00:00")).startswith("vừa tăng"), "23 phút sau lần tăng phải chặn"
    assert chan_tang(api, 1, u("2026-10-21T11:00:00")) is None, "đủ 3 giờ thì tăng tiếp — không giới hạn số lần/ngày"
    assert chan_tang(api, 1, u("2026-10-22T01:30:00")) is None, "sang ngày mới (8h30 VN) được tăng"
    _CACHE.clear()
    gia2 = {"data": [{"created_at": "2026-10-22T01:00:00Z", "changes": [{"field": "budget_daily", "old": 5, "new": 3}]}]}
    api2 = lambda p: gia2
    assert chan_tang(api2, 2, u("2026-10-22T04:00:00")).startswith("vừa giảm"), "vừa giảm 3 giờ trước → khoá tăng"
    assert chan_tang(api2, 2, u("2026-10-22T07:30:00")) is None, "sau 6 giờ hết khoá — hồi lại thì lên lại không mất nhịp (điều kiện ROI từ ngày giảm do luat-ethopex chấm)"
    assert chan_giam(api2, 2, u("2026-10-22T03:00:00")) is not None and chan_giam(api2, 2, u("2026-10-22T08:00:00")) is None, "giảm cách lần đổi trước ≥ 6 giờ"
    assert xuong(5) == 3 and xuong(7, 2) == 3 and xuong(2) == 1 and xuong(1) is None and xuong(30) == 20
    api0 = lambda p: {"data": []}
    assert chan_tang(api0, 1) is None
    print("tự kiểm: 9/9 đạt")
