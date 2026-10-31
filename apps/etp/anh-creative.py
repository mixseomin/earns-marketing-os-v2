#!/usr/bin/env python3
"""ẢNH CREATIVE KHÔNG BAO GIỜ THIẾU (anh 31/10/2026: "ko bao giờ đc để thiếu hình creative").
Mọi creative có camp (etp.camp nhà + etp.camp_ngoai đội) mà etp.creative.anh trống và chưa có etp.anh_cr → điền etp.anh_cr (ảnh + video —
anh 31/10/2026 "creative thì phải xem đc chi tiết": creative đội không ở etp.creative nên video cũng lưu ở đây cho thẻ chi tiết):
  1. đã chấm → khung thứ 3 của bản chấm (Worker etp-cham /khung/<id>/3.jpg — sẵn, không tốn gì)
  2. chưa chấm → video (etp.creative.video, không có thì GET Ethopex /api/v1/creatives/<id>) → ffmpeg cắt một khung giây 2, rộng 360
     → PUT Worker /anh/<id>.jpg (R2, khoá MOS2_EXT_KEY) → anh = <Worker>/anh/<id>.jpg
Lỗi ghi loi + lan_loi, thử lại tối đa 3 lần. Trang etp đọc coalesce(etp.creative.anh, etp.anh_cr.anh) (etp-doc.ts).
Dùng (box3): python3 anh-creative.py [--so 60]    — dong-bo.py gọi mỗi lượt 10 phút; chạy tay --so 2000 để vét tồn."""
import concurrent.futures as cf, json, os, subprocess, sys, tempfile, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ethopex_api as EA
WORKER = "https://etp-cham.eimagini-info.workers.dev"
SO = int(sys.argv[sys.argv.index("--so") + 1]) if "--so" in sys.argv else 60
s_ = lambda t: str(t or "").replace("'", "''")

def thieu():
    return [l.split("|") for l in EA._q(f"""with ids as (select creative_id from etp.camp where creative_id > 0 union select creative_id from etp.camp_ngoai where creative_id > 0)
        select i.creative_id, coalesce(r.video, ''), coalesce((select k from (select coalesce(c.lop->'anh'->'khung_url'->>2, replace(c.lop->'anh'->>'khung_mau', '{{n}}', '3')) k
                                                                from etp.cham c where c.creative_id = i.creative_id) x), '')
        from ids i left join etp.creative r using (creative_id) left join etp.anh_cr a using (creative_id)
        where ((coalesce(r.anh, '') = '' and coalesce(a.anh, '') = '') or (r.creative_id is null and coalesce(a.video, '') = '')) and coalesce(a.lan_loi, 0) < 3
        order by i.creative_id desc limit {SO}""").splitlines() if l]

def mot(cr, video, khung):
    if not video:
        v = json.loads(EA._goi(f"/api/v1/creatives/{cr}").get("video_url") or "[]"); video = v[0] if isinstance(v, list) and v else ""
    if not video: raise RuntimeError("Ethopex không có video")
    if khung: return khung, "cham", video
    with tempfile.TemporaryDirectory(dir="/var/tmp") as d:
        ra = os.path.join(d, "a.jpg")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "2", "-i", video, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", ra], check=True, timeout=90)
        with open(ra, "rb") as f:
            r = urllib.request.Request(f"{WORKER}/anh/{cr}.jpg", data=f.read(), method="PUT",
                                       headers={"authorization": "Bearer " + os.environ["MOS2_EXT_KEY"], "content-type": "image/jpeg", "user-agent": "etp-anh"})
            json.load(urllib.request.urlopen(r, timeout=60))
    return f"{WORKER}/anh/{cr}.jpg?v={int(time.time())}", "video", video

def chay(x):
    cr, video, khung = int(x[0]), x[1], x[2]
    try:
        anh, nguon, vid = mot(cr, video, khung)
        EA._q(f"insert into etp.anh_cr (creative_id, anh, nguon, video) values ({cr}, '{s_(anh)}', '{nguon}', '{s_(vid)}') on conflict (creative_id) do update set anh = excluded.anh, nguon = excluded.nguon, video = excluded.video, loi = null, luc = now()")
        return nguon
    except Exception as e:
        EA._q(f"insert into etp.anh_cr (creative_id, loi, lan_loi) values ({cr}, '{s_(str(e)[:300])}', 1) on conflict (creative_id) do update set loi = excluded.loi, lan_loi = etp.anh_cr.lan_loi + 1, luc = now()")
        return "loi"

if __name__ == "__main__":
    ds = thieu()
    with cf.ThreadPoolExecutor(6) as ex: kq = list(ex.map(chay, ds))
    print(json.dumps({"thieu": len(ds), "cham": kq.count("cham"), "video": kq.count("video"), "loi": kq.count("loi")}))
