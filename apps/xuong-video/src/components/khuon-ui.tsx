'use client';
// 🧭 Ngăn sửa KHUÔN CHUỖI của tập (khuon-chuoi.ts): thêm / bỏ lần áp khuôn, chọn shot cho từng bước, xem kiểm (vai đúng bước, đủ bước) ngay khi
// gán. Mở từ nút ✎ ở nhãn làn 🧭 Khuôn trên timeline. Lưu = luuKhuonChuoi (0đ, có ↶ hoàn tác qua chupTruoc).
import { useState } from 'react';
import { Ngan } from './ngan';
import { Chon, type LuaChon } from './chon';
import { Loi, mono, goiAction } from './ui';
import { luuKhuonChuoi, tachShot, chenShotKhuon } from '@/lib/actions';
import { KHUON_CHUOI, QUY_CHUAN_DONG, kiemKhuon, khuonTheoKey, hopTheLoai, buocCua, type ApKhuon } from '@/lib/xuong-video/khuon-chuoi';
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
  const [nhap, setNhap] = useState<Record<string, string>>({});   // chữ của nhịp tách / shot chèn đang gõ
  // Tách / chèn ĐỔI danh sách shot → lưu khuôn đang sửa trước (chỉ số lần áp khớp với máy chủ), làm, rồi nạp lại tập và đóng ngăn.
  const lam = async (fn: () => Promise<{ ok: boolean; loi?: string }>) => {
    setBan(true); setLoi('');
    const r0 = await goiAction(() => luuKhuonChuoi(tapId, ds));
    const r = r0.loi ? r0 : await goiAction(fn as () => Promise<{ ok: true; data: undefined }>);
    setBan(false); setLoi(r.loi); if (!r.loi) { await onLuu(); onClose(); }
  };
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
                const vals = Object.entries(a.shots).filter(([, x]) => buocCua(x).includes(bi)).map(([id]) => id);
                return (
                  <div key={bi} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 8, alignItems: 'center' }}>
                    <span title={`${b.ghi}\nvai cần: ${b.vai.join(' / ')}${b.luat?.length ? `\nluật nên có: ${b.luat.join(' / ')}` : ''}`} style={{ fontSize: 12 }}>
                      {bi + 1}. {b.ten}{b.tuy ? <span style={mono}> · tuỳ chọn</span> : b.nen ? <span style={mono}> · nên có</span> : null}
                    </span>
                    <Chon multi values={vals} options={chonShot} placeholder="chọn shot…" minWidth={220}
                      onValues={(v) => sua(i, (x) => {
                        // Một shot được gánh nhiều bước (shot dồn nhiều nhịp → timeline chia ô + gợi ý tách); bỏ chọn chỉ gỡ đúng bước này.
                        const s: ApKhuon['shots'] = {};
                        for (const [id, xb] of Object.entries(x.shots)) { const con = buocCua(xb).filter((b) => b !== bi); if (con.length) s[id] = con.length === 1 ? con[0]! : con; }
                        for (const id of v) { const cu = buocCua(s[id]); const moi = [...cu, bi].sort((a, b) => a - b); s[id] = moi.length === 1 ? moi[0]! : moi; }
                        return { ...x, shots: s };
                      })} />
                  </div>
                );
              })}
              {k?.shots.filter((x) => x.buocs.length > 1).map((x) => {
                const c = canh.find((y) => y.id === x.id); if (!c) return null;
                const tach = (c.hanh_dong || '').split(/;\s*|\.\s+(?=[A-ZÀ-Ỹ])/).map((t) => t.trim()).filter(Boolean);
                const phan = x.buocs.map((_, q) => nhap[`t${x.id}-${q}`] ?? (tach.length === x.buocs.length ? tach[q]! : q === 0 ? c.hanh_dong : ''));
                return (
                  <div key={`t${x.id}`} style={{ display: 'grid', gap: 4, padding: 8, border: '1px dashed var(--amber)', borderRadius: 6 }}>
                    <span style={{ fontSize: 12 }}>✂ #{c.thu_tu} gánh {x.buocs.length} bước — tách để mỗi nhịp có khung riêng (shot gốc giữ hình cũ, shot mới chưa có hình)</span>
                    {x.buocs.map((bi, q) => <input key={q} className="xv-in" value={phan[q]} placeholder={`nhịp ${q + 1}: ${kh?.buoc[bi]?.ten}`} onChange={(e) => setNhap((m) => ({ ...m, [`t${x.id}-${q}`]: e.target.value }))} />)}
                    <button type="button" className="xv-btn" disabled={ban || phan.some((t) => !t?.trim())} onClick={() => void lam(() => tachShot(x.id, phan as string[]))}>✂ Tách thành {x.buocs.length} shot · 0đ</button>
                  </div>
                );
              })}
              {k?.thieu.map((t) => {
                const sau = canh.find((c) => c.id === t.sau);
                const mo = nhap[`c${i}-${t.buoc}`] ?? '';
                return (
                  <div key={`c${t.buoc}`} style={{ display: 'grid', gap: 4, padding: 8, border: `1px dashed ${MAU[t.muc]}`, borderRadius: 6 }}>
                    <span style={{ fontSize: 12 }}>＋ Thiếu "{t.ten}" — {t.ghi}. Chèn {sau ? `sau #${sau.thu_tu}` : 'trước shot đầu của khuôn'}:</span>
                    <input className="xv-in" value={mo} placeholder="Hành động của shot mới (vd: Cận mặt Vivian, nụ cười đông cứng, mắt dại đi)" onChange={(e) => setNhap((m) => ({ ...m, [`c${i}-${t.buoc}`]: e.target.value }))} />
                    <button type="button" className="xv-btn" disabled={ban || !mo.trim()} onClick={() => void lam(() => chenShotKhuon(tapId, i, t.buoc, mo))}>＋ Chèn shot · 0đ (chưa sinh hình)</button>
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
