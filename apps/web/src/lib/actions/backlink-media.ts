'use server';

// Prepare post media for backlink tasks straight from the drawer: search the stock
// providers, or AI-generate, then persist into media_assets for the project. Reuses
// the same image pipeline as the ext media/generate route (lib/stock-photos + R2).
import { getDb, mediaAssets } from '@mos2/db';
import { uploadToR2, r2Enabled } from '@/lib/r2';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import { searchStockPhotos, downloadImage, type PhotoCandidate } from '@/lib/stock-photos';
import { getCurrentUser } from '@/lib/auth';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const wide = (field: string) => /(cover|banner|screenshot|thumbnail|infographic|header|wallpaper)/i.test(field);

async function requireAdmin(): Promise<boolean> {
  const me = await getCurrentUser();
  return me?.role === 'admin';
}

async function persist(projectId: string, field: string, buf: Buffer, mime: string, source: string, w: number | null, h: number | null): Promise<{ id: number; url: string } | null> {
  const db = getDb(); if (!db) return null;
  const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const key = `backlink/${projectId || 'misc'}/${field}-${stamp}.${ext}`;
  let url = r2Enabled() ? await uploadToR2(key, buf, mime) : null;
  if (!url) url = `data:${mime};base64,${buf.toString('base64')}`;
  const [row] = await db.insert(mediaAssets).values({
    tenantId: TENANT, projectId: projectId || null, kind: 'image',
    filename: `${field}-${stamp}.${ext}`, url, mimeType: mime,
    sizeBytes: buf.length, width: w, height: h,
    tags: [field, 'backlink', source], notes: `backlink ${field} · ${source}`, source,
  }).returning({ id: mediaAssets.id });
  return row ? { id: row.id, url } : null;
}

// Search stock/web providers → candidate URLs (not saved yet; user picks one).
export async function searchBacklinkMedia(query: string): Promise<{ ok: boolean; candidates?: PhotoCandidate[]; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  const q = query.trim();
  if (!q) return { ok: false, error: 'query rỗng' };
  const raw = await searchStockPhotos(q);
  const seen = new Set<string>();
  const candidates = raw.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true))).slice(0, 12);
  return candidates.length ? { ok: true, candidates } : { ok: false, error: 'không tìm thấy ảnh (chưa cấu hình provider key?)' };
}

// Download a chosen candidate → R2 → media_assets for the project.
export async function attachBacklinkMedia(projectId: string, url: string, field: string): Promise<{ ok: boolean; id?: number; url?: string; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  if (!projectId || !/^https?:\/\//.test(url)) return { ok: false, error: 'input không hợp lệ' };
  const dl = await downloadImage(url);
  if (!dl) return { ok: false, error: 'không tải được ảnh' };
  const saved = await persist(projectId, field, dl.buf, dl.mime, 'web', null, null);
  return saved ? { ok: true, ...saved } : { ok: false, error: 'lưu thất bại' };
}

// AI-generate a fresh image for the field and persist it.
export async function generateBacklinkMedia(projectId: string, prompt: string, field: string): Promise<{ ok: boolean; id?: number; url?: string; error?: string }> {
  if (!(await requireAdmin())) return { ok: false, error: 'forbidden' };
  if (!projectId) return { ok: false, error: 'thiếu project' };
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY chưa cấu hình' };
  const p = prompt.trim() || `Clean, modern illustration for a "${field}". Aesthetic, tasteful. No text, no logo, no watermark.`;
  const size = wide(field) ? '1536x1024' : '1024x1024';
  const [w, h] = size.split('x').map(Number) as [number, number];
  try {
    const res = await getOpenAI()!.images.generate({ model: 'gpt-image-2', prompt: p, size, quality: 'medium', n: 1 });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return { ok: false, error: 'gpt-image không trả ảnh' };
    const saved = await persist(projectId, field, Buffer.from(b64, 'base64'), 'image/png', 'gen', w, h);
    return saved ? { ok: true, ...saved } : { ok: false, error: 'lưu thất bại' };
  } catch (e) {
    return { ok: false, error: `gen lỗi: ${(e as Error).message || String(e)}` };
  }
}
