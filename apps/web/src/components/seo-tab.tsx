// Tab SEO (thuần) của trang chủ — chỉ số NỘI BỘ của một site: chọn site → GSC/Bing 7/30/90 ngày + truy vấn + interactions;
// Keyword Research; SteamSolo ngôn ngữ/engagement. Bảng tổng mọi site là TÀI SẢN (tai-san-tab.tsx), không ở đây.
import { docSeoSites } from './seo-sites-panel';
import { SeoView } from './seo-view';
import { SteamsoloLangPanel } from './steamsolo-lang-panel';

/** khối chọn site → chi tiết GSC / Bing — tab SEO vẽ cùng SteamSolo, /home vẽ riêng thành widget E1 */
export async function SeoMotSite() {
  const d = await docSeoSites();
  return (
    <SeoView loi={d.ok ? null : d.loi} timeseries={d.ok ? d.timeseries : {}}
      sites={d.ok ? d.rows.map((r) => ({ domain: r.domain, emoji: r.emoji, bing: r.bing_ts_30d ?? [], interactions: r.ga4_interactions_by ?? null })) : []} />
  );
}

export async function SeoTab() {
  // minmax(0,1fr): ô grid mặc định min-width:auto → bảng rộng (cột Site width 100%) NỞ theo nội dung, đẩy mọi cột số ra ngoài
  // khung thay vì cuộn ngang (anh bắt 05/10/2026).
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <SeoMotSite />
      <SteamsoloLangPanel />
    </div>
  );
}
