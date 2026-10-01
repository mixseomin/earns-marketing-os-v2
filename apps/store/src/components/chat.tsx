'use client';
// Ô chat tư vấn góc dưới phải (bật/tắt + lời chào ở mos2 /shop › Cửa hàng › Tư vấn). Cuộc chat nhớ trong localStorage (id + chìa), mở lại
// trang vẫn thấy. Khi có trả lời đang chờ người duyệt thì xin email để báo khách khi họ đã rời trang. Dữ liệu: /api/chat.
import { useEffect, useRef, useState } from 'react';
import { idPhien, ghiPhien } from './phien';

type Tin = { id: number; ts: string; minh: boolean; noi_dung: string };
type Ban = { id: number; k: string; email: string | null; tin: Tin[]; cho: 'soan' | 'nguoi' | null };
const KHOA = 'chat-tv';

export function ChatTuVan({ chao, ten, truc }: { chao: string; ten: string; truc: boolean }) {
  const [mo, setMo] = useState(false);
  const [ban, setBan] = useState<Ban | null>(null);
  const [nd, setNd] = useState('');
  const [email, setEmail] = useState('');
  const [dang, setDang] = useState(false);
  const cuoi = useRef<HTMLDivElement>(null);
  const luu = (b: Ban) => { setBan(b); try { localStorage.setItem(KHOA, JSON.stringify({ id: b.id, k: b.k })); } catch { /* chặn bộ nhớ */ } };

  const tai = async () => {
    let c: { id: number; k: string } | null = null;
    try { c = JSON.parse(localStorage.getItem(KHOA) ?? 'null'); } catch { /* */ }
    if (!c) return;
    const r = await fetch(`/api/chat?id=${c.id}&k=${encodeURIComponent(c.k)}`).catch(() => null);
    if (r?.ok) luu(await r.json());
  };
  useEffect(() => { tai(); }, []);
  // Đang mở và đang chờ trả lời thì hỏi lại nhanh; mở mà không chờ thì chậm hơn
  useEffect(() => {
    if (!mo) return;
    const t = setInterval(() => document.visibilityState === 'visible' && tai(), ban?.cho ? 3000 : 12000);
    return () => clearInterval(t);
  }, [mo, ban?.cho]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cuoi.current?.scrollIntoView({ block: 'end' }); }, [ban?.tin.length, ban?.cho, mo]);

  const gui = async (than: Record<string, unknown>) => {
    setDang(true);
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...than, id: ban?.id, k: ban?.k, phien: idPhien() }) }).catch(() => null);
    if (r?.ok) luu(await r.json());
    setDang(false);
  };
  const nhan = async () => { const x = nd.trim(); if (!x) return; setNd(''); ghiPhien('click', { nhan: 'chat: gửi tin' }); await gui({ noi_dung: x }); };

  return <>
    <button className={`chat-nut${mo ? ' mo' : ''}`} aria-label={mo ? 'Close chat' : 'Chat with us'} onClick={() => setMo(!mo)}>
      {mo ? '✕' : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v11H8l-4 4V5Z" /></svg>}
    </button>
    {mo && <div className="chat-khung" role="dialog" aria-label={`Chat with ${ten}`}>
      <div className="chat-dau"><b>{ten}</b><span>{truc ? '● Our team is online now' : 'Instant answers to most questions · order & return questions answered by our team within a few hours'}</span></div>
      <div className="chat-than">
        <div className="chat-tin ho">{chao}</div>
        {ban?.tin.map((t) => <div key={t.id} className={`chat-tin ${t.minh ? 'toi' : 'ho'}`}>{t.noi_dung}</div>)}
        {ban?.cho === 'soan' && <div className="chat-tin ho dang"><i /><i /><i /></div>}
        {ban?.cho === 'nguoi' && <div className="chat-ghi">Thanks! A team member will reply here shortly{ban.email ? <> and by email to <b>{ban.email}</b>.</> : '.'}</div>}
        {ban && !ban.email && ban.tin.length > 0 && <form className="chat-email" onSubmit={(e) => { e.preventDefault(); if (email.trim()) gui({ email: email.trim() }); }}>
          <span>Get our reply by email if you leave the page:</span>
          <div><input id="chat-email" type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} /><button disabled={dang}>Save</button></div>
        </form>}
        <div ref={cuoi} />
      </div>
      <form className="chat-go" onSubmit={(e) => { e.preventDefault(); nhan(); }}>
        <textarea id="chat-nd" rows={1} placeholder="Type your question…" value={nd} maxLength={2000}
          onChange={(e) => setNd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); nhan(); } }} />
        <button disabled={dang || !nd.trim()} aria-label="Send">➤</button>
      </form>
    </div>}
  </>;
}
