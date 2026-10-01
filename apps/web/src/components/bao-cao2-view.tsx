'use client';

// Report2 (MOS2) — vẽ bảng xoay do app/report2/page.tsx tính sẵn. Mọi bộ lọc là URL (đổi chip = router.push),
// nên bấm ⌘ mở tab mới, gửi link cho người khác là thấy đúng màn đó.
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { DataTable, EmptyState, FilterChips, Panel, type DataColumn } from '@/components/ui';

type Kieu = 'tien' | 'so' | 'pt' | 'x';
type Y = { duAn: string[]; tu: string; den: string; gop: string[]; chiSo: string[]; loc: Record<string, string> };
type Dong = Record<string, unknown>;

const n = (v: unknown) => (v == null ? null : Number(v));
function dinhDang(v: unknown, k: Kieu): string {
  const x = n(v);
  if (x == null || Number.isNaN(x)) return '—';
  if (k === 'tien') return (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: Math.abs(x) < 1 && x !== 0 ? 4 : 2 });
  if (k === 'pt') return (x * 100).toFixed(2) + '%';
  if (k === 'x') return x.toFixed(2) + '×';
  return x.toLocaleString('en-US');
}
const ngayTruoc = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
const KHOANG = [{ value: '0', label: 'Hôm nay' }, { value: '6', label: '7 ngày' }, { value: '13', label: '14 ngày' }, { value: '29', label: '30 ngày' }, { value: '89', label: '90 ngày' }];

export function BaoCao2View({ duAnCo, y, rows, dongTong, loi, chieu, chiSo }: {
  duAnCo: string[]; y: Y; rows: Dong[]; dongTong: Dong | null; loi: string | null;
  chieu: { key: string; nhan: string }[]; chiSo: { key: string; nhan: string; kieu: Kieu }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [dang, chay] = useTransition();
  const doi = (vals: Record<string, string>) => {
    const u = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(vals)) v ? u.set(k, v) : u.delete(k);
    chay(() => router.push('/report2?' + u.toString()));
  };
  const khoang = KHOANG.find((k) => y.tu === ngayTruoc(Number(k.value)) && y.den === ngayTruoc(0))?.value ?? '';
  const chieuChon = chieu.filter((c) => y.gop.includes(c.key)).sort((a, b) => y.gop.indexOf(a.key) - y.gop.indexOf(b.key));
  const csChon = chiSo.filter((c) => y.chiSo.includes(c.key));

  const columns: DataColumn<Dong>[] = [
    ...chieuChon.map((c, i): DataColumn<Dong> => ({
      key: c.key, header: c.nhan, align: 'left',
      cell: (r) => (
        <button type="button" title={`Lọc ${c.nhan} = ${r[c.key]}`} onClick={() => doi({ ['l_' + c.key]: String(r[c.key] ?? '') })}
          style={{ background: 'none', border: 0, padding: 0, color: 'var(--fg-1)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'left' }}>
          {String(r[c.key] ?? '—')}
        </button>
      ),
      sortValue: (r) => String(r[c.key] ?? ''),
      total: i === 0 ? () => <b>Tổng</b> : undefined,
    })),
    ...csChon.map((c): DataColumn<Dong> => ({
      key: c.key, header: c.nhan,
      cell: (r) => {
        const x = n(r[c.key]);
        const mau = c.key === 'lai' && x ? (x > 0 ? 'var(--ok, #1a7f37)' : 'var(--bad, #c62828)') : undefined;
        return <span style={{ fontVariantNumeric: 'tabular-nums', color: mau }}>{dinhDang(r[c.key], c.kieu)}</span>;
      },
      sortValue: (r) => n(r[c.key]),
      total: () => <b style={{ fontVariantNumeric: 'tabular-nums' }}>{dinhDang(dongTong?.[c.key], c.kieu)}</b>,
    })),
  ];
  const locDang = Object.entries(y.loc).filter(([, v]) => v);

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, opacity: dang ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Report2</h1>
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>chi · phiên · đơn · lãi — sổ PHỦ (không gồm adfond)</span>
      </div>
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '8px 12px', alignItems: 'center', fontSize: 12 }}>
          <span style={{ color: 'var(--fg-3)' }}>Dự án</span>
          <FilterChips values={y.duAn} onToggle={(v) => doi({ p: v.join(',') })} options={duAnCo.map((p) => ({ value: p, label: p }))} />
          <span style={{ color: 'var(--fg-3)' }}>Khoảng</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <FilterChips value={khoang} onChange={(v) => doi({ tu: ngayTruoc(Number(v)), den: ngayTruoc(0) })} options={KHOANG} />
            <input type="date" value={y.tu} max={y.den} onChange={(e) => doi({ tu: e.target.value })} aria-label="Từ ngày" />
            <span>→</span>
            <input type="date" value={y.den} min={y.tu} onChange={(e) => doi({ den: e.target.value })} aria-label="Đến ngày" />
          </div>
          <span style={{ color: 'var(--fg-3)' }}>Gộp theo</span>
          <FilterChips values={y.gop} onToggle={(v) => doi({ gop: v.slice(-3).join(',') || 'none' })} options={chieu.map((c) => ({ value: c.key, label: c.nhan }))} />
          <span style={{ color: 'var(--fg-3)' }}>Chỉ số</span>
          <FilterChips values={y.chiSo} onToggle={(v) => doi({ cs: v.join(',') })} options={chiSo.map((c) => ({ value: c.key, label: c.nhan }))} />
          {locDang.length > 0 && <>
            <span style={{ color: 'var(--fg-3)' }}>Đang lọc</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {locDang.map(([k, v]) => (
                <button key={k} type="button" onClick={() => doi({ ['l_' + k]: '' })}
                  style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', cursor: 'pointer' }}>
                  {chieu.find((c) => c.key === k)?.nhan}: {v} ✕
                </button>
              ))}
            </div>
          </>}
        </div>
      </Panel>
      {loi ? (
        <div role="alert" style={{ padding: 12, border: '1px solid var(--bad, #c62828)', borderRadius: 8, color: 'var(--bad, #c62828)', fontSize: 13 }}>
          Không chạy được báo cáo: {loi}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon="📊" title="Chưa có số trong khoảng này" description="Đổi khoảng ngày hoặc dự án. Số vào từ /api/phu/ingest (chi, đơn, GA4) theo nhịp adapter." />
      ) : (
        <DataTable rows={rows} columns={columns} getRowKey={(r) => chieuChon.map((c) => String(r[c.key])).join('|') || 'tong'} persistKey="report2" />
      )}
    </div>
  );
}
