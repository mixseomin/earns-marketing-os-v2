// Mã etp2 dùng chung cho web — webpack alias trong apps/web/next.config.mjs trỏ về apps/etp2/src/components/etp-tong2-widget.tsx.
// Khai kiểu tay ở đây để tsc của web không đi vào mã etp2 (ở đó '@/…' là apps/etp2/src).
declare module '@etp2/thanh-pho' {
  export function ThanhPhoO(p: { cao: number }): import('react').JSX.Element;
}
// widget số Tổng quan 2 của etp2 (nắm nhanh, người, tài khoản QC, bản đồ giờ…) — dùng ở /home nhóm Ethopex (components/home/etp2-o.tsx)
declare module '@etp2/tong2' {
  export function useVeSo(ky: { tu: string; den: string }): Record<string, (k: { rong: number; cao: number }) => import('react').ReactNode>;
}
