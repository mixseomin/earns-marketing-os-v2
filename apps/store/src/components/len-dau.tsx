'use client';
export function LenDau() {
  return <div className="len-dau"><button onClick={() => scrollTo({ top: 0, behavior: 'smooth' })}>Scroll to top <span aria-hidden="true">⌃</span></button></div>;
}
