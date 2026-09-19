'use server';
// Server actions cho trang /y-tuong (admin). Logic thật ở lib/y-tuong.ts (dùng chung với API ext / CLI ~/bin/ideas).
import { getCurrentUser } from '@/lib/auth';
import { listYTuong, getYTuong, suaYTuong, suaBuoc, datBuoc } from '@/lib/y-tuong';
import type { YTuong, YTuongChiTiet, BuocPatch } from '@/lib/y-tuong-shared';

async function admin() {
  const me = await getCurrentUser();
  if (me?.role !== 'admin') throw new Error('admin only');
}

export async function ytList(nhom?: string): Promise<YTuong[]> { await admin(); return listYTuong(nhom); }
export async function ytGet(id: number): Promise<YTuongChiTiet | null> { await admin(); return getYTuong(id); }
export async function ytSuaTrangThai(id: number, trang_thai: string): Promise<YTuongChiTiet | null> { await admin(); return suaYTuong(id, { trang_thai }); }
export async function ytSuaTruong(id: number, patch: { ghi_chu?: string; mo_ta?: string; link?: string; uu_tien?: number }): Promise<YTuongChiTiet | null> { await admin(); return suaYTuong(id, patch); }
export async function ytSuaBuoc(buocId: number, p: BuocPatch): Promise<YTuongChiTiet | null> { await admin(); const r = await suaBuoc(buocId, p); return r?.y_tuong ?? null; }
export async function ytThemBuoc(id: number, buoc: string): Promise<YTuongChiTiet | null> { await admin(); await datBuoc(id, [buoc], 'append'); return getYTuong(id); }
