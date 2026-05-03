'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestLoginLink, bootstrapLogin } from '@/lib/actions/auth';
import { NoFillInput } from './no-fill-input';

export function LoginPage({ nextUrl, bootstrapToken, initialError }: { nextUrl: string; bootstrapToken?: string; initialError?: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [bootstrap, setBootstrap] = useState(bootstrapToken ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const handleEmail = () => {
    setError(null); setOkMessage(null); setGeneratedUrl(null);
    if (!email.trim()) { setError('Email rỗng'); return; }
    setBusy(true);
    startTransition(async () => {
      const res = await requestLoginLink(email.trim());
      setBusy(false);
      if (!res.ok) { setError(res.error || 'Lỗi'); return; }
      if (res.url) { setGeneratedUrl(res.url); }
      setOkMessage(res.message ?? 'Link sent.');
    });
  };

  const handleBootstrap = () => {
    setError(null); setOkMessage(null);
    if (!bootstrap.trim()) { setError('Bootstrap token rỗng'); return; }
    setBusy(true);
    startTransition(async () => {
      const res = await bootstrapLogin(bootstrap.trim());
      setBusy(false);
      if (!res.ok) { setError(res.error || 'Bootstrap thất bại'); return; }
      router.push(nextUrl);
    });
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-0)', padding: 20,
    }}>
      <div style={{
        maxWidth: 460, width: '100%',
        background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 12,
        padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--neon-cyan), var(--neon-violet))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: 'var(--bg-0)', fontSize: 18,
          }}>M</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: 'var(--fg-0)' }}>MOS Login</h1>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              Marketing OS · magic link auth
            </p>
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 10px', background: 'rgba(255,77,94,.08)', border: '1px solid rgba(255,77,94,.4)', borderRadius: 5, color: 'var(--bad)', fontSize: 12, marginBottom: 12 }}>
            ⚠ {error}
          </div>
        )}
        {okMessage && (
          <div style={{ padding: '8px 10px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.4)', borderRadius: 5, color: 'var(--ok)', fontSize: 12, marginBottom: 12 }}>
            ✓ {okMessage}
          </div>
        )}
        {generatedUrl && (
          <div style={{ padding: 10, background: 'var(--bg-2)', border: '1px solid var(--neon-cyan)', borderRadius: 5, marginBottom: 12 }}>
            <div style={{ fontSize: 10.5, color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              ↓ Magic link (admin có thể copy + gửi cho member)
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input readOnly value={generatedUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: 10.5,
                  background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 3,
                  color: 'var(--fg-1)', fontFamily: 'var(--font-mono)',
                }} />
              <button className="btn primary" style={{ fontSize: 10, padding: '3px 8px' }}
                onClick={() => navigator.clipboard.writeText(generatedUrl).catch(() => {})}>
                📋 Copy
              </button>
            </div>
          </div>
        )}

        {/* Email magic link */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Email
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <NoFillInput
              type="text"
              placeholder="you@team.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEmail(); }}
              style={{
                flex: 1, padding: '8px 10px', fontSize: 13,
                background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5,
                color: 'var(--fg-0)', outline: 'none',
              }}
            />
            <button onClick={handleEmail} disabled={busy}
              className="btn primary"
              style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {busy ? '...' : 'Send link'}
            </button>
          </div>
          <p style={{ marginTop: 6, fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
            Nhập email → server tạo magic link 24h. Link sẽ được admin chuyển cho bạn (chưa có SMTP auto-send).
          </p>
        </div>

        {/* Bootstrap admin */}
        <details style={{ marginTop: 14, fontSize: 11 }}>
          <summary style={{ color: 'var(--fg-3)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
            Lần đầu setup? · Bootstrap admin
          </summary>
          <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-2)', border: '1px dashed var(--line)', borderRadius: 5 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--fg-2)' }}>
              Nhập <code>MOS2_AGENT_TOKEN</code> từ <code>/opt/earns-marketing-os-v2/.env.production</code> để login lần đầu (chỉ work khi token match).
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <NoFillInput
                type="text"
                placeholder="MOS2_AGENT_TOKEN"
                value={bootstrap}
                onChange={(e) => setBootstrap(e.target.value)}
                style={{
                  flex: 1, padding: '6px 8px', fontSize: 12,
                  background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 4,
                  color: 'var(--fg-0)', outline: 'none', fontFamily: 'var(--font-mono)',
                }}
              />
              <button onClick={handleBootstrap} disabled={busy}
                style={{
                  padding: '6px 10px', fontSize: 11, fontWeight: 600,
                  background: 'var(--neon-amber)', color: 'var(--bg-0)',
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                }}>
                Bootstrap
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
