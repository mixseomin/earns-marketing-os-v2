// CHUYỂN KHO SAU KHI ĐĂNG — phần chạy trên box3 (08/11/2026, anh: "Đẩy lên Drive cho giảm chi phí R2"): bản trên R2 đã chép sang Drive và đã so khớp ở iMac
// (scripts/luu-kho.mjs, chung mọi máy video) → xoá đúng các tệp R2 đó + ghi đường Drive vào sổ Studio (de.kho_drive) để cần thì kéo về.
//   NODE_OPTIONS=--conditions=react-server tsx scripts/luu-kho.mts --may <mã> --slug <slug> --drive <đường drive> <url R2>…
// Chốt: chỉ xoá URL của chính video đó (video_url / thumb trong sổ) và nằm dưới <R2_PUBLIC_BASE>/xuong-video/ — URL lạ thì dừng, không xoá gì.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { deleteFromR2, r2KeyFromUrl } from '../src/lib/r2';

const a = process.argv.slice(2), lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const may0 = lay('--may'), slug0 = lay('--slug');
// --ds-may: mã mọi máy có video còn trên R2 (luu-kho.mjs --het đi hết, không máy nào đứng ngoài)
if (a.includes('--ds-may')) { const r = (await getDb()!.execute(sql`SELECT DISTINCT m.ma FROM xv_may m JOIN xv_may_video v ON v.may_id = m.id WHERE v.video_url IS NOT NULL AND NOT (coalesce(v.de, '{}'::jsonb) ? 'kho_drive') ORDER BY 1`)) as unknown as { ma: string }[]; console.log(JSON.stringify(r.map((x) => x.ma))); process.exit(0); }
// --tra <tệp=url>…: đẩy tệp (kéo từ Drive) về đúng khoá R2 của url, bỏ dấu kho_drive — chỉ cho video đã chuyển kho
if (a.includes('--tra')) { const { uploadToR2 } = await import('../src/lib/r2'), db0 = getDb()!; let n = 0;
  for (const cap of a.slice(a.indexOf('--tra') + 1)) { const [tep, u] = [cap.slice(0, cap.indexOf('=')), cap.slice(cap.indexOf('=') + 1)], k = r2KeyFromUrl(u.split('?')[0]); if (!k || !k.startsWith('xuong-video/')) { console.error(`✗ khoá lạ: ${u}`); process.exit(4); }
    if (await uploadToR2(k, { tep }, /\.jpe?g$/i.test(k) ? 'image/jpeg' : 'video/mp4')) n++; else { console.error(`✗ đẩy lại ${k} hỏng — giữ dấu kho_drive`); process.exit(5); } }
  await db0.execute(sql`UPDATE xv_may_video SET de = de - 'kho_drive' - 'kho_luc', updated_at = now() WHERE slug = ${slug0} AND may_id = (SELECT id FROM xv_may WHERE ma = ${may0})`);
  console.log(JSON.stringify({ slug: slug0, tra: n })); process.exit(0); }
// một video: chỉ xoá URL của CHÍNH video đó (video_url / bìa trong sổ) dưới <R2_PUBLIC_BASE>/xuong-video/ — URL lạ thì không xoá gì. Trả kết quả hoặc ném.
const db = getDb()!;
async function chuyenMot(may: string, slug: string, drive: string, urls: string[]) {
  const [v] = (await db.execute(sql`SELECT v.id, v.video_url, v.de FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${may} AND v.slug = ${slug}`)) as unknown as { id: number; video_url: string | null; de: { thumb?: { url?: string } } | null }[];
  if (!v) throw new Error(`không có video ${slug} trong máy ${may}`);
  const goc = (u: string) => u.split('?')[0], cua = new Set([v.video_url, v.de?.thumb?.url].filter((x): x is string => !!x).map(goc)), base = `${process.env.R2_PUBLIC_BASE!.replace(/\/+$/, '')}/xuong-video/`;
  const la = urls.filter((u) => !cua.has(goc(u)) || !goc(u).startsWith(base)); if (la.length) throw new Error(`URL không thuộc video ${slug}: ${la.join(' ')} — không xoá gì`);
  let xoa = 0; const hong: string[] = [];
  for (const u of urls) { const k = r2KeyFromUrl(goc(u)); if (k && await deleteFromR2(k)) xoa++; else hong.push(u); }
  await db.execute(sql`UPDATE xv_may_video SET de = coalesce(de, '{}'::jsonb) || ${JSON.stringify({ kho_drive: drive, kho_luc: new Date().toISOString() })}::jsonb, updated_at = now() WHERE id = ${v.id}`);
  return { slug, xoa, drive, ...(hong.length ? { khong_xoa_duoc: hong } : {}) };
}
// --lo <base64 JSON [{ slug, drive, urls }]>: cả lô một lần gọi (luu-kho.mjs gom 25 video / lượt — mỗi lần ssh + tsx ~5 s, 736 video lẻ = cả giờ)
if (lay('--lo')) { const lo = JSON.parse(Buffer.from(lay('--lo')!, 'base64').toString('utf8')) as { slug: string; drive: string; urls: string[] }[], kq = [];
  for (const x of lo) { try { kq.push(await chuyenMot(may0!, x.slug, x.drive, x.urls)); } catch (e) { kq.push({ slug: x.slug, loi: (e as Error).message }); } }
  console.log(JSON.stringify(kq)); process.exit(0); }
const drive = lay('--drive'), urls = a.filter((x, i) => /^https?:\/\//.test(x) && !['--may', '--slug', '--drive'].includes(a[i - 1]));
if (!may0 || !slug0 || !drive || !urls.length) { console.error('tsx luu-kho.mts --may <mã> --slug <slug> --drive <đường> <url>… | --may <mã> --lo <base64>'); process.exit(2); }
try { console.log(JSON.stringify(await chuyenMot(may0, slug0, drive, urls))); } catch (e) { console.error(`✗ ${(e as Error).message}`); process.exit(4); }
process.exit(0);
