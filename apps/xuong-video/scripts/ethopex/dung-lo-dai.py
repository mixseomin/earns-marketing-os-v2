#!/usr/bin/env python3
"""DỰNG LÔ CREATIVE DÀI 2–3' (anh 21/10/2026: đợt NetShort + DramaBox, "tất cả 2–3'", mỗi phim 1 camp 1 ad).
Mỗi phim (thư mục do tai-tap.py tải: tap01.mp4 …, poster.jpg): ghép các tập → chọn đoạn liền mạch TỪ ĐẦU TẬP 1 dài 120–180s,
ưu tiên kết đúng chỗ hết tập (cliffhanger của app), không thì cắt ở ~170s → poster thẻ cuối 1080x1920 (poster sát trên, tên phim thoát dải tối)
→ đọc chữ cả nguồn một lần (kiem-thoai) chọn khung 2–3' KHÔNG dính từ cấm → cat-canh.py (nút CTA + giọng CTA + thẻ cuối; cổng thoại kiểm lại).
Dùng: dung-lo-dai.py <thư mục chứa các phim> <phim.tsv: id\\tnguon\\tlocale\\tten\\turl> <thư mục ra> [song_song=3]"""
import csv, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageFilter

D = os.path.dirname(os.path.abspath(__file__))
import importlib.util as _iu2
_c2 = _iu2.spec_from_file_location("cta_qc", os.path.join(D, "cta_qc.py")); CQ = _iu2.module_from_spec(_c2); _c2.loader.exec_module(CQ)
A = os.path.join(D, "..", "..", "assets", "ethopex")
DAI_MIN, DAI_MAX, CAT_NGAN = 120, 180, 170

def giay(f): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip() or 0)

def ghep(thu_muc, tu_tap=1):
    taps = sorted(f for f in os.listdir(thu_muc) if f.startswith("tap") and f.endswith(".mp4"))[tu_tap - 1:]
    ds = os.path.join(thu_muc, f"ds{tu_tap}.txt"); ra = os.path.join(thu_muc, f"ghep{tu_tap}.mp4")
    open(ds, "w").write("".join(f"file '{os.path.join(thu_muc, t)}'\n" for t in taps))
    # chuẩn hoá về cùng thông số rồi ghép (tập có thể khác bitrate / kích thước)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", ds, "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,fps=30",
                    "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-c:a", "aac", "-ar", "44100", ra], check=True)
    moc, t = [], 0.0
    for x in taps: t += giay(os.path.join(thu_muc, x)); moc.append(round(t, 1))
    return ra, moc

import importlib.util
_s = importlib.util.spec_from_file_location("kt", os.path.join(D, "kiem-thoai.py")); KT = importlib.util.module_from_spec(_s); _s.loader.exec_module(KT)

def chon_khung(src, moc):
    """Đọc chữ CẢ nguồn một lần (kiem-thoai, mỗi giây) → khung 120–180s KHÔNG dính giây cấm nào (±2s đệm).
    Ưu tiên: bắt đầu ở đầu một tập + kết ở hết tập (cliffhanger) → bắt đầu đầu tập, cắt ~170s → bắt đầu ngay sau giây cấm. None nếu không có."""
    cam = [g for g, c in KT.doc(src, 0, moc[-1]) if KT.soat(c)]
    sach = lambda a, b: not any(a - 2 <= g <= b + 2 for g in cam)
    dau = [0.0] + moc[:-1]
    for s in dau:
        for e in reversed(moc):
            if DAI_MIN <= e - s <= DAI_MAX and sach(s, e): return s, e, cam
    for s in dau + [g + 3 for g in cam]:
        e = min(s + CAT_NGAN, moc[-1])
        if e - s >= DAI_MIN and sach(s, e): return s, e, cam
    return None, None, cam

def poster(vao, ra):
    W, H = 1080, 1920
    im = Image.open(vao).convert("RGB")
    bg = im.resize((int(im.width * H / im.height) + 1, H)); bg = bg.crop(((bg.width - W) // 2, 0, (bg.width - W) // 2 + W, H)).filter(ImageFilter.GaussianBlur(30))
    fg = im.resize((W, int(im.height * W / im.width)))
    if fg.height > 1420: fg = fg.resize((int(W * 1420 / fg.height), 1420))   # tên phim ở chân poster phải nằm trên dải tối (y ≥ 1430)
    bg.paste(fg, ((W - fg.width) // 2, 0)); bg.save(ra)

def lam(phim, goc, ra_dir):
    cid, nguon, loc, ten = phim[0], phim[1], phim[2], phim[3]
    tm = os.path.join(goc, cid); ra = os.path.join(ra_dir, f"c-{cid}-dai.mp4")
    try:
        pst = os.path.join(tm, "poster-1080.png"); poster(os.path.join(tm, "poster.jpg"), pst)
        es = loc == "es"
        c = CQ.CTA["es" if es else "en"]; args = [c["nut"], ra, c["giong"], c["hoi"]]   # CTA chung (cta_qc.py)
        src, moc = ghep(tm, 1)
        tu, den, cam = chon_khung(src, moc)
        if tu is None: return {"content_id": int(cid), "loi": f"không có khung 2–3' sạch (giây dính từ cấm: {cam[:12]})"}
        r = subprocess.run(["python3", os.path.join(D, "cat-canh.py"), src, str(tu), str(den), pst, "-"] + args, capture_output=True, text=True)
        if r.returncode != 0: return {"content_id": int(cid), "loi": (r.stdout + r.stderr)[-300:]}
        tap_dau = 1 + sum(1 for m in moc[:-1] if m <= tu)
        return {"content_id": int(cid), "lang": loc, "ten": ten, "tu_tap": tap_dau, "tu": tu, "den": den, "moc_tap": moc, "file": ra, "giay": round(giay(ra), 1)}
    except Exception as e:
        return {"content_id": int(cid), "loi": str(e)[-300:]}

if __name__ == "__main__":
    goc, tsv, ra_dir = sys.argv[1], sys.argv[2], sys.argv[3]; n = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    os.makedirs(ra_dir, exist_ok=True)
    phim = [r for r in csv.reader(open(tsv), delimiter="\t") if len(r) >= 5]
    with ThreadPoolExecutor(n) as ex: kq = list(ex.map(lambda p: lam(p, goc, ra_dir), phim))
    json.dump(kq, open(os.path.join(ra_dir, "lo.json"), "w"), ensure_ascii=False, indent=1)
    for k in kq: print(json.dumps(k, ensure_ascii=False)[:220])
