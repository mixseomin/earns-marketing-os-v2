'use client';

// Lịch doanh thu theo NGÀY, gộp mọi nguồn (AdSense · Sản phẩm · Gumroad · Affiliate network).
// Filter = primitive nhà (ListToolbar + FilterChips + MultiSelect + SearchInput), lịch = MonthCalendar.
// Dùng CHUNG cho trang chủ và /revenue, không có biến thể "rút gọn" nào bỏ bớt bộ lọc.
//
// TRẠNG THÁI LỌC: state cục bộ, URL ghi kiểu SHALLOW (window.history.replaceState qua
// lib/url-shallow) → F5/share vẫn giữ nguyên bộ lọc (ui-conventions §1). Trước đây mỗi lần bấm chip
// gọi router.replace: Next render lại toàn trang ở SERVER, kéo lại AdSense + product_stats + Gumroad
// + 2 API network, chỉ để lọc một mảng đã nằm sẵn trong props. Đó là lý do bấm lọc phải chờ.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MonthCalendar, ListToolbar, FilterChips, MultiSelect, StatsStrip, EmptyState, Pill } from './ui';
import { writeShallowParam } from '@/lib/url-shallow';
import type { CalItem } from './ui/month-calendar';
import type { StatCard } from './ui/stats-strip';
import type { RevenueDayRow, RevenueSource } from '@/lib/revenue/by-day';

const SRC_META: Record<RevenueSource, { label: string; color: string }> = {
  // 'product' = product_stats (chaturbate/mql5/udemy/stripe…) — trước ghi là "Sản phẩm/Affiliate",
  // giờ affiliate network là nguồn RIÊNG nên tên cũ chỉ gây nhầm.
  product: { label: 'Sản phẩm', color: 'var(--neon-lime)' },
  adsense: { label: 'AdSense', color: 'var(--neon-cyan)' },
  gumroad: { label: 'Gumroad', color: 'var(--neon-violet)' },
  affiliate: { label: 'Affiliate network', color: 'var(--neon-amber)' },
};
const SOURCES = Object.keys(SRC_META) as RevenueSource[];

const usd = (n: number) => (n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(3)}`);
const list = (s: string | null) => (s || '').split(',').filter(Boolean);
/** Bậc bóc tách của một dòng: affiliate → network; nguồn khác không có tầng giữa nên chính là kênh. */
const groupOf = (r: RevenueDayRow) => r.group ?? r.channel;
/** Quá nhiều lựa chọn thì chip thành bức tường — chuyển sang dropdown (đúng việc của MultiSelect). */
const CHIP_LIMIT = 8;

export function RevenueCalendar({ rows, errors, scannedNetworks = [] }: {
  rows: RevenueDayRow[]; errors: string[];
  /** Network đã hỏi API trong lượt này, kể cả net trả 0 giao dịch — để nó vẫn có mặt trong bộ lọc. */
  scannedNetworks?: string[];
}) {
  // useSearchParams cho giá trị ĐẦU (server và client thấy như nhau → không lệch hydrate); từ đó về
  // sau state cục bộ là nguồn thật, URL chỉ là bản chiếu.
  const params = useSearchParams();
  const [srcs, setSrcs] = useState<RevenueSource[]>(() => list(params.get('src')) as RevenueSource[]);
  const [grps, setGrps] = useState<string[]>(() => list(params.get('g')));
  const [channel, setChannel] = useState(() => params.get('ch') ?? '');

  useEffect(() => {
    writeShallowParam('src', srcs.join(','));
    writeShallowParam('g', grps.join(','));
    writeShallowParam('ch', channel.trim());
  }, [srcs, grps, channel]);

  // Chọn ĐÚNG một nguồn = mở nguồn đó ra: hiện bộ lọc bậc dưới + lịch tách pill theo bậc đó.
  // Nhiều nguồn (hoặc tất cả) thì bóc tách theo cái gì cũng vô nghĩa nên gộp lại như cũ.
  const solo = srcs.length === 1 ? srcs[0]! : null;

  const filtered = useMemo(() => {
    const needle = channel.trim().toLowerCase();
    return rows.filter((r) =>
      (!srcs.length || srcs.includes(r.source))
      && (!solo || !grps.length || grps.includes(groupOf(r)))
      && (!needle || `${r.channel} ${groupOf(r)}`.toLowerCase().includes(needle)));
  }, [rows, srcs, grps, solo, channel]);

  // Lựa chọn bậc dưới + số tiền của từng bậc — nhãn chip CHÍNH LÀ bảng bóc tách ("cj $19.75").
  // Tính trên tập đã lọc nguồn + ô tìm nhưng CHƯA lọc bậc dưới, để bấm vào là biết sẽ được bao nhiêu.
  const groupOpts = useMemo(() => {
    if (!solo) return [];
    const needle = channel.trim().toLowerCase();
    const m = new Map<string, number>();
    // Network đã quét mà không có giao dịch nào vẫn phải hiện (awin $0.00). Biến mất khỏi bộ lọc thì
    // không phân biệt được "kiểm rồi, không có tiền" với "đường lấy dữ liệu chết".
    if (solo === 'affiliate') for (const n of scannedNetworks) m.set(n, 0);
    for (const r of rows) {
      if (r.source !== solo) continue;
      const g = groupOf(r);
      if (needle && !`${r.channel} ${g}`.toLowerCase().includes(needle)) continue;
      m.set(g, (m.get(g) ?? 0) + r.amount);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([value, amt]) => ({ value, label: `${value} ${usd(amt)}` }));
  }, [rows, solo, channel, scannedNetworks]);

  // Một pill mỗi (ngày × nguồn) — nhiều kênh cùng nguồn trong một ngày thì cộng lại, ô lịch chỉ cao
  // ~78px nên đừng nhồi từng kênh một. Đang mở một nguồn thì tách thêm theo bậc dưới (awin / cj).
  const items: CalItem[] = useMemo(() => {
    const agg = new Map<string, { date: string; source: RevenueSource; group: string | null; amount: number; gross: number; channels: Set<string> }>();
    for (const r of filtered) {
      const g = solo ? groupOf(r) : null;
      const k = `${r.date}|${r.source}|${g ?? ''}`;
      const cur = agg.get(k) ?? { date: r.date, source: r.source, group: g, amount: 0, gross: 0, channels: new Set<string>() };
      cur.amount += r.amount; cur.gross += r.gross ?? r.amount; cur.channels.add(r.channel);
      agg.set(k, cur);
    }
    return [...agg.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([k, v]) => ({
        id: k, date: v.date, color: SRC_META[v.source].color,
        // Con số trên ô = THỰC NHẬN. Doanh số gốc chỉ vào tooltip, để không ai
        // nhìn nhầm $421 khách tiêu thành $421 tiền mình.
        label: v.group ? `${v.group} ${usd(v.amount)}` : usd(v.amount),
        title: `${v.date} · ${SRC_META[v.source].label}${v.group ? ` · ${v.group}` : ''} · thực nhận ${usd(v.amount)}`
          + (v.gross > v.amount ? `\ndoanh số gốc ${usd(v.gross)} → ${Math.round((v.amount / v.gross) * 100)}%` : '')
          + `\n${[...v.channels].join(', ')}`,
      }));
  }, [filtered, solo]);

  const totals = useMemo(() => {
    const z = () => ({ net: 0, gross: 0 });
    const t: Record<RevenueSource | 'all', { net: number; gross: number }> =
      { all: z(), adsense: z(), product: z(), gumroad: z(), affiliate: z() };
    for (const r of filtered) {
      const g = r.gross ?? r.amount;
      t.all.net += r.amount; t.all.gross += g;
      t[r.source].net += r.amount; t[r.source].gross += g;
    }
    return t;
  }, [filtered]);

  // Thẻ số = SỐ, không phải nút lọc. Trước đây thẻ và chip cùng đổi một trạng thái — hai mặt của
  // đúng một cái công tắc, mà chip mới là cái có nhãn. Bỏ onClick ở thẻ, chip giữ việc lọc.
  const cards: StatCard[] = [
    { key: 'all', label: 'Thực nhận (đã lọc)', value: usd(totals.all.net), color: 'var(--ok)',
      title: `Tiền vào túi. Doanh số gốc qua tay: ${usd(totals.all.gross)}` },
    ...SOURCES.map((s) => ({
      key: s, label: SRC_META[s].label, value: usd(totals[s].net), color: SRC_META[s].color,
      title: totals[s].gross > totals[s].net
        ? `Doanh số gốc ${usd(totals[s].gross)} → thực nhận ${usd(totals[s].net)} (${Math.round((totals[s].net / totals[s].gross) * 100)}%)`
        : SRC_META[s].label,
    })),
  ];

  return (
    <>
      <ListToolbar search={channel} onSearch={setChannel} searchPlaceholder="Lọc theo kênh/site/sản phẩm…">
        <FilterChips
          values={srcs}
          onToggle={(v) => { setSrcs(v); setGrps([]); }}   // đổi nguồn thì bậc dưới không còn nghĩa
          options={SOURCES.map((s) => ({ value: s, label: SRC_META[s].label }))}
        />
      </ListToolbar>

      {solo && groupOpts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '-4px 2px 10px' }}>
          <span style={{ fontSize: 10, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {solo === 'affiliate' ? 'theo network' : 'theo kênh'}
          </span>
          {groupOpts.length <= CHIP_LIMIT ? (
            <FilterChips values={grps} onToggle={setGrps} options={groupOpts} />
          ) : (
            <MultiSelect label={solo === 'affiliate' ? 'network' : 'kênh'} compact selected={grps} onChange={setGrps}
              options={groupOpts} />
          )}
        </div>
      )}

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
        <MonthCalendar items={items} itemNoun="doanh thu" />
      )}
    </>
  );
}
