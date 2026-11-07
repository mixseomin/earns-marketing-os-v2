// Dựng PNG nền trong suốt từ ra/logo/*.svg và tờ thử ra/logo/bang-thu.png (Playwright của skill teardown, iMac). Xem ve-logo.py.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { chromium } = await import(path.join(os.homedir(), '.claude/skills/content/teardown/node_modules/playwright/index.mjs'));
const RA = path.join(import.meta.dirname, 'ra/logo');
const doc = (t) => fs.readFileSync(path.join(RA, `${t}.svg`), 'utf8');
const co = (t) => doc(t).match(/viewBox="0 0 (\S+) (\S+)"/).slice(1).map(Number);
const DAU = ['dau-vang', 'dau-do', 'dau-den', 'dau-trang', 'huy-hieu'];
const LOCKUP = ['ngang-nen-sang', 'ngang-nen-toi', 'doc-nen-sang', 'doc-nen-toi'];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2400, height: 1400 } });
const chup = async (t, w, h, ra) => {
  await p.setViewportSize({ width: Math.round(w), height: Math.round(h) });
  await p.setContent(`<!doctype html><style>*{margin:0}html,body{background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${doc(t)}`);
  await p.screenshot({ path: path.join(RA, ra), omitBackground: true });
};
for (const t of DAU) await chup(t, 1024, 1024, `${t}-1024.png`);
for (const s of [64, 32, 16]) await chup('huy-hieu-nho', s, s, `huy-hieu-${s}.png`);
for (const t of LOCKUP) { const [w, h] = co(t); await chup(t, 1600, 1600 * h / w, `${t}.png`); }
const anh = (t, s, c) => `<span style="display:inline-block;width:${s}px;height:${s}px">${doc(t).replace('<svg ', `<svg width="${s}" height="${s}" `).replaceAll('#111111', c ?? '#111111')}</span>`;
const hop = (nen, t) => `<div style="background:${nen};padding:26px;display:flex;align-items:center;justify-content:center">${doc(t).replace('<svg ', '<svg style="height:210px;max-width:100%" ')}</div>`;
await p.setViewportSize({ width: 1500, height: 960 });
await p.setContent(`<!doctype html><meta charset=utf-8><body style="margin:0;background:#fff;font:14px Helvetica;display:grid;gap:12px;padding:16px">
<div style="display:grid;grid-template-columns:1.5fr 1.5fr;gap:12px">${hop('#f7f4ec', 'ngang-nen-sang')}${hop('#111', 'ngang-nen-toi')}</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${hop('#f7f4ec', 'doc-nen-sang')}${hop('#111', 'doc-nen-toi')}${hop('#e8352b', 'dau-vang')}${hop('#fff', 'huy-hieu')}</div>
<div style="display:flex;gap:26px;align-items:end;padding:10px">${[128, 64, 48, 32, 24, 16].map((s) => anh(s > 32 ? 'huy-hieu' : 'huy-hieu-nho', s)).join('')}<span style="width:30px"></span>${[64, 32, 24, 16].map((s) => anh(s > 32 ? 'dau-den' : 'dau-den-nho', s)).join('')}</div></body>`);
await p.screenshot({ path: path.join(RA, 'bang-thu.png') });
await b.close();
console.log(fs.readdirSync(RA).filter((f) => f.endsWith('.png')).map((f) => path.join(RA, f)).join('\n'));
