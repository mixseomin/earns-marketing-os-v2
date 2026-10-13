// Ảnh nhỏ của kho studio (lib/xuong-video/anh-nho.ts): thu nhỏ MỘT lần bằng ffmpeg → R2 xuong-video/nho/w<rộng>/<băm>.jpg → 302 tới bản đó,
// trình duyệt nhớ chuyển hướng 1 năm (ảnh gốc trên R2 không bao giờ đổi nội dung ở cùng url). Hỏng thì chuyển về ảnh gốc, không nhớ.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2 } from '@/lib/r2';
import { CO_NHO, type CoNho } from '@/lib/xuong-video/anh-nho';

export const dynamic = 'force-dynamic';
const GOC = (process.env.R2_PUBLIC_BASE || 'https://img.on.tc').replace(/\/+$/, '');
const daCo = new Set<string>();                       // khoá đã có trên R2 (trong tiến trình) — khỏi hỏi lại
const dangLam = new Map<string, Promise<boolean>>();  // cùng ảnh xin cùng lúc → làm một lần

async function coTren(url: string): Promise<boolean> {
  try { return (await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })).ok; } catch { return false; }
}
async function lam(u: string, w: CoNho, key: string): Promise<boolean> {
  const r = await fetch(u, { signal: AbortSignal.timeout(60_000) }); if (!r.ok) return false;
  const vao = Buffer.from(await r.arrayBuffer());
  const ra = await new Promise<Buffer | null>((ok) => {
    const p = execFile('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', `scale='min(${w},iw)':-2`, '-q:v', '4', '-frames:v', '1', '-f', 'mjpeg', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1 << 25, timeout: 30_000 }, (e, b) => ok(e ? null : (b as Buffer)));
    p.stdin?.end(vao);
  });
  if (!ra || ra.length < 200) return false;
  return !!(await uploadToR2(key, ra, 'image/jpeg'));
}

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return new Response('cần đăng nhập', { status: 401 });
  const q = new URL(req.url).searchParams;
  const u = q.get('u') || ''; const w = Number(q.get('w')) as CoNho;
  if (!u.startsWith(`${GOC}/xuong-video/`) || !CO_NHO.includes(w)) return new Response('chỉ ảnh của studio, rộng 160/320/640', { status: 400 });
  const key = `xuong-video/nho/w${w}/${createHash('sha1').update(u).digest('hex').slice(0, 24)}.jpg`;
  const nho = `${GOC}/${key}`;
  if (!daCo.has(key)) {
    let p = dangLam.get(key);
    if (!p) { p = (async () => (await coTren(nho)) || lam(u, w, key))().finally(() => dangLam.delete(key)); dangLam.set(key, p); }
    if (await p) daCo.add(key);
    else { console.error('[ảnh nhỏ] không thu nhỏ được — trả ảnh gốc', u); return Response.redirect(u, 302); }
  }
  return new Response(null, { status: 302, headers: { location: nho, 'cache-control': 'public, max-age=31536000, immutable' } });
}
