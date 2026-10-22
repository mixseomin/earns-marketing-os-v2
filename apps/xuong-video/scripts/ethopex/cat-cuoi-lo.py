#!/usr/bin/env python3
"""CẮT ĐOẠN CUỐI (sâu nhất lấy được) cho cả lô (anh 21/10/2026: phân tích lô 2110 — đoạn cắt càng sâu trong phim càng lãi, Number One cắt phút
19–24 lãi +99…+316% còn cắt đầu/giữa −7%). Mỗi phim (thư mục tai-tap.py: tap01.mp4…, poster.jpg): ghép các tập miễn phí (bỏ tập cụt ≤ 20s = khoá),
đọc chữ vùng cuối một lần (kiem-thoai) → khung 65–85s KẾT ĐÚNG CHỖ HẾT MỘT TẬP (cliffhanger của app), ưu tiên tập muộn nhất, không dính giây cấm (±2s)
→ cat-canh.py (nút CTA + giọng CTA + thẻ cuối poster). Nguồn 720p được phóng lanczos lên 1080x1920 trong cat-canh.
Dùng: cat-cuoi-lo.py <thư mục phim> <lo.tsv: id\\tlocale\\tnguon\\tten\\turl> <thư mục ra> [song_song=3] [so_ban=1]  → <ra>/lo.json
so_ban > 1 (anh 22/10/2026: phim âm "thêm góc khác, ko limit để còn tìm hướng sớm"): mỗi phim tới so_ban khung, kết ở các chỗ hết tập khác nhau."""
import csv, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import importlib.util
D = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(D, "..", "..", "assets", "ethopex")
_s = importlib.util.spec_from_file_location("dl", os.path.join(D, "dung-lo-dai.py")); DL = importlib.util.module_from_spec(_s); _s.loader.exec_module(DL)
DAI_MIN, DAI_MAX, QUET = 65, 85, 420

def ghep_mo(tm):
    """ghép các tập còn mở (tập ≤ 20s là bản cụt của tập khoá — DramaBox trả 15s)"""
    taps = sorted(f for f in os.listdir(tm) if f.startswith("tap") and f.endswith(".mp4"))
    taps = [t for t in taps if DL.giay(os.path.join(tm, t)) > 20]
    ds = os.path.join(tm, "ds-cuoi.txt"); ra = os.path.join(tm, "ghep-cuoi.mp4")
    # ghép giữ mã chỉ khi mọi tập cùng thông số — 22/10/2026 DramaBox 156881 tập 6 là 720x1282 → concat cụt còn 215/392s, đoạn ra 3,6s.
    # Lệch thì chuẩn hoá TỪNG tập về 720x1280/30fps (bộ concat không qua được chỗ đổi luồng h264) rồi mới ghép.
    tso = {subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,codec_name", "-of", "csv=p=0", os.path.join(tm, t)],
                          capture_output=True, text=True).stdout.strip() for t in taps}
    vao = [os.path.join(tm, t) for t in taps]
    if len(tso) > 1:
        def chuan(f):
            o = f[:-4] + "-chuan.mp4"
            if not os.path.exists(o):
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1",
                                "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-c:a", "aac", "-ar", "44100", "-ac", "2", o], check=True, timeout=900)
            return o
        vao = [chuan(f) for f in vao]
    open(ds, "w").write("".join(f"file '{f}'\n" for f in vao))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", ds, "-c", "copy", ra], check=True, timeout=900)
    moc, t = [], 0.0
    for x in taps: t += DL.giay(os.path.join(tm, x)); moc.append(round(t, 1))
    if abs(DL.giay(ra) - t) > 3: raise ValueError(f"tệp ghép {DL.giay(ra):.1f}s ≠ tổng các tập {t:.1f}s")
    return ra, moc

def chon(src, moc, so_ban=1):
    """tới so_ban khung, mỗi khung kết ở một chỗ hết tập KHÁC nhau (muộn nhất trước), không chồng lên nhau"""
    tu0 = max(0.0, moc[-1] - QUET * so_ban)
    cam = [g for g, c in DL.KT.doc(src, tu0, moc[-1]) if DL.KT.soat(c)]
    sach = lambda a, b: not any(a - 2 <= g <= b + 2 for g in cam)
    ra = []
    for e in reversed(moc):
        if e - DAI_MIN < tu0 or len(ra) >= so_ban: break
        if ra and e > ra[-1][0]: continue   # không chồng khung đã chọn
        for d in range(DAI_MAX, DAI_MIN - 1, -5):
            s = round(e - d, 1)
            if s >= tu0 and sach(s, e): ra.append((s, e)); break
    return ra, cam

def lam(p, goc, ra_dir, so_ban=1):
    cid, loc, ten = p[0], p[1], p[3]; tm = os.path.join(goc, cid)
    try:
        pst = os.path.join(tm, "poster-1080.png"); DL.poster(os.path.join(tm, "poster.jpg"), pst)
        src, moc = ghep_mo(tm); khung, cam = chon(src, moc, so_ban)
        if not khung: return [{"content_id": int(cid), "ten": ten, "loi": f"không có khung cuối sạch (giây cấm {cam[:12]})"}]
        return [cat1(cid, loc, ten, src, moc, pst, tu, den, ra_dir) for tu, den in khung]
    except Exception as e:
        return [{"content_id": int(cid), "ten": ten, "loi": str(e)[-300:]}]

def cat1(cid, loc, ten, src, moc, pst, tu, den, ra_dir):
    try:
        ra = os.path.join(ra_dir, f"c-{cid}-{int(tu)}.mp4")
        args = (["MÍRALA GRATIS · TOCA MÁS INFORMACIÓN", ra, os.path.join(A, "cta-es-aria.mp3"), "¿QUÉ PASA DESPUÉS?"] if loc == "es"
                else ["WATCH FREE · TAP LEARN MORE", ra, os.path.join(A, "cta-en-george.mp3")])
        r = subprocess.run(["python3", os.path.join(D, "cat-canh.py"), src, str(tu), str(den), pst, "-"] + args, capture_output=True, text=True)
        if r.returncode != 0: return {"content_id": int(cid), "ten": ten, "loi": (r.stdout + r.stderr)[-300:]}
        g = DL.giay(ra)
        if g < den - tu: return {"content_id": int(cid), "ten": ten, "loi": f"đoạn ra {g:.1f}s ngắn hơn khung {den - tu:.0f}s"}
        return {"content_id": int(cid), "lang": loc, "ten": ten, "tu": tu, "den": den, "het_tap": len(moc), "moc_tap": moc, "file": ra, "giay": round(DL.giay(ra), 1)}
    except Exception as e:
        return {"content_id": int(cid), "ten": ten, "loi": str(e)[-300:]}

if __name__ == "__main__":
    goc, tsv, ra_dir = sys.argv[1], sys.argv[2], sys.argv[3]; n = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    so_ban = int(sys.argv[5]) if len(sys.argv) > 5 else 1
    os.makedirs(ra_dir, exist_ok=True)
    phim = [r for r in csv.reader(open(tsv), delimiter="\t") if len(r) >= 5]
    with ThreadPoolExecutor(n) as ex: kq = [k for ds in ex.map(lambda p: lam(p, goc, ra_dir, so_ban), phim) for k in ds]
    json.dump(kq, open(os.path.join(ra_dir, "lo.json"), "w"), ensure_ascii=False, indent=1)
    for k in kq: print(json.dumps({x: k[x] for x in k if x != "moc_tap"}, ensure_ascii=False)[:240])
