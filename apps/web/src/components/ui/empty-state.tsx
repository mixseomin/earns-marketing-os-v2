// EmptyState — centered icon + title + optional description + optional CTA.
// Replaces the ad-hoc "🌱 Blank slate", "🤖 Chưa có squad" panels scattered
// across pages.

import type { ReactNode } from 'react';

export function EmptyState({
  icon, title, description, action, compact = false,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="panel">
      <div className="panel-body" style={{
        padding: compact ? 20 : 32,
        textAlign: 'center',
        color: 'var(--fg-2)',
      }}>
        <div style={{ fontSize: compact ? 28 : 36, marginBottom: 8 }}>{icon}</div>
        <h2 style={{
          margin: '0 0 6px',
          fontSize: compact ? 14 : 16,
          fontWeight: 600,
          color: 'var(--fg-0)',
        }}>
          {title}
        </h2>
        {description && (
          <p style={{
            margin: '0 0 12px',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-2)',
            lineHeight: 1.5,
          }}>
            {description}
          </p>
        )}
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
