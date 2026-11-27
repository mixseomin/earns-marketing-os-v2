#!/usr/bin/env python3
"""LOGO GỐC CỦA PHIM tách từ poster — bước chuẩn của mẫu creative "Logo gốc của phim" (dung-mau.py › dt_logo_chat_lieu).
Anh 20/11/2026: "Vấn đề về vị trí chữ, cắt rồi ghép thì sao ? Hãy chuẩn hoá cho mẫu creative này trước". Bản trước (anh-tinh.ten_poster) giữ điểm ảnh theo
MÀU CHỮ CHÍNH nên rụng mọi thứ khác màu của logo (American Sniper: mất tâm ngắm đỏ) và còn vụn nền. Ở đây tách theo ĐỘ LỆCH SO VỚI NỀN:
  1. máy đọc chữ của macOS (Vision, chạy tại máy, 0₫, không gọi mô hình AI) tìm các dòng chữ là tên phim trên poster
  2. vùng logo = hộp các dòng đó nới ra theo chiều cao dòng (hoạ tiết của logo thường thò ra ngoài hộp chữ); chữ KHÁC trên poster (nhãn ReelShort…) bị loại
  3. nền dưới logo ước từ vành quanh vùng (trung bình có trọng số, mượt) → điểm nào lệch nền rõ = thuộc logo, GIỮ NGUYÊN màu gốc của poster
  4. chỉ giữ các mảng dính / sát khối chữ tên phim; mảng rời xa = nền, bỏ
  5. cổng chất lượng của bản CẮT RỜI: nét phủ 10–62% hộp chữ, phần ngoài khối chữ ≤ 15%, mỗi dòng tên còn nét trên ≥ 85% bề ngang (không rụng chữ)
  6. trượt cổng mà bên gọi đưa hàm nen_sach → TẦNG AI: mô hình ảnh rẻ nhất xoá chữ khỏi poster, logo = chỗ poster gốc lệch nền sạch đó (cùng cổng chất lượng)
  7. vẫn trượt (nền poster dưới logo rối — thử 30 poster 20/11/2026: khoảng 2/3 số phim) → bản DẢI: lấy NGUYÊN dải poster chứa logo (logo + nền của chính nó,
     không cắt nét nào), bỏ phần có nhãn nền tảng, bốn mép mờ dần để hoà vào khung. Hai bản đều là logo gốc; không bản nào vẽ lại chữ.
Chạy tay để soát: logo-goc.py <poster.jpg> "<tên phim>" <ra.png>
tra-repo-ok: bước xử lý ảnh nội bộ của máy dựng (numpy + scipy có sẵn trong venv poster-mau), thay một hàm đang có
"""
import importlib.util, json, os, re, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

D = os.path.dirname(os.path.abspath(__file__))
NOI_LAN = 3   # số lần nới vùng cắt khi nét logo chạm mép (mỗi lần một cao dòng, chỉ cạnh bị chạm) — 26/11/2026 #116378 mất chữ KING
NHAN = {"reelshort", "dramabox", "shortmax", "goodshort", "flextv", "exclusive", "exclusivo", "exclusiva", "original", "originals", "originales"}   # nhãn nền tảng trên poster — không thuộc logo phim, không mang vào creative
_at = None
def AT():
    global _at
    if _at is None:
        s = importlib.util.spec_from_file_location("anh_tinh", os.path.join(D, "anh-tinh.py")); _at = importlib.util.module_from_spec(s); s.loader.exec_module(_at)
    return _at

def tach_nen(rgb):
    """BiRefNet (rembg, model birefnet-general-lite 214MB tải một lần về ~/.rembg; bản đầy đủ 970MB làm iMac 16GB nghẽn, chất lượng logo tương đương) → lớp tiền cảnh 0..1 của một vùng ảnh. Chạy trong TIẾN TRÌNH RIÊNG: model giữ nhiều GB RAM,
    để nó nằm lại trong tiến trình dựng thì máy đọc chữ (Vision) gọi sau đó nghẽn > 120 giây (đo 20/11/2026) — xong một vùng là thoát, trả RAM. iMac CPU 10–140 giây / vùng, một lần / phim."""
    import tempfile
    with tempfile.TemporaryDirectory() as tm:
        vao, ra = os.path.join(tm, "vao.png"), os.path.join(tm, "ra.png"); Image.fromarray(rgb.astype(np.uint8)).save(vao)
        r = subprocess.run([sys.executable, os.path.abspath(__file__), "--nen", vao, ra], capture_output=True, text=True, timeout=900, env={**os.environ, "OMP_NUM_THREADS": "4"})
        # HÂM NÓNG máy đọc chữ: BiRefNet ép bộ nhớ (≈ 6 GB trên iMac 16 GB) làm Vision bị đẩy khỏi RAM, lượt đọc chữ đầu tiên sau đó mất 20 giây tới hơn 2 phút — các bước dựng
        # kế tiếp gọi máy đọc với hạn 120 giây sẽ rớt (đo 20/11/2026, phim 167274). Gọi một lượt ở đây với hạn dài, bỏ kết quả.
        try: subprocess.run([AT().may_doc(), vao], capture_output=True, timeout=600)
        except Exception as e: print("hâm nóng máy đọc chữ sau BiRefNet lỗi:", e, file=sys.stderr)
        if not os.path.exists(ra): raise RuntimeError(f"BiRefNet không ra lớp nền: {(r.stderr or r.stdout)[-200:]}")
        return np.asarray(Image.open(ra).convert("L")).astype(np.float32) / 255

# CHUẨN TÁCH NỀN LOGO (anh 20/11/2026 "Đẹp hẳn. Sửa thành chuẩn tách nền"): poster nền rối → ảnh KHOÁ MÀU. MỘT hàm gọi mô hình ảnh cho mọi máy (máy dựng theo mẫu, dòng ảnh tĩnh):
# mô hình ảnh rẻ nhất của cổng chung giữ nguyên logo, tô phần còn lại hồng phẳng; nhớ tệp ra (MỘT lần / phim). → (đường dẫn, tiền ₫ lượt này — 0 nếu đã có)
DE_LOGO_KHOA = ("Edit this movie poster. Keep the movie TITLE LOGO exactly as it is: same letters, same font, same colors, same ornaments, same size and same position. "
    "Replace absolutely everything else in the image (people, background, other small text and app labels) with one flat solid pure magenta color #FF00FF. "
    "No shadows, no glow, no gradient on the magenta. The result is only the unchanged title logo on a flat magenta background.")
def anh_khoa(link, ra, ma=""):
    import base64, urllib.request, urllib.error
    if os.path.exists(ra) and os.path.getsize(ra) > 20000: return ra, 0
    if not link: raise RuntimeError("không có link poster công khai để gửi mô hình ảnh")
    k = dict(l.strip().split("=", 1) for l in open(os.path.expanduser("~/.secrets/cong-ai.env")) if "=" in l)["CONG_AI_KEY"].strip().strip('"')
    try:
        r = urllib.request.urlopen(urllib.request.Request("https://spy.on.tc/api/ai", method="POST", headers={"authorization": f"Bearer {k}", "content-type": "application/json", "user-agent": "Mozilla/5.0 logo-goc"},
            data=json.dumps({"loai": "anh", "viec": "etp-logo-khoa", "ma": str(ma), "prompt": DE_LOGO_KHOA, "ti_le": "3:4", "tham_chieu": [link], "bo_chinh_hang": True}).encode()), timeout=400)
        j = json.loads(r.read())
    except urllib.error.HTTPError as e: raise RuntimeError(f"cổng ảnh từ chối: {e.read()[:200].decode('utf8', 'replace')}")
    if not j.get("anh_b64"): raise RuntimeError(f"cổng ảnh không trả ảnh: {str(j.get('loi'))[:160]}")
    open(ra, "wb").write(base64.b64decode(j["anh_b64"])); v = round((j.get("chi_usd") or 0) * 26000)
    print(f"logo gốc: ảnh khoá màu AI {j.get('model')} {v}₫ → {ra}", flush=True); return ra, v

DOC_RONG = 1800   # poster hẹp hơn thì phóng lên ~mức này trước khi đưa máy đọc chữ
def tach(ten, poster, ra, ghi_ly_do=None, nen_sach=None, khoa=None):
    """→ (đường dẫn PNG trong suốt, 'cat' | 'ai' | 'dai'), hoặc (None, None) kèm lý do qua ghi_ly_do(str). nen_sach(poster) → đường dẫn ảnh poster đã xoá chữ (tầng AI, tuỳ chọn)."""
    noi = ghi_ly_do or (lambda s: None)
    if not os.path.exists(poster): noi("thiếu poster"); return None, None
    # POSTER NHỎ PHÓNG LÊN TRƯỚC KHI ĐỌC (26/11/2026 phim 22385: og:image 651×868, chữ hoa văn — máy đọc chỉ ra "ITTLE", phóng ×3 đọc đủ "THE DEVILS / LITTLE PRINCE / IS HIDING AGAIN").
    # Toạ độ máy đọc trả về theo tỉ lệ 0–1 nên dùng thẳng cho poster gốc.
    doc_anh = poster; pw = Image.open(poster).size[0]
    if pw < DOC_RONG:
        doc_anh = os.path.splitext(ra)[0] + "-doc.jpg"; k = -(-DOC_RONG // pw); im0 = Image.open(poster).convert("RGB")
        im0.resize((im0.width * k, im0.height * k), Image.LANCZOS).save(doc_anh, quality=95)
    # ĐỌC ĐÚNG hơn đọc nhanh: chờ Neural Engine tới 4 phút (--cho 240) — dự phòng CPU .fast đọc cụt chữ hoa văn (27/11/2026 134241 ",jLargate de m")
    j = json.loads(subprocess.run([AT().may_doc(), "--cho", "240", doc_anh], capture_output=True, text=True, timeout=600).stdout.strip() or "{}")
    treo = " — máy đọc chữ chạy dự phòng vì Neural Engine treo (đọc thiếu chữ), chạy lại khi ANE rảnh" if j.get("du_phong") else ""
    if doc_anh != poster: os.remove(doc_anh)
    hop = AT().hop_ten(ten, j)
    if not hop: noi("máy đọc chữ không thấy tên phim trên poster" + treo); return None, None
    # ĐỦ KHỐI LOGO: máy đọc chữ hay đọc trượt dòng chữ hoa văn (20/11/2026: "Rising", "INTERN", "MechGod" rụng khỏi logo) → dòng chữ to sát trên / dưới khối tên,
    # không phải nhãn nền tảng, nhập vào khối. Sau đó chữ đọc được phải khớp ≥ 50% số từ của tên phim, không thì coi như KHÔNG đọc ra logo (thà dừng hơn lấy nhầm biển hiệu).
    tu = AT().tu_chu; hop = [list(b) for b in hop]; kh = [list(k) for k in j.get("khung") or []]
    them = True
    while them:
        them = False; cao = float(np.median([b[3] for b in hop])); t_, d_ = min(b[1] for b in hop), max(b[1] + b[3] for b in hop); l_, r_ = min(b[0] for b in hop), max(b[0] + b[2] for b in hop)
        for k in kh:
            b = k[1:]
            if b in hop or tu(k[0]) & NHAN or len(k[0].strip()) < 3 or b[3] < 0.45 * cao or b[0] + b[2] < l_ or b[0] > r_: continue
            if -0.9 * cao <= b[1] - d_ <= 0.9 * cao or -0.9 * cao <= t_ - (b[1] + b[3]) <= 0.9 * cao or (b[1] >= t_ and b[1] + b[3] <= d_): hop.append(b); them = True
    can = tu(ten); doc = AT().khop_tu(set().union(*[tu(k[0]) for k in kh if k[1:] in hop]), can, ten)
    if len(doc) < 0.5 * len(can): noi(f"chữ đọc được trên poster chỉ khớp {len(doc)}/{len(can)} từ của tên phim" + treo); return None, None
    im = np.asarray(Image.open(poster).convert("RGB")).astype(np.float32); Y, X = im.shape[:2]
    px = lambda b: (b[0] * X, b[1] * Y, (b[0] + b[2]) * X, (b[1] + b[3]) * Y)
    hp = [px(b) for b in hop]; lh = float(np.median([b[3] - b[1] for b in hp]))
    x0 = int(max(0, min(b[0] for b in hp) - 1.0 * lh)); x1 = int(min(X, max(b[2] for b in hp) + 0.7 * lh))
    y0 = int(max(0, min(b[1] for b in hp) - 0.9 * lh)); y1 = int(min(Y, max(b[3] for b in hp) + 0.45 * lh))
    # VÙNG CẮT LỚN DẦN THEO NÉT (anh 26/11/2026 creative #116378 Undercover Prison King: "Logo bị cắt lỗi ! Mất chữ KING" — chữ KING đỏ kiểu mực loang, máy đọc chữ
    # trả hộp hụt nên vùng cắt dừng trước chữ G, mọi nét ngoài vùng bị xoá mà cổng vẫn cho qua): nét logo chạm mép vùng cắt ở cạnh nào thì nới cạnh đó thêm một cao dòng
    # rồi cắt lại (tối đa NOI_LAN lần); vẫn chạm thì mọi tầng cắt theo vùng (cắt nền / nền sạch AI / BiRefNet) trượt cổng "logo bị cụt" — thà lùi tầng còn hơn ra logo mất chữ
    def dung(x0, x1, y0, y1):
        nonlocal v, X0, Y0, X1, Y1, c, h, w, trong, bg, chu, cam_nhan, cam, vung
        vung = (x0, x1, y0, y1)
        v = int(max(12, 0.5 * lh)); X0, Y0, X1, Y1 = max(0, x0 - v), max(0, y0 - v), min(X, x1 + v), min(Y, y1 + v)   # vành ngoài để ước nền
        c = im[Y0:Y1, X0:X1]; h, w = c.shape[:2]
        trong = np.zeros((h, w), bool); trong[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = True
        # NỀN: trung bình có trọng số của vành ngoài, hai cỡ nhoè (gần mép lấy cỡ nhỏ cho sát, giữa vùng lấy cỡ lớn)
        def nen(sig):
            wv = nd.gaussian_filter((~trong).astype(np.float32), sig); return np.stack([nd.gaussian_filter(c[..., k] * ~trong, sig) for k in range(3)], -1) / np.maximum(wv, 1e-4)[..., None], wv
        b1, w1 = nen(max(6, 0.6 * lh)); b2, _ = nen(max(12, 2.2 * lh)); t = np.clip(w1 / 0.25, 0, 1)[..., None]; bg = b1 * t + b2 * (1 - t)
        chu = np.zeros((h, w), bool)   # hộp các dòng tên phim
        for b in hp: chu[int(max(0, b[1] - Y0)):int(b[3] - Y0), int(max(0, b[0] - X0)):int(b[2] - X0)] = True
        cam_nhan = np.zeros((Y, X), bool)   # riêng nhãn nền tảng, cỡ poster — tầng khoá màu khi tên thiếu từ chỉ cấm vùng này
        cam = np.zeros((h, w), bool)   # chữ KHÁC trên poster (nhãn nền tảng, khẩu hiệu) + biểu tượng đứng cạnh nó: không bao giờ thuộc logo
        for t_, bx, by, bw, bh in j.get("khung") or []:
            if [bx, by, bw, bh] in hop: continue
            k = 1.0 if bw * bh < 0.004 else 0.25; trai = 2.4 * bh * Y / X if tu(t_) & NHAN else 0   # nhãn nền tảng luôn có biểu tượng bên trái chữ (DramaBox "M", ReelShort "R")
            a, b_, e, f = px((bx - bw * k - trai, by - bh * (k + (0.5 if trai else 0)), bw * (1 + 2 * k) + trai, bh * (1 + 2 * k + (1.0 if trai else 0))))
            cam[int(max(0, b_ - Y0)):int(max(0, f - Y0)), int(max(0, a - X0)):int(max(0, e - X0))] = True
            if trai: cam_nhan[int(max(0, b_)):int(max(0, f)), int(max(0, a)):int(max(0, e))] = True
        # NHÃN NỀN TẢNG THẮNG HỘP TÊN (anh 27/11/2026 "Deny Me logo bóc xấu quá": máy đọc chữ trả hộp "Dragon King" cao tới 0,91 poster, đè dòng "DramaBox Exclusive"
        # ở 0,875 → `cam &= ~chu` xoá vùng cấm đúng chỗ chồng, mác nền tảng lọt nguyên vào logo). Hộp nhãn sát (lề 10%, kèm biểu tượng bên trái) cấm tuyệt đối,
        # và hộp tên bị cắt tại mép nhãn để cổng chất lượng không tính phần nhãn là nét tên.
        nhan_sat = np.zeros((h, w), bool)
        for t_, bx, by, bw, bh in j.get("khung") or []:
            if [bx, by, bw, bh] in hop or not tu(t_) & NHAN: continue
            a, b_, e, f = px((bx - 2.4 * bh * Y / X, by - 0.1 * bh, bw + 2.4 * bh * Y / X + 0.1 * bw, bh * 1.2))
            nhan_sat[int(max(0, b_ - Y0)):int(max(0, f - Y0)), int(max(0, a - X0)):int(max(0, e - X0))] = True
        cam &= ~chu; cam |= nhan_sat; chu &= ~nhan_sat
    def mep(dac):
        """cạnh vùng cắt mà nét logo chạm (trừ cạnh trùng mép poster — đó là mép ảnh gốc, không phải mình cắt) → {'trai','phai','tren','duoi'}"""
        x0, x1, y0, y1 = vung; a, b, e, f = y0 - Y0, y1 - Y0, x0 - X0, x1 - X0; n = max(3, int(0.15 * lh)); dd = max(2, int(0.04 * lh)); ra_ = set()
        if x0 > 0 and dac[a:b, e:e + dd].any(1).sum() >= n: ra_.add("trai")
        if x1 < X and dac[a:b, f - dd:f].any(1).sum() >= n: ra_.add("phai")
        if y0 > 0 and dac[a:a + dd, e:f].any(0).sum() >= n: ra_.add("tren")
        if y1 < Y and dac[b - dd:b, e:f].any(0).sum() >= n: ra_.add("duoi")
        return ra_
    def ly_mep(dac):
        s = mep(dac); return f"nét logo chạm mép vùng cắt ({', '.join(sorted(s))}) — logo bị cụt" if s else None
    v = X0 = Y0 = X1 = Y1 = h = w = 0; c = trong = bg = chu = cam_nhan = cam = vung = None
    dung(x0, x1, y0, y1)
    def cat(bg, that=False):
        """nền dưới logo → (lớp trong suốt, nét đặc, lý do trượt cổng | None)"""
        d = np.abs(c - bg).max(-1); d[~trong] = 0
        if that:   # nền sạch THẬT (AI): poster hay phủ một dải tối sau logo mà nền sạch không có → chỗ poster chỉ TỐI hơn nền, không đổi màu = bóng nền, không phải nét logo
            toi = (c.max(-1) < bg.max(-1)) & ((c.max(-1) - c.min(-1)) < 60) & (c.max(-1) < 120); d[toi] = 0
        d[cam] = 0
        nguong = max(34.0, 0.42 * float(np.percentile(d[chu], 97)))
        al = np.clip((d - 0.55 * nguong) / (0.45 * nguong), 0, 1)
        dac = nd.median_filter(al > 0.5, size=3)
        if that:   # nét logo trùng màu nền sạch (chữ vàng nhạt trên vải kem) bị thủng → lấp lỗ nhỏ hơn bề dày nét, không lấp lòng chữ
            kin = nd.binary_closing(dac, iterations=max(1, int(0.05 * lh))); lo, nlo = nd.label(~kin)
            cv = nd.sum(np.ones_like(lo), lo, np.arange(nlo + 1)); nho = cv < (0.22 * lh) ** 2; nho[0] = False
            dac2 = kin | nho[lo]; al = np.maximum(al, nd.gaussian_filter((dac2 & ~dac).astype(np.float32), 1.0) * 1.6).clip(0, 1); dac = dac2
        nhom, n = nd.label(nd.binary_dilation(dac, iterations=max(2, int(0.16 * lh))))   # mảng sát nhau gộp một nhóm
        giu = np.zeros(n + 1, bool); giu[np.unique(nhom[chu & dac])] = True; giu[0] = False
        al = al * giu[nhom]; dac = dac & giu[nhom]
        return al, dac, cong(dac) or ly_mep(dac)
    def cong(dac, tran=0.62, du_min=0.85):
        """cổng chất lượng của một lớp nét → lý do trượt | None"""
        if not dac.any(): return "không còn nét logo sau khi tách"
        phu = dac[chu].mean(); ngoai = (dac & ~nd.binary_dilation(chu, iterations=int(0.3 * lh))).sum() / dac.sum()
        # khe giữa chữ / giữa từ hẹp hơn ~0,6 cao dòng không tính là mất nét (25/11/2026 dòng nhỏ "WHAT IF I'M" chỉ 69% cột có nét vì khoảng trắng) — phần chữ mất thật rộng hơn nhiều
        # đệm hai đầu trước khi đóng khe: binary_closing của scipy coi ngoài mép là trống nên ăn mất ~nửa cỡ khe ở mỗi đầu — dòng chữ cao trên hộp hẹp tự "rụng" ~30%
        # dù đủ nét (26/11/2026 phim 179465 "Don't humiliate the CEO's parents": cột có nét 97% mà đo ra 70%, khoá màu sạch bị bỏ, lùi về dải poster)
        def phu_ngang(cot, n):
            return nd.binary_closing(np.pad(cot, n, constant_values=True), np.ones(n, bool))[n:-n].mean()
        du = min(phu_ngang(dac[int(max(0, b[1] - Y0)):int(b[3] - Y0), int(max(0, b[0] - X0)):int(b[2] - X0)].any(0), max(3, int(0.6 * (b[3] - b[1])))) for b in hp)
        if not 0.10 <= phu <= tran: return f"nét phủ {phu:.0%} hộp chữ"
        if ngoai > 0.15: return f"{ngoai:.0%} phần tách nằm ngoài khối chữ"
        if du < du_min: return f"một dòng tên chỉ còn nét trên {du:.0%} bề ngang"
        return None
    for _ in range(NOI_LAN):
        s = mep(cat(bg)[1])
        if not s: break
        x0, x1, y0, y1 = vung; d_ = int(1.0 * lh)
        dung(max(0, x0 - d_) if "trai" in s else x0, min(X, x1 + d_) if "phai" in s else x1, max(0, y0 - d_) if "tren" in s else y0, min(Y, y1 + d_) if "duoi" in s else y1)
    al, _, ly = cat(bg); cach = "cat"
    # TÊN THIẾU TỪ (21/11/2026 Get Out of My Bugatti: "Bugatti" viết tay máy đọc chữ bỏ sót): các tầng cắt theo HỘP CHỮ đều mất phần đó → chỉ nhận tầng khoá màu,
    # nơi AI tô hồng mọi thứ trừ logo nên lấy được cả phần chữ máy không đọc ra (dải ngang quanh khối tên, bỏ chữ khác của poster). Khoá màu trượt → không có logo.
    thieu = {w for w in can - doc if len(w) > 3}   # từ nối ngắn (of, a, the… ≤ 3 ký tự) máy đọc hay bỏ sót nhưng nằm giữa khối tên — không tính thiếu (25/11/2026 One Hell of a Fighter: rụng "OF A" làm khoá màu sạch bị bỏ)
    if thieu and not ly: ly = f"máy đọc chữ không ra từ {' '.join(sorted(thieu))} — cắt theo hộp chữ sẽ mất phần đó"
    # TẦNG KHOÁ MÀU (anh 20/11/2026 "các mẫu này khi nhìn lại vẫn ko đẹp, nhất là các viền xung quanh"): cách nền sạch + BiRefNet để dính mảng nền (da người, bóng tối)
    # quanh logo. Nay mô hình ảnh rẻ nhất GIỮ NGUYÊN logo, tô mọi thứ còn lại một màu hồng phẳng → khoá màu hồng ra lớp trong suốt (mép + ánh sáng quanh chữ mờ dần tự nhiên,
    # gỡ ám hồng ở mép). Cổng: đủ nét như các tầng khác + nét đặc phải KHỚP poster gốc (AI vẽ lại chữ thì bỏ, lùi về tầng nền sạch). khoa(poster) → đường dẫn ảnh nền hồng.
    # KHOÁ MÀU ĐI TRƯỚC (21/11/2026 Get Out of My Bugatti: tầng cắt 0₫ qua cổng mà vẫn dính mảng áo + đốm nền quanh logo): có khoa thì luôn thử khoá màu trước,
    # trượt cổng mới giữ kết quả tầng cắt 0₫ (ly của nó không đổi)
    if khoa:
        try:
            kp = khoa(poster)
            if kp:
                Kh = np.asarray(Image.open(kp).convert("RGB")).astype(np.float32); KY, KX = Kh.shape[:2]
                k = np.minimum(Kh[..., 0], Kh[..., 2]) - Kh[..., 1]; nen_h = k > 175
                if nen_h.mean() < 0.35: noi("ảnh khoá màu: nền hồng chưa tới 35% ảnh — AI không tô nền, bỏ")
                else:
                    M = np.median(Kh[nen_h], 0); a = 1 - np.clip((k - 45) / 125, 0, 1)
                    lon = lambda m: np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((KX, KY), Image.NEAREST)) > 127   # mặt nạ cỡ poster → cỡ ảnh khoá
                    CHU = np.zeros((Y, X), bool); CHU[Y0:Y1, X0:X1] = chu; CAM = np.zeros((Y, X), bool); CAM[Y0:Y1, X0:X1] = cam
                    if thieu: CAM = cam_nhan & ~CHU   # chữ "khác" đọc lệch quanh khối tên có thể chính là phần tên máy không đọc ra
                    a[lon(CAM)] = 0; tl = KY / Y; dac = nd.median_filter(a > 0.5, size=3)
                    nhom, n = nd.label(nd.binary_dilation(a > 0.12, iterations=max(2, int(0.16 * lh * tl)))); giu = np.zeros(n + 1, bool)
                    if thieu:   # mọi mảng logo trong dải ngang quanh khối tên (phần chữ máy không đọc ra thường to hơn, nằm sát trên / dưới)
                        DAI = np.zeros((Y, X), bool); DAI[int(max(0, min(b[1] for b in hp) - 2.0 * lh)):int(min(Y, max(b[3] for b in hp) + 5.0 * lh))] = True
                        giu[np.unique(nhom[lon(DAI & ~CAM) & dac])] = True
                    else: giu[np.unique(nhom[lon(CHU) & dac])] = True
                    giu[0] = False
                    a = a * giu[nhom]; dac = dac & giu[nhom]
                    nho = lambda m: np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((X, Y), Image.BILINEAR)) > 127
                    lyk = cong(nho(dac)[Y0:Y1, X0:X1], 0.82, 0.75)
                    if thieu:   # cổng hộp chữ không áp được (phần thiếu nằm ngoài hộp): đủ nét trong hộp đã đọc + khối giữ phải lớn hơn hẳn hộp đã đọc (đã lấy thêm phần thiếu)
                        ys_ = np.where(dac.any(1))[0]; cao_doc = (max(b[3] for b in hp) - min(b[1] for b in hp)) * tl
                        lyk = "không còn nét logo" if not len(ys_) else (None if ys_.max() - ys_.min() > 1.3 * cao_doc and nho(dac)[Y0:Y1, X0:X1][chu].mean() > 0.10 else "khoá màu không lấy thêm được phần chữ thiếu")   # dòng chữ nhỏ thưa ("and Became …") có khe giữa các từ; đã có cổng khớp poster gốc gác phía sau
                        if lyk and len(ys_):   # máy đọc chữ trên POSTER lúc ra lúc không (26/11/2026 phim 179465: cùng poster, lượt này đủ từ, lượt sau rụng một dòng) → đọc lại
                            # ngay trên logo đã tách (nền tối phẳng, không còn ảnh nền nhiễu): đủ mọi từ thiếu thì khoá màu đã lấy được phần đó, nhận
                            import tempfile
                            with tempfile.TemporaryDirectory() as tm_:
                                tp_ = os.path.join(tm_, "logo.png"); Image.fromarray((Kh * a[..., None] + 30 * (1 - a[..., None])).astype(np.uint8)).save(tp_)
                                jl = json.loads(subprocess.run([AT().may_doc(), tp_], capture_output=True, text=True, timeout=300).stdout.strip() or "{}")
                            dl = AT().khop_tu(set().union(*[tu(k[0]) for k in jl.get("khung") or []]) if jl.get("khung") else set(), can, ten)
                            if thieu <= dl: lyk = None
                    F = np.clip((Kh - (1 - a)[..., None] * M) / np.maximum(a, 0.06)[..., None], 0, 255)   # gỡ ám hồng: màu thật của nét ở mép bán trong suốt
                    du_h = np.clip(np.minimum(F[..., 0], F[..., 2]) - F[..., 1], 0, None) * (nd.minimum_filter(a, size=5) < 0.97)   # ám hồng còn lại ở viền + nét mảnh: rút phần đỏ-lam thừa
                    F[..., 0] -= 0.85 * du_h; F[..., 2] -= 0.85 * du_h
                    goc_lon = np.asarray(Image.fromarray(im.astype(np.uint8)).resize((KX, KY), Image.LANCZOS)).astype(np.float32); loi_ = nd.binary_erosion(a > 0.95, iterations=3)
                    lech = float(np.abs(goc_lon - F).mean(-1)[loi_].mean()) if loi_.any() else 255.0
                    tim = (np.minimum(F[..., 0], F[..., 2]) - F[..., 1] > 25) & (a > 0.5)   # đốm hồng AI tô lẫn vào vân chữ (25/11/2026 FIGHTER lấm tấm tím trên nền tối): nét đặc → lấy màu thật của poster gốc tại chỗ đó
                    F[tim] = goc_lon[tim]
                    if lyk: noi(f"khoá màu trượt cổng ({lyk})")
                    elif lech > 38: noi(f"khoá màu: nét logo lệch poster gốc {lech:.0f}/255 (chuẩn ≤ 38) — AI vẽ lại chữ, bỏ")
                    else:
                        a = nd.gaussian_filter(a, 0.6); ys, xs = np.where(a > 0.06)
                        Image.fromarray(np.dstack([F, a * 255]).astype(np.uint8)[ys.min():ys.max() + 1, xs.min():xs.max() + 1], "RGBA").save(ra); return ra, "khoa"
        except Exception as e: noi(f"tầng khoá màu lỗi: {str(e)[:160]}")
    if ly and nen_sach:   # TẦNG AI (anh 20/11/2026 "nếu ko đc thì vẫn phải cho AI vào support, dùng mô hình nào rẻ nhất"): mô hình ảnh rẻ nhất của cổng chung xoá chữ khỏi poster
        # → NỀN SẠCH thật; logo = chỗ poster gốc lệch nền sạch, ĐIỂM ẢNH VẪN LẤY TỪ POSTER GỐC (AI không vẽ nét logo nào). Nền sạch phải khớp poster ở vùng không chữ, không thì bỏ.
        try:
            ns = nen_sach(poster)
            if ns:
                pl = np.asarray(Image.open(ns).convert("RGB").resize((X, Y), Image.LANCZOS)).astype(np.float32)
                ngoai_chu = np.ones((Y, X), bool); ngoai_chu[max(0, Y0 - 2 * v):Y1 + 2 * v] = False
                for t_, bx, by, bw, bh in j.get("khung") or []: a_, b_, e_, f_ = px((bx, by, bw, bh)); ngoai_chu[int(max(0, b_ - 20)):int(f_ + 20), int(max(0, a_ - 20)):int(e_ + 20)] = False
                lech = float(np.abs(im - pl).max(-1)[ngoai_chu].mean()) if ngoai_chu.any() else 0.0
                if lech > 24: noi(f"nền sạch AI lệch poster gốc {lech:.0f}/255 ở vùng không chữ (chuẩn ≤ 24) — AI vẽ lại bố cục, bỏ")
                else:
                    al2, dac2, ly2 = cat(pl[Y0:Y1, X0:X1], True)
                    # GHÉP BiRefNet (anh 20/11/2026 "vẫn còn bị nền bẩn … xem có git nào hỗ trợ việc này hoàn hảo hơn", ZhengPeng7/BiRefNet, MIT, chạy tại máy qua rembg, 0₫):
                    # BiRefNet tách tiền cảnh rất sạch mép và đủ hoạ tiết logo nhưng lấy luôn người trong vùng cắt; lớp lệch nền sạch AI biết CHỖ có logo nhưng bẩn mép
                    # → lớp cuối = BiRefNet, chỉ giữ trong vùng lệch nền sạch (nới nhẹ). Trượt cổng thì lùi về lớp lệch nền sạch, rồi mới tới dải poster.
                    try:
                        cua = nd.binary_dilation(dac2, iterations=max(3, int(0.14 * lh))); al3 = tach_nen(c) * cua * ~cam; m3 = nd.median_filter(al3 > 0.5, size=3); ly3 = cong(m3, 0.82) or ly_mep(m3)
                        if ly3: noi(f"BiRefNet + nền sạch AI trượt cổng ({ly3})")
                        else: al, ly, cach = al3, None, "ai"
                    except Exception as e: noi(f"BiRefNet lỗi: {str(e)[:140]}")
                    if ly and not ly2: al, ly, cach = al2, None, "ai"
                    elif ly: noi(f"tách theo nền sạch AI vẫn trượt cổng ({ly2})")
        except Exception as e: noi(f"tầng AI lỗi: {str(e)[:160]}")
    if not ly:
        al = nd.gaussian_filter(al, 0.7); ys, xs = np.where(al > 0.08)
        Image.fromarray(np.dstack([c, al * 255]).astype(np.uint8)[ys.min():ys.max() + 1, xs.min():xs.max() + 1], "RGBA").save(ra); return ra, cach
    # chỉ chặn dải poster khi thiếu TỪ CHÍNH; từ nối ngắn (of, a, the… ≤ 3 ký tự) máy đọc chữ hay bỏ sót nhưng nằm cùng dải tên (25/11/2026 One Hell of a Fighter: rụng "OF A")
    if {w for w in thieu if len(w) > 3}: noi(f"không cắt rời được ({ly}) — tên thiếu từ nên không dùng dải poster"); return None, None
    noi(f"không cắt rời được ({ly}) → dùng dải poster")
    # BẢN DẢI: dải ngang poster quanh logo; chặn trên / dưới tại chữ khác (nhãn nền tảng) để không mang nhãn đó vào creative
    t0 = min(b[1] for b in hp); d0 = max(b[3] for b in hp); tren, duoi = max(0.0, t0 - 0.9 * lh), min(float(Y), d0 + 0.6 * lh)
    for t_, bx, by, bw, bh in j.get("khung") or []:
        if [bx, by, bw, bh] in hop: continue
        a, b_, e, f = px((bx, by, bw, bh))
        if f <= t0 + 0.2 * lh: tren = max(tren, f + 2)
        elif b_ >= d0 - 0.2 * lh: duoi = min(duoi, b_ - 2)
        elif tu(t_) & NHAN and (b_ + f) / 2 > (t0 + d0) / 2:   # nhãn nền tảng dưới tâm khối tên mà hộp tên lấn qua nó (25/11/2026 Deny Me, Dragon King: hộp "Dragonkus" đọc cao tới đáy 728px, nhãn DramaBox ở 700px) → nhãn vẫn là đáy dải
            duoi = min(duoi, b_ - 2); d0 = min(d0, b_ - 2)
    # MÉP DƯỚI THEO ĐIỂM ẢNH, KHÔNG THEO HỘP MÁY ĐỌC (anh 25/11/2026 "logo này bị cụt ở chân", 88231 One Hell of a Fighter): hộp chữ máy đọc rộng hơn nét thật
    # (FIGHTER đọc tới 701px, nhãn DramaBox từ 700px, nét thật hết ở 692px) → dải cắt + mờ dần ăn vào chân chữ. Chữ khác chặn sát đáy thì tìm KHE thật giữa nét logo
    # và chữ dưới (hàng gần như không có điểm sáng / đậm màu), đáy dải = cuối khe, phần mờ dần nằm trọn trong khe.
    if duoi < d0 + 0.6 * lh - 1:
        xs_ = slice(int(max(0, min(b[0] for b in hp))), int(min(X, max(b[2] for b in hp))))
        mu = lambda y: float(((im[y, xs_].max(-1) > 170) | (im[y, xs_].max(-1) - im[y, xs_].min(-1) > 90)).mean())
        lo, hi = int(max(t0, d0 - 0.45 * lh)), int(min(Y - 1, duoi + 0.35 * lh)); m_ = [mu(y) for y in range(lo, hi + 1)]
        trong_ = [i for i, v in enumerate(m_) if v < 0.04]
        if trong_:   # khe = đoạn hàng trống dài nhất
            doan = []; s0 = p0 = trong_[0]
            for i in trong_[1:] + [None]:
                if i is not None and i == p0 + 1: p0 = i; continue
                doan.append((s0, p0)); s0 = p0 = i
            a_, b2 = max(doan, key=lambda d: d[1] - d[0]); d0, duoi = float(lo + a_), float(lo + b2 + 1)
    tren, duoi = int(tren), int(duoi)
    if duoi - tren < 1.05 * (d0 - t0): noi("dải logo bị chữ khác của poster chèn sát — không lấy được"); return None, None
    g = im[tren:duoi]; hh = g.shape[0]; yy = np.arange(hh, dtype=np.float32)
    mo_t = max(6.0, t0 - tren); mo_d = max(6.0, duoi - d0)   # mờ dần hết trong phần đệm, khối chữ giữ đặc
    ay = np.clip(np.minimum(yy / mo_t, (hh - 1 - yy) / mo_d), 0, 1); xx = np.arange(X, dtype=np.float32); ax = np.clip(np.minimum(xx, X - 1 - xx) / (0.07 * X), 0, 1)
    a2 = (ay[:, None] ** 1.5) * (ax[None, :] ** 1.2)
    Image.fromarray(np.dstack([g, a2 * 255]).astype(np.uint8), "RGBA").save(ra); return ra, "dai"

if __name__ == "__main__":
    if sys.argv[1] == "--nen":   # tiến trình riêng của tach_nen
        from rembg import new_session, remove
        remove(Image.open(sys.argv[2]).convert("RGB"), session=new_session("birefnet-general-lite", providers=["CPUExecutionProvider"]), only_mask=True).save(sys.argv[3]); sys.exit(0)
    # --khoa <link poster công khai> <mã phim>: cho phép tầng khoá màu (chuẩn tách nền) — máy gọi bằng tiến trình con vì Python hệ thống của dòng phim không có numpy / scipy
    a_ = sys.argv; kl = a_[a_.index("--khoa") + 1:a_.index("--khoa") + 3] if "--khoa" in a_ else None
    r_ = tach(a_[2], a_[1], a_[3], lambda s: print("✗", s, file=sys.stderr), None, (lambda p_: anh_khoa(kl[0], os.path.join(os.path.dirname(os.path.abspath(a_[1])), "logo-khoa.png"), kl[1])[0]) if kl and kl[0] else None)
    print(json.dumps({"ra": r_[0], "kieu": r_[1]}))
