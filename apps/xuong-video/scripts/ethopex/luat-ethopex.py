#!/usr/bin/env python3
"""LUẬT ETHOPEX — MỘT chỗ chấm mọi luật vận hành camp (kb #261 mục 8–8g) trên box3 (đọc API Report + chi tiết camp, khoá ở studio xv_khoa_ngoai).
Ai dùng: kiem-ngan-sach.sh (gọi tay từ Mac qua ssh) · phòng Ethopex của cty (theo dõi định kỳ, báo Telegram). CHỈ ĐỌC + BÁO — không sửa camp.
Dùng (trên box3, đã nạp .env.production):  python3 luat-ethopex.py [roi_toi_thieu=20] [spending_toi_thieu=50] [--json]
  --tong: chỉ tổng số (hôm nay / hôm qua / tháng / từ đầu + camp lãi / lỗ nhất) cho bảng ghim, không chấm luật.
  --json: in một đối tượng {luc, tang, dau_phien, giam, tat, moc30, tu_choi, gan} — mỗi mục {id, ten, chu} để máy theo dõi so trùng."""
import json, os, subprocess, sys, urllib.request, datetime as dt
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
roi_min = float(ARGS[0]) if ARGS else 20; sp_min = float(ARGS[1]) if len(ARGS) > 1 else 50; JSON = '--json' in sys.argv
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
def bc(tu, den):
    body = json.dumps({"columns": ["campaign_name", "daily_budget", "spending", "roi", "profit", "cost", "revenue"], "filters": {}, "metric_conditions": [], "limit": 1000, "page": 1, "page_size": 1000, "date_from": tu, "date_to": den}).encode()
    r = urllib.request.Request("https://api.ethopex.dev/api/v1/report", data=body, method="POST", headers={"authorization": "Bearer " + T, "content-type": "application/json", "user-agent": "mos2-kiem"})
    g = {}
    for x in json.load(urllib.request.urlopen(r, timeout=60)).get("rows", []):   # report tách dòng theo content → cộng theo camp
        a = g.setdefault(x["campaign_id"], {"ten": x["campaign_name"], "budget": float(x.get("daily_budget") or 0), "chi": 0.0, "thu": 0.0})
        a["chi"] += float(x.get("cost") or 0); a["thu"] += float(x.get("revenue") or 0); a["budget"] = max(a["budget"], float(x.get("daily_budget") or 0))
    return g
vn = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) + dt.timedelta(hours=7); nay = vn.date()
d = lambda n: (nay - dt.timedelta(days=n)).isoformat()
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
    print(json.dumps({"luc": f"{vn:%H:%M %d/%m}", "hom": {**tong(h), "budget": round(sum(x["budget"] for x in co), 2)}, "qua": tong(bc(d(1), d(1))), "thang": tong(bc(nay.replace(day=1).isoformat(), d(0))), "tron": tong(bc("2026-01-01", d(0))),
                      "top": co[:3], "day": [x for x in co[::-1] if x["lai"] < 0][:2], "noi_dung": nd}, ensure_ascii=False)); sys.exit(0)
hom = bc(d(0), d(0)); thang = bc(nay.replace(day=1).isoformat(), d(0)); gan = bc(d(2), d(0)); truoc = bc(d(6), d(3)); tron = bc("2026-01-01", d(0))
roi = lambda a: (a["thu"] - a["chi"]) / a["chi"] * 100 if a["chi"] else None
BAC = [1, 3, 5, 7, 10, 15, 20]
ke = lambda b: next((x for x in BAC if x > b + 1e-9), None)
dat, theo, giam, dau_phien, moc30 = [], [], [], [], []
for cid, a in sorted(thang.items()):
    h = hom.get(cid, {"chi": 0.0, "budget": a["budget"]}); sp = h["chi"] / a["budget"] * 100 if a["budget"] else 0; r = roi(a)
    dong = f"#{a['ten'][:70]} · ${a['budget']:g}" + (f" → ${ke(a['budget']):g}" if ke(a['budget']) else " (trần $20)") + f" · spending hôm nay {sp:.0f}% · ROI tháng {r:+.0f}% · lãi ${a['thu'] - a['chi']:+.2f}" if r is not None else ""
    if not dong: continue
    if r >= roi_min and sp > sp_min and ke(a["budget"]): dat.append((cid, dong))
    elif r >= roi_min or sp > sp_min * 0.8: theo.append((cid, dong))
    if h["chi"] >= 0.5 and a["budget"] < 3:
        rh = (h.get("thu", 0) - h["chi"]) / h["chi"] * 100
        dich = 3 if rh >= 100 else 2
        if rh > 50 and dich > a["budget"]: dau_phien.append((cid, f"#{a['ten'][:70]} · ${a['budget']:g} → ${dich} · ROI hôm nay {rh:+.0f}% · lãi hôm nay ${h.get('thu', 0) - h['chi']:+.2f}"))
    if a["chi"] >= 30 and a["thu"] > a["chi"]: moc30.append((cid, f"#{a['ten'][:70]} · đã tiêu ${a['chi']:.2f} tháng này, vẫn lãi ${a['thu'] - a['chi']:+.2f} → hỏi Support cách scale bài viết cũ + bid ROAS"))
    g2, t2 = gan.get(cid), truoc.get(cid)
    if g2 and t2 and g2["chi"] >= 1.5 and t2["chi"] >= 1.5 and (g2["chi"] + t2["chi"]) >= 3:
        rg, rt = roi(g2), roi(t2)
        if rt is not None and rg is not None and ((rt >= roi_min and rg < 0) or rt - rg >= 30):
            giam.append((cid, f"#{a['ten'][:70]} · ROI 4 ngày trước {rt:+.0f}% → 3 ngày gần {rg:+.0f}% (chi ${g2['chi']:.2f})"))

def api(p):
    return json.load(urllib.request.urlopen(urllib.request.Request("https://api.ethopex.dev" + p, headers={"authorization": "Bearer " + T, "user-agent": "mos2-kiem"}), timeout=30))
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
    if ai == "user": cau = f"tắt tay — {h.get('actor_name') or 'người dùng'} qua {h.get('source_label') or h.get('source') or '?'}" + (" (lệnh anh duyệt: chat / nút Telegram)" if h.get("source") == "api" else "")
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
tu_choi, dong_l = [], []
try:
    for c in api("/api/v1/campaigns?page_size=500")["data"]:
        if c.get("state") == "ARCHIVED": continue
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
        if "DISAPPROVED" in str(ad.get("error") or "") or ad.get("delivery_status") == "DISAPPROVED":
            tu_choi.append((c["id"], f"#{c['id']}: {c['name'][:60]} · ad bị Meta từ chối → Edit camp, thay creative sạch đã duyệt cùng phim (soat-camp-api.py gợi ý)"))
except Exception as e:
    tu_choi.append((0, f"không đọc được chi tiết camp: {str(e)[:80]}"))
tat_l = [(cid, f"#{a['ten'][:70]} · tiêu ${a['chi']:.2f} từ trước tới nay · ROI {roi(a):+.0f}% → TẮT") for cid, a in tron.items() if a["chi"] > 10 and roi(a) is not None and roi(a) < -50]
if JSON:
    m = lambda ds: [{"id": i, "chu": s} for i, s in ds]
    print(json.dumps({"luc": f"{vn:%H:%M %d/%m}", "tat": m(tat_l), "tu_choi": m(tu_choi), "dau_phien": m(dau_phien), "tang": m(dat), "giam": m(giam), "moc30": m(moc30), "dong": m(dong_l), "gan": m(theo)}, ensure_ascii=False))
    sys.exit(0)
gio = vn.hour + vn.minute / 60
moc = min([21, 24, 32], key=lambda m: (m - gio) % 24)   # 21h · 24h · 8h (=32 ⇒ 8h sáng hôm sau)
trong = any(abs(((gio - m + 12) % 24) - 12) <= 1 for m in (21, 0, 8))
in_ = lambda tieu, ds, rong="(không)": (print(tieu), print("\n".join("  " + s for _, s in ds) or "  " + rong))
print(f"Giờ VN {vn:%H:%M %d/%m} · khung tăng ngân sách ~21h / ~24h / 8h: " + ("ĐANG TRONG KHUNG" if trong else f"mốc kế ~{int(moc) % 24}h") + " (ngân sách còn thấp $1–3 thì chưa cần canh giờ; không thu lại sau khung)")
in_("CẦN TẮT (tiêu > $10 từ trước tới nay, ROI < −50%) — CHỜ ANH TẮT:", tat_l)
in_("AD BỊ META TỪ CHỐI — thay creative sạch:", tu_choi)
in_("LÃI ĐẦU PHIÊN — TĂNG LUÔN $2/$3 (ROI hôm nay > 50%, chi ≥ $0,5):", dau_phien, "(chưa có)")
in_("CHẠM MỐC $30 MÀ VẪN LÃI — hỏi Support scale bài viết cũ + bid ROAS:", moc30, "(chưa có)")
in_(f"ĐỦ ĐIỀU KIỆN TĂNG (ROI tháng ≥ {roi_min:g}% và spending hôm nay > {sp_min:g}%) — CHỜ ANH DUYỆT:", dat, "(chưa có)")
in_("CẦN XEM GIẢM / TẮT (ROI tụt — phim down trend hoặc creative bão hoà, CPC/CPA tăng) — CHỜ ANH QUYẾT:", giam)
in_("GẦN ĐẠT (theo dõi tiếp):", theo)
