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

export type TinTraoDoi = { nguoi: string; noiDung: string; xuLy: string | null; luc: string; anh: string[];
  /** Trang đang bị lỗi — chỉ tin gốc có. Cùng khuôn `TraoDoi.trang` bên adfond để MỘT drawer
   *  đọc được cả hai nguồn; thiếu nó thì card góp ý MOS2 lại là ca không biết sửa ở đâu. */
  trang?: string };

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
  // Tiêu đề = chữ người gửi. Loại việc do glyph 🐞 nói (source_platform='feedback' → TYPE_META),
  // project do bảng nói — gắn thêm "Góp ý MOS2:" chỉ làm pill trên lịch dài và lặp.
  const dongDau = (noiDung.split('\n')[0] ?? '').trim().slice(0, 60);
  const title = input.loai === 'cau_hoi' ? `Hỏi: ${dongDau}` : dongDau;
  const draft = [noiDung, trang ? `[Trang báo lỗi ↗](${trang})` : '', ...anh.map((u) => `![ảnh](${u})`)]
    .filter(Boolean).join('\n\n').slice(0, 20_000);
  // Tin GỐC = tin đầu của luồng (người gửi · lúc gửi · ảnh) — cùng khuôn adfond (luongGopY):
  // góp ý là câu mở đầu cuộc trao đổi, reply nối vào sau, không phải một khối tách rời.
  const goc: TinTraoDoi = { nguoi: me.email, noiDung: noiDung.slice(0, 4000), xuLy: null, luc: new Date().toISOString(), anh, trang: trang || undefined };
  const pp = {
    source_url: trang, source_platform: 'feedback', draft,
    loai: input.loai === 'cau_hoi' ? 'cau_hoi' : 'loi',   // tab "Của tôi" in nhãn loại từ đây, không đoán lại từ tiêu đề
    trao_doi: [goc],
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

/** Một dòng trong tab "Của tôi" của hòm góp ý — cùng khuôn `GopYCuaToi` bên adfond, chỉ khác
 *  là card CHÍNH LÀ bản ghi nên `id` = số card (số duy nhất người dùng gọi tên). */
export type GopYCuaToi = {
  id: number; loai: string; noiDung: string; trang: string;
  /** site_status['mos2'] — pending (chờ xử) · claimed (đang làm) · review (chờ duyệt) · completed (xong) · dropped (bỏ). */
  trangThai: string;
  luc: string; capNhat: string;
  /** Số tin trao đổi SAU tin gốc. */
  soTin: number;
  /** Tin mới nhất trong luồng (không tính tin gốc) — ai nói, nói gì, lúc nào. */
  tinCuoi: { nguoi: string; noiDung: string; luc: string; xuLy: string | null } | null;
};

/** Góp ý CỦA TÔI: mọi card còn mở + card đã đóng trong 7 ngày (lọc HIỂN THỊ, không xoá — cùng
 *  lằn ranh adfond). Người gửi = tin gốc của luồng (`trao_doi[0].nguoi`), vì card không có cột
 *  người tạo. Xếp theo đúng cột màn hình in ra (cập nhật). */
export async function dsGopYCuaToi(): Promise<GopYCuaToi[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`
    SELECT id, created_at, updated_at,
           COALESCE(prep_payload->'site_status'->>'mos2', status) AS tt,
           COALESCE(prep_payload->>'loai', CASE WHEN title LIKE 'Hỏi: %' THEN 'cau_hoi' ELSE 'loi' END) AS loai,
           COALESCE(prep_payload->>'source_url', '') AS trang,
           COALESCE(prep_payload->'trao_doi', '[]'::jsonb) AS td
    FROM human_tasks
    WHERE project_id = 'mos2' AND prep_payload->>'source_platform' = 'feedback'
      AND lower(prep_payload->'trao_doi'->0->>'nguoi') = lower(${me.email})
      AND (COALESCE(prep_payload->'site_status'->>'mos2', status) IN ('pending','claimed','submitted','review','broken')
           OR updated_at >= now() - interval '7 days')
    ORDER BY updated_at DESC NULLS LAST, id DESC
    LIMIT 200`);
  type Row = { id: number; created_at: string | Date; updated_at: string | Date | null; tt: string; loai: string; trang: string; td: unknown };
  return (r as unknown as Row[]).map((x) => {
    const td = (Array.isArray(x.td) ? x.td : []) as TinTraoDoi[];
    const goc = td[0];
    const cuoi = td.length > 1 ? td[td.length - 1]! : null;
    return {
      id: Number(x.id), loai: String(x.loai || 'loi'),
      noiDung: String(goc?.noiDung ?? ''), trang: String(x.trang || goc?.trang || ''),
      trangThai: String(x.tt || 'pending'),
      luc: new Date(x.created_at).toISOString(), capNhat: new Date(x.updated_at ?? x.created_at).toISOString(),
      soTin: Math.max(0, td.length - 1),
      tinCuoi: cuoi ? { nguoi: cuoi.nguoi, noiDung: cuoi.noiDung, luc: cuoi.luc, xuLy: cuoi.xuLy } : null,
    };
  });
}

/** Luồng trao đổi của một card góp ý MOS2 (prep_payload.trao_doi). */
export async function docTraoDoiCard(taskId: number): Promise<TinTraoDoi[]> {
  if (!(await getCurrentUser())) return [];
  const db = getDb();
  if (!db) return [];
  const r = await db.execute(sql`
    SELECT prep_payload->'trao_doi' AS td FROM human_tasks
    WHERE id = ${taskId} AND project_id = 'mos2' AND prep_payload->>'source_platform' = 'feedback' LIMIT 1`);
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
  // CHỈ card góp ý mos2 — action nào cũng gọi được từ client nên phạm vi phải nằm trong
  // WHERE, không nằm ở "UI chỉ gọi đúng chỗ": thiếu nó thì mọi taskId đều bị ghi thread
  // + rework đè site_status['mos2'] lên card của project khác.
  const up = await db.execute(sql`
    UPDATE human_tasks
    SET prep_payload = jsonb_set(COALESCE(prep_payload, '{}'::jsonb), '{trao_doi}',
          COALESCE(prep_payload->'trao_doi', '[]'::jsonb) || ${JSON.stringify(tin)}::jsonb, true),
        updated_at = now()
    WHERE id = ${input.taskId} AND project_id = 'mos2' AND prep_payload->>'source_platform' = 'feedback'
    RETURNING id`);
  if (!(up as unknown as Array<{ id: number }>).length) return { ok: false, error: 'Không phải card góp ý mos2.' };

  if (xuLy === 'rework') {
    await setBacklinkSite(input.taskId, 'mos2', 'pending', '');
    // Review/completed trước đó đã xoá follow date; về pending mà không đặt lại thì card
    // không còn ngày nào → tàng hình khỏi calendar (bài học card #616 bên adfond, 26/08).
    await setBacklinkSchedule(input.taskId, 'mos2', homNayVN());
  }
  if (xuLy === 'duyet') {
    const r = await db.execute(sql`SELECT prep_payload->>'source_url' AS src FROM human_tasks WHERE id = ${input.taskId} LIMIT 1`);
    const src = String((r as unknown as Array<{ src: string | null }>)[0]?.src || '');
    const r2 = await setBacklinkSite(input.taskId, 'mos2', 'completed', src);
    if (!r2.ok) return { ok: false, error: r2.error || 'không đóng được card' };
  }
  return { ok: true };
}
