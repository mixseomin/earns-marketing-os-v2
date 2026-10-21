"""NHỊP TĂNG NGÂN SÁCH (anh 21/10/2026 hỏi "có camp nào âm do tăng budget nhanh hơn bình thường"): ngày 21/10 phòng Ethopex chấm luật 30 phút/lần
mà không có khoảng nghỉ → cùng một camp hiện nút đầu phiên $2 rồi nút tăng $3, $5 → nhiều camp $1→$3→$5 trong 1–3 giờ, có camp $1→$2→$3 trong 2 phút;
7 camp âm hôm đó đều thuộc nhóm tăng dồn. Luật (kb #261 mục 8: tối đa 2–3 lần tăng/ngày, ưu tiên mốc 21h/24h/8h) → máy giữ:
  - mỗi camp tối đa TOI_DA_NGAY lần tăng trong một ngày giờ VN
  - hai lần tăng cách nhau ít nhất NGHI_GIO giờ
Đọc lịch sử camp Ethopex (/campaigns/<id>/history — mỗi lần đổi có 2 dòng requested + status_changed → gộp các dòng cách nhau < 10 phút).
Dùng chung: luat-ethopex.py (không hiện nút) + lam-ethopex.py (nút cũ bấm muộn vẫn bị chặn)."""
import datetime as dt

NGHI_GIO, TOI_DA_NGAY = 3, 2

def lan_tang(api, cid):
    """→ danh sách thời điểm (UTC) các lần TĂNG ngân sách, mới nhất trước"""
    ls = (api(f"/api/v1/campaigns/{cid}/history") or {}).get("data") or []
    t = []
    for h in ls:
        for ch in h.get("changes") or []:
            if "budget" in (ch.get("field") or ""):
                try:
                    if float(ch.get("new") or 0) > float(ch.get("old") or 0): t.append(dt.datetime.fromisoformat(str(h["created_at"]).replace("Z", "+00:00")))
                except (TypeError, ValueError): pass
    t.sort(reverse=True); gop = []
    for x in t:
        if not gop or (gop[-1] - x).total_seconds() > 600: gop.append(x)
    return gop

def chan_tang(api, cid, bay_gio=None):
    """→ câu lý do nếu CHƯA được tăng (vừa tăng / đủ lần trong ngày), None nếu được"""
    now = bay_gio or dt.datetime.now(dt.timezone.utc); vn = lambda x: x + dt.timedelta(hours=7)
    ls = lan_tang(api, cid)
    if ls and (now - ls[0]).total_seconds() < NGHI_GIO * 3600:
        return f"vừa tăng lúc {vn(ls[0]):%H:%M} — chờ tới {vn(ls[0] + dt.timedelta(hours=NGHI_GIO)):%H:%M} (cách nhau ≥ {NGHI_GIO} giờ)"
    hom = [x for x in ls if vn(x).date() == vn(now).date()]
    if len(hom) >= TOI_DA_NGAY: return f"đã tăng {len(hom)} lần hôm nay (tối đa {TOI_DA_NGAY}/ngày) — để sang mốc 8h mai"
    return None

if __name__ == "__main__":   # tự kiểm (không gọi mạng)
    u = lambda s: dt.datetime.fromisoformat(s + "+00:00")
    gia = {"data": [{"created_at": "2026-10-21T07:37:10Z", "changes": [{"field": "budget_daily", "old": 3, "new": 5}]}, {"created_at": "2026-10-21T07:36:50Z", "changes": [{"field": "budget_daily", "old": 3, "new": 5}]},
                    {"created_at": "2026-10-21T04:01:00Z", "changes": [{"field": "budget_daily", "old": 1, "new": 3}]}, {"created_at": "2026-10-20T04:01:00Z", "changes": [{"field": "name", "old": "", "new": "x"}]}]}
    api = lambda p: gia
    assert len(lan_tang(api, 1)) == 2, "2 dòng cách 20 giây là MỘT lần tăng"
    assert chan_tang(api, 1, u("2026-10-21T08:00:00")).startswith("vừa tăng"), "23 phút sau lần tăng phải chặn"
    assert chan_tang(api, 1, u("2026-10-21T11:00:00")).startswith("đã tăng 2"), "đủ 2 lần trong ngày phải chặn"
    assert chan_tang(api, 1, u("2026-10-22T01:30:00")) is None, "sang ngày mới (8h30 VN) được tăng"
    api0 = lambda p: {"data": []}
    assert chan_tang(api0, 1) is None
    print("tự kiểm: 5/5 đạt")
