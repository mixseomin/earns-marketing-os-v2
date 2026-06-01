'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { Spinner, IconCommunity, SiteFavicon } from './ui';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  syncPlatformsFromDirectus,
  type PlatformWithUsage, type PlatformPriority,
} from '@/lib/actions/platforms';
import { searchHabitatsAcrossProjects } from '@/lib/actions/tribes-crud';
import Link from 'next/link';
import { TagsFilterChips } from './tags-input';
import { NoFillInput } from './no-fill-input';
import { PlatformFormModal } from './platform-form-modal';
import { LinkChip } from './ui';

const PRIORITY_ORDER: PlatformPriority[] = ['critical', 'high', 'medium', 'low'];
const PRIORITY_META: Record<PlatformPriority, { label: string; color: string; star: string }> = {
  critical: { label: 'CRITICAL', color: 'var(--bad)',       star: '★★★' },
  high:     { label: 'HIGH',     color: 'var(--warn)',      star: '★★'  },
  medium:   { label: 'MEDIUM',   color: 'var(--accent)',    star: '★'   },
  low:      { label: 'LOW',      color: 'var(--fg-3)',      star: '·'   },
};

// Shallow URL sync — uses window.history.replaceState so the URL stays
// shareable/F5-able without triggering Next.js RSC roundtrip on every click.
// Local state is the source of truth so filter UI is instant. URL update
// is fire-and-forget side effect.
function useUrlParam(key: string, def: string): [string, (v: string) => void] {
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get(key) ?? def;
  const [value, setValue] = useState(initial);
  const set = (v: string) => {
    setValue(v);
    if (typeof window === 'undefined') return;
    const next = new URLSearchParams(window.location.search);
    if (!v || v === def) next.delete(key); else next.set(key, v);
    const qs = next.toString();
    window.history.replaceState({}, '', qs ? `${pathname}?${qs}` : pathname);
  };
  return [value, set];
}

export function PlatformsPage({ platforms }: { platforms: PlatformWithUsage[] }) {
  const [qUrl, setQUrl] = useUrlParam('q', '');
  // Local state for input — instant UI feedback. Sync to URL after 300ms debounce.
  const [q, setQ] = useState(qUrl);
  useEffect(() => {
    if (q === qUrl) return;
    const t = setTimeout(() => setQUrl(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const [priorityFilter, setPriorityFilter] = useUrlParam('p', 'all');
  const [tagsFilterStr, setTagsFilterStr] = useUrlParam('tags', '');
  const tagsFilter = useMemo(() => tagsFilterStr.split(',').filter(Boolean), [tagsFilterStr]);
  const setTagsFilter = (next: string[]) => setTagsFilterStr(next.join(','));

  // Aggregate tag pool + counts from all platforms (for filter chips)
  const tagPool = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of platforms) {
      for (const t of p.tags ?? []) counts[t] = (counts[t] ?? 0) + 1;
    }
    return { all: Object.keys(counts).sort((a, b) => counts[b]! - counts[a]!), counts };
  }, [platforms]);
  const [editing, setEditing] = useState<PlatformWithUsage | null>(null);
  const [creating, setCreating] = useState(false);

  // Deep-link từ ext: ?m=edit&mId=<platformKey> → mở thẳng modal edit platform đó.
  const deepParams = useSearchParams();
  useEffect(() => {
    if (deepParams.get('m') !== 'edit') return;
    const k = deepParams.get('mId');
    if (!k) return;
    const p = platforms.find((x) => x.key === k);
    if (p) setEditing(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-project habitat matches — surface communities (Lyso, r/astrology,
  // FB groups…) when user searches. Helps users who don't know a community
  // is project-scoped, not platform-catalog. Debounced 250ms.
  const [habitatMatches, setHabitatMatches] = useState<Array<Awaited<ReturnType<typeof searchHabitatsAcrossProjects>>[number]>>([]);
  useEffect(() => {
    const ql = q.trim();
    if (ql.length < 2) { setHabitatMatches([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      searchHabitatsAcrossProjects(ql, 20).then((rows) => {
        if (!cancelled) setHabitatMatches(rows);
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return platforms.filter((p) => {
      if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
      if (tagsFilter.length > 0) {
        const ptags = p.tags ?? [];
        if (!tagsFilter.every((t) => ptags.includes(t))) return false;
      }
      if (!ql) return true;
      // Match name/key only — description match was too noisy ("ly" matched
      // every "Daily product launches" / "Pre-launch" etc).
      return p.key.toLowerCase().includes(ql) ||
             p.label.toLowerCase().includes(ql) ||
             p.iconSlug.toLowerCase().includes(ql);
    });
  }, [platforms, q, priorityFilter, tagsFilter]);

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
          <SyncDirectusPlatformsButton />
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

      <TagsFilterChips
        allTags={tagPool.all}
        counts={tagPool.counts}
        selected={tagsFilter}
        onChange={setTagsFilter}
      />

      {grouped.length === 0 && habitatMatches.length === 0 ? (
        <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌐</div>
          <p style={{ margin: '0 0 12px', fontSize: 13 }}>Không match. Thêm platform mới?</p>
          <button className="btn primary" onClick={() => setCreating(true)}>+ Add platform</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Habitat matches first when search active — same visual style as
              priority groups, just labeled "COMMUNITIES". */}
          {habitatMatches.length > 0 && q.trim().length >= 2 && (
            <div>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: 'var(--accent)', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <IconCommunity size={12} />
                <span>COMMUNITIES (habitats cross-project)</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span style={{ opacity: 0.6 }}>{habitatMatches.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                {habitatMatches.map((h) => (
                  <Link key={`h${h.id}`}
                        href={`/p/${h.projectId}/tribes?habitat=${h.id}`}
                        className="panel"
                        style={{ display: 'block', padding: '10px 12px', textDecoration: 'none', color: 'var(--fg-0)', cursor: 'pointer', borderLeft: '3px solid var(--accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <IconCommunity size={14} color="var(--accent)" title="Community / habitat" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {h.name}
                      </span>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', padding: '1px 5px', background: 'var(--bg-3)', borderRadius: 3 }}>
                        {h.kind}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.4, marginBottom: 4 }}>
                      📁 {h.projectName}{h.tribeName ? ` · ◍ ${h.tribeName}` : ''}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {h.platformLabel && <span>🌐 {h.platformLabel}</span>}
                      {h.members > 0 && <span>· 👥 {h.members.toLocaleString()}</span>}
                      {h.url && <span>· {new URL(h.url).hostname}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
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
                      <SiteFavicon iconSlug={p.iconSlug} url={p.signupUrl || p.postUrl} size={15} title={p.label} />
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
                    {p.description && (
                      <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.4, marginTop: 2, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.description}
                      </div>
                    )}
                    <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.region && <span title={p.region}>{p.region === 'global' ? '🌍' : p.region}</span>}
                      {p.category && p.category !== 'other' && <span>· {p.category}</span>}
                      {p.pricing && <span>· {p.pricing}</span>}
                      {p.userCountEstimate && <span>· {p.userCountEstimate}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <LinkChip href={p.signupUrl} size="xs" onClick={(e) => e.stopPropagation()}>↗ signup</LinkChip>
                      {p.postUrl && <LinkChip href={p.postUrl} size="xs" onClick={(e) => e.stopPropagation()}>↗ post</LinkChip>}
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

// One-click sync platforms catalog from Directus accounts.platform values.
// Idempotent — only inserts NEW keys, never overwrites admin edits.
function SyncDirectusPlatformsButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; existed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setBusy(true); setError(null); setResult(null);
    startTransition(async () => {
      const res = await syncPlatformsFromDirectus();
      setBusy(false);
      if (!res.ok) { setError(res.error ?? 'sync failed'); return; }
      setResult({ created: res.created, existed: res.alreadyExisted });
      setTimeout(() => setResult(null), 5000);
      router.refresh();
    });
  };

  return (
    <button type="button" className="btn"
            onClick={handleClick} disabled={busy}
            title="Pull all distinct platforms from as.on.tc Directus accounts. Idempotent — keys đã có không bị overwrite."
            style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {busy
        ? <><Spinner size="xs" /> Syncing</>
        : result
          ? <span style={{ color: 'var(--ok)' }}>✓ +{result.created} new ({result.existed} existed)</span>
          : error
            ? <span style={{ color: 'var(--bad)' }} title={error}>⚠ Sync failed</span>
            : <>↓ Sync from Directus</>}
    </button>
  );
}

