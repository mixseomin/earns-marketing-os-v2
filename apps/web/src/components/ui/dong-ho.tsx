// ĐỒNG HỒ TIẾN ĐỘ dùng chung (anh 04/11/2026: etp "thiết kế giống cái đồng hồ công tơ mét với các node là tiến độ … ở giữa vẫn là số"; rồi "phần này của nội dung
// có làm đc ko?" → Kênh nội dung dùng cho tập đang sản xuất). Vòng cung 240° mở phía dưới, mỗi nút một bước, màu theo trạng thái, nút đang chạy chớp, số ở giữa.
// Chỉ vẽ — link / bấm / thẻ nổi do chỗ dùng bọc ngoài. Chớp bằng <animate> trong SVG: không phụ thuộc keyframes của trang nào.
export type TrangThaiNut = 'cho' | 'dang' | 'chay' | 'xong' | 'dung' | 'loi' | 'bo_qua' | 'huy';
export const MAU_NUT: Record<TrangThaiNut, string> = { cho: '#6b7280', dang: '#60a5fa', chay: '#60a5fa', xong: '#22c55e', dung: '#f59e0b', loi: '#ef4444', bo_qua: '#374151', huy: '#6b7280' };
const MAU_SO: Partial<Record<TrangThaiNut, string>> = { xong: '#22c55e', dung: '#f59e0b', loi: '#ef4444' };

export function DongHo({ nut, so, ket, co = 26, mau = (t) => MAU_NUT[t as TrangThaiNut] ?? MAU_NUT.cho }: {
  /** các bước theo thứ tự; tt = trạng thái bước */ nut: { ma: string; tt: string }[];
  /** số ở giữa */ so: number | string;
  /** dòng đã kết thúc ở trạng thái nào (tô màu số) */ ket?: string;
  co?: number; mau?: (tt: string) => string;
}) {
  const C = 13, R = 10, goc0 = 150, quet = 240, n = Math.max(nut.length, 2);
  const xy = (g: number) => [C + R * Math.cos((g * Math.PI) / 180), C + R * Math.sin((g * Math.PI) / 180)];
  return <svg width={co} height={co} viewBox="0 0 26 26" data-comp="ui.DongHo" style={{ display: 'block' }}>
    {nut.map((b, i) => { const [x, y] = xy(goc0 + (quet * i) / (n - 1)), dang = b.tt === 'dang';   // chỉ bước đang chạy chớp (như etp)
      return <circle key={b.ma} cx={x} cy={y} r={dang ? 2.4 : 1.9} fill={mau(b.tt)}>{dang && <animate attributeName="opacity" values="1;.35;1" dur="1.6s" repeatCount="indefinite" />}</circle>; })}
    <text x={C} y={C + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={(ket && MAU_SO[ket as TrangThaiNut]) || '#fff'}>{so}</text>
  </svg>;
}

/** Nút của một dây chuyền chạy tuần tự từ "đang ở bước so / tong": trước đó xong, bước so đang (hoặc lỗi), sau đó chờ. Thuần. */
export function nutTuanTu(tong: number, so: number, loi?: boolean): { ma: string; tt: TrangThaiNut }[] {
  return Array.from({ length: tong }, (_, i) => ({ ma: String(i + 1), tt: i + 1 < so ? 'xong' : i + 1 === so ? (loi ? 'loi' : 'dang') : 'cho' }));
}
