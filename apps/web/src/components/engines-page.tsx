'use client';

// EnginesPage — admin view to inspect + manage forum/CMS engine selectors.
// Per engine (xenforo, vbulletin, discourse…): the selector_overrides at
// engine scope (view/edit/delete via HabitatSelectorsSection editScope=engine),
// the signup-field defaults, and which platforms + habitats inherit this engine.
// Route: /engines.

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { HabitatSelectorsSection } from './habitat-selectors-section';
import type { TechnologyWithUsage } from '@/lib/actions/technologies';

// page_kind → human label (matches the switcher inside HabitatSelectorsSection).
const PK_META: Record<string, { label: string; color: string }> = {
  signup: { label: 'signup', color: 'var(--neon-amber)' },
  composer: { label: 'composer', color: 'var(--neon-cyan)' },
  'subreddit-about': { label: 'about', color: 'var(--neon-violet)' },
};

function pkMeta(pk: string) {
  return PK_META[pk] ?? { label: pk, color: 'var(--fg-3)' };
}

export function EnginesPage({ engines }: { engines: TechnologyWithUsage[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('e');
  });

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

  const totalSel = engines.reduce(
    (a, e) => a + Object.values(e.selectorCounts).reduce((x, y) => x + y, 0), 0,
  );

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚙ Engines
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-3)' }}>
            {engines.length} engines · {totalSel} engine-scope selectors
          </span>
        </h1>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
          Selector defaults inherited by every platform + habitat on this engine
          (3-tier cascade: habitat &gt; platform &gt; engine). Edit here = applies to
          all sites running this engine unless overridden at a narrower scope.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {engines.map((e) => {
          const isOpen = open === e.key;
          const selPks = Object.entries(e.selectorCounts).sort();
          const selTotal = selPks.reduce((a, [, n]) => a + n, 0);
          return (
            <div key={e.key} style={{
              border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden',
              background: 'var(--bg-1)',
            }}>
              {/* ── Header ── */}
              <button type="button" onClick={() => toggle(e.key)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: isOpen ? 'var(--bg-2)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit',
              }}>
                <span style={{ fontSize: 11, color: 'var(--fg-3)', width: 12 }}>{isOpen ? '▾' : '▸'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{e.label}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{e.key}</span>
                  </div>
                  {e.description && (
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</div>
                  )}
                </div>
                {/* selector page_kind badges */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {selTotal === 0 ? (
                    <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>no selectors</span>
                  ) : selPks.map(([pk, n]) => {
                    const m = pkMeta(pk);
                    return (
                      <span key={pk} title={`${n} ${m.label} selectors`} style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 5,
                        border: `1px solid ${m.color}`, color: m.color,
                      }}>{m.label} {n}</span>
                    );
                  })}
                </div>
                {/* usage counts */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, fontSize: 11, color: 'var(--fg-2)' }}>
                  <span title="platforms on this engine">🌐 {e.platforms.length}</span>
                  <span title="habitats on this engine">◍ {e.habitats.length}</span>
                </div>
              </button>

              {/* ── Body ── */}
              {isOpen && (
                <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--line)' }}>
                  {/* Applied by */}
                  <Section title="Applied by">
                    {e.platforms.length === 0 && e.habitats.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>No platform or habitat is linked to this engine yet.</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {e.platforms.map((p) => (
                          <Link key={p.key} href="/platforms" title={`Platform · ${p.key}`} style={chip('var(--neon-violet)')}>
                            🌐 {p.label}
                          </Link>
                        ))}
                        {e.habitats.map((h) => (
                          <Link key={h.id} href={`/p/${h.projectId}/tribes`} title={`Habitat #${h.id} · ${h.projectId}`} style={chip('var(--neon-cyan)')}>
                            ◍ {h.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </Section>

                  {/* Signup field defaults (engine) */}
                  {e.signupFields.length > 0 && (
                    <Section title={`Signup field defaults (${e.signupFields.length})`}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {e.signupFields.map((f) => (
                          <span key={f.key} title={[f.type, f.required ? 'required' : 'optional', f.notes].filter(Boolean).join(' · ')} style={{
                            fontSize: 11, padding: '2px 7px', borderRadius: 5,
                            border: '1px solid var(--line)', color: 'var(--fg-2)',
                            display: 'inline-flex', gap: 4, alignItems: 'center',
                          }}>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{f.key}</span>
                            {f.required && <span style={{ color: 'var(--bad)' }}>*</span>}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Selector editor — reuse the 3-tier section in engine edit mode */}
                  <Section title="Selectors (engine scope)">
                    <HabitatSelectorsSection editScope="engine" editKey={e.key} pageKind="signup" />
                  </Section>
                </div>
              )}
            </div>
          );
        })}
        {engines.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>
            No engines yet. Add one from a Platform’s “Technology engine” section.
          </div>
        )}
      </div>
    </div>
  );
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
  return {
    fontSize: 11, padding: '3px 8px', borderRadius: 6,
    border: `1px solid ${color}`, color, textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };
}
