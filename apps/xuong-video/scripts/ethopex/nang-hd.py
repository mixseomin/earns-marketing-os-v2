#!/usr/bin/env python3
"""NÂNG HD BẰNG AI (Topaz Proteus trên fal, $0,01/giây — giá đọc API fal 21/10/2026) — CHỈ CHO PHIM THẮNG.
Anh 21/10/2026 (thử Step Back: Topaz nét hơn rõ ở tóc/da/phụ đề so với lanczos): "nâng HD làm theo đề xuất, dành cho camp thắng" →
phim còn test giữ lanczos 0đ của cat-canh.py; phim đã thắng (studio xv_khoa_ngoai['ethopex_phim_thang'].content, anh duyệt scale) mới tốn
~$0,6–0,9 / creative để nâng đoạn nguồn 720p lên 1080x1920 trước khi cắt. Phim chưa thắng → mã 2, không gọi fal.
TỐN TIỀN: chỉ chạy khi anh bảo, tiền tố DUYET_SINH_1_LAN=1.
Chạy trên box3 (FAL_KEY + DB studio):
  cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; \
    DUYET_SINH_1_LAN=1 python3 apps/xuong-video/scripts/ethopex/nang-hd.py <content_id> <url video 720p công khai> <tên ra.mp4>
→ in JSON {url, giay, usd}: url = bản 1080x1920 trên kho R2 (kho phat ethopex nguon) — đưa vào cat-canh.py làm nguồn."""
import json, os, subprocess, sys, time, urllib.request

GIA_GIAY = 0.01   # fal-ai/topaz/upscale/video, Proteus

def phim_thang(cid):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", "select gia_tri::text from xv_khoa_ngoai where ten='ethopex_phim_thang'"], capture_output=True, text=True).stdout.strip()
    return cid in (json.loads(r or '{"content":[]}').get("content") or [])

def main(cid, vao, ten):
    if not phim_thang(cid):
        print(f"HD CHAN: phim {cid} chưa thắng — nâng HD Topaz chỉ dành cho phim thắng (anh 21/10/2026); phim test dùng lanczos của cat-canh.py"); sys.exit(2)
    if os.environ.get("DUYET_SINH_1_LAN") != "1":
        print("HD CHAN: TỐN TIỀN (~$0,01/giây) — chỉ chạy với DUYET_SINH_1_LAN=1 sau khi anh bảo"); sys.exit(2)
    w, h, giay = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "csv=p=0:s=,", vao]).decode().replace("\n", ",").strip(",").split(",")[:3]
    he_so = round(1920 / int(h), 3)
    if he_so <= 1.01: print(f"HD CHAN: nguồn đã {w}x{h}, không cần nâng"); sys.exit(2)
    H = {"Authorization": "Key " + os.environ["FAL_KEY"], "content-type": "application/json"}
    b = json.dumps({"video_url": vao, "upscale_factor": he_so, "model": "Proteus", "H264_output": True}).encode()
    j = json.load(urllib.request.urlopen(urllib.request.Request("https://queue.fal.run/fal-ai/topaz/upscale/video", data=b, method="POST", headers=H), timeout=60))
    t0 = time.time()
    while time.time() - t0 < 1800:
        st = json.load(urllib.request.urlopen(urllib.request.Request(j["status_url"], headers=H), timeout=60))
        if st.get("status") == "COMPLETED": break
        time.sleep(15)
    else: print("HD CHAN: fal quá 30 phút chưa xong"); sys.exit(2)
    u = json.load(urllib.request.urlopen(urllib.request.Request(j["response_url"], headers=H), timeout=60))["video"]["url"]
    tam = subprocess.check_output(["kho", "tam", "ethopex"]).decode().strip(); ra = os.path.join(tam, ten)
    urllib.request.urlretrieve(u, ra)
    url = subprocess.check_output(["kho", "phat", ra, "ethopex", "nguon", ten]).decode().strip()
    print(json.dumps({"url": url, "giay": round(float(giay), 1), "usd": round(float(giay) * GIA_GIAY, 2), "he_so": he_so}))

if __name__ == "__main__":
    main(int(sys.argv[1]), sys.argv[2], sys.argv[3])
