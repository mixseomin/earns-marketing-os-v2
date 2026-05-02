'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  type PlatformWithUsage, type PlatformPriority,
  createPlatform, updatePlatform, deletePlatform,
} from '@/lib/actions/platforms';
import { AIFormParser } from './ai-form-parser';
import { NoFillInput } from './no-fill-input';
import { ExternalLink } from './external-link';

const PRIORITY_ORDER: PlatformPriority[] = ['critical', 'high', 'medium', 'low'];
const PRIORITY_META: Record<PlatformPriority, { label: string; color: string; star: string }> = {
  critical: { label: 'CRITICAL', color: 'var(--bad)',       star: '★★★' },
  high:     { label: 'HIGH',     color: 'var(--warn)',      star: '★★'  },
  medium:   { label: 'MEDIUM',   color: 'var(--neon-cyan)', star: '★'   },
  low:      { label: 'LOW',      color: 'var(--fg-3)',      star: '·'   },
};

function useUrlParam(key: string, def: string): [string, (v: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(key) ?? def;
  const set = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (!v || v === def) next.delete(key); else next.set(key, v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [value, set];
}

export function PlatformsPage({ platforms }: { platforms: PlatformWithUsage[] }) {
  const [q, setQ] = useUrlParam('q', '');
  const [priorityFilter, setPriorityFilter] = useUrlParam('p', 'all');
  const [editing, setEditing] = useState<PlatformWithUsage | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return platforms.filter((p) => {
      if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
      if (!ql) return true;
      return p.key.toLowerCase().includes(ql) ||
             p.label.toLowerCase().includes(ql) ||
             p.iconSlug.toLowerCase().includes(ql);
    });
  }, [platforms, q, priorityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<PlatformPriority, PlatformWithUsage[]>();
    for (const p of filtered) {
      const arr = map.get(p.priority) ?? [];
      arr.push(p);
      map.set(p.priority, arr);
    }
    return PRIORITY_ORDER.map((k) => ({ priority: k, items: (map.get(k) ?? []).sort((a, b) => a.label.localeCompare(b.label)) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const counts = {
    total: platforms.length,
    inUse: platforms.filter((p) => p.accountsCount > 0).length,
    unused: platforms.filter((p) => p.accountsCount === 0).length,
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🌐 Platforms
            <small>// {counts.total} catalog · {counts.inUse} in use · {counts.unused} unused</small>
          </h1>
          <p className="page-sub">
            Catalog dùng chung cross-project. Account vault link tới platform key. Add platform để lập tài khoản trên đó.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setCreating(true)}>+ New platform</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <NoFillInput
          style={{
            padding: '6px 10px', minWidth: 280,
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
          }}
          placeholder="Search platform..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', ...PRIORITY_ORDER] as const).map((p) => (
            <button key={p} className="btn"
              data-active={priorityFilter === p || undefined}
              onClick={() => setPriorityFilter(p)}
              style={{
                fontSize: 11, padding: '4px 10px',
                background: priorityFilter === p ? 'var(--accent-soft)' : 'transparent',
                color: p === 'all' ? 'var(--fg-1)' : (PRIORITY_META[p as PlatformPriority]?.color),
                border: `1px solid ${priorityFilter === p ? 'var(--accent)' : 'var(--line)'}`,
                borderRadius: 4, cursor: 'pointer',
              }}>
              {p === 'all' ? 'All' : PRIORITY_META[p as PlatformPriority].star + ' ' + PRIORITY_META[p as PlatformPriority].label.toLowerCase()}
              <span style={{ opacity: 0.6, marginLeft: 4 }}>
                {p === 'all' ? platforms.length : platforms.filter((x) => x.priority === p).length}
              </span>
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          {filtered.length} match
        </span>
      </div>

      {grouped.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
          <p style={{ margin: '0 0 12px', fontSize: 13 }}>Không match. Thêm platform mới?</p>
          <button className="btn primary" onClick={() => setCreating(true)}>+ Add platform</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grouped.map((g) => (
            <div key={g.priority}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: PRIORITY_META[g.priority].color, textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>{PRIORITY_META[g.priority].star} {PRIORITY_META[g.priority].label}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span style={{ opacity: 0.6 }}>{g.items.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                {g.items.map((p) => (
                  <div key={p.key} className="panel"
                       style={{ padding: '10px 12px', cursor: 'pointer' }}
                       onClick={() => setEditing(p)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {p.label}
                      </span>
                      {p.accountsCount > 0 ? (
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ok)', padding: '1px 5px', border: '1px solid var(--ok)', borderRadius: 3 }}>
                          {p.accountsCount} acc
                        </span>
                      ) : (
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>unused</span>
                      )}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                      {p.key} · icon: {p.iconSlug}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 10 }}>
                      <ExternalLink href={p.signupUrl} onClick={(e) => e.stopPropagation()}
                                    style={{ color: 'var(--accent)', textDecoration: 'none' }}>↗ signup</ExternalLink>
                      {p.postUrl && (
                        <ExternalLink href={p.postUrl} onClick={(e) => e.stopPropagation()}
                                      style={{ color: 'var(--accent)', textDecoration: 'none' }}>↗ post</ExternalLink>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <PlatformFormModal
          platform={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function PlatformFormModal({ platform, onClose }: { platform: PlatformWithUsage | null; onClose: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isCreate = !platform;
  const [form, setForm] = useState({
    key: platform?.key ?? '',
    label: platform?.label ?? '',
    signupUrl: platform?.signupUrl ?? '',
    postUrl: platform?.postUrl ?? '',
    priority: (platform?.priority ?? 'medium') as PlatformPriority,
    iconSlug: platform?.iconSlug ?? '',
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
      const payload = { ...form, postUrl: form.postUrl || null };
      const res = isCreate ? await createPlatform(payload) : await updatePlatform(platform!.key, payload);
      if (!res.ok) { setError(res.error || 'Lưu thất bại'); return; }
      router.refresh();
      onClose();
    });
  };
  const handleDelete = () => {
    if (!platform) return;
    if (!confirm(`Xóa platform "${platform.label}"? Không thể undo.`)) return;
    startTransition(async () => {
      const res = await deletePlatform(platform.key);
      if (!res.ok) { setError(res.error || 'Xóa thất bại'); return; }
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{platform?.key ?? 'NEW PLATFORM'}</div>
            <h2>{isCreate ? '+ New platform' : `Edit ${platform!.label}`}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ padding: '8px 14px', background: 'rgba(255,77,94,.08)', borderBottom: '1px solid rgba(255,77,94,.3)', color: 'var(--bad)', fontSize: 12 }}>⚠ {error}</div>}

        <AIFormParser
          context="Platform catalog entry. Parse from website URL, About page, or paste platform description."
          schema={[
            { key: 'label', label: 'Display name (e.g. "Hacker News")' },
            { key: 'key', label: 'Unique slug, lowercase no spaces (e.g. "hackernews")' },
            { key: 'signupUrl', label: 'Signup/register URL' },
            { key: 'postUrl', label: 'Submit/post URL where users create posts' },
            { key: 'priority', label: 'Priority for the project', type: 'enum', enumValues: ['critical', 'high', 'medium', 'low'] },
            { key: 'iconSlug', label: 'Simple Icons slug (lowercase, e.g. "ycombinator", "x")' },
          ]}
          onApply={(v) => setForm((f) => ({
            ...f,
            label: typeof v.label === 'string' ? v.label : f.label,
            key: !platform && typeof v.key === 'string' ? v.key : f.key,
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
            <span style={lbl}>Key (slug) {isCreate ? '*' : ''}</span>
            <NoFillInput style={fld} disabled={!isCreate} placeholder="auto từ label nếu rỗng"
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
              {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_META[p].star} {PRIORITY_META[p].label.toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Icon slug <span style={{ color: 'var(--fg-4)' }}>(simpleicons.org)</span></span>
            <NoFillInput style={fld} placeholder="auto từ key"
                         value={form.iconSlug} onChange={(e) => setF('iconSlug', e.target.value.toLowerCase())} />
          </div>
        </div>

        <div className="modal-foot">
          <div className="meta">
            {platform ? `${platform.accountsCount} accounts · added globally` : 'Adds to platforms catalog (shared across projects)'}
          </div>
          <div className="modal-foot-actions">
            {!isCreate && platform!.accountsCount === 0 && (
              <button className="btn danger" onClick={handleDelete}>🗑 Delete</button>
            )}
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={save}>{isCreate ? 'Create' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
