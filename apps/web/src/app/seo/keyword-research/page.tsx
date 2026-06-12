import { KeywordResearchClient } from './client';

export const dynamic = 'force-dynamic';

export default function KeywordResearchPage() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'baseline', gap: 12 }}>
          Keyword Research
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 400, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            // BING WEBMASTER · GetKeywordStats · 24 months history
          </small>
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', margin: '4px 0 0' }}>
          Free Bing keyword volume. Exact = exact-match impressions, Broad = includes variations + related terms.
        </p>
      </div>
      <KeywordResearchClient />
    </div>
  );
}
