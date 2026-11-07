#!/usr/bin/env node
// MÁY VIẾT "SKY CALENDAR" (G5 kênh Astrolas, 05/11/2026): một chuyện trời xưa + một tuần sắp tới → một Short 9:16 cho shot-code/la-so.html (khuôn demo mau-sky-calendar.json).
// 0đ, không AI. Chuyện = câu NGUYÊN VĂN Wikipedia (lich-su/troi-xua/<ma>.json, 21 chuyện, bộ kiểm troi-xua/_may/verify.py) · tuần = dải pha trăng TÍNH THẬT (trang_tuan)
// + trăng mới / tròn trong tuần từ lịch trời (lich-troi.json) · hook = dòng đầu QC spy góc Thời điểm (playlist timing) · bài đăng = mô tả Moon Phase của site + link + nguồn chuyện.
// XẾP LỊCH: mỗi chuyện một tuần (thứ Hai đầu tuần), ưu tiên tuần chứa NGÀY KỶ NIỆM của chuyện; chuyện chỉ có năm lấp tuần trống sớm nhất.
// Tranh minh hoạ tuỳ chọn: brand/astrolas/tranh/<ma>-<i>.jpg có thì dùng (tranh-sinh.mts ~110₫ / cảnh), không thì bầu trời + thẻ ngày.
//   node viet-sky.mjs [--tu 2026-11-09] [--chuyen sc-halley-1066] [--kho-hook kho.json] [--hook-moi] [--xem]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dangCongCu } from './nguon-site.mjs';
import { tachCanh, hookGon, hookNgan } from './chu-man.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { chonHook, baoHook } from './hook-kenh.mjs';
import { ghiTacGia } from './anh-wiki.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const THANG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const THU = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const tg = (p) => relative(SHOT, join(DIR, p));
/** năm thiên văn → chữ: -0584 → "585 BC", 1066 → "1066" */
export const namChu = (y) => (y <= 0 ? `${1 - y} BC` : String(y));
const tachNgay = (d) => { const m = /^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(d); return m ? { y: +m[1], m: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null } : null; };
export const ngayChu = (s) => { const n = tachNgay(s); return n.d ? `${THANG[n.m - 1]} ${n.d}, ${namChu(n.y)}` : n.m ? `${THANG[n.m - 1]} ${namChu(n.y)}` : namChu(n.y); };
const NHAN_LOAI = { nguyet_thuc: 'Lunar eclipse', nhat_thuc: 'Solar eclipse', sao_choi: 'Comet', sao_bang: 'Meteor', sieu_tan_tinh: 'New star', hanh_tinh: 'Planet', trang: 'The Moon', khac: 'Sky event' };
const iso = (t) => t.toISOString().slice(0, 10), cong = (s, n) => iso(new Date(Date.parse(`${s}T00:00Z`) + n * 864e5));

/** sổ chuyện: troi-xua/_so.json + chuyện Columbus 1504 của demo (dai/moc-columbus-1504.json) */
export function soChuyen() {
  const ds = doc('troi-xua/_so.json').chuyen.map((c) => ({ ...c, tep: `troi-xua/${c.tep.split('/').pop()}` }));
  if (!ds.some((c) => c.ma === 'sc-columbus-1504')) ds.push({ ma: 'sc-columbus-1504', ten: 'Columbus and the lunar eclipse', loai: 'nguyet_thuc', su_kien_ngay: '1504-02-29', tep: 'dai/moc-columbus-1504.json' });
  return ds;
}
/** xếp lịch: tuần (thứ Hai) chứa ngày kỷ niệm (tháng-ngày) của chuyện → chuyện đó; chuyện chỉ có năm / trùng tuần lấp tuần trống sớm nhất. Thuần. */
export function xepLich(ds, tu, soTuan) {
  const tuan = Array.from({ length: soTuan }, (_, i) => cong(tu, i * 7)), xep = new Map(), cho = [];
  const coNgay = ds.filter((c) => tachNgay(c.su_kien_ngay)?.d).sort((a, b) => a.su_kien_ngay.slice(-5).localeCompare(b.su_kien_ngay.slice(-5)));
  for (const c of coNgay) {
    const md = c.su_kien_ngay.slice(-5), w = tuan.find((t) => !xep.has(t) && [0, 1, 2, 3, 4, 5, 6].some((i) => cong(t, i).slice(5) === md));
    if (w) xep.set(w, { ...c, ky_niem: true }); else cho.push(c);
  }
  for (const c of [...cho, ...ds.filter((c) => !tachNgay(c.su_kien_ngay)?.d)]) { const w = tuan.find((t) => !xep.has(t)); if (w) xep.set(w, { ...c, ky_niem: false }); }
  return [...xep.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([t, c]) => ({ tuan: t, ...c }));
}

function vietMot(c, LT) {
  const T = doc(c.tep), so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === 'timing'), n = tachNgay(c.su_kien_ngay);
  const { hook, chuHook, goc: gocHook } = chonHook('astrolas', 'timing', c.ma);
  // trăng mới / trăng tròn trong tuần (giờ UTC của lịch trời)
  const trang = LT.su_kien.filter((e) => /^trang_/.test(e.loai) && e.utc.slice(0, 10) >= c.tuan && e.utc.slice(0, 10) < cong(c.tuan, 7));
  const cauTrang = trang.length ? `This week: ${trang.map((e) => `a ${e.loai === 'trang_moi' ? 'New' : 'Full'} Moon on ${THU[new Date(e.utc).getUTCDay()]}`).join(', ')}.` : "This week's Moon, day by day.";
  // ảnh THẬT của chuyện (troi-xua/_anh.json — troi-xua/_may/lay-anh.mjs: ảnh Wikipedia công cộng / CC) xoay vòng theo mốc; CC BY phải ghi tác giả trong bài đăng
  const anh = (existsSync(join(DIR, 'troi-xua/_anh.json')) ? doc('troi-xua/_anh.json')[c.ma] ?? [] : []).filter((a) => existsSync(join(DIR, a.tep)));
  const ghiAnh = ghiTacGia(anh);
  const chinh = T.moc.findIndex((m) => m.ngay === c.su_kien_ngay), iChinh = chinh >= 0 ? chinh : Math.min(1, T.moc.length - 1);
  const cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: namChu(n.y), duoi: c.ten, dong: [], vi: 'giua' } },
    ...T.moc.flatMap((m, i) => {
      const a = anh.length ? anh[i % anh.length] : null, nhan = `${namChu(tachNgay(m.ngay).y)}${m.noi ? ` · ${m.noi}` : ''}`;
      const ke = a ? { nhin: { tranh: tg(a.tep), kieu: ['trai', 'day', 'len', 'phai'][i % 4] }, chu: m.chu, nhan } : { nhin: { troi: 1 }, chu: m.chu, nhan };
      // mốc chính (ngày của sự kiện trời): thêm thẻ ngày + loại sự kiện trước câu kể
      // chuyện chỉ có năm (Halley 1066): thẻ mở đầu đã ghi năm — không thêm cảnh ngày trơn "1066."
      return i === iChinh && n.m ? [{ nhin: { troi: 1 }, chu: `${ngayChu(c.su_kien_ngay)}.`, the: { lon: n.d ? `${THANG[n.m - 1].slice(0, 3)} ${n.d}` : namChu(n.y), duoi: namChu(n.y), dong: [NHAN_LOAI[c.loai] ?? 'Sky event'], vi: 'giua' } }, ke] : [ke];
    }),
    { nhin: { trang_tuan: { tu: c.tuan, so: 7 } }, chu: cauTrang },
    { nhin: { troi: 1 }, khung: true, chu: "See this week's Moon Phase free at astrolas.com." },
  ].map((q) => ({ ...q, tu: 0, den: 0 }));
  // tiêu đề không mang số (luật hook: không thêm con số không có trong QC gốc) — "Halley's Comet and 1066" → "Halley's Comet"
  const tieuDe = `${chuHook} ${c.ten.replace(/\s+(?:of|and|in)\s+\d+\b/g, '').replace(/\s*\b\d+\b/g, '').replace(/\s+/g, ' ').trim()}`, nguon = T.nguon.split(/;\s*/).map((s) => s.split(' ')[0]);
  const tap = tachCanh({ _ghi: `Sky Calendar · ${c.ten} · tuần ${c.tuan}${c.ky_niem ? ' (tuần kỷ niệm)' : ''} — sinh bởi lich-su/viet-sky.mjs (chuyện ${c.tep}, lịch trời lich-troi.json, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'sky-calendar', playlist_ma: 'timing', y_tuong: c.ma, tuan: c.tuan, tieu_de: tieuDe, goc: gocHook, hook: { qc: hook.id, goc: hook.chu },
    nguon_moc: [c.tep],
    dang: dangCongCu('moon-phase', null, {}, `${ngayChu(c.su_kien_ngay)}: ${c.ten}. This week's Moon phases on Astrolas. Story: ${nguon.join(' · ')}${ghiAnh.length ? `\nImages: ${ghiAnh.join('; ')}` : ''}`),
    nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'), playlist: { ten: pl.ten, mau: '#7FD18B', ic: '☽' }, cau, DAI: 0 });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) { console.error(`✗ ${c.ma}:\n${loi.map((l) => `   · ${l}`).join('\n')}`); return false; }
  const ra = join(SHOT, 'tap-astrolas', `${c.ma}.json`); mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
  console.log(`✓ ${relative(SHOT, ra)} · tuần ${c.tuan}${c.ky_niem ? ' ★' : ''} · ${tap.cau.length} câu · ${tap.DAI}s`);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const LT = doc('lich-troi.json'), homNay = iso(new Date()), thu2 = (s) => cong(s, (8 - new Date(`${s}T00:00Z`).getUTCDay()) % 7);   // thứ Hai kế tiếp (hoặc hôm nay nếu là thứ Hai)
  const tu = arg('tu', thu2(homNay)), soTuan = Math.floor((Date.parse(`${LT.den}T00:00Z`) - Date.parse(`${tu}T00:00Z`)) / (7 * 864e5));
  const lich = xepLich(soChuyen(), tu, soTuan).filter((c) => !arg('chuyen') || c.ma === arg('chuyen'));
  if (process.argv.includes('--xem')) { for (const c of lich) console.log(`${c.tuan}  ${c.ky_niem ? '★' : ' '} ${c.ma.padEnd(22)} ${c.su_kien_ngay.padEnd(11)} ${c.ten}`); process.exit(0); }
  if (arg('tuan')) for (const c of lich) c.tuan = arg('tuan');   // chay-so-kenh.mjs đã chọn tuần
  let hong = 0; for (const c of lich) if (!vietMot(c, LT)) hong++;
  console.log(`${lich.length - hong}/${lich.length} chuyện đạt`); process.exit(hong ? 1 : 0);
}
