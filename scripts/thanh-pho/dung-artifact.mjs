#!/usr/bin/env node
// DỰNG BẢN ARTIFACT THÀNH PHỐ SOCIAL (anh 22/10/2026): lấy mô hình số thật từ mos2 (/api/ext/thanh-pho, gọi trên box3 — khoá MOS2_EXT_KEY
// đọc tại chỗ, không rời máy chủ) → gói mã cảnh (apps/web/src/components/social-thanh-pho-canh.ts) bằng esbuild → MỘT tệp HTML.
// Rồi đăng tệp đó lên đúng artifact anh đang mở (Claude gọi công cụ Artifact với đường dẫn in ra cuối).
//   node scripts/thanh-pho/dung-artifact.mjs [tệp-ra]   (mặc định: scripts/thanh-pho/ra/thanh-pho-social.html — trong repo, không ở /tmp)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const goc = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ra = resolve(process.argv[2] ?? `${goc}/scripts/thanh-pho/ra/thanh-pho-social.html`);
const BOX = 'root@167.233.241.16';
const lenh = `cd /opt/earns-marketing-os-v2 && K=$(grep -E '^MOS2_EXT_KEY=' .env.production | cut -d= -f2- | tr -d '"') && curl -sf -m 90 -H "Authorization: Bearer $K" http://127.0.0.1:3821/api/ext/thanh-pho`;
const tl = JSON.parse(execFileSync('ssh', [BOX, lenh], { encoding: 'utf8', maxBuffer: 64 << 20 }));
if (!tl.ok) throw new Error('mos2 không trả mô hình');
const js = execFileSync(`${goc}/node_modules/.bin/esbuild`, [`${goc}/scripts/thanh-pho/vao.ts`, '--bundle', '--format=iife', '--minify', `--alias:@=${goc}/apps/web/src`, '--log-level=warning'], { encoding: 'utf8', maxBuffer: 64 << 20 });
const gioVn = new Date(Date.parse(tl.luc) + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const html = `<title>Thành phố Social Traffic</title>
<style>
:root { --nen: #060914; color-scheme: dark; }
:root:not([data-theme="light"]) { --nen: #060914; } :root[data-theme="dark"] { --nen: #060914; }
html, body { height: 100%; margin: 0; background: var(--nen); }
#pho { position: fixed; inset: 0; }
#luc { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(10px + env(safe-area-inset-bottom, 0px)); z-index: 8; font: 10px system-ui, sans-serif; color: #8e9abd; background: #111830cc; border: 1px solid #252f4e; border-radius: 999px; padding: 3px 9px; pointer-events: none; }
</style>
<div id="pho" aria-label="Thành phố 3D social traffic"></div>
<div id="luc">số lúc ${gioVn} (GMT+7)</div>
<script>window.__MH = ${JSON.stringify(tl.mh).replace(/</g, '\\u003c')};</script>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, html);
console.log(`${ra} · ${(html.length / 1024).toFixed(0)} KB · ${tl.mh.tk.length} toà · ${tl.mh.cum.length} cụm · ${tl.mh.dich.length} site · số lúc ${gioVn}`);
