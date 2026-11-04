// Tab KÊNH NỘI DUNG của trang chủ (anh 05/11/2026: "Cho Kênh Nội dung vào 1 tab riêng"): kênh video trọn chuyện là sản phẩm (xv_may.la_san_pham) —
// sổ kênh, mẫu, hàng chờ, lộ trình, playlist, ▶ Đang sản xuất (đồng hồ từng tập), lịch, đã làm. Trước nằm giữa tab Tài sản (tai-san-tab.tsx).
import { TaiSanKenhSp } from './tai-san-kenh-sp';
import { docKenhSp } from '@/lib/tai-san/kenh-sp';
import { docSocialTroVe } from '@/lib/tai-san/social-tro-ve';
import { KY_SOCIAL } from '@/lib/tai-san/social-tro-ve-tinh';
import { ChonKySocial } from './tai-san-social';

export async function KenhNoiDungTab({ ky: kyThu }: { ky?: string } = {}) {
  const ky = (KY_SOCIAL as readonly number[]).includes(Number(kyThu)) ? Number(kyThu) : 7;
  const hom = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }), loi: string[] = [];
  const [kenh0, tro] = await Promise.all([
    docKenhSp(hom).catch((e: Error) => { loi.push(`kênh sản phẩm (xv_may.la_san_pham): ${e.message}`); return []; }),
    docSocialTroVe(ky, hom).catch((e: Error) => { loi.push(`social trỏ về: ${e.message}`); return null; })]);
  const kenh = kenh0.map((k) => ({ ...k, social: tro ? tro.duong(k.kenhUrl) : null }));
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {loi.length > 0 && <div style={{ color: 'var(--bad)', fontSize: 12 }}>{loi.join(' · ')}</div>}
      <ChonKySocial ky={ky} />
      <TaiSanKenhSp kenh={kenh} kySocial={ky} />
    </div>
  );
}
