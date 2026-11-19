#!/usr/bin/env python3
"""BẢN XEM NHẸ CHO HÀNG CHẤM (anh 26/10/2026: "Lỗi thì phải có cách xử lý chứ mày cứ để mãi ở đấy?").
Creative chấm lỗi vì VIDEO (> 100 MB vượt giới hạn Cloudflare, hoặc Media binding không cắt được khung nào) → tải bản gốc, nén 720p H.264 (faststart)
bằng ffmpeg trên box3, PUT lên Worker etp-cham (/nhe/<id>, R2 nhe/<id>.mp4 — Worker dùng bản này thay bản gốc), rồi xếp lại hàng chờ.
dong-bo.py gọi mỗi lượt (10 phút), tối đa MOI_LUOT creative / lượt, mỗi creative tối đa 2 lần dựng. Dùng tay: cham-nhe.py [creative_id …]"""
import json, os, subprocess, sys, tempfile, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../xuong-video/scripts/ethopex")); import nen_video as NV   # bộ nén theo máy (Mac = VideoToolbox)
WORKER = "https://etp-cham.eimagini-info.workers.dev"
MOI_LUOT = 1   # dong-bo.service có TimeoutStartSec=900 — một video / lượt
LOI_VIDEO = "(loi like '%vượt giới hạn 100 MB%' or loi ~ 'cắt được [0-9]+/[0-9]+ khung')"
def q(s):
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-c", s], capture_output=True, text=True, timeout=60)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def mot(cr, video):
    with tempfile.TemporaryDirectory(dir="/var/tmp") as d:   # /tmp trên box3 là tmpfs 512 MB — video dài không vừa (#52487 26/10/2026)
        goc, ra = os.path.join(d, "goc.mp4"), os.path.join(d, "nhe.mp4")
        urllib.request.urlretrieve(video, goc)
        for crf in (28, 32, 36):   # tới khi < 95 MB
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", goc, "-vf", "scale=-2:'min(720,ih)'", *NV.nen_h264(crf=crf, preset="veryfast"),
                            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", ra], check=True, timeout=480)
            if os.path.getsize(ra) < 95 * 1048576: break
        dai = os.path.getsize(ra)
        if dai >= 100 * 1048576: raise RuntimeError(f"nén vẫn {dai / 1048576:.0f} MB")
        with open(ra, "rb") as f:
            r = urllib.request.Request(f"{WORKER}/nhe/{cr}", data=f.read(), method="PUT",
                                       headers={"authorization": "Bearer " + os.environ["MOS2_EXT_KEY"], "content-type": "video/mp4", "user-agent": "etp-cham-nhe"})
            json.load(urllib.request.urlopen(r, timeout=300))
        return dai

# PHIM CẤM (etp:phim-cam-cho-3-2011, anh 20/11/2026 "fix triệt để các phim cấm là ko đc bật"): creative của phim trong sổ ethopex_phim_cam không dựng bản nhẹ / không xếp lại
# hàng chấm — hỏi đúng MỘT bộ đọc cong.phim_cam (lỗi đọc → cong trả lý do chặn → bỏ creative đó). Lấy dư 20× rồi lọc để phim cấm không giữ chỗ MOI_LUOT mãi.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import cong as CG
def loc_cam(ds, doc=None):
    """[(creative_id, content_id, …)] → các dòng KHÔNG thuộc phim cấm (in dòng bỏ ra stderr)"""
    giu = []
    for d in ds:
        ly = (doc or CG.phim_cam)(cts=[d[1]]) if str(d[1]).isdigit() and int(d[1]) > 0 else None
        if ly: print(f"#{d[0]} bỏ qua: {ly[:120]}", file=sys.stderr)
        else: giu.append(d)
    return giu

def main(ids=None):
    dk = f"h.creative_id in ({','.join(str(int(x)) for x in ids)})" if ids else f"h.trang_thai = 'loi' and h.lan_nhe < 2 and {LOI_VIDEO}"
    ds = [l.split("|", 2) for l in q(f"""select h.creative_id, coalesce(c.content_id, 0), c.video from etp.cham_hang h join etp.creative c using (creative_id)
            where {dk} and c.video is not null order by h.xong limit {MOI_LUOT * 20}""").splitlines() if l.count("|") >= 2]
    ds = [(cr, video) for cr, cid, video in loc_cam(ds)][:MOI_LUOT]
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

def tu_kiem_phim_cam():   # trên box3, SỔ THẬT: 167292 bị bỏ, một phim thường đi qua
    thuong = int(q("select content_id from etp.creative where content_id is not null and not coalesce((select gia_tri ? content_id::text from xv_khoa_ngoai where ten = 'ethopex_phim_cam'), false) order by creative_id desc limit 1"))
    ra = loc_cam([("1", "167292", "v"), ("2", str(thuong), "v")])
    assert [d[0] for d in ra] == ["2"], f"lọc phim cấm sai: {ra}"
    print(f"cham-nhe phim cấm: 167292 bị bỏ, phim thường #{thuong} đi qua")

if __name__ == "__main__" and "--tu-kiem-phim-cam" in sys.argv: tu_kiem_phim_cam(); sys.exit()
if __name__ == "__main__": main([int(x) for x in sys.argv[1:] if x.isdigit()] or None)
