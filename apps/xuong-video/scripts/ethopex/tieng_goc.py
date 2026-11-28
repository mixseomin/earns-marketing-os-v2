#!/usr/bin/env python3
# tra-repo-ok: mã dán keo nội bộ — gọi mlx_whisper (đã cài ~/.venvs/whisper trên iMac) đọc ngôn ngữ nói của nguồn, không viết cơ chế mới
"""CỔNG TIẾNG GỐC — phim locale nào thì tiếng nói trong tập phải đúng ngôn ngữ đó (anh 28/11/2026 "Các phim ES lại voice EN"):
bản 96 phim 134241 ¡Lárgate de mi Bugatti! (locale es) cắt từ tập tiếng ANH phụ đề Tây Ban Nha → creative ES mà người xem nghe tiếng Anh.
Máy cắt (cat-cuoi-lo.py) gọi kiem() TRƯỚC khi cắt; sai tiếng → bỏ phim, báo rõ, không tốn bước cắt / giọng.

  python3 tieng_goc.py <tệp video> <locale>   → in ngôn ngữ đọc được, exit 1 khi lệch
Kết quả nhớ ở <tệp>.tieng.json (gắn với giờ sửa tệp) — đọc lại không chạy whisper lần hai.
"""
import json, os, subprocess, sys, tempfile

PY = os.path.expanduser("~/.venvs/whisper/bin/python")
MO_HINH = "mlx-community/whisper-large-v3-turbo"   # whisper-small bịa chữ trên nhạc nền (soát lô 28/11/2026) — turbo đọc đúng
DOAN = 25   # giây mẫu mỗi điểm


def giay(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout or 0)


def doc(f):
    """ngôn ngữ nói của tệp: đọc 2 đoạn (30% + 60% độ dài), lấy ngôn ngữ đa số → 'en' / 'es' / … ; không đọc được → ''"""
    nho = f + ".tieng.json"
    try:
        j = json.load(open(nho))
        if j.get("mtime") == os.path.getmtime(f): return j["lang"]
    except Exception: pass
    if not os.path.exists(PY): raise SystemExit(f"thiếu {PY} — cổng tiếng gốc chỉ chạy trên iMac (mlx_whisper)")
    L = giay(f); ds = []
    with tempfile.TemporaryDirectory() as td:
        for k, ti in enumerate((0.3, 0.6)):
            w = os.path.join(td, f"{k}.wav")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{L * ti:.1f}", "-t", str(DOAN), "-i", f, "-ac", "1", "-ar", "16000", w], check=True, timeout=120)
            ds.append(w)
        r = subprocess.run([PY, "-I", "-c", "import sys, mlx_whisper\nfor w in sys.argv[1:]: print(mlx_whisper.transcribe(w, path_or_hf_repo=%r)['language'])" % MO_HINH, *ds],
                           capture_output=True, text=True, timeout=600)
    langs = [x.strip() for x in r.stdout.splitlines() if x.strip()]
    if r.returncode != 0 or not langs: raise RuntimeError(f"whisper không đọc được tiếng {f}: {r.stderr[-200:]}")
    lang = max(set(langs), key=langs.count)
    json.dump({"mtime": os.path.getmtime(f), "lang": lang, "doan": langs}, open(nho, "w"))
    return lang


def kiem(f, loc):
    """None khi đúng tiếng; chuỗi lỗi khi tiếng nói ≠ locale của phim"""
    can = (loc or "en").split("-")[0].lower(); co = doc(f)
    return None if co == can else f"tiếng gốc trong tập là '{co}' — phim locale '{can}' (creative {can.upper()} mà tiếng {co.upper()}): bỏ phim"


if __name__ == "__main__":
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    l = kiem(sys.argv[1], sys.argv[2]); print(l or f"đúng tiếng {doc(sys.argv[1])}"); sys.exit(1 if l else 0)
