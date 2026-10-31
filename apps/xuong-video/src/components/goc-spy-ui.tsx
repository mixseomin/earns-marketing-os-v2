'use client';
// GÓC SPY của phim QC (goc-spy.ts): chip "👤 Chân dung · …", "😣 Nỗi đau · …" — bấm là sang spy.on.tc mở đúng ngăn bằng chứng của góc đó.
// ChipGocSpy dùng ở danh sách phim + đầu tab Phim; GocSpyPanel (tab 📖 Phim) chọn góc thẳng từ kho spy (đọc API spy cùng box).
import { useEffect, useState, type CSSProperties } from 'react';
import { dsSpSpy, dsGocSpy, luuGocSpy, spGoiYSpy, type SpSpy } from '@/lib/actions';
import { LOAI_GOC_SPY, linkGocSpy, linkSpSpy, loaiGocSpy, xepGocSpy, type GocSpy } from '@/lib/xuong-video/goc-spy';
import type { Phim } from '@/lib/xuong-video/kieu';
import { Nut, Loi, LinkNgoai, mono, goiAction } from './ui';
import { Chon } from './chon';

const chip: CSSProperties = { display: 'inline-flex', gap: 4, alignItems: 'baseline', padding: '1px 8px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', fontSize: 11.5, textDecoration: 'none', maxWidth: 360 };

/** toiDa = số chip hiện trên dòng danh sách (YDNI mục 10: 4–6 chip góc làm mỗi phim thành hai dòng); phần còn lại gom thành "+n" có title liệt kê. */
export function ChipGocSpy({ ds, gon, toiDa }: { ds: GocSpy[]; gon?: boolean; toiDa?: number }) {
  if (!ds.length) return null;
  const xep = xepGocSpy(ds);
  const hien = toiDa && xep.length > toiDa ? xep.slice(0, toiDa) : xep;
  const conLai = xep.slice(hien.length);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {hien.map((g) => {
        const l = loaiGocSpy(g.loai);
        return (
          <LinkNgoai key={g.id} href={linkGocSpy(g)} style={chip} title={`${l.ten}: ${g.ten}${g.mo_ta ? ` — ${g.mo_ta}` : ''}\nBấm để mở góc này trên spy.on.tc ở tab mới (bằng chứng: bài, bình luận, QC đối thủ)`}>
            <span>{l.ic}</span>{!gon && <span style={{ color: 'var(--fg-3)' }}>{l.ten}</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.ten}</span>
          </LinkNgoai>
        );
      })}
      {conLai.length > 0 && <LinkNgoai href={linkGocSpy(conLai[0]!)} style={{ ...chip, color: 'var(--fg-3)' }} title={`${conLai.length} góc nữa:\n${conLai.map((g) => `${loaiGocSpy(g.loai).ic} ${loaiGocSpy(g.loai).ten}: ${g.ten}`).join('\n')}\nBấm để mở trên spy.on.tc ở tab mới`}>+{conLai.length}</LinkNgoai>}
    </div>
  );
}

export function GocSpyPanel({ phim, onChanged }: { phim: Phim; onChanged: () => Promise<void> }) {
  const daCo = phim.goc_spy ?? [];
  const [sua, setSua] = useState(false);
  const [chon, setChon] = useState<GocSpy[]>(daCo);
  const [dsSp, setDsSp] = useState<SpSpy[]>([]);
  const [sp, setSp] = useState<number>(daCo[0]?.sp ?? 0);
  const [goc, setGoc] = useState<(GocSpy & { so_nhac: number })[]>([]);
  const [loi, setLoi] = useState('');
  const [ban, setBan] = useState(false);
  useEffect(() => { if (!sua) setChon(phim.goc_spy ?? []); }, [phim.goc_spy, sua]);
  useEffect(() => { if (!sua || dsSp.length) return; void dsSpSpy().then((r) => (r.ok ? setDsSp(r.data) : setLoi(r.loi))); }, [sua, dsSp.length]);
  // chưa gắn gì → gợi ý nhóm đã dùng cho video khác cùng sản phẩm (một sản phẩm = một nhóm spy)
  useEffect(() => { if (!sua || sp) return; void spGoiYSpy(phim.id).then((r) => { if (r.ok && r.data) setSp(r.data); }); }, [sua, sp, phim.id]);
  useEffect(() => { if (!sua || !sp) return; setGoc([]); void dsGocSpy(sp).then((r) => (r.ok ? setGoc(r.data) : setLoi(r.loi))); }, [sua, sp]);

  const luu = async () => {
    setBan(true);
    const r = await goiAction(() => luuGocSpy(phim.id, chon));
    setBan(false); setLoi(r.loi);
    if (!r.loi) { setSua(false); await onChanged(); }
  };
  const thuSp = new Set(chon.filter((g) => g.sp === sp).map((g) => String(g.id)));
  const datGocSp = (ids: string[]) => {
    const moi = goc.filter((g) => ids.includes(String(g.id))).map(({ so_nhac: _n, ...g }) => g);
    setChon(xepGocSpy(moi));   // một video = một nhóm spy: góc nhóm khác bỏ khi chọn ở nhóm này
  };
  const tenSp = (id: number) => dsSp.find((x) => x.id === id)?.ten ?? `#${id}`;

  if (!sua) return (
    <div className="xv-panel" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', flexWrap: 'wrap' }}>
      <b style={{ fontSize: 13 }}>🎯 Góc từ spy</b>
      {daCo.length ? <ChipGocSpy ds={daCo} /> : <span style={mono}>chưa gắn góc nào — video này nhắm ai, đánh vào nỗi đau / mong muốn nào trên spy.on.tc</span>}
      <button type="button" className="xv-btn" onClick={() => setSua(true)}>✎ {daCo.length ? 'Sửa góc' : 'Gắn góc'}</button>
    </div>
  );
  return (
    <div className="xv-panel">
      <h3>🎯 Góc từ spy<small>MỘT nhóm spy đúng sản phẩm đang bán (đổi nhóm là bỏ góc nhóm cũ) → tick các góc video này khai thác; chip bấm sang đúng góc bên spy</small></h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <Chon value={sp ? String(sp) : ''} onChange={(v) => { setSp(Number(v)); setChon(chon.filter((g) => g.sp === Number(v))); }} placeholder="Nhóm sản phẩm trên spy…" minWidth={260}
          options={dsSp.map((x) => ({ value: String(x.id), label: x.ten, phu: `#${x.id}` }))} />
        {sp > 0 && <LinkNgoai href={linkSpSpy(sp)} className="xv-lienket xv-mono" title="Mở nhóm này trên spy.on.tc ở tab mới">mở “{tenSp(sp)}” trên spy ↗</LinkNgoai>}
        {sp > 0 && <Chon multi values={[...thuSp]} onValues={datGocSp} placeholder={goc.length ? `Tick góc (${goc.length})…` : 'đang tải góc…'} minWidth={320}
          options={LOAI_GOC_SPY.flatMap((l) => goc.filter((g) => g.loai === l.key).map((g) => ({ value: String(g.id), label: g.ten, nhom: `${l.ic} ${l.ten}`, phu: `${g.so_nhac} người`, title: g.mo_ta })))} />}
      </div>
      <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
        {xepGocSpy(chon).map((g) => (
          <div key={g.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <ChipGocSpy ds={[g]} />
            <button type="button" className="xv-btn" style={{ padding: '0 6px' }} title="Bỏ góc này" onClick={() => setChon(chon.filter((x) => x.id !== g.id))}>✕</button>
          </div>
        ))}
        {!chon.length && <span style={mono}>chưa chọn góc nào</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Nut chinh ban={ban} onClick={() => void luu()}>Lưu góc</Nut>
        <button type="button" className="xv-btn" onClick={() => { setSua(false); setChon(daCo); setLoi(''); }}>Huỷ</button>
      </div>
      <Loi>{loi}</Loi>
    </div>
  );
}
