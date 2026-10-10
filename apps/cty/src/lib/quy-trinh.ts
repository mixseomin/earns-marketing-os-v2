'use server';
// Quy trình + cải tiến của các phòng cho giao diện: đọc từ worker (một nguồn), và các nút của Giám đốc.
// Họp / So phiên bản GỌI MÔ HÌNH → mỗi lần bấm = một lần chạy (đúng luật tiêu tiền), chạy nền (spawn), trang tự làm mới.
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './auth';
import { dsQuyTrinh, quyDinhCuaPhong, coPhienBan, hienHanh, dsBan, nhatKyQuyTrinh, dsDeXuat, boViecChuan, dsLuotTho, chiSo, veBan } from '../../worker/quy-trinh.mjs';
import { dsSoSanh, diemMoiNhat, duyetDeXuat, dangChayCaiTien, ketQuaGanNhat } from '../../worker/cai-tien.mjs';

type Kq = { ok: boolean; loi?: string };
const chiAdmin = async (): Promise<string | null> => { const me = await getCurrentUser(); return !me ? 'Phiên đăng nhập đã hết — tải lại trang.' : me.role !== 'admin' ? 'Chỉ Giám đốc (admin) được làm việc này.' : null; };

/** Chi tiết MỘT quy trình (khoá 'phòng/quy-trình'). */
export async function tongQuanQuyTrinh(phong: string) {
  const ds = dsBan(phong); const hh = hienHanh(phong);
  const luot = (dsLuotTho() as { bo_viec?: string; quy_trinh?: number }[]).filter((l) => !l.bo_viec);
  return {
    hienHanh: hh, cacBan: ds.map((b: { ban: number }) => ({ ...b, chiSo: chiSo(luot.filter((l) => (l.quy_trinh ?? 1) === b.ban)), diem: diemMoiNhat(phong, b.ban) })),
    deXuat: dsDeXuat(phong), nhatKy: nhatKyQuyTrinh(phong).reverse(), boViec: boViecChuan(phong), soSanh: dsSoSanh(phong).slice(0, 10),
    dangChay: dangChayCaiTien(phong), ketQua: ketQuaGanNhat(phong),
  };
}
export type DongQuyTrinh = { phong: string; id: string; khoa: string; nguon: 'phong' | 'chung'; ten: string; mo_ta: string; so_hoa: string; kich_hoat: string; ma?: string;
  ban?: number; soBan?: number; deXuat?: { ts: string; trang_thai: string; thay_doi: { khoa: string }[] }[]; diem?: { so_dung: number; tong: number } | null };
/** Mọi quy trình nghiệp vụ của mọi phòng (một dòng mỗi quy trình); quy trình có phiên bản thì kèm bản đang chạy, đề xuất, điểm. */
export async function dsQuyTrinhCacPhong(): Promise<DongQuyTrinh[]> {
  return (dsQuyTrinh() as DongQuyTrinh[]).map((q) => coPhienBan(q.khoa)
    ? { ...q, ban: hienHanh(q.khoa).ban, soBan: dsBan(q.khoa).length, deXuat: dsDeXuat(q.khoa), diem: diemMoiNhat(q.khoa, hienHanh(q.khoa).ban) }
    : q);
}

function chayNen(phong: string, co: string): Kq {
  if (dangChayCaiTien(phong)) return { ok: false, loi: 'Phòng đang họp / đang so phiên bản — đợi xong.' };
  const w = path.join(process.cwd(), 'worker', 'cai-tien.mjs');
  if (!fs.existsSync(w)) return { ok: false, loi: `Không thấy ${w}.` };
  const log = fs.openSync(path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'cai-tien.log'), 'a');
  spawn(process.execPath, [w, co, '--qt', phong], { detached: true, stdio: ['ignore', log, log], env: process.env }).unref();
  return { ok: true };
}
export async function hopRutKinhNghiem(phong: string): Promise<Kq> {
  const l = await chiAdmin(); if (l) return { ok: false, loi: l };
  if ((dsDeXuat(phong) as { trang_thai: string }[]).some((d) => d.trang_thai === 'dang_thu')) return { ok: false, loi: 'Đang có bản thử chưa so trên bộ việc chuẩn — bấm "So trên bộ việc chuẩn" trước (mỗi lần một thay đổi).' };
  const r = chayNen(phong, '--hop'); await new Promise((x) => setTimeout(x, 400)); revalidatePath('/', 'layout'); return r;
}
export async function soTrenBoViecChuan(phong: string): Promise<Kq> {
  const l = await chiAdmin(); if (l) return { ok: false, loi: l };
  const r = chayNen(phong, '--so'); await new Promise((x) => setTimeout(x, 400)); revalidatePath('/', 'layout'); return r;
}
export async function kyDeXuat(phong: string, id: string, dongY: boolean): Promise<Kq> {
  const l = await chiAdmin(); if (l) return { ok: false, loi: l };
  try { duyetDeXuat(phong, id, dongY, 'giam-doc'); } catch (e) { return { ok: false, loi: (e as Error).message }; }
  revalidatePath('/', 'layout'); return { ok: true };
}
export async function veBanDau(phong: string): Promise<Kq> {
  const l = await chiAdmin(); if (l) return { ok: false, loi: l };
  if (dangChayCaiTien(phong)) return { ok: false, loi: 'Phòng đang họp / đang so phiên bản — đợi xong rồi mới về v1.' };
  try { veBan(phong, 1, 'Giám đốc bấm "Về bản đầu" để thử', 'giam-doc'); } catch (e) { return { ok: false, loi: (e as Error).message }; }
  revalidatePath('/', 'layout'); return { ok: true };
}

export type QuyDinh = { tang: 'cong-ty' | 'du-an' | 'phong'; id: string; ten: string; nguon?: string; tep: string | null; noi_dung: string };
/** Quy định phòng phải tuân theo, theo tầng công ty → dự án → phòng. */
export async function quyDinhPhong(phong: string): Promise<QuyDinh[]> { return quyDinhCuaPhong(phong) as QuyDinh[]; }
