#!/usr/bin/env python3
"""TRẦN CHI BAN NGÀY THEO PHIM (anh 25/10/2026: "tốc độ tăng lãi ban ngày chậm dần khi tăng chi ban ngày → có ngưỡng giới hạn chi ban ngày để đạt
mức lãi tối đa trên từng film → tính được mức tăng tối đa cho từng film"). CHỈ ĐỌC + IN — chưa gắn vào luật nào.

Mô hình lợi suất giảm dần: doanh thu một khung giờ trong ngày R = k · S^α (S = chi khung đó, 0 < α < 1).
  · α (độ cong) ước CHUNG cho mọi phim bằng hồi quy log–log có hiệu ứng cố định theo phim (mỗi phim so với chính nó qua các ngày) — một phim
    chỉ có ≤ 7 ngày số, ước riêng thì nhiễu.
  · k riêng từng phim = trung bình hình học R / S^α trên các ngày của phim đó.
  · Lãi = k·S^α − S cực đại khi lãi biên = 0 → S* = (α·k)^(1/(1−α)). Chi > S* thì mỗi $ thêm lỗ.
Khung: ngày = 07h–19h giờ VN, đêm = 20h–06h (etp.so_gio lưu giờ UTC). Chỉ lấy phim-ngày chi khung đó ≥ CHI_MIN.
Chạy (box3, đã nạp .env.production):  python3 tran-chi-phim.py [ngay|dem] [--json]"""
import json, math, os, subprocess, sys
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()
KHUNG = (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "ngay")
DIEU = "(gio + 7) % 24 between 7 and 19" if KHUNG == "ngay" else "not (gio + 7) % 24 between 7 and 19"
CHI_MIN, NGAY_MIN, ALPHA_PHANG = 3.0, 2, 0.93   # α ≥ ALPHA_PHANG: doanh thu gần như tăng thẳng theo chi — dữ liệu chưa chạm bão hoà, không có trần
# khung đêm của ngày UTC hiện tại chưa trọn (đêm 20h–06h VN nằm trong cùng một ngày UTC) → bỏ; khung ngày của hôm nay trọn sau 20h VN
BO_NAY = "and s.ngay < (now() at time zone 'utc')::date" if KHUNG == "dem" else "and (s.ngay < (now() at time zone 'utc')::date or extract(hour from now() at time zone 'utc') >= 13)"

rows = [l.split("|") for l in q(f"""select s.content_id, coalesce(p.ten, ''), s.ngay, sum(s.chi), sum(s.thu) from etp.so_gio s left join etp.phim p using (content_id)
    where {DIEU} {BO_NAY} group by 1, 2, 3 having sum(s.chi) >= {CHI_MIN} and sum(s.thu) > 0""").splitlines() if l.count("|") == 4]
phim = {}
for cid, ten, ngay, chi, thu in rows: phim.setdefault(int(cid), {"ten": ten, "d": []})["d"].append((ngay, float(chi), float(thu)))
phim = {c: v for c, v in phim.items() if len(v["d"]) >= NGAY_MIN}

# α chung: hồi quy log R theo log S sau khi trừ trung bình từng phim (hiệu ứng cố định)
sxx = sxy = 0.0
for v in phim.values():
    xs = [math.log(c) for _, c, _ in v["d"]]; ys = [math.log(t) for _, _, t in v["d"]]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxx += sum((x - mx) ** 2 for x in xs); sxy += sum((x - mx) * (y - my) for x, y in zip(xs, ys))
alpha = sxy / sxx if sxx else 1.0
alpha_dung = min(max(alpha, 0.2), 0.95)   # chặn hai đầu: α ≥ 1 nghĩa là không có trần (dữ liệu chưa đủ cong)

ra = []
for cid, v in phim.items():
    k = math.exp(sum(math.log(t) - alpha_dung * math.log(c) for _, c, t in v["d"]) / len(v["d"]))
    s_opt = (alpha_dung * k) ** (1 / (1 - alpha_dung)) if alpha < ALPHA_PHANG else float("inf")
    lai_opt = k * s_opt ** alpha_dung - s_opt if s_opt != float("inf") else float("inf")
    ng, c, t = max(v["d"])   # ngày gần nhất
    ra.append({"content_id": cid, "ten": v["ten"][:44], "so_ngay": len(v["d"]), "chi_gan": round(c, 1), "lai_gan": round(t - c, 1), "ngay_gan": ng,
               "tran": round(s_opt, 1) if s_opt != float("inf") else None, "lai_tran": round(lai_opt, 1) if lai_opt != float("inf") else None,
               "vuot": round(c - s_opt, 1) if s_opt != float("inf") else None})
ra.sort(key=lambda x: -(x["vuot"] if x["vuot"] is not None else -1e9))
if "--json" in sys.argv:
    print(json.dumps({"khung": KHUNG, "alpha": round(alpha, 3), "alpha_dung": alpha_dung, "phim": ra}, ensure_ascii=False)); sys.exit(0)
print(f"Khung {KHUNG} · {len(phim)} phim đủ ≥ {NGAY_MIN} ngày chi ≥ ${CHI_MIN:g} · α = {alpha:.3f} (dùng {alpha_dung:.3f}) — chi gấp đôi thì doanh thu ×{2 ** alpha_dung:.2f}")
print(f"{'phim':<46}{'ngày':>5}{'chi gần':>9}{'lãi gần':>9}{'trần':>8}{'lãi ở trần':>11}{'vượt':>8}")
if alpha >= ALPHA_PHANG: print(f"α ≥ {ALPHA_PHANG}: khung {KHUNG} CHƯA THẤY BÃO HOÀ — chi thêm vẫn ra doanh thu gần tỷ lệ, chưa tính được trần (cần ngày chi lớn hơn)")
f = lambda v, w: f"{v:>{w}}" if v is not None else f"{'—':>{w}}"
for x in ra: print(f"{x['ten']:<46}{x['so_ngay']:>5}{x['chi_gan']:>9}{x['lai_gan']:>9}{f(x['tran'], 8)}{f(x['lai_tran'], 11)}{f(x['vuot'], 8)}")
if alpha < ALPHA_PHANG:
    print(f"Tổng chi vượt trần ở ngày gần nhất: ${sum(max(x['vuot'], 0) for x in ra):.0f} · lãi dự kiến các phim nếu chi đúng trần: ${sum(x['lai_tran'] for x in ra):.0f}")
