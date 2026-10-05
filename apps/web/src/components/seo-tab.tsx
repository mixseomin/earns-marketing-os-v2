// Tab SEO (thuần) của trang chủ — chỉ số NỘI BỘ của một site: chọn site → GSC/Bing 7/30/90 ngày + truy vấn + interactions;
// Keyword Research; SteamSolo ngôn ngữ/engagement. Bảng tổng mọi site là TÀI SẢN (tai-san-tab.tsx), không ở đây.
import { docSeoSites } from './seo-sites-panel';
import { SeoView } from './seo-view';
import { SteamsoloLangPanel } from './steamsolo-lang-panel';

export async function SeoTab() {
  const d = await docSeoSites();
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <SeoView loi={d.ok ? null : d.loi} timeseries={d.ok ? d.timeseries : {}}
        sites={d.ok ? d.rows.map((r) => ({ domain: r.domain, emoji: r.emoji, bing: r.bing_ts_30d ?? [], interactions: r.ga4_interactions_by ?? null })) : []} />
      <SteamsoloLangPanel />
    </div>
  );
}
