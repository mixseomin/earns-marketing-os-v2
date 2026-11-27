#!/usr/bin/env python3
"""KIỂU CREATIVE "ẢNH TĨNH" (anh 05/11/2026, mẫu video của đội: một khung đẹp nét trong phim + tên phim + giọng ~9s).
Giọng: bốc ngẫu nhiên một trong các mẫu CAU (EN 4 mẫu anh đưa 05–06/11/2026, ES 1 mẫu "¡Mira {title} gratis ahora! ¡Mira más ahora!").
Áp trước cho PHIM MỚI BẮT ĐẦU LÃI của nhà: camp đầu ≤ NGAY_MOI ngày, 3 ngày gần nhất thu > chi (chi ≥ $3) HOẶC có camp cơ hội (etp.camp_co_hoi — anh 06/11/2026
"thấy camp cơ hội thì tập trung scale từ nó": một camp ROI ≥ 50% giữa các camp thử lỗ vẫn là phim cần creative), còn camp ACTIVE, chưa có bản ảnh tĩnh,
cổng không chặn (apps/etp/cong.phim_chan_len). Mới nhất lên trước.
MỘT lệnh lo trọn, mỗi phim:
  1. tải 3 tập miễn phí (tai-tap.py) → khung mỗi 1,5 giây → doc-chu --mat (Vision: điểm mặt Apple + chữ) → chọn khung mặt to, nét, không chữ in cứng
  2. khung gốc độ phân giải đầy đủ → 1080x1920 + tên phim chữ vàng nửa dưới (không che mặt) + phóng chậm 5%
  3. giọng ElevenLabs v3 qua cổng giọng chung scripts/lich-su/giong-ckey.mjs (ckey 156₫/câu theo mã giọng → fal khi hỏng)
  4. cổng chữ trên video (kiem-thoai.py) → thư viện etp (thu-vien-them.mts, dạng "ảnh tĩnh", nguồn anh_tinh) → creative (thu-vien-len.py)
Từ đó nhịp ethopex (apps/cty/worker/ethopex.mjs) thấy creative ảnh tĩnh chấm Sạch của phim đang chạy → lên camp $1, giờ chạy theo lịch chung (nhan-ban.lich_len).
Dùng (iMac): python3 anh-tinh.py [content_id …] [--so N] [--ban N bản / phim] [--xem] [--giong ky_di|gao|cam_xuc|hao_hung|thuong|theo-phim|xoay]
  giọng mặc định = sổ luật giong_at.mac_dinh = thuong / George (anh 27/11/2026, ky_di KHÔNG ƯU TIÊN — vẫn dùng được, xếp cuối; trước đó ky_di mặc định 18/11/2026) cho MỌI bản; --giong xoay = xoay 5 kiểu như 05/11/2026;
  dấu kiểu ghi vào etp.diem_cham.cham.voice.giong để đo
  lớp Free (nhãn tím "All Episodes Released" + tên phim + nút xanh "Watch For Free") LUÔN vẽ — anh chốt 19/11/2026 (at_chi_dang_free): AT chỉ một dạng, không tắt được
  --anh <tệp ảnh> (lặp được) = KHUNG CHỈ ĐỊNH (anh 22/11/2026 "trên spy … cắt theo 1 cảnh tương tự … ảnh dùng chung cho cả EN/ES thay nội dung"): bỏ bước tải tập + AI xếp hạng,
    dựng đúng ảnh đưa vào (một ảnh dùng cho mọi phim trong lệnh — bản EN và ES cùng cảnh, chỉ đổi tên phim / lớp Free / giọng theo ngôn ngữ từng phim)
  không id = tự chọn N phim (mặc định 10) · --xem = chỉ dựng + tờ khung (~/.cache/ethopex/anh-tinh/to-<giờ>.jpg), không nạp thư viện / tạo creative"""
import difflib, hashlib, json, os, random, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import cam_box3; cam_box3.cam()   # CẤM dựng video trên box3 (anh 03/11/2026)
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageStat

D = os.path.dirname(os.path.abspath(__file__)); B = "root@167.233.241.16"; C = os.path.expanduser("~/.cache/ethopex/anh-tinh")
ENV = "cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a"
XV = f"{ENV}; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx"
DANG, NGUON, NGAY_MOI, GIAY_MIN, W, H = "ảnh tĩnh", "anh_tinh", 14, 9.0, 1080, 1920
# MẪU CÂU GIỌNG — mỗi mẫu 3 vế (vế nào cũng được chứa {t} = tên phim · c = câu chốt, thẻ hét đặt trước nó) để KIEU_GIONG chèn thẻ cách đọc. Mỗi creative BỐC NGẪU NHIÊN một mẫu của ngôn ngữ
# (anh 06/11/2026 "Thêm các mẫu voice này vào AT !!! Khi lên camp dạng AT, switch random giữa chúng"), số mẫu ghi vào etp.diem_cham.cham.voice.mau để đo. Chữ giữ nguyên văn anh đưa.
# Câu nằm trong SỔ MẪU apps/etp2/src/lib/etp-mau-cr.json › thu_vien.giong.cau (23/11/2026: ngăn soạn creative etp2 cho ghim câu đọc vào ô Giọng — một nguồn cho cả trang lẫn máy).
CAU = {k: [tuple(m) for m in v] for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp2", "src", "lib", "etp-mau-cr.json"), encoding="utf-8"))["thu_vien"]["giong"]["cau"].items()}
assert len(CAU.get("en", [])) >= 1 and all(len(m) == 3 for l in CAU.values() for m in l), "sổ mẫu thiếu câu giọng (thu_vien.giong.cau) hoặc câu không đủ 3 vế"
assert not [m for l in CAU.values() for m in l if re.match(r"\W*(for\s+free|free|gratis)\b", m[0], re.I)], "mẫu giọng mở bằng Free/gratis — câu đầu phải là tên phim (anh 21/11/2026)"
# GIỌNG THEO PHIM (anh 05/11/2026: "giọng kỳ dị, gào thét, ấn tượng … tuỳ theo film"): kiểu đọc chọn theo thể loại phim (etp.phim.the_loai);
# chữ giữ nguyên form, chỉ chèn thẻ cách đọc ElevenLabs v3 ([shouting]…) — thẻ không thành tiếng. Thể loại chưa có → giọng thường.
KIEU_GIONG = {
    "ky_di":    ("Brian",   "[whispers] {a}... [sinister laugh] {b} [shouting] {c}"),
    "gao":      ("Callum",  "[shouting] {a} {b} [screaming] {c}"),
    "cam_xuc":  ("Jessica", "[crying] {a} {b} [shouting] {c}"),
    "hao_hung": ("Laura",   "[excited] {a} {b} [screams] {c}"),
    "thuong":   ("George",  "{a} {b} {c}"),
    "tinh_nghich": ("Charlotte", "[mischievously] {a}... [laughs] {b} [excited] {c}"),   # phép thuật / hài / tình cảm vui (anh 25/11/2026 giọng theo chủ đề phim)
}
# MÔ TẢ KIỂU GIỌNG cho mô hình chọn theo chủ đề phim (xep-khung.py, cùng lượt xếp khung) — thêm kiểu mới vào KIEU_GIONG thì thêm mô tả ở đây
MO_TA_GIONG = {"ky_di": "LOW PRIORITY, pick only when no other style fits — male, whispering then sinister laugh then shouting — supernatural, dark fantasy, system / cultivation, mystery",
               "gao": "male, shouting and screaming — revenge, hidden billionaire / underdog, mafia, power reversal, action",
               "cam_xuc": "female, crying then shouting — regret, betrayal, mother and child, tragic family drama",
               "hao_hung": "female, excited and screaming — passionate romance, school love, period drama",
               "thuong": "male, plain calm narration — serious drama, biography, war, when no strong mood fits",
               "tinh_nghich": "female, mischievous with laughs then excited — magic / wishes, comedy, light-hearted or sweet romance"}
assert set(MO_TA_GIONG) == set(KIEU_GIONG), "MO_TA_GIONG phải mô tả đủ mọi kiểu trong KIEU_GIONG"
# GIỌNG KHÔNG ƯU TIÊN (anh 27/11/2026 "Đổi hết các giọng AD về dạng thường là mặc định" + "ko phải cấm ky_di mà là ko ưu tiên nó"): KHÔNG cấm —
# --giong ky_di / anh ghim / AI chọn vẫn ra ky_di; chỉ không bao giờ là mặc định, không gắn sẵn cho thể loại nào, xếp CUỐI trong vòng xoay và AI được dặn chỉ chọn khi không kiểu nào khác hợp.
GIONG_SAU = {"ky_di"}
KIEU_CHON = [k for k in KIEU_GIONG if k not in GIONG_SAU] + [k for k in KIEU_GIONG if k in GIONG_SAU]   # thứ tự ưu tiên: giọng không ưu tiên xếp cuối
THE_LOAI_GIONG = {"fantasy": "thuong", "soi": "thuong", "vien_tuong": "thuong", "he_thong": "thuong",   # từng là ky_di — 27/11/2026 ky_di không ưu tiên nên không gắn sẵn cho thể loại
                  "vo_danh": "gao", "ty_phu": "gao", "mafia": "gao", "doi_thuong": "gao",
                  "hoi_han": "cam_xuc", "me_con": "cam_xuc", "tinh_cam": "hao_hung", "hoc_duong": "hao_hung", "co_trang": "hao_hung"}
UNG_VIEN = 20   # số khung ứng viên gửi AI xếp hạng
# BẢN MỚI (08/11/2026: AI chọn khung + tên từ poster + HD 8 Mb/s)
MOI = "--cu" not in sys.argv   # anh DUYỆT mẫu 08/11/2026 → bản mới là mặc định; --cu = cách cũ (khung điểm máy, chữ vàng, 3 Mb/s)
LOC = "fps=2/3"   # khung ứng viên: mỗi 1,5 giây (từ giây 3) — một chuỗi lọc cho cả khung nhỏ lẫn khung gốc
FONT = "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf"
# LỚP "FREE" — LUẬT CHUNG MỌI DẠNG TĨNH (sổ dạng etp-dang.json "tinh": AT · ATT · PO · CTS — anh 09/11/2026 "cho vào luật chung về dựng creative dạng ảnh tĩnh, PO"):
# mọi lớp chữ đứng yên của creative tĩnh đi qua lop_free (anh-tinh.anh cho AT / ATT, tinh-ba-kieu.py cho PO / CTS). Gốc (Dol / Ethopex 09/11/2026: "Trong Creative, hình ảnh, video có chữ 'Free' gần như giúp mình mua được CPC rẻ hơn" + mẫu poster Dol gửi; anh 09/11: "Dựng free"):
# nhãn tím trên cùng "All Episodes Released" + nút xanh "Watch For Free" ngay dưới tên phim. LUÔN BẬT (anh chốt 19/11/2026 theo mẫu team Dol: "Phải luôn có text ở trên,
# FREE + mô tả tên phim!") — cờ --khong-free đã bỏ; bản không Free mang nhãn cta khong_nut và cổng apps/etp/cong.at_sai_dang chặn lên camp.
# Tên phim đẩy lên (đáy ≤ TEN_DAY_FREE) để nút xanh vẫn nằm trên vùng khung ứng dụng (~15% đáy: tên trang, nút của Meta).
FREE = {"en": ("All Episodes Released", "Watch For Free"), "es": ("Todos los episodios ya disponibles", "Míralo gratis")}
FONT_FREE, TIM, XANH, TEN_DAY_FREE = "/System/Library/Fonts/Supplemental/Arial Bold.ttf", (124, 58, 237, 255), (34, 197, 94, 255), 0.72
if "--khong-free" in sys.argv: sys.exit("--khong-free đã bỏ: AT chỉ còn MỘT dạng có Free (anh chốt 19/11/2026, sổ luật at_chi_dang_free)")
CO_FREE = True
# KIỂU NHÃN + NÚT CỦA LỚP FREE (anh 20/11/2026 "cần các mẫu Button và Text ở trên All Episodes... dạng khác theo mẫu spy đẹp hơn"): chữ GIỮ NGUYÊN (FREE — cổng kiem-thoai
# gỡ đúng hai câu này), chỉ đổi cách vẽ theo các kiểu đối thủ dùng trên mẫu spy. Mỗi bản của một phim một kiểu (bản b → FREE_KIEU[b % n]) để đo kiểu nào hơn:
#   vang — nhãn hộp tối viền vàng mảnh chữ vàng · nút viên thuốc tối viền vàng đôi (mẫu "Watch Now" viền vàng)
#   do   — nhãn dải trắng trọn ngang chữ đen đậm (mẫu "Watch Movies Now! Free") · nút viên thuốc đỏ chữ trắng (mẫu "Watch Free" đỏ)
#   kinh — nhãn chữ trắng không hộp, hai vạch vàng hai bên · nút trắng chữ tối kèm nút phát đỏ (mẫu khung trình phát)
#   tim  — kiểu cũ: nhãn tím, nút xanh lá (giữ để so, không nằm trong vòng xoay)
# KIỂU LẤY TỪ THƯ VIỆN MẪU (anh 20/11/2026 "mọi mẫu creative đều phải lưu vào thư viện và việc sx đều phải dựa vào đó"): danh sách kiểu = các mục của sổ
# apps/etp2/src/lib/etp-mau-cr.json có trường lop_free và đang dùng được (trang_thai may / thu) — tắt / thêm một kiểu là sửa SỔ (tab Mẫu Creative), không sửa mã.
# Sổ không còn kiểu nào → dừng kêu rõ (không tự vẽ kiểu ngoài thư viện). FREE_MAU: kiểu → mã mẫu trong sổ (ghi vào ghi chú bản dựng để đo từng kiểu).
def _free_tu_so():
    import importlib.util
    s = importlib.util.spec_from_file_location("so_mau_free", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "etp", "so_mau.py")); SM = importlib.util.module_from_spec(s); s.loader.exec_module(SM)
    return {x["lop_free"]: x["ma"] for x in SM.DS if x.get("lop_free") and x.get("trang_thai") in SM.DUOC_LEN}
FREE_MAU = _free_tu_so(); FREE_KIEU = list(FREE_MAU); FREE_BAN = [0]   # FREE_BAN[0] = số bản đang vẽ (anh() / tinh-ba-kieu đặt trước khi vẽ)
def free_mau(ban=None):
    """mã mẫu thư viện của kiểu nhãn + nút dùng cho bản `ban` (mặc định bản đang vẽ)"""
    if not FREE_KIEU: raise RuntimeError("thư viện mẫu (apps/etp2/src/lib/etp-mau-cr.json) không còn kiểu nhãn + nút Free nào đang dùng được (trường lop_free) — thêm / bật lại ở tab Mẫu Creative")
    return FREE_MAU[FREE_KIEU[(FREE_BAN[0] if ban is None else ban) % len(FREE_KIEU)]]
VANG_F, DO_F = (240, 200, 112, 255), (225, 29, 46, 255)
def lop_free(lop, lang, day_ten=None, kieu=None, chi_nhan=False):
    """vẽ nhãn trên cùng + nút dưới tên phim (day_ten = mép dưới tên, px; None = sát vùng giao diện Meta ở đáy — PO, tên nằm sẵn trên poster) lên lớp chữ RGBA đứng yên
    chi_nhan: chỉ vẽ nhãn trên cùng (mẫu đã có nút CTA riêng, vd ảnh động logo gốc — anh 25/11/2026 "thiếu dòng ở trên: all episodes...")"""
    if day_ten is None: day_ten = H
    if not kieu: free_mau(); kieu = FREE_KIEU[FREE_BAN[0] % len(FREE_KIEU)]   # kiểu của thư viện mẫu; hết kiểu → free_mau() dừng kêu rõ
    nhan, nut = FREE.get(lang, FREE["en"]); d = ImageDraw.Draw(lop)
    def co(chu, c, max_w):
        while c > 40 and ImageFont.truetype(FONT_FREE, c).getlength(chu) > max_w: c -= 4
        f = ImageFont.truetype(FONT_FREE, c); return f, f.getbbox(chu)
    def bong(hop, r, lech=(4, 8), do=120, mo=10):
        bo = Image.new("RGBA", (W, H)); ImageDraw.Draw(bo).rounded_rectangle((hop[0] + lech[0], hop[1] + lech[1], hop[2] + lech[0], hop[3] + lech[1]), radius=r, fill=(0, 0, 0, do)); lop.alpha_composite(bo.filter(ImageFilter.GaussianBlur(mo)))
    def chu_bong(x, y, chu, f, mau):
        bo = Image.new("RGBA", (W, H)); ImageDraw.Draw(bo).text((x + 2, y + 4), chu, font=f, fill=(0, 0, 0, 255)); bo = bo.filter(ImageFilter.GaussianBlur(6)); lop.alpha_composite(bo); lop.alpha_composite(bo);   # bóng đôi: chữ trắng vẫn đọc được trên nền sáng
        d.text((x, y), chu, font=f, fill=mau)
    yn, yb = int(H * 0.055), int(min(day_ten + 44, H * 0.86 - 140))
    if kieu == "tim":
        for chu, c, y, mau, dx, dy, mw in ((nhan, 76, yn, TIM, 44, 26, W - 160),) + (() if chi_nhan else ((nut, 84, yb, XANH, 70, 34, W - 260),)):
            f, (x0, y0, x1, y1) = co(chu, c, mw - 2 * dx); w, h = x1 - x0 + 2 * dx, y1 - y0 + 2 * dy; x = (W - w) // 2
            bong((x, y, x + w, y + h), h // 4); d.rounded_rectangle((x, y, x + w, y + h), radius=h // 4, fill=mau); d.text((x + dx - x0, y + dy - y0), chu, font=f, fill=(255, 255, 255, 255))
        return lop
    # ── NHÃN ──
    if kieu == "vang":
        f, (x0, y0, x1, y1) = co(nhan, 66, W - 300); dx, dy = 50, 26; w, h = x1 - x0 + 2 * dx, y1 - y0 + 2 * dy; x = (W - w) // 2
        bong((x, yn, x + w, yn + h), 14); d.rounded_rectangle((x, yn, x + w, yn + h), radius=14, fill=(14, 12, 10, 215), outline=VANG_F, width=4)
        d.text((x + dx - x0, yn + dy - y0), nhan, font=f, fill=VANG_F)
    elif kieu == "do":
        f, (x0, y0, x1, y1) = co(nhan, 70, W - 120); h = y1 - y0 + 2 * 30
        bong((0, yn, W, yn + h), 0, (0, 8), 110, 12); d.rectangle((0, yn, W, yn + h), fill=(255, 255, 255, 255)); d.rectangle((0, yn + h - 8, W, yn + h), fill=DO_F)
        d.text(((W - (x1 - x0)) // 2 - x0, yn + 26 - y0), nhan, font=f, fill=(14, 14, 16, 255))
    else:   # kinh
        f, (x0, y0, x1, y1) = co(nhan, 64, W - 340); w, h = x1 - x0, y1 - y0; x = (W - w) // 2; ym = yn + 20
        chu_bong(x - x0, ym - y0, nhan, f, (255, 255, 255, 255))
        for a_, b_ in ((60, x - 28), (x + w + 28, W - 60)):
            if b_ - a_ > 30: d.rectangle((a_, ym + h // 2 - 2, b_, ym + h // 2 + 2), fill=VANG_F)
    if chi_nhan: return lop
    # ── NÚT ──
    if kieu == "vang":
        f, (x0, y0, x1, y1) = co(nut, 80, W - 420); dx, dy = 84, 36; w, h = x1 - x0 + 2 * dx, y1 - y0 + 2 * dy; x = (W - w) // 2; r = h // 2
        bong((x, yb, x + w, yb + h), r, do=150, mo=12); d.rounded_rectangle((x, yb, x + w, yb + h), radius=r, fill=(16, 13, 10, 235), outline=VANG_F, width=6)
        d.rounded_rectangle((x + 12, yb + 12, x + w - 12, yb + h - 12), radius=r - 12, outline=(240, 200, 112, 150), width=2)
        d.text((x + dx - x0, yb + dy - y0), nut, font=f, fill=VANG_F)
    elif kieu == "do":
        f, (x0, y0, x1, y1) = co(nut, 84, W - 400); dx, dy = 90, 36; w, h = x1 - x0 + 2 * dx, y1 - y0 + 2 * dy; x = (W - w) // 2; r = h // 2
        bong((x, yb, x + w, yb + h), r, do=150, mo=12); d.rounded_rectangle((x - 5, yb - 5, x + w + 5, yb + h + 5), radius=r + 5, fill=(255, 255, 255, 235)); d.rounded_rectangle((x, yb, x + w, yb + h), radius=r, fill=DO_F)
        d.text((x + dx - x0, yb + dy - y0), nut, font=f, fill=(255, 255, 255, 255))
    else:
        f, (x0, y0, x1, y1) = co(nut, 78, W - 520); dy = 36; h = y1 - y0 + 2 * dy; tron = h - 28; w = x1 - x0 + 70 + tron + 26 + 60; x = (W - w) // 2; r = h // 2
        bong((x, yb, x + w, yb + h), r, do=150, mo=12); d.rounded_rectangle((x, yb, x + w, yb + h), radius=r, fill=(250, 250, 250, 248))
        cx, cy = x + 14 + tron // 2, yb + h // 2; d.ellipse((cx - tron // 2, cy - tron // 2, cx + tron // 2, cy + tron // 2), fill=DO_F)
        tg = tron * 0.24; d.polygon([(cx - tg * 0.7, cy - tg), (cx - tg * 0.7, cy + tg), (cx + tg * 1.1, cy)], fill=(255, 255, 255, 255))
        d.text((x + 14 + tron + 26 - x0, yb + dy - y0), nut, font=f, fill=(18, 18, 22, 255))
    return lop
MA_HOA = ["-c:v", "h264_videotoolbox", "-b:v", "8M" if MOI else "3M", "-maxrate", "10M" if MOI else "4500k",   # HD (anh 08/11/2026 "nhớ là dạng HD"): 1080x1920, 8 Mb/s (trước 3M)
           "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "44100"]   # như cat-canh.MA_HOA (Mac)

def sql(q):
    return subprocess.run(["ssh", B, f"{ENV}; psql \"$DATABASE_URL\" -tAq"], input=q, capture_output=True, text=True, check=True).stdout.strip()
def sh(*a, han=900): return subprocess.run(list(a), capture_output=True, text=True, timeout=han)
# CÂU ĐỌC SINH THÊM (anh 27/11/2026 "phải cho tao sinh thêm kiểu khác"): nút ✨ ở phiếu lên camp (etp2 sinhCauDoc) ghi etp.cau_hinh 'cau_doc_them' {lc: [[a, b, c]…]}
# → nối SAU các mẫu của sổ etp-mau-cr.json, giữ thứ tự (id 'es:1' = mẫu thứ hai của danh sách nối — etp2 dựng id cùng cách)
try: _CAU_THEM = json.loads(sql("select gia_tri::text from etp.cau_hinh where khoa = 'cau_doc_them'") or "{}")
except Exception as e: print(f"⚠ không đọc được câu đọc sinh thêm (etp.cau_hinh cau_doc_them): {str(e)[:120]} — chỉ dùng mẫu của sổ", file=sys.stderr); _CAU_THEM = {}
for _k, _v in _CAU_THEM.items(): CAU.setdefault(_k, []).extend(tuple(m) for m in _v if isinstance(m, list) and len(m) == 3 and all(isinstance(x, str) and x for x in m) and not re.match(r"\W*(for\s+free|free|gratis)\b", m[0], re.I))   # câu mở bằng Free/gratis không nạp (etp2 sinhCauDoc cũng chặn)
def ten_sach(t): return re.sub(r"\s*[（(](?:DUBBED|Doblado)[)）]\s*", " ", t or "").strip()

def chon(so):
    """phim mới bắt đầu lãi (nhà) — cổng chặn lấy từ apps/etp/cong.phim_chan_len (một nguồn với thay-the / nhan-ban)"""
    chan = json.loads(subprocess.run(["ssh", B, f"{ENV}; cd apps/etp && python3 -c 'import json, cong; print(json.dumps(cong.phim_chan_len()))'"],
                                     capture_output=True, text=True, check=True).stdout.strip() or "{}")
    ds = json.loads(sql(f"""with p as (select c.content_id, min(c.tao) dau, sum(n.chi) filter (where n.ngay >= current_date - 3) chi3, sum(n.thu) filter (where n.ngay >= current_date - 3) thu3
        from etp.camp c join etp.so_ngay n using (camp_id) where c.content_id is not null group by 1)
      select coalesce(json_agg(x order by x.dau desc), '[]') from (select p.content_id, f.ten, coalesce(f.locale, substring(f.url from 'dramaboxdb[.]com/([a-z][a-z])/(?:ep|movie)/'), 'en') locale, f.url, f.the_loai, p.dau, round(p.thu3 - p.chi3, 2) lai3 from p join etp.phim f using (content_id)
        where p.dau > now() - interval '{NGAY_MOI} days' and ((p.chi3 >= 3 and p.thu3 > p.chi3) or exists (select 1 from etp.camp_co_hoi h where h.content_id = p.content_id)) and f.url is not null
          and exists (select 1 from etp.camp k where k.content_id = p.content_id and k.trang_thai = 'ACTIVE')
          and not exists (select 1 from etp.thu_vien v where v.content_id = p.content_id and v.dang = '{DANG}')) x""") or "[]")
    for x in ds:
        if str(x["content_id"]) in chan: print(f"bỏ {x['content_id']} {x['ten']}: cổng chặn — {chan[str(x['content_id'])]}")
    return [x for x in ds if str(x["content_id"]) not in chan][:so]

def phim(ids):
    return json.loads(sql(f"select coalesce(json_agg(x), '[]') from (select content_id, ten, coalesce(locale, substring(url from 'dramaboxdb[.]com/([a-z][a-z])/(?:ep|movie)/'), 'en') locale, url, the_loai from etp.phim where content_id in ({','.join(map(str, ids))})) x") or "[]")

def may_doc():
    import importlib.util
    s = importlib.util.spec_from_file_location("kt", os.path.join(D, "kiem-thoai.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m.may_doc()

def doc_mat(fs, han=900):
    """máy đọc Vision --mat cho các ảnh → [{anh, chu, khung, mat}, …]. MỘT đường cho mọi chỗ gọi (anh-tinh, dung-mau): Neural Engine iMac lúc chạy lúc
    lỗi (e5rtError, doc-chu đợi 3 phút rồi thoát mã 2, stdout rỗng) — trước 26/11/2026 bốn chỗ gọi chỉ đọc stdout nên lỗi máy thành "không khung nào đạt"
    (Bugatti 134241). Nay: thoát khác 0 → thử lại tới 3 lượt (tiến trình mới ấm ANE lại), vẫn lỗi → kêu to đúng câu máy đọc nói."""
    for lan in range(3):
        r = subprocess.run([may_doc(), "--mat", *fs], capture_output=True, text=True, timeout=han)
        if r.returncode == 0: return [json.loads(l) for l in r.stdout.splitlines() if l.startswith("{")]
        print(f"máy đọc mặt lỗi (lượt {lan + 1}/3): {r.stderr.strip()[-200:]}", file=sys.stderr)
    raise RuntimeError(f"máy đọc mặt (Vision) lỗi 3 lượt liền: {r.stderr.strip()[-300:]}")

def goc_nho(k):
    """hộp chữ là logo nhỏ ở góc (chữ "R" ReelShort…) — xoá được, không loại khung"""
    return k[3] * k[4] < 0.006 and (k[1] < 0.2 or k[1] + k[3] > 0.8)

def diem(anh, mat, chu):
    """điểm một khung: mặt chính to + Apple chấm nét/sáng/nhìn thẳng (≥ 0,45: dưới mức đó Vision nhận nhầm đồ vật — chiếc giày 172316, 05/11/2026).
    Chữ in cứng chỉ được nằm DƯỚI mặt ở nửa dưới (phụ đề, tên nhân vật) hoặc là logo nhỏ ở góc — anh() xoá hết; chữ đè mặt / nửa trên = loại.
    Mặt phải xong trước 62% chiều cao để tên phim nằm dưới mặt. → (điểm, hộp mặt, hộp chữ cần xoá)"""
    mat = [m for m in mat or [] if m[4] >= 0.45]
    if not mat or len(mat) > 3: return 0, None, None
    x, y, w, h, q = max(mat, key=lambda m: m[2] * m[3])
    cx = x + w / 2
    if not 0.14 < h < 0.5 or y < 0.04 or y + h > 0.62 or not 0.25 < cx < 0.75: return 0, None, None
    if any(not goc_nho(k) and k[2] < max(0.5, y + h) for k in chu): return 0, None, None
    im = Image.open(anh).convert("L"); X, Y = im.size
    o = im.crop((int(x * X), int(y * Y), int((x + w) * X), int((y + h) * Y)))
    sang = ImageStat.Stat(o).mean[0]
    if not 55 < sang < 210: return 0, None, None
    net = ImageStat.Stat(o.filter(ImageFilter.FIND_EDGES)).stddev[0]
    return q * (0.6 + 0.4 * min(1, h / 0.25)) * (0.6 + 0.4 * min(1, net / 40)) * (1 if not chu else 0.92), (x, y, w, h), \
        [[k[1] - k[3] / 2, k[2] - k[4] / 2, k[3] * 2, k[4] * 2] if goc_nho(k) else k[1:] for k in chu]   # khung sạch chữ nhỉnh hơn · logo góc: OCR chỉ bắt chữ "R", ô vuông bao quanh rộng gấp đôi

def dau_tinh(kd, tap):
    """logo / watermark ĐỨNG YÊN của app gốc ở 4 góc: trung bình các khung một tập — nội dung nhoè đi, logo giữ nét (đo 05/11/2026: "R" ReelShort
    nhảy giữa góc trên-trái và dưới-phải, cả hai hiện rõ trên ảnh trung bình) → [x, y, rộng, cao] 0–1"""
    fs = sorted(f for f in os.listdir(kd) if f.startswith(tap))[::2][:80]; tb = None
    for i, f in enumerate(fs):
        im = Image.open(os.path.join(kd, f)).convert("L"); tb = im if tb is None else Image.blend(tb, im, 1 / (i + 1))
    if tb is None: return []
    e = tb.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(9)).resize((tb.width // 4, tb.height // 4))
    X, Y = e.size; px = e.load(); thay = set(); ra = []
    for sx in range(X):
        for sy in range(Y):
            if px[sx, sy] < 128 or (sx, sy) in thay: continue
            hang, cum = [(sx, sy)], []; thay.add((sx, sy))
            while hang:   # mảng liền (4 hướng)
                a, b = hang.pop(); cum.append((a, b))
                for c, d in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= c < X and 0 <= d < Y and (c, d) not in thay and px[c, d] >= 128: thay.add((c, d)); hang.append((c, d))
            x0, x1, y0, y1 = min(a for a, _ in cum) / X, (max(a for a, _ in cum) + 1) / X, min(b for _, b in cum) / Y, (max(b for _, b in cum) + 1) / Y
            goc = (x1 < 0.3 or x0 > 0.7) and (y1 < 0.2 or y0 > 0.8)   # nằm trọn trong một góc
            if goc and 0.04 < x1 - x0 < 0.16 and 0.02 < y1 - y0 < 0.09: ra.append([x0, y0, x1 - x0, y1 - y0])   # cỡ logo; lớn hơn = cảnh đứng yên
    return ra

def xoa(im, hop):
    """xoá chữ in cứng / logo trong các hộp (0–1) bằng LẤP TỪ VIỀN VÀO: lòng hộp đổ màu trung bình của vành quanh nó rồi làm mờ lặp nhiều lượt,
    mỗi lượt giữ nguyên phần ngoài hộp → màu xung quanh lan vào. Lọc trung vị (bản đầu) nuốt được nét chữ nhưng để lại viền ô logo mờ (05/11/2026)."""
    X, Y = im.size
    for x, y, w, h in hop:
        p = int(0.012 * X); b = (int(x * X) - p, int(y * Y) - p, int((x + w) * X) + p, int((y + h) * Y) + p)
        v = max(b[2] - b[0], b[3] - b[1]) // 2 + p; n = (max(0, b[0] - v), max(0, b[1] - v), min(X, b[2] + v), min(Y, b[3] + v))
        if b[2] - b[0] < 4 or b[3] - b[1] < 4: continue
        o = im.crop(n); m = Image.new("L", o.size, 0); ImageDraw.Draw(m).rectangle((b[0] - n[0], b[1] - n[1], b[2] - n[0], b[3] - n[1]), fill=255)
        nen = Image.new("RGB", o.size, tuple(int(c) for c in ImageStat.Stat(o, ImageChops.invert(m)).mean))
        r = Image.composite(nen, o, m)
        bk = max(5, min(b[2] - b[0], b[3] - b[1]) // 6)   # hộp to thì lan xa hơn, không để mảng phẳng
        for _ in range(30): r = Image.composite(r.filter(ImageFilter.GaussianBlur(bk)), o, m)
        im.paste(Image.composite(r, o, m.filter(ImageFilter.GaussianBlur(p / 2))), n[:2])
    return im

def khung(cid, url, tm):
    """→ (tập, giây, khung mặt, điểm, ảnh nhỏ) của khung đẹp nhất trong 3 tập miễn phí"""
    sh("python3", os.path.join(D, "tai-tap.py"), url, tm, "3", han=1800)
    taps = sorted(f for f in os.listdir(tm) if re.fullmatch(r"tap\d+\.mp4", f))[:3]
    if not taps: raise RuntimeError("không tải được tập miễn phí")
    kd = os.path.join(tm, "khung"); os.makedirs(kd, exist_ok=True)
    for f in os.listdir(kd): os.remove(os.path.join(kd, f))
    for t in taps:   # bỏ 3 giây đầu (logo app / tóm tắt tập trước)
        sh("ffmpeg", "-v", "error", "-ss", "3", "-i", os.path.join(tm, t), "-vf", f"{LOC},scale=540:-2", "-q:v", "3", os.path.join(kd, f"{t[:-4]}_%04d.jpg"))
    fs = sorted(os.path.join(kd, f) for f in os.listdir(kd) if f.endswith(".jpg"))
    ra = []
    for i in range(0, len(fs), 200):
        for j in doc_mat(fs[i:i + 200]):
            d, m, ch = diem(j["anh"], j.get("mat"), j.get("khung") or [])
            if d: tap, so = re.match(r".*/(tap\d+)_(\d+)\.jpg", j["anh"]).groups(); ra.append((d, tap, int(so), m, j["anh"], ch))
    if not ra: raise RuntimeError(f"không khung nào đạt (mặt to nét, chữ không đè mặt) trong {len(fs)} khung")
    # ỨNG VIÊN ĐA DẠNG (anh 08/11/2026 "chọn các góc, khung hình ấn tượng nhất, đẹp nhất"): điểm máy cao → thấp, cách nhau ≥ 4 khung (6 giây) trong cùng tập,
    # tối đa UNG_VIEN → AI xếp hạng (xep-khung.py, box3) → lấy N khung đầu cho N bản creative
    uv = []
    for d, tap, g, m, nho, ch in sorted(ra, key=lambda r: -r[0]):
        if any(u["tap"] == tap and abs(u["so"] - g) < 4 for u in uv): continue
        uv.append({"tap": tap, "so": g, "mat": m, "diem": round(d, 3), "nho": nho, "so_khung": len(fs), "dat": len(ra), "xoa": ch + dau_tinh(kd, tap)})
        if len(uv) >= UNG_VIEN: break
    return uv

KHUNG_CHI = []   # --anh (main đặt)
def khung_chi(tm):
    """ứng viên từ ảnh chỉ định (--anh): mặt to nhất theo máy đọc (cần một mặt để đặt chữ dưới mặt), chữ in cứng để anh() đọc lại + xoá trên ảnh gốc"""
    uv = []
    for i, f in enumerate(KHUNG_CHI):
        if not os.path.exists(f): raise RuntimeError(f"--anh: không có tệp {f}")
        j = (doc_mat([f], 300) or [{}])[-1]
        mat = [m for m in j.get("mat") or [] if m[4] >= 0.3]
        if not mat: raise RuntimeError(f"--anh {os.path.basename(f)}: máy không thấy mặt nào — chọn ảnh có mặt nhân vật rõ")
        x, y, w, h, q = max(mat, key=lambda m: m[2] * m[3])
        uv.append({"tap": "chi-" + re.sub(r"\W+", "-", os.path.splitext(os.path.basename(f))[0])[:40], "so": i + 1, "mat": (x, y, w, h), "diem": round(q, 3), "nho": f,
                   "so_khung": 1, "dat": 1, "xoa": [], "goc_tep": os.path.abspath(f)})
    return uv

def _mo_ta(url):
    """tóm tắt thật của phim (tai-tap.mo_ta) — lỗi thì rỗng, AI xếp theo luật chung"""
    try:
        import importlib.util
        s = importlib.util.spec_from_file_location("tt_mo_ta", os.path.join(D, "tai-tap.py")); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m.mo_ta(url)
    except Exception as e: print("không đọc được tóm tắt phim:", e, file=sys.stderr); return ""
def xep_ai(ten, uv, mo_ta="", the_loai="", poster=None, chon_giong=None):
    """AI xếp hạng ứng viên theo độ ấn tượng / đẹp (box3 xep-khung.py, ckey) → (danh sách theo thứ tự, lý do, ₫). Lỗi → giữ thứ tự điểm máy.
    poster: POSTER GỐC của phim làm ảnh đối chiếu (anh 20/11/2026 "Sao nó ko liên quan gì đến poster gốc?" — Undercover Prison King ra khung người lính quân phục trong khi
    poster + mọi ad đối thủ là nhân vật chính áo tù cam) → AI ưu tiên khung đúng nhân vật chính, đúng tạo hình như trên poster. Không truyền thì tự tìm poster.jpg cạnh thư mục khung.
    chon_giong: dict rỗng truyền vào → cùng lượt gọi, AI chọn KIỂU GIỌNG theo chủ đề phim (MO_TA_GIONG), ghi vào {"giong", "giong_ly_do"} (anh 25/11/2026)."""
    import base64, io
    def du(p_, q=80, cao=None):
        im = Image.open(p_).convert("RGB")
        if cao and im.height > cao: im = im.resize((round(im.width * cao / im.height), cao))
        b = io.BytesIO(); im.save(b, "JPEG", quality=q); return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
    anh = [du(u["nho"]) for u in uv]
    poster = poster or (os.path.join(os.path.dirname(os.path.dirname(uv[0]["nho"])), "poster.jpg") if uv else None)
    pa = du(poster, 82, 640) if poster and os.path.exists(poster) else None
    r = subprocess.run(["ssh", B, f"{ENV}; python3 apps/xuong-video/scripts/ethopex/xep-khung.py"], input=json.dumps({"ten": ten, "anh": anh, "mo_ta": mo_ta, "the_loai": the_loai, **({"poster": pa} if pa else {}), **({"giong_chon": {k: v for k, v in MO_TA_GIONG.items() if k in KIEU_CHON}} if chon_giong is not None else {})}), capture_output=True, text=True, timeout=300)
    try: j = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception: j = {"thu_tu": [], "ly_do": (r.stderr or r.stdout)[-200:], "vnd": 0}
    tt = j.get("thu_tu") or list(range(len(uv)))
    if chon_giong is not None and j.get("giong") in KIEU_CHON: chon_giong.update(giong=j["giong"], giong_ly_do=j.get("giong_ly_do") or "")
    for x in j.get("khung") or []:   # nhãn cảm xúc + nhân vật từng khung (có khi gửi tóm tắt phim) — bản dựng lần sau cho cùng phim chọn khung khác cảm xúc
        if 0 <= x.get("i", -1) < len(uv): uv[x["i"]]["cam_xuc"] = x.get("cam_xuc") or ""; uv[x["i"]]["nhan_vat"] = x.get("nhan_vat") or ""
    return [uv[i] for i in tt], j.get("ly_do", ""), int(j.get("vnd") or 0)

def giong_tu(a, b):
    """hai từ coi là MỘT khi máy đọc chữ đọc lệch một ký tự (21/11/2026: chữ viết tay "Bugatti" đọc thành "Bugattis" → không khớp tên, logo bị coi là chữ khác và cắt mất)"""
    if a == b: return True
    if min(len(a), len(b)) < 4 or abs(len(a) - len(b)) > 1: return False
    if len(a) > len(b): a, b = b, a
    i = 0
    while i < len(a) and a[i] == b[i]: i += 1
    return a[i + (len(a) == len(b)):] == b[i + 1:]

def khop_tu(doc, can, ten=None):
    """các từ của tên phim (can) có trong tập từ máy đọc (doc), cho phép lệch một ký tự"""
    # máy đọc chữ hay DÍNH từ (25/11/2026 Deny Me, Dragon King: đọc "DenyMe," "Dragonkus") → từ đọc được chứa trọn từ của tên (≥ 2 ký tự) cũng tính là khớp
    co = {c for c in can if any(giong_tu(d, c) or (len(d) > len(c) >= 2 and c in d) for d in doc)}
    if ten:   # cụm 2–3 từ liền nhau của tên bị đọc dính + lệch đuôi ("Dragonkus" ≈ "dragonking") → cả cụm tính là khớp
        tt = [w for w in re.findall(r"[a-z0-9áéíóúñü]+", re.sub(r"['’`]", "", ten.lower()))]
        for n in (2, 3):
            for i in range(len(tt) - n + 1):
                cum = "".join(tt[i:i + n])
                if any(len(d) >= 6 and difflib.SequenceMatcher(None, d, cum).ratio() >= 0.73 for d in doc): co |= set(tt[i:i + n]) & can
    return co

def tu_chu(x):
    """tách từ một dòng chữ để so với tên phim — bỏ dấu nháy trước (25/11/2026 "WHAT IF I'M": "i'm" bị tách "i" + "m", không khớp tên) — dùng chung anh-tinh + logo-goc"""
    return set(re.findall(r"[a-z0-9áéíóúñü]+", re.sub(r"['’`]", "", x.lower())))

def thieu_tu(ten, j, hop):
    """từ của tên phim mà các hộp tên KHÔNG đọc ra (đã khớp được một phần tên) — 21/11/2026 Get Out of My Bugatti: chữ "Bugatti" viết tay máy đọc chữ bỏ sót,
    cắt theo hộp chữ thì logo chỉ còn "Get Out of My". Hộp lấy theo khối chữ to nhất (không khớp từ nào) → set() (không đo được)."""
    tu = tu_chu; can = tu(ten)
    doc = khop_tu(set().union(*[tu(k[0]) for k in j.get("khung") or [] if k[1:] in hop]), can, ten)
    return can - doc if doc else set()

def hop_ten(ten, j):
    """các hộp chữ (x, y, rộng, cao — tỉ lệ ảnh) là TÊN PHIM trong kết quả máy đọc chữ một poster; không thấy → [] (dùng chung: ten_poster + logo-goc.py)"""
    tu = tu_chu
    can = tu(ten); hop = [k[1:] for k in j.get("khung") or [] if tu(k[0]) and sum(1 for d in tu(k[0]) if khop_tu({d}, can)) / len(tu(k[0])) >= 0.6]
    if not hop:
        # CHỮ HOA VĂN (08/11/2026 The Dragon's Silly Captive: chữ gothic, Vision đọc lệch → không khớp tên): tên phim gần như luôn là KHỐI CHỮ TO NHẤT nửa dưới poster
        # → dòng cao nhất (y > 0,45) + các dòng liền trên / dưới cao ≥ 50% nó; khối phải rộng ≥ 35% poster, không thì bỏ (chữ vàng)
        dd = sorted([k[1:] for k in j.get("khung") or [] if k[2] > 0.45 and k[4] > 0.025], key=lambda b: -b[3])
        if not dd: return []
        hop = [dd[0]]
        for b in dd[1:]:
            if b[3] >= 0.5 * dd[0][3] and any(abs((b[1] + b[3] / 2) - (h_[1] + h_[3] / 2)) < 1.6 * max(b[3], h_[3]) for h_ in hop): hop.append(b)
        if max(b[0] + b[2] for b in hop) - min(b[0] for b in hop) < 0.35: return []
    return hop

def ten_poster(ten, poster, ra):
    """TÊN PHIM TÁCH TỪ POSTER (anh 08/11/2026 "tách phần tên phim từ poster ra và gắn lên creative"): Vision đọc chữ poster → các dòng chữ khớp từ
    của tên phim → cắt vùng đó, chỉ giữ nét chữ (màu nhiều trong lõi dòng chữ, ít ở viền vùng cắt), thêm viền tối để đọc rõ trên mọi khung.
    Không có poster / không dòng nào khớp ≥ 60% từ của tên → None (anh() quay về chữ vàng)."""
    if os.path.exists(ra): os.remove(ra)   # tệp tên của lượt trước (bản 2, 3 dùng lại tệp này) — lượt này không tách được thì không được để bản cũ sót lại
    if not os.path.exists(poster): return None
    from collections import Counter
    j = json.loads(subprocess.run([may_doc(), poster], capture_output=True, text=True, timeout=300).stdout.strip() or "{}")
    hop = hop_ten(ten, j)
    if not hop or thieu_tu(ten, j, hop): return None   # tên thiếu từ → cắt theo hộp chữ sẽ mất phần đó; chữ vàng gõ đủ tên
    im = Image.open(poster).convert("RGB"); X, Y = im.size
    x0 = max(0, int(min(b[0] for b in hop) * X) - 12); y0 = max(0, int(min(b[1] for b in hop) * Y) - 12)
    x1 = min(X, int(max(b[0] + b[2] for b in hop) * X) + 12); y1 = min(Y, int(max(b[1] + b[3] for b in hop) * Y) + 12)
    c = im.crop((x0, y0, x1, y1)); w, h = c.size; px = list(c.getdata()); q = lambda p: (p[0] // 32, p[1] // 32, p[2] // 32)
    loi, vien, trong = Counter(), Counter(), set()
    for bx, by, bw, bh in hop:
        for yy in range(int(by * Y) - y0 - 6, int((by + bh) * Y) - y0 + 6):
            for xx in range(int(bx * X) - x0 - 6, int((bx + bw) * X) - x0 + 6): trong.add((xx, yy))
        for yy in range(int(by * Y) - y0 + int(bh * Y * .3), int(by * Y) - y0 + int(bh * Y * .7)):
            for xx in range(max(0, int(bx * X) - x0), min(w, int((bx + bw) * X) - x0), 2):
                if 0 <= yy < h: loi[q(px[yy * w + xx])] += 1
    for yy in range(h):
        for xx in (range(w) if yy < 8 or yy >= h - 8 else (*range(8), *range(w - 8, w))): vien[q(px[yy * w + xx])] += 1
    nl, nv = sum(loi.values()) or 1, sum(vien.values()) or 1
    chon = [k for k, v in sorted(((k, loi[k] / nl - 2 * vien.get(k, 0) / nv) for k in loi), key=lambda x: -x[1])[:6] if v > 0.01]
    if not chon: return None
    tong = {k: [0, 0, 0, 0] for k in chon}
    for p in px:
        t = tong.get(q(p))
        if t: t[0] += p[0]; t[1] += p[1]; t[2] += p[2]; t[3] += 1
    mau = [(t[0] / t[3], t[1] / t[3], t[2] / t[3]) for t in tong.values() if t[3]]
    a = [0 if (i % w, i // w) not in trong else max(0, min(255, int(255 * (1 - (min(((p[0]-m[0])**2+(p[1]-m[1])**2+(p[2]-m[2])**2) ** .5 for m in mau) - 40) / 40))))
         for i, p in enumerate(px)]
    m = Image.new("L", (w, h)); m.putdata(a); m = m.filter(ImageFilter.MedianFilter(3))
    # bỏ VỤN NỀN: mảng liền (trên ảnh thu 1/2) nhỏ hơn 0,4% vùng cắt, tâm NGOÀI hộp chữ OCR = đốm đèn / vạch nền trùng màu chữ, không phải nét chữ (mẫu 94344: vệt tím góc trên-phải)
    nho = m.resize((w // 2, h // 2)); W2, H2 = nho.size; pp = nho.load(); thay = set(); bo = Image.new("L", (W2, H2), 0); pb = bo.load()
    for sx in range(W2):
        for sy in range(H2):
            if pp[sx, sy] < 100 or (sx, sy) in thay: continue
            hang, cum = [(sx, sy)], []; thay.add((sx, sy))
            while hang:
                x_, y_ = hang.pop(); cum.append((x_, y_))
                for c_ in ((x_ + 1, y_), (x_ - 1, y_), (x_, y_ + 1), (x_, y_ - 1)):
                    if 0 <= c_[0] < W2 and 0 <= c_[1] < H2 and c_ not in thay and pp[c_] >= 100: thay.add(c_); hang.append(c_)
            tx, ty = 2 * sum(c_[0] for c_ in cum) / len(cum) + x0, 2 * sum(c_[1] for c_ in cum) / len(cum) + y0   # tâm mảng, toạ độ poster
            ngoai = not any(bx * X <= tx <= (bx + bw) * X and by * Y <= ty <= (by + bh) * Y for bx, by, bw, bh in hop)
            if (len(cum) < 0.004 * W2 * H2 and ngoai) or len(cum) < 0.0008 * W2 * H2:   # dấu câu (",") nằm TRONG hộp chữ, to hơn chấm li ti → giữ
                for c_ in cum: pb[c_] = 255
    m = Image.composite(Image.new("L", (w, h), 0), m, bo.resize((w, h)).filter(ImageFilter.MaxFilter(5)))
    if sum(1 for v in m.getdata() if v > 128) < 0.05 * w * h: return None   # gần như không còn nét → tách hỏng
    out = c.convert("RGBA"); out.putalpha(m)
    nen = Image.new("RGBA", out.size, (0, 0, 0, 0)); nen.putalpha(m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3)).point(lambda v: min(230, int(v * 1.3))))
    Image.alpha_composite(nen, out).save(ra); return ra

def _logo_sach(ten, poster, ra, cid=None):
    """LOGO GỐC CẮT RỜI theo chuẩn mẫu Logo gốc (logo-goc.py, tầng không AI, 0₫) cho dòng ảnh tĩnh — 20/11/2026 soát American Sniper: ten_poster để lại HỘP TỐI vuông sau logo và
    rụng hoạ tiết khác màu (tâm ngắm đỏ). Chỉ nhận khi logo-goc cắt rời sạch ('cat'); nền poster rối (cần AI / dải poster) → None, bên gọi dùng ten_poster như cũ."""
    try:
        # CHUẨN TÁCH NỀN (anh 20/11/2026 "Sửa thành chuẩn tách nền"): nền poster rối → ảnh khoá màu của mô hình ảnh rẻ nhất (~200₫ / phim, một lần, nhớ logo-khoa.png cùng thư mục
        # với máy dựng theo mẫu). Chỉ nhận logo cắt rời sạch ('cat' 0₫ | 'khoa'); còn lại → None, bên gọi dùng ten_poster như cũ.
        # Chạy logo-goc.py bằng TIẾN TRÌNH CON của môi trường ~/.venvs/poster-mau (20/11/2026: máy dòng phim chạy python3 hệ thống không có scipy → nạp thẳng thì lỗi
        # "No module named 'scipy'", bước này âm thầm lùi về cách tách cũ ở MỌI phim — logo hộp tối vẫn ra dù mã đã lên main)
        py = os.path.expanduser("~/.venvs/poster-mau/bin/python")
        if not os.path.exists(py): print("logo gốc cắt rời: thiếu môi trường ~/.venvs/poster-mau — dùng cách tách cũ", file=sys.stderr); return None
        link = ""
        if cid:
            import importlib.util
            s2 = importlib.util.spec_from_file_location("tai_tap_lg", os.path.join(D, "tai-tap.py")); TT = importlib.util.module_from_spec(s2); s2.loader.exec_module(TT)
            url = sql(f"select coalesce(url, '') from etp.phim where content_id = {int(cid)}"); link = (TT.og_anh(TT.mo_rong(url)) if url else "") or ""
        tam = ra[:-4] + "-tam.png"
        rr = subprocess.run([py, os.path.join(D, "logo-goc.py"), poster, ten, tam, *(["--khoa", link, str(cid)] if link else [])], capture_output=True, text=True, timeout=900)
        if rr.stderr.strip(): print("logo gốc:", rr.stderr.strip()[-300:], file=sys.stderr)
        j_ = json.loads(rr.stdout.strip().splitlines()[-1]) if rr.stdout.strip() else {}; r, kieu = j_.get("ra"), j_.get("kieu")
        if not r or kieu not in ("cat", "khoa"): return None
        lg = Image.open(r).convert("RGBA"); dem = 40; to_ = Image.new("RGBA", (lg.width + 2 * dem, lg.height + 2 * dem)); to_.paste(lg, (dem, dem), lg); al = to_.split()[3]
        nen = Image.new("RGBA", to_.size, (0, 0, 0, 0)); nen.putalpha(ImageChops.lighter(al.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3)).point(lambda v: min(235, int(v * 1.4))),
                                                                              al.filter(ImageFilter.GaussianBlur(26)).point(lambda v: min(130, int(v * 1.5)))))
        Image.alpha_composite(nen, to_).save(ra); return ra
    except Exception as e: print("logo gốc cắt rời lỗi — dùng cách tách cũ:", e, file=sys.stderr); return None
def anh(cid, ten, k, tm, ban=0):
    """khung gốc → nền 1080x1920 (nền.png, sẽ phóng chậm) + lớp tên phim (chu.png, đứng yên) đặt dưới mặt"""
    FREE_BAN[0] = ban   # mỗi bản một kiểu nhãn + nút (FREE_KIEU)
    goc = os.path.join(tm, f"goc-{ban}.png")
    # khung gốc lấy bằng ĐÚNG chuỗi lọc đã trích khung nhỏ + số thứ tự khung (05/11/2026: tính giây tay lệch sang cảnh khác — chấm mặt cận, dựng ra cảnh đám đông)
    if os.path.exists(goc): os.remove(goc)
    if k.get("goc_tep"): Image.open(k["goc_tep"]).convert("RGB").save(goc)   # khung chỉ định (--anh)
    else: sh("ffmpeg", "-v", "error", "-y", "-ss", "3", "-i", os.path.join(tm, k["tap"] + ".mp4"), "-vf", f"{LOC},select=eq(n\\,{k['so'] - 1})", "-frames:v", "1", goc)
    if not os.path.exists(goc): raise RuntimeError(f"không lấy được khung gốc {k['tap']} #{k['so']}")
    if k.get("lat"): ImageOps.mirror(Image.open(goc).convert("RGB")).save(goc)   # khung lật trái ↔ phải (dung-mau --lat): mat / xoa của k đã lật sẵn
    j = json.loads(subprocess.run([may_doc(), goc], capture_output=True, text=True, timeout=300).stdout.strip() or "{}")   # đọc chữ lại trên khung gốc: chữ nhỏ ("R") ảnh 540px bỏ sót
    k["xoa"] += [[x - w / 2, y - h / 2, w * 2, h * 2] if goc_nho([t, x, y, w, h]) else [x, y, w, h] for t, x, y, w, h in j.get("khung") or []]
    im = xoa(Image.open(goc).convert("RGB"), k["xoa"]); s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x0 = min(max(0, round((k["mat"][0] + k["mat"][2] / 2) * im.width - W / 2)), im.width - W); y0 = (im.height - H) // 2
    im = im.crop((x0, y0, x0 + W, y0 + H)).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    toi = Image.new("L", (1, 256)); toi.putdata([0 if i < 140 else min(190, (i - 140) * 2) for i in range(256)])   # dải tối nửa dưới cho chữ đọc rõ
    im = Image.composite(Image.new("RGB", (W, H)), im, toi.resize((W, H)))
    nen = os.path.join(tm, f"nen-{ban}.png"); im.save(nen); mat_day = (k["mat"][1] + k["mat"][3]) * H
    tpp = os.path.join(tm, "ten-poster.png")
    tp = None if not MOI else (_logo_sach(ten, os.path.join(tm, "poster.jpg"), tpp, cid) or ten_poster(ten, os.path.join(tm, "poster.jpg"), tpp)) if ban == 0 or not os.path.exists(tpp) else tpp
    if tp:   # tên phim đúng kiểu chữ poster: rộng ≤ W − 120, cao ≤ 22% màn, đặt dưới mặt, chừa ~20% đáy
        t_ = Image.open(tp); s_ = min((W - 120) / t_.width, H * 0.22 / t_.height); t_ = t_.resize((round(t_.width * s_), round(t_.height * s_)), Image.LANCZOS)
        y = int(min(max(H * 0.66 - t_.height / 2, mat_day + 60), H * (TEN_DAY_FREE if CO_FREE else 0.80) - t_.height)); lop = Image.new("RGBA", (W, H)); lop.paste(t_, ((W - t_.width) // 2, y), t_)
        if CO_FREE: lop_free(lop, k.get("lang", "en"), y + t_.height); k["free"] = True
        k["ten_poster"] = True; lop.save(os.path.join(tm, f"chu-{ban}.png")); return nen, os.path.join(tm, f"chu-{ban}.png")
    t, c = ten.upper() if len(ten) <= 18 else ten, 120
    while True:
        f = ImageFont.truetype(FONT, c); dong, cur = [], ""
        for w_ in t.split():
            thu = f"{cur} {w_}".strip()
            if cur and f.getlength(thu) > W - 140: dong.append(cur); cur = w_
            else: cur = thu
        dong.append(cur)
        if len(dong) <= 3 or c <= 64: break
        c -= 8
    cao = int(c * 1.12) * len(dong)
    y = int(min(max(H * 0.66 - cao / 2, mat_day + 60), H * (TEN_DAY_FREE if CO_FREE else 0.80) - cao))   # dưới mặt; chừa ~20% đáy cho khung ứng dụng (tên trang, nút)
    lop = Image.new("RGBA", (W, H)); bong = Image.new("RGBA", (W, H)); d, db = ImageDraw.Draw(lop), ImageDraw.Draw(bong)
    mask = Image.new("L", (W, H)); dm = ImageDraw.Draw(mask)
    for i, x in enumerate(dong):
        xx, yy = (W - f.getlength(x)) / 2, y + i * int(c * 1.12)
        db.text((xx + 6, yy + 8), x, font=f, fill=(0, 0, 0, 200)); dm.text((xx, yy), x, font=f, fill=255)
        d.text((xx, yy), x, font=f, fill=(0, 0, 0, 0), stroke_width=7, stroke_fill=(40, 20, 0, 255))
    vang = Image.new("RGBA", (1, H)); vang.putdata([(255, 236 - int(60 * max(0, min(1, (r - y) / max(1, cao)))), 150 - int(110 * max(0, min(1, (r - y) / max(1, cao)))), 255) for r in range(H)])
    lop.paste(vang.resize((W, H)), (0, 0), mask)
    lop = Image.alpha_composite(bong.filter(ImageFilter.GaussianBlur(8)), lop)
    if CO_FREE: lop_free(lop, k.get("lang", "en"), y + cao); k["free"] = True
    lop.save(os.path.join(tm, f"chu-{ban}.png"))
    return nen, os.path.join(tm, f"chu-{ban}.png")

# (27/11/2026 anh đổi: mặc định = thuong, ky_di không ưu tiên — GIONG_SAU ở trên; đoạn dưới là lý do cũ 18/11)
# GIỌNG MẶC ĐỊNH = GIỌNG TỐT NHẤT ĐÃ ĐO (anh 18/11/2026, sổ luật chung giong_at — thay luật xoay 5 giọng 05/11/2026): Brian / ky_di ROI −24% tốt nhất cả trước lẫn sau 12/11,
# George / thuong −39% tệ nhất. Mọi bản AT (kể cả bản 2, 3… của một phim) đọc giọng này; --giong <kiểu> ép kiểu khác, --giong xoay = cách xoay cũ (đo lại khi cần).
GIONG_MAC_DINH = json.load(open(os.path.join(D, "..", "..", "..", "web", "src", "lib", "etp-bang-luat.json")))["giong_at"]["mac_dinh"]
assert GIONG_MAC_DINH not in GIONG_SAU, f"sổ luật giong_at.mac_dinh '{GIONG_MAC_DINH}' là giọng không ưu tiên (anh 27/11/2026: mặc định giọng thường)"
assert not GIONG_SAU & set(THE_LOAI_GIONG.values()), "THE_LOAI_GIONG trỏ vào giọng không ưu tiên"
assert GIONG_MAC_DINH in KIEU_GIONG, f"sổ luật giong_at.mac_dinh '{GIONG_MAC_DINH}' không có trong KIEU_GIONG"
def kieu_ban(kieu, b, xoay):
    """kiểu giọng của bản thứ b (0 = bản đầu): xoay → lần lượt các kiểu kế (luật 08/11/2026), không xoay → mọi bản cùng một kiểu"""
    ks = KIEU_CHON; return ks[(ks.index(kieu) + b) % len(ks)] if xoay else kieu
assert kieu_ban("gao", 2, False) == "gao" and kieu_ban("gao", 1, True) == "cam_xuc" and kieu_ban("ky_di", 0, False) == "ky_di" and KIEU_CHON[-1] in GIONG_SAU
XOAY = False   # --giong xoay (main đặt lại)

def xoay_giong(ds, yeu_cau):
    """kiểu giọng cho từng phim → {content_id: kiểu}. MẶC ĐỊNH (anh 18/11/2026) = GIONG_MAC_DINH cho mọi phim. --giong <kiểu> ép một kiểu,
    --giong theo-phim chọn theo thể loại (THE_LOAI_GIONG), --giong xoay = cách 05/11/2026: kiểu ít creative ảnh tĩnh nhất (đếm trong sổ điểm chạm) lên trước,
    không lặp kiểu phim đó đã có."""
    if yeu_cau == "theo-phim": return {int(p["content_id"]): THE_LOAI_GIONG.get(p.get("the_loai") or "", "thuong") for p in ds}
    if yeu_cau != "xoay": return {int(p["content_id"]): (yeu_cau or GIONG_MAC_DINH) for p in ds}
    # đếm trong CHÍNH sổ điểm chạm (hook.dang + noi_dung.content_id do len-creative ghi) — etp.creative chỉ có creative mới sau lượt đồng bộ 10 phút
    da = json.loads(sql(f"select coalesce(json_agg(x), '[]') from (select (cham->'noi_dung'->>'content_id')::int content_id, cham->'voice'->>'giong' giong from etp.diem_cham "
                        f"where cham->'hook'->>'dang' = '{DANG}' and cham->'voice'->>'giong' is not null) x") or "[]")
    dem = {k: sum(1 for x in da if x["giong"] == k) for k in KIEU_CHON}; ra = {}
    for p in ds:
        cid = int(p["content_id"]); co = {x["giong"] for x in da if x["content_id"] == cid}
        k = min(KIEU_CHON, key=lambda k: (k in co, dem[k], KIEU_CHON.index(k))); ra[cid] = k; dem[k] += 1
    return ra

def giong_phim(p, ai=None, ghim=None):
    """KIỂU GIỌNG CỦA MỘT PHIM (anh 25/11/2026 "giọng cần phiên bản theo film và theme film") — thứ tự: anh ghim (ô Giọng) → AI chọn theo chủ đề câu chuyện
    (xep_ai chon_giong) → thể loại trong sổ (THE_LOAI_GIONG) → giọng mặc định sổ luật. → (kiểu, nguồn)"""
    if ghim in KIEU_GIONG: return ghim, "anh ghim"
    if ai in KIEU_CHON: return ai, "AI theo chủ đề phim"
    tl = THE_LOAI_GIONG.get(p.get("the_loai") or "")
    return (tl, f"thể loại {p.get('the_loai')}") if tl else (GIONG_MAC_DINH, "mặc định sổ luật")
assert giong_phim({}, "ky_di")[0] == "ky_di" and giong_phim({}, None, "ky_di")[0] == "ky_di" and giong_phim({"the_loai": "fantasy"})[0] == "thuong" and giong_phim({})[0] not in GIONG_SAU, "ky_di phải dùng được khi chọn rõ, nhưng không là mặc định (anh 27/11/2026 không ưu tiên, không cấm)"
assert giong_phim({"the_loai": "mafia"}) == ("gao", "thể loại mafia") and giong_phim({}, "tinh_nghich")[0] == "tinh_nghich" and giong_phim({}, "x", "cam_xuc")[0] == "cam_xuc" and giong_phim({})[0] == GIONG_MAC_DINH

def giong_ban(kg, ng, thu=0):
    """GIỌNG của MỘT khung hình — đúng MỘT giọng (anh 25/11/2026 "Creatives mà chỉ đổi giọng mà ko đổi hình thì ko đc coi là khác nhau"):
    hai giọng (mặc định sổ luật + theo chủ đề phim, anh 25/11 "có 2 phiên bản") giờ XOAY theo thứ tự bản → mỗi giọng nằm trên một hình khác;
    anh ghim giọng thì đúng giọng đó. thu = số khung đã dựng của (mẫu, phim) + bản đang dựng. → [(kiểu, nguồn)] một phần tử"""
    if ng == "anh ghim" or kg == GIONG_MAC_DINH: return [(kg, ng)]
    return [[(GIONG_MAC_DINH, "mặc định sổ luật"), (kg, ng)][thu % 2]]
assert all(len(giong_ban(k, "AI theo chủ đề phim", t)) == 1 for k in ("hao_hung", "gao", GIONG_MAC_DINH) for t in range(4)), "một khung chỉ MỘT giọng"
assert GIONG_MAC_DINH == "hao_hung" or [giong_ban("hao_hung", "AI", t)[0][0] for t in range(2)] == [GIONG_MAC_DINH, "hao_hung"], "hai giọng xoay qua hai bản (hai hình)"
assert giong_ban("gao", "anh ghim", 1) == [("gao", "anh ghim")]

def cau_doc(lang, so_mau, kieu, ten, hook=None):
    """câu đọc của một mẫu — MỘT chỗ cho giọng đọc lẫn dấu sổ. Gộp mạo từ lặp khi tên phim đã mở bằng nó ("Watch the The Great…" — Genie 21/11/2026).
    hook = CÂU HOOK CỐT TRUYỆN (anh 27/11/2026 "Nội dung câu đọc phải là hook giữ chân"; hook_phim): đọc ĐẦU TIÊN, rồi mới tới mời xem —
    "<hook> Watch X for Free Now. Watch More Now!" (anh 27/11/2026 "cái nào cũng Watch now ngay từ đầu": 3 giây đầu là câu chuyện, không phải lời mời;
    luật 21/11 chỉ cấm mở bằng Free/gratis — hook không bao giờ chứa Free, hook_dat chặn)."""
    a_, b_, c_ = CAU[lang][so_mau]
    ten = re.sub(r"^[¡¿\s]+|[!?¡¿.\s]+$", "", ten or "")   # tên phim nằm GIỮA câu: bỏ ¡…! / ¿…? của chính tên ("¡Mira ¡Lárgate de mi Bugatti! gratis" — anh 27/11/2026)
    h = (hook or "").strip()
    if h and not re.search(r"[.!?…]$", h): h += "."
    cau = KIEU_GIONG[kieu][1].format(a=(h + " " if h else "") + a_.format(t=ten), b=b_.format(t=ten), c=c_.format(t=ten))
    return re.sub(r"\b(the|el|la)\s+(?=\1\b)", "", cau, flags=re.I)
assert all("¡Mira ¡" not in cau_doc("es", i, "thuong", "¡Lárgate de mi Bugatti!") and "!!" not in cau_doc("es", i, "thuong", "¡Lárgate de mi Bugatti!") for i in range(len(CAU["es"]))), "cau_doc để lọt dấu ¡…! của tên phim"
assert all("the The" not in cau_doc("en", i, "thuong", "The X") for i in range(len(CAU["en"]))), "cau_doc không gộp được mạo từ lặp"

assert all(cau_doc("en", i, k, "X", "They mocked him. He owns it all.").split("]")[-1 if k == "thuong" else 1].strip().startswith("They mocked him") for i in range(len(CAU["en"])) for k in KIEU_GIONG), "hook phải mở câu đọc, không phải Watch"
assert "They mocked him. He owns it all." in cau_doc("en", 0, "thuong", "X", "They mocked him. He owns it all.") and cau_doc("en", 0, "thuong", "X", "") == cau_doc("en", 0, "thuong", "X"), "cau_doc không chèn / bỏ hook đúng"

# HOOK GIỮ CHÂN CỦA CÂU ĐỌC (anh 27/11/2026 "Nội dung câu đọc phải là hook giữ chân"): câu đọc chỉ có mời xem ("Watch X for free now. Watch more now.") không giữ ai;
# creative đội lãi đọc thêm MỘT câu cốt truyện ("They mocked this old man… Big mistake. Their son owns the airline."). Luật hook 31/10/2026: chữ từ nguồn THẬT, AI không tự nghĩ:
#   NỘI DUNG = chữ thật của CHÍNH phim: QC spy của phim (qc-spy-phim.sql) + tóm tắt app (tai-tap.mo_ta) — hook giữ ≥ HOOK_GIU chữ của nguồn này.
#   NHỊP = câu mở QC phim ngắn chạy lâu nhất cùng tiếng (qc-spy-hook.sql) — chỉ làm khuôn, KHÔNG lấy truyện: đó là tóm tắt phim khác
#   (thử 27/11/2026: lấy truyện từ kho này thì AI chép nguyên tóm tắt phim khác vào phim Bugatti — sai truyện).
# Kết quả ghi sổ etp.cau_hinh 'hook_phim' {cid: {lang: {cau, nguon, mau}}} — mọi bản dựng sau của phim dùng lại, không gọi AI lần hai. Hỏng → không có hook, KÊU TO.
HOOK_GIU, HOOK_CHU = 0.5, 30
HOOK_CTA = re.compile(r"(?i)\b(watch|click|free|download|episode|mira|gratis|descarga|haz clic|ver m[aá]s|serie completa)\b")
def _chu(t): return [w for w in re.findall(r"[^\W\d_]{3,}", (t or "").lower())]
def hook_dat(cau, goc, ten, mau=()):
    """→ lỗi (chuỗi) hoặc None: hook ngắn, không mời xem, không nhắc tên phim, giữ đủ chữ của nguồn thật CỦA PHIM (goc), không chép nguyên câu khuôn của phim khác"""
    if not cau or len(cau.split()) > HOOK_CHU: return f"dài {len((cau or '').split())} chữ > {HOOK_CHU}"
    if HOOK_CTA.search(cau): return "có chữ mời xem / free"
    t = re.sub(r"[^\w\s]", "", (ten or "").lower()).strip()
    if t and t in re.sub(r"[^\w\s]", "", cau.lower()): return "nhắc tên phim"
    c, g = _chu(cau), set(_chu(goc))
    giu = sum(1 for w in c if w in g) / max(1, len(c))
    if giu < HOOK_GIU: return f"chỉ {giu:.0%} chữ có trong tóm tắt / QC thật của phim < {HOOK_GIU:.0%} — chữ tự nghĩ"
    for m in mau:
        mm = set(_chu(m))
        if mm and sum(1 for w in c if w in mm and w not in g) / max(1, len(c)) > 0.25: return "chép chữ truyện của phim khác (câu khuôn)"
    return None
assert hook_dat("They mocked Leo on the plane. Big mistake. His son owns the airline.", "Leo, an old man mocked on the plane; his son owns the airline.", "Sky") is None
assert hook_dat("A brand new story nobody wrote before about dragons.", "Leo, an old man mocked on the plane.", "Sky") and hook_dat("Watch it free now.", "Watch it free now.", "Sky")
assert hook_dat("Leo hid that he was the Sinclair heiress magnate.", "Leo hid his past.", "Sky", ["She hid that she was the Sinclair heiress and made him a magnate."])

def hook_khac(cau, da):
    """→ lỗi hoặc None: hook mới na ná hook đã dùng của cùng phim (≥ 60% chữ trùng) — các bản cùng phim chạy cùng lúc phải nghe khác nhau"""
    c = set(_chu(cau))
    for h in da:
        d = set(_chu(h))
        if c and d and len(c & d) / min(len(c), len(d)) >= 0.6: return f"na ná hook đã dùng của phim: {h[:60]!r}"
    return None
assert hook_khac("They mocked Leo on the plane. His son owns the airline.", ["They mocked Leo on the plane. Big mistake, his son owns the airline."]) and hook_khac("Evelyn collapsed while Jack destroyed her heart medicine.", ["They mocked Leo on the plane."]) is None

def _spy(tep, **v):
    """chạy một tệp .sql trên DB spy (box3) → các dòng TSV"""
    vs = " ".join(f"-v {k}={str(x)}" for k, x in v.items())
    r = subprocess.run(["ssh", B, f". /root/.secrets/spy.env; psql \"$DATABASE_URL\" {vs} -tA -F'\t' -f -"], input=open(os.path.join(D, tep)).read(), capture_output=True, text=True, timeout=180)
    if r.returncode != 0: raise RuntimeError(f"{tep}: {r.stderr[-200:]}")
    return [l.split("\t") for l in r.stdout.splitlines() if l.strip()]

def _cong_ai(de, viec, model="haiku", toi=160):
    """cổng AI chung (spy.on.tc/api/ai — donk → ckey → fal, tự lùi) → (chữ, ₫)"""
    import urllib.request
    k = dict(l.strip().split("=", 1) for l in open(os.path.expanduser("~/.secrets/cong-ai.env")) if "=" in l)["CONG_AI_KEY"].strip().strip('"')
    r = urllib.request.urlopen(urllib.request.Request("https://spy.on.tc/api/ai", method="POST", headers={"authorization": f"Bearer {k}", "content-type": "application/json", "user-agent": "Mozilla/5.0 anh-tinh"},
        data=json.dumps({"viec": viec, "model": model, "max_tokens": toi, "noi_dung": de, "bo_chinh_hang": True}).encode()), timeout=120)
    j = json.loads(r.read()); return str(j.get("kq") or ""), round((j.get("chi_usd") or 0) * 26000)

def _ds_hook(so, cid, lang):
    """sổ hook_phim[cid][lang]: bản cũ một dict → danh sách"""
    x = (so.get(str(cid)) or {}).get(lang)
    return [x] if isinstance(x, dict) else [h for h in (x or []) if isinstance(h, dict) and h.get("cau")]
assert _ds_hook({"1": {"en": {"cau": "a"}}}, 1, "en") == [{"cau": "a"}] and _ds_hook({"1": {"en": [{"cau": "a"}, {"cau": "b"}]}}, 1, "en")[1]["cau"] == "b" and _ds_hook({}, 1, "en") == []

def hook_phim(cid, lang, ten, ghi=True, thu=0):
    """→ ({cau, nguon, mau} | None, ₫). Sổ trước; chữ từ QC spy của phim + tóm tắt app; nhịp từ câu mở QC phim ngắn chạy lâu nhất.
    thu = SỐ THỨ TỰ BẢN của phim (anh 27/11/2026 "Ko cho chạy đồng thời như vậy" — 3 creative cùng phim đọc y một câu): mỗi phim một DANH SÁCH hook,
    bản thứ N lấy hook thứ N; sổ chưa đủ thì AI viết thêm hook mới phải khác góc / xung đột các hook đã có (hook_khac chặn câu na ná)."""
    cid, lang, thu = int(cid), (lang or "en")[:2].lower(), max(0, int(thu or 0))
    try: so = json.loads(sql("select gia_tri::text from etp.cau_hinh where khoa = 'hook_phim'") or "{}")
    except Exception as e: print(f"⚠ không đọc được sổ hook_phim: {str(e)[:120]}", file=sys.stderr); so = {}
    da = _ds_hook(so, cid, lang)
    if thu < len(da): return da[thu], 0
    url = sql(f"select coalesce((select url from etp.phim where content_id = {cid}), (select url from etp.thu_vien_phim where content_id = {cid}), '')")
    mo = _mo_ta(url) if url else ""
    rieng = []
    try:   # QC spy của chính phim — câu mở
        for r in _spy("qc-spy-phim.sql", ids=cid):
            c = re.match(r"^(.{30,220}?[.!?])(\s|$)", r[6] if len(r) > 6 else "")
            if c and not HOOK_CTA.search(c.group(1)): rieng.append((c.group(1), r[1]))
    except Exception as e: print(f"⚠ QC spy của phim {cid}: {e}", file=sys.stderr)
    goc = " ".join([mo] + [c for c, _ in rieng]).strip()
    if len(goc) < 40: print(f"✗ HOOK phim {cid}: không có tóm tắt / QC thật của phim (url {url or 'trống'}) — câu đọc KHÔNG có hook", file=sys.stderr); return None, 0
    try: mau = [{"cau": r[3], "id": r[0], "so_ngay": int(r[2] or 0)} for r in _spy("qc-spy-hook.sql", lang=lang) if len(r) > 3][:20]
    except Exception as e: print(f"⚠ kho câu khuôn spy: {e}", file=sys.stderr); mau = []
    chi, loi = 0, ""
    de = (f"Short drama: {ten}\nREAL synopsis of THIS drama (from the app):\n{mo[:1200]}\n"
          + ("REAL ads of THIS drama (opening lines):\n" + "\n".join(f"- {c}" for c, _ in rieng[:6]) + "\n" if rieng else "")
          + ("\nOpening lines of long-running ads for OTHER dramas — use ONLY as rhythm / hook style examples, NEVER copy their story, names or facts:\n"
             + "\n".join(f"{i + 1}. {m['cau']}" for i, m in enumerate(mau)) + "\n" if mau else "")
          + f"\nWrite ONE spoken hook line for a video ad of THIS drama: the most gripping conflict / twist from its synopsis, built mostly from the synopsis' own words "
          f"(names, roles, facts exactly as in the synopsis), at most {HOOK_CHU - 4} words, present the setup and the stakes, no spoiler of the ending, no title, "
          f"no 'watch' / 'free' / call to action, in {'Spanish (Latin America)' if lang == 'es' else 'English'}.\n"
          + ("\nHooks ALREADY used for this drama — yours must show a DIFFERENT moment / conflict / character angle, sharing no phrase with them:\n"
             + "\n".join(f"- {h['cau']}" for h in da) + "\n" if da else "")
          +
          "Answer EXACTLY two lines:\nSTYLE: <number of the example whose rhythm you followed, or 0>\nHOOK: <line>")
    for lan in range(2):
        try:
            t, v = _cong_ai(de + (f"\n\nYour previous answer was rejected: {loi}. Use the synopsis' own words." if loi else ""), "etp-hook-cau-doc"); chi += v
            p = re.search(r"STYLE:\s*(\d+)", t); h = re.search(r"HOOK:\s*(.+)", t)
            if not h: loi = f"không đúng khuôn: {t[:100]!r}"; continue
            cau = h.group(1).strip().strip('"“”')
            loi = hook_dat(cau, goc, ten, [m["cau"] for m in mau]) or hook_khac(cau, [h["cau"] for h in da]) or ""
            if loi: print(f"✗ hook phim {cid} lần {lan + 1}: {loi} — {cau!r}", file=sys.stderr, flush=True); continue
            k = int(p.group(1)) if p else 0; m = mau[k - 1] if 1 <= k <= len(mau) else None
            ra = {"cau": cau, "nguon": "tóm tắt app" + (" + QC spy phim " + ",".join(i for _, i in rieng[:3]) if rieng else ""),
                  **({"mau": {"cau": m["cau"], "spy": m["id"], "so_ngay": m["so_ngay"]}} if m else {})}
            if ghi:
                so = json.loads(sql("select gia_tri::text from etp.cau_hinh where khoa = 'hook_phim'") or "{}"); ds = _ds_hook(so, cid, lang)
                if thu < len(ds): return ds[thu], chi   # phiên khác vừa ghi đúng ô này
                so.setdefault(str(cid), {})[lang] = ds + [ra]; ra = (ds + [ra])[min(thu, len(ds))]
                sql(f"insert into etp.cau_hinh (khoa, gia_tri) values ('hook_phim', $J${json.dumps(so, ensure_ascii=False).replace('$J$', '')}$J$::jsonb) on conflict (khoa) do update set gia_tri = excluded.gia_tri")
            return ra, chi
        except Exception as e: loi = str(e)[:120]; print(f"✗ hook phim {cid} lần {lan + 1} lỗi: {loi}", file=sys.stderr, flush=True)
    print(f"✗ HOOK phim {cid}: AI hai lần không ra hook đạt ({loi}) — câu đọc KHÔNG có hook", file=sys.stderr); return None, chi

def danh_dau(tv, kieu, lang, ten, so_mau=0, them=None, hook=None):
    """DẤU KIỂU GIỌNG vào sổ điểm chạm của creative (etp.diem_cham.cham) để đo kiểu nào tốt / xấu — anh 05/11/2026. len-creative ghi khuôn
    cảnh cắt (thoại gốc, nút CTA mẫu Kiên); ảnh tĩnh không có những thứ đó → ghi đúng cái creative này có."""
    v, mau = KIEU_GIONG[kieu]
    j = json.dumps({"voice": {"thoai": "khong", "giong": kieu, "nguoi_doc": v, "mau": so_mau, "cau": cau_doc(lang, so_mau, kieu, ten, (hook or {}).get("cau")), **({"hook": hook} if hook else {})},
                    "chu_video": {"bo_cuc": "anh_tinh_ten_phim", "phu_de": "xoa", **({"ten": "poster" if them.get("ten_poster") else "chu_vang"} if them else {})},
                    "cta": {"mau": "watch_for_free" if (them or {}).get("free") else "khong_nut"}, **({"anh_tinh": {"ban": them.get("ban"), "khung": f"{them.get('tap')}#{them.get('khung_so')}", "chon": "ai" if MOI else "may", "hd": MOI}} if them else {})}, ensure_ascii=False).replace("$J$", "")
    return sql(f"update etp.diem_cham d set cham = d.cham || $J${j}$J$::jsonb, luc = now() from etp.thu_vien v where v.id = {int(tv)} and d.creative_id = v.creative_id returning d.creative_id")

# GIỌNG = CỔNG GIỌNG CHUNG scripts/lich-su/giong-ckey.mjs trên box3 (anh 08/11/2026 "chuyển vào cơ chế chung. Mọi AI API đều phải qua fallback"):
# ckey ElevenLabs v3 theo MÃ giọng (156₫ / câu) → fal eleven-v3 khi ckey hỏng. Không gọi API giọng riêng ở đây.
def doc_giong(cid, lang, v, cau, tm):
    """một câu → mp3 trong tm (dùng lại khi cùng giọng + câu) → (tệp, ₫ thật theo dòng cuối của cổng)"""
    h = hashlib.sha1(f"{v}|{cau}".encode()).hexdigest()[:10]; f = os.path.join(tm, f"giong-{h}.mp3")
    if os.path.exists(f) and os.path.getsize(f) > 3000: return f, 0
    xa = f"/var/tmp/anh-tinh/{cid}"; job = os.path.join(tm, "giong.json")
    json.dump({"giong": v, "engine": "v3", "language": lang, "cau": [{"khoa": h, "chu": cau}]}, open(job, "w"), ensure_ascii=False)
    sh("ssh", B, f"mkdir -p {xa}"); sh("scp", "-q", job, f"{B}:{xa}/giong.json")
    r = sh("ssh", B, f"{ENV}; node apps/xuong-video/scripts/lich-su/giong-ckey.mjs {xa}/giong.json {xa}", han=600)
    if r.returncode != 0: raise RuntimeError(f"giọng: {(r.stderr or r.stdout)[-200:]}")
    if r.stderr.strip(): print(r.stderr.strip()[-200:], file=sys.stderr)   # câu xuống tuyến fal — kêu ra
    sh("scp", "-q", f"{B}:{xa}/{h}.mp3", f)
    m = re.search(r"tiền (\d+)₫", r.stdout); return f, int(m.group(1)) if m else 156

def giong(cid, lang, ten, kieu, tm, so_mau=0, hook=None):
    """giọng đọc mẫu câu CAU theo kiểu (+ hook cốt truyện của hook_phim) → (giong.mp3, ₫ đã chi, kiểu). Bên gọi không đưa hook → tự lấy hook của phim
    (dung-mau / dung-lai-logo / tinh-ba-kieu từng gọi không hook → câu chỉ còn "Watch… Watch more", anh 27/11/2026). hook=False = cố ý không hook."""
    v0 = 0
    if hook is None: hook, v0 = hook_phim(cid, lang, ten, thu=so_mau)   # bản khác (mẫu câu khác) → hook khác, không đọc trùng câu (anh 27/11/2026)
    hook = hook or None
    f, vnd = doc_giong(cid, lang, KIEU_GIONG[kieu][0], cau_doc(lang, so_mau, kieu, ten, (hook or {}).get("cau")), tm)
    return f, vnd + v0, kieu

def dung(nen, chu, mp3, ra):
    L = max(GIAY_MIN, float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3).stdout) + 1.4); n = int(L * 30)
    r = sh("ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", nen, "-loop", "1", "-i", chu, "-i", mp3, "-filter_complex",
           f"[0:v]scale={W * 2}:{H * 2}:flags=lanczos,zoompan=z='1+0.05*on/{n}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={W}x{H}:fps=30,setsar=1[n];"
           f"[1:v]format=rgba,fade=in:st=0.2:d=0.4:alpha=1[c];[n][c]overlay=0:0:shortest=1[v];[2:a]adelay=400|400,apad[a]",
           "-map", "[v]", "-map", "[a]", "-t", f"{L:.2f}", *MA_HOA, ra)
    if r.returncode != 0: raise RuntimeError(f"ffmpeg: {r.stderr[-300:]}")
    return round(L, 1)

# BẢN SAU KHÁC BẢN TRƯỚC + CỔNG CHỮ CHE MẶT cho các DÒNG TĨNH THẬT (anh 20/11/2026 "làm nốt các việc còn lại" — rà cách sản xuất: chạy lại cùng phim ra gần y hệt vì
# luôn lấy khung hạng 1; không dòng nào ĐO chữ có che mặt không). Dùng chung cho anh-tinh (AT) và tinh-ba-kieu (ATT / CTS / PO):
#   · sổ khung đã dùng theo từng dạng: <thư mục phim>/khung-da-dung.json — khung chưa dùng đứng trước (giữ thứ tự AI xếp), hết khung mới thì quay vòng
#   · lớp chữ phủ quá CHE_MAT_TOI_DA hộp mặt → đổi khung kế (tối đa 3 khung / bản), vẫn che thì bản đó dừng kêu rõ — cùng ngưỡng máy dựng theo mẫu (dung-mau.CHE_MAT_TOI_DA)
CHE_MAT_TOI_DA = 0.04
_ma_khung = lambda k: f"{k['tap']}#{k['so']}"
def _so_khung(tm):
    try: return json.load(open(os.path.join(tm, "khung-da-dung.json")))
    except Exception: return {}
def xoay_khung(tm, dang, uv):
    da = set(_so_khung(tm).get(dang) or []); return [k for k in uv if _ma_khung(k) not in da] + [k for k in uv if _ma_khung(k) in da]
def ghi_khung(tm, dang, k):
    so = _so_khung(tm); so[dang] = [*[x for x in so.get(dang) or [] if x != _ma_khung(k)], _ma_khung(k)]; json.dump(so, open(os.path.join(tm, "khung-da-dung.json"), "w"), ensure_ascii=False)
def che_mat(chu, k):
    """phần hộp mặt (k['mat'] = x, y, rộng, cao theo tỉ lệ khung 9:16) bị lớp chữ phủ — 0 khi khung không có hộp mặt"""
    m = k.get("mat")
    if not m or len(m) < 4: return 0.0
    al = Image.open(chu).convert("RGBA").split()[3]; w_, h_ = al.size
    hop = (int(max(0, m[0] * w_)), int(max(0, m[1] * h_)), int(min(w_, (m[0] + m[2]) * w_)), int(min(h_, (m[1] + m[3]) * h_)))
    if hop[2] <= hop[0] or hop[3] <= hop[1]: return 0.0
    return ImageStat.Stat(al.crop(hop).point(lambda v: 255 if v > 60 else 0)).mean[0] / 255
def khung_sach_mat(con, ve, goc=None, thu=3):
    """khung kế trong hàng `con` mà lớp chữ (ve(k) → (nền, chữ)) không che mặt → (k, nền, chữ); `con` cạn thì nạp lại từ `goc`"""
    te = []
    for _ in range(thu):
        if not con and goc: con.extend(goc)
        if not con: break
        k = con.pop(0); nen, chu = ve(k); c = che_mat(chu, k)
        if c <= CHE_MAT_TOI_DA: return k, nen, chu
        te.append(f"{_ma_khung(k)} chữ phủ {c:.0%} mặt"); print(f"cổng che mặt: khung {te[-1]} — đổi khung", file=sys.stderr, flush=True)
    raise RuntimeError("chữ che mặt ở mọi khung đã thử (" + ", ".join(te) + ")" if te else "hết khung ứng viên")

def mot(p, xem, kieu, ban=1):
    """một phim → `ban` creative (anh 08/11/2026 "3 camp mỗi loại"): mỗi bản một khung khác (AI xếp hạng), mẫu câu giọng xoay vòng → danh sách kq"""
    cid, lang = int(p["content_id"]), "es" if str(p.get("locale")).startswith("es") else "en"; ten = ten_sach(p["ten"])
    tm = os.path.join(C, str(cid)); os.makedirs(tm, exist_ok=True)
    try:
        if KHUNG_CHI: uv, ly_ai, vnd_ai = khung_chi(tm), "khung chỉ định (--anh)", 0
        else: uv = khung(cid, p["url"], tm); uv, ly_ai, vnd_ai = xep_ai(ten, uv, _mo_ta(p["url"])) if MOI and len(uv) > 1 else (uv, "", 0)   # + tóm tắt phim: khung đúng móc câu chuyện (20/11/2026)
    except Exception as e:
        return [{"content_id": cid, "ten": ten, "loi": str(e)[-300:]}]
    mau0 = random.randrange(len(CAU[lang])); ra = []
    vnd_hook = 0   # hook giữ chân của câu đọc — MỖI BẢN MỘT HOOK (anh 27/11/2026 "Ko cho chạy đồng thời như vậy"), lấy trong vòng bản
    uv = xoay_khung(tm, DANG, uv); con = list(uv)
    for b in range(min(ban, len(uv))):
        try:
            so_mau = (mau0 + b) % len(CAU[lang])   # bốc ngẫu nhiên mẫu đầu, các bản sau xoay vòng (anh 06/11/2026)
            # MỖI BẢN MỘT KIỂU GIỌNG chỉ khi --giong xoay (anh 08/11/2026 đo kiểu voice; 18/11/2026 đã có số → mặc định mọi bản cùng giọng tốt nhất)
            kieu_b = kieu_ban(kieu, b, XOAY); hook, vh = hook_phim(cid, lang, ten, thu=b); vnd_ai += vh
            k, nen, chu = khung_sach_mat(con, lambda k_: (k_.__setitem__("lang", lang), anh(cid, ten, k_, tm, b))[1], uv); mp3, vnd, kieu_ = giong(cid, lang, ten, kieu_b, tm, so_mau, hook)
            out = os.path.join(tm, f"anh-tinh-{cid}-{b + 1}.mp4"); giay = dung(nen, chu, mp3, out)
            r = sh("python3", os.path.join(D, "kiem-thoai.py"), out, "0", str(giay)) if not k.get("free") else sh("python3", os.path.join(D, "kiem-thoai.py"), out, "0", str(giay), "--free")   # cổng chữ trên video (tên phim) — cùng cổng mọi creative; --free: gỡ đúng câu lớp Free nhà vẽ
            if r.returncode != 0: raise RuntimeError(r.stdout.strip()[-200:])
            kq = {"content_id": cid, "ten": ten, "lang": lang, "file": out, "ban": b + 1, "giay": giay, "vnd": vnd + (vnd_ai if b == 0 else 0), "giong": kieu_, "mau": so_mau, **({"hook": hook} if hook else {}),
                  "ten_poster": bool(k.get("ten_poster")), "free": bool(k.get("free")), **({"free_mau": free_mau(b)} if k.get("free") else {}), "ai": ly_ai[:200] if b == 0 else "", **{x: k[x] for x in ("tap", "diem", "dat", "so_khung", "nho")}, "xoa": len(k["xoa"]), "khung_so": k["so"]}
            if not xem:
                xa = f"/var/tmp/anh-tinh/{cid}"; sh("ssh", B, f"mkdir -p {xa}"); sh("rsync", "-a", out, f"{B}:{xa}/", han=900)
                ghi = (f"ảnh tĩnh bản {b + 1}/{ban} · giọng {kieu_} · mẫu câu {so_mau + 1} ({p.get('the_loai') or '?'}): {k['tap']} khung #{k['so']} (mỗi 1,5 giây từ giây 3) · "
                       f"điểm mặt {k['diem']} ({k['dat']}/{k['so_khung']} khung đạt) · AI xếp hạng {b + 1} · tên {'từ poster' if k.get('ten_poster') else 'chữ vàng'}" + (f" · lớp Free kiểu {free_mau(b)} (nhãn All Episodes Released + nút Watch For Free)" if k.get("free") else ""))
                r = sh("ssh", B, f"{XV} scripts/ethopex/thu-vien-them.mts 0 {xa}/{os.path.basename(out)} --content={cid} --dang='{DANG}' --nguon={NGUON} --lang={lang} --chi-vnd={kq['vnd']} --ghi='{ghi}' --them{' --lop-free' if k.get('free') else ''}", han=600)   # --them: mỗi bản một dòng thư viện
                if r.returncode != 0: raise RuntimeError(f"thư viện: {(r.stderr or r.stdout)[-200:]}")
                kq["tv"] = int(sql(f"select id from etp.thu_vien where content_id = {cid} and dang = '{DANG}' and nguon = '{NGUON}' and creative_id is null order by id desc limit 1") or 0)
                # MỌI bản ảnh tĩnh chờ anh duyệt trên etp2 › Camp (0460) — anh 22/11/2026 cho khung chỉ định --anh; 26/11/2026 "SX Creative nào cần để tao duyệt" → mọi bản
                if kq["tv"]: sql(f"insert into etp.cho_anh_duyet (tv_id, ghi) values ({kq['tv']}, '{'khung chỉ định --anh' if KHUNG_CHI else 'ảnh tĩnh máy dựng'}') on conflict do nothing")
                ghi_khung(tm, DANG, k)
            ra.append(kq)
        except Exception as e:
            ra.append({"content_id": cid, "ten": ten, "ban": b + 1, "loi": str(e)[-300:]})
    return ra

def to_khung(kq, ra):
    """tờ khung: mỗi phim một ô (khung đã chọn + tên) để người xem soát trước"""
    ok = [x for x in kq if not x.get("loi")]
    if not ok: return None
    o = 270; to = Image.new("RGB", (o * min(5, len(ok)), int(o * 16 / 9) * ((len(ok) + 4) // 5)), "black")
    for i, x in enumerate(ok):
        f = os.path.join(C, str(x["content_id"]), f"xem-{x.get('ban', 1)}.jpg"); sh("ffmpeg", "-v", "error", "-y", "-ss", "3", "-i", x["file"], "-frames:v", "1", "-vf", f"scale={o}:-2", f)
        to.paste(Image.open(f), ((i % 5) * o, (i // 5) * int(o * 16 / 9)))
    to.save(ra, quality=88); return ra

if __name__ == "__main__":
    a = sys.argv[1:]; xem = "--xem" in a
    so = int(a[a.index("--so") + 1]) if "--so" in a else 10
    yc = a[a.index("--giong") + 1] if "--giong" in a else None
    if yc and yc not in ("theo-phim", "xoay") and yc not in KIEU_GIONG: sys.exit(f"--giong phải là một trong: {', '.join(KIEU_GIONG)} · theo-phim · xoay")
    XOAY = yc == "xoay"
    KHUNG_CHI[:] = [a[i + 1] for i, x in enumerate(a) if x == "--anh" and i + 1 < len(a)]
    ids = [int(x) for i, x in enumerate(a) if x.isdigit() and (i == 0 or a[i - 1] not in ("--so", "--ban", "--anh"))]
    ds = phim(ids) if ids else chon(so)
    if not ds: sys.exit("không có phim nào hợp (mới bắt đầu lãi, chưa có ảnh tĩnh)")
    print(f"{len(ds)} phim: " + " · ".join(f"{x['content_id']} {ten_sach(x['ten'])[:30]}" for x in ds), flush=True)
    gk = xoay_giong(ds, yc); print("giọng: " + " · ".join(f"{c} {k}" for c, k in gk.items()), flush=True)
    ban = int(a[a.index("--ban") + 1]) if "--ban" in a else 1
    with ThreadPoolExecutor(3) as ex: kq = [x for r in ex.map(lambda p: mot(p, xem, gk[int(p["content_id"])], ban), ds) for x in r]
    for x in kq: print(json.dumps(x, ensure_ascii=False), flush=True)
    print("tờ khung:", to_khung(kq, os.path.join(C, f"to-{time.strftime('%d%m%H%M')}.jpg")))
    print(f"giọng: {sum(x.get('vnd', 0) for x in kq)}₫")
    tv = [str(x["tv"]) for x in kq if x.get("tv")]
    if tv: subprocess.run(["python3", os.path.join(D, "thu-vien-len.py"), *tv])   # thư viện → creative; chấm Sạch thì nhịp ethopex lên camp theo lịch chung
    for x in kq:
        if x.get("tv"): print(f"dấu giọng tv{x['tv']} {x['giong']} → creative", danh_dau(x["tv"], x["giong"], x["lang"], x["ten"], x.get("mau", 0), x, x.get("hook")) or "(chưa thành creative)")
    subprocess.run(["python3", os.path.join(D, "don-kho.py")])   # dọn tập tải về để chọn khung (anh 15/11/2026: iMac cấm đầy ổ)
