'use client';

import { MenuBaCham, type NhomMenu } from './ui/menu-ba-cham';
import { siteSlugForDomain } from '@/lib/backlink-sites';
import { clarityUrl } from '@/lib/projects/clarity-ids';

// Per-site "⋯" menu in the SEO Sites table (vẽ bằng ui/menu-ba-cham — dùng chung với Kênh nội dung). Replaces the inline Web/GSC/GA/Bing
// links with one grouped dropdown of every surface for that site + the internal
// MOS2 management pages. Rendered via portal so the table's overflow-x:auto
// doesn't clip it.

type Group = NhomMenu;

function buildGroups(domain: string, project: string | undefined, ga4: string | undefined, clarity: string | undefined, onOpenDetail?: () => void): Group[] {
  const enc = encodeURIComponent('https://' + domain + '/');
  const slug = siteSlugForDomain(domain);
  const groups: Group[] = [
    { label: 'Live', items: [
      { label: 'Homepage',      emoji: '🌐', href: `https://${domain}/`, external: true },
      { label: 'Sitemap.xml',   emoji: '🗺️', href: `https://${domain}/sitemap.xml`, external: true },
      { label: 'robots.txt',    emoji: '🤖', href: `https://${domain}/robots.txt`, external: true },
      { label: 'Google index',  emoji: '🔎', href: `https://www.google.com/search?q=${encodeURIComponent('site:' + domain)}`, external: true },
    ] },
    { label: 'Search Console', items: [
      { label: 'Google Search Console', emoji: '🔵', href: `https://search.google.com/search-console?resource_id=${encodeURIComponent('sc-domain:' + domain)}`, external: true },
      { label: 'Bing Webmaster',        emoji: '🟣', href: `https://www.bing.com/webmasters/?siteUrl=${enc}`, external: true },
    ] },
    { label: 'Analytics & Revenue', items: [
      ...(ga4 ? [
        { label: 'GA4 Reports',  emoji: '📊', href: `https://analytics.google.com/analytics/web/#/p${ga4}/reports/intelligenthome`, external: true },
        { label: 'GA4 Realtime', emoji: '⚡', href: `https://analytics.google.com/analytics/web/#/p${ga4}/realtime/overview`, external: true },
      ] : []),
      ...(clarity ? [{ label: 'Clarity (recordings · heatmaps)', emoji: '🎥', href: clarityUrl(clarity), external: true }] : []),
      { label: 'AdSense', emoji: '💰', href: 'https://www.google.com/adsense/new/u/0/home', external: true },
    ] },
    { label: 'Manage', items: [
      ...(project ? [
        { label: 'Project', emoji: '📁', href: `/p/${project}` },
        { label: 'Outreach', emoji: '📣', href: `/p/${project}/outreach` },
      ] : []),
      { label: 'Backlinks', emoji: '🔗', href: project ? `/p/${project}/backlinks` : `/architecture?obj=backlink${slug ? `&site=${slug}` : ''}` },
      { label: 'Keyword Research', emoji: '🔍', href: '/seo/keyword-research' },
      ...(onOpenDetail ? [{ label: 'GSC Detail', emoji: '📈', onClick: onOpenDetail }] : []),
    ] },
  ];
  return groups;
}

export function SiteMenu({ domain, project, ga4PropertyId, clarityId, onOpenDetail }: {
  domain: string; project?: string; ga4PropertyId?: string; clarityId?: string; onOpenDetail?: () => void;
}) {
  return <MenuBaCham tieuDe="Site Menu" phu={domain} title={`Manage ${domain}`} groups={buildGroups(domain, project, ga4PropertyId, clarityId, onOpenDetail)} />;
}
