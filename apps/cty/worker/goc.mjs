// Thư mục gốc của apps/cty cho mọi module worker. KHÔNG dựa riêng vào import.meta.url: khi Next đóng gói một module worker
// (trang đọc quy trình, số liệu…), import.meta.url bị chốt cứng thành đường dẫn LÚC BUILD trên máy GHA (/home/runner/…), không có
// trên box → ENOENT, cả trang 500 (11/10/2026). Đường dẫn thật thì dùng; không có thì về process.cwd() (systemd chạy ở apps/cty).
import fs from 'node:fs';
import path from 'node:path';
const tuFile = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const GOC = fs.existsSync(path.join(tuFile, 'cong-ty')) ? tuFile : process.cwd();

// MONOREPO + GÓI DÙNG CHUNG (tách repo cty, anh 18/11/2026 "Tập trung chuyển cty toàn diện theo plan" — earns-strategy decisions/2026-11-17-tach-repo-theo-phong.md):
// trước đây import tĩnh '../../web/…', '../../xuong-video/…' → chỉ chạy khi cty nằm trong monorepo, và next build chép cứng bản lúc dựng.
// Nay đọc LÚC CHẠY từ checkout monorepo trên cùng máy; chạy được cả khi cty là apps/cty (giai đoạn chuyển) lẫn repo riêng /opt/cty.
import os from 'node:os';
import { pathToFileURL } from 'node:url';
const laMono = (d) => !!d && fs.existsSync(path.join(d, 'apps', 'web', 'package.json'));
/** checkout earns-marketing-os-v2: MOS2_DIR → cty đang nằm trong monorepo → box3 → cạnh repo cty → máy Mac. Không thấy = null. */
export const MONO = [process.env.MOS2_DIR, path.resolve(GOC, '..', '..'), '/opt/earns-marketing-os-v2', path.resolve(GOC, '..', 'earns-marketing-os-v2'),
  path.join(os.homedir(), 'Me', 'Earns', 'earns-marketing-os-v2')].find(laMono) ?? null;
/** tệp monorepo theo đường gốc repo ('apps/web/src/lib/etp-bang-luat.json'); thiếu monorepo thì ném lỗi rõ, không chết im */
export const monoTep = (rel) => { if (!MONO) throw new Error(`không thấy monorepo earns-marketing-os-v2 để đọc ${rel} (đặt MOS2_DIR)`); return path.join(MONO, rel); };
export const docMonoJson = (rel) => JSON.parse(fs.readFileSync(monoTep(rel), 'utf8'));
/** import mã phòng khác lúc chạy (webpackIgnore: next không gói cứng bản lúc dựng) */
export const nhapMono = (rel) => import(/* webpackIgnore: true */ pathToFileURL(monoTep(rel)).href);
/** gói dùng chung: bản GHIM goi/<tên> (scripts/keo-goi.mjs) nếu có, không thì packages/<tên> của monorepo */
export const goiTep = (ten, rel) => { const g = path.join(GOC, 'goi', ten); return fs.existsSync(g) ? path.join(g, rel) : monoTep(path.join('packages', ten, rel)); };

if (process.argv[1]?.endsWith('goc.mjs') && process.argv.includes('--tu-kiem')) {
  const t = (await import('node:assert/strict')).default;
  t.ok(fs.existsSync(path.join(GOC, 'cong-ty')), 'GOC trỏ đúng gốc cty');
  t.ok(laMono(MONO), 'tìm được monorepo');
  t.ok(fs.existsSync(goiTep('gop-y', 'src/client.tsx')), 'gói gop-y đọc được');
  t.ok(Array.isArray(docMonoJson('apps/web/src/lib/etp-dang.json').dang), 'đọc được sổ của web');
  t.throws(() => docMonoJson('apps/web/khong-co-tep-nay.json'), 'tệp thiếu phải ném, không trả rỗng');
  console.log(`goc: tự kiểm đạt · GOC=${GOC} · MONO=${MONO}`);
}
