import { readFileSync } from 'node:fs';
import path from 'node:path';

// CODE EXTENSION ETHOPEX PHÁT TỪ MOS2 (anh 22/10/2026: "trên macbook làm sao dùng chung extension mà không phải bảo copy sang mỗi khi có update"):
// extension chỉ còn VỎ NẠP (apps/ethopex-ext/nap.js) chèn <script src> trỏ vào đây → mỗi lần mở trang Ethopex chạy bản ly-do.js mới nhất của repo
// (deploy = cập nhật mọi máy, kể cả userscript iPhone). Code không chứa khoá (khoá nằm ở vỏ nạp từng máy) nên phát công khai; không cache.
export async function GET(req: Request) {
  // nhật ký nạp (journalctl -u mos2-web | grep ethopex-nap): máy nào tải mã, lần thứ mấy — để tự soát máy không chạy được mà không phải hỏi anh
  const u = new URL(req.url); console.log(`ethopex-nap lan=${u.searchParams.get('lan') ?? '?'} khoa=${u.searchParams.get('k') ? 'co' : 'khong'} ua=${(req.headers.get('user-agent') ?? '').slice(0, 90)}`);
  const goc = process.env.MOS2_DIR || path.resolve(process.cwd(), '../..');
  let js: string;
  try { js = readFileSync(path.join(goc, 'apps/ethopex-ext/ly-do.js'), 'utf8'); } catch { js = "console.warn('ethopex-ly-do: chưa đọc được mã trên mos2');"; }
  return new Response(js, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': 'https://app.ethopex.dev' } });
}
