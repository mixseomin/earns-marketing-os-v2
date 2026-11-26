'use client';
// KỲ RIÊNG CỦA MỘT Ô WIDGET (anh 26/11/2026 "mỗi widget sẽ cho chọn time period riêng; có thể add cùng widget lên 1 page vì có tham số bên trong khác nhau"):
// nằm trên thanh tiêu đề ô (components/home/bang.tsx), giá trị lưu ở O.ky của bố cục (lib/home/luoi.ts). Hai kiểu theo sổ (lib/luoi-trang/bo-so.ts kieuKy):
//  'moc'  — widget etp2 tự tính trên trình duyệt: ô chọn khoảng chuẩn ChonKhoang (mốc sẵn, đếm lùi, hai đầu, All time); dữ liệu etp2 dùng chung, kỳ chỉ lọc trên trình duyệt.
//  'ngay' — widget máy chủ đọc ?days / ?ky: 7 / 30 / 90 ngày hoặc theo kỳ chung của trang; đổi kỳ (cả hai kiểu) thì trang đọc lại để máy chủ vẽ ruột ô theo kỳ mới (trang.tsx doi).
import { ChonKhoang, khoangCuaMoc } from '@/components/ui/chon-khoang';
import { KY_NGAY } from '@/lib/luoi-trang/bo-so';

/** All time của Ethopex: số etp2 bắt đầu 2026 — ngày trước '2000' thì useVeSo tự lấy ngày có số đầu tiên */
const TAT_CA = { ma: 'tat_ca', nhan: 'All time' };
export const MOC_MAC_DINH = '7';
/** ngày Ethopex hôm nay = ngày UTC (07:00–07:00 giờ VN) */
export const homNayEtp = () => new Date().toISOString().slice(0, 10);

/** mã kỳ của ô → khoảng ngày; mã hỏng thì về 7 ngày */
export function khoangKyO(v: string | undefined, nay = homNayEtp()): { tu: string; den: string } {
  const ma = v || MOC_MAC_DINH;
  if (ma === TAT_CA.ma) return { tu: '1970-01-01', den: nay };
  const hai = /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/.exec(ma);
  if (hai) return { tu: hai[1]!, den: hai[2]! };
  return khoangCuaMoc(ma, nay) ?? khoangCuaMoc(MOC_MAC_DINH, nay)!;
}

export function ChonKyO({ kieu, v, chung, onDoi }: {
  kieu: 'moc' | 'ngay'; v: string | undefined;
  /** kỳ chung của trang (widget 'ngay' chưa đặt kỳ riêng thì theo nó) */ chung: number;
  /** '' = bỏ kỳ riêng */ onDoi: (v: string) => void;
}) {
  if (kieu === 'moc') {
    const nay = homNayEtp(), k = khoangKyO(v, nay), hai = v && v.includes('~');
    return <ChonKhoang tu={k.tu} den={k.den} ma={hai ? null : v || MOC_MAC_DINH} homNay={nay} mocThem={[TAT_CA]} title="kỳ riêng của ô này (ngày Ethopex 07:00–07:00 giờ VN)"
      onDoi={(x) => onDoi('ma' in x ? x.ma : `${x.tu}~${x.den}`)} />;
  }
  const dang = v && (KY_NGAY as readonly string[]).includes(v) ? v : '';
  // cùng ô chọn kỳ ChonKhoang với widget 'moc' (góp ý #1889), chỉ mở các kỳ máy chủ nhận được
  const nay = new Date().toISOString().slice(0, 10), k = khoangCuaMoc(dang || String(chung), nay) ?? { tu: nay, den: nay };
  return <ChonKhoang chiMoc tu={k.tu} den={k.den} ma={dang || 'chung'} homNay={nay} title="kỳ riêng của ô này"
    mocThem={[{ ma: 'chung', nhan: `Kỳ chung (${chung} ngày)` }, ...KY_NGAY.map((n) => ({ ma: n, nhan: `${n} ngày qua` }))]}
    onDoi={(x) => { if ('ma' in x) onDoi(x.ma === 'chung' ? '' : x.ma); }} />;
}
