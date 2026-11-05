#!/usr/bin/env node
// MÁY VIẾT "SIGN × SIGN" (G5 kênh Astrolas, 05/11/2026): một cặp cung Mặt Trời → một Short 9:16 cho shot-code/la-so.html (vòng hoàng đạo trơn, hai cung sáng).
// 0đ, không AI: chữ là câu NGUYÊN VĂN bài ghép cung của site (la-so/cung-cap.json, 78 bài /en/blog/<a>-and-<b>-compatibility) theo mục —
// câu hỏi "Is … a good match?" · The core dynamic · Where it clicks · Where it clashes · How to make it work · câu trả lời đầu của Questions people ask.
// Hook = dòng đầu QC spy góc Tình yêu (playlist love-compatibility › goc_spy). Bài đăng = mô tả công cụ Compatibility của site + link + link bài.
//   node viet-sign.mjs --cap sx-leo-sagittarius [--goc-hook gh.json] [--ra <tệp>]   · --cap all = đủ 78 cặp
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, GOC_BOX } from './box3.mjs';
import { dangCongCu } from './nguon-site.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook, sachHook } from '../../src/lib/xuong-video/hook-qc.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const CUNG = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const KYC = Object.fromEntries(CUNG.map((c, i) => [c, '♈♉♊♋♌♍♎♏♐♑♒♓'[i] + '︎']));
const hoa = (s) => s[0].toUpperCase() + s.slice(1);
const cauDau = (p) => (p ?? '').split(/(?<=[.!?])\s+/)[0];
// tên mục của bài khác nhau giữa các bài ("Where it clicks" / "What works") — mỗi vai một danh sách tên, tên đầu khớp thì dùng
const VAI = { loi: [/core dynamic|between you|how these two signs relate/i], hop: [/where it clicks|what works/i], vuong: [/where it clashes|what rubs/i], lam: [/how to make it work|making it last/i] };
// tên lạ ("The good part", "Strengths", "What flows"…) → lấy theo VỊ TRÍ: mọi bài cùng khuôn 11 mục (quan hệ · yêu · sống chung · bạn · công việc · hợp · vướng · cách làm ·
// Beyond Sun signs · Questions · Compare) — chỉ khi đúng khuôn đó (mục 9 là Beyond Sun signs), không thì báo thiếu
const VI_TRI = { loi: 0, hop: 5, vuong: 6, lam: 7 };
const lay = (b, vai) => b.muc.find((m) => VAI[vai].some((re) => re.test(m.ten))) ?? (b.muc.length === 11 && /beyond sun signs/i.test(b.muc[8].ten) ? b.muc[VI_TRI[vai]] : undefined);

function layHook(goc) {
  if (arg('goc-hook')) return JSON.parse(readFileSync(arg('goc-hook'), 'utf8'));
  const r = spawnSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && NODE_OPTIONS=--conditions=react-server timeout 240s ../../node_modules/.bin/tsx scripts/may-dung.mts --may astrolas --goc-hook --goc ${goc}`], { encoding: 'utf8', maxBuffer: 16 << 20 });
  const dong = (r.stdout ?? '').trim().split('\n').reverse().find((l) => l.startsWith('{"goc"'));
  if (!dong) { console.error(`✗ không lấy được hook spy góc ${goc}`); process.exit(3); }
  return JSON.parse(dong);
}

function vietMot(b, gh, ra) {
  const A = hoa(b.a), B = hoa(b.b), so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === 'love-compatibility');
  const hoi = [...b.mo, ...b.muc.map((m) => m.ten)].flatMap((x) => x.split(/(?<=\?)\s+/)).find((x) => /^Is .+ (a )?good match\?$/i.test(x.trim()))?.trim();
  const tra = b.muc.find((m) => /questions people ask/i.test(m.ten))?.doan[0];
  const [loi, hop, vuong, lam] = ['loi', 'hop', 'vuong', 'lam'].map((v) => lay(b, v));
  if (!loi || !hop || !vuong) { console.error(`✗ ${b.ma}: bài thiếu mục cốt lõi / hợp / vướng (${b.muc.map((m) => m.ten).join(' | ')})`); return false; }
  const hs = gh.hooks.filter((h) => !/\d/.test(h.chu) && !/retrograde/i.test(h.chu)), iA = CUNG.indexOf(A), iB = CUNG.indexOf(B);
  const hook = hs[(iA * 12 + iB) % hs.length] ?? gh.hooks[0], chuHook = sachHook(hook.chu).replace(/\s*[\u{1F300}-\u{1FAFF}☀-➿]+\s*$/u, '');
  const vong = A === B ? { toan: 1 } : { cap_cung: [A, B] }, q = (s) => `“${s.replace(/[.]$/, '')}.”`;
  const cau = [
    { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: `${KYC[A]} × ${KYC[B]}`, duoi: `${A} × ${B}`, dong: [], vi: 'giua' } },
    ...(hoi ? [{ nhin: vong, chu: `“${hoi}”` }] : []),   // câu hỏi của site — không có thì vào thẳng câu cốt lõi
    { nhin: vong, chu: q(cauDau(loi.doan[0])) },
    { nhin: vong, chu: `“${hop.ten}”: ${q(cauDau(hop.doan[0]))}` },
    { nhin: vong, chu: `“${vuong.ten}”: ${q(cauDau(vuong.doan[0]))}` },
    ...(lam ? [{ nhin: { troi: 1 }, chu: q(cauDau(lam.doan[0])) }] : []),
    ...(hoi && tra ? [{ nhin: { troi: 1 }, chu: q(cauDau(tra)) }] : []),   // câu trả lời chỉ đi cùng câu hỏi của nó
    { nhin: { troi: 1 }, khung: true, chu: '“Beyond Sun signs”:<br>compare your charts free at astrolas.com.' },
  ].map((x, i) => ({ ...x, tu: i * 4.4, den: (i + 1) * 4.4 }));
  const tieuDe = `${chuHook} ${A} and ${B} compatibility`;
  const tg = (p) => relative(SHOT, p);
  const tap = { _ghi: `Sign × Sign · ${A} × ${B} — sinh bởi lich-su/viet-sign.mjs (chữ nguyên văn ${b.url}, hook QC spy #${hook.id})`,
    kenh: 'astrolas', mau: 'sign-x-sign', playlist_ma: 'love-compatibility', y_tuong: b.ma, tieu_de: tieuDe, goc: gh.goc, hook: { qc: hook.id, goc: hook.chu },
    dang: dangCongCu('compatibility', null, {}, `${A} and ${B} compatibility. Read the full guide: ${b.url}`),
    la_so: tg(join(DIR, 'la-so/steve-jobs.svg')), chi_vong: true, nen: tg(join(DIR, 'brand/astrolas/anh/troi.jpg')), logo: tg(join(DIR, 'brand/astrolas/logo/wordmark.png')),
    playlist: { ten: pl.ten, mau: '#FF8FB1', ic: '♡' }, DAI: cau.at(-1).den, cau };
  const loiTap = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
  if (loiTap.length) { console.error(`✗ ${b.ma}:\n${loiTap.map((l) => `   · ${l}`).join('\n')}`); return false; }
  mkdirSync(dirname(ra), { recursive: true }); writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
  console.log(`✓ ${relative(SHOT, ra)} · ${cau.length} câu · hook "${chuHook.slice(0, 40)}"`);
  return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ma = arg('cap'); if (!ma) { console.error('dùng: --cap <sx-a-b | all>'); process.exit(2); }
  const ds = doc('la-so/cung-cap.json').cap.filter((x) => ma === 'all' || x.ma === ma); if (!ds.length) { console.error(`không có cặp ${ma}`); process.exit(2); }
  const so = docSo().astrolas, goc = so.playlist.find((p) => p.ma === 'love-compatibility')?.goc_spy?.[0]?.id ?? 4314, gh = layHook(goc);
  let hong = 0; for (const b of ds) if (!vietMot(b, gh, arg('ra', join(SHOT, 'tap-astrolas', `${b.ma}.json`)))) hong++;
  console.log(`${ds.length - hong}/${ds.length} cặp đạt`); process.exit(hong ? 1 : 0);
}
