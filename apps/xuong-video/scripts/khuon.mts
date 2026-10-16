// KHUÔN VIDEO từ dòng lệnh (src/lib/xuong-video/khuon.ts) — cửa cho máy bên ngoài studio (puzzle-books trên iMac / MacBook đi qua ssh).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/khuon.mts <lệnh>
//   --nap                  (0đ) đọc JSON đề từ stdin ([{du_an, khuon, slug, chu_de, de, dang}]) → xv_khuon (đề đổi thì bản xuất cũ bỏ)
//   --ds <du_an>           (0đ) in JSON { slug: { file_url, title, description, link, book, words, kieu } } — bên đăng đọc thay manifest.json cũ
//   --xuat <slug|all-chua> (0đ) dựng MP4 (ffmpeg trên box3) → R2. all-chua = mọi video chưa có bản xuất của --du-an
//   --nen <chu_de> --du-an <du_an> [--prompt "…"]   TỐN TIỀN (~110₫/ảnh, chuỗi cổng rẻ): ảnh nền cho một chủ đề — cần DUYET_SINH_1_LAN=1
import { getDb } from '@mos2/db';
import { dsKhuon, napDe, sinhNenKhuon, xuatKhuon } from '../src/lib/xuong-video/khuon';
import { chotTien } from '../src/lib/xuong-video/chot-tien';

const a = process.argv.slice(2), lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] ?? '' : null; };
const db = getDb(); if (!db) { console.error('thiếu DATABASE_URL'); process.exit(1); }

if (a.includes('--nap')) {
  let raw = ''; for await (const c of process.stdin) raw += c;
  const ds = JSON.parse(raw);
  if (!Array.isArray(ds) || !ds.length) { console.error('stdin phải là mảng đề'); process.exit(1); }
  console.log(JSON.stringify(await napDe(db, ds)));
} else if (lay('--ds') != null) {
  const ra: Record<string, unknown> = {};
  for (const k of await dsKhuon(db, lay('--ds')!)) ra[k.slug] = { file_url: k.file_url, xuat_luc: k.xuat_luc, nen: !!k.nen_url, ...k.dang, kieu: 'an', khuon: k.khuon };
  process.stdout.write(JSON.stringify(ra));
} else if (lay('--xuat') != null) {
  const muc = lay('--xuat')!, duAn = lay('--du-an') ?? 'puzzle-books';
  const ds = (await dsKhuon(db, duAn)).filter((k) => (muc === 'all-chua' ? !k.file_url : muc === 'all' ? true : k.slug === muc));
  if (!ds.length) { console.error(`không có video khuôn khớp "${muc}" (dự án ${duAn})`); process.exit(1); }
  let hong = 0;
  for (const k of ds) {
    const t = Date.now(), r = await xuatKhuon(db, k.id);
    console.log(r.ok ? `✓ ${k.slug} ${((Date.now() - t) / 1000).toFixed(1)}s ${r.url}` : `✗ ${k.slug}: ${r.loi}`); if (!r.ok) hong++;
  }
  if (hong) process.exit(1);
} else if (lay('--nen') != null) {
  const chuDe = lay('--nen')!, duAn = lay('--du-an') ?? 'puzzle-books';
  chotTien(`ảnh nền khuôn · ${chuDe}`, { cents: 0.5 });
  const r = await sinhNenKhuon(db, duAn, chuDe, lay('--prompt') ?? undefined);
  console.log(r.ok ? `✓ nền ${chuDe}: ${r.url} (${r.vnd ?? '?'}₫)` : `✗ ${r.loi}`);
  if (!r.ok) process.exit(1);
} else { console.error('dùng: khuon.mts --nap < de.json | --ds <du_an> | --xuat <slug|all-chua|all> [--du-an x] | --nen <chu_de> --du-an x [--prompt …]'); process.exit(2); }
process.exit(0);
