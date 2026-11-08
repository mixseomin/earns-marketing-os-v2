#!/usr/bin/env node
// MÁY VIẾT "FREE IN 60 SECONDS" (G5 kênh Astrolas, 08/11/2026 — mẫu đã duyệt G3, trước đây kịch bản tay): một công cụ của astrolas.com → một Short 9:16
// cho shot-code/la-so.html (khuôn demo mau-free-60s.json). 0đ, không AI, iMac (chụp trang bằng trình duyệt — box cấm).
// Nguồn: tên + mô tả công cụ NGUYÊN VĂN của site (sổ công cụ cong-cu/so-cong-cu.json, menu Tools) · trang thật chụp bằng cong-cu/chup.mjs: form trống (khoanh ô nhập +
// nút) và trang kết quả mở thẳng cho một người hạng AA (Steve Jobs; công cụ hai người: Brad Pitt + Angelina Jolie) · câu bước là câu khung tự viết (không mang
// nghĩa chiêm tinh) · hook = dòng đầu QC spy góc Know Yourself qua bộ chọn chung (hook-kenh.mjs). Trang không khoanh được ô → DỪNG công cụ đó, không đoán chỗ.
//   node viet-free60.mjs --cong-cu <mã | all> [--xem] [--chup-lai]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SO_CONG_CU, linkCongCu, dangCongCu } from './nguon-site.mjs';
import { tachCanh } from './chu-man.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { chonHook } from './hook-kenh.mjs';
import { nhanPlaylist } from './viet-chung.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), CC = join(DIR, 'cong-cu');
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const HAI = new Set(['synastry-chart', 'compatibility']), PL = 'know-yourself';
// nút GỬI của form theo chữ — css "form button" bắt nhầm nút "Parse" (ô nhập bằng AI, 08/11/2026); không thấy nút nào khớp thì chup.mjs dừng, công cụ đó báo hỏng
const NUT_GUI = '^[^A-Za-z]*(View|Update|Calculate|Compare|Show|Get|Generate|Cast|Analy[sz]e|Find|See|Check|Run|Create|Compute)\\b[\\w\\s\\-]{0,24}$';

/** ô nhập của form (tên tham số trên trang) → cụm chữ cho câu bước 1. Thuần. */
export function oNhap(tham) {
  const co = (re) => tham.some((t) => re.test(t)), ds = [];
  if (co(/(^|_)(day|month|year)2?$/)) ds.push('date'); if (co(/(^|_)(hour|minute)2?$/)) ds.push('time'); if (co(/(^|_)location2?$/)) ds.push('city');
  const cau = ds.length ? `your ${ds.join(', ').replace(/, ([^,]+)$/, ' and $1')} of birth` : 'your birth details';
  return `${cau}${co(/2$|^b_/) ? ", then the other person's" : ''}${co(/year_target/) ? ', and the year you want' : ''}`;
}

export function vietMot(c, { xem = false } = {}) {
  if (!c.mo_ta) return { loi: 'site chưa có mô tả riêng cho công cụ này' };
  // công cụ không nhận ngày sinh (Today, Horary): mở trang trần, không gắn người
  const theoNguoi = c.tham.some((t) => /(^|_)day$/.test(t)), ai = !theoNguoi ? null : HAI.has(c.ma) ? ['brad-pitt', 'angelina-jolie'] : 'steve-jobs', tenAi = !theoNguoi ? 'today' : HAI.has(c.ma) ? 'Brad Pitt and Angelina Jolie' : 'Steve Jobs';
  const form = `f60-${c.ma}-form`, ket = `f60-${c.ma}-ket`;
  if (!xem && (process.argv.includes('--chup-lai') || (theoNguoi && !existsSync(join(CC, `${form}.png`))) || !existsSync(join(CC, `${ket}.png`)))) {
    // kết quả: bánh xe lá số của site (svg có nhãn data-layer); công cụ không vẽ bánh xe (lịch trăng, hôm nay…) → cả trang
    const chup = (khungKet) => { const spec = join(CC, `spec-f60-${c.ma}.json`);
      writeFileSync(spec, JSON.stringify([...(theoNguoi ? [{ ten: form, url: c.url, khung: { form: { css: 'form' }, btn: { chu: NUT_GUI } } }] : []),   // công cụ không nhập ngày sinh: không có form
        { ten: ket, url: linkCongCu(c.ma, ai), cho: 4000, khung: { ket: khungKet } }], null, 1));
      execFileSync(process.execPath, [join(CC, 'chup.mjs'), spec], { cwd: CC, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5 * 60_000 }); };
    try { try { chup({ css: 'svg:has([data-layer])' }); } catch { chup({ css: 'body' }); } }
    catch (e) { return { loi: `chụp trang hỏng: ${String(e.stderr || e.stdout || e.message).trim().split('\n').pop().slice(0, 200)}` }; }
  }
  const so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === PL), y = `f60-${c.ma}`;
  const { hook, chuHook, goc } = chonHook('astrolas', PL, y), man = (t) => relative(SHOT, join(CC, `${t}.png`));
  const cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: '60s', duoi: c.ten, dong: ['Free · no payment needed'], vi: 'giua' } },
    { nhin: { troi: 1 }, chu: `${c.ten}: ${c.mo_ta}.`, nhan: 'astrolas.com · Tools' },
    ...(theoNguoi ? [{ nhin: { man: man(form), khung: 'form' }, khung: true, chu: `Step 1: ${oNhap(c.tham)}.`, nhan: '0:10' },
      { nhin: { man: man(form), khung: 'btn', bam: true }, khung: true, chu: 'Step 2: one tap.', nhan: '0:20' }] : []),
    { nhin: { man: man(ket), khung: 'ket' }, khung: true, chu: theoNguoi ? `Step 3: ${c.ten} for ${tenAi}, on screen.` : `Open ${c.ten}: it's already on screen.`, nhan: '0:40' },
    { nhin: { troi: 1 }, khung: true, chu: `Try ${c.ten} free<br>at astrolas.com.` },
  ];
  const tenGon = c.ten.replace(/\s*[-–]\s*[^-–]*\d[^-–]*$/, ''), tieuDe = `${chuHook} ${tenGon}, free, in about a minute`, tg = (p) => relative(SHOT, join(DIR, p));   // luật hook: tiêu đề không thêm con số ngoài hook gốc
  const tap = tachCanh({ _ghi: `Free in 60 Seconds · ${c.ten} — sinh bởi lich-su/viet-free60.mjs (mô tả công cụ nguyên văn của site, trang chụp thật, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'free-60s', playlist_ma: PL, y_tuong: y, tieu_de: tieuDe, goc, hook: { qc: hook.id, goc: hook.chu },
    dang: dangCongCu(c.ma, ai, {}, `${c.ten} in 60 seconds, free.`), la_so: tg('la-so/steve-jobs.svg'), nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'), playlist: nhanPlaylist(pl),
    cau: cau.map((q) => ({ ...q, tu: 0, den: 0 })), DAI: 0 });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) return { loi: loi.join(' · ') };
  if (!xem) { const ra = join(SHOT, 'tap-astrolas', `${y}.json`); mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n'); }
  return { tap };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--tu-kiem')) {
    const { strict: a } = await import('node:assert');
    a.equal(oNhap(['name', 'day', 'month', 'year', 'hour', 'minute', 'location', 'lat', 'lng']), 'your date, time and city of birth');
    a.equal(oNhap(['day', 'month', 'year', 'hour', 'minute', 'location', 'day2', 'month2']), "your date, time and city of birth, then the other person's");
    a.equal(oNhap(['a_day', 'a_month', 'a_year', 'b_day']), "your date of birth, then the other person's");
    a.equal(oNhap(['day', 'month', 'year', 'year_target']), 'your date of birth, and the year you want');
    console.log('viet-free60: tự kiểm đạt'); process.exit(0);
  }
  const ma = arg('cong-cu'); if (!ma) { console.error('dùng: --cong-cu <mã | all> [--xem]'); process.exit(2); }
  const ds = SO_CONG_CU().filter((c) => ma === 'all' || c.ma === ma); let hong = 0;
  for (const c of ds) { const r = vietMot(c, { xem: process.argv.includes('--xem') });
    if (r.loi) { hong++; console.log(`✗ ${c.ma}: ${r.loi}`); } else console.log(`✓ f60-${c.ma} · ${r.tap.cau.length} câu · ${r.tap.DAI}s · ${r.tap.tieu_de}`); }
  console.log(`${ds.length - hong}/${ds.length} công cụ đạt`); process.exit(hong && ma !== 'all' ? 1 : 0);
}
