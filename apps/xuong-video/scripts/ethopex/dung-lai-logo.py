#!/usr/bin/env python3
"""DỰNG LẠI CREATIVE ẢNH ĐỘNG (dt_anh_dong_logo) CÓ LOGO CŨ BẰNG LOGO BẢN HIỆN HÀNH (anh 27/11/2026: "Tất cả phim Undercover King đều bị lỗi cắt logo…
sửa phải hiểu là sửa hàng loạt" → "bố mày vẫn thấy hình cũ"): creative dựng trước khi Huy nâng dung-mau.LOGO_BAN lên 6 mang logo tách kiểu cũ (cụt chữ).
Dựng lại ĐÚNG khung + ĐÚNG clip AI đã trả tiền (dong-<mẫu>-N.jpg khớp khung, 0₫) + đúng kiểu giọng / câu đọc của bản cũ, chỉ vẽ lại lớp chữ (logo_goc bản mới).
Không khớp clip đã trả → bỏ bản đó, KHÔNG gửi AI chuyển động.
Chạy (iMac, ~/.venvs/poster-mau/bin/python):
  dung-lai-logo.py <tv cũ> … [--nap] [--tra-ai]
    --tra-ai: clip cũ đã mất → sinh một clip chuyển động mới (~800₫ / bản)
    không --nap: dựng mp4 + ảnh soát (<tm>/lai-<tv>.mp4, lai-<tv>-soat.jpg), in JSON — chưa nạp gì
    --nap: nạp thư viện + tải creative (thu-vien-len.py) → in {tv_cu, cr_cu, tv, cr}; ghi sổ thay / loại bản cũ làm ở box3 sau khi soát
tra-repo-ok: mã dán keo nội bộ (gọi lại hàm dung-mau)."""
import glob, importlib.util, json, os, re, subprocess, sys
from PIL import Image, ImageChops, ImageStat
D = os.path.dirname(os.path.abspath(__file__))
s_ = importlib.util.spec_from_file_location("dung_mau", os.path.join(D, "dung-mau.py")); DM = importlib.util.module_from_spec(s_); s_.loader.exec_module(DM)
AT, TB = DM.AT, DM.TB
MA = "dt_anh_dong_logo"
TRA_AI = "--tra-ai" in sys.argv

def lech(a, b):
    a, b = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    return 999 if a.size != b.size else sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3

def mot(tv, nap):
    r = AT.sql(f"select content_id || E'\\t' || coalesce(creative_id::text, '') || E'\\t' || ghi from etp.thu_vien where id = {int(tv)}")
    if not r: raise SystemExit(f"tv{tv}: không có trong thư viện")
    cid, cr_cu, ghi = r.split("\t", 2); cid = int(cid)
    if not ghi.startswith(f"mẫu:{MA} "): raise SystemExit(f"tv{tv}: không phải mẫu {MA}")
    kh = re.search(r"khung (\S+)", ghi).group(1); ban = int(re.search(r"bản (\d+)", ghi).group(1)); kg = re.search(r"giọng (\S+)", ghi).group(1)
    p, lang, ten, tm = DM.ngu_canh(cid); p["the_loai"] = p.get("the_loai") or ""
    # đọc thẳng xem-uv.json (doc_uv đòi đủ ảnh nhỏ khung/ — máy dọn ổ xoá khung/ sau bản dựng; chỉ cần <tap>.mp4 để trích lại khung gốc)
    try: uv = json.load(open(os.path.join(tm, "xem-uv.json"))).get("uv") or []
    except Exception: uv = []
    k = next((u for u in uv if f"{u['tap']}#{u['so']}" + ("~lat" if u.get("lat") else "") == kh), None)
    if not k: raise SystemExit(f"tv{tv}: khung {kh} không còn trong xem-uv.json của phim")
    k = json.loads(json.dumps(k)); k["lang"] = lang; nb = 500 + int(tv) % 400
    AT.CO_FREE, cu = False, AT.CO_FREE
    try: nen, _ = AT.anh(cid, ten, k, tm, nb)
    finally: AT.CO_FREE = cu
    goc = os.path.join(tm, f"goc-{nb}.png"); mats = []
    try: mats = [(m[1] * DM.H, (m[1] + m[3]) * DM.H) for m in (AT.doc_mat([goc], 300) or [{}])[-1].get("mat") or [] if m[4] >= 0.45 and m[3] >= 0.05]
    except Exception as e: print("đọc mặt lỗi:", e, file=sys.stderr)
    c = {"ma": MA, "cid": cid, "p": p, "lang": lang, "ten": ten, "tm": tm, "nen": nen, "goc": goc, "goc_khac": [], "mats": mats,
         "mat_day": (k["mat"][1] + k["mat"][3]) * DM.H, "mat_tam": k["mat"][1] + k["mat"][3] / 2, "cau": "", "nhan": "", "cta": ""}
    nen2, lop = DM.HAM[MA](c); nen = nen2 or nen
    # clip đã trả tiền của đúng khung này (so khung sạch với mọi dong-<mẫu>-N.jpg) — không có thì dừng, không gửi AI
    ds = sorted((lech(j, nen), j) for j in glob.glob(os.path.join(tm, f"dong-{MA}-[0-9]*.jpg")) if os.path.exists(j[:-4] + ".mp4"))
    vnd_dong = 0
    if ds and ds[0][0] < 1.0: clip = ds[0][1][:-4] + ".mp4"
    elif TRA_AI:   # clip cũ đã bị lượt sau ghi đè (dong-<mẫu>-<b> đánh số theo bản) → một clip mới (~800₫), tệp mang số tv để không đè clip khác
        clip, vnd_dong = DM.chuyen_dong(nen, tm, cid, MA, int(tv))
    else: raise SystemExit(f"tv{tv}: không có clip đã trả tiền khớp khung {kh} (lệch gần nhất {ds[0][0] if ds else '-'}) — không dựng để khỏi tốn AI (thêm --tra-ai để sinh clip mới ~800₫)")
    chu = os.path.join(tm, f"chu-lai-{tv}.png"); lop.save(chu)
    so_cau = (ban - 1) % len(AT.CAU[lang]); mp3, vnd, _ = AT.giong(cid, lang, ten, kg, tm, so_cau)
    nhip = None
    if c.get("_nut"):
        t_cta = max(DM.DONG_HIEN + 0.5, DM.GIONG_TRE + DM.moc_cta(mp3, AT.CAU[lang][so_cau][2])); nhip = (*DM.nhip_nut(c, tm, 900 + int(tv) % 100), t_cta)
    out = os.path.join(tm, f"lai-{tv}.mp4"); giay = DM.dung_dong(clip, chu, mp3, out, nhip)
    soat = out[:-4] + "-soat.jpg"; subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(DM.DONG_HIEN + 1, giay - 1.5):.2f}", "-i", out, "-frames:v", "1", "-vf", "scale=540:-2", soat])
    kq = {"tv_cu": int(tv), "cr_cu": int(cr_cu) if cr_cu else None, "khung": kh, "clip": os.path.basename(clip), "lech": round(ds[0][0], 2) if ds else None, "giay": giay, "vnd": vnd + vnd_dong, "file": out, "soat": soat}
    if nap:
        dang = next(x for x in DM.SO if x["ma"] == MA)["dung_cho"][0]
        g = re.sub(r" · giọng \S+$", "", ghi) + f" · logo bản {DM.LOGO_BAN} thay #{cr_cu} · giọng {kg}"
        t = TB.nap(cid, lang, out, dang, g.replace("'", "’"), vnd + vnd_dong, None)
        if not t: raise SystemExit(f"tv{tv}: nạp thư viện không ra mã")
        subprocess.run(["python3", os.path.join(D, "thu-vien-len.py"), str(t)], check=False)
        kq |= {"tv": t, "cr": int(AT.sql(f"select coalesce(creative_id::text, '0') from etp.thu_vien where id = {int(t)}") or 0)}
    print(json.dumps(kq, ensure_ascii=False), flush=True); return kq

if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if not a: raise SystemExit(__doc__)
    loi = 0
    for tv in a:
        try: mot(int(tv), "--nap" in sys.argv)
        except SystemExit as e: print(f"✗ {e}", flush=True); loi += 1
    sys.exit(1 if loi else 0)
