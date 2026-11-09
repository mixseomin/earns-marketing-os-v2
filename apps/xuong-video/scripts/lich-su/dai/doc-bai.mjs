#!/usr/bin/env node
// MÁY VIẾT "FULL CHART READING" — VIDEO DÀI 8–10 PHÚT 16:9 (kênh YouTube Astrolas, anh 09/11/2026: "Đổi sang 8-10 phút sau đó remix từ nó thành short").
// Mẫu dài cũ (Love Story / Chart Chapters dài) chỉ ~1 phút; bản này đọc NGUYÊN VĂN cả bài "<người>-birth-chart" của blog site (~1.100 từ ≈ 8 phút giọng đọc)
// + xen mốc đời có nguồn (dai/moc-<người>.json · la-so/cap.json, chung viet-ask.mjs › mocCua) kèm ảnh thật Wikipedia của chính người đó.
// Mỗi mục của bài = MỘT CHƯƠNG (tap.chuong): nap-tap.mjs ghi mốc chương vào mô tả YouTube, dai/cat-short.mjs cắt mỗi chương thành một Short 9:16 (giọng dùng lại, 0₫).
// Máy quay theo câu: câu nhắc hai sao có góc chiếu → góc chiếu · một sao → sao · "Nth house" → nhà · tên cung → cung · không nhắc gì → giữ cảnh trước.
// 0đ AI; tiền giọng ckey ~156₫ / lượt đọc (~80 lượt ≈ 12.500₫ / tập — anh duyệt 09/11/2026).
//   node dai/doc-bai.mjs --slug angelina-jolie | all  [--xem]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url)), LS = join(DIR, '..'), SHOT = join(LS, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(LS, p), 'utf8'));
export const SAO = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'];
const CUNG = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const PL = 'know-yourself', MAU = 'chart-reading-dai';
const re = (w) => new RegExp(`\\b${w}\\b`);

/** đoạn văn → các câu (không cắt ở 13°05' hay "Dr."). Thuần. */
export const tachCau = (doan) => doan.join(' ').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z“"(])/).map((s) => s.trim()).filter(Boolean)
  // câu dưới 5 từ ("The houses are personal.") ghép vào câu sau: luật nguồn đối chiếu khúc ≥ 5 từ, câu ngắn đứng riêng không chứng minh được là chữ site
  .reduce((ra, c) => { const t = ra.at(-1); if (t && t.split(/\s+/).length < 5) ra[ra.length - 1] = `${t} ${c}`; else ra.push(c); return ra; }, [])
  .reduce((ra, c, i, a) => { if (i === a.length - 1 && ra.length && c.split(/\s+/).length < 5) ra[ra.length - 1] += ` ${c}`; else ra.push(c); return ra; }, []);   // câu ngắn ở cuối đoạn ghép về câu trước
/** cảnh máy quay cho một câu theo lá số D (sao / góc chiếu / nhà / cung có thật trên lá số); không nhắc gì → giữ cảnh trước. Thuần. */
export function chonNhin(cau, D, truoc = { toan: 1 }) {
  const ten = SAO.filter((s) => re(s).test(cau) && D.sao.some((x) => x.ten === s)).sort((a, b) => cau.search(re(a)) - cau.search(re(b)));
  if (ten.length >= 2) { const g = (D.goc ?? []).find((x) => (x.a === ten[0] && x.b === ten[1]) || (x.a === ten[1] && x.b === ten[0])); if (g) return { goc: [g.a, g.b] }; }
  if (ten.length) return { sao: ten[0] };
  const nh = /\b(\d{1,2})(?:st|nd|rd|th) house\b/.exec(cau); if (nh && +nh[1] >= 1 && +nh[1] <= 12) return { nha: +nh[1] };
  const c = CUNG.find((x) => re(x).test(cau)); if (c) return { cung: c };
  return truoc;
}
/** tên mục bỏ số nhà ("…, in the 9th house") — tiêu đề không được thêm con số ngoài hook gốc (luật hook). Thuần. */
export const tenGon = (t) => t.replace(/,?\s*(?:in|on|across) the \d+\w*(?: and \d+\w*)? houses?/gi, '').replace(/\s+/g, ' ').trim();
/** mục của bài: mục lá số theo thứ tự site; mục hỏi đáp ghép câu hỏi (trong bai.mo) với câu trả lời. Thuần. */
export function mucBai(bai) {
  const hoi = bai.mo.filter((x) => /\?$/.test(x.trim()));
  return bai.muc.map((m) => (/questions people ask/i.test(m.ten)
    ? { ten: m.ten, hoi: true, cau: m.doan.flatMap((d, i) => [...(hoi[i] ? [hoi[i].trim()] : []), ...tachCau([d])]) }
    : { ten: m.ten, cau: tachCau(m.doan) })).filter((m) => m.cau.length);
}

/** giây giọng đọc ước theo chữ: giọng ckey ~13,1 ký tự / giây kể cả nghỉ giữa câu (đo 09/11/2026: tập dài Angelina 611 giây thật / ước 564 giây ở 14,2). Thuần. */
export const TOC = 13.1, giayChu = (s) => String(s).replace(/<[^>]+>/g, '').length / TOC;
/** gọt bài cho vừa `giay` giây: bỏ mục hỏi đáp trước, rồi bớt câu CUỐI của mục còn nhiều câu nhất (giữ ≥ 3 câu / mục, không đụng mục tổng kết). Thuần. */
export function catMuc(muc, giay) {
  let ds = muc.map((m) => ({ ...m, cau: [...m.cau] }));
  const tong = () => ds.reduce((s, m) => s + giayChu(m.ten) + m.cau.reduce((a, c) => a + giayChu(c), 0), 0);
  if (tong() > giay) ds = ds.filter((m) => !m.hoi);
  while (tong() > giay) { const m = ds.filter((x) => !/adds up/i.test(x.ten) && x.cau.length > 3).sort((a, b) => b.cau.length - a.cau.length)[0]; if (!m) break; m.cau.pop(); }
  return ds;
}

export async function vietDai(n, { xem = false } = {}) {
  const { THANG, nhanPlaylist } = await import('../viet-chung.mjs'), { tenNgan } = await import('../viet-cap.mjs'), { mocCua } = await import('../viet-ask.mjs');
  const { layAnhWiki, ghiTacGia } = await import('../anh-wiki.mjs'), { dangCongCu } = await import('../nguon-site.mjs'), { tachCanh } = await import('../chu-man.mjs');
  const { docSo, kiemTap } = await import('../kiem-so-kenh.mjs'), { chonHook } = await import('../hook-kenh.mjs'), { loiHook } = await import('../../../src/lib/xuong-video/hook-qc.mjs');
  const y = `crd-${n.slug}`, bai = doc(`la-so/bai/${n.slug}-birth-chart.json`), D = doc(`la-so/${n.slug}.json`), so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === PL);
  const A = n.ten_ngan ?? tenNgan(n.ten), tg = (p) => relative(SHOT, join(LS, p)), moc = mocCua(n), [GIAY_MIN, GIAY_MAX] = so.tu_chay?.dai?.giay ?? [480, 570];
  // ảnh thật Wikipedia của chính người đó (chung viet-chuong.mjs: la-so/anh-nguoi.json › cc-<người>)
  const fAnh = join(LS, 'la-so/anh-nguoi.json'), kho = existsSync(fAnh) ? JSON.parse(readFileSync(fAnh, 'utf8')) : {};
  if (!kho[`cc-${n.slug}`] && !xem) { kho[`cc-${n.slug}`] = await layAnhWiki([n.wiki ?? n.ten], { ma: `cc-${n.slug}`, toiDa: 3 }); writeFileSync(fAnh, JSON.stringify(kho, null, 1) + '\n'); }
  const anh = kho[`cc-${n.slug}`] ?? [];
  const { hook, chuHook, goc } = chonHook('astrolas', PL, y);
  const cau = [], chuong = [{ ten: 'Intro', cau: 0 }]; let cam = { dung: 1 };
  const doc1 = (chu, nhan) => { cam = chonNhin(chu, D, cam.dung ? { toan: 1 } : cam); cau.push({ nhin: cam, chu, ...(nhan ? { nhan } : {}) }); };
  cau.push({ nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: A.split(' ')[0], duoi: 'birth chart, in full', dong: [], vi: 'giua' } });
  cau.push({ nhin: { dung: 1 }, chu: `${A}, born ${THANG[n.sinh.thang - 1]} ${n.sinh.ngay}, ${n.sinh.nam}.` });
  const i0 = bai.mo.findIndex((x) => /^Born:/.test(x)); for (const c of tachCau(i0 >= 0 ? bai.mo.slice(i0) : [])) doc1(c);
  // thời lượng 8–10 phút (so-kenh › tu_chay.dai.giay): phần cố định (mở đầu, mốc, câu kết) trừ trước, bài gọt cho vừa phần còn lại
  const coDinh = [...cau.map((q) => q.chu), ...moc.map((mc) => `${mc.ngay.slice(0, 4)}, age ${mc.tuoi}. ${mc.chu}`), 'Read your own birth chart free at astrolas.com.'].reduce((a, c) => a + giayChu(c), 0);
  const muc = catMuc(mucBai(bai), GIAY_MAX - coDinh);
  const viTri = muc.filter((m) => !m.hoi && !/adds up/i.test(m.ten)).length, phan = moc.map((_, j) => Math.min(viTri - 1, Math.floor((j * viTri) / Math.max(1, moc.length))));
  let k = 0;
  for (const m of muc) {
    chuong.push({ ten: tenGon(m.ten), cau: cau.length });
    cau.push({ nhin: { troi: 1 }, chu: `${m.ten.replace(/[.:]$/, '')}.`, the: { lon: m.hoi ? 'Q & A' : /adds up/i.test(m.ten) ? 'In sum' : String(k + 1).padStart(2, '0'), duoi: '', dong: [], vi: 'giua' } });
    cam = { toan: 1 }; for (const c of m.cau) doc1(c);
    if (!m.hoi && !/adds up/i.test(m.ten)) {
      moc.forEach((mc, j) => { if (phan[j] !== k) return; const t = mc.tranh ? join('dai', mc.tranh) : anh[j % Math.max(1, anh.length)]?.tep, nam = mc.ngay.slice(0, 4);
        cau.push(t && existsSync(join(LS, t)) ? { nhin: { tranh: tg(t), kieu: ['day', 'trai', 'lui', 'phai'][j % 4] }, chu: `${nam}, age ${mc.tuoi}. ${mc.chu}`, nhan: `${nam}${mc.noi ? ` · ${mc.noi}` : ''}` }
          : { nhin: { troi: 1 }, chu: mc.chu, the: { lon: nam, duoi: `age ${mc.tuoi}`, dong: [], vi: 'giua' } }); });
      k++;
    }
  }
  cau.push({ nhin: { toan: 1 }, khung: true, chu: 'Read your own birth chart free at astrolas.com.' });
  const tieuDe = `${chuHook} ${A}'s birth chart, read in full`, tac = ghiTacGia(anh);
  const tap = tachCanh({ _ghi: `Full Chart Reading · ${A} — sinh bởi lich-su/dai/doc-bai.mjs (bài site ${bai.url} nguyên văn, ${moc.length} mốc, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: MAU, playlist_ma: PL, y_tuong: y, khung: 'ngang', tieu_de: tieuDe, goc, hook: { qc: hook.id, goc: hook.chu },
    nguon_moc: [...new Set(moc.map((m) => m.nguon_moc))], nguon_bai: [`${n.slug}-birth-chart`], chuong, giay_uoc: Math.round(cau.reduce((a, q) => a + giayChu(q.chu), 0)),
    dang: dangCongCu('birth', n.slug, {}, `${n.ten}'s birth chart, read in full from the Astrolas article ${bai.url}${tac.length ? `\nImages: ${tac.join('; ')}` : ''}`),
    la_so: tg(`la-so/${n.slug}.svg`), nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'), playlist: nhanPlaylist(pl), cau: cau.map((q) => ({ ...q, tu: 0, den: 0 })), DAI: 0 });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loi.length) return { loi };
  if (!xem) { const ra = join(SHOT, 'tap-astrolas', `${y}.json`); mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n'); }
  return { tap };
}
/** người làm được bản dài: hạng Rodden dùng được nhà, có lá số + bài lá số của site. */
export const dsNguoi = () => { const S = doc('la-so/nguoi.json'); return S.nguoi.filter((x) => !x.khong_dung && S.rodden_dung_nha.includes(x.rodden)
  && existsSync(join(LS, `la-so/${x.slug}.json`)) && existsSync(join(LS, `la-so/bai/${x.slug}-birth-chart.json`))); };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--tu-kiem')) {
    const { strict: t } = await import('node:assert'), D = { sao: [{ ten: 'Moon' }, { ten: 'Mars' }, { ten: 'Venus' }], goc: [{ a: 'Moon', b: 'Mars', loai: 'Conjunction' }] };
    t.deepEqual(chonNhin('The Moon and Mars sit together.', D), { goc: ['Moon', 'Mars'] }); t.deepEqual(chonNhin('Venus then Moon.', D), { sao: 'Venus' }, 'không có góc → sao nhắc trước');
    t.deepEqual(chonNhin('the 9th house ties to travel', D), { nha: 9 }); t.deepEqual(chonNhin('Gemini is quick.', D), { cung: 'Gemini' }); t.deepEqual(chonNhin('She acts.', D, { sao: 'Mars' }), { sao: 'Mars' });
    t.deepEqual(tachCau(["At 13°05' Aries, it sits here. The library reads it as bold. “Bold,” it says."]), ["At 13°05' Aries, it sits here.", 'The library reads it as bold. “Bold,” it says.']);
    t.equal(tenGon('Moon, Mars and Jupiter in Aries, in the 9th house'), 'Moon, Mars and Jupiter in Aries'); t.equal(tenGon('Pluto and Uranus in Libra, in the 3rd and 4th houses'), 'Pluto and Uranus in Libra');
    const M = [{ ten: 'A', cau: ['x'.repeat(142), 'x'.repeat(142), 'x'.repeat(142), 'x'.repeat(142), 'x'.repeat(142)] }, { ten: 'Questions people ask', hoi: true, cau: ['x'.repeat(1420)] }, { ten: 'What the chart adds up to', cau: ['x'.repeat(142), 'x'.repeat(142)] }];
    t.deepEqual(catMuc(M, 999).map((m) => m.cau.length), [5, 1, 2], 'vừa thì giữ nguyên'); t.deepEqual(catMuc(M, 75).map((m) => m.cau.length), [5, 2], 'quá thì bỏ hỏi đáp trước');
    t.deepEqual(catMuc(M, 55).map((m) => m.cau.length), [3, 2], 'vẫn quá thì bớt câu cuối, giữ ≥ 3 câu, không đụng tổng kết');
    t.deepEqual(mucBai({ mo: ['What is X?', 'Why Y?'], muc: [{ ten: 'Questions people ask', doan: ['A one.', 'B two.'] }] })[0].cau, ['What is X?', 'A one.', 'Why Y?', 'B two.']);
    console.log('doc-bai: tự kiểm đạt'); process.exit(0);
  }
  const ai = process.argv[process.argv.indexOf('--slug') + 1]; if (!process.argv.includes('--slug') || !ai) { console.error('dùng: --slug <người | all> [--xem]'); process.exit(2); }
  const ds = dsNguoi().filter((x) => ai === 'all' || x.slug === ai); let hong = 0;
  if (!ds.length) { console.error(`✗ ${ai}: không có trong sổ người dùng được (hạng Rodden / lá số / bài site)`); process.exit(3); }
  for (const n of ds) { const r = await vietDai(n, { xem: process.argv.includes('--xem') });
    if (r.loi) { hong++; console.log(`✗ crd-${n.slug}:\n${r.loi.map((l) => `   · ${l}`).join('\n')}`); }
    else console.log(`✓ crd-${n.slug} · ${r.tap.cau.length} câu · ${r.tap.chuong.length} chương · giọng ước ${(r.tap.giay_uoc / 60).toFixed(1)} phút${r.tap.giay_uoc < 480 ? ' ⚠ dưới 8 phút' : ''}`); }
  console.log(`${ds.length - hong}/${ds.length} người đạt`); process.exit(hong && ai !== 'all' ? 1 : 0);
}
