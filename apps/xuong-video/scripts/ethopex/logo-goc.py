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
NHAN = {"reelshort", "dramabox", "shortmax", "goodshort", "flextv", "exclusive", "original", "originals"}   # nhãn nền tảng trên poster — không thuộc logo phim, không mang vào creative
_at = None
def AT():
    global _at
    if _at is None:
        s = importlib.util.spec_from_file_location("anh_tinh", os.path.join(D, "anh-tinh.py")); _at = importlib.util.module_from_spec(s); s.loader.exec_module(_at)
    return _at

def tach(ten, poster, ra, ghi_ly_do=None, nen_sach=None):
    """→ (đường dẫn PNG trong suốt, 'cat' | 'ai' | 'dai'), hoặc (None, None) kèm lý do qua ghi_ly_do(str). nen_sach(poster) → đường dẫn ảnh poster đã xoá chữ (tầng AI, tuỳ chọn)."""
    noi = ghi_ly_do or (lambda s: None)
    if not os.path.exists(poster): noi("thiếu poster"); return None, None
    j = json.loads(subprocess.run([AT().may_doc(), poster], capture_output=True, text=True, timeout=120).stdout.strip() or "{}")
    hop = AT().hop_ten(ten, j)
    if not hop: noi("máy đọc chữ không thấy tên phim trên poster"); return None, None
    # ĐỦ KHỐI LOGO: máy đọc chữ hay đọc trượt dòng chữ hoa văn (20/11/2026: "Rising", "INTERN", "MechGod" rụng khỏi logo) → dòng chữ to sát trên / dưới khối tên,
    # không phải nhãn nền tảng, nhập vào khối. Sau đó chữ đọc được phải khớp ≥ 50% số từ của tên phim, không thì coi như KHÔNG đọc ra logo (thà dừng hơn lấy nhầm biển hiệu).
    tu = lambda x: set(re.findall(r"[a-z0-9áéíóúñü]+", x.lower())); hop = [list(b) for b in hop]; kh = [list(k) for k in j.get("khung") or []]
    them = True
    while them:
        them = False; cao = float(np.median([b[3] for b in hop])); t_, d_ = min(b[1] for b in hop), max(b[1] + b[3] for b in hop); l_, r_ = min(b[0] for b in hop), max(b[0] + b[2] for b in hop)
        for k in kh:
            b = k[1:]
            if b in hop or tu(k[0]) & NHAN or len(k[0].strip()) < 3 or b[3] < 0.45 * cao or b[0] + b[2] < l_ or b[0] > r_: continue
            if -0.9 * cao <= b[1] - d_ <= 0.9 * cao or -0.9 * cao <= t_ - (b[1] + b[3]) <= 0.9 * cao or (b[1] >= t_ and b[1] + b[3] <= d_): hop.append(b); them = True
    doc = set().union(*[tu(k[0]) for k in kh if k[1:] in hop]); can = tu(ten)
    if len(doc & can) < 0.5 * len(can): noi(f"chữ đọc được trên poster chỉ khớp {len(doc & can)}/{len(can)} từ của tên phim"); return None, None
    im = np.asarray(Image.open(poster).convert("RGB")).astype(np.float32); Y, X = im.shape[:2]
    px = lambda b: (b[0] * X, b[1] * Y, (b[0] + b[2]) * X, (b[1] + b[3]) * Y)
    hp = [px(b) for b in hop]; lh = float(np.median([b[3] - b[1] for b in hp]))
    x0 = int(max(0, min(b[0] for b in hp) - 1.0 * lh)); x1 = int(min(X, max(b[2] for b in hp) + 0.7 * lh))
    y0 = int(max(0, min(b[1] for b in hp) - 0.9 * lh)); y1 = int(min(Y, max(b[3] for b in hp) + 0.45 * lh))
    v = int(max(12, 0.5 * lh)); X0, Y0, X1, Y1 = max(0, x0 - v), max(0, y0 - v), min(X, x1 + v), min(Y, y1 + v)   # vành ngoài để ước nền
    c = im[Y0:Y1, X0:X1]; h, w = c.shape[:2]
    trong = np.zeros((h, w), bool); trong[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = True
    # NỀN: trung bình có trọng số của vành ngoài, hai cỡ nhoè (gần mép lấy cỡ nhỏ cho sát, giữa vùng lấy cỡ lớn)
    def nen(sig):
        wv = nd.gaussian_filter((~trong).astype(np.float32), sig); return np.stack([nd.gaussian_filter(c[..., k] * ~trong, sig) for k in range(3)], -1) / np.maximum(wv, 1e-4)[..., None], wv
    b1, w1 = nen(max(6, 0.6 * lh)); b2, _ = nen(max(12, 2.2 * lh)); t = np.clip(w1 / 0.25, 0, 1)[..., None]; bg = b1 * t + b2 * (1 - t)
    chu = np.zeros((h, w), bool)   # hộp các dòng tên phim
    for b in hp: chu[int(max(0, b[1] - Y0)):int(b[3] - Y0), int(max(0, b[0] - X0)):int(b[2] - X0)] = True
    def cat(bg, that=False):
        """nền dưới logo → (lớp trong suốt, nét đặc, lý do trượt cổng | None)"""
        d = np.abs(c - bg).max(-1); d[~trong] = 0
        if that:   # nền sạch THẬT (AI): poster hay phủ một dải tối sau logo mà nền sạch không có → chỗ poster chỉ TỐI hơn nền, không đổi màu = bóng nền, không phải nét logo
            toi = (c.max(-1) < bg.max(-1)) & ((c.max(-1) - c.min(-1)) < 60) & (c.max(-1) < 120); d[toi] = 0
        for t_, bx, by, bw, bh in j.get("khung") or []:   # chữ khác trên poster (nhãn nền tảng, khẩu hiệu): loại, kể cả biểu tượng nhỏ cạnh nó
            if [bx, by, bw, bh] in hop: continue
            k = 1.0 if bw * bh < 0.004 else 0.25; a, b_, e, f = px((bx - bw * k, by - bh * k, bw * (1 + 2 * k), bh * (1 + 2 * k)))
            vung = np.zeros((h, w), bool); vung[int(max(0, b_ - Y0)):int(max(0, f - Y0)), int(max(0, a - X0)):int(max(0, e - X0))] = True; d[vung & ~chu] = 0
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
        ly = None
        if not dac.any(): ly = "không còn nét logo sau khi tách"
        else:
            phu = dac[chu].mean(); ngoai = (dac & ~nd.binary_dilation(chu, iterations=int(0.3 * lh))).sum() / dac.sum()
            du = min(dac[int(max(0, b[1] - Y0)):int(b[3] - Y0), int(max(0, b[0] - X0)):int(b[2] - X0)].any(0).mean() for b in hp)
            if not 0.10 <= phu <= 0.62: ly = f"nét phủ {phu:.0%} hộp chữ"
            elif ngoai > 0.15: ly = f"{ngoai:.0%} phần tách nằm ngoài khối chữ"
            elif du < 0.85: ly = f"một dòng tên chỉ còn nét trên {du:.0%} bề ngang"
        return al, ly
    al, ly = cat(bg); cach = "cat"
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
                    al2, ly2 = cat(pl[Y0:Y1, X0:X1], True)
                    if ly2: noi(f"tách theo nền sạch AI vẫn trượt cổng ({ly2})")
                    else: al, ly, cach = al2, None, "ai"
        except Exception as e: noi(f"tầng AI lỗi: {str(e)[:160]}")
    if not ly:
        al = nd.gaussian_filter(al, 0.7); ys, xs = np.where(al > 0.08)
        Image.fromarray(np.dstack([c, al * 255]).astype(np.uint8)[ys.min():ys.max() + 1, xs.min():xs.max() + 1], "RGBA").save(ra); return ra, cach
    noi(f"không cắt rời được ({ly}) → dùng dải poster")
    # BẢN DẢI: dải ngang poster quanh logo; chặn trên / dưới tại chữ khác (nhãn nền tảng) để không mang nhãn đó vào creative
    t0 = min(b[1] for b in hp); d0 = max(b[3] for b in hp); tren, duoi = max(0.0, t0 - 0.9 * lh), min(float(Y), d0 + 0.6 * lh)
    for t_, bx, by, bw, bh in j.get("khung") or []:
        if [bx, by, bw, bh] in hop: continue
        a, b_, e, f = px((bx, by, bw, bh))
        if f <= t0 + 0.2 * lh: tren = max(tren, f + 2)
        elif b_ >= d0 - 0.2 * lh: duoi = min(duoi, b_ - 2)
    tren, duoi = int(tren), int(duoi)
    if duoi - tren < 1.05 * (d0 - t0): noi("dải logo bị chữ khác của poster chèn sát — không lấy được"); return None, None
    g = im[tren:duoi]; hh = g.shape[0]; yy = np.arange(hh, dtype=np.float32)
    mo_t = max(6.0, t0 - tren); mo_d = max(6.0, duoi - d0)   # mờ dần hết trong phần đệm, khối chữ giữ đặc
    ay = np.clip(np.minimum(yy / mo_t, (hh - 1 - yy) / mo_d), 0, 1); xx = np.arange(X, dtype=np.float32); ax = np.clip(np.minimum(xx, X - 1 - xx) / (0.07 * X), 0, 1)
    a2 = (ay[:, None] ** 1.5) * (ax[None, :] ** 1.2)
    Image.fromarray(np.dstack([g, a2 * 255]).astype(np.uint8), "RGBA").save(ra); return ra, "dai"

if __name__ == "__main__":
    print(tach(sys.argv[2], sys.argv[1], sys.argv[3], lambda s: print("✗", s, file=sys.stderr)))
