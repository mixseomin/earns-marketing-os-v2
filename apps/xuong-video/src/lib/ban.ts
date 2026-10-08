// Mã bản build đang chạy (.next/BUILD_ID). Trang so mã lúc mở với mã máy chủ hiện tại → biết vừa có deploy mà tự tải lại,
// thay vì để tab cũ gọi server action đã không còn (404 "Failed to find Server Action") rồi nút treo (góp ý #1194, 08/10/2026).
import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function maBan(): string {
  try { return readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim(); } catch { return 'dev'; }
}
