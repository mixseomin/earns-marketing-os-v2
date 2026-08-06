'use client';

// Client wrapper so the offer table can use <DataTable> (a client component whose column
// `cell` functions can't cross the server→client boundary). The server panel passes plain
// serializable data (offers + meta); columns are built here. Validates ui.DataTable: the
// 7d / 30d metric sets are toggle GROUPS — hide 30d to focus on recent.
import { DataTable, type DataColumn, type DataGroup } from './ui/data-table';
import type { OfferRow, OfferMeta } from './affiliate-offers-panel';

const GROUPS: DataGroup[] = [
  { key: '7d', label: '7d', color: '#3c9bff' },
  { key: '30d', label: '30d', color: '#9d6cff' },
];

export function OfferTable({ offers, meta }: { offers: OfferRow[]; meta: Record<string, OfferMeta> }) {
  const columns: DataColumn<OfferRow>[] = [
    {
      key: 'offer', align: 'left', width: '100%', header: 'Offer',
      cell: (o) => {
        const m = meta[o.key] ?? { label: o.key, merchant: '' };
        const link = o.sample_url || m.url;
        return (
          <>
            {link
              ? <a href={link} target="_blank" rel="noopener" title={o.sample_url ? 'See how it looks on-site' : 'Offer page'} style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{m.label} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>↗</span></a>
              : <span style={{ fontWeight: 600 }}>{m.label}</span>}
            {m.merchant && <span style={{ display: 'block', color: 'var(--fg-3)', fontSize: 11 }}>{m.merchant}</span>}
            {(o.recent_clicks ?? []).map((c, i) => (
              <a key={i} href={c.url} target="_blank" rel="noopener" title={`Clicked ${c.ts}`} style={{ display: 'block', color: 'var(--ok)', fontSize: 11, marginTop: 2 }}>✓ clicked: {c.title} ↗</a>
            ))}
          </>
        );
      },
    },
    { key: 'views7', group: '7d', header: 'Views', cell: (o) => o.views7.toLocaleString() },
    { key: 'clicks7', group: '7d', header: 'Clicks', cell: (o) => o.clicks7.toLocaleString() },
    { key: 'ctr7', group: '7d', header: 'CTR', cell: (o) => <span style={{ color: o.ctr7 > 0 ? 'var(--ok)' : 'var(--fg-3)' }}>{o.ctr7}%</span> },
    { key: 'views30', group: '30d', header: 'Views', cell: (o) => o.views30.toLocaleString() },
    { key: 'clicks30', group: '30d', header: 'Clicks', cell: (o) => o.clicks30.toLocaleString() },
    { key: 'ctr30', group: '30d', header: 'CTR', cell: (o) => <span style={{ color: o.ctr30 > 0 ? 'var(--ok)' : 'var(--fg-3)' }}>{o.ctr30}%</span> },
  ];
  return <DataTable rows={offers} columns={columns} getRowKey={(o) => o.key} groups={GROUPS} minWidth={520} />;
}
