// MÁY → VIDEO từ dòng lệnh (src/lib/xuong-video/may.ts) — cửa cho máy ngoài studio (puzzle-books trên iMac / MacBook đi qua ssh). Mọi lệnh 0đ.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts [--may <mã máy>] <lệnh>
//   (--may mặc định front-porch-only-one)
//   --nap                          đọc JSON đề từ stdin ([{slug, chu_de, de, dang}]) → video của máy (đề đổi thì video cũ bỏ, xuất lại)
//   --ds [--ca-luu-tru]            in JSON { slug: { id, file_url, xuat_luc, da_dang, title, description, link, book, … } } — bên đăng / bên đọc số
//   --xuat <slug|all-chua>         dựng video (MP4 + 3 khung) cho một slug, hoặc mọi video đang dùng chưa có video
//   --ghi-dang <slug> <nền>        stdin JSON { url, ngay, luc?, binhLuan? } → sổ đăng của video (gộp vào lượt đã có)
//   --nguon                        stdin JSON { dung, tong, mo_ta? } → số của nguồn đề
import { getDb } from '@mos2/db';
import { dsVideoDang, ghiDang, ghiNguon, napVideo, xuatVideo } from '../src/lib/xuong-video/may';

const a = process.argv.slice(2), lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] ?? '' : null; };
const db = getDb(); if (!db) { console.error('thiếu DATABASE_URL'); process.exit(1); }
const ma = lay('--may') ?? 'front-porch-only-one';
const docStdin = async () => { let raw = ''; for await (const c of process.stdin) raw += c; return JSON.parse(raw); };

if (a.includes('--nap')) {
  const ds = await docStdin();
  if (!Array.isArray(ds) || !ds.length) { console.error('stdin phải là mảng đề'); process.exit(1); }
  console.log(JSON.stringify(await napVideo(db, ma, ds)));
} else if (a.includes('--ds')) {
  process.stdout.write(JSON.stringify(await dsVideoDang(db, ma, a.includes('--ca-luu-tru'))));
} else if (lay('--xuat') != null) {
  const muc = lay('--xuat')!, ds = Object.entries(await dsVideoDang(db, ma)).filter(([slug, x]) => (muc === 'all-chua' ? !x.file_url : slug === muc));
  if (!ds.length) { console.error(muc === 'all-chua' ? 'không còn video nào chưa dựng' : `không có video "${muc}" (đang dùng) trong máy ${ma}`); process.exit(muc === 'all-chua' ? 0 : 1); }
  let hong = 0;
  for (const [slug, x] of ds) {
    const t = Date.now(), r = await xuatVideo(db, Number(x.id));
    console.log(r.ok ? `✓ ${slug} ${((Date.now() - t) / 1000).toFixed(1)}s` : `✗ ${slug}: ${r.loi}`); if (!r.ok) hong++;
  }
  if (hong) process.exit(1);
} else if (lay('--ghi-dang') != null) {
  const i = a.indexOf('--ghi-dang'), slug = a[i + 1], nen = a[i + 2];
  if (!slug || !nen) { console.error('dùng: --ghi-dang <slug> <nền> < x.json'); process.exit(2); }
  if (!(await ghiDang(db, ma, slug, nen, await docStdin()))) { console.error(`không có video "${slug}" trong máy ${ma}`); process.exit(1); }
  console.log(`✓ sổ đăng ${slug} · ${nen}`);
} else if (a.includes('--nguon')) {
  await ghiNguon(db, ma, await docStdin()); console.log('✓ nguồn');
} else { console.error('dùng: may-dung.mts [--may mã] --nap < de.json | --ds [--ca-luu-tru] | --xuat <slug|all-chua> | --ghi-dang <slug> <nền> < x.json | --nguon < n.json'); process.exit(2); }
process.exit(0);
