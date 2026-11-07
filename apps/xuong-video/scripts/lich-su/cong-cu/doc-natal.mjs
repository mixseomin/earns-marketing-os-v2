#!/usr/bin/env node
// ĐỌC TRANG LÁ SỐ THẬT của astrolas.com cho một người (G5 Read Your Chart, 06/11/2026): số liệu từng dòng lấy từ trang, máy viết không tự tính.
// Mở link mở thẳng kết quả (nguon-site.mjs › linkCongCu 'birth') → đọc bảng góc + bảng sao → chụp cả trang khổ điện thoại (giống chup.mjs, doc-ap.mjs) + đo khung
// → cong-cu/natal/<người>.json { nguon, goc: { Ascendant: { do }, MC: { do } }, sao: { Sun: { do, nha, nghich } … }, rong, cao, khung: { angles, planets, Ascendant, MC, Sun … } } (+ .png, dựng lại được nên không commit).
//   node doc-natal.mjs <slug> [slug…] [--lai]   · 0đ, chạy iMac. Trang đổi khuôn, thiếu ô nào → báo lỗi, không đoán.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkCongCu } from '../nguon-site.mjs';
import { layChromium, moTrangCongCu, TI_LE as TL } from './trinh-duyet.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), NATAL = join(DIR, 'natal');
export const tepNatal = (slug) => join(NATAL, `${slug}.json`);
export const SAO = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

export async function docNatal(ds, { lai = false } = {}) {
  const can = ds.filter((s) => lai || !existsSync(tepNatal(s))); if (!can.length) return [];
  mkdirSync(NATAL, { recursive: true });
  const tr = await layChromium().launch(), loi = [];
  try {
    for (const slug of can) {
      const url = linkCongCu('birth', slug), p = await moTrangCongCu(tr, url);
      try {
        const r = await p.evaluate(({ SAO }) => {
          const t = document.body.innerText, dau = t.indexOf('Angle coordinates'), bang = t.indexOf('Planet positions'); if (dau < 0 || bang < 0) return { thieu: ['bảng góc / bảng sao'] };
          const goc = {}, sao = {}, thieu = [];
          for (const g of ['Ascendant', 'MC']) { const m = new RegExp(`${g}\\s+(\\d+°\\d+')`).exec(t.slice(dau)); if (m) goc[g] = { do: m[1] }; else thieu.push(g); }
          for (const s of SAO) { const m = new RegExp(`\\n${s}\\s+(R\\s+)?\\S+ (\\d+°\\d+')\\s+(\\d+)`).exec(t.slice(bang)); if (m) sao[s] = { do: m[2], nha: +m[3], nghich: !!m[1] }; else thieu.push(s); }
          if (thieu.length) return { thieu };
          const tim = window.__tim;
          const khung = { angles: tim(/^\s*Angle coordinates/, 2), planets: tim(/^\s*Planet positions/, 2) };
          for (const [g, v] of Object.entries(goc)) khung[g] = tim(new RegExp(`${g}[\\s\\S]{0,30}${v.do}`));
          for (const [s, v] of Object.entries(sao)) khung[s] = tim(new RegExp(`^\\s*.?\\s*${s}[\\s\\S]{0,40}${v.do}`));
          const thieuK = Object.entries(khung).filter(([, v]) => !v).map(([k]) => `khung ${k}`); if (thieuK.length) return { thieu: thieuK };
          return { goc, sao, khung, cao: document.documentElement.scrollHeight };
        }, { SAO });
        if (r.thieu) { loi.push(`${slug}: trang không có ${r.thieu.join(', ')} (${url})`); continue; }
        await p.screenshot({ path: tepNatal(slug).replace(/\.json$/, '.png'), fullPage: true });
        writeFileSync(tepNatal(slug), JSON.stringify({ nguon: url, doc_luc: new Date().toISOString(), goc: r.goc, sao: r.sao, rong: 540 * TL, cao: r.cao * TL,
          khung: Object.fromEntries(Object.entries(r.khung).map(([k, v]) => [k, v.map((x) => x * TL)])) }, null, 1) + '\n');
        console.log(`✓ ${slug}: AC ${r.goc.Ascendant.do} · MC ${r.goc.MC.do} · ${Object.keys(r.sao).length} sao`);
      } finally { await p.close(); }
    }
  } finally { await tr.close(); }
  return loi;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ds = process.argv.slice(2).filter((x) => !x.startsWith('--')); if (!ds.length) { console.error('dùng: node doc-natal.mjs <slug> [slug…] [--lai]'); process.exit(2); }
  const loi = await docNatal(ds, { lai: process.argv.includes('--lai') }); for (const l of loi) console.error(`✗ ${l}`); process.exit(loi.length ? 3 : 0);
}
