// Debug page list recent ext calls. URL: /ext-debug
// Read-only view ext_call_log table - quick audit khi LLM trả empty
// hoặc ext không POST đúng.

import { getDb, extCallLog } from '@mos2/db';
import { desc } from 'drizzle-orm';
import { wrapExternalUrl } from '@/lib/external-url';

export const dynamic = 'force-dynamic';

interface CallRow {
  id: number;
  endpoint: string;
  method: string;
  extVersion: string | null;
  pageUrl: string | null;
  payloadMeta: Record<string, unknown> | null;
  responseMeta: Record<string, unknown> | null;
  status: number | null;
  durationMs: number | null;
  errorMsg: string | null;
  createdAt: Date;
}

async function getRecentCalls(limit = 50): Promise<CallRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(extCallLog)
    .orderBy(desc(extCallLog.createdAt))
    .limit(limit);
  return rows as unknown as CallRow[];
}

export default async function ExtDebugPage() {
  const calls = await getRecentCalls(50);

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', fontFamily: 'var(--font-mono)' }}>
      <h1 style={{ fontSize: 18, marginBottom: 6 }}>🔍 Ext Call Log</h1>
      <p style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>
        Last {calls.length} calls. Auto-refresh = F5. Auto-prune sau 7 ngày (cron chưa làm).
      </p>

      {calls.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>
          Chưa có call nào. Reload ext MOS2 Crew + mở 1 page tương ứng để test.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {calls.map((c) => {
            const isErr = (c.status ?? 0) >= 400 || c.errorMsg;
            const selectorCount = (c.responseMeta?.selectors_count as number) ?? null;
            const isEmptyLLM = selectorCount === 0;
            const accent = isErr ? 'var(--bad)'
              : isEmptyLLM ? 'var(--warn)'
              : 'var(--ok)';
            return (
              <div key={c.id} style={{ border: `1px solid ${accent}44`, borderLeft: `3px solid ${accent}`,
                                        borderRadius: 5, padding: '8px 12px',
                                        background: 'var(--bg-1)', fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <strong style={{ color: accent }}>#{c.id}</strong>
                  <span style={{ padding: '1px 6px', background: 'var(--bg-2)', borderRadius: 3, fontWeight: 700 }}>
                    {c.method} /api/ext/{c.endpoint}
                  </span>
                  <span style={{ color: accent, fontWeight: 700 }}>{c.status ?? '—'}</span>
                  {c.durationMs != null && <span style={{ color: 'var(--fg-3)' }}>{c.durationMs}ms</span>}
                  {c.extVersion && <span style={{ color: 'var(--fg-3)' }}>ext v{c.extVersion}</span>}
                  {selectorCount != null && (
                    <span style={{ padding: '1px 6px',
                                   background: isEmptyLLM ? 'rgba(251,191,36,.2)' : 'rgba(34,197,94,.2)',
                                   color: isEmptyLLM ? 'var(--warn)' : 'var(--ok)',
                                   borderRadius: 3, fontWeight: 700 }}>
                      {selectorCount} selectors
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ color: 'var(--fg-3)' }}>{new Date(c.createdAt).toLocaleString()}</span>
                </div>

                {c.pageUrl && (
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 4 }}>
                    📄 <a href={wrapExternalUrl(c.pageUrl)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{c.pageUrl}</a>
                  </div>
                )}

                {c.errorMsg && (
                  <div style={{ padding: 6, background: 'rgba(248,113,113,.08)',
                                border: '1px solid rgba(248,113,113,.3)',
                                color: 'var(--bad)', fontSize: 10, borderRadius: 3, marginBottom: 4 }}>
                    ⚠ {c.errorMsg}
                  </div>
                )}

                <details style={{ marginTop: 4 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--fg-3)', fontSize: 10 }}>
                    payload + response
                  </summary>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--fg-4)', marginBottom: 2 }}>PAYLOAD</div>
                      <pre style={{ ...preStyle, background: 'var(--bg-2)' }}>
                        {JSON.stringify(c.payloadMeta, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--fg-4)', marginBottom: 2 }}>RESPONSE</div>
                      <pre style={{ ...preStyle, background: 'var(--bg-2)' }}>
                        {JSON.stringify(c.responseMeta, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const preStyle: React.CSSProperties = {
  fontSize: 10, padding: 6, borderRadius: 3, color: 'var(--fg-2)',
  overflow: 'auto', maxHeight: 300, whiteSpace: 'pre-wrap',
  wordBreak: 'break-all', margin: 0,
};
