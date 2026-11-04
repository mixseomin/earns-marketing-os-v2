#!/usr/bin/env node
// SỔ CÔNG CỤ ASTROLAS (anh 05/11/2026: "khi đăng bài về 1 tool … phải kèm mô tả và link cụ thể đến đúng page đó · mọi thứ phải đúng với mô tả trong tool của
// astrolas, cấm bịa"). Mỗi công cụ: đường dẫn trang, tên + MÔ TẢ NGUYÊN VĂN của site, các tham số GET để dựng link mở thẳng kết quả cho đúng người / cặp.
// Nguồn mô tả theo thứ tự: dòng nhỏ dưới tên công cụ trong menu Tools của site → câu hướng dẫn đầu trang công cụ → meta description (bỏ câu chung của cả site).
// Máy viết bài + máy gác (kiem-so-kenh.mjs) chỉ lấy mô tả / link từ tệp này. 0đ, fetch.   node so-cong-cu.mjs  → cong-cu/so-cong-cu.json
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), SITE = 'https://astrolas.com';
const TRANG = ['birth', 'compatibility', 'synastry-chart', 'today', 'transit', 'moon-phase', 'annual-profections-v1', 'tools/daily-profections', 'tools/zodiacal-releasing',
  'solar-return-v1', 'tools/lunar-return-v1', 'progression', 'solar-arc', 'tools/lunation-analyzer', 'tools/diurnal-chart', 'tools/horary-chart'];
const CHUNG = 'Free birth chart, solar arc, midpoints, and AI chart reader.';   // meta description dùng chung nhiều trang — không phải mô tả công cụ
const giaiMa = (s) => s.replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const chu = (h) => giaiMa(h.replace(/<(svg|style|script)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const lay = async (p) => (await fetch(`${SITE}/${p}`, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) astrolas-studio' } })).text();

const menu = new Map();   // đường dẫn → { ten, mo_ta } từ menu Tools (có <small>)
for (const m of (await lay('')).matchAll(/<a[^>]*href="https:\/\/astrolas\.com\/([^"#?]*)"[^>]*>([\s\S]{0,700}?)<\/a>/g)) {
  const sm = /<small>([^<]*)<\/small>/.exec(m[2]); if (!sm) continue;
  menu.set(m[1], { ten: chu(m[2].replace(sm[0], '')).replace(/\s*›$/, ''), mo_ta: giaiMa(sm[1]).trim() });
}
const ra = [];
for (const p of TRANG) {
  const h = await lay(p), tieuDe = giaiMa(/<title>([^<]*)/.exec(h)?.[1] ?? '').replace(/\s*[—-]\s*Astrolas.*$/, '').trim();
  const meta = giaiMa(/<meta name="description" content="([^"]*)"/.exec(h)?.[1] ?? ''), huongDanTho = chu(/<div class="form-box"[^>]*>([\s\S]*?)<\/div>/.exec(h)?.[1] ?? '');
  const huongDan = /^Enter .{10,200}\.$/.test(huongDanTho) ? huongDanTho : '';   // câu hướng dẫn của site luôn dạng "Enter birth data and …"; khối form khác = nút / mã
  const mo_ta = menu.get(p)?.mo_ta || huongDan || (meta.startsWith(CHUNG) ? '' : meta);
  const tham = [...new Set([...h.matchAll(/<(?:input|select)[^>]*name="([a-z_0-9]+)"/g)].map((x) => x[1]))].filter((x) => !['q', 'website', 'ufb-kind', '_token'].includes(x));
  ra.push({ ma: p.replace(/^tools\//, '').replace(/-v1$/, ''), url: `${SITE}/${p}`, ten: menu.get(p)?.ten || tieuDe, mo_ta, nguon_mo_ta: menu.has(p) ? 'menu Tools' : huongDan ? 'câu hướng dẫn đầu trang' : 'meta description', tham });
}
writeFileSync(join(DIR, 'so-cong-cu.json'), JSON.stringify({ _ghi: 'Sổ công cụ astrolas.com (lich-su/cong-cu/so-cong-cu.mjs — đừng sửa tay). mo_ta = chữ NGUYÊN VĂN của site; tham = tham số GET dựng link mở thẳng kết quả.', lay_luc: new Date().toISOString().slice(0, 10), cong_cu: ra }, null, 1) + '\n');
for (const c of ra) console.log(`${c.mo_ta ? '✓' : '✗'} ${c.ma.padEnd(20)} ${c.ten} · "${c.mo_ta || '(site chưa có mô tả riêng)'}" · ${c.nguon_mo_ta}`);
process.exit(ra.some((c) => !c.mo_ta) ? 1 : 0);
