'use client';

// EnginesPage — admin view to inspect + manage forum/CMS engine selectors.
// Per engine (xenforo, vbulletin, discourse…): the selector_overrides at
// engine scope (view/edit/delete via HabitatSelectorsSection editScope=engine),
// the signup-field defaults, which platforms + habitats inherit the engine,
// and a duplicate-field detector with one-click merge. Route: /engines.

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { HabitatSelectorsSection } from './habitat-selectors-section';
import { NoFillInput } from './no-fill-input';
import { mergeSelectorField, type DupGroup } from '@/lib/actions/habitat-selectors';
import type { TechnologyWithUsage } from '@/lib/actions/technologies';

const PK_META: Record<string, { label: string; color: string }> = {
  signup: { label: 'signup', color: 'var(--neon-amber)' },
  composer: { label: 'composer', color: 'var(--neon-cyan)' },
  'subreddit-about': { label: 'about', color: 'var(--neon-violet)' },
};
const pkMeta = (pk: string) => PK_META[pk] ?? { label: pk, color: 'var(--fg-3)' };

const APPLIED_CAP = 10;

export function EnginesPage({ engines, dups }: { engines: TechnologyWithUsage[]; dups: DupGroup[] }) {
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('e');
  });

  // engine key → its duplicate groups
  const dupsByEngine = useMemo(() => {
    const m = new Map<string, DupGroup[]>();
    for (const d of dups) (m.get(d.scopeKey) ?? m.set(d.scopeKey, []).get(d.scopeKey)!).push(d);
    return m;
  }, [dups]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return engines;
    return engines.filter((e) =>
      e.key.toLowerCase().includes(s) ||
      e.label.toLowerCase().includes(s) ||
      e.platforms.some((p) => p.label.toLowerCase().includes(s) || p.key.toLowerCase().includes(s)) ||
      e.habitats.some((h) => h.name.toLowerCase().includes(s)),
    );
  }, [engines, q]);

  const toggle = (key: string) => {
    const next = open === key ? null : key;
    setOpen(next);
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (next) p.set('e', next); else p.delete('e');
      const qs = p.toString();
      window.history.replaceState({}, '', qs ? `${pathname}?${qs}` : pathname);
    }
  };

  const totalSel = engines.reduce((a, e) => a + Object.values(e.selectorCounts).reduce((x, y) => x + y, 0), 0);
  const totalDups = dups.length;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚙ Engines
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-3)' }}>
            {engines.length} engines · {totalSel} engine-scope selectors
            {totalDups > 0 && <span style={{ color: 'var(--warn)' }}> · ⚠ {totalDups} duplicate{totalDups > 1 ? 's' : ''}</span>}
          </span>
        </h1>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
          Selector defaults inherited by every platform + habitat on this engine
          (cascade: habitat &gt; platform &gt; engine). Edit here = applies to all
          sites on the engine unless overridden at a narrower scope.
        </p>
      </div>

      <div style={{ marginBottom: 10 }}>
        <NoFillInput
          type="search"
          placeholder="Search engine · platform · habitat…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', maxWidth: 360, fontSize: 13, padding: '6px 10px',
                   border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((e) => (
          <EngineCard
            key={e.key} engine={e} isOpen={open === e.key}
            onToggle={() => toggle(e.key)} dups={dupsByEngine.get(e.key) ?? []}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>
            {engines.length === 0 ? 'No engines yet.' : `No engine matches “${q}”.`}
          </div>
        )}
      </div>
    </div>
  );
}

function EngineCard({ engine: e, isOpen, onToggle, dups }: {
  engine: TechnologyWithUsage; isOpen: boolean; onToggle: () => void; dups: DupGroup[];
}) {
  const selPks = Object.entries(e.selectorCounts).sort();
  const selTotal = selPks.reduce((a, [, n]) => a + n, 0);
  return (
    <div style={{ border: `1px solid ${dups.length ? 'var(--warn)' : 'var(--line)'}`, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-1)' }}>
      <button type="button" onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        background: isOpen ? 'var(--bg-2)' : 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left', color: 'inherit',
      }}>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', width: 12 }}>{isOpen ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{e.label}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{e.key}</span>
            {dups.length > 0 && (
              <span title={`${dups.length} duplicate field group(s)`} style={{ fontSize: 10, color: 'var(--warn)' }}>⚠ {dups.length} dup</span>
            )}
          </div>
          {e.description && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {selTotal === 0 ? (
            <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>no selectors</span>
          ) : selPks.map(([pk, n]) => {
            const m = pkMeta(pk);
            return <span key={pk} title={`${n} ${m.label} selectors`} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, border: `1px solid ${m.color}`, color: m.color }}>{m.label} {n}</span>;
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, fontSize: 11, color: 'var(--fg-2)' }}>
          <span title="platforms on this engine">🌐 {e.platforms.length}</span>
          <span title="habitats on this engine">◍ {e.habitats.length}</span>
        </div>
      </button>

      {isOpen && (
        <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--line)' }}>
          {dups.length > 0 && <DupPanel engineKey={e.key} dups={dups} />}

          <Section title="Applied by">
            <AppliedBy engine={e} />
          </Section>

          {e.signupFields.length > 0 && (
            <Section title={`Signup field defaults (${e.signupFields.length})`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {e.signupFields.map((f) => (
                  <span key={f.key} title={[f.type, f.required ? 'required' : 'optional', f.notes].filter(Boolean).join(' · ')} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, border: '1px solid var(--line)', color: 'var(--fg-2)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{f.key}</span>
                    {f.required && <span style={{ color: 'var(--bad)' }}>*</span>}
                  </span>
                ))}
              </div>
            </Section>
          )}

          <Section title="Selectors (engine scope)">
            <HabitatSelectorsSection editScope="engine" editKey={e.key} pageKind="signup" />
          </Section>
        </div>
      )}
    </div>
  );
}

function AppliedBy({ engine: e }: { engine: TechnologyWithUsage }) {
  const [expanded, setExpanded] = useState(false);
  const all = [
    ...e.platforms.map((p) => ({ kind: 'platform' as const, id: p.key, label: p.label, href: '/platforms', title: `Platform · ${p.key}` })),
    ...e.habitats.map((h) => ({ kind: 'habitat' as const, id: `h${h.id}`, label: h.name, href: `/p/${h.projectId}/tribes`, title: `Habitat #${h.id} · ${h.projectId}` })),
  ];
  if (all.length === 0) return <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>No platform or habitat linked yet.</span>;
  const shown = expanded ? all : all.slice(0, APPLIED_CAP);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {shown.map((it) => (
        <Link key={it.id} href={it.href} title={it.title} style={chip(it.kind === 'platform' ? 'var(--neon-violet)' : 'var(--neon-cyan)')}>
          {it.kind === 'platform' ? '🌐' : '◍'} {it.label}
        </Link>
      ))}
      {all.length > APPLIED_CAP && (
        <button type="button" onClick={() => setExpanded((v) => !v)} style={{ ...chip('var(--fg-3)'), cursor: 'pointer', background: 'transparent' }}>
          {expanded ? 'show less' : `+${all.length - APPLIED_CAP} more`}
        </button>
      )}
    </div>
  );
}

function DupPanel({ engineKey, dups }: { engineKey: string; dups: DupGroup[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const merge = (g: DupGroup, keep: string) => {
    const drop = g.fields.map((f) => f.field).filter((f) => f !== keep);
    setBusy(g.on);
    start(async () => {
      await mergeSelectorField({ scopeKind: 'engine', scopeKey: engineKey, pageKind: g.pageKind, keep, drop });
      setBusy(null);
      router.refresh();
    });
  };

  return (
    <div style={{ marginTop: 10, border: '1px solid var(--warn)', borderRadius: 8, padding: 10, background: 'color-mix(in srgb, var(--warn) 8%, transparent)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warn)', marginBottom: 6 }}>
        ⚠ {dups.length} duplicate field group{dups.length > 1 ? 's' : ''} — pick the field to keep
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dups.map((g) => (
          <div key={`${g.pageKind}:${g.on}`} style={{ fontSize: 11 }}>
            <div style={{ color: 'var(--fg-3)', marginBottom: 3 }}>
              <span style={{ ...pkBadge(g.pageKind) }}>{pkMeta(g.pageKind).label}</span>{' '}
              {g.reason === 'same-css' ? <>same selector <code style={codeSty}>{g.on}</code></> : <>names fold to <code style={codeSty}>{g.on}</code></>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.fields.map((f) => {
                const isKeep = f.field === g.suggestedKeep;
                return (
                  <button key={f.field} type="button" disabled={pending}
                    onClick={() => merge(g, f.field)}
                    title={`Keep “${f.field}” (${f.source}) · ${f.css} — delete the others`}
                    style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: pending ? 'wait' : 'pointer',
                      border: `1px solid ${isKeep ? 'var(--ok)' : 'var(--line)'}`,
                      color: isKeep ? 'var(--ok)' : 'var(--fg-2)', background: 'var(--bg-1)',
                      display: 'inline-flex', gap: 5, alignItems: 'center',
                    }}>
                    {busy === g.on && pending ? '⏳' : '✓ keep'}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{f.field}</span>
                    <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>{f.source}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const codeSty: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-2)', padding: '0 4px', borderRadius: 3 };
function pkBadge(pk: string): React.CSSProperties {
  const m = pkMeta(pk);
  return { fontSize: 9, padding: '1px 5px', borderRadius: 4, border: `1px solid ${m.color}`, color: m.color, fontFamily: 'var(--font-mono)' };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-3)', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function chip(color: string): React.CSSProperties {
  return { fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `1px solid ${color}`, color, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 };
}
