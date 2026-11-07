#!/usr/bin/env node
// BÌA CHUẨN KÊNH CÓ SỔ MÁY VIẾT (anh 07/11/2026: "Thumb phải chuẩn hoá để dùng"): tập → bìa 1080×1920 theo MỘT khuôn (brand/<kênh>/thumb.html), không dùng bìa YouTube tự sinh. 0đ, không AI, iMac.
// Chữ lấy từ dữ liệu tập (thẻ mở đầu), chủ thể: tranh / ảnh người của tập → ảnh Wikipedia chính người đó (anh-wiki.mjs) → nhân vật → lá số. nap-tap.mjs gọi rồi đưa vào de.thumb; Ngọc chấm bìa (xet-thumb.mts).
//   node thumb-kenh.mjs --tap <tập.json> --ra <bìa.jpg>
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { layAnhWiki } from './anh-wiki.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8')), arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const hoa = (s) => s[0].toUpperCase() + s.slice(1);
const soTu = (x) => String(x ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
/** chuẩn bìa của Phòng Nội dung: chữ to + chữ phụ ≤ 5 từ — tên dài cắt ở dấu phẩy, thừa thì bỏ chữ phụ. Thuần. */
export function gonChu({ lon, nho, ...r }) {
  const l = soTu(lon) > 5 ? String(lon).split(',')[0].trim() : lon;
  return { ...r, lon: l, nho: soTu(l) + soTu(nho) > 5 ? '' : nho };
}
/** chữ bìa từ dữ liệu tập. Thuần. */
export const chuBia = (tap) => gonChu(chuTho(tap));
function chuTho(tap) {
  const y = tap.y_tuong, the = tap.cau[0].the ?? {}, m = (re, s) => re.exec(s ?? '');
  if (/^ask-/.test(y)) { const a = m(/^(.+), (\d{4}): age (\d+)/, tap.cau.find((q) => /: age \d+/.test(q.chu))?.chu); return { lon: a?.[1] ?? the.duoi, nho: a ? `${a[2]} · age ${a[3]}` : '' }; }
  if (/^ryc-/.test(y)) { const t = m(/^ryc-([a-z]+)-/, y)[1]; return { lon: { asc: 'Your AC', mc: 'Your MC' }[t] ?? `Your ${hoa(t)}`, nho: 'explained' }; }
  // Sky Calendar: tên chuyện đã nằm trong tiêu đề, bìa lặp lại là Ngọc chặn → năm + loại sự kiện (thẻ ngày của tập)
  if (/^sc-/.test(y)) return { lon: the.lon, nho: tap.cau.find((q) => q.the?.dong?.length)?.the.dong[0] ?? 'sky history' };
  if (/^sx-/.test(y)) return { lon: the.duoi, nho: 'compatibility', ky: the.lon };   // không có người / nhân vật: hai ký hiệu cung lớn
  if (/^(my|tt)-/.test(y)) return { lon: String(the.lon).replace(/[\u2600-\u26FF\u2B00-\u2BFF\uFE0E]\s*/g, '').trim(), nho: 'the myth behind it' };
  return { lon: String(the.lon ?? tap.tieu_de).replace(/[☀-⛿︎]\s*/g, '').trim() || the.lon, nho: the.duoi ?? '' };
}
/** chủ thể bìa: { anh (đường tuyệt đối), vua (true = đặt gọn, không tràn), tac } */
async function chuThe(tap) {
  const tu = (p) => resolve(SHOT, p), y = tap.y_tuong, tranh = tap.cau.map((q) => q.nhin?.tranh).find(Boolean);
  if (tranh && !/^ask-/.test(y)) { const a = existsSync(join(DIR, 'troi-xua/_anh.json')) ? (doc('troi-xua/_anh.json')[y] ?? [])[0] : null; return { anh: tu(tranh), tac: a }; }
  const ai = tap.cau.flatMap((q) => q.vai ?? [])[0]?.ai; if (ai && tap.nv?.[ai]) return { anh: resolve(SHOT, tap.nv[ai], 'goc.png'), vua: true };
  const slug = /^ask-(.+)-\d{4}$/.exec(y)?.[1];
  if (slug) { const f = join(DIR, 'la-so/anh-nguoi.json'), kho = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}, n = doc('la-so/nguoi.json').nguoi.find((x) => x.slug === slug);
    if (!kho[`cc-${slug}`]?.length) { kho[`cc-${slug}`] = await layAnhWiki([n.wiki ?? n.ten], { ma: `cc-${slug}`, toiDa: 3 }); writeFileSync(f, JSON.stringify(kho, null, 1) + '\n'); }
    const a = kho[`cc-${slug}`][0]; if (a) return { anh: join(DIR, a.tep), tac: a }; }
  if (tranh) return { anh: tu(tranh) };
  if (tap.la_so && !tap.chi_vong) return { anh: tu(tap.la_so), vua: true };
  return {};
}
export async function dungBia(tap, ra) {
  const PW = process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`, { chromium } = createRequire(import.meta.url)(PW);
  const c = chuBia(tap), t = await chuThe(tap), tr = await chromium.launch(), p = await tr.newPage({ viewport: { width: 1080, height: 1920 } });
  try {
    await p.goto(pathToFileURL(join(DIR, `brand/${tap.kenh}/thumb.html`)).href); await p.waitForFunction(() => window.__xong);
    const u = (x) => pathToFileURL(x).href;
    await p.evaluate(window_ve, { nen: u(resolve(SHOT, tap.nen)), anh: t.anh ? u(t.anh) : null, vua: !!t.vua, lon: c.lon, nho: c.nho, ky: c.ky ?? null, chip: tap.playlist.ten, mau: tap.playlist.mau });
    await p.screenshot({ path: ra, type: 'jpeg', quality: 86 });
  } finally { await tr.close(); }
  return { chu: `${c.lon}${c.nho ? ` · ${c.nho}` : ''}`, tac: t.tac ?? null };
}
const window_ve = (d) => window.__ve(d);
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tep = arg('tap'), ra = arg('ra'); if (!tep || !ra) { console.error('dùng: --tap <tập.json> --ra <bìa.jpg>'); process.exit(2); }
  console.log(JSON.stringify(await dungBia(JSON.parse(readFileSync(resolve(tep), 'utf8')), resolve(ra))));
}
