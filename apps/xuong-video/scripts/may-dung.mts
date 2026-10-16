// PHIM MÁY DỰNG từ dòng lệnh (src/lib/xuong-video/may-dung.ts) — cửa cho máy ngoài studio (puzzle-books trên iMac / MacBook đi qua ssh).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts <lệnh>
//   --nap                    (0đ) đọc JSON đề từ stdin ([{du_an, mau, slug, chu_de, de, dang}]) → phim thể loại Máy Dựng (+ tập + 3 shot)
//   --ds <du_an>             (0đ) in JSON { slug: { phim_id, tap_id, file_url, xuat_luc, title, description, link, … } } — bên đăng đọc
//   --xuat <slug|all-chua|all> [--du-an x]   (0đ) ⬇ Xuất như nút của tập: bản dựng + keyframe / clip từng shot (ghi bản xuất của tập)
//   --xem-truoc <slug|all-thieu> [--du-an x]  (0đ) keyframe xem trước từng shot (một khung qua bộ lọc bản dựng) — all-thieu: phim còn shot chưa có khung
//   --nen <slug> [--prompt "…"]               TỐN TIỀN (~65–110₫/ảnh, chuỗi cổng rẻ): ảnh nền cho phim — cần DUYET_SINH_1_LAN=1
import { getDb } from '@mos2/db';
import { dsMayDungDang, khungXemTruoc, napDe, sinhNenMayDung } from '../src/lib/xuong-video/may-dung';
import { batDauXuatTap } from '../src/lib/xuong-video/xuat-tap';
import { chotTien } from '../src/lib/xuong-video/chot-tien';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { sql } from 'drizzle-orm';

const a = process.argv.slice(2), lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] ?? '' : null; };
const db = getDb(); if (!db) { console.error('thiếu DATABASE_URL'); process.exit(1); }

if (a.includes('--nap')) {
  let raw = ''; for await (const c of process.stdin) raw += c;
  const ds = JSON.parse(raw);
  if (!Array.isArray(ds) || !ds.length) { console.error('stdin phải là mảng đề'); process.exit(1); }
  console.log(JSON.stringify(await napDe(db, ds)));
} else if (lay('--ds') != null) {
  process.stdout.write(JSON.stringify(await dsMayDungDang(db, lay('--ds')!)));
} else if (lay('--xuat') != null) {
  const muc = lay('--xuat')!, duAn = lay('--du-an') ?? 'puzzle-books';
  const ds = Object.entries(await dsMayDungDang(db, duAn)).filter(([slug, x]) => (muc === 'all-chua' ? !x.file_url : muc === 'all' ? true : slug === muc));
  if (!ds.length) { console.error(`không có phim Máy Dựng khớp "${muc}" (dự án ${duAn})`); process.exit(1); }
  let hong = 0;
  for (const [slug, x] of ds) {
    const tapId = Number(x.tap_id), t = Date.now();
    const canh = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
    const r = await batDauXuatTap(db, tapId, canh);
    if (!r.ok) { console.log(`✗ ${slug}: ${r.loi}`); hong++; continue; }
    const k = await r.chay();
    console.log(k.loi ? `✗ ${slug}: ${k.loi}` : `✓ ${slug} ${((Date.now() - t) / 1000).toFixed(1)}s (phim #${x.phim_id})`); if (k.loi) hong++;
  }
  if (hong) process.exit(1);
} else if (lay('--xem-truoc') != null) {
  const muc = lay('--xem-truoc')!, ds = await dsMayDungDang(db, lay('--du-an') ?? 'puzzle-books');
  const thieu = new Set(((await db.execute(sql`SELECT DISTINCT tap_id FROM xv_canh WHERE keyframe_url IS NULL OR keyframe_url = ''`)) as unknown as Row[]).map((r) => Number(r.tap_id)));
  let hong = 0;
  for (const [slug, x] of Object.entries(ds)) {
    if (x.tap_id == null || (muc === 'all-thieu' ? !thieu.has(Number(x.tap_id)) : slug !== muc)) continue;
    const loi = await khungXemTruoc(db, Number(x.tap_id));
    console.log(loi.length ? `✗ ${slug}: ${loi.join(' · ')}` : `✓ ${slug} (phim #${x.phim_id})`); if (loi.length) hong++;
  }
  if (hong) process.exit(1);
} else if (lay('--nen') != null) {
  const slug = lay('--nen')!, duAn = lay('--du-an') ?? 'puzzle-books';
  const x = (await dsMayDungDang(db, duAn))[slug];
  if (!x) { console.error(`không có phim Máy Dựng "${slug}"`); process.exit(1); }
  chotTien(`ảnh nền khuôn · ${slug}`, { cents: 0.5 });
  const r = await sinhNenMayDung(db, Number(x.phim_id), lay('--prompt') ?? undefined);
  console.log(r.ok ? `✓ nền ${slug}: ${r.url} (${r.vnd ?? '?'}₫) — ⬇ Xuất lại để nền vào bản dựng` : `✗ ${r.loi}`);
  if (!r.ok) process.exit(1);
} else { console.error('dùng: may-dung.mts --nap < de.json | --ds <du_an> | --xuat <slug|all-chua|all> [--du-an x] | --xem-truoc <slug|all-thieu> | --nen <slug> [--prompt …]'); process.exit(2); }
process.exit(0);
