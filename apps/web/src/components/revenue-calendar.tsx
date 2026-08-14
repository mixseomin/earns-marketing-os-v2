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

export function RevenueCalendar({ rows, errors, compact = false }: { rows: RevenueDayRow[]; errors: string[]; compact?: boolean }) {
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
    const agg = new Map<string, { date: string; source: RevenueSource; amount: number; gross: number; channels: Set<string> }>();
    for (const r of filtered) {
      const k = `${r.date}|${r.source}`;
      const cur = agg.get(k) ?? { date: r.date, source: r.source, amount: 0, gross: 0, channels: new Set<string>() };
      cur.amount += r.amount; cur.gross += r.gross ?? r.amount; cur.channels.add(r.channel);
      agg.set(k, cur);
    }
    return [...agg.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([k, v]) => ({
        id: k, date: v.date, label: usd(v.amount), color: SRC_META[v.source].color,
        // Con số trên ô = THỰC NHẬN. Doanh số gốc chỉ vào tooltip, để không ai
        // nhìn nhầm $421 khách tiêu thành $421 tiền mình.
        title: `${v.date} · ${SRC_META[v.source].label} · thực nhận ${usd(v.amount)}`
          + (v.gross > v.amount ? `\ndoanh số gốc ${usd(v.gross)} → ${Math.round((v.amount / v.gross) * 100)}%` : '')
          + `\n${[...v.channels].join(', ')}`,
      }));
  }, [filtered]);

  const totals = useMemo(() => {
    const z = () => ({ net: 0, gross: 0 });
    const t: Record<RevenueSource | 'all', { net: number; gross: number }> =
      { all: z(), adsense: z(), product: z(), gumroad: z() };
    for (const r of filtered) {
      const g = r.gross ?? r.amount;
      t.all.net += r.amount; t.all.gross += g;
      t[r.source].net += r.amount; t[r.source].gross += g;
    }
    return t;
  }, [filtered]);

  const cards: StatCard[] = [
    { key: 'all', label: 'Thực nhận (đã lọc)', value: usd(totals.all.net), color: 'var(--ok)',
      title: `Tiền vào túi. Doanh số gốc qua tay: ${usd(totals.all.gross)}` },
    ...(Object.keys(SRC_META) as RevenueSource[]).map((s) => ({
      key: s, label: SRC_META[s].label, value: usd(totals[s].net), color: SRC_META[s].color,
      active: src === s, onClick: () => setParam('src', src === s ? 'all' : s),
      title: totals[s].gross > totals[s].net
        ? `Doanh số gốc ${usd(totals[s].gross)} → thực nhận ${usd(totals[s].net)} (${Math.round((totals[s].net / totals[s].gross) * 100)}%). Bấm để chỉ xem nguồn này.`
        : `Chỉ xem ${SRC_META[s].label}`,
    })),
  ];

  // Compact (home glance): totals strip + the month calendar, but NO filter toolbar (kept lean).
  // Full filtering (source/channel, URL-state) lives on /revenue. Cards non-interactive here.
  if (compact) {
    return (
      <>
        {errors.length > 0 && (
          <div style={{ fontSize: 10.5, color: 'var(--warn)', marginBottom: 8 }}>⚠ {errors.join(' · ')}</div>
        )}
        <StatsStrip cards={cards.map((c) => ({ ...c, onClick: undefined, active: undefined }))} />
        {items.length === 0 ? (
          <EmptyState icon="🗓" compact title="Chưa có doanh thu nguồn nào trong 30 ngày" />
        ) : (
          <MonthCalendar items={items} />
        )}
      </>
    );
  }

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
