// Tab TÀI SẢN của trang chủ (anh chốt 05/10/2026): mọi thứ sinh tiền hoặc sắp sinh tiền, một màn —
// website (bảng SEO cũ), site Shopdy (cùng cột, nhóm riêng), shop → sản phẩm (cây; có cả hàng đang làm: sách KDP, Etsy…).
// Thuần SEO (chi tiết một site, keyword research, SteamSolo) đã sang tab SEO (seo-tab.tsx).
import { StatsStrip, type StatCard } from '@/components/ui';
import { SeoSitesPanel, docSeoSites } from './seo-sites-panel';
import { TaiSanView } from './tai-san-view';
import { docTaiSanBan } from '@/lib/tai-san/doc';
import type { TrangThaiSp } from '@/lib/tai-san/kieu';

export async function TaiSanTab() {
  const [sites, ban] = await Promise.all([docSeoSites(), docTaiSanBan()]);
  const web = sites.ok ? sites.rows : [];
  const nha = web.filter((r) => r.nhom !== 'shopdy');
  const sp = ban.shops.flatMap((s) => s.sp);
  const dem = (k: TrangThaiSp) => sp.filter((x) => x.trangThai === k).length;
  const cards: StatCard[] = [
    { key: 'web', label: 'Website', value: nha.length, sub: `${nha.reduce((t, r) => t + (r.ga4_users_7d ?? 0), 0).toLocaleString('en-US')} users 7d` },
    { key: 'shopdy', label: 'Site Shopdy', value: web.length - nha.length, sub: 'GA4-only' },
    { key: 'shop', label: 'Shop', value: ban.shops.length, sub: `${sp.length} sản phẩm` },
    { key: 'ban', label: 'Đang bán', value: dem('dang_ban'), color: 'var(--ok)' },
    { key: 'duyet', label: 'Chờ duyệt', value: dem('cho_duyet'), color: dem('cho_duyet') ? 'var(--warn)' : undefined },
    { key: 'san', label: 'Sẵn sàng', value: dem('san_sang'), sub: 'xong, chưa đăng' },
    { key: 'lam', label: 'Đang làm', value: dem('dang_lam'), sub: `${dem('du_kien')} dự kiến` },
  ];
  // minmax(0,1fr): ô grid mặc định min-width:auto → bảng rộng (cột Site width 100%) NỞ theo nội dung, đẩy mọi cột số ra ngoài
  // khung thay vì cuộn ngang (anh bắt 05/10/2026).
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <StatsStrip cards={cards} />
      <SeoSitesPanel d={sites} />
      <TaiSanView ban={ban} />
    </div>
  );
}
