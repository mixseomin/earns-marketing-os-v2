// Bộ cuối logo A3 của kênh Yesterday's News Tonight (anh chọn 07/11/2026): PNG từ ra/logo-a3/*.svg, ảnh đại diện + ảnh bìa trên ẢNH THẬT, tờ thử bang-thu.png.
// Chạy: uv run --no-project --with fonttools --with uharfbuzz python ve-logo-hien-dai.py && node ve-logo-a3.mjs   (Playwright của skill teardown, iMac; 0đ)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { chromium } = await import(path.join(os.homedir(), '.claude/skills/content/teardown/node_modules/playwright/index.mjs'));
const GOC = import.meta.dirname;
const RA = path.join(GOC, 'ra/logo-a3');
const RB = path.join(GOC, 'ra');
let dem = 0;
const doc = (t) => fs.readFileSync(path.join(RA, `${t}.svg`), 'utf8');
const co = (t) => doc(t).match(/viewBox="0 0 (\S+) (\S+)"/).slice(1).map(Number);
// mỗi lần nhúng đổi id chuyển sắc, tránh trùng id giữa các SVG cùng trang
const svg = (t, css) => { dem += 1; return doc(t).replace(/id="(\w+)"/g, `id="$1_${dem}"`).replace(/url\(#(\w+)\)/g, `url(#$1_${dem})`).replace('<svg ', `<svg style="${css}" `); };
const b = await chromium.launch();
const p = await b.newPage();
const chup = async (t, w, h, ra) => {
  await p.setViewportSize({ width: Math.round(w), height: Math.round(h) });
  await p.setContent(`<!doctype html><style>*{margin:0}html,body{background:transparent}</style>${svg(t, `display:block;width:${w}px;height:${h}px`)}`);
  await p.screenshot({ path: path.join(RA, ra), omitBackground: true });
};
for (const t of ['dau-chuyen-sac', 'dau-do-cho-nen-sang', 'dau-muc', 'dau-kem', 'dau-do', 'the-vuong', 'huy-hieu-tron']) await chup(t, 1024, 1024, `${t}-1024.png`);
for (const s of [64, 48, 32, 24, 16]) await chup(s > 32 ? 'huy-hieu-tron' : 'huy-hieu-tron-nho', s, s, `huy-hieu-tron-${s}.png`);
for (const t of ['ngang-nen-toi', 'ngang-nen-sang', 'doc-nen-toi', 'doc-nen-sang']) { const [w, h] = co(t); await chup(t, 1800, Math.round(1800 * h / w), `${t}.png`); }
// luật nền lớn + ảnh đại diện = ảnh thật: bó báo Pexels (anh-nen/nguon.txt) dưới lớp mực, vẫn nhìn ra báo
const NEN = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(GOC, 'anh-nen/pe-27794812.jpg')).toString('base64');
const FONT = 'data:font/ttf;base64,' + fs.readFileSync(path.join(GOC, '../../../../public/fonts/Montserrat-ExtraBold.ttf')).toString('base64');
const lop = (a, c) => `<div style="position:absolute;inset:0;background:url(${NEN}) ${c} / cover;filter:grayscale(.7) contrast(1.05)"></div><div style="position:absolute;inset:0;background:${a}"></div>`;
const trang = async (W, H, than, ra) => {
  await p.setViewportSize({ width: W, height: H });
  await p.setContent(`<!doctype html><style>@font-face{font-family:M;src:url(${FONT})}</style><body style="margin:0"><div style="position:relative;width:${W}px;height:${H}px;overflow:hidden">${than}</div></body>`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(RB, ra) });
};
const CAU = 'HISTORY, REPORTED LIKE IT JUST HAPPENED';
await trang(800, 800, `${lop('rgba(16,19,28,.7)', '50% 45%')}<div style="position:absolute;left:125px;top:125px;width:550px;height:550px;filter:drop-shadow(0 10px 40px rgba(255,90,50,.35))">${svg('dau-chuyen-sac', 'width:100%;display:block')}</div>`, 'avatar-800.png');
await p.setContent(`<!doctype html><body style="margin:0;background:#f0f0f0"><img src="data:image/png;base64,${fs.readFileSync(path.join(RB, 'avatar-800.png')).toString('base64')}" style="display:block;width:800px;height:800px;border-radius:50%"></body>`);
await p.waitForTimeout(150);
await p.screenshot({ path: path.join(RB, 'avatar-soat-tron.png') });
// YouTube: vùng an toàn mọi thiết bị giữa 1546×423 (x 507–2053, y 508–931)
await trang(2560, 1440, `${lop('linear-gradient(180deg,rgba(16,19,28,.3),rgba(16,19,28,.86) 36%,rgba(16,19,28,.86) 64%,rgba(16,19,28,.3))', '50% 45%')}<div style="position:absolute;left:0;right:0;top:565px">${svg('ngang-nen-toi', 'width:1400px;display:block;margin:0 auto')}</div><div style="position:absolute;left:0;right:0;top:845px;text-align:center;font:400 34px M;letter-spacing:.2em;color:#f6f1e7cc">${CAU}</div>`, 'yt-banner-2560x1440.png');
// Facebook: vùng an toàn điện thoại x 300–1340 (trang-diem-page.mts)
await trang(1640, 624, `${lop('linear-gradient(90deg,rgba(16,19,28,.5),rgba(16,19,28,.86) 22%,rgba(16,19,28,.86) 78%,rgba(16,19,28,.5))', '50% 50%')}<div style="position:absolute;left:0;right:0;top:165px">${svg('ngang-nen-toi', 'width:920px;display:block;margin:0 auto')}</div><div style="position:absolute;left:0;right:0;top:405px;text-align:center;font:400 22px M;letter-spacing:.2em;color:#f6f1e7cc">${CAU}</div>`, 'fb-cover-1640x624.png');
// tờ thử: mọi dạng, mọi nền, mọi cỡ thật
const hop = (nen, t, c = 'max-height:190px;max-width:100%') => `<div style="background:${nen};border-radius:12px;padding:20px;display:flex;align-items:center;justify-content:center">${svg(t, c)}</div>`;
await p.setViewportSize({ width: 1500, height: 590 });
await p.setContent(`<!doctype html><meta charset=utf-8><body style="margin:0;background:#fff;padding:16px;display:grid;gap:12px">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${hop('#10131c', 'ngang-nen-toi')}${hop('#f6f1e7', 'ngang-nen-sang')}</div>
<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px">${hop('#10131c', 'doc-nen-toi')}${hop('#f6f1e7', 'doc-nen-sang')}${hop('#f6f1e7', 'dau-do-cho-nen-sang')}${hop('#fff', 'dau-muc')}${hop('#10131c', 'dau-kem')}${hop('#fff', 'huy-hieu-tron')}</div>
<div style="display:flex;gap:22px;align-items:end;padding:8px">${[96, 64, 48].map((s) => svg('huy-hieu-tron', `width:${s}px;height:${s}px`)).join('')}${[32, 24, 16].map((s) => svg('huy-hieu-tron-nho', `width:${s}px;height:${s}px`)).join('')}<span style="width:30px"></span>${[64, 48].map((s) => svg('dau-muc', `width:${s}px;height:${s}px`)).join('')}${[32, 24, 16].map((s) => svg('dau-muc-nho', `width:${s}px;height:${s}px`)).join('')}<span style="width:30px"></span>${[32, 24, 16].map((s) => svg('dau-muc', `width:${s}px;height:${s}px`)).join('')}<span style="font:13px Helvetica;color:#888">← cùng cỡ, bản thường để so</span></div></body>`);
await p.screenshot({ path: path.join(RA, 'bang-thu.png') });
await b.close();
console.log(fs.readdirSync(RA).length, 'tệp', path.join(RA));
