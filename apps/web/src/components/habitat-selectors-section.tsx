'use client';

// HabitatSelectorsSection — UI inspect + manage 3-tier selectors.
//
// Mode:
//   - inspect (habitat modal): show resolved map (cascade habitat>platform>engine)
//     với badge scope per field. Click field → action override (xuống scope hẹp)
//     hoặc promote (lên scope rộng).
//   - editScope (platform/engine modal): list rows của 1 scope cụ thể, edit
//     CSS/parse inline, delete.

import { useState, useEffect } from 'react';
import {
  resolveSelectorsForHabitat, resolveSelectors, listScope, listFieldSamples,
  setOverride, clearOverride, promoteToScope,
  type SelectorSpec, type ResolvedMap, type ScopeKind,
} from '@/lib/actions/habitat-selectors';
import { getFieldSchema } from '@/lib/habitat-field-schema';

interface Props {
  // Inspect mode: pass habitatId hoặc platformKey (+ optional technologyKey)
  habitatId?: number | null;
  platformKey?: string | null;
  technologyKey?: string | null;
  // Edit mode: pass scope + key (override inspect)
  editScope?: ScopeKind;
  editKey?: string;
  pageKind?: string;
}

const SCOPE_META: Record<ScopeKind, { label: string; color: string }> = {
  habitat: { label: 'site', color: 'var(--accent)' },
  platform: { label: 'platform', color: 'var(--warn)' },
  engine: { label: 'engine', color: 'var(--fg-3)' },
};

export function HabitatSelectorsSection({
  habitatId, platformKey, technologyKey,
  editScope, editKey, pageKind = 'subreddit-about',
}: Props) {
  const isEditMode = !!(editScope && editKey);
  const [resolved, setResolved] = useState<ResolvedMap>({});
  const [editRows, setEditRows] = useState<Array<{ field: string; spec: SelectorSpec; source: string; updatedAt: string }>>([]);
  const [resolvedPlatform, setResolvedPlatform] = useState<string | null>(null);
  const [resolvedTech, setResolvedTech] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  // Sample values per field từ habitats khác — hover row để xem dữ liệu
  // thực đã crawled. Lazy fetch khi component mount + có pageKind.
  const [fieldSamples, setFieldSamples] = useState<Record<string, Array<{ value: string; habitat: string }>>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (isEditMode && editScope && editKey) {
        const rows = await listScope({ scopeKind: editScope, scopeKey: editKey, pageKind });
        if (!cancelled) { setEditRows(rows); setLoading(false); }
      } else if (habitatId != null) {
        const r = await resolveSelectorsForHabitat(habitatId, pageKind);
        if (!cancelled) {
          setResolved(r.resolved);
          setResolvedPlatform(r.platformKey);
          setResolvedTech(r.technologyKey);
          setLoading(false);
        }
      } else {
        const r = await resolveSelectors({
          platformKey: platformKey ?? null,
          technologyKey: technologyKey ?? null,
          pageKind,
        });
        if (!cancelled) {
          setResolved(r);
          setResolvedPlatform(platformKey ?? null);
          setResolvedTech(technologyKey ?? null);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [habitatId, platformKey, technologyKey, editScope, editKey, pageKind, reload, isEditMode]);

  // Fetch sample values từ habitats khác cùng platform — chạy sau khi
  // biết resolvedPlatform (nếu inspect mode) hoặc platformKey (edit mode).
  useEffect(() => {
    let cancelled = false;
    const pf = resolvedPlatform || platformKey || null;
    const schemaKeys = getFieldSchema(pageKind).map((s) => s.key);
    if (schemaKeys.length === 0) return;
    (async () => {
      const samples = await listFieldSamples({
        pageKind, platformKey: pf, fields: schemaKeys,
      });
      if (!cancelled) setFieldSamples(samples);
    })();
    return () => { cancelled = true; };
  }, [resolvedPlatform, platformKey, pageKind, reload]);

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 4000);
  };

  // Override field xuống habitat scope (clone spec từ cascade → habitat tier)
  const handleOverrideToHabitat = async (field: string, currentSpec: SelectorSpec) => {
    if (habitatId == null) return;
    const res = await setOverride({
      scopeKind: 'habitat', scopeKey: String(habitatId),
      pageKind, fieldName: field, spec: currentSpec, source: 'manual',
    });
    if (res.ok) { showMsg(`✓ Override "${field}" tới site scope`); setReload((n) => n + 1); }
    else showMsg(`⚠ ${res.error}`);
  };

  // Promote field từ scope hiện tại → scope rộng hơn
  const handlePromote = async (field: string, fromScope: ScopeKind, fromKey: string, toScope: ScopeKind, toKey: string) => {
    const res = await promoteToScope({ fromScope, fromKey, toScope, toKey, pageKind, fieldName: field });
    if (res.ok) { showMsg(`✓ Promoted "${field}" ${fromScope}→${toScope}`); setReload((n) => n + 1); }
    else showMsg(`⚠ ${res.error}`);
  };

  // Clear override (revert tới scope cha trong cascade)
  const handleClear = async (field: string, scope: ScopeKind, key: string) => {
    const res = await clearOverride({ scopeKind: scope, scopeKey: key, pageKind, fieldName: field });
    if (res.ok) { showMsg(`✓ Cleared "${field}" @ ${scope}`); setReload((n) => n + 1); }
  };

  // Edit cell value (CSS hoặc parse) trong edit mode
  const handleEditCell = async (field: string, newSpec: SelectorSpec) => {
    if (!isEditMode || !editScope || !editKey) return;
    const res = await setOverride({
      scopeKind: editScope, scopeKey: editKey,
      pageKind, fieldName: field, spec: newSpec, source: 'manual',
    });
    if (res.ok) { showMsg(`✓ Saved "${field}"`); setReload((n) => n + 1); }
    else showMsg(`⚠ ${res.error}`);
  };

  const headerTitle = isEditMode
    ? `🔍 Selectors @ ${editScope}:${editKey}`
    : '🔍 Auto-detect selectors (resolved cascade)';

  const rows = isEditMode
    ? editRows
    : Object.entries(resolved).map(([field, rf]) => ({
        field,
        spec: rf.spec,
        source: rf.source.source,
        scope: rf.source.scope,
        scopeKey: rf.source.key,
        updatedAt: rf.source.updated_at,
      }));

  return (
    <div style={{ border: '1px dashed var(--line-2)', borderRadius: 5, padding: 8,
                  background: 'var(--bg-1)', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)',
                         textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {headerTitle}
        </strong>
        <span style={{ padding: '1px 5px', background: 'var(--bg-2)', borderRadius: 3,
                       fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
          {pageKind}
        </span>
        {!isEditMode && resolvedPlatform && (
          <span style={{ fontSize: 9, color: 'var(--fg-4)' }}>
            cascade: site#{habitatId ?? '?'} → platform:{resolvedPlatform}
            {resolvedTech ? ` → engine:${resolvedTech}` : ''}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {actionMsg && (
          <span style={{ fontSize: 10, color: actionMsg.startsWith('⚠') ? 'var(--bad)' : 'var(--ok)' }}>
            {actionMsg}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--fg-3)', padding: 4 }}>Loading…</div>
      ) : (() => {
        // Merge schema (expected fields) với rows hiện có. Field nào chưa
        // có selector → render placeholder row màu xám với hint.
        const schemaFields = getFieldSchema(pageKind);
        const rowsByField = new Map(rows.map((r) => [r.field, r]));
        const allFields = schemaFields.map((s) => ({
          schema: s,
          row: rowsByField.get(s.key) ?? null,
        }));
        // Cũng include row có field không trong schema (LLM tự thêm)
        for (const r of rows) {
          if (!schemaFields.find((s) => s.key === r.field)) {
            allFields.push({ schema: { key: r.field, label: r.field, hint: '' }, row: r });
          }
        }
        if (allFields.length === 0) {
          return (
            <div style={{ color: 'var(--fg-3)', fontStyle: 'italic', padding: 4 }}>
              Chưa có field schema cho page_kind &quot;{pageKind}&quot;.
              Edit @ lib/habitat-field-schema.ts để thêm field expected.
            </div>
          );
        }
        const populatedCount = allFields.filter((f) => f.row).length;
        const missingCount = allFields.length - populatedCount;
        return (
          <>
            <div style={{ fontSize: 9.5, color: 'var(--fg-3)', padding: '2px 4px',
                          background: 'var(--bg-2)', borderRadius: 3, marginBottom: 3,
                          display: 'flex', gap: 8 }}>
              <span><strong style={{ color: 'var(--ok)' }}>{populatedCount}</strong> covered</span>
              {missingCount > 0 && <span><strong style={{ color: 'var(--warn)' }}>{missingCount}</strong> missing</span>}
              {missingCount > 0 && !isEditMode && (
                <span style={{ flex: 1, textAlign: 'right', fontStyle: 'italic' }}>
                  Mở 1 page tương ứng → ext auto LLM learn (~$0.001).
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2,
                          maxHeight: 280, overflowY: 'auto' }}>
              {allFields.map(({ schema, row }) => {
                if (!row) {
                  // Missing row placeholder
                  return (
                    <div key={schema.key} style={{ display: 'grid',
                                                    gridTemplateColumns: '110px 60px 1fr auto auto',
                                                    gap: 6, alignItems: 'center',
                                                    padding: '3px 4px', borderTop: '1px solid var(--line)' }}>
                      <span title={buildFieldTooltip(schema.key, schema, fieldSamples[schema.key] || [])}
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
                                     color: 'var(--fg-1)', fontWeight: 600, cursor: 'help' }}>
                        {schema.key}
                      </span>
                      <span title="Chưa có selector — ext sẽ LLM-learn khi gặp 1 page tương ứng"
                            style={{ padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)',
                                     fontWeight: 700, borderRadius: 3, textAlign: 'center',
                                     background: 'rgba(251,191,36,.18)', color: 'var(--warn)',
                                     border: '1px dashed var(--warn)' }}>
                        none
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--fg-2)',
                                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={schema.hint}>
                        <strong style={{ color: 'var(--fg-1)' }}>{schema.label}</strong>
                        <span style={{ color: 'var(--fg-3)', marginLeft: 6 }}>{schema.hint}</span>
                      </span>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                        {schema.parse ? `→ ${schema.parse}` : ''}
                      </span>
                      <span />
                    </div>
                  );
                }
                return renderResolvedRow(row, schema);
              })}
            </div>
          </>
        );
      })()}
    </div>
  );

  // Render 1 row có selector resolved
  function renderResolvedRow(row: typeof rows[number], schema: { key: string; label: string; hint: string }) {
    const scope = ('scope' in row ? row.scope : editScope) as ScopeKind;
    const scopeKey: string = ('scopeKey' in row ? row.scopeKey as string : editKey) ?? '';
    const meta = SCOPE_META[scope];
    return (
      <div key={row.field} style={{ display: 'grid',
                                     gridTemplateColumns: '110px 60px 1fr auto auto',
                                     gap: 6, alignItems: 'center',
                                     padding: '3px 4px', borderTop: '1px solid var(--line)' }}>
        <span title={buildFieldTooltip(row.field, schema, fieldSamples[row.field] || [])}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
                       color: 'var(--fg-1)', fontWeight: 600, cursor: 'help' }}>
          {row.field}
        </span>
        <span title={`Source: ${row.source} @ ${scope}:${scopeKey}`}
              style={{ padding: '1px 5px', fontSize: 9, fontFamily: 'var(--font-mono)',
                       fontWeight: 700, borderRadius: 3, textAlign: 'center',
                       background: meta.color + '22', color: meta.color,
                       border: `1px solid ${meta.color}66` }}>
          {meta.label}
        </span>
        <code style={{ fontSize: 10, color: 'var(--fg-2)',
                       overflow: 'hidden', textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap', cursor: 'help' }}
              title={buildRowTooltip(row, fieldSamples[row.field] || [])}>
          {row.spec.css}
        </code>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
          {row.spec.parse ? `→ ${row.spec.parse}` : (row.spec.attr ? `@${row.spec.attr}` : '')}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {isEditMode ? (
            <>
              <button type="button"
                      onClick={() => {
                        const newCss = prompt(`Edit CSS for "${row.field}":`, row.spec.css);
                        if (newCss != null && newCss !== row.spec.css) {
                          handleEditCell(row.field, { ...row.spec, css: newCss });
                        }
                      }}
                      title="Edit CSS selector"
                      style={btnSmall}>✎</button>
              <button type="button"
                      onClick={() => {
                        if (confirm(`Delete selector "${row.field}" at ${editScope}:${editKey}?`)) {
                          if (editScope && editKey) handleClear(row.field, editScope, editKey);
                        }
                      }}
                      title="Delete (revert to cascade parent)"
                      style={{ ...btnSmall, color: 'var(--bad)' }}>✕</button>
            </>
          ) : (
            <>
              {habitatId != null && scope !== 'habitat' && (
                <button type="button"
                        onClick={() => handleOverrideToHabitat(row.field, row.spec)}
                        title={`Override "${row.field}" tới site scope (clone hiện tại)`}
                        style={btnSmall}>⤓</button>
              )}
              {scope === 'habitat' && resolvedPlatform && (
                <button type="button"
                        onClick={() => handlePromote(row.field, 'habitat', scopeKey, 'platform', resolvedPlatform)}
                        title={`Promote site → platform:${resolvedPlatform}`}
                        style={btnSmall}>⤴</button>
              )}
              {scope === 'platform' && resolvedTech && (
                <button type="button"
                        onClick={() => handlePromote(row.field, 'platform', scopeKey, 'engine', resolvedTech)}
                        title={`Promote platform → engine:${resolvedTech}`}
                        style={btnSmall}>⤴</button>
              )}
              {scope === 'habitat' && (
                <button type="button"
                        onClick={() => {
                          if (confirm(`Clear "${row.field}" @ site (revert to cascade parent)?`)) {
                            handleClear(row.field, scope, scopeKey);
                          }
                        }}
                        title="Clear site override (revert to platform/engine)"
                        style={{ ...btnSmall, color: 'var(--bad)' }}>✕</button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
}

const btnSmall: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--line)', borderRadius: 3,
  padding: '0 5px', fontSize: 10, color: 'var(--fg-2)', cursor: 'pointer',
  lineHeight: 1.4,
};

// Tooltip builders — hiển thị CSS + notes + sample values từ habitats khác.
function buildRowTooltip(
  row: { spec: SelectorSpec; field: string },
  samples: Array<{ value: string; habitat: string }>,
): string {
  const lines = [row.spec.css];
  if (row.spec.notes) { lines.push('', row.spec.notes); }
  if (samples.length > 0) {
    lines.push('', `── Crawled values (${samples.length}):`);
    for (const s of samples) {
      const v = s.value.length > 80 ? s.value.slice(0, 80) + '…' : s.value;
      lines.push(`  • ${s.habitat}: ${v}`);
    }
  }
  return lines.join('\n');
}

function buildFieldTooltip(
  field: string,
  schema: { hint: string; label: string },
  samples: Array<{ value: string; habitat: string }>,
): string {
  const lines = [`${schema.label || field}`];
  if (schema.hint) lines.push(schema.hint);
  if (samples.length > 0) {
    lines.push('', `Crawled values (${samples.length}):`);
    for (const s of samples) {
      const v = s.value.length > 80 ? s.value.slice(0, 80) + '…' : s.value;
      lines.push(`  • ${s.habitat}: ${v}`);
    }
  } else {
    lines.push('', '(chưa có habitat nào có giá trị cho field này)');
  }
  return lines.join('\n');
}
