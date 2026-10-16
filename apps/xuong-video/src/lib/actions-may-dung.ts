'use server';
// Server action của PHIM MÁY DỰNG (may-dung.ts) — khối 🎞 Máy Dựng trong tab Phim: sinh ảnh nền theo chủ đề (~65–110₫). Xuất đi nút ⬇ Xuất của tập. Chỉ admin.
import 'server-only';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { sinhNenMayDung } from '@/lib/xuong-video/may-dung';

async function admin() { const me = await getCurrentUser(); return me && me.role === 'admin' ? me : null; }

/** Bấm từ màn = anh duyệt đúng lượt này (giá hiện trên nút, bấm hai nhịp). */
export async function sinhNenMayDungUi(phimId: number): Promise<{ ok: boolean; loi?: string }> {
  const db = getDb(); if (!db) return { ok: false, loi: 'no db' };
  if (!(await admin())) return { ok: false, loi: 'chỉ admin' };
  const r = await sinhNenMayDung(db, phimId);
  return r.ok ? { ok: true } : { ok: false, loi: r.loi };
}
