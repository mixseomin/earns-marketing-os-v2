'use server';

// Generic image upload → Cloudflare R2, returns a public URL. Shared by any feature that needs
// screenshot/attachment upload (backlink blocker report, feedback forms, …). Reuse via <ImageAttach>.
import 'server-only';
import { randomUUID } from 'node:crypto';
import { uploadToR2, deleteFromR2, r2KeyFromUrl, r2Enabled } from '@/lib/r2';

export async function uploadImage(dataUrl: string, folder = 'uploads'): Promise<{ ok: boolean; url?: string; error?: string }> {
  const m = (dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/s);
  if (!m) return { ok: false, error: 'không phải ảnh base64' };
  const buf = Buffer.from(m[2]!, 'base64');
  if (buf.length > 8_000_000) return { ok: false, error: 'ảnh quá lớn (>8MB)' };
  if (!r2Enabled()) return { ok: false, error: 'storage chưa cấu hình' };
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '') || 'uploads';
  const url = await uploadToR2(`${safeFolder}/${randomUUID()}.${m[1]!.split('/')[1]}`, buf, m[1]!);
  return url ? { ok: true, url } : { ok: false, error: 'upload thất bại' };
}

// Delete an image we uploaded (called when the user removes it before sending, or cancels the
// form). No-op for external URLs (added via "Thêm URL") — only our own R2 objects are removed.
export async function deleteImage(url: string): Promise<{ ok: boolean }> {
  const key = r2KeyFromUrl(url || '');
  if (!key) return { ok: true };   // not ours → nothing to delete
  return { ok: await deleteFromR2(key) };
}
