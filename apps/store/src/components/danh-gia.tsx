'use client';
// Khối Reviews — CHỈ đánh giá thật (shop_danh_gia 'hien'). Form "Write your review" gửi vào hàng chờ duyệt ở MOS2 /shop.
import { useState } from 'react';
import type { DanhGia } from '@/lib/shop';

const sao = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function KhoiDanhGia({ spId, ds, tb, so }: { spId: number; ds: DanhGia[]; tb: number | null; so: number }) {
  const [them, setThem] = useState(6);
  const [mo, setMo] = useState(false);
  const [gui, setGui] = useState<'' | 'dang' | 'xong' | string>('');
  const [diem, setDiem] = useState(5);
  const nop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setGui('dang');
    const r = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sp: spId, sao: diem, ten: f.get('ten'), email: f.get('email'), tieu_de: f.get('tieu_de'), noi_dung: f.get('noi_dung') }) }).catch(() => null);
    setGui(r?.ok ? 'xong' : 'Could not send your review, please try again.');
  };
  return <div>
    <div className="dg-dau">
      <h2>Reviews</h2>
      {so > 0 && tb !== null ? <div className="dg-diem"><span className="so">{tb.toFixed(1)}</span><div><div className="sao">{sao(Math.round(tb))}</div>Based on <b>{so} {so === 1 ? 'rating' : 'ratings'}</b></div></div>
        : <div className="dong-nho">Be the first to review this product.</div>}
      <button className="nut-den" onClick={() => setMo((v) => !v)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20h4L19 9l-4-4L4 16v4Z" /></svg>Write your review</button>
    </div>
    {mo && (gui === 'xong' ? <p className="dg-trong">Thank you! Your review will appear after it is checked.</p> :
      <form className="dg-form" onSubmit={nop}>
        <div className="sao-chon" role="group" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} aria-pressed={n <= diem} aria-label={`${n} stars`} onClick={() => setDiem(n)}>★</button>)}</div>
        <div className="hai-o"><input className="o" id="dg-ten" name="ten" placeholder="Your name" required maxLength={60} /><input className="o" id="dg-email" name="email" type="email" placeholder="Email (used for your order)" required /></div>
        <input className="o" id="dg-tieu-de" name="tieu_de" placeholder="Title" maxLength={120} />
        <textarea className="o" id="dg-noi-dung" name="noi_dung" placeholder="Tell others about the fit, comfort and quality" required minLength={10} maxLength={3000} />
        {gui && gui !== 'dang' && <p className="loi">{gui}</p>}
        <button className="nut-den" disabled={gui === 'dang'}>Submit review</button>
      </form>)}
    {ds.slice(0, them).map((r) => <div className="dg" key={r.id}>
      <div><div className="ten">{r.ten}</div>{r.da_mua && <div className="xac">Verified Buyer</div>}</div>
      <div><div className="sao">{sao(r.sao)}</div>{r.tieu_de && <h4>{r.tieu_de}</h4>}
        {r.anh.length > 0 && <div className="anh">{r.anh.map((a) => <img key={a} src={a} alt="" loading="lazy" />)}</div>}<p>{r.noi_dung}</p></div>
    </div>)}
    {ds.length > them && <p style={{ textAlign: 'center', marginTop: 24 }}><button className="nut-den" onClick={() => setThem((n) => n + 10)}>Show more</button></p>}
  </div>;
}
