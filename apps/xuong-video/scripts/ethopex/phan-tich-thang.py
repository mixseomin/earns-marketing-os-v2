#!/usr/bin/env python3
"""TÌM ĐIỂM CHUNG PHIM THẮNG theo dạng QC (anh 21/10/2026). Chạy trên box3 sau khi đã kéo:
  /root/etp-kc/r-all.json (API Report từ đầu tháng) · /root/etp-kc/sx.tsv (studio: camp → content, thể loại, ngôn ngữ, đoạn cắt) · /root/etp-kc/nguon.tsv (spy: content → app).
In: phim xếp theo ROI (kèm góc truyện + ROI từng dạng), rồi gộp theo app gốc · ngôn ngữ · dạng · đoạn cắt (đầu phim / giữa phim)."""
import collections, csv, json, re

rows = json.load(open("/root/etp-kc/r-all.json"))["rows"]
camp = collections.defaultdict(lambda: [0.0, 0.0, ""])
for x in rows:
    a = camp[x["campaign_id"]]; a[0] += x.get("cost") or 0; a[1] += x.get("revenue") or 0; a[2] = x["campaign_name"]
src = {r[0]: r[1] for r in csv.reader(open("/root/etp-kc/nguon.tsv"), delimiter="\t") if len(r) >= 3}
info = {}
for r in csv.reader(open("/root/etp-kc/sx.tsv"), delimiter="\t"):
    if len(r) < 9: continue
    for c in [r[0]] + (json.loads(r[1]) if r[1] else []):
        if c and str(c) != "null": info[int(c)] = dict(content=r[2], loai=r[3], nn=r[4], tu=float(r[5] or 0), den=float(r[6] or 0), lo=r[7], phim=r[8])
GOC = {  # góc truyện (đặt tay theo cốt truyện / QC spy)
    "Number One, Nobody": "thân phận bí ẩn · nam · thể thao", "Votos destrozados": "trả thù phản bội · nữ", "My 100x Cashback Life": "hệ thống làm giàu · nam",
    "Athena’s Chosen Queen": "thân phận bí ẩn · nữ · thần thoại", "The Rejected Luna Claimed by the Alpha King": "người sói · nữ", "Phantom Returns": "thân phận bí ẩn · nam",
    "My Cheating Wife's Downfall": "trả thù ngoại tình · nam", "The Triplets' Final Regret": "mẹ đơn thân · gia đình hối hận", "SIMP NO MORE": "hệ thống · nam",
    "Dear Brother, Your Regret Came Too Late": "gia đình hối hận · nữ", "Runaway Single Mom and Her Billionaire Hubby": "mẹ đơn thân · tổng tài",
    "The Weakest Null Commands the Devil King!": "phế vật thành thần · nam", "They Called Her Fool, She Saved Their Fortune": "thân phận bí ẩn · nữ",
    "Reborn To Win What They Stole": "trọng sinh trả thù", "Married My Ex-Fiancé’s Mafia Daddy": "mafia · nữ"}

def dang(n, l):
    if "ke chuyen" in n or l == "qc_ke_chuyen": return "kể chuyện"
    return "phim dài 2–3'" if "phim dai" in n else "cảnh thật"

R = lambda a: (a[1] - a[0]) / a[0] * 100 if a[0] else 0
film = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0, 0]))
gop = {k: collections.defaultdict(lambda: [0.0, 0.0, 0]) for k in ("dạng", "app gốc", "ngôn ngữ", "đoạn cắt (cảnh thật)", "góc")}
for cid, (c, v, n) in camp.items():
    if c <= 0: continue
    i = info.get(cid, {}); d = dang(n, i.get("loai")); f = i.get("phim") or re.sub(r"^\d+: \S+ ", "", n)[:30]
    keys = {"dạng": d, "app gốc": src.get(i.get("content", ""), "?"), "ngôn ngữ": i.get("nn") or "?", "góc": GOC.get(f, "?")}
    if d == "cảnh thật": keys["đoạn cắt (cảnh thật)"] = "đầu phim (bắt đầu < 120s)" if i.get("tu", 0) < 120 else "giữa phim"
    for k, val in keys.items(): a = gop[k][val]; a[0] += c; a[1] += v; a[2] += 1
    a = film[f][d]; a[0] += c; a[1] += v; a[2] += 1
print("== PHIM (đã chi ≥ $1), xếp theo ROI")
for f, dd in sorted(film.items(), key=lambda kv: -R([sum(x[0] for x in kv[1].values()), sum(x[1] for x in kv[1].values())])):
    c = sum(x[0] for x in dd.values()); v = sum(x[1] for x in dd.values())
    if c < 1: continue
    print(f"{R([c, v]):+5.0f}% · chi ${c:5.2f} · {f[:34]:34} · {GOC.get(f, '?'):32} · " + "  ".join(f"{k} {R(a):+.0f}% (${a[0]:.1f}, {a[2]} camp)" for k, a in dd.items()))
for k, b in gop.items():
    print(f"== {k.upper()}")
    for val, a in sorted(b.items(), key=lambda kv: -R(kv[1])): print(f"  {val}: ROI {R(a):+.0f}% · chi ${a[0]:.2f} · {a[2]} camp")
