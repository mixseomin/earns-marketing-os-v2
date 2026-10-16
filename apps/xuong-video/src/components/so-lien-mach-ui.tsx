'use client';
// SỔ LIỀN MẠCH trong drawer (anh 16/10/2026: "các phần theo dõi này phải show chi tiết trong drawer của nhân vật, của từng cảnh"; phim này là bản
// demo để học làm phim người thật → khuôn script supervisor: ngày truyện · cảnh · chỗ · dáng · hướng · trạng thái cơ thể / trang phục · đồ đang cầm).
//   <SoLienMachXem phimId ten />  drawer nhân vật: mọi tập có nhân vật đó, mỗi shot một dòng.
//   <SoLienMachXem tapId canh />  drawer cảnh: mọi nhân vật trong cảnh đó.
// Lỗi = câu của cổng lienMachTap (cùng nguồn với cổng keyframe + ⚠ trên lưới). Bấm số shot → mở drawer nguồn shot.
import { useEffect, useState } from 'react';
import { soLienMachAction } from '@/lib/actions';
import { bangNgoai, chuCho, chuDang, diemNhanVat, TRU_MUC, type DongSo, type MucLoi, type SoLienMach } from '@/lib/xuong-video/so-lien-mach';
import { goiAction } from './ui';
import { moNgan } from './ngan-chung';

type Ds = { tap: { id: number; so: number; ten: string }; so: SoLienMach }[];
const mono = { fontFamily: 'var(--mono, ui-monospace)', fontSize: 11 } as const;
const mauDiem = (d: number) => (d >= 90 ? '#4ade80' : d >= 70 ? '#facc15' : '#f87171');
const TEN_MUC: Record<MucLoi, string> = { chan: 'CHẶN', nang: 'nặng', thieu: 'thiếu', nhe: 'nhẹ', ghi: 'ghi chú' };
const LUONG: Record<DongSo['luong_moi'], string> = { '': '', ngay: '📅 sang ngày truyện mới — sổ reset hết', canh: '✂ cảnh mới (thời gian nhảy) — chỗ / dáng / đồ cầm reset', nhay: '⏭ shot khai cắt thời gian' };

export function SoLienMachXem(p: { phimId: number; ten: string } | { tapId: number; canh?: string }) {
  const [ds, setDs] = useState<Ds | null>(null); const [loi, setLoi] = useState('');
  const khoa = JSON.stringify(p);
  useEffect(() => {
    let huy = false;
    void goiAction(() => soLienMachAction('ten' in p ? { phimId: p.phimId, ten: p.ten } : { tapId: p.tapId })).then((r) => { if (huy) return; setLoi(r.loi); if (r.kq?.ok) setDs(r.kq.data); });
    return () => { huy = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khoa]);
  if (loi) return <div style={{ ...mono, color: '#f87171' }}>{loi}</div>;
  if (!ds) return <div style={{ ...mono, color: 'var(--fg-4)' }}>… đang đọc sổ</div>;
  if (!ds.length) return <div style={{ ...mono, color: 'var(--fg-4)' }}>Chưa có shot nào khai chỗ đứng (may_3d) cho {'ten' in p ? p.ten : 'cảnh này'}.</div>;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...mono, color: 'var(--fg-3)', lineHeight: 1.5 }}>
        Sổ của <b>script supervisor</b>: mỗi shot một dòng — nhân vật phải MỞ shot đúng chỗ / dáng / hướng / trạng thái / đồ cầm lúc KẾT lần cuối thấy, trừ khi sang
        <b> ngày truyện</b> khác (reset hết) hoặc <b>cảnh mới</b> (thời gian nhảy: reset chỗ, dáng, đồ cầm — trạng thái cơ thể như ướt, bẩn, trang phục giữ tới khi đổi ngày).
        {' '}<b style={{ color: '#4ade80' }}>nối #N</b> = <b>hookup</b> như xưởng hoạt hình: chỗ / hướng / dáng / trạng thái mở của shot TỰ NỐI từ lúc kết của shot #N — không khai lại; sửa chỗ kết shot trước là shot sau đổi theo.
      </div>
      {ds.map(({ tap, so }) => {
        const ten = 'ten' in p ? [p.ten] : Object.keys(so.nhanVat);
        const shotCanh = 'canh' in p && p.canh ? new Set(so.canh.find((c) => c.ten === p.canh)?.shot ?? []) : null;
        return (
          <section key={tap.id} style={{ display: 'grid', gap: 10 }}>
            {'ten' in p && <h3 style={{ margin: 0, fontSize: 13 }}>Tập {tap.so} · {tap.ten}</h3>}
            {ten.map((t) => {
              const dong = (so.nhanVat[t] ?? []).filter((d) => !shotCanh || shotCanh.has(d.thu_tu));
              if (!dong.length) return null;
              const soLoi = dong.filter((d) => d.muc.some((m) => m.muc !== 'ghi')).length;
              return (
                <div key={t} style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                  {!('ten' in p) && <div style={{ padding: '6px 10px', background: 'var(--bg-2)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <b style={{ fontSize: 13 }}>{t}</b>
                    <span style={{ ...mono, color: soLoi ? '#f87171' : '#4ade80' }} title={soLoi ? `${soLoi} shot đứt mạch` : 'liền mạch'}>{soLoi ? `⚠ đứt mạch` : '✓ liền mạch'}</span>
                  </div>}
                  <DiemDau ds={dong} />
                  <BangNgoai ds={dong} />
                  <table style={{ width: '100%', borderCollapse: 'collapse', ...mono }}>
                    <thead><tr style={{ color: 'var(--fg-4)', textAlign: 'left' }}>
                      {['Điểm', 'Shot', 'Cảnh · ngày', 'Chỗ mở → kết (cm)', 'Dáng', 'Hướng', 'Trạng thái / trang phục', 'Đồ cầm', 'Diễn'].map((h) => <th key={h} style={{ padding: '4px 8px', fontWeight: 500, borderBottom: '1px solid var(--line)' }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{dong.map((d) => (
                      <DongSoTr key={d.canhId} d={d} />
                    ))}</tbody>
                  </table>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function DongSoTr({ d }: { d: DongSo }) {
  const td = { padding: '4px 8px', borderTop: '1px solid var(--line)', verticalAlign: 'top' } as const;
  const loi = d.muc.some((m) => m.muc !== 'ghi'); const coGhi = d.muc.length > 0;
  return (<>
    {d.luong_moi && <tr><td colSpan={9} style={{ ...td, color: '#facc15', background: 'rgba(250,204,21,.06)' }}>{LUONG[d.luong_moi]}</td></tr>}
    <tr style={{ background: loi ? 'rgba(248,113,113,.08)' : undefined, opacity: d.an ? 0.6 : 1 }} title={d.an ? 'ngoài khung (ẩn) — vẫn tính liền mạch' : undefined}>
      <td style={{ ...td, color: mauDiem(d.diem), fontWeight: 700 }} title={d.muc.length ? d.muc.map((m) => `${TEN_MUC[m.muc]} −${m.tru}`).join(' · ') : 'không lỗi'}>{d.diem}</td>
      <td style={td}><button type="button" className="xv-lienket" onClick={() => moNgan({ loai: 'nguon', canhId: d.canhId })} style={{ ...mono }}>#{d.thu_tu}</button></td>
      <td style={{ ...td, color: 'var(--fg-3)' }}>{d.canh}{d.ngay ? ` · ${d.ngay}` : ''}</td>
      <td style={td}>{d.noi != null && <span style={{ color: '#4ade80' }} title={`chỗ / hướng / dáng / trạng thái mở NỐI từ lúc kết #${d.noi} (hookup) — sửa chỗ kết của #${d.noi} là shot này đổi theo`}>nối #{d.noi} · </span>}{chuCho(d.tam)}{d.den ? ` → ${chuCho(d.den)}` : ''}</td>
      <td style={{ ...td, color: d.nam !== d.nam_den ? '#facc15' : undefined }}>{chuDang(d)}</td>
      <td style={td}>{d.huong != null ? `${Math.round(d.huong)}°` : ''}{d.huong_den != null && d.huong_den !== d.huong ? ` → ${Math.round(d.huong_den)}°` : ''}</td>
      <td style={{ ...td, maxWidth: 260 }}>{d.trang || d.trang_den ? <span title={d.trang_den}>{d.trang || 'bình thường'}{d.trang_den !== d.trang ? ` → ${d.trang_den}` : ''}</span> : <span style={{ color: 'var(--fg-4)' }}>bình thường</span>}
        {d.ngoai.map((g) => <div key={g.k} style={{ color: 'var(--fg-3)' }}>{g.ten}: {g.mo || 'không'}{g.ket !== g.mo ? ` → ${g.ket || 'bỏ ra'}` : ''}</div>)}</td>
      <td style={td}>{d.cam ? `trong tay ${d.cam}` : ''}{d.chia ? ` · ${d.chia} mảnh` : ''}</td>
      <td style={{ ...td, color: 'var(--fg-3)' }}>{d.dien.join(', ')}</td>
    </tr>
    {coGhi && <tr><td colSpan={9} style={{ ...td, borderTop: 'none', paddingTop: 0 }}>{d.muc.map((m, i) => <div key={i} style={{ color: m.muc === 'chan' ? '#f87171' : m.muc === 'nhe' || m.muc === 'ghi' ? 'var(--fg-3)' : '#facc15' }}>
      <b>{TEN_MUC[m.muc]}{m.tru ? ` −${m.tru}` : ''}</b> · {m.chu}</div>)}</td></tr>}
  </>);
}

/** Bảng bề ngoài theo ngày (wardrobe plot): ngày truyện → trang phục / tóc / trang điểm / đồ trên người / vết, kèm shot. Không khai gì thì ẩn. */
function BangNgoai({ ds }: { ds: DongSo[] }) {
  const b = bangNgoai(ds); if (!b.length) return null;
  return <div style={{ ...mono, padding: '5px 10px', borderBottom: '1px solid var(--line)', display: 'grid', gap: 3 }} title="Bảng bề ngoài theo ngày truyện (wardrobe plot của script supervisor) — trong một ngày chỉ đổi khi khai _den trong shot">
    {b.map((n) => <div key={n.ngay}><b>📅 {n.ngay}</b>{n.muc.map((m) => <span key={m.ten} style={{ marginLeft: 10 }}>{m.ten}: {m.gia_tri.map((g) => `${g.t} (#${g.shot.join(', #')})`).join(' → ')}</span>)}</div>)}
  </div>;
}

/** Đầu bảng một nhân vật: điểm liền mạch trung bình / thấp nhất / số lỗi chặn + cách tính (mức × độ dễ thấy). */
function DiemDau({ ds }: { ds: DongSo[] }) {
  const d = diemNhanVat(ds);
  return <div style={{ ...mono, padding: '5px 10px', display: 'flex', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--line)' }}
    title={`Điểm liền mạch = 100 − tổng trừ. Mức: CHẶN −${TRU_MUC.chan} (phá logic truyện / vật lý, trừ đủ dù khó thấy) · nặng −${TRU_MUC.nang} · thiếu động tác −${TRU_MUC.thieu} · nhẹ −${TRU_MUC.nhe}; nặng / thiếu / nhẹ nhân độ dễ thấy (ngoài khung ×0,4, trong khung 0,6–1 theo % khung)`}>
    <span>điểm TB <b style={{ color: mauDiem(d.tb) }}>{d.tb}</b></span><span>thấp nhất <b style={{ color: mauDiem(d.thap) }}>{d.thap}</b></span>
    <span>lỗi chặn <b style={{ color: d.chan ? '#f87171' : '#4ade80' }}>{d.chan}</b></span>
  </div>;
}
