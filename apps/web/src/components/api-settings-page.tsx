'use client';

import type { ProviderStatus } from '@/lib/ai-providers';
import { Pill } from './ui';
import { wrapExternalUrl } from '@/lib/external-url';

export function ApiSettingsPage({ providers }: { providers: ProviderStatus[] }) {
  const configuredCount = providers.filter((p) => p.configured).length;
  const totalModels = providers.filter((p) => p.configured).reduce((s, p) => s + p.models.length, 0);

  return (
    <div className="page" style={{ padding: 16, maxWidth: 980 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            🔑 API Settings
            <small>// {configuredCount}/{providers.length} providers · {totalModels} models available</small>
          </h1>
          <p className="page-sub">
            Cấu hình API keys cho LLM providers. Chỉ các provider đã configure mới xuất hiện trong Squad model dropdown.
            <br />
            <strong>Cách thêm key</strong>: SSH vào server, edit <code>/opt/earns-marketing-os-v2/.env.production</code>, thêm dòng <code>{'<ENV_VAR>=<key>'}</code>, rồi <code>systemctl restart mos2-web</code>.
            Phase 2 sẽ thêm UI nhập trực tiếp (encrypt-store DB).
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {providers.map((p) => (
          <div key={p.id} className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span className="dot" style={{ background: p.configured ? 'var(--ok)' : 'var(--bad)' }} />
                {p.name}
                <small>// {p.models.length} models</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pill
                  color={p.configured ? 'var(--ok)' : 'var(--bad)'}
                  label={p.configured ? '● configured' : '○ missing'}
                  size="xs"
                />
                <a className="btn" style={{ fontSize: 10, padding: '3px 8px' }}
                   href={wrapExternalUrl(p.setupUrl)} target="_blank" rel="noopener noreferrer">
                  Get key ↗
                </a>
              </div>
            </div>
            <div className="panel-body" style={{ padding: '8px 14px' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginBottom: 6 }}>
                env: <code style={{ color: p.configured ? 'var(--ok)' : 'var(--warn)' }}>{p.envVar}</code>
                {!p.configured && <span style={{ marginLeft: 8 }}>— chưa set, models bên dưới không khả dụng</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {p.models.map((m) => (
                  <span
                    key={m.id}
                    className="chip"
                    title={m.cost ?? ''}
                    style={{
                      fontSize: 10,
                      opacity: p.configured ? 1 : 0.4,
                      borderColor: p.configured ? 'var(--line-strong)' : 'var(--line)',
                    }}
                  >
                    {m.label}
                    {m.cost && <span style={{ marginLeft: 4, color: 'var(--fg-4)', fontSize: 9 }}>{m.cost}</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 11, color: 'var(--fg-2)' }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--fg-1)' }}>SSH command quick-ref</div>
        <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.6, color: 'var(--fg-3)', whiteSpace: 'pre-wrap' }}>{`ssh root@5.78.65.158
cd /opt/earns-marketing-os-v2
nano .env.production    # thêm OPENAI_API_KEY=sk-... etc.
systemctl restart mos2-web
# F5 trang này để verify`}</pre>
      </div>
    </div>
  );
}
