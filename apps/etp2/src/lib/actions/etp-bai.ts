'use server';
// BÀI QC NHƯ NGƯỜI DÙNG THẤY (anh 20/11/2026): Page · chữ QC (primary) · hình · tên miền · tiêu đề · mô tả · nút CTA của một creative.
// Nguồn THẬT, không chữ mẫu: etp.bai_cr (asset_spec creative trên Ethopex) + etp.bai_camp (Page + tên miền của camp) — apps/etp/bai-qc.py đồng bộ (chỉ GET);
// Page lấy tên + ảnh đại diện ở etp.tai_nguyen loai='page'. Creative chưa lên camp → chữ máy đã nạp (bai_cr) hoặc thu_vien.chu_qc, gắn "chưa lên camp — chữ dự kiến".
// Tải khi mở thẻ (một creative) — không nhét vào gói dữ liệu đầu trang. Dựng bài + gom chữ cần dịch: lib/etp-dich.ts (một nguồn với máy dịch sẵn scripts/dich-truoc.mts).
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { dungBaiQc, docDich, dichKho, canDichChu, TRAN_SO_DICH, type BaiQcTho } from '@/lib/etp-dich';

export type { NoiDungCr, DiemTc } from '@/lib/etp-dich';
export type BaiQc = Omit<BaiQcTho, 'canDich'> & {
  /** BẢN DỊCH (anh #1778): khoá = mọi chữ ngoại ngữ trong thẻ (nguyên văn), giá trị = bản tiếng Việt đã nhớ ở etp.dich, null = chưa dịch.
   *  Creative đang / chuẩn bị / sẽ chạy đã được máy dịch sẵn (scripts/dich-truoc.mts, mỗi lượt etp-dong-bo) — null chỉ còn ở creative ngoài tập đó, trang gọi dichChu một lượt. */
  dich: Record<string, string | null>;
};

/** Dịch GỘP các chữ ngoại ngữ của MỘT thẻ (chỉ cho creative máy chưa dịch sẵn) — nhớ ở etp.dich theo nguyên văn. Trả bản dịch cho mọi câu xin (cả câu đã nhớ). */
export async function dichChu(dsGoc: string[]): Promise<{ vi: Record<string, string> } | { loi: string }> {
  if (!(await quyenEtp(await getCurrentUser()))) return { loi: 'không có quyền' };
  const ds = [...new Set((Array.isArray(dsGoc) ? dsGoc : []).map((x) => String(x ?? '')))].filter(canDichChu);
  if (ds.length > TRAN_SO_DICH) return { loi: `xin dịch ${ds.length} đoạn một lượt, trần ${TRAN_SO_DICH}` };
  if (!ds.length) return { vi: {} };
  const db = getDb(); if (!db) return { loi: 'không nối được kho' };
  try { return { vi: (await dichKho(db, ds)).vi }; } catch (e) { return { loi: `không dịch được: ${String((e as Error)?.message ?? e).slice(0, 200)}` }; }
}

export async function docBaiQc(cr: number, camp?: number | null): Promise<BaiQc | { loi: string }> {
  if (!(await quyenEtp(await getCurrentUser()))) return { loi: 'không có quyền' };
  if (!Number.isInteger(cr) || cr <= 0) return { loi: 'thiếu creative' };
  const db = getDb(); if (!db) return { loi: 'không nối được kho' };
  const { canDich, ...bai } = await dungBaiQc(db, cr, camp ?? null);
  const daNho = await docDich(db, canDich).catch(() => ({} as Record<string, string>));
  return { ...bai, dich: Object.fromEntries(canDich.map((d) => [d, daNho[d] ?? null])) };
}
