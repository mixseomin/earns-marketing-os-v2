// Phần máy chủ của ẢNH NHỎ (anh-nho.ts): thu nhỏ một ảnh của kho bằng ffmpeg → R2 xuong-video/nho/w<rộng>/<băm>.jpg (khoá suy từ url gốc,
// không bao giờ đổi). Một chỗ cho route /api/xv/nho (lúc xem), hoàn tất ảnh (làm sẵn ngay khi ảnh vừa sinh) và script làm bù.
import 'server-only';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { uploadToR2 } from '../r2';
import { CO_NHO, type CoNho } from './anh-nho';

const GOC = () => (process.env.R2_PUBLIC_BASE || 'https://img.on.tc').replace(/\/+$/, '');
const daCo = new Set<string>();                       // khoá đã có trên R2 (trong tiến trình) — khỏi hỏi lại
const dangLam = new Map<string, Promise<boolean>>();  // cùng ảnh xin cùng lúc → làm một lần

export const khoaNho = (u: string, w: CoNho) => `xuong-video/nho/w${w}/${createHash('sha1').update(u).digest('hex').slice(0, 24)}.jpg`;
export const laAnhKho = (u: string) => u.startsWith(`${GOC()}/xuong-video/`) && !u.includes('/xuong-video/nho/') && /\.(jpe?g|png|webp)$/i.test(u);

async function coTren(url: string): Promise<boolean> {
  try { return (await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })).ok; } catch { return false; }
}
async function thuNho(vao: Buffer, w: CoNho): Promise<Buffer | null> {
  return new Promise((ok) => {
    const p = execFile('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', `scale='min(${w},iw)':-2`, '-q:v', '4', '-frames:v', '1', '-f', 'mjpeg', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1 << 25, timeout: 30_000 }, (e, b) => ok(e ? null : (b as Buffer)));
    p.stdin?.end(vao);
  });
}

/** Bảo đảm có bản nhỏ `w` của ảnh `u` trên R2 → url bản nhỏ, hoặc null khi không làm được. vao = bytes ảnh gốc nếu đã có sẵn. */
export async function damBaoNho(u: string, w: CoNho, vao?: Buffer): Promise<string | null> {
  const key = khoaNho(u, w); const nho = `${GOC()}/${key}`;
  if (daCo.has(key)) return nho;
  let p = dangLam.get(key);
  if (!p) {
    p = (async () => {
      if (await coTren(nho)) return true;
      let goc = vao;
      if (!goc) { const r = await fetch(u, { signal: AbortSignal.timeout(60_000) }); if (!r.ok) return false; goc = Buffer.from(await r.arrayBuffer()); }
      const ra = await thuNho(goc, w);
      return !!ra && ra.length >= 200 && !!(await uploadToR2(key, ra, 'image/jpeg'));
    })().catch((e) => { console.error('[ảnh nhỏ] hỏng', u, w, e); return false; }).finally(() => dangLam.delete(key));
    dangLam.set(key, p);
  }
  if (!(await p)) return null;
  daCo.add(key); return nho;
}

/** Làm sẵn cả ba nấc cho một ảnh vừa vào kho (tải gốc MỘT lần). Không ném lỗi — ảnh nhỏ hỏng thì lúc xem route làm lại. */
export async function lamSanNho(u: string | null | undefined): Promise<number> {
  if (!u || !laAnhKho(u)) return 0;
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(60_000) }); if (!r.ok) return 0;
    const vao = Buffer.from(await r.arrayBuffer());
    let so = 0; for (const w of CO_NHO) if (await damBaoNho(u, w, vao)) so++;
    return so;
  } catch (e) { console.error('[ảnh nhỏ] làm sẵn hỏng', u, e); return 0; }
}
