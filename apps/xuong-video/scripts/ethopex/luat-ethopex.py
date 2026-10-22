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
# KHUNG 0–5h VN (anh 22/10/2026: "giờ đang là giờ tối ưu tốt (21h–5h sáng VN) thì phải check xem tăng được không"): qua 0h số HÔM NAY về 0 nên
# "Spending hôm nay > 50%" không bao giờ đạt đúng lúc Mỹ đang mua → trong khung này xét chi tiêu + ROI của NGÀY HÔM QUA (trọn ngày) thay cho hôm nay;
# thêm điều kiện ROI hôm qua ≥ 0% (không tăng camp vừa có một ngày lỗ).
KHUNG_DEM = 0 <= vn.hour < 5
try: DUYET = json.load(open(os.path.join(os.environ.get("CTY_DATA_DIR", "/var/lib/cty"), "ethopex-luat-duyet.json")))
except Exception: DUYET = {}
LD_SIET = bool(DUYET.get("ld_siet"))
hqua = bc(d(1), d(1))
for cid, a in sorted(thang.items()):
    h = hom.get(cid, {"chi": 0.0, "budget": a["budget"]}); r = roi(a)
    if KHUNG_DEM:
        y = hqua.get(cid, {"chi": 0.0, "thu": 0.0}); sp = y["chi"] / a["budget"] * 100 if a["budget"] else 0; ry = roi(y)
        nhan, them_dk = "spending hôm qua", (ry is not None and ry >= 0)
    else:
        sp = h["chi"] / a["budget"] * 100 if a["budget"] else 0; ry = None; nhan, them_dk = "spending hôm nay", True
    dong = f"#{a['ten'][:70]} · ${a['budget']:g}" + (f" → ${ke(a['budget']):g}" if ke(a['budget']) else " (trần $20)") + f" · {nhan} {sp:.0f}%" + (f" · ROI hôm qua {ry:+.0f}%" if ry is not None else "") + f" · ROI tháng {r:+.0f}% · lãi ${a['thu'] - a['chi']:+.2f}" if r is not None else ""
    if not dong: continue
    if r >= ROI_TANG and sp > sp_min and them_dk and ke(a["budget"]): dat.append((cid, dong))
    elif r >= roi_min or sp > sp_min * 0.8: theo.append((cid, dong))
    # LD SIẾT (khi anh duyệt trên Telegram — DATA/ethopex-luat-duyet.json "ld_siet"): camp vừa lỗ hôm qua / lỗ cả tháng thì không tăng vì vài chục cent
    # lãi đầu phiên (22/10/2026: #65115 lên $2 nhờ lãi $0,36 buổi sáng trong khi hôm qua −86%, tháng −62%)
    _y = hqua.get(cid); _ry = roi(_y) if _y and _y["chi"] >= 0.3 else None
    ld_chan = LD_SIET and ((_ry is not None and _ry < 0) or (r is not None and r < 0))
    if h["chi"] >= 0.5 and a["budget"] < 3 and not ld_chan:
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
    tu = ((g[0] + dt.timedelta(hours=7)).date() + dt.timedelta(days=1)).isoformat()
    if tu > d(0): return False
    if tu not in _sau: _sau[tu] = bc(tu, d(0))
    a = _sau[tu].get(cid) or _sau[tu].get(str(cid))
    return bool(a and a["chi"] > 0 and roi(a) >= ROI_TANG)
dat = [(cid, chu) for cid, chu in dat if _sau_giam_ok(cid)]
dau_phien = [(cid, chu) for cid, chu in dau_phien if _sau_giam_ok(cid)]
# GIẢM BẬC (luật GB): chỉ phiên sáng (6–13h VN), trên số TRỌN ngày hôm qua: ngân sách > $1, hôm qua đã tiêu ≥ 50% ngân sách, ROI hôm qua < 0% và ROI 3 ngày < 20%
# → xuống một bậc; lỗ nặng (ROI hôm qua < −50% và tiêu đủ ngân sách) → hai bậc. ROI 0–50% là VÙNG GIỮ (không tăng, không giảm).
ha = []
if 6 <= vn.hour < 13:
    for cid, a in thang.items():
        ns = a["budget"]; y = hqua.get(cid)
        if ns <= 1 or not y or y["chi"] < 0.5 * ns: continue
        ry = roi(y); g3 = gan.get(cid); r3 = roi(g3) if g3 else ry
        if ry is None or ry >= 0 or (r3 is not None and r3 >= 20): continue
        buoc = 2 if ry < -50 and y["chi"] >= ns else 1; dich = NT.xuong(ns, buoc)
        try: ly = NT.chan_giam(api, cid)
        except Exception: ly = None
        if dich and not ly: ha.append((cid, f"#{a['ten'][:70]} · ${ns:g} → ${dich:g} · ROI hôm qua {ry:+.0f}% (chi ${y['chi']:.2f}) · ROI 3 ngày {r3:+.0f}%" + (" · lỗ nặng: xuống 2 bậc" if buoc == 2 else "")))
tu_choi, dong_l = [], []
phim_cua, ds_camp = {}, []   # camp → content_id (camp đang chạy / đang đồng bộ) · danh sách camp (luật NB)
try:
    for c in api("/api/v1/campaigns?page_size=500")["data"]:
        ds_camp.append(c)
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
        if ad.get("content_id"): phim_cua[c["id"]] = ad["content_id"]
        if "DISAPPROVED" in str(ad.get("error") or "") or ad.get("delivery_status") == "DISAPPROVED":
            tu_choi.append((c["id"], f"#{c['id']}: {c['name'][:60]} · ad bị Meta từ chối → Edit camp, thay creative sạch đã duyệt cùng phim (soat-camp-api.py gợi ý)"))
except Exception as e:
    tu_choi.append((0, f"không đọc được chi tiết camp: {str(e)[:80]}"))
# LUẬT NB — NHÂN BẢN CAMP THẮNG (anh 22/10/2026: tự động, báo Telegram, mỗi phim tối đa 30 camp ĐANG CHẠY — camp thua tắt thì nhường chỗ cho creative mới).
# Camp đang bật, ROI tháng ≥ 100%, đã tiêu ≥ $10, ROI 3 ngày ≥ 50% (còn đang thắng) → 1 bản $1; mỗi camp gốc tối đa 1 bản / 24 giờ, mỗi phim tối đa
# 3 bản / ngày. Bản nhân bản do nhan-ban.py tạo (tên "(nhan ban N cua <gốc>)"), Phòng Ethopex tự chạy + báo 🧬.
NB_ROI, NB_CHI, NB_ROI3, NB_PHIM_NGAY, TRAN_PHIM_CHAY = 100, 10, 50, 3, 30
nb = []
try:
    gio24 = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=24)
    tao = lambda c: dt.datetime.fromisoformat(str(c.get("created_at")).replace("Z", "+00:00")) if c.get("created_at") else gio24 - dt.timedelta(days=1)
    goc_moi = {int(m.group(1)) for c in ds_camp if tao(c) > gio24 for m in [re.search(r"\(nhan ban \d+ cua (\d+)\)$", c.get("name", ""))] if m}
    dang_chay = {}
    for cid, p in phim_cua.items(): dang_chay[p] = dang_chay.get(p, 0) + 1
    ban_phim = {}
    for c in ds_camp:
        m = re.search(r"\(nhan ban \d+ cua (\d+)\)$", c.get("name", ""))
        if m and tao(c) > gio24 and phim_cua.get(int(m.group(1))): ban_phim[phim_cua[int(m.group(1))]] = ban_phim.get(phim_cua[int(m.group(1))], 0) + 1
    bat = {c["id"] for c in ds_camp if c.get("state") == "ACTIVE"}
    for cid, a in sorted(thang.items(), key=lambda z: -(roi(z[1]) or 0)):
        r, g3, p = roi(a), roi(gan.get(cid) or {"chi": 0, "thu": 0}), phim_cua.get(cid)
        if cid not in bat or not p or r is None or r < NB_ROI or a["chi"] < NB_CHI or g3 is None or g3 < NB_ROI3 or cid in goc_moi: continue
        if dang_chay.get(p, 0) >= TRAN_PHIM_CHAY or ban_phim.get(p, 0) >= NB_PHIM_NGAY: continue
        dang_chay[p] = dang_chay.get(p, 0) + 1; ban_phim[p] = ban_phim.get(p, 0) + 1
        nb.append((cid, f"#{a['ten'][:70]} · ROI tháng {r:+.0f}% · tiêu ${a['chi']:.2f} · ROI 3 ngày {g3:+.0f}% → nhân bản 1 camp $1 (phim {p}: {dang_chay[p]}/{TRAN_PHIM_CHAY} camp chạy)"))
except Exception as e:
    tu_choi.append((0, f"luật NB lỗi: {str(e)[:80]}"))
# CHỈ CAMP ĐANG BẬT mới vào danh sách tăng / giảm (22/10/2026: bảng đề xuất tăng #65648 SIMP NO MORE đã tắt vì phim cấm — máy tự tăng vẫn từ chối camp PAUSED,
# nhưng bảng không được đưa camp đã tắt cho anh duyệt). Không đọc được danh sách camp thì giữ nguyên (đường tăng thật vẫn tự kiểm trạng thái).
_bat = {c["id"] for c in ds_camp if c.get("state") == "ACTIVE"}
if ds_camp: dat, dau_phien, theo, giam, moc30, ha = ([x for x in ds if x[0] in _bat] for ds in (dat, dau_phien, theo, giam, moc30, ha))
# TẮT CHỈ XÉT CAMP ĐỦ 7 NGÀY (anh 22/10/2026: "ít nhất 7 ngày sẽ review tắt camp, chứ không tắt sớm") — camp trẻ hơn mà lỗ thì đi đường giảm bậc (GB)
TUOI_TAT = 7
_tao = {c["id"]: dt.datetime.fromisoformat(str(c["created_at"]).replace("Z", "+00:00")) for c in ds_camp if c.get("created_at")}
du_tuoi = lambda cid: cid in _tao and (dt.datetime.now(dt.timezone.utc) - _tao[cid]).days >= TUOI_TAT
tat_l = [(cid, f"#{a['ten'][:70]} · {(dt.datetime.now(dt.timezone.utc) - _tao[cid]).days} ngày · tiêu ${a['chi']:.2f} từ trước tới nay · ROI {roi(a):+.0f}% → TẮT") for cid, a in tron.items() if a["chi"] > 10 and roi(a) is not None and roi(a) < -50 and du_tuoi(cid)]
giam = [(cid, s + ("" if du_tuoi(cid) else " · camp chưa đủ 7 ngày → chỉ giảm, không tắt")) for cid, s in giam]
if JSON:
    m = lambda ds: [{"id": i, "chu": s} for i, s in ds]
    print(json.dumps({"luc": f"{vn:%H:%M %d/%m}", "tat": m(tat_l), "tu_choi": m(tu_choi), "dau_phien": m(dau_phien), "tang": m(dat), "giam": m(giam), "ha": m(ha), "nb": m(nb), "moc30": m(moc30), "dong": m(dong_l), "gan": m(theo)}, ensure_ascii=False))
    sys.exit(0)
gio = vn.hour + vn.minute / 60
moc = min([21, 24, 32], key=lambda m: (m - gio) % 24)   # 21h · 24h · 8h (=32 ⇒ 8h sáng hôm sau)
trong = any(abs(((gio - m + 12) % 24) - 12) <= 1 for m in (21, 0, 8))
in_ = lambda tieu, ds, rong="(không)": (print(tieu), print("\n".join("  " + s for _, s in ds) or "  " + rong))
print(f"Giờ VN {vn:%H:%M %d/%m} · khung tăng ngân sách ~21h / ~24h / 8h: " + ("ĐANG TRONG KHUNG" if trong else f"mốc kế ~{int(moc) % 24}h") + " (ngân sách còn thấp $1–3 thì chưa cần canh giờ; không thu lại sau khung)")
in_("CẦN TẮT (camp ≥ 7 ngày, tiêu > $10 từ trước tới nay, ROI < −50%) — CHỜ ANH TẮT:", tat_l)
in_("AD BỊ META TỪ CHỐI — thay creative sạch:", tu_choi)
in_("LÃI ĐẦU PHIÊN — TĂNG LUÔN $2/$3 (ROI hôm nay > 50%, chi ≥ $0,5):", dau_phien, "(chưa có)")
in_("CHẠM MỐC $30 MÀ VẪN LÃI — hỏi Support scale bài viết cũ + bid ROAS:", moc30, "(chưa có)")
in_(f"ĐỦ ĐIỀU KIỆN TĂNG (ROI tháng ≥ {roi_min:g}% và spending hôm nay > {sp_min:g}%) — CHỜ ANH DUYỆT:", dat, "(chưa có)")
in_("CẦN XEM GIẢM / TẮT (ROI tụt — phim down trend hoặc creative bão hoà, CPC/CPA tăng) — CHỜ ANH QUYẾT:", giam)
in_("GẦN ĐẠT (theo dõi tiếp):", theo)
