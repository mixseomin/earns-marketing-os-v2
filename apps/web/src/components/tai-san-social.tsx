'use client';
// KHỐI "SOCIAL TRỎ VỀ" dùng chung cho ba bảng tab Tài sản — Kênh nội dung · Website · Sản phẩm (anh 02/11/2026): số kênh social đang trỏ về đích +
// số đo trong khung thời gian chọn ở đầu tab (7 / 30 / 90 ngày, ?ky=). Số tính ở lib/tai-san/social-tro-ve*.ts. "–" = chưa có số (khác 0).
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FilterChips, type DataColumn } from '@/components/ui';
import type { DataGroup } from '@/components/ui/data-table';
import { KY_SOCIAL, type TroVe } from '@/lib/tai-san/social-tro-ve-tinh';

const so = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('vi-VN'));
const NHAN_NEN: Record<string, string> = { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', twitter: 'X', pinterest: 'Pinterest', dailymotion: 'Dailymotion', quora: 'Quora', threads: 'Threads' };

/** KHỐI CỘT "Social" (anh 02/11/2026: chia khối + màu như GSC / Bing) — dải tiêu đề màu riêng, bật / tắt ở menu Columns như mọi khối. */
export const nhomSocial = (ky: number): DataGroup => ({ key: 'social', label: `Social trỏ về · ${ky} ngày`, color: '#e1306c' });

/** 4 cột số của khối Social cho DataTable bất kỳ — get lấy TroVe của dòng. "–" = chưa có số (khác 0). */
export function cotSocial<T>(get: (r: T) => TroVe | null | undefined, ky: number): DataColumn<T>[] {
  const nenCua = (t: TroVe | null | undefined) => (t ? t.nen.map((n) => NHAN_NEN[n] ?? n).join(', ') : 'chưa có kênh social nào trỏ về');
  const o = (n: number | null | undefined, dam = false) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: dam ? 700 : 400, color: n ? undefined : 'var(--fg-4)' }}>{so(n)}</span>;
  return [
    { key: 'so_tk', group: 'social', header: 'Tài khoản', width: 76, sortValue: (r) => get(r)?.taiKhoan ?? null, title: 'số tài khoản social có bài trỏ về (mọi thời điểm)',
      cellTitle: (r) => nenCua(get(r)), cell: (r) => o(get(r)?.taiKhoan ?? null, true) },
    { key: 'so_bai', group: 'social', header: 'Bài', width: 60, sortValue: (r) => get(r)?.bai ?? null, title: `bài đăng trong ${ky} ngày`, cell: (r) => o(get(r) ? get(r)!.bai : null) },
    { key: 'so_xem', group: 'social', header: 'Xem tới nay', width: 88, sortValue: (r) => get(r)?.xem ?? null, title: `lượt xem CỘNG DỒN tới nay của các bài đăng trong ${ky} ngày (không phải lượt xem phát sinh trong ${ky} ngày)`, cell: (r) => o(get(r)?.xem ?? null) },
    { key: 'so_khach', group: 'social', header: 'Khách', width: 64, sortValue: (r) => get(r)?.khach ?? null, title: `khách vào site từ bài social trong ${ky} ngày (sổ phiên adfond; sản phẩm trên chợ không đo được)`,
      cell: (r) => o(get(r)?.khach ?? null, true) },
  ];
}

/** Chọn khung thời gian cho mọi khối social trỏ về của tab (URL ?ky= — server đọc lại). */
export function ChonKySocial({ ky }: { ky: number }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-3)' }}>
      <span>Social trỏ về · khung</span>
      <FilterChips urlKey="ky" value={String(ky)} options={KY_SOCIAL.map((k) => ({ value: String(k), label: `${k} ngày` }))}
        onChange={(v: string) => { const q = new URLSearchParams(sp?.toString()); q.set('ky', v); router.replace(`${path}?${q.toString()}`, { scroll: false }); }} />
    </div>
  );
}
