#!/usr/bin/env python3
"""LƯỚI POSTER PHIM để chấm NHÓM GỐC phim bằng mắt (anh 29/10/2026: "phim của Ấn, Tàu, Âu… là những nhóm cụ thể phải tách … chấm điểm rồi đo xem").
Chạy trên box3: phim có chi trong N ngày (mặc định 14) chưa có nhóm gốc → tải poster (ethopex_content.anh, CDN dofez mở) → ghép lưới 8×5, mỗi ô ghi số thứ tự
→ /tmp/luoi-poster/luoi-<k>.jpg + ds.json (số thứ tự ↔ content_id). Người chấm xem lưới rồi ghi apps/etp/phan-tich/nhom-goc-phim.json, nạp bằng nhom-goc-nap.py.
NHÓM: au_my · trung · an · latin · dong_a (Hàn / Nhật / Đông Nam Á) · da_mau · hoat_hinh. hoat_hinh CHỈ khi nhìn ra là tranh vẽ / hoạt hình 2D-3D
(vd "Giving My Sacred Husband to My Sister"); phim làm bằng AI mà nhìn như người thật thì xếp theo ngoại hình diễn viên, KHÔNG vào hoat_hinh (anh 29/10/2026).
  cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; python3 apps/etp/phan-tich/luoi-poster.py [ngay=14] [--het]   (--het: cả phim đã có nhóm)"""
import io, json, os, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont
DB = os.environ["DATABASE_URL"]; RA = "/tmp/luoi-poster"; os.makedirs(RA, exist_ok=True)
q = lambda s, db=DB: subprocess.run(["psql", db, "-tAc", s], capture_output=True, text=True, check=True).stdout.strip()
ngay = next((int(x) for x in sys.argv[1:] if x.isdigit()), 14)
loc = "" if "--het" in sys.argv else "and p.nhom_goc is null"
ds = json.loads(q(f"""select coalesce(json_agg(x order by x.chi desc), '[]') from (select c.content_id, max(p.ten) ten, round(sum(s.chi)) chi from etp.so_ngay s join etp.camp c using (camp_id)
  join etp.phim p on p.content_id = c.content_id where s.ngay >= current_date - {ngay} and s.chi > 0 {loc} group by 1) x""") or "[]")
spy = subprocess.run(["bash", "-c", ". /root/.secrets/spy.env; echo $DATABASE_URL"], capture_output=True, text=True).stdout.strip()   # ethopex_content nằm ở kho spy
anh = dict(l.split("|", 1) for l in q(f"select id || '|' || coalesce(anh, '') from ethopex_content where id in ({','.join(str(x['content_id']) for x in ds) or 0})", spy).splitlines() if "|" in l)
W, H, CO, HANG = 180, 260, 8, 5
def tai(x):
    u = anh.get(str(x["content_id"])) or ""; u = u if u.startswith("http") else f"https://acdn.dofez.com/{u}"   # kho lưu đường tương đối (cùng cách viet-ke-chuyen.mts)
    try: return Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(u, headers={"user-agent": "Mozilla/5.0"}), timeout=20).read())).convert("RGB")
    except Exception: return None
with ThreadPoolExecutor(12) as ex: hinh = list(ex.map(tai, ds))
try: f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
except Exception: f = ImageFont.load_default()
n = CO * HANG
for k in range(0, len(ds), n):
    L = Image.new("RGB", (CO * W, HANG * H), (20, 20, 20)); d = ImageDraw.Draw(L)
    for j, (x, h) in enumerate(zip(ds[k:k + n], hinh[k:k + n])):
        ox, oy = (j % CO) * W, (j // CO) * H
        if h: h.thumbnail((W - 4, H - 4)); L.paste(h, (ox + 2, oy + 2))
        else: d.text((ox + 10, oy + 100), "không ảnh", fill=(200, 80, 80), font=f)
        d.rectangle([ox + 2, oy + 2, ox + 52, oy + 30], fill=(0, 0, 0)); d.text((ox + 6, oy + 4), str(k + j), fill=(255, 220, 0), font=f)
    L.save(f"{RA}/luoi-{k // n}.jpg", quality=82)
json.dump([{"so": i, **x} for i, x in enumerate(ds)], open(f"{RA}/ds.json", "w"), ensure_ascii=False, indent=0)
print(f"{len(ds)} phim · {sum(1 for h in hinh if h)} có poster · {(len(ds) + n - 1) // n} lưới ở {RA}")
