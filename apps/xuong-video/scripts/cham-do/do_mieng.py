"""ĐO MIỆNG BẰNG HÌNH — canh giọng theo miệng THẬT trong clip (anh 15/11/2026, phim #3071 shot #4: Seedance chép tiếng đúng chỗ nhưng miệng vẽ trễ ~0,8 s;
canh theo tiếng clip không bắt được). Chạy trên iMac (Grounding DINO của cham_do.py, 0đ):
  1. tách khung clip 8 / giây (ffmpeg, iMac)
  2. mỗi khung: Grounding DINO tìm "mouth" (không thấy thì nửa dưới hộp "face"), cắt vùng miệng → độ MỞ MIỆNG = tỉ lệ điểm ảnh tối trong vùng (lòng miệng tối)
     + độ ĐỘNG = chênh lệch với khung trước
  3. đường mở miệng ↔ đường âm lượng của câu thoại (đặt ở giây t trong clip) → tương quan chuẩn hoá, tìm độ trễ trong ±1,5 s
In một dòng JSON {lech, tq, mieng: […]} — lech > 0 = miệng mở TRỄ hơn câu. Script gọi: thu-seedance-cum.mts (qua ssh từ box không được — chạy tay trên iMac
hoặc từ cum-seedance-tap.sh).
  ~/.venvs/cham-do/bin/python apps/xuong-video/scripts/cham-do/do_mieng.py --video <url|tệp> --cau <url mp3>@<giây t> [--cau …] [--ra json]
"""
import argparse, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
FPS = 8


def khung(video: str, thu: str) -> list[str]:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'fps={FPS}', f'{thu}/k%04d.png'], check=True)
    return sorted(os.path.join(thu, f) for f in os.listdir(thu) if f.startswith('k'))


def am_luong(url: str) -> np.ndarray:
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', url, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], capture_output=True, check=True).stdout
    x = np.abs(np.frombuffer(b, dtype=np.int16).astype(float)); buoc = 8000 // FPS
    return np.array([x[i * buoc:(i + 1) * buoc].mean() for i in range(len(x) // buoc)])


def mieng(may, anh: Image.Image) -> tuple[np.ndarray | None, list | None]:
    kq = may.do(anh, ['mouth', 'face'])
    m = max((k for k in kq if 'mouth' in k[0]), key=lambda k: k[1], default=None)
    if m:
        return m[2], m
    f = max((k for k in kq if 'face' in k[0]), key=lambda k: k[1], default=None)
    if not f:
        return None, None
    x0, y0, x1, y1 = f[2]
    return [x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.6, x1 - (x1 - x0) * 0.25, y1], f


def tuong_quan(a: np.ndarray, b: np.ndarray, t0: int, khoang: int) -> tuple[float, float]:
    """Độ trễ (khung) của mẫu b trong a quanh t0, tương quan chuẩn hoá cao nhất."""
    tot = (0, -2.0); n = len(b); bb = b - b.mean(); sb = np.sqrt((bb ** 2).sum()) or 1
    for d in range(-khoang, khoang + 1):
        i0 = t0 + d
        if i0 < 0 or i0 + n > len(a):
            continue
        aa = a[i0:i0 + n] - a[i0:i0 + n].mean(); tq = float((aa * bb).sum() / ((np.sqrt((aa ** 2).sum()) or 1) * sb))
        if tq > tot[1]:
            tot = (d, tq)
    return tot[0] / FPS, tot[1]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--video', required=True); ap.add_argument('--cau', action='append', required=True); ap.add_argument('--ra', default='')
    a = ap.parse_args()
    from cham_do import May
    may = May()
    with tempfile.TemporaryDirectory() as thu:
        ds = khung(a.video, thu); mo = []; truoc = None
        for f in ds:
            anh = Image.open(f).convert('RGB'); W, H = anh.size; hop, _ = mieng(may, anh)
            if not hop:
                mo.append(np.nan); truoc = None; continue
            x0, y0, x1, y1 = hop; c = np.asarray(anh.crop((int(x0 * W), int(y0 * H), max(int(x1 * W), int(x0 * W) + 2), max(int(y1 * H), int(y0 * H) + 2))).convert('L').resize((32, 16)), dtype=float)
            toi = float((c < np.percentile(c, 25) * 0.8 + 10).mean())   # lòng miệng tối
            dong = float(np.abs(c - truoc).mean()) / 255 if truoc is not None else 0.0
            mo.append(toi + dong); truoc = c
    mo = np.array(mo); mo = np.where(np.isnan(mo), np.nanmean(mo) if np.isfinite(np.nanmean(mo)) else 0, mo)
    lech = []
    for c in a.cau:
        url, t = c.rsplit('@', 1); al = am_luong(url)
        if not len(al):
            continue
        # ĐIỂM BẮT ĐẦU (15/11/2026: tương quan trên câu ngắn ~7 điểm chọn sai đỉnh — báo 0,125 s khi miệng trễ thật ~0,8 s): miệng mở = vượt nền (trung vị + 3 × MAD,
        # tối thiểu +0,04) lần đầu trong [t − 0,5 s, t + 1,5 s]; câu bắt đầu = âm lượng > 15 % đỉnh. phu = phần thời gian câu có miệng mở (sau khi bù trễ).
        nen = float(np.median(mo)); mad = float(np.median(np.abs(mo - nen))) or 0.01; nguong = nen + max(3 * mad, 0.04)
        bd_am = next((i for i, x in enumerate(al) if x > 0.15 * al.max()), 0) / FPS; t_cau = float(t) + bd_am
        i0, i1 = max(0, int((t_cau - 0.5) * FPS)), min(len(mo), int((t_cau + 1.5) * FPS))
        bd_m = next((i / FPS for i in range(i0, i1) if mo[i] > nguong), None)
        if bd_m is None:
            lech.append({'cau': url[-24:], 't': float(t), 'lech': None, 'phu': 0.0, 'loi': 'không thấy miệng mở quanh câu'}); continue
        l = bd_m - t_cau; dai = int(round((al > 0.15 * al.max()).sum()))
        phu = float(np.mean([mo[int((t_cau + l) * FPS) + k] > nguong for k in range(dai) if int((t_cau + l) * FPS) + k < len(mo)])) if dai else 0.0
        l2, tq = tuong_quan(mo, al, int(round(float(t) * FPS)), int(1.5 * FPS))
        lech.append({'cau': url[-24:], 't': float(t), 'lech': round(l, 3), 'phu': round(phu, 2), 'nguong': round(nguong, 3), 'tq_cu': round(tq, 2)})
    out = {'lech': lech, 'mieng': [round(float(x), 3) for x in mo]}
    print(json.dumps(out, ensure_ascii=False))
    if a.ra:
        open(a.ra, 'w').write(json.dumps(out, ensure_ascii=False))


if __name__ == '__main__':
    main()
