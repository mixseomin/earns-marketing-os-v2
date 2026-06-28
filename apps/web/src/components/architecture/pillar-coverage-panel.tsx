'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { pillarCoverage, createContentPillar, generatePillarSuggestions, type PillarCoverageRow } from '@/lib/actions/content-pillars';
import type { OpenFn } from '@/components/content-value-page';

// "Pillar sơ sài — biết thiếu để thêm" — coverage pillar toàn portfolio NHÚNG vào drawer node `pillar`.
// none(0)/thin(<3)/ok(≥3). Mỗi project: + thêm tay · ✨ AI gợi ý (sinh 4-6 từ brand+website, lưu thật).
const ST: Record<string, { label: string; color: string }> = {
  none: { label: 'THIẾU', color: 'var(--bad)' }, thin: { label: 'mỏng', color: 'var(--neon-amber)' }, ok: { label: 'ok', color: 'var(--neon-lime)' },
};
export function PillarCoveragePanel({ onOpen }: { onOpen?: OpenFn }) {
  const [rows, setRows] = useState<PillarCoverageRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState<Record<string, string>>({});
  const reload = () => pillarCoverage().then(setRows);
  useEffect(() => { reload(); }, []);

  const add = async (pid: string) => {
    const name = (draft[pid] || '').trim(); if (!name) return;
    setBusy(pid + ':add');
    const r = await createContentPillar(pid, { name });
    setBusy(''); setMsg((m) => ({ ...m, [pid]: r.ok ? '✓ đã thêm' : (r.error || 'lỗi') }));
    if (r.ok) { setDraft((d) => ({ ...d, [pid]: '' })); reload(); }
  };
  const suggest = async (pid: string) => {
    setBusy(pid + ':ai'); setMsg((m) => ({ ...m, [pid]: 'AI đang gợi ý…' }));
    const r = await generatePillarSuggestions(pid, true);
    setBusy(''); setMsg((m) => ({ ...m, [pid]: r.ok ? `✓ thêm ${r.created} pillar` : (r.error || 'lỗi') }));
    if (r.ok) reload();
  };

  if (!rows) return <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Đang tải coverage…</div>;
  const th: CSSProperties = { padding: '6px 8px', textAlign: 'left', color: 'var(--fg-2)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--bg-3)', whiteSpace: 'nowrap' };
  const td: CSSProperties = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid var(--bg-2)', verticalAlign: 'middle' };
  const inp: CSSProperties = { fontSize: 12, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--bg-3)', background: 'var(--bg-0)', color: 'var(--fg-0)', width: 150 };
  const btn = (c: string): CSSProperties => ({ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${c}`, background: 'transparent', color: c, cursor: 'pointer' });
  const missing = rows.filter((r) => r.status !== 'ok').length;
  return (
    <div>
      <p style={{ color: 'var(--fg-2)', fontSize: 13, margin: '0 0 10px' }}>
        {rows.length} project · <b style={{ color: 'var(--bad)' }}>{rows.filter((r) => r.status === 'none').length} thiếu hẳn</b>, {rows.filter((r) => r.status === 'thin').length} mỏng. Project có bài đăng mà ít pillar = ưu tiên bổ sung (pillar điều hướng voice + key-message cho AI gen).
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={th}>Project</th><th style={{ ...th, textAlign: 'right' }}>Pillar</th><th style={{ ...th, textAlign: 'right' }}>Đã đăng</th>
          <th style={th}>Tình trạng</th><th style={th}>Thêm</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => {
            const s = ST[r.status]!;
            return (
              <tr key={r.projectId} style={{ background: r.status === 'none' ? 'color-mix(in srgb, var(--bad) 8%, transparent)' : undefined }}>
                <td style={{ ...td, fontWeight: 600 }}>{onOpen ? <a role="button" onClick={() => onOpen('project', r.projectId, r.projectName)} style={{ color: 'var(--fg-0)', cursor: 'pointer', textDecoration: 'none' }}>{r.projectName}</a> : r.projectName}</td>
                <td style={{ ...td, textAlign: 'right', color: r.status === 'none' ? 'var(--bad)' : 'var(--fg-1)' }}>{r.pillars}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--fg-2)' }}>{r.posted}</td>
                <td style={td}><span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, border: `1px solid ${s.color}`, color: s.color }}>{s.label}</span></td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input value={draft[r.projectId] || ''} onChange={(e) => setDraft((d) => ({ ...d, [r.projectId]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') add(r.projectId); }} placeholder="tên pillar mới" style={inp} />
                    <button onClick={() => add(r.projectId)} disabled={!!busy} style={btn('var(--neon-cyan)')}>＋</button>
                    <button onClick={() => suggest(r.projectId)} disabled={!!busy} title="AI sinh 4-6 pillar từ brand + website, lưu thật" style={btn('var(--neon-lime)')}>✨ AI</button>
                    {msg[r.projectId] && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{msg[r.projectId]}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {missing > 0 && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-3)' }}>Mẹo: bấm ✨ AI ở project thiếu → tự sinh pillar theo brand. Sửa chi tiết (key-message, voice) trong /p/&lt;project&gt;.</div>}
    </div>
  );
}
