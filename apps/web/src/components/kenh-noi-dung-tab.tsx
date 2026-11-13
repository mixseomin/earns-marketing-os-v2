// Tab KÊNH NỘI DUNG của trang chủ (anh 05/11/2026: "Cho Kênh Nội dung vào 1 tab riêng"): kênh video trọn chuyện là sản phẩm (xv_may.la_san_pham) —
// sổ kênh, mẫu, hàng chờ, lộ trình, playlist, ▶ Đang sản xuất (đồng hồ từng tập), lịch, đã làm. Trước nằm giữa tab Tài sản (tai-san-tab.tsx).
import { TaiSanKenhSp } from './tai-san-kenh-sp';
import { getRevenueByDay } from '@/lib/revenue/by-day';
import { KY_TIEN, tinhTienKenh } from '@/lib/tai-san/kenh-sp-tinh';
import { docKenhSp } from '@/lib/tai-san/kenh-sp';
import { docSocialTroVe } from '@/lib/tai-san/social-tro-ve';
import { KY_SOCIAL } from '@/lib/tai-san/social-tro-ve-tinh';
import { ChonKySocial } from './tai-san-social';

// Kênh social ĐÃ CHUYỂN (so-kenh.json loai 'social', lộ trình _chuyen_social — anh 14/11/2026 "cho sang đây") nằm CÙNG bảng, sau kênh sản phẩm;
// social trỏ về của nó tính theo SITE ĐÍCH của máy, của kênh sản phẩm theo link kênh.
export async function KenhNoiDungTab({ ky: kyThu }: { ky?: string } = {}) {
  const ky = (KY_SOCIAL as readonly number[]).includes(Number(kyThu)) ? Number(kyThu) : 7;
  const hom = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }), loi: string[] = [];
  const [kenh0, kenhSo, tro] = await Promise.all([
    docKenhSp(hom).catch((e: Error) => { loi.push(`kênh sản phẩm (xv_may.la_san_pham): ${e.message}`); return []; }),
    docKenhSp(hom, 'social').catch((e: Error) => { loi.push(`kênh social (so-kenh.json loai social): ${e.message}`); return []; }),
    docSocialTroVe(ky, hom).catch((e: Error) => { loi.push(`social trỏ về: ${e.message}`); return null; })]);
  // TIỀN: chỉ đọc sổ doanh thu khi có kênh khai nguồn tiền đọc được số (CJ · Awin · AdSense — gọi API, nhớ 5–10 phút theo REVENUE_TAG)
  const coDoc = [...kenh0, ...kenhSo].some((k) => k.so?.nguon_tien?.some((n) => n.mang));
  const dt = coDoc ? await getRevenueByDay(KY_TIEN).catch((e: Error) => { loi.push(`doanh thu: ${e.message}`); return null; }) : null;
  const tien = (k: (typeof kenh0)[number]) => (k.so?.nguon_tien?.length ? tinhTienKenh(k.so.nguon_tien, dt?.rows ?? []) : null);
  const kenh = [...kenh0.map((k) => ({ ...k, tien: tien(k), social: tro ? tro.duong(k.kenhUrl) : null })), ...kenhSo.map((k) => ({ ...k, tien: tien(k), social: tro && k.siteDich ? tro.site(k.siteDich) : null }))];
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {loi.length > 0 && <div style={{ color: 'var(--bad)', fontSize: 12 }}>{loi.join(' · ')}</div>}
      <ChonKySocial ky={ky} />
      <TaiSanKenhSp kenh={kenh} kySocial={ky} />
    </div>
  );
}
