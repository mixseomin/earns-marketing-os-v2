'use client';
// KHỐI "SOCIAL TRỎ VỀ" dùng chung cho ba bảng tab Tài sản — Kênh nội dung · Website · Sản phẩm (anh 02/11/2026): số kênh social đang trỏ về đích +
// số đo trong khung thời gian chọn ở đầu tab (7 / 30 / 90 ngày, ?ky=). Số tính ở lib/tai-san/social-tro-ve*.ts. "–" = chưa có số (khác 0).
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FilterChips, type DataColumn } from '@/components/ui';
import { KY_SOCIAL, type TroVe } from '@/lib/tai-san/social-tro-ve-tinh';

const so = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('vi-VN'));
const NHAN_NEN: Record<string, string> = { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', twitter: 'X', pinterest: 'Pinterest', dailymotion: 'Dailymotion', quora: 'Quora', threads: 'Threads' };

export function OSocial({ t }: { t: TroVe | null | undefined }) {
  if (!t) return <span style={{ color: 'var(--fg-4)' }}>chưa có kênh</span>;
  return (
    <span title={`${t.kenh} kênh social trỏ về (${t.nen.map((n) => NHAN_NEN[n] ?? n).join(', ')}) · ${t.ky} ngày: ${t.bai} bài, ${so(t.xem)} lượt xem bài đó${t.khach == null ? '' : `, ${so(t.khach)} khách vào site từ bài`}`}
      style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <b>{t.kenh}</b><span style={{ color: 'var(--fg-3)' }}> kênh · {t.bai} bài · {so(t.xem)} xem{t.khach == null ? '' : ` · ${so(t.khach)} khách`}</span>
    </span>
  );
}

/** Cột "Social trỏ về" cho DataTable bất kỳ — get lấy TroVe của dòng. */
export function cotSocial<T>(get: (r: T) => TroVe | null | undefined, ky: number): DataColumn<T> {
  return { key: 'social', header: `Social trỏ về · ${ky} ngày`, align: 'left', width: 250, sortValue: (r) => get(r)?.kenh ?? null,
    title: `kênh social đang trỏ về · bài / lượt xem / khách trong ${ky} ngày (chọn khung ở đầu tab)`, cell: (r) => <OSocial t={get(r)} /> };
}

/** Chọn khung thời gian cho mọi khối social trỏ về của tab (URL ?ky= — server đọc lại). */
export function ChonKySocial({ ky }: { ky: number }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-3)' }}>
      <span>Social trỏ về · khung</span>
      <FilterChips value={String(ky)} options={KY_SOCIAL.map((k) => ({ value: String(k), label: `${k} ngày` }))}
        onChange={(v: string) => { const q = new URLSearchParams(sp?.toString()); q.set('ky', v); router.replace(`${path}?${q.toString()}`, { scroll: false }); }} />
    </div>
  );
}
