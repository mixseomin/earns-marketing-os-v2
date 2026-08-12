'use client';

// Client tables for SteamsoloLangPanel (an async SERVER component — it cannot pass `cell`
// functions to a client component). Each export takes ONLY serializable rows; the DataColumn[]
// (with cell markup + sortValue) lives here so headers become click-sortable and every table
// gains the card-view toggle for free. Cell markup ported verbatim from the old SimpleTables.
import { DataTable, type DataColumn } from './ui/data-table';

export interface TopGuideRow { views: number; likes: number; shares: number; slug: string; title: string; game: string }
export interface DemandRow { lang: string; hits: number; guides: number; last_at: string | null }
export interface TopDemandRow { lang: string; hits: number; slug: string; title: string; game: string }

export function SteamsoloTopGuidesTable({ rows }: { rows: TopGuideRow[] }) {
  const cols: DataColumn<TopGuideRow>[] = [
    { key: 'guide', header: 'Guide', align: 'left', sortValue: (x) => x.title, cell: (x) => <><a href={`https://steamsolo.com/guide/${x.slug}/`} target="_blank" rel="noopener" style={{ color: 'var(--fg-1)' }}>{x.title}</a><span style={{ color: 'var(--fg-3)' }}> · {x.game}</span></> },
    { key: 'views', header: 'Views', align: 'right', sortValue: (x) => x.views, cell: (x) => <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{x.views}</span> },
    { key: 'likes', header: 'Likes', align: 'right', sortValue: (x) => x.likes, cell: (x) => <span style={{ color: 'var(--fg-2)' }}>{x.likes}</span> },
    { key: 'shares', header: 'Shares', align: 'right', sortValue: (x) => x.shares, cell: (x) => <span style={{ color: 'var(--fg-2)' }}>{x.shares}</span> },
  ];
  return <DataTable rows={rows} columns={cols} getRowKey={(x, i) => x.slug + i} card defaultView="table" persistKey="steamsolo_top_guides" />;
}

export function SteamsoloDemandTable({ rows }: { rows: DemandRow[] }) {
  const cols: DataColumn<DemandRow>[] = [
    { key: 'lang', header: 'Lang', align: 'left', sortValue: (x) => x.lang, cell: (x) => x.lang },
    { key: 'hits', header: 'Requests', align: 'right', sortValue: (x) => x.hits, cell: (x) => <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{x.hits}</span> },
    { key: 'guides', header: 'Guides', align: 'right', sortValue: (x) => x.guides, cell: (x) => <span style={{ color: 'var(--fg-2)' }}>{x.guides}</span> },
  ];
  return <DataTable rows={rows} columns={cols} getRowKey={(x) => x.lang} card defaultView="table" persistKey="steamsolo_demand" />;
}

export function SteamsoloTopDemandTable({ rows }: { rows: TopDemandRow[] }) {
  const cols: DataColumn<TopDemandRow>[] = [
    { key: 'hits', header: '×', align: 'right', width: 40, sortValue: (x) => x.hits, cell: (x) => <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{x.hits}×</span> },
    { key: 'lang', header: 'Lang', align: 'left', width: 44, sortValue: (x) => x.lang, cell: (x) => x.lang },
    { key: 'title', header: 'Guide', align: 'left', sortValue: (x) => x.title, cell: (x) => <><a href={`https://steamsolo.com/guide/${x.slug}/`} target="_blank" rel="noopener" style={{ color: 'var(--fg-1)' }}>{x.title}</a><span style={{ color: 'var(--fg-3)' }}> · {x.game}</span></> },
  ];
  return <DataTable rows={rows} columns={cols} getRowKey={(x, i) => x.slug + i} card defaultView="table" persistKey="steamsolo_top_demand" />;
}
