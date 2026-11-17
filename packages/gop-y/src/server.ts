// HÒM GÓP Ý DÙNG CHUNG — phần máy chủ. Gom từ apps/xuong-video/src/lib/gop-y.ts (10/10/2026) để mọi app con dùng MỘT bản:
// card = human_tasks platform_key 'backlink', source_platform 'feedback', project = `duAn` → mos2.on.tc/p/<duAn>/plays;
// luồng trao đổi trong prep_payload.trao_doi, trạng thái prep_payload.site_status[duAn].
// Mỗi app chỉ giữ một tệp 'use server' mỏng: lấy người đăng nhập + R2 của app rồi gọi các hàm ở đây.
// Claude nhặt bằng `GOPY_PROJECT=<duAn> scripts/gop-y.sh`.
import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import fs from 'node:fs';
import path from 'node:path';
import { choToi, conTrongTran, luotDangChay, KY_SU_HOM, DEM_RONG, type DemGopY } from './dem';

export type Nguoi = { email: string; displayName?: string | null; role: string };
export type TinTraoDoi = { nguoi: string; noiDung: string; xuLy: string | null; luc: string; anh: string[]; trang?: string; nguCanh?: string };
export type GopYCuaToi = {
  id: number; loai: string; noiDung: string; trang: string; trangThai: string; luc: string; capNhat: string; soTin: number;
  tinCuoi: { nguoi: string; noiDung: string; luc: string; xuLy: string | null } | null;
  /** card đang chờ CHÍNH người xem (kỹ sư hỏi chưa ai đáp / kẹt) — số đỏ trên nút 💬 (CHUAN.md) */
  choYKien?: boolean;
};
export type Kq = { ok: boolean; error?: string };
export type { DemGopY } from './dem';
/** Luật riêng của app (vd mos2: team ETP gửi được, lọc card theo nguồn etp, admin thấy card máy tạo, trạng thái qua setBacklinkSite). */
export type TuyChon = {
  /** app đã tự xét quyền gửi (thay luật mặc định admin-only) */
  choPhepGui?: boolean;
  /** chỉ lấy card có source_url khớp / không khớp mẫu regex Postgres */
  locNguon?: { mau: string; khop: boolean };
  /** admin thấy thêm card có người gửi là máy (vd 'may-quet', 'claude') */
  nguoiMay?: string[];
  /** ghi trạng thái theo đường của app (thay datTrangThai/henHomNay mặc định) */
  datTrangThai?: (id: number, hom: string, st: string, url: string) => Promise<unknown>;
  henHomNay?: (id: number, hom: string) => Promise<unknown>;
};
const dsHom = (duAn: string | string[]) => (Array.isArray(duAn) ? duAn : [duAn]);
const trongHom = (duAn: string | string[]) => sql`project_id IN (${sql.join(dsHom(duAn).map((h) => sql`${h}`), sql`, `)})`;
/** Ngoài admin, chỉ đọc / trả lời card chính mình gửi. */
const cuaMinh = (me: Nguoi) => (me.role === 'admin' ? sql`` : sql`AND lower(prep_payload->'trao_doi'->0->>'nguoi') = lower(${me.email})`);
async function ghiTT(o: TuyChon | undefined, duAn: string, id: number, st: string, url = ''): Promise<unknown> { return o?.datTrangThai ? o.datTrangThai(id, duAn, st, url) : datTrangThai(duAn, id, st, url); }
async function hen(o: TuyChon | undefined, duAn: string, id: number) { if (o?.henHomNay) await o.henHomNay(id, duAn); else await henHomNay(duAn, id); }

export type R2 = { r2Enabled: () => boolean; uploadToR2: (key: string, buf: Buffer, type: string) => Promise<string | null> };

const homNayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

/** Ảnh đính kèm (data URL đã thu nhỏ ở trình duyệt) → R2 thư mục `thuMuc`, trả URL công khai. */
export async function taiAnh(me: Nguoi | null, dataUrl: string, thuMuc: string, r2: R2): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!me) return { ok: false, error: 'chưa đăng nhập' };
  const m = (dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/s);
  if (!m) return { ok: false, error: 'không phải ảnh base64' };
  const buf = Buffer.from(m[2]!, 'base64');
  if (buf.length > 8_000_000) return { ok: false, error: 'ảnh quá lớn (>8MB)' };
  if (!r2.r2Enabled()) return { ok: false, error: 'storage chưa cấu hình' };
  const url = await r2.uploadToR2(`${thuMuc}/${randomUUID()}.${m[1]!.split('/')[1]}`, buf, m[1]!);
  return url ? { ok: true, url } : { ok: false, error: 'upload thất bại' };
}

async function datTrangThai(duAn: string, id: number, st: string, url = '') {
  const db = getDb()!;
  await db.execute(sql`UPDATE human_tasks SET prep_payload = COALESCE(prep_payload, '{}'::jsonb)
      || jsonb_build_object('site_status', COALESCE(prep_payload->'site_status', '{}'::jsonb) || jsonb_build_object(${duAn}::text, to_jsonb(${st}::text)))
      || jsonb_build_object('site_url', COALESCE(prep_payload->'site_url', '{}'::jsonb) || jsonb_build_object(${duAn}::text, to_jsonb(${url}::text))),
      status = CASE WHEN ${st} IN ('completed','verified') THEN 'completed' ELSE 'pending' END,
      completed_at = CASE WHEN ${st} IN ('completed','verified') THEN now() ELSE NULL END, updated_at = now()
    WHERE id = ${id} AND platform_key = 'backlink'`);
}
async function henHomNay(duAn: string, id: number) {
  const db = getDb()!;
  await db.execute(sql`UPDATE human_tasks SET prep_payload = COALESCE(prep_payload, '{}'::jsonb)
      || jsonb_build_object('site_scheduled_at', COALESCE(prep_payload->'site_scheduled_at', '{}'::jsonb) || jsonb_build_object(${duAn}::text, to_jsonb(${homNayVN()}::text))),
      updated_at = now() WHERE id = ${id} AND platform_key = 'backlink'`);
}

/** Gửi góp ý → card pending trên plays `duAn`, hẹn hôm nay. Admin-only như hòm mos2. */
export async function guiGopY(duAn: string, me: Nguoi | null, input: { loai: string; noiDung: string; trang: string; anhUrls: string[]; nguCanh?: string }, o?: TuyChon): Promise<Kq & { id?: number }> {
  if (!me || (me.role !== 'admin' && !o?.choPhepGui)) return { ok: false, error: 'không có quyền' };
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
    VALUES ('self', ${duAn}, ${title}, ${`${noiDung}\n\nTrang báo: ${trang}${nguCanh ? `\nNgữ cảnh: ${nguCanh}` : ''}`.slice(0, 6000)}, ${JSON.stringify(pp)}::jsonb, 'backlink', 'pending', '')
    RETURNING id`)) as unknown as Array<{ id: number }>;
  const id = Number(r[0]?.id);
  if (!Number.isFinite(id)) return { ok: false, error: 'insert hỏng' };
  await ghiTT(o, duAn, id, 'pending');
  await hen(o, duAn, id);
  return { ok: true, id };
}

/** Góp ý CỦA TÔI: card còn mở + card đóng trong 7 ngày. */
export async function dsGopYCuaToi(duAn: string, me: Nguoi | null, o?: TuyChon): Promise<GopYCuaToi[]> {
  const db = getDb();
  if (!me || !db) return [];
  const r = await db.execute(sql`
    SELECT id, created_at, updated_at,
           COALESCE(prep_payload->'site_status'->>${duAn}, status) AS tt,
           COALESCE(prep_payload->>'loai', CASE WHEN title LIKE 'Hỏi: %' THEN 'cau_hoi' ELSE 'loi' END) AS loai,
           COALESCE(prep_payload->>'source_url', '') AS trang,
           COALESCE(prep_payload->'trao_doi', '[]'::jsonb) AS td
    FROM human_tasks
    WHERE project_id = ${duAn} AND prep_payload->>'source_platform' = 'feedback'
      AND (lower(prep_payload->'trao_doi'->0->>'nguoi') = lower(${me.email})
           ${me.role === 'admin' && o?.nguoiMay?.length ? sql`OR lower(prep_payload->'trao_doi'->0->>'nguoi') IN (${sql.join(o.nguoiMay.map((n) => sql`${n}`), sql`, `)})` : sql``})
      ${o?.locNguon ? sql`AND (COALESCE(prep_payload->>'source_url', '') ~ ${o.locNguon.mau}) = ${o.locNguon.khop}` : sql``}
      AND (COALESCE(prep_payload->'site_status'->>${duAn}, status) IN ('pending','claimed','submitted','review','broken') OR updated_at >= now() - interval '7 days')
    ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 200`);
  type Row = { id: number; created_at: string | Date; updated_at: string | Date | null; tt: string; loai: string; trang: string; td: unknown };
  const laToi = laNguoi(me);
  return (r as unknown as Row[]).map((x) => {
    const td = (Array.isArray(x.td) ? x.td : []) as TinTraoDoi[];
    const goc = td[0]; const cuoi = td.length > 1 ? td[td.length - 1]! : null;
    const trangThai = String(x.tt || 'pending');
    const tinCuoi = cuoi ? { nguoi: cuoi.nguoi, noiDung: cuoi.noiDung, luc: cuoi.luc, xuLy: cuoi.xuLy } : null;
    return {
      id: Number(x.id), loai: String(x.loai || 'loi'), noiDung: String(goc?.noiDung ?? ''), trang: String(x.trang || goc?.trang || ''),
      trangThai, luc: new Date(x.created_at).toISOString(), capNhat: new Date(x.updated_at ?? x.created_at).toISOString(),
      soTin: Math.max(0, td.length - 1), tinCuoi, choYKien: choToi(trangThai, tinCuoi, laToi),
    };
  });
}

/** Tin trong luồng có phải của người này: tin gốc ghi email, tin trả lời ghi displayName || email (guiTraoDoi). */
const laNguoi = (me: Nguoi) => {
  const ten = new Set([me.email, me.displayName].filter(Boolean).map((s) => String(s).trim().toLowerCase()));
  return (nguoi: string) => ten.has(String(nguoi ?? '').trim().toLowerCase());
};

/** Kỹ sư CLI phụ trách hòm đang chạy một lượt? Đọc dòng cuối nhật ký nhịp <CTY_DATA_DIR>/nhip/<người>.json (bộ điều phối iMac đẩy về box3). */
function kySuDangChay(duAn: string): string | null {
  const nguoi = KY_SU_HOM[duAn]; if (!nguoi) return null;
  try { return luotDangChay(JSON.parse(fs.readFileSync(path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'nhip', `${nguoi}.json`), 'utf8'))); }
  catch { return null; }   // máy không có nhật ký (dev / app khác máy) → chỉ dựa vào card claimed
}

/** SỐ CHO NÚT 💬 (CHUAN.md): working = card claimed của hòm (mọi người gửi, còn trong trần phiên) + lượt kỹ sư CLI đang chạy;
 *  can_y_kien = card CỦA CHÍNH người xem đang chờ họ. Nút nạp 60 giây một lần khi tab đang hiện. */
export async function demGopY(duAn: string, me: Nguoi | null, o?: TuyChon): Promise<DemGopY> {
  const db = getDb();
  if (!me || !db) return DEM_RONG;
  const r = await db.execute(sql`SELECT id, title, updated_at FROM human_tasks
    WHERE project_id = ${duAn} AND prep_payload->>'source_platform' = 'feedback'
      AND COALESCE(prep_payload->'site_status'->>${duAn}, status) = 'claimed'
      ${o?.locNguon ? sql`AND (COALESCE(prep_payload->>'source_url', '') ~ ${o.locNguon.mau}) = ${o.locNguon.khop}` : sql``}
    ORDER BY updated_at DESC LIMIT 20`);
  const lam = (r as unknown as Array<{ id: number; title: string; updated_at: string | Date }>)
    .filter((x) => conTrongTran(new Date(x.updated_at).toISOString())).map((x) => `#${x.id} ${String(x.title ?? '').slice(0, 60)}`);
  const luot = kySuDangChay(duAn);
  const dangLam = lam.length ? lam : luot ? [luot] : [];
  const cho = (await dsGopYCuaToi(duAn, me, o)).filter((b) => b.choYKien);
  return { working: dangLam.length, dangLam, can_y_kien: cho.length, choYKien: cho.map((b) => b.id) };
}

export async function docTraoDoi(duAn: string | string[], me: Nguoi | null, taskId: number): Promise<TinTraoDoi[]> {
  const db = getDb();
  if (!me || !db) return [];
  const r = await db.execute(sql`SELECT prep_payload->'trao_doi' AS td FROM human_tasks
    WHERE id = ${taskId} AND ${trongHom(duAn)} AND prep_payload->>'source_platform' = 'feedback' ${cuaMinh(me)} LIMIT 1`);
  const td = (r as unknown as Array<{ td: unknown }>)[0]?.td;
  return Array.isArray(td) ? (td as TinTraoDoi[]) : [];
}

/** Trả lời trong luồng: rework → card về Chờ xử (hẹn lại hôm nay) · duyet → Xong (admin) · còn lại chỉ thêm tin. */
export async function guiTraoDoi(duAn: string | string[], me: Nguoi | null, input: { taskId: number; noiDung: string; anhUrls: string[]; xuLy: string }, o?: TuyChon): Promise<Kq> {
  const db = getDb();
  if (!me || !db) return { ok: false, error: 'chưa đăng nhập' };
  const xuLy = input.xuLy === 'rework' || input.xuLy === 'duyet' ? input.xuLy : null;
  // Đọc xong là duyệt được, không bắt gõ chữ (#1234); trả lời / làm lại vẫn phải có nội dung.
  const noiDung = input.noiDung.trim() || (xuLy === 'duyet' ? 'Đã duyệt.' : '');
  if (!noiDung) return { ok: false, error: xuLy === 'rework' ? 'Ghi chỗ chưa đạt để làm lại.' : 'Chưa gõ nội dung.' };
  if (xuLy === 'duyet' && me.role !== 'admin') return { ok: false, error: 'Duyệt xong là quyền admin.' };
  const tin: TinTraoDoi = { nguoi: me.displayName || me.email, noiDung: noiDung.slice(0, 4000), xuLy, luc: new Date().toISOString(),
    anh: (Array.isArray(input.anhUrls) ? input.anhUrls : []).filter((u) => /^https?:\/\//.test(u)).slice(0, 6) };
  const up = await db.execute(sql`UPDATE human_tasks SET prep_payload = jsonb_set(COALESCE(prep_payload, '{}'::jsonb), '{trao_doi}',
        COALESCE(prep_payload->'trao_doi', '[]'::jsonb) || ${JSON.stringify(tin)}::jsonb, true), updated_at = now()
    WHERE id = ${input.taskId} AND ${trongHom(duAn)} AND prep_payload->>'source_platform' = 'feedback' ${cuaMinh(me)} RETURNING id, project_id`);
  const hom = (up as unknown as Array<{ project_id: string }>)[0]?.project_id;
  if (!hom) return { ok: false, error: 'Không phải card góp ý của hòm này.' };
  if (xuLy === 'rework') { await ghiTT(o, hom, input.taskId, 'pending'); await hen(o, hom, input.taskId); }
  if (xuLy === 'duyet') {
    const r2 = (await ghiTT(o, hom, input.taskId, 'completed', `https://mos2.on.tc/plays?proj=${hom}&task=${input.taskId}`)) as Kq | undefined;
    if (r2 && r2.ok === false) return { ok: false, error: r2.error || 'không đóng được card' };
  }
  return { ok: true };
}
