#!/usr/bin/env node
// MÁY VIẾT "CHART TOOLS" (G5 kênh Astrolas, 08/11/2026 — mẫu đã duyệt G3, trước đây kịch bản tay): một công cụ có bài giải thích trên astrolas.com × một người
// hạng AA → một Short 9:16 cho shot-code/la-so.html (khuôn demo mau-cong-cu.json). 0đ, không AI, iMac (chụp trang kết quả bằng trình duyệt — box cấm).
// Chữ: tiêu đề + câu giải thích NGUYÊN VĂN của bài site (la-so/bai/<bài>.json, BAI_CONG_CU dưới đây) · hình: lá số site của người đó, rồi trang kết quả công cụ
// mở thẳng cho người đó (cong-cu/chup.mjs) · câu dẫn / kết là câu khung · hook = dòng đầu QC spy góc Career qua bộ chọn chung.
//   node viet-chart-tools.mjs --y ct-<công cụ>--<người> [--xem]     · node viet-chart-tools.mjs --ds   (mọi mã dùng được: công cụ × người AA)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SO_CONG_CU, linkCongCu, dangCongCu } from './nguon-site.mjs';
import { tachCanh } from './chu-man.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { chonHook } from './hook-kenh.mjs';
import { nhanPlaylist } from './viet-chung.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), CC = join(DIR, 'cong-cu'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const PL = 'career';
/** công cụ một người có bài giải thích của site (bài nguồn chữ). Thêm công cụ = thêm một dòng khi site có bài. */
export const BAI_CONG_CU = { 'annual-profections': 'annual-profections-explained', 'zodiacal-releasing': 'how-to-use-the-zodiacal-releasing-tool', transit: 'transits-explained',
  'solar-return': 'solar-return-your-birthday-chart', birth: 'how-to-read-your-birth-chart-in-10-steps' };

/** câu giải thích của bài site: câu đầu mỗi mục, 40–200 ký tự, không dừng ở ":" (câu dẫn tới bảng / trích dẫn), tối đa n câu. Thuần. */
export function cauGiai(bai, n = 3) {
  const ra = [];
  for (const m of bai.muc ?? []) { const c = String(m.doan?.[0] ?? '').split(/(?<=[.!?])\s+/)[0]?.trim();   // câu đầu của ĐOẠN đầu — không nối đoạn (nối thì ra câu site không có)
    if (c && c.length >= 40 && c.length <= 200 && !c.includes(':') && !/\?$/.test(c) && !/^(Open|Click|Enter|Tap|Use|Go|Type|Pick|Choose|Select)\b/.test(c)) ra.push({ chu: c, nhan: m.ten }); if (ra.length >= n) break; }   // bỏ câu hướng dẫn bấm nút (không phải lời giải thích)
  return ra;
}
/** người dùng được: hạng AA, không khong_dung, có lá số + bài lá số site. */
const nguoiDung = () => doc('la-so/nguoi.json').nguoi.filter((n) => n.rodden === 'AA' && !n.khong_dung && existsSync(join(DIR, `la-so/${n.slug}.json`)) && existsSync(join(DIR, `la-so/bai/${n.slug}-birth-chart.json`)));
export const dsMa = () => Object.keys(BAI_CONG_CU).filter((c) => existsSync(join(DIR, `la-so/bai/${BAI_CONG_CU[c]}.json`))).flatMap((c) => nguoiDung().map((n) => `ct-${c}--${n.slug}`));

export function vietMot(y, { xem = false } = {}) {
  const m = /^ct-([a-z-]+)--([a-z0-9-]+)$/.exec(y); if (!m) return { loi: `mã lạ ${y} (ct-<công cụ>--<người>)` };
  const [, ma, slug] = m, c = SO_CONG_CU().find((x) => x.ma === ma), n = nguoiDung().find((x) => x.slug === slug);
  if (!c || !BAI_CONG_CU[ma]) return { loi: `công cụ ${ma} không có bài giải thích trong BAI_CONG_CU` };
  if (!n) return { loi: `${slug} không dùng được (cần AA + lá số + bài lá số site)` };
  const bai = doc(`la-so/bai/${BAI_CONG_CU[ma]}.json`), giai = cauGiai(bai); if (giai.length < 2) return { loi: `bài ${BAI_CONG_CU[ma]} không đủ câu giải thích` };
  const ket = `ct-${ma}--${slug}-ket`;
  if (!xem && !existsSync(join(CC, `${ket}.png`))) {
    const chup = (k) => { const spec = join(CC, `spec-${ket}.json`); writeFileSync(spec, JSON.stringify([{ ten: ket, url: linkCongCu(ma, slug), cho: 4000, khung: { ket: k } }], null, 1));
      execFileSync(process.execPath, [join(CC, 'chup.mjs'), spec], { cwd: CC, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5 * 60_000 }); };
    try { try { chup({ css: 'svg:has([data-layer])' }); } catch { chup({ css: 'body' }); } }
    catch (e) { return { loi: `chụp trang hỏng: ${String(e.stderr || e.stdout || e.message).trim().split('\n').pop().slice(0, 200)}` }; }
  }
  const so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === PL), { hook, chuHook, goc } = chonHook('astrolas', PL, y), tg = (p) => relative(SHOT, join(DIR, p));
  const cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: c.ten, duoi: `with ${n.ten}`, dong: [], vi: 'giua' } },
    { nhin: { dung: 1 }, khung: true, chu: `This is ${n.ten}'s birth chart.`, nhan: n.ten },
    ...giai.map((g) => ({ nhin: { toan: 1 }, chu: `“${g.chu}”`, nhan: `astrolas.com · ${c.ten}` })),   // nhãn = tên công cụ (tên mục bài dạng câu hỏi bị máy gác coi là lời không nguồn)
    { nhin: { man: relative(SHOT, join(CC, `${ket}.png`)), khung: 'ket' }, khung: true, chu: `${c.ten} for ${n.ten}, on astrolas.com.`, nhan: c.ten },
    { nhin: { troi: 1 }, khung: true, chu: `Run it on your own chart<br>free at astrolas.com.` },
  ];
  const tieuDe = `${chuHook} ${c.ten}, explained with ${n.ten}'s chart`;
  const tap = tachCanh({ _ghi: `Chart Tools · ${c.ten} × ${n.ten} — sinh bởi lich-su/viet-chart-tools.mjs (bài site ${BAI_CONG_CU[ma]}, trang công cụ chụp thật, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'chart-tools', playlist_ma: PL, y_tuong: y, tieu_de: tieuDe, goc, hook: { qc: hook.id, goc: hook.chu }, nguon_bai: [BAI_CONG_CU[ma]],
    dang: dangCongCu(ma, slug, {}, `${bai.tieu_de}: explained with ${n.ten}'s chart.`), la_so: tg(`la-so/${slug}.svg`), nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'), playlist: nhanPlaylist(pl),
    cau: cau.map((q) => ({ ...q, tu: 0, den: 0 })), DAI: 0 });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) return { loi: loi.join(' · ') };
  if (!xem) { const ra = join(SHOT, 'tap-astrolas', `${y}.json`); mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n'); }
  return { tap };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--tu-kiem')) {
    const { strict: a } = await import('node:assert');
    const g = cauGiai({ muc: [{ ten: 'A', doan: ['Your first year of life belongs to the 1st house. Then more.'] }, { ten: 'B', doan: ['A few landmarks from the table:'] }, { ten: 'C', doan: ['Short.'] }, { ten: 'D', doan: ['Each house begins with a sign, and each sign has a ruler in the traditional scheme.'] }] });
    a.deepEqual(g.map((x) => x.nhan), ['A', 'D'], 'bỏ câu dẫn ":" và câu quá ngắn');
    console.log('viet-chart-tools: tự kiểm đạt'); process.exit(0);
  }
  if (process.argv.includes('--ds')) { console.log(JSON.stringify(dsMa())); process.exit(0); }
  const y = arg('y'); if (!y) { console.error('dùng: --y ct-<công cụ>--<người> [--xem] | --ds'); process.exit(2); }
  const r = vietMot(y, { xem: process.argv.includes('--xem') });
  if (r.loi) { console.log(`✗ ${y}: ${r.loi}`); process.exit(1); }
  console.log(`✓ ${y} · ${r.tap.cau.length} câu · ${r.tap.DAI}s · ${r.tap.tieu_de}`); process.exit(0);
}
