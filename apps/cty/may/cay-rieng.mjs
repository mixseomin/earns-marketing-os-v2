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
  // BẢN DỞ TRÙNG TỆP MAIN VỪA ĐỔI (11/11/2026: Khang để dở may-dung.mts từ 23:06 10/11, main sau đó đổi cùng tệp → `merge --ff-only` từ chối mỗi lượt,
  // Khang đứng im gần một ngày, 4 việc chờ trong hàng — gồm việc SỬA LẠI của máy Mia). Cất bản dở thành tệp vá + stash (không xoá, không hoàn tác),
  // kéo main, rồi áp lại tệp vá lên bản mới. Áp không được = trả `vat` để kỹ sư đọc tệp vá và làm lại trên main mới, cây vẫn sạch để nhận việc.
  let vat = null;
  try { git(dir, 'merge', '-q', '--ff-only', 'origin/main'); } catch (e) {
    const dirty = git(dir, 'status', '--porcelain', '--untracked-files=no');
    if (!dirty) throw e;   // không phải do bản dở (nhánh riêng có commit chưa lên main) — để người gọi báo
    const tep = path.join(os.homedir(), 'may-ky-su', nguoi, `do-${new Date().toISOString().replace(/[:.]/g, '-')}.patch`);
    fs.writeFileSync(tep, execFileSync('git', ['-C', dir, 'diff', 'HEAD'], { encoding: 'utf8' }));
    git(dir, 'stash', 'push', '-q', '-m', `cay-rieng: bản dở của ${nguoi} trước khi kéo main (tệp vá ${tep})`);
    git(dir, 'merge', '-q', '--ff-only', 'origin/main');
    try { git(dir, 'apply', '--check', tep); git(dir, 'apply', tep); } catch { vat = tep; }
  }
  const doDo = git(dir, 'status', '--porcelain', '--untracked-files=no').split('\n').filter(Boolean).map((l) => l.slice(3));
  return { dir, do: doDo, vat };
}

if (process.argv[1]?.endsWith('cay-rieng.mjs') && process.argv[2]) { const r = cayRieng(process.argv[2]); console.log(JSON.stringify(r)); }

/** Như cayRieng, nhưng kẹt (không fast-forward được) thì BÁO chủ đề phòng rồi bỏ lượt — kỹ sư đứng im mà không ai biết là lỗi im lặng
 *  (anh 11/11/2026: "phải biết giới hạn đúng lúc, đúng chỗ"). tho-may-viec --canh tự giữ nhịp: mỗi khoá ≤ 1 tin / 24 giờ, không thành 5 phút một tin. */
export function cayHoacBao(nguoi, { ten, khoa, phong, tep }) {
  try { return cayRieng(nguoi); } catch (e) {
    const ly = String(e.stderr || e.message).split('\n')[0];
    console.log(`${new Date().toISOString()} chưa chuẩn bị được cây riêng, chưa nhận việc: ${ly}`);
    try {
      execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', 'root@167.233.241.16',
        `cd /opt/earns-marketing-os-v2/apps/cty && CTY_DATA_DIR=/var/lib/cty THO_MAY_TEP=${tep} node worker/tho-may-viec.mjs --canh ${khoa} ${phong}`],
      { input: `${ten} không kéo được bản mới nhất vào cây repo riêng trên iMac (~/may-ky-su/${nguoi}) nên đang đứng im, lỗi chưa ai sửa. Git báo: ${ly}`, encoding: 'utf8', timeout: 60000 });
    } catch (e2) { console.log(`báo kẹt lỗi: ${String(e2.message).split('\n')[0]}`); }
    process.exit(0);
  }
}
