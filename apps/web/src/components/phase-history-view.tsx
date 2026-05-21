'use client';

// PhaseHistoryView — append-only transition log for a brief, read-only.
// Extracted từ brief-edit-modal trong refactor 2026-05-22.
// memo() vì history append-only — stable reference giữa renders cùng id.

import { memo } from 'react';
import { PHASE_LABEL, PHASE_COLOR, type Phase } from '@/lib/phase-plan';
import { fmtAgo } from '@/lib/time-format';

export interface PhaseHistoryEntry {
  from: Phase | null;
  to: Phase;
  at: string;
  byUserId: number | null;
  reason: string;
}

export const PhaseHistoryView = memo(PhaseHistoryViewImpl);
PhaseHistoryView.displayName = 'PhaseHistoryView';

function PhaseHistoryViewImpl({
  history, currentPhase,
}: {
  history: PhaseHistoryEntry[];
  currentPhase: Phase;
}) {
  if (history.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--fg-3)', background: 'var(--bg-2)', borderRadius: 5, border: '1px dashed var(--line)', textAlign: 'center' }}>
        Chưa có chuyển phase nào. Brief đang ở <strong style={{ color: PHASE_COLOR[currentPhase] }}>{PHASE_LABEL[currentPhase]}</strong>.
      </div>
    );
  }
  const sorted = [...history].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>
        Lịch sử chuyển phase · {history.length} mục
      </div>
      {sorted.map((h, i) => (
        <div key={i} style={{
          padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', minWidth: 120 }}>
            {fmtAgo(h.at)}
          </span>
          <span style={{
            padding: '1px 6px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
            background: h.from ? PHASE_COLOR[h.from] + '22' : 'transparent',
            color: h.from ? PHASE_COLOR[h.from] : 'var(--fg-3)',
            border: h.from ? `1px solid ${PHASE_COLOR[h.from]}44` : '1px dashed var(--line)',
            borderRadius: 3, textTransform: 'uppercase',
          }}>{h.from ? PHASE_LABEL[h.from] : 'ban đầu'}</span>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>→</span>
          <span style={{
            padding: '1px 6px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
            background: PHASE_COLOR[h.to] + '22', color: PHASE_COLOR[h.to],
            border: `1px solid ${PHASE_COLOR[h.to]}44`, borderRadius: 3, textTransform: 'uppercase',
          }}>{PHASE_LABEL[h.to]}</span>
          <span style={{ flex: 1, fontSize: 11, color: 'var(--fg-1)' }}>
            {h.reason || <em style={{ color: 'var(--fg-4)' }}>(không ghi lý do)</em>}
          </span>
        </div>
      ))}
    </div>
  );
}
