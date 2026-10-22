#!/usr/bin/env python3
"""DÒ KHỚP ĐOẠN CẮT TỪ VIDEO QC SPY SANG TẬP SẠCH (anh 23/10/2026: nhân bản camp thắng mang CTA cũ = dựng lại đúng đoạn đó theo luật; luật AFS cấm cắt
từ video QC spy — lớp phủ mũi tên / đếm ngược của app gốc). Vân khung hình (dHash 8x8 vùng giữa, 1 khung/giây) của đoạn [tu, den] trong video spy
so với bản ghép tập sạch (cùng bản lam-lai-cta.py dùng: ghep-cuoi.mp4 / <id>.mp4 / ghép tập lẻ) → độ lệch chiếm đa số → mốc mới trên bản sạch.
Number One (94344): spy và bản sạch cùng một bản ghép (lệch 0). Atrás (92980): spy dựng lại từ tập trả phí → không khớp → cắt góc mới (cat-cuoi-lo).
Dùng (Mac): khop-nguon.py <spy.mp4> <thư mục phim sạch> <tu> <den>  → JSON {khop, tu, den, lech, ty_le, nguon}"""
import collections, importlib.util, json, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__))

def nguon_sach(tm):
    cid = os.path.basename(tm.rstrip("/"))
    for f in (os.path.join(tm, "ghep-cuoi.mp4"), os.path.join(tm, cid + ".mp4")):
        if os.path.exists(f): return f
    s = importlib.util.spec_from_file_location("ccl", os.path.join(D, "cat-cuoi-lo.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
    return m.ghep_mo(tm)[0]

def van(f, tu=None, den=None):
    a = (["-ss", str(tu), "-t", str(den - tu)] if tu is not None else [])
    raw = subprocess.run(["ffmpeg", "-v", "error", *a, "-i", f, "-vf", "fps=1,crop=iw:ih*0.6:0:ih*0.15,scale=9:8,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    out = []
    for k in range(len(raw) // 72):
        b = raw[k * 72:(k + 1) * 72]; v = 0
        for r in range(8):
            for c in range(8): v = (v << 1) | (b[r * 9 + c + 1] > b[r * 9 + c])
        out.append(v)
    return out

def main(spy, tm, tu, den):
    src = nguon_sach(tm); G = van(src); C = van(spy, tu, den)
    lech = collections.Counter()
    for i, h in enumerate(C):
        j, dmin = min(((j, bin(g ^ h).count("1")) for j, g in enumerate(G)), key=lambda x: x[1])
        if dmin <= 8: lech[j - i] += 1
    if not lech: return {"khop": False, "nguon": src, "ty_le": 0}
    (l, n), = lech.most_common(1); n += lech.get(l - 1, 0) + lech.get(l + 1, 0)   # lệch ±1 giây do lấy mẫu
    ty_le = round(n / max(1, len(C)), 2)
    return {"khop": ty_le >= 0.6, "tu": float(l), "den": float(l + (den - tu)), "lech": l - tu, "ty_le": ty_le, "nguon": src}

if __name__ == "__main__":
    a = sys.argv[1:]
    print(json.dumps(main(a[0], a[1], float(a[2]), float(a[3])), ensure_ascii=False))
