import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';
import { getDb, mediaAssets } from '@mos2/db';
import { uploadToR2, r2Enabled } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

// POST /api/ext/media/upload
// Body: { projectId, filename, dataBase64, mimeType?, tags?, width?, height?, durationSec?, notes?, source? }
// → { ok, id, url }
//
// Vì sao có: vault ảnh đã có đường ĐỌC (GET /api/ext/media) và đường SINH (media/generate: AI/stock),
// nhưng không có đường nạp ảnh MÌNH TỰ DỰNG từ máy vào — nên card render bằng cover-generator không
// có chỗ đứng, phải đi vòng bằng SQL tay. Đây là mặt ghi còn thiếu của cùng một kho, dùng lại
// nguyên si đường lưu của backlink-media (R2 → media_assets, rơi về data URI khi chưa cấu hình R2).
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);

  const b = (await req.json().catch(() => ({}))) as {
    projectId?: string; filename?: string; dataBase64?: string; mimeType?: string;
    tags?: string[]; width?: number; height?: number; durationSec?: number;
    notes?: string; source?: string;
  };
  const projectId = String(b.projectId ?? '').trim();
  const filename = String(b.filename ?? '').trim();
  const data = String(b.dataBase64 ?? '');
  if (!projectId || !filename || !data) return errorResponse('projectId + filename + dataBase64 required');

  const buf = Buffer.from(data, 'base64');
  if (!buf.length) return errorResponse('dataBase64 rỗng hoặc sai mã');
  if (buf.length > 12 * 1024 * 1024) return errorResponse('file > 12MB — nén trước khi nạp');

  const mime = String(b.mimeType ?? '').trim()
    || (/\.jpe?g$/i.test(filename) ? 'image/jpeg' : /\.mp4$/i.test(filename) ? 'video/mp4' : 'image/png');
  // kind suy từ mime, không đóng cứng 'image': reel dựng xong phải nạp được bằng chính đường này,
  // không thì lại đi vòng bằng SQL tay (media 76/77 đã phải làm thế).
  const kind = mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'image';
  const source = String(b.source ?? 'upload').trim();
  // Cùng quy ước khoá với backlink-media: <nguồn>/<project>/<tên>-<mốc>.<đuôi>
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 60);
  const key = `${source}/${projectId}/${base}-${stamp}.${ext}`;

  let url = r2Enabled() ? await uploadToR2(key, buf, mime) : null;
  if (!url) url = `data:${mime};base64,${buf.toString('base64')}`;

  const [row] = await db.insert(mediaAssets).values({
    tenantId: TENANT, projectId, kind,
    filename: `${base}.${ext}`, url, mimeType: mime, sizeBytes: buf.length,
    width: b.width ?? null, height: b.height ?? null,
    durationSec: b.durationSec ?? null,
    tags: Array.isArray(b.tags) ? b.tags.map(String) : [source],
    notes: b.notes ?? null, source,
  }).returning({ id: mediaAssets.id });

  return NextResponse.json({ ok: true, id: row?.id, url });
}
