'use client';

import { DataTable, type DataColumn } from './ui/data-table';

// Client wrapper for the Awareness Funnel "Top countries (7d)" table. The panel is an async
// server component and cannot pass `cell` functions to DataTable (a client component), so the
// columns are defined here and only serializable data (the row array) crosses the boundary.

export interface CountryRow {
  country: string;
  spend_usd: number;
  visits: number;
  cpc_usd: number;
}

// Pure formatters copied verbatim from awareness-funnel-panel.tsx (cells reference these).
function fmtUsd(n: number): string {
  if (n === 0) return '$0';
  if (n < 1) return `$${n.toFixed(3)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n === 0) return '0';
  return n.toLocaleString();
}

export function AwarenessFunnelTable({ rows }: { rows: CountryRow[] }) {
  const cols: DataColumn<CountryRow>[] = [
    { key: 'country', header: 'Country', align: 'left', cell: (c) => <span style={{ fontFamily: 'var(--font-sans)' }}>{c.country}</span>, sortValue: (c) => c.country },
    { key: 'visits', header: 'Visits', align: 'right', cell: (c) => fmtNum(c.visits), sortValue: (c) => c.visits },
    { key: 'spend', header: 'Spend', align: 'right', cell: (c) => fmtUsd(c.spend_usd), sortValue: (c) => c.spend_usd },
    { key: 'cpc', header: 'CPC', align: 'right', cell: (c) => `$${c.cpc_usd.toFixed(4)}`, sortValue: (c) => c.cpc_usd },
  ];

  return (
    <DataTable
      rows={rows}
      columns={cols}
      getRowKey={(c) => c.country}
      card
      defaultView="table"
      persistKey="awareness_funnel"
    />
  );
}
