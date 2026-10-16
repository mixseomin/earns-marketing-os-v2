'use server';
// Server action của cửa ⚙ Tự động (may.ts): danh sách máy, một máy + video của nó. Chỉ đọc; nạp / xuất / ghi sổ đăng đi scripts/may-dung.mts.
import 'server-only';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { chiTietMay, dsMay, type May, type VideoMay } from '@/lib/xuong-video/may';

async function admin() { const me = await getCurrentUser(); return me && me.role === 'admin' ? me : null; }

export async function dsMayUi(): Promise<May[]> {
  const db = getDb(); if (!db || !(await admin())) return [];
  return dsMay(db);
}
export async function chiTietMayUi(id: number, o: { luuTru?: boolean; gioiHan?: number } = {}): Promise<{ may: May; video: VideoMay[] } | null> {
  const db = getDb(); if (!db || !(await admin())) return null;
  return chiTietMay(db, id, o);
}
