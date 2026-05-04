'use client';

// Design System Playground
// ─────────────────────────
// Live editor + showcase for every design token + every shared `ui/` primitive.
// Edits write to localStorage `mos.design-tokens` keyed by theme. They apply
// via document.documentElement.style.setProperty so the entire app reflects
// the change while you tune. "Reset" wipes overrides for the active theme.
//
// Editable groups:
//   - Surfaces:  bg-0..bg-4, fg-0..fg-4, line / line-2 / line-strong
//   - Accent:    accent (resolves to neon-blue), accent-soft, accent-line
//   - Neon:      neon-blue / cyan / lime / amber / pink / violet / red
//   - Semantic:  ok / warn / bad / info
//   - Buttons:   per-variant fg + bg + border (default / primary / danger / success)
//
// Read-only display: spacing scale, radii, typography stack.

import { useEffect, useMemo, useState } from 'react';
import {
  Pill, PriorityPill, EffortPill, EmptyState, StatsStrip,
  Spinner, LinkChip, Segmented, CTACard,
} from './ui';

type Theme = 'dark' | 'light';

interface TokenDef {
  name: string;            // CSS var name without --
  label: string;
  group: TokenGroup;
}
type TokenGroup = 'surface' | 'accent' | 'neon' | 'semantic' | 'btn-default' | 'btn-primary' | 'btn-danger' | 'btn-success';

const TOKENS: TokenDef[] = [
  // Surface
  { name: 'bg-0', label: 'BG 0 (page)',         group: 'surface' },
  { name: 'bg-1', label: 'BG 1 (card)',         group: 'surface' },
  { name: 'bg-2', label: 'BG 2 (input)',        group: 'surface' },
  { name: 'bg-3', label: 'BG 3 (hover)',        group: 'surface' },
  { name: 'bg-4', label: 'BG 4 (active)',       group: 'surface' },
  { name: 'fg-0', label: 'FG 0 (heading)',      group: 'surface' },
  { name: 'fg-1', label: 'FG 1 (body)',         group: 'surface' },
  { name: 'fg-2', label: 'FG 2 (label)',        group: 'surface' },
  { name: 'fg-3', label: 'FG 3 (muted)',        group: 'surface' },
  { name: 'fg-4', label: 'FG 4 (placeholder)',  group: 'surface' },
  { name: 'line',         label: 'Line (border)',     group: 'surface' },
  { name: 'line-2',       label: 'Line 2 (hover)',    group: 'surface' },
  { name: 'line-strong',  label: 'Line strong',       group: 'surface' },

  // Accent
  { name: 'accent',       label: 'Accent (= neon-blue)',  group: 'accent' },
  { name: 'accent-soft',  label: 'Accent soft (bg)',      group: 'accent' },
  { name: 'accent-line',  label: 'Accent line (border)',  group: 'accent' },

  // Neon palette
  { name: 'neon-blue',    label: 'Neon Blue',    group: 'neon' },
  { name: 'neon-cyan',    label: 'Neon Cyan',    group: 'neon' },
  { name: 'neon-lime',    label: 'Neon Lime',    group: 'neon' },
  { name: 'neon-amber',   label: 'Neon Amber',   group: 'neon' },
  { name: 'neon-pink',    label: 'Neon Pink',    group: 'neon' },
  { name: 'neon-violet',  label: 'Neon Violet',  group: 'neon' },
  { name: 'neon-red',     label: 'Neon Red',     group: 'neon' },

  // Semantic
  { name: 'ok',    label: 'OK (= lime)',    group: 'semantic' },
  { name: 'warn',  label: 'Warn (= amber)', group: 'semantic' },
  { name: 'bad',   label: 'Bad (= red)',    group: 'semantic' },
  { name: 'info',  label: 'Info (= cyan)',  group: 'semantic' },

  // Button: default
  { name: 'btn-fg',        label: 'Default · text',     group: 'btn-default' },
  { name: 'btn-bg',        label: 'Default · bg',       group: 'btn-default' },
  { name: 'btn-border',    label: 'Default · border',   group: 'btn-default' },
  { name: 'btn-hover-bg',  label: 'Default · hover bg', group: 'btn-default' },

  // Button: primary
  { name: 'btn-primary-fg',     label: 'Primary · text',    group: 'btn-primary' },
  { name: 'btn-primary-bg',     label: 'Primary · bg',      group: 'btn-primary' },
  { name: 'btn-primary-border', label: 'Primary · border',  group: 'btn-primary' },

  // Button: danger
  { name: 'btn-danger-fg',     label: 'Danger · text',     group: 'btn-danger' },
  { name: 'btn-danger-bg',     label: 'Danger · bg',       group: 'btn-danger' },
  { name: 'btn-danger-border', label: 'Danger · border',   group: 'btn-danger' },

  // Button: success
  { name: 'btn-success-fg',     label: 'Success · text',    group: 'btn-success' },
  { name: 'btn-success-bg',     label: 'Success · bg',      group: 'btn-success' },
  { name: 'btn-success-border', label: 'Success · border',  group: 'btn-success' },
];

const GROUP_META: Record<TokenGroup, { label: string; hint: string }> = {
  surface:      { label: 'Surface',          hint: 'bg / fg / line ladder' },
  accent:       { label: 'Accent',           hint: 'primary brand color' },
  neon:         { label: 'Neon Palette',     hint: 'underlying hues for accent + semantic' },
  semantic:     { label: 'Semantic',         hint: 'status colors (resolve to neon-*)' },
  'btn-default':{ label: 'Button · Default', hint: '.btn (no modifier)' },
  'btn-primary':{ label: 'Button · Primary', hint: '.btn.primary' },
  'btn-danger': { label: 'Button · Danger',  hint: '.btn.danger' },
  'btn-success':{ label: 'Button · Success', hint: '.btn.success' },
};

const STORAGE_KEY = 'mos.design-tokens';

type Overrides = Record<Theme, Record<string, string>>;
const EMPTY: Overrides = { dark: {}, light: {} };

function readStored(): Overrides {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch { return EMPTY; }
}

function applyOverrides(ov: Overrides, theme: Theme) {
  const root = document.documentElement.style;
  for (const t of TOKENS) root.removeProperty(`--${t.name}`);
  const map = ov[theme] || {};
  for (const [name, val] of Object.entries(map)) {
    if (val) root.setProperty(`--${name}`, val);
  }
}

function readComputedColor(name: string): string {
  if (typeof window === 'undefined') return '#000000';
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  if (v.startsWith('#') && (v.length === 7 || v.length === 4)) return v.length === 4 ? expandShort(v) : v;
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (m && m[1]) {
    const parts = m[1].split(',').map((s) => Number(s.trim()));
    if (parts.length >= 3) return rgbToHex(parts[0]!, parts[1]!, parts[2]!);
  }
  return '#000000';
}
function expandShort(short: string) {
  const r = short[1], g = short[2], b = short[3];
  return `#${r}${r}${g}${g}${b}${b}`;
}
function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

const SPACING = ['s-1', 's-2', 's-3', 's-4', 's-5', 's-6'];
const RADII = ['r-sm', 'r-md', 'r-lg', 'r-xl'];

export function DesignSystemPlayground() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [overrides, setOverrides] = useState<Overrides>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [reading, setReading] = useState(0);
  const [activeGroup, setActiveGroup] = useState<TokenGroup>('accent');

  useEffect(() => {
    const initial = readStored();
    setOverrides(initial);
    const themeAttr = (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
    setTheme(themeAttr);
    applyOverrides(initial, themeAttr);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute('data-theme', theme);
    applyOverrides(overrides, theme);
    setReading((n) => n + 1);
  }, [theme, overrides, hydrated]);

  const persist = (next: Overrides) => {
    setOverrides(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };
  const updateToken = (name: string, value: string) => {
    persist({ ...overrides, [theme]: { ...overrides[theme], [name]: value } });
  };
  const resetToken = (name: string) => {
    const m = { ...overrides[theme] }; delete m[name];
    persist({ ...overrides, [theme]: m });
  };
  const resetAll = () => persist({ ...overrides, [theme]: {} });
  const resetEverything = () => persist(EMPTY);

  const exportCss = useMemo(() => {
    if (!hydrated) return '';
    const map = overrides[theme] || {};
    if (Object.keys(map).length === 0) return `/* no overrides for ${theme} */`;
    const selector = theme === 'light' ? 'html[data-theme="light"]' : ':root';
    const lines = Object.entries(map).map(([n, v]) => `  --${n}: ${v};`).join('\n');
    return `${selector} {\n${lines}\n}`;
  }, [overrides, theme, hydrated]);

  const overrideCount = (overrides[theme] || {}) ? Object.keys(overrides[theme] || {}).length : 0;

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto', background: 'var(--bg-0)', color: 'var(--fg-0)' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🎨 Design System</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-3)', fontSize: 12 }}>
            Edit tokens live. Switch theme. Copy CSS back to <code>globals.css</code>.
            {overrideCount > 0 && <> · <strong style={{ color: 'var(--accent)' }}>{overrideCount} override{overrideCount === 1 ? '' : 's'} on {theme}</strong></>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Segmented
            value={theme}
            onChange={(t) => setTheme(t as Theme)}
            options={[
              { value: 'dark',  label: '🌙 Dark' },
              { value: 'light', label: '☀ Light' },
            ]}
          />
          <button type="button" onClick={resetAll} className="btn"
                  title={`Clear all token overrides for ${theme} mode`}>
            ↺ Reset {theme}
          </button>
          <button type="button" onClick={resetEverything} className="btn danger"
                  title="Wipe overrides for BOTH themes">
            ⚠ Reset all
          </button>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 380px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── LEFT: Token editor ───────────────────────── */}
        <aside style={{ position: 'sticky', top: 0, padding: 12, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, maxHeight: 'calc(100vh - 32px)', overflow: 'auto' }}>
          {/* Group tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, marginBottom: 10 }}>
            {(Object.keys(GROUP_META) as TokenGroup[]).map((g) => {
              const count = (overrides[theme] || {}) ? TOKENS.filter((t) => t.group === g && t.name in (overrides[theme] || {})).length : 0;
              return (
                <button key={g} type="button"
                        onClick={() => setActiveGroup(g)}
                        style={{
                          padding: '5px 8px', fontSize: 10.5, fontWeight: 600,
                          background: activeGroup === g ? 'var(--accent-soft)' : 'transparent',
                          color: activeGroup === g ? 'var(--accent)' : 'var(--fg-2)',
                          border: `1px solid ${activeGroup === g ? 'var(--accent-line)' : 'var(--line)'}`,
                          borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                        }}>
                  {GROUP_META[g].label}
                  {count > 0 && <span style={{ marginLeft: 4, padding: '0 4px', fontSize: 9, background: 'var(--accent)', color: 'var(--bg-0)', borderRadius: 8 }}>{count}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginBottom: 8, padding: '0 2px' }}>{GROUP_META[activeGroup].hint}</div>
          {TOKENS.filter((t) => t.group === activeGroup).map((t) => (
            <TokenRow key={t.name + reading + theme} token={t} themeMap={overrides[theme] || {}} onChange={updateToken} onReset={resetToken} />
          ))}

          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Export CSS · {theme}
            </div>
            <textarea readOnly value={exportCss}
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      style={{
                        width: '100%', minHeight: 90, padding: 8, fontSize: 10.5, fontFamily: 'var(--font-mono)',
                        background: 'var(--bg-2)', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 6,
                        resize: 'vertical', outline: 'none',
                      }} />
            <p style={{ fontSize: 10, color: 'var(--fg-3)', margin: '6px 0 0' }}>
              Click → select all → copy → paste into <code>apps/web/src/app/globals.css</code>.
            </p>
          </div>
        </aside>

        {/* ── RIGHT: Showcase ──────────────────────────── */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ShowcaseSection title="Surfaces — bg + fg ladder">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {(['bg-0','bg-1','bg-2','bg-3','bg-4'] as const).map((b) => (
                <div key={b} style={{ padding: 10, background: `var(--${b})`, border: '1px solid var(--line)', borderRadius: 6, fontSize: 11 }}>
                  <code style={{ color: 'var(--fg-3)', fontSize: 10 }}>--{b}</code>
                  <div style={{ color: 'var(--fg-0)', fontWeight: 600, marginTop: 4 }}>fg-0 heading</div>
                  <div style={{ color: 'var(--fg-1)' }}>fg-1 body</div>
                  <div style={{ color: 'var(--fg-2)' }}>fg-2 label</div>
                  <div style={{ color: 'var(--fg-3)' }}>fg-3 muted</div>
                  <div style={{ color: 'var(--fg-4)' }}>fg-4 placeholder</div>
                </div>
              ))}
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="Buttons — every variant in every state">
            <ButtonShowcase label="Default (.btn)" cls="" />
            <ButtonShowcase label="Primary (.btn.primary)" cls="primary" />
            <ButtonShowcase label="Ghost (.btn.ghost)" cls="ghost" />
            <ButtonShowcase label="Danger (.btn.danger)" cls="danger" />
            <ButtonShowcase label="Success (.btn.success)" cls="success" />
          </ShowcaseSection>

          <ShowcaseSection title="Pill — status / priority / category badges">
            <Row>
              <Pill color="var(--accent)" label="ACCENT" />
              <Pill color="var(--ok)"     label="OK"     />
              <Pill color="var(--warn)"   label="WARN"   />
              <Pill color="var(--bad)"    label="BAD"    />
              <Pill color="var(--info)"   label="INFO"   />
              <Pill color="var(--neon-pink)"   label="PINK"   />
              <Pill color="var(--neon-violet)" label="VIOLET" />
            </Row>
            <Row>
              <Pill color="var(--accent)" label="solid" tone="solid" />
              <Pill color="var(--accent)" label="soft"  tone="soft"  />
              <Pill color="var(--accent)" label="ghost" tone="ghost" />
            </Row>
            <Row>
              <PriorityPill priority="critical" />
              <PriorityPill priority="high" />
              <PriorityPill priority="medium" />
              <PriorityPill priority="low" />
              <EffortPill effort="XS" />
              <EffortPill effort="S" />
              <EffortPill effort="M" />
              <EffortPill effort="L" />
              <EffortPill effort="XL" />
            </Row>
          </ShowcaseSection>

          <ShowcaseSection title="LinkChip — inline external link pills">
            <Row>
              <LinkChip href="https://example.com">↗ signup</LinkChip>
              <LinkChip href="https://example.com">↗ post</LinkChip>
              <LinkChip href="https://example.com" tone="success">↗ live</LinkChip>
              <LinkChip href="https://example.com" tone="warn">↗ pending</LinkChip>
              <LinkChip href="https://example.com" tone="danger">↗ blocked</LinkChip>
              <LinkChip href="https://example.com" tone="neutral">↗ docs</LinkChip>
            </Row>
            <Row>
              <LinkChip href="https://example.com" size="xs">↗ xs</LinkChip>
              <LinkChip href="https://example.com" size="sm">↗ sm</LinkChip>
            </Row>
          </ShowcaseSection>

          <ShowcaseSection title="Segmented — 1-of-N picker">
            <SegmentedDemo />
          </ShowcaseSection>

          <ShowcaseSection title="Spinner — inline pending indicator">
            <Row>
              <Stat><Spinner size="xs" /> xs</Stat>
              <Stat><Spinner size="sm" /> sm</Stat>
              <Stat><Spinner size="md" /> md</Stat>
              <Stat><Spinner size="sm" color="var(--ok)" /> ok</Stat>
              <Stat><Spinner size="sm" color="var(--bad)" /> bad</Stat>
              <Stat><Spinner size="sm" color="var(--warn)" /> warn</Stat>
            </Row>
          </ShowcaseSection>

          <ShowcaseSection title="CTACard — large call-to-action box">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560 }}>
              <CTACard href="https://example.com" title="Tạo account trên Product Hunt"
                       subtitle="Mở signup page → đăng ký xong → cập nhật handle" />
              <CTACard href="https://example.com" tone="success"
                       title="Account đã active" subtitle="Bắt đầu post" />
              <CTACard href="https://example.com" tone="warn"
                       title="Cần verify email" subtitle="Check inbox" />
              <CTACard href="https://example.com" tone="danger"
                       title="Account bị ban" subtitle="Tạo account mới?" />
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="EmptyState">
            <div style={{ maxWidth: 560 }}>
              <EmptyState icon="📭" title="Không có account nào"
                          description="Tạo account đầu tiên để bắt đầu đăng ký các platform."
                          action={<button type="button" className="btn primary">+ New account</button>} />
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="StatsStrip — KPI counters">
            <StatsStrip cards={[
              { key: 'total',   label: 'Total',   value: 42, color: 'var(--fg-1)' },
              { key: 'active',  label: 'Active',  value: 31, color: 'var(--ok)' },
              { key: 'pending', label: 'Pending', value: 8,  color: 'var(--warn)' },
              { key: 'blocked', label: 'Blocked', value: 3,  color: 'var(--bad)' },
            ]} />
          </ShowcaseSection>

          <ShowcaseSection title="Typography">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--fg-0)' }}>Display 28 / Space Grotesk · 700</div>
              <div style={{ fontFamily: 'var(--font-sans)',    fontSize: 18, fontWeight: 700, color: 'var(--fg-0)' }}>H1 18 / Inter · 700</div>
              <div style={{ fontFamily: 'var(--font-sans)',    fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>H2 14 / Inter · 600</div>
              <div style={{ fontFamily: 'var(--font-sans)',    fontSize: 13, fontWeight: 400, color: 'var(--fg-1)' }}>Body 13 / Inter · 400 — The quick brown fox jumps over the lazy dog.</div>
              <div style={{ fontFamily: 'var(--font-sans)',    fontSize: 11, fontWeight: 500, color: 'var(--fg-2)' }}>Label 11 / Inter · 500</div>
              <div style={{ fontFamily: 'var(--font-mono)',    fontSize: 11, color: 'var(--fg-3)' }}>Mono 11 / JetBrains Mono — abc123 → 0.789</div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="Spacing & Radii (read-only)">
            <Row>
              {SPACING.map((s) => (
                <div key={s} style={{ textAlign: 'center', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                  <div style={{ width: `var(--${s})`, height: 'var(--s-4)', background: 'var(--accent)', margin: '0 auto 4px', borderRadius: 2 }} />
                  --{s}
                </div>
              ))}
            </Row>
            <Row>
              {RADII.map((r) => (
                <div key={r} style={{ textAlign: 'center', fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                  <div style={{ width: 44, height: 28, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', margin: '0 auto 4px', borderRadius: `var(--${r})` }} />
                  --{r}
                </div>
              ))}
            </Row>
          </ShowcaseSection>
        </main>
      </div>
    </div>
  );
}

function ShowcaseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: 12, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </section>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>{children}</div>;
}
function Stat({ children }: { children: React.ReactNode }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-2)' }}>{children}</span>;
}

function ButtonShowcase({ label, cls }: { label: string; cls: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, alignItems: 'center' }}>
      <code style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{label}</code>
      <Row>
        <button type="button" className={`btn ${cls}`}>Action</button>
        <button type="button" className={`btn ${cls}`} disabled style={{ opacity: 0.5 }}>Disabled</button>
        <button type="button" className={`btn ${cls}`}>With <Spinner size="xs" /></button>
        <button type="button" className={`btn ${cls}`}>↗ icon</button>
      </Row>
    </div>
  );
}

function SegmentedDemo() {
  const [v, setV] = useState<number>(0);
  return (
    <Segmented value={v} onChange={setV} options={[
      { value: 0, label: '1', title: 'Primary' },
      { value: 1, label: '2', title: 'Alt 1' },
      { value: 2, label: '3', title: 'Alt 2' },
      { value: 3, label: '4', title: 'Alt 3' },
    ]} />
  );
}

function TokenRow({
  token, themeMap, onChange, onReset,
}: {
  token: TokenDef;
  themeMap: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onReset: (name: string) => void;
}) {
  const overridden = token.name in themeMap;
  const value = themeMap[token.name] ?? readComputedColor(token.name);
  const pickerValue = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 18px', gap: 5, alignItems: 'center', marginBottom: 5 }}>
      <input type="color" value={pickerValue} onChange={(e) => onChange(token.name, e.target.value)}
             style={{ width: 28, height: 24, padding: 0, border: '1px solid var(--line)', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}
             title={`--${token.name}`} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <input type="text" value={value} onChange={(e) => onChange(token.name, e.target.value)} spellCheck={false}
               style={{
                 width: '100%', padding: '3px 6px',
                 background: overridden ? 'var(--accent-soft)' : 'var(--bg-2)',
                 color: 'var(--fg-0)',
                 border: `1px solid ${overridden ? 'var(--accent-line)' : 'var(--line)'}`,
                 borderRadius: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)', outline: 'none',
               }} />
        <span style={{ fontSize: 9.5, color: 'var(--fg-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          --{token.name} · {token.label}
        </span>
      </div>
      {overridden ? (
        <button type="button" onClick={() => onReset(token.name)}
                style={{ width: 18, height: 18, padding: 0, fontSize: 11, background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                title="Reset to default">↺</button>
      ) : <span />}
    </div>
  );
}
