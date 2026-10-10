'use server';

// HÒM GÓP Ý CỦA CTY — cùng khuôn card với hòm studio (apps/xuong-video/src/lib/gop-y.ts) và mos2: card = human_tasks
// platform_key 'backlink', source_platform 'feedback', project 'cty' → mos2.on.tc/p/cty/plays; luồng trao đổi trong
// prep_payload.trao_doi, trạng thái prep_payload.site_status.cty. Claude nhặt bằng `GOPY_PROJECT=cty scripts/gop-y.sh`.
// Trả lời / duyệt / làm lại làm trên card mos2 (drawer góp ý ở đó), hòm này chỉ gửi + xem trạng thái.
import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2, r2Enabled } from '@/lib/r2';

const DU_AN = 'cty';
export type GopYCuaToi = { id: number; loai: string; noiDung: string; trangThai: string; capNhat: string; soTin: number; tinCuoi: string };
const homNayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

/** Ảnh (data URL đã thu nhỏ ở trình duyệt) → R2, trả URL công khai. */
export async function taiAnhGopY(dataUrl: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'không có quyền' };
  const m = (dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/s);
  if (!m) return { ok: false, error: 'không phải ảnh base64' };
  const buf = Buffer.from(m[2]!, 'base64');
  if (buf.length > 8_000_000) return { ok: false, error: 'ảnh quá lớn (>8MB)' };
  if (!r2Enabled()) return { ok: false, error: 'máy chủ chưa cấu hình R2 (R2_* trong .env.production)' };
  const url = await uploadToR2(`gop-y-cty/${randomUUID()}.${m[1]!.split('/')[1]}`, buf, m[1]!);
  return url ? { ok: true, url } : { ok: false, error: 'tải ảnh lên R2 thất bại' };
}

/** Gửi góp ý → card pending trên plays `cty`, hẹn hôm nay. Admin-only như hòm mos2/studio. */
export async function guiGopY(input: { loai: string; noiDung: string; trang: string; anhUrls: string[]; nguCanh?: string }): Promise<{ ok: boolean; id?: number; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'không có quyền' };
  const db = getDb();
  if (!db) return { ok: false, error: 'máy chủ không nối được DB' };
  const noiDung = input.noiDung.trim();
  if (!noiDung) return { ok: false, error: 'Chưa gõ mô tả.' };
  const trang = String(input.trang || '').slice(0, 1000);
  const nguCanh = String(input.nguCanh || '').slice(0, 3000);
  const anh = (Array.isArray(input.anhUrls) ? input.anhUrls : []).filter((u) => /^https?:\/\//.test(u)).slice(0, 6);
  const loai = input.loai === 'cau_hoi' ? 'cau_hoi' : 'loi';
  const dongDau = (noiDung.split('\n')[0] ?? '').trim().slice(0, 60);
  const title = loai === 'cau_hoi' ? `Hỏi: ${dongDau}` : dongDau;
  const draft = [noiDung, trang ? `[Trang báo lỗi ↗](${trang})` : '', nguCanh ? `Ngữ cảnh: ${nguCanh}` : '', ...anh.map((u) => `![ảnh](${u})`)].filter(Boolean).join('\n\n').slice(0, 20_000);
  const goc = { nguoi: me.email, noiDung: noiDung.slice(0, 4000), xuLy: null, luc: new Date().toISOString(), anh, trang: trang || undefined, nguCanh: nguCanh || undefined };
  const pp = { source_url: trang, source_platform: 'feedback', draft, loai, trao_doi: [goc],
    site_status: { [DU_AN]: 'pending' }, site_url: { [DU_AN]: '' }, site_scheduled_at: { [DU_AN]: homNayVN() } };
  const r = (await db.execute(sql`
    INSERT INTO human_tasks (tenant_id, project_id, title, instructions, prep_payload, platform_key, status, publish_url)
    VALUES ('self', ${DU_AN}, ${title}, ${`${noiDung}\n\nTrang báo: ${trang}${nguCanh ? `\nNgữ cảnh: ${nguCanh}` : ''}`.slice(0, 6000)}, ${JSON.stringify(pp)}::jsonb, 'backlink', 'pending', '')
    RETURNING id`)) as unknown as Array<{ id: number }>;
  const id = Number(r[0]?.id);
  return Number.isFinite(id) ? { ok: true, id } : { ok: false, error: 'ghi card hỏng' };
}

/** Góp ý của tôi: card còn mở + card đóng trong 7 ngày. */
export async function dsGopYCuaToi(): Promise<GopYCuaToi[]> {
  const me = await getCurrentUser();
  const db = getDb();
  if (!me || !db) return [];
  const r = (await db.execute(sql`
    SELECT id, COALESCE(updated_at, created_at) AS cap_nhat, COALESCE(prep_payload->'site_status'->>${DU_AN}, status) AS tt,
           COALESCE(prep_payload->>'loai', 'loi') AS loai, COALESCE(prep_payload->'trao_doi', '[]'::jsonb) AS td
    FROM human_tasks
    WHERE project_id = ${DU_AN} AND prep_payload->>'source_platform' = 'feedback'
      AND lower(prep_payload->'trao_doi'->0->>'nguoi') = lower(${me.email})
      AND (COALESCE(prep_payload->'site_status'->>${DU_AN}, status) IN ('pending','claimed','submitted','review','broken') OR updated_at >= now() - interval '7 days')
    ORDER BY cap_nhat DESC, id DESC LIMIT 100`)) as unknown as Array<{ id: number; cap_nhat: string | Date; tt: string; loai: string; td: unknown }>;
  return r.map((x) => {
    const td = (Array.isArray(x.td) ? x.td : []) as Array<{ nguoi: string; noiDung: string }>;
    const cuoi = td.length > 1 ? td[td.length - 1]! : null;
    return { id: Number(x.id), loai: String(x.loai), noiDung: String(td[0]?.noiDung ?? ''), trangThai: String(x.tt || 'pending'),
      capNhat: new Date(x.cap_nhat).toISOString(), soTin: Math.max(0, td.length - 1), tinCuoi: cuoi ? `${cuoi.nguoi}: ${cuoi.noiDung}` : '' };
  });
}
