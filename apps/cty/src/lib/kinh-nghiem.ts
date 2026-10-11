'use server';
// Bỏ một bài học của nhân sự (Giám đốc thấy bài học bịa hoặc lệch chuẩn). Chỉ admin. Ghi sổ sự kiện để biết ai bỏ bài nào.
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './auth';
import { boBaiHoc } from '../../worker/kinh-nghiem.mjs';
import { ghiLog } from '../../worker/log.mjs';

export async function boBaiHocCua(nguoi: string, ma: string): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ Giám đốc (admin) được bỏ bài học.' };
  if (!boBaiHoc(nguoi, ma)) return { ok: false, loi: `Không thấy bài học ${ma} của ${nguoi} — có thể đã bị bỏ.` };
  ghiLog({ luot: `bo-bai-hoc-${Date.now()}`, loai: 'quyet', tu: 'giam-doc', toi: nguoi, chi_tiet: { bo_bai_hoc: ma } });
  revalidatePath('/', 'layout');
  return { ok: true };
}
