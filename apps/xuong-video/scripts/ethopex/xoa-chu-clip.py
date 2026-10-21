#!/usr/bin/env python3
"""XOÁ CHỮ MODEL TỰ IN trong clip (0đ, tại máy): phụ đề giả của Grok ("What a moment.", "Mom.") — clip vẫn dùng được nhưng chữ lạ / sai ngôn ngữ
(21/10/2026: clip kể chuyện EN #133 đem sang bản ES #223 thì chữ Anh trên hình phạm luật một ngôn ngữ). Đọc khung 5 lần/giây bằng Vision
(hop-chu.swift, biên dịch một lần vào ~/.cache/ethopex/hop-chu) → mỗi chữ lấy khung, nối các khung liền nhau theo thời gian → làm mờ đúng
vùng đó trong đúng quãng đó (boxblur), phần còn lại giữ nguyên. Không có chữ thì chép nguyên.
Dùng: xoa-chu-clip.py <vào.mp4|url> <ra.mp4>   → in JSON {vung: [[tu, den, x, y, w, h], …]}"""
import json, os, subprocess, sys, tempfile
D = os.path.dirname(os.path.abspath(__file__)); MAY = os.path.expanduser("~/.cache/ethopex/hop-chu"); FPS = 5; DEM = 0.04
def may():
    src = os.path.join(D, "hop-chu.swift")
    if not os.path.exists(MAY) or os.path.getmtime(MAY) < os.path.getmtime(src):
        os.makedirs(os.path.dirname(MAY), exist_ok=True); subprocess.run(["swiftc", "-O", src, "-o", MAY], check=True, timeout=600)
    return MAY
def main(vao, ra):
    w, h = map(int, subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", vao]).decode().strip().split(","))
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["ffmpeg", "-v", "error", "-i", vao, "-vf", f"fps={FPS}", os.path.join(td, "k%04d.png")], check=True, timeout=600)
        anh = sorted(f for f in os.listdir(td) if f.endswith(".png"))
        kq = [json.loads(l) for l in subprocess.check_output([may()] + [os.path.join(td, f) for f in anh], timeout=600).decode().splitlines() if l.strip()]
    chu = set(); vung = []   # [tu, den, x0, y0, x1, y1] (0–1), nối khung chữ chồng nhau ở khung hình kế tiếp
    for k in kq:
        t = (int(os.path.basename(k["anh"])[1:5]) - 1) / FPS
        for b in k["hop"]:
            if sum(ch.isalpha() for ch in b["chu"]) < 2: continue   # số trên áo ("1"), ký hiệu lẻ — là hình, không phải chữ in
            x0, y0, x1, y1 = b["x"] - DEM, b["y"] - DEM, b["x"] + b["w"] + DEM, b["y"] + b["h"] + DEM
            v = next((v for v in vung if t - v[1] <= 2 / FPS and not (x1 < v[2] or x0 > v[4] or y1 < v[3] or y0 > v[5])), None)
            if v: v[1] = t; v[2], v[3], v[4], v[5] = min(v[2], x0), min(v[3], y0), max(v[4], x1), max(v[5], y1)
            else: vung.append([t, t, x0, y0, x1, y1]); chu.add(b["chu"])
    if not vung:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vao, "-c", "copy", ra], check=True); print(json.dumps({"vung": []})); return
    loc, nhan, cuoi = [], "[0:v]", 0
    out = []
    for i, (a, b, x0, y0, x1, y1) in enumerate(vung):
        X, Y = max(0, int(x0 * w)) // 2 * 2, max(0, int(y0 * h)) // 2 * 2
        W, H = min(w - X, int((x1 - x0) * w)) // 2 * 2, min(h - Y, int((y1 - y0) * h)) // 2 * 2
        if W < 4 or H < 4: continue
        a2, b2 = max(0, a - 1 / FPS), b + 1 / FPS
        loc.append(f"{nhan}split[g{i}][c{i}];[c{i}]crop={W}:{H}:{X}:{Y},boxblur=20:3[m{i}];[g{i}][m{i}]overlay={X}:{Y}:enable='between(t,{a2:.2f},{b2:.2f})'[v{i}]")
        nhan = f"[v{i}]"; out.append([round(a2, 2), round(b2, 2), X, Y, W, H])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vao, "-filter_complex", ";".join(loc), "-map", nhan, "-map", "0:a?", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-c:a", "copy", ra], check=True, timeout=900)
    print(json.dumps({"vung": out, "chu": sorted(chu)}, ensure_ascii=False))
if __name__ == "__main__": main(sys.argv[1], sys.argv[2])
