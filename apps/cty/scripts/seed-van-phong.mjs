#!/usr/bin/env node
// Bơm nhân sự vào văn phòng pixel (pixel-agents standalone, vp.on.tc). pixel-agents không có agent "ảo": phải gửi hook giả
// SessionStart + Stop cho mỗi người (cwd=/office/<Tên> → nhãn = Tên). Token đổi mỗi lần server khởi động → script đọc lại
// ~/.pixel-agents/server.json rồi bơm; systemd mos2-vp.service gọi ở ExecStartPost. `--config` chỉ ghi watchAllSessions (ExecStartPre).
import fs from 'node:fs';
import path from 'node:path';
import { parseFm } from './fm.mjs';
import os from 'node:os';

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
  cfg.standalone = { ...(cfg.standalone || {}), watchAllSessions: true };
  cfg.alwaysShowLabels = true;
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
const phongLoc = process.argv.includes('--phong') ? process.argv[process.argv.indexOf('--phong') + 1] : null;   // instance riêng một phòng (vpthu.on.tc)
let n = 0;
const ds = docs().filter((x) => !phongLoc || x.phong === phongLoc);
for (const d of ds) {
  const session_id = `cty-${d.id}`;
  await hook({ session_id, hook_event_name: 'SessionStart', cwd: `/office/${d.ten}`, source: 'startup' });
  await hook({ session_id, hook_event_name: 'Stop' });
  n++;
}
console.log(`seeded ${n} nhân sự vào văn phòng (${base})`);

// Nhân vật theo giới tính. pixel-agents bốc ngẫu nhiên 1 trong 6 sprite (assets/characters/char_N.png) lúc agent vào; không có API
// đặt sẵn, chỉ có tin WS `saveAgentSeats` (cái webview gửi khi anh đổi áo tay). Nên sau khi bơm: hỏi danh sách agent như webview
// (`webviewReady` → `existingAgents`), rồi gửi palette theo gioi_tinh. Sprite: 1 tóc dài váy đen · 3 tóc bạc ngắn · 5 tóc đen ngắn
// = nữ; 0 · 2 · 4 = nam (nhìn ảnh 10/10/2026). Giữ seatId cũ để không xếp lại chỗ ngồi.
export const SPRITE = { nam: [0, 2, 4], nu: [1, 3, 5] };
export function paletteTheoGioi(ds) {   // ds theo thu_tu → { ten: palette }, xoay vòng trong từng giới để cạnh nhau ít trùng áo
  const dem = { nam: 0, nu: 0 }; const out = {};
  for (const d of ds) { const g = d.gioi_tinh === 'nu' ? 'nu' : 'nam'; out[d.ten] = SPRITE[g][dem[g]++ % 3]; }
  return out;
}
const theoTen = paletteTheoGioi(ds);
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
  seats[id] = { palette: theoTen[ten], hueShift: 0, ...(cu[id]?.seatId ? { seatId: cu[id].seatId } : agents.agentMeta?.[id]?.seatId ? { seatId: agents.agentMeta[id].seatId } : {}) };
}
ws.send(JSON.stringify({ type: 'saveAgentSeats', seats }));
await new Promise((r) => setTimeout(r, 300)); ws.close();
console.log(`nhân vật theo giới tính: ${Object.keys(seats).length} người`);
