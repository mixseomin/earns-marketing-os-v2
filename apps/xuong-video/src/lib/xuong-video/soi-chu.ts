// SOI CHỮ LẠ TRONG CLIP (lớp "chữ lạ" của soi-clip.ts) — cắt khung ffmpeg + tesseract. Anh 26/10/2026 ("dựng CF soi đi"): nhiều lượt tu-lam-phim
// cùng chạy tesseract đẩy box3 (4 nhân) lên tải ~22, nên việc này chạy ở máy dựng Cloudflare (cloudflare/dung-video, POST /soi) như bản xuất MP4:
// container tự tải clip MỘT lần, cắt mọi khung + tesseract song song, trả TSV từng khung. Cloudflare lỗi / chưa cấu hình → chạy tại box3 như cũ,
// nhưng tại box3 chỉ MỘT tesseract một lúc (khoá trong tiến trình + flock chung mọi tiến trình) ở nice 19.
// Kết quả hai đường cùng dạng: TSV thô từng khung (null = khung không cắt / không đọc được) — soi-clip-do.ts › chuTrongKhung đọc như nhau.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cauHinhCf } from './may-dung-cf';

/** Tham số cắt khung + tesseract — MỘT nguồn cho cả hai đường (Cloudflare nhận đúng mảng này). */
export const VF_KHUNG = 'scale=720:-2';
export const LENH_TESS = ['--psm', '11', '-l', 'eng', 'tsv'];

export type KetQuaChu = { noi: 'cloudflare' | 'box3'; tsv: (string | null)[]; giay: number; loiCf?: string };

const chay = (cmd: string, args: string[], timeout = 60_000) => new Promise<Buffer | null>((ok) => execFile(cmd, args, { encoding: 'buffer', maxBuffer: 1 << 26, timeout }, (e, b) => ok(e ? null : (b as Buffer))));

// Tại box3: một tesseract một lúc trong tiến trình; flock (Linux) giữ một lúc cho MỌI tiến trình (nhiều tu-lam-phim chạy song song).
let dangChay = Promise.resolve();
export function motLuc<T>(f: () => Promise<T>): Promise<T> { const p = dangChay.then(f, f); dangChay = p.then(() => undefined, () => undefined); return p; }
const FLOCK = existsSync('/usr/bin/flock') ? '/usr/bin/flock' : null;
const KHOA_TESS = join(tmpdir(), 'soi-chu-tesseract.lock');
// Ảnh khung tại chỗ ghi ra đĩa (/var/tmp), không /tmp: /tmp box3 là tmpfs 512M hay đầy → ffmpeg ghi khung hỏng, mất khung soi (đo 26/10/2026).
const THU_KHUNG = existsSync('/var/tmp') ? '/var/tmp' : tmpdir();
const nhe = (cmd: string, args: string[]): [string, string[]] => FLOCK ? [FLOCK, ['-w', '300', KHOA_TESS, 'nice', '-n', '19', cmd, ...args]] : ['nice', ['-n', '19', cmd, ...args]];

/** Đường tại chỗ: cắt khung rồi tesseract lần lượt, nice 19, mỗi lúc một tesseract. */
export async function docChuTaiCho(url: string, giay: number[]): Promise<(string | null)[]> {
  const thu = await mkdtemp(join(THU_KHUNG, 'soi-clip-'));
  try {
    const ra: (string | null)[] = [];
    for (const [i, t] of giay.entries()) {
      const png = join(thu, `${i}.png`);
      if (!(await chay('nice', ['-n', '19', 'ffmpeg', '-v', 'error', '-y', '-ss', String(t), '-i', url, '-frames:v', '1', '-vf', VF_KHUNG, png]))) { ra.push(null); continue; }
      const tsv = await motLuc(() => chay(...nhe('tesseract', [png, 'stdout', ...LENH_TESS]), 6 * 60_000));
      ra.push(tsv ? String(tsv) : null);
    }
    return ra;
  } finally { await rm(thu, { recursive: true, force: true }); }
}

/** Đường Cloudflare: clip http(s) thì container tự tải; tệp cục bộ thì gửi kèm base64. Ném lỗi khi không soi được. */
async function docChuCf(url: string, giay: number[], o: { url: string; khoa: string }): Promise<(string | null)[]> {
  const clip = /^https?:\/\//.test(url) ? { url } : { mp4: (await readFile(url)).toString('base64') };
  const r = await fetch(`${o.url.replace(/\/$/, '')}/soi`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-dung-khoa': o.khoa }, signal: AbortSignal.timeout(3 * 60_000),
    body: JSON.stringify({ ...clip, giay, vf: VF_KHUNG, tess: LENH_TESS }),
  });
  if (!r.ok) throw new Error(`cloudflare ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = (await r.json()) as { khung?: unknown };
  if (!Array.isArray(j.khung) || j.khung.length !== giay.length || !j.khung.every((x) => x === null || typeof x === 'string')) throw new Error('cloudflare trả sai dạng (khung)');
  return j.khung as (string | null)[];
}

/** Đọc chữ ở các giây `giay` của clip: Cloudflare trước (cùng cấu hình máy dựng MP4), lỗi thì tại box3. Ghi nhật ký đường đã chạy. */
export async function docChuKhung(url: string, giay: number[]): Promise<KetQuaChu> {
  const t0 = Date.now(), xong = (noi: KetQuaChu['noi'], tsv: (string | null)[], loiCf?: string): KetQuaChu => {
    const k: KetQuaChu = { noi, tsv, giay: (Date.now() - t0) / 1000, ...(loiCf ? { loiCf } : {}) };
    console.log(`soi chữ ${url.split('/').pop()}: ${noi} ${k.giay.toFixed(1)}s${loiCf ? ` (cloudflare lỗi: ${loiCf})` : ''}`);
    return k;
  };
  const { url: cf, khoa } = cauHinhCf();
  if (cf && khoa) {
    try { return xong('cloudflare', await docChuCf(url, giay, { url: cf, khoa })); }
    catch (e) { return xong('box3', await docChuTaiCho(url, giay), (e as Error).message.slice(0, 200)); }
  }
  return xong('box3', await docChuTaiCho(url, giay));
}
