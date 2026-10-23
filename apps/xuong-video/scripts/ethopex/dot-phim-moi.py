#!/usr/bin/env python3
"""ĐỢT PHIM MỚI cho bộ tài khoản 2 (ETP_441 + Argo Love Tyrell — anh 23/10/2026: "chỉ dành cho các phim mới… nhịp đăng, giới hạn camp, ngân sách như tk đầu").
Danh sách = studio xv_khoa_ngoai['ethopex_200_phim'] (chon-phim-moi.py), theo hạng. Chạy trên iMac (cắt + cổng chữ dùng Vision):
  dot-phim-moi.py cat <từ hạng> <tới hạng> [song_song=2]   → tải tập miễn phí (tai-tap.py) → cắt 2 góc/phim (cat-cuoi-lo.py so_ban=2)
                                                              → tờ soát 18+ mỗi phim: ~/.cache/ethopex/ra/moi-<a>-<b>/soat-<id>.jpg (poster + 8 khung mỗi đoạn)
  (Claude xem tờ soát trong phiên → kiem-phim-18.py --soat <id> ok|cam trên box3)
  dot-phim-moi.py len <từ hạng> <tới hạng> [lich=today]   → len-creative.py (chỉ phim đã soát ok) → nhan-ban.py --bo 2 --creative … (khuôn EN/ES)"""
import json, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; N = os.path.expanduser("~/.cache/ethopex/nguon")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
KHUON = {"en": 65110, "es": 65734}   # camp mẫu cùng tiếng (cấu hình Ad Set, pixel, nước); nhan-ban --bo 2 đổi tài khoản + Page
sh = lambda c, **k: subprocess.run(c, shell=True, capture_output=True, text=True, **k)

def ds(a, b):
    r = sh(f"""ssh {B} '{ENV}; psql "$DATABASE_URL" -tAc "select gia_tri::text from xv_khoa_ngoai where ten=\\$\\$ethopex_200_phim\\$\\$"'""")
    return json.loads(r.stdout.strip() or "[]")[a - 1:b]

def cat(a, b, n=2):
    ra = os.path.expanduser(f"~/.cache/ethopex/ra/moi-{a}-{b}"); os.makedirs(ra, exist_ok=True); phim = ds(a, b)
    for p in phim:
        tm = os.path.join(N, str(p["id"]))
        if not (os.path.isdir(tm) and any(f.startswith("tap") for f in os.listdir(tm))):
            os.makedirs(tm, exist_ok=True); r = sh(f"python3 {D}/tai-tap.py '{p['url']}' {tm} 8", timeout=900)
            print("tải", p["id"], p["ten"][:40], (r.stdout.strip().splitlines() or [r.stderr.strip()[-120:]])[-1][:120], flush=True)
    tsv = os.path.join(ra, "lo.tsv")
    with open(tsv, "w") as f:
        for p in phim:
            tm = os.path.join(N, str(p["id"]))
            if any(x.startswith("tap") for x in os.listdir(tm)): f.write(f"{p['id']}\t{p['locale']}\t{p['nguon']}\t{p['ten']}\t{p['url']}\n")
    r = subprocess.run(["taskpolicy", "-b", "python3", f"{D}/cat-cuoi-lo.py", N, tsv, ra, str(n), "2"], capture_output=True, text=True, timeout=6 * 3600)
    print(r.stdout[-3000:], flush=True)
    to_soat(ra)

def to_soat(ra):
    """tờ soát 18+ mỗi phim từ <ra>/lo.json: poster + 8 khung mỗi đoạn → <ra>/soat-<id>.jpg (chạy được cả iMac lẫn box3)"""
    lo = json.load(open(os.path.join(ra, "lo.json")))
    theo = {}
    for x in lo:
        if x.get("file") and not x.get("loi"): theo.setdefault(x["content_id"], []).append(x["file"])
    for cid, fs in theo.items():   # tờ soát 18+: poster + 8 khung mỗi đoạn
        pst = os.path.join(N, str(cid), "poster.jpg"); vao, loc = [], []
        if os.path.exists(pst): vao += ["-i", pst]; loc.append(f"[{len(loc)}]scale=-2:384[v{len(loc)}]")
        for f in fs:
            d = float(sh(f"ffprobe -v error -show_entries format=duration -of csv=p=0 '{f}'").stdout.strip() or 60)
            o = f[:-4] + "-soat.jpg"; sh(f"ffmpeg -v error -y -i '{f}' -vf 'fps=8/{d},scale=216:384,tile=8x1' -frames:v 1 '{o}'")
            vao += ["-i", o]; loc.append(f"[{len(loc)}]scale=-2:384[v{len(loc)}]")
        g = ";".join(loc) + ";" + "".join(f"[v{i}]" for i in range(len(loc))) + f"hstack=inputs={len(loc)}"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *vao, "-filter_complex", g, os.path.join(ra, f"soat-{cid}.jpg")])
    print("CẮT XONG:", sum(len(v) for v in theo.values()), "đoạn ·", len(theo), "phim · tờ soát ở", ra)

def cat_box(a, b, n=2):
    """CẮT TRÊN BOX3 (anh 23/10/2026 "setup box3"): box3 tải tập + ghép + trích khung (nguon-box.py) → iMac đọc chữ bằng Vision (doc-khung.py)
    → box3 chọn khung + dựng đoạn (cat-cuoi-lo.py, nice) + tờ soát → iMac kéo tờ soát + lo.json về (đường tệp đánh dấu "box3:")."""
    ten = f"moi-{a}-{b}"; ra = os.path.expanduser(f"~/.cache/ethopex/ra/{ten}"); os.makedirs(ra, exist_ok=True); phim = ds(a, b)
    rb = f"/root/.cache/ethopex/ra/{ten}"; tsv = os.path.join(ra, "lo.tsv")
    with open(tsv, "w") as f:
        for p in phim: f.write(f"{p['id']}\t{p['locale']}\t{p['nguon']}\t{p['ten']}\t{p['url']}\n")
    sh(f"ssh {B} 'mkdir -p {rb}'"); subprocess.run(["scp", "-q", tsv, f"{B}:{rb}/lo.tsv"], check=True)
    T = "cd /opt/earns-marketing-os-v2/apps/xuong-video/scripts/ethopex && nice -n 10"
    r = sh(f"ssh {B} '{T} python3 nguon-box.py {rb}/lo.tsv {n} 3'", timeout=6 * 3600)
    nguon = [json.loads(l) for l in r.stdout.splitlines() if l.startswith("{")]
    for x in nguon: print("nguồn", x["id"], x.get("ten", "")[:40], x.get("loi") or f"{x['n']} khung", flush=True)
    co = [str(x["id"]) for x in nguon if not x.get("loi")]
    if not co: return print("không phim nào có nguồn")
    print(subprocess.run(["python3", f"{D}/doc-khung.py", *co], capture_output=True, text=True, timeout=3 * 3600).stdout[-1500:], flush=True)
    with open(tsv + ".co", "w") as f:
        for p in phim:
            if str(p["id"]) in co: f.write(f"{p['id']}\t{p['locale']}\t{p['nguon']}\t{p['ten']}\t{p['url']}\n")
    subprocess.run(["scp", "-q", tsv + ".co", f"{B}:{rb}/lo-co.tsv"], check=True)
    r = sh(f"ssh {B} '{T} python3 cat-cuoi-lo.py /root/.cache/ethopex/nguon {rb}/lo-co.tsv {rb} 2 {n} && {T} python3 dot-phim-moi.py to-soat {rb}'", timeout=8 * 3600)
    print(r.stdout[-2000:], r.stderr[-500:], flush=True)
    subprocess.run(["rsync", "-a", "--include=soat-*.jpg", "--include=lo.json", "--exclude=*", f"{B}:{rb}/", ra + "/"], check=True)
    lo = json.load(open(os.path.join(ra, "lo.json")))
    for x in lo:
        if x.get("file"): x["file"] = "box3:" + x["file"]
    json.dump(lo, open(os.path.join(ra, "lo.json"), "w"), ensure_ascii=False, indent=1)
    print("CẮT XONG (box3):", sum(1 for x in lo if x.get("file") and not x.get("loi")), "đoạn · tờ soát ở", ra)

def len_(a, b, lich="today"):
    ra = os.path.expanduser(f"~/.cache/ethopex/ra/moi-{a}-{b}"); lo = json.load(open(os.path.join(ra, "lo.json")))
    ok = sh(f"""ssh {B} '{ENV}; psql "$DATABASE_URL" -tAc "select gia_tri::text from xv_khoa_ngoai where ten=\\$\\$ethopex_soat_18\\$\\$"'""").stdout.strip()
    ok = {k for k, v in (json.loads(ok) if ok else {}).items() if v.get("ok")}
    di = [dict(x, lo="2310m") for x in lo if x.get("file") and not x.get("loi") and str(x["content_id"]) in ok]
    if not di: return print("chưa có phim nào soát ok")
    lf = os.path.join(ra, "lo-len.json"); json.dump(di, open(lf, "w"), ensure_ascii=False, indent=1)
    r = subprocess.run(["taskpolicy", "-b", "python3", f"{D}/len-creative.py", lf, f"moi{a}", "canh cuoi"], capture_output=True, text=True, timeout=6 * 3600)
    print(r.stdout[-1500:], flush=True)
    for x in json.load(open(os.path.expanduser(f"~/.cache/ethopex/ra/moi{a}/len.json"))):
        if not x.get("ok"): print("✗", x["content_id"], (x.get("loi") or "")[:100]); continue
        ten = x["ten"].replace("'", "")
        r = sh(f"""ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {KHUON[x["lang"]]} --bo 2 --creative {x["creative_id"]} --content {x["content_id"]} --ten "{ten}" --that --lich {lich} --luat "đợt phim mới bộ 2 (ETP_441 + Argo Love Tyrell) — 200 phim mới hạng {a}–{b}" --ai "anh (chat 23/10/2026: lên tiếp luôn trong hôm nay các phim mới)"'""", timeout=600)
        print(x["content_id"], (r.stdout.strip().splitlines() or ["?"])[-1][:200], flush=True)

def len_tu_tep(lf, ma, a=1, b=30, lich="today"):
    """lên thẳng từ một tệp lô đã lọc (đoạn đã soát 18+ ok) — dùng khi không chờ cả đợt cắt xong (anh 23/10/2026 "sao không thấy phim nào bộ 2")"""
    lj = os.path.expanduser(f"~/.cache/ethopex/ra/{ma}/len.json")
    if not os.path.exists(lj):   # đã có len.json (lô lên creative xong, gãy ở bước camp) → không đẩy lại creative
        r = subprocess.run(["taskpolicy", "-b", "python3", f"{D}/len-creative.py", lf, ma, "canh cuoi"], capture_output=True, text=True, timeout=6 * 3600)
        print(r.stdout[-1500:], r.stderr[-800:], flush=True)
    for x in json.load(open(lj)):
        if not x.get("ok"): print("✗", x["content_id"], (x.get("loi") or "")[:100]); continue
        ten = x["ten"].replace("'", "").replace('"', "")
        r = sh(f"""ssh {B} '{ENV}; cd apps/xuong-video/scripts/ethopex && python3 nhan-ban.py {KHUON[x["lang"]]} --bo 2 --creative {x["creative_id"]} --content {x["content_id"]} --ten "{ten}" --that --lich {lich} --luat "đợt phim mới bộ 2 (ETP_441 + Argo Love Tyrell) — 200 phim mới hạng {a}–{b}" --ai "anh (chat 23/10/2026: bộ tk 2 cứ lên camp và bật luôn)"'""", timeout=600)
        print(x["content_id"], (r.stdout.strip().splitlines() or ["?"])[-1][:200], flush=True)

def sua_cta():
    """cuối mỗi đợt lên camp: dựng sẵn bản sửa CTA cho camp thắng sắp nhân bản (sua-cta.py; anh 23/10/2026 "camp mới chuẩn bị lên thì phải chủ động mà sửa CTA lỗi")"""
    r = subprocess.run(["taskpolicy", "-b", "python3", f"{D}/sua-cta.py"], capture_output=True, text=True, timeout=8 * 3600)
    print("sửa CTA:", r.stdout[-1500:], flush=True)

if __name__ == "__main__":
    v = sys.argv[1:]
    if v[0] == "cat": cat_box(int(v[1]), int(v[2]), int(v[3]) if len(v) > 3 else 2)   # cắt trên box3 (23/10/2026); "cat-mac" = cắt trên iMac như cũ
    elif v[0] == "cat-mac": cat(int(v[1]), int(v[2]), int(v[3]) if len(v) > 3 else 2)
    elif v[0] == "to-soat": to_soat(v[1])
    elif v[0] == "tep": len_tu_tep(v[1], v[2]); sua_cta()
    else: len_(int(v[1]), int(v[2]), v[3] if len(v) > 3 else "today"); sua_cta()
