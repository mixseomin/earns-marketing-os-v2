"""CTA CHUẨN CHO MỌI CREATIVE ETHOPEX — một nguồn duy nhất (cat-canh · cat-cuoi-lo · dung-lo-dai · ghep-xem; bản TS: khuon-qc-phim.ts).
Luật (nhóm Support Ads 22/10/2026, anh chuyển + lệnh "thêm rule khi lên creative"): KHÔNG dùng chữ CTA dụ nhấp (Click, Tap, Toca, Pulsa…),
KHÔNG icon / mũi tên / biểu tượng chỉ trỏ — chỉ để thông tin nhẹ nhàng "Watch Free - Learn More". Cổng: kiem-thoai.py (MAU_CTA, đọc chữ trên video
+ chữ QC) và cat-canh.py (từ chối dựng khi chữ nút sai luật)."""
import os, re
A = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "ethopex")
CTA = {
    # giọng v2: EN cắt chữ "Tap" khỏi bản cũ (0đ) · ES đọc lại không có "Toca" (ElevenLabs v3 Aria, ~$0,007)
    "en": {"nut": "WATCH FREE · LEARN MORE", "hoi": "WHAT HAPPENS NEXT?", "giong": os.path.join(A, "cta-en-george-v2.mp3"),
           "loi_giong": "Want to know what happens next? Learn More and watch the full series for free!"},
    "es": {"nut": "MÍRALA GRATIS · MÁS INFORMACIÓN", "hoi": "¿QUÉ PASA DESPUÉS?", "giong": os.path.join(A, "cta-es-aria-v2.mp3"),
           "loi_giong": "¿Quieres saber qué pasa después? Mira la serie completa gratis. Más información."},
}
# chữ dụ nhấp + ký tự mũi tên/chỉ trỏ (dùng chung cho chữ trên video, chữ QC, chữ nút)
# chỉ bắt khi đi cùng ngữ cảnh CTA hoặc viết HOA như chữ nút — thoại phim có "te toca" (tới lượt), OCR nhiễu ra "taP" (22/10/2026 chặn oan Number One 1760s)
MAU_CTA = re.compile(r"\btap (?:to|here|now|below|learn|the (?:link|button)|for more|on (?:the|learn))\b|(?-i:\bTAP\b)|\bclick (?:here|now|below|the|to|on|learn)\b|(?-i:\bCLICK\b)|"
                     r"\btoca (?:m[aá]s|aqu[ií]|el bot[oó]n|para ver)|(?-i:\bTOCA\b)|\bhaz clic|\bpulsa (?:aqu[ií]|el|m[aá]s)|\bpresiona (?:aqu[ií]|el bot)|"
                     r"[▼▲►◄▶◀↓↑→←⬇⬆➡⬅👇👆👉👈⏬🔽]", re.I)

# LỚP PHỦ CTA KÍCH THÍCH của QC app gốc (anh 22/10/2026: "bỏ hết các mũi tên, các CTA kích thích quá mức… traffic về AFS nên phải tuân thủ rule triệt để"):
# đồng hồ đếm ngược, "limited time", nhãn FREE / GRATIS, download / install. Nút chuẩn của mình (CTA[*]["nut"]) được gỡ ra trước khi xét.
MAU_PHU = re.compile(r"limited[- ]time|tiempo limitado|por tiempo limitado|oferta limitada|\bwatch (?:it )?for free\b|\bfree for (?:a )?limited|"
                     r"\bdownload\b|\bdescarga|\binstall\b|\binstala|\bcontinue watching\b|\bsigue viendo\b|"
                     r"(?-i:\bFREE\b)|(?-i:\bGRATIS\b)|^\s*(?:free|gratis)\s*!*\s*$|\b\d{2}:\d{2}\b(?=.{0,40}(?:free|gratis|limit))", re.I)
# nút chuẩn khi OCR đọc lại: dấu "·" ra "•" / "-" / "." / mất — gỡ bằng mẫu nới (22/10/2026 chặn oan cả lô cta3 vì "WATCH FREE • LEARN MORE")
NUT_CHUAN = re.compile(r"WATCH\W{0,4}FREE\W{0,4}LEARN\W{0,4}MORE|M[IÍ]RALA\W{0,4}GRATIS\W{0,4}M[AÁ]S\W{0,4}INFORMACI[OÓ]N|WHAT HAPPENS NEXT\W?|\W?QU[EÉ] PASA DESPU[EÉ]S\W?", re.I)

def _bo_dau(t):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFKD", t) if not unicodedata.combining(c))

def phu_kich_thich(chu):
    t = NUT_CHUAN.sub(" ", _bo_dau(chu or ""))   # OCR đọc nút đang nhún ra "WÂTCH" / "MORÉ" → bỏ dấu trước khi gỡ
    m = MAU_PHU.search(t)
    return m.group(0) if m else None

def sai_luat(chu):
    m = MAU_CTA.search(chu or "")
    return m.group(0) if m else None
