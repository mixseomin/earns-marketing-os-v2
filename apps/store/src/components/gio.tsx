'use client';
// Giỏ hàng (trình duyệt giữ trong localStorage) + ngăn kéo bên phải đúng khuôn Crossian. Số tiền hiện ở đây chỉ để xem —
// máy chủ tính lại từ sổ khi mở thanh toán (@mos2/shop/thanh-toan).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { tinhGio, usd, type TongGio } from '@mos2/shop/gia';
import type { BacGiam } from '@mos2/shop/mat-tien';
import { DemNguoc } from './dem-nguoc';
import { bao } from './do';

export type MonGio = { b: number; sl: number; sp: number; slug: string; ten: string; tc: string; anh: string | null; gia: number; gia_goc: number | null };
export type CauHinhGio = { bac_giam: BacGiam[]; ship: { phi: number; mien_phi_tu?: number | null }; sale_het: string | null };

type Ctx = { mon: MonGio[]; tong: TongGio; mo: boolean; setMo: (v: boolean) => void; them: (m: MonGio) => void; doiSl: (b: number, sl: number) => void;
  bo: (b: number) => void; xoaHet: () => void; cfg: CauHinhGio };
const C = createContext<Ctx | null>(null);
export const useGio = () => useContext(C)!;

const KHOA = 'gio-v1';

export function GioProvider({ cfg, children }: { cfg: CauHinhGio; children: ReactNode }) {
  const [mon, setMon] = useState<MonGio[]>([]);
  const [mo, setMo] = useState(false);
  const [nap, setNap] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem(KHOA); if (raw) setMon(JSON.parse(raw)); } catch { /* trình duyệt chặn bộ nhớ: giỏ sống trong phiên */ }
    setNap(true);
  }, []);
  useEffect(() => { if (nap) try { localStorage.setItem(KHOA, JSON.stringify(mon)); } catch { /* như trên */ } }, [mon, nap]);
  useEffect(() => { document.body.style.overflow = mo ? 'hidden' : ''; }, [mo]);
  const them = useCallback((m: MonGio) => {
    setMon((ds) => { const i = ds.findIndex((x) => x.b === m.b); if (i < 0) return [...ds, m]; const c = [...ds]; c[i] = { ...c[i]!, sl: Math.min(20, c[i]!.sl + m.sl) }; return c; });
    bao('add_to_cart', { value: m.gia * m.sl, items: [{ item_id: String(m.sp), item_name: m.ten, item_variant: m.tc, price: m.gia, quantity: m.sl }] });
    setMo(true);
  }, []);
  const doiSl = useCallback((b: number, sl: number) => setMon((ds) => ds.map((x) => (x.b === b ? { ...x, sl: Math.min(20, Math.max(1, sl)) } : x))), []);
  const bo = useCallback((b: number) => setMon((ds) => ds.filter((x) => x.b !== b)), []);
  const xoaHet = useCallback(() => setMon([]), []);
  const tong = useMemo(() => tinhGio(mon, cfg.bac_giam, cfg.ship), [mon, cfg]);
  return <C.Provider value={{ mon, tong, mo, setMo, them, doiSl, bo, xoaHet, cfg }}>{children}<NganGio /></C.Provider>;
}

export function SoLuong({ sl, doi }: { sl: number; doi: (n: number) => void }) {
  return <div className="so-luong"><button type="button" aria-label="Decrease quantity" onClick={() => doi(sl - 1)}>−</button><span>{sl}</span>
    <button type="button" aria-label="Increase quantity" onClick={() => doi(sl + 1)}>+</button></div>;
}

// Khuôn ngăn kéo của orabra (đo 01/10/2026): desktop 475px; mobile = màn trừ 31px — dải tối bên trái để chạm là đóng, khách quay
// lại trang đặt thêm. Món: ảnh 90 · tên đậm · mỗi tuỳ chọn một dòng "Tên: **giá trị**" · nút ⊗ góc · bộ đếm nhỏ · giá gạch trên giá bán.
// Chân: Subtotal + giá gạch · nút PROCEED TO CHECKOUT · hàng biểu tượng cách trả.
function NganGio() {
  const { mon, tong, mo, setMo, doiSl, bo, cfg } = useGio();
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setMo(false); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [setMo]);
  if (!mo) return null;
  const cuoi = mon[mon.length - 1];
  const sau = tong.tam_tinh - tong.giam;
  return <>
    <div className="ngan-nen" onClick={() => setMo(false)} aria-hidden="true" />
    <aside className="ngan" role="dialog" aria-label="Shopping cart">
      <div className="dau-n"><b>Your Cart</b><button className="dong-n" aria-label="Close cart" onClick={() => setMo(false)}>✕</button></div>
      <div className="than-n">
        {cfg.sale_het && <DemNguoc den={cfg.sale_het} />}
        {!mon.length && <p className="dong-nho">Your cart is empty.</p>}
        {mon.map((m) => <div className="mon" key={m.b}>
          {m.anh ? <img src={m.anh} alt="" /> : <div />}
          <div>
            <div className="tren"><div className="ten-m">{m.ten}</div><button className="bo" aria-label={`Remove ${m.ten}`} onClick={() => bo(m.b)}>✕</button></div>
            <div className="tc">{m.tc.split(' · ').map((d) => { const [k, ...v] = d.split(': '); return <div key={d}>{v.length ? <>{k}: <b>{v.join(': ')}</b></> : d}</div>; })}</div>
            <div className="duoi-m"><SoLuong sl={m.sl} doi={(n) => doiSl(m.b, n)} />
              <span className="gia-m">{m.gia_goc ? <s>{usd(m.gia_goc * m.sl)}</s> : null}<b>{usd(m.gia * m.sl)}</b></span></div>
          </div>
        </div>)}
        {tong.bac_tiep && cuoi && <div className="tiep"><span><b>EXTRA {tong.bac_tiep.pt}% OFF</b> {tong.bac_tiep.can > 1 ? `when you add ${tong.bac_tiep.can} more items` : 'for next item'}</span>
          <Link href={`/${cuoi.slug}`} onClick={() => setMo(false)}>Select now</Link></div>}
      </div>
      {mon.length > 0 && <div className="chan-n">
        {tong.giam > 0 && <div className="tam phu"><span>Bundle discount ({tong.pt}% OFF)</span><span>- {usd(tong.giam)}</span></div>}
        <div className="tam"><b>Subtotal</b><span><b>{usd(sau)}</b>{tong.goc > sau ? <s>{usd(tong.goc)}</s> : null}</span></div>
        <Link className="nut-tt" href="/checkout" onClick={() => setMo(false)}>Proceed to checkout</Link>
        <div className="the-tt" aria-label="Accepted payments">{['VISA', 'Mastercard', 'AMEX', 'Discover', 'Apple Pay', 'G Pay'].map((t) => <span key={t}>{t}</span>)}</div>
      </div>}
    </aside>
  </>;
}

export function NutGio() {
  const { tong, setMo } = useGio();
  return <button className="gio-nut" aria-label={`Cart, ${tong.so_mon} items`} onClick={() => setMo(true)}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>
    {tong.so_mon > 0 && <span className="gio-so">{tong.so_mon}</span>}
  </button>;
}
