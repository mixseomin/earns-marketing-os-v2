'use server';
// Admin chỉnh nhịp của một nhân sự ngay trên bảng nhân sự (anh 14/10/2026): ca · giờ điểm danh · kiểm mấy phút một lần. Lưu ở sổ dữ liệu
// (worker/nhip.mjs luuChinh), có hiệu lực ở nhịp kế tiếp — không sửa git, không cần deploy.
import { getCurrentUser } from './auth';
import { luuChinh, datBat, datGio, datKiemMoi } from '../../worker/nhip.mjs';
import { datLichMay, sach } from '../../worker/lich-may.mjs';

export async function chinhNhip(id: string, x: { ca: string; diem_danh: string; kiem_moi: number }): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được chỉnh nhịp.' };
  try { luuChinh(String(id), x, String(me.email ?? me.id)); return { ok: true }; } catch (e) { return { ok: false, loi: (e as Error).message }; }
}

/** Bật/tắt cột Tự làm (anh 14/10/2026). Chỉ admin. */
export async function batTatNhip(id: string, bat: boolean): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được bật/tắt.' };
  try { datBat(String(id), bat, String(me.email ?? me.id)); return { ok: true }; } catch (e) { return { ok: false, loi: (e as Error).message }; }
}

/** MỘT cửa đổi lịch cho mọi việc tự làm (ô chỉnh dùng chung components/chinh-lich.tsx). muc:
 *  `nhip:<người>` — nhịp cty kiểm mấy phút một lần · `gio:<người>` — giờ chạy hằng ngày việc Mac của người đó · `may:<máy>:<mã>` — một việc máy. Chỉ admin. */
export async function chinhLich(muc: string, lich: { kieu: string; phut?: number; gio?: string }): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được chỉnh lịch.' };
  const ai = String(me.email ?? me.id); const i = muc.indexOf(':'); const loai = muc.slice(0, i), ma = muc.slice(i + 1);
  try {
    if (loai === 'nhip') { if (lich.kieu !== 'moi') throw new Error('Nhịp cty chỉ đặt "mỗi N phút".'); datKiemMoi(ma, lich.phut, ai); }
    else if (loai === 'gio') { if (lich.kieu !== 'luc') throw new Error('Việc này chạy mỗi ngày một lần — chỉ đặt giờ.'); datGio(ma, lich.gio, ai); }
    else if (loai === 'may') datLichMay(ma, sach(lich), ai);
    else throw new Error(`Không biết việc "${muc}".`);
    return { ok: true };
  } catch (e) { return { ok: false, loi: (e as Error).message }; }
}
