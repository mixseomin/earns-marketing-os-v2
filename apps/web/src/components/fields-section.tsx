'use client';

// FieldsSection — generic component render schema-driven fields với:
//   - Header (title + subtitle badge + refresh button)
//   - List rows: field key + scope badge (selector trained?) + value
//
// Reuse cho HabitatSelectorsSection, BriefSelectorsSection và mọi
// schema sau này (vd account fields, post fields).
//
// Caller chuẩn bị fields[] với value resolved sẵn — component không
// biết về habitat/brief/account. Tách concerns: data-fetch ở wrapper,
// presentation ở đây.

import { useState, type ReactNode } from 'react';
import type { ScopeKind } from '@/lib/actions/habitat-selectors';

export interface FieldRowSpec {
  /** Field key (vd "title", "members", "join_status"). */
  key: string;
  /** Display label cho user. */
  label: string;
  /** Hint tooltip — mô tả nghĩa field. */
  hint?: string;
  /** Parse hint (number, date, ...) — show ở góc phải. */
  parse?: string;
  /** Resolved selector scope (site/platform/technology) hoặc null nếu chưa train. */
  selectorScope?: ScopeKind | null;
  /** CSS selector full — show qua tooltip khi hover scope badge. */
  selectorCss?: string;
  /** Value đã extract; chuỗi/JSX/null. */
  value?: ReactNode;
  /** Tooltip cho cell value (multi-line text). */
  valueTooltip?: string;
  /** Render value placeholder khác nếu null (vd "chưa có data"). */
  emptyPlaceholder?: ReactNode;
}

interface Props {
  /** Header title — vd "🔍 Auto-detect selectors". */
  title: string;
  /** Subtitle badge nhỏ — vd "subreddit-about" hoặc "5 briefs". */
  subtitle?: string;
  /** Extra info dòng header (vd cascade chain). */
  hint?: string;
  /** Fields rows render. */
  fields: FieldRowSpec[];
  /** Loading state — show "Loading…" thay rows. */
  loading?: boolean;
  /** Empty state — show khi fields.length === 0 hoặc tất cả rỗng. */
  emptyMessage?: ReactNode;
  /** ↻ refresh button — show khi pass; click trigger re-fetch.
   * Có thể trả Promise (async) → component TỰ manage loading state
   * (button ⏳ + disabled trong suốt thời gian Promise pending). Caller
   * KHÔNG cần useState refresh thủ công. */
  onRefresh?: () => void | Promise<void>;
  /** Optional override — nếu caller muốn force loading state ngoài. */
  refreshing?: boolean;
  /** Max height list (default 280, auto scroll). */
  maxListHeight?: number;
  /** Action message (toast inline trong header). */
  actionMsg?: string | null;
  /** Tooltip cho missing selector badge. */
  noneTooltip?: string;
  /** Per-row trailing action (vd train button). */
  renderRowAction?: (field: FieldRowSpec) => ReactNode;
}

const SCOPE_META: Record<ScopeKind, { label: string; color: string }> = {
  habitat: { label: 'site', color: 'var(--accent)' },
  platform: { label: 'platform', color: 'var(--warn)' },
  technology: { label: 'technology', color: 'var(--fg-3)' },
};

const NONE_BADGE_STYLE: React.CSSProperties = {
  padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)',
  fontWeight: 700, borderRadius: 3, textAlign: 'center',
  background: 'rgba(251,191,36,.18)', color: 'var(--warn)',
  border: '1px dashed var(--warn)',
};

export function FieldsSection({
  title, subtitle, hint, fields,
  loading, emptyMessage, onRefresh, refreshing,
  maxListHeight = 280, actionMsg, noneTooltip = 'Chưa có selector trained',
  renderRowAction,
}: Props) {
  // Self-managed loading state — caller chỉ cần pass onRefresh (sync or
  // async). Nếu pass refreshing prop explicit → caller override.
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const isRefreshing = refreshing ?? internalRefreshing;
  const handleRefresh = async () => {
    if (!onRefresh) return;
    setInternalRefreshing(true);
    try {
      const ret = onRefresh();
      if (ret instanceof Promise) await ret;
      // Min visible delay 500ms để user thấy feedback (router.refresh ko
      // return Promise → finish ngay, button flash quá nhanh).
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      setInternalRefreshing(false);
    }
  };
  return (
    <div style={{ border: '1px dashed var(--line-2)', borderRadius: 5, padding: 8,
                  background: 'var(--bg-1)', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)',
                         textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {title}
        </strong>
        {subtitle && (
          <span style={{ padding: '1px 5px', background: 'var(--bg-2)', borderRadius: 3,
                         fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
            {subtitle}
          </span>
        )}
        {hint && (
          <span style={{ fontSize: 9, color: 'var(--fg-4)' }}>{hint}</span>
        )}
        <span style={{ flex: 1 }} />
        {actionMsg && (
          <span style={{ fontSize: 10, color: actionMsg.startsWith('⚠') ? 'var(--bad)' : 'var(--ok)' }}>
            {actionMsg}
          </span>
        )}
        {onRefresh && (
          <button type="button" onClick={handleRefresh} disabled={isRefreshing || loading}
                  title="Refresh data"
                  style={{ background: 'transparent', border: '1px solid var(--line)',
                           borderRadius: 3, padding: '1px 7px', fontSize: 10,
                           color: isRefreshing ? 'var(--fg-4)' : 'var(--fg-2)',
                           cursor: isRefreshing ? 'wait' : 'pointer',
                           fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
            {isRefreshing ? '⏳ refreshing…' : '↻ refresh'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--fg-3)', padding: 4 }}>Loading…</div>
      ) : fields.length === 0 ? (
        <div style={{ color: 'var(--fg-3)', fontStyle: 'italic', padding: 4 }}>
          {emptyMessage ?? 'Chưa có field nào.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2,
                      maxHeight: maxListHeight, overflowY: 'auto' }}>
          {fields.map((f) => {
            const scopeMeta = f.selectorScope ? SCOPE_META[f.selectorScope] : null;
            const hasValue = f.value != null && f.value !== '';
            return (
              <div key={f.key} style={{ display: 'grid',
                                         gridTemplateColumns: renderRowAction
                                           ? '130px 60px 1fr auto auto'
                                           : '130px 60px 1fr auto',
                                         gap: 6, alignItems: 'center',
                                         padding: '3px 4px', borderTop: '1px solid var(--line)' }}>
                {/* col 1: field key (mono) */}
                <span title={f.hint ? `${f.label}\n${f.hint}` : f.label}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
                               color: 'var(--fg-1)', fontWeight: 600, cursor: 'help' }}>
                  {f.key}
                </span>
                {/* col 2: scope badge */}
                {scopeMeta ? (
                  <span title={f.selectorCss ? `Selector @ ${f.selectorScope}\n${f.selectorCss}` : `Scope: ${f.selectorScope}`}
                        style={{ padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                 fontWeight: 700, borderRadius: 3, textAlign: 'center',
                                 background: scopeMeta.color + '22', color: scopeMeta.color,
                                 border: `1px solid ${scopeMeta.color}66` }}>
                    {scopeMeta.label}
                  </span>
                ) : (
                  <span title={noneTooltip} style={NONE_BADGE_STYLE}>none</span>
                )}
                {/* col 3: value (or label + hint fallback if no value) */}
                <span style={{ fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={f.valueTooltip ?? (hasValue ? undefined : f.hint)}>
                  {hasValue ? f.value : (f.emptyPlaceholder ?? (
                    <>
                      <strong style={{ color: 'var(--fg-1)' }}>{f.label}</strong>
                      {f.hint && <span style={{ color: 'var(--fg-3)', marginLeft: 6 }}>{f.hint}</span>}
                    </>
                  ))}
                </span>
                {/* col 4: parse hint */}
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                  {f.parse ? `→ ${f.parse}` : ''}
                </span>
                {/* col 5: optional row action */}
                {renderRowAction && (
                  <span>{renderRowAction(f)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
