'use client';
// Cột mua + ảnh của trang sản phẩm — khuôn Crossian + các khối của orabra (nhãn tuỳ chọn ở trên, ô màu bằng ảnh tròn, dòng bậc
// giảm, sao + số review dẫn xuống khối Reviews, ảnh có mũi tên/vuốt). Mọi số hiện ra là số thật (xem @mos2/shop/mat-tien).
import { useEffect, useMemo, useRef, useState } from 'react';
import { usd } from '@mos2/shop/gia';
import type { SanPham } from '@/lib/shop';
import type { BacGiam } from '@mos2/shop/mat-tien';
import { useGio, SoLuong } from './gio';
import { DemNguoc } from './dem-nguoc';
import { bao } from './do';

export type DuLieuMua = { sp: SanPham; diem: number | null; soDg: number; daBan: number; saleHet: string | null; dongSale: string | null; tonDuoi: number;
  camKet: string[]; bac: BacGiam[] };

function phienXem() {
  try { let p = sessionStorage.getItem('phien'); if (!p) { p = Math.random().toString(36).slice(2); sessionStorage.setItem('phien', p); } return p; }
  catch { return Math.random().toString(36).slice(2); }
}

export function TrangMua({ d }: { d: DuLieuMua }) {
  const { sp } = d;
  const { them, tong } = useGio();
  // Chọn sẵn tuỳ chọn ĐẦU (màu) như Crossian; các tuỳ chọn sau (size) để khách tự chọn — chọn hộ size là mời đơn sai cỡ, đổi trả.
  const [chon, setChon] = useState<Record<string, string>>(() => {
    const t = sp.tuy_chon[0];
    const gt = t?.gia_tri.find((g) => sp.bien_the.some((b) => !b.het_hang && b.tuy_chon[t.ten] === g));
    return t && gt && sp.tuy_chon.length > 1 ? { [t.ten]: gt } : { ...(sp.bien_the.find((b) => !b.het_hang) ?? sp.bien_the[0]!).tuy_chon };
  });
  const thieu = sp.tuy_chon.find((t) => !chon[t.ten]);
  const [sl, setSl] = useState(1);
  const [anh, setAnh] = useState(0);
  const [xem, setXem] = useState(0);
  const [nhac, setNhac] = useState('');
  // Thanh mua dính đáy (khuôn orabra): hiện khi khối nút mua đã cuộn khỏi màn, trượt lên từ đáy, ẩn khi giỏ đang mở.
  const khoiMua = useRef<HTMLDivElement>(null), khoiChon = useRef<HTMLDivElement>(null);
  const [dinh, setDinh] = useState(false);
  const { mo: gioMo } = useGio();
  useEffect(() => {
    // đọc vị trí khi cuộn (rAF gộp nhịp) — IntersectionObserver không bắn được ở một số trình duyệt nhúng khi cuộn bằng mã
    let cho = 0;
    const tinh = () => { cho = 0; const e = khoiMua.current; if (e) setDinh(e.getBoundingClientRect().bottom < 0); };
    const nghe = () => { if (!cho) cho = requestAnimationFrame(tinh); };
    tinh(); addEventListener('scroll', nghe, { passive: true }); addEventListener('resize', nghe);
    return () => { removeEventListener('scroll', nghe); removeEventListener('resize', nghe); if (cho) cancelAnimationFrame(cho); };
  }, []);
  useEffect(() => { document.body.classList.toggle('co-dinh', dinh); return () => document.body.classList.remove('co-dinh'); }, [dinh]);

  const bt = useMemo(() => sp.bien_the.find((b) => sp.tuy_chon.every((t) => b.tuy_chon[t.ten] === chon[t.ten])) ?? null, [chon, sp]);
  const coTon = (ten: string, gt: string) => sp.bien_the.some((b) => !b.het_hang && b.tuy_chon[ten] === gt
    && sp.tuy_chon.every((t) => t.ten === ten || !chon[t.ten] || b.tuy_chon[t.ten] === chon[t.ten]));
  const dsAnh = useMemo(() => {
    const ds = [...sp.anh_ds];
    for (const b of sp.bien_the) if (b.anh && !ds.includes(b.anh)) ds.push(b.anh);
    return ds;
  }, [sp]);
  useEffect(() => { bao('view_item', { value: sp.gia, items: [{ item_id: String(sp.id), item_name: sp.ten, price: sp.gia, quantity: 1 }] }); }, [sp]);
  useEffect(() => {
    const p = phienXem();
    const nhip = () => fetch('/api/xem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sp: sp.id, p }) })
      .then((r) => r.json()).then((j) => setXem(j.so ?? 0)).catch(() => null);
    nhip();
    const id = setInterval(() => document.visibilityState === 'visible' && nhip(), 45_000);
    return () => clearInterval(id);
  }, [sp.id]);

  const gia = bt?.gia ?? sp.gia, goc = bt ? bt.gia_goc : sp.gia_goc;
  // ảnh đại diện cho một giá trị tuỳ chọn (màu) — chỉ dùng ô ảnh khi MỌI giá trị của tuỳ chọn đó đều có ảnh riêng
  const anhCua = (ten: string, gt: string) => sp.bien_the.find((b) => b.tuy_chon[ten] === gt && b.anh)?.anh ?? null;
  const oAnh = (ten: string, ds: string[]) => ds.length > 1 && ds.every((g) => anhCua(ten, g)) && new Set(ds.map((g) => anhCua(ten, g))).size === ds.length;
  const doiAnh = (buoc: number) => setAnh((i) => (i + buoc + dsAnh.length) % dsAnh.length);
  const vuot = useRef<number | null>(null);
  // ảnh lớn theo lựa chọn: đủ biến thể → ảnh biến thể; mới chọn màu → ảnh của màu đó (không phải đợi chọn size)
  const t0 = sp.tuy_chon[0];
  const anhChon = bt?.anh ?? (t0 && chon[t0.ten] ? anhCua(t0.ten, chon[t0.ten]!) : null);
  useEffect(() => { if (anhChon) { const i = dsAnh.indexOf(anhChon); if (i >= 0) setAnh(i); } }, [anhChon, dsAnh]);
  const tenTc = sp.tuy_chon.map((t) => t.ten).join(' and ');
  const tiep = tong.bac_tiep;
  const mua = () => {
    if (thieu) { setNhac(`Please select a ${thieu.ten.toLowerCase()}`); khoiChon.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (!bt || bt.het_hang) return;
    them({ b: bt.id, sl, sp: sp.id, slug: sp.slug, ten: sp.ten, tc: sp.tuy_chon.map((t) => `${t.ten}: ${bt.tuy_chon[t.ten]}`).join('\n') || bt.ten,
      anh: bt.anh ?? dsAnh[0] ?? null, gia: bt.gia, gia_goc: bt.gia_goc });
  };

  return <div className="sp">
    <div className="sp-anh">
      <div className="chinh" onTouchStart={(e) => { vuot.current = e.touches[0]!.clientX; }}
        onTouchEnd={(e) => { if (vuot.current === null) return; const dx = e.changedTouches[0]!.clientX - vuot.current; vuot.current = null; if (Math.abs(dx) > 40) doiAnh(dx < 0 ? 1 : -1); }}>
        {dsAnh[anh] && <img src={dsAnh[anh]} alt={sp.ten} fetchPriority="high" />}
        {dsAnh.length > 1 && <span className="so-anh">{anh + 1} / {dsAnh.length}</span>}
      </div>
      {dsAnh.length > 1 && <div className="dai-khung">
        <button className="mui" aria-label="Previous image" onClick={() => doiAnh(-1)}>‹</button>
        <div className="dai">{dsAnh.map((a, i) => <button key={a} aria-current={i === anh} aria-label={`Image ${i + 1}`}
          ref={(e) => { if (e && i === anh) e.parentElement!.scrollTo({ left: e.offsetLeft - e.parentElement!.clientWidth / 2 + e.clientWidth / 2, behavior: 'smooth' }); }}
          onClick={() => setAnh(i)}><img src={a} alt="" loading="lazy" /></button>)}</div>
        <button className="mui" aria-label="Next image" onClick={() => doiAnh(1)}>›</button>
      </div>}
    </div>
    <div className="mua">
      <h1>{sp.tieu_de}</h1>
      {d.diem !== null && d.soDg > 0 && <a className="rated" href="#reviews"><span className="sao" aria-label={`${d.diem} out of 5`}>{'★'.repeat(Math.round(d.diem))}</span><u>{d.soDg} {d.soDg === 1 ? 'Review' : 'Reviews'}</u></a>}
      <div className="gia">{usd(gia)}{goc ? <s>{usd(goc)}</s> : null}</div>
      {d.saleHet && <DemNguoc den={d.saleHet} />}
      {d.bac.length > 0 && <div className="bac">{d.bac.map((b, i) => `BUY ${b.sl}${i === d.bac.length - 1 && d.bac.length > 1 ? '+' : ''}, SAVE ${b.pt}%`).join(' · ')}
        <small>Mix any {sp.tuy_chon.map((t) => t.ten.toLowerCase()).join(' and ') || 'item'}</small></div>}
      {d.dongSale && <div className="bao-sale"><span className="d">{d.dongSale.split('\n')[0]}</span>{d.dongSale.includes('\n') && <><br /><span className="c">{d.dongSale.split('\n')[1]}</span></>}</div>}
      <div ref={khoiChon} style={{ display: 'grid', gap: 16 }}>{sp.tuy_chon.map((t) => {
        const anhOk = oAnh(t.ten, t.gia_tri);
        return <div className="chon" key={t.ten}>
          <label>{t.ten}: <b>{chon[t.ten] ?? <span className="chua">Select</span>}</b></label>
          <div className={`nut-ds${anhOk ? ' o-anh' : ''}`} role="group" aria-label={t.ten}>{t.gia_tri.map((g) => <button key={g} type="button" className="nut" aria-pressed={chon[t.ten] === g}
            title={g} aria-label={anhOk ? g : undefined} disabled={!coTon(t.ten, g)} onClick={() => { setChon((c) => ({ ...c, [t.ten]: g })); setNhac(''); }}>
            {anhOk ? <img src={anhCua(t.ten, g)!} alt="" loading="lazy" /> : g}</button>)}</div>
        </div>;
      })}</div>
      {tiep && <div className="uu-dai"><b>{tong.so_mon === 0 ? `Add ${tiep.can} items to cart to get ${tiep.pt}% off` : `Extra ${tiep.pt}% off for next item in cart`}</b>
        {tenTc ? `Apply to any ${tenTc}` : 'Apply to any item'}</div>}
      <div className="hang-mua" ref={khoiMua}><SoLuong sl={sl} doi={(n) => setSl(Math.min(20, Math.max(1, n)))} />
        <button className="nut-mua" disabled={!thieu && (!bt || bt.het_hang)} onClick={mua}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>
          {thieu ? 'Add to cart' : !bt ? 'Unavailable' : bt.het_hang ? 'Sold out' : 'Add to cart'}</button></div>
      {nhac && <p className="loi" role="alert" style={{ margin: 0 }}>{nhac}</p>}
      {(xem > 1 || d.daBan > 0) && <div className="dong-nho">{xem > 1 && <><span className="d">Popular! </span><b>{xem}</b> people are viewing this{d.daBan > 0 ? ' and ' : '.'}</>}
        {d.daBan > 0 && <><b>{d.daBan}</b> purchased it.</>}</div>}
      <div className={`mua-dinh${dinh && !gioMo ? ' hien' : ''}`} aria-hidden={!dinh}>
        <div className="mua-dinh-trong">
          {dsAnh[anh] && <img src={dsAnh[anh]} alt="" />}
          <div className="mua-dinh-ten"><b>{sp.ten}</b><span>{usd(gia)}{goc ? <s>{usd(goc)}</s> : null}{bt && !thieu ? ` · ${Object.values(chon).join(' / ')}` : ''}</span></div>
          <button className="nut-mua" tabIndex={dinh ? 0 : -1} disabled={!thieu && (!bt || bt.het_hang)} onClick={mua}>
            {thieu ? `Select ${thieu.ten.toLowerCase()}` : bt?.het_hang ? 'Sold out' : tiep && tong.so_mon > 0 ? `Add to cart - extra ${tiep.pt}% off` : 'Add to cart'}</button>
        </div>
      </div>
      {d.camKet.length > 0 && <div className="cam-ket">{d.camKet.map((c) => <div key={c}>{c}</div>)}</div>}
    </div>
  </div>;
}
