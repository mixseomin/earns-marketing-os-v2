// Gốc repo cty trên máy chủ — cty tách khỏi monorepo 18/11/2026 (github.com/mixseomin/cty), chạy ở /opt/cty trên box3.
// Web chỉ chạy trên box3 nên không dò nhiều chỗ; bản đầy đủ (dò cả Mac) cho mã chạy ngoài Next ở apps/xuong-video/src/lib/xuong-video/cty.mjs.
export const CTY_DIR = process.env.CTY_DIR || '/opt/cty';
/** Địa chỉ công khai của cty — /home nhúng mảnh của cty vào ô widget (components/home/manh-cty.tsx) và nhận tin mở ngăn từ đúng gốc này. */
export const CTY_GOC = 'https://cty.on.tc';
