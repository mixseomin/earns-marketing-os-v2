'use client';

// Lịch doanh thu theo NGÀY, gộp mọi nguồn (AdSense · Product/affiliate · Gumroad).
// Filter = primitive nhà (ListToolbar + FilterChips + SearchInput), lịch = MonthCalendar.
// State vào URL (?src=&ch=) để F5/share giữ nguyên bộ lọc — ui-conventions §1.

import { useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MonthCalendar, ListToolbar, FilterChips, StatsStrip, EmptyState, Pill } from './ui';
import type { CalItem } from './ui/month-calendar';
import type { StatCard } from './ui/stats-strip';
import type { RevenueDayRow, RevenueSource } from '@/lib/revenue/by-day';

const SRC_META: Record<RevenueSource, { label: string; color: string }> = {
  product: { label: 'Sản phẩm/Affiliate', color: 'var(--neon-lime)' },
  adsense: { label: 'AdSense', color: 'var(--neon-cyan)' },
  gumroad: { label: 'Gumroad', color: 'var(--neon-violet)' },
};

const usd = (n: number) => (n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`);

export function RevenueCalendar({ rows, errors }: { rows: RevenueDayRow[]; errors: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const src = (params.get('src') ?? 'all') as RevenueSource | 'all';
  const channel = params.get('ch') ?? '';

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (!v || v === 'all') next.delete(k); else next.set(k, v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const filtered = useMemo(() => {
    const needle = channel.trim().toLowerCase();
    return rows.filter((r) =>
      (src === 'all' || r.source === src) &&
      (!needle || r.channel.toLowerCase().includes(needle)));
  }, [rows, src, channel]);

  // Một pill mỗi (ngày × nguồn) — nhiều kênh cùng nguồn trong một ngày thì cộng lại,
  // ô lịch chỉ cao ~78px nên đừng nhồi từng kênh một.
  const items: CalItem[] = useMemo(() => {
    const agg = new Map<string, { date: string; source: RevenueSource; amount: number; channels: Set<string> }>();
    for (const r of filtered) {
      const k = `${r.date}|${r.source}`;
      const cur = agg.get(k) ?? { date: r.date, source: r.source, amount: 0, channels: new Set<string>() };
      cur.amount += r.amount; cur.channels.add(r.channel);
      agg.set(k, cur);
    }
    return [...agg.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([k, v]) => ({
        id: k, date: v.date, label: usd(v.amount), color: SRC_META[v.source].color,
        title: `${v.date} · ${SRC_META[v.source].label} · ${usd(v.amount)}\n${[...v.channels].join(', ')}`,
      }));
  }, [filtered]);

  const totals = useMemo(() => {
    const t: Record<RevenueSource | 'all', number> = { all: 0, adsense: 0, product: 0, gumroad: 0 };
    for (const r of filtered) { t.all += r.amount; t[r.source] += r.amount; }
    return t;
  }, [filtered]);

  const cards: StatCard[] = [
    { key: 'all', label: 'Tổng (đã lọc)', value: usd(totals.all), color: 'var(--ok)' },
    ...(Object.keys(SRC_META) as RevenueSource[]).map((s) => ({
      key: s, label: SRC_META[s].label, value: usd(totals[s]), color: SRC_META[s].color,
      active: src === s, onClick: () => setParam('src', src === s ? 'all' : s),
      title: `Chỉ xem ${SRC_META[s].label}`,
    })),
  ];

  return (
    <>
      <ListToolbar search={channel} onSearch={(v) => setParam('ch', v)} searchPlaceholder="Lọc theo kênh/site/sản phẩm…">
        <FilterChips
          value={src}
          onChange={(v) => setParam('src', v)}
          options={[
            { value: 'all' as const, label: 'Mọi nguồn' },
            ...(Object.keys(SRC_META) as RevenueSource[]).map((s) => ({ value: s, label: SRC_META[s].label })),
          ]}
        />
      </ListToolbar>

      {errors.length > 0 && (
        <div className="panel" style={{ padding: '6px 10px', marginBottom: 10, borderColor: 'var(--warn)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill label="nguồn lỗi" color="var(--warn)" size="xs" tone="soft" />
          <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{errors.join(' · ')}</span>
        </div>
      )}

      <StatsStrip cards={cards} />

      {items.length === 0 ? (
        <EmptyState icon="🗓" compact title="Không có doanh thu khớp bộ lọc"
          description="Đổi nguồn hoặc xoá ô tìm kênh." />
      ) : (
        <MonthCalendar items={items} />
      )}
    </>
  );
}
