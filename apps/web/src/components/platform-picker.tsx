'use client';

// Searchable platform combobox with grouped priorities + inline "Add new platform".
// Replaces native <select> in account form. Scales to 100+ platforms.

import { useState, useRef, useEffect, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlatformRow } from '@/lib/data';
import { createPlatform, type PlatformPriority } from '@/lib/actions/platforms';
import { AIFormParser } from './ai-form-parser';
import { NoFillInput } from './no-fill-input';

const PRIORITY_ORDER: PlatformPriority[] = ['critical', 'high', 'medium', 'low'];
const PRIORITY_META: Record<PlatformPriority, { label: string; color: string; star: string }> = {
  critical: { label: 'CRITICAL', color: 'var(--bad)',        star: '★★★' },
  high:     { label: 'HIGH',     color: 'var(--warn)',       star: '★★'  },
  medium:   { label: 'MEDIUM',   color: 'var(--neon-cyan)',  star: '★'   },
  low:      { label: 'LOW',      color: 'var(--fg-3)',       star: '·'   },
};

interface Props {
  platforms: PlatformRow[];
  value: string;
  onChange: (key: string) => void;
  fld: React.CSSProperties;
}

export function PlatformPicker({ platforms, value, onChange, fld }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = platforms.find((p) => p.key === value);

  // Filter + group
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return platforms;
    return platforms.filter((p) =>
      p.key.toLowerCase().includes(q) ||
      p.label.toLowerCase().includes(q) ||
      p.iconSlug.toLowerCase().includes(q)
    );
  }, [platforms, query]);

  const grouped = useMemo(() => {
    const map = new Map<PlatformPriority, PlatformRow[]>();
    for (const p of filtered) {
      const k = (p.priority as PlatformPriority);
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    return PRIORITY_ORDER.map((k) => ({ priority: k, items: (map.get(k) ?? []).sort((a, b) => a.label.localeCompare(b.label)) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  // Flat list for keyboard nav
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (key: string) => {
    onChange(key);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      setHighlighted((i) => Math.min(flat.length - 1, i + 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlighted((i) => Math.max(0, i - 1));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const it = flat[highlighted];
      if (it) select(it.key);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      e.preventDefault();
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        style={{ ...fld, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 10); }}
      >
        {selected ? (
          <>
            <span style={{ flex: 1, color: 'var(--fg-0)', fontWeight: 600 }}>
              {selected.label}{' '}
              <span style={{ color: PRIORITY_META[selected.priority as PlatformPriority]?.color, fontSize: 11, marginLeft: 4 }}>
                {PRIORITY_META[selected.priority as PlatformPriority]?.star}
              </span>
            </span>
            <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{selected.key}</span>
          </>
        ) : (
          <span style={{ color: 'var(--fg-3)' }}>Chọn platform...</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>▾</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          marginTop: 4,
          background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
          borderRadius: 7, boxShadow: '0 12px 32px rgba(0,0,0,.6)',
          maxHeight: 380, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>
            <NoFillInput
              ref={inputRef as React.Ref<HTMLInputElement>}
              style={{
                width: '100%', padding: '6px 8px',
                background: 'var(--bg-2)', border: '1px solid var(--line)',
                borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none',
              }}
              placeholder={`Search ${platforms.length} platforms...`}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
              onKeyDown={onKeyDown}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {grouped.length === 0 && !adding && (
              <div style={{ padding: 14, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                <div style={{ marginBottom: 8 }}>Không match. Thêm mới?</div>
                <button className="btn primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setAdding(true)}>
                  + Add platform: {query.trim() || '...'}
                </button>
              </div>
            )}

            {grouped.map((g, gi) => (
              <div key={g.priority}>
                <div style={{
                  padding: '4px 10px', fontSize: 9, fontFamily: 'var(--font-mono)',
                  color: PRIORITY_META[g.priority].color, textTransform: 'uppercase',
                  letterSpacing: '0.08em', background: 'var(--bg-2)',
                  borderBottom: '1px solid var(--line)',
                }}>
                  {PRIORITY_META[g.priority].label} <span style={{ opacity: 0.6 }}>· {g.items.length}</span>
                </div>
                {g.items.map((p, idx) => {
                  const flatIdx = grouped.slice(0, gi).reduce((a, b) => a + b.items.length, 0) + idx;
                  const isHL = flatIdx === highlighted;
                  return (
                    <div
                      key={p.key}
                      onMouseEnter={() => setHighlighted(flatIdx)}
                      onClick={() => select(p.key)}
                      style={{
                        padding: '6px 10px', cursor: 'pointer',
                        background: isHL ? 'var(--bg-2)' : (p.key === value ? 'var(--accent-soft)' : 'transparent'),
                        borderLeft: `2px solid ${p.key === value ? 'var(--accent)' : 'transparent'}`,
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                      }}
                    >
                      <span style={{ flex: 1, color: 'var(--fg-1)', fontWeight: p.key === value ? 700 : 400 }}>
                        {p.label}
                      </span>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>{p.key}</span>
                    </div>
                  );
                })}
              </div>
            ))}

            {grouped.length > 0 && query.trim() && !filtered.some((p) => p.label.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                onClick={() => setAdding(true)}
                style={{
                  width: '100%', padding: '8px 10px', fontSize: 11, fontWeight: 600,
                  background: 'transparent', border: 'none', borderTop: '1px solid var(--line)',
                  color: 'var(--neon-violet)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                ✨ Add new platform: <b>{query.trim()}</b>
              </button>
            )}
          </div>
        </div>
      )}

      {adding && <AddPlatformModal initialName={query} onClose={() => setAdding(false)} onCreated={(key) => { onChange(key); setAdding(false); setOpen(false); setQuery(''); }} />}
    </div>
  );
}

// ── Add platform modal ────────────────────────────────────────────
function AddPlatformModal({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (key: string) => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: '',
    label: initialName,
    signupUrl: '',
    postUrl: '',
    priority: 'medium' as PlatformPriority,
    iconSlug: '',
  });
  const setF = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await createPlatform({
        ...form,
        postUrl: form.postUrl || null,
        iconSlug: form.iconSlug || form.key.toLowerCase().replace(/[^a-z0-9]/g, ''),
      });
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      router.refresh();
      onCreated(res.key!);
    });
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 2000 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">NEW PLATFORM</div>
            <h2>+ Add platform to catalog</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <AIFormParser
          context="New platform catalog entry. Parse from website URL, about page, or paste platform description."
          schema={[
            { key: 'label', label: 'Display name (e.g. "Hacker News", "Indie Hackers")' },
            { key: 'key', label: 'Unique slug, lowercase no spaces (e.g. "hackernews", "indiehackers")' },
            { key: 'signupUrl', label: 'Signup/register URL' },
            { key: 'postUrl', label: 'Submit/post URL (where users create posts)' },
            { key: 'priority', label: 'Priority for the project', type: 'enum', enumValues: ['critical', 'high', 'medium', 'low'] },
            { key: 'iconSlug', label: 'Simple Icons slug (lowercase, e.g. "ycombinator", "x", "linkedin")' },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            label: typeof v.label === 'string' ? v.label : f.label,
            key: typeof v.key === 'string' ? v.key : f.key,
            signupUrl: typeof v.signupUrl === 'string' ? v.signupUrl : f.signupUrl,
            postUrl: typeof v.postUrl === 'string' ? v.postUrl : f.postUrl,
            priority: (v.priority as PlatformPriority) || f.priority,
            iconSlug: typeof v.iconSlug === 'string' ? v.iconSlug : f.iconSlug,
          }))}
        />

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <span style={lbl}>Label *</span>
            <NoFillInput style={fld} value={form.label} onChange={(e) => setF('label', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Key (slug) *</span>
            <NoFillInput style={fld} placeholder="auto từ label nếu rỗng"
                         value={form.key} onChange={(e) => setF('key', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Signup URL *</span>
            <NoFillInput style={fld} type="url" placeholder="https://..." value={form.signupUrl} onChange={(e) => setF('signupUrl', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Post URL <span style={{ color: 'var(--fg-4)' }}>(optional)</span></span>
            <NoFillInput style={fld} type="url" placeholder="https://...submit" value={form.postUrl} onChange={(e) => setF('postUrl', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Priority</span>
            <select style={fld} value={form.priority} onChange={(e) => setF('priority', e.target.value as PlatformPriority)}>
              <option value="critical">★★★ critical</option>
              <option value="high">★★ high</option>
              <option value="medium">★ medium</option>
              <option value="low">· low</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Icon slug <span style={{ color: 'var(--fg-4)' }}>(simpleicons.org)</span></span>
            <NoFillInput style={fld} placeholder="auto từ key nếu rỗng"
                         value={form.iconSlug} onChange={(e) => setF('iconSlug', e.target.value.toLowerCase())} />
          </div>
        </div>

        <div className="modal-foot">
          <div className="meta">Adds to platforms catalog (shared across projects)</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
