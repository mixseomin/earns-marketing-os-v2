'use client';
// "Notify me when back in stock" — hiện thay nút Add to cart khi món khách chọn đang hết (NCC hết/gỡ tạm). /api/bao-co-hang.
import { useState } from 'react';

export function BaoCoHang({ sp, bt, ten }: { sp: number; bt: number | null; ten: string }) {
  const [email, setEmail] = useState('');
  const [tt, setTt] = useState<'' | 'dang' | 'xong' | 'loi'>('');
  if (tt === 'xong') return <div className="bch xong">Thanks! We'll email you as soon as <b>{ten}</b> is back in stock.</div>;
  return <form className="bch" onSubmit={async (e) => {
    e.preventDefault(); setTt('dang');
    const r = await fetch('/api/bao-co-hang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sp, bt, email }) }).catch(() => null);
    setTt(r?.ok ? 'xong' : 'loi');
  }}>
    <b>Temporarily sold out</b>
    <span>Leave your email and we'll let you know the moment it's back.</span>
    <div><input id={`bch-${sp}-${bt ?? 0}`} type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="nut-den" disabled={tt === 'dang'}>{tt === 'dang' ? 'Saving…' : 'Notify me'}</button></div>
    {tt === 'loi' && <span className="loi">Could not save. Please try again.</span>}
  </form>;
}
