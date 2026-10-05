'use client';
// Khối "Bản xem để duyệt" trong drawer sản phẩm (tab Tài sản): anh xem + góp ý + duyệt NGAY TRONG MOS2, không link ra ngoài.
// Ảnh nằm trên Directus của MOS2 (as.on.tc/assets/<id>), dữ liệu ở listing_config.xem do máy sản xuất ghi (puzzle-books xem.mjs).
// Góp ý = hòm góp ý MOS2 (gop-y-mos2.tsx) mở qua sự kiện 'gop-y:mo'; ngữ cảnh tự kèm sản phẩm nhờ data-ngu-canh của drawer.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GuardedButton } from '@/components/ui';
import { duyetSanPham } from '@/lib/actions/san-pham-duyet';
import type { SpNut } from '@/lib/tai-san/kieu';

const DIRECTUS = 'https://as.on.tc';
const nhan: React.CSSProperties = { fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 6px' };

export function BanXem({ x }: { x: SpNut }) {
  const v = x.xem!;
  const router = useRouter();
  const [dang, batDau] = useTransition();
  const [kq, datKq] = useState<{ ok: boolean; chu: string } | null>(null);
  // dựng lại SAU lần duyệt → phải duyệt lại. So thời điểm (ISO); duyệt cũ chỉ có ngày → coi là cuối ngày đó.
  const lucDuyet = x.duyet ? new Date(x.duyet.length > 10 ? x.duyet : `${x.duyet}T23:59:59`).getTime() : 0;
  const cuHon = !!x.duyet && lucDuyet < new Date(v.ngay).getTime();
  const ngan = (s: string) => s.slice(0, 16).replace('T', ' ');
  const duyet = () => batDau(async () => {
    const r = await duyetSanPham(x.idSo!);
    datKq(r.ok ? { ok: true, chu: `Đã duyệt (${r.soDong} dòng sổ cùng tên). Máy sản xuất sẽ mở khoá bật bán ở lần chạy kế.` } : { ok: false, chu: r.error ?? 'Lỗi không rõ.' });
    if (r.ok) router.refresh();
  });
  return (
    <section style={{ display: 'grid', gap: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>Bản xem để duyệt</b>
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>dựng {ngan(v.ngay)}{v.trang ? ` · ${v.trang} trang` : ''}</span>
        <span style={{ fontSize: 12, color: x.duyet && !cuHon ? 'var(--ok)' : 'var(--warn)' }}>
          {x.duyet ? (cuHon ? `duyệt ${ngan(x.duyet)} nhưng đã dựng lại → duyệt lại` : `anh đã duyệt ${ngan(x.duyet)}`) : 'chưa duyệt'}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <GuardedButton reason={!x.idSo ? 'sản phẩm không nằm trong sổ' : x.duyet && !cuHon ? 'đã duyệt bản này' : undefined} disabled={dang} onClick={duyet}
          style={{ fontSize: 12.5, padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--bg-0, #fff)', cursor: 'pointer' }}>
          {dang ? 'Đang ghi…' : 'Duyệt bản này'}</GuardedButton>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('gop-y:mo'))}
          style={{ fontSize: 12.5, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--line)', background: 'none', color: 'var(--fg-1)', cursor: 'pointer' }}>
          Góp ý về sản phẩm này</button>
      </div>
      {kq && <div style={{ fontSize: 12.5, border: `1px solid ${kq.ok ? 'var(--ok)' : 'var(--bad)'}`, color: kq.ok ? 'var(--ok)' : 'var(--bad)', borderRadius: 6, padding: '6px 10px' }}>{kq.chu}</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {v.anh.map((a) => (
          <figure key={a.id} style={{ margin: 0 }}>
            <img src={`${DIRECTUS}/assets/${a.id}?width=1100`} alt={a.chu} loading="lazy" style={{ width: '100%', height: 'auto', borderRadius: 6, border: '1px solid var(--line)', background: '#fff' }} />
            <figcaption style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 3 }}>{a.chu}</figcaption>
          </figure>
        ))}
      </div>
      {v.mau?.length ? <div><p style={nhan}>Trang gợi nhớ đầu sách</p>
        {v.mau.map((m) => <div key={m.t} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontSize: 12.5, lineHeight: 1.5 }}>
          <b>{m.t}</b><div>{m.story}</div><div style={{ color: 'var(--fg-3)', marginTop: 4 }}>{m.ask.join(' · ')}</div>
          <div style={{ color: 'var(--fg-3)', fontSize: 11.5, marginTop: 4 }}>Từ: {m.w.join(', ')}</div></div>)}</div> : null}
      {v.moTa && <div><p style={nhan}>Mô tả bán hàng</p>
        {/* HTML do chính máy sản xuất ghi (kdp-<ten>.json), không phải nhập của người ngoài */}
        <div style={{ fontSize: 12.5, lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: v.moTa }} /></div>}
      {v.chuDe?.length ? <div><p style={nhan}>{v.chuDe.length} chủ đề</p>
        <ol style={{ columns: '2 200px', columnGap: 20, margin: 0, paddingLeft: 22, fontSize: 12.5 }}>{v.chuDe.map((t) => <li key={t}>{t}</li>)}</ol></div> : null}
    </section>
  );
}
