#!/usr/bin/env python3
"""DỰNG LẠI CREATIVE CẮT CẢNH THEO LUẬT CTA MỚI (anh 22/10/2026: Support Ads cấm "Tap/Click" + mũi tên; "camp mới / lãi mỏng update, camp âm off rồi làm mới
theo rule mới, khi làm mới chụp ảnh để review"). Cùng đoạn tu–den của lô cũ, nguồn = tệp ghép tập trong ~/.cache/ethopex/nguon/<id>/ghep-cuoi.mp4,
nút + giọng + thẻ cuối theo cta_qc.CTA (không mũi tên). Ra <ra>/c-<id>-<tu>.mp4 + <ra>/to-c-<id>-<tu>.jpg (tờ 8 khung để review) + <ra>/lo.json.
Dùng: lam-lai-cta.py <lo.json cũ (content_id, lang, ten, tu, den)> <thư mục ra> [song_song=3]"""
import importlib.util, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
D = os.path.dirname(os.path.abspath(__file__)); N = os.path.expanduser("~/.cache/ethopex/nguon")
_s = importlib.util.spec_from_file_location("ccl", os.path.join(D, "cat-cuoi-lo.py")); CCL = importlib.util.module_from_spec(_s); _s.loader.exec_module(CCL)

def to_khung(f):
    d = CCL.DL.giay(f); o = os.path.join(os.path.dirname(f), "to-" + os.path.basename(f)[:-4] + ".jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-vf", f"fps=8/{d},scale=216:384,tile=8x1", "-frames:v", "1", o], check=True)
    # khung cuối riêng (thẻ cuối) để soát chữ nút + không mũi tên
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-sseof", "-1.2", "-i", f, "-frames:v", "1", "-vf", "scale=540:-2", o[:-4] + "-cuoi.jpg"], check=True)
    return o

def lam(x, ra):
    cid = str(x["content_id"]); tm = os.path.join(N, cid); src = os.path.join(tm, "ghep-cuoi.mp4"); pst = os.path.join(tm, "poster-1080.png")
    if not os.path.exists(src): return {**x, "loi": f"không có nguồn {src}"}
    if not os.path.exists(pst): CCL.DL.poster(os.path.join(tm, "poster.jpg"), pst)
    k = CCL.cat1(cid, x["lang"], x["ten"], src, x.get("moc_tap") or [], pst, float(x["tu"]), float(x["den"]), ra)
    if "loi" not in k: k["to"] = to_khung(k["file"])
    return k

if __name__ == "__main__":
    lo, ra = json.load(open(sys.argv[1])), sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    os.makedirs(ra, exist_ok=True)
    with ThreadPoolExecutor(n) as ex: kq = list(ex.map(lambda x: lam(x, ra), [x for x in lo if "loi" not in x]))
    json.dump(kq, open(os.path.join(ra, "lo.json"), "w"), ensure_ascii=False, indent=1)
    for k in kq: print(json.dumps({a: k.get(a) for a in ("content_id", "tu", "den", "giay", "file", "loi")}, ensure_ascii=False))
