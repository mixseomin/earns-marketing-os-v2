// DỰNG FFMPEG TRÊN CLOUDFLARE CONTAINERS (anh 21/10/2026: "mục đích là nhẹ tải và có thể cần thì chạy song song nhưng box3 chỉ gánh ít thôi").
// Lệnh ffmpeg dựng chính (nặng nhất) chạy ở máy dựng cloudflare/dung-video; box3 chỉ gửi tệp đầu vào (phụ đề .ass + ảnh nền) và nhận MP4 về.
// Cắt khung / ảnh tĩnh từ MP4 vẫn ở box3 (vài trăm ms). Có DUNG_CF_URL + DUNG_CF_KHOA trong env thì đi Cloudflare; không có, hoặc Cloudflare lỗi
// → dựng tại chỗ như cũ (không mất lượt), nhật ký ghi rõ đường nào.
import { readdir, readFile, writeFile } from 'node:fs/promises';
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

/** Lệnh ffmpeg dựng chính: Cloudflare trước (nếu cấu hình), lỗi thì chạy tại chỗ bằng `chayTaiCho`. Trả nơi đã dựng để ghi nhật ký. */
export async function dungFfmpeg(args: string[], o: { thuMuc: string; fontsDir: string; ra: string; chayTaiCho: () => Promise<unknown> }): Promise<{ noi: 'cloudflare' | 'box3'; giay?: number; loiCf?: string }> {
  const url = process.env.DUNG_CF_URL, khoa = process.env.DUNG_CF_KHOA;
  if (url && khoa) {
    try { return { noi: 'cloudflare', giay: await dungCf(args, { ...o, url, khoa }) }; }
    catch (e) { const loiCf = (e as Error).message.slice(0, 200); console.warn(`dựng cloudflare hỏng → dựng tại box3: ${loiCf}`); await o.chayTaiCho(); return { noi: 'box3', loiCf }; }
  }
  await o.chayTaiCho(); return { noi: 'box3' };
}
