'use client';

// Searchable platform combobox with grouped priorities + inline "Add new platform".
// Replaces native <select> in account form. Scales to 100+ platforms.

import { useState, useRef, useEffect, useMemo, useCallback, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { PlatformRow } from '@/lib/data';
import { createPlatform, archivePlatform, type PlatformPriority } from '@/lib/actions/platforms';
import { AIFormParser } from './ai-form-parser';
import { NoFillInput } from './no-fill-input';
import { ExternalLink } from './external-link';
import { LinkChip, IconCommunity, SiteFavicon } from './ui';
import { searchHabitatsAcrossProjects } from '@/lib/actions/tribes-crud';

// ISO country code → flag emoji (regional indicator pairs)
function flag(code: string | null | undefined): string {
  if (!code || code.toLowerCase() === 'global') return '🌍';
  if (code.length !== 2) return '';
  const cc = code.toUpperCase();
  return String.fromCodePoint(0x1F1E6 + cc.charCodeAt(0) - 65, 0x1F1E6 + cc.charCodeAt(1) - 65);
}

const CATEGORY_ICON: Record<string, string> = {
  community: '🗣', social: '🔗', video: '🎬', blog: '📝', launch: '🚀',
  marketplace: '🛒', messaging: '💬', newsletter: '📧', design: '🎨',
  audio: '🎵', other: '🗂',
};

// Filter internal/system tags out of user-facing display.
// Keep user/admin-meaningful tags only.
function visibleTags(tags?: string[]): string[] {
  if (!tags) return [];
  return tags.filter((t) => !t.startsWith('directus-id:') && t !== 'directus-sync' && !t.startsWith('type:'));
}

export function PlatformInfoCard({ p, onArchive }: {
  p: { key: string; label: string; description?: string; pricing?: string | null; region?: string | null; category?: string; userCountEstimate?: string | null; signupUrl: string; postUrl?: string | null; tags?: string[] };
  onArchive?: (archive: boolean) => void;
}) {
  if (!p.description && !p.pricing && !p.region) return null;
  const tags = visibleTags(p.tags);
  const isArchived = p.tags?.includes('archived') ?? false;
  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--bg-2)', border: `1px solid ${isArchived ? 'var(--warn)' : 'var(--line)'}`,
      borderRadius: 5, fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.45,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {p.category && <span style={{ fontSize: 14 }}>{CATEGORY_ICON[p.category] ?? '🗂'}</span>}
        <span style={{ fontWeight: 700, color: isArchived ? 'var(--warn)' : 'var(--fg-0)' }}>
          {isArchived && <span style={{ fontSize: 9, marginRight: 4, fontFamily: 'var(--font-mono)' }}>[DEFUNCT]</span>}
          {p.label}
        </span>
        {p.region && <span style={{ fontSize: 13 }} title={p.region}>{flag(p.region)}</span>}
        <span style={{ flex: 1 }} />
        <LinkChip href={p.signupUrl} onClick={(e) => e.stopPropagation()}>↗ signup</LinkChip>
        {p.postUrl && <LinkChip href={p.postUrl} onClick={(e) => e.stopPropagation()}>↗ post</LinkChip>}
        {onArchive && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onArchive(!isArchived); }}
            title={isArchived ? 'Khôi phục platform (bỏ ẩn)' : 'Đánh dấu defunct — platform không còn tồn tại nữa. Sẽ bị ẩn khỏi picker.'}
            style={{
              padding: '2px 7px', fontSize: 9.5, fontFamily: 'var(--font-mono)',
              background: isArchived ? 'var(--accent-soft)' : 'rgba(255,200,0,.08)',
              color: isArchived ? 'var(--accent)' : 'var(--warn)',
              border: `1px solid ${isArchived ? 'var(--accent-line)' : 'rgba(255,200,0,.3)'}`,
              borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {isArchived ? '↺ Restore' : '🗃 Defunct'}
          </button>
        )}
      </div>
      {p.description && <div style={{ marginBottom: 4 }}>{p.description}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
        {p.pricing && <span>💰 {p.pricing}</span>}
        {p.userCountEstimate && <span>👥 {p.userCountEstimate}</span>}
        {p.category && <span>· {p.category}</span>}
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-1)', color: t === 'archived' ? 'var(--warn)' : 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>#{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const PRIORITY_ORDER: PlatformPriority[] = ['critical', 'high', 'medium', 'low'];
const PRIORITY_META: Record<PlatformPriority, { label: string; color: string; star: string }> = {
  critical: { label: 'CRITICAL', color: 'var(--bad)',        star: '★★★' },
  high:     { label: 'HIGH',     color: 'var(--warn)',       star: '★★'  },
  medium:   { label: 'MEDIUM',   color: 'var(--accent)',     star: '★'   },
  low:      { label: 'LOW',      color: 'var(--fg-3)',       star: '·'   },
};

interface Props {
  platforms: PlatformRow[];
  value: string;
  onChange: (key: string) => void;
  fld: React.CSSProperties;
}

export function PlatformPicker({ platforms, value, onChange, fld }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  // When opening AddPlatformModal from a habitat suggestion, prefill name+url.
  const [addingPrefill, setAddingPrefill] = useState<{ name: string; url: string } | null>(null);
  // Cross-system habitat hits — surface communities not yet wired as platforms.
  const [habitatHints, setHabitatHints] = useState<Array<{ id: number; name: string; url: string | null; kind: string; projectName: string }>>([]);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Dropdown is rendered via portal to escape modal overflow:hidden — position
  // fixed-coords relative to trigger. Recompute on open + window scroll/resize.
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number; flipUp: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // Hover tooltip — show platform info card only on demand instead of
  // always-rendering it below the trigger (it was bulky in account modal).
  // Use a 150ms leave-delay so the user can move from trigger → card to click
  // signup/post links without the tooltip disappearing mid-way.
  const [infoHover, setInfoHover] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onInfoEnter = useCallback(() => {
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
    setInfoHover(true);
  }, []);
  const onInfoLeave = useCallback(() => {
    leaveTimerRef.current = setTimeout(() => setInfoHover(false), 150);
  }, []);

  useEffect(() => {
    if (!open) { setDropdownRect(null); return; }
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const desired = 380;
      const flipUp = spaceBelow < 200 && r.top > spaceBelow;
      setDropdownRect({
        top: flipUp ? Math.max(8, r.top - desired - 4) : r.bottom + 4,
        left: r.left,
        width: r.width,
        flipUp,
      });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open]);

  const selected = platforms.find((p) => p.key === value);

  // Separate archived from active platforms
  const activePlatforms = useMemo(() => platforms.filter((p) => !((p.tags as string[]) ?? []).includes('archived')), [platforms]);
  const archivedPlatforms = useMemo(() => platforms.filter((p) => ((p.tags as string[]) ?? []).includes('archived')), [platforms]);

  // Filter + group — always search active; archived shown only when toggled
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = showArchived ? platforms : activePlatforms;
    if (!q) return pool;
    return pool.filter((p) =>
      p.key.toLowerCase().includes(q) ||
      p.label.toLowerCase().includes(q) ||
      p.iconSlug.toLowerCase().includes(q)
    );
  }, [platforms, activePlatforms, query, showArchived]);

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

  // Close on outside click — dropdown is portal'd so check both trigger
  // (inside the form) and dropdown (in document.body).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(t) ?? false;
      const insideDropdown = wrapperRef.current?.contains(t) ?? false;
      if (!insideTrigger && !insideDropdown) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Cross-project habitat suggestions — when user query has nothing in
  // platforms catalog, surface communities (Lyso, r/x, FB groups...) so
  // they can 1-click create a platform from that community's name+url.
  useEffect(() => {
    const ql = query.trim();
    if (!open || ql.length < 2) { setHabitatHints([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      searchHabitatsAcrossProjects(ql, 8).then((rows) => {
        if (cancelled) return;
        setHabitatHints(rows.map((r) => ({
          id: r.id, name: r.name, url: r.url, kind: r.kind, projectName: r.projectName,
        })));
      });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open]);

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
    <div style={{ position: 'relative' }}>
      <div
        ref={triggerRef}
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

      {open && dropdownRect && mounted && createPortal(
        <div ref={wrapperRef} style={{
          position: 'fixed',
          top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width,
          zIndex: 10000,
          background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
          borderRadius: 7, boxShadow: '0 12px 32px rgba(0,0,0,.6)',
          maxHeight: 380, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 6, borderBottom: '1px solid var(--line)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <NoFillInput
              ref={inputRef as React.Ref<HTMLInputElement>}
              style={{
                flex: 1, padding: '6px 8px',
                background: 'var(--bg-2)', border: '1px solid var(--line)',
                borderRadius: 5, color: 'var(--fg-0)', fontSize: 12, outline: 'none',
              }}
              placeholder={`Search ${platforms.length} platforms...`}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
              onKeyDown={onKeyDown}
            />
            <button type="button"
                    onClick={() => setAdding(true)}
                    title="Tạo platform mới"
                    style={{
                      flexShrink: 0, padding: '5px 10px', fontSize: 11, fontWeight: 600,
                      background: 'var(--accent)', color: 'var(--btn-primary-fg, #0d1117)',
                      border: '1px solid var(--accent)', borderRadius: 5,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
              + New
            </button>
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
                      <SiteFavicon iconSlug={p.iconSlug} url={p.signupUrl || p.postUrl} size={15}
                        glyph={p.region ? flag(p.region) : (p.category && CATEGORY_ICON[p.category]) || '🗂'} title={p.label} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--fg-1)', fontWeight: p.key === value ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.label}
                        </div>
                        {p.description && (
                          <div style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.description}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>{p.key}</span>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Cross-system community suggestions — when user query matches
                a habitat that isn't yet a platform, offer 1-click create. */}
            {habitatHints.length > 0 && (
              <div>
                <div style={{
                  padding: '4px 10px', fontSize: 9, fontFamily: 'var(--font-mono)',
                  color: 'var(--accent)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', background: 'var(--accent-soft)',
                  borderBottom: '1px solid var(--accent-line)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <IconCommunity size={11} />
                  <span>From communities — click to create platform</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ opacity: 0.6 }}>{habitatHints.length}</span>
                </div>
                {habitatHints.map((h) => (
                  <div key={`hint-${h.id}`}
                       onClick={() => {
                         setAddingPrefill({ name: h.name, url: h.url ?? '' });
                         setAdding(true);
                       }}
                       style={{
                         padding: '6px 10px', cursor: 'pointer',
                         display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                         borderBottom: '1px dashed var(--line)',
                       }}>
                    <IconCommunity size={13} color="var(--accent)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--fg-1)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {h.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        📁 {h.projectName} · {h.kind}{h.url ? ` · ${(() => { try { return new URL(h.url).hostname; } catch { return h.url; } })()}` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>+ create</span>
                  </div>
                ))}
              </div>
            )}

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
            {archivedPlatforms.length > 0 && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                style={{
                  width: '100%', padding: '6px 10px', fontSize: 10, fontWeight: 500,
                  background: 'transparent', border: 'none', borderTop: '1px solid var(--line)',
                  color: 'var(--warn)', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {showArchived ? '▴ Hide archived' : `▾ Show ${archivedPlatforms.length} archived (defunct)`}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}

      {adding && <AddPlatformModal initialName={addingPrefill?.name ?? query} initialUrl={addingPrefill?.url ?? ''} onClose={() => { setAdding(false); setAddingPrefill(null); }} onCreated={(key) => { onChange(key); setAdding(false); setAddingPrefill(null); setOpen(false); setQuery(''); }} />}

      {selected && !open && (
        <div
          style={{ marginTop: 4, position: 'relative', display: 'inline-block' }}
          onMouseEnter={onInfoEnter}
          onMouseLeave={onInfoLeave}>
          <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
            ⓘ Platform info <span style={{ opacity: 0.6 }}>(hover)</span>
          </span>
          {infoHover && (
            <div
              onMouseEnter={onInfoEnter}
              onMouseLeave={onInfoLeave}
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4,
                minWidth: 320, maxWidth: 480, zIndex: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,.5)',
              }}>
              <PlatformInfoCard
                p={selected}
                onArchive={(archive) => {
                  archivePlatform(selected.key, archive).then(() => router.refresh());
                  setInfoHover(false);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add platform modal ────────────────────────────────────────────
function AddPlatformModal({ initialName, initialUrl = '', onClose, onCreated }: { initialName: string; initialUrl?: string; onClose: () => void; onCreated: (key: string) => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    key: '',
    label: initialName,
    signupUrl: initialUrl,
    postUrl: '',
    priority: 'medium' as PlatformPriority,
    iconSlug: '',
    description: '',
    pricing: '',
    region: '',
    category: 'other',
    userCountEstimate: '',
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
        pricing: form.pricing || null,
        region: form.region || null,
        category: form.category as import('@/lib/actions/platforms').PlatformCategory,
        userCountEstimate: form.userCountEstimate || null,
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
          currentValues={form}
          context="New platform catalog entry. Parse from website URL, about/pricing page, or paste platform description."
          schema={[
            { key: 'label', label: 'Display name (e.g. "Hacker News", "Indie Hackers")' },
            { key: 'key', label: 'Unique slug, lowercase no spaces (e.g. "hackernews")' },
            { key: 'signupUrl', label: 'Signup/register URL' },
            { key: 'postUrl', label: 'Submit/post URL (where users create posts)' },
            { key: 'priority', label: 'Priority for the project', type: 'enum', enumValues: ['critical', 'high', 'medium', 'low'] },
            { key: 'iconSlug', label: 'Simple Icons slug (lowercase, e.g. "ycombinator")' },
            { key: 'description', label: 'Short 1-2 sentence description of the platform — what it does, audience, USP' },
            { key: 'pricing', label: 'Pricing summary (e.g. "Free", "Free + Pro $9/mo")' },
            { key: 'region', label: 'ISO 2-letter country code or "global" (e.g. US, VN, IN, global)' },
            { key: 'category', label: 'Category', type: 'enum', enumValues: ['community', 'social', 'video', 'blog', 'launch', 'marketplace', 'messaging', 'newsletter', 'design', 'audio', 'other'] },
            { key: 'userCountEstimate', label: 'User count estimate (e.g. "1B MAU", "5M users")' },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            label: typeof v.label === 'string' ? v.label : f.label,
            key: typeof v.key === 'string' ? v.key : f.key,
            signupUrl: typeof v.signupUrl === 'string' ? v.signupUrl : f.signupUrl,
            postUrl: typeof v.postUrl === 'string' ? v.postUrl : f.postUrl,
            priority: (v.priority as PlatformPriority) || f.priority,
            iconSlug: typeof v.iconSlug === 'string' ? v.iconSlug : f.iconSlug,
            description: typeof v.description === 'string' ? v.description : f.description,
            pricing: typeof v.pricing === 'string' ? v.pricing : f.pricing,
            region: typeof v.region === 'string' ? v.region : f.region,
            category: typeof v.category === 'string' ? v.category : f.category,
            userCountEstimate: typeof v.userCountEstimate === 'string' ? v.userCountEstimate : f.userCountEstimate,
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
          <div style={{ gridColumn: '1 / 3' }}>
            <span style={lbl}>Description <span style={{ color: 'var(--fg-4)' }}>(1-2 sentences)</span></span>
            <textarea style={{ ...fld, minHeight: 50, fontFamily: 'inherit', resize: 'vertical' }}
                      placeholder="Forum tech VN, ML-driven FYP, B2B-focused..."
                      value={form.description} onChange={(e) => setF('description', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Category</span>
            <select style={fld} value={form.category} onChange={(e) => setF('category', e.target.value)}>
              {['community', 'social', 'video', 'blog', 'launch', 'marketplace', 'messaging', 'newsletter', 'design', 'audio', 'other'].map((c) => (
                <option key={c} value={c}>{CATEGORY_ICON[c]} {c}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={lbl}>Region <span style={{ color: 'var(--fg-4)' }}>(ISO-2 hoặc "global")</span></span>
            <NoFillInput style={fld} placeholder="US, VN, global..."
                         value={form.region} onChange={(e) => setF('region', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Pricing</span>
            <NoFillInput style={fld} placeholder="Free / $9/mo..."
                         value={form.pricing} onChange={(e) => setF('pricing', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>User count <span style={{ color: 'var(--fg-4)' }}>(estimate)</span></span>
            <NoFillInput style={fld} placeholder="1B MAU, 5M users..."
                         value={form.userCountEstimate} onChange={(e) => setF('userCountEstimate', e.target.value)} />
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
