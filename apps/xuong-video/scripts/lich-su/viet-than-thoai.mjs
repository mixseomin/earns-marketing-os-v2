#!/usr/bin/env node
// MÁY VIẾT "MYTHS OF THE ZODIAC" (anh 05/11/2026: "mẫu kể chuyện giống kênh YNT với minh hoạ nhân vật, biểu tượng… chuyển động kiểu hoạt hình cơ bản"):
// một sổ chuyện (la-so/than-thoai/<cung>.json) → một Short 9:16 cho shot-code/la-so.html: nhân vật hình dán (lớp vai — vào / đi / đổi dáng / ra), chòm sao thật vẽ dần (chom).
// 0đ khi đã có nhân vật (vẽ một lần qua lich-su/kho-sinh.mts, ckey ~110₫ / dáng). Chuyện = câu NGUYÊN VĂN Wikipedia trong sổ (nguon_moc), lời về cung = câu nguyên văn site,
// hook = dòng đầu QC spy góc Hiểu bản thân (playlist know-yourself), bài đăng = mô tả Birth chart của site + link + bài 12 cung. Máy gác kiemTap chặn trước khi ghi.
//   node viet-than-thoai.mjs --cung leo [--kho-hook kho.json] [--hook-moi] [--ra <tệp>]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dangCongCu } from './nguon-site.mjs';
import { tachCanh, hookGon, hookNgan } from './chu-man.mjs';
import { docSo, kiemTap } from './kiem-so-kenh.mjs';
import { loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { chonHook, baoHook } from './hook-kenh.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), SHOT = join(DIR, '../shot-code'), doc = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const arg = (k, md) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : md; };
const KYC = { Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓' };

const cung = arg('cung'); if (!cung) { console.error('dùng: --cung <leo | …>'); process.exit(2); }
const tep = `la-so/than-thoai/${cung.toLowerCase()}.json`, T = doc(tep), so = docSo().astrolas, pl = so.playlist.find((p) => p.ma === 'know-yourself');
const { hook, chuHook, goc: gocHook } = chonHook('astrolas', 'know-yourself', `tt-${T.cung.toLowerCase()}`), tg = (p) => relative(SHOT, join(DIR, p));
const cau = [
  { nhin: { troi: 1 }, khung: true, chu: chuHook, the: { lon: `${KYC[T.cung]}︎ ${T.cung}`, duoi: 'the myth behind the sign', dong: [], vi: 'giua' } },
  ...T.moc.filter((m) => !m.chi_ban_dai).map((m) => ({ nhin: m.nhin ?? { troi: 1 }, chu: m.chu, vai: m.vai })),   // Short: nhịp chính; chi_ban_dai để bản dài
  ...T.site.map((s) => ({ nhin: { chom: T.cung }, chu: `“${s}”` })),
  { nhin: { troi: 1 }, khung: true, chu: `Are you a ${T.cung}? See your chart free at astrolas.com.` },
].map((q) => ({ ...q, tu: 0, den: 0 }));   // thời lượng do tachCanh tính theo lượng chữ
const tieuDe = `${chuHook} The myth behind ${T.cung}`;
const tap = tachCanh({ _ghi: `Myths of the Zodiac · ${T.cung} — sinh bởi lich-su/viet-than-thoai.mjs (chuyện ${T.nguon}, câu cung của site, hook QC spy #${hook.id})`,
  kenh: 'astrolas', mau: 'zodiac-myths', playlist_ma: 'know-yourself', y_tuong: `tt-${T.cung.toLowerCase()}`, tieu_de: tieuDe, goc: gocHook, hook: { qc: hook.id, goc: hook.chu },
  nguon_moc: [tep], nguon_bai: ['the-12-zodiac-signs-explained'],
  dang: dangCongCu('birth', null, {}, `The myth behind ${T.cung}: ${T.ten}. Story: ${T.nguon.split(' ')[0]} · the 12 signs explained: https://astrolas.com/en/blog/the-12-zodiac-signs-explained`),
  nv: Object.fromEntries(Object.entries(T.nhan_vat).map(([k, v]) => [k, tg(v)])), demo: arg('demo') ? true : undefined,
  nen: tg(pl.nen), logo: tg('brand/astrolas/logo/wordmark.png'), playlist: { ten: pl.ten, mau: '#8EC5FF', ic: '☉' }, DAI: cau.at(-1).den, cau });
const loi = [...kiemTap(tap, so, 'astrolas'), ...loiHook([tieuDe, chuHook], hook.chu).map((x) => `hook: ${x}`)];
if (loi.length) { console.error(`✗ ${T.cung}:\n${loi.map((l) => `   · ${l}`).join('\n')}`); process.exit(1); }
const ra = arg('ra', join(SHOT, 'tap-astrolas', `tt-${T.cung.toLowerCase()}.json`)); mkdirSync(dirname(ra), { recursive: true });
writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n'); console.log(`✓ ${relative(SHOT, ra)} · ${tap.cau.length} câu · ${tap.DAI}s · hook "${chuHook.slice(0, 50)}"`);
