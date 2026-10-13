'use server';
// Gửi lệnh "Chạy lại ngay" cho máy Mac (worker/lenh-may.mjs). Chỉ admin mos2 bấm được: lệnh làm máy đăng video công khai lên tài khoản thật.
import { getCurrentUser } from './auth';
import { taoLenh } from '../../worker/lenh-may.mjs';

export async function guiLenh(lenh: string): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang để đăng nhập.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được gửi lệnh cho máy.' };
  try { const r = taoLenh(String(lenh), String(me.email ?? me.id)) as { id?: string; loi?: string }; return r.loi ? { ok: false, loi: r.loi } : { ok: true }; }
  catch (e) { return { ok: false, loi: `Không ghi được lệnh trên máy chủ: ${(e as Error).message}` }; }
}
