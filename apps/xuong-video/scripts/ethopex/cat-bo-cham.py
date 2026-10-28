#!/usr/bin/env python3
"""CẮT BỎ KHUNG VI PHẠM CỦA CREATIVE ĐÃ CHẤM (anh 28/10/2026: "khi cắt cảnh video, đoạn nào vi phạm chủ động cắt bỏ luôn. Ko cần phải liền mạch").
Creative bị cổng chấm chặn (etp.cham_cong.duoc_len = false): máy chấm ghi KHUNG dính từng tiêu chí (etp.cham.khung {tiêu chí: [số khung 1..N]}, N khung rải
đều trên video — etp.cham.lop.anh.so_khung / giay). Bỏ khoảng quanh các khung dính (mỗi khung ±1/2 bước), giữ phần còn lại nối liền → video mới → lô lo.json
cho len-creative.py (creative MỚI, máy chấm lại như mọi creative). Không cắt khi:
  · khung dính rơi vào THẺ CUỐI (O_CUOI giây cuối: tên phim + nút) — cắt là mất tên phim
  · còn lại < GIU (40%) thời lượng, hoặc lỗi nằm ở thoại cả video (khung dính ≥ 60% số khung)
Chạy (iMac):  python3 cat-bo-cham.py <mã lô ra> <creative_id…>   → ~/.cache/ethopex/ra/<mã>/lo.json, rồi: len-creative.py <lo.json> <mã> "<dạng>" --da-soat"""
import json, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__)); C = os.path.expanduser("~/.cache/ethopex")
B = "root@167.233.241.16"; ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
GIU, THE_CUOI, TRAN_KHUNG = 0.4, 6.0, 0.6
MA_HOA = ["-c:v", "h264_videotoolbox", "-b:v", "3M", "-maxrate", "4500k"] if sys.platform == "darwin" else ["-c:v", "libx264", "-crf", "23"]

def sql(cau):
    r = subprocess.run(["ssh", "-o", "ConnectTimeout=15", B, f'{ENV}; psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -'], input=cau, capture_output=True, text=True, timeout=120)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def khoang(khung, n, giay):
    """số khung dính (1..n) → [[a, z]] giây cần bỏ (gộp chồng)"""
    b = giay / n; kh = []
    for i in sorted(set(khung)):
        a, z = max(0.0, (i - 1) * b - b / 2), min(giay, i * b + b / 2)
        if kh and a <= kh[-1][1]: kh[-1][1] = max(kh[-1][1], z)
        else: kh.append([a, z])
    return kh

def mot(cr, ra_dir):
    j = json.loads(sql(f"""select json_build_object('khung', h.khung, 'lop', h.lop->'anh', 'chan', g.chan_boi, 'video', r.video, 'content_id', r.content_id, 'lang', coalesce(r.lang, 'en'),
        'tu', r.tu, 'den', r.den, 'dang', r.dang, 'lo', r.lo, 'ten', coalesce(p.ten, '')) from etp.cham h join etp.cham_cong g using (creative_id) join etp.creative r using (creative_id)
        left join etp.phim p on p.content_id = r.content_id where h.creative_id = {int(cr)}""") or "null")
    if not j: return {"creative": cr, "loi": "chưa chấm / không có trong kho"}
    n, giay = int((j.get("lop") or {}).get("so_khung") or 0), float((j.get("lop") or {}).get("giay") or 0)
    dinh = sorted({int(k) for v in (j.get("khung") or {}).values() for k in v})
    if not (n and giay and dinh and j.get("video")): return {"creative": cr, "loi": f"thiếu dữ liệu khung (n={n}, giây={giay:.0f}, khung dính={len(dinh)})"}
    if len(dinh) >= TRAN_KHUNG * n: return {"creative": cr, "loi": f"dính {len(dinh)}/{n} khung — lỗi nằm cả video (thoại), không cắt được"}
    kh = khoang(dinh, n, giay)
    if any(z > giay - THE_CUOI for a, z in kh): return {"creative": cr, "loi": f"khung dính rơi vào thẻ cuối (khung {dinh}) — cắt là mất tên phim / nút"}
    con = giay - sum(z - a for a, z in kh)
    if con < GIU * giay: return {"creative": cr, "loi": f"bỏ xong còn {con:.0f}/{giay:.0f}s (< {GIU:.0%})"}
    goc = os.path.join(ra_dir, f"goc-{cr}.mp4"); out = os.path.join(ra_dir, f"b-{j['content_id']}-{int(float(j['tu'] or 0))}-{cr}.mp4")
    subprocess.run(["curl", "-s", "-A", "Mozilla/5.0", "-o", goc, j["video"]], check=True, timeout=600)
    dk = "+".join(f"between(t,{a:.2f},{z:.2f})" for a, z in kh)
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", goc, "-vf", f"select='not({dk})',setpts=N/FRAME_RATE/TB", "-af", f"aselect='not({dk})',asetpts=N/SR/TB",
                        *MA_HOA, "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", out], capture_output=True, text=True)
    os.remove(goc)
    if r.returncode: return {"creative": cr, "loi": "ffmpeg: " + r.stderr.strip()[-160:]}
    return {"content_id": int(j["content_id"]), "lang": j["lang"], "ten": j["ten"], "tu": float(j["tu"] or 0), "den": float(j["den"] or 0), "file": out, "lo": j.get("lo") or "",
            "cat_bo_tu": int(cr), "bo": [f"{a:.1f}–{z:.1f}s" for a, z in kh], "giay": round(con, 1), "chan_cu": j.get("chan")}

if __name__ == "__main__":
    ma, ids = sys.argv[1], [int(x) for x in sys.argv[2:] if x.isdigit()]
    ra = os.path.join(C, "ra", ma); os.makedirs(ra, exist_ok=True)
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(3) as ex: kq = list(ex.map(lambda c: mot(c, ra), ids))
    json.dump([x for x in kq if x.get("file")], open(os.path.join(ra, "lo.json"), "w"), ensure_ascii=False, indent=1)
    for x in kq: print(json.dumps({k: x[k] for k in x if k not in ("chan_cu",)}, ensure_ascii=False)[:230])
    print(f"cắt được {sum(1 for x in kq if x.get('file'))}/{len(kq)} → {ra}/lo.json")
