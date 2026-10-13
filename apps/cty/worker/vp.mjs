// Báo trạng thái nhân sự sang văn phòng pixel (pixel-agents) bằng hook giả — để nhân vật gõ phím khi đang được gọi mô hình và về
// ghế khi xong. Nhiều instance: cả công ty (HOME /root, mos2-vp.service) + văn phòng RIÊNG của MỌI phòng — mỗi instance một HOME, server.json
// riêng, token riêng. Mỗi người báo vào văn phòng cả công ty + văn phòng phòng mình. CTY_VP_HOMES (danh sách HOME cách dấu phẩy) đè cả danh
// sách khi cần (tự kiểm). Best-effort: VP tắt thì bỏ qua, không làm hỏng lượt.
//   node worker/vp.mjs --tu-kiem    mọi phòng có văn phòng, HOME không trùng, nginx đưa /vp/<phòng>/ về bộ điều phối, điều phối đúng phòng
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';

const CONG_TY = path.join(GOC, 'cong-ty');
const HOME_CONG_TY = '/root';
/** Cổng BỘ ĐIỀU PHỐI văn phòng các phòng: nginx đưa mọi cty.on.tc/vp/<phòng>/ (trừ cong-ty) về đây kèm header X-Vp-Phong; trình chạy
 *  (scripts/seed-van-phong.mjs --cac-phong) chuyển tới pixel-agents của đúng phòng. Cổng từng văn phòng do trình chạy tự xin, không khai. */
export const CONG_DIEU_PHOI = 3863;
/** VĂN PHÒNG RIÊNG của MỌI phòng (anh 13/10/2026: "kể cả phòng mới cũng phải tự động có pixel phòng riêng") — mỗi tệp cong-ty/phong/<phòng>.md
 *  là một văn phòng, HOME /var/lib/cty/vp-<phòng> (đè bằng van_phong_home để giữ bố cục cũ). Trình chạy, vpBao, khung văn phòng trên ngăn phòng
 *  (lib/cong-ty.ts hrefVp) đều đọc từ đây; thêm phòng = thêm tệp hồ sơ phòng, trình chạy tự mở văn phòng trong ≤ 1 phút. */
export function vanPhongCacPhong() {
  const dir = path.join(CONG_TY, 'phong');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => ({ phong: f.slice(0, -3), fm: parseFm(fs.readFileSync(path.join(dir, f), 'utf8')).fm }))
    .map((x) => ({ phong: x.phong, home: String(x.fm.van_phong_home || `/var/lib/cty/vp-${x.phong}`) }));
}
/** Bộ điều phối: cong = { phòng: cổng pixel-agents } (trình chạy cập nhật khi mở văn phòng mới) → http.Server chuyển cả HTTP lẫn WebSocket
 *  theo header X-Vp-Phong. Phòng lạ → 404. ponytail: chuyển thô, không đệm — đủ cho một trang + một /ws mỗi người xem. */
export function dieuPhoi(cong) {
  const den = (req) => cong[String(req.headers['x-vp-phong'] ?? '')];
  const sv = http.createServer((req, res) => {
    const p = den(req); if (!p) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Phòng này chưa có văn phòng (trình chạy chưa mở).'); }
    const r = http.request({ host: '127.0.0.1', port: p, method: req.method, path: req.url, headers: req.headers }, (u) => { res.writeHead(u.statusCode ?? 502, u.headers); u.pipe(res); });
    r.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); }); req.pipe(r);
  });
  sv.on('upgrade', (req, sock, dau) => {
    const p = den(req); if (!p) return sock.destroy();
    const u = net.connect(p, '127.0.0.1', () => {
      let h = `${req.method} ${req.url} HTTP/1.1\r\n`; for (let i = 0; i < req.rawHeaders.length; i += 2) h += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
      u.write(`${h}\r\n`); if (dau?.length) u.write(dau); u.pipe(sock); sock.pipe(u);
    });
    u.on('error', () => sock.destroy()); sock.on('error', () => u.destroy());
  });
  return sv;
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

// node worker/vp.mjs --lenh <id>: máy Mac (puzzle-books scripts/nhan-lenh.mjs) gọi qua ssh MỖI LẦN ghi trạng thái một lệnh máy → người phụ trách
// lệnh (lenh-may.mjs nguoiLenh) gõ phím khi máy chạy, về ghế khi xong, chờ người khi lỗi — cùng lúc nút trên cty đổi trạng thái (anh 13/10/2026).
if (process.argv.includes('--lenh')) {
  const { dsLenh, trangLenh, nguoiLenh, LENH_MAY } = await import('./lenh-may.mjs');
  const id = process.argv[process.argv.indexOf('--lenh') + 1];
  const x = dsLenh().find((l) => l.id === id); const n = x && nguoiLenh(x.lenh); const h = x && trangLenh(x);
  const tt = { dang: 'lam', xong: 'xong', loi: 'cho', chet: 'cho' }[h];
  const l = x && LENH_MAY[x.lenh];
  console.log(n && tt ? `vp: ${n.id} ${tt} (${x.lenh}) → ${await vpBao(n.id, tt, `${l.ten.split(/[(:]/)[0].trim()} · ${l.may}`)} hook nhận`
    : `vp: lệnh ${id} không báo (${!x ? 'không có tệp' : !n ? 'không có người phụ trách' : h})`);
}

if (process.argv[1]?.endsWith('vp.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert');
  const ds = vanPhongCacPhong(), soPhong = fs.readdirSync(path.join(CONG_TY, 'phong')).filter((f) => f.endsWith('.md')).length;
  a.equal(ds.length, soPhong, 'phòng nào cũng phải có văn phòng riêng');
  a.equal(new Set(ds.map((v) => v.home)).size, ds.length, 'hai phòng trùng HOME văn phòng');
  const ng = fs.readFileSync(path.join(GOC, '..', '..', 'deploy', 'nginx-cty.conf'), 'utf8');
  a.match(ng, new RegExp(`^\\s*default\\s+${CONG_DIEU_PHOI};`, 'm'), `deploy/nginx-cty.conf: map phải để default ${CONG_DIEU_PHOI} (bộ điều phối) — không thì phòng mới trả 404`);
  a.match(ng, /proxy_set_header X-Vp-Phong \$vp_phong;/, 'deploy/nginx-cty.conf thiếu header X-Vp-Phong → bộ điều phối không biết phòng nào');
  a.deepEqual(HOMES('tam'), [HOME_CONG_TY, ...ds.filter((v) => v.phong === 'thu-nghiem').map((v) => v.home)], 'Tâm báo vào văn phòng cả công ty + văn phòng Phòng thử');
  a.ok(!HOMES('thao').includes('/var/lib/cty/vp-thu') && HOMES('thao').includes('/var/lib/cty/vp-sach'), 'Thảo vào văn phòng Sách, không lọt sang Phòng thử');
  // điều phối: hai "văn phòng" giả → đúng phòng theo header, cả HTTP lẫn WebSocket (upgrade); phòng lạ 404
  const gia = (ten) => { const s = http.createServer((q, r) => r.end(`${ten}${q.url}`)); s.on('upgrade', (q, so) => { so.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'); so.on('data', (d) => so.write(`${ten}:${d}`)); }); return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok(s))); };
  const [g1, g2] = await Promise.all([gia('sach'), gia('ky-thuat')]);
  const dp = dieuPhoi({ sach: g1.address().port, 'ky-thuat': g2.address().port }); await new Promise((ok) => dp.listen(0, '127.0.0.1', ok)); const P = dp.address().port;
  const lay = (phong) => fetch(`http://127.0.0.1:${P}/x?y=1`, { headers: { 'x-vp-phong': phong } }).then(async (r) => `${r.status} ${await r.text()}`);
  a.equal(await lay('ky-thuat'), '200 ky-thuat/x?y=1'); a.equal(await lay('sach'), '200 sach/x?y=1'); a.match(await lay('khong-co'), /^404/);
  const ws = await new Promise((ok, fail) => { const c = net.connect(P, '127.0.0.1', () => c.write('GET /ws HTTP/1.1\r\nHost: x\r\nX-Vp-Phong: sach\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'));
    let b = ''; c.on('data', (d) => { b += d; if (b.includes('\r\n\r\n') && !b.includes('sach:')) c.write('chao'); if (b.includes('sach:chao')) { c.destroy(); ok(b); } }); c.on('error', fail); setTimeout(() => fail(new Error('upgrade không thông')), 3000); });
  a.match(ws, /^HTTP\/1\.1 101/);
  for (const s of [dp, g1, g2]) s.close();
  console.log(`✓ vp.mjs: ${ds.length}/${soPhong} phòng có văn phòng riêng, HOME không trùng, nginx → điều phối :${CONG_DIEU_PHOI}, điều phối đúng phòng (HTTP + WebSocket, phòng lạ 404)`);
  process.exit(0);
}
