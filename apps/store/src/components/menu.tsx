'use client';
import { useState } from 'react';
import Link from 'next/link';

export function Menu({ lien }: { lien: { href: string; ten: string }[] }) {
  const [mo, setMo] = useState(false);
  return <>
    <button className="menu" aria-label="Menu" aria-expanded={mo} onClick={() => setMo(true)}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h12M4 17h16" /></svg>
    </button>
    {mo && <div className="menu-mo" onClick={() => setMo(false)}>
      <nav onClick={(e) => e.stopPropagation()}>{lien.map((l) => <Link key={l.href} href={l.href} onClick={() => setMo(false)}>{l.ten}</Link>)}</nav>
    </div>}
  </>;
}
