'use client';
// KHO CREATIVE THEO CONCEPT (concept.ts · actions-concept.ts) — 4 tab đầu của ngăn sản phẩm (anh 16–17/10/2026, demo "Kho creative JettJeans"):
// Concept (sub-avatar spy: path × mức nhận biết) · Template (cặp concept × template + biến thể diễn viên / bối cảnh) · Phương án (chữ từng ô)
// · Đề xuất (tổ hợp gom theo bộ hình, tên đọc được, duyệt → số cố định → tạo phim). Dải số đầu ngăn tự tính lại theo mọi thay đổi.
import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '@mos2/bang/data-table';
import { Seg, Pill, Nut, Loi, mono } from './ui';
import { useNho } from './nho';
import { TaoTuTemplate } from './template-ui';
import { tien } from '@/lib/xuong-video/kieu';
import { nhapConcept, batCap, themBienThe, suaBienThe, boBienThe, themPhuongAn, suaPhuongAn, boPhuongAn, uocVietPhuongAn, vietPhuongAn, uocVietHet, vietHet, duyetToHop, boCreative, gtCreative, taoPhimTuCreative, type KhoConcept } from '@/lib/actions-concept';
import { MUC_NB, mucNb, hopKhuon, toHopCap, trongVong, khacGoc, tienCapCents, tienBienTheCents, duKienCap, type Concept, type TplConcept, type Cap, type BienTheHinh, type ToHop, type Vong } from '@/lib/xuong-video/concept';

const tenT = (t: Pick<TplConcept, 'ten'>) => t.ten.replace(/\s*\(.*\)\s*$/, '');
const NbChip = ({ nb }: { nb: string }) => <b title={`${mucNb(nb).ten} — ${mucNb(nb).dung}`} style={{ color: mucNb(nb).mau, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{nb}</b>;
const capCua = (d: KhoConcept, c: number, t: number) => d.cap.find((x) => x.concept_id === c && x.template_id === t);
const btCua = (d: KhoConcept, capId: number) => d.bien_the.filter((b) => b.cap_id === capId);

/** Mọi số của kho: cặp bật, bộ hình, creative thực (đã có phương án) / dự kiến, tiền ước. */
export function soKho(d: KhoConcept) {
  const bat = d.cap.filter((c) => c.bat).map((cap) => ({ cap, c: d.concept.find((x) => x.id === cap.concept_id)!, t: d.tpl.find((x) => x.id === cap.template_id)! })).filter((x) => x.c && x.t);
  let thuc = 0, duKien = 0, cents = 0, boHinh = 0;
  for (const { cap, c, t } of bat) {
    const bt = btCua(d, cap.id); boHinh += bt.length;
    thuc += toHopCap(c, t, cap, bt, d.phuong_an).ds.length; duKien += duKienCap(t, bt.length); cents += tienCapCents(t, bt.length, d.gia);
  }
  return { bat, thuc, duKien, cents, boHinh };
}
export function DaiSoKho({ d }: { d: KhoConcept }) {
  const k = soKho(d), n = k.thuc || k.duKien;
  const o = (b: string, s: string, t?: string) => <span title={t} style={{ display: 'grid' }}><b style={{ fontFamily: 'var(--font-mono)', fontSize: 15 }}>{b}</b><span style={mono}>{s}</span></span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 26px', padding: '4px 2px 10px' }}>
      {o(String(d.concept.length), 'concept')}
      {o(String(k.boHinh), 'bộ hình', `${k.bat.length} cặp concept × template đang bật; mỗi biến thể diễn viên / bối cảnh một bộ hình`)}
      {o(n.toLocaleString('vi-VN'), k.thuc ? 'creative' : 'creative (dự kiến)', `ghép được ${k.thuc.toLocaleString('vi-VN')} · dự kiến khi đủ phương án ${k.duKien.toLocaleString('vi-VN')} · đã duyệt ${d.creative.filter((x) => x.trang_thai !== 'bo').length}`)}
      {o(`~${tien(k.cents)}`, 'tiền hình', `đơn giá thật 30 ngày: ${tien(d.gia.shot_cents)}/shot · ${tien(d.gia.kb_cents)}/bộ kịch bản · ${n ? tien(k.cents / n) : '—'}/creative`)}
    </div>
  );
}

// ── TAB CONCEPT ─────────────────────────────────────────────────────────────────────────────────────────────────
const catChu = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;
export function TabConcept({ d, spKey, onDoi, onChon }: { d: KhoConcept; spKey: string; onDoi: () => Promise<void>; onChon: (id: number) => void }) {
  const [ban, setBan] = useState(false), [loi, setLoi] = useState('');
  const nhap = async () => { setBan(true); setLoi(''); const r = await nhapConcept(spKey); setBan(false); if (!r.ok) { setLoi(r.loi); return; } await onDoi(); };
  const nut = <Nut ban={ban} ly={!d.spy_sp && 'sản phẩm chưa gắn nhóm spy'} onClick={() => void nhap()} title={`Đọc sub-avatar của nhóm spy${d.spy_sp ? ` #${d.spy_sp}` : ''} (0đ)`}>{d.concept.length ? '↻ Cập nhật từ spy' : '⬇ Nhập concept từ spy'}</Nut>;
  if (!d.concept.length) return <div style={{ padding: '20px 4px', display: 'grid', gap: 8, justifyItems: 'start' }}><b>Chưa có concept</b>{nut}<Loi>{loi}</Loi></div>;
  const path = [...new Map(d.concept.map((c) => [c.path, c.path_ten])).entries()];
  const cot = '64px repeat(5, minmax(0, 1fr))';
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div>{nut}</div><Loi>{loi}</Loi>
      <div style={{ display: 'grid', gridTemplateColumns: cot, gap: 6, alignItems: 'center' }}>
        <span />{MUC_NB.map((m) => <b key={m.key} title={`${m.ten} — ${m.dung}`} style={{ ...mono, color: m.mau, fontWeight: 700 }}>{m.key} · {m.ten}</b>)}
        {path.map(([p, ten]) => [
          <b key={p} title={ten} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p === 'chung' ? 'Chung' : p}</b>,
          ...MUC_NB.map((m) => { const c = d.concept.find((x) => x.path === p && x.nb === m.key);
            return c ? <button key={`${p}-${m.key}`} type="button" onClick={() => onChon(c.id)} title={`${c.ma} · ${c.ten}\n${ten}\nHook: ${c.du_lieu.hook}`}
              style={{ all: 'unset', cursor: 'pointer', minWidth: 0, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', borderLeft: `3px solid ${m.mau}`, display: 'grid', gap: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 600, ...catChu }}>{c.ma} · {c.ten}</span>
              <span style={mono}>{d.cap.filter((x) => x.concept_id === c.id && x.bat).length} template</span></button>
              : <span key={`${p}-${m.key}`} style={{ ...mono, textAlign: 'center' }}>·</span>; }),
        ])}
      </div>
    </div>
  );
}

// ── TAB TEMPLATE (+ biến thể diễn viên / bối cảnh) ───────────────────────────────────────────────────────────────
/** Tên ngắn của template cho tiêu đề cột: phần trước "(" , bỏ chữ thừa ("UGC", "Template") — tên đủ ở hover. */
const tenNgan = (t: Pick<TplConcept, 'ten'>) => tenT(t).replace(/^UGC\s+/i, '').replace(/\s*—.*$/, '').replace(/^Chuyện có thật.*/i, 'Chuyện thật').slice(0, 14);
export function TabTemplate({ d, onDoi, conceptId, setConceptId }: { d: KhoConcept; onDoi: () => Promise<void>; conceptId: number | null; setConceptId: (id: number) => void }) {
  const [sua, setSua] = useState<{ c: number; t: number } | null>(null);
  const [loi, setLoi] = useState('');
  if (!d.concept.length) return <span style={mono}>Nhập concept ở tab Concept trước.</span>;
  const bam = async (c: Concept, t: TplConcept) => {
    const cap = capCua(d, c.id, t.id); setConceptId(c.id);
    if (cap?.bat && !(sua?.c === c.id && sua.t === t.id)) { setSua({ c: c.id, t: t.id }); return; }   // ô đang bật: bấm lần đầu = mở biến thể, lần hai = tắt
    const r = await batCap(c.id, t.id, !cap?.bat); if (!r.ok) { setLoi(r.loi); return; }
    setSua(cap?.bat ? null : { c: c.id, t: t.id }); await onDoi();
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={mono}>✓ bật · ×N biến thể diễn viên · viền đứt = hợp mức nhận biết · bấm ô đã bật để sửa diễn viên, bấm lần nữa để tắt</span>
      <Loi>{loi}</Loi>
      <DataTable rows={d.concept} getRowKey={(c) => String(c.id)} minWidth={200 + d.tpl.length * 74} stickyFirst
        rowStyle={(c) => (c.id === conceptId ? { background: 'color-mix(in srgb, var(--cyan) 7%, transparent)' } : undefined)}
        columns={[
          { key: 'c', header: 'Concept', align: 'left', width: 200, cell: (c) => <span title={`${c.ma} · ${c.ten}`} style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0, maxWidth: 190 }}><b style={{ fontFamily: 'var(--font-mono)' }}>{c.ma}</b><NbChip nb={c.nb} /><span style={{ fontSize: 12, ...catChu }}>{c.ten}</span></span> },
          ...d.tpl.map((t): DataColumn<Concept> => ({ key: `t${t.id}`, header: tenNgan(t), title: `${tenT(t)} · ${t.so_shot} shot · ${t.giay}s`, align: 'center', width: 74,
            cell: (c) => { const cap = capCua(d, c.id, t.id), bat = !!cap?.bat, nv = cap ? btCua(d, cap.id).length : 0, goi = hopKhuon(t.khuon, c.nb), dang = sua?.c === c.id && sua.t === t.id;
              return <button type="button" onClick={(e) => { e.stopPropagation(); void bam(c, t); }} title={`${c.ma} × ${tenT(t)}${goi ? ` · hợp mức ${c.nb}` : ''}${bat ? ` · ${nv} biến thể` : ''}`}
                style={{ all: 'unset', cursor: 'pointer', width: 20, height: 20, borderRadius: 4, display: 'inline-grid', placeItems: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: bat ? '#06210f' : 'var(--fg-3)',
                  background: bat ? 'var(--lime)' : 'transparent', border: `1px ${goi ? 'dashed' : 'solid'} ${goi || bat ? 'var(--lime)' : 'var(--line)'}`, outline: dang ? '2px solid var(--cyan)' : undefined }}>{bat ? (nv > 1 ? `×${nv}` : '✓') : ''}</button>; } })),
        ]} />
      {sua && (() => { const c = d.concept.find((x) => x.id === sua.c), t = d.tpl.find((x) => x.id === sua.t), cap = c && t ? capCua(d, c.id, t.id) : undefined;
        return c && t && cap?.bat ? <BienThePanel key={cap.id} d={d} c={c} t={t} cap={cap} onDoi={onDoi} /> : null; })()}
    </div>
  );
}
const DA = ['da trắng', 'da đen', 'Latino', 'châu Á'];
function BienThePanel({ d, c, t, cap, onDoi }: { d: KhoConcept; c: Concept; t: TplConcept; cap: Cap; onDoi: () => Promise<void> }) {
  const ds = btCua(d, cap.id);
  const [loi, setLoi] = useState('');
  const chay = async (p: Promise<{ ok: boolean; loi?: string }>) => { const r = await p; if (!r.ok) setLoi(r.loi ?? 'lỗi'); else { setLoi(''); await onDoi(); } };
  const doiDa = (x: string) => { const cu = DA.find((d0) => x.includes(d0)); return cu ? x.replace(cu, DA[(DA.indexOf(cu) + 1) % DA.length]!) : `${x}${x ? ', ' : ''}${DA[1]}`; };
  const cuoi = ds[ds.length - 1]!;
  const them = (v: Partial<BienTheHinh>) => chay(themBienThe(cap.id, { nguoi_chinh: v.nguoi_chinh ?? cuoi.nguoi_chinh, nguoi_phu: v.nguoi_phu ?? cuoi.nguoi_phu, boi_canh: v.boi_canh ?? cuoi.boi_canh }));
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
      <span><b style={{ fontFamily: 'var(--font-mono)' }}>{c.ma} × T{t.id}</b> {tenT(t)} <span style={mono}>· {t.shot_ca}/{t.so_shot} shot có người / bối cảnh · mỗi biến thể thêm ~{tien(tienBienTheCents(t, d.gia))} · bộ hình cặp này ~{tien(tienCapCents(t, ds.length, d.gia))}</span></span>
      {!t.shot_ca ? <span style={mono}>Template này không có shot gắn nhân vật / bối cảnh — không có gì để đổi diễn viên.</span> : <>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 80px 70px', gap: 6, alignItems: 'center', ...mono }}><span>Mã</span><span>Người chính</span><span>Người phụ</span><span>Bối cảnh</span><span>Tiền thêm</span><span /></div>
        {ds.map((v) => <DongBienThe key={`${v.id}-${v.nguoi_chinh}-${v.nguoi_phu}-${v.boi_canh}`} v={v} gia={v.goc ? 'bộ gốc' : `+${tien(tienBienTheCents(t, d.gia))}`} onLuu={(x) => chay(suaBienThe(v.id, x))} onBo={v.goc ? undefined : () => chay(boBienThe(v.id))} />)}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Nut onClick={() => void them({ nguoi_chinh: doiDa(cuoi.nguoi_chinh) })}>+ đổi màu da người chính</Nut>
          <Nut onClick={() => void them({ nguoi_phu: doiDa(cuoi.nguoi_phu) })}>+ đổi màu da người phụ</Nut>
          <Nut onClick={() => void them({ boi_canh: '' })}>+ bối cảnh khác</Nut>

        </div></>}
      <Loi>{loi}</Loi>
    </div>
  );
}
function DongBienThe({ v, gia, onLuu, onBo }: { v: BienTheHinh; gia: string; onLuu: (x: { nguoi_chinh: string; nguoi_phu: string; boi_canh: string }) => void; onBo?: () => void }) {
  const [x, setX] = useState({ nguoi_chinh: v.nguoi_chinh, nguoi_phu: v.nguoi_phu, boi_canh: v.boi_canh });
  const doi = x.nguoi_chinh !== v.nguoi_chinh || x.nguoi_phu !== v.nguoi_phu || x.boi_canh !== v.boi_canh;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 80px 70px', gap: 6, alignItems: 'center' }}>
      <b style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>V{v.so}</b>
      {(['nguoi_chinh', 'nguoi_phu', 'boi_canh'] as const).map((k) => <input key={k} className="xv-in" value={x[k]} placeholder={k === 'boi_canh' ? 'như template' : k === 'nguoi_phu' ? '—' : ''} onChange={(e) => setX({ ...x, [k]: e.target.value })} onBlur={() => doi && onLuu(x)} />)}
      <span style={mono}>{gia}</span>
      {onBo ? <Nut nguy onClick={onBo} title="Bỏ biến thể (ẩn, không xoá)">Bỏ</Nut> : <span />}
    </div>
  );
}

// ── TAB PHƯƠNG ÁN ───────────────────────────────────────────────────────────────────────────────────────────────
/** VIẾT HẾT: một nút cho mọi cặp còn thiếu phương án (giá tổng trên nút); đang chạy → hỏi lại 5 giây, vẽ lại kho khi có phương án mới. */
function VietHet({ spKey, onDoi }: { spKey: string; onDoi: () => Promise<void> }) {
  const [u, setU] = useState<{ caps: number[]; cents: number; dang: { tong: number; xong: number; loi: number; cents: number; chay: boolean } | null } | null>(null);
  const [loi, setLoi] = useState('');
  const tai = async () => { const r = await uocVietHet(spKey); if (r.ok) setU(r.data); };
  useEffect(() => { void tai(); }, [spKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!u?.dang?.chay) return; const t = setTimeout(() => { void onDoi(); void tai(); }, 5000); return () => clearTimeout(t); }, [u]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!u) return null;
  const dg = u.dang;
  return <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
    {dg?.chay ? <span style={mono}>đang viết {dg.xong}/{dg.tong} cặp · {tien(dg.cents)}{dg.loi ? ` · ${dg.loi} lỗi` : ''}</span>
      : u.caps.length ? <Nut chinh gia={u.cents} onClick={() => void vietHet(spKey).then((r) => { if (!r.ok) setLoi(r.loi); else void tai(); })}
          title={`Một lượt Claude mỗi cặp, lần lượt ${u.caps.length} cặp còn thiếu phương án — TỐN TIỀN`}>✍ AI viết cho {u.caps.length} cặp còn thiếu · ~{tien(u.cents)}</Nut>
      : <span style={mono}>mọi cặp đã có phương án{dg ? ` · lượt vừa rồi ${dg.xong} cặp, ${tien(dg.cents)}${dg.loi ? `, ${dg.loi} lỗi` : ''}` : ''}</span>}
    {loi && <Loi>{loi}</Loi>}
  </span>;
}
export function TabPhuongAn({ d, spKey, onDoi, capId, setCapId }: { d: KhoConcept; spKey: string; onDoi: () => Promise<void>; capId: number | null; setCapId: (id: number) => void }) {
  const ds = soKho(d).bat;
  const x = ds.find((y) => y.cap.id === capId) ?? ds[0];
  const [uoc, setUoc] = useState<{ cap: number; cents: number; model: string } | null>(null);
  const [ban, setBan] = useState(false), [loi, setLoi] = useState(''), [moi, setMoi] = useState<Record<string, string>>({});
  const capX = x?.cap.id ?? null;
  useEffect(() => { if (capX != null) void uocVietPhuongAn(capX).then((r) => r.ok && setUoc({ cap: capX, cents: r.data.cents, model: r.data.model })); }, [capX, d.phuong_an.length]);
  if (!x) return <span style={mono}>Chưa có cặp concept × template nào đang bật — bật ở tab Template.</span>;
  const pa = d.phuong_an.filter((p) => p.cap_id === x.cap.id);
  const viet = async () => { setBan(true); setLoi(''); const r = await vietPhuongAn(x.cap.id); setBan(false); if (!r.ok) setLoi(r.loi); else await onDoi(); };
  const chay = async (p: Promise<{ ok: boolean; loi?: string }>) => { const r = await p; if (!r.ok) setLoi(r.loi ?? 'lỗi'); else await onDoi(); };
  const th = toHopCap(x.c, x.t, x.cap, btCua(d, x.cap.id), d.phuong_an);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <VietHet spKey={spKey} onDoi={onDoi} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="xv-in" style={{ maxWidth: 420 }} value={x.cap.id} onChange={(e) => setCapId(Number(e.target.value))} aria-label="cặp concept × template">
          {ds.map((y) => <option key={y.cap.id} value={y.cap.id}>{y.c.ma} · {y.c.ten} × T{y.t.id} {tenT(y.t)}</option>)}
        </select>
        <Nut chinh ban={ban} gia={uoc?.cap === x.cap.id ? uoc.cents : undefined} ly={!x.t.o_chu.length && 'template không có ô chữ'} onClick={() => void viet()} title={`Một lượt ${uoc?.model ?? 'Claude'} viết phương án cho ${x.t.o_chu.length} ô từ câu thật của khách — TỐN TIỀN`}>
          ✍ AI viết phương án{uoc?.cap === x.cap.id ? ` · ~${tien(uoc.cents)}` : ''}</Nut>
        <span style={mono}>{th.thieu.length ? `còn ${th.thieu.length} ô chưa có phương án — chưa ghép được creative` : `${th.ds.length.toLocaleString('vi-VN')} creative ghép được từ cặp này`}</span>
      </div>
      <Loi>{loi}</Loi>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
        {x.t.o_chu.map((o) => { const ds2 = pa.filter((p) => p.o === o.k).sort((a, b) => a.so - b.so);
          return <div key={o.k} style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{o.ten} <span style={mono}>· {o.loai} · {o.giay}s · {ds2.length} phương án</span></span>
            {ds2.map((p) => <PhuongAnO key={`${p.id}-${p.chu}`} chu={p.chu} so={p.so} nguon={p.nguon} onLuu={(c) => chay(suaPhuongAn(p.id, c))} onBo={() => chay(boPhuongAn(p.id))} />)}
            <span style={{ display: 'flex', gap: 4 }}>
              <input className="xv-in" placeholder={o.goi_y || 'thêm phương án tay…'} value={moi[o.k] ?? ''} onChange={(e) => setMoi({ ...moi, [o.k]: e.target.value })} />
              <Nut ly={!(moi[o.k] ?? '').trim() && 'gõ chữ trước'} onClick={() => void chay(themPhuongAn(x.cap.id, o.k, moi[o.k] ?? '')).then(() => setMoi({ ...moi, [o.k]: '' }))}>+</Nut>
            </span>
          </div>; })}
      </div>
    </div>
  );
}
function PhuongAnO({ chu, so, nguon, onLuu, onBo }: { chu: string; so: number; nguon: string; onLuu: (c: string) => void; onBo: () => void }) {
  const [x, setX] = useState(chu);
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', display: 'grid', gap: 4 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><b style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)' }}>{so}</b><span style={{ ...mono, flex: 1 }}>{nguon}</span>
        <button type="button" className="xv-lienket xv-mono" onClick={onBo} title="Bỏ phương án (ẩn, không xoá)">bỏ</button></span>
      <textarea className="xv-in" rows={2} value={x} onChange={(e) => setX(e.target.value)} onBlur={() => x.trim() && x !== chu && onLuu(x)} />
    </div>
  );
}

// ── TAB ĐỀ XUẤT (creative = tổ hợp) ──────────────────────────────────────────────────────────────────────────────
const VONG: { value: `${Vong}`; label: string; title: string }[] = [
  { value: '1', label: 'Vòng 1 · đổi hook', title: 'Chỉ đổi ô đầu (hook) — mọi ô khác và diễn viên giữ bản 1' },
  { value: '2', label: 'Vòng 2 · đổi diễn viên / bối cảnh', title: 'Chữ giữ bản 1, chỉ đổi biến thể hình' },
  { value: '3', label: 'Vòng 3 · đổi thân', title: 'Hook bản 1, diễn viên V1, đổi các ô sau hook' },
  { value: '0', label: 'Cả ma trận', title: 'Mọi tổ hợp' },
];
export function TabDeXuat({ d, spKey, onDoi, onMoPhim }: { d: KhoConcept; spKey: string; onDoi: () => Promise<void>; onMoPhim: (id: number) => void }) {
  const [vongS, setVong] = useNho<`${Vong}`>('xv-cp-vong', '1', ['0', '1', '2', '3'], 'cpvong');
  const vong = Number(vongS) as Vong;
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [het, setHet] = useState(200);
  const [tao, setTao] = useState<{ id: number; template_id: number; template_ten: string; ten: string; gt: Record<string, string> } | null>(null);
  const [loi, setLoi] = useState('');
  const daDuyet = useMemo(() => new Map(d.creative.map((c) => [c.ma, c])), [d.creative]);
  const nhom = useMemo(() => soKho(d).bat.map(({ cap, c, t }) => ({ cap, c, t, ds: toHopCap(c, t, cap, btCua(d, cap.id), d.phuong_an).ds.filter((x) => trongVong(x, t.o_chu, vong)) })).filter((g) => g.ds.length), [d, vong]);
  const tong = nhom.reduce((a, g) => a + g.ds.length, 0);
  const hien: { g: (typeof nhom)[number]; v: number; ds: ToHop[] }[] = [];
  let con = het;
  for (const g of nhom) for (const v of [...new Set(g.ds.map((x) => x.bien_the.so))]) { if (con <= 0) break; const ds = g.ds.filter((x) => x.bien_the.so === v).slice(0, con); con -= ds.length; hien.push({ g, v, ds }); }
  const doi = (ma: string) => { const s2 = new Set(chon); s2.has(ma) ? s2.delete(ma) : s2.add(ma); setChon(s2); };
  const tatCa = nhom.flatMap((g) => g.ds);
  const duyet = async (ds: ToHop[]) => { const r = await duyetToHop(spKey, ds.map((x) => ({ cap_id: x.cap_id, bien_the_id: x.bien_the.id, chon: x.chon, ma: x.ma }))); if (!r.ok) setLoi(r.loi); else { setChon(new Set()); await onDoi(); } };
  const bo = async (ma: string[]) => { const r = await boCreative(spKey, ma); if (!r.ok) setLoi(r.loi); else { setChon(new Set()); await onDoi(); } };
  const moTao = async (id: number) => { const r = await gtCreative(id); if (!r.ok) setLoi(r.loi); else setTao({ id, ...r.data }); };
  const chep = (ma: string) => { void navigator.clipboard?.writeText(ma).catch(() => undefined); };
  if (!tong) return <div style={{ display: 'grid', gap: 8 }}><Seg options={VONG} value={vongS} onChange={setVong} />
    <span style={mono}>Chưa ghép được creative nào ở vòng này — mỗi ô chữ của cặp cần ít nhất một phương án (tab Phương án).</span></div>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Seg options={VONG} value={vongS} onChange={setVong} />
        <span style={mono}>{tong.toLocaleString('vi-VN')} creative · đang chọn {chon.size}</span>
        <Nut chinh ly={!chon.size && 'chọn creative trước'} onClick={() => void duyet(tatCa.filter((x) => chon.has(x.ma)))}>Duyệt {chon.size} đã chọn</Nut>
        <Nut onClick={() => void duyet(tatCa.filter((x) => !daDuyet.has(x.ma) || daDuyet.get(x.ma)!.trang_thai === 'bo'))} title="Duyệt mọi creative của vòng đang xem (0đ — chỉ lưu kế hoạch)">Duyệt cả vòng ({tatCa.filter((x) => !daDuyet.has(x.ma) || daDuyet.get(x.ma)!.trang_thai === 'bo').length})</Nut>
        <Nut ly={![...chon].some((m) => daDuyet.get(m)?.trang_thai === 'duyet') && 'chọn creative đã duyệt'} onClick={() => void bo([...chon].filter((m) => daDuyet.get(m)?.trang_thai === 'duyet'))}>Bỏ duyệt</Nut>
      </div>
      <Loi>{loi}</Loi>
      {hien.map(({ g, v, ds }) => { const bt = ds[0]!.bien_the;
        return <div key={`${g.cap.id}-${v}`} style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'baseline', padding: '7px 10px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
            <b style={{ fontSize: 13 }}>{g.c.ten}</b><NbChip nb={g.c.nb} /><span style={{ fontSize: 12 }}>· {tenT(g.t)}</span>
            {g.t.shot_ca > 0 && <span style={mono}>· V{bt.so} {[bt.nguoi_chinh, bt.nguoi_phu, bt.boi_canh].filter((x) => x && x !== '—').join(' · ') || 'như template'}</span>}
            <span style={mono}>· {ds.length} creative</span>
          </div>
          {ds.map((x) => { const cr = daDuyet.get(x.ma), hook = d.phuong_an.find((p) => p.cap_id === x.cap_id && p.o === g.t.o_chu[0]?.k && p.so === x.chon[g.t.o_chu[0]?.k ?? '']);
            const khac = khacGoc(x, g.t.o_chu, d.phuong_an).filter((k) => k.ten !== `V${x.bien_the.so}`);
            return <div key={x.ma} style={{ display: 'grid', gridTemplateColumns: '20px 48px minmax(0, 1fr) auto', gap: 8, alignItems: 'start', padding: '6px 10px', borderBottom: '1px solid var(--line)' }}>
              <input type="checkbox" checked={chon.has(x.ma)} onChange={() => doi(x.ma)} aria-label={`chọn ${x.ma}`} />
              <b style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: cr && cr.trang_thai !== 'bo' ? 'var(--fg-1)' : 'var(--fg-4)' }} title={cr ? `số cố định #${cr.so}` : 'chưa duyệt — chưa có số'}>{cr && cr.trang_thai !== 'bo' ? `#${cr.so}` : '·'}</b>
              <span style={{ display: 'grid', gap: 3, minWidth: 0 }}><span style={{ fontSize: 13 }}>{hook?.chu ?? '—'}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{khac.length ? khac.map((k) => <span key={k.ten} style={{ fontSize: 11, padding: '0 6px', borderRadius: 99, background: 'color-mix(in srgb, var(--cyan) 14%, transparent)', color: 'var(--cyan)' }} title={k.chu}>{k.ten}: {k.chu.slice(0, 46)}{k.chu.length > 46 ? '…' : ''}</span>) : <span style={mono}>thân · kết như bản 1</span>}</span></span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {cr?.trang_thai === 'da_tao' && cr.phim_id ? <button type="button" className="xv-lienket xv-mono" onClick={() => onMoPhim(cr.phim_id!)}>phim #{cr.phim_id}</button>
                  : cr?.trang_thai === 'duyet' ? <Nut onClick={() => void moTao(cr.id)} title="Tạo phim từ template với diễn viên, bối cảnh và chữ đã chọn (0đ)">Tạo phim</Nut> : <Pill color="var(--fg-3)">đề xuất</Pill>}
                <button type="button" className="xv-lienket xv-mono" onClick={() => chep(x.ma)} title={`Mã QC (tên quảng cáo để quy kết quả): ${x.ma} — bấm để chép`}>mã QC</button>
              </span>
            </div>; })}
        </div>; })}
      {tong > het && <Nut onClick={() => setHet(het + 400)}>Xem thêm ({(tong - het).toLocaleString('vi-VN')} creative)</Nut>}
      {tao && <TaoTuTemplate templateId={tao.template_id} tenTemplate={tao.template_ten} gtDau={tao.gt} onClose={() => setTao(null)}
        taoBang={(ten, gt) => taoPhimTuCreative(tao.id, ten, gt)} onTao={(id) => { setTao(null); void onDoi(); onMoPhim(id); }}
        dauNgan={<div style={{ ...mono, marginBottom: 8 }}>{tao.ten} — ô điền sẵn từ concept, diễn viên / bối cảnh và phương án đã chọn; kiểm rồi tạo.</div>} />}
    </div>
  );
}
