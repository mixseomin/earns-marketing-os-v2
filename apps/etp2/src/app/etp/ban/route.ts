// MÃ BẢN DỰNG đang chạy (anh 04/11/2026: tab etp mở từ trước lần deploy cứ chạy giao diện cũ — "nút này đâu ở tab phim"). Trang etp hỏi mỗi phút,
// khác mã lúc nạp trang thì tự tải lại. Đường /etp/ban đi qua vhost etp.on.tc (regex ^/etp/<x>), không lộ gì ngoài mã bản dựng.
import { readFileSync } from 'node:fs';
import path from 'node:path';
export const dynamic = 'force-dynamic';
export function GET() {
  let ma = '';
  try { ma = readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim(); } catch { /* chạy dev */ }
  return new Response(ma, { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}
