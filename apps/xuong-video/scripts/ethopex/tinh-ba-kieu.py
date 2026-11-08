#!/usr/bin/env python3
"""BA KIỂU CREATIVE TĨNH MỚI — MẪU (anh 08/11/2026: "xem còn kiểu nào hay và ấn tượng giống ảnh tĩnh … làm trên phim khác mà đội đang lãi đi").
Dùng lại máy ảnh tĩnh (anh-tinh.py: tải 3 tập, khung AI chọn, tên phim từ poster, giọng, HD):
  tom_tat — video ảnh tĩnh như thường + CHỮ QC tóm tắt 3–4 câu kết bằng mốc xoay chuyển (kiểu Dramawave chạy 46 ngày trên spy)
  poster  — POSTER ĐỘNG: poster gốc của phim (đã vẽ để bán) phủ kín 9:16 (nền là chính poster làm mờ), phóng chậm + giọng
  cau_soc — CÂU THOẠI SỐC: khung cảm xúc mạnh nhất + một câu thoại nguyên văn gắt nhất (phụ đề đọc từ tập) in to + giọng đọc đúng câu đó rồi câu mời xem
Chữ AI viết ở box3 (chu-qc-anh-tinh.py, ckey). Dùng (iMac): python3 tinh-ba-kieu.py <content_id> [--kieu tom_tat,poster,cau_soc] [--ban N] [--xem = chỉ dựng, không nạp]  → ~/.cache/ethopex/anh-tinh/<id>/tinh-tom-tat.mp4 · poster-dong.mp4 · cau-thoai-soc.mp4 (chỉ dựng, không nạp)"""
import importlib.util, json, os, re, subprocess, sys
# TÊN CỐ ĐỊNH (anh 08/11/2026 "phải đặt tên cho rõ ràng phân biệt về sau") — dạng ghi vào etp.creative.dang + tên camp mang mã
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp")); import so_dang as DG   # SỔ DẠNG một nơi (etp-dang.json)
KIEU = {k: (x["dang"], x["dong"]) for k, x in DG.KIEU.items() if x.get("tinh")}   # kiểu → (dạng, mã dòng)
from PIL import Image, ImageDraw, ImageFilter, ImageFont

D = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("at", os.path.join(D, "anh-tinh.py")); AT = importlib.util.module_from_spec(_s); _s.loader.exec_module(AT)
_t = importlib.util.spec_from_file_location("tt", os.path.join(D, "tai-tap.py")); TT = importlib.util.module_from_spec(_t); _t.loader.exec_module(TT)
W, H = AT.W, AT.H

def thoai(tm):
    """phụ đề đọc được trên các khung đã trích (anh-tinh.khung) — mỗi dòng chữ dài ≥ 12 ký tự, không trùng"""
    kd = os.path.join(tm, "khung"); fs = sorted(os.path.join(kd, f) for f in os.listdir(kd) if f.endswith(".jpg"))[::2]
    ra = []
    for i in range(0, len(fs), 200):
        for l in subprocess.run([AT.may_doc(), *fs[i:i + 200]], capture_output=True, text=True, timeout=900).stdout.splitlines():
            for k in json.loads(l).get("khung") or []:
                t = re.sub(r"\s+", " ", k[0]).strip()
                if len(t) >= 12 and k[2] > 0.5 and t not in ra: ra.append(t)   # nửa dưới khung = phụ đề
    return ra

def mo_ta(url):
    try:
        h = TT.lay(url).decode("utf-8", "ignore")
        m = re.search(r'<meta[^>]+(?:property|name)="(?:og:)?description"[^>]+content="([^"]+)"', h)
        return TT.H.unescape(m.group(1)) if m else ""
    except Exception: return ""

def giong_cau(cid, lang, cau, kieu, tm):
    """giọng đọc một câu tuỳ ý — cùng đường ckey của anh-tinh.doc_giong, giữ thẻ cách đọc đầu mẫu của kiểu"""
    v, mau = AT.KIEU_GIONG[kieu]; return AT.doc_giong(cid, lang, v, mau.split("{a}")[0] + cau, tm)

def poster_dong(tm, ra_nen):
    """poster 3:4 → 9:16: nền = poster phóng kín + mờ + tối nhẹ, poster rõ nét đặt giữa, rộng trọn khung"""
    p = Image.open(os.path.join(tm, "poster.jpg")).convert("RGB"); s = max(W / p.width, H / p.height)
    nen = p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS); x, y = (nen.width - W) // 2, (nen.height - H) // 2
    nen = nen.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(28)).point(lambda v: int(v * 0.55))
    s2 = W / p.width; q = p.resize((W, round(p.height * s2)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=50, threshold=2))
    nen.paste(q, (0, (H - q.height) // 2)); nen.save(ra_nen); return ra_nen

def lop_cau(cau, tm, ra, mat_day):
    """câu thoại sốc: chữ trắng đậm trong ngoặc kép, viền đen, đặt dưới mặt; tên phim từ poster (nếu có) nhỏ bên dưới"""
    f, c = None, 96
    while True:
        f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Black.ttf", c); dong, cur = [], ""
        for w_ in f"“{cau}”".split():
            thu = f"{cur} {w_}".strip()
            if cur and f.getlength(thu) > W - 120: dong.append(cur); cur = w_
            else: cur = thu
        dong.append(cur)
        if len(dong) <= 4 or c <= 56: break
        c -= 6
    lh = int(c * 1.18); cao = lh * len(dong); y = int(min(max(H * 0.60 - cao / 2, mat_day + 50), H * 0.70 - cao))
    lop = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lop)
    for i, x in enumerate(dong):
        d.text(((W - f.getlength(x)) / 2, y + i * lh), x, font=f, fill=(255, 255, 255, 255), stroke_width=8, stroke_fill=(0, 0, 0, 255))
    tp = os.path.join(tm, "ten-poster.png")
    if os.path.exists(tp):
        t_ = Image.open(tp); s_ = min(W * 0.62 / t_.width, H * 0.11 / t_.height); t_ = t_.resize((round(t_.width * s_), round(t_.height * s_)), Image.LANCZOS)
        lop.paste(t_, ((W - t_.width) // 2, min(int(H * 0.80 - t_.height), y + cao + 40)), t_)
    lop.save(ra); return ra

def nap(cid, lang, f, dang, ghi, vnd, chu_dau=None):
    """một bản → thư viện etp (box3 thu-vien-them --them, mỗi bản một dòng) → id dòng thư viện"""
    xa = f"/var/tmp/anh-tinh/{cid}"; AT.sh("ssh", AT.B, f"mkdir -p {xa}"); AT.sh("rsync", "-a", f, f"{AT.B}:{xa}/", han=900)
    them = ""
    if chu_dau:
        t = f + ".chu.txt"; open(t, "w").write(chu_dau); AT.sh("scp", "-q", t, f"{AT.B}:{xa}/{os.path.basename(t)}"); them = f" --chu-dau-tep={xa}/{os.path.basename(t)}"
    r = AT.sh("ssh", AT.B, f"{AT.XV} scripts/ethopex/thu-vien-them.mts 0 {xa}/{os.path.basename(f)} --content={cid} --dang='{dang}' --nguon=tinh_ba_kieu --lang={lang} --chi-vnd={vnd} --ghi='{ghi}' --them{them}", han=600)
    if r.returncode != 0: raise RuntimeError(f"thư viện: {(r.stderr or r.stdout)[-200:]}")
    return int(AT.sql(f"select id from etp.thu_vien where content_id = {cid} and dang = '{dang}' and nguon = 'tinh_ba_kieu' and creative_id is null order by id desc limit 1") or 0)

# MẪU POSTER ĐỘNG (anh 08/11/2026 "PO đang dùng poster của nhà sản xuất nên chỉ có 1 mẫu. Tự thiết kế mới hoặc thêm bớt chi tiết… nhưng là dạng poster"):
# --ban N xoay vòng các mẫu dưới, mỗi bản một mẫu (ghi vào sổ điểm chạm để đo từng mẫu). Chỉ dùng poster gốc + khung phim AI đã xếp hạng + tên phim tách từ poster — không sinh ảnh AI.
MAU_PO = ["goc", "ghep", "the"]   # "dien_anh" anh KHÔNG duyệt (08/11/2026 "Nhìn lởm") — không xoay vào bản dựng
def _phu(im, w, h, cx=0.5, cy=0.5):   # phóng ảnh phủ kín w×h, giữ tâm (cx, cy)
    s = max(w / im.width, h / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = min(max(0, round(cx * im.width - w / 2)), im.width - w); y = min(max(0, round(cy * im.height - h / 2)), im.height - h); return im.crop((x, y, x + w, y + h))
def poster_mau(mau, tm, nen_khung, ra):
    """mẫu poster động → ảnh nền 1080×1920 (phóng chậm ở AT.dung). nen_khung = khung phim đã dựng 9:16 (AT.anh, mặt ở giữa ngang).
    Poster luôn hiện TRỌN (tên phim nằm sẵn trên poster — không chồng tên lần hai, không cắt chữ)."""
    if mau == "goc": return poster_dong(tm, ra)
    p = Image.open(os.path.join(tm, "poster.jpg")).convert("RGB"); q = p.resize((W, round(p.height * W / p.width)), Image.LANCZOS)
    if mau == "ghep":   # poster trọn ở trên · dải khung phim (cảnh trong phim, AI xếp hạng) ở đáy · nối bằng dải chuyển mềm
        kh = Image.open(nen_khung).convert("RGB"); cao = max(H - q.height + 260, round(H * 0.34))
        nen = Image.new("RGB", (W, H)); nen.paste(_phu(kh, W, cao, 0.5, 0.36), (0, H - cao))
        mk = Image.new("L", (1, q.height)); mk.putdata([255 if i < q.height - 260 else max(0, 255 - (i - (q.height - 260)) * 255 // 260) for i in range(q.height)])
        nen.paste(q, (0, 0), mk.resize(q.size)); nen.save(ra); return ra
    if mau == "the":    # khung phim làm nền (mờ, tối) · poster thu nhỏ như tấm thẻ viền trắng, nghiêng, đổ bóng
        nen = Image.open(nen_khung).convert("RGB").filter(ImageFilter.GaussianBlur(8)).point(lambda v: int(v * 0.55))
        r = round(W * 0.82); q2 = p.resize((r, round(p.height * r / p.width)), Image.LANCZOS); vien = 16
        the = Image.new("RGB", (q2.width + 2 * vien, q2.height + 2 * vien), (255, 255, 255)); the.paste(q2, (vien, vien)); the = the.convert("RGBA").rotate(-4, expand=True, resample=Image.BICUBIC)
        bong = Image.new("RGBA", the.size, (0, 0, 0, 0)); bong.putalpha(the.split()[3].point(lambda a: int(a * 0.75))); bong = bong.filter(ImageFilter.GaussianBlur(26))
        x, y = (W - the.width) // 2, (H - the.height) // 2; nen.paste((0, 0, 0), (x + 20, y + 30), bong); nen.paste(the, (x, y), the); nen.save(ra); return ra
    if mau == "dien_anh":   # (anh 08/11/2026 "4 sửa lại": bản cũ quá giống gốc) nửa trên CẬN MẶT nhân vật (khung phim), chỉnh màu teal-orange, rõ nét ·
        # nửa dưới poster TRỌN thu nhỏ (tên phim đọc được) trên nền tối · hai vạch sáng mảnh kiểu khung phim chiếu rạp
        def mau_(im):
            r_, g_, b_ = im.split(); im = Image.merge("RGB", (r_.point(lambda v: min(255, int(v * 1.12 + 8))), g_.point(lambda v: int(v * 0.97)), b_.point(lambda v: min(255, int(v * 0.84 + 28)))))
            return Image.blend(im, Image.new("RGB", im.size, (6, 22, 30)), 0.08)
        cao = round(H * 0.56); tren = mau_(_phu(Image.open(nen_khung).convert("RGB"), W, cao, 0.5, 0.38))   # cận mặt = khung phim AI xếp hạng (đã xoá chữ) — cắt phần trên poster thì dính tên phim dở (poster tên nằm cao).filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
        nen = mau_(_phu(p, W, H)).filter(ImageFilter.GaussianBlur(34)).point(lambda v: int(v * 0.35)); nen.paste(tren, (0, 0))
        mk = Image.new("L", (1, 200)); mk.putdata([int(255 * i / 199) for i in range(200)])   # mép dưới cận mặt tan vào nền
        nen.paste(Image.new("RGB", (W, 200)), (0, cao - 200), mk.resize((W, 200)))
        con = H - cao - 70; r = round(con * p.width / p.height); q2 = p.resize((r, con), Image.LANCZOS)
        x = (W - r) // 2; y = cao - 30; nen.paste((235, 235, 235), (x - 4, y - 4, x + r + 4, y + con + 4)); nen.paste(q2, (x, y))
        for yy in (cao - 46, H - 22): nen.paste((200, 170, 120), (60, yy, W - 60, yy + 3))
        nen.save(ra); return ra
    raise ValueError(f"mẫu poster lạ: {mau}")

def main(cid, kieu, ban=1, xem=False):
    p = AT.phim([cid])[0]; lang = "es" if str(p.get("locale")).startswith("es") else "en"; ten = AT.ten_sach(p["ten"])
    tm = os.path.join(AT.C, str(cid)); os.makedirs(tm, exist_ok=True); vnd = 0; kq = {"content_id": cid, "ban": []}
    uv = AT.khung(cid, p["url"], tm); uv, ly_ai, v_ai = AT.xep_ai(ten, uv) if len(uv) > 1 else (uv, "", 0); vnd += v_ai
    ks = list(AT.KIEU_GIONG); kg0 = AT.xoay_giong([p], None)[cid]
    if "tom_tat" in kieu or "cau_soc" in kieu:
        th = thoai(tm); md = mo_ta(p["url"])
        r = subprocess.run(["ssh", AT.B, f"{AT.ENV}; python3 apps/xuong-video/scripts/ethopex/chu-qc-anh-tinh.py"], input=json.dumps({"ten": ten, "lang": lang, "mo_ta": md, "thoai": th}),
                           capture_output=True, text=True, timeout=300)
        cq = json.loads(r.stdout.strip().splitlines()[-1]) if r.stdout.strip() else {"loi": r.stderr[-200:]}; vnd += int(cq.get("vnd") or 0)
        kq["chu"] = {**cq, "so_thoai": len(th)}
    tv = []
    for kk in kieu:
        dang, ma = KIEU[kk]
        for b in range(ban):
            kg = ks[(ks.index(kg0) + b) % len(ks)]; k = uv[b % len(uv)]; chu_dau = None
            try:
                if kk == "tom_tat":
                    ds = kq["chu"].get("tom_tat") or []
                    if not ds: raise RuntimeError("AI không viết được tóm tắt")
                    chu_dau = ds[b % len(ds)]
                    nen, chu = AT.anh(cid, ten, k, tm, b); mp3, v, _ = AT.giong(cid, lang, ten, kg, tm, b % len(AT.CAU[lang]))
                elif kk == "poster":
                    if not os.path.exists(os.path.join(tm, "poster.jpg")): raise RuntimeError("không có poster")
                    mau = MAU_PO[b % len(MAU_PO)]; nk = AT.anh(cid, ten, k, tm, b)[0] if mau != "goc" else None   # khung phim + tên tách từ poster cho mẫu ghép
                    nen = poster_mau(mau, tm, nk, os.path.join(tm, f"nen-poster-{mau}.png")); chu = os.path.join(tm, "trong.png"); Image.new("RGBA", (W, H)).save(chu)   # poster đã có tên phim
                    mp3, v, _ = AT.giong(cid, lang, ten, kg, tm, b % len(AT.CAU[lang]))
                else:
                    ds = kq["chu"].get("cau_soc") or []
                    if not ds: raise RuntimeError("AI không chọn được câu thoại sốc có trong phụ đề")
                    c = ds[b % len(ds)]; moi = (f"¡Mira {ten} gratis ahora!" if lang == "es" else f"Watch {ten} for free now!")
                    nen, _ = AT.anh(cid, ten, k, tm, b); mp3, v = giong_cau(cid, lang, f"{c} ... {moi}", kg, tm)
                    chu = lop_cau(c, tm, os.path.join(tm, f"chu-cau-{b}.png"), (k["mat"][1] + k["mat"][3]) * H)
                vnd += v; out = os.path.join(tm, f"{ma.lower()}-{cid}-{b + 1}.mp4"); giay = AT.dung(nen, chu, mp3, out)
                x = {"kieu": ma, "dang": dang, "ban": b + 1, "file": out, "giay": giay, "giong": kg, "vnd": v, "tap": k["tap"], "khung_so": k["so"], "ten_poster": bool(k.get("ten_poster")),
                     **({"chu_dau": chu_dau} if chu_dau else {}), **({"cau": c} if kk == "cau_soc" else {}), **({"mau": mau} if kk == "poster" else {})}
                if not xem:
                    ghi = f"{dang} ({ma}){' mẫu ' + mau if kk == 'poster' else ''} bản {b + 1}/{ban} · giọng {kg} · khung {k['tap']}#{k['so']} AI xếp hạng · tên {'từ poster' if k.get('ten_poster') or kk == 'poster' else 'chữ vàng'}"
                    x["tv"] = nap(cid, lang, out, dang, ghi, v, chu_dau); tv.append(x)
                kq["ban"].append(x)
            except Exception as e: kq["ban"].append({"kieu": ma, "ban": b + 1, "loi": str(e)[-300:]})
    kq["vnd"] = vnd; print(json.dumps(kq, ensure_ascii=False), flush=True)
    if tv:   # thư viện → creative (đẩy kho + chữ QC + Ethopex bulk-jobs) — dòng "→ creative #N" để máy dòng phim nhận
        subprocess.run(["python3", os.path.join(D, "thu-vien-len.py"), *[str(x["tv"]) for x in tv]])
        for x in tv:   # dấu kiểu / giọng / câu vào sổ điểm chạm (đo hiệu suất từng kiểu về sau)
            print(f"dấu {x['kieu']} tv{x['tv']} →", AT.danh_dau(x["tv"], x["giong"], lang, ten, 0, {**x, "ten_poster": x["ten_poster"]}) or "(chưa thành creative)")

if __name__ == "__main__":
    a = sys.argv[1:]; ki = a[a.index("--kieu") + 1].split(",") if "--kieu" in a else ["tom_tat", "poster", "cau_soc"]
    main(int(a[0]), ki, int(a[a.index("--ban") + 1]) if "--ban" in a else 1, "--xem" in a)
