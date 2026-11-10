// CÂY REPO RIÊNG CHO TỪNG KỸ SƯ CLAUDE (anh 10/11/2026 "làm sao để chúng nó chạy ổn định, tự fix được lỗi mà tao ko phải tham gia"): Huy / Khang trước đây sửa thẳng trong
// cây mos2 chính của iMac — cây dùng chung với các phiên Claude khác và việc nền xưởng video, luôn có tệp dở của người khác → kỹ sư sửa xong không dám commit (tệp lẫn việc dở)
// rồi báo "cần anh". Mỗi kỹ sư một git worktree riêng ~/may-ky-su/<người>/earns-marketing-os-v2 trên nhánh ky-su/<người>: đầu lượt kéo origin/main (chỉ fast-forward),
// sửa + commit trong cây riêng, đẩy bằng `git push origin HEAD:main`. node_modules trỏ về cây chính (chỉ đọc). Không xoá gì: cây riêng giữ nguyên giữa các lượt.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MOS2_GOC = path.join(os.homedir(), 'Me/GitHub/earns-marketing-os-v2');
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8' }).trim();

/** Chuẩn bị cây riêng của `nguoi`, trả { dir, do: [tệp còn sửa dở từ lượt trước] }. Ném lỗi khi không fast-forward được (nhánh riêng có commit chưa lên main) — người gọi bỏ lượt. */
export function cayRieng(nguoi, goc = MOS2_GOC) {
  if (!/^[a-z0-9-]+$/.test(nguoi)) throw new Error(`tên kỹ sư lạ: ${nguoi}`);
  const dir = path.join(os.homedir(), 'may-ky-su', nguoi, 'earns-marketing-os-v2'), nhanh = `ky-su/${nguoi}`;
  git(goc, 'fetch', '-q', 'origin', 'main');
  // CÂY CHÍNH vẫn được kéo theo (như runner cũ làm trước khi có cây riêng): việc nền iMac (lich-su, shot-code, studio) chạy mã ở cây chính — không kéo thì chạy mã cũ.
  // Chỉ fast-forward; có tệp dở trùng thì bỏ qua, không đụng việc dở của ai.
  try { git(goc, 'merge', '-q', '--ff-only', 'origin/main'); } catch { /* cây chính có commit riêng / tệp dở trùng — để nguyên */ }
  if (!fs.existsSync(path.join(dir, '.git'))) { fs.mkdirSync(path.dirname(dir), { recursive: true }); git(goc, 'worktree', 'add', '-q', '-B', nhanh, dir, 'origin/main'); }
  const nm = path.join(dir, 'node_modules'); if (!fs.existsSync(nm)) fs.symlinkSync(path.join(goc, 'node_modules'), nm);
  // liên kết node_modules là TỆP (không phải thư mục) nên mẫu 'node_modules/' của .gitignore không khớp → thêm '/node_modules' vào exclude chung (thư mục thật vốn đã bị bỏ qua)
  const ex = path.resolve(dir, git(dir, 'rev-parse', '--git-path', 'info/exclude')); const exCu = fs.existsSync(ex) ? fs.readFileSync(ex, 'utf8') : '';
  if (!/^\/node_modules$/m.test(exCu)) { fs.mkdirSync(path.dirname(ex), { recursive: true }); fs.appendFileSync(ex, `${exCu && !exCu.endsWith('\n') ? '\n' : ''}/node_modules\n`); }
  git(dir, 'merge', '-q', '--ff-only', 'origin/main');
  const doDo = git(dir, 'status', '--porcelain', '--untracked-files=no').split('\n').filter(Boolean).map((l) => l.slice(3));
  return { dir, do: doDo };
}

if (process.argv[1]?.endsWith('cay-rieng.mjs') && process.argv[2]) { const r = cayRieng(process.argv[2]); console.log(JSON.stringify(r)); }
