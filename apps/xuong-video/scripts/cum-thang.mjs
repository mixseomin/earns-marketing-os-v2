#!/usr/bin/env node
// CỤM TỪ THẮNG TRONG QC SPY (anh 11/11/2026: "Có cách nào tìm thêm loại trick tương tự với chữ free trong content ko ?" — sau khi Reel Mia có chữ FREE
// được 236 lượt phát so với 22). Kho spy (qc_meta, QC Meta đã cào) có ngày chạy của từng QC: QC chạy ≥ 30 ngày = nhà quảng cáo còn trả tiền = đang thắng,
// QC tắt trong ≤ 7 ngày = thua. Cụm từ nào xuất hiện ở nhóm thắng nhiều hơn hẳn nhóm thua là "trick" đáng thử (FREE đo được 28% vs 7,5%, gấp 3,8 lần).
// Tự tách từ đơn + cụm 2–3 từ + emoji từ chữ QC, không cần đoán trước. 0₫ (chỉ đọc DB spy). Chạy trên box3 (có /root/.secrets/spy.env):
//   node apps/xuong-video/scripts/cum-thang.mjs --nhom '(reelshort|dramabox|short drama|full episode)' [--top 25] [--toi-thieu 40] [--thang 30] [--thua 7]
// Kết quả là TƯƠNG QUAN trên chữ đăng (không phải chữ trên hình) — mỗi cụm phải thử A/B một thay đổi một lần (sổ dạng bài kieu-sx.json) mới thành luật.
import fs from 'node:fs';
import { HO_HAO } from '../../cty/worker/cham-dang.mjs';
// cụm nằm trong câu hô hào phòng chấm cấm → ghi "CẤM cho Page persona" (11/11/2026: mẹo C "limited" chọn từ bảng này, 3 bài Mia bị SỬA LẠI sau khi dựng)
const camPersona = (c) => (c.length > 3 && HO_HAO.some((h) => h.includes(c) || c.includes(h)) ? ' · CẤM cho Page persona (phòng chấm chặn)' : '');

const ag = process.argv.slice(2), lay = (k, mac) => { const i = ag.indexOf(k); return i >= 0 ? ag[i + 1] : mac; };
const MIN_PAGE = Number(lay('--page', 5)), NHOM = lay('--nhom', null), TOP = Number(lay('--top', 25)), MIN = Number(lay('--toi-thieu', 40)), THANG = Number(lay('--thang', 30)), THUA = Number(lay('--thua', 7));
const BO = new Set('the a an and or of to in on for is it this that with at by be are was as from his her he she they we i you my your our me him them its not but so if do did just all have has had will can about what who how when then there their into out up one more after than'.split(' '));

/** Thuần — tách cụm: từ đơn (bỏ từ nối), cụm 2–3 từ liền nhau, emoji / dấu ! ?. Mỗi QC đếm một cụm một lần. */
export function tachCum(chu) {
  const t = String(chu).toLowerCase(), ra = new Set();
  const tu = t.replace(/https?:\/\/\S+/g, ' ').match(/[a-z][a-z']*/g) ?? [];
  tu.forEach((w, i) => {
    if (!BO.has(w) && w.length > 2) ra.add(w);
    if (i + 1 < tu.length) ra.add(`${w} ${tu[i + 1]}`);
    if (i + 2 < tu.length) ra.add(`${w} ${tu[i + 1]} ${tu[i + 2]}`);
  });
  for (const e of t.match(/\p{Extended_Pictographic}/gu) ?? []) ra.add(e);
  if (t.includes('!')) ra.add('!'); if (t.includes('?')) ra.add('?');
  return ra;
}
/** Thuần — xếp cụm theo độ nâng: tỉ lệ ở nhóm thắng / tỉ lệ ở nhóm thua (làm trơn +1 để cụm vắng ở nhóm thua không chia cho 0). */
// Một nhà quảng cáo chạy hàng trăm BẢN COPY cùng chữ (sách Kindle 140 QC "www amazon com") → số đếm phồng: gộp QC trùng chữ (giữ ngày chạy dài nhất) và
// chỉ nhận cụm xuất hiện ở ≥ minPage Page khác nhau trong nhóm thắng (một Page = một lá phiếu, không phải trăm lá).
export function xepCum(ds, { thang = 30, thua = 7, min = 40, minPage = 5 } = {}) {
  const gop = new Map(); for (const r of ds) { const k = String(r.chu).toLowerCase().replace(/\s+/g, ' ').trim(); const c = gop.get(k); if (!c || r.ngay > c.ngay) gop.set(k, r); }
  const dem = new Map(); let nT = 0, nH = 0;
  for (const { chu, ngay, page = '' } of gop.values()) {
    const la = ngay >= thang ? 'T' : ngay <= thua ? 'H' : null; if (!la) continue; if (la === 'T') nT++; else nH++;
    for (const c of tachCum(chu)) { const x = dem.get(c) ?? { T: 0, H: 0, pg: new Set() }; x[la]++; if (la === 'T') x.pg.add(page); dem.set(c, x); }
  }
  const ra = [...dem].filter(([, x]) => x.T >= min && x.pg.size >= minPage).map(([c, x]) => ({ cum: c, thang: x.T, page: x.pg.size, pThang: x.T / Math.max(nT, 1), pThua: x.H / Math.max(nH, 1),
    nang: (x.T + 1) / (nT + 2) / ((x.H + 1) / (nH + 2)) }));
  return { nT, nH, len: ra.sort((a, b) => b.nang - a.nang), xuong: [...ra].sort((a, b) => a.nang - b.nang) };
}

if (ag.includes('--tu-kiem')) {
  const t = (await import('node:assert')).strict;
  t.ok(tachCum('Watch the FULL episode free 👇').has('free') && tachCum('Watch the FULL episode free 👇').has('full episode') && tachCum('x 👇').has('👇'));
  t.ok(!tachCum('the and of').has('the'), 'bỏ từ nối đứng một mình');
  const ds = [...Array(50).fill({ chu: 'free episode', ngay: 40 }), ...Array(50).fill({ chu: 'episode', ngay: 3 })];
  const r = xepCum(ds.map((x, i) => ({ ...x, chu: `${x.chu} n${i}`, page: `p${i % 7}` })), { min: 10 }); t.equal(r.len[0].cum, 'free'); t.equal(r.nT, 50); t.equal(r.nH, 50);
  t.ok(r.len.find((x) => x.cum === 'episode').nang < 1.1, 'cụm có ở cả hai nhóm không nâng');
  console.log('cum-thang: tự kiểm đạt'); process.exit(0);
}
if (!NHOM) { console.error('cần --nhom <biểu thức chữ QC của ngách> (vd \'(reelshort|dramabox|short drama)\')'); process.exit(2); }
const url = process.env.SPY_DATABASE_URL ?? fs.readFileSync('/root/.secrets/spy.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice(13);
const spy = (await import('postgres')).default(url, { max: 1, prepare: false });
const ds = (await spy`select noi_dung as chu, coalesce(page_ten, page_id::text, '') as page, (coalesce(lan_cuoi, now())::date - bat_dau::date) as ngay from qc_meta where bat_dau is not null and noi_dung ~* ${NHOM}`).map((r) => ({ chu: r.chu ?? '', page: r.page, ngay: Number(r.ngay) }));
await spy.end();
const r = xepCum(ds, { thang: THANG, thua: THUA, min: MIN, minPage: MIN_PAGE }), pc = (x) => `${(x * 100).toFixed(1)}%`;
console.log(`nhóm "${NHOM}": ${ds.length} QC · thắng (≥ ${THANG} ngày) ${r.nT} · thua (≤ ${THUA} ngày) ${r.nH} · cụm có ≥ ${MIN} QC thắng ở ≥ ${MIN_PAGE} Page (đã gộp bản copy trùng chữ)`);
console.log(`\nCỤM THẮNG (ở QC chạy lâu nhiều hơn QC tắt sớm):`); for (const x of r.len.slice(0, TOP)) console.log(`  ×${x.nang.toFixed(1)}  ${x.cum.padEnd(28)} thắng ${pc(x.pThang)} · thua ${pc(x.pThua)} · ${x.thang} QC / ${x.page} Page${camPersona(x.cum)}`);
console.log(`\nCỤM THUA (tránh):`); for (const x of r.xuong.slice(0, Math.ceil(TOP / 2))) console.log(`  ×${x.nang.toFixed(2)}  ${x.cum.padEnd(28)} thắng ${pc(x.pThang)} · thua ${pc(x.pThua)} · ${x.thang} QC`);
