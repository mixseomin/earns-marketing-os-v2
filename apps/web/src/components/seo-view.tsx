'use client';
// Tab SEO › chọn một site (?site=, F5 giữ) → chi tiết GSC/Bing + truy vấn + interactions (gsc-detail-drawer, cùng drawer bảng Website mở).
import { FilterChips, LinkChip, Panel } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import type { GscDailyPoint } from '@/lib/projects/gsc-timeseries';
import { GscDetailDrawer } from './gsc-detail-drawer';
import { RefreshGscBtn } from './refresh-gsc-btn';

type Site = { domain: string; emoji: string; bing: { date: string; imp: number; clicks: number }[]; interactions: Record<string, number> | null };

export function SeoView({ sites, timeseries, loi }: { sites: Site[]; timeseries: Record<string, GscDailyPoint[]>; loi: string | null }) {
  const [site, datSite] = useShallowParam('site', '');
  const chon = sites.find((s) => s.domain === site) ?? null;
  return (
    <Panel title="🔍 Chỉ số nội bộ một site" subtitle={`${sites.length} site · GSC + Bing 7/30/90 ngày · truy vấn · interactions`}
      actions={<><LinkChip href="/seo/keyword-research" tone="neutral" size="xs">🔍 Keyword Research</LinkChip><RefreshGscBtn /></>}>
      {loi && <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '0 0 8px' }}>{loi}</p>}
      <FilterChips value={site} onChange={(v) => datSite(v)} urlKey="site" allValue=""
        options={sites.map((s) => ({ value: s.domain, label: `${s.emoji} ${s.domain}` }))} />
      {!chon && <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '10px 0 0' }}>Chọn một site để xem chi tiết. Bảng tổng mọi site nằm ở tab Tài sản.</p>}
      {chon && <GscDetailDrawer key={chon.domain} domain={chon.domain} points={timeseries[chon.domain] ?? []} bingPoints={chon.bing} interactions={chon.interactions} onClose={() => datSite('')} />}
    </Panel>
  );
}
