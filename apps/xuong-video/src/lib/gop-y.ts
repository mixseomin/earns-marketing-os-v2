'use server';

// HÒM GÓP Ý CỦA STUDIO — cùng khuôn hòm góp ý mos2 (apps/web/src/lib/actions/gop-y-mos2.ts), anh yêu cầu 08/10/2026.
// Studio dùng chung DB mos2_prod nên ghi THẲNG card vào human_tasks, project 'xuong-video' (bảng mos2.on.tc/p/xuong-video/plays):
// card = bản ghi, luồng trao đổi trong prep_payload.trao_doi, trạng thái prep_payload.site_status['xuong-video'].
// Claude nhặt bằng `GOPY_PROJECT=xuong-video scripts/gop-y.sh` (lệnh /tasks-studio). Ảnh lên R2 thư mục gop-y-studio.
import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2, r2Enabled } from '@/lib/r2';

const DU_AN = 'xuong-video';
export type TinTraoDoi = { nguoi: string; noiDung: string; xuLy: string | null; luc: string; anh: string[]; trang?: string; nguCanh?: string };
export type GopYCuaToi = {
  id: number; loai: string; noiDung: string; trang: string; trangThai: string; luc: string; capNhat: string; soTin: number;
  tinCuoi: { nguoi: string; noiDung: string; luc: string; xuLy: string | null } | null;
};
type Kq = { ok: boolean; error?: string };

const homNayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

/** Ảnh đính kèm (data URL đã thu nhỏ ở trình duyệt) → R2, trả URL công khai. */
export async function taiAnhGopY(dataUrl: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!(await getCurrentUser())) return { ok: false, error: 'chưa đăng nhập' };
  const m = (dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/s);
  if (!m) return { ok: false, error: 'không phải ảnh base64' };
  const buf = Buffer.from(m[2]!, 'base64');
  if (buf.length > 8_000_000) return { ok: false, error: 'ảnh quá lớn (>8MB)' };
  if (!r2Enabled()) return { ok: false, error: 'storage chưa cấu hình' };
  const url = await uploadToR2(`gop-y-studio/${randomUUID()}.${m[1]!.split('/')[1]}`, buf, m[1]!);
  return url ? { ok: true, url } : { ok: false, error: 'upload thất bại' };
}
/** Bỏ ảnh chưa gửi (✕ hoặc Huỷ nháp): chỉ gỡ khỏi form, KHÔNG xoá file R2 — studio không xoá thật bất cứ thứ gì (card #1192). */
export async function xoaAnhGopY(_url: string): Promise<{ ok: boolean }> {
  return { ok: true };
}

async function datTrangThai(id: number, st: string, url = '') {
  const db = getDb()!;
  await db.execute(sql`UPDATE human_tasks SET prep_payload = COALESCE(prep_payload, '{}'::jsonb)
      || jsonb_build_object('site_status', COALESCE(prep_payload->'site_status', '{}'::jsonb) || jsonb_build_object(${DU_AN}::text, to_jsonb(${st}::text)))
      || jsonb_build_object('site_url', COALESCE(prep_payload->'site_url', '{}'::jsonb) || jsonb_build_object(${DU_AN}::text, to_jsonb(${url}::text))),
      status = CASE WHEN ${st} IN ('completed','verified') THEN 'completed' ELSE 'pending' END,
      completed_at = CASE WHEN ${st} IN ('completed','verified') THEN now() ELSE NULL END, updated_at = now()
    WHERE id = ${id} AND platform_key = 'backlink'`);
}
async function henHomNay(id: number) {
  const db = getDb()!;
  await db.execute(sql`UPDATE human_tasks SET prep_payload = COALESCE(prep_payload, '{}'::jsonb)
      || jsonb_build_object('site_scheduled_at', COALESCE(prep_payload->'site_scheduled_at', '{}'::jsonb) || jsonb_build_object(${DU_AN}::text, to_jsonb(${homNayVN()}::text))),
      updated_at = now() WHERE id = ${id} AND platform_key = 'backlink'`);
}

/** Gửi góp ý → card pending trên plays `xuong-video`, hẹn hôm nay. Admin-only như hòm mos2. */
export async function guiGopY(input: { loai: string; noiDung: string; trang: string; anhUrls: string[]; nguCanh?: string }): Promise<Kq & { id?: number }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'không có quyền' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const noiDung = input.noiDung.trim();
  if (!noiDung) return { ok: false, error: 'Chưa gõ mô tả.' };
  const trang = String(input.trang || '').slice(0, 1000);
  const nguCanh = String(input.nguCanh || '').slice(0, 3000);
  const anh = (Array.isArray(input.anhUrls) ? input.anhUrls : []).filter((u) => /^https?:\/\//.test(u)).slice(0, 6);
  const dongDau = (noiDung.split('\n')[0] ?? '').trim().slice(0, 60);
  const title = input.loai === 'cau_hoi' ? `Hỏi: ${dongDau}` : dongDau;
  const draft = [noiDung, trang ? `[Trang báo lỗi ↗](${trang})` : '', nguCanh ? `Ngữ cảnh: ${nguCanh}` : '', ...anh.map((u) => `![ảnh](${u})`)].filter(Boolean).join('\n\n').slice(0, 20_000);
  const goc: TinTraoDoi = { nguoi: me.email, noiDung: noiDung.slice(0, 4000), xuLy: null, luc: new Date().toISOString(), anh, trang: trang || undefined, nguCanh: nguCanh || undefined };
  const pp = { source_url: trang, source_platform: 'feedback', draft, loai: input.loai === 'cau_hoi' ? 'cau_hoi' : 'loi', trao_doi: [goc] };
  const r = (await db.execute(sql`
    INSERT INTO human_tasks (tenant_id, project_id, title, instructions, prep_payload, platform_key, status, publish_url)
    VALUES ('self', ${DU_AN}, ${title}, ${`${noiDung}\n\nTrang báo: ${trang}${nguCanh ? `\nNgữ cảnh: ${nguCanh}` : ''}`.slice(0, 6000)}, ${JSON.stringify(pp)}::jsonb, 'backlink', 'pending', '')
    RETURNING id`)) as unknown as Array<{ id: number }>;
  const id = Number(r[0]?.id);
  if (!Number.isFinite(id)) return { ok: false, error: 'insert hỏng' };
  await datTrangThai(id, 'pending');
  await henHomNay(id);
  return { ok: true, id };
}

/** Góp ý CỦA TÔI: card còn mở + card đóng trong 7 ngày. */
export async function dsGopYCuaToi(): Promise<GopYCuaToi[]> {
  const me = await getCurrentUser();
  const db = getDb();
  if (!me || !db) return [];
  const r = await db.execute(sql`
    SELECT id, created_at, updated_at,
           COALESCE(prep_payload->'site_status'->>${DU_AN}, status) AS tt,
           COALESCE(prep_payload->>'loai', 'loi') AS loai,
           COALESCE(prep_payload->>'source_url', '') AS trang,
           COALESCE(prep_payload->'trao_doi', '[]'::jsonb) AS td
    FROM human_tasks
    WHERE project_id = ${DU_AN} AND prep_payload->>'source_platform' = 'feedback'
      AND lower(prep_payload->'trao_doi'->0->>'nguoi') = lower(${me.email})
      AND (COALESCE(prep_payload->'site_status'->>${DU_AN}, status) IN ('pending','claimed','submitted','review','broken') OR updated_at >= now() - interval '7 days')
    ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 200`);
  type Row = { id: number; created_at: string | Date; updated_at: string | Date | null; tt: string; loai: string; trang: string; td: unknown };
  return (r as unknown as Row[]).map((x) => {
    const td = (Array.isArray(x.td) ? x.td : []) as TinTraoDoi[];
    const goc = td[0]; const cuoi = td.length > 1 ? td[td.length - 1]! : null;
    return {
      id: Number(x.id), loai: String(x.loai || 'loi'), noiDung: String(goc?.noiDung ?? ''), trang: String(x.trang || goc?.trang || ''),
      trangThai: String(x.tt || 'pending'), luc: new Date(x.created_at).toISOString(), capNhat: new Date(x.updated_at ?? x.created_at).toISOString(),
      soTin: Math.max(0, td.length - 1), tinCuoi: cuoi ? { nguoi: cuoi.nguoi, noiDung: cuoi.noiDung, luc: cuoi.luc, xuLy: cuoi.xuLy } : null,
    };
  });
}

export async function docTraoDoi(taskId: number): Promise<TinTraoDoi[]> {
  const db = getDb();
  if (!(await getCurrentUser()) || !db) return [];
  const r = await db.execute(sql`SELECT prep_payload->'trao_doi' AS td FROM human_tasks
    WHERE id = ${taskId} AND project_id = ${DU_AN} AND prep_payload->>'source_platform' = 'feedback' LIMIT 1`);
  const td = (r as unknown as Array<{ td: unknown }>)[0]?.td;
  return Array.isArray(td) ? (td as TinTraoDoi[]) : [];
}

/** Trả lời trong luồng: rework → card về Chờ xử (hẹn lại hôm nay) · duyet → Xong (admin) · còn lại chỉ thêm tin. */
export async function guiTraoDoi(input: { taskId: number; noiDung: string; anhUrls: string[]; xuLy: string }): Promise<Kq> {
  const me = await getCurrentUser();
  const db = getDb();
  if (!me || !db) return { ok: false, error: 'chưa đăng nhập' };
  const noiDung = input.noiDung.trim();
  if (!noiDung) return { ok: false, error: 'Chưa gõ nội dung.' };
  const xuLy = input.xuLy === 'rework' || input.xuLy === 'duyet' ? input.xuLy : null;
  if (xuLy === 'duyet' && me.role !== 'admin') return { ok: false, error: 'Duyệt xong là quyền admin.' };
  const tin: TinTraoDoi = { nguoi: me.displayName || me.email, noiDung: noiDung.slice(0, 4000), xuLy, luc: new Date().toISOString(),
    anh: (Array.isArray(input.anhUrls) ? input.anhUrls : []).filter((u) => /^https?:\/\//.test(u)).slice(0, 6) };
  const up = await db.execute(sql`UPDATE human_tasks SET prep_payload = jsonb_set(COALESCE(prep_payload, '{}'::jsonb), '{trao_doi}',
        COALESCE(prep_payload->'trao_doi', '[]'::jsonb) || ${JSON.stringify(tin)}::jsonb, true), updated_at = now()
    WHERE id = ${input.taskId} AND project_id = ${DU_AN} AND prep_payload->>'source_platform' = 'feedback' RETURNING id`);
  if (!(up as unknown as unknown[]).length) return { ok: false, error: 'Không phải card góp ý studio.' };
  if (xuLy === 'rework') { await datTrangThai(input.taskId, 'pending'); await henHomNay(input.taskId); }
  if (xuLy === 'duyet') await datTrangThai(input.taskId, 'completed', `https://mos2.on.tc/plays?proj=${DU_AN}&task=${input.taskId}`);
  return { ok: true };
}
