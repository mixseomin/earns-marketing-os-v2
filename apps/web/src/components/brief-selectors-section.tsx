'use client';

// BriefSelectorsSection — UI inspect brief metadata (account ↔ habitat
// relationship) cho 1 habitat hiện tại. Tương tự HabitatSelectorsSection
// nhưng cho schema brief-field-schema.ts.
//
// Render: list rows {field, label, value của brief mỗi account engaged,
// selector trained (nếu có), train button}.
//
// Cách dùng:
//   <BriefSelectorsSection habitatId={habitat.id} platformKey="reddit"
//                          briefs={briefsRows} />

import { useState, useEffect } from 'react';
import { resolveSelectors, type ScopeKind, type SelectorSpec } from '@/lib/actions/habitat-selectors';
import { getBriefFieldSchema, briefSelectorFieldName, parseBriefFieldName } from '@/lib/brief-field-schema';

interface BriefRow {
  id: number;
  accountId: number;
  accountHandle: string | null;
  joinStatus: string;
  scrapedMeta: Record<string, unknown>;
}

interface Props {
  habitatId: number;
  platformKey: string | null;
  briefs: BriefRow[];
  pageKind?: string;
  onRefresh?: () => void;
}

const SCOPE_META: Record<ScopeKind, { label: string; color: string }> = {
  habitat: { label: 'site', color: 'var(--accent)' },
  platform: { label: 'platform', color: 'var(--warn)' },
  engine: { label: 'engine', color: 'var(--fg-3)' },
};

export function BriefSelectorsSection({
  habitatId, platformKey, briefs, pageKind = 'subreddit-about', onRefresh,
}: Props) {
  // Resolved selectors theo brief field names (prefix "brief.").
  const [resolved, setResolved] = useState<Record<string, { spec: SelectorSpec; scope: ScopeKind; key: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // resolveSelectors trả tất cả field cho (platform, page_kind); ta
      // filter prefix "brief." rồi strip để map về schema key.
      const all = await resolveSelectors({
        platformKey,
        technologyKey: null,
        pageKind,
      });
      if (cancelled) return;
      const briefOnly: typeof resolved = {};
      for (const [field, rf] of Object.entries(all)) {
        const briefKey = parseBriefFieldName(field);
        if (briefKey) {
          briefOnly[briefKey] = {
            spec: rf.spec,
            scope: rf.source.scope,
            key: rf.source.key,
          };
        }
      }
      setResolved(briefOnly);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [habitatId, platformKey, pageKind]);

  const schema = getBriefFieldSchema(pageKind);

  // Per field, gom values từ tất cả brief rows hiện engaged habitat này.
  const valuesByField = new Map<string, Array<{ value: string; handle: string }>>();
  for (const f of schema) {
    const arr: Array<{ value: string; handle: string }> = [];
    for (const b of briefs) {
      // join_status mirror sang column joinStatus, ưu tiên scrapedMeta nếu có
      let v: unknown;
      if (f.key === 'join_status') {
        v = (b.scrapedMeta && b.scrapedMeta[f.key]) ?? b.joinStatus;
      } else {
        v = b.scrapedMeta?.[f.key];
      }
      if (v != null && v !== '') {
        arr.push({ value: String(v), handle: b.accountHandle || `acc#${b.accountId}` });
      }
    }
    valuesByField.set(f.key, arr);
  }

  return (
    <div style={{ border: '1px dashed var(--line-2)', borderRadius: 5, padding: 8,
                  background: 'var(--bg-1)', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)',
                         textTransform: 'uppercase', letterSpacing: '.06em' }}>
          🔍 Brief auto-detect (per account)
        </strong>
        <span style={{ padding: '1px 5px', background: 'var(--bg-2)', borderRadius: 3,
                       fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
          {pageKind}
        </span>
        <span style={{ fontSize: 9, color: 'var(--fg-4)' }}>
          {briefs.length} brief{briefs.length === 1 ? '' : 's'}
        </span>
        <span style={{ flex: 1 }} />
        {onRefresh && (
          <button type="button" onClick={onRefresh}
                  style={{ background: 'transparent', border: '1px solid var(--line)',
                           borderRadius: 3, padding: '1px 7px', fontSize: 10,
                           color: 'var(--fg-2)', cursor: 'pointer',
                           fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
            ↻ refresh
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--fg-3)', padding: 4 }}>Loading…</div>
      ) : briefs.length === 0 ? (
        <div style={{ color: 'var(--fg-3)', fontStyle: 'italic', padding: 4 }}>
          Chưa có account nào engage habitat — không có brief để inspect.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2,
                      maxHeight: 280, overflowY: 'auto' }}>
          {schema.map((f) => {
            const rs = resolved[f.key];
            const meta = rs ? SCOPE_META[rs.scope] : null;
            const values = valuesByField.get(f.key) || [];
            const valueDisplay = values.length === 0
              ? <em style={{ color: 'var(--fg-4)' }}>chưa có data</em>
              : values.length === 1
                ? <span style={{ color: 'var(--ok)', fontFamily: 'var(--font-mono)' }}>{values[0]!.value}</span>
                : (
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
                    {values.map((v) => `${v.handle}=${v.value}`).join(' · ')}
                  </span>
                );
            return (
              <div key={f.key} style={{ display: 'grid',
                                         gridTemplateColumns: '130px 60px 1fr auto',
                                         gap: 6, alignItems: 'center',
                                         padding: '3px 4px', borderTop: '1px solid var(--line)' }}>
                <span title={f.hint}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
                               color: 'var(--fg-1)', fontWeight: 600, cursor: 'help' }}>
                  {f.key}
                </span>
                {meta ? (
                  <span title={`Selector trained @ ${rs!.scope}:${rs!.key}\n${rs!.spec.css}`}
                        style={{ padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                 fontWeight: 700, borderRadius: 3, textAlign: 'center',
                                 background: meta.color + '22', color: meta.color,
                                 border: `1px solid ${meta.color}66` }}>
                    {meta.label}
                  </span>
                ) : (
                  <span title="Chưa có selector trained — ext dùng fallback heuristic (vd join_status từ button text)"
                        style={{ padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                 fontWeight: 700, borderRadius: 3, textAlign: 'center',
                                 background: 'rgba(251,191,36,.18)', color: 'var(--warn)',
                                 border: '1px dashed var(--warn)' }}>
                    none
                  </span>
                )}
                <span style={{ fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={values.map((v) => `${v.handle}: ${v.value}`).join('\n')}>
                  {valueDisplay}
                </span>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                  {f.parse ? `→ ${f.parse}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
