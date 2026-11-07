// Tờ so ba hướng logo hiện đại: ra/logo-hien-dai/bang-so.png (Playwright của skill teardown, iMac). Xem ve-logo-hien-dai.py.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { chromium } = await import(path.join(os.homedir(), '.claude/skills/content/teardown/node_modules/playwright/index.mjs'));
const RA = path.join(import.meta.dirname, 'ra/logo-hien-dai');
let dem = 0;
// mỗi lần nhúng đổi id chuyển sắc, tránh trùng id giữa các SVG cùng trang
const svg = (t, css) => { dem += 1; return fs.readFileSync(path.join(RA, `${t}.svg`), 'utf8').replace(/id="(\w+)"/g, `id="$1_${dem}"`).replace(/url\(#(\w+)\)/g, `url(#$1_${dem})`).replace('<svg ', `<svg style="${css}" `); };
const cot = (m, ten) => `<div style="display:grid;gap:12px;align-content:start">
<div style="font:600 15px Helvetica;color:#333">${ten}</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="background:#10131c;border-radius:14px;padding:22px">${svg(m + '-dau', 'width:100%;display:block')}</div><div style="background:#f6f1e7;border-radius:14px;padding:22px">${svg(m + '-dau', 'width:100%;display:block')}</div></div>
<div style="background:#10131c;border-radius:14px;padding:22px">${svg(m + '-ngang-toi', 'width:100%;display:block')}</div>
<div style="background:#f6f1e7;border-radius:14px;padding:22px">${svg(m + '-ngang-sang', 'width:100%;display:block')}</div>
<div style="display:flex;gap:18px;align-items:end;padding:6px">${[96, 64, 48, 32, 24, 16].map((s) => svg(m + '-the', `width:${s}px;height:${s}px`)).join('')}${[32, 16].map((s) => svg(m + '-dau-den', `width:${s}px;height:${s}px`)).join('')}</div></div>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1560, height: 860 } });
await p.setContent(`<!doctype html><meta charset=utf-8><body style="margin:0;background:#fff;padding:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${cot('a', 'A1. Trăng + kim bo tròn')}${cot('b', 'A2. Vòng trăng tua ngược')}${cot('c', 'A3. Trăng + kim thành chữ Y')}</body>`);
await p.screenshot({ path: path.join(RA, 'bang-so.png') });
// thử trên ảnh thật (luật nền lớn + ảnh đại diện = ảnh thật): bó báo Pexels dưới lớp mực, vẫn nhìn ra báo
const NEN = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(import.meta.dirname, 'anh-nen/pe-27794812.jpg')).toString('base64');
const FONT = 'data:font/ttf;base64,' + fs.readFileSync(path.join(import.meta.dirname, '../../../../public/fonts/Montserrat-ExtraBold.ttf')).toString('base64');
const lop = (a, c) => `<div style="position:absolute;inset:0;background:url(${NEN}) ${c} / cover;filter:grayscale(.75) contrast(1.05)"></div><div style="position:absolute;inset:0;background:${a}"></div>`;
for (const m of ['a', 'b', 'c']) {
  await p.setViewportSize({ width: 800, height: 800 });
  await p.setContent(`<!doctype html><body style="margin:0"><div style="position:relative;width:800px;height:800px;overflow:hidden">${lop('rgba(16,19,28,.74)', '50% 45%')}<div style="position:absolute;left:125px;top:125px;width:550px;height:550px;filter:drop-shadow(0 10px 40px rgba(255,90,50,.35))">${svg(m + '-dau', 'width:100%;display:block')}</div></div></body>`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(RA, `${m}-avatar-800.png`) });
}
await p.setViewportSize({ width: 2560, height: 1440 });
await p.setContent(`<!doctype html><style>@font-face{font-family:M;src:url(${FONT})}</style><body style="margin:0"><div style="position:relative;width:2560px;height:1440px;overflow:hidden">${lop('linear-gradient(180deg,rgba(16,19,28,.35),rgba(16,19,28,.86) 36%,rgba(16,19,28,.86) 64%,rgba(16,19,28,.35))', '50% 45%')}<div style="position:absolute;left:520px;right:520px;top:565px;text-align:center">${svg('c-ngang-toi', 'width:1400px;display:block;margin:0 auto')}</div><div style="position:absolute;left:0;right:0;top:845px;text-align:center;font:400 34px M;letter-spacing:.2em;color:#f6f1e7cc">HISTORY, REPORTED LIKE IT JUST HAPPENED</div></div></body>`);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(RA, 'c-yt-banner-2560x1440.png') });
await b.close();
console.log(path.join(RA, 'bang-so.png'));
