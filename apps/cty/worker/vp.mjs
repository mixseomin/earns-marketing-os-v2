// Báo trạng thái nhân sự sang văn phòng pixel (pixel-agents) bằng hook giả — để nhân vật gõ phím khi đang được gọi mô hình và về
// ghế khi xong. Nhiều instance: cả công ty (HOME /root, mos2-vp.service) + văn phòng RIÊNG của từng phòng khai van_phong_cong — mỗi instance
// một HOME, server.json riêng, token riêng. Mỗi người báo vào văn phòng cả công ty + văn phòng riêng của phòng mình. CTY_VP_HOMES (danh sách
// HOME cách dấu phẩy) đè cả danh sách khi cần (tự kiểm). Best-effort: VP tắt thì bỏ qua, không làm hỏng lượt.
//   node worker/vp.mjs --tu-kiem    cổng các văn phòng riêng không trùng, khớp map nginx (deploy/nginx-cty.conf)
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';

const CONG_TY = path.join(GOC, 'cong-ty');
const HOME_CONG_TY = '/root';
/** VĂN PHÒNG RIÊNG của các phòng — MỘT nguồn: phòng khai `van_phong_cong: <cổng>` trong cong-ty/phong/<phòng>.md (HOME mặc định
 *  /var/lib/cty/vp-<phòng>, đè bằng van_phong_home). Trình chạy (scripts/seed-van-phong.mjs --cac-phong, unit mos2-vp-thu.service),
 *  vpBao, ô văn phòng trên trang phòng (/vp/<phòng>/) đều đọc từ đây; thêm phòng = thêm một dòng ở hồ sơ phòng + một dòng map nginx. */
export function vanPhongCacPhong() {
  const dir = path.join(CONG_TY, 'phong');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ({ phong: f.slice(0, -3), fm: parseFm(fs.readFileSync(path.join(dir, f), 'utf8')).fm }))
    .filter((x) => x.fm.van_phong_cong).map((x) => ({ phong: x.phong, cong: Number(x.fm.van_phong_cong), home: String(x.fm.van_phong_home || `/var/lib/cty/vp-${x.phong}`) }));
}
const phongCua = (id) => { try { return String(parseFm(fs.readFileSync(path.join(CONG_TY, 'nhan-su', id, 'SOUL.md'), 'utf8')).fm.phong ?? ''); } catch { return ''; } };
const HOMES = (id) => (process.env.CTY_VP_HOMES ? process.env.CTY_VP_HOMES.split(',').map((h) => h.trim()).filter(Boolean)
  : [HOME_CONG_TY, ...vanPhongCacPhong().filter((v) => v.phong === phongCua(id)).map((v) => v.home)]);

async function hook(home, body) {
  const f = path.join(home, '.pixel-agents', 'server.json');
  if (!fs.existsSync(f)) return false;
  const srv = JSON.parse(fs.readFileSync(f, 'utf8'));
  try {
    const r = await fetch(`http://127.0.0.1:${srv.port}/api/hooks/claude`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${srv.token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

// trangThai: 'lam' (đang gọi mô hình → nhân vật gõ) · 'xong' (về ghế) · 'cho' (chờ người). moTa = chữ hiện trên đầu nhân vật
// (vd "2 làm · từ Tâm"): đi qua Bash.command vì pixel-agents chỉ hiện chữ tự do của công cụ này ("Running: …", cắt ở 30 ký tự).
export async function vpBao(id, trangThai, moTa = '') {
  const session_id = `cty-${id}`;
  const cong = { tool_name: 'Bash', tool_input: { command: moTa || 'ca' } };
  const ev = trangThai === 'lam' ? [{ session_id, hook_event_name: 'PreToolUse', ...cong }]
    : trangThai === 'cho' ? [{ session_id, hook_event_name: 'Notification', notification_type: 'idle_prompt' }]
    : [{ session_id, hook_event_name: 'PostToolUse', ...cong }, { session_id, hook_event_name: 'Stop' }];
  let ok = 0;
  for (const home of HOMES(id)) for (const e of ev) if (await hook(home, e)) ok++;
  return ok;
}

if (process.argv.includes('--bao')) {   // node worker/vp.mjs --bao tam lam  (thử tay, 0 tiền)
  const [, , , id, tt] = process.argv;
  console.log(`vp: ${id} ${tt} → ${await vpBao(id, tt)} hook nhận`);
}

if (process.argv[1]?.endsWith('vp.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert');
  const ds = vanPhongCacPhong(); a.ok(ds.length >= 1, 'ít nhất một phòng có văn phòng riêng');
  a.equal(new Set(ds.map((v) => v.cong)).size, ds.length, 'hai phòng trùng cổng văn phòng');
  for (const v of ds) a.ok(![3860, 3861, 3862].includes(v.cong), `${v.phong}: cổng ${v.cong} đã là cty / vp cả công ty / proxy`);
  const ng = fs.readFileSync(path.join(GOC, '..', '..', 'deploy', 'nginx-cty.conf'), 'utf8');
  for (const v of ds) a.match(ng, new RegExp(`^\\s*${v.phong}\\s+${v.cong};`, 'm'), `deploy/nginx-cty.conf thiếu dòng map "${v.phong} ${v.cong};" → /vp/${v.phong}/ trả 404`);
  a.deepEqual(HOMES('tam'), [HOME_CONG_TY, ...ds.filter((v) => v.phong === 'thu-nghiem').map((v) => v.home)], 'Tâm báo vào văn phòng cả công ty + văn phòng Phòng thử');
  a.ok(!HOMES('thao').includes('/var/lib/cty/vp-thu'), 'người phòng khác không lọt vào văn phòng Phòng thử');
  console.log(`✓ vp.mjs: ${ds.length} văn phòng riêng (${ds.map((v) => `${v.phong}:${v.cong}`).join(', ')}) khớp nginx, không trùng cổng`);
}
