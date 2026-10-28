#!/usr/bin/env python3
"""MÁY ĐỌC VIDEO → ĐIỂM CHẠM TỰ NHIÊN (anh 29/10/2026: "các creative hiện tại có thể dùng để đo luôn điểm chạm được không?" → "có cách nào đo nhanh hơn không?").
Creative đang chạy KHÁC NHAU sẵn ở những chỗ sổ điểm chạm chưa ghi (3 giây đầu có tiếng hay im, nhịp cắt cảnh, khung đầu sáng / tối…) → đọc thẳng
video trên img.on.tc bằng ffmpeg (chỉ kéo vài giây đầu qua HTTP, không tải nguyên tệp, không kéo từ Drive), ghi nhóm `video` vào etp.diem_cham
(gộp, không đè các nhóm khác) → tab etp › Creative › Điểm chạm tự có khối so sánh. $0: không gọi AI.
  doc_video.py [--ngay 14] [--luong 6] [--lai]    → đọc creative có chi trong N ngày chưa có nhóm video (--lai: đọc lại cả cái đã có)"""
import json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import soat_doan as SD

BAN = 1   # đổi cách đo thì tăng → --lai đọc lại

def ff(*a, t=40):
    try: return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *a], capture_output=True, text=True, timeout=t).stderr
    except subprocess.TimeoutExpired: return ""

def doc(url):
    """→ dict giá trị THÔ (số) của một video; None khi không đọc được"""
    a = ff("-t", "3", "-i", url, "-vn", "-af", "astats=metadata=1:reset=0,ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-")
    rms = [float(x) for x in re.findall(r"RMS_level=(-?[0-9.]+)", a)]
    c = ff("-t", "10", "-i", url, "-an", "-vf", "select='gt(scene,0.3)',metadata=print", "-f", "null", "-")
    s = ff("-ss", "2", "-i", url, "-frames:v", "1", "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-")
    y = re.findall(r"YAVG=([0-9.]+)", s)
    if not y and not rms: return None
    return {"rms_3s": round(rms[-1], 1) if rms else -99.0, "cat_10s": c.count("lavfi.scene_score"), "sang_khung_dau": round(float(y[-1]), 1) if y else None}

def nhom(v):
    """số thô → giá trị gom nhóm để so (chữ ngắn, như mọi điểm chạm khác)"""
    r, c, y = v["rms_3s"], v["cat_10s"], v["sang_khung_dau"]
    return {"tieng_3s": "im" if r < -45 else "nho" if r < -28 else "to", "nhip_cat_10s": "0 cắt" if c == 0 else "1–2 cắt" if c <= 2 else "3–5 cắt" if c <= 5 else "≥ 6 cắt",
            "sang_khung_dau": None if y is None else "tối" if y < 60 else "vừa" if y < 110 else "sáng", "tho": v, "ban": BAN}

def main():
    a = sys.argv[1:]; ngay = int(a[a.index("--ngay") + 1]) if "--ngay" in a else 14; luong = int(a[a.index("--luong") + 1]) if "--luong" in a else 6
    loc = "" if "--lai" in a else f"and (d.cham->'video'->>'ban') is distinct from '{BAN}'"
    ds = [r.split("|") for r in SD.sql(f"""select c.creative_id, c.video from etp.creative c join etp.diem_cham d using (creative_id)
      where c.video like 'http%' and c.creative_id in (select k.creative_id from etp.so_ngay s join etp.camp k using (camp_id) where s.ngay >= current_date - {ngay} and s.chi > 0) {loc}""").splitlines() if r]
    print(f"đọc {len(ds)} video ({luong} luồng)…", flush=True); t0 = time.time(); ra = {}
    with ThreadPoolExecutor(luong) as ex:
        for (cid, url), v in zip(ds, ex.map(lambda x: doc(x[1]), ds)):
            if v: ra[int(cid)] = nhom(v)
    if ra:
        j = json.dumps([{"creative_id": k, "v": v} for k, v in ra.items()], ensure_ascii=False).replace("$J$", "")
        SD.sql(f"update etp.diem_cham d set cham = d.cham || jsonb_build_object('video', x.v), luc = now() from jsonb_to_recordset($J${j}$J$::jsonb) as x(creative_id int, v jsonb) where d.creative_id = x.creative_id")
    print(f"xong {len(ra)}/{len(ds)} trong {time.time() - t0:.0f}s → etp.diem_cham nhóm 'video' (xem etp › Creative › Điểm chạm)", flush=True)

if __name__ == "__main__":
    main()
