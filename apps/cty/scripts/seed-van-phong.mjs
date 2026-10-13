#!/usr/bin/env node
// Bơm nhân sự vào văn phòng pixel (pixel-agents standalone, cty.on.tc/vp/cong-ty/). pixel-agents không có agent "ảo": phải gửi hook giả
// SessionStart + Stop cho mỗi người (cwd=/office/<Tên> → nhãn = Tên). Token đổi mỗi lần server khởi động → script đọc lại
// ~/.pixel-agents/server.json rồi bơm; systemd mos2-vp.service gọi ở ExecStartPost. `--config` chỉ ghi watchAllSessions (ExecStartPre).
import fs from 'node:fs';
import path from 'node:path';
import { parseFm } from './fm.mjs';
import { spriteTheoNguoi } from './nhan-vat.mjs';
import os from 'node:os';

// --cac-phong: TRÌNH CHẠY văn phòng riêng của MỌI phòng (worker/vp.mjs vanPhongCacPhong) — mỗi phòng một tiến trình pixel-agents (HOME riêng,
// cổng tự xin) + bơm nhân sự phòng đó, và BỘ ĐIỀU PHỐI :3863 (nginx đưa mọi /vp/<phòng>/ về, header X-Vp-Phong → đúng văn phòng). Mỗi phút
// quét lại danh sách phòng: phòng mới (anh 13/10/2026 "kể cả phòng mới cũng phải tự động có pixel phòng riêng") được mở văn phòng ngay, không sửa
// nginx / deploy.sh. Unit mos2-vp-thu.service chạy lệnh này (tên unit giữ từ Phòng thử). Một tiến trình con chết → dừng cả nhóm, systemd dựng lại.
if (process.argv.includes('--cac-phong')) {
  const { spawn, execFileSync } = await import('node:child_process');
  const net = await import('node:net');
  const { vanPhongCacPhong, dieuPhoi, CONG_DIEU_PHOI } = await import('../worker/vp.mjs');
  const SELF = new URL(import.meta.url).pathname, BIN = process.env.PIXEL_AGENTS_BIN || '/usr/bin/pixel-agents';
  if (!fs.existsSync(BIN)) { console.error(`✗ không có ${BIN} (deploy.sh cài pixel-agents)`); process.exit(1); }
  const con = [], cong = {};   // cong: phòng → cổng pixel-agents của phòng đó (bộ điều phối đọc)
  const dung = (ma) => { for (const c of con) c.kill('SIGTERM'); process.exit(ma); };
  const congTrong = () => new Promise((ok, fail) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); s.on('error', fail); });
  async function moVanPhong(v) {
    const p = await congTrong(), env = { ...process.env, HOME: v.home };
    // server.json cũ ghi cổng + token LẦN TRƯỚC (cổng giờ tự xin, đổi mỗi lần) → xoá để vpBao / script bơm không gõ nhầm cửa
    fs.mkdirSync(v.home, { recursive: true }); fs.rmSync(path.join(v.home, '.pixel-agents', 'server.json'), { force: true });
    execFileSync(process.execPath, [SELF, '--config'], { env, stdio: 'inherit' });
    const c = spawn(BIN, ['--host', '127.0.0.1', '--port', String(p)], { env, stdio: 'inherit' }); con.push(c); cong[v.phong] = p;
    c.on('exit', (ma) => { console.error(`✗ văn phòng ${v.phong} (:${p}) thoát mã ${ma} → dừng cả nhóm`); dung(1); });
    setTimeout(() => spawn(process.execPath, [SELF, '--phong', v.phong], { env, stdio: 'inherit' }), 5000);   // bơm sau khi server lên (script tự chờ thêm)
    console.log(`văn phòng ${v.phong} → :${p} (HOME ${v.home})`);
  }
  let dangQuet = false;
  const quet = async () => { if (dangQuet) return; dangQuet = true; try { for (const v of vanPhongCacPhong()) if (!cong[v.phong]) await moVanPhong(v); } finally { dangQuet = false; } };
  const dp = dieuPhoi(cong);
  dp.on('error', (e) => { console.error(`✗ bộ điều phối :${CONG_DIEU_PHOI}: ${e.message}`); dung(1); });
  dp.listen(CONG_DIEU_PHOI, '127.0.0.1', () => console.log(`bộ điều phối văn phòng → :${CONG_DIEU_PHOI}`));
  await quet();
  setInterval(() => quet().catch((e) => console.error(`quét phòng mới: ${e.message}`)), 60_000);
  for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => dung(0));
  await new Promise(() => {});   // giữ tiến trình (systemd theo dõi)
}

const HOME = path.join(os.homedir(), '.pixel-agents');
const NS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'cong-ty', 'nhan-su');

function docs() {
  return fs.readdirSync(NS_DIR).filter((d) => fs.existsSync(path.join(NS_DIR, d, 'SOUL.md'))).map((d) => {
    const raw = fs.readFileSync(path.join(NS_DIR, d, 'SOUL.md'), 'utf8');
    const fm = parseFm(raw).fm;
    return { id: d, ten: String(fm.ten || d), gioi_tinh: String(fm.gioi_tinh || ''), phong: String(fm.phong || ''), thu_tu: Number(fm.thu_tu || 99) };
  }).sort((a, b) => a.thu_tu - b.thu_tu);
}

if (process.argv.includes('--config')) {
  fs.mkdirSync(HOME, { recursive: true });
  const f = path.join(HOME, 'config.json');
  const cfg = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  // pixel-agents standalone đọc khoá trong `standalone` — trước ghi alwaysShowLabels ở ngoài nên nhãn trên đầu chưa từng bật (11/10/2026).
  cfg.standalone = { ...(cfg.standalone || {}), watchAllSessions: true, alwaysShowLabels: true };
  fs.writeFileSync(f, JSON.stringify(cfg, null, 2));
  console.log('config: watchAllSessions=true, alwaysShowLabels=true');
  process.exit(0);
}

// Chờ server thật sự nhận request (poll /api/health tới 30s) thay vì tin một con số sleep — server.json có thể còn là của lần chạy trước.
let srv, base;
for (let i = 0; i < 60; i++) {
  try {
    srv = JSON.parse(fs.readFileSync(path.join(HOME, 'server.json'), 'utf8'));
    base = `http://127.0.0.1:${srv.port}`;
    if ((await fetch(`${base}/api/health`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
  if (i === 59) { console.error('✗ pixel-agents không lên sau 30s'); process.exit(1); }
}
async function hook(body) {
  const r = await fetch(`${base}/api/hooks/claude`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${srv.token}` }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${body.hook_event_name} ${r.status}`);
}
const phongLoc = process.argv.includes('--phong') ? process.argv[process.argv.indexOf('--phong') + 1] : null;   // instance riêng một phòng (cty.on.tc/vp/<phòng>/)
let n = 0;
const ds = docs().filter((x) => !phongLoc || x.phong === phongLoc);
for (const d of ds) {
  const session_id = `cty-${d.id}`;
  await hook({ session_id, hook_event_name: 'SessionStart', cwd: `/office/${d.ten}`, source: 'startup' });
  await hook({ session_id, hook_event_name: 'Stop' });
  n++;
}
console.log(`seeded ${n} nhân sự vào văn phòng (${base})`);

// Nhân vật theo người. pixel-agents bốc ngẫu nhiên 1 trong 6 sprite lúc agent vào; không có API đặt sẵn, chỉ có tin WS `saveAgentSeats`
// (cái webview gửi khi anh đổi áo tay). Nên sau khi bơm: hỏi danh sách agent như webview (`webviewReady` → `existingAgents`), rồi gửi
// sprite theo quy tắc chung scripts/nhan-vat.mjs — tính trên TOÀN BỘ nhân sự (không phải danh sách của văn phòng này) để một người một
// hình ở mọi văn phòng và khớp avatar trên cty.on.tc. Giữ seatId cũ để không xếp lại chỗ ngồi.
const tatCa = docs(); const spriteCua = spriteTheoNguoi(tatCa);
const theoTen = Object.fromEntries(tatCa.map((d) => [d.ten, spriteCua[d.id]]));
async function apGioiTinh() {
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
  const agents = await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('ws: không nhận existingAgents sau 10s')), 10000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'webviewReady' }));
    ws.onmessage = (m) => { const v = JSON.parse(String(m.data)); if (v.type === 'existingAgents') { clearTimeout(t); ok(v); } };
    ws.onerror = () => { clearTimeout(t); fail(new Error('ws: lỗi kết nối')); };
  });
  let cu = {}; try { cu = JSON.parse(fs.readFileSync(path.join(HOME, 'standalone-state.json'), 'utf8')).seats || {}; } catch {}
  const seats = {};
  for (const id of agents.agents) {
    const ten = agents.folderNames?.[id]; if (!(ten in theoTen)) continue;
    const seatId = cu[id]?.seatId ?? agents.agentMeta?.[id]?.seatId;
    seats[id] = { palette: theoTen[ten], hueShift: 0, ...(seatId ? { seatId } : {}) };
  }
  ws.send(JSON.stringify({ type: 'saveAgentSeats', seats }));
  await new Promise((r) => setTimeout(r, 300)); ws.close();
  return Object.keys(seats).length;
}
// Tab trình duyệt đang mở nối lại ngay khi server lên, cầm palette ngẫu nhiên lúc đó và gửi saveAgentSeats đè lên (đo 10/10/2026
// trên vpthu). Áp lần hai sau 20s để thắng nó; tab đó tải lại là thấy đúng.
console.log(`nhân vật theo giới tính: ${await apGioiTinh()} người`);
await new Promise((r) => setTimeout(r, 20000));
console.log(`nhân vật theo giới tính (lần 2): ${await apGioiTinh()} người`);
