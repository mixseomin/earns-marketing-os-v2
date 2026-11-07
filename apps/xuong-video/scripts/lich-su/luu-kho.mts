// CHUYỂN KHO SAU KHI ĐĂNG — phần chạy trên box3 (08/11/2026, anh: "Đẩy lên Drive cho giảm chi phí R2"): bản trên R2 đã chép sang Drive và đã so khớp ở iMac
// (luu-kho.mjs) → xoá đúng các tệp R2 đó + ghi đường Drive vào sổ Studio (de.kho_drive) để cần thì kéo về.
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/luu-kho.mts --may <mã> --slug <slug> --drive <đường drive> <url R2>…
// Chốt: chỉ xoá URL của chính video đó (video_url / thumb trong sổ) và nằm dưới <R2_PUBLIC_BASE>/xuong-video/ — URL lạ thì dừng, không xoá gì.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { deleteFromR2, r2KeyFromUrl } from '../../src/lib/r2';

const a = process.argv.slice(2), lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const may0 = lay('--may'), slug0 = lay('--slug');
// --tra <tệp=url>…: đẩy tệp (kéo từ Drive) về đúng khoá R2 của url, bỏ dấu kho_drive — chỉ cho video đã chuyển kho
if (a.includes('--tra')) { const { uploadToR2 } = await import('../../src/lib/r2'), db0 = getDb()!; let n = 0;
  for (const cap of a.slice(a.indexOf('--tra') + 1)) { const [tep, u] = [cap.slice(0, cap.indexOf('=')), cap.slice(cap.indexOf('=') + 1)], k = r2KeyFromUrl(u.split('?')[0]); if (!k || !k.startsWith('xuong-video/')) { console.error(`✗ khoá lạ: ${u}`); process.exit(4); }
    if (await uploadToR2(k, { tep }, /\.jpe?g$/i.test(k) ? 'image/jpeg' : 'video/mp4')) n++; else { console.error(`✗ đẩy lại ${k} hỏng — giữ dấu kho_drive`); process.exit(5); } }
  await db0.execute(sql`UPDATE xv_may_video SET de = de - 'kho_drive' - 'kho_luc', updated_at = now() WHERE slug = ${slug0} AND may_id = (SELECT id FROM xv_may WHERE ma = ${may0})`);
  console.log(JSON.stringify({ slug: slug0, tra: n })); process.exit(0); }
const may = may0, slug = slug0, drive = lay('--drive'), urls = a.filter((x, i) => /^https?:\/\//.test(x) && !['--may', '--slug', '--drive'].includes(a[i - 1]));
if (!may || !slug || !drive || !urls.length) { console.error('tsx luu-kho.mts --may <mã> --slug <slug> --drive <đường> <url>…'); process.exit(2); }
const db = getDb()!;
const [v] = (await db.execute(sql`SELECT v.id, v.video_url, v.de FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${may} AND v.slug = ${slug}`)) as unknown as { id: number; video_url: string | null; de: { thumb?: { url?: string } } | null }[];
if (!v) { console.error(`✗ không có video ${slug} trong máy ${may}`); process.exit(3); }
const goc = (u: string) => u.split('?')[0], cua = new Set([v.video_url, v.de?.thumb?.url].filter((x): x is string => !!x).map(goc)), base = `${process.env.R2_PUBLIC_BASE!.replace(/\/+$/, '')}/xuong-video/`;
const la = urls.filter((u) => !cua.has(goc(u)) || !goc(u).startsWith(base)); if (la.length) { console.error(`✗ URL không thuộc video ${slug}: ${la.join(' ')} — không xoá gì`); process.exit(4); }
let xoa = 0; for (const u of urls) { const k = r2KeyFromUrl(goc(u)); if (k && await deleteFromR2(k)) xoa++; else console.error(`⚠ không xoá được ${u}`); }
await db.execute(sql`UPDATE xv_may_video SET de = coalesce(de, '{}'::jsonb) || ${JSON.stringify({ kho_drive: drive, kho_luc: new Date().toISOString() })}::jsonb, updated_at = now() WHERE id = ${v.id}`);
console.log(JSON.stringify({ slug, xoa, drive }));
process.exit(0);
