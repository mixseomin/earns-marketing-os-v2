// DỰNG FFMPEG TRÊN CLOUDFLARE CONTAINERS (anh 21/10/2026: "mục đích là nhẹ tải và có thể cần thì chạy song song nhưng box3 chỉ gánh ít thôi").
// Lệnh ffmpeg dựng chính (nặng nhất) chạy ở máy dựng cloudflare/dung-video; box3 chỉ gửi tệp đầu vào (phụ đề .ass + ảnh nền) và nhận MP4 về.
// Cắt khung / ảnh tĩnh từ MP4 vẫn ở box3 (vài trăm ms). Có DUNG_CF_URL + DUNG_CF_KHOA trong env thì đi Cloudflare; không có, hoặc Cloudflare lỗi
// → trên box3 lùi về iMac (xv_dung_imac — CẤM dựng tại box3, anh 03/11/2026), máy khác dựng tại chỗ; nhật ký ghi rõ đường nào.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';

/** Thay đường dẫn máy này bằng mã chỗ của container: thư mục lượt → @DIR@, thư mục font → @FONTS@ (cả khi nằm giữa chuỗi filter ffmpeg). */
export function doiDuongDan(args: string[], thuMuc: string, fontsDir: string): string[] {
  return args.map((a) => a.split(thuMuc).join('@DIR@').split(fontsDir).join('@FONTS@'));
}

/** Gọi máy dựng Cloudflare: mọi tệp trong thuMuc (đầu vào) đi kèm; ghi MP4 trả về vào `ra`. Ném lỗi khi không dựng được. */
async function dungCf(args: string[], o: { thuMuc: string; fontsDir: string; ra: string; url: string; khoa: string }): Promise<number> {
  const files: Record<string, string> = {};
  for (const ten of await readdir(o.thuMuc)) if (path.join(o.thuMuc, ten) !== o.ra) files[ten] = (await readFile(path.join(o.thuMuc, ten))).toString('base64');
  const r = await fetch(`${o.url.replace(/\/$/, '')}/ffmpeg`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-dung-khoa': o.khoa }, signal: AbortSignal.timeout(6 * 60_000),
    body: JSON.stringify({ args: doiDuongDan(args, o.thuMuc, o.fontsDir), files, ra: path.basename(o.ra) }),
  });
  if (!r.ok) throw new Error(`cloudflare ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const mp4 = Buffer.from(await r.arrayBuffer()); if (mp4.length < 10_000) throw new Error(`cloudflare trả tệp quá nhỏ (${mp4.length} byte)`);
  await writeFile(o.ra, mp4);
  return Number(r.headers.get('x-giay-dung') ?? 0);
}

/** Khoá máy dựng: env trước, không có thì đọc tệp bí mật trên box3 (/root/.secrets/dung-cf.env — mọi đường gọi dựng: app studio, may-dung.mts qua ssh).
 *  Dùng chung cho mọi việc gửi lên máy dựng Cloudflare: dựng MP4 (dungFfmpeg) và soi chữ clip (soi-chu.ts). */
export function cauHinhCf(): { url?: string; khoa?: string } {
  if (!process.env.DUNG_CF_URL) try { for (const l of readFileSync('/root/.secrets/dung-cf.env', 'utf8').split('\n')) { const m = l.match(/^(DUNG_CF_URL|DUNG_CF_KHOA)=(.+)$/); if (m) process.env[m[1]!] = m[2]!.trim(); } } catch { /* không phải box3 */ }
  return { url: process.env.DUNG_CF_URL, khoa: process.env.DUNG_CF_KHOA };
}
/** CẤM DỰNG VIDEO TRÊN BOX3 (anh 03/11/2026: "Cấm mày ren video trên box3" · "CF lỗi thì lùi về iMAC") — box3 = máy có .env.production của mos2 */
export const laBox3 = (): boolean => hostname().split('.')[0] === 'box3' || existsSync('/opt/earns-marketing-os-v2/.env.production');

/** Cloudflare lỗi trên box3 → xếp hàng xv_dung_imac và CHỜ máy iMac (apps/etp/dong_phim.py) kéo tệp về dựng rồi đẩy MP4 vào `ra` (migration 0414). */
async function dungImac(args: string[], o: { thuMuc: string; fontsDir: string; ra: string }): Promise<number> {
  const { getDb } = await import('@mos2/db'); const { sql } = await import('drizzle-orm'); const db = getDb()!;
  const [r] = (await db.execute(sql`insert into xv_dung_imac (thu_muc, args, ra) values (${o.thuMuc}, ${JSON.stringify(doiDuongDan(args, o.thuMuc, o.fontsDir))}::jsonb, ${path.basename(o.ra)}) returning id`)) as unknown as { id: number }[];
  const het = Date.now() + 25 * 60_000;
  while (Date.now() < het) {
    await new Promise((ok) => setTimeout(ok, 3000));
    const [x] = (await db.execute(sql`select trang_thai, loi, giay::float giay from xv_dung_imac where id = ${r!.id}`)) as unknown as { trang_thai: string; loi: string | null; giay: number | null }[];
    if (x?.trang_thai === 'xong') { const n = (await readFile(o.ra)).length; if (n < 10_000) throw new Error(`iMac trả tệp quá nhỏ (${n} byte)`); return x.giay ?? 0; }
    if (x?.trang_thai === 'loi') throw new Error(`iMac dựng lỗi: ${x.loi ?? '?'}`);
  }
  await db.execute(sql`update xv_dung_imac set trang_thai = 'loi', loi = 'quá 25 phút chưa xong (box3 thôi chờ)' where id = ${r!.id} and trang_thai in ('cho', 'dang')`);
  throw new Error('iMac chưa dựng xong sau 25 phút — máy chạy dòng phim (launchd com.htuan.etp-dong-phim) có đang chạy?');
}

/** Lệnh ffmpeg dựng chính: Cloudflare trước; lỗi thì trên box3 lùi về iMAC (KHÔNG BAO GIỜ dựng tại box3), máy khác (máy dev) chạy tại chỗ bằng `chayTaiCho`. */
export async function dungFfmpeg(args: string[], o: { thuMuc: string; fontsDir: string; ra: string; chayTaiCho: () => Promise<unknown> }): Promise<{ noi: 'cloudflare' | 'imac' | 'tai_cho'; giay?: number; loiCf?: string }> {
  const { url, khoa } = cauHinhCf(); let loiCf: string | undefined;
  if (url && khoa) {
    try { return { noi: 'cloudflare', giay: await dungCf(args, { ...o, url, khoa }) }; }
    catch (e) { loiCf = (e as Error).message.slice(0, 200); console.warn(`dựng cloudflare hỏng → ${laBox3() ? 'lùi về iMac' : 'dựng tại chỗ'}: ${loiCf}`); }
  }
  if (laBox3()) return { noi: 'imac', giay: await dungImac(args, o), loiCf };
  await o.chayTaiCho(); return { noi: 'tai_cho', loiCf };
}
