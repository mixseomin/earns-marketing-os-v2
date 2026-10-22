#!/usr/bin/env python3
"""CHE KIỂU TV cho đoạn cắt (anh 22/10/2026: "câu thoại nhạy cảm thì thử làm méo giống tv xem", "cảnh hôn thì che đi").
Từ một đoạn nguồn [tu, den]:
  - đọc chữ 4 khung/giây (doc-chu: chữ + vị trí ô) → ô phụ đề dính từ cấm (kiem-thoai.MAU) bị MOSAIC đúng chỗ, tiếng cùng khoảng thay bằng BÍP 1 kHz
    (khoảng = lúc phụ đề hiện ± 0,15s);
  - --che "a-b,c-d" (giây tính từ đầu đoạn): làm mờ nặng CẢ KHUNG trong các khoảng đó (cảnh hôn / thân mật — chọn bằng mắt từ tờ khung);
  - đọc lại bản ra bằng kiem-thoai: còn chữ cấm thì báo lỗi.
Bản ra dài đúng (den - tu) giây, mốc 0 = tu → đưa vào cat-canh.py <ra> 0 <den-tu> … như nguồn thường.
Dùng: che-thoai.py <nguồn.mp4> <tu> <den> <ra.mp4> [--che "a-b,c-d"]"""
import importlib.util, json, os, subprocess, sys, tempfile
D = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("kt", os.path.join(D, "kiem-thoai.py")); KT = importlib.util.module_from_spec(_s); _s.loader.exec_module(KT)
FPS, LE = 4, 0.15

def doc_khung(video, L):
    with tempfile.TemporaryDirectory() as t:
        subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"fps={FPS},scale=540:-2", f"{t}/k%05d.png"], check=True)
        anh = sorted(os.listdir(t))
        r = subprocess.run([KT.may_doc()] + [f"{t}/{a}" for a in anh], capture_output=True, text=True, check=True, timeout=1800)
        return [((i + 0.5) / FPS, json.loads(l)) for i, l in enumerate(r.stdout.splitlines())]

def khoang_cam(ds):
    """→ [(a, b, [x, y, w, h])] gộp các khung liền nhau dính từ cấm; ô = hợp các ô chữ dính"""
    hit = []
    for g, d in ds:
        ks = d.get("khung", []); o = [k for k in ks if KT.soat(k[0])]
        # che CẢ KHỐI phụ đề: thêm các dòng sát trên/dưới dòng dính (22/10/2026: "Tu esposa tiene" còn hiện, chỉ che "un cuerpazo")
        while True:
            them = [k for k in ks if k not in o and any(abs((k[2] + k[4] / 2) - (h[2] + h[4] / 2)) <= max(k[4], h[4]) * 1.8 for h in o)]
            if not them: break
            o += them
        if o: hit.append((g, o))
    ra = []
    for g, o in hit:
        x0, y0 = min(k[1] for k in o), min(k[2] for k in o); x1, y1 = max(k[1] + k[3] for k in o), max(k[2] + k[4] for k in o)
        if ra and g - ra[-1][1] <= 1.0 / FPS + 0.01:
            a, b, (X0, Y0, X1, Y1) = ra[-1]; ra[-1] = (a, g, (min(X0, x0), min(Y0, y0), max(X1, x1), max(Y1, y1)))
        else: ra.append((g, g, (x0, y0, x1, y1)))
    return [(max(0, a - 0.5 / FPS - LE), b + 0.5 / FPS + LE, o) for a, b, o in ra]

def main(a):
    src, tu, den, out = a[0], float(a[1]), float(a[2]), a[3]; L = den - tu
    che = [tuple(map(float, x.split("-"))) for x in (a[a.index("--che") + 1].split(",") if "--che" in a else []) if x]
    tmp = out[:-4] + "-goc.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(tu), "-t", str(L), "-i", src, "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-c:a", "aac", "-ar", "44100", "-ac", "2", tmp], check=True)
    W, H = map(int, subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", tmp]).decode().strip().split(","))
    kc = khoang_cam(doc_khung(tmp, L))
    v, am, n = "[0:v]null[v0]", "[0:a]anull[a0]", 0
    for i, (p, q) in enumerate(che):   # mờ cả khung
        v += f";[v{n}]boxblur=luma_radius=40:luma_power=3:enable='between(t,{p},{q})'[v{n + 1}]"; n += 1
    for i, (p, q, (x0, y0, x1, y1)) in enumerate(kc):   # mosaic ô phụ đề
        px, py = max(0, int((x0 - 0.04) * W)), max(0, int((y0 - 0.02) * H)); pw, ph = min(W - px, int((x1 - x0 + 0.08) * W)), min(H - py, int((y1 - y0 + 0.04) * H))
        pw, ph = pw - pw % 2, ph - ph % 2
        v += (f";[v{n}]split[b{i}][c{i}];[c{i}]crop={pw}:{ph}:{px}:{py},scale={max(2, pw // 24)}:{max(2, ph // 24)},scale={pw}:{ph}:flags=neighbor[m{i}];"
              f"[b{i}][m{i}]overlay={px}:{py}:enable='between(t,{p:.2f},{q:.2f})'[v{n + 1}]"); n += 1
    if kc:
        cond = "+".join(f"between(t,{p:.2f},{q:.2f})" for p, q, _ in kc)
        am = (f"[0:a]volume=0:enable='{cond}'[a1];sine=frequency=1000:sample_rate=44100:duration={L},volume=0.35,"
              f"volume=0:enable='not({cond})',aformat=channel_layouts=stereo[bip];[a1][bip]amix=inputs=2:duration=first:normalize=0[a0]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-filter_complex", f"{v};{am}", "-map", f"[v{n}]", "-map", "[a0]",
                    "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-c:a", "aac", "-ar", "44100", out], check=True)
    os.remove(tmp)
    con = [(g, d["chu"]) for g, d in doc_khung(out, L) if KT.soat(d["chu"])]
    print(json.dumps({"ra": out, "giay": L, "che_thoai": [[round(p, 2), round(q, 2)] for p, q, _ in kc], "mo_khung": che,
                      "con_chu_cam": [[round(g, 2), c[:80]] for g, c in con[:5]]}, ensure_ascii=False))
    sys.exit(2 if con else 0)

if __name__ == "__main__":
    main(sys.argv[1:])
