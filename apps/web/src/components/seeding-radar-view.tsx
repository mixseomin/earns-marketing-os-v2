'use client';

// Seeding Radar — view quản lý/thống kê (cockpit tab "📡 Radar"). Aggregate cái mà per-board
// panel KHÔNG cho thấy: funnel độ phủ + backlog low-hanging + hiệu quả approach library + coverage
// catalog. Tự fetch qua server actions (seeding-radar-stats). Read-only, click backlog mở board.

import { useEffect, useState } from 'react';
import {
  getSeedingFunnel, getApproachPlaybookStats, getBoardCatalogCoverage,
  type SeedingFunnel, type PlaybookStat, type CoverageRow,
} from '@/lib/actions/seeding-radar-stats';

const card: React.CSSProperties = {
  background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, padding: 14,
};
const h: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 10 };
const sub: React.CSSProperties = { fontSize: 11, color: 'var(--fg-4)', fontWeight: 400 };
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, color: 'var(--fg-4)', fontWeight: 600, padding: '5px 8px', borderBottom: '1px solid var(--line)' };
const td: React.CSSProperties = { fontSize: 12, color: 'var(--fg-2)', padding: '5px 8px', borderBottom: '1px solid var(--bg-2)' };

function Stat({ label, value, color, hint }: { label: string; value: number | string; color?: string; hint?: string }) {
  return (
    <div style={{ flex: '1 1 88px', minWidth: 88, ...card, padding: '10px 12px' }} title={hint}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--fg-1)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 3 }}>{label}</div>
    </div>
  );
}

// Thanh funnel: discovered → GO/ADD → tracked(habitat) → brief → posted. Width ∝ count.
function FunnelBar({ f }: { f: SeedingFunnel }) {
  const steps = [
    { k: 'scored', label: 'Đã chấm', v: f.scored, c: 'var(--fg-3)' },
    { k: 'go', label: 'GO+ (fit≥70)', v: f.goIsh, c: '#4ade80' },
    { k: 'hab', label: 'Đã track', v: f.habitatsLinked, c: '#60a5fa' },
    { k: 'brief', label: 'Có brief', v: f.briefs, c: '#a78bfa' },
    { k: 'posted', label: 'Đã đăng', v: f.posted, c: '#34d399' },
  ];
  const max = Math.max(1, f.scored);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((s) => (
        <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 96, fontSize: 11, color: 'var(--fg-3)', textAlign: 'right' }}>{s.label}</div>
          <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 5, height: 18, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((s.v / max) * 100)}%`, minWidth: s.v ? 22 : 0, height: '100%', background: s.c, borderRadius: 5, transition: 'width .3s' }} />
          </div>
          <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: s.c }}>{s.v}</div>
        </div>
      ))}
    </div>
  );
}

export function SeedingRadarView({ projectId, serverBase }: { projectId: string; serverBase?: string }) {
  const [funnel, setFunnel] = useState<SeedingFunnel | null>(null);
  const [pb, setPb] = useState<PlaybookStat[]>([]);
  const [cov, setCov] = useState<CoverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let ok = true;
    setLoading(true); setErr('');
    Promise.all([getSeedingFunnel(projectId), getApproachPlaybookStats(), getBoardCatalogCoverage()])
      .then(([f, p, c]) => { if (!ok) return; setFunnel(f); setPb(p); setCov(c); })
      .catch((e) => { if (ok) setErr(e instanceof Error ? e.message : 'lỗi tải'); })
      .finally(() => { if (ok) setLoading(false); });
    return () => { ok = false; };
  }, [projectId]);

  if (loading) return <div style={{ padding: 24, color: 'var(--fg-4)', fontSize: 13 }}>Đang tải thống kê Radar…</div>;
  if (err) return <div style={{ padding: 24, color: 'var(--bad)', fontSize: 13 }}>⚠ {err}</div>;
  if (!funnel) return null;

  const boardUrl = (id: number) => `${serverBase || ''}/architecture?${new URLSearchParams({ obj: 'board', d: JSON.stringify([{ t: 'inst', objKey: 'board', id, label: '#' + id }]) }).toString()}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      {/* ── Funnel + stat chips (project) ── */}
      <div style={card}>
        <div style={h}>📡 Seeding funnel <span style={sub}>· độ phủ board của project (account-free) — cái per-board panel không cho thấy</span></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Stat label="đã chấm" value={funnel.scored} hint="board_project_score rows" />
          <Stat label="avg fit" value={funnel.avgFit} color={funnel.avgFit >= 50 ? '#4ade80' : funnel.avgFit >= 30 ? '#fbbf24' : '#f87171'} hint="fit trung bình — thấp = pillar chưa nhắm trúng board" />
          <Stat label="GO+ (≥70)" value={funnel.goIsh} color="#4ade80" />
          <Stat label="có angle" value={funnel.withApproach} color="#93c5fd" hint="board có approach bắc cầu" />
          <Stat label="đã track" value={funnel.habitatsLinked} color="#60a5fa" />
          <Stat label="có brief" value={funnel.briefs} color="#a78bfa" />
          <Stat label="đã đăng" value={funnel.posted} color="#34d399" />
          <Stat label="bỏ qua" value={funnel.skipped} color="#71717a" hint="manual SKIP" />
        </div>
        <FunnelBar f={funnel} />
      </div>

      {/* ── Backlog: GO/fit cao chưa có brief = low-hanging ── */}
      <div style={card}>
        <div style={h}>🎯 Backlog low-hanging <span style={sub}>· board fit cao / pin GO nhưng CHƯA có brief → hành động ngay</span></div>
        {funnel.backlog.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Không còn board fit cao nào chưa được track. 👌</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>fit</th><th style={th}>board</th><th style={th}></th></tr></thead>
              <tbody>
                {funnel.backlog.map((b) => (
                  <tr key={b.boardId}>
                    <td style={{ ...td, fontWeight: 700, color: b.fit >= 70 ? '#4ade80' : '#fbbf24' }}>{b.manualTier === 'GO' ? '📌 ' : ''}{b.fit}</td>
                    <td style={td}>{b.name || `#${b.boardId}`}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {b.url ? <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ color: '#93c5fd', fontSize: 11, marginRight: 10 }}>↗ mở board</a> : null}
                      <a href={boardUrl(b.boardId)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-4)', fontSize: 11 }}>Studio</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* ── Approach playbook effectiveness ── */}
      <div style={card}>
        <div style={h}>📚 Hiệu quả thư viện approach <span style={sub}>· angle nào được dùng nhiều + nâng fit → promote/retire</span></div>
        {pb.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>Chưa có approach playbook nào. Lưu angle từ ext (💾 Lưu lib) để gom thư viện.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>angle</th><th style={th}>uses</th><th style={th}>áp dụng</th><th style={th}>avg fit</th><th style={th}>projects</th></tr></thead>
              <tbody>
                {pb.map((p) => (
                  <tr key={p.id}>
                    <td style={td}>{p.title}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{p.uses}</td>
                    <td style={td}>{p.applied}</td>
                    <td style={{ ...td, fontWeight: 700, color: p.avgFit >= 50 ? '#4ade80' : p.avgFit >= 30 ? '#fbbf24' : 'var(--fg-3)' }}>{p.applied ? p.avgFit : '—'}</td>
                    <td style={td}>{p.projects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* ── Catalog coverage per platform/technology ── */}
      <div style={card}>
        <div style={h}>🗂 Độ phủ catalog <span style={sub}>· board/platform · %scored thấp = chưa khai thác · %signal thấp = cần auto-read</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>platform</th><th style={th}>engine</th><th style={th}>boards</th><th style={th}>có signal</th><th style={th}>đã scored</th></tr></thead>
          <tbody>
            {cov.map((c) => {
              const scoredPct = c.boards ? Math.round((c.scored / c.boards) * 100) : 0;
              return (
                <tr key={c.platform + (c.engine || '')}>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--fg-1)' }}>{c.platform}</td>
                  <td style={td}>{c.engine || '—'}</td>
                  <td style={td}>{c.boards}</td>
                  <td style={td}>{c.withSignal}</td>
                  <td style={{ ...td, color: scoredPct >= 50 ? '#4ade80' : scoredPct > 0 ? '#fbbf24' : 'var(--fg-4)' }}>{c.scored} <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>({scoredPct}%)</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
