// Thư mục gốc của apps/cty cho mọi module worker. KHÔNG dựa riêng vào import.meta.url: khi Next đóng gói một module worker
// (trang đọc quy trình, số liệu…), import.meta.url bị chốt cứng thành đường dẫn LÚC BUILD trên máy GHA (/home/runner/…), không có
// trên box → ENOENT, cả trang 500 (11/10/2026). Đường dẫn thật thì dùng; không có thì về process.cwd() (systemd chạy ở apps/cty).
import fs from 'node:fs';
import path from 'node:path';
const tuFile = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const GOC = fs.existsSync(path.join(tuFile, 'cong-ty')) ? tuFile : process.cwd();
