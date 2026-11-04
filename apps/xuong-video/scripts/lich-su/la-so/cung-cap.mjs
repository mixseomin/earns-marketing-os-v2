#!/usr/bin/env node
// SIGN × SIGN (Astrolas, 05/11/2026 — mảng synastry): 78 bài ghép cung Mặt Trời của site astrolas.com/en/blog/<a>-and-<b>-compatibility (đủ 12 × 13 / 2 cặp, kể cả cùng cung)
// → la-so/cung-cap.json: mỗi cặp các mục của bài (The core dynamic · Where it clicks · Where it clashes · How to make it work · Questions people ask…) NGUYÊN VĂN.
// Máy viết kịch bản Short Sign × Sign chỉ lấy câu trong đây (luật 2 sổ kênh: số / chữ chiêm tinh chỉ từ astrolas.com). Lấy bằng fetch, 0đ.
//   node cung-cap.mjs            (thiếu bài nào / bài đổi khuôn → mã 1, vẫn ghi phần đã lấy)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), SITE = 'https://astrolas.com';
const CUNG = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const giaiMa = (s) => s.replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const chu = (h) => giaiMa(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** một bài → { tieu_de, mo, muc: [{ ten, doan: [] }] } — đoạn mở đầu trước h2 đầu tiên, rồi từng h2 với các <p> / <li> của nó. Thuần. */
export function tachBai(h) {
  const a = /<article[\s\S]*?<\/article>/.exec(h)?.[0]; if (!a) return null;
  const sach = a.replace(/<(script|style|figure|nav)[\s\S]*?<\/\1>/g, '');
  const tieu_de = chu(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(h)?.[1] ?? '');
  const khoi = sach.split(/<h2[^>]*>/), doan = (x) => [...x.matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => chu(m[2])).filter((t) => t.length > 20 && !/^A live chart drawn by Astrolas/.test(t));
  return { tieu_de, mo: doan(khoi[0]), muc: khoi.slice(1).map((k) => { const [ten, ...con] = k.split(/<\/h2>/); return { ten: chu(ten), doan: doan(con.join('')) }; }).filter((m) => m.doan.length) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cap = []; for (let i = 0; i < 12; i++) for (let j = i; j < 12; j++) cap.push([CUNG[i], CUNG[j]]);
  const ra = [], thieu = [];
  for (let k = 0; k < cap.length; k += 6) await Promise.all(cap.slice(k, k + 6).map(async ([a, b]) => {
    const url = `${SITE}/en/blog/${a}-and-${b}-compatibility`, r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) astrolas-studio' } });
    const bai = r.ok ? tachBai(await r.text()) : null;
    if (!bai || bai.muc.length < 3) { thieu.push(`${a}-${b} (${r.status}${bai ? `, ${bai.muc.length} mục` : ''})`); return; }
    ra.push({ ma: `sx-${a}-${b}`, a, b, url, ...bai, so_chu: [...bai.mo, ...bai.muc.flatMap((m) => m.doan)].join(' ').split(' ').length });
  }));
  ra.sort((x, y) => CUNG.indexOf(x.a) - CUNG.indexOf(y.a) || CUNG.indexOf(x.b) - CUNG.indexOf(y.b));
  writeFileSync(join(DIR, 'cung-cap.json'), JSON.stringify({ _ghi: 'Bài ghép cung của astrolas.com, nguyên văn (la-so/cung-cap.mjs — đừng sửa tay, chạy lại lệnh).', lay_luc: new Date().toISOString().slice(0, 10), cap: ra }, null, 1) + '\n');
  const muc = new Map(); for (const x of ra) for (const m of x.muc) muc.set(m.ten.replace(/^(Is|Will|Why|How|Do|Can|Are|What)\b.*/, '(câu hỏi)'), (muc.get(m.ten.replace(/^(Is|Will|Why|How|Do|Can|Are|What)\b.*/, '(câu hỏi)')) ?? 0) + 1);
  console.log(`${thieu.length ? '✗' : '✓'} cung-cap.json · ${ra.length}/78 cặp · trung bình ${Math.round(ra.reduce((s, x) => s + x.so_chu, 0) / Math.max(1, ra.length))} chữ / bài`);
  console.log(`   mục hay gặp: ${[...muc].sort((x, y) => y[1] - x[1]).slice(0, 10).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  if (thieu.length) console.log(`   thiếu: ${thieu.join(', ')}`);
  process.exit(thieu.length ? 1 : 0);
}
