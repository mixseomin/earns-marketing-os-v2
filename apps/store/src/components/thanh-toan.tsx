'use client';
// Checkout 2 cột trên tên miền shop — khuôn Crossian: trái = tóm tắt đơn (nền xám), phải = ví nhanh (Apple Pay / Google Pay) →
// "continue to pay with debit or credit card" → liên hệ, địa chỉ, ô thẻ Stripe tách (số / hạn / CVC) → "Pay $X now".
// Số tiền: máy chủ tính (POST /api/checkout) và giữ trong PaymentIntent; trang này chỉ hiện lại.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usd, type TongGio } from '@mos2/shop/gia';
import type { MonTT } from '@mos2/shop/thanh-toan';
import { useGio } from './gio';
import { DemNguoc } from './dem-nguoc';
import { BANG_MY } from './bang';
import { bao } from './do';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { Stripe?: (pk: string) => any } }

type Phien = { id: string; client_secret: string; mon: MonTT[]; tong: TongGio };
const KHOA_TT = 'tt-id';

function napStripe(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  return new Promise((ok, loi) => {
    const s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; s.onload = () => ok(); s.onerror = () => loi(new Error('stripe')); document.head.appendChild(s);
  });
}

export function ThanhToan({ ten, logo, pk, shipTen, saleHet }: { ten: string; logo: string | null; pk: string; shipTen: string; saleHet: string | null }) {
  const { mon: gio, xoaHet } = useGio();
  const router = useRouter();
  const [phien, setPhien] = useState<Phien | null>(null);
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState(false);
  const [coVi, setCoVi] = useState(true);
  const stripeRef = useRef<any>(null), theRef = useRef<any>(null), viRef = useRef<any>(null), phienRef = useRef<Phien | null>(null);
  const viMount = useRef<HTMLDivElement>(null), soMount = useRef<HTMLDivElement>(null), hanMount = useRef<HTMLDivElement>(null), cvcMount = useRef<HTMLDivElement>(null);
  phienRef.current = phien;

  // 1. Mở/cập nhật phiên mỗi khi giỏ đổi
  const khoaGio = gio.map((m) => `${m.b}x${m.sl}`).join(',');
  useEffect(() => {
    if (!gio.length) return;
    let huy = false;
    let id: string | null = null; try { id = sessionStorage.getItem(KHOA_TT); } catch { /* bộ nhớ bị chặn */ }
    fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, mon: gio.map((m) => ({ b: m.b, sl: m.sl })) }) })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.loi || 'checkout'); return j as Phien; })
      .then((p) => {
        if (huy) return;
        try { sessionStorage.setItem(KHOA_TT, p.id); } catch { /* như trên */ }
        setPhien(p);
        bao('begin_checkout', { value: p.tong.tong, items: p.mon.map((m) => ({ item_id: String(m.san_pham_id), item_name: m.ten, item_variant: m.tuy_chon, price: m.gia, quantity: m.sl })) });
      })
      .catch(() => !huy && setLoi('We could not load your cart. Please refresh the page.'));
    return () => { huy = true; };
  }, [khoaGio]); // eslint-disable-line react-hooks/exhaustive-deps

  const xong = useCallback((id: string) => { try { sessionStorage.removeItem(KHOA_TT); } catch { /* */ } xoaHet(); router.push(`/thank-you?tt=${id}`); }, [router, xoaHet]);

  const guiKhach = async (id: string, khach: Record<string, string>, diaChi: Record<string, string>) => {
    const r = await fetch('/api/checkout/khach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, khach, dia_chi: diaChi }) });
    if (!r.ok) throw new Error('khach');
  };

  // 2. Dựng Stripe Elements một lần khi có phiên đầu tiên
  const daDung = useRef(false);
  useEffect(() => {
    if (!phien || daDung.current || !pk) return;
    daDung.current = true;
    napStripe().then(() => {
      const stripe = window.Stripe!(pk); stripeRef.current = stripe;
      const fonts = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500&display=swap' }];
      const kieu = { base: { fontFamily: 'Poppins, sans-serif', fontSize: '16px', color: '#1b1b1b', '::placeholder': { color: '#9a9a9a' } }, invalid: { color: '#e74c3c' } };
      const nhom = stripe.elements({ fonts });
      const so = nhom.create('cardNumber', { style: kieu, showIcon: true, placeholder: 'Card number' }); so.mount(soMount.current);
      nhom.create('cardExpiry', { style: kieu, placeholder: 'Expiration date (MM / YY)' }).mount(hanMount.current);
      nhom.create('cardCvc', { style: kieu, placeholder: 'Security code' }).mount(cvcMount.current);
      theRef.current = so;
      // Ví nhanh (Apple Pay / Google Pay) — cùng PaymentIntent
      const vi = stripe.elements({ mode: 'payment', amount: Math.round(phien.tong.tong * 100), currency: 'usd', paymentMethodTypes: ['card'], fonts });
      viRef.current = vi;
      const ece = vi.create('expressCheckout', { emailRequired: true, phoneNumberRequired: true, shippingAddressRequired: true, allowedShippingCountries: ['US'],
        shippingRates: [{ id: 'mac-dinh', displayName: shipTen, amount: Math.round(phien.tong.ship * 100) }],
        paymentMethods: { applePay: 'always', googlePay: 'always', link: 'never', paypal: 'never', amazonPay: 'never' }, buttonHeight: 50 });
      ece.on('ready', (e: any) => setCoVi(!!e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean)));
      ece.on('confirm', async (e: any) => {
        const p = phienRef.current!;
        const a = e.shippingAddress?.address ?? e.billingDetails?.address ?? {};
        try {
          await guiKhach(p.id, { ten: e.billingDetails?.name ?? e.shippingAddress?.name ?? '', email: e.billingDetails?.email ?? '', sdt: e.billingDetails?.phone ?? '' },
            { ten: e.shippingAddress?.name ?? '', dong1: a.line1 ?? '', dong2: a.line2 ?? '', thanh_pho: a.city ?? '', bang: a.state ?? '', zip: a.postal_code ?? '', nuoc: a.country ?? 'US' });
        } catch { setLoi('Something went wrong. You were not charged. Please try again.'); e.paymentFailed?.(); return; }
        const r = await stripe.confirmPayment({ elements: vi, clientSecret: p.client_secret, confirmParams: { return_url: `${location.origin}/thank-you?tt=${p.id}` }, redirect: 'if_required' });
        if (r.error) { setLoi(r.error.message ?? 'Payment failed.'); return; }
        xong(p.id);
      });
      ece.mount(viMount.current);
    }).catch(() => setLoi('Secure payment could not load. Please check your connection and refresh.'));
  }, [phien, pk, shipTen, xong]);
  useEffect(() => { if (phien && viRef.current) viRef.current.update({ amount: Math.round(phien.tong.tong * 100) }); }, [phien]);

  const tra = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!phien || !stripeRef.current) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setDang(true); setLoi('');
    const ten = `${f.ho ?? ''} ${f.ten ?? ''}`.trim();
    const khach = { ten, email: f.email ?? '', sdt: f.sdt ?? '' };
    const diaChi = { ten, dong1: f.dong1 ?? '', dong2: f.dong2 ?? '', thanh_pho: f.thanh_pho ?? '', bang: f.bang ?? '', zip: f.zip ?? '', nuoc: 'US' };
    try {
      await guiKhach(phien.id, khach, diaChi);
      bao('add_payment_info', { value: phien.tong.tong, items: phien.mon.map((m) => ({ item_id: String(m.san_pham_id), item_name: m.ten, price: m.gia, quantity: m.sl })) });
      const r = await stripeRef.current.confirmCardPayment(phien.client_secret, { payment_method: { card: theRef.current,
        billing_details: { name: ten, email: khach.email, phone: khach.sdt || undefined,
          address: { line1: diaChi.dong1, line2: diaChi.dong2 || undefined, city: diaChi.thanh_pho, state: diaChi.bang, postal_code: diaChi.zip, country: 'US' } } } });
      if (r.error) { setLoi(r.error.message ?? 'Your card was declined.'); setDang(false); return; }
      xong(phien.id);
    } catch { setLoi('Something went wrong. You were not charged. Please try again.'); setDang(false); }
  };

  if (!gio.length && !phien) return <div className="khung trang"><h1>Your cart is empty</h1><p><Link href="/">Continue shopping</Link></p></div>;
  const t = phien?.tong;
  return <div className="tt">
    <div className="tt-trai">
      <div className="tt-logo"><Link className="logo" href="/">{logo ? <img src={logo} alt={ten} style={{ maxHeight: 48 }} /> : ten}</Link>
        <div className="tt-tin"><span>🔒 SSL secured</span><span>Payments by Stripe</span></div></div>
      <h2>Order Summary</h2>
      {t && t.tiet_kiem > 0 && <div className="tiet-kiem"><div>Nice! You saved <b>{usd(t.tiet_kiem)}</b> on this order!</div>
        {saleHet && <div><DemNguoc den={saleHet} truoc="" giua="This offer ends in " /></div>}</div>}
      {(phien?.mon ?? []).map((m) => <div className="tt-mon" key={m.bien_the_id}>{m.anh ? <img src={m.anh} alt="" /> : <div />}
        <div><div className="ten-m">{m.ten}</div><div className="tc">{m.tuy_chon}</div>
          <div className="dg-m"><span><b>Quantity</b>: {m.sl}</span><span>{m.gia_goc ? <s>{usd(m.gia_goc * m.sl)}</s> : null}{usd(m.gia * m.sl)}</span></div></div></div>)}
      {t && <div className="tt-tong">
        <div><span>Subtotal</span><b>{usd(t.tam_tinh)}</b></div>
        <div><span>{shipTen}</span><b>{t.ship ? usd(t.ship) : 'FREE'}</b></div>
        {t.giam > 0 && <div className="giam"><span>Bundle discount ({t.pt}% OFF)</span><span>- {usd(t.giam)}</span></div>}
        <div className="cuoi"><span>Total</span><span>{t.goc + t.ship > t.tong ? <s>{usd(t.goc + t.ship)}</s> : null}{usd(t.tong)}</span></div>
      </div>}
    </div>
    <div className="tt-phai">
      <div ref={viMount} className="vi-nhanh" style={{ display: coVi ? undefined : 'none' }} />
      <div className="ke-chu">{coVi ? 'Continue to pay with debit or credit card' : 'Pay with debit or credit card'}</div>
      <form className="tt-form" onSubmit={tra}>
        <h3>Contact information</h3>
        <input className="o" id="tt-email" name="email" type="email" placeholder="Email" autoComplete="email" required />
        <h3>Shipping address</h3>
        <div className="hai-o"><input className="o" id="tt-ho" name="ho" placeholder="First name" autoComplete="given-name" required />
          <input className="o" id="tt-ten" name="ten" placeholder="Last name" autoComplete="family-name" required /></div>
        <input className="o" id="tt-dong1" name="dong1" placeholder="Address" autoComplete="address-line1" required />
        <input className="o" id="tt-dong2" name="dong2" placeholder="Apartment, suite, etc. (optional)" autoComplete="address-line2" />
        <div className="hai-o"><input className="o" id="tt-tp" name="thanh_pho" placeholder="City" autoComplete="address-level2" required />
          <select className="o" id="tt-bang" name="bang" autoComplete="address-level1" required defaultValue=""><option value="" disabled>State</option>
            {BANG_MY.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="hai-o"><input className="o" id="tt-zip" name="zip" placeholder="ZIP code" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" required />
          <input className="o" id="tt-nuoc" value="United States" readOnly aria-label="Country" /></div>
        <input className="o" id="tt-sdt" name="sdt" type="tel" placeholder="Phone number (for delivery updates)" autoComplete="tel" required />
        <h3>Card information</h3>
        <div className="the"><div className="so-the" ref={soMount} /><div className="han" ref={hanMount} /><div className="cvc" ref={cvcMount} /></div>
        {loi && <p className="loi" role="alert">{loi}</p>}
        <button className="nut-tra" disabled={!phien || dang}>{dang ? 'Processing…' : t ? `Pay ${usd(t.tong)} now` : 'Loading…'}</button>
        <div className="an-toan">🔒 All transactions are secure and encrypted.</div>
      </form>
    </div>
  </div>;
}
