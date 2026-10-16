'use server';
// Server action của KHUÔN VIDEO (khuon.ts) — ngăn 🧩 Khuôn video: danh sách, xuất (0đ), sinh ảnh nền theo chủ đề (~110₫). Chỉ admin.
import 'server-only';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { dsKhuon, sinhNenKhuon, xuatKhuon, type DongKhuon } from '@/lib/xuong-video/khuon';

async function admin() { const me = await getCurrentUser(); return me && me.role === 'admin' ? me : null; }

export async function layKhuon(): Promise<{ ok: true; data: DongKhuon[] } | { ok: false; loi: string }> {
  const db = getDb(); if (!db) return { ok: false, loi: 'no db' };
  if (!(await admin())) return { ok: false, loi: 'chỉ admin' };
  return { ok: true, data: await dsKhuon(db) };
}

export async function xuatKhuonUi(id: number): Promise<{ ok: boolean; loi?: string }> {
  const db = getDb(); if (!db) return { ok: false, loi: 'no db' };
  if (!(await admin())) return { ok: false, loi: 'chỉ admin' };
  const r = await xuatKhuon(db, id);
  return r.ok ? { ok: true } : { ok: false, loi: r.loi };
}

/** Bấm từ màn = anh duyệt đúng lượt này (giá hiện trên nút, bấm hai nhịp). */
export async function sinhNenKhuonUi(duAn: string, chuDe: string): Promise<{ ok: boolean; loi?: string }> {
  const db = getDb(); if (!db) return { ok: false, loi: 'no db' };
  if (!(await admin())) return { ok: false, loi: 'chỉ admin' };
  const r = await sinhNenKhuon(db, duAn, chuDe);
  return r.ok ? { ok: true } : { ok: false, loi: r.loi };
}
