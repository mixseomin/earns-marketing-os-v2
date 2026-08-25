'use server';

// HÒM GÓP Ý CỦA CHÍNH MOS2 — nút nổi trên mọi màn (admin), card rơi thẳng vào plays
// project `mos2` với cùng khuôn card góp ý adfond (source_platform='feedback' → GopYDrawer
// tối giản). Khác adfond một điểm kiến trúc: MOS2 *là* bảng task, nên không có "bản ghi
// gốc" ở app khác — card chính là bản ghi, luồng trao đổi sống ngay trong
// prep_payload.trao_doi của card, ảnh đi đường R2 sẵn có (ImageAttach/uploadImage).

import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { setBacklinkSite, setBacklinkSchedule } from '@/lib/actions/architecture';

export type TinTraoDoi = { nguoi: string; noiDung: string; xuLy: string | null; luc: string; anh: string[] };

const homNayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

/** Gửi góp ý về MOS2 → một card pending trên plays `mos2`, follow hôm nay (nằm trong ô
 *  calendar), draft = nội dung + link trang + ảnh. Admin-only — cùng khẩu vị cờ htuan82
 *  bên adfond: hòm này là kênh của người chủ, không phải kênh nhân sự (họ có blocker 🚩). */
export async function guiGopYMos2(input: {
  loai: string; noiDung: string; trang: string; anhUrls: string[];
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'not found' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const noiDung = input.noiDung.trim();
  if (!noiDung) return { ok: false, error: 'Chưa gõ mô tả.' };

  const trang = String(input.trang || '').slice(0, 1000);
  const anh = (Array.isArray(input.anhUrls) ? input.anhUrls : []).filter((u) => /^https?:\/\//.test(u)).slice(0, 6);
  const dongDau = (noiDung.split('\n')[0] ?? '').trim().slice(0, 90);
  const title = `${input.loai === 'cau_hoi' ? 'Hỏi' : 'Góp ý'} MOS2: ${dongDau}`;
  const draft = [noiDung, '', trang ? `[Trang báo lỗi ↗](${trang})` : '', ...anh.map((u) => `![ảnh](${u})`)]
    .filter(Boolean).join('\n\n').slice(0, 20_000);
  const pp = {
    source_url: trang, source_platform: 'feedback', draft,
    nguoi_gui: me.email,
  };

  const r = await db.execute(sql`
    INSERT INTO human_tasks (tenant_id, project_id, title, instructions, prep_payload, platform_key, status, publish_url)
    VALUES ('self', 'mos2', ${title}, ${`${noiDung}\n\nTrang báo: ${trang}`.slice(0, 4000)}, ${JSON.stringify(pp)}::jsonb, 'backlink', 'pending', '')
    RETURNING id`);
  const id = Number((r as unknown as Array<{ id: number }>)[0]?.id);
  if (!Number.isFinite(id)) return { ok: false, error: 'insert hỏng' };
  await setBacklinkSite(id, 'mos2', 'pending', '');
  await setBacklinkSchedule(id, 'mos2', homNayVN());
  return { ok: true, id };
}

/** Luồng trao đổi của một card góp ý MOS2 (prep_payload.trao_doi). */
export async function docTraoDoiCard(taskId: number): Promise<TinTraoDoi[]> {
  if (!(await getCurrentUser())) return [];
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`
    SELECT prep_payload->'trao_doi' AS td FROM human_tasks WHERE id = ${taskId} LIMIT 1`);
  const td = (r as unknown as Array<{ td: unknown }>)[0]?.td;
  return Array.isArray(td) ? (td as TinTraoDoi[]) : [];
}

/** Reply vào luồng của card MOS2 — bấm Gửi là trạng thái đổi theo (cùng ngữ nghĩa adfond):
 *  rework → card To-do · duyet → card Done (admin, kèm source_url làm bằng chứng) ·
 *  ghi_chu → chỉ thêm tin. */
export async function guiTraoDoiCard(input: {
  taskId: number; noiDung: string; anhUrls: string[]; xuLy: string;
}): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: 'not found' };
  const db = getDb();
  if (!db) return { ok: false, error: 'no db' };
  const noiDung = input.noiDung.trim();
  if (!noiDung) return { ok: false, error: 'Chưa gõ nội dung.' };
  const xuLy = input.xuLy === 'rework' || input.xuLy === 'duyet' ? input.xuLy : null;
  // Duyệt = chữ ký nghiệm thu — chỉ admin; rework/ghi chú thì nhân sự nào cũng nói được.
  if (xuLy === 'duyet' && me.role !== 'admin') return { ok: false, error: 'Duyệt xong là quyền admin.' };

  const tin: TinTraoDoi = {
    nguoi: me.displayName || me.name || me.email,
    noiDung: noiDung.slice(0, 4000),
    xuLy,
    luc: new Date().toISOString(),
    anh: (Array.isArray(input.anhUrls) ? input.anhUrls : []).filter((u) => /^https?:\/\//.test(u)).slice(0, 6),
  };
  await db.execute(sql`
    UPDATE human_tasks
    SET prep_payload = jsonb_set(COALESCE(prep_payload, '{}'::jsonb), '{trao_doi}',
          COALESCE(prep_payload->'trao_doi', '[]'::jsonb) || ${JSON.stringify(tin)}::jsonb, true),
        updated_at = now()
    WHERE id = ${input.taskId}`);

  if (xuLy === 'rework') await setBacklinkSite(input.taskId, 'mos2', 'pending', '');
  if (xuLy === 'duyet') {
    const r = await db.execute(sql`SELECT prep_payload->>'source_url' AS src FROM human_tasks WHERE id = ${input.taskId} LIMIT 1`);
    const src = String((r as unknown as Array<{ src: string | null }>)[0]?.src || '');
    const r2 = await setBacklinkSite(input.taskId, 'mos2', 'completed', src);
    if (!r2.ok) return { ok: false, error: r2.error || 'không đóng được card' };
  }
  return { ok: true };
}
