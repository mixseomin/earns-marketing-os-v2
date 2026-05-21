'use client';

// CritiquePanel — read-only display of AI review verdict + risks + polish
// suggestions. Extracted từ brief-edit-modal trong refactor 2026-05-22.
// memo() vì critique object stable sau khi sinh — props ko đổi mỗi parent render.

import { memo } from 'react';
import type { PostCritique } from '@/lib/ai/post-draft';

export const CritiquePanel = memo(CritiquePanelImpl);
CritiquePanel.displayName = 'CritiquePanel';

function CritiquePanelImpl({ critique, onClose }: { critique: PostCritique; onClose: () => void }) {
  const riskColor: Record<PostCritique['riskLevel'], string> = {
    low: 'var(--ok)', medium: 'var(--warn)', high: 'var(--bad)',
  };
  return (
    <div style={{
      padding: 10, background: 'var(--bg-1)',
      border: `2px solid ${riskColor[critique.riskLevel]}`, borderRadius: 5,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
          background: riskColor[critique.riskLevel], color: '#0d1117', borderRadius: 3, textTransform: 'uppercase',
        }}>
          🔍 Risk {critique.riskLevel}
        </span>
        {critique.willModRemove && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--bad)', fontWeight: 700 }}>
            ⚠ Mod có thể REMOVE
          </span>
        )}
        <span style={{ flex: 1, fontSize: 11, color: 'var(--fg-2)' }}>{critique.rationale}</span>
        <button type="button" onClick={onClose} className="btn ghost"
                style={{ fontSize: 10, padding: '2px 6px' }}>✕</button>
      </div>
      {critique.risks.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>
            Risks ({critique.risks.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {critique.risks.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, padding: '4px 6px', background: 'var(--bg-2)', borderRadius: 4, border: '1px solid var(--line)' }}>
                <span style={{
                  flexShrink: 0, padding: '0 4px', fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: riskColor[r.severity], border: `1px solid ${riskColor[r.severity]}`, borderRadius: 2, textTransform: 'uppercase',
                }}>{r.severity}</span>
                <div style={{ flex: 1, fontSize: 11.5, lineHeight: 1.4 }}>
                  <div style={{ color: 'var(--fg-0)' }}>{r.issue}</div>
                  <div style={{ color: 'var(--fg-2)', marginTop: 2 }}><strong>Fix:</strong> {r.fix}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {critique.suggestions.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 4 }}>
            Polish suggestions ({critique.suggestions.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'var(--fg-1)', lineHeight: 1.5 }}>
            {critique.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
