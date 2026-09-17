// Root loading boundary. Without a loading.tsx, App Router blocks the whole
// navigation on the destination page's server render (0.3–2.6s here) showing
// ZERO feedback — the browser sits on the old tab, so every tab switch feels
// frozen. This Suspense fallback makes the transition instant: the nav shell
// (root layout) stays, and the content area shows this skeleton immediately
// while the page streams in. Covers every top-level tab that has no closer
// loading.tsx of its own.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ padding: '1.5rem 1.75rem' }}>
      <style>{`@keyframes mos2pulse{0%,100%{opacity:.55}50%{opacity:1}}`}</style>
      {/* header line */}
      <div
        style={{
          height: 28, width: '32%', maxWidth: 320, borderRadius: 8,
          background: 'var(--surface-2, rgba(148,163,184,0.16))',
          animation: 'mos2pulse 1.1s ease-in-out infinite', marginBottom: 20,
        }}
      />
      {/* stat row */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 72, flex: '1 1 140px', minWidth: 120, borderRadius: 12,
              background: 'var(--surface-2, rgba(148,163,184,0.12))',
              animation: 'mos2pulse 1.1s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}
      </div>
      {/* table rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 40, borderRadius: 8, marginBottom: 10,
            background: 'var(--surface-2, rgba(148,163,184,0.10))',
            animation: 'mos2pulse 1.1s ease-in-out infinite',
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}
