#!/usr/bin/env node
// REMIX TẬP DÀI → SHORT (anh 09/11/2026: "Đổi sang 8-10 phút sau đó remix từ nó thành short"): một CHƯƠNG của tập dài Full Chart Reading (crd-<người>,
// dai/doc-bai.mjs) → một Short 9:16 ≤ 50 giây cho shot-code/la-so.html. Câu lấy y nguyên bản dài (cùng chữ → giọng dùng lại từ kho, chỉ hook + câu kết đọc mới),
// cùng cảnh máy quay; hook = dòng đầu QC spy góc Know Yourself qua bộ chọn chung. Mốc đời trong chương không lên Short (Short giữ một ý: phần lá số).
//   node dai/cat-short.mjs --tu angelina-jolie [--chuong <k | all>] [--xem]      (k = số chương của tập dài, 1 = mục đầu tiên của bài; 0 là Intro, không cắt)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PL, tenGon } from './doc-bai.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), LS = join(DIR, '..'), SHOT = join(LS, '../shot-code'), TAP = join(SHOT, 'tap-astrolas');
export const MAU = 'chart-reading-cat', GIAY_TOI_DA = 50;
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };

/** câu lá số của chương k trong tập dài (bỏ thẻ đầu chương + cảnh mốc đời), bỏ mốc giờ / mảnh chữ để tachCanh tính lại theo khổ dọc. Thuần. */
export function cauChuong(dai, k) {
  const c = dai.chuong?.[k]; if (!c || k === 0) return null;
  const het = dai.chuong[k + 1]?.cau ?? dai.cau.length - 1;   // câu cuối của tập dài là câu kết, không thuộc chương nào
  const ds = dai.cau.slice(c.cau, het).map(({ tu, den, manh, ...q }) => q);
  return { ten: c.ten, dau: ds[0], cau: ds.slice(1).filter((q) => !q.nhin?.tranh && !q.the) };
}
/** các mã Short cắt được từ một tập dài (mọi chương trừ Intro, có ít nhất một câu lá số). Thuần. */
export const maCat = (dai) => (dai.chuong ?? []).map((_, k) => k).filter((k) => cauChuong(dai, k)?.cau.length).map((k) => `crc-${dai.y_tuong.replace(/^crd-/, '')}-${k}`);

export async function catMot(slug, k, { xem = false } = {}) {
  const { tachCanh } = await import('../chu-man.mjs'), { docSo, kiemTap } = await import('../kiem-so-kenh.mjs'), { chonHook } = await import('../hook-kenh.mjs');
  const { loiHook } = await import('../../../src/lib/xuong-video/hook-qc.mjs'), { dangCongCu } = await import('../nguon-site.mjs'), { nhanPlaylist } = await import('../viet-chung.mjs');
  const f = join(TAP, `crd-${slug}.json`); if (!existsSync(f)) return { loi: [`chưa có tập dài crd-${slug} (dai/doc-bai.mjs --slug ${slug})`] };
  const dai = JSON.parse(readFileSync(f, 'utf8')), ch = cauChuong(dai, k); if (!ch?.cau.length) return { loi: [`tập dài crd-${slug} không có chương ${k} cắt được`] };
  const so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === PL), y = `crc-${slug}-${k}`, A = dai.cau[1].chu.split(',')[0];
  const { hook, chuHook, goc } = chonHook('astrolas', PL, y);
  const dau = [{ nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: A.split(' ')[0], duoi: 'birth chart', dong: [], vi: 'giua' } }, { ...ch.dau, nhin: ch.cau[0].nhin, the: undefined }];
  const ket = { nhin: { toan: 1 }, khung: true, chu: 'Full reading on our channel. Read your own birth chart free at astrolas.com.' };
  const dung = (n) => tachCanh({ kenh: 'astrolas', mau: MAU, playlist_ma: PL, y_tuong: y, cau: [...dau, ...ch.cau.slice(0, n), ket].map((q) => ({ ...q, tu: 0, den: 0 })), DAI: 0 });
  let n = 1; while (n < ch.cau.length && dung(n + 1).DAI <= GIAY_TOI_DA) n++;   // thêm câu tới khi chạm 50 giây (ít nhất một câu)
  const tieuDe = `${chuHook} ${A}: ${ch.ten}`;
  const tap = { ...dung(n), _ghi: `Chart Reading · ${A} · chương ${k} "${ch.ten}" — cắt từ tập dài crd-${slug} bởi lich-su/dai/cat-short.mjs (${n}/${ch.cau.length} câu, hook QC spy #${hook.id})`,
    tu_dai: `crd-${slug}`, tieu_de: tieuDe, goc, hook: { qc: hook.id, goc: hook.chu }, nguon_bai: dai.nguon_bai,
    dang: dangCongCu('birth', slug, {}, `${A}'s birth chart: ${ch.ten}. One chapter of the full reading on our channel.`),
    la_so: dai.la_so, nen: dai.nen, logo: dai.logo, playlist: nhanPlaylist(pl) };   // cùng thư mục tập-astrolas với tập dài: đường tương đối dùng y nguyên
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) return { loi };
  if (!xem) { const ra = join(TAP, `${y}.json`); mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n'); }
  return { tap };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--tu-kiem')) {
    const { strict: t } = await import('node:assert');
    const D = { y_tuong: 'crd-x', chuong: [{ ten: 'Intro', cau: 0 }, { ten: 'Moon in Aries', cau: 3 }, { ten: 'In sum', cau: 7 }],
      cau: [{ chu: 'h' }, { chu: 'X, born' }, { chu: 'i' }, { chu: 'Moon in Aries.', the: { lon: '01' } }, { chu: 'a', nhin: { sao: 'Moon' }, tu: 1, den: 2, manh: ['a'] }, { chu: '1990, age 9.', nhin: { tranh: 'p' } }, { chu: 'b', nhin: { sao: 'Mars' } }, { chu: 'Sum.', the: { lon: 'In sum' } }, { chu: 'c', nhin: { toan: 1 } }, { chu: 'free at astrolas.com', khung: true }] };
    const c = cauChuong(D, 1); t.deepEqual(c.cau.map((q) => q.chu), ['a', 'b'], 'bỏ thẻ chương + mốc đời'); t.equal(c.cau[0].manh, undefined, 'bỏ mảnh / mốc giờ cũ');
    t.deepEqual(cauChuong(D, 2).cau.map((q) => q.chu), ['c'], 'chương cuối không lấy câu kết'); t.equal(cauChuong(D, 0), null, 'Intro không cắt');
    t.deepEqual(maCat(D), ['crc-x-1', 'crc-x-2']); t.equal(tenGon('Sun and Mercury in Gemini, in the 11th house'), 'Sun and Mercury in Gemini');
    console.log('cat-short: tự kiểm đạt'); process.exit(0);
  }
  const slug = arg('tu'), ch = arg('chuong', 'all'); if (!slug) { console.error('dùng: --tu <người> [--chuong <k | all>] [--xem]'); process.exit(2); }
  const f = join(TAP, `crd-${slug}.json`); if (!existsSync(f)) { console.error(`✗ chưa có tập dài crd-${slug}`); process.exit(3); }
  const ks = ch === 'all' ? maCat(JSON.parse(readFileSync(f, 'utf8'))).map((m) => Number(m.split('-').pop())) : [Number(ch)]; let hong = 0;
  for (const k of ks) { const r = await catMot(slug, k, { xem: process.argv.includes('--xem') });
    if (r.loi) { hong++; console.log(`✗ crc-${slug}-${k}:\n${r.loi.map((l) => `   · ${l}`).join('\n')}`); } else console.log(`✓ crc-${slug}-${k} · ${r.tap.cau.length} câu · ${r.tap.DAI}s · ${r.tap.tieu_de}`); }
  process.exit(hong && ch !== 'all' ? 1 : 0);
}
