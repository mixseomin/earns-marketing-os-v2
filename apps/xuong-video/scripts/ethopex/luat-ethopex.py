#!/usr/bin/env python3
"""LUẬT ETHOPEX — MỘT chỗ chấm mọi luật vận hành camp (kb #261 mục 8–8g) trên box3 (đọc API Report + chi tiết camp, khoá ở studio xv_khoa_ngoai).
Ai dùng: kiem-ngan-sach.sh (gọi tay từ Mac qua ssh) · phòng Ethopex của cty (theo dõi định kỳ, báo Telegram). CHỈ ĐỌC + BÁO — không sửa camp.
Dùng (trên box3, đã nạp .env.production):  python3 luat-ethopex.py [roi_toi_thieu=20] [spending_toi_thieu=50] [--json]
  --tong: chỉ tổng số (hôm nay / hôm qua / tháng / từ đầu + camp lãi / lỗ nhất) cho bảng ghim, không chấm luật.
  --json: in một đối tượng {luc, tang, dau_phien, giam, tat, moc30, tu_choi, gan} — mỗi mục {id, ten, chu} để máy theo dõi so trùng."""
import json, os, re, subprocess, sys, urllib.request, datetime as dt
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
# TĂNG BẬC chỉ khi ROI tháng > 50% (Support Dol 21/10/2026: "a chỉ tăng budget những camp rois > 50% nhé") — roi_min (20) còn dùng cho luật giảm / theo dõi
ROI_TANG = 50
HQ_NHO = 0.5   # luật B1: chi hôm qua dưới tỷ lệ này của ngân sách hiện tại thì ROI hôm qua âm không chặn tăng trong ngày
roi_min = float(ARGS[0]) if ARGS else 20; sp_min = float(ARGS[1]) if len(ARGS) > 1 else 50; JSON = '--json' in sys.argv
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
# API Ethopex chậm / quá giờ (23/10/2026 21:49 "The read operation timed out" thành tin báo động giả) → mọi lượt gọi tự thử lại 3 lần, nghỉ 5–10s.
# Lỗi 4xx không thử lại. Còn lỗi sau 3 lần mới vào nhóm loi_may (báo nhanh, tự xoá) — KHÔNG bao giờ nhét vào nhóm bị Meta từ chối.
import time, urllib.error
_goc_mo = urllib.request.urlopen
def _mo(*a, **k):
    for i in range(3):
        try: return _goc_mo(*a, **k)
        except OSError as e:
            if (isinstance(e, urllib.error.HTTPError) and e.code < 500) or i == 2: raise
            time.sleep(5 * (i + 1))
urllib.request.urlopen = _mo
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
def bc(tu, den):
    body = json.dumps({"columns": ["campaign_name", "daily_budget", "spending", "roi", "profit", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 1000, "page": 1, "page_size": 1000, "date_from": tu, "date_to": den}).encode()
    r = urllib.request.Request("https://api.ethopex.dev/api/v1/report", data=body, method="POST", headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-kiem"})
    g = {}
    for x in json.load(urllib.request.urlopen(r, timeout=60)).get("rows", []):   # report tách dòng theo content → cộng theo camp
        a = g.setdefault(x["campaign_id"], {"ten": x["campaign_name"], "budget": float(x.get("daily_budget") or 0), "chi": 0.0, "thu": 0.0})
        a["chi"] += float(x.get("cost") or 0); a["thu"] += float(x.get("revenue") or 0); a["budget"] = max(a["budget"], float(x.get("daily_budget") or 0))
    return g
# LUẬT ĐỔI THEO DUYỆT TRÊN TELEGRAM (cty ethopex.mjs nút el:, tệp DATA/ethopex-luat-duyet.json) — mỗi khoá anh duyệt mới có hiệu lực
try: DUYET = json.load(open(os.path.join(os.environ.get("CTY_DATA_DIR", "/var/lib/cty"), "ethopex-luat-duyet.json")))
except Exception: DUYET = {}
TANG_CHOT, CHOT_GIAM, GB_9H, HIEN_CHOT = (bool(DUYET.get(k)) for k in ("tang_chot", "chot_giam", "gb_9h", "hien_chot"))
vn = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) + dt.timedelta(hours=7)
# NGÀY ETHOPEX = NGÀY UTC (07:00 → 07:00 giờ VN; Report mặc định timezone utc+00:00, đo 22/10/2026). Hỏi theo ngày VN thì 0–7h sáng VN hỏi một
# ngày UTC chưa bắt đầu → số "hôm nay" = 0 (gốc của khung đêm cũ). tang_chot duyệt → dùng ngày UTC.
nay = dt.datetime.now(dt.timezone.utc).date() if (TANG_CHOT or HIEN_CHOT) else vn.date()
d = lambda n: (nay - dt.timedelta(days=n)).isoformat()
def chot_chi():
    """SỐ HÔM NAY ĐÃ CHỐT CHI: Ethopex ghi tiền chi theo ĐỢT (giờ 14 UTC 22/10: chi $0 thu $55, giờ 15: chi $46) còn doanh thu ghi liên tục → chỉ cộng
    các giờ tới giờ cuối cùng đã có đợt chi (toàn tài khoản). → (giờ chốt UTC | None, {camp: {chi, thu}})"""
    body = json.dumps({"columns": ["hour", "campaign_name", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 10000, "page": 1, "page_size": 10000, "date_from": d(0), "date_to": d(0)}).encode()
    rows = json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev/api/v1/report", data=body, method="POST", headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-kiem"}), timeout=90)).get("rows", [])
    co = [int(x.get("hour") or 0) for x in rows if float(x.get("cost") or 0) > 0]
    if not co: return None, {}
    H = max(co); g = {}
    for x in rows:
        if int(x.get("hour") or 0) > H: continue
        a = g.setdefault(x["campaign_id"], {"chi": 0.0, "thu": 0.0}); a["chi"] += float(x.get("cost") or 0); a["thu"] += float(x.get("revenue") or 0)
    return H, g
if '--tong' in sys.argv:   # bảng số rút gọn (cty ethopex.mjs bangEthopex — tin ghim phòng Ethopex): tổng hôm nay / tháng / từ đầu + camp lãi / lỗ nhất hôm nay
    def tong(g):
        chi = sum(a["chi"] for a in g.values()); thu = sum(a["thu"] for a in g.values())
        return {"chi": round(chi, 2), "thu": round(thu, 2), "lai": round(thu - chi, 2), "roi": round((thu - chi) / chi * 100, 1) if chi else None, "camp": sum(1 for a in g.values() if a["chi"] > 0)}
    h = bc(d(0), d(0)); co = [dict(id=k, ten=a["ten"][:40], lai=round(a["thu"] - a["chi"], 2), roi=round((a["thu"] - a["chi"]) / a["chi"] * 100) if a["chi"] else None, budget=a["budget"]) for k, a in h.items() if a["chi"] > 0]
    co.sort(key=lambda x: -x["lai"])
    # bảng theo NỘI DUNG (phim) như màn Report Ethopex nhóm "Content": group_by content_name, xếp ROI giảm dần (anh 21/10/2026: "trình bày được kiểu này không")
    body = json.dumps({"columns": ["content_name", "roi", "profit", "cost", "revenue"], "group_by": ["content_name"], "filters": {}, "metric_conditions": [], "limit": 1000, "page": 1, "page_size": 1000, "date_from": d(0), "date_to": d(0)}).encode()
    nd = json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev/api/v1/report", data=body, method="POST", headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-kiem"}), timeout=60)).get("rows", [])
    nd = sorted([dict(ten=x.get("content_group_name") or "?", roi=round(x["roi"]) if x.get("roi") is not None else None, lai=round(float(x.get("profit") or 0), 2), chi=round(float(x.get("cost") or 0), 2)) for x in nd if float(x.get("cost") or 0) > 0], key=lambda x: -(x["roi"] if x["roi"] is not None else -1e9))
    if HIEN_CHOT:
        try: _H, _ = chot_chi()
        except Exception: _H = None
    print(json.dumps({"luc": f"{vn:%H:%M %d/%m}", **({"chot_toi": f"{(_H + 1 + 7) % 24:02d}:00", "ngay_tu": "07:00"} if HIEN_CHOT and _H is not None else {}), "hom": {**tong(h), "budget": round(sum(x["budget"] for x in co), 2)}, "qua": tong(bc(d(1), d(1))), "thang": tong(bc(nay.replace(day=1).isoformat(), d(0))), "tron": tong(bc("2026-01-01", d(0))),
                      "top": co[:3], "day": [x for x in co[::-1] if x["lai"] < 0][:2], "noi_dung": nd}, ensure_ascii=False)); sys.exit(0)
# KHUNG DÀI = 30 NGÀY TRƯỢT, không phải tháng lịch (anh 24/10/2026: "camp mới chạy lại tính là tháng thì không hợp lý"): tháng lịch về 1 ngày dữ liệu mỗi
# mùng 1 → luật tăng / nhân bản chấm trên một ngày. Tên biến giữ 'thang' (nhiều chỗ dùng) nhưng nghĩa = 30 ngày gần nhất; camp trẻ hơn 30 ngày thì
# đó là ROI TỪ LÚC LÊN — chữ báo ghi đúng số ngày có dữ liệu (ROI 6 ngày), không gọi là "tháng".
hom = bc(d(0), d(0)); thang = bc(d(29), d(0))
try: _tao_kho = {int(l.split("|")[0]): dt.date.fromisoformat(l.split("|")[1][:10]) for l in q("select camp_id, (tao at time zone 'UTC')::date from etp.camp where tao is not null").splitlines() if "|" in l}
except Exception: _tao_kho = {}
def rd(cid):
    """nhãn khung dài của camp: 'ROI 6 ngày' (camp < 30 ngày: từ lúc lên) / 'ROI 30 ngày'"""
    t = _tao_kho.get(int(cid)); n = min(30, (nay - t).days + 1) if t else 30
    return f"ROI {max(n, 1)} ngày"
# chot_giam duyệt: luật giảm / tắt / so xu hướng chỉ dùng NGÀY ĐÃ KHÉP (bỏ hôm nay đang chạy, chi chưa ghi đủ): 3 ngày gần = D−3..D−1, 4 ngày trước = D−7..D−4, cộng dồn tới D−1
gan, truoc, tron = (bc(d(3), d(1)), bc(d(7), d(4)), bc("2026-01-01", d(1))) if CHOT_GIAM else (bc(d(2), d(0)), bc(d(6), d(3)), bc("2026-01-01", d(0)))
if TANG_CHOT:   # luật tăng đọc số hôm nay ĐÃ CHỐT CHI (giữ ngân sách từ Report ngày)
    try:
        _H, _ch = chot_chi()
        hom = {cid: {**a, "chi": _ch.get(cid, {}).get("chi", 0.0), "thu": _ch.get(cid, {}).get("thu", 0.0)} for cid, a in hom.items()}
    except Exception as e: print(f"chot_chi lỗi: {e}", file=sys.stderr)
roi = lambda a: (a["thu"] - a["chi"]) / a["chi"] * 100 if a["chi"] else None
BAC = [1, 3, 5, 7, 10, 15, 20]
ke = lambda b: next((x for x in BAC if x > b + 1e-9), None)
dat, theo, giam, dau_phien, moc30 = [], [], [], [], []
# KHUNG 0–5h VN (anh 22/10/2026: "giờ đang là giờ tối ưu tốt (21h–5h sáng VN) thì phải check xem tăng được không"): qua 0h số HÔM NAY về 0 nên
# "Spending hôm nay > 50%" không bao giờ đạt đúng lúc Mỹ đang mua → trong khung này xét chi tiêu + ROI của NGÀY HÔM QUA (trọn ngày) thay cho hôm nay;
# thêm điều kiện ROI hôm qua ≥ 0% (không tăng camp vừa có một ngày lỗ).
KHUNG_DEM = 0 <= vn.hour < 5 and not TANG_CHOT   # ngày UTC (tang_chot) thì 0–5h VN số hôm nay đã có thật, không cần mượn hôm qua
LD_SIET = bool(DUYET.get("ld_siet"))
hqua = bc(d(1), d(1))
ROAS_CHI = 100; _ngay3 = {1: hqua, 2: bc(d(2), d(2)), 3: bc(d(3), d(3))}   # ngày trọn D−1..D−3 cho tiêu chí bid ROAS
for cid, a in sorted(thang.items()):
    h = hom.get(cid, {"chi": 0.0, "budget": a["budget"]}); r = roi(a)
    if KHUNG_DEM:
        y = hqua.get(cid, {"chi": 0.0, "thu": 0.0}); sp = y["chi"] / a["budget"] * 100 if a["budget"] else 0; ry = roi(y)
        nhan, them_dk = "spending hôm qua", (ry is not None and ry >= 0)
    else:
        sp = h["chi"] / a["budget"] * 100 if a["budget"] else 0; ry = None; nhan, them_dk = "spending hôm nay", True
    dong = f"#{a['ten'][:70]} · ${a['budget']:g}" + (f" → ${ke(a['budget']):g}" if ke(a['budget']) else " (trần $20)") + f" · {nhan} {sp:.0f}%" + (f" · ROI hôm qua {ry:+.0f}%" if ry is not None else "") + f" · {rd(cid)} {r:+.0f}% · lãi ${a['thu'] - a['chi']:+.2f}" if r is not None else ""
    if not dong: continue
    # TĂNG TRONG NGÀY (tang_chot duyệt, anh 22/10/2026 "nếu không tăng sẽ lỡ nhịp tối ưu và trend"): ROI hôm nay đã chốt chi ≥ 50%, đã chi ≥ 30% ngân sách,
    # ROI hôm qua ≥ 0% (camp chưa có hôm qua thì bỏ qua điều kiện này) → một bậc; nhịp ≥ 3 giờ giữa hai lần tăng vẫn do nhip_tang chặn
    # NỚI B1 (anh 26/10/2026 "theo B1"): hôm qua âm mà chi hôm qua < 50% ngân sách HIỆN TẠI (mẫu nhỏ — vừa lên bậc / mới chạy) thì bỏ qua điều kiện hôm qua.
    # Chạy lại 19–24/10: nhóm này hôm sau ROI +74% (4/6 lãi); hôm qua âm với chi ≥ 50% ngân sách hôm sau −4% (16/24 lỗ) → vẫn chặn.
    _yq = hqua.get(cid); _ryq = roi(_yq) if _yq and _yq["chi"] >= 0.3 else None; _rh = roi(h) if h.get("chi", 0) >= 0.3 else None
    _hq_nho = _ryq is not None and _ryq < 0 and _yq["chi"] < HQ_NHO * a["budget"]
    tb_ngay = TANG_CHOT and _rh is not None and _rh >= 50 and h["chi"] >= 0.3 * a["budget"] and (_ryq is None or _ryq >= 0 or _hq_nho)
    if tb_ngay and not (r >= ROI_TANG and sp > sp_min and them_dk): dong += f" · ROI hôm nay (chốt chi) {_rh:+.0f}%, chi {h['chi'] / a['budget'] * 100:.0f}% ngân sách"
    if tb_ngay and _hq_nho: dong += f" · hôm qua {_ryq:+.0f}% nhưng chi ${_yq['chi']:.2f} < {HQ_NHO * 100:.0f}% ngân sách → bỏ qua (luật B1)"
    # KHÔNG TĂNG KHI HÔM NAY ĐANG LỖ (anh duyệt 23/10/2026 sau Step Back: #66055 −31% hôm nay vẫn được tăng $10 → $15 nhờ ROI tháng): ROI hôm nay
    # (số đã chốt chi, chi ≥ $0,3) < 0 → không vào danh sách tăng, kể cả máy tự tăng; ROI tháng chỉ còn là điều kiện cần.
    lo_nay = _rh is not None and _rh < 0
    if ((r >= ROI_TANG and sp > sp_min and them_dk) or tb_ngay) and ke(a["budget"]) and not lo_nay: dat.append((cid, dong))
    elif r >= roi_min or sp > sp_min * 0.8: theo.append((cid, dong))
    # LD SIẾT (khi anh duyệt trên Telegram — DATA/ethopex-luat-duyet.json "ld_siet"): camp vừa lỗ hôm qua / lỗ cả tháng thì không tăng vì vài chục cent
    # lãi đầu phiên (22/10/2026: #65115 lên $2 nhờ lãi $0,36 buổi sáng trong khi hôm qua −86%, tháng −62%)
    _y = hqua.get(cid); _ry = roi(_y) if _y and _y["chi"] >= 0.3 else None
    ld_chan = LD_SIET and ((_ry is not None and _ry < 0) or (r is not None and r < 0))
    if h["chi"] >= (1.5 if TANG_CHOT else 0.5) and a["budget"] < 3 and not ld_chan:
        rh = (h.get("thu", 0) - h["chi"]) / h["chi"] * 100
        dich = 3 if rh >= 100 else 2
        if rh > 50 and dich > a["budget"]: dau_phien.append((cid, f"#{a['ten'][:70]} · ${a['budget']:g} → ${dich} · ROI hôm nay {rh:+.0f}% · lãi hôm nay ${h.get('thu', 0) - h['chi']:+.2f}"))
    # ĐỦ TIÊU CHÍ BID ROAS (Support Dol 24/10/2026, anh chuyển: "camp tiêu cost ~ > $100 mà ROI > 50% ổn định 2–3 ngày có thể áp dụng ROAS; mốc $30 chưa
    # phải đủ tiêu chí"): chi 30 ngày ≥ $100 · mọi ngày TRỌN có chi ≥ $1 trong 3 ngày gần nhất ROI ≥ 50%, tối thiểu 2 ngày như vậy · ROI 30 ngày ≥ 50%
    _ng = [(n, (_ngay3[n].get(cid) or {"chi": 0.0, "thu": 0.0})) for n in (1, 2, 3)]
    _co = [(n, x) for n, x in _ng if x["chi"] >= 1]
    if a["chi"] >= ROAS_CHI and r is not None and r >= 50 and len(_co) >= 2 and all(roi(x) >= 50 for n, x in _co):
        moc30.append((cid, f"#{a['ten'][:70]} · ${a['budget']:g}/ngày · chi ${a['chi']:.2f}, lãi ${a['thu'] - a['chi']:+.2f}, {rd(cid)} {r:+.0f}% · " + " · ".join(f"{d(n)[8:10]}/{d(n)[5:7]} {roi(x):+.0f}%" for n, x in _co) + " → đủ tiêu chí bid ROAS"))
    g2, t2 = gan.get(cid), truoc.get(cid)
    if g2 and t2 and g2["chi"] >= 1.5 and t2["chi"] >= 1.5 and (g2["chi"] + t2["chi"]) >= 3:
        rg, rt = roi(g2), roi(t2)
        if rt is not None and rg is not None and ((rt >= roi_min and rg < 0) or rt - rg >= 30):
            giam.append((cid, f"#{a['ten'][:70]} · ROI 4 ngày trước {rt:+.0f}% → 3 ngày gần {rg:+.0f}% (chi ${g2['chi']:.2f})"))

def api(p):
    return json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, headers={"authorization": "Bearer " + T, "user-agent": "mos2-kiem"}), timeout=30))
_NK = None
def nhat_ky_tat(cid, luc_utc):
    """dòng nhật ký luật (studio ethopex_nhat_ky) của lệnh tắt camp này gần mốc luc_utc nhất (±20 phút)"""
    global _NK
    if _NK is None:
        _NK = json.loads(subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", "select gia_tri::text from xv_khoa_ngoai where ten='ethopex_nhat_ky'"], capture_output=True, text=True).stdout.strip() or "[]")
    best = None
    for x in _NK:
        if x.get("viec") != "tat" or not x.get("ok") or int(x.get("id") or 0) != int(cid): continue
        try: t = dt.datetime.strptime(x["luc"], "%H:%M %d/%m/%Y").replace(tzinfo=dt.timezone(dt.timedelta(hours=7)))
        except Exception: continue
        d = abs((t - luc_utc).total_seconds())
        if d <= 1200 and (best is None or d < best[0]): best = (d, x)
    return best[1] if best else None

def ly_do_dong(c):
    """LÝ DO camp bị đóng (anh 21/10/2026: "lý do đóng là gì phải ghi rõ"). API Ethopex không có trường lý do → đọc lịch sử camp
    (/campaigns/<id>/history: ai đổi state → PAUSED, qua đường nào, kèm metadata) + đối chiếu luật của mình (OFF, ad bị từ chối).
    → (câu lý do | None nếu chưa từng có lệnh tắt, giờ dừng VN | None)"""
    try: ls = api(f"/api/v1/campaigns/{c['id']}/history").get("data") or []
    except Exception as e: ls = []
    h = next((x for x in ls if any(ch.get("field") == "state" and ch.get("new") == "PAUSED" for ch in x.get("changes") or [])), None)
    if not h: return (None, None)
    luc = (dt.datetime.fromisoformat(str(h["created_at"]).replace("Z", "+00:00")) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m")
    md = {k: v for k, v in (h.get("metadata") or {}).items() if not k.startswith("control_") and v not in (None, "", [], {})}
    ai = h.get("actor_type") or ""
    if ai == "user":
        cau = f"tắt tay — {h.get('actor_name') or 'người dùng'} qua {h.get('source_label') or h.get('source') or '?'}"
        # tắt qua API = lệnh của mình → LUẬT + AI DUYỆT lấy từ nhật ký luật (anh 22/10/2026: "phải ghi rõ lý do tắt camp thuộc rule nào")
        if h.get("source") == "api":
            nk = nhat_ky_tat(c["id"], dt.datetime.fromisoformat(str(h["created_at"]).replace("Z", "+00:00")))
            cau = (f"tắt qua API — luật: {nk['luat']} · duyệt: {nk.get('ai') or '?'}" if nk else cau + " (không thấy dòng nhật ký luật — tắt ngoài máy)")
    else: cau = f"{h.get('actor_type_label') or ai or 'hệ thống'} Ethopex tự tắt" + (f" ({h.get('actor_name')})" if h.get("actor_name") else "")
    if md: cau += " · " + ", ".join(f"{k}={str(v)[:40]}" for k, v in list(md.items())[:3])
    t = tron.get(c["id"]) or tron.get(str(c["id"]))
    if t and t["chi"] > 10 and roi(t) is not None and roi(t) < -50: cau += f" · khớp luật OFF (tiêu ${t['chi']:.2f}, ROI {roi(t):+.0f}%)"
    return (cau, luc)
# NHỊP TĂNG (nhip_tang.py): camp vừa tăng < 3 giờ thì KHÔNG hiện nút tăng / đầu phiên nữa
import importlib.util as _iu
_s = _iu.spec_from_file_location("nhip_tang", os.path.join(os.path.dirname(os.path.abspath(__file__)), "nhip_tang.py")); NT = _iu.module_from_spec(_s); _s.loader.exec_module(NT)
def _loc(ds):
    ra = []
    for cid, chu in ds:
        try: ly = NT.chan_tang(api, cid)
        except Exception: ly = None
        if not ly: ra.append((cid, chu))
    return ra
dat, dau_phien = _loc(dat), _loc(dau_phien)
# TĂNG LẠI sau một lần giảm: ROI phải ≥ 50% trên số TỪ NGÀY SAU lần giảm (không dùng ROI tháng cũ — tránh vòng tăng–giảm, anh 21/10/2026)
_sau = {}
def _sau_giam_ok(cid):
    g = NT.lan_giam(api, cid)
    if not g: return True
    # số TỪ NGÀY GIẢM (kể cả ngày giảm), không đợi sang hôm sau — anh 24/10/2026: hồi lại thì lên lại không mất nhịp (khoá 6 giờ ở nhip_tang)
    tu = (g[0] if (TANG_CHOT or HIEN_CHOT) else g[0] + dt.timedelta(hours=7)).date().isoformat()
    if tu > d(0): return False
    if tu not in _sau: _sau[tu] = bc(tu, d(0))
    a = _sau[tu].get(cid) or _sau[tu].get(str(cid))
    return bool(a and a["chi"] > 0 and roi(a) >= ROI_TANG)
dat = [(cid, chu) for cid, chu in dat if _sau_giam_ok(cid)]
dau_phien = [(cid, chu) for cid, chu in dau_phien if _sau_giam_ok(cid)]
# GIẢM BẬC (luật GB): chỉ phiên sáng (6–13h VN), trên số TRỌN ngày hôm qua: ngân sách > $1, hôm qua đã tiêu ≥ 50% ngân sách, ROI hôm qua < 0% và ROI 3 ngày < 20%
# → xuống một bậc; lỗ nặng (ROI hôm qua < −50% và tiêu đủ ngân sách) → hai bậc. ROI 0–50% là VÙNG GIỮ (không tăng, không giảm).
# Camp vừa tăng mà ngày trọn kế tiếp âm → giảm luôn, không xét ROI 3 ngày (anh 24/10/2026), từng bậc một: $20 → $15 → $10.
ha = []
if (9 if GB_9H else 6) <= vn.hour < 13:   # gb_9h duyệt: ngày UTC hôm qua khép 07:00 VN + ~2 giờ cho đợt chi cuối → 9h mới đủ số trọn
    for cid, a in thang.items():
        ns = a["budget"]; y = hqua.get(cid)
        if ns <= 1 or not y or y["chi"] < 0.5 * ns: continue
        ry = roi(y); g3 = gan.get(cid); r3 = roi(g3) if g3 else ry
        if ry is None or ry >= 0: continue
        # GIẢM SAU KHI TĂNG (anh 24/10/2026: "camp sau khi tăng thì hôm sau bị âm thì áp dụng rule giảm theo bậc… lên $20 nhưng hôm nay âm thì phải giảm
        # xuống $10" → "tạo thêm 1 bậc về $15 trước rồi mới về $10"): lần tăng gần nhất rơi vào 48 giờ trước đầu hôm nay → bỏ điều kiện ROI 3 ngày; xuống từng bậc.
        try: _lt = max(NT.lan_tang(api, cid) or [None], key=lambda t: t or dt.datetime.min.replace(tzinfo=dt.timezone.utc))
        except Exception: _lt = None
        _dau = dt.datetime.combine(nay, dt.time(), tzinfo=dt.timezone.utc) - (dt.timedelta(hours=7) if not (TANG_CHOT or HIEN_CHOT) else dt.timedelta(0))
        sau_tang = _lt is not None and _dau - dt.timedelta(hours=48) <= _lt < _dau - dt.timedelta(hours=12)
        if not sau_tang and r3 is not None and r3 >= 20: continue
        buoc = 2 if ry < -50 and y["chi"] >= ns else 1; dich = NT.xuong(ns, buoc)
        try: ly = NT.chan_giam(api, cid)
        except Exception: ly = None
        if dich and not ly: ha.append((cid, f"#{a['ten'][:70]} · ${ns:g} → ${dich:g} · ROI hôm qua {ry:+.0f}% (chi ${y['chi']:.2f}) · ROI 3 ngày {r3:+.0f}%" + (" · lỗ nặng: xuống 2 bậc" if buoc == 2 and not sau_tang else "") + (f" · ngày đầu sau lần tăng lúc {(_lt + dt.timedelta(hours=7)):%H:%M %d/%m} đã âm" if sau_tang else "")))
# GIẢM SỚM CAMP LỚN ROI MỎNG (Support Dol 24/10/2026, anh chuyển + "phải áp dụng sớm nhất nếu có thể để giảm chi phí"): camp ngân sách ≥ $15 tiêu đều
# (hôm qua + hôm nay đã chốt chi ≥ 1 ngày ngân sách) mà ROI gộp 1–2 ngày đó < 30% → giảm ngay trong nhịp, không chờ phiên sáng. Vừa tăng (48 giờ) mà
# hôm nay âm mà đang $20 → giảm dù ROI gộp ≥ 30%; luôn xuống MỘT bậc ($20 → $15 → $10, anh 24/10/2026). Đổi ngân sách < 6 giờ vẫn bị chan_giam chặn. Mốc an toàn giữ ROI > 50% (luật tăng).
ROI_GIAM_SOM = 30
_da_ha = {cid for cid, _ in ha}
for cid, a in thang.items():
    ns = a["budget"]
    if ns < 15 or cid in _da_ha: continue
    y, h = hqua.get(cid, {"chi": 0.0, "thu": 0.0}), hom.get(cid, {"chi": 0.0, "thu": 0.0})
    g2 = {"chi": y["chi"] + h.get("chi", 0.0), "thu": y["thu"] + h.get("thu", 0.0)}
    if g2["chi"] < ns: continue
    r2 = roi(g2); rh = roi(h) if h.get("chi", 0) >= 0.3 else None
    if r2 is None or (r2 >= ROI_GIAM_SOM and not (ns >= 20 and rh is not None and rh < 0)): continue
    try: _lt = max(NT.lan_tang(api, cid) or [None], key=lambda t: t or dt.datetime.min.replace(tzinfo=dt.timezone.utc))
    except Exception: _lt = None
    vua_tang = _lt is not None and (dt.datetime.now(dt.timezone.utc) - _lt).total_seconds() < 48 * 3600
    am = vua_tang and ns >= 20 and ((rh is not None and rh < 0) or r2 < 0)   # anh: $20 vừa tăng mà hôm nay âm → giảm, TỪNG BẬC: $15 trước rồi mới $10
    dich = NT.xuong(ns, 1)
    try: ly = NT.chan_giam(api, cid)
    except Exception: ly = None
    if dich and not ly: ha.append((cid, f"#{a['ten'][:70]} · ${ns:g} → ${dich:g} · ROI hôm qua + hôm nay {r2:+.0f}%" + (f" · hôm nay {rh:+.0f}%" if rh is not None else "") + f" (chi ${g2['chi']:.2f})" + (" · vừa tăng lên $20 mà hôm nay âm" if am else f" < {ROI_GIAM_SOM}%") + " · giảm sớm (Support)"))
# GIẢM TRONG NGÀY — ĐỐI XỨNG VỚI TĂNG TRONG NGÀY (anh 25/10/2026: "các camp âm phải có cơ chế giảm bậc giống với camp dương"): trước đây camp dương
# được tăng từng bậc ngay trong ngày, còn camp âm chỉ giảm mỗi sáng (GB, số trọn hôm qua) hoặc GIẢM SỚM (chỉ camp ≥ $15) → camp $10 / $7 / $5 âm
# cả ngày vẫn tiêu đủ. Gương của tăng trong ngày: ROI hôm nay (đã chốt chi) ≤ −5% · đã chi ≥ 30% ngân sách · ROI hôm qua < 50% (camp vừa lãi đậm
# không bị cắt vì doanh thu hôm nay về trễ) → xuống MỘT bậc, mọi mức ngân sách > $1; giảm tiếp sau lần giảm cách ≥ 3 giờ, vừa tăng mà âm thì giảm ngay (nhip_tang.chan_giam).
ROI_HQ_GIU, ROI_NAY_GIAM = 50, -5   # hôm nay phải âm rõ (≤ −5%): −0% / −2% giữa ngày thường chỉ là doanh thu về trễ
_da_ha = {cid for cid, _ in ha}
if TANG_CHOT:   # cần số hôm nay đã chốt chi (giống tăng trong ngày)
    for cid, a in thang.items():
        ns = a["budget"]
        if ns <= 1 or cid in _da_ha: continue
        h = hom.get(cid, {"chi": 0.0, "thu": 0.0})
        if h.get("chi", 0) < max(0.3 * ns, 0.3): continue
        rh = roi(h)
        if rh is None or rh > ROI_NAY_GIAM: continue
        _yq = hqua.get(cid); _ryq = roi(_yq) if _yq and _yq["chi"] >= 0.3 else None
        if _ryq is not None and _ryq >= ROI_HQ_GIU: continue
        dich = NT.xuong(ns, 1)
        try: ly = NT.chan_giam(api, cid)
        except Exception: ly = None
        if dich and not ly: ha.append((cid, f"#{a['ten'][:70]} · ${ns:g} → ${dich:g} · ROI hôm nay {rh:+.0f}% (chi ${h['chi']:.2f} = {h['chi'] / ns * 100:.0f}% ngân sách)"
                                          + (f" · ROI hôm qua {_ryq:+.0f}%" if _ryq is not None else "") + " · giảm trong ngày (đối xứng tăng trong ngày)"))
tu_choi, dong_l, loi_may = [], [], []
phim_cua, ds_camp = {}, []   # camp → content_id (camp đang chạy / đang đồng bộ) · danh sách camp (luật NB)
# camp bị Meta từ chối thì Ethopex chuyển PAUSED — trước 24/10/2026 nhánh PAUSED nuốt mất, máy thay creative không bao giờ thấy (#68876 Step Back).
# Kho etp (đồng bộ 10 phút, giao = delivery_status của ad) cho biết camp nào đang DISAPPROVED mà không phải gọi chi tiết từng camp tắt.
tc_kho = set(q("select camp_id from etp.camp where giao = 'DISAPPROVED' and coalesce(trang_thai, '') <> 'ARCHIVED'").split())
lich_tat = set(q("select camp_id from etp.lich_tat").split())   # camp tạm dừng vì LỊCH GIỜ (apps/etp/lich-gio.py) — không phải bị đóng, không báo
try:
    for c in api("/api/v1/campaigns?page_size=500")["data"]:
        ds_camp.append(c)
        if c.get("state") == "ARCHIVED": continue
        # sync_status 'error' KHÔNG phải "đang đồng bộ": Ethopex dừng camp kèm lỗi (Meta từ chối, lỗi đẩy FB). Trước 24/10/2026 nhánh dưới coi mọi
        # trạng thái khác done là camp mới đang đồng bộ → #68876 (PAUSED · error · DISAPPROVED lúc 07:40) bị bỏ qua im lặng, không Telegram, không tự thay.
        if c.get("state") == "PAUSED" and c.get("sync_status") == "error":
            if "DISAPPROVED" in str(c.get("error") or "").upper() or str(c["id"]) in tc_kho:
                tu_choi.append((c["id"], f"#{c['id']}: {c['name'][:60]} · ad bị Meta từ chối (camp đã bị dừng) → máy thay creative sạch cùng phim rồi bật lại"))
            else: dong_l.append((c["id"], f"#{c['id']}: {c['name'][:60]} · Ethopex dừng vì lỗi: {str(c.get('error') or '?')[:120]}"))
            continue
        if c.get("state") == "PAUSED" and str(c["id"]) in tc_kho:
            tu_choi.append((c["id"], f"#{c['id']}: {c['name'][:60]} · ad bị Meta từ chối (camp đã bị dừng) → máy thay creative sạch cùng phim")); continue
        if c.get("state") == "PAUSED" and str(c["id"]) in lich_tat: continue   # tạm dừng theo lịch giờ, máy tự bật lại khi tới khung BẬT
        if c.get("state") == "PAUSED":   # camp đã bị đóng (rule Ethopex / tay) — anh 21/10/2026: "các camp chạm rule đóng cũng gửi lên telegram"
            # camp MỚI đang đồng bộ lên FB (sync_status checking_video / checking_ads…) Ethopex để PAUSED tạm — không phải bị đóng (21/10/2026 báo nhầm #66054/#66055)
            if (c.get("sync_status") or "done") not in ("done", "synced"): continue
            a = thang.get(c["id"]) or thang.get(str(c["id"])) or {}; r = roi(a) if a else None
            ly, luc = ly_do_dong(c), None
            luc = ly[1] or ((dt.datetime.fromisoformat(str(c.get("updated_at", "")).replace("Z", "+00:00")) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m") if c.get("updated_at") else "?")
            if ly[0] is None: continue   # chưa từng chạy mà cũng chưa ai tắt (đang chờ lịch / đồng bộ) — không báo
            dong_l.append((c["id"], f"#{c['id']}: {c['name'][:60]} · dừng lúc {luc} · lý do: {ly[0]}" + (f" · tháng này chi ${a['chi']:.2f}, thu ${a.get('thu', 0):.2f}" + (f", ROI {r:+.0f}%" if r is not None else "") if a else "")))
            continue
        dct = api(f"/api/v1/campaigns/{c['id']}"); ad = ((dct.get("ad_groups") or [{}])[0].get("ads") or [{}])[0]
        if ad.get("content_id"): phim_cua[c["id"]] = ad["content_id"]
        if "DISAPPROVED" in str(ad.get("error") or "") or ad.get("delivery_status") == "DISAPPROVED":
            tu_choi.append((c["id"], f"#{c['id']}: {c['name'][:60]} · ad bị Meta từ chối → Edit camp, thay creative sạch đã duyệt cùng phim (soat-camp-api.py gợi ý)"))
except Exception as e:
    loi_may.append((0, f"không đọc được chi tiết camp: {str(e)[:80]}"))
# LUẬT NB — NHÂN BẢN CAMP THẮNG (anh 22/10/2026: tự động, báo Telegram, mỗi phim tối đa 30 camp ĐANG CHẠY — camp thua tắt thì nhường chỗ cho creative mới).
# Camp đang bật, ROI tháng ≥ 100%, đã tiêu ≥ $10, ROI 3 ngày ≥ 50% (còn đang thắng) → 1 bản $1; mỗi camp gốc tối đa 1 bản / 24 giờ, mỗi phim tối đa
# 3 bản / ngày. Bản nhân bản do nhan-ban.py tạo (tên "(nhan ban N cua <gốc>)"), Phòng Ethopex tự chạy + báo 🧬.
# NỚI (anh 23/10/2026: "còn nhiều camp thắng mà sao không tự clone… tất cả chỗ này lên full là có $1000"): ROI tháng ≥ 50%, tiêu ≥ $3, ROI 3 ngày ≥ 20%,
# mỗi phim 6 bản/ngày, mỗi camp gốc 1 bản / 6 giờ (cũ 100% · $10 · 50% · 3/ngày · 24 giờ — Step Back +206% tiêu $6 không được nhân bản)
NB_ROI, NB_CHI, NB_ROI3, NB_PHIM_NGAY, TRAN_PHIM_CHAY = 50, 3, 20, 6, 30
TRAN_NB = float(q("select coalesce((select gia_tri::text::numeric from etp.cau_hinh where khoa = 'tran_camp'), 30)") or 30)   # = nhan-ban.py: chỉ clone camp đã chạm trần
nb = []
try:
    gio24 = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=6)   # mỗi camp gốc 1 bản / 6 giờ (tên biến giữ nguyên)
    tao = lambda c: dt.datetime.fromisoformat(str(c.get("created_at")).replace("Z", "+00:00")) if c.get("created_at") else gio24 - dt.timedelta(days=1)
    goc_moi = {int(m.group(1)) for c in ds_camp if tao(c) > gio24 for m in [re.search(r"\(nhan ban \d+ cua (\d+)\)$", c.get("name", ""))] if m}
    dang_chay = {}
    for cid, p in phim_cua.items(): dang_chay[p] = dang_chay.get(p, 0) + 1
    ban_phim = {}
    for c in ds_camp:
        m = re.search(r"\(nhan ban \d+ cua (\d+)\)$", c.get("name", ""))
        if m and tao(c) > gio24 and phim_cua.get(int(m.group(1))): ban_phim[phim_cua[int(m.group(1))]] = ban_phim.get(phim_cua[int(m.group(1))], 0) + 1
    bat = {c["id"] for c in ds_camp if c.get("state") == "ACTIVE"}
    # CỔNG BÃO HOÀ PHIM (B, anh 25/10/2026 "rule hoá"): phim ROI hôm qua < 50% hoặc tụt dưới 70% hôm kia → không nhân thêm (etp.phim_bao_hoa, canh-bao.py tính)
    try: chan_phim = {int(l.split("|")[0]): l.split("|", 1)[1] for l in q("select content_id, chan_nb from etp.phim_bao_hoa where chan_nb is not null").splitlines() if "|" in l}
    except Exception: chan_phim = {}
    # NGHỈ SAU LỖI (25/10/2026: 16.751 lần nhân bản thất bại trong nhật ký — luật đề xuất lại cùng camp bị chặn ở MỖI nhịp, #67663 3 lần / phút):
    # camp gốc nhân bản lỗi trong 6 giờ qua thì bỏ qua lượt này
    try: loi6 = {int(x) for x in q("select distinct camp_id from etp.nhat_ky where viec = 'nhan_ban' and ok is not true and luc > now() - interval '6 hours' and camp_id is not null").split()}
    except Exception: loi6 = set()
    for cid, a in sorted(thang.items(), key=lambda z: -(roi(z[1]) or 0)):
        r, g3, p = roi(a), roi(gan.get(cid) or {"chi": 0, "thu": 0}), phim_cua.get(cid)
        if cid not in bat or not p or r is None or r < NB_ROI or a["chi"] < NB_CHI or g3 is None or g3 < NB_ROI3 or cid in goc_moi: continue
        if dang_chay.get(p, 0) >= TRAN_PHIM_CHAY or ban_phim.get(p, 0) >= NB_PHIM_NGAY or int(p) in chan_phim or cid in loi6: continue
        if a["budget"] < TRAN_NB: continue   # nhan-ban.py chỉ clone camp đã chạm trần (anh 25/10/2026) — không đề xuất camp chưa tới, tránh hàng trăm lượt bị chặn
        dang_chay[p] = dang_chay.get(p, 0) + 1; ban_phim[p] = ban_phim.get(p, 0) + 1
        nb.append((cid, f"#{a['ten'][:70]} · {rd(cid)} {r:+.0f}% · tiêu ${a['chi']:.2f} · ROI 3 ngày {g3:+.0f}% → nhân bản 1 camp $1 (phim {p}: {dang_chay[p]}/{TRAN_PHIM_CHAY} camp chạy)"))
except Exception as e:
    loi_may.append((0, f"luật NB lỗi: {str(e)[:80]}"))
# CHỈ CAMP ĐANG BẬT mới vào danh sách tăng / giảm (22/10/2026: bảng đề xuất tăng #65648 SIMP NO MORE đã tắt vì phim cấm — máy tự tăng vẫn từ chối camp PAUSED,
# nhưng bảng không được đưa camp đã tắt cho anh duyệt). Không đọc được danh sách camp thì giữ nguyên (đường tăng thật vẫn tự kiểm trạng thái).
_bat = {c["id"] for c in ds_camp if c.get("state") == "ACTIVE"}
if ds_camp: dat, dau_phien, theo, giam, moc30, ha = ([x for x in ds if x[0] in _bat] for ds in (dat, dau_phien, theo, giam, moc30, ha))
# BỘ TÀI KHOẢN của từng camp (anh 23/10/2026: tên trên Telegram ghi [1]/[2] = bộ TK) — theo ad_account_id ↔ studio ethopex_bo_tk
_bo = {int(v["tk"]): k for k, v in json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_bo_tk'") or "{}").items()}
_bo_c = {int(c["id"]): _bo.get(int(c.get("ad_account_id") or 0)) for c in ds_camp}
# THANG NHÂN BẢN — CHỈ BỘ 2 (anh 25/10/2026: "áp dụng chiến lược này cho bộ tk số 2 trước. Bộ 1 vẫn giữ nguyên"): đổi ngân sách lớn (> ~20%) là chỉnh
# sửa đáng kể → camp học lại. Bộ 2 KHÔNG tăng ngân sách camp đang chạy (không tăng bậc / đầu phiên / T30 / nhân bản $1 NB) mà mở BẢN MỚI ở bậc kế
# THANG_NB, dùng creative KHÁC cùng phim (nhan-ban.py --thang chọn: 3 giây đầu khác thì Meta mới coi là creative khác; qua cổng chấm).
# Điều kiện (anh 25/10/2026 "áp dụng cho hôm nay"): camp bộ 2 chạm ĐÚNG luật tăng của bộ 1 (tăng bậc / tăng trong ngày / lãi đầu phiên — cùng mọi cổng:
# hôm nay không lỗ, tăng lại sau giảm, LD siết) → thay vì đổi ngân sách, mở một bản ở bậc kế; mỗi camp tối đa THANG_CON bản con, bản trước còn chạy thì
# không mở thêm. (Bản đầu đòi 2 ngày trọn ROI ≥ 50%: đo 25/10 bộ 2 có 0 camp đạt — không áp được hôm nay.) Bản thang chi ≥ 1 ngày ngân sách mà ROI ≤ −30% → đề xuất TẮT (anh bấm nút — luật cấm tự tắt).
# Bản thang không đi đường giảm bậc (giữ ngân sách lúc mở); camp bộ 2 cũ vẫn giảm như bộ 1. Không biết bộ (API lỗi) thì đọc kho etp — chặn tăng cho chắc.
_ch = lambda k, mac: json.loads(q(f"select gia_tri::text from etp.cau_hinh where khoa = '{k}'") or json.dumps(mac))   # một sổ với nhan-ban.py (migration 0333)
BO_THANG, THANG_NB, THANG_CON, THANG_TAT = [str(x) for x in _ch("thang_bo", ["2"])], sorted(float(x) for x in _ch("thang_muc", [1, 3, 7, 15, 30])), 2, -30
la_thang = lambda c: re.search(r"\(thang \$\d+ cua (\d+)\)$", c.get("name") or "")
bo2 = {cid for cid, b in _bo_c.items() if b in BO_THANG} | {int(x) for x in q("select camp_id from etp.camp where bo in (" + ",".join(f"'{b}'" for b in BO_THANG) + ")").split() if x.isdigit()}
_tang_bo2 = {int(x[0]) for x in dat + dau_phien if int(x[0] or 0) in bo2}
dat, dau_phien, nb = ([x for x in ds if int(x[0] or 0) not in bo2] for ds in (dat, dau_phien, nb))
_id_thang = {int(c["id"]) for c in ds_camp if la_thang(c)}
ha = [x for x in ha if int(x[0] or 0) not in _id_thang]
thang_nb, thang_tat = [], []
_bo_chan = {b: q(f"select etp.bo_chan_mo('{b}')") for b in BO_THANG}
try:
    _con = {}
    _la_ban_thang = lambda cid: int(cid) in _id_thang   # _id_thang: camp mang tên "(thang $N cua <gốc>)" (khai phía trên)
    for c in ds_camp:
        mt = la_thang(c)
        if mt: _con.setdefault(int(mt.group(1)), []).append(c)
    _chan_phim, _loi6 = locals().get("chan_phim") or {}, locals().get("loi6") or set()
    for cid, a in thang.items():
        if int(cid) not in _tang_bo2 or cid not in _bat: continue
        if _bo_chan.get(str(_bo_c.get(int(cid)) or "2")): continue   # bộ lỗ 3 ngày khép → không mở bản thang (etp.bo_chan_mo, anh 26/10/2026)
        # THANG ĐI TỪ ĐÁY (anh 27/10/2026: "nhân bản này sai rule rồi. Phải nhân từ $1 - $3... lên cơ mà?" — #68835 $10 mở thẳng bản $15 #71957):
        # camp gốc THƯỜNG (đã được tăng bậc kiểu cũ tới $5–$20) → bản thang đầu tiên tối đa bậc thứ hai ($3); chỉ bản nhân của chính một BẢN THANG
        # mới lên bậc kế ($3 → $7 → $15 → $30)
        ns = a["budget"]; dich = next((b for b in THANG_NB if b > ns + 1e-9), None)
        if dich and not _la_ban_thang(cid): dich = min(dich, THANG_NB[1] if len(THANG_NB) > 1 else THANG_NB[0])
        if not dich: continue
        con = _con.get(int(cid), [])
        if len(con) >= THANG_CON or any(x.get("state") == "ACTIVE" or (x.get("sync_status") or "done") not in ("done", "synced", "error") for x in con): continue
        h = hom.get(cid, {"chi": 0.0, "thu": 0.0}); y = hqua.get(cid) or {"chi": 0.0, "thu": 0.0}
        if int(phim_cua.get(cid) or 0) in _chan_phim or cid in _loi6: continue
        thang_nb.append((cid, f"#{a['ten'][:70]} · ${ns:g} đủ luật tăng · ROI hôm nay {(roi(h) if h.get('chi', 0) >= 0.3 else 0):+.0f}% (chi ${h.get('chi', 0):.2f})" + (f" · hôm qua {roi(y):+.0f}%" if y["chi"] >= 0.3 else "") + f" · {rd(cid)} {roi(a):+.0f}% → ${dich:g} bản mới (creative khác cùng phim; camp này giữ nguyên ngân sách)" + (f" · bản con thứ {len(con) + 1}" if con else "")))
    for c in ds_camp:
        if not la_thang(c) or c.get("state") != "ACTIVE": continue
        cid = c["id"]; a = tron.get(cid) or tron.get(str(cid)); ns = float((thang.get(cid) or {}).get("budget") or c.get("budget_daily") or 0)
        if a and ns and a["chi"] >= ns and roi(a) is not None and roi(a) <= THANG_TAT:
            thang_tat.append((cid, f"#{c['name'][:70]} · bản thang ${ns:g} · chi ${a['chi']:.2f} (≥ 1 ngày ngân sách) · ROI {roi(a):+.0f}% ≤ {THANG_TAT}% → TẮT"))
except Exception as e:
    loi_may.append((0, f"luật thang nhân bản lỗi: {str(e)[:80]}"))
# TẮT CHỈ XÉT CAMP ĐỦ 7 NGÀY (anh 22/10/2026: "ít nhất 7 ngày sẽ review tắt camp, chứ không tắt sớm") — camp trẻ hơn mà lỗ thì đi đường giảm bậc (GB)
TUOI_TAT = 7
_tao = {c["id"]: dt.datetime.fromisoformat(str(c["created_at"]).replace("Z", "+00:00")) for c in ds_camp if c.get("created_at")}
du_tuoi = lambda cid: cid in _tao and (dt.datetime.now(dt.timezone.utc) - _tao[cid]).days >= TUOI_TAT
tat_l = [(cid, f"#{a['ten'][:70]} · {(dt.datetime.now(dt.timezone.utc) - _tao[cid]).days} ngày · tiêu ${a['chi']:.2f} từ trước tới nay · ROI {roi(a):+.0f}% → TẮT") for cid, a in tron.items() if a["chi"] > 10 and roi(a) is not None and roi(a) < -50 and du_tuoi(cid)]
# T7 — LUẬT TẮT CỦA SUPPORT (Dol 26/10/2026: "Last 7 day, profit < 0, active day > 3, cost > $5 — những camp như này có thể off"; anh: "thêm và áp dụng rule này"):
# lấy THẲNG Report Ethopex 7 ngày ĐÃ KHÉP D−7..D−1 (thu hôm nay còn về trễ) với cột active_day của Ethopex = số ngày camp được BẬT trong kỳ — KHÔNG phải số ngày
# có chi (bản đầu đếm ngày có chi từ kho etp → 22 camp, Report của anh ra 57; anh 26/10/2026 "mày phải check lại rule"). Chỉ tắt camp đang chạy / đang tạm dừng vì lịch giờ.
T7_LAI = -1   # tắt khi lãi 7 ngày đã khép < −$1 (anh 26/10/2026: "T7 đổi là lãi 7N < -$1")
def _bc7():
    body = json.dumps({"columns": ["campaign_name", "active_day", "cost", "revenue", "profit"], "filters": {}, "metric_conditions": [], "limit": 2000, "page": 1, "page_size": 2000,
                       "date_from": (dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=7)).isoformat(), "date_to": (dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1)).isoformat()}).encode()
    g = {}
    for x in json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev/api/v1/report", data=body, method="POST", headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-kiem"}), timeout=90)).get("rows", []):
        a = g.setdefault(int(x["campaign_id"]), {"ten": x.get("campaign_name") or "", "chi": 0.0, "lai": 0.0, "ad": 0})
        a["chi"] += float(x.get("cost") or 0); a["lai"] += float(x.get("profit") or 0); a["ad"] = max(a["ad"], int(x.get("active_day") or 0))
    return g
_dc = _bat | {int(c) for c in q("select camp_id from etp.lich_tat").split() if c.isdigit()}   # trạng thái THẬT từ API (kho etp chậm 10 phút) + camp tạm dừng vì lịch
try:
    # anh 26/10/2026: "T7 đổi là lãi 7N < -$1" (bản Support: lãi < 0)
    _r7 = _bc7(); T7_DAT = {c: a for c, a in _r7.items() if a["lai"] < T7_LAI and a["chi"] > 5 and a["ad"] > 3}
except Exception as e:
    _r7 = {}; T7_DAT = {}; loi_may.append((0, f"luật T7 không đọc được Report: {str(e)[:80]}"))
# GẦN CHẠM T7 (anh 27/10/2026: etp.on.tc "cần show được camp đang chạm luật nào (chưa chạy), chuẩn bị chạm"): camp đang chạy, 7 ngày đã khép
# đã âm nhưng chưa đủ điều kiện T7 (lãi chưa < −$1, hoặc chi chưa > $5, hoặc ≤ 3 ngày bật) — chỉ báo trên etp, không làm gì
gan_t7 = [(c, f"#{a['ten'][:70]} · gần T7: 7 ngày đã khép lãi ${a['lai']:+.2f} (tắt khi < −$1) · chi ${a['chi']:.2f} (> $5) · {a['ad']} ngày bật (> 3)")
          for c, a in sorted(_r7.items(), key=lambda x: x[1]["lai"]) if c in _dc and c not in T7_DAT and a["lai"] < 0 and a["chi"] > 3]
tat7 = [(c, f"#{a['ten'][:70]} · 7 ngày đã khép: chi ${a['chi']:.2f} · lãi ${a['lai']:+.2f} · ROI {a['lai'] / a['chi'] * 100:+.0f}% · {a['ad']} ngày bật → TẮT (luật T7: lãi 7 ngày < −$1)")
        for c, a in sorted(T7_DAT.items(), key=lambda x: x[1]["lai"]) if c in _dc]
# DỪNG T7 (anh 27/10/2026: "Đặt 1 cái mới … Sau đó dừng T7") — thay bằng T2 bên dưới; giữ mã tính T7 để bật lại được, nhưng không đưa vào danh sách tắt / gần chạm
tat7, gan_t7 = [], []
# T2 — CẮT SAU 2 NGÀY ĐẦU (anh 27/10/2026, chọn "2 ngày đầu ROI < −20%" và đặt tên T2): tín hiệu đo trên 255 camp 20–26/10 (apps/etp/phan-tich/som.py) —
# ROI gộp 2 ngày có chi ĐẦU TIÊN < −20% → chỉ 6–12% thành lãi thực về sau (đúng ở cả hai nửa thời gian), 103 camp như vậy lỗ thêm $99 nếu để chạy.
# Xét trên kho etp.so_ngay, CHỈ ngày đã khép (trước hôm nay): camp có 2–3 ngày đã khép có chi (vừa hết 2 ngày đầu — không quét lại camp già đã hồi),
# 2 ngày đầu chi ≥ T2_CHI và ROI < −20%, ROI mọi ngày đã khép vẫn < −20% → TẮT HẲN (bỏ khỏi sổ lịch, không luật nào bật lại). Camp ROAS không áp.
T2_ROI, T2_CHI = -20, 5.0   # chi 2 ngày đầu tối thiểu $5 — ngang T7 (anh 27/10/2026 "nâng lên đi. T7 còn min chi là $5")
tat2 = []
try:
    _n2 = {}
    for _l in q(f"select s.camp_id, s.chi, s.thu, coalesce(c.ten, '') from etp.so_ngay s left join etp.camp c using (camp_id) where s.ngay < '{d(0)}' and s.chi > 0 order by s.camp_id, s.ngay").splitlines():
        _p = _l.split("|", 3)
        if len(_p) == 4 and _p[0].isdigit(): _n2.setdefault(int(_p[0]), [_p[3], []])[1].append((float(_p[1]), float(_p[2])))
    for _c, (_ten, _ds) in _n2.items():
        if _c not in _dc or not 2 <= len(_ds) <= 3: continue
        _c2, _t2 = _ds[0][0] + _ds[1][0], _ds[0][1] + _ds[1][1]; _ca, _ta = sum(x[0] for x in _ds), sum(x[1] for x in _ds)
        _r2, _ra = (_t2 - _c2) / _c2 * 100, (_ta - _ca) / _ca * 100
        if _c2 >= T2_CHI and _r2 < T2_ROI and _ra < T2_ROI:
            tat2.append((_c, f"#{_ten[:70]} · 2 ngày đầu: chi ${_c2:.2f} · lãi ${_t2 - _c2:+.2f} · ROI {_r2:+.0f}%" + (f" · cả {len(_ds)} ngày ROI {_ra:+.0f}%" if len(_ds) > 2 else "") + " → TẮT (luật T2: 2 ngày đầu ROI < −20%, chi ≥ $5)"))
    tat2.sort(key=lambda x: float(x[1].split("lãi $")[1].split(" ")[0]))
except Exception as e:
    loi_may.append((0, f"luật T2 lỗi: {str(e)[:80]}"))
# ROI TỤT chỉ đi đường GIẢM BẬC (anh 26/10/2026 "ds này chỉ cần giảm bậc"): kèm "$ns → $đích" một bậc để Telegram ra nút giảm thay nút tắt; camp $1 (đáy thang) chỉ báo
_dich_tut = lambda cid: (lambda ns: (ns, NT.xuong(ns, 1)) if ns else (None, None))(float((thang.get(cid) or {}).get("budget") or 0))
giam = [(cid, s + (lambda nd: f" · ${nd[0]:g} → ${nd[1]:g}" if nd[1] else " · đang ở đáy thang $1, không giảm được nữa")(_dich_tut(cid))) for cid, s in giam]
# LUẬT T30 (Support 23/10/2026: "$20 mà 2, 3 ngày spending > 80% và ROI vẫn cao > 80% thì tăng lên"; anh: "thêm rule này để có điều kiện tăng camp lên $30"):
# camp đang bật ở trần $20, trong 3 ngày ĐÃ KHÉP gần nhất (D−1..D−3) có ≥ 2 ngày tiêu > 80% ngân sách, ROI cộng các ngày đó > 80% → đề xuất $20 → $30, anh duyệt nút.
T30_SP, T30_ROI, T30_NGAY = 80, 80, 2
tang30 = []
try:
    ngay3 = [bc(d(k), d(k)) for k in (1, 2, 3)]
    bat30 = {c["id"] for c in ds_camp if c.get("state") == "ACTIVE"} if ds_camp else set(thang)
    for cid, a in thang.items():
        if cid not in bat30 or round(a["budget"]) != 20: continue
        du = [n[cid] for n in ngay3 if cid in n and n[cid]["chi"] > T30_SP / 100 * 20]
        if len(du) < T30_NGAY: continue
        if not _sau_giam_ok(cid): continue   # đã giảm → T30 cũng phải qua cổng tăng lại (anh 24/10/2026)
        g = {"chi": sum(x["chi"] for x in du), "thu": sum(x["thu"] for x in du)}; r = roi(g)
        if r is not None and r > T30_ROI:
            tang30.append((cid, f"#{a['ten'][:70]} · $20 → $30 · {len(du)}/3 ngày tiêu > {T30_SP}% ngân sách · ROI các ngày đó {r:+.0f}% · {rd(cid)} {roi(a):+.0f}%"))
except Exception as e:
    loi_may.append((0, f"luật T30 lỗi: {str(e)[:80]}"))
tang30 = [x for x in tang30 if int(x[0] or 0) not in bo2]
# DỪNG ĐÊM — CAMP ÂM TĂNG NHANH (anh 25/10/2026: "Trong phiên 9h tối đến 5h sáng mà các camp âm tăng nhanh hơn thì phải chủ động dừng luôn"):
# 21h–5h VN là giờ Mỹ mua mạnh, camp âm tiêu rất nhanh — chờ giảm bậc sáng mai là mất cả đêm. Camp đang bật, hôm nay (số đã chốt chi) chi ≥ 30% ngân sách,
# ROI ≤ −50%, và khoản LỖ vẫn đang tăng so với lượt chấm trước (≤ 90 phút) → máy TẮT luôn (lam-ethopex vẫn chặn camp ROI cộng dồn > 20%).
# Ngưỡng chọn bằng mô phỏng hai đêm 23–24/10 (scripts mo-phong theo đường giờ phim): 40%/−40%/lỗ +15% cắt ~$0; 30%/−50%/lỗ tăng cắt $4–6 mỗi đêm,
# dừng 21–33 camp, mất doanh thu ít nhất; 20%/−20% dừng 37–67 camp, có đêm lỗ còn tăng vì mất doanh thu về trễ.
# CHỈ CAMP CLONE Y NGUYÊN CREATIVE (anh 25/10/2026: "luật dừng này chỉ áp dụng cho camp là clone lại hoàn toàn creative. Còn camp creative mới vẫn duy trì
# theo dõi thêm"): camp mà creative của nó đã có camp khác tạo TRƯỚC (kho etp.camp) — camp đầu tiên của một creative không bao giờ bị dừng đêm.
# Ảnh chụp lỗ từng camp lưu xv_khoa_ngoai['ethopex_lo_dem'], chỉ ghi ở lượt --json (Phòng Ethopex ~35 phút/lượt).
DEM_ROI, DEM_CHI, DEM_TANG, DEM_PHUT = -50, 0.3, 0.01, 90   # DEM_TANG: lỗ tăng tối thiểu (tỷ lệ ngân sách) — chỉ cần còn đang tăng
dung_dem = []
if vn.hour >= 21 or vn.hour < 5:
    try:
        _truoc = json.loads(q("select coalesce(gia_tri, '{}'::jsonb)::text from xv_khoa_ngoai where ten='ethopex_lo_dem'") or "{}")
        _bay = dt.datetime.now(dt.timezone.utc); _anh = {}
        _clone_y = {int(x) for x in q("""select c.camp_id from etp.camp c where c.creative_id is not null and exists (select 1 from etp.camp o where o.creative_id = c.creative_id
                                          and o.camp_id <> c.camp_id and (o.tao, o.camp_id) < (c.tao, c.camp_id))""").split() if x.isdigit()}
        for cid, a in thang.items():
            h = hom.get(cid) or {"chi": 0.0, "thu": 0.0}; ns = a["budget"] or 0
            if not ns or h.get("chi", 0) <= 0: continue
            lo = h["chi"] - h.get("thu", 0.0); _anh[str(cid)] = [round(lo, 2), _bay.isoformat()]
            if int(cid) not in _clone_y or (_bat and cid not in _bat) or h["chi"] < DEM_CHI * ns or roi(h) > DEM_ROI: continue
            p0 = _truoc.get(str(cid))
            if not p0 or (_bay - dt.datetime.fromisoformat(p0[1])).total_seconds() > DEM_PHUT * 60: continue
            if lo - p0[0] >= DEM_TANG * ns:
                dung_dem.append((cid, f"#{a['ten'][:70]} · ${ns:g} · hôm nay chi ${h['chi']:.2f} ({h['chi'] / ns * 100:.0f}% ngân sách), ROI {roi(h):+.0f}% · lỗ ${p0[0]:.2f} → ${lo:.2f} sau {(_bay - dt.datetime.fromisoformat(p0[1])).total_seconds() / 60:.0f} phút · clone y nguyên creative → DỪNG ĐÊM"))
        _dd = {int(x[0]) for x in dung_dem}   # camp sắp tắt thì không giảm / mở bản thang trong cùng lượt
        ha, thang_nb = [x for x in ha if int(x[0] or 0) not in _dd], [x for x in thang_nb if int(x[0] or 0) not in _dd]
        if JSON: q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_lo_dem', '" + json.dumps(_anh).replace("'", "''") + "'::jsonb) on conflict (ten) do update set gia_tri = excluded.gia_tri")
    except Exception as e:
        loi_may.append((0, f"luật dừng đêm lỗi: {str(e)[:80]}"))   # bộ 2 đi thang nhân bản, không lên $30 bằng đổi ngân sách
# CAMP ROAS — DẠNG RIÊNG (tài liệu Support 26/10/2026; anh: "Camp ROAS là 1 dạng riêng, miễn hết các luật"): camp ★ … duplicate by <gốc> (nhan-ban.py --roas)
# ra khỏi MỌI danh sách luật ở trên (tắt / T7 / tăng / giảm / hạ / nhân bản / thang / dừng đêm / T30 / thay creative) — chỉ còn luật tắt ROAS của Support:
# "camp tiêu > $20 mà ROI < 30%, 1–2 ngày thì off" = ngày đã khép hôm qua, hoặc cộng 2 ngày đã khép, chi > $20 và ROI < 30% → báo riêng anh trên Telegram (nút Tắt / Giữ), máy không tự tắt (anh 26/10/2026).
import importlib.util as _iuc
_sc = _iuc.spec_from_file_location("etp_cong", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp", "cong.py")); CONG = _iuc.module_from_spec(_sc); _sc.loader.exec_module(CONG)
ROAS_CHI, ROAS_ROI = 20, 30
try: _ROAS = CONG.camp_roas() | {int(c["id"]) for c in ds_camp if CONG.la_roas(c.get("name"))}
except Exception as e: _ROAS = {int(c["id"]) for c in ds_camp if CONG.la_roas(c.get("name"))}; loi_may.append((0, f"không đọc được danh sách camp ROAS trong kho: {str(e)[:80]}"))
_bo_roas = lambda ds: [x for x in ds if int(x[0] or 0) not in _ROAS]
tat_l, tat7, tat2, tu_choi, dau_phien, dat, giam, ha, nb, thang_nb, thang_tat, dung_dem, moc30, tang30, theo, gan_t7 = map(_bo_roas, (tat_l, tat7, tat2, tu_choi, dau_phien, dat, giam, ha, nb, thang_nb, thang_tat, dung_dem, moc30, tang30, theo, gan_t7))
tat_roas = []
try:
    if _ROAS & _bat:
        _r1, _r2 = bc(d(1), d(1)), bc(d(2), d(1))
        for cid in sorted(_ROAS & _bat):
            for so, ky in ((_r1, "hôm qua"), (_r2, "2 ngày đã khép")):
                a = so.get(cid) or so.get(str(cid))
                if a and a["chi"] > ROAS_CHI and roi(a) < ROAS_ROI:
                    tat_roas.append((cid, f"#{a['ten'][:80]} · {ky}: chi ${a['chi']:.2f} · thu ${a['thu']:.2f} · lãi ${a['thu'] - a['chi']:+.2f} · ROI {roi(a):+.0f}% → TẮT (luật ROAS)")); break
except Exception as e:
    loi_may.append((0, f"luật ROAS không đọc được Report: {str(e)[:80]}"))
if JSON:
    m = lambda ds: [{"id": i, "chu": s, **({"bo": _bo_c[int(i)]} if _bo_c.get(int(i or 0)) else {})} for i, s in ds]
    print(json.dumps({"luc": f"{vn:%H:%M %d/%m}", "tat": m(tat_l), "tat7": m(tat7), "tat2": m(tat2), "tat_roas": m(tat_roas), "tu_choi": m(tu_choi), "loi_may": m(loi_may), "dau_phien": m(dau_phien), "tang": m(dat), "giam": m(giam), "ha": m(ha), "nb": m(nb), "thang_nb": m(thang_nb), "thang_tat": m(thang_tat), "dung_dem": m(dung_dem), "moc30": m(moc30), "tang30": m(tang30), "dong": m(dong_l), "gan": m(theo), "gan_t7": m(gan_t7)}, ensure_ascii=False))
    sys.exit(0)
gio = vn.hour + vn.minute / 60
moc = min([21, 24, 32], key=lambda m: (m - gio) % 24)   # 21h · 24h · 8h (=32 ⇒ 8h sáng hôm sau)
trong = any(abs(((gio - m + 12) % 24) - 12) <= 1 for m in (21, 0, 8))
in_ = lambda tieu, ds, rong="(không)": (print(tieu), print("\n".join("  " + s for _, s in ds) or "  " + rong))
print(f"Giờ VN {vn:%H:%M %d/%m} · khung tăng ngân sách ~21h / ~24h / 8h: " + ("ĐANG TRONG KHUNG" if trong else f"mốc kế ~{int(moc) % 24}h") + " (ngân sách còn thấp $1–3 thì chưa cần canh giờ; không thu lại sau khung)")
in_("CẦN TẮT (camp ≥ 7 ngày, tiêu > $10 từ trước tới nay, ROI < −50%) — CHỜ ANH TẮT:", tat_l)
in_(f"LUẬT ROAS (camp ★, chi > ${ROAS_CHI} mà ROI < {ROAS_ROI}% trong 1–2 ngày đã khép) — BÁO RIÊNG ANH TRÊN TELEGRAM, MÁY KHÔNG TỰ TẮT:", tat_roas, "(không)")
in_("AD BỊ META TỪ CHỐI — thay creative sạch:", tu_choi)
in_("LÃI ĐẦU PHIÊN — TĂNG LUÔN $2/$3 (ROI hôm nay > 50%, chi ≥ $0,5):", dau_phien, "(chưa có)")
in_("THANG NHÂN BẢN BỘ 2 — MỞ BẢN MỚI Ở BẬC KẾ (không đổi ngân sách camp đang chạy):", thang_nb, "(chưa có)")
in_("DỪNG ĐÊM (21h–5h, camp âm, lỗ tăng nhanh) — MÁY TẮT:", dung_dem, "(không)")
in_("BẢN THANG LỖ (chi ≥ 1 ngày ngân sách, ROI ≤ −30%) — CHỜ ANH TẮT:", thang_tat, "(không)")
in_("T30 — CAMP $20 TIÊU ĐỦ + ROI > 80% TRONG 2–3 NGÀY → LÊN $30 (CHỜ ANH DUYỆT):", tang30, "(chưa có)")
in_("ĐỦ TIÊU CHÍ BID ROAS (chi ≥ $100, ROI ≥ 50% ổn định 2–3 ngày trọn):", moc30, "(chưa có)")
in_(f"ĐỦ ĐIỀU KIỆN TĂNG (ROI 30 ngày / từ lúc lên ≥ {roi_min:g}% và spending hôm nay > {sp_min:g}%) — CHỜ ANH DUYỆT:", dat, "(chưa có)")
in_("CẦN XEM GIẢM / TẮT (ROI tụt — phim down trend hoặc creative bão hoà, CPC/CPA tăng) — CHỜ ANH QUYẾT:", giam)
in_("GẦN ĐẠT (theo dõi tiếp):", theo)
