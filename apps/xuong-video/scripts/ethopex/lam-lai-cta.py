#!/usr/bin/env python3
"""DỰNG LẠI CREATIVE CẮT CẢNH THEO LUẬT CTA MỚI (anh 22/10/2026: Support Ads cấm "Tap/Click" + mũi tên; "camp mới / lãi mỏng update, camp âm off rồi làm mới
theo rule mới, khi làm mới chụp ảnh để review"). Cùng đoạn tu–den của lô cũ, nguồn = tệp ghép tập trong ~/.cache/ethopex/nguon/<id>/ghep-cuoi.mp4,
nút + giọng + thẻ cuối theo cta_qc.CTA (không mũi tên). Ra <ra>/c-<id>-<tu>.mp4 + <ra>/to-c-<id>-<tu>.jpg (tờ 8 khung để review) + <ra>/lo.json.
Dùng: lam-lai-cta.py <lo.json cũ (content_id, lang, ten, tu, den [, nguon_qc = mã QC spy | dai = true])> <thư mục ra> [song_song=3]"""
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
    if x.get("nguon_qc") and not os.environ.get("CHO_NGUON_SPY"):   # anh 22/10/2026 (AFS): video QC spy mang mũi tên / đếm ngược / nhãn FREE của app gốc → cấm
        return {**x, "loi": "nguồn là video QC spy (lớp phủ mũi tên / đếm ngược của app gốc) — cắt lại từ tập phim sạch (cat-cuoi-lo)"}
    if x.get("nguon_qc"): src = os.path.join(os.path.expanduser("~/.cache/ethopex/nguon-qc"), f"{x['nguon_qc']}.mp4")   # cảnh thật lô 19–21/10: cắt từ video QC spy
    elif x.get("dai"): src = CCL.DL.ghep(tm, 1)[0]                                                                       # phim dài 2110ns: mốc tính từ đầu tập 1 (tệp ghép chuẩn hoá của dung-lo-dai)
    if not x.get("nguon_qc") and not os.path.exists(src) and os.path.exists(os.path.join(tm, cid + ".mp4")): src = os.path.join(tm, cid + ".mp4")   # nguồn một tệp (Number One 94344)
    if not x.get("nguon_qc") and not os.path.exists(src) and any(f.startswith("tap") and f.endswith(".mp4") for f in os.listdir(tm)): src = CCL.ghep_mo(tm)[0]                 # còn tập lẻ → ghép lại
    if not os.path.exists(src): return {**x, "loi": f"không có nguồn {src}"}
    if not os.path.exists(pst): CCL.DL.poster(os.path.join(tm, "poster.jpg"), pst)
    tu, den = float(x["tu"]), float(x["den"])
    def che(mo=None):   # che kiểu TV (che-thoai.py): mosaic + bíp câu nhạy cảm, mờ cả khung các khoảng khai trong x["che"] (cảnh hôn)
        o = os.path.join(ra, f"che-{cid}-{int(tu)}.mp4")
        r = subprocess.run(["python3", os.path.join(D, "che-thoai.py"), src, str(tu), str(den), o] + (["--che", mo] if mo else []), capture_output=True, text=True)
        if r.returncode != 0: raise RuntimeError("che-thoai: " + (r.stdout + r.stderr)[-200:])
        return o
    if x.get("che"): src, tu, den = che(x["che"]), 0.0, den - tu
    k = CCL.cat1(cid, x["lang"], x["ten"], src, x.get("moc_tap") or [], pst, tu, den, ra)
    if "loi" in k and "THOAI CHAN" in str(k["loi"]) and not x.get("che"):   # anh 22/10/2026: thoại nhạy cảm → làm méo kiểu TV thay vì bỏ đoạn
        src, den, tu = che(), den - tu, 0.0
        k = CCL.cat1(cid, x["lang"], x["ten"], src, [], pst, tu, den, ra); k["da_che"] = True
    k.update({a: x[a] for a in ("camp", "loai", "lo") if a in x})
    if "loi" not in k: k["to"] = to_khung(k["file"])
    return k

if __name__ == "__main__":
    lo, ra = json.load(open(sys.argv[1])), sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    os.makedirs(ra, exist_ok=True)
    def an_toan(x):   # một đoạn lỗi không được kéo sập cả lô (22/10/2026)
        try: return lam(x, ra)
        except Exception as e: return {**x, "loi": str(e)[-300:]}
    with ThreadPoolExecutor(n) as ex: kq = list(ex.map(an_toan, [x for x in lo if "loi" not in x]))
    json.dump(kq, open(os.path.join(ra, "lo.json"), "w"), ensure_ascii=False, indent=1)
    for k in kq: print(json.dumps({a: k.get(a) for a in ("content_id", "tu", "den", "giay", "file", "loi")}, ensure_ascii=False))
