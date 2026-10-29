// city.on.tc (anh 22/10/2026 "cho toàn bộ cái này vào sub riêng: city.on.tc, nhớ dùng SSO"): thành phố hệ sinh thái trọn màn, không khung mos2.
// nginx city.on.tc gác bằng SSO mos2 (auth_request → /api/auth/verify) rồi chuyển / → /city; chỉ mở trang này + /api/social/thanh-pho + /_next.
// Dựng ngay từ bản lưu đĩa (lib/thanh-pho-ban-luu) rồi nạp số mới ở nền — không bắt anh chờ lượt tính ~8 giây.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { banLuu, moHinhNhanh } from '@/lib/thanh-pho-ban-luu';
import { SocialThanhPho } from '@/components/social-thanh-pho';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Thành phố', appleWebApp: { capable: true, title: 'City', statusBarStyle: 'black-translucent' }, robots: { index: false, follow: false } };

export default async function CityPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/city');
  if (me.role !== 'admin') redirect('/');
  const luu = banLuu(), ban = luu ?? (await moHinhNhanh());
  return <SocialThanhPho mh={ban.mh} luc={ban.luc} toanTrang lamMoiNgay={!!luu} />;
}
