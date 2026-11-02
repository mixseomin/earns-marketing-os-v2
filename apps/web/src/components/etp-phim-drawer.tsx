'use client';
// NGĂN PHIM etp (anh 02/11/2026 "Ko có khả năng xem nội dung phim đang có là gì!!!?") — loại 'etp-phim' của EntityDrawerHost (xếp chồng, đi theo URL ?ed=etp-phim~<mã>).
// Một màn, 3 cột (chuẩn ngăn kéo): [poster + xem tập 1] [lưới thông tin + bảng điểm chọn phim] [tóm tắt · cốt truyện · mô tả]. Tự tải theo mã (docPhimEtp).
import { useEffect, useState, type ReactNode } from 'react';
import { Drawer } from '@/components/ui';
import { Dem } from '@/components/etp-so';
import { docPhimEtp, type PhimNoiDung } from '@/lib/actions/etp-phim';

const MO = 'var(--fg-3)';
const ngoai = (u: string) => `https://href.li/?${u}`;   // link ra ngoài che referrer

function O({ nhan, children }: { nhan: string; children: ReactNode }) {
  return <div><div style={{ fontSize: 10.5, color: MO, textTransform: 'uppercase', letterSpacing: 0.4 }}>{nhan}</div><div style={{ fontSize: 13, marginTop: 2 }}>{children}</div></div>;
}
function Doan({ nhan, chu }: { nhan: string; chu: string | null }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10.5, color: MO, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{nhan}</div>
    {chu ? <div title={chu} style={{ fontSize: 12.5, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>{chu}</div>
      : <div style={{ color: MO }}>—</div>}</div>;
}

export function EtpPhimDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<PhimNoiDung | { loi: string } | null>(null);
  useEffect(() => {
    let song = true; setD(null);
    docPhimEtp(id).then((r) => { if (song) setD('ok' in r ? r.phim : r); }).catch((e) => { if (song) setD({ loi: String((e as Error).message) }); });
    return () => { song = false; };
  }, [id]);
  const dau = (ten: ReactNode) => <div className="modal-head"><div><div className="id-line">phim #{id}</div><h2 style={{ margin: 0 }}>{ten}</h2></div><button className="modal-close" onClick={onClose}>✕</button></div>;
  if (!d) return <Drawer onClose={onClose} width={1100} zIndex={300} padding={0}>{dau('Đang tải…')}<div style={{ padding: 16, color: MO }}>Đang đọc nội dung phim…</div></Drawer>;
  if ('loi' in d) return <Drawer onClose={onClose} width={1100} zIndex={300} padding={0}>{dau('Không mở được')}<div style={{ padding: 16, color: '#f87171' }}>{d.loi}</div></Drawer>;
  const p = d;
  return (
    <Drawer onClose={onClose} width={1100} zIndex={300} padding={0}>
      {dau(p.ten ?? `phim #${p.id}`)}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 300px 1fr', gap: 18, padding: 16 }}>
        <div>
          {p.anh ? <img src={p.anh} alt="" referrerPolicy="no-referrer" style={{ width: '100%', borderRadius: 8, display: 'block', border: '1px solid var(--line)' }} />
            : <div style={{ aspectRatio: '3 / 4', borderRadius: 8, border: '1px dashed var(--line)', display: 'grid', placeItems: 'center', color: MO }}>chưa có poster</div>}
          {p.url ? <a href={ngoai(p.url)} target="_blank" rel="noreferrer noopener" style={{ display: 'block', marginTop: 10, textAlign: 'center', padding: '7px 0', borderRadius: 6, border: '1px solid var(--line)', color: 'var(--accent, #38bdf8)', textDecoration: 'none', fontSize: 13 }}>Xem tập 1 ↗</a> : null}
          {p.loi_doc ? <div style={{ marginTop: 8, fontSize: 11.5, color: '#fbbf24' }}>{p.loi_doc}</div> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <O nhan="Nguồn">{p.nguon ?? <span style={{ color: MO }}>—</span>}</O>
            <O nhan="Tiếng">{(p.locale ?? '—').toUpperCase()}</O>
            <O nhan="Số tập">{p.so_tap ? p.so_tap : <span style={{ color: MO }}>—</span>}</O>
            <O nhan="QC FB đang bật">{p.diem?.qc_tra ? <Dem v={p.diem.qc_dang} /> : <span style={{ color: MO }} title="máy cào spy chưa tra phim này">—</span>}</O>
            <O nhan="Camp nhà · đội"><Dem v={p.camp.nha} /> · <Dem v={p.camp.doi} /></O>
            <O nhan="Đang chạy"><Dem v={p.camp.chay} /></O>
          </div>
          {p.the.length ? <O nhan="Thẻ"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{p.the.map((t) => <span key={t} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--line)', color: 'var(--fg-2)' }}>{t}</span>)}</div></O> : null}
          <O nhan="Điểm chọn phim">{p.diem ? <div>
            <div><b style={{ fontSize: 18 }}>{p.diem.diem}</b> <span style={{ color: MO }}>· hạng {p.diem.hang}/{p.diem.tong}</span></div>
            <table style={{ width: '100%', fontSize: 12, marginTop: 4, borderCollapse: 'collapse' }}><tbody>
              {p.diem.ct.map(([k, v]) => <tr key={k}><td style={{ padding: '2px 0', color: 'var(--fg-2)' }}>{k}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: !v ? MO : v < 0 ? '#f87171' : undefined }}>{v > 0 ? `+${v}` : v}</td></tr>)}
            </tbody></table></div> : <span style={{ color: MO }}>không nằm trong danh sách có thể test (đã lên camp, bị loại hoặc không qua lọc)</span>}</O>
          <O nhan="Trang phim workspace">{p.trang.length ? p.trang.map((t) => <div key={t.ws} style={{ fontSize: 12 }}>{t.nguoi ?? '?'}: {t.thieu.length ? <span style={{ color: '#f87171' }}>thiếu {t.thieu.join(', ')}</span> : <span style={{ color: '#4ade80' }}>✓</span>}</div>) : <span style={{ color: MO }}>—</span>}</O>
        </div>
        <div>
          <Doan nhan="Tóm tắt" chu={p.tom_tat} />
          <Doan nhan="Cốt truyện" chu={p.cot_truyen} />
          <Doan nhan="Mô tả" chu={p.mo_ta} />
        </div>
      </div>
    </Drawer>
  );
}
