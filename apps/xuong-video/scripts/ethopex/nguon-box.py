#!/usr/bin/env python3
"""CHUẨN BỊ NGUỒN TRÊN BOX3 (anh 23/10/2026 "setup box3": việc cắt chuyển khỏi iMac — tập tải thẳng về box3, ghép + dựng bằng ffmpeg tại chỗ,
khỏi đẩy video qua đường lên ~1 Mbit/s của nhà). Chỉ phần ĐỌC CHỮ còn ở iMac (Vision 0,09s/khung; RapidOCR trên box3 1,2s/khung + dính chữ).
Mỗi phim trong lô: tải tập miễn phí (tai-tap.py) → ghép (cat-cuoi-lo.ghep_mo) → trích khung 1 giây/khung của vùng cat-cuoi-lo sẽ đọc
(QUET × so_ban giây cuối) vào /root/.cache/ethopex/khung/<id>/ + meta.json {src, tu0, n} → iMac doc-khung.py đọc rồi ghi <nguồn>.chu.json.
Dùng (box3): nguon-box.py <lo.tsv: id locale nguon ten url> [so_ban=2] [song_song=3]  → mỗi phim một dòng JSON"""
import importlib.util, json, os, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
D = os.path.dirname(os.path.abspath(__file__)); C = os.path.expanduser("~/.cache/ethopex"); N = os.path.join(C, "nguon"); K = os.path.join(C, "khung")
_s = importlib.util.spec_from_file_location("ccl", os.path.join(D, "cat-cuoi-lo.py")); CCL = importlib.util.module_from_spec(_s); _s.loader.exec_module(CCL)

def mot(dong, so_ban):
    cid, _, _, ten, url = (dong.rstrip("\n").split("\t") + [""] * 5)[:5]; tm = os.path.join(N, cid)
    try:
        if not (os.path.isdir(tm) and any(f.startswith("tap") and f.endswith(".mp4") for f in os.listdir(tm))):
            os.makedirs(tm, exist_ok=True); subprocess.run(["python3", os.path.join(D, "tai-tap.py"), url, tm, "8"], capture_output=True, text=True, timeout=1800)
        if not any(f.startswith("tap") and f.endswith(".mp4") for f in os.listdir(tm)): return {"id": int(cid), "ten": ten, "loi": "không tải được tập miễn phí"}
        src, moc = CCL.ghep_mo(tm); tu0 = max(0.0, moc[-1] - CCL.QUET * so_ban)
        kd = os.path.join(K, cid); shutil.rmtree(kd, ignore_errors=True); os.makedirs(kd)
        subprocess.run(["ffmpeg", "-v", "error", "-threads", "2", "-ss", str(tu0), "-i", src, "-vf", "fps=1,scale=540:-2", "-q:v", "4", os.path.join(kd, "k%05d.jpg")], check=True, timeout=1800)
        n = len([f for f in os.listdir(kd) if f.endswith(".jpg")])
        json.dump({"id": int(cid), "src": src, "tu0": tu0, "n": n}, open(os.path.join(kd, "meta.json"), "w"))
        return {"id": int(cid), "ten": ten, "src": src, "tu0": tu0, "n": n}
    except Exception as e:
        return {"id": int(cid), "ten": ten, "loi": str(e)[-200:]}

if __name__ == "__main__":
    ds = [l for l in open(sys.argv[1]) if l.strip()]; so_ban = int(sys.argv[2]) if len(sys.argv) > 2 else 2; ss = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    with ThreadPoolExecutor(ss) as ex:
        for k in ex.map(lambda l: mot(l, so_ban), ds): print(json.dumps(k, ensure_ascii=False), flush=True)
