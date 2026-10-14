'use server';
// Admin chỉnh nhịp của một nhân sự ngay trên bảng nhân sự (anh 14/10/2026): ca · giờ điểm danh · kiểm mấy phút một lần. Lưu ở sổ dữ liệu
// (worker/nhip.mjs luuChinh), có hiệu lực ở nhịp kế tiếp — không sửa git, không cần deploy.
import { getCurrentUser } from './auth';
import { luuChinh, datBat, datGio, datKiemMoi } from '../../worker/nhip.mjs';
import { datLichMay, sach } from '../../worker/lich-may.mjs';
import { docViecMay } from '../../worker/viec-may.mjs';

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
type Lich = { kieu: 'moi'; phut: number } | { kieu: 'luc'; gio: string[]; thu: number[] };
export async function chinhLich(muc: string, lich: Lich): Promise<{ ok: boolean; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'Phiên đăng nhập đã hết — tải lại trang.' };
  if (me.role !== 'admin') return { ok: false, loi: 'Chỉ admin được chỉnh lịch.' };
  const ai = String(me.email ?? me.id); const i = muc.indexOf(':'); const loai = muc.slice(0, i), ma = muc.slice(i + 1);
  try {
    const l = sach(lich) as Lich;
    if (loai === 'nhip') { if (l.kieu !== 'moi') throw new Error('Nhịp cty chỉ đặt "mỗi N phút/giờ".'); datKiemMoi(ma, l.phut, ai); }
    else if (loai === 'gio') { if (l.kieu !== 'luc' || l.gio.length !== 1 || l.thu.length) throw new Error('Việc này chạy mỗi ngày đúng một lần — chỉ đặt một giờ, không chọn thứ.'); datGio(ma, l.gio[0], ai); }
    else if (loai === 'may') {
      const v = ((docViecMay() as { ds: { id: string; loai: string }[] } | null)?.ds ?? []).find((x) => x.id === ma);
      if (!v) throw new Error('Không thấy việc này trong lần dò máy gần nhất — đợi lượt dò (10 phút) rồi thử lại.');
      datLichMay(ma, l, ai, v.loai);
    } else throw new Error(`Không biết việc "${muc}".`);
    return { ok: true };
  } catch (e) { return { ok: false, loi: (e as Error).message }; }
}
