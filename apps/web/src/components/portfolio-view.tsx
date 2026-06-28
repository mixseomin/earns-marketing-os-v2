import Link from 'next/link';
import type { Project } from '@/lib/mock/types';
import { SeoSitesPanel } from './seo-sites-panel';
import { CitiesOfferStats } from './cities-offer-stats';
import { AwarenessFunnelPanel } from './awareness-funnel-panel';
import { AwinDailyPanel } from './awin-daily-panel';
import { PortfolioGrid } from './portfolio-grid';

export function PortfolioView({ projects: PROJECTS }: { projects: Project[] }) {
  const totalBudget = PROJECTS.reduce((s, p) => s + p.budget, 0);

  return (
    <div style={{ padding: 16 }} className="portfolio-view">
      <div className="portfolio-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            Portfolio
            <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 400, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>// {PROJECTS.length} projects</small>
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', margin: '4px 0 0' }}>Tổng quan hoạt động. Click project để drill-down.</p>
        </div>
        <Link href="/p/new" style={{ appearance: 'none', background: 'var(--accent)', color: 'var(--bg-0)', border: 0, borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>+ New Project</Link>
      </div>

      {/* SEO Sites Overview — GSC live data for monitored sites */}
      <SeoSitesPanel />

      {/* cities.gg affiliate-offer funnel (Awin CTAs on walk pages) */}
      <CitiesOfferStats />

      {/* Awareness Funnel — cities.gg paid (Bidvertiser) ÷ organic spillover */}
      <AwarenessFunnelPanel />

      {/* Awin Daily Route — reminder to run the apply-extension batch */}
      <AwinDailyPanel />

      <PortfolioGrid projects={PROJECTS} totalBudget={totalBudget} />
    </div>
  );
}
