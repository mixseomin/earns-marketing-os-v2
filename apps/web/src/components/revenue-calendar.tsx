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
import { MonthCalendar, ListToolbar, FilterChips, MultiSelect, StatsStrip, EmptyState, Pill, Collapsible } from './ui';
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
const resetBtn: React.CSSProperties = {
  fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid var(--line)',
  background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer',
};
export function RevenueCalendar({ rows, errors, scannedNetworks = [], foldCalendar = false }: {
  rows: RevenueDayRow[]; errors: string[];
  /** Network đã hỏi API trong lượt này, kể cả net trả 0 giao dịch — để nó vẫn có mặt trong bộ lọc. */
  scannedNetworks?: string[];
  /** Gập lịch lại (YDNI §5): trên màn mà lịch KHÔNG phải nội dung chính (trang chủ — chính là
   *  Portfolio), panel tham chiếu phải đóng sẵn. Tiền vẫn hiện ở dải thẻ, 1 click là bung lịch. */
  foldCalendar?: boolean;
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
      && (!grps.length || grps.includes(groupOf(r)))
      && (!needle || `${r.channel} ${groupOf(r)}`.toLowerCase().includes(needle)));
  }, [rows, srcs, grps, solo, channel]);

  // Lựa chọn bậc dưới + số tiền của từng bậc — nhãn chip CHÍNH LÀ bảng bóc tách ("cj $19.75").
  // Tính trên tập đã lọc nguồn + ô tìm nhưng CHƯA lọc bậc dưới, để bấm vào là biết sẽ được bao nhiêu.
  const groupOpts = useMemo(() => {
    const needle = channel.trim().toLowerCase();
    const m = new Map<string, number>();
    // Network đã quét mà không có giao dịch nào vẫn phải hiện (awin $0.00). Biến mất khỏi bộ lọc thì
    // không phân biệt được "kiểm rồi, không có tiền" với "đường lấy dữ liệu chết".
    if (!srcs.length || srcs.includes('affiliate')) for (const n of scannedNetworks) m.set(n, 0);
    for (const r of rows) {
      if (srcs.length && !srcs.includes(r.source)) continue;
      const g = groupOf(r);
      if (needle && !`${r.channel} ${g}`.toLowerCase().includes(needle)) continue;
      m.set(g, (m.get(g) ?? 0) + r.amount);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
      .map(([value, amt]) => ({ value, label: `${value} ${usd(amt)}` }));
  }, [rows, srcs, channel, scannedNetworks]);

  /** Bóc tách: chọn đúng một nguồn thì dải thẻ đổi sang từng bậc dưới của nguồn đó (awin/cj…).
   *  Dải thẻ chỉ chứa nổi ~4 ô nên phần đuôi gộp thành "+N khác" — cắt bớt thì phải NÓI, chứ tổng
   *  các thẻ mà không bằng thẻ tổng là kiểu sai số khó chịu nhất. */
  const groupTotals = useMemo(() => {
    if (!solo) return [];
    const m = new Map<string, number>();
    if (solo === 'affiliate') for (const n of scannedNetworks) m.set(n, 0);
    for (const r of filtered) m.set(groupOf(r), (m.get(groupOf(r)) ?? 0) + r.amount);
    const all = [...m.entries()].sort((a, b) => b[1] - a[1]);
    if (all.length <= 4) return all;
    const rest = all.slice(3);
    return [...all.slice(0, 3), [`+${rest.length} khác`, rest.reduce((sum, [, v]) => sum + v, 0)] as [string, number]];
  }, [filtered, solo, scannedNetworks]);

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

  /** Số ngày thực sự có tiền — nhãn của khối gập, để biết bên trong có gì mà không phải mở ra. */
  const days = useMemo(() => new Set(filtered.map((r) => r.date)).size, [filtered]);
  const reset = () => { setSrcs([]); setGrps([]); setChannel(''); };

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
  //
  // KỶ LUẬT MÀU (YDNI): chỉ thẻ TỔNG được tô — nó là con số của màn. Bốn nguồn còn lại để số trung
  // tính, màu rút về một vạch nhỏ ở nhãn, đúng vai của nó là CHÚ THÍCH cho pill cùng màu trên lịch.
  // Bốn con số bốn màu neon thì không con nào nổi, mà màu cũng chẳng báo nghĩa gì thêm.
  const bar = (color: string) => (
    <span style={{ display: 'inline-block', width: 3, height: 8, borderRadius: 1, background: color, marginRight: 5, verticalAlign: 'baseline' }} />
  );
  const cards: StatCard[] = solo
    // Chọn một nguồn = dải thẻ chuyển sang BÓC TÁCH bậc dưới của nguồn đó (awin / cj / từng site…).
    ? [
      { key: 'all', label: `${SRC_META[solo].label} (đã lọc)`, value: usd(totals.all.net), color: 'var(--ok)',
        title: `Tiền vào túi. Doanh số gốc qua tay: ${usd(totals.all.gross)}` },
      ...groupTotals.map(([g, amt]) => ({
        key: `g:${g}`, label: <>{bar(SRC_META[solo].color)}{g}</>, value: usd(amt),
        title: `${g}: ${usd(amt)} trong khoảng đang xem`,
      })),
    ]
    : [
      { key: 'all', label: 'Thực nhận (đã lọc)', value: usd(totals.all.net), color: 'var(--ok)',
        title: `Tiền vào túi. Doanh số gốc qua tay: ${usd(totals.all.gross)}` },
      ...SOURCES.map((s) => ({
        key: s, label: <>{bar(SRC_META[s].color)}{SRC_META[s].label}</>, value: usd(totals[s].net),
        title: totals[s].gross > totals[s].net
          ? `Doanh số gốc ${usd(totals[s].gross)} → thực nhận ${usd(totals[s].net)} (${Math.round((totals[s].net / totals[s].gross) * 100)}%)`
          : SRC_META[s].label,
      })),
    ];

  const calendar = items.length === 0 ? (
    <EmptyState icon="🗓" compact title="Không có doanh thu khớp bộ lọc"
      // YDNI §4: câu chỉ-việc phải bấm được, đừng bắt người ta tự đi mò lại từng ô lọc.
      action={<button type="button" onClick={reset} style={resetBtn}>✕ bỏ hết bộ lọc</button>} />
  ) : (
    <MonthCalendar items={items} itemNoun="doanh thu" />
  );

  return (
    <>
      {/* Thanh lọc ĐỨNG YÊN: bộ điều khiển không mọc/biến theo lựa chọn (luật bố-cục-không-nhảy
          2026-08-08). Ô bóc tách luôn có mặt — đổi nguồn chỉ đổi DANH SÁCH bên trong nó. */}
      <ListToolbar search={channel} onSearch={setChannel} searchPlaceholder="Lọc theo kênh/site/sản phẩm…">
        <FilterChips
          values={srcs}
          onToggle={(v) => { setSrcs(v); setGrps([]); }}   // đổi nguồn thì bậc dưới không còn nghĩa
          options={SOURCES.map((s) => ({ value: s, label: SRC_META[s].label }))}
        />
        <MultiSelect label="bóc tách" compact selected={grps} onChange={setGrps} options={groupOpts}
          searchPlaceholder="network / site / sản phẩm…" />
      </ListToolbar>

      {errors.length > 0 && (
        <div className="panel" style={{ padding: '6px 10px', marginBottom: 10, borderColor: 'var(--warn)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill label="nguồn lỗi" color="var(--warn)" size="xs" tone="soft" />
          <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{errors.join(' · ')}</span>
        </div>
      )}

      <StatsStrip cards={cards} />

      {foldCalendar
        ? <Collapsible title="Lịch theo ngày" marginTop={0} badge={<span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>{days} ngày có tiền</span>}>{calendar}</Collapsible>
        : calendar}
    </>
  );
}
