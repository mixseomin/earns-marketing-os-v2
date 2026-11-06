#!/usr/bin/env node
// ĐỌC TRANG ANNUAL PROFECTIONS THẬT của astrolas.com cho một người + một năm (G5 Ask the Chart, 05/11/2026): số liệu VÀ chữ đều lấy từ trang công cụ,
// máy viết không tự tính, không tự đặt nghĩa. Một lượt = mở link mở thẳng kết quả (nguon-site.mjs › linkCongCu, year_target) → đọc chữ trên trang →
// chụp cả trang khổ điện thoại (giống chup.mjs) + đo khung → cong-cu/ap/<người>-<năm>.json (+ .png, ảnh dựng lại được nên không commit).
//   { nguon, tuoi, nam, nha, cung, nghia_nha, chu_nam, vi_tri, nha_chu, chu_de, nha_chu_nghia, chu: [câu nguyên văn trang], rong, cao, khung: { tuoi, banh, nha, chu-nam, chu-de } }
//   node doc-ap.mjs <slug> <năm> [<slug> <năm> …]      · 0đ, chạy iMac (box cấm trình duyệt). Trang đổi khuôn, thiếu ô nào → DỪNG (mã 3), không đoán.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkCongCu } from '../nguon-site.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), AP = join(DIR, 'ap'), TL = 2;
export const tepAp = (slug, nam) => join(AP, `${slug}-${nam}.json`);

/** đọc nhiều (người, năm) trong MỘT trình duyệt; bỏ qua cặp đã có tệp trừ khi lai = true. Trả danh sách lỗi (rỗng = đạt). */
export async function docAp(ds, { lai = false } = {}) {
  const can = ds.filter(({ slug, nam }) => lai || !existsSync(tepAp(slug, nam))); if (!can.length) return [];
  const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`;
  let chromium; try { ({ chromium } = createRequire(import.meta.url)(PW)); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
  mkdirSync(AP, { recursive: true });
  const tr = await chromium.launch(), loi = [];
  try {
    for (const { slug, nam } of can) {
      const url = linkCongCu('annual-profections', slug, { year_target: nam }), p = await tr.newPage({ viewport: { width: 540, height: 1100 }, deviceScaleFactor: TL });
      try {
        await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
        await p.evaluate(() => { [...document.querySelectorAll('button, a')].find((e) => /^got it!?$/i.test(e.textContent.trim()))?.click(); });
        await p.waitForTimeout(2500);
        await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const v = getComputedStyle(e).position; if (v === 'fixed' || v === 'sticky') e.style.setProperty('display', 'none', 'important'); } });
        await p.waitForTimeout(300);
        const r = await p.evaluate(({ nam }) => {
          const t = document.body.innerText, m = (re) => re.exec(t);
          const dau = m(new RegExp(`Annual Profections ${nam} · Age (\\d+)`)), nha = m(/\n(\d{4})\nAge (\d+)\nHouse\n(\d+)\n\S+ (\w+)\n+([^\n]+)\n/);
          const chu = m(/Lord of the Year\n(?:[^\n]*\n){0,3}?(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn)\n\S+ (\w+ \d+°\d+')\nH(\d+)\n+Theme: ([^\n]+)\n/);
          const hc = chu && m(new RegExp(`House ${chu[3]}\\nHouse of the ruling planet\\n([^\\n]+)\\n`));
          if (!dau || !nha || !chu) return { thieu: [!dau && 'tuổi', !nha && 'nhà của năm', !chu && 'chủ năm'].filter(Boolean) };
          // khung: phần tử NHỎ NHẤT còn hiện mà chữ khớp (giống chup.mjs), cha = số tầng bọc ngoài
          const tim = (re, cha = 0) => { let el = [...document.querySelectorAll('body *')].filter((e) => e.offsetParent !== null && re.test(e.innerText || '')).sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
            if (!el) return null; for (let i = 0; i < cha && el.parentElement; i++) el = el.parentElement; const b = el.getBoundingClientRect();
            return [b.left - 8, b.top + window.scrollY - 8, b.width + 16, b.height + 16].map(Math.round); };
          const khung = { tuoi: tim(new RegExp(`Annual Profections ${nam}[\\s\\S]{0,40}Age\\s*${dau[1]}`)), banh: tim(new RegExp(`^\\s*Annual profection chart ${nam}`), 1),
            nha: tim(new RegExp(`House\\s*${nha[3]}[\\s\\S]{0,30}${nha[4]}`), 1), 'chu-nam': tim(/^\s*Lord of the Year\s*$/, 1), 'chu-de': tim(/^\s*Theme:/, 1) };   // nhỏ nhất khớp là nhãn "Theme:" — lên 1 tầng = cả đoạn
          const thieuK = Object.entries(khung).filter(([, v]) => !v).map(([k]) => `khung ${k}`); if (thieuK.length) return { thieu: thieuK };
          return { tuoi: +dau[1], nha: +nha[3], cung: nha[4], nghia_nha: nha[5].trim(), chu_nam: chu[1], vi_tri: chu[2], nha_chu: +chu[3], chu_de: chu[4].trim(), nha_chu_nghia: hc?.[1]?.trim() ?? null, khung, cao: document.documentElement.scrollHeight };
        }, { nam });
        if (r.thieu) { loi.push(`${slug} ${nam}: trang không có ${r.thieu.join(', ')} — trang đổi khuôn? (${url})`); continue; }
        await p.screenshot({ path: tepAp(slug, nam).replace(/\.json$/, '.png'), fullPage: true });
        const { khung, cao, ...du } = r;
        writeFileSync(tepAp(slug, nam), JSON.stringify({ nguon: url, doc_luc: new Date().toISOString(), nam, ...du,
          chu: [du.nghia_nha, `Theme: ${du.chu_de}`, du.nha_chu_nghia].filter(Boolean),   // câu NGUYÊN VĂN trang (khoChuSite nạp khi tập khai nguon_cong_cu)
          rong: 540 * TL, cao: cao * TL, khung: Object.fromEntries(Object.entries(khung).map(([k, v]) => [k, v.map((x) => x * TL)])) }, null, 1) + '\n');
        console.log(`✓ ${slug} ${nam}: tuổi ${r.tuoi} · nhà ${r.nha} ${r.cung} · chủ năm ${r.chu_nam} H${r.nha_chu}`);
      } finally { await p.close(); }
    }
  } finally { await tr.close(); }
  return loi;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2).filter((x) => x !== '--lai'), ds = [];
  for (let i = 0; i + 1 < a.length; i += 2) ds.push({ slug: a[i], nam: +a[i + 1] });
  if (!ds.length) { console.error('dùng: node doc-ap.mjs <slug> <năm> [<slug> <năm> …] [--lai]'); process.exit(2); }
  const loi = await docAp(ds, { lai: process.argv.includes('--lai') }); for (const l of loi) console.error(`✗ ${l}`); process.exit(loi.length ? 3 : 0);
}
