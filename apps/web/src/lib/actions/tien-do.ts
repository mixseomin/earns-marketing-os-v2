'use server';
// Server actions cho view Tiến độ trong Plays (admin). Logic thật ở lib/tien-do.ts (dùng chung với API ext / CLI ~/bin/tiendo).
import { getCurrentUser } from '@/lib/auth';
import { listHangMuc, getHangMuc, suaHangMuc, suaBuoc, datBuoc, themHangMuc } from '@/lib/tien-do';
import type { HangMuc, HangMucChiTiet, BuocPatch } from '@/lib/tien-do-shared';

async function admin() {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') throw new Error('admin only');
}

export async function tdList(project_id?: string): Promise<HangMuc[]> { await admin(); return listHangMuc(project_id ? { project_id } : {}); }
export async function tdGet(id: number): Promise<HangMucChiTiet | null> { await admin(); return getHangMuc(id); }
export async function tdSuaTrangThai(id: number, trang_thai: string): Promise<HangMucChiTiet | null> { await admin(); return suaHangMuc(id, { trang_thai }); }
export async function tdSuaTruong(id: number, patch: { ghi_chu?: string; mo_ta?: string; link?: string; uu_tien?: number; ai?: string; cong?: string; so?: Record<string, string> }): Promise<HangMucChiTiet | null> { await admin(); return suaHangMuc(id, patch); }
export async function tdSuaBuoc(buocId: number, p: BuocPatch): Promise<HangMucChiTiet | null> { await admin(); const r = await suaBuoc(buocId, p); return r?.hang_muc ?? null; }
export async function tdThemBuoc(id: number, buoc: string): Promise<HangMucChiTiet | null> { await admin(); await datBuoc(id, [buoc], 'append'); return getHangMuc(id); }
export async function tdThem(project_id: string, nhom: string, ten: string): Promise<HangMucChiTiet> {
  await admin();
  return themHangMuc({ project_id, nhom, ten });
}
