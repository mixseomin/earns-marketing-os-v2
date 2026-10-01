'use client';
import { useState } from 'react';

export function LienHe({ don = '' }: { don?: string }) {
  const [tt, setTt] = useState<'' | 'dang' | 'xong' | 'loi'>('');
  const nop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setTt('dang');
    const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }).catch(() => null);
    setTt(r?.ok ? 'xong' : 'loi');
  };
  if (tt === 'xong') return <p><b>Thanks! We received your message and will reply by email soon.</b></p>;
  return <form className="tt-form" onSubmit={nop} style={{ marginTop: 20 }}>
    <div className="hai-o"><input className="o" id="lh-ten" name="ten" placeholder="Name" required maxLength={80} /><input className="o" id="lh-email" name="email" type="email" placeholder="Email" required /></div>
    <input className="o" id="lh-don" name="don" placeholder="Order number (optional)" maxLength={20} defaultValue={don} />
    <textarea className="o" id="lh-noi-dung" name="noi_dung" placeholder="How can we help?" required minLength={5} maxLength={5000} />
    {tt === 'loi' && <p className="loi">Could not send. Please email us directly.</p>}
    <button className="nut-tra" disabled={tt === 'dang'}>Send message</button>
  </form>;
}
