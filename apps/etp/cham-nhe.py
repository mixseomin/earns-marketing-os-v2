#!/usr/bin/env python3
"""BẢN XEM NHẸ CHO HÀNG CHẤM (anh 26/10/2026: "Lỗi thì phải có cách xử lý chứ mày cứ để mãi ở đấy?").
Creative chấm lỗi vì VIDEO (> 100 MB vượt giới hạn Cloudflare, hoặc Media binding không cắt được khung nào) → tải bản gốc, nén 720p H.264 (faststart)
bằng ffmpeg trên box3, PUT lên Worker etp-cham (/nhe/<id>, R2 nhe/<id>.mp4 — Worker dùng bản này thay bản gốc), rồi xếp lại hàng chờ.
dong-bo.py gọi mỗi lượt (10 phút), tối đa MOI_LUOT creative / lượt, mỗi creative tối đa 2 lần dựng. Dùng tay: cham-nhe.py [creative_id …]"""
import json, os, subprocess, sys, tempfile, urllib.request
WORKER = "https://etp-cham.eimagini-info.workers.dev"
MOI_LUOT = 1   # dong-bo.service có TimeoutStartSec=900 — một video / lượt
LOI_VIDEO = "(loi like '%vượt giới hạn 100 MB%' or loi ~ 'cắt được [0-9]+/[0-9]+ khung')"
def q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s], capture_output=True, text=True, timeout=60)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def mot(cr, video):
    with tempfile.TemporaryDirectory() as d:
        goc, ra = os.path.join(d, "goc.mp4"), os.path.join(d, "nhe.mp4")
        urllib.request.urlretrieve(video, goc)
        for crf in (28, 32, 36):   # tới khi < 95 MB
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", goc, "-vf", "scale=-2:'min(720,ih)'", "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
                            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", ra], check=True, timeout=480)
            if os.path.getsize(ra) < 95 * 1048576: break
        dai = os.path.getsize(ra)
        if dai >= 100 * 1048576: raise RuntimeError(f"nén vẫn {dai / 1048576:.0f} MB")
        with open(ra, "rb") as f:
            r = urllib.request.Request(f"{WORKER}/nhe/{cr}", data=f.read(), method="PUT",
                                       headers={"authorization": "Bearer " + os.environ["MOS2_EXT_KEY"], "content-type": "video/mp4", "user-agent": "etp-cham-nhe"})
            json.load(urllib.request.urlopen(r, timeout=300))
        return dai

def main(ids=None):
    dk = f"h.creative_id in ({','.join(str(int(x)) for x in ids)})" if ids else f"h.trang_thai = 'loi' and h.lan_nhe < 2 and {LOI_VIDEO}"
    ds = [l.split("|", 1) for l in q(f"""select h.creative_id, c.video from etp.cham_hang h join etp.creative c using (creative_id)
            where {dk} and c.video is not null order by h.xong limit {MOI_LUOT}""").splitlines() if "|" in l]
    for cr, video in ds:
        try:
            dai = mot(cr, video)
            q(f"""update etp.cham_hang set trang_thai = 'cho', bat_dau = null, loi = null, thu_lai_luc = null, lan_nhe = lan_nhe + 1, buoc = 'đã có bản xem nhẹ',
                  nhat_ky = nhat_ky || jsonb_build_array(jsonb_build_object('b', 'đã dựng bản xem nhẹ 720p {dai / 1048576:.0f} MB — chấm lại', 'luc', now())) where creative_id = {int(cr)}""")
            print(f"#{cr} bản nhẹ {dai / 1048576:.0f} MB → xếp lại")
        except Exception as e:
            q(f"""update etp.cham_hang set lan_nhe = lan_nhe + 1, nhat_ky = nhat_ky || jsonb_build_array(jsonb_build_object('b', 'dựng bản xem nhẹ lỗi: ' || $L${str(e)[:150]}$L$, 'luc', now()))
                  where creative_id = {int(cr)}""")
            print(f"#{cr} lỗi dựng bản nhẹ: {e}", file=sys.stderr)

if __name__ == "__main__": main([int(x) for x in sys.argv[1:] if x.isdigit()] or None)
