'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction, bootstrapAdminAction } from '@/lib/actions/auth';
import { NoFillInput } from './no-fill-input';

// Standard input style for credentials — does NOT use NoFillInput because
// password managers SHOULD detect login fields (opposite of other forms).
const credInputStyle: React.CSSProperties = {
  width: '100%', marginTop: 4, padding: '8px 10px', fontSize: 13,
  background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5,
  color: 'var(--fg-0)', outline: 'none',
};

export function LoginPage({ nextUrl, bootstrapMode, initialError }: { nextUrl: string; bootstrapMode: boolean; initialError?: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const handleLogin = () => {
    setError(null); setOkMessage(null);
    if (!email.trim() || !password) { setError('Email + password bắt buộc'); return; }
    setBusy(true);
    startTransition(async () => {
      const res = await loginAction(email.trim().toLowerCase(), password);
      setBusy(false);
      if (!res.ok) { setError(res.error || 'Login thất bại'); return; }
      router.push(nextUrl);
    });
  };

  const handleBootstrap = () => {
    setError(null); setOkMessage(null);
    if (!bootstrapToken.trim() || !password || !email.trim()) {
      setError('Cần email + password + bootstrap token');
      return;
    }
    setBusy(true);
    startTransition(async () => {
      const res = await bootstrapAdminAction(bootstrapToken.trim(), password);
      setBusy(false);
      if (!res.ok) { setError(res.error || 'Bootstrap thất bại'); return; }
      setOkMessage('Bootstrap OK — đang vào dashboard...');
      setTimeout(() => router.push(nextUrl), 800);
    });
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-0)', padding: 20,
    }}>
      <div style={{
        maxWidth: 420, width: '100%',
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
              {bootstrapMode ? 'Setup ban đầu — set admin password' : 'Marketing OS · email + password'}
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

        {bootstrapMode && (
          <div style={{ padding: 10, marginBottom: 14, background: 'rgba(255,176,60,.06)', border: '1px solid rgba(255,176,60,.4)', borderRadius: 5, fontSize: 11.5, color: 'var(--fg-2)' }}>
            ⚠ Lần đầu setup. Nhập <code>MOS2_AGENT_TOKEN</code> + email admin + password mới để khởi tạo.
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); bootstrapMode ? handleBootstrap() : handleLogin(); }}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="login-email" style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="you@team.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={credInputStyle}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="login-password" style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Password{bootstrapMode ? ' (ít nhất 8 ký tự — sẽ là password admin)' : ''}
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete={bootstrapMode ? 'new-password' : 'current-password'}
            placeholder={bootstrapMode ? 'Set new admin password' : 'Your password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={credInputStyle}
          />
        </div>

        {bootstrapMode && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Bootstrap token (MOS2_AGENT_TOKEN)
            </label>
            <NoFillInput
              type="text"
              placeholder="from .env.production"
              value={bootstrapToken}
              onChange={(e) => setBootstrapToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleBootstrap(); }}
              style={{
                width: '100%', marginTop: 4, padding: '8px 10px', fontSize: 12,
                background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5,
                color: 'var(--fg-0)', outline: 'none', fontFamily: 'var(--font-mono)',
              }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn primary"
          style={{
            width: '100%', padding: '10px', fontSize: 13, fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}>
          {busy ? '...' : (bootstrapMode ? 'Setup admin & login' : 'Login')}
        </button>

        {!bootstrapMode && (
          <p style={{ marginTop: 10, fontSize: 10.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
            Quên password? Liên hệ admin → /team → Reset password
          </p>
        )}
        </form>
      </div>
    </div>
  );
}
