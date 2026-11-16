#!/usr/bin/env node
// BÀI VIẾT ASTROLAS CHO SUBSTACK / MEDIUM (anh 16/11/2026 "làm cả 3" — mở rộng nền đăng): đăng lại NGUYÊN VĂN một bài blog của astrolas.com
// (la-so/bai/<bài>.json, máy đã tải từ site) — 0đ, không AI, không bịa: chữ là chữ site, ảnh là ảnh bìa của chính bài (og:image trên astrolas.com),
// cuối bài ghi rõ bài gốc + link về site (UTM). Nạp qua đường chung puzzle-books nap-bai.mjs › napBai → Phòng Nội dung chấm → máy đăng tự đăng lên
// mọi nền bài viết của máy astrolas (xv_may.dang: substack / medium). Mỗi bài site chỉ nạp MỘT lần (slug bai-<tiêu đề> đã có trong sổ máy thì bỏ).
//   node lich-su/bai-site.mjs [--so 1] [--bai <tên tệp, vd aspects-explained>] [--xem]      --xem: in bài sẽ nạp, không nạp
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), BAI = join(DIR, 'la-so/bai'), NAP = '/Users/htuan/puzzle-books/scripts/nap-bai.mjs';
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const thoat = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** slug bài nạp — cùng công thức nap-bai.mjs › slugTu (bai-<8 chữ đầu tiêu đề>). Thuần. */
export const slugBai = (t) => `bai-${String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 8).join('-')}`;
/** HTML bài đăng lại từ bài site đã tải: <h1> tiêu đề · <em> câu mở · ảnh bìa · đoạn mở + từng mục (<h2>) nguyên văn · mục hỏi đáp ghép câu hỏi ·
 *  cuối bài: "Originally published on Astrolas" + link có UTM (link chữ thuần để nap-bai lấy làm link đích). Thuần. */
export function htmlBai(b, anh, slug) {
  const doan = (b.mo ?? []).filter((x) => x.length > 120 && !/\?$/.test(x.trim())), hoi = (b.mo ?? []).filter((x) => /\?$/.test(x.trim()));
  const link = `${b.url}?utm_source=syndication&utm_medium=bai&utm_campaign=${slug}`, mo = doan[0]?.split(/(?<=[.!?])\s+/)[0] ?? '';
  const muc = (b.muc ?? []).map((m) => /questions people ask/i.test(m.ten)
    ? `<h2>${thoat(m.ten)}</h2>${m.doan.map((d, i) => `${hoi[i] ? `<h3>${thoat(hoi[i])}</h3>` : ''}<p>${thoat(d)}</p>`).join('')}`
    : `<h2>${thoat(m.ten)}</h2>${m.doan.map((d) => `<p>${thoat(d)}</p>`).join('')}`).join('\n');
  return `<article><h1>${thoat(b.tieu_de)}</h1><p><em>${thoat(mo)}</em></p>${anh ? `<p><img src="${anh}" alt="${thoat(b.tieu_de)}"></p>` : ''}\n`
    + `${doan.map((d) => `<p>${thoat(d)}</p>`).join('\n')}\n${muc}\n`
    + `<p>Originally published on Astrolas: <a href="${link}">${link}</a> — the birth chart, transits and every chart tool there are free.</p></article>`;
}
/** ảnh bìa của bài trên astrolas.com (og:image) — ảnh thật của site; không đọc được thì null (Phòng Nội dung chặn bài không ảnh). */
async function anhBia(url) { try { const h = await (await fetch(url, { signal: AbortSignal.timeout(20_000) })).text(); return h.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? null; } catch { return null; } }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--tu-kiem')) {
    const { strict: t } = await import('node:assert');
    t.equal(slugBai("Angelina Jolie's natal chart: a humanitarian pull"), 'bai-angelina-jolie-s-natal-chart-a-humanitarian-pull');
    const h = htmlBai({ url: 'https://astrolas.com/en/blog/x', tieu_de: 'T <x>', mo: ['Heading', 'What is it?', `${'A'.repeat(130)}. Second.`], muc: [{ ten: 'S1', doan: ['p1'] }, { ten: 'Questions people ask', doan: ['ans'] }] }, 'https://img/a.jpg', 'bai-t');
    t.ok(h.includes('<h1>T &lt;x&gt;</h1>') && h.includes('<img src="https://img/a.jpg"') && h.includes('<h3>What is it?</h3><p>ans</p>') && !h.includes('<p>Heading</p>'));
    t.ok(/https:\/\/astrolas\.com\/en\/blog\/x\?utm_source=syndication&utm_medium=bai&utm_campaign=bai-t/.test(h), 'link về bài gốc có UTM');
    console.log('bai-site: tự kiểm đạt'); process.exit(0);
  }
  const { sqlBox } = await import('./box3.mjs');
  const da = new Set(sqlBox(`SELECT coalesce(string_agg(v.slug, ','), '') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = 'astrolas' AND v.slug LIKE 'bai-%';`).trim().split(',').filter(Boolean));
  // thứ tự: bài giải thích / hướng dẫn trước (mọi người đọc), bài lá số người nổi tiếng sau
  const tep = readdirSync(BAI).filter((f) => f.endsWith('.json')).sort((a, b) => Number(/-birth-chart\.json$/.test(a)) - Number(/-birth-chart\.json$/.test(b)) || a.localeCompare(b));
  const chon = (arg('bai') ? tep.filter((f) => f === `${arg('bai')}.json`) : tep).map((f) => ({ f, b: JSON.parse(readFileSync(join(BAI, f), 'utf8')) }))
    .filter(({ b }) => b.url && b.tieu_de && !da.has(slugBai(b.tieu_de))).slice(0, Number(arg('so', 1)));
  if (!chon.length) { console.log('· hết bài site chưa nạp'); process.exit(0); }
  const { napBai } = await import(NAP), { chonHook } = await import('./hook-kenh.mjs');
  for (const { f, b } of chon) {
    const slug = slugBai(b.tieu_de), anh = await anhBia(b.url), html = htmlBai(b, anh, slug);
    if (!anh) { console.log(`✗ ${f}: không đọc được ảnh bìa trên ${b.url} — bỏ`); continue; }
    if (process.argv.includes('--xem')) { console.log(`→ ${slug} · ${html.replace(/<[^>]+>/g, ' ').split(/\s+/).length} từ · ảnh ${anh}`); continue; }
    const { goc } = chonHook('astrolas', 'know-yourself', slug);
    napBai({ may: 'astrolas', tep: `${slug}.html`, noiDung: html, goc, slug, anh });
  }
}
