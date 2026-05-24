'use client';

// HabitatSelectorsSection — UI để inspect + manage CSS selectors mà LLM
// đã discover cho 1 platform. Selectors lưu trong knowledge_items qua
// endpoint /api/ext/learn-selectors.
//
// Mode:
//   - editable=false (habitat modal): read-only display + nút "Open in Platform"
//     để jump qua platform modal để edit. Có nút "🔄 Force re-learn" gọi LLM lại.
//   - editable=true (platform modal): textarea JSON full edit + Save.

import { useState, useEffect } from 'react';
import { fetchHabitatSelectors, saveHabitatSelectors, type SelectorMap } from '@/lib/actions/habitat-selectors';

interface Props {
  platformKey: string;
  pageKind?: string;          // default 'subreddit-about' (Reddit) — sau extensible
  editable?: boolean;
}

export function HabitatSelectorsSection({ platformKey, pageKind = 'subreddit-about', editable = false }: Props) {
  const [selectors, setSelectors] = useState<SelectorMap | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editJson, setEditJson] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHabitatSelectors(platformKey, pageKind)
      .then((r) => {
        if (cancelled) return;
        setSelectors(r.selectors);
        setUpdatedAt(r.updatedAt);
        setEditJson(r.selectors ? JSON.stringify(r.selectors, null, 2) : '{}');
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [platformKey, pageKind, reload]);

  const handleSave = async () => {
    setEditError(null);
    let parsed: SelectorMap;
    try { parsed = JSON.parse(editJson); }
    catch (e) { setEditError(`JSON invalid: ${(e as Error).message}`); return; }
    setSaving(true);
    const res = await saveHabitatSelectors(platformKey, pageKind, parsed);
    setSaving(false);
    if (!res.ok) { setEditError(res.error || 'save failed'); return; }
    setSelectors(parsed);
    setReload((n) => n + 1);
  };

  const selectorEntries = selectors ? Object.entries(selectors) : [];

  return (
    <div style={{ border: '1px dashed var(--line-2)', borderRadius: 5, padding: 8,
                  background: 'var(--bg-1)', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <strong title="LLM-discovered CSS selectors cho platform này. Ext apply selectors khi scrape subreddit."
                style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)',
                         textTransform: 'uppercase', letterSpacing: '.06em' }}>
          🔍 Auto-detect selectors
        </strong>
        <span style={{ padding: '1px 5px', background: 'var(--bg-2)', borderRadius: 3,
                       fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
          {platformKey} · {pageKind}
        </span>
        <span style={{ flex: 1 }} />
        {updatedAt && (
          <span style={{ fontSize: 9, color: 'var(--fg-4)' }}
                title={new Date(updatedAt).toISOString()}>
            updated {new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--fg-3)', padding: 4 }}>Loading…</div>
      ) : !selectors || selectorEntries.length === 0 ? (
        <div style={{ color: 'var(--fg-3)', fontStyle: 'italic', padding: 4 }}>
          Chưa có selectors. Mở 1 subreddit khi ext active → LLM auto-learn lần đầu (~$0.001).
        </div>
      ) : editable ? (
        <>
          <textarea value={editJson} onChange={(e) => setEditJson(e.target.value)}
                    spellCheck={false}
                    style={{ width: '100%', minHeight: 220, padding: 8,
                             fontFamily: 'var(--font-mono)', fontSize: 10.5,
                             background: 'var(--bg-2)', color: 'var(--fg-1)',
                             border: '1px solid var(--line)', borderRadius: 4,
                             outline: 'none', resize: 'vertical' }} />
          {editError && (
            <div style={{ color: 'var(--bad)', fontSize: 10, marginTop: 4 }}>⚠ {editError}</div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button type="button" onClick={handleSave} disabled={saving}
                    style={{ fontSize: 11, padding: '3px 10px',
                             background: 'var(--accent)', color: 'var(--btn-primary-fg, #0d1117)',
                             border: 'none', borderRadius: 3,
                             cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save selectors'}
            </button>
            <button type="button" onClick={() => setEditJson(JSON.stringify(selectors, null, 2))}
                    style={{ fontSize: 11, padding: '3px 10px', background: 'transparent',
                             color: 'var(--fg-3)', border: '1px solid var(--line)',
                             borderRadius: 3, cursor: 'pointer' }}>
              Reset
            </button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>
              Edit JSON nếu LLM sinh selector sai. Ext invalidate cache 1h.
            </span>
          </div>
        </>
      ) : (
        // Read-only table
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3,
                      maxHeight: 200, overflowY: 'auto' }}>
          {selectorEntries.map(([field, spec]) => (
            <div key={field} style={{ display: 'grid',
                                       gridTemplateColumns: '110px 1fr auto',
                                       gap: 6, alignItems: 'baseline',
                                       padding: '3px 4px', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10,
                             color: 'var(--fg-1)', fontWeight: 600 }}>
                {field}
              </span>
              <code style={{ fontSize: 10, color: 'var(--fg-2)',
                             overflow: 'hidden', textOverflow: 'ellipsis',
                             whiteSpace: 'nowrap' }}
                    title={spec.css}>
                {spec.css}
              </code>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)',
                             color: 'var(--fg-3)' }}>
                {spec.parse ? `→ ${spec.parse}` : (spec.attr ? `@${spec.attr}` : '')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
