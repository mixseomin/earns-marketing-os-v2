# Cổng API AI cho xưởng video — số đo 15/10/2026 (tiền THẬT, VNĐ)

Quy đổi: 26.000₫ ≈ $1. ShopAIKey bán credit $1 = 3.250₫ (nạp 1₫ = 1 xu) → giá trên site của họ ×3.250₫ mới là tiền thật.

| | Ảnh Nano Banana | Video | Ghi chú |
|---|---|---|---|
| Google trực tiếp | 2.1: $0,034 ≈ 884₫ | Veo 3.1 Lite ≈ 4.160₫/clip ngắn ($0,05/s) | ổn định; hết tín dụng trả trước thì RESOURCE_EXHAUSTED |
| **ShopAIKey** (vault #532) | 2.1: **683₫** (đo thật, ~29s) | Grok Video 3 10s **3.250₫** (94s) · Grok Imagine 1.5 6s **6.500₫** (99s) — ra 2:3, không 9:16 · Veo 3.1 Fast: treo hàng đợi >25 phút | key cần nhóm Veo Normal1/2/HQ cho video; client phải chờ ≥200s (hết giờ vẫn bị trừ) |
| **APIMaster.ai** (vault #533, Google SSO) | gemini-3.1-flash-image $0,067 ≈ 1.830₫ · Seedream 5 Pro $0,045 ≈ 1.230₫ | Seedance 2.0 Mini $0,0756/s · Kling v3 Omni $0,084/s · Seedance 2.0 $0,151/s (×1.05) — có 9:16 | trả USDT/Epay, không công bố pháp nhân; giá: `apimaster-pricing-2026-10-15.json` (GET /api/pricing) |
| **ckey.vn** (vault #534) | nano-banana-pro / nano-banana-2 **110,5₫** · gemini-3.1-flash-image **65₫** (người bán trên chợ, ~96% thành công) | **không có** | hộ kinh doanh CKEY (Lào Cai, MST 010201000561); Cloudflare Turnstile chặn trình duyệt tự động; catalog công khai: `ckey-catalog-2026-10-15.json` |

## Đo thật ckey.vn (15/10/2026, key vault #534, base https://api.xah.io/v1, POST /images/generations)
- `wowztools/nano-banana-pro` (→ gemini-3.0-pro-image) và `wowztools/nano-banana-2` (→ gemini-3.1-flash-image): **6/6 đạt**, 34–44s/ảnh, chạy song song vẫn trả đủ, 768×1376 (9:16), **giữ đúng người từ ảnh tham chiếu** khi gửi `image_urls` + `image`. Ảnh trả ở flow.wowz.cloud/tmp (link tạm → phải chép về R2).
- `dungcsnd113/gemini-3.1-flash-image`: **2/2 lỗi 502** "upstream AI gateway is unavailable".
- Không có endpoint billing (`/dashboard/billing/usage` → not_found) → tiền trừ thật xem ở console ckey.

## Đo thật TokenHot + FlatKey (04/11/2026, anh đưa khoá — vault #686 TokenHot, #687 FlatKey, cả hai đăng nhập Google SSO mikerey887)

**TokenHot** — base `https://tokenhot.ai/v1` (OpenAI + Anthropic `/v1/messages`), 108 mô hình, khoá hạn mức $20.
- Bài đo: 20 tờ khung soát đoạn (soat_doan.HOI, `claude-sonnet-5-5`), 10 tờ máy cũ đã chấm cấm + 10 tờ đã cho qua.
- **Bẫy**: Sonnet 5.5 ở đây bật thinking — `max_tokens: 300` (như soat_doan.py) bị phần suy nghĩ ăn hết, 10/20 lượt không có chữ. `thinking: {type: disabled}` → HTTP 400. Phải để `max_tokens` ≥ 2000.
- Kết quả: tờ đã cấm → 8 cấm · 1 xem · 1 ok (lọt 1); tờ đã qua → 3 ok · 5 xem · 2 cấm — **khắt hơn đường hiện tại** (nhiều "xem" hơn = nhiều đoạn giữ lại cho người).
- Tốc độ TB 10,4 s/lượt. Tiền: 36 lượt (gồm lượt hỏng) $0,097 ≈ 2.500₫ → **~90₫ / lượt soát** (≈ 34% giá Anthropic, khớp niêm yết). Trả `model` + chữ ký thinking giống Anthropic thật.

**FlatKey** — base `https://router.flatkey.ai/v1` (KHÔNG phải api.flatkey.ai — chỗ đó báo INVALID_API_KEY), video `POST /v1/videos` → `GET /v1/videos/{id}` → tải `metadata.url` kèm Bearer.
- `/v1/models` của khoá chỉ liệt kê `seedance-2.0`, nhưng gọi `seedance-2.0-mini` vẫn chạy.
- 3 lượt mini 720p 9:16 5s: 1 hỏng ("Video generation failed. Please retry", **không trừ tiền**), 2 đạt: 720×1280, 5,1s, có tiếng, mặt người giữ ổn, 3,5–4 phút / clip.
- **Giá thật $0,2646 / clip 5s ≈ 6.900₫** (= $0,053/s) — gấp ~3,8 lần giá trang /models ($0,014/s). Rẻ hơn APIMaster Seedance Mini ($0,0756/s) ~30%, không phải 5 lần như ước.
- Khoá đặt "không giới hạn" → API không cho biết số dư tài khoản; Phòng Tài nguyên chỉ báo đã dùng.
