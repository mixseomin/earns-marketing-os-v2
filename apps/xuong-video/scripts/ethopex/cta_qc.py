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
MAU_CTA = re.compile(r"\btap\b|\bclick|\bclic\b|\btoca\b|\btócala|\bpulsa|\bpresiona|\bhaz clic|[▼▲►◄▶◀↓↑→←⬇⬆➡⬅👇👆👉👈⏬🔽]", re.I)

def sai_luat(chu):
    m = MAU_CTA.search(chu or "")
    return m.group(0) if m else None
