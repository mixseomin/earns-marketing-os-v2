#!/usr/bin/env python3
"""ĐƯA BẢN TRONG THƯ VIỆN LÊN THÀNH CREATIVE ETHOPEX (anh 29/10/2026 — vòng phản hồi của máy sinh kể chuyện). Chạy trên iMac (len-creative cần Vision macOS).
Bản kể chuyện VideoExpress nằm ở etp.thu_vien (sẵn sàng, đã có người xem qua ở tab Thư viện) → len-creative.py (kho + chữ QC + bulk-jobs + studio + cổng chữ)
→ ghi creative_id + trạng thái da_len vào etp.thu_vien. Từ đó tab Thư viện hiện số chạy thật của bản đó, hàng đợi máy sinh (hang-ke-chuyen.mts) tính thắng / thua
của kể chuyện theo phim. KHÔNG lên camp — lên camp (nhan-ban.py --creative) vẫn chờ lệnh anh.
Dùng: python3 thu-vien-len.py <id thư viện…>      (id = số sau "tv" trong link ?tvx=tv<id>)"""
import json, os, subprocess, sys, time
D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex")
PSQL = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql \"$DATABASE_URL\" -tAq"

def sql(q):
    return subprocess.run(["ssh", B, PSQL], input=q, capture_output=True, text=True, check=True).stdout.strip()

ids = [int(x) for x in sys.argv[1:] if x.isdigit()]
if not ids: sys.exit(__doc__)
rows = json.loads(sql(f"select coalesce(json_agg(row_to_json(v)), '[]') from (select id, content_id, lang, ten, video, giay, creative_id, trang_thai from etp.thu_vien where id in ({','.join(map(str, ids))})) v") or "[]")
lo, tm = [], os.path.join(C, "thu-vien"); os.makedirs(tm, exist_ok=True)
for r in rows:
    if r["creative_id"]: print(f"tv{r['id']}: đã là creative #{r['creative_id']} — bỏ qua"); continue
    if r["trang_thai"] != "san_sang" or not r["video"]: print(f"tv{r['id']}: trạng thái {r['trang_thai']} — chỉ đưa bản sẵn sàng"); continue
    f = os.path.join(tm, f"tv{r['id']}.mp4")
    subprocess.run(["curl", "-sSfL", "-o", f, r["video"]], check=True)
    lo.append({"tv": r["id"], "content_id": r["content_id"], "lang": r["lang"] or "en", "ten": r["ten"], "tu": 0, "den": round(float(r["giay"] or 0), 1), "file": f, "lo": "tv"})
if not lo: sys.exit("không có bản nào để đưa lên")
ma = "tv" + time.strftime("%d%m%H%M")
lf = os.path.join(tm, f"lo-{ma}.json"); json.dump(lo, open(lf, "w"), ensure_ascii=False, indent=1)
# --da-soat: người đã xem video ở tab Thư viện trước khi chọn đưa lên (đúng nghĩa cờ của len-creative — soát từng đoạn trước khi gọi)
r_ = subprocess.run(["python3", os.path.join(D, "len-creative.py"), lf, ma, "kể chuyện", "--da-soat"], env={**os.environ, "ETP_KHONG_CAT": "1"})
# đọc len.json kể cả khi len-creative trả mã lỗi ở bước phụ sau cùng (tờ review…): creative đã tạo thì phải ghi vào thư viện, không để nhịp sau tạo trùng
if not os.path.exists(os.path.join(C, "ra", ma, "len.json")): sys.exit(f"len-creative không ra len.json (mã {r_.returncode})")
kq = json.load(open(os.path.join(C, "ra", ma, "len.json")))
# khớp theo PHIM (29/10/2026: len.json KHÔNG có trường den → khớp theo độ dài luôn trượt, tạo được creative mà báo "không tạo được" → nhịp sau tạo trùng);
# mỗi phim một bản trong lô thì chỉ cần phim; nhiều bản cùng phim thì lấy lần lượt theo thứ tự, không dùng lại một dòng kết quả hai lần
da = set()
for x in lo:
    l = next((k for i, k in enumerate(kq) if i not in da and str(k.get("content_id")) == str(x["content_id"])), {})
    if l: da.add(kq.index(l))
    cr = l.get("creative_id")
    if cr and l.get("ok", True) and not l.get("loi"):
        sql(f"update etp.thu_vien set creative_id = {int(cr)}, trang_thai = 'da_len', cap_nhat = now() where id = {x['tv']}")
        print(f"✓ tv{x['tv']} → creative #{cr} (chấm Sạch thì nhịp ethopex tự lên camp KT $1 — anh 29/10/2026)")
    else: print(f"✗ tv{x['tv']}: {l.get('loi') or 'không tạo được creative'}")
