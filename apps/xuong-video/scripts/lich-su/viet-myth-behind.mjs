#!/usr/bin/env node
// MÁY VIẾT "THE MYTH BEHIND" (G5 kênh Astrolas, 05/11/2026): một thiên thể → một Short 9:16 cho shot-code/la-so.html, cùng khuôn kể chuyện hoạt hình của
// Myths of the Zodiac (lớp vai nhân vật hình dán). 0đ khi đã có nhân vật (ve-nhan-vat.mjs vẽ một lần ~111₫ / nhân vật).
//   câu đặt tên + chuyện = câu NGUYÊN VĂN Wikipedia (la-so/than-thoai-sao/<sao>.json, nguon_moc) · câu về hành tinh = câu nguyên văn site (bài the-10-planets-in-astrology /
//   chiron-in-the-birth-chart) · vị trí trong lá số site của một người hạng AA (la-so/<người>.json) · hook = dòng đầu QC spy góc Hiểu bản thân (playlist know-yourself)
//   Dàn cảnh TỰ ĐỘNG từ moc[].nhan_vat: 1 người giữa · 2 người hai bên · 3 người ba chỗ; ai đã đứng thì giữ phía cũ; người bên phải quay mặt vào (lat).
//   node viet-myth-behind.mjs --sao saturn | all  [--goc-hook gh.json]
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, GOC_BOX } from './box3.mjs';
import { dangCongCu } from './nguon-site.mjs';
import { tachCanh, hookGon, hookNgan } from './chu-man.mjs';
import { tenNgan } from './viet-cap.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const KY = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Chiron: '⚷', Lilith: '⚸', Ceres: '⚳', Eris: '⯰' };
const THU = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const tg = (p) => relative(SHOT, join(DIR, p)), bam = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);

function layHook(goc) {
  const f = arg('goc-hook'); if (f) return JSON.parse(readFileSync(f, 'utf8'));
  const r = spawnSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 240s ../../node_modules/.bin/tsx scripts/may-dung.mts --may astrolas --goc-hook --goc ${goc}`], { encoding: 'utf8', maxBuffer: 16 << 20 });
  const dong = (r.stdout ?? '').trim().split('\n').reverse().find((l) => l.startsWith('{"goc"'));
  if (!dong) { console.error(`✗ không lấy được hook spy góc ${goc}`); process.exit(3); }
  return JSON.parse(dong);
}

/** câu đặt tên trên màn: câu dài / có chỗ ảnh biểu tượng bị rỗng (" , ") → cắt ở ranh giới mệnh đề đầu tiên sau 30 ký tự — vẫn là khúc NGUYÊN VĂN liền mạch */
export function catTen(chu) {
  if (chu.length <= 110 && !/\s,\s/.test(chu)) return chu.replace(/[.]$/, '');
  const m = /,\s|\sand has\s/.exec(chu.slice(30)); return m ? chu.slice(0, 30 + m.index) : chu.replace(/[.]$/, '');
}
/** câu site về thiên thể: câu đầu mục của bài the-10-planets-in-astrology ("Runs: …"), Chiron = câu "In practice…" của bài Chiron; không có thì null */
function cauSite(sao) {
  if (sao === 'Chiron') return { chu: doc('la-so/bai/chiron-in-the-birth-chart.json').mo.join(' ').match(/In practice, Chiron marks[^.]*\./)?.[0], bai: 'chiron-in-the-birth-chart' };
  const m = doc('la-so/bai/the-10-planets-in-astrology.json').muc.find((x) => new RegExp(`\\b${sao}$`).test(x.ten));
  const c = m?.doan[0].split(/(?<=\.)\s+/)[0]; return c ? { chu: c, bai: 'the-10-planets-in-astrology' } : null;
}
/** dàn cảnh: nhân vật mỗi câu → vai { ai, dang, x, y, cao, lat } — giữ phía cũ của ai đã đứng trên cảnh. Thuần. */
export function danCanh(moc, VE) {
  const CHO = { 1: [0.5], 2: [0.3, 0.7], 3: [0.2, 0.5, 0.8] }, truoc = new Map();
  return moc.map((m) => {
    const ai = [...new Set((m.nhan_vat ?? []).map((t) => VE[t]?.id).filter(Boolean))].slice(0, 3);
    const xs = CHO[ai.length] ?? [], xep = [...ai].sort((a, b) => (truoc.get(a) ?? 0.5) - (truoc.get(b) ?? 0.5));
    const vai = xep.map((id, i) => { const v = Object.values(VE).find((x) => x.id === id && x.loai) ?? {}, sinhVat = v.loai === 'sinh_vat';
      return { ai: id, dang: 'goc', x: xs[i], y: 0.66, cao: sinhVat ? 520 : ai.length === 3 ? 600 : 660, ...(xs[i] > 0.5 ? { lat: true } : {}) }; });
    truoc.clear(); for (const v of vai) truoc.set(v.ai, v.x);
    return vai;
  });
}

/** Short giữ cỡ Myths of the Zodiac đã duyệt (51–78 s): phần chuyện ≤ TRAN_CHUYEN ký tự — giữ câu đầu + câu cuối, bỏ câu giữa DÀI NHẤT trước. Thuần. */
const TRAN_CHUYEN = 400;
export function gonChuyen(moc) {
  const giu = moc.map((m, i) => ({ m, i })), dai = () => giu.reduce((s, x) => s + x.m.chu.length, 0);
  while (dai() > TRAN_CHUYEN && giu.length > 3) { const giua = giu.slice(1, -1).sort((a, b) => b.m.chu.length - a.m.chu.length)[0]; giu.splice(giu.indexOf(giua), 1); }
  return giu.map((x) => x.m);
}

function vietMot(tep, gh, nguoi) {
  const T0 = doc(tep), T = { ...T0, moc: gonChuyen(T0.moc) }, VE = doc('la-so/than-thoai-sao/_ve.json').ten, so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === 'know-yourself'), sao = T.sao;
  const hs = hookGon(gh.hooks.filter((h) => !/\d/.test(h.chu) && !/retrograde/i.test(h.chu))), hook = hs[bam(sao) % hs.length] ?? gh.hooks[0], chuHook = hookNgan(hook.chu);
  // người hạng AA có thiên thể này trong lá số site, xoay theo tên thiên thể
  const co = nguoi.filter((n) => doc(`la-so/${n.slug}.json`).sao.some((s) => s.ten === sao)), n = co.length ? co[bam(sao) % co.length] : null;
  const vi = n && doc(`la-so/${n.slug}.json`).sao.find((s) => s.ten === sao), A = n && (n.ten_ngan ?? tenNgan(n.ten)), site = cauSite(sao);
  const vai = danCanh(T.moc, VE), nv = Object.fromEntries([...new Set(vai.flat().map((v) => v.ai))].map((id) => [id, tg(`brand/astrolas/nhan-vat/${id}`)]));
  const cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: `${KY[sao] ?? ''}︎ ${sao}`, duoi: 'the myth behind the name', dong: [], vi: 'giua' } },
    ...(T.ten_goi?.loai === 'dat_ten' ? [{ nhin: { troi: 1 }, chu: `“${catTen(T.ten_goi.chu)}.”`, the: { lon: `${KY[sao] ?? ''}︎`, duoi: T.ten, dong: [], vi: 'tren' } }] : []),
    ...T.moc.map((m, i) => ({ nhin: { troi: 1 }, chu: m.chu, vai: vai[i] })),
    ...(site?.chu ? [{ nhin: n ? { toan: 1 } : { troi: 1 }, chu: `On Astrolas, ${sao} “${site.chu[0].toLowerCase()}${site.chu.slice(1).replace(/[.]$/, '')}.”` }] : []),
    ...(vi ? [{ nhin: { sao }, chu: `In ${A}'s chart, ${sao} sits in ${vi.cung}, in the ${THU(vi.nha)} house.` }] : []),
    { nhin: { troi: 1 }, khung: true, chu: `Where is ${sao} in your chart? Find it free at astrolas.com.` },
  ].map((q) => ({ ...q, tu: 0, den: 0 }));
  const tieuDe = `${chuHook} The myth behind ${sao}`;
  const tap = tachCanh({ _ghi: `The Myth Behind · ${sao} — sinh bởi lich-su/viet-myth-behind.mjs (chuyện ${T.nguon[0]}, câu site ${site?.bai ?? '—'}, lá số ${n?.slug ?? '—'}, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'myth-behind', playlist_ma: 'know-yourself', y_tuong: `my-${T.ma}`, tieu_de: tieuDe, goc: gh.goc, hook: { qc: hook.id, goc: hook.chu },
    nguon_moc: [tep], nguon_bai: site ? [site.bai] : [],
    dang: dangCongCu('birth', n?.slug ?? null, {}, `The myth behind ${sao}: ${T.ten}. Story: ${T.nguon.join(' · ')}${site ? ` · https://astrolas.com/en/blog/${site.bai}` : ''}`),
    nv, ...(n ? { la_so: tg(`la-so/${n.slug}.svg`) } : {}), nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'),
    playlist: { ten: pl.ten, mau: '#8EC5FF', ic: '☉' }, cau, DAI: 0 });
  const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  const thieuHinh = Object.keys(nv).filter((id) => !existsSync(join(DIR, `brand/astrolas/nhan-vat/${id}/goc.png`)));
  if (loi.length) { console.error(`✗ my-${T.ma}:\n${loi.map((l) => `   · ${l}`).join('\n')}`); return false; }
  const ra = join(SHOT, 'tap-astrolas', `my-${T.ma}.json`); mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
  console.log(`✓ ${relative(SHOT, ra)} · ${tap.cau.length} câu · ${tap.DAI}s · lá số ${n?.slug ?? '—'}${thieuHinh.length ? ` · ⚠ chưa vẽ: ${thieuHinh.join(', ')} (node ve-nhan-vat.mjs)` : ''}`);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ma = arg('sao'); if (!ma) { console.error('dùng: --sao <saturn | all>'); process.exit(2); }
  const ds = readdirSync(join(DIR, 'la-so/than-thoai-sao')).filter((f) => /^[a-z]+\.json$/.test(f) && (ma === 'all' || f === `${ma}.json`)).map((f) => `la-so/than-thoai-sao/${f}`);
  if (!ds.length) { console.error(`không có sổ chuyện ${ma}`); process.exit(2); }
  const S = doc('la-so/nguoi.json'), nguoi = S.nguoi.filter((x) => !x.khong_dung && S.rodden_dung_nha.includes(x.rodden) && existsSync(join(DIR, `la-so/${x.slug}.json`)));
  const gh = layHook(docSo().astrolas.playlist.find((p) => p.ma === 'know-yourself')?.goc_spy?.[0]?.id ?? 4313);
  let hong = 0; for (const t of ds) if (!vietMot(t, gh, nguoi)) hong++;
  console.log(`${ds.length - hong}/${ds.length} thiên thể đạt`); process.exit(hong ? 1 : 0);
}
