// TRANG ĐIỂM PAGE FACEBOOK (anh 29/10/2026: "trang điểm lại page này cho đẹp. Avatar phải có hình thật cho hấp dẫn (sửa code + chuẩn)").
// Một chỗ cho mọi Page gắn vào máy đăng: ảnh đại diện = ẢNH THẬT Pexels cắt vuông (không chữ trên nền màu phẳng — luật nền lớn = ảnh thật),
// ảnh bìa 1640×624 = ảnh thật dưới lớp màu thương hiệu chuyển dần từ trái + tên + câu phụ trong vùng an toàn điện thoại (x 300–1340).
// Ảnh gốc + link trang nguồn lưu cạnh bản dựng ở thư mục ra (mặc định /root/trang-diem/<page_id>/) — dựng lại ra y hệt.
// Đặt lên Page: dang-fb-reel.mts › datAnhPage (cùng sổ token + kiểm danh tính token ↔ Page như lượt đăng); token thiếu pages_manage_metadata → mã thoát 3,
// ảnh vẫn nằm ở thư mục ra để đặt bằng trình duyệt quản trị Page, xong chạy --kiem (Trust Reviews 29/10/2026 đặt theo đường này).
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && ../../node_modules/.bin/tsx scripts/trang-diem-page.mts \
//     --page 537626083113751 --anh 5149759 --bia 6519935 --chu "EMT Exam Prep" --phu "NREMT practice questions, explained" --mau B3261E \
//     [--tam-anh 0.5,0.5] [--tam-bia 0.5,0.5] [--xem]      (--xem: chỉ dựng ảnh, không đặt lên Page)
//   ... --kiem <page_id>    Page đã đủ ảnh đại diện + ảnh bìa chưa (thiếu → mã thoát 1)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { datAnhPage, kiemAnhPage } from './dang-fb-reel.mts';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const FONT = path.resolve(import.meta.dirname, '../public/fonts');
const a = process.argv.slice(2), lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };

/** Toạ độ tâm cắt "x,y" (0–1) → [x, y]; sai khuôn thì ném. */
export const docTam = (s = '0.5,0.5'): [number, number] => {
  const [x, y] = s.split(',').map(Number);
  if (!(x! >= 0 && x! <= 1 && y! >= 0 && y! <= 1)) throw new Error(`tâm cắt "${s}" phải là x,y trong 0–1`);
  return [x!, y!];
};
/** Lọc ffmpeg cắt ảnh về đúng W×H quanh tâm (phủ kín, không méo). */
export const catPhu = (W: number, H: number, [x, y]: [number, number]) =>
  `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})*${x}:(ih-${H})*${y}`;
/** Mép phải ước của khối chữ bìa (x bắt đầu 300; Montserrat Black 84px ~52px/ký tự, Atkinson Bold 40px ~21px/ký tự). */
export const mepChu = (chu: string, phu: string) => 300 + Math.max(chu.length * 52, phu.length * 21);
/** Chữ an toàn cho drawtext (bỏ ký tự ffmpeg hiểu là cú pháp). */
const chuFf = (s: string) => s.replace(/\\/g, '').replace(/'/g, '\u2019').replace(/:/g, '\\:').replace(/%/g, '\\%');

async function taiPexels(id: string, ra: string): Promise<{ tep: string; trang: string }> {
  const key = process.env.PEXELS_KEY; if (!key) throw new Error('thiếu PEXELS_KEY — không trang điểm Page thiếu ảnh thật');
  const r = await fetch(`https://api.pexels.com/v1/photos/${id}`, { headers: { Authorization: key, 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`Pexels ${r.status} cho ảnh ${id}`);
  const p = (await r.json()) as { url: string; src: { original: string } };
  const b = await fetch(`${p.src.original}?auto=compress&w=2400`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) });
  if (!b.ok) throw new Error(`tải ảnh Pexels ${id}: ${b.status}`);
  const tep = path.join(ra, `goc-${id}.jpg`); writeFileSync(tep, Buffer.from(await b.arrayBuffer()));
  return { tep, trang: p.url };
}

const ff = (args: string[]) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });

export function dungDaiDien(goc: string, ra: string, tam: [number, number]) {
  const tep = path.join(ra, 'dai-dien.jpg'); ff(['-i', goc, '-vf', catPhu(960, 960, tam), '-q:v', '2', tep]); return tep;
}
export function dungBia(goc: string, ra: string, tam: [number, number], chu: string, phu: string, mau: string) {
  const tep = path.join(ra, 'bia.jpg'), [r, g, b] = [0, 2, 4].map((i) => parseInt(mau.slice(i, i + 2), 16));
  // lớp màu thương hiệu: đặc 75% bên trái (90% thì ảnh mất dưới màu), tan dần theo MÉP PHẢI CỦA CHỮ (đặc tới mép − 500, hết ở mép + 200) — chữ dài vẫn nằm trên màu,
  // ảnh thật lộ rõ phần còn lại (29/10/2026: cố định tan ở x 1150 làm "Healthcare Exam Prep" rơi chữ cuối ra nền sáng)
  const mep = mepChu(chu, phu), lop = `color=c=black:s=1640x624,format=rgba,geq=r=${r}:g=${g}:b=${b}:a='190*clip(1-(X-${mep - 500})/700\\,0\\,1)'`;
  const vf = [`[0:v]${catPhu(1640, 624, tam)}[nen]`, `${lop}[lop]`, '[nen][lop]overlay=0:0[x]',
    `[x]drawtext=fontfile='${FONT}/Montserrat-Black.ttf':text='${chuFf(chu)}':fontsize=84:fontcolor=white:x=300:y=(h/2)-90:shadowcolor=black@0.35:shadowx=2:shadowy=2,` +
    `drawtext=fontfile='${FONT}/AtkinsonHyperlegible-Bold.ttf':text='${chuFf(phu)}':fontsize=40:fontcolor=white:x=304:y=(h/2)+18[ra]`].join(';');
  ff(['-i', goc, '-filter_complex', vf, '-map', '[ra]', '-frames:v', '1', '-q:v', '2', tep]); return tep;
}

if (a[0] === '--tu-kiem') {
  const t = (await import('node:assert')).strict;
  t.deepEqual(docTam(), [0.5, 0.5]); t.deepEqual(docTam('0.2,0.8'), [0.2, 0.8]); t.throws(() => docTam('2,0.5'), /0–1/);
  t.equal(catPhu(960, 960, [0.5, 0.5]), 'scale=960:960:force_original_aspect_ratio=increase,crop=960:960:(iw-960)*0.5:(ih-960)*0.5');
  t.equal(chuFf("EMT: 100% it's"), 'EMT\\: 100\\% it\u2019s');
  t.equal(mepChu('EMT Exam Prep', ''), 976); t.ok(mepChu('Healthcare Exam Prep', 'NREMT · PTCB · TEAS practice questions, explained') > 1300, 'chữ dài kéo lớp màu');
  console.log('trang-diem-page: 7/7 ok'); process.exit(0);
}
if (a[0] === '--kiem') {
  const k = await kiemAnhPage(a[1]!); console.log(JSON.stringify(k));
  process.exit(k.co_dai_dien && k.co_bia ? 0 : 1);
}
const page = lay('--page'), anh = lay('--anh'), bia = lay('--bia'), chu = lay('--chu'), phu = lay('--phu') ?? '', mau = (lay('--mau') ?? '').replace('#', '');
if (!page || !anh || !bia || !chu || !/^[0-9a-fA-F]{6}$/.test(mau)) {
  console.error('dùng: trang-diem-page.mts --page <id> --anh <pexels id> --bia <pexels id> --chu "<tên>" [--phu "<câu phụ>"] --mau <RRGGBB> [--tam-anh x,y] [--tam-bia x,y] [--xem] | --kiem <id> | --tu-kiem');
  process.exit(2);
}
const ra = lay('--ra') ?? `/root/trang-diem/${page}`; mkdirSync(ra, { recursive: true });
const [ga, gb] = [await taiPexels(anh, ra), await taiPexels(bia, ra)];
const tepA = dungDaiDien(ga.tep, ra, docTam(lay('--tam-anh'))), tepB = dungBia(gb.tep, ra, docTam(lay('--tam-bia')), chu, phu, mau);
writeFileSync(path.join(ra, 'nguon.json'), JSON.stringify({ page, dai_dien: { pexels: anh, trang: ga.trang }, bia: { pexels: bia, trang: gb.trang }, chu, phu, mau, luc: new Date().toISOString() }, null, 1));
console.log(`✓ dựng ${tepA} + ${tepB}`);
if (a.includes('--xem')) process.exit(0);
// token thiếu pages_manage_metadata (#283 — app Kenh Social Poster 29/10/2026 chưa có quyền này trong danh sách Explorer): ảnh đã dựng xong ở `ra`,
// đặt bằng phiên trình duyệt quản trị Page (Profile picture actions → Choose profile picture; Add cover photo → Upload photo), rồi chạy --kiem
const kq = await datAnhPage(page, { daiDien: tepA, bia: tepB }).catch((e: Error) => {
  if (/\(#283\)|pages_manage_metadata/.test(e.message)) { console.error(`✗ token Page thiếu quyền pages_manage_metadata — ảnh đã dựng: ${tepA} · ${tepB}; đặt bằng trình duyệt quản trị Page rồi chạy --kiem ${page}`); process.exit(3); }
  throw e;
});
console.log(`✓ đã đặt lên Page ${page}: ${JSON.stringify(kq)}`);
const k = await kiemAnhPage(page); console.log(`· kiểm lại: ${JSON.stringify(k)}`); process.exit(k.co_dai_dien && k.co_bia ? 0 : 1);
