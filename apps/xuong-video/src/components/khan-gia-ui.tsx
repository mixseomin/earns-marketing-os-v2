'use client';
// 🎭 Ngăn sửa Ý ĐỒ KHÁN GIẢ của tập (khan-gia.ts): mỗi đoạn shot một hiệu ứng đạo diễn muốn khán giả cảm (vui · tò mò · hồi hộp · bất ngờ · đánh lừa A→B ·
// gieo phân vân · sợ…). Đánh lừa ghi A (khán giả tin) / B (sự thật) + shot lật. Máy soát theo luật ngành hiện ngay khi sửa. Mở từ nút ✎ ở nhãn làn 🎭
// trên timeline. Lưu = luuKhanGia (0đ, có ↶ hoàn tác qua chupTruoc).
import { useState } from 'react';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';
import { Chon, type LuaChon } from './chon';
import { Loi, mono, goiAction } from './ui';
import { luuKhanGia } from '@/lib/actions';
import { HIEU_UNG_KHAN_GIA, hieuUngKG, soatKhanGia, type YDoKhanGia, type MaKhanGia } from '@/lib/xuong-video/khan-gia';
import type { Canh } from '@/lib/xuong-video/kieu';

export function NganKhanGia({ tapId, ds: dau, canh, onClose, onLuu }: { tapId: number; ds: YDoKhanGia[]; canh: Canh[]; onClose: () => void; onLuu: () => Promise<void> }) {
  const [ds, setDs] = useState<YDoKhanGia[]>(() => dau.map((x) => ({ ...x })));
  const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false);
  const chonY: LuaChon[] = HIEU_UNG_KHAN_GIA.map((h) => ({ value: h.key, label: `${h.ic} ${h.ten}`, title: h.mo_ta }));
  const chonShot: LuaChon[] = canh.map((c) => ({ value: String(c.id), label: `#${c.thu_tu} · ${c.hanh_dong || c.canh}`, ngan: `#${c.thu_tu}`, nhom: c.phan_doan || undefined }));
  const sua = (i: number, f: (a: YDoKhanGia) => YDoKhanGia) => setDs((d) => d.map((a, j) => (j === i ? f(a) : a)));
  const soat = soatKhanGia(ds, canh);
  const them = () => { const c = canh[0]; if (c) setDs((d) => [...d, { y: 'to_mo', tu: c.id, den: c.id }]); };
  const luu = async () => {
    setBan(true); setLoi('');
    const r = await goiAction(() => luuKhanGia(tapId, ds));
    setBan(false); setLoi(r.loi); if (!r.loi) { await onLuu(); onClose(); }
  };
  return (
    <Ngan onClose={onClose} tieuDe="🎭 Ý đồ khán giả của tập" nut={<button type="button" className="xv-btn chinh" disabled={ban} onClick={() => void luu()}>{ban ? 'đang lưu…' : 'Lưu'}</button>}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ ...mono, fontSize: 11, lineHeight: 1.5 }}>Mỗi đoạn: từ shot nào tới shot nào, đạo diễn muốn khán giả cảm gì. Máy soát theo ngành: đánh lừa phải có cú lật · bất ngờ phải gieo trước · hồi hộp cần khán giả biết trước · hả hê / nhẹ nhõm đến sau căng thẳng.</div>
        {ds.map((a, i) => {
          const h = hieuUngKG(a.y); const k = soat[i]!;
          return (
            <div key={i} style={{ border: `1px solid ${k.loi.length ? 'var(--amber)' : 'var(--line)'}`, borderLeft: `3px solid ${h?.mau ?? 'var(--line)'}`, borderRadius: 8, padding: 10, display: 'grid', gap: 8, background: 'var(--bg-1)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chon value={a.y} onChange={(v) => sua(i, (x) => ({ ...x, y: v as MaKhanGia }))} options={chonY} minWidth={200} title="Khán giả cảm" />
                <Chon value={String(a.tu)} onChange={(v) => sua(i, (x) => ({ ...x, tu: Number(v) }))} options={chonShot} minWidth={150} title="Từ shot" />
                <span style={mono}>→</span>
                <Chon value={String(a.den)} onChange={(v) => sua(i, (x) => ({ ...x, den: Number(v) }))} options={chonShot} minWidth={150} title="Tới shot" />
                <button type="button" className="xv-btn" title="Xem hiệu ứng trong thư viện (ngành gọi, làm thế nào, tránh gì, nguồn)" onClick={() => moNgan({ loai: 'ky-thuat', ma: `khan_gia.${a.y}` })}>📖</button>
                <button type="button" className="xv-btn" title="Bỏ đoạn này" onClick={() => setDs((d) => d.filter((_, j) => j !== i))}>🗑</button>
              </div>
              <input className="xv-in" placeholder="Ý đạo diễn ở đoạn này (khán giả cảm gì, vì sao)" value={a.ghi ?? ''} onChange={(e) => sua(i, (x) => ({ ...x, ghi: e.target.value }))} />
              {a.y === 'danh_lua' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                  <input className="xv-in" placeholder="A — khán giả tin là…" value={a.a ?? ''} onChange={(e) => sua(i, (x) => ({ ...x, a: e.target.value }))} />
                  <input className="xv-in" placeholder="B — sự thật là…" value={a.b ?? ''} onChange={(e) => sua(i, (x) => ({ ...x, b: e.target.value }))} />
                  <Chon value={a.lat != null ? String(a.lat) : ''} onChange={(v) => sua(i, (x) => ({ ...x, lat: v ? Number(v) : undefined }))} options={chonShot} minWidth={150} title="Shot lật (lộ B)" placeholder="shot lật…" />
                </div>
              )}
              {k.loi.map((l, j) => <div key={j} style={{ fontSize: 11.5, color: 'var(--amber)' }}>⚠ {l}</div>)}
            </div>
          );
        })}
        <div><button type="button" className="xv-btn" onClick={them} disabled={!canh.length}>＋ Thêm đoạn</button></div>
        {loi && <Loi>{loi}</Loi>}
      </div>
    </Ngan>
  );
}
