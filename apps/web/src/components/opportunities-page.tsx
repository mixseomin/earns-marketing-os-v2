'use client';

// /opportunities — "đặt sản phẩm tiếp theo ở đâu".
//
// Bố cục theo YDNI: bề mặt mặc định CHỈ có thứ ra quyết định = bảng đo thị trường thật
// (có nguồn + ngày đo). 104 ý tưởng cũ chưa kiểm chứng vẫn giữ nguyên nhưng nằm DƯỚI và
// GẬP LẠI — 1 click là bung, không xoá, không ưu tiên (user 2026-08-06).
//
// Kỷ luật màu: mặc định trung tính. Màu chỉ ở ĐÚNG cột quyết định ($/1 SP mới) và ở
// dấu "anh đang ở đây". Verdict/score của ý tưởng cũ để xám — chúng chưa được kiểm chứng
// thì không được quyền hét lên bằng màu.

import { useMemo, useState } from 'react';
import type { MarketBenchmark, IdeaAnalysis } from '@/lib/opportunities/data';
import { useModalParam } from '@/lib/use-modal-param';
import {
  Section, StatsStrip, ListToolbar, FilterChips, Drawer, Pill, EmptyState, Pager, usePaged,
} from './ui';
import type { StatCard } from './ui/stats-strip';

const usd = (n: number) => n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : n >= 1 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
const int = (n: number) => n.toLocaleString('en-US');
const CAT_LABEL: Record<string, string> = {
  'software-development': 'Software Development', 'business-and-money': 'Business & Money',
  'self-improvement': 'Self-Improvement', education: 'Education',
  'writing-and-publishing': 'Writing & Publishing', other: 'Other', design: 'Design',
  'fitness-and-health': 'Fitness & Health', '3d': '3D Assets',
};
const catLabel = (c: string) => CAT_LABEL[c] ?? c;

/** Ngành mình ĐANG đứng — cả 9 sản phẩm CodeCrate nằm ở đây. Đánh dấu để bảng thành quyết định. */
const CURRENT_CATEGORY = 'software-development';

export function OpportunitiesPage({ benchmarks, ideas }: { benchmarks: MarketBenchmark[]; ideas: IdeaAnalysis[] }) {
  // ui-conventions §1: drawer mở qua useModalParam → F5 / gửi link mở lại đúng chỗ.
  const modal = useModalParam();
  const bench = modal.is('benchmark') ? benchmarks.find((b) => b.id === modal.numId) ?? null : null;

  const best = benchmarks[0];
  const worst = benchmarks[benchmarks.length - 1];
  const mine = benchmarks.find((b) => b.category === CURRENT_CATEGORY);
  const captured = benchmarks.find((b) => b.capturedAt)?.capturedAt?.slice(0, 10) ?? '—';
  // Giá nên đặt = giá trung bình của ngành đắt nhất theo đơn, không phải trung bình toàn sàn.
  const priciest = [...benchmarks].sort((a, b) => b.avgPrice - a.avgPrice)[0];

  const cards: StatCard[] = [
    { key: 'best', label: 'Ngành đáng vào nhất', value: best ? catLabel(best.category) : '—',
      color: 'var(--ok)', title: best ? `${usd(best.perNewProduct)} cho 1 sản phẩm mới trong ${best.windowDays} ngày · chỉ ${best.newProducts} đối thủ mới` : '' },
    { key: 'mine', label: 'Ngành mình đang đứng', value: mine ? usd(mine.perNewProduct) : '—',
      color: mine && best && mine.perNewProduct < best.perNewProduct / 2 ? 'var(--warn)' : 'var(--fg-0)',
      title: mine ? `${catLabel(mine.category)} — ${mine.newProducts} sản phẩm mới/tháng chia nhau ${usd(mine.newRevenue)}` : '' },
    { key: 'price', label: 'Giá bán nên nhắm', value: priciest ? `${usd(priciest.avgPrice)}` : '—',
      color: 'var(--fg-0)', title: priciest ? `Giá đơn trung bình của ${catLabel(priciest.category)} — ngành bán được giá nhất` : '' },
    { key: 'ideas', label: 'Ý tưởng cũ chờ kiểm chứng', value: int(ideas.length), color: 'var(--fg-2)',
      title: 'Phân tích từ trước, chưa verify — để tham khảo, không dùng để quyết định' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          🎯 Opportunities{' '}
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>
            // {benchmarks.length} ngành đo thật · {ideas.length} ý tưởng cũ
          </small>
        </h1>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
          Đặt sản phẩm tiếp theo ở đâu. Bảng dưới đo <strong style={{ color: 'var(--fg-1)' }}>người MỚI vào ngành kiếm được bao nhiêu</strong> trong 30 ngày —
          doanh thu toàn thời gian chỉ phản ánh mấy ông trùm cũ nên không dùng để chọn chỗ vào. Đo ngày {captured}.
        </p>
      </div>

      <StatsStrip cards={cards} />

      <BenchmarkTable rows={benchmarks} best={best} worst={worst} onOpen={(r) => modal.open('benchmark', r.id)} />

      <IdeasSection ideas={ideas} />

      {bench && <BenchmarkDrawer row={bench} onClose={modal.close} />}
    </div>
  );
}

// ── Bảng thị trường: bề mặt chính ────────────────────────────────
function BenchmarkTable({ rows, best, worst, onOpen }: {
  rows: MarketBenchmark[]; best?: MarketBenchmark; worst?: MarketBenchmark; onOpen: (r: MarketBenchmark) => void;
}) {
  if (rows.length === 0) {
    return <Section title="Chuẩn thị trường"><EmptyState icon="📊" compact title="Chưa đo ngành nào"
      description="Seed vào Directus collection market_benchmarks." /></Section>;
  }
  return (
    <Section title="Chuẩn thị trường · Gumroad" subtitle="xếp theo tiền 1 sản phẩm mới kiếm được — bấm 1 dòng để xem chi tiết + nguồn">
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Ngành', 'SP mới 30d', 'Đơn', 'Doanh thu 30d', '$/1 SP mới', 'Giá TB/đơn', 'Tổng SP'].map((h, i) => (
                <th key={h} style={{
                  padding: '6px 10px', fontSize: 9.5, fontWeight: 600, color: 'var(--fg-3)',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em',
                  textAlign: i === 0 ? 'left' : 'right', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isBest = r.id === best?.id;
              const isWorst = r.id === worst?.id;
              const isMine = r.category === CURRENT_CATEGORY;
              return (
                <tr key={r.id} onClick={() => onOpen(r)} style={{ cursor: 'pointer' }}
                  title={`${catLabel(r.category)} — bấm xem chi tiết`}>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', color: 'var(--fg-0)', fontWeight: isBest ? 600 : 400 }}>
                    {catLabel(r.category)}
                    {isMine && <Pill label="đang ở đây" color="var(--warn)" size="xs" tone="soft"
                      style={{ marginLeft: 6 }} title="Toàn bộ sản phẩm CodeCrate đang nằm ở ngành này" />}
                  </td>
                  <Td>{int(r.newProducts)}</Td>
                  <Td>{int(r.newSales)}</Td>
                  <Td>{usd(r.newRevenue)}</Td>
                  {/* Cột quyết định — chỗ DUY NHẤT được tô mạnh. */}
                  <Td style={{
                    color: isBest ? 'var(--ok)' : isWorst ? 'var(--warn)' : 'var(--fg-0)',
                    fontWeight: isBest || isWorst ? 600 : 500,
                  }}>{usd(r.perNewProduct)}</Td>
                  <Td>{usd(r.avgPrice)}</Td>
                  <Td style={{ color: 'var(--fg-3)' }}>{int(r.totalProducts)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right',
    fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', whiteSpace: 'nowrap', ...style }}>{children}</td>;
}

function BenchmarkDrawer({ row, onClose }: { row: MarketBenchmark; onClose: () => void }) {
  return (
    <Drawer onClose={onClose} width={560}>
      <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700 }}>{catLabel(row.category)}</h2>
      <p style={{ margin: '0 0 14px', fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        {row.platform} · đo {row.windowDays} ngày · chốt {row.capturedAt?.slice(0, 10) ?? '—'}
      </p>
      <Facts rows={[
        [`Sản phẩm mới trong ${row.windowDays} ngày`, int(row.newProducts)],
        ['Đơn bán ra từ sản phẩm mới', int(row.newSales)],
        ['Doanh thu từ sản phẩm mới', usd(row.newRevenue)],
        ['→ 1 sản phẩm mới kiếm được', usd(row.perNewProduct)],
        ['→ giá trung bình mỗi đơn', usd(row.avgPrice)],
        ['Tổng sản phẩm trong ngành', int(row.totalProducts)],
        ['Đơn toàn thời gian', int(row.allTimeSales)],
        ['Doanh thu toàn thời gian', usd(row.allTimeRevenue)],
      ]} />
      {row.notes && <p style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 12 }}>{row.notes}</p>}
      {row.sourceUrl && (
        <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', marginTop: 14, fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
          Nguồn đo → {row.sourceUrl.replace(/^https?:\/\//, '')}
        </a>
      )}
    </Drawer>
  );
}

function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div style={{ display: 'grid', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 10px', background: 'var(--bg-1)' }}>
          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{k}</span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-0)' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ── Ý tưởng cũ: xuống dưới, gập lại, không ưu tiên ───────────────
function IdeasSection({ ideas }: { ideas: IdeaAnalysis[] }) {
  const [q, setQ] = useState('');
  const [verdict, setVerdict] = useState('all');
  // Drawer con dùng slot riêng ('sub') để không giẫm lên slot của drawer ngành.
  const sub = useModalParam('sub');
  const sel = sub.is('idea') ? ideas.find((i) => i.id === sub.numId) ?? null : null;
  // Section GẬP không render children (`{open && …}` trong ui/section.tsx) → link
  // ?sub=idea&subId=… gửi cho người khác sẽ mở ra trắng. Nên khi URL đang trỏ vào
  // một ý tưởng thì section phải tự bung; đóng section = đóng luôn drawer.
  const [openSelf, setOpenSelf] = useState(false);
  const open = openSelf || !!sel;

  const counts = useMemo(() => ({
    all: ideas.length,
    go: ideas.filter((i) => i.verdict === 'go' || i.verdict === 'pursue').length,
    maybe: ideas.filter((i) => i.verdict === 'maybe').length,
    no: ideas.filter((i) => i.verdict === 'nogo' || i.verdict === 'avoid').length,
    none: ideas.filter((i) => !i.verdict).length,
  }), [ideas]);

  const filtered = useMemo(() => ideas.filter((i) => {
    if (verdict === 'go' && !(i.verdict === 'go' || i.verdict === 'pursue')) return false;
    if (verdict === 'maybe' && i.verdict !== 'maybe') return false;
    if (verdict === 'no' && !(i.verdict === 'nogo' || i.verdict === 'avoid')) return false;
    if (verdict === 'none' && i.verdict) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!i.title.toLowerCase().includes(t) && !(i.summary ?? '').toLowerCase().includes(t)
        && !(i.category ?? '').toLowerCase().includes(t)) return false;
    }
    return true;
  }), [ideas, verdict, q]);

  const { pageItems, ...pager } = usePaged(filtered);

  return (
    <Section
      title="Ý tưởng cũ · chưa kiểm chứng"
      subtitle={`${ideas.length} bản phân tích từ trước — tham khảo, không dùng để quyết định`}
      open={open}
      onToggle={(next) => { setOpenSelf(next); if (!next) sub.close(); }}
    >
      <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--fg-3)' }}>
        Số liệu trong đây chưa đối chiếu nguồn nào và phần lớn đã cũ. Muốn dùng cái nào thì đo lại thị trường
        cho nó trước, rồi thêm vào bảng chuẩn ở trên.
      </p>

      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="Tìm ý tưởng…">
        <FilterChips
          value={verdict}
          onChange={setVerdict}
          counts={counts}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'go', label: 'Go' },
            { value: 'maybe', label: 'Maybe' },
            { value: 'no', label: 'Không' },
            { value: 'none', label: 'Chưa chấm' },
          ]}
        />
      </ListToolbar>

      {pageItems.length === 0 ? (
        <EmptyState icon="🗃" compact title="Không có ý tưởng khớp bộ lọc" />
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          {pageItems.map((i) => (
            <div key={i.id} onClick={() => sub.open('idea', i.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
              title="Bấm để xem toàn bộ phân tích">
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i.title}
              </span>
              {i.category && <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{i.category}</span>}
              {/* Chưa kiểm chứng → pill xám, không tô xanh/đỏ theo verdict. */}
              {i.verdict && <Pill label={i.verdict} color="var(--fg-3)" size="xs" tone="soft" />}
              {i.score != null && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', minWidth: 22, textAlign: 'right' }}>{i.score}</span>}
              {i.ageDays != null && <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', minWidth: 46, textAlign: 'right' }}>{i.ageDays}d</span>}
            </div>
          ))}
        </div>
      )}
      <Pager {...pager} onPage={pager.setPage} />

      {sel && <IdeaDrawer idea={sel} onClose={sub.close} />}
    </Section>
  );
}

function IdeaDrawer({ idea, onClose }: { idea: IdeaAnalysis; onClose: () => void }) {
  const facts = (rows: Array<[string, string | number | null]>) =>
    rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)] as [string, string]);

  const market = facts([
    ['Quy mô thị trường', idea.marketSize], ['Khách hàng', idea.targetAudience],
    ['Cỡ tệp khách', idea.audienceSize], ['Mức bão hoà', idea.saturation],
    ['Số đối thủ', idea.competitorsCount],
  ]);
  const money = facts([
    ['Giá dự kiến', idea.pricePoint], ['Mô hình doanh thu', idea.revenueModel],
    ['Doanh thu tiềm năng', idea.revenuePotential], ['Bao lâu có tiền', idea.timeToRevenue],
  ]);
  const build = facts([
    ['Độ khó', idea.buildDifficulty], ['Thời gian làm', idea.buildTime],
    ['Chi phí/tháng', idea.monthlyCost != null ? `$${idea.monthlyCost}` : null],
    ['Rủi ro pháp lý', idea.legalRisk], ['Nỗ lực marketing', idea.marketingEffort],
  ]);

  return (
    <Drawer onClose={onClose} width={680}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1 }}>{idea.title}</h2>
        {idea.verdict && <Pill label={idea.verdict} color="var(--fg-3)" size="xs" tone="soft" />}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
        #{idea.id} · {idea.category ?? 'chưa phân loại'} · {idea.status ?? 'draft'}
        {idea.score != null && ` · điểm ${idea.score}`}
        {idea.ageDays != null && ` · ${idea.ageDays} ngày trước`}
      </p>

      <div className="panel" style={{ padding: '6px 10px', marginBottom: 12, borderColor: 'var(--line)' }}>
        <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
          Bản phân tích cũ, chưa đối chiếu nguồn. Đọc để lấy ý, đừng lấy số ở đây làm căn cứ.
        </span>
      </div>

      {idea.summary && <P>{idea.summary}</P>}
      {idea.painPoint && <Block title="Vấn đề giải quyết">{idea.painPoint}</Block>}
      {idea.competitiveGap && <Block title="Khoảng trống cạnh tranh">{idea.competitiveGap}</Block>}

      {market.length > 0 && <Group title="Thị trường"><Facts rows={market} /></Group>}
      {money.length > 0 && <Group title="Tiền"><Facts rows={money} /></Group>}
      {build.length > 0 && <Group title="Làm ra sao"><Facts rows={build} /></Group>}

      {idea.topCompetitors.length > 0 && (
        <Group title="Đối thủ chính">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--fg-1)' }}>
            {idea.topCompetitors.map((c, n) => <li key={n}>{c}</li>)}
          </ul>
        </Group>
      )}
      {(idea.pros.length > 0 || idea.cons.length > 0) && (
        <Group title="Được / mất">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <List items={idea.pros} label="Được" />
            <List items={idea.cons} label="Mất" />
          </div>
        </Group>
      )}
      {idea.notes && <Block title="Ghi chú">{idea.notes}</Block>}
      {idea.userNote && <Block title="Ghi chú cá nhân">{idea.userNote}</Block>}
      {idea.dashboardUrl && (
        <a href={idea.dashboardUrl} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
          Mở dashboard → {idea.dashboardUrl}
        </a>
      )}
    </Drawer>
  );
}

const P = ({ children }: { children: React.ReactNode }) =>
  <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg-1)' }}>{children}</p>;

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg-1)' }}>{children}</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</h3>
      {children}
    </div>
  );
}

function List({ items, label }: { items: string[]; label: string }) {
  if (items.length === 0) return <div />;
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 3 }}>{label}</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.5 }}>
        {items.map((x, n) => <li key={n}>{x}</li>)}
      </ul>
    </div>
  );
}
