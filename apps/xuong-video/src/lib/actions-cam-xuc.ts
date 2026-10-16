'use server';
// Server action của MURCH QC (qc-cam-xuc.ts) — tách khỏi actions.ts: kế hoạch biểu cảm + nối liền của một shot, bật / tắt Murch QC của phim.
// Cùng luật quyền (admin) + sổ hoàn tác (↶) như actions.ts.
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { chupTruoc } from '@/lib/xuong-video/hoan-tac';
import { BIEU_CAM, type BieuCamNv } from '@/lib/xuong-video/qc-cam-xuc';

type Kq = { ok: true; data: undefined } | { ok: false; loi: string };
const loi = (m: string): Kq => ({ ok: false, loi: m });
async function admin() { const me = await getCurrentUser(); return me && me.role === 'admin' ? me : null; }
const hopMa = (k: string) => BIEU_CAM.some((x) => x.key === k);

/** Ghi kế hoạch biểu cảm (danh sách nhân vật) và / hoặc cờ nối liền của shot. Mã biểu cảm lạ → từ chối (máy không so được). */
export async function suaBieuCam(canhId: number, d: { bieu_cam?: BieuCamNv[]; noi_lien?: boolean }): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  if (d.bieu_cam?.some((b) => !b.nv?.trim() || !hopMa(b.dau) || !hopMa(b.cuoi) || (b.cam ?? []).some((k) => !hopMa(k)))) return loi('mã biểu cảm không hợp lệ');
  await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: [...(d.bieu_cam ? ['bieu_cam'] : []), ...(d.noi_lien != null ? ['noi_lien'] : [])], moTa: 'sửa biểu cảm / nối liền', nguoi: me.email ?? '' });
  if (d.bieu_cam) await db.execute(sql`UPDATE xv_canh SET bieu_cam = ${JSON.stringify(d.bieu_cam)}::jsonb, updated_at = now() WHERE id = ${canhId}`);
  if (d.noi_lien != null) await db.execute(sql`UPDATE xv_canh SET noi_lien = ${d.noi_lien}, updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: undefined };
}

/** Bật / tắt Murch QC cho cả phim (kinh_thanh.cam_xuc_qc). */
export async function batCamXucQc(phimId: number, bat: boolean): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_phim', id: phimId, cot: ['kinh_thanh'], moTa: bat ? 'bật Murch QC' : 'tắt Murch QC', nguoi: me.email ?? '' });
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{cam_xuc_qc}', ${JSON.stringify(bat)}::jsonb), updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, data: undefined };
}
