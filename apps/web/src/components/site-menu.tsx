'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { wrapExternalUrl } from '@/lib/external-url';
import { siteSlugForDomain } from '@/lib/backlink-sites';

// Per-site "⋯" menu in the SEO Sites table. Replaces the inline Web/GSC/GA/Bing
// links with one grouped dropdown of every surface for that site + the internal
// MOS2 management pages. Rendered via portal so the table's overflow-x:auto
// doesn't clip it.

type Item = { label: string; emoji: string; href?: string; external?: boolean; onClick?: () => void };
type Group = { label: string; items: Item[] };

function buildGroups(domain: string, project: string | undefined, ga4: string | undefined, onOpenDetail: () => void): Group[] {
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
      { label: 'AdSense', emoji: '💰', href: 'https://www.google.com/adsense/new/u/0/home', external: true },
    ] },
    { label: 'Manage', items: [
      ...(project ? [{ label: 'Project', emoji: '📁', href: `/p/${project}` }] : []),
      { label: 'Backlinks', emoji: '🔗', href: `/architecture?obj=backlink${slug ? `&site=${slug}` : ''}` },
      { label: 'Keyword Research', emoji: '🔍', href: '/seo/keyword-research' },
      { label: 'GSC Detail', emoji: '📈', onClick: onOpenDetail },
    ] },
  ];
  return groups;
}

export function SiteMenu({ domain, project, ga4PropertyId, onOpenDetail }: {
  domain: string; project?: string; ga4PropertyId?: string; onOpenDetail: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 230) });
    setOpen(true);
  }

  const groups = buildGroups(domain, project, ga4PropertyId, () => { setOpen(false); onOpenDetail(); });

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    padding: '5px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)',
    textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4,
  };

  return (
    <>
      <button ref={btnRef} type="button" onClick={(e) => { e.stopPropagation(); toggle(); }}
        title={`Manage ${domain}`}
        style={{ marginLeft: 8, padding: '1px 6px', fontSize: 13, lineHeight: 1, color: open ? 'var(--fg-1)' : 'var(--fg-3)',
          background: open ? 'var(--bg-3)' : 'transparent', border: '1px solid var(--line)', borderRadius: 5, cursor: 'pointer' }}>
        ⋯
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000, width: 218,
            background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)', padding: 4, maxHeight: '70vh', overflowY: 'auto' }}>
          {groups.map((g) => (
            <div key={g.label}>
              <div style={{ padding: '6px 10px 2px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{g.label}</div>
              {g.items.map((it) => it.href ? (
                <a key={it.label} href={it.external ? wrapExternalUrl(it.href) : it.href}
                  {...(it.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  onClick={() => setOpen(false)}
                  style={itemStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                  <span>{it.emoji}</span><span>{it.label}</span>
                  {it.external && <span style={{ marginLeft: 'auto', color: 'var(--fg-3)', fontSize: 10 }}>↗</span>}
                </a>
              ) : (
                <button key={it.label} type="button" onClick={it.onClick} style={itemStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                  <span>{it.emoji}</span><span>{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
