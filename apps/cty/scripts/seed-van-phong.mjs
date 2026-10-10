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
    return { id: d, ten: String(fm.ten || d), phong: String(fm.phong || ''), thu_tu: Number(fm.thu_tu || 99) };
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
for (const d of docs().filter((x) => !phongLoc || x.phong === phongLoc)) {
  const session_id = `cty-${d.id}`;
  await hook({ session_id, hook_event_name: 'SessionStart', cwd: `/office/${d.ten}`, source: 'startup' });
  await hook({ session_id, hook_event_name: 'Stop' });
  n++;
}
console.log(`seeded ${n} nhân sự vào văn phòng (${base})`);
