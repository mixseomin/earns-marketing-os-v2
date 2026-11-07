#!/usr/bin/env node
// LƯU KHO SAU KHI ĐĂNG (08/11/2026, anh: "phim gốc đăng rồi thì đẩy lên Drive cho giảm chi phí R2… iMac không thiếu ổ triệt để"). Chạy trên iMac:
//   node luu-kho.mjs --kenh <khoá kenh.json> [--chi <slug>] [--ngay N (thay sau_ngay, để thử)] [--xem]
// Kênh bật bằng kenh.json › <kênh>.luu_kho = { drive: "Studio/YNT", sau_ngay: 7 } — kênh không khai thì không làm gì.
// "Đã đăng" = đã lên MỌI nền máy được khai đăng (may-dung --may-info › dang[]), lấy thẳng từ cấu hình máy đăng — 08/11/2026 khai tay ["youtube"]
// trong khi máy YNT còn Page Facebook chưa đăng → một tập bị chuyển kho sớm (đã lấy lại bằng --lay-lai).
//   node luu-kho.mjs --kenh <kênh> --lay-lai <slug>   kéo bản đã chuyển kho từ Drive về lại đúng chỗ cũ trên R2, bỏ dấu kho_drive trong sổ
//   Nhịp 1 · tập đã lên MỌI nền trong luu_kho.nen: xoá video trên iMac (bản cuối, hình trung gian, bản phát hành, bản xem) — tài sản tập giữ lại.
//   Nhịp 2 · đã lên đủ `sau_ngay` ngày: chép bản phát hành từ R2 + bìa + tài sản tập lên Google Drive (rclone remote `gdrive`), so kích thước từng tệp,
//            khớp hết mới xoá bản R2 (box3 luu-kho.mts, ghi đường Drive vào sổ Studio) rồi xoá thư mục tập trên iMac. Lệch một tệp = dừng tập đó, không xoá gì.
// lam-tap.mjs / lam-dai.mjs gọi cuối mỗi lượt làm tập (không có tiến trình nền riêng).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boxA } from './box3.mjs';

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; }, xem = process.argv.includes('--xem');
const DIR = dirname(fileURLToPath(import.meta.url)), KHO = join(process.env.HOME, '.cache/lich-su'), kenhId = arg('kenh');
const KENH = JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'))[kenhId ?? ''], CH = KENH?.luu_kho;
if (!KENH?.may) { console.error(`✗ kênh "${kenhId}" không có máy đăng`); process.exit(2); }
if (!CH?.drive) { console.log(`· kênh ${kenhId} chưa bật lưu kho (kenh.json › luu_kho) — bỏ qua`); process.exit(0); }
const NGAY = arg('ngay') != null ? Number(arg('ngay')) : CH.sau_ngay ?? 7, REMOTE = CH.remote ?? 'gdrive';
const ds = JSON.parse((await boxA(`scripts/may-dung.mts --may ${KENH.may} --ds --ca-luu-tru`)).split('\n').pop());
const NEN = [...new Set((JSON.parse((await boxA(`scripts/may-dung.mts --may ${KENH.may} --may-info`)).split('\n').pop()).dang ?? []).map((d) => d.nen))];
if (!NEN.length) { console.error(`✗ máy ${KENH.may} không khai nền đăng nào — không chuyển kho`); process.exit(3); }
const rc = (...a) => execFileSync('rclone', a, { encoding: 'utf8', maxBuffer: 64 << 20 });
const coDrive = (dich) => { try { return JSON.parse(rc('lsjson', dich))[0]?.Size ?? -1; } catch { return -1; } };
const coUrl = (u) => Number(/content-length:\s*(\d+)/gi.exec(execFileSync('curl', ['-sIL', u], { encoding: 'utf8' }))?.[1] ?? -1);
// LẤY LẠI: Drive → box3 → đúng khoá R2 cũ (cùng URL) — khi một nền còn cần tệp sau khi đã chuyển kho
if (arg('lay-lai')) { const slug = arg('lay-lai'), v = ds[slug]; if (!v?.kho_drive) { console.error(`✗ ${slug} chưa chuyển kho`); process.exit(4); }
  const tam = join(KHO, '_lay-lai', slug), bt = `/var/tmp/lay-lai-${slug}`, cap = [v.file_url, v.thumb].filter(Boolean).map((u) => ({ u, ten: u.split('?')[0].split('/').pop() }));
  for (const c of cap) rc('copyto', `${v.kho_drive}/${c.ten}`, join(tam, c.ten));
  execFileSync('ssh', ['root@167.233.241.16', `rm -rf ${bt} && mkdir -p ${bt}`]); execFileSync('scp', ['-q', ...cap.map((c) => join(tam, c.ten)), `root@167.233.241.16:${bt}/`]);
  console.log((await boxA(`scripts/lich-su/luu-kho.mts --may ${KENH.may} --slug ${slug} --tra ${cap.map((c) => `'${bt}/${c.ten}=${c.u}'`).join(' ')}`)).split('\n').pop());
  rmSync(tam, { recursive: true, force: true }); process.exit(0); }
let mb1 = 0, tap2 = 0;
for (const [slug, v] of Object.entries(ds)) {
  if (arg('chi') && slug !== arg('chi')) continue;
  const len = NEN.map((n) => v.da_dang?.[n]?.luc).filter(Boolean);
  if (len.length < NEN.length) continue;   // chưa lên đủ mọi nền — còn có thể cần bản trên máy
  const thu = join(KHO, slug);
  // nhịp 1: video trên iMac (R2 còn bản phát hành)
  if (existsSync(thu)) for (const f of readdirSync(thu).filter((x) => x.endsWith('.mp4'))) { const p = join(thu, f); mb1 += statSync(p).size / 2 ** 20; if (!xem) rmSync(p); }
  // nhịp 2: đủ ngày → Drive
  const tuoi = (Date.now() - Math.max(...len.map((x) => Date.parse(x)))) / 86_400_000;
  if (tuoi < NGAY || v.kho_drive) continue;
  const dich = `${REMOTE}:${CH.drive}/${slug}`, r2 = [v.file_url, v.thumb].filter(Boolean);
  if (xem) { console.log(`→ ${slug}: đăng ${tuoi.toFixed(1)} ngày — sẽ chép ${r2.length} tệp R2${existsSync(thu) ? ' + tài sản' : ''} lên ${dich}`); continue; }
  try {
    for (const u of r2) { const ten = u.split('?')[0].split('/').pop(), can = coUrl(u); rc('copyurl', u, `${dich}/${ten}`); const co = coDrive(`${dich}/${ten}`); if (can < 0 || co !== can) throw new Error(`${ten}: Drive ${co} / R2 ${can} byte`); }
    if (existsSync(thu)) { rc('copy', thu, `${dich}/tai`, '--exclude', '*.mp4'); rc('check', thu, `${dich}/tai`, '--exclude', '*.mp4', '--size-only', '--one-way'); }
    if (r2.length) console.log((await boxA(`scripts/lich-su/luu-kho.mts --may ${KENH.may} --slug ${slug} --drive '${dich}' ${r2.map((u) => `'${u}'`).join(' ')}`)).split('\n').pop());
    if (existsSync(thu)) rmSync(thu, { recursive: true });
    tap2++; console.log(`✓ ${slug} → ${dich}`);
  } catch (e) { console.log(`⚠ ${slug}: chưa chuyển kho — ${String(e.message).split('\n')[0]} (không xoá gì)`); }
}
console.log(`lưu kho ${kenhId}: ${xem ? 'sẽ ' : ''}bỏ ${Math.round(mb1)} MB video trên iMac · ${tap2} tập chuyển sang Drive`);
