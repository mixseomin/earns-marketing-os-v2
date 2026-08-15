'use client';

// Đăng nhập publisher. Trang RIÊNG, không dùng /login của MOS2 — hai hệ danh tính khác nhau,
// dùng chung một màn hình là mời người ta thử tài khoản nội bộ ở đây.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction, setPasswordAction } from '@/lib/actions/pub-auth';
import { TextField } from './ui';

export function PubLogin({ setupToken }: { setupToken?: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const setup = !!setupToken;
  const mismatch = setup && !!again && pw !== again;

  const submit = () => start(async () => {
    const r = setup ? await setPasswordAction(setupToken!, pw) : await loginAction(email, pw);
    if (r.ok) { router.replace('/pub'); router.refresh(); } else setErr(r.error ?? 'lỗi');
  });

  return (
    <div style={{ height: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="panel" style={{ width: 320, padding: 20, display: 'grid', gap: 10 }}>
        <h1 style={{ fontSize: 16, margin: 0 }}>{setup ? 'Đặt mật khẩu' : 'Publisher đăng nhập'}</h1>
        <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: 0 }}>
          {setup ? 'Chọn mật khẩu của riêng bạn. Không ai khác biết nó.' : 'Tài khoản publisher — khác tài khoản nội bộ.'}
        </p>
        {!setup && (
          <TextField label="Email" type="email" autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
        <TextField label={setup ? 'Mật khẩu mới' : 'Mật khẩu'} type="password"
          autoComplete={setup ? 'new-password' : 'current-password'}
          hint={setup ? 'Tối thiểu 8 ký tự.' : undefined}
          value={pw} onChange={(e) => setPw(e.target.value)} />
        {setup && (
          <TextField label="Gõ lại" type="password" autoComplete="new-password"
            error={mismatch ? 'Hai ô không khớp' : undefined}
            value={again} onChange={(e) => setAgain(e.target.value)} />
        )}
        <button type="button" disabled={busy || !pw || mismatch} onClick={submit}
          style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'transparent',
                   color: 'var(--ok)', border: '1px solid var(--ok)', borderRadius: 4, cursor: 'pointer' }}>
          {busy ? 'Đang xử lý…' : setup ? 'Đặt mật khẩu' : 'Đăng nhập'}
        </button>
        {err && <span style={{ fontSize: 11, color: 'var(--warn)' }}>{err}</span>}
      </div>
    </div>
  );
}
