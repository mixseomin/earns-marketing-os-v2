#!/usr/bin/env python3
"""LUẬT ETHOPEX — MỘT chỗ chấm mọi luật vận hành camp (kb #261 mục 8–8g) trên box3 (đọc API Report + chi tiết camp, khoá ở studio xv_khoa_ngoai).
Ai dùng: kiem-ngan-sach.sh (gọi tay từ Mac qua ssh) · phòng Ethopex của cty (theo dõi định kỳ, báo Telegram). CHỈ ĐỌC + BÁO — không sửa camp.
Dùng (trên box3, đã nạp .env.production):  python3 luat-ethopex.py [roi_toi_thieu=20] [spending_toi_thieu=50] [--json]
  --tong: chỉ tổng số (hôm nay / hôm qua / tháng / từ đầu + camp lãi / lỗ nhất) cho bảng ghim, không chấm luật.
  --json: in một đối tượng {luc, tang, dau_phien, giam, tat, moc30, tu_choi, gan} — mỗi mục {id, ten, chu} để máy theo dõi so trùng."""
import json, os, re, subprocess, sys, urllib.request, datetime as dt
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp")); import ethopex_api as EA   # cổng chung: chỉ tài khoản nhà (anh 28/10/2026)
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
# XEM NGƯỜI (ETP_XEM_NGUOI, anh 30/10/2026 "chỉ đề xuất, ko tự ý update"): cùng luật chấm camp của một người trong team — kho đọc bảng *_ngoai,
# xét luật ghi etp.xet_luat_ngoai, cổng chung chặn mọi lệnh ghi. apps/etp/de-xuat-ngoai.py gọi chế độ này; worker cty KHÔNG BAO GIỜ gọi.
K_CAMP, K_SO = ("etp.camp_ngoai", "etp.so_ngay_ngoai") if EA.XEM else ("etp.camp", "etp.so_ngay")
# TĂNG BẬC chỉ khi ROI tháng > 50% (Support Dol 21/10/2026: "a chỉ tăng budget những camp rois > 50% nhé") — roi_min (20) còn dùng cho luật giảm / theo dõi
ROI_TANG = 50
HQ_NHO, HQ_NHO_MIN = 0.5, 2.0   # sàn $2 (anh 28/10/2026 "cấm viết chung chung, chi nhỏ là bao nhiêu — set tối thiểu $2"): chi nhỏ = chi hôm qua < max($2, 50% ngân sách) · luật B1: chi hôm qua dưới tỷ lệ này của ngân sách hiện tại thì ROI hôm qua âm không chặn tăng trong ngày
roi_min = float(ARGS[0]) if ARGS else 20; sp_min = float(ARGS[1]) if len(ARGS) > 1 else 50; JSON = '--json' in sys.argv
BANG_LUAT = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "web", "src", "lib", "etp-bang-luat.json")))   # sổ luật chung (anh 01/11/2026)
KD = BANG_LUAT["khung_doi"]   # khung máy tự đổi camp (anh 04/11/2026; 05/11 đảo: tang 21–07h · giam 15–21h · sang 07–15h) — mốc giờ luật GB / đuôi đọc từ đây, cùng worker ethopex.mjs + trang etp
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
BC = lambda body, t=90: EA.api("/api/v1/report", json.loads(body), t)["rows"]   # report qua cổng chung: ĐỦ MỌI TRANG + lọc tài khoản nhà (29/10/2026)
def bc(tu, den):
    body = json.dumps({"columns": ["campaign_name", "daily_budget", "spending", "roi", "profit", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 1000, "page": 1, "page_size": 1000, "date_from": tu, "date_to": den}).encode()
    g = {}
    for x in BC(body, 60):   # report tách dòng theo content → cộng theo camp
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
    rows = BC(body, 90)
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
    nd = BC(body, 60)
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
try: _tao_kho = {int(l.split("|")[0]): dt.date.fromisoformat(l.split("|")[1][:10]) for l in q(f"select camp_id, (tao at time zone 'UTC')::date from {K_CAMP} where tao is not null").splitlines() if "|" in l}
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
BAC = [x for x in BANG_LUAT["thang"] if x <= 20]   # THANG BẬC = sổ luật chung (anh 05/11/2026 duyệt: mọi bước ≤ ×1,5 — số toàn đội tăng ×>1,5 ROI +47% → −15%, 74% lần 24h sau âm; $1→$2 chấp nhận); $30 chỉ qua T30
ke = lambda b: next((x for x in BAC if x > b + 1e-9), None)
dat, theo, giam, dau_phien, moc30 = [], [], [], [], []
# KHUNG 0–5h VN (anh 22/10/2026: "giờ đang là giờ tối ưu tốt (21h–5h sáng VN) thì phải check xem tăng được không"): qua 0h số HÔM NAY về 0 nên
# "Spending hôm nay > 50%" không bao giờ đạt đúng lúc Mỹ đang mua → trong khung này xét chi tiêu + ROI của NGÀY HÔM QUA (trọn ngày) thay cho hôm nay;
# thêm điều kiện ROI hôm qua ≥ 0% (không tăng camp vừa có một ngày lỗ).
KHUNG_DEM = 0 <= vn.hour < 5 and not TANG_CHOT   # ngày UTC (tang_chot) thì 0–5h VN số hôm nay đã có thật, không cần mượn hôm qua
LD_SIET = bool(DUYET.get("ld_siet"))
hqua = bc(d(1), d(1))
ROAS_LAI = 75; _ngay3 = {1: hqua, 2: bc(d(2), d(2)), 3: bc(d(3), d(3))}   # lãi 30 ngày tối thiểu để lên ROAS (anh 29/10/2026) · ngày trọn D−1..D−3 chỉ để hiện
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
    _hq_nho = _ryq is not None and _ryq < 0 and _yq["chi"] < max(HQ_NHO_MIN, HQ_NHO * a["budget"])
    # + ROI KHUNG DÀI ≥ 0% (anh 29/10/2026 "OK", bản luật: 11/523 lần tăng khi ROI khung dài đang âm → sau đó ROI −34%): chỉ nhờ ROI hôm nay thì không tăng
    tb_ngay = TANG_CHOT and _rh is not None and _rh >= 50 and h["chi"] >= 0.3 * a["budget"] and (_ryq is None or _ryq >= 0 or _hq_nho) and r is not None and r >= 0
    if tb_ngay and not (r >= ROI_TANG and sp > sp_min and them_dk): dong += f" · ROI hôm nay (chốt chi) {_rh:+.0f}%, chi {h['chi'] / a['budget'] * 100:.0f}% ngân sách"
    if tb_ngay and _hq_nho: dong += f" · hôm qua {_ryq:+.0f}% nhưng chi ${_yq['chi']:.2f} < ${max(HQ_NHO_MIN, HQ_NHO * a['budget']):g} (max $2, 50% ngân sách) → bỏ qua (luật B1)"
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
        dich = ke(a["budget"]) or a["budget"]   # bậc KẾ trên thang (anh 05/11/2026: không nhảy $1 → $3)
        if rh > 50 and dich > a["budget"]: dau_phien.append((cid, f"#{a['ten'][:70]} · ${a['budget']:g} → ${dich} · ROI hôm nay {rh:+.0f}% · lãi hôm nay ${h.get('thu', 0) - h['chi']:+.2f}"))
    # ĐỦ TIÊU CHÍ LÊN ROAS — anh 29/10/2026: "Các camp đủ điều kiện lên roas thì lên luôn. Nới điều kiện lên roas là ROI >= 75$": MỘT điều kiện, lãi 30 ngày
    # (camp mới: từ lúc lên) ≥ $75. Thay chuẩn Support 24/10 (chi ≥ $100 · ROI ≥ 50% · ổn định 2–3 ngày trọn). Worker tự lên ROAS (cty ethopex.mjs, khối ★ LÊN ROAS);
    # gốc đã có camp ★ thì không vào lại (lọc dưới luật ROAS). 3 ngày trọn gần nhất chỉ để hiện.
    _co = [(n, x) for n, x in ((n, (_ngay3[n].get(cid) or {"chi": 0.0, "thu": 0.0})) for n in (1, 2, 3)) if x["chi"] >= 1]
    if a["thu"] - a["chi"] >= ROAS_LAI:
        moc30.append((cid, f"#{a['ten'][:70]} · ${a['budget']:g}/ngày · chi ${a['chi']:.2f}, lãi ${a['thu'] - a['chi']:+.2f}, {rd(cid)} {r:+.0f}% · " + " · ".join(f"{d(n)[8:10]}/{d(n)[5:7]} {roi(x):+.0f}%" for n, x in _co) + f" → lãi ≥ ${ROAS_LAI}: lên ROAS"))
    g2, t2 = gan.get(cid), truoc.get(cid)
    if g2 and t2 and g2["chi"] >= 1.5 and t2["chi"] >= 1.5 and (g2["chi"] + t2["chi"]) >= 3:
        rg, rt = roi(g2), roi(t2)
        if rt is not None and rg is not None and ((rt >= roi_min and rg < 0) or rt - rg >= 30):
            giam.append((cid, f"#{a['ten'][:70]} · ROI 4 ngày trước {rt:+.0f}% → 3 ngày gần {rg:+.0f}% (chi ${g2['chi']:.2f})"))

def api(p):
    return json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, headers={"authorization": "Bearer " + T, "user-agent": "mos2-kiem"}), timeout=30))
api = lambda p, b=None: EA.api(p, b)   # mọi lệnh Ethopex qua cổng chung apps/etp/ethopex_api.py: danh sách đủ mọi trang + chỉ camp tài khoản nhà, lệnh ghi vào camp ngoài bị chặn (anh 28/10/2026)
_NK = None
def nhat_ky_tat(cid, luc_utc):
    """dòng nhật ký luật (studio ethopex_nhat_ky) của lệnh tắt camp này gần mốc luc_utc nhất (±20 phút)"""
    global _NK
    if _NK is None:
        _NK = json.loads(subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", "select gia_tri::text from xv_khoa_ngoai where ten='ethopex_nhat_ky'"], capture_output=True, text=True).stdout.strip() or "[]")
    best = None
    for x in _NK:
        if x.get("viec") != "tat" or not (x.get("ok") or "đọc lại" in (x.get("loi") or "")) or int(x.get("id") or 0) != int(cid): continue   # lệnh gửi mà Ethopex áp chậm cũng là lệnh của máy (#73533)
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
            # không khớp dòng nhật ký: lệnh API bằng khoá Ethopex nhà nhưng không phải lệnh máy luật đã ghi — KHÔNG phải tắt tay trên web (nguồn web thì source = web);
            # trước 02/11/2026 lệnh máy luật Ethopex áp chậm > 60 giây cũng không được ghi (#73533 L3) — nói đúng hai khả năng, không gán "tắt tay"
            cau = (f"tắt qua API — luật: {nk['luat']} · duyệt: {nk.get('ai') or '?'}" if nk else
                   f"lệnh API bằng khoá Ethopex của {h.get('actor_name') or '?'} — không có dòng nhật ký luật khớp (script ngoài máy luật, hoặc lệnh máy luật Ethopex áp chậm chưa được ghi trước 02/11)")
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
        h_ = hom.get(cid) or hom.get(str(cid)) or {}; a_ = thang.get(cid) or thang.get(str(cid)) or {}
        try: ly = NT.chan_tang(api, cid, du=NT.du_so(h_.get("chi"), h_.get("thu"), a_.get("budget") or h_.get("budget")))   # tăng dồn < 24h khi đạt cổng (anh 05/11/2026)
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
# TS — SIẾT TĂNG BẬC (anh 02/11/2026 "Ok áp dụng", sau phân tích cách Kim Kiên tăng: chỉ tăng khi hôm qua + hôm nay cùng lãi đậm, xét cuối ngày). Đo 742 lần
# tăng của Nhà 19/10–01/11, ROI NGÀY KẾ TIẾP: hôm qua lãi 0–50% → +9% (185 lần, chi $1.899 — mọi khung giờ); tăng lúc 07:00–14:59 VN (ngày Ethopex chạy
# < 8 giờ) → +26%, ngoài khung → +42–45%; camp chưa có hôm qua tăng trong khung đó +2% (ngoài khung +59%). Hôm qua LỖ (luật B1 / chi nhỏ) vẫn +18–38% → không chặn.
# Chỉ áp danh sách tăng bậc (tang / tăng trong ngày / thang bộ 2); lãi đầu phiên ($1 → $2–3, đo +47–132%) và T30 giữ nguyên.
# NẠP SÁNG (anh 05/11/2026): giờ chặn TS = khung 'sang' của sổ luật chung; camp hôm nay đã tiêu ≥ nap_chi × ngân sách + ROI hôm nay ≥ sang_roi% thì
# KHÔNG bị chặn giờ (đi được $1 → $3 → $5 trong buổi sáng, nhịp tăng ≥ 3 giờ vẫn giữ) — cùng điều kiện worker dùng để cho tăng (ethopex.mjs napDuoc)
TS_GIO, TS_HQ = tuple(KD.get("sang") or (7, 15)), 50
def _nap_sang(cid):
    h = hom.get(cid) or {}; ns = float((thang.get(cid) or {}).get("budget") or 0); ch, th = float(h.get("chi") or 0), float(h.get("thu") or 0)
    return ns > 0 and ch >= float(KD["nap_chi"]) * ns and th >= (1 + float(KD["sang_roi"]) / 100) * ch
def _ts_ly(cid):
    if TS_GIO[0] <= vn.hour < TS_GIO[1] and not _nap_sang(cid): return f"{vn:%H:%M} — ngày Ethopex mới chạy < 8 giờ, tăng từ {TS_GIO[1]}:00 (trừ camp đã tiêu hết + ROI hôm nay ≥ {KD['sang_roi']}%)"
    y = hqua.get(cid); ry = roi(y) if y and y["chi"] >= 0.3 else None
    if ry is not None and 0 <= ry < TS_HQ: return f"hôm qua {ry:+.0f}% (0–{TS_HQ}%)"
    return None
dat = [(cid, chu) for cid, chu in dat if not _ts_ly(cid)]
# GIẢM BẬC (luật GB): chỉ trong KHUNG GIẢM / TẮT (KD.giam, 15–21h VN — anh 05/11/2026 đảo khung: tăng 21–07h, giảm/tắt 15–21h; trước: phiên sáng 6/9–13h), trên số TRỌN ngày hôm qua: ngân sách > $1, hôm qua đã tiêu ≥ 50% ngân sách, ROI hôm qua < 0% và ROI 3 ngày < 20%
# → xuống một bậc; lỗ nặng (ROI hôm qua < −50% và tiêu đủ ngân sách) → hai bậc. ROI 0–50% là VÙNG GIỮ (không tăng, không giảm).
# Camp vừa tăng mà ngày trọn kế tiếp âm → giảm luôn, không xét ROI 3 ngày (anh 24/10/2026), từng bậc một: $20 → $15 → $10.
ha = []
if KD["giam"][0] <= vn.hour < KD["giam"][1]:   # khung giảm / tắt (sổ luật chung): máy chỉ tự giảm trong khung này → GB chấm đúng lúc đó (số hôm qua đã khép từ ~9h, gb_9h không còn cần)
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
tc_kho = set() if EA.XEM else set(q("select camp_id from etp.camp where giao = 'DISAPPROVED' and coalesce(trang_thai, '') <> 'ARCHIVED'").split())   # camp ngoài: kho không giữ trạng thái duyệt
lich_tat = set(q("select camp_id from etp.lich_tat").split())   # camp tạm dừng vì LỊCH GIỜ (apps/etp/lich-gio.py) — không phải bị đóng, không báo
# ĐỌC SONG SONG (28/10/2026: đọc đủ 703 camp nhà → 765 lượt gọi API nối đuôi × 0,33s = 4m48s, vượt giới hạn nhịp 240s → cả nhịp Ethopex gãy 57 lượt):
# lịch sử camp đóng + chi tiết camp đang chạy nạp trước bằng 12 luồng vào _NAP; vòng dưới đọc từ đó (thiếu thì gọi như cũ)
_NAP = {}
def _nap_truoc(ds):
    from concurrent.futures import ThreadPoolExecutor
    can = []
    for c in ds:
        if c.get("state") == "ARCHIVED" or (c.get("state") == "PAUSED" and c.get("sync_status") == "error"): continue
        if c.get("state") == "PAUSED":
            if str(c["id"]) in tc_kho or str(c["id"]) in lich_tat or (c.get("sync_status") or "done") not in ("done", "synced"): continue
            can.append(f"/api/v1/campaigns/{c['id']}/history")
        else: can.append(f"/api/v1/campaigns/{c['id']}")
    def lay(p):
        try: return p, api(p)
        except Exception as e: return p, None
    with ThreadPoolExecutor(12) as ex:
        for p, d in ex.map(lay, can):
            if d is not None: _NAP[p] = d
_api_goc = api
api = lambda p, b=None: _NAP.pop(p) if b is None and p in _NAP else _api_goc(p, b)
try:
    _ds = api("/api/v1/campaigns?page_size=500")["data"]; _nap_truoc(_ds)
    for c in _ds:
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
NB_ROI, NB_CHI, NB_ROI3, NB_PHIM_NGAY = 50, 3, 20, 6
TRAN_PHIM_CHAY = (10**6 if EA.XEM else int(float(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'tran_phim'), '0')") or 0)) or 10**6)   # trần 30 camp/phim chỉ tài khoản nhà (anh 02/11/2026, đặt lại sau lần bỏ 28/10) — cùng khoá với nhan-ban.py
TRAN_NB = float(q("select coalesce((select gia_tri::text::numeric from etp.cau_hinh where khoa = 'tran_camp'), 30)") or 30)   # = nhan-ban.py: chỉ clone camp đã chạm trần
nb = []
try:
    gio24 = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=6)   # mỗi camp gốc 1 bản / 6 giờ (tên biến giữ nguyên)
    tao = lambda c: dt.datetime.fromisoformat(str(c.get("created_at")).replace("Z", "+00:00")) if c.get("created_at") else gio24 - dt.timedelta(days=1)
    goc_moi = {int(m.group(1)) for c in ds_camp if tao(c) > gio24 for m in [re.search(r"\(nhan ban \d+ cua (\d+)\)$", c.get("name", ""))] if m}
    dang_chay, tk_cua = {}, {c["id"]: c.get("ad_account_id") for c in ds_camp}   # trần đếm theo (phim, tài khoản) — anh 02/11/2026 "theo từng tk"
    for cid, p in phim_cua.items(): dang_chay[(p, tk_cua.get(cid))] = dang_chay.get((p, tk_cua.get(cid)), 0) + 1
    ban_phim = {}
    for c in ds_camp:
        m = re.search(r"\(nhan ban \d+ cua (\d+)\)$", c.get("name", ""))
        if m and tao(c) > gio24 and phim_cua.get(int(m.group(1))): ban_phim[phim_cua[int(m.group(1))]] = ban_phim.get(phim_cua[int(m.group(1))], 0) + 1
    bat = {c["id"] for c in ds_camp if c.get("state") == "ACTIVE"}
    # CỔNG BÃO HOÀ PHIM (B, anh 25/10/2026 "rule hoá"): phim ROI hôm qua < 50% hoặc tụt dưới 70% hôm kia → không nhân thêm (etp.phim_bao_hoa, canh-bao.py tính)
    try: chan_phim = {} if EA.XEM else {int(l.split("|")[0]): l.split("|", 1)[1] for l in q("select content_id, chan_nb from etp.phim_bao_hoa where chan_nb is not null").splitlines() if "|" in l}   # team chỉ cảnh báo (anh 02/11/2026)
    except Exception: chan_phim = {}
    # NGHỈ SAU LỖI (25/10/2026: 16.751 lần nhân bản thất bại trong nhật ký — luật đề xuất lại cùng camp bị chặn ở MỖI nhịp, #67663 3 lần / phút):
    # camp gốc nhân bản lỗi trong 6 giờ qua thì bỏ qua lượt này
    try: loi6 = {int(x) for x in q("select distinct camp_id from etp.nhat_ky where viec = 'nhan_ban' and ok is not true and luc > now() - interval '6 hours' and camp_id is not null").split()}
    except Exception: loi6 = set()
    for cid, a in sorted(thang.items(), key=lambda z: -(roi(z[1]) or 0)):
        r, g3, p = roi(a), roi(gan.get(cid) or {"chi": 0, "thu": 0}), phim_cua.get(cid)
        if cid not in bat or not p or r is None or r < NB_ROI or a["chi"] < NB_CHI or g3 is None or g3 < NB_ROI3 or cid in goc_moi: continue
        if dang_chay.get((p, tk_cua.get(cid)), 0) >= TRAN_PHIM_CHAY or ban_phim.get(p, 0) >= NB_PHIM_NGAY or int(p) in chan_phim or cid in loi6: continue
        if a["budget"] < TRAN_NB: continue   # nhan-ban.py chỉ clone camp đã chạm trần (anh 25/10/2026) — không đề xuất camp chưa tới, tránh hàng trăm lượt bị chặn
        dang_chay[(p, tk_cua.get(cid))] = dang_chay.get((p, tk_cua.get(cid)), 0) + 1; ban_phim[p] = ban_phim.get(p, 0) + 1
        nb.append((cid, f"#{a['ten'][:70]} · {rd(cid)} {r:+.0f}% · tiêu ${a['chi']:.2f} · ROI 3 ngày {g3:+.0f}% → nhân bản 1 camp $1 (phim {p}: {dang_chay[(p, tk_cua.get(cid))]}/{TRAN_PHIM_CHAY} camp chạy ở tài khoản này)"))
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
# THANG_NB, GIỮ creative camp gốc (nhan-ban.py: như mọi clone từ 28/10/2026 — đoạn đủ trần tran_trung mới sang creative khác cùng phim; qua cổng chấm).
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
_thang_ly = {}   # cổng mở bản thang chặn camp nào, vì sao — hiện trong bảng xét (anh 28/10/2026 "camp này phải đủ tăng trong ngày chứ?": trước cổng chặn ngầm)
_bo_chan = {b: q(f"select etp.bo_chan_mo('{b}')") for b in BO_THANG}
# CỔNG CHI GỐC (anh 29/10/2026 "làm đi"): 13/14 bản thang mở từ camp gốc tiêu < $6/ngày → ROI −27% (so-luat 14 ngày) → chỉ mở bản thang khi camp gốc
# tiêu TRUNG BÌNH ≥ THANG_CHI_GOC $/ngày trong 3 ngày đã khép (ngày thiếu số tính $0 — camp chưa đủ 3 ngày thì chưa đủ để nhân)
THANG_CHI_GOC = float(_ch("thang_chi_goc", 6))
_chi3 = {int(l.split("|")[0]): float(l.split("|")[1]) for l in (q(f"select camp_id, sum(chi) / 3 from {K_SO} where ngay between '{d(3)}' and '{d(1)}' group by 1") or "").split("\n") if "|" in l}
try:
    _con = {}
    _la_ban_thang = lambda cid: int(cid) in _id_thang   # _id_thang: camp mang tên "(thang $N cua <gốc>)" (khai phía trên)
    for c in ds_camp:
        mt = la_thang(c)
        if mt: _con.setdefault(int(mt.group(1)), []).append(c)
    _chan_phim, _loi6 = locals().get("chan_phim") or {}, locals().get("loi6") or set()
    for cid, a in thang.items():
        if int(cid) not in _tang_bo2 or cid not in _bat: continue
        _bc = q(f"select etp.bo_chan_mo_camp('{_bo_c.get(int(cid)) or '2'}', {int(cid)})") if _bo_chan.get(str(_bo_c.get(int(cid)) or "2")) else ""   # bộ lỗ 3 ngày khép → không mở bản thang (0339); camp tự thắng 3 ngày khép ROI ≥ 30% thì miễn (0372, anh 30/10/2026)
        if _bc: _thang_ly[int(cid)] = f"bộ {_bo_c.get(int(cid)) or '2'} đang chặn mở bản mới: {str(_bc)[:60]}"; continue
        # THANG ĐI TỪ ĐÁY (anh 27/10/2026: "nhân bản này sai rule rồi. Phải nhân từ $1 - $3... lên cơ mà?" — #68835 $10 mở thẳng bản $15 #71957):
        # camp gốc THƯỜNG (đã được tăng bậc kiểu cũ tới $5–$20) → bản thang đầu tiên tối đa bậc thứ hai ($3); chỉ bản nhân của chính một BẢN THANG
        # mới lên bậc kế ($3 → $7 → $15 → $30)
        ns = a["budget"]; dich = next((b for b in THANG_NB if b > ns + 1e-9), None)
        if dich and not _la_ban_thang(cid): dich = min(dich, THANG_NB[1] if len(THANG_NB) > 1 else THANG_NB[0])
        if not dich: _thang_ly[int(cid)] = "hết bậc thang trên"; continue
        con = _con.get(int(cid), [])
        if len(con) >= THANG_CON: _thang_ly[int(cid)] = f"đã có {len(con)} bản thang (trần {THANG_CON})"; continue
        _dang = [x for x in con if x.get("state") == "ACTIVE" or (x.get("sync_status") or "done") not in ("done", "synced", "error")]
        if _dang: _thang_ly[int(cid)] = "bản thang #" + ", #".join(str(x.get("id")) for x in _dang) + " đang chạy / đang dựng — chờ nó xong"; continue
        h = hom.get(cid, {"chi": 0.0, "thu": 0.0}); y = hqua.get(cid) or {"chi": 0.0, "thu": 0.0}
        if int(phim_cua.get(cid) or 0) in _chan_phim: _thang_ly[int(cid)] = f"phim đang bị chặn nhân bản: {str(_chan_phim.get(int(phim_cua.get(cid) or 0)))[:60]}"; continue
        if cid in _loi6: _thang_ly[int(cid)] = "nhân bản camp này lỗi gần đây"; continue
        if _chi3.get(int(cid), 0.0) < THANG_CHI_GOC: _thang_ly[int(cid)] = f"camp gốc tiêu TB ${_chi3.get(int(cid), 0.0):.2f}/ngày 3 ngày đã khép (< ${THANG_CHI_GOC:g})"; continue
        thang_nb.append((cid, f"#{a['ten'][:70]} · ${ns:g} đủ luật tăng · ROI hôm nay {(roi(h) if h.get('chi', 0) >= 0.3 else 0):+.0f}% (chi ${h.get('chi', 0):.2f})" + (f" · hôm qua {roi(y):+.0f}%" if y["chi"] >= 0.3 else "") + f" · {rd(cid)} {roi(a):+.0f}% → ${dich:g} bản mới (cùng creative gốc, đoạn đủ trần mới đổi; camp này giữ nguyên ngân sách)" + (f" · bản con thứ {len(con) + 1}" if con else "")))
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
    for x in BC(body, 90):
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
T2_ROI, T2_CHI = -20, 2.5   # chi 2 ngày đầu tối thiểu $2.5 (anh 27/10/2026: $1 → $5 → "hạ xuống 2.5")
# NGƯỠNG THEO NGÂN SÁCH (anh 01/11/2026 "bộ tk 2 đang lỗ khá nặng" → chọn "sửa T2 theo ngân sách"): camp $1 chi tối đa $2 trong 2 ngày → không bao giờ chạm $2.5,
# lỗ mãi không bị tắt (đo 29–31/10: bộ 2 có 45 camp $1 ROI < −30%, −$54 / 3 ngày). Ngưỡng = min($2.5, 80% ngân sách 2 ngày) — camp ≥ $2 giữ nguyên $2.5.
# CỬA SỔ 2–5 ngày đã khép có chi (trước 2–3): camp $1 già hơn 3 ngày là đúng đám đã lọt luật cũ; vẫn đòi ROI MỌI ngày đã khép < −20% nên camp đã hồi không bị đụng
T2_PHAN, T2_NGAY = 0.8, 5
t2_chi = lambda ns: min(T2_CHI, round(T2_PHAN * 2 * float(ns or 0), 2)) if ns else T2_CHI
tat2 = []
try:
    _n2 = {}
    _ns2 = {}
    for _l in q(f"select s.camp_id, s.chi, s.thu, coalesce(c.ngan_sach, 0), coalesce(c.ten, '') from {K_SO} s left join {K_CAMP} c using (camp_id) where s.ngay < '{d(0)}' and s.chi > 0 order by s.camp_id, s.ngay").splitlines():
        _p = _l.split("|", 4)
        if len(_p) == 5 and _p[0].isdigit(): _n2.setdefault(int(_p[0]), [_p[4], []])[1].append((float(_p[1]), float(_p[2]))); _ns2[int(_p[0])] = float(_p[3] or 0)
    for _c, (_ten, _ds) in _n2.items():
        if _c not in _dc or not 2 <= len(_ds) <= T2_NGAY: continue
        _c2, _t2 = _ds[0][0] + _ds[1][0], _ds[0][1] + _ds[1][1]; _ca, _ta = sum(x[0] for x in _ds), sum(x[1] for x in _ds)
        _r2, _ra = (_t2 - _c2) / _c2 * 100, (_ta - _ca) / _ca * 100
        _ng2 = t2_chi(_ns2.get(_c))
        if _c2 >= _ng2 and _r2 < T2_ROI and _ra < T2_ROI:
            tat2.append((_c, f"#{_ten[:70]} · 2 ngày đầu: chi ${_c2:.2f} · lãi ${_t2 - _c2:+.2f} · ROI {_r2:+.0f}%" + (f" · cả {len(_ds)} ngày ROI {_ra:+.0f}%" if len(_ds) > 2 else "") + f" → TẮT (luật T2: 2 ngày đầu ROI < −20%, chi ≥ ${_ng2:g})"))
    tat2.sort(key=lambda x: float(x[1].split("lãi $")[1].split(" ")[0]))
except Exception as e:
    loi_may.append((0, f"luật T2 lỗi: {str(e)[:80]}"))
# T1 — CẮT SAU NGÀY ĐẦU (anh 02/11/2026 "Thêm luật T1", sau phân tích cách Kim Kiên đóng camp: ngày đầu lỗ > 30% thì Kiên tắt 91%, Nhà giữ 99%).
# Đo 19/10–01/11: 484 camp Nhà ngày đầu ROI < −30% được chạy tiếp → chi thêm $2.817, lãi −$445 (ROI −16%), chỉ 2 camp thành camp thắng (+$134).
# Ngày có chi ĐẦU TIÊN đã khép (kho etp.so_ngay, như T2), chi ≥ min($1, 80% ngân sách), ROI < −30% (không có thu = −100%), mọi ngày đã khép vẫn < −30%;
# xét khi camp có 1–2 ngày đã khép có chi (camp già để T2 / L3 / L4). Tắt hẳn, báo trước một nhịp, cùng đường T2. Camp ROAS không áp (_bo_roas).
T1_ROI, T1_CHI, T1_PHAN = -30, 1.0, 0.8
t1_chi = lambda ns: min(T1_CHI, round(T1_PHAN * float(ns or 0), 2)) if ns else T1_CHI
# CHỜ 6 GIỜ ĐẦU NGÀY MỚI + THA CAMP HÔM NAY LÃI (anh 02/11/2026 "delay T1 khoảng 4-6 tiếng đầu ngày mới để review" → "ok. Làm luôn"; #74078 ngày đầu −34%, hôm nay +52%):
# đo 367 camp Nhà ngày đầu lỗ > 30%: ngày 2 lãi ≥ 30% (40 camp) → ngày 2 +$46, từ ngày 3 +$51 (ROI +11%); ngày 2 lãi 0–30% / lỗ → về sau −12% / −23%.
# Ngày Ethopex mới (07:00 VN) chạy chưa đủ T1_CHO giờ → chưa xét (số hôm nay còn mỏng, doanh thu về trễ); đủ giờ mà ROI hôm nay ≥ T1_THA% (chi ≥ $0.3) → tha hôm nay
T1_CHO, T1_THA = 6, 30
_gio_ngay = (vn.hour - 7) % 24
def _t1_nay(c):
    h = hom.get(c) or hom.get(str(c)) or {}
    return roi(h) if h.get("chi", 0) >= 0.3 else None
# T1 ĐÃ NHẬN (anh 05/11/2026 "T1 đến 3h chiều áp dụng thì cũng show để biết là có tiếp nhận, chỉ là chưa đến lúc"): trước T1_CHO giờ ngày mới camp đủ mọi
# điều kiện ngày đầu → danh sách t1_cho (không có 'tat' ở sổ luật → worker không làm), tab Camp hiện chip; đủ giờ thì sang tat1 như cũ (tha nếu hôm nay lãi)
T1_XET, T1_KHUNG = (7 + T1_CHO) % 24, BANG_LUAT["khung_doi"]["giam"]
tat1, t1_cho = [], []
try:
    _t2s = {x[0] for x in tat2}   # đã chạm T2 thì để T2 (một camp một luật)
    for _c, (_ten, _ds) in _n2.items():
        if _c not in _dc or _c in _t2s or not 1 <= len(_ds) <= 2: continue
        _cho = _gio_ngay < T1_CHO
        _rn = _t1_nay(_c)
        if not _cho and _rn is not None and _rn >= T1_THA: continue
        _c1, _t1 = _ds[0]; _ca, _ta = sum(x[0] for x in _ds), sum(x[1] for x in _ds)
        _r1, _ra = (_t1 - _c1) / _c1 * 100, (_ta - _ca) / _ca * 100
        _ng1 = t1_chi(_ns2.get(_c))
        if _c1 >= _ng1 and _r1 < T1_ROI and _ra < T1_ROI:
            _so1 = f"#{_ten[:70]} · ngày đầu: chi ${_c1:.2f} · lãi ${_t1 - _c1:+.2f} · ROI {_r1:+.0f}%" + (f" · cả {len(_ds)} ngày ROI {_ra:+.0f}%" if len(_ds) > 1 else "")
            if _cho: t1_cho.append((_c, _so1 + f" → T1 ĐÃ NHẬN: {T1_XET}:00 VN xét lại (hôm nay ROI ≥ {T1_THA}% thì tha), máy tắt trong khung {T1_KHUNG[0]}–{T1_KHUNG[1]}h"))
            else: tat1.append((_c, _so1 + f" → TẮT (luật T1: ngày đầu ROI < −30%, chi ≥ ${_ng1:g})"))
    for _l1 in (tat1, t1_cho): _l1.sort(key=lambda x: float(x[1].split("lãi $")[1].split(" ")[0]))
except Exception as e:
    loi_may.append((0, f"luật T1 lỗi: {str(e)[:80]}"))
# T1 THEO 24 GIỜ CHẠY (anh 05/11/2026 duyệt plan bước 5 — số toàn đội 20/10–03/11, apps/etp/phan-tich-gio.py mục A: 978 camp ROI 24 giờ chạy đầu < −50%
# → 92% lỗ triền miên, 1% hồi về ROI ≥ 30%, lãi 96h −$1,57/camp): đo trên 24 GIỜ kể từ giờ có chi đầu (etp.so_gio_camp), KHÔNG theo ngày lịch — 68% camp
# lên sau 13h nên "ngày đầu" theo lịch chỉ còn ~8 giờ và camp phải chờ 2–4 ngày mới bị xử. Camp đủ T1_24_TUOI giờ tuổi (số 24 giờ đầu đã đồng bộ trọn),
# chi 24h đầu ≥ T1_24_PHAN × ngân sách, ROI < T1_24_ROI% → tắt hẳn, cùng đường T1 (báo trước một nhịp, chỉ trong khung giảm/tắt). Không tha theo hôm nay.
T1_24_ROI, T1_24_PHAN, T1_24_TUOI = -50, 0.5, BANG_LUAT["khung_doi"]["hoc_gio"] + 1   # đủ hết giai đoạn học (sổ luật hoc_gio) + 1 giờ khép
_t24 = {}
try:
    _t1_co = {int(x[0]) for x in tat1} | {int(x[0]) for x in tat2}
    def _q_ktra(cau):   # q() nuốt lỗi SQL (stdout rỗng, không ném) → 05/11/2026 join using (camp_id) sai mà T1 24h im lặng ra 0; khối này đòi psql thoát 0
        r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-v", "ON_ERROR_STOP=1", "-tAc", cau], capture_output=True, text=True)   # -v trước -c: "-tAc" lấy đối số kế làm lệnh
        if r.returncode != 0: raise RuntimeError(r.stderr.strip()[:160])
        return r.stdout.strip()
    for _l24 in _q_ktra("""with d as (select camp_id, min(ngay::timestamp + (gio || ' hours')::interval) t0 from etp.so_gio_camp where chi > 0 group by 1)
        select s.camp_id, extract(epoch from (now() at time zone 'utc' - d.t0)) / 3600, sum(s.chi), sum(s.thu), coalesce(c.ngan_sach, 0), coalesce(c.ten, '')
        from d join etp.so_gio_camp s on s.camp_id = d.camp_id and (s.ngay::timestamp + (s.gio || ' hours')::interval) < d.t0 + interval '24 hours'
        join etp.camp c on c.camp_id = s.camp_id where d.t0 >= now() - interval '4 days' group by 1, 2, 5, 6""").splitlines():
        _p24 = _l24.split("|", 5)
        if len(_p24) < 6: continue
        _c24, _tuoi24, _ch24, _th24, _ns24, _ten24 = int(_p24[0]), float(_p24[1]), float(_p24[2]), float(_p24[3]), float(_p24[4]), _p24[5]
        _t24[_c24] = (_tuoi24, _ch24, _th24, _ns24)
        if _tuoi24 < T1_24_TUOI or _c24 not in _dc or _c24 in _t1_co or _ch24 < max(0.3, T1_24_PHAN * _ns24): continue
        _r24 = (_th24 - _ch24) / _ch24 * 100
        if _r24 < T1_24_ROI:
            tat1.append((_c24, f"#{_ten24[:70]} · 24 giờ chạy đầu: chi ${_ch24:.2f} · lãi ${_th24 - _ch24:+.2f} · ROI {_r24:+.0f}% → TẮT (luật T1: 24 giờ chạy đầu ROI < {T1_24_ROI}%, chi ≥ {T1_24_PHAN:.0%} ngân sách)"))
except Exception as e:
    loi_may.append((0, f"luật T1 (24 giờ chạy) lỗi: {str(e)[:80]}"))
def _t24_dong(cid):
    """hàng 'T1 theo 24 giờ chạy' cho thẻ xét luật"""
    x = _t24.get(int(cid))
    if not x or x[1] < 0.3: return ["24 giờ chạy đầu (T1 theo giờ)", "chưa có số giờ", f"< {T1_24_ROI}%, chi ≥ {T1_24_PHAN:.0%} NS, tuổi ≥ {T1_24_TUOI}h", False]
    r_ = (x[2] - x[1]) / x[1] * 100
    return ["24 giờ chạy đầu (T1 theo giờ)", f"ROI {r_:+.0f}% · chi ${x[1]:.2f} · tuổi {x[0]:.0f}h", f"< {T1_24_ROI}%, chi ≥ {T1_24_PHAN:.0%} NS, tuổi ≥ {T1_24_TUOI}h", x[0] >= T1_24_TUOI and x[1] >= max(0.3, T1_24_PHAN * x[3]) and r_ < T1_24_ROI]
# D24 — CAMP CÓ KHOẢNG DỪNG > 24 GIỜ → TẮT NGAY (anh 29/10/2026 "camp bị 1 khoảng dừng > 24h cũng dừng ngay lập tức"): từ ngày chi đầu tiên tới hôm qua
# (ngày đã khép, kho etp.so_ngay) có ít nhất MỘT ngày trọn không chi = camp đã đứng ≥ 24 giờ (tắt rồi bật lại, hoặc Meta ngừng phân phối) → tắt hẳn như T2,
# không xét lãi lỗ (anh lệnh). Đo 29/10: 11/326 camp đang chạy dính, cùng nghỉ 23–25/10. Camp ROAS không áp (_bo_roas).
tat_d24 = []
try:
    _hq = dt.date.fromisoformat(d(1)); _ng = {}
    for _l in q(f"select s.camp_id, s.ngay, s.chi, s.thu, coalesce(s.ngan_sach, 0), coalesce(c.ten, '') from {K_SO} s left join {K_CAMP} c using (camp_id) where s.ngay < '{d(0)}' and s.chi > 0 order by s.camp_id, s.ngay").splitlines():
        _p = _l.split("|", 5)   # (ngày, chi, thu, ngân sách ngày đó — L3 đo ngưỡng chi theo nó)
        if len(_p) == 6 and _p[0].isdigit(): _ng.setdefault(int(_p[0]), [_p[5], []])[1].append((dt.date.fromisoformat(_p[1]), float(_p[2]), float(_p[3]), float(_p[4] or 0)))
    for _c, (_ten, _ds) in _ng.items():
        if _c not in _dc: continue
        _co = {x[0] for x in _ds}; _thieu = [_ds[0][0] + dt.timedelta(days=i) for i in range((_hq - _ds[0][0]).days + 1)]; _thieu = [x for x in _thieu if x not in _co]
        if not _thieu: continue
        _ca, _ta = sum(x[1] for x in _ds), sum(x[2] for x in _ds)
        tat_d24.append((_c, f"#{_ten[:70]} · không chi {len(_thieu)} ngày ({', '.join(f'{x:%d/%m}' for x in _thieu[:4])}{'…' if len(_thieu) > 4 else ''}) · cả {len(_ds)} ngày có chi: chi ${_ca:.2f} · lãi ${_ta - _ca:+.2f} · ROI {(_ta - _ca) / _ca * 100:+.0f}% → TẮT (luật D24: có khoảng dừng > 24 giờ)"))
    tat_d24.sort(key=lambda x: float(x[1].split("lãi $")[1].split(" ")[0]))
except Exception as e:
    loi_may.append((0, f"luật D24 lỗi: {str(e)[:80]}"))
_D24 = {x[0]: x for x in tat_d24}
# L3 — LỖ 3 NGÀY ĐÃ KHÉP LIỀN → TẮT (anh 29/10/2026: "theo hướng dẫn Ethopex không có điều kiện giảm; ROI âm liên tục thì tắt camp luôn" → "làm 1+2"):
# 3 ngày đã khép gần nhất (D−1..D−3) NGÀY NÀO cũng chi ≥ L3_CHI và thu < chi → tắt hẳn như T2 / D24. Đo 29/10 (21 ngày): sau 3 ngày lỗ liền, 2 ngày kế
# cộng lãi $0 (hoà) → tắt không mất gì, giải phóng ngân sách; mốc 2 ngày KHÔNG dùng vì 25% camp lỗ 2 ngày liền hồi lại lãi. Camp ROAS không áp (_bo_roas).
# Ngưỡng chi mỗi ngày = min($1, 60% ngân sách ngày đó) (anh 01/11/2026 #69314: camp $1 chi $0.7–0.98/ngày lỗ 5 ngày liền mà không tắt — $1 cứng không bao giờ chạm).
# Đo 21 ngày: 116 camp lọt $1 cứng nhưng dính ngưỡng mới, 3 ngày KẾ chi $84 · lãi −$27 · ROI −32%.
L3_CHI, L3_PHAN = 1.0, 0.6
# ĐUÔI NGÀY KẾ (anh 03/11/2026, chọn "Cả hai": #65714 / #65736 / #72920 / #73282 bị G10 tắt 07:48 khi ngày mới vừa mở — "thêm đoạn đuôi trong ngày tiếp theo"):
# L3 / G10 tới ngưỡng thì CHƯA tắt ngay — cho chạy phần đầu ngày đang chạy tới khi chi ≥ DUOI_PHAN ngân sách hoặc tới DUOI_GIO giờ VN; đoạn đuôi đó
# cũng dưới ngưỡng của luật thì mới tắt, có lãi đạt ngưỡng thì giữ (ngày đó khép xong luật xét lại với số mới).
DUOI_PHAN, DUOI_GIO = 0.5, KD["giam"][0]   # mốc đuôi = đầu khung giảm / tắt (anh 05/11/2026; trước 19h → chỉ còn 19–21h để xử, đuôi dính giờ xấu 15–19h)
cho_duoi = []
def duoi(c, ns, nguong, ten_, luat_):
    """→ True = được tắt; False = chờ đuôi / đuôi đạt ngưỡng (đã ghi cho_duoi)"""
    h = hom.get(c) or hom.get(str(c)) or hom.get(int(c)) or {}
    ch, th = float(h.get("chi") or 0), float(h.get("thu") or 0)
    du = ch >= DUOI_PHAN * float(ns or 0) or vn.hour >= DUOI_GIO
    r = (th - ch) / ch * 100 if ch else None
    if not du:
        cho_duoi.append((c, f"#{ten_[:70]} · {luat_} tới ngưỡng — chờ đuôi ngày đang chạy: chi ${ch:.2f}/{DUOI_PHAN:.0%} × ${float(ns or 0):g}, tới {DUOI_GIO}:00 VN mới xét")); return False
    if r is not None and r >= nguong:
        cho_duoi.append((c, f"#{ten_[:70]} · {luat_} tới ngưỡng nhưng đuôi ngày đang chạy lãi: chi ${ch:.2f} · ROI {r:+.0f}% ≥ {nguong}% → GIỮ")); return False
    return True
l3_chi = lambda ns: min(L3_CHI, round(L3_PHAN * float(ns), 2)) if ns else L3_CHI
tat_l3 = []
try:
    _d3 = [dt.date.fromisoformat(d(i)) for i in (1, 2, 3)]
    for _c, (_ten, _ds) in _ng.items():
        if _c not in _dc or _c in _D24: continue
        _m = {x[0]: x for x in _ds}
        if not all(k in _m and _m[k][1] >= l3_chi(_m[k][3]) and _m[k][2] < _m[k][1] for k in _d3): continue
        _ca, _ta = sum(_m[k][1] for k in _d3), sum(_m[k][2] for k in _d3)
        if not duoi(_c, _m[_d3[0]][3], 0, _ten, "L3"): continue
        tat_l3.append((_c, f"#{_ten[:70]} · 3 ngày đã khép lỗ liền: chi ${_ca:.2f} · lãi ${_ta - _ca:+.2f} · ROI {(_ta - _ca) / _ca * 100:+.0f}% → TẮT (luật L3: lỗ 3 ngày đã khép liền, mỗi ngày chi ≥ min(${L3_CHI:g}, {L3_PHAN:.0%} ngân sách))"))
    tat_l3.sort(key=lambda x: float(x[1].split("lãi $")[1].split(" ")[0]))
except Exception as e:
    loi_may.append((0, f"luật L3 lỗi: {str(e)[:80]}"))
# L7 — LỖ ĐỀU 7 NGÀY → TẮT (anh 29/10/2026 "làm luôn đi", sau #68738: $1/ngày lỗ 5/6 ngày, ROI −51%, lọt mọi luật — L3 đòi chi ≥ $1 mỗi ngày,
# T2 đòi 2 ngày đầu ≥ $2.5, OFF đòi tiêu > $10): 7 ngày đã khép (D−1..D−7) chi ≥ L7_CHI, ≥ L7_NGAY ngày có chi, ROI < L7_ROI% → tắt hẳn.
# Đo 29/10: 26 camp đang chạy dính, 7 ngày chi $164 · lãi −$75 · ROI −46%. Camp ROAS không áp (_bo_roas).
# L7 ĐANG DỪNG từ 29/10/2026 (anh "Sao ko thêm L4, tắt L7?") — thay bằng L4 bên dưới; L7 chỉ còn trong bảng xét để đối chiếu, không xếp camp nào.
L7_CHI, L7_NGAY, L7_ROI = 5.0, 5, -30
tat_l7 = []
# L4 — LỖ ĐỀU ≥ 4 NGÀY → TẮT (anh 29/10/2026 "L4 bật đi", sau #68970 lọt L7 ở −29%): 7 ngày đã khép, ≥ L4_NGAY ngày có chi, chi ≥ L4_CHI, ROI < L4_ROI% → tắt hẳn.
# Đo camp $1: 130 camp lỗ < −20% sau 4 ngày có chi, phần chạy tiếp chi $149 lãi −$38 (ROI −25%), 12 camp gỡ được cộng chỉ +$9.5, không camp nào thành camp thắng.
L4_CHI, L4_NGAY, L4_ROI = 5.0, 4, -20
import importlib.util as _iuc
_sc = _iuc.spec_from_file_location("etp_cong", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp", "cong.py")); CONG = _iuc.module_from_spec(_sc); _sc.loader.exec_module(CONG)
try: _ROAS = CONG.camp_roas() | {int(c["id"]) for c in ds_camp if CONG.la_roas(c)}
except Exception as e: _ROAS = {int(c["id"]) for c in ds_camp if CONG.la_roas(c)}; loi_may.append((0, f"không đọc được danh sách camp ROAS trong kho: {str(e)[:80]}"))
# L4 ÁP CẢ ★ ROAS (anh 03/11/2026 "set rule thế nào để nó tự xử lý": 11 camp ROAS Number One tiêu $3–9/ngày, lỗ dồn −13%, lọt RL / R0 / G10 — RL đòi
# 2 ngày chi > $20, G10 đòi 3 ngày chi ≥ 1 ngày ngân sách; camp ROAS tiêu ít mà lỗ đều không luật nào xử). Cùng ngưỡng L4 đã đo trên camp thường.
tat_l4 = []
try:
    _d7 = {dt.date.fromisoformat(d(i)) for i in range(1, 8)}
    _l3id = {x[0] for x in tat_l3}
    for _c, (_ten, _ds) in _ng.items():
        if _c not in _dc or _c in _D24 or (_c in _l3id and _c not in _ROAS): continue   # camp ROAS: L3 / D24 không áp (_bo_roas) → L4 xét luôn
        _x = [x for x in _ds if x[0] in _d7]
        _ca, _ta = sum(x[1] for x in _x), sum(x[2] for x in _x)
        if len(_x) < L4_NGAY or _ca < L4_CHI or (_ta - _ca) / _ca * 100 >= L4_ROI: continue
        tat_l4.append((_c, f"#{_ten[:70]} · 7 ngày đã khép: {len(_x)} ngày có chi, {sum(1 for x in _x if x[2] < x[1])} ngày lỗ · chi ${_ca:.2f} · lãi ${_ta - _ca:+.2f} · ROI {(_ta - _ca) / _ca * 100:+.0f}% → TẮT (luật L4: ROI 7 ngày < {L4_ROI}%, chi ≥ ${L4_CHI:g}, ≥ {L4_NGAY} ngày có chi)"))
    tat_l4.sort(key=lambda x: float(x[1].split("lãi $")[1].split(" ")[0]))
except Exception as e:
    loi_may.append((0, f"luật L4 lỗi: {str(e)[:80]}"))
# PL — PHIM LỖ → TẮT CAMP NHỎ CỦA PHIM (anh 02/11/2026 "bộ 2 vẫn âm" → chọn "luật máy: tắt theo phim"; đo 26/10–01/11 bộ 2: 160 phim, 13 phim lãi +$92,
# 147 phim lỗ −$599 trên $1.782 chi): bộ trong etp.cau_hinh.bo_tat_phim_lo — phim có 7 ngày đã khép Ở BỘ ĐÓ chi ≥ PL_CHI và ROI < PL_ROI% → tắt mọi camp
# ngân sách ≤ PL_NS của phim ở bộ đó, trừ camp tự lãi 3 ngày đã khép (ROI ≥ 0%, chi ≥ $0.3). Camp ROAS không áp (_bo_roas). Không áp tài khoản team (EA.XEM).
PL_CHI, PL_ROI, PL_NS = 10.0, -20, 3.0
BO_PL = [] if EA.XEM else [str(x) for x in _ch("bo_tat_phim_lo", [])]
tat_pl, _pl_phim, _pl_xet = [], {}, {}
try:
    for _b in BO_PL:
        for _l in q(f"select c.content_id, sum(s.chi), sum(s.thu) from {K_SO} s join {K_CAMP} c using (camp_id) where c.bo = '{_b}' and c.content_id is not null and s.ngay between '{d(7)}' and '{d(1)}' group by 1").splitlines():
            _p = _l.split("|")
            if len(_p) == 3 and _p[0].isdigit(): _pl_phim[(_b, int(_p[0]))] = (float(_p[1] or 0), float(_p[2] or 0))
    _da_tat = {x[0] for v in (tat_l3, tat_l4, tat_d24) for x in v}
    for c in ds_camp:
        _c, _b, _f = int(c["id"]), _bo_c.get(int(c["id"])), phim_cua.get(c["id"])
        if c["id"] not in _bat or _b not in BO_PL or not _f: continue
        _pc, _pt = _pl_phim.get((_b, int(_f)), (0.0, 0.0)); _pr = (_pt - _pc) / _pc * 100 if _pc > 0 else None
        _ns = float(c.get("budget_daily") or 0)
        _m = {x[0]: x for x in (_ng.get(_c) or [None, []])[1]}
        _c3, _t3 = sum(_m[k][1] for k in _d3 if k in _m), sum(_m[k][2] for k in _d3 if k in _m); _r3 = (_t3 - _c3) / _c3 * 100 if _c3 >= 0.3 else None
        # TUỔI CAMP (góp ý #1527 anh 04/11/2026 "camp này vừa lên thì rule này ko hợp lý"): camp chưa chạy đủ 3 ngày đã khép thì "chưa đủ số" là do MỚI LÊN, không phải
        # do chi không ra — trước đây vẫn tính đạt → phim đang lỗ thì máy tắt luôn camp vừa lên. Camp tạo trước ngày khép đầu tiên của cửa sổ 3 ngày mới xét.
        _t0 = _tao.get(c["id"]); _du3 = _t0 is not None and _t0.date() < min(_d3)
        _pl_xet[_c] = [["Tuổi camp", "—" if _t0 is None else f"{(dt.datetime.now(dt.timezone.utc) - _t0).days} ngày", "chạy qua đủ 3 ngày đã khép", _du3], [f"Phim {_f} · chi 7 ngày ở bộ {_b}", f"${_pc:.2f}", f"≥ ${PL_CHI:g}", _pc >= PL_CHI], ["ROI phim 7 ngày", "—" if _pr is None else f"{_pr:+.0f}%", f"< {PL_ROI}%", _pr is not None and _pr < PL_ROI],
                       ["Ngân sách camp", f"${_ns:g}", f"≤ ${PL_NS:g}", 0 < _ns <= PL_NS], ["ROI camp 3 ngày đã khép", "—" if _r3 is None else f"{_r3:+.0f}%", "< 0% hoặc chưa đủ số", _r3 is None or _r3 < 0]]
        if _c in _da_tat or not all(x[3] for x in _pl_xet[_c]): continue
        _x = [x for x in (_ng.get(_c) or [None, []])[1] if x[0] in _d7]; _ca, _ta = sum(x[1] for x in _x), sum(x[2] for x in _x)
        tat_pl.append((_c, f"#{(c.get('name') or '')[:70]} · camp 7 ngày: chi ${_ca:.2f} · lãi ${_ta - _ca:+.2f} · ROI {((_ta - _ca) / _ca * 100) if _ca else 0:+.0f}% · phim {_f} ở bộ {_b} 7 ngày chi ${_pc:.2f} ROI {_pr:+.0f}% → TẮT (luật PL: phim lỗ 7 ngày < {PL_ROI}%, chi ≥ ${PL_CHI:g}, camp ≤ ${PL_NS:g})"))
    tat_pl.sort(key=lambda x: float(x[1].split("lãi $")[1].split(" ")[0]))
except Exception as e:
    loi_may.append((0, f"luật PL lỗi: {str(e)[:80]}"))
# ROI TỤT chỉ đi đường GIẢM BẬC (anh 26/10/2026 "ds này chỉ cần giảm bậc"): kèm "$ns → $đích" một bậc để Telegram ra nút giảm thay nút tắt; camp $1 (đáy thang) chỉ báo
_dich_tut = lambda cid: (lambda ns: (ns, NT.xuong(ns, 1)) if ns else (None, None))(float((thang.get(cid) or {}).get("budget") or 0))
giam = [(cid, s + (lambda nd: f" · ${nd[0]:g} → ${nd[1]:g}" if nd[1] else " · đang ở đáy thang $1, không giảm được nữa")(_dich_tut(cid))) for cid, s in giam]
# BỎ HẲN LUẬT GIẢM BẬC (anh 29/10/2026 "làm 1+2"): GB · giảm trong ngày · giảm sớm · ROI tụt không đề xuất / báo / ra nút ↓ nữa — số 14 ngày: camp bị giảm đang lãi,
# giảm làm mất ≈ $1.350; camp lỗ liền đi luật L3 (tắt). Danh sách để rỗng (worker vẫn đọc khoá ha / giam, chỉ là không còn gì).
ha, giam = [], []
# LUẬT T30 (Support 23/10/2026: "$20 mà 2, 3 ngày spending > 80% và ROI vẫn cao > 80% thì tăng lên"; anh: "thêm rule này để có điều kiện tăng camp lên $30"):
# camp đang bật ở trần $20, trong 3 ngày ĐÃ KHÉP gần nhất (D−1..D−3) có ≥ 2 ngày tiêu > 80% ngân sách, ROI cộng các ngày đó > 80% → đề xuất $20 → $30, anh duyệt nút.
T30_SP, T30_ROI, T30_NGAY = 80, 50, 2   # nay CHỈ còn cho ★ ROAS thắng → $30 · ROI 80 → 50% (anh 30/10/2026 "vậy điều chỉnh đi": 80% không camp ★ nào qua; 50% = ngang luật nới camp thường T30N_ROI)
# NỚI T30 CHO CAMP THƯỜNG (anh 29/10/2026 "ok. Nới đi", sau khi so tk Nguyễn Sơn: 9 camp $30 tiêu 40–80% ngân sách, ROI 37–84% — luật cũ không
# camp nào của Sơn qua được): camp thường $20, 5 ngày đã khép (D−1..D−5) ROI ≥ T30N_ROI% và chi TB ≥ T30N_SP% ngân sách ($12/ngày) → máy lên $30.
T30N_ROI, T30N_SP, T30N_NGAY = 50, 60, 5
TRAN_DOAN_ = int(float(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'tran_trung'), '20')") or 20))   # trần camp trùng một đoạn của nhan-ban.py (mô tả luật NB)
tang30, _tang30_goc = [], []   # tang30 = camp thường (ngưỡng nới) · _tang30_goc = ngưỡng cũ, camp ★ ROAS thắng dùng lại (xem dưới luật ROAS)
ngay5 = {}
try:
    ngay3 = [bc(d(k), d(k)) for k in (1, 2, 3)]
    ngay5 = bc(d(T30N_NGAY), d(1))
    bat30 = {c["id"] for c in ds_camp if c.get("state") == "ACTIVE"} if ds_camp else set(thang)
    for cid, a in thang.items():
        if cid not in bat30 or round(a["budget"]) != 20: continue
        if not _sau_giam_ok(cid): continue   # đã giảm → T30 cũng phải qua cổng tăng lại (anh 24/10/2026)
        du = [n[cid] for n in ngay3 if cid in n and n[cid]["chi"] > T30_SP / 100 * 20]
        g = {"chi": sum(x["chi"] for x in du), "thu": sum(x["thu"] for x in du)}; r = roi(g)
        if len(du) >= T30_NGAY and r is not None and r > T30_ROI:
            _tang30_goc.append((cid, f"#{a['ten'][:70]} · $20 → $30 · {len(du)}/3 ngày tiêu > {T30_SP}% ngân sách · ROI các ngày đó {r:+.0f}% · {rd(cid)} {roi(a):+.0f}%"))
        g5 = ngay5.get(cid); r5 = roi(g5) if g5 and g5["chi"] else None
        if g5 and g5["chi"] >= T30N_SP / 100 * 20 * T30N_NGAY and r5 is not None and r5 >= T30N_ROI:
            tang30.append((cid, f"#{a['ten'][:70]} · $20 → $30 · {T30N_NGAY} ngày đã khép: chi ${g5['chi']:.2f} (TB ${g5['chi'] / T30N_NGAY:.2f}/ngày) · lãi ${g5['thu'] - g5['chi']:+.2f} · ROI {r5:+.0f}%"))
except Exception as e:
    loi_may.append((0, f"luật T30 lỗi: {str(e)[:80]}"))
tang30 = [x for x in tang30 if int(x[0] or 0) not in bo2]
# DỪNG ĐÊM — ĐÃ BỎ (anh 29/10/2026 "bỏ luôn luật dừng đêm đó"): từ 25/10 tới 29/10 chưa tắt được camp nào (cổng tuổi 7 ngày chặn 45.098 lần); mã cũ xem git log.
dung_dem = []
# CAMP ROAS — DẠNG RIÊNG (tài liệu Support 26/10/2026; anh: "Camp ROAS là 1 dạng riêng, miễn hết các luật"): camp ★ … duplicate by <gốc> (nhan-ban.py --roas)
# ra khỏi MỌI danh sách luật ở trên (tắt / T7 / tăng / giảm / hạ / nhân bản / thang / dừng đêm / T30 / thay creative) — chỉ còn luật tắt ROAS của Support:
# LUẬT RL (ROAS lỗ): 2 ngày đã khép ĐỀU có chi và ĐỀU lỗ, cộng 2 ngày chi > $20, ROI < 0% → báo trước một nhịp rồi MÁY TỰ TẮT, cùng đường T2 / L3 / L4 / OFF
# (anh 30/10/2026: "Thêm luật tắt cho khớp mọi thứ để nhìn rõ trên màn hình. Ko đc để luật ngầm nào" — trước đó chỉ báo Telegram chờ anh bấm, thẻ xét luật không có điều kiện nào).
ROAS_CHI, ROAS_ROI = 20, 0   # anh 28/10/2026: "camp lãi sao lại đòi tắt" — chỉ báo khi LỖ (ROI < 0%); bản Support 26/10 là < 30% báo cả camp đang lãi
_bo_roas = lambda ds: [x for x in ds if int(x[0] or 0) not in _ROAS]
tat_pl, tat_l3, tat_d24, tat_l, tat7, tat2, tat1, t1_cho, tu_choi, dau_phien, dat, giam, ha, nb, thang_nb, thang_tat, dung_dem, moc30, tang30, theo, gan_t7 = map(_bo_roas, (tat_pl, tat_l3, tat_d24, tat_l, tat7, tat2, tat1, t1_cho, tu_choi, dau_phien, dat, giam, ha, nb, thang_nb, thang_tat, dung_dem, moc30, tang30, theo, gan_t7))
# gốc đã có camp ★ ROAS (đọc thẳng danh sách camp Ethopex — camp vừa tạo chưa cần chờ kho) → không lên ROAS lại. Mọi kiểu tên: nhà "duplicate by <gốc>",
# team "_D<gốc>_ROAS1" / "Dup by <gốc> ROAS 1.1" / "<tên gốc>_D2 (ROAS)" (31/10/2026: Luật tự động của Sơn — trước chỉ nhận kiểu nhà, gốc Sơn đã có ROAS vẫn vào moc30)
_goc_roas = CONG.goc_roas(ds_camp)
moc30 = [x for x in moc30 if int(x[0] or 0) not in _goc_roas]
# ROAS TRƯỚC NHÂN BẢN (anh 02/11/2026 duyệt review luật: 7 ngày camp ROAS +18%, clone thường −7%): camp gốc đủ lên ROAS mà chưa có camp ★ → lượt này
# chỉ lên ROAS, không nhân bản thường; có ROAS rồi mới tới lượt luật NB.
_roas_truoc = {int(x[0] or 0) for x in moc30}; nb = [x for x in nb if int(x[0] or 0) not in _roas_truoc]
# LUẬT TẮT THẮNG MỌI LUẬT KHÁC — xếp ở NGUỒN (anh 29/10/2026 "các luật khác thì sao? đã fix triệt để chưa?"): #65656 chạm D24 mà không tắt vì
# cùng lúc nằm trong danh sách giảm bậc, bước giảm của nhịp chạy trước giành camp. Một camp chỉ mang MỘT quyết định: camp trong danh sách tắt
# (tự tắt, báo trước một nhịp: T2 · D24 · L3 · OFF · bản thang lỗ — 29/10/2026 không còn luật chờ anh tắt) bị gỡ khỏi mọi danh sách tăng / giảm / nhân bản / thay creative — worker,
# Telegram, thẻ etp đều đọc cùng một quyết định, không còn phụ thuộc thứ tự bước trong nhịp.
_SE_TAT = {int(x[0] or 0) for v in (tat2, tat1, tat_d24, tat_l3, tat_l4, tat_pl, dung_dem, tat_l, thang_tat) for x in v}   # RL (tat_roas) gỡ tang30 ở dưới, sau khi xét
tu_choi, dau_phien, dat, giam, ha, nb, thang_nb, tang30, moc30 = ([x for x in v if int(x[0] or 0) not in _SE_TAT] for v in (tu_choi, dau_phien, dat, giam, ha, nb, thang_nb, tang30, moc30))
# ★ ROAS THẮNG → $30 (anh 28/10/2026 "thêm rule tăng roas thắng lên $30"): camp ROAS vẫn miễn mọi luật khác, riêng T30 áp cùng ngưỡng —
# đang $20, ≥ 2/3 ngày đã khép tiêu > 80% ngân sách, ROI các ngày đó > 80% → máy tự tăng $20 → $30 (cùng đường tang30 của worker)
# T30 THEO SỐ ĐO CÓ ĐỐI CHỨNG (anh 02/11/2026 "dừng T30 cho camp thường, theo dõi kỹ cho ROAS vì chưa có đủ data"): so với camp $20 cùng ngày, đang lãi,
# không bị tăng — camp thường lên $30 mất $8.99/ngày mỗi lần (10 lần) → DỪNG; ★ ROAS +$1.80/ngày (3 lần, chưa đủ) → CHẠY, so-luat tách dòng t30_roas
# theo dõi tới ≥ 10 lần (etp ?t=luat). Đổi lại = sửa hai cờ dưới. tang30 tới đây chỉ còn camp thường (camp ROAS đã ra ở _bo_roas).
T30_THUONG_DUNG, T30_ROAS_DUNG = True, False
if T30_THUONG_DUNG: tang30 = []
tang30 += [] if T30_ROAS_DUNG else [(cid, "★ ROAS thắng · " + s_) for cid, s_ in _tang30_goc if int(cid or 0) in _ROAS]
tat_roas = []
try:
    if _ROAS & _bat:
        # anh 28/10/2026 (góp ý #1460 "mới chạy 1 hôm bị âm đã đòi tắt. Hôm sau lại dương"): bỏ nhánh MỘT ngày — chỉ báo khi 2 ngày đã khép
        # ĐỀU có chi và ĐỀU lỗ, cộng 2 ngày chi > $20 mà ROI < 0%. Một ngày âm rồi ngày sau dương = không báo.
        _r1, _r2, _rg = bc(d(1), d(1)), bc(d(2), d(2)), bc(d(2), d(1))
        for cid in sorted(_ROAS & _bat):
            a1, a2, a = (x.get(cid) or x.get(str(cid)) for x in (_r1, _r2, _rg))
            if a and a1 and a2 and a1["chi"] > 0 and a2["chi"] > 0 and a["chi"] > ROAS_CHI and roi(a) < ROAS_ROI and roi(a1) < 0 and roi(a2) < 0:
                tat_roas.append((cid, f"#{a['ten'][:80]} · 2 ngày đã khép ({d(2)[8:10]}/{d(2)[5:7]} {roi(a2):+.0f}% · {d(1)[8:10]}/{d(1)[5:7]} {roi(a1):+.0f}%): chi ${a['chi']:.2f} · thu ${a['thu']:.2f} · lãi ${a['thu'] - a['chi']:+.2f} · ROI {roi(a):+.0f}% → TẮT (luật RL)"))
except Exception as e:
    loi_may.append((0, f"luật RL (ROAS lỗ) không đọc được Report: {str(e)[:80]}"))
# R0 — ★ ROAS KHÔNG TIÊU (anh 02/11/2026 #72924: "camp ROAS này đang âm mà lại có 3 ngày liên tiếp ko tiêu tiền. Cần có cơ chế xử lý để dồn ngân sách sang việc khác"):
# camp ROAS bật, đã lên > R0_NGAY + 1 ngày, R0_NGAY ngày đã khép gần nhất cộng chi < $R0_CHI (thầu ROAS không thắng phiên nào) → báo trước một nhịp rồi máy tắt, cùng
# đường RL. D24 (khoảng dừng > 24 giờ) miễn camp ROAS và RL đòi có chi → trước đây camp ROAS đứng không luật nào xử, vẫn giữ ngân sách trong trần ngày.
R0_NGAY, R0_CHI, R0_PHAN = 3, 0.5, 0.05
# mốc chi THEO NGÂN SÁCH (02/11/2026: #72924 $20/ngày tiêu $0.85 trong 3 ngày — lọt mốc cứng $0.5): < max($0.5, 5% ngân sách 3 ngày) — camp $20 = $3, camp $1 = $0.5
r0_chi = lambda ns: max(R0_CHI, round(R0_PHAN * R0_NGAY * float(ns or 0), 2))
tat_r0 = []
try:
    if _ROAS & _bat:
        _g0 = bc(d(R0_NGAY), d(1)); _cm = {c["id"]: c for c in ds_camp}
        for cid in sorted(_ROAS & _bat):
            if int(cid) in {int(x[0] or 0) for x in tat_roas}: continue
            t = _tao.get(cid)
            if not t or (dt.datetime.now(dt.timezone.utc) - t).days < R0_NGAY + 1: continue
            a = _g0.get(cid) or _g0.get(str(cid)) or {"chi": 0.0, "thu": 0.0}; c = _cm.get(cid) or {}
            if a["chi"] >= r0_chi(c.get("budget_daily")): continue
            tr = tron.get(cid) or tron.get(str(cid)) or {"chi": 0.0, "thu": 0.0}
            tat_r0.append((cid, f"#{(c.get('name') or '')[:80]} · {R0_NGAY} ngày đã khép chi ${a['chi']:.2f} · lãi ${a['thu'] - a['chi']:+.2f} · đang giữ ${float(c.get('budget_daily') or 0):g}/ngày · cả chặng lãi ${tr['thu'] - tr['chi']:+.2f} → TẮT (luật R0: ★ ROAS {R0_NGAY} ngày chi < ${r0_chi(c.get('budget_daily')):g})"))
except Exception as e:
    loi_may.append((0, f"luật R0 (ROAS không tiêu) lỗi: {str(e)[:80]}"))
_rl = {int(x[0] or 0) for x in tat_roas + tat_r0}; tang30 = [x for x in tang30 if int(x[0] or 0) not in _rl]   # một camp một quyết định: RL thắng ★ ROAS thắng → $30
# G10 — HẠ VỀ $10 RỒI TẮT (hướng dẫn team 31/10/2026: "ngân sách lên $30 mà camp rois giảm là mình giảm luôn budget về ~ 10$ sau đó theo dõi 1,2 ngày mà rois
# vẫn kém, mình off đi"; anh: "Có áp dụng g10 cho roas") — MỌI camp đang bật, kể cả ★ ROAS (xét SAU _bo_roas). Bước 1: ngân sách > G10_NS, 3 ngày đã khép
# (D−1..D−3) chi ≥ 1 ngày ngân sách mà ROI < G10_ROI% → máy hạ THẲNG về $10. Ngưỡng ngân sách đúng bộ lọc team gửi trên Ethopex (anh 31/10/2026 ảnh:
# "Campaign Status: Active · Budget Daily: > 15 · ROI: < 15") — ngân sách > $15, tức camp $20 / $30 (không đi từng bậc). Bước 2: camp G10 đã hạ (etp.cau_hinh 'g10' = {camp: ngày hạ},
# worker ghi khi hạ xong) có G10_THEO ngày đã khép SAU ngày hạ mà ROI vẫn < G10_ROI% → báo trước một nhịp rồi máy tắt (cùng đường L3 / RL).
# Đang theo dõi thì khoá tăng / nhân bản / lên ROAS; qua được thì hết theo dõi, kém lại thì hạ lại.
G10_NS, G10_DICH, G10_ROI, G10_THEO = 15, 10, 0, 2   # G10_ROI 15 → 0 (anh 05/11/2026 "không giảm camp đang lãi": giảm khi ROI 24h trước ≥ 0 → −$1,59/camp so đối chứng +$0,04)
# NHÁNH KÉM ĐI (anh 02/11/2026 "có, thêm luôn" — team: "những camp mà last 5 day có tín hiệu rois kém đi … giảm budget theo dõi 2 ngày tiếp, vẫn kém thì off"):
# Nhánh "kém đi" (ROI còn dương mà tụt so 4 ngày trước → hạ $10) ĐÃ BỎ 05/11/2026: không giảm camp đang lãi (số toàn đội: −$1,59/camp so đối chứng +$0,04).
# G10 HỒI (anh 04/11/2026 "Camp ROAS về $10 theo dõi thì chưa có rule để tăng trở lại" → "ok"): camp G10 đã hạ, đủ G10_THEO ngày đã khép sau ngày hạ, ROI ≥ G10_HOI%
# và chi ≥ 1 ngày ngân sách → nâng thẳng về ngân sách TRƯỚC lúc hạ (nhật ký G10 'truoc'), gỡ khỏi sổ G10 (worker). Áp cả ★ ROAS — đường tăng duy nhất của camp ROAS
# (_bo_roas gạt ROAS khỏi mọi luật tăng). Tụt lại thì G10 hạ như cũ. Ngưỡng 30% (cao hơn ngưỡng tắt 15%) để không giật lên xuống.
G10_HOI = 30
g10, tat_g10, _g10_theo, hoi_g10 = [], [], {}, []
# A/B G10 hồi (AB02, migration 0429): lần A/B kieu g10_hoi đang chạy hôm nay → (mã, nhánh, tên nhánh) của camp; camp đã mang mã A/B khác (etp.camp_ab một camp một mã) → None = theo thang
_ab_g10_so = json.loads(q(f"select row_to_json(a)::text from etp.ab a where trang_thai = 'dang' and kieu = 'g10_hoi' and '{(dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).date()}'::date between bat_dau and coalesce(ket_thuc, bat_dau) order by ma limit 1") or "null")
_ab_g10_co = {int(x.split("|")[0]): x.split("|", 1)[1] for x in q("select camp_id || '|' || ab || '|' || nhanh from etp.camp_ab").splitlines() if x} if _ab_g10_so else {}
_ab_g10_dem = {n: sum(1 for v in _ab_g10_co.values() if v == f"{_ab_g10_so['ma']}|{n}") for n in ("thu", "doi")} if _ab_g10_so else {}
def _ab_g10(cid):
    if not _ab_g10_so: return None
    co = _ab_g10_co.get(cid)
    if co and not co.startswith(_ab_g10_so["ma"] + "|"): return None
    if co: nh = co.split("|")[1]
    else:   # camp mới vào → nhánh đang ÍT camp hơn (anh 05/11/2026 "AB phải cùng điểm xuất phát"): hai nhánh vào thành cặp, không để đối chứng chờ may rủi chẵn/lẻ
        nh = "thu" if _ab_g10_dem["thu"] <= _ab_g10_dem["doi"] else "doi"; _ab_g10_dem[nh] += 1
    return _ab_g10_so["ma"], nh, _ab_g10_so["nhanh"][nh]["ten"]
_d3s = {dt.date.fromisoformat(d(i)) for i in (1, 2, 3)}
_d4s = {dt.date.fromisoformat(d(i)) for i in (4, 5, 6, 7)}
try:
    try: _g10 = {int(k): dt.date.fromisoformat(v) for k, v in json.loads(q("select gia_tri::text from etp.cau_hinh where khoa = 'g10'") or "{}").items()}
    except Exception: _g10 = {}
    for cid in sorted(_bat):
        if int(cid) in _SE_TAT or int(cid) in _rl: continue
        _ds = (_ng.get(int(cid)) or [None, []])[1]; a = thang.get(cid) or {}; ten_ = (a.get("ten") or (_ng.get(int(cid)) or [""])[0] or "")[:70]
        ns = float(a.get("budget") or 0)
        ngay_ha = _g10.get(int(cid)) if ns <= G10_DICH else None   # sổ ghi theo lệnh đã gửi — ngân sách thật chưa về $10 thì coi như chưa hạ, xét hạ lại
        if ngay_ha:
            sau = sorted(x for x in _ds if x[0] > ngay_ha)[:G10_THEO]
            if len(sau) < G10_THEO: _g10_theo[int(cid)] = ngay_ha; continue
            cs, ts = sum(x[1] for x in sau), sum(x[2] for x in sau)
            if cs >= ns and (ts - cs) / cs * 100 >= G10_HOI:
                # ngân sách TRƯỚC lúc hạ = ngân sách thật cao nhất 7 ngày trước ngày hạ (etp.so_ngay.ngan_sach) — không đọc nhật ký lệnh (04/11/2026: #66666 lệnh G10 ghi thất bại mà ngân sách vẫn về $10)
                truoc_ = q(f"select max(ngan_sach) from etp.so_ngay where camp_id = {int(cid)} and ngay between '{ngay_ha - dt.timedelta(days=7)}' and '{ngay_ha}'")
                cu_ = float(truoc_) if truoc_ and truoc_.replace('.', '', 1).isdigit() else 0
                # A/B AB02 (sổ etp.ab kieu g10_hoi): nhánh thu = theo THANG (anh 05/11/2026 mọi bước ≤ ×1,5: bậc cao nhất ≤ min(ngân sách cũ, ns × 1,5), $10 → $13)
                # · nhánh doi = về ngân sách cũ (luật 04/11/2026), làm tròn xuống bậc thang gần nhất (MUC của lam-ethopex chỉ nhận mức trên thang). Không có lần A/B đang chạy = theo thang.
                nh_ = _ab_g10(int(cid))
                tran_ = cu_ if nh_ and nh_[1] == "doi" else min(cu_, ns * 1.5)
                ve = max((b for b in BAC + [30] if ns < b <= tran_), default=None)
                if ve: hoi_g10.append((cid, f"#{ten_} · hạ về ${G10_DICH} ngày {ngay_ha:%d/%m}, {G10_THEO} ngày đã khép sau đó: chi ${cs:.2f} · lãi ${ts - cs:+.2f} · ROI {(ts - cs) / cs * 100:+.0f}% ≥ {G10_HOI}% · trước lúc hạ ${cu_:.0f}"
                                      f"{f' · {nh_[0]} {nh_[2]}' if nh_ else ''} · ${ns:.0f} → ${ve} (luật G10 hồi{': về ngân sách cũ' if nh_ and nh_[1] == 'doi' else ': lên lại theo thang, mỗi bước ≤ ×1,5'})", {"ab": nh_[:2]} if nh_ else {})); continue
            if cs > 0 and (ts - cs) / cs * 100 < G10_ROI and duoi(int(cid), ns, G10_ROI, ten_, "G10"):
                tat_g10.append((cid, f"#{ten_} · hạ về ${G10_DICH} ngày {ngay_ha:%d/%m}, {G10_THEO} ngày đã khép sau đó: chi ${cs:.2f} · lãi ${ts - cs:+.2f} · ROI {(ts - cs) / cs * 100:+.0f}% → TẮT (luật G10: vẫn < {G10_ROI}%)"))
                continue
        if ns <= G10_NS: continue
        x3 = [x for x in _ds if x[0] in _d3s]; c3, t3 = sum(x[1] for x in x3), sum(x[2] for x in x3)
        if len(x3) < 3 or c3 < ns: continue   # chạy đủ 3 ngày: cả 3 ngày đã khép đều có chi (anh 31/10/2026 "ROI 3 ngày và phải chạy từ 3 ngày trở lên")
        r3_ = (t3 - c3) / c3 * 100
        x4 = [x for x in _ds if x[0] in _d4s]; c4, t4 = sum(x[1] for x in x4), sum(x[2] for x in x4); r4_ = (t4 - c4) / c4 * 100 if c4 else None
        if r3_ >= G10_ROI: continue   # nhánh "kém đi" (ROI còn dương mà tụt) đã bỏ 05/11/2026 — không giảm camp đang lãi
        try: ly = NT.chan_giam(api, cid)
        except Exception: ly = None
        if not ly: g10.append((cid, f"#{ten_} · ${ns:g} → ${G10_DICH} · 3 ngày đã khép chi ${c3:.2f} · lãi ${t3 - c3:+.2f} · ROI {r3_:+.1f}%" + (
            f" < {G10_ROI}% (luật G10 — hướng dẫn team)")))
except Exception as e:
    loi_may.append((0, f"luật G10 lỗi: {str(e)[:80]}"))
_g10_cam = {int(x[0]) for x in g10 + tat_g10} | set(_g10_theo)
# H2 — TĂNG BẬC RỒI LỖ 2 NGÀY ĐÃ KHÉP → HẠ VỀ $1 (anh 04/11/2026 "Đc. Làm đi và áp dụng", sau #68815 $1→$7 rồi −33% / −56% mà không luật nào kéo về):
# lần tăng gần nhất trong 5 ngày, từ đó tới nay KHÔNG tăng thêm, và 2 ngày đã khép sau lần tăng (D−1, D−2) đều lỗ (chi ≥ $0.5, thu < chi) → hạ thẳng về $1, KHÔNG tắt
# (L3 vẫn tắt nếu lỗ ngày thứ 3). Đo 22–31/10: 102 lần, 3 ngày kế để nguyên −$35.77 · hạ về $1 −$4.66 · tắt $0 nhưng mất +$31.91 của 28% camp hồi. Không áp ★ ROAS (luật RL riêng).
H2_DICH = 1
h2 = []
try:
    _tang = {}
    for _l in q("select camp_id, max(luc at time zone 'UTC')::date from etp.nhat_ky where viec = 'tang' and ok and luc > now() - interval '6 days' and camp_id is not null group by 1").splitlines():
        _a = _l.split("|")
        if len(_a) == 2 and _a[0].isdigit(): _tang[int(_a[0])] = dt.date.fromisoformat(_a[1])
    _dd1, _dd2 = dt.date.fromisoformat(d(1)), dt.date.fromisoformat(d(2))
    for cid in sorted(_bat):
        c_ = int(cid)
        if c_ in _SE_TAT or c_ in _rl or c_ in _g10_cam or c_ in _ROAS or c_ not in _tang: continue
        if _tang[c_] >= _dd2: continue   # lần tăng phải TRƯỚC 2 ngày đã khép đang xét
        ns = float((thang.get(cid) or {}).get("budget") or 0)
        if ns <= H2_DICH: continue
        _m = {x[0]: x for x in (_ng.get(c_) or [None, []])[1]}
        lo2 = [_m.get(k) for k in (_dd2, _dd1)]
        if not all(x and x[1] >= 0.5 and x[2] < x[1] for x in lo2): continue
        cs_, ts_ = sum(x[1] for x in lo2), sum(x[2] for x in lo2)
        h2.append((cid, f"#{((thang.get(cid) or {}).get('ten') or '')[:70]} · tăng bậc ngày {_tang[c_]:%d/%m}, 2 ngày đã khép sau đó lỗ: chi ${cs_:.2f} · lãi ${ts_ - cs_:+.2f} · ROI {(ts_ - cs_) / cs_ * 100:+.0f}% · ${ns:g} → ${H2_DICH} (luật H2)"))
except Exception as e:
    loi_may.append((0, f"luật H2 lỗi: {str(e)[:80]}"))
# KHÔNG GIẢM CAMP ĐANG LÃI — MỘT CỔNG Ở NGUỒN (anh 05/11/2026 duyệt; số toàn đội phan-tich-gio.py mục C: giảm khi ROI 24h trước ≥ 0 → lãi 24h sau −$1,59/camp,
# đối chứng +$0,04; giảm khi đang lỗ +$1,47 ≈ đối chứng): mọi lệnh giảm (GB `ha` · ROI tụt `giam` · G10 hạ `g10` · H2 `h2`) phải có lãi hôm qua + hôm nay < 0.
# Worker / Telegram / thẻ etp đọc cùng danh sách; máy đề xuất đội (de-xuat-ngoai.py) chạy cùng mã nên cùng cổng.
def _lai_gan(c):
    y = hqua.get(c) or hqua.get(str(c)) or {}; h_ = hom.get(c) or hom.get(str(c)) or {}
    return float(y.get("thu") or 0) + float(h_.get("thu") or 0) - float(y.get("chi") or 0) - float(h_.get("chi") or 0)
_giu_lai = lambda ds: [x for x in ds if _lai_gan(int(x[0] or 0)) < 0]
ha, giam, g10, h2 = map(_giu_lai, (ha, giam, g10, h2))
# TĂNG TRONG NGÀY CHỈ KHI ĐÃ CHI ĐỦ + ROI HÔM NAY ≥ 100% — MỘT CỔNG cho mọi luật tăng (tăng bậc · tăng trong ngày · lãi đầu phiên), mọi khung
# (anh 05/11/2026 "sửa đi"; số toàn đội 20/10–05/11, tang-trong-ngay: tăng khi ROI hôm nay 50–100% kém để nguyên $1,83/camp; ROI ≥ 100% + bước ≤ ×1,5
# hơn để nguyên $14,77/camp). Ngưỡng = khung_doi.nap_chi / sang_roi của sổ luật chung — cùng ngưỡng nạp sáng, một nguồn.
# TIÊU DỒN (anh 05/11/2026): chi tới 13h VN hôm nay + ngân sách lúc 13h (trước lần máy tăng đầu tiên trong ngày) của mọi camp — nhip_tang.tieu_don quyết, một chỗ
_CHI13 = {int(l.split("|")[0]): float(l.split("|")[1]) for l in q(f"select camp_id, sum(chi) from etp.so_gio_camp where ngay = '{d(0)}' and gio < {NT.DON_GIO} group by 1").splitlines() if "|" in l}
_NS13 = {int(l.split("|")[0]): float(l.split("|")[1]) for l in q(f"select camp_id, min(nullif(regexp_replace(truoc, '[^0-9.]', '', 'g'), '')::numeric) from etp.nhat_ky where ok and viec = 'tang' and (luc at time zone 'utc')::date = '{d(0)}' group by 1").splitlines() if "|" in l and l.split("|")[1]}
def _ns_tang(c):
    h_ = hom.get(c) or hom.get(str(c)) or {}; a_ = thang.get(c) or thang.get(str(c)) or {}
    return h_, a_.get("budget") or h_.get("budget")
def _du_tang(c):
    h_, ns_ = _ns_tang(c)
    return NT.du_so(h_.get("chi"), h_.get("thu"), ns_, chi_13h=_CHI13.get(c), ns_13h=_NS13.get(c, ns_))   # MỘT công thức cổng tăng (nhip_tang.du_so) cho máy luật + nhịp tăng + máy làm
def _don_dk(c, ns):
    """hàng 'tiêu dồn' cho thẻ xét luật Tăng bậc"""
    c13, n13 = _CHI13.get(int(c)), _NS13.get(int(c), ns)
    pct = c13 / n13 * 100 if c13 is not None and n13 else None
    return [f"Chi tới {7 + NT.DON_GIO}h VN / ngân sách lúc đó (tiêu dồn → hoãn tăng tối nay)", "—" if pct is None else f"{pct:.0f}% (${c13:.2f} / ${n13:g})", f"< {NT.DON_13H:.0%}", not NT.tieu_don(c13, n13)]
dat, dau_phien = ([x for x in ds if _du_tang(int(x[0] or 0))] for ds in (dat, dau_phien))
# camp đã hạ, đang trong 2 ngày theo dõi — có danh sách riêng để trang etp / bộ lọc thấy (anh 01/11/2026 "Thiếu luật G10 vừa áp dụng?": trước đó camp đang theo dõi rơi khỏi mọi danh sách)
g10_theo = [(cid, f"#{(thang.get(cid) or {}).get('ten', '')[:70]} · đã hạ về ${G10_DICH} ngày {ngay:%d/%m} — theo dõi {G10_THEO} ngày đã khép, ROI vẫn < {G10_ROI}% thì tắt; đang khoá tăng") for cid, ngay in sorted(_g10_theo.items())]
dat, dau_phien, tang30, thang_nb, nb, moc30 = ([x for x in v if int(x[0] or 0) not in _g10_cam] for v in (dat, dau_phien, tang30, thang_nb, nb, moc30))
# GIỮ CAMP CUỐI CỦA PHIM — CHỈ CAMP LÃI (anh 05/11/2026 sau đó: "cam lỗ vẫn phải cắt nhưng thay bằng = camp test duy nhất !!! Thử các hướng creative khác nhau") (anh 05/11/2026: "nếu phim ko có camp thay thế thì sẽ bị mất dấu vết. Ít nhất vẫn phải có 1 camp lãi duy trì, trừ trường hợp bị bão hoà
# + lỗ quá theo luật"): mọi camp đang bật của phim đều nằm trong danh sách tắt mà phim chưa có camp nối (camp đã tạo, hẹn lịch chưa tới giờ chạy) → gỡ camp tốt nhất
# (ROI cả đời cao nhất) khỏi mọi danh sách tắt, vào danh sách giu_cuoi. Ngoại lệ = luật cất phim đã có: phim đã cất (thu_vong 'cat' — cat_phim) hoặc bão hoà
# (etp.phim_bao_hoa.bao_hoa) mà ROI phim cả hệ ngày đã khép gần nhất < 0. Có camp nối thì máy tắt như thường; thay-the.py vẫn thấy camp sắp tắt và tiếp tục lên camp thay.
giu_cuoi = []
try:
    _DS_TAT = (tat2, tat1, t1_cho, tat_d24, tat_l3, tat_l4, tat_pl, tat_l, thang_tat, tat_roas, tat_r0, tat_g10)   # dừng đêm không tính (tạm dừng, bật lại theo lịch) · t1_cho: sáng đã biết camp nào được giữ
    _chet = {int(x[0] or 0) for v in _DS_TAT for x in v}
    if _chet and _bat:
        _pc = {}
        for _l in q(f"select camp_id, content_id from etp.camp where camp_id in ({','.join(str(int(c)) for c in _bat)}) and content_id > 0").splitlines():
            _a, _b = _l.split("|"); _pc.setdefault(int(_b), []).append(int(_a))
        _noi = {int(x) for x in q("select distinct content_id from etp.camp where trang_thai <> 'ACTIVE' and lich > now() and tao > now() - interval '3 days' and content_id > 0").split()}
        _bo_giu = {int(x) for x in q("select content_id from etp.phim where thu_vong = 'cat'").split()}
        for _l in q("select content_id, roi->-1->>'roi' from etp.phim_bao_hoa where bao_hoa is not null").splitlines():
            _a, _b = _l.split("|")
            if _b and float(_b) < 0: _bo_giu.add(int(_a))
        _roi_doi = {}
        for _l in q(f"select camp_id, sum(chi), sum(thu) from {K_SO} where camp_id in ({','.join(str(c) for c in _chet)}) group by 1").splitlines():
            _a, _c, _t = _l.split("|"); _roi_doi[int(_a)] = (float(_t) - float(_c)) / float(_c) * 100 if float(_c) > 0 else -100.0
        for _ph, _cs in _pc.items():
            if _ph in _noi or _ph in _bo_giu or not all(c in _chet for c in _cs): continue
            _g = max(_cs, key=lambda c: (_roi_doi.get(c, -100.0), c))
            if _roi_doi.get(_g, -100.0) < 0: continue   # anh 05/11/2026 "cam lỗ vẫn phải cắt nhưng thay bằng 1 camp test duy nhất": chỉ giữ camp LÃI; lỗ thì tắt, thay-the.py lên camp test
            _luat = [v[[int(x[0] or 0) for x in v].index(_g)][1].split("→")[-1].strip()[:60] for v in _DS_TAT if any(int(x[0] or 0) == _g for x in v)]
            for v in _DS_TAT: v[:] = [x for x in v if int(x[0] or 0) != _g]
            giu_cuoi.append((_g, f"#{(thang.get(_g) or thang.get(str(_g)) or {}).get('ten', '')[:70]} · camp cuối của phim {_ph} (ROI cả đời {_roi_doi.get(_g, -100):+.0f}%) · chạm {' | '.join(_luat)} → GIỮ, chưa có camp thay; tắt khi phim có camp nối hoặc phim bị cất (bão hoà + lỗ / cat_phim)"))
except Exception as e:
    loi_may.append((0, f"giữ camp cuối lỗi: {str(e)[:80]}"))
# XÉT LUẬT TỪNG CAMP (anh 28/10/2026: "Cần xem mức độ liên quan của từng camp với các luật khi hover vào … để biết tính có đúng không + hiểu rõ hơn
# về từng luật"): với mỗi camp đang chạy, từng luật → điều kiện [tên, giá trị thật, ngưỡng, đạt?] trên CHÍNH các bảng số + ngưỡng máy vừa dùng ở trên;
# kết: 'dat' (đủ mọi điều kiện) · 'gan' (thiếu đúng một) · 'xa'; 'vao' = máy có xếp camp vào danh sách làm ở nhịp này không (khác 'dat' thì do cổng phụ:
# nhịp tăng 3 giờ, đổi < 6 giờ, khung giờ, bộ…). Ghi etp.xet_luat (migration 0350) ở lượt --json; trang etp hiện khi rê vào camp.
def _xet_luat():
    vao = {k: {int(x[0] or 0) for x in v} for k, v in (("tat_l3", tat_l3), ("tat_l4", tat_l4), ("tat_pl", tat_pl), ("tat_d24", tat_d24), ("tat2", tat2), ("tat1", tat1), ("tat", tat_l), ("tang", dat), ("dau_phien", dau_phien), ("ha", ha), ("giam", giam), ("nb", nb),
           ("thang_nb", thang_nb), ("thang_tat", thang_tat), ("tang30", tang30), ("dung_dem", dung_dem), ("tat_roas", tat_roas), ("tat_r0", tat_r0), ("g10", g10), ("tat_g10", tat_g10), ("hoi_g10", hoi_g10))}
    giam_tu = q("select gia_tri::text from etp.cau_hinh where khoa = 'giam_tu_dong'") != "false"
    f = lambda v, dv="": "—" if v is None else (f"{v:+.0f}%" if dv == "%" else f"${v:.2f}" if dv == "$" else f"{v:g}{dv}")
    def L(ma, ten, mo_ta, dk, vao_ds=None, ghi=None, ap=True, tien=0, lo=None):
        # tien = số điều kiện TIỀN ĐỀ đứng đầu dk (camp có thuộc diện luật không: đáy $1 không giảm được, đã qua 2 ngày đầu…) — hỏng một cái là 'khong_ap', không gọi là 'gần'
        ap = ap and all(x[3] for x in dk[:tien]); thieu = sum(1 for x in dk if not x[3])
        # lo = camp có đang LỖ trong khung của luật tắt không (anh 29/10/2026 sau L4: camp lãi +177% hiện thẻ "L4 gần chạm" vì đủ ngày + đủ chi, chỉ thiếu điều kiện ROI
        # — rồi máy thay camp coi là sắp tắt). Luật tắt: camp đang lãi thì KHÔNG bao giờ là 'gần', chỉ 'xa'
        ket = "khong_ap" if not ap else "dat" if thieu == 0 else "gan" if thieu == 1 and lo is not False else "xa"
        return {"ma": ma, "ten": ten, "mo_ta": mo_ta, "dk": dk, "ket": ket, "vao": vao_ds, "ghi": ghi}
    def L_g10(cid, ns):
        _x = [x for x in (_ng.get(int(cid)) or [None, []])[1] if x[0] in _d3s]; c3, t3 = sum(x[1] for x in _x), sum(x[2] for x in _x); r3 = (t3 - c3) / c3 * 100 if c3 >= 0.3 else None
        theo_ = _g10_theo.get(int(cid))
        return L("g10", "G10 · ROI 3 ngày < 15% → $10, rồi tắt", f"Mọi camp kể cả ★ ROAS (hướng dẫn team 31/10/2026): ngân sách > ${G10_NS}, chạy đủ 3 ngày (3 ngày đã khép đều có chi), chi 3 ngày ≥ 1 ngày ngân sách mà ROI < {G10_ROI}% → máy hạ thẳng về ${G10_DICH}; {G10_THEO} ngày đã khép sau đó ROI vẫn < {G10_ROI}% → báo trước một nhịp rồi máy tắt. Đang theo dõi thì khoá tăng.",
            [["Ngân sách", f"${ns:g}", f"> ${G10_NS}", ns > G10_NS], ["Ngày có chi (3 ngày đã khép)", f"{len(_x)}/3", "đủ 3 ngày", len(_x) >= 3], ["Chi 3 ngày đã khép", f(c3, "$"), f"≥ 1 ngày ngân sách", bool(ns) and c3 >= ns], ["ROI 3 ngày đã khép", f(r3, "%"), f"< {G10_ROI}%", r3 is not None and r3 < G10_ROI]],
            "g10" if int(cid) in vao["g10"] else "tat_g10" if int(cid) in vao["tat_g10"] else None,
            f"đã hạ về ${G10_DICH} ngày {theo_:%d/%m} — đang theo dõi {G10_THEO} ngày đã khép, khoá tăng" if theo_ else None, tien=2, lo=None if r3 is None else r3 < G10_ROI)
    # thẻ "G10 kém đi" (g10k) đã gỡ 05/11/2026 cùng nhánh kém đi — không giảm camp đang lãi
    ra = {}; _giu = {int(x[0] or 0) for x in giu_cuoi}
    for cid in sorted(_dc):
        a = thang.get(cid) or thang.get(str(cid)) or {"chi": 0.0, "thu": 0.0, "budget": 0.0}
        ns = float(a.get("budget") or 0); r = roi(a) if a.get("chi") else None
        h = hom.get(cid) or {"chi": 0.0, "thu": 0.0}; rh = roi(h) if h.get("chi", 0) >= 0.3 else None
        y = hqua.get(cid); ry = roi(y) if y and y["chi"] >= 0.3 else None
        g3 = gan.get(cid); rg = roi(g3) if g3 and g3["chi"] else None; t4 = truoc.get(cid); rt = roi(t4) if t4 and t4["chi"] else None
        tr = tron.get(cid) or tron.get(str(cid)); rtr = roi(tr) if tr and tr["chi"] else None
        tuoi = (dt.datetime.now(dt.timezone.utc) - _tao[cid]).days if cid in _tao else None
        b2 = int(cid) in bo2; ls = []
        def _the_l4(cid):   # thẻ L4 dùng chung camp thường + ★ ROAS (anh 03/11/2026: L4 áp cả ROAS — "chưa thấy L4 lên à ?": nhánh ROAS trước chỉ dựng RL / R0 / T30 / G10)
            _gl = _ng.get(int(cid), [None, []])[1] if "_ng" in globals() else []
            _x7 = [x for x in _gl if x[0] in _d7] if "_d7" in globals() else []; _c7, _t7_ = sum(x[1] for x in _x7), sum(x[2] for x in _x7); _r7 = (_t7_ - _c7) / _c7 * 100 if _c7 >= 0.3 else None
            return L("l4", "L4 · lỗ đều ≥ 4 ngày", f"7 ngày đã khép: chi ≥ ${L4_CHI:g}, ≥ {L4_NGAY} ngày có chi, ROI < {L4_ROI}% → máy tắt hẳn (bắt camp $1 lỗ đều mà L3 / T2 / OFF bỏ lọt — anh 29/10/2026, thay L7; áp cả ★ ROAS từ 03/11/2026).",
                [["Ngày có chi (7 ngày đã khép)", f"{len(_x7)} ngày", f"≥ {L4_NGAY}", len(_x7) >= L4_NGAY], ["Chi 7 ngày", f(_c7, "$"), f"≥ ${L4_CHI:g}", _c7 >= L4_CHI], ["ROI 7 ngày", f(_r7, "%"), f"< {L4_ROI}%", _r7 is not None and _r7 < L4_ROI]],
                "tat_l4" if int(cid) in vao["tat_l4"] else None, lo=_r7 is not None and _r7 < 0)
        if int(cid) in _ROAS:
            # RL — điều kiện hiện đủ trên thẻ xét luật (trước đây dk rỗng → thẻ ghi "Đạt" mà không nói đạt cái gì)
            _g = lambda t: (globals().get(t) or {}).get(cid) or (globals().get(t) or {}).get(str(cid))
            a1_, a2_, ag_ = _g("_r1"), _g("_r2"), _g("_rg")
            r1_, r2_, rg_ = (roi(x) if x and x["chi"] > 0 else None for x in (a1_, a2_, ag_))
            ls.append(L("rl", "RL · ROAS lỗ 2 ngày", f"Camp ★ ROAS (miễn luật camp thường, trừ L4 — 03/11/2026): 2 ngày đã khép ĐỀU có chi và ĐỀU lỗ, cộng 2 ngày chi > ${ROAS_CHI} mà ROI < {ROAS_ROI}% → báo trước một nhịp rồi máy tự tắt.",
                [[f"ROI ngày {d(2)[8:10]}/{d(2)[5:7]}", f(r2_, "%"), "< 0%", r2_ is not None and r2_ < 0], [f"ROI ngày {d(1)[8:10]}/{d(1)[5:7]}", f(r1_, "%"), "< 0%", r1_ is not None and r1_ < 0],
                 ["Chi 2 ngày", f((ag_ or {}).get("chi"), "$"), f"> ${ROAS_CHI}", bool(ag_) and ag_["chi"] > ROAS_CHI], ["ROI 2 ngày", f(rg_, "%"), f"< {ROAS_ROI}%", rg_ is not None and rg_ < ROAS_ROI]],
                "tat_roas" if int(cid) in vao["tat_roas"] else None, lo=None if rg_ is None else rg_ < 0))
            _a0 = _g("_g0"); _t0 = _tao.get(cid); _tu0 = (dt.datetime.now(dt.timezone.utc) - _t0).days if _t0 else None
            ls.append(L("r0", "R0 · ROAS không tiêu", f"Camp ★ ROAS đã lên > {R0_NGAY + 1} ngày, {R0_NGAY} ngày đã khép gần nhất cộng chi < max(${R0_CHI:g}, {R0_PHAN:.0%} ngân sách {R0_NGAY} ngày) (thầu ROAS không thắng) → báo trước một nhịp rồi máy tắt, trả ngân sách cho việc khác (anh 02/11/2026).",
                [["Tuổi camp", "—" if _tu0 is None else f"{_tu0} ngày", f"> {R0_NGAY} ngày", _tu0 is not None and _tu0 >= R0_NGAY + 1], [f"Chi {R0_NGAY} ngày đã khép", f((_a0 or {}).get("chi", 0.0), "$"), f"< ${r0_chi(ns):g}", (_a0 or {}).get("chi", 0.0) < r0_chi(ns)]],
                "tat_r0" if int(cid) in vao["tat_r0"] else None, tien=1))
            ns = float(a.get("budget") or 0); du30 = [n[cid] for n in (ngay3 if "ngay3" in globals() else []) if cid in n and n[cid]["chi"] > T30_SP / 100 * 20]
            r30 = roi({"chi": sum(x["chi"] for x in du30), "thu": sum(x["thu"] for x in du30)}) if du30 else None
            ls.append(L("t30", "★ ROAS thắng · $20 → $30", ("Đang tạm dừng — máy không tăng. " if T30_ROAS_DUNG else "Đang theo dõi (02/11/2026: mới 3 lần đo, +$1.80/ngày so với đối chứng; sổ luật dòng t30_roas). ") + f"Camp ROAS đang $20, ≥ {T30_NGAY}/3 ngày đã khép tiêu > {T30_SP}% ngân sách ($16), ROI các ngày đó > {T30_ROI}% → máy tự tăng $30.",
                [["Ngân sách", f"${ns:g}", "= $20", round(ns) == 20], ["Ngày tiêu > $16", f"{len(du30)}/3", f"≥ {T30_NGAY}", len(du30) >= T30_NGAY], ["ROI các ngày đó", f(r30, "%"), f"> {T30_ROI}%", r30 is not None and r30 > T30_ROI]],
                "tang30" if int(cid) in vao["tang30"] else None, tien=1))
            ls.append(_the_l4(cid)); ls.append(L_g10(cid, ns)); ra[int(cid)] = ls; continue
        # T2 — tắt sau 2 ngày có chi đầu tiên
        ds2 = _n2.get(int(cid), [None, []])[1] if "_n2" in globals() else []
        # T1 — tắt sau ngày có chi đầu tiên (02/11/2026)
        c1 = ds2[0][0] if ds2 else 0.0; r1 = (ds2[0][1] - c1) / c1 * 100 if c1 else None; ng1 = t1_chi(ns)
        ca1 = sum(x[0] for x in ds2[:2]); ra1 = (sum(x[1] for x in ds2[:2]) - ca1) / ca1 * 100 if ca1 else None
        rn1 = _t1_nay(cid)
        _the1 = L("t1", "T1 · tắt sau ngày đầu", f"Camp có 1–2 ngày đã khép có chi, ngày đầu chi ≥ min(${T1_CHI:g}, {T1_PHAN:.0%} ngân sách) và ROI < {T1_ROI}% (không có thu = −100%), mọi ngày đã khép vẫn < {T1_ROI}% → máy tắt hẳn (cách Kim Kiên đóng camp — anh 02/11/2026); HOẶC 24 giờ chạy đầu (từ giờ có chi đầu, etp.so_gio_camp) ROI < {T1_24_ROI}% với chi ≥ {T1_24_PHAN:.0%} ngân sách → tắt ngay khi đủ {T1_24_TUOI} giờ tuổi, không chờ ngày khép (anh 05/11/2026). Xét từ {(7 + T1_CHO) % 24}:00 VN (ngày mới chạy đủ {T1_CHO} giờ); hôm nay ROI ≥ {T1_THA}% thì tha hôm đó.",
            [["Số ngày đã khép có chi", f"{len(ds2)} ngày", "1–2 ngày", 1 <= len(ds2) <= 2], ["Chi ngày đầu", f(c1, "$"), f"≥ ${ng1:g}", c1 >= ng1],
             ["ROI ngày đầu", f(r1, "%"), f"< {T1_ROI}%", r1 is not None and r1 < T1_ROI], ["ROI mọi ngày đã khép", f(ra1, "%"), f"< {T1_ROI}%", ra1 is not None and ra1 < T1_ROI],
             ["ROI hôm nay (chi ≥ $0.3)", f(rn1, "%"), f"< {T1_THA}% (≥ {T1_THA}% thì tha hôm nay)", rn1 is None or rn1 < T1_THA]],
            "tat1" if int(cid) in vao["tat1"] else None, tien=1, lo=(r1 is not None and r1 < 0) or (ra1 is not None and ra1 < 0))
        # GIỜ CHỜ + NHÁNH 24 GIỜ không phải điều kiện AND (05/11/2026: thẻ đếm cả "ngày mới đủ 6 giờ" lẫn hàng 24 giờ → camp đủ T1 bị ghi 'xa' trước 13:00,
        # thay-the.py không thấy phim sắp mất hết camp → không chuẩn bị camp thay). Giờ chờ chỉ hiện; 24 giờ chạy đạt = đạt T1 (HOẶC)
        _d24 = _t24_dong(cid)
        if _d24[3]: _the1["ket"] = "dat"
        if _the1["ket"] == "dat" and not _the1["vao"] and _gio_ngay < T1_CHO: _the1["ghi"] = f"đã nhận — {T1_XET}:00 VN xét lại (hôm nay ROI ≥ {T1_THA}% thì tha), máy tắt trong khung {T1_KHUNG[0]}–{T1_KHUNG[1]}h"
        _the1["dk"] += [["Ngày mới đã chạy (giờ chờ, không tính điều kiện)", f"{_gio_ngay} giờ", f"≥ {T1_CHO} giờ ({T1_XET}:00 VN)", _gio_ngay >= T1_CHO], _d24]
        ls.append(_the1)
        c2 = sum(x[0] for x in ds2[:2]); t2_ = sum(x[1] for x in ds2[:2]); r2 = (t2_ - c2) / c2 * 100 if c2 else None
        ca = sum(x[0] for x in ds2); ra_ = (sum(x[1] for x in ds2) - ca) / ca * 100 if ca else None
        ng2 = t2_chi(ns)
        ls.append(L("t2", "T2 · tắt sau 2 ngày đầu", f"Camp có 2–{T2_NGAY} ngày đã khép có chi, 2 ngày đầu chi ≥ min(${T2_CHI:g}, {T2_PHAN:.0%} ngân sách 2 ngày) và ROI < {T2_ROI}%, mọi ngày đã khép vẫn < {T2_ROI}% → máy tắt hẳn.",
            [["Số ngày đã khép có chi", f"{len(ds2)} ngày", f"2–{T2_NGAY} ngày", 2 <= len(ds2) <= T2_NGAY], ["Chi 2 ngày đầu", f(c2, "$"), f"≥ ${ng2:g}", c2 >= ng2],
             ["ROI 2 ngày đầu", f(r2, "%"), f"< {T2_ROI}%", r2 is not None and r2 < T2_ROI], ["ROI mọi ngày đã khép", f(ra_, "%"), f"< {T2_ROI}%", ra_ is not None and ra_ < T2_ROI]],
            "tat2" if int(cid) in vao["tat2"] else None, tien=1, lo=(r2 is not None and r2 < 0) or (ra_ is not None and ra_ < 0)))
        # D24 — khoảng dừng > 24 giờ
        _g = _ng.get(int(cid), [None, []])[1] if "_ng" in globals() else []
        _th = [x for x in ([_g[0][0] + dt.timedelta(days=i) for i in range((_hq - _g[0][0]).days + 1)] if _g else []) if x not in {y[0] for y in _g}]
        ls.append(L("d24", "D24 · dừng > 24 giờ", "Từ ngày chi đầu tiên tới hôm qua có một ngày trọn không chi (camp đã đứng ≥ 24 giờ: tắt rồi bật lại, hoặc Meta ngừng phân phối) → máy tắt hẳn, không xét lãi lỗ.",
            [["Ngày có chi (đã khép)", f"{len(_g)} ngày", "≥ 1", bool(_g)], ["Ngày trọn không chi sau ngày chi đầu", ", ".join(f"{x:%d/%m}" for x in _th[:4]) or "không", "≥ 1 ngày", bool(_th)]],
            "tat_d24" if int(cid) in vao["tat_d24"] else None, tien=2))   # cả hai là tiền đề: chưa có khoảng nghỉ = KHÔNG ÁP, không có "sắp chạm D24" (anh 29/10/2026: thẻ D24 nét đứt trên camp chưa từng nghỉ)
        # L3 — lỗ 3 ngày đã khép liền
        _m3 = {x[0]: x for x in _g}; _l3 = [_m3.get(k) for k in _d3] if "_d3" in globals() else []
        ls.append(L("l3", "L3 · lỗ 3 ngày liền", f"3 ngày đã khép gần nhất ngày nào cũng chi ≥ min(${L3_CHI:g}, {L3_PHAN:.0%} ngân sách ngày đó) và lỗ → máy tắt hẳn (thay cho giảm bậc — anh 29/10/2026; ngưỡng theo ngân sách 01/11/2026).",
            [[f"Ngày {k:%d/%m}", (f"chi ${x[1]:.2f} · lãi ${x[2] - x[1]:+.2f}" if x else "không chi"), (f"chi ≥ ${l3_chi(x[3]):g} và lỗ" if x else f"chi ≥ ${L3_CHI:g} và lỗ"), bool(x and x[1] >= l3_chi(x[3]) and x[2] < x[1])] for k, x in zip(_d3 if "_d3" in globals() else [], _l3)],
            "tat_l3" if int(cid) in vao["tat_l3"] else None))
        # L4 — lỗ đều ≥ 4 ngày trong 7 ngày đã khép (thẻ _the_l4, chung với nhánh ★ ROAS)
        _x7 = [x for x in _g if x[0] in _d7] if "_d7" in globals() else []; _c7 = sum(x[1] for x in _x7)   # L7 đối chiếu bên dưới dùng lại
        _r7 = (sum(x[2] for x in _x7) - _c7) / _c7 * 100 if _c7 >= 0.3 else None
        ls.append(_the_l4(cid))
        # PL — phim lỗ 7 ngày → tắt camp nhỏ của phim (chỉ bộ trong etp.cau_hinh.bo_tat_phim_lo)
        if int(cid) in _pl_xet:
            ls.append(L("pl", "PL · phim lỗ 7 ngày", f"Bộ {', '.join(BO_PL)}: phim có 7 ngày đã khép ở bộ đó chi ≥ ${PL_CHI:g} và ROI < {PL_ROI}% → máy tắt camp ≤ ${PL_NS:g} của phim, trừ camp tự lãi 3 ngày (anh 02/11/2026).",
                _pl_xet[int(cid)], "tat_pl" if int(cid) in vao["tat_pl"] else None))
        # L7 — ĐANG DỪNG (thay bằng L4 29/10/2026), số chỉ để đối chiếu
        ls.append(L("l7", "L7 · lỗ đều 7 ngày (ĐANG DỪNG)", f"Đã dừng từ 29/10, thay bằng L4. Số chỉ để đối chiếu: chi ≥ ${L7_CHI:g}, ≥ {L7_NGAY} ngày có chi, ROI < {L7_ROI}%.",
            [["Ngày có chi (7 ngày đã khép)", f"{len(_x7)} ngày", f"≥ {L7_NGAY}", len(_x7) >= L7_NGAY], ["Chi 7 ngày", f(_c7, "$"), f"≥ ${L7_CHI:g}", _c7 >= L7_CHI], ["ROI 7 ngày", f(_r7, "%"), f"< {L7_ROI}%", _r7 is not None and _r7 < L7_ROI]],
            None, "luật đang dừng — không làm gì", ap=False))
        # OFF — tắt camp lỗ lâu
        ls.append(L("off", "OFF · tắt camp lỗ lâu", "Camp đủ 7 ngày tuổi, tiêu > $10 từ trước tới nay mà ROI < −50% → máy tắt (báo Telegram trước một nhịp).",
            [["Tuổi", f"{tuoi} ngày" if tuoi is not None else "—", f"≥ {TUOI_TAT} ngày", tuoi is not None and tuoi >= TUOI_TAT], ["Chi từ trước tới nay", f(tr["chi"] if tr else 0, "$"), "> $10", bool(tr and tr["chi"] > 10)],
             ["ROI từ trước tới nay", f(rtr, "%"), "< −50%", rtr is not None and rtr < -50]], "tat" if int(cid) in vao["tat"] else None, lo=rtr is not None and rtr < 0))
        # T7 — đang dừng
        a7 = _r7.get(int(cid)) if isinstance(_r7, dict) else None
        ls.append(L("t7", "T7 · lãi 7 ngày (ĐANG DỪNG)", "Đã dừng từ 27/10, thay bằng T2. Số chỉ để đối chiếu: 7 ngày đã khép lãi < −$1, chi > $5, > 3 ngày bật.",
            [["Lãi 7 ngày đã khép", f(a7["lai"] if a7 else None, "$"), "< −$1", bool(a7 and a7["lai"] < -1)], ["Chi 7 ngày", f(a7["chi"] if a7 else None, "$"), "> $5", bool(a7 and a7["chi"] > 5)],
             ["Ngày bật", f"{a7['ad']} ngày" if a7 else "—", "> 3", bool(a7 and a7["ad"] > 3)]], None, "luật đang dừng — không làm gì", ap=False))
        # TĂNG BẬC / THANG NHÂN BẢN (bộ 2 không đổi ngân sách, mở bản thang)
        spv = (y["chi"] if (KHUNG_DEM and y) else h.get("chi", 0)) / ns * 100 if ns else 0
        dk_tang = [["ROI " + rd(cid).replace("ROI ", ""), f(r, "%"), f"≥ {ROI_TANG}%", r is not None and r >= ROI_TANG],
                   ["Spending " + ("hôm qua" if KHUNG_DEM else "hôm nay"), f"{spv:.0f}%", f"> {sp_min:g}%", spv > sp_min],
                   ["ROI hôm nay (tới đợt chi gần nhất, chi ≥ $0.3)", f(rh, "%"), "≥ 0%", rh is None or rh >= 0], ["Còn bậc trên", f"${ns:g}", "< $20", bool(ke(ns))]]
        cong_b2 = ["Cổng mở bản thang (bộ 2)", _thang_ly.get(int(cid), "mở được"), "mở được", int(cid) not in _thang_ly]
        if b2: dk_tang = dk_tang + [cong_b2]
        _ts = _ts_ly(cid); dk_ts = [f"Siết tăng TS (02/11): sau {TS_GIO[1]}:00 (nạp sáng: tiêu hết + ROI hôm nay ≥ {KD['sang_roi']}% thì được) · hôm qua không lãi 0–50%", _ts or "qua", "không chặn", _ts is None]
        dk_tang = dk_tang + [dk_ts] + ([] if b2 else [_don_dk(cid, ns)])
        _don_ghi = None if b2 or _don_dk(cid, ns)[3] else f"tiêu dồn (≥ {NT.DON_13H:.0%} ngân sách tới {7 + NT.DON_GIO}h) — hoãn tăng tối nay, hôm sau tiêu đều thì tăng như thường"
        ls.append(L("thang_nb" if b2 else "tang", "Thang nhân bản (bộ 2)" if b2 else "Tăng bậc",
            ("Bộ 2: đủ luật tăng thì KHÔNG đổi ngân sách mà mở bản mới ở bậc kế (creative khác cùng phim). " if b2 else "") + f"ROI khung dài ≥ {ROI_TANG}%, spending > {sp_min:g}% ngân sách, hôm nay không lỗ, chưa ở trần. Cổng phụ: tăng cách nhau ≥ 3 giờ, sau lần giảm phải ROI ≥ 50% lại." + (f" Bộ 2: camp gốc tiêu TB ≥ ${THANG_CHI_GOC:g}/ngày 3 ngày đã khép mới mở bản thang (29/10)." if b2 else ""),
            dk_tang, ("thang_nb" if int(cid) in vao["thang_nb"] else None) if b2 else ("tang" if int(cid) in vao["tang"] else None), ghi=_don_ghi))
        # bộ 2 KHÔNG tăng ngân sách — đủ luật thì mở bản thang, nên cổng mở bản thang mới nằm trong bảng (anh 28/10/2026 #1464 "tăng trong ngày sao lại liên quan đến mở bản thang?": tên luật không nói điều đó)
        ls.append(L("tang_ngay", "Tăng trong ngày → mở bản thang (bộ 2)" if b2 else "Tăng trong ngày", ("Bộ 2 không tăng ngân sách: đủ luật này thì máy MỞ BẢN MỚI ở bậc kế (creative khác cùng phim), nên phải qua cổng mở bản thang. " if b2 else "") + "ROI hôm nay (chỉ cộng các giờ tới đợt chi gần nhất) ≥ 50%, đã chi ≥ 30% ngân sách, hôm qua không âm (hôm qua âm mà chi hôm qua < max($2, 50% ngân sách) thì bỏ qua — luật B1), ROI khung dài ≥ 0% (29/10). ROI chỉ tính khi chi ≥ $0.3.",
            [["ROI hôm nay", f(rh, "%"), "≥ 50%", rh is not None and rh >= 50], ["Chi hôm nay", f"{(h.get('chi', 0) / ns * 100 if ns else 0):.0f}% ngân sách", "≥ 30%", bool(ns and h.get("chi", 0) >= 0.3 * ns)],
             ["ROI hôm qua", f(ry, "%") + (f" · chi ${y['chi']:.2f}" if y else ""), f"≥ 0% · bỏ qua khi chi < ${max(HQ_NHO_MIN, HQ_NHO * ns):g}", bool(ry is None or ry >= 0 or (y and y["chi"] < max(HQ_NHO_MIN, HQ_NHO * ns)))],
             ["ROI " + rd(cid).replace("ROI ", ""), f(r, "%"), "≥ 0%", r is not None and r >= 0], dk_ts] + ([cong_b2] if b2 else []), ("thang_nb" if int(cid) in vao["thang_nb"] else None) if b2 else ("tang" if int(cid) in vao["tang"] else None)))
        # GIẢM BẬC — đã bỏ (anh 29/10/2026 "làm 1+2"): không còn trong bản xét; camp lỗ liền xem luật L3
        if not b2:
            ls.append(L("nb", "Nhân bản camp thắng (NB)", f"ROI khung dài ≥ {NB_ROI}%, tiêu ≥ ${NB_CHI}, ROI 3 ngày gần ≥ {NB_ROI3}%, camp gốc đã chạm trần ${TRAN_NB:g} → nhân một bản $1 GIỮ NGUYÊN creative (từ 28/10; đoạn đã đủ {TRAN_DOAN_} camp chạy mới đổi creative khác cùng phim).",
                [["ROI " + rd(cid).replace("ROI ", ""), f(r, "%"), f"≥ {NB_ROI}%", r is not None and r >= NB_ROI], ["Chi khung dài", f(a.get("chi"), "$"), f"≥ ${NB_CHI}", a.get("chi", 0) >= NB_CHI],
                 ["ROI 3 ngày gần", f(rg, "%"), f"≥ {NB_ROI3}%", rg is not None and rg >= NB_ROI3], ["Ngân sách", f"${ns:g}", f"≥ ${TRAN_NB:g} (trần)", ns >= TRAN_NB]],
                "nb" if int(cid) in vao["nb"] else None))
            g5 = ngay5.get(cid) if "ngay5" in globals() else None; r5 = roi(g5) if g5 and g5["chi"] else None
            # mô tả luật hiện ở cột Luật của MỌI người trong team (etp vai người) → không ghi tên người (nới 29/10/2026 theo cách một tk team chạy; anh 31/10/2026 Kiên không thấy phần người khác)
            ls.append(L("t30", "T30 · $20 → $30", ("Đang tạm dừng (02/11/2026: so với camp $20 cùng ngày không tăng, mỗi lần lên $30 mất $8.99/ngày) — máy không tăng. " if T30_THUONG_DUNG else "") + f"Camp đang $20, {T30N_NGAY} ngày đã khép: chi TB ≥ {T30N_SP}% ngân sách (${T30N_SP / 100 * 20:g}/ngày), ROI ≥ {T30N_ROI}% → máy tự lên $30.",
                [["Ngân sách", f"${ns:g}", "= $20", round(ns) == 20], [f"Chi TB {T30N_NGAY} ngày", f((g5["chi"] / T30N_NGAY) if g5 else None, "$"), f"≥ ${T30N_SP / 100 * 20:g}", bool(g5 and g5["chi"] >= T30N_SP / 100 * 20 * T30N_NGAY)], [f"ROI {T30N_NGAY} ngày", f(r5, "%"), f"≥ {T30N_ROI}%", r5 is not None and r5 >= T30N_ROI]],
                "tang30" if int(cid) in vao["tang30"] else None, tien=1))
        ls.append(L_g10(cid, ns))
        if int(cid) in _giu:   # camp cuối của phim: luật tắt đạt nhưng máy giữ (giu_cuoi) — thẻ nói thẳng, không hứa "máy tắt"
            for l_ in ls:
                if l_["ket"] == "dat" and l_["ma"] in ("t1", "t2", "l3", "l4", "off", "d24", "g10"): l_["ghi"] = "GIỮ — camp cuối của phim, chưa có camp thay (tắt khi phim có camp nối hoặc phim bị cất)"
        ra[int(cid)] = ls
    return ra
if JSON:
    m = lambda ds: [{"id": i, "chu": s, **(x[0] if x else {}), **({"bo": _bo_c[int(i)]} if _bo_c.get(int(i or 0)) else {})} for i, s, *x in ds]   # phần tử thứ ba (tuỳ chọn) = trường thêm, vd G10 hồi {"ab": [mã, nhánh]}
    try:   # XÉT LUẬT TỪNG CAMP → etp.xet_luat (đi qua stdin psql: chuỗi lớn vượt giới hạn một tham số dòng lệnh)
        _x = _xet_luat()
        _sql = "begin; create temp table _x (j jsonb); insert into _x values ('" + json.dumps([{"c": k, "x": v} for k, v in _x.items()], ensure_ascii=False).replace("'", "''") + "'::jsonb);" + \
               (f" insert into etp.xet_luat_ngoai (camp_id, nguoi_id, luc, xet) select (e->>'c')::int, {EA.XEM}, now(), e->'x' from _x, jsonb_array_elements(j) e on conflict (camp_id) do update set nguoi_id = excluded.nguoi_id, luc = excluded.luc, xet = excluded.xet;"
                f" delete from etp.xet_luat_ngoai where nguoi_id = {EA.XEM} and luc < now() - interval '3 hours'; commit;" if EA.XEM else
                " insert into etp.xet_luat (camp_id, luc, xet) select (e->>'c')::int, now(), e->'x' from _x, jsonb_array_elements(j) e on conflict (camp_id) do update set luc = excluded.luc, xet = excluded.xet;"
                " delete from etp.xet_luat where luc < now() - interval '3 hours'; commit;")
        _p = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1"], input=_sql, capture_output=True, text=True, timeout=60)
        if _p.returncode: loi_may.append((0, f"ghi xét luật lỗi: {_p.stderr.strip()[:80]}"))
    except Exception as e:
        loi_may.append((0, f"xét luật lỗi: {str(e)[:80]}"))
    ra_ = {"luc": f"{vn:%H:%M %d/%m}", "tat_d24": m(tat_d24), "tat_l3": m(tat_l3), "tat_l4": m(tat_l4), "tat_pl": m(tat_pl), "tat": m(tat_l), "tat7": m(tat7), "tat2": m(tat2), "tat1": m(tat1), "t1_cho": m(t1_cho), "giu_cuoi": m(giu_cuoi), "tat_roas": m(tat_roas), "tat_r0": m(tat_r0), "g10": m(g10), "h2": m(h2), "tat_g10": m(tat_g10), "g10_theo": m(g10_theo), "cho_duoi": m(cho_duoi), "tu_choi": m(tu_choi), "loi_may": m(loi_may), "dau_phien": m(dau_phien), "tang": m(dat), "giam": m(giam), "ha": m(ha), "nb": m(nb), "thang_nb": m(thang_nb), "thang_tat": m(thang_tat), "dung_dem": m(dung_dem), "moc30": m(moc30), "tang30": m(tang30), "dong": m(dong_l), "gan": m(theo), "gan_t7": m(gan_t7), "hoi_g10": m(hoi_g10)}
    # SỔ LUẬT CHUNG (apps/web/src/lib/etp-bang-luat.json): mọi danh sách máy luật xuất ra phải có mục ở sổ — thiếu là trang etp / bộ lọc / worker không biết luật đó (gốc vụ G10 01/11/2026)
    _thieu = sorted(k for k in ra_ if k != "luc" and k not in BANG_LUAT["khoa"])
    if _thieu: ra_["loi_may"] = ra_.get("loi_may", []) + [{"id": 0, "chu": f"luật chưa có trong sổ luật chung etp-bang-luat.json: {', '.join(_thieu)}"}]
    print(json.dumps(ra_, ensure_ascii=False))
    sys.exit(0)
gio = vn.hour + vn.minute / 60
moc = min([21, 24, 32], key=lambda m: (m - gio) % 24)   # 21h · 24h · 8h (=32 ⇒ 8h sáng hôm sau)
trong = any(abs(((gio - m + 12) % 24) - 12) <= 1 for m in (21, 0, 8))
in_ = lambda tieu, ds, rong="(không)": (print(tieu), print("\n".join("  " + s for _, s in ds) or "  " + rong))
print(f"Giờ VN {vn:%H:%M %d/%m} · khung tăng ngân sách ~21h / ~24h / 8h: " + ("ĐANG TRONG KHUNG" if trong else f"mốc kế ~{int(moc) % 24}h") + " (ngân sách còn thấp $1–3 thì chưa cần canh giờ; không thu lại sau khung)")
in_("CẦN TẮT — OFF (camp ≥ 7 ngày, tiêu > $10 từ trước tới nay, ROI < −50%) — MÁY TẮT (báo trước một nhịp):", tat_l)
in_(f"LUẬT RL (camp ★ ROAS, 2 ngày đã khép đều lỗ, cộng chi > ${ROAS_CHI} mà ROI < {ROAS_ROI}%) — BÁO TRƯỚC MỘT NHỊP RỒI MÁY TỰ TẮT:", tat_roas, "(không)")
in_(f"LUẬT G10 (ngân sách > ${G10_NS}, 3 ngày đã khép ROI < {G10_ROI}%, kể cả ★ ROAS) — MÁY HẠ THẲNG VỀ ${G10_DICH}:", g10, "(không)")
in_(f"LUẬT G10 — ĐÃ HẠ VỀ ${G10_DICH}, {G10_THEO} NGÀY SAU VẪN ROI < {G10_ROI}% — BÁO TRƯỚC MỘT NHỊP RỒI MÁY TỰ TẮT:", tat_g10, "(không)")
in_("LUẬT H2 (tăng bậc rồi 2 ngày đã khép lỗ liền) — MÁY HẠ VỀ $1:", h2, "(không)")
in_(f"ĐUÔI NGÀY KẾ (L3 / G10 tới ngưỡng — chờ đoạn đuôi ngày đang chạy: chi ≥ {DUOI_PHAN:.0%} ngân sách hoặc {DUOI_GIO}:00 VN; đuôi đạt ngưỡng thì giữ):", cho_duoi, "(không)")
in_("AD BỊ META TỪ CHỐI — thay creative sạch:", tu_choi)
in_("LÃI ĐẦU PHIÊN — TĂNG LUÔN $2/$3 (ROI hôm nay > 50%, chi ≥ $0,5):", dau_phien, "(chưa có)")
in_("THANG NHÂN BẢN BỘ 2 — MỞ BẢN MỚI Ở BẬC KẾ (không đổi ngân sách camp đang chạy):", thang_nb, "(chưa có)")
in_("BẢN THANG LỖ (chi ≥ 1 ngày ngân sách, ROI ≤ −30%) — MÁY TẮT (báo trước một nhịp):", thang_tat, "(không)")
in_("T30 — CAMP $20, 5 NGÀY ĐÃ KHÉP CHI TB ≥ $12 + ROI ≥ 50% → LÊN $30 (MÁY TỰ TĂNG — nới 29/10/2026):", tang30, "(chưa có)")
in_(f"ĐỦ TIÊU CHÍ LÊN ROAS (lãi 30 ngày ≥ ${ROAS_LAI}, chưa có camp ★) — MÁY TỰ LÊN:", moc30, "(chưa có)")
in_(f"ĐỦ ĐIỀU KIỆN TĂNG (ROI 30 ngày / từ lúc lên ≥ {roi_min:g}% và spending hôm nay > {sp_min:g}%) — CHỜ ANH DUYỆT:", dat, "(chưa có)")
in_("CẦN XEM GIẢM / TẮT (ROI tụt — phim down trend hoặc creative bão hoà, CPC/CPA tăng) — CHỜ ANH QUYẾT:", giam)
in_("GẦN ĐẠT (theo dõi tiếp):", theo)
