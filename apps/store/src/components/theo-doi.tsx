'use client';
// Trang theo dõi đơn: link trong thư (số đơn + chìa) mở thẳng; không có thì khách gõ số đơn + email. Dữ liệu: @mos2/shop/khach.
import { useEffect, useState } from 'react';
import type { BanKhach } from '@mos2/shop/khach';

const ngay = (iso: string, gio = false) => new Date(iso).toLocaleString('en-US', gio ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' });

export function TheoDoi({ order, khoa, xem }: { order: string; khoa: string; xem?: { key: string; shop: string } }) {
  const [ban, setBan] = useState<BanKhach | null>(null);
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(false);
  const tim = async (body: Record<string, string>) => {
    setDang(true); setLoi('');
    const r = await fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, ...(xem ? { xem: xem.key, shop: xem.shop } : {}) }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (j.ban) setBan(j.ban); else setLoi('We could not find an order with those details. Please check the order number (in your confirmation email) and the email you used at checkout.');
    setDang(false);
  };
  useEffect(() => { if (order && khoa) tim({ order, key: khoa }); }, [order, khoa]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ban) return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}><b style={{ fontSize: 20 }}>Order #{ban.so_don}</b><span className="dong-nho">Placed {ngay(ban.ngay_dat)}</span></div>
    <ol className="td-buoc">{ban.buoc.map((b, i) => <li key={b.nhan} className={`${b.xong ? 'xong' : ''}${i === ban.hien_tai ? ' nay' : ''}`}><i /><span>{b.nhan}</span></li>)}</ol>
    {ban.tien_do && <div className="td-tien">
      <div className="td-tien-dau"><b>{ban.tien_do.nhan}</b><span>{ban.tien_do.pct}%</span></div>
      <div className="td-thanh" role="progressbar" aria-valuenow={ban.tien_do.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(4, ban.tien_do.pct)}%` }} /></div>
      <p>{ban.tien_do.giai_thich}</p>
    </div>}
    {ban.du_kien && <p className="du-kien"><span aria-hidden="true">📦</span><span>{ban.du_kien_qua ? 'Originally estimated' : 'Estimated delivery'}: <b>{ngay(ban.du_kien.tu)} - {ngay(ban.du_kien.den)}</b></span></p>}
    {ban.im_lang && <p className={`td-im${ban.du_kien_qua ? ' tre' : ''}`}>{ban.im_lang}</p>}
    {ban.ghi_chu && !ban.im_lang && <p className="dong-nho">{ban.ghi_chu}</p>}
    <ul className="td-moc">{ban.moc.map((m, i) => <li key={i}><span className="t">{ngay(m.ts, true)}</span><span className="m">{m.mo_ta}{m.noi && <em>{m.noi}</em>}</span></li>)}</ul>
    {ban.chang_cuoi && <p className="dong-nho" style={{ marginTop: 12 }}>{ban.chang_cuoi.hang} tracking: <a href={ban.chang_cuoi.link ?? '#'} target="_blank" rel="noopener">{ban.chang_cuoi.ma}</a></p>}
    <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>{ban.mon.map((x, i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {x.anh && <img src={x.anh} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 4 }} />}<span>{x.ten}{x.sl > 1 ? ` × ${x.sl}` : ''}</span></div>)}</div>
    {!ban.du_kien_qua && <div className="dam-bao" style={{ marginTop: 18 }}><span aria-hidden="true">🛡️</span><span>{ban.cam_ket}</span></div>}
    <div className="td-hoi"><span>Questions about your order? We reply within 24 hours.</span><a className="nut-den" href={`/contact?order=${encodeURIComponent(ban.so_don)}`}>Contact us</a></div>
  </div>;
  return <form className="tt-form" style={{ maxWidth: 440 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); tim({ order: String(f.get('order')), email: String(f.get('email')) }); }}>
    <p>Enter your order number and the email you used at checkout.</p>
    <input className="o" id="td-order" name="order" placeholder="Order number, e.g. 5001" defaultValue={order} required />
    <input className="o" id="td-email" name="email" type="email" placeholder="Email" required />
    {loi && <p className="loi">{loi}</p>}
    <button className="nut-tra" disabled={dang}>{dang ? 'Searching…' : 'Track order'}</button>
  </form>;
}
