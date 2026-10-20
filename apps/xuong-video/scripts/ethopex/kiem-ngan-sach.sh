#!/usr/bin/env bash
# KIỂM NGÂN SÁCH CAMP ETHOPEX (rule nhóm Support Ads — anh chuyển 20/10 + 21/10/2026). CHỈ ĐỌC + BÁO: mọi lần tăng / giảm / tắt phải được anh DUYỆT đúng camp đó.
#  TĂNG: cột Spending = cost / budget. Camp ROI CAO và Spending > 50% (chi tiêu lên mà ROI vẫn giữ) → tăng MỘT bậc theo thang
#        $1 → 3 → 5 → 7 → 10 → 15 → 20, TRẦN $20/camp (giữ ROI cao). Một ngày tác động tăng tối đa 2–3 lần.
#  KHUNG GIỜ (21/10/2026, Dol Dang): camp chạy chủ yếu Mỹ → hiệu suất tốt nhất 21h hôm nay – 5h sáng hôm sau (giờ VN). Khi tối ưu scale, tăng vào
#        các mốc ~21h · ~24h · 8h (giờ VN). KHÔNG thu ngân sách lại sau khung — tăng tới mốc vừa phải rồi để camp tự chạy, theo dõi ROI.
#        Ngân sách đang thấp ($1–3) thì chưa cần canh giờ.
#  GIẢM / TẮT: chỉ khi phim đi xuống (down trend) hoặc creative bão hoà → CPC/CPA tăng, ROI tụt → báo anh để giảm ngân sách hoặc tắt camp.
#        Máy so ROI 3 ngày gần nhất với 4 ngày trước đó (camp đã chi ≥ $3): ROI tụt từ ≥ ngưỡng xuống < 0, hoặc tụt ≥ 30 điểm → "CẦN XEM GIẢM / TẮT".
#  NHÂN BẢN: phim có camp đạt → Duplicate camp + thêm creative cùng phim (phim phải nằm trong danh sách phim thắng anh duyệt, kiem-so-camp.sh).
# Đọc API Report Ethopex ở máy chủ (khoá trong studio xv_khoa_ngoai, không in) — đủ mọi camp, không phụ thuộc bảng trên màn (bảng chỉ hiện ~15 dòng).
# Dùng: kiem-ngan-sach.sh [roi_toi_thieu=20] [spending_toi_thieu=50]
set -u
ROI_MIN=${1:-20}; SP_MIN=${2:-50}
ssh -o ConnectTimeout=15 root@167.233.241.16 "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 - $ROI_MIN $SP_MIN" <<'EOF'
import json, os, subprocess, sys, urllib.request, datetime as dt
roi_min, sp_min = float(sys.argv[1]), float(sys.argv[2])
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
hom = bc(d(0), d(0)); thang = bc(nay.replace(day=1).isoformat(), d(0)); gan = bc(d(2), d(0)); truoc = bc(d(6), d(3))
roi = lambda a: (a["thu"] - a["chi"]) / a["chi"] * 100 if a["chi"] else None
BAC = [1, 3, 5, 7, 10, 15, 20]
ke = lambda b: next((x for x in BAC if x > b + 1e-9), None)
dat, theo, giam = [], [], []
for cid, a in sorted(thang.items()):
    h = hom.get(cid, {"chi": 0.0, "budget": a["budget"]}); sp = h["chi"] / a["budget"] * 100 if a["budget"] else 0; r = roi(a)
    dong = f"#{a['ten'][:70]} · ${a['budget']:g}" + (f" → ${ke(a['budget']):g}" if ke(a['budget']) else " (trần $20)") + f" · spending hôm nay {sp:.0f}% · ROI tháng {r:+.0f}% · lãi ${a['thu'] - a['chi']:+.2f}" if r is not None else ""
    if not dong: continue
    if r >= roi_min and sp > sp_min and ke(a["budget"]): dat.append(dong)
    elif r >= roi_min or sp > sp_min * 0.8: theo.append(dong)
    g2, t2 = gan.get(cid), truoc.get(cid)
    if g2 and t2 and g2["chi"] >= 1.5 and t2["chi"] >= 1.5 and (g2["chi"] + t2["chi"]) >= 3:
        rg, rt = roi(g2), roi(t2)
        if rt is not None and rg is not None and ((rt >= roi_min and rg < 0) or rt - rg >= 30):
            giam.append(f"#{a['ten'][:70]} · ROI 4 ngày trước {rt:+.0f}% → 3 ngày gần {rg:+.0f}% (chi ${g2['chi']:.2f})")
gio = vn.hour + vn.minute / 60
moc = min([21, 24, 32], key=lambda m: (m - gio) % 24)   # 21h · 24h · 8h (=32 ⇒ 8h sáng hôm sau)
trong = any(abs(((gio - m + 12) % 24) - 12) <= 1 for m in (21, 0, 8))
print(f"Giờ VN {vn:%H:%M %d/%m} · khung tăng ngân sách ~21h / ~24h / 8h: " + ("ĐANG TRONG KHUNG" if trong else f"mốc kế ~{int(moc) % 24}h") + " (ngân sách còn thấp $1–3 thì chưa cần canh giờ; không thu lại sau khung)")
print(f"ĐỦ ĐIỀU KIỆN TĂNG (ROI tháng ≥ {roi_min:g}% và spending hôm nay > {sp_min:g}%) — CHỜ ANH DUYỆT:"); print("\n".join("  " + x for x in dat) or "  (chưa có)")
print("CẦN XEM GIẢM / TẮT (ROI tụt — phim down trend hoặc creative bão hoà, CPC/CPA tăng) — CHỜ ANH QUYẾT:"); print("\n".join("  " + x for x in giam) or "  (không)")
print("GẦN ĐẠT (theo dõi tiếp):"); print("\n".join("  " + x for x in theo) or "  (không)")
EOF
