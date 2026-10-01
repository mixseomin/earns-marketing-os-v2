'use client';
import { useState } from 'react';

export function DangKy({ tieuDe, chu }: { tieuDe: string; chu: string }) {
  const [tt, setTt] = useState<'' | 'dang' | 'loi'>('');
  const [ma, setMa] = useState<string | null>(null);
  const nop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTt('dang');
    const r = await fetch('/api/dang-ky', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: new FormData(e.currentTarget).get('email'), trang: location.pathname }) }).catch(() => null);
    const j = r?.ok ? await r.json() : null;
    if (!j) { setTt('loi'); return; }
    if (j.ma) try { localStorage.setItem('ma-giam', j.ma); } catch { /* */ }
    setMa(j.ma ?? ''); setTt('');
  };
  return <div>
    <h3>{tieuDe}</h3>
    <p className="dk-chu">{chu}</p>
    {ma !== null ? <p className="dk-xong">Thanks for joining!{ma ? <> Your code <b>{ma}</b> is saved and will apply at checkout.</> : null}</p>
      : <form className="dk" onSubmit={nop}><input className="o" id="dk-email" name="email" type="email" placeholder="Email address" aria-label="Email address for newsletter" required />
        <button className="nut-den" disabled={tt === 'dang'}>Sign up</button></form>}
    {tt === 'loi' && <p className="loi">Please check your email and try again.</p>}
  </div>;
}
