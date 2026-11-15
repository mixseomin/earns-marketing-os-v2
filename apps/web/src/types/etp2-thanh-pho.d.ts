// Thành phố của etp2 dùng chung cho etp.on.tc (card #1605) — webpack alias trong apps/web/next.config.mjs trỏ về apps/etp2/src/components/etp-tong2-widget.tsx.
// Khai kiểu tay ở đây để tsc của web không đi vào mã etp2 (ở đó '@/…' là apps/etp2/src).
declare module '@etp2/thanh-pho' {
  export function ThanhPhoO(p: { cao: number }): import('react').JSX.Element;
}
