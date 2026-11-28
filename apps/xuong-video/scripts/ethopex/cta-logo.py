#!/usr/bin/env python3
# tra-repo-ok: mã dán keo nội bộ — ghép lại các hàm thẻ cuối AD đã có trong dung-mau.py (logo gốc, nút màu logo, nút nảy, VideoExpress), không viết cơ chế mới
"""THẺ CUỐI KIỂU AD CHO VIDEO KỂ CHUYỆN (KT) — anh 27/11/2026: "CTA dùng loại của AD làm chuẩn : logo + button động".

Thân KT (bản xuất studio, chưa thẻ cuối) + đoạn cuối dựng ĐÚNG như mẫu ảnh động logo (dt_anh_dong_logo của dung-mau.py):
khung sạch cảnh cuối → VideoExpress chuyển động (0₫) → logo gốc của phim + nhãn "All Episodes Released" + nút màu logo,
nút nảy đúng lúc giọng đọc câu CTA. Không vẽ chữ mới: chữ nút / nhãn / câu giọng đều lấy từ sổ (etp-mau-cr.json).

  ~/.venvs/poster-mau/bin/python cta-logo.py <than.mp4> <content_id> <khung-sach.png> <ra.mp4> [--so-cau N]

Chạy trên iMac (dựng video cấm trên box3). In dòng cuối `CTA_LOGO: {json}` (giây, ₫, che mặt).
"""
import importlib.util, json, os, sys
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("dung_mau", os.path.join(D, "dung-mau.py")); DM = importlib.util.module_from_spec(_s); _s.loader.exec_module(DM)
AT, W, H = DM.AT, DM.W, DM.H
HIEN = 0.3   # thẻ cuối nối sau thân phim: lớp logo hiện gần như ngay (mẫu AD đứng riêng thì chờ 1,5s cho người xem nhìn cảnh)


def dai(f): return float(AT.sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f).stdout)


def main(than, cid, khung, ra, so_cau=0):
    p, lang, ten, tm = DM.ngu_canh(cid)
    ng = AT.sql(f"select coalesce(nhom_goc, '') from etp.phim where content_id = {int(cid)}")   # chỉ phim Âu-Mỹ (anh 29/10 + 28/11/2026) — chặn trước khi tốn AI / VE
    if ng != "au_my": raise SystemExit(f"phim #{cid} nhóm gốc '{ng or 'chưa chấm'}' — chỉ dựng phim Âu-Mỹ (etp.phim.nhom_goc)")
    pj = os.path.join(tm, "poster.jpg")
    TT = DM._nap("tai_tap", "tai-tap.py")
    # logo gốc tách từ poster CÔNG KHAI của trang phim (og:image) — poster studio không mang logo, logo rơi về kiểu dải (166081, 27/11/2026).
    # Tải qua tai_poster (Referer + kiểm chữ ký ảnh): curl trơn trước đây ghi trang chặn HTML làm poster.jpg (88090, 28/11/2026) → KT chết ở bước này mãi.
    if not TT.poster_tot(pj) and p.get("url"):
        try: TT.tai_poster(TT.mo_rong(p["url"]), tm)
        except Exception as e: print(f"poster phim #{cid}: {e}", file=sys.stderr)
    if not TT.poster_tot(pj): raise SystemExit(f"thiếu {pj} — không lấy được poster công khai của phim (logo gốc tách từ đó)")
    goc = os.path.join(tm, "kt-goc.png")
    im = Image.open(khung).convert("RGB"); k = max(W / im.width, H / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H)).save(goc)
    jm = (AT.doc_mat([goc], 300) or [{}])[-1]
    mats = [(m[1] * H, (m[1] + m[3]) * H) for m in jm.get("mat") or [] if m[4] >= 0.45 and m[3] >= 0.05]
    c = {"ma": "dt_anh_dong_logo", "cid": cid, "p": p, "lang": lang, "ten": ten, "tm": tm, "nen": goc, "goc": goc, "goc_khac": [], "mats": mats,
         "mat_day": max([b for _, b in mats] or [H * 0.45]), "mat_tam": 0.3, "cau": "", "nhan": "", "cta": ""}
    vnd = 0
    _, lop = DM.dt_anh_dong_logo(c); vnd += DM._CHI_LOGO[0]; DM._CHI_LOGO[0] = 0
    cm = DM.che_mat(lop, DM.mat_tren(goc))
    if cm > DM.CHE_MAT_TOI_DA: raise SystemExit(f"chữ phủ {cm:.0%} hộp mặt (chuẩn ≤ {DM.CHE_MAT_TOI_DA:.0%}) — chọn khung cuối khác")
    chu = os.path.join(tm, "kt-chu.png"); lop.save(chu)
    Image.alpha_composite(Image.open(goc).convert("RGBA"), lop).convert("RGB").save(os.path.join(tm, "kt-xem.jpg"), quality=88)
    kg, ng = AT.giong_phim(p)
    so_cau %= len(AT.CAU[lang]); mp3, v, _ = AT.giong(cid, lang, ten, kg, tm, so_cau, hook=False); vnd += v   # KT: thân phim ĐÃ kể chuyện → giọng thẻ cuối chỉ là lời mời, không chèn hook cốt truyện (8479: hook đẩy thẻ cuối lên 21s)
    print(f"giọng CTA: {kg} · {ng} · câu {so_cau} · {v}₫", flush=True)
    clip, v = DM.chuyen_dong(goc, tm, cid, "kt_logo", 0); vnd += v
    DM.DONG_HIEN = HIEN; AT.GIAY_MIN = 0   # dung_dong: lớp phủ hiện ở HIEN, độ dài = giọng + 1,4s (không kéo tới 10s như mẫu đứng riêng)
    t = max(HIEN + 0.5, DM.GIONG_TRE + DM.moc_cta(mp3, AT.CAU[lang][so_cau][2]))
    cuoi = os.path.join(tm, "kt-cuoi.mp4"); L = DM.dung_dong(clip, chu, mp3, cuoi, (*DM.nhip_nut(c, tm, 0), t))
    # ghép: thân giữ tiếng gốc (giọng kể + nhạc), đoạn cuối mang giọng CTA — cùng khổ / nhịp khung / mẫu tiếng trước khi nối
    chuan = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1,format=yuv420p"
    am = "aformat=sample_rates=44100:channel_layouts=stereo"
    r = AT.sh("ffmpeg", "-v", "error", "-y", "-i", than, "-i", cuoi, "-filter_complex",
              f"[0:v]{chuan}[v0];[0:a]{am}[a0];[1:v]{chuan}[v1];[1:a]{am}[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
              "-map", "[v]", "-map", "[a]", *AT.MA_HOA, "-b:a", "160k", ra)
    if r.returncode != 0: raise SystemExit(f"ffmpeg ghép: {r.stderr[-300:]}")
    kq = {"ra": ra, "giay": round(dai(ra), 2), "than": round(dai(than), 2), "cuoi": L, "nut_nay": round(t, 2), "vnd": vnd, "che_mat": round(cm, 3), "giong": kg}
    print("CTA_LOGO: " + json.dumps(kq, ensure_ascii=False), flush=True)
    return kq


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if len(a) != 4: raise SystemExit(__doc__)
    so = int(sys.argv[sys.argv.index("--so-cau") + 1]) if "--so-cau" in sys.argv else 0
    if "--so-cau" in sys.argv: a = [x for x in a if x != str(so)]
    main(a[0], int(a[1]), a[2], a[3], so)
