'use client';
// 🧭 Ngăn sửa KHUÔN CHUỖI của tập (khuon-chuoi.ts): thêm / bỏ lần áp khuôn, chọn shot cho từng bước, xem kiểm (vai đúng bước, đủ bước) ngay khi
// gán. Mở từ nút ✎ ở nhãn làn 🧭 Khuôn trên timeline. Lưu = luuKhuonChuoi (0đ, có ↶ hoàn tác qua chupTruoc).
import { useState } from 'react';
import { Ngan } from './ngan';
import { Chon, type LuaChon } from './chon';
import { Loi, mono, goiAction } from './ui';
import { luuKhuonChuoi } from '@/lib/actions';
import { KHUON_CHUOI, QUY_CHUAN_DONG, kiemKhuon, khuonTheoKey, hopTheLoai, type ApKhuon } from '@/lib/xuong-video/khuon-chuoi';
import type { TheLoai } from '@/lib/xuong-video/dien-anh';
import type { Canh } from '@/lib/xuong-video/kieu';

const MAU = { tot: 'var(--green, #4ade80)', vang: 'var(--amber)', do: 'var(--red)' } as const;

export function NganKhuon({ tapId, khuon, canh, theLoai, onClose, onLuu }: { tapId: number; khuon: ApKhuon[]; canh: Canh[]; theLoai?: TheLoai | ''; onClose: () => void; onLuu: () => Promise<void> }) {
  const [ds, setDs] = useState<ApKhuon[]>(() => khuon.map((a) => ({ ...a, shots: { ...a.shots } })));
  const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false);
  const qc = theLoai ? QUY_CHUAN_DONG[theLoai] : undefined;
  const chonKhuon: LuaChon[] = KHUON_CHUOI.map((k) => ({ value: k.key, label: k.ten, title: k.muc_dich, nhom: hopTheLoai(k, theLoai) ? 'Hợp dòng phim' : 'Dòng khác' }))
    .sort((a, b) => (a.nhom === b.nhom ? 0 : a.nhom === 'Hợp dòng phim' ? -1 : 1));
  const chonShot: LuaChon[] = canh.map((c) => ({ value: String(c.id), label: `#${c.thu_tu} · ${c.hanh_dong || c.canh}`, ngan: `#${c.thu_tu}`, nhom: c.phan_doan || undefined, phu: c.ky_thuat?.vai || undefined }));
  const sua = (i: number, f: (a: ApKhuon) => ApKhuon) => setDs((d) => d.map((a, j) => (j === i ? f(a) : a)));
  const luu = async () => {
    setBan(true); setLoi('');
    const r = await goiAction(() => luuKhuonChuoi(tapId, ds));
    setBan(false); setLoi(r.loi); if (!r.loi) { await onLuu(); onClose(); }
  };
  return (
    <Ngan onClose={onClose} tieuDe="🧭 Khuôn chuỗi của tập" nut={<button type="button" className="xv-btn chinh" disabled={ban} onClick={() => void luu()}>{ban ? 'đang lưu…' : 'Lưu'}</button>}>
      <div style={{ display: 'grid', gap: 12 }}>
        {qc && <div style={{ ...mono, fontSize: 11, lineHeight: 1.5 }}>Quy chuẩn dòng phim: {qc.luat.join(' · ')}</div>}
        {ds.map((a, i) => {
          const kh = khuonTheoKey(a.khuon);
          const k = kiemKhuon(a, canh, theLoai);
          return (
            <div key={i} style={{ border: `1px solid ${k ? MAU[k.muc] : 'var(--line)'}`, borderRadius: 8, padding: 10, display: 'grid', gap: 8, background: 'var(--bg-1)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chon value={a.khuon} onChange={(v) => sua(i, (x) => ({ ...x, khuon: v, shots: {} }))} options={chonKhuon} minWidth={240} title="Khuôn" />
                <input className="xv-in" style={{ flex: 1, minWidth: 200 }} placeholder="Ở đây khuôn làm gì (ý đạo diễn / kịch bản)" value={a.ghi ?? ''} onChange={(e) => sua(i, (x) => ({ ...x, ghi: e.target.value }))} />
                <button type="button" className="xv-btn" title="Bỏ lần áp này" onClick={() => setDs((d) => d.filter((_, j) => j !== i))}>🗑</button>
              </div>
              {kh && <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{kh.muc_dich}</div>}
              {kh?.buoc.map((b, bi) => {
                const vals = Object.entries(a.shots).filter(([, x]) => x === bi).map(([id]) => id);
                return (
                  <div key={bi} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 8, alignItems: 'center' }}>
                    <span title={`${b.ghi}\nvai cần: ${b.vai.join(' / ')}${b.luat?.length ? `\nluật nên có: ${b.luat.join(' / ')}` : ''}`} style={{ fontSize: 12 }}>
                      {bi + 1}. {b.ten}{b.tuy ? <span style={mono}> · tuỳ chọn</span> : b.nen ? <span style={mono}> · nên có</span> : null}
                    </span>
                    <Chon multi values={vals} options={chonShot} placeholder="chọn shot…" minWidth={220}
                      onValues={(v) => sua(i, (x) => { const s = { ...x.shots }; for (const [id, xb] of Object.entries(s)) if (xb === bi) delete s[id]; for (const id of v) s[id] = bi; return { ...x, shots: s }; })} />
                  </div>
                );
              })}
              {k && (k.loi.length > 0 || k.shots.some((s) => s.loi.length)) && (
                <div style={{ display: 'grid', gap: 2, fontSize: 11.5 }}>
                  {k.shots.filter((s) => s.loi.length).map((s) => <span key={s.id} style={{ color: MAU[s.muc] }}>#{canh.find((c) => c.id === s.id)?.thu_tu} {s.tenBuoc}: {s.loi.join(' · ')}</span>)}
                  {k.loi.map((l, j) => <span key={j} style={{ color: MAU[k.muc] }}>{l}</span>)}
                </div>
              )}
            </div>
          );
        })}
        <button type="button" className="xv-btn" onClick={() => setDs((d) => [...d, { khuon: (KHUON_CHUOI.find((k) => hopTheLoai(k, theLoai)) ?? KHUON_CHUOI[0]!).key, shots: {} }])}>＋ Thêm lần áp khuôn</button>
        <Loi>{loi}</Loi>
      </div>
    </Ngan>
  );
}
