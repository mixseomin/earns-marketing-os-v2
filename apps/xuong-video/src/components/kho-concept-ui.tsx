'use client';
// KHO CREATIVE THEO CONCEPT (concept.ts · actions-concept.ts) — 4 tab đầu của ngăn sản phẩm (anh 16–17/10/2026, demo "Kho creative JettJeans"):
// Concept (sub-avatar spy: path × mức nhận biết) · Template (cặp concept × template + biến thể diễn viên / bối cảnh) · Phương án (chữ từng ô)
// · Đề xuất (tổ hợp gom theo bộ hình, tên đọc được, duyệt → số cố định → tạo phim). Dải số đầu ngăn tự tính lại theo mọi thay đổi.
import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '@mos2/bang/data-table';
import { Seg, Pill, Nut, Loi, LinkNgoai, mono } from './ui';
import { Chon } from './chon';
import { linkGocSpy } from '@/lib/xuong-video/goc-spy';
import { Ngan } from './ngan';
import { useNho } from './nho';
import { TaoTuTemplate } from './template-ui';
import { tien, LOAI_SHOT_MAU } from '@/lib/xuong-video/kieu';
import { nhapConcept, batCap, themBienThe, suaBienThe, boBienThe, themPhuongAn, suaPhuongAn, boPhuongAn, uocVietPhuongAn, vietPhuongAn, uocVietHet, vietHet, duyetToHop, boCreative, gtCreative, taoPhimTuCreative, xuatCreative, type KhoConcept } from '@/lib/actions-concept';
import { MUC_NB, mucNb, hopKhuon, toHopCap, trongVong, khacGoc, tienCapCents, tienDungRiengCents, tienBienTheCents, duKienCap, type Concept, type TplConcept, type Cap, type BienTheHinh, type ToHop, type Vong } from '@/lib/xuong-video/concept';

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
        <Chon value={String(x.cap.id)} onChange={(v) => setCapId(Number(v))} minWidth={320} title="cặp concept × template"
          options={ds.map((y) => ({ value: String(y.cap.id), label: `${y.c.ma} · ${y.c.ten} × T${y.t.id} ${tenT(y.t)}`, nhom: `${y.c.ma} · ${y.c.ten}` }))} />
        <Nut chinh ban={ban} gia={uoc?.cap === x.cap.id ? uoc.cents : undefined} ly={!x.t.o_chu.length && 'template không có ô chữ'} onClick={() => void viet()} title={`Một lượt ${uoc?.model ?? 'Claude'} viết phương án cho ${x.t.o_chu.length} ô từ câu thật của khách — TỐN TIỀN`}>
          ✍ AI viết phương án{uoc?.cap === x.cap.id ? ` · ~${tien(uoc.cents)}` : ''}</Nut>
        <span style={mono}>{th.thieu.length ? `còn ${th.thieu.length} ô chưa có phương án — chưa ghép được creative` : `${th.ds.length.toLocaleString('vi-VN')} creative ghép được từ cặp này`}</span>
      </div>
      <Loi>{loi}</Loi>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
        {x.t.o_chu.map((o) => { const ds2 = pa.filter((p) => p.o === o.k).sort((a, b) => a.so - b.so);
          return <div key={o.k} style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
            <span style={{ display: 'grid', gap: 1 }} title={`ô {{${o.k}}}`}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-2)' }}>{LOAI_SHOT_MAU.find((l) => l.key === o.loai)?.ten ?? o.loai} <span style={mono}>· {o.giay}s · {ds2.length} phương án</span></span>
              <span style={{ ...mono, ...catChu }}>{o.ten}</span></span>
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

// ── BẢNG CREATIVE DUY NHẤT (anh 17/10/2026: "một bảng duy nhất là danh sách creative và bộ lọc chi tiết là xong") ──────────────────────────────
// Mỗi dòng = một creative (concept × template × diễn viên × một phương án mỗi ô). Lọc: concept · mức nhận biết · template · diễn viên · trạng thái · vòng test
// + ô tìm chữ của bảng. Bấm dòng → bung toàn bộ chữ của creative theo thứ tự shot. Nhập concept / bật template / sửa phương án nằm trong ⚙ Cấu hình.
type DongCr = ToHop & { c: Concept; t: TplConcept; hook: string; khac: { ten: string; chu: string }[] };
const TT_CR = [{ value: '', label: 'Mọi trạng thái' }, { value: 'de_xuat', label: 'Đề xuất' }, { value: 'duyet', label: 'Đã duyệt' }, { value: 'da_tao', label: 'Đã thành phim' }];
const VONG_LOC = [{ value: '', label: 'Mọi tổ hợp' }, { value: '1', label: 'Vòng 1 · đổi hook' }, { value: '2', label: 'Vòng 2 · đổi diễn viên' }, { value: '3', label: 'Vòng 3 · đổi thân' }];
/** Bộ hình = một cặp concept × template × một biến thể diễn viên — đơn vị SẢN XUẤT (keyframe + video làm một lần), các creative của nó chỉ khác chữ. */
type BoHinh = { key: string; c: Concept; t: TplConcept; v: BienTheHinh; ds: DongCr[] };
export function KhoCreative({ d, spKey, phim, onDoi, onMoPhim }: { d: KhoConcept; spKey: string; phim: { id: number; anh: string | null; ket: string; nac: { ten: string; tt: string }[] }[]; onDoi: () => Promise<void>; onMoPhim: (id: number) => void }) {
  const [cfg, setCfg] = useState<{ cap: number | null } | null>(null);
  const [lc, setLc] = useNho<string>('xv-kc-c', '', ['', ...d.concept.map((c) => String(c.id))], 'kcc');
  const [lnb, setLnb] = useNho<string>('xv-kc-nb', '', ['', ...MUC_NB.map((m) => m.key)], 'kcnb');
  const [lt, setLt] = useNho<string>('xv-kc-t', '', ['', ...d.tpl.map((t) => String(t.id))], 'kct');
  const [lv, setLv] = useNho<string>('xv-kc-v', '', ['', '1', '2', '3', '4', '5', '6', '7', '8'], 'kcv');
  const [ltt, setLtt] = useNho<string>('xv-kc-tt', '', TT_CR.map((x) => x.value), 'kctt');
  const [lvong, setLvong] = useNho<string>('xv-kc-vong', '1', VONG_LOC.map((x) => x.value), 'kcvong');
  const [q, setQ] = useState('');
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [mo, setMo] = useState<string | null>(null);
  const [soBo, setSoBo] = useState(8);
  const [tao, setTao] = useState<{ id: number; template_id: number; template_ten: string; ten: string; gt: Record<string, string> } | null>(null);
  const [loi, setLoi] = useState('');
  const [dangXuat, setDangXuat] = useState<Set<number>>(new Set());
  useEffect(() => { if (!dangXuat.size) return; const t = setTimeout(() => { void onDoi(); }, 6000); return () => clearTimeout(t); }, [dangXuat, d]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!dangXuat.size) return; const con = new Set([...dangXuat].filter((id) => !d.creative.find((c) => c.id === id)?.xuat)); if (con.size !== dangXuat.size) setDangXuat(con); }, [d.creative]); // eslint-disable-line react-hooks/exhaustive-deps
  const daDuyet = useMemo(() => new Map(d.creative.map((c) => [c.ma, c])), [d.creative]);
  const phimId = useMemo(() => new Map(phim.map((x) => [x.id, x])), [phim]);
  const tat: DongCr[] = useMemo(() => soKho(d).bat.flatMap(({ cap, c, t }) => toHopCap(c, t, cap, btCua(d, cap.id), d.phuong_an).ds.map((x) => ({ ...x, c, t,
    hook: d.phuong_an.find((p) => p.cap_id === cap.id && p.o === t.o_chu[0]?.k && p.so === x.chon[t.o_chu[0]?.k ?? ''])?.chu ?? '—',
    khac: khacGoc(x, t.o_chu, d.phuong_an).filter((k) => k.ten !== `V${x.bien_the.so}`) }))), [d]);
  const ttCua = (x: DongCr) => { const cr = daDuyet.get(x.ma); return !cr || cr.trang_thai === 'bo' ? 'de_xuat' : cr.trang_thai; };
  const qq = q.trim().toLowerCase();
  const rows = tat.filter((x) => (!lc || String(x.c.id) === lc) && (!lnb || x.c.nb === lnb) && (!lt || String(x.t.id) === lt) && (!lv || String(x.bien_the.so) === lv)
    && (!ltt || ttCua(x) === ltt) && (!lvong || trongVong(x, x.t.o_chu, Number(lvong) as Vong))
    && (!qq || `${x.hook} ${x.c.ten} ${tenT(x.t)} ${x.khac.map((k2) => k2.chu).join(' ')} ${x.bien_the.nguoi_chinh} ${x.bien_the.boi_canh}`.toLowerCase().includes(qq)));
  const bo: BoHinh[] = [];
  for (const x of rows) { const key = `${x.cap_id}|${x.bien_the.id}`; let b = bo.find((y) => y.key === key); if (!b) { b = { key, c: x.c, t: x.t, v: x.bien_the, ds: [] }; bo.push(b); } b.ds.push(x); }
  const duyet = async (ds: DongCr[]) => { const r = await duyetToHop(spKey, ds.map((x) => ({ cap_id: x.cap_id, bien_the_id: x.bien_the.id, chon: x.chon, ma: x.ma }))); if (!r.ok) setLoi(r.loi); else { setChon(new Set()); await onDoi(); } };
  const boDuyet = async (ma: string[]) => { const r = await boCreative(spKey, ma); if (!r.ok) setLoi(r.loi); else { setChon(new Set()); await onDoi(); } };
  const moTao = async (id: number) => { const r = await gtCreative(id); if (!r.ok) setLoi(r.loi); else setTao({ id, ...r.data }); };
  const chuaDuyet = rows.filter((x) => ttCua(x) === 'de_xuat');
  const k = soKho(d);
  const doiChon = (ma: string) => { const s2 = new Set(chon); s2.has(ma) ? s2.delete(ma) : s2.add(ma); setChon(s2); };
  const tienRieng = tat.reduce((a, x) => a + tienDungRiengCents(x.t, d.gia), 0);
  const spyAv = d.spy_sp ? `https://spy.on.tc/#/goc?sp=${d.spy_sp}&t=av` : null;
  const cot = (b: BoHinh): DataColumn<DongCr>[] => [
    { key: 'chon', header: '', width: 28, align: 'center', cell: (x) => <input type="checkbox" checked={chon.has(x.ma)} onChange={() => doiChon(x.ma)} onClick={(e) => e.stopPropagation()} aria-label={`chọn ${x.ma}`} /> },
    { key: 'so', header: '#', width: 52, align: 'left', sortValue: (x) => daDuyet.get(x.ma)?.so ?? 1e9, cell: (x) => { const cr = daDuyet.get(x.ma); return cr && cr.trang_thai !== 'bo' ? <b style={{ fontFamily: 'var(--font-mono)' }}>#{cr.so}</b> : <span style={mono}>·</span>; } },
    { key: 'hook', header: 'Hook', title: b.t.o_chu[0]?.ten, align: 'left', sortValue: (x) => x.hook, cell: (x) => <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 500, ...catChu }}>{x.hook}</span>, cellTitle: (x) => x.hook },
    { key: 'khac', header: 'Khác bản 1', align: 'left', width: '34%', cell: (x) => <span style={{ fontSize: 11.5, color: 'var(--cyan)', display: 'block', ...catChu }}>{x.khac.map((k2) => `${k2.ten}: ${k2.chu}`).join(' · ') || <span style={mono}>thân · kết như bản 1</span>}</span>, cellTitle: (x) => x.khac.map((k2) => `${k2.ten}: ${k2.chu}`).join('\n') },
    { key: 'tt', header: 'Trạng thái', align: 'left', width: 150, sortValue: (x) => ttCua(x), cell: (x) => { const cr = daDuyet.get(x.ma), goc = x.bien_the.phim_id ?? null;
      // DÙNG LẠI CLIP: creative đầu của bộ hình tạo PHIM GỐC; các creative khác xuất từ clip của phim gốc (chỉ thay chữ + giọng)
      if (!cr || cr.trang_thai === 'bo') return <Pill color="var(--fg-3)">đề xuất</Pill>;
      if (cr.phim_id && cr.phim_id === goc) return <button type="button" className="xv-lienket xv-mono" onClick={(e) => { e.stopPropagation(); onMoPhim(cr.phim_id!); }} title="phim gốc của bộ hình — sản xuất hình / clip ở đây">🎬 phim gốc #{cr.phim_id}</button>;
      if (cr.phim_id) return <button type="button" className="xv-lienket xv-mono" onClick={(e) => { e.stopPropagation(); onMoPhim(cr.phim_id!); }}>🎬 phim #{cr.phim_id}</button>;
      if (!goc) return <Nut onClick={() => void moTao(cr.id)} title="Tạo PHIM GỐC của bộ hình từ creative này (0đ) — sinh hình / clip một lần ở phim gốc, các creative khác cùng bộ hình xuất từ clip đó">Tạo phim gốc</Nut>;
      const san = phimId.get(goc)?.nac.find((k2) => k2.ten === 'Clip')?.tt === 'xong';
      return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
        {cr.xuat?.url && <LinkNgoai href={cr.xuat.url} className="xv-lienket xv-mono" title={`xuất ${new Date(cr.xuat.luc).toLocaleString('vi-VN')}${cr.xuat.canh_bao?.length ? ` · ${cr.xuat.canh_bao.join(' · ')}` : ''}`}>▶ bản xuất</LinkNgoai>}
        {dangXuat.has(cr.id) ? <span style={mono}>đang xuất…</span>
          : <Nut ly={!san && 'phim gốc chưa đủ clip — sinh clip ở phim gốc trước'} onClick={() => void xuatCreative(cr.id).then((r) => { if (!r.ok) setLoi(r.loi); else setDangXuat(new Set([...dangXuat, cr.id])); })}
              title="Xuất từ clip của phim gốc, chỉ thay chữ màn + giọng câu đổi (giọng đọc lại theo câu, ~vài cent; hình 0đ)">{cr.xuat?.url ? '↻' : '⬇ Xuất'}</Nut>}
      </span>; } },
  ];
  /** Kịch bản một creative = dải thẻ theo shot (như storyboard): số · loại shot · giây, câu chữ, nguồn — để review đúng chữ trước khi duyệt. */
  const kichBan = (x: DongCr) => <div style={{ display: 'grid', gap: 10, padding: '4px 0 2px', fontFamily: 'var(--font-sans)' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
      {x.t.o_chu.map((o, i) => { const p = d.phuong_an.find((y) => y.cap_id === x.cap_id && y.o === o.k && y.so === x.chon[o.k]), ban = x.chon[o.k] ?? 1;
        return <div key={o.k} title={`ô {{${o.k}}} · ${o.ten}`} style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-1)', border: `1px solid ${ban !== 1 ? 'color-mix(in srgb, var(--cyan) 55%, transparent)' : 'var(--line)'}`, minHeight: 92 }}>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <b style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, width: 18, height: 18, borderRadius: 99, display: 'inline-grid', placeItems: 'center', background: 'var(--bg-2)', color: 'var(--fg-2)' }}>{i + 1}</b>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-2)' }}>{LOAI_SHOT_MAU.find((l) => l.key === o.loai)?.ten ?? o.loai}</span>
            <span style={{ ...mono, marginLeft: 'auto' }}>{o.giay}s</span>
            {ban !== 1 && <span style={{ fontSize: 10, padding: '0 6px', borderRadius: 99, background: 'color-mix(in srgb, var(--cyan) 16%, transparent)', color: 'var(--cyan)' }}>bản {ban}</span>}
          </span>
          <span style={{ fontSize: 14.5, lineHeight: 1.35, fontWeight: 600, color: 'var(--fg-1)' }}>{p?.chu ?? '—'}</span>
          {p?.nguon && <span style={{ fontSize: 11, color: 'var(--fg-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.nguon}</span>}
        </div>; })}
    </div>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="xv-btn" onClick={() => void navigator.clipboard?.writeText(x.ma).catch(() => undefined)} title="Chép mã QC — đặt làm tên quảng cáo để kết quả quy về đúng creative">⧉ mã QC <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>{x.ma}</span></button>
      {(x.c.du_lieu.goc ?? []).length > 0 && d.spy_sp && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span style={mono}>bằng chứng</span>
        {(x.c.du_lieu.goc ?? []).slice(0, 4).map((g, n2) => <LinkNgoai key={g} href={linkGocSpy({ id: g, sp: d.spy_sp! })} className="xv-btn" title={`góc #${g} trên spy — câu thật của khách`}>spy {n2 + 1} ↗</LinkNgoai>)}</span>}
      <button type="button" className="xv-btn" onClick={() => setCfg({ cap: x.cap_id })}>✎ Sửa câu chữ</button>
    </div>
  </div>;
  const anhBo = (b: BoHinh) => b.ds.map((x) => daDuyet.get(x.ma)?.phim_id).map((id) => (id ? phimId.get(id) : undefined)).find((p) => p?.anh);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: '6px 14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={mono} title={`đơn giá thật 30 ngày: ${tien(d.gia.shot_cents)}/shot · ${tien(d.gia.kb_cents)}/bộ kịch bản`}><b style={{ color: 'var(--fg-1)', fontSize: 13 }}>{tat.length.toLocaleString('vi-VN')}</b> creative trên <b style={{ color: 'var(--fg-1)', fontSize: 13 }}>{k.boHinh}</b> bộ hình · {d.creative.filter((x) => x.trang_thai !== 'bo').length} đã duyệt</span>
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline' }} title="Dùng lại clip: mỗi bộ hình chỉ sản xuất MỘT phim gốc; các creative khác của bộ hình bấm ⬇ Xuất — dựng từ clip phim gốc, chỉ thay chữ màn + giọng câu đổi. Dựng riêng = mỗi creative một phim (tạo phim từ template sinh lại shot có chữ đổi).">
          <span style={{ ...mono, color: 'var(--amber)' }}>nếu dựng riêng từng creative ~{tien(tienRieng)}</span><span style={mono}>→</span>
          <span style={{ ...mono, color: 'var(--lime)' }}>dùng lại clip ~{tien(k.cents)}</span></span>
        <span style={{ flex: 1 }} />
        {spyAv && <LinkNgoai href={spyAv} className="xv-lienket xv-mono" title="Sub-avatar của nhóm spy — gốc của mọi người mua">người mua trên spy ↗</LinkNgoai>}
        <Nut onClick={() => setCfg({ cap: null })} title="Nhập concept từ spy · bật / tắt template · diễn viên · sửa phương án chữ">⚙ Cấu hình</Nut>
      </div>
      {!d.concept.length ? <span style={mono}>Chưa có concept — bấm ⚙ Cấu hình → Nhập concept từ spy.</span> : <>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="xv-in" style={{ width: 200 }} placeholder="tìm chữ trong creative…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="tìm chữ" />
          <Chon nho title="Người mua" value={lc} onChange={setLc} minWidth={150} options={[{ value: '', label: 'Mọi người mua' }, ...d.concept.map((c) => ({ value: String(c.id), label: `${c.ma} · ${c.ten}` }))]} />
          <Chon nho title="Mức nhận biết" value={lnb} onChange={setLnb} minWidth={150} options={[{ value: '', label: 'Mọi mức nhận biết' }, ...MUC_NB.map((m) => ({ value: m.key, label: `${m.key} · ${m.ten}` }))]} />
          <Chon nho title="Template" value={lt} onChange={setLt} minWidth={150} options={[{ value: '', label: 'Mọi template' }, ...d.tpl.filter((t) => d.cap.some((c) => c.bat && c.template_id === t.id)).map((t) => ({ value: String(t.id), label: tenT(t) }))]} />
          <Chon nho title="Diễn viên" value={lv} onChange={setLv} minWidth={150} options={[{ value: '', label: 'Mọi diễn viên' }, ...[...new Set(tat.map((x) => x.bien_the.so))].sort().map((v) => ({ value: String(v), label: `V${v}` }))]} />
          <Chon nho title="Trạng thái" value={ltt} onChange={setLtt} minWidth={150} options={TT_CR} />
          <Chon nho title="Vòng test" value={lvong} onChange={setLvong} minWidth={150} options={VONG_LOC} />
          {(lc || lnb || lt || lv || ltt || lvong || q) && <button type="button" className="xv-lienket xv-mono" onClick={() => { setLc(''); setLnb(''); setLt(''); setLv(''); setLtt(''); setLvong(''); setQ(''); }}>bỏ lọc</button>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Nut chinh ly={!chon.size && 'tick creative trước'} onClick={() => void duyet(tat.filter((x) => chon.has(x.ma)))}>Duyệt {chon.size} đã chọn</Nut>
          <Nut ly={!chuaDuyet.length && 'không còn creative chưa duyệt trong bộ lọc'} onClick={() => void duyet(chuaDuyet)} title="Duyệt mọi creative đang lọc (0đ — chỉ lưu kế hoạch, cấp số cố định)">Duyệt {chuaDuyet.length} đang lọc</Nut>
          <Nut ly={![...chon].some((m) => daDuyet.get(m)?.trang_thai === 'duyet') && 'tick creative đã duyệt'} onClick={() => void boDuyet([...chon].filter((m) => daDuyet.get(m)?.trang_thai === 'duyet'))}>Bỏ duyệt</Nut>
          <span style={mono}>{rows.length.toLocaleString('vi-VN')} creative · {bo.length} bộ hình đang lọc</span>
        </div>
        <Loi>{loi}</Loi>
        {bo.slice(0, soBo).map((b) => { const a = anhBo(b), boPhim = new Set(b.ds.map((x) => daDuyet.get(x.ma)?.phim_id).filter(Boolean)).size;
          const tienBo = b.v.so === 1 ? tienCapCents(b.t, 1, d.gia) : tienBienTheCents(b.t, d.gia), m = mucNb(b.c.nb);
          return <div key={b.key} style={{ border: '1px solid var(--line)', borderLeft: `3px solid ${m.mau}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '8px 10px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 40, height: 56, borderRadius: 4, border: '1px solid var(--line)', background: a?.anh ? `center / cover no-repeat url(${a.anh}), #111` : 'var(--bg-1)', display: 'grid', placeItems: 'center', ...mono }} title={a ? 'ảnh phim của bộ hình' : 'chưa sản xuất'}>{a ? '' : '—'}</span>
              <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', minWidth: 0 }}>
                  {spyAv ? <LinkNgoai href={spyAv} className="xv-lienket" title={`${b.c.du_lieu.nguoi}\nmở sub-avatar trên spy`} style={{ fontWeight: 600, fontSize: 13 }}>{b.c.ma} · {b.c.ten}</LinkNgoai> : <b>{b.c.ma} · {b.c.ten}</b>}
                  <NbChip nb={b.c.nb} /><span style={mono} title={m.dung}>{m.ten}</span>
                </span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', ...mono }}>
                  <button type="button" className="xv-lienket xv-mono" onClick={() => onMoPhim(b.t.id)} title={`mở template #${b.t.id}: ${b.t.so_shot} shot · ${b.t.giay}s`}>🧩 {tenT(b.t)}</button>
                  {b.t.shot_ca > 0 && <span title={[b.v.nguoi_chinh, b.v.nguoi_phu, b.v.boi_canh].filter((v) => v && v !== '—').join(' · ')}>👤 V{b.v.so} {[b.v.nguoi_chinh, b.v.boi_canh].filter(Boolean).join(' · ').slice(0, 60)}</span>}
                  <button type="button" className="xv-lienket xv-mono" onClick={() => setCfg({ cap: b.ds[0]!.cap_id })}>✎ phương án</button>
                </span>
              </span>
              <span style={{ display: 'grid', justifyItems: 'end', gap: 2, ...mono }} title="Dùng lại clip: bộ hình sản xuất một lần, mỗi creative chỉ thay chữ màn + giọng khi xuất">
                <span>{b.v.phim_id ? <button type="button" className="xv-lienket xv-mono" onClick={() => onMoPhim(b.v.phim_id!)} title={phimId.get(b.v.phim_id)?.nac.map((k2) => `${k2.ten}: ${k2.tt}`).join(' · ')}>🎬 phim gốc #{b.v.phim_id} · {phimId.get(b.v.phim_id)?.ket ?? ''}</button> : '🎬 chưa có phim gốc'} → <b style={{ color: 'var(--fg-1)' }}>{b.ds.length}</b> creative · {b.ds.filter((x) => daDuyet.get(x.ma)?.xuat?.url).length} đã xuất{boPhim > 1 ? ` · ${boPhim} phim` : ''}</span>
                <span><span style={{ color: 'var(--amber)' }}>riêng ~{tien(b.ds.length * tienDungRiengCents(b.t, d.gia))}</span> · <span style={{ color: 'var(--lime)' }}>dùng lại ~{tien(tienBo)}</span></span>
              </span>
            </div>
            <DataTable rows={b.ds} columns={cot(b)} getRowKey={(x) => x.ma} minWidth={760} fixedLayout stickyFirst={false} persistKey="xv-kho-creative"
              onRowClick={(x) => setMo(mo === x.ma ? null : x.ma)} renderExpanded={(x) => (mo === x.ma ? kichBan(x) : null)} />
          </div>; })}
        {bo.length > soBo && <Nut onClick={() => setSoBo(soBo + 8)}>Xem thêm {Math.min(8, bo.length - soBo)} bộ hình ({bo.length - soBo} còn lại)</Nut>}
      </>}
      {cfg && <CauHinhKho d={d} spKey={spKey} onDoi={onDoi} capDau={cfg.cap} onClose={() => setCfg(null)} />}
      {tao && <TaoTuTemplate templateId={tao.template_id} tenTemplate={tao.template_ten} gtDau={tao.gt} onClose={() => setTao(null)}
        taoBang={(ten, gt) => taoPhimTuCreative(tao.id, ten, gt)} onTao={(id) => { setTao(null); void onDoi(); onMoPhim(id); }}
        dauNgan={<div style={{ ...mono, marginBottom: 8 }}>{tao.ten} — ô điền sẵn từ người mua, diễn viên và phương án đã chọn; kiểm rồi tạo.</div>} />}
    </div>
  );
}
/** ⚙ CẤU HÌNH kho (ẩn mặc định): nhập concept · template + diễn viên · phương án chữ — ba màn quản trị cũ, gom vào một ngăn. */
function CauHinhKho({ d, spKey, onDoi, onClose, capDau }: { d: KhoConcept; spKey: string; onDoi: () => Promise<void>; onClose: () => void; capDau: number | null }) {
  const [tab, setTab] = useState<'concept' | 'template' | 'phuong_an'>(capDau ? 'phuong_an' : 'concept');
  const [conceptId, setConceptId] = useState<number | null>(null), [capId, setCapId] = useState<number | null>(capDau);
  return (
    <Ngan onClose={onClose} tieuDe="⚙ Cấu hình kho creative" dau={<Seg options={[{ value: 'concept' as const, label: 'Người mua (concept)' }, { value: 'template' as const, label: 'Template · diễn viên' }, { value: 'phuong_an' as const, label: 'Phương án chữ' }]} value={tab} onChange={setTab} />}>
      {tab === 'concept' && <TabConcept d={d} spKey={spKey} onDoi={onDoi} onChon={(id) => { setConceptId(id); setTab('template'); }} />}
      {tab === 'template' && <TabTemplate d={d} onDoi={onDoi} conceptId={conceptId} setConceptId={setConceptId} />}
      {tab === 'phuong_an' && <TabPhuongAn d={d} spKey={spKey} onDoi={onDoi} capId={capId} setCapId={setCapId} />}
    </Ngan>
  );
}
