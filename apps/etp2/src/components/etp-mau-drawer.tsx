'use client';
// CHI TIẾT MỘT MẪU CREATIVE — MỘT khối, HAI chỗ đứng (anh 20/11/2026 "sửa cả đi", rà tổ chức tab Mẫu Creative):
//   · ChiTietMau: ruột chi tiết, chia HAI TAB (?mxt=): "Mẫu" — creative mẫu chia nhóm (nguồn đối thủ / nhà đã duyệt), mô tả, quy trình chuẩn, thông số, giọng đọc, dùng cho dạng nào,
//     hợp thể loại, số nhà, QC đối thủ gốc, máy nào dựng · "Phim sản xuất" — mọi phim đã chọn + tiến độ từng bước + creative thật.
//   · Tab Mẫu Creative đặt ChiTietMau THẲNG ở khung phải khi chọn một mẫu trên cây (khỏi bấm thêm lần nữa để mở ngăn).
//   · EtpMauDrawer: ngăn 'etp-mau' của EtpDrawerHost (xếp chồng, URL ?ed=etp-mau~<loại>:<mã mẫu>), mở khi bấm một thẻ / một dòng trong lưới nhiều mẫu.
// Dữ liệu: cùng bản nhớ 'mau-cr' của tab (không truy vấn riêng). CHỈ ĐỌC + nút Chọn phim.
// ngan-moi-ok: chi tiết một mẫu — đã tra: etp-mau-phim là chọn phim cho mẫu, etp-mau-dung là dòng thời gian một việc dựng; chưa có ngăn nào cho chính mẫu
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (Drawer, Tabs, SiteFavicon) + các khối của tab Mẫu Creative
import { useEffect, useState } from 'react';
import { Drawer, SiteFavicon, Tabs } from '@/components/ui';
import { Dem, MO_SO } from '@/components/etp-so';
import { useSoNho } from '@/lib/so-nho';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { docMauCr, type MauCr, type MayDung } from '@/lib/actions/etp-mau-cr';
import { BanMauLuoi, DongPhimSx, MayDungDong, ORoi, TEN_GIONG, TEN_LOAI, TEN_NGUON, TEN_TT, docUrl, ghiUrl, hopKhuon, mayDung } from './etp-mau-cr';
import { DO, XANH } from './etp-doi-thu';

type TabMau = 'mau' | 'phim';
const Muc = ({ ten, children }: { ten: string; children: React.ReactNode }) => <>
  <div style={{ fontSize: 11.5, color: MO_SO, whiteSpace: 'nowrap' }}>{ten}</div><div style={{ fontSize: 12.5, minWidth: 0 }}>{children}</div></>;

/** dòng đầu của một mẫu: loại · vai · nguồn · nhóm + tên + đèn trạng thái */
export function DauMau({ m }: { m: MauCr | null }) {
  const tt = m ? TEN_TT[m.trang_thai] : null;
  return <div style={{ minWidth: 0 }}>
    <div className="id-line">{m ? [TEN_LOAI[m.loai], m.vai, TEN_NGUON[m.nguon], m.nhom_tk].filter(Boolean).join(' · ') : 'mẫu creative'}</div>
    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>{tt ? <span title={`${tt[0]} — ${tt[2]}`} style={{ width: 10, height: 10, borderRadius: 5, background: tt[1], flex: 'none' }} /> : null}{m?.ten ?? 'đang đọc…'}
      {tt ? <span style={{ fontSize: 12, fontWeight: 400, color: tt[1] }}>{tt[0]}</span> : null}</h2></div>;
}

export function ChiTietMau({ m, may }: { m: MauCr; /** trạng thái máy dựng (góp ý #1726) — hiện ở đầu tab Phim sản xuất */ may?: MayDung | null }) {
  const [tab, setTab] = useState<TabMau>(() => (docUrl('mxt') === 'phim' ? 'phim' : 'mau'));
  useEffect(() => { ghiUrl('mxt', tab === 'mau' ? null : tab); }, [tab]);
  useEffect(() => () => ghiUrl('mxt', null), []);
  const s = m.so, soCr = m.phim_sx.reduce((a, f) => a + f.cr.length, 0);
  const nutChon = <button type="button" onClick={() => openEntityDrawer('etp-mau-phim', m.ma)} title={mayDung(m)}
    style={{ fontSize: 12, padding: '3px 12px', borderRadius: 6, border: '1px solid var(--accent, #60a5fa)', background: 'transparent', color: 'var(--accent, #60a5fa)', cursor: 'pointer' }}>＋ Chọn phim</button>;
  return <>
    <div style={{ padding: '0 16px' }}><Tabs<TabMau> value={tab} onChange={setTab} right={nutChon} dinh={false}
      items={[{ key: 'mau', label: 'Mẫu' }, { key: 'phim', label: 'Phim sản xuất' }]} /></div>
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tab === 'mau' ? <>
        <BanMauLuoi m={m} cot={5} nhom />
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.mo_ta}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '6px 14px', alignItems: 'baseline' }}>
          <Muc ten="Quy trình triển khai">{m.quy_trinh.length ? <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>{m.quy_trinh.map((x) => <li key={x}>{x}</li>)}</ol>
            : <span style={{ color: MO_SO }}>chưa có máy dựng cho mẫu này — mới là mẫu tham chiếu, chọn phim chỉ ghi lại</span>}</Muc>
          {m.spec.map((x) => <Muc key={x.nhan} ten={x.nhan}>{x.gia}</Muc>)}
          {m.giong.length ? <Muc ten="Giọng đọc"><span style={{ display: 'inline-flex', flexWrap: 'wrap', columnGap: 12 }}>{m.giong.map((g) => { const r = g.chi > 0.5 ? ((g.thu - g.chi) / g.chi) * 100 : null;
            return <span key={g.k} title={`${g.n} creative · chi $${g.chi.toFixed(0)} · thu $${g.thu.toFixed(0)}`} style={{ whiteSpace: 'nowrap' }}>{TEN_GIONG[g.k] ?? 'khác'} <Dem v={g.n} />{r != null ? <span style={{ color: r >= 0 ? XANH : DO }}> {r.toFixed(0)}%</span> : null}</span>; })}</span></Muc> : null}
          {m.dung_cho.length ? <Muc ten="Dùng cho dạng">{m.dung_cho.join(' · ')}</Muc> : null}
          <Muc ten="Hợp thể loại phim">{m.the_loai.length ? m.the_loai.join(' · ') : <span style={{ color: MO_SO }}>mọi thể loại</span>}</Muc>
          {s ? <Muc ten="Số của nhà"><span style={{ fontVariantNumeric: 'tabular-nums' }}><Dem v={s.cr} /> creative nhà · camp đang chạy {s.dang_chay} / đã lên {s.camp} · chi ${s.chi.toFixed(0)} · thu ${s.thu.toFixed(0)} · ROI <ORoi s={s} /></span></Muc> : null}
          {m.tham_chieu.length ? <Muc ten="QC đối thủ gốc"><span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px 14px' }}>{m.tham_chieu.map((t) =>
            <a key={t.id} href={`https://href.li/?https://www.facebook.com/ads/library/?id=${t.id}`} target="_blank" rel="noreferrer" title="mở QC trong Thư viện QC Meta"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <SiteFavicon url="https://www.facebook.com" size={13} /><span title={t.con_chay ? 'còn chạy' : 'đã dừng'} style={{ width: 6, height: 6, borderRadius: 3, background: t.con_chay ? XANH : '#94a3b8' }} />
              {t.phim ?? 'QC đối thủ'} · {t.ngay ?? '?'} ngày ↗</a>)}</span></Muc> : null}
          <Muc ten="Máy dựng">{mayDung(m)}</Muc>
        </div>
      </> : <>
        <MayDungDong may={may} />
        <div style={{ fontSize: 12, color: MO_SO }}>{m.phim_sx.length} phim đã chọn · {soCr} creative đã ra — bấm một phim để xem từng bước và vấn đề theo dòng thời gian</div>
        {!m.phim_sx.length ? <div style={{ fontSize: 12.5, color: MO_SO }}>chưa chọn phim nào cho mẫu này — bấm ＋ Chọn phim ở góc phải</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{m.phim_sx.map((f) => <DongPhimSx key={f.content_id} f={f} ma={m.ma} />)}</div>}
      </>}
    </div>
  </>;
}

export function EtpMauDrawer({ khoa, onClose }: { khoa: string; onClose: () => void }) {
  const { so: du, loi } = useSoNho<{ mau: MauCr[]; phim: { id: number; ten: string }[]; may_dung?: MayDung; luc: string }>('mau-cr', docMauCr, 20_000, hopKhuon);
  const m = du?.mau.find((x) => `${x.loai}:${x.ma}` === khoa) ?? null;
  const dau = <div className="modal-head"><DauMau m={m} /><button className="modal-close" onClick={onClose}>✕</button></div>;
  if (!m) return <Drawer onClose={onClose} width={860} padding={0}>{dau}<div style={{ padding: 16, color: loi ? DO : MO_SO }}>{loi ?? (du ? 'không còn mẫu này trong sổ' : 'đang đọc sổ mẫu creative…')}</div></Drawer>;
  return <Drawer onClose={onClose} width={860} padding={0}>{dau}<ChiTietMau m={m} may={du?.may_dung} /></Drawer>;
}
