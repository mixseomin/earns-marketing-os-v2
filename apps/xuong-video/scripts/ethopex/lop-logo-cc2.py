"""LỚP LOGO CỦA DẠNG CC2 (anh 26/11/2026: "CC phải dùng dạng CC kết hợp với cách lên của Kiên. Cc phải luôn dùng logo cắt đẹp như AD. Đặt tên loại CC2 … Cc2 ko cần caption trên màn hình").
Thay ô chữ tên phim cuối đoạn cắt (cat-canh.the_ten) bằng: logo gốc tách từ poster (dung-mau.logo_goc — đúng hàm của AD) + nút CTA cùng bảng màu logo (dung-mau.nut_logo).
+ nhãn trên cùng "All Episodes Released" (dung-mau.nhan_logo — đúng hàm của AD; anh 26/11/2026 "CC2 cũng phải có đoạn ALL EPISODES"). Một ảnh RGBA 1080×1920 / phim / ngôn ngữ; cat-canh.dung_tap / ghep-lai-cc2.py ghép đuôi bằng duoi_cc2.ghep (env ETP_LOGO); kèm khung nút nảy <ảnh ra không đuôi>-nhip/.
Chạy (iMac, ~/.venvs/poster-mau/bin/python):  lop-logo-cc2.py <thư mục phim> <content_id> <tên phim> <locale> <link phim> <ảnh ra>
In một dòng JSON {out, vnd, kieu} — vnd = tiền AI tách logo (0 khi logo đã nhớ). Không tách được logo → mã 1, kêu to (không lùi về chữ vẽ).
tra-repo-ok: mã dán keo nội bộ (gọi lại hàm vẽ của dung-mau.py)."""
import importlib.util, json, os, sys
D = os.path.dirname(os.path.abspath(__file__))
def _nap(ten, tep):
    s = importlib.util.spec_from_file_location(ten, os.path.join(D, tep)); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
DM = _nap("dung_mau", "dung-mau.py")
NUT_CC2 = DM.CQ.NUT_FREE   # nút CC2 luôn mang chữ Free (anh 27/11/2026 "Khi sinh creative phải có phần chữ Free trong video")

def lam(tm, cid, ten, lang, url, ra):
    lang = "es" if lang == "es" else "en"; chu = NUT_CC2[lang]
    if DM.CQ.sai_luat(chu): raise SystemExit(f"CTA CHAN: {chu!r}")
    # mặt trong đoạn cắt chuyển động (không đo từng khung) → giữ logo + nút ở nửa dưới (dải LOGO_VUNG_DONG từ 50% xuống), như ô tên phim kiểu Kiên ở đáy khung
    c = {"tm": tm, "ten": ten, "cid": str(cid), "lang": lang, "p": {"url": url}, "mat_day": int(DM.H * 0.40)}
    lop, day = DM._lop_logo(c, DM.NUT_DONG, DM.LOGO_CAO_DONG, DM.LOGO_VUNG_DONG)
    lg, kieu = DM.logo_goc(c)
    pal = DM.bang_mau_logo(lg); DM.nut_logo(lop, chu, day + DM.NUT_CACH, pal)
    DM.nhan_logo(lop, c, pal)   # nhãn "ALL EPISODES RELEASED" như AD (anh 26/11/2026 "CC2 cũng phải có đoạn ALL EPISODES")
    lop.save(ra)
    # NÚT NẢY ĐÚNG FORM AD (anh 26/11/2026 "Nút CTA phải có điểm nhấn, dùng lại form của AD"): khung dung-mau.nhip_nut cho đúng nút vừa vẽ → <ra không đuôi>-nhip/ + .json (x, y);
    # duoi_cc2.ghep lặp khung này tới hết video
    import shutil
    c["_nut"] = (pal, chu, day + DM.NUT_CACH); g = os.path.splitext(ra)[0] + "-nhip"
    d, x, y = DM.nhip_nut(c, os.path.dirname(os.path.abspath(ra)), "cc2-tam"); shutil.rmtree(g, True); shutil.move(d, g)
    json.dump({"x": x, "y": y}, open(g + ".json", "w"))
    return {"out": ra, "vnd": DM._CHI_LOGO[0], "kieu": kieu, "nhip": g}

if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) != 6: raise SystemExit(__doc__)
    try: print(json.dumps(lam(*a), ensure_ascii=False))
    except SystemExit: raise
    except Exception as e: print(f"LOGO CC2 LỖI: {e}", file=sys.stderr); sys.exit(1)
