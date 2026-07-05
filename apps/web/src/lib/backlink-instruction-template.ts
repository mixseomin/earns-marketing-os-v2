// Canonical shape for a backlink task's `instructions`. Source of truth for BOTH the AI
// normalizer (drawer "✨ Chuẩn hoá" + bulk pass) and any seeding prompt. The Steps renderer
// (backlinks-page.tsx) is built to this shape: numbered steps get a number gutter, emoji-led
// meta lines get an emoji gutter, a short line ending ":" is a sub-heading.
//
// Keep the rules terse — this string is fed to an LLM verbatim.

export const BACKLINK_INSTRUCTION_TEMPLATE = `Khuôn hướng dẫn backlink (BẮT BUỘC theo đúng thứ tự dòng này):

Cách lấy link: <1 câu — được link gì + cơ chế>
🔗 Trang: <URL trang HÀNH ĐỘNG chính xác — submit form / "new post" editor / câu hỏi cụ thể / directory "add a tool". KHÔNG phải homepage>
🔑 Điều kiện: <free / cần account / gate cụ thể> · Công sức: low|med|high
Các bước:
1. <bước cụ thể, quét-là-làm-được, có giá trị thật: Name=…, category=…, anchor=…>
2. …
📍 Link đặt ở: <vị trí đặt link + anchor> · <dofollow|nofollow — GHI ĐÚNG THẬT> · <live ngay | chờ duyệt ~N ngày>
✅ Link nhận được (dán vào ô "Live URL"): <mẫu URL kết quả>   ← CHỈ thêm dòng này khi URL kết quả KHÔNG hiển nhiên (Wikidata Qxxx, KG node, redirect, item page). Nguồn post/profile/comment mà URL kết quả là chính bài/profile thì BỎ dòng này.

QUY TẮC:
- Tiếng Việt CÓ DẤU (trừ tên riêng / URL / anchor English giữ nguyên).
- Mỗi bước = 1 dòng, đánh số "1." "2."… (chỉ dùng "Các bước:" khi có ≥2 bước; việc 1 thao tác thì bỏ khối này).
- Dòng meta bắt đầu bằng đúng emoji 🔗 🔑 📍 ✅ như trên.
- nofollow/dofollow ghi THẬT (Quora/Reddit/HN/dev.to/Medium/Crunchbase/PH/Wikidata = nofollow). Không phịa dofollow.
- Giữ nguyên URL + giá trị cụ thể đã có trong bản gốc; chỉ sửa cấu trúc + dịch + bổ sung dòng thiếu. KHÔNG bịa bước/điều kiện không có thật.
- Đặc thù nền tảng: Wikidata backlink = statement official website (P856)=URL + reference (P854 reference URL + P813 retrieved), KHÔNG phải "External links" (đó là Wikipedia). Sitelinks để trống. MediaWiki thật (Bogleheads-wiki, Fandom) mới có External-links thật.`;
