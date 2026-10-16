'use client';
// Sổ nguồn AI (nguon-ai.ts) — ngăn chung mở từ header: Bảng giá · Nguồn · Khớp nội dung · Ổn định · Tham khảo. Bấm dòng = ngăn chi tiết chồng lên.
// Giá chỉ hiện kèm link trang chứa giá (giaHien); tiền thật đã trừ lấy từ sổ job, mở sổ chi phí để đối chiếu.
import { useEffect, useMemo, useState } from 'react';
import { dsNguonAi, doiTrangThaiNguon, themNguonModel } from '@/lib/actions';
import { LOAI_NGUON, TEN_TRANG_THAI, VIEC_NGUON, fmtVnd, giaHien, mucOnDinh, tiLeDat, vndMoiLuot, type LoaiNguon, type Nguon, type NguonModel, type O } from '@/lib/xuong-video/nguon-ai';
import { Seg, Loi, LinkNgoai, mono, goiAction } from './ui';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';
import { useNho } from './nho';

type Tab = 'gia' | 'nguon' | 'khop' | 'odinh' | 'tk';
const MAU_TT: Record<string, string> = { dang: 'var(--green, #4ade80)', co_tk: 'var(--amber)', tham_khao: 'var(--fg-4)', ngung: 'var(--fg-4)' };
const MAU_OD = { do: 'var(--red)', vang: 'var(--amber)', tot: '#4ade80' } as const;
const th: React.CSSProperties = { ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--bg-1)', cursor: 'default' };
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', fontSize: 12.5 };
const so: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' };

function Cham({ tt }: { tt: string }) { return <span title={TEN_TRANG_THAI[tt as keyof typeof TEN_TRANG_THAI]} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: MAU_TT[tt] ?? 'var(--fg-4)', marginRight: 6, verticalAlign: 'middle' }} />; }
function OnDinhO({ m }: { m: NguonModel }) {
  const t = tiLeDat(m.on_dinh), muc = mucOnDinh(m.on_dinh);
  if (t == null || !muc) return <span style={{ ...mono, color: 'var(--fg-4)' }}>chưa đo</span>;
  return <span title={`${m.on_dinh!.dat}/${m.on_dinh!.goi} lượt đạt`}><span style={{ display: 'inline-block', width: 52, height: 5, borderRadius: 3, background: 'var(--line)', verticalAlign: 'middle', marginRight: 6, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.round(t * 100)}%`, background: MAU_OD[muc] }} /></span><span style={mono}>{Math.round(t * 100)}%</span></span>;
}
/** Giá luôn bọc link trang chứa giá; không có link thì không có giá. */
function Gia({ m, dam }: { m: NguonModel; dam?: boolean }) {
  const g = giaHien(m);
  if (g == null) return <span style={{ color: 'var(--fg-4)' }} title={m.gia_goc || 'chưa có giá kèm nguồn'}>—</span>;
  return <LinkNgoai href={m.link} title={`${m.gia_goc} · đọc ${m.ngay_doc ?? '?'}`} style={{ color: 'inherit', fontWeight: dam ? 700 : 500 }}>{fmtVnd(g)}</LinkNgoai>;
}
function Khop({ k, tat }: { k: O[]; tat: string }) {
  return <>{VIEC_NGUON.map((v, i) => k[i] === 1 ? <span key={v} className="xv-pill" style={{ color: '#4ade80', marginRight: 3 }}>{v}</span> : k[i] === -1 ? <span key={v} className="xv-pill" title={tat} style={{ color: 'var(--red)', marginRight: 3 }}>cấm {v}</span> : null)}</>;
}

export function SoNguonAi() {
  const [d, setD] = useState<{ nguon: Nguon[]; model: NguonModel[] } | null>(null);
  const [loi, setLoi] = useState('');
  const [tab, setTab] = useNho<Tab>('xv-nguon-tab', 'gia', ['gia', 'nguon', 'khop', 'odinh', 'tk']);
  const [loai, setLoai] = useNho<LoaiNguon>('xv-nguon-loai', 'video', ['video', 'anh', 'giong', 'am', 'chu']);
  const [tt, setTt] = useState<'tat_ca' | 'dang' | 'chua'>('tat_ca');
  const [tim, setTim] = useState('');
  const [sap, setSap] = useState<{ k: 'gia' | 'odinh' | 'giay' | 'model'; tang: boolean }>({ k: 'gia', tang: true });
  const [mo, setMo] = useState<{ model: number } | { nguon: string } | null>(null);
  const tai = async () => { const r = await goiAction(() => dsNguonAi()); setLoi(r.loi); if (r.kq?.ok) setD(r.kq.data); };
  useEffect(() => { void tai(); }, []);
  const ng = useMemo(() => new Map((d?.nguon ?? []).map((n) => [n.key, n])), [d]);
  const ttM = (m: NguonModel) => ng.get(m.nguon_key)?.trang_thai ?? 'tham_khao';
  const dv = LOAI_NGUON.find((l) => l.key === loai)!.donVi;
  if (!d) return <div style={mono}>{loi || 'đang tải…'}</div>;

  const dsLoai = d.model.filter((m) => m.loai === loai);
  const dsGia = dsLoai.filter((m) => (tt === 'tat_ca' || (tt === 'dang' ? ttM(m) === 'dang' : ttM(m) !== 'dang')) && (!tim.trim() || `${m.model} ${m.goi} ${ng.get(m.nguon_key)?.ten}`.toLowerCase().includes(tim.trim().toLowerCase())))
    .sort((a, b) => { const v = (m: NguonModel) => sap.k === 'gia' ? giaHien(m) ?? 1e12 : sap.k === 'odinh' ? tiLeDat(m.on_dinh) ?? -1 : sap.k === 'giay' ? m.on_dinh?.giay ?? 1e9 : m.model; const x = v(a), y = v(b); return (x > y ? 1 : x < y ? -1 : 0) * (sap.tang ? 1 : -1); });
  const maxGia = Math.max(1, ...dsGia.map((m) => giaHien(m) ?? 0));
  const thSap = (k: typeof sap.k, ten: string, phai?: boolean) => <th style={{ ...th, cursor: 'pointer', textAlign: phai ? 'right' : 'left' }} onClick={() => setSap((s) => ({ k, tang: s.k === k ? !s.tang : true }))}>{ten}{sap.k === k ? (sap.tang ? ' ↑' : ' ↓') : ''}</th>;
  const tenNguon = (k: string) => ng.get(k)?.ten ?? k;
  const loc = (tab === 'gia' || tab === 'khop' || tab === 'odinh') && (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Seg options={LOAI_NGUON.map((l) => ({ value: l.key, label: l.ten, title: `${d.model.filter((m) => m.loai === l.key).length} model · đơn vị: ${l.donVi}` }))} value={loai} onChange={setLoai} />
      {tab === 'gia' && <Seg options={[{ value: 'tat_ca' as const, label: 'Tất cả' }, { value: 'dang' as const, label: 'Đang dùng' }, { value: 'chua' as const, label: 'Chưa dùng' }]} value={tt} onChange={setTt} />}
      {tab === 'gia' && <input className="xv-in" style={{ width: 180 }} value={tim} onChange={(e) => setTim(e.target.value)} placeholder="🔍 model, nguồn…" />}
      <span style={{ ...mono, marginLeft: 'auto' }}>{dv}</span>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Seg options={[{ value: 'gia' as const, label: 'Bảng giá', title: `${d.model.length} model` }, { value: 'nguon' as const, label: 'Nguồn', title: `${d.nguon.length} nguồn` }, { value: 'khop' as const, label: 'Khớp nội dung' }, { value: 'odinh' as const, label: 'Ổn định', title: 'tính từ sổ job 14 ngày' }, { value: 'tk' as const, label: 'Tham khảo', title: `${d.nguon.filter((n) => n.trang_thai !== 'dang').length} bên chưa dùng` }]} value={tab} onChange={(v) => { setTab(v); setMo(null); }} />
      {loc}
      <Loi>{loi}</Loi>

      {tab === 'gia' && <div style={{ overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr>{thSap('model', 'Model')}<th style={th}>Nguồn</th>{thSap('gia', 'Giá', true)}<th style={{ ...th, textAlign: 'right' }} title="Tiền thật đã trừ trung bình mỗi lượt (sổ job 14 ngày)">Đã trừ</th>{thSap('odinh', 'Ổn định')}{thSap('giay', 'Thời gian', true)}<th style={th}>Khớp</th></tr></thead>
        <tbody>{dsGia.map((m) => (
          <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setMo({ model: m.id })}>
            <td style={td}><b>{m.model}</b>{m.goi && <span style={{ color: 'var(--fg-4)' }}> · {m.goi}</span>}</td>
            <td style={td}><Cham tt={ttM(m)} />{tenNguon(m.nguon_key)}</td>
            <td style={so} onClick={(e) => e.stopPropagation()}><Gia m={m} /><span style={{ display: 'inline-block', height: 5, borderRadius: 3, background: 'var(--cyan)', opacity: 0.5, marginLeft: 6, verticalAlign: 'middle', width: giaHien(m) ? Math.max(3, Math.round((40 * giaHien(m)!) / maxGia)) : 0 }} /></td>
            <td style={so} onClick={(e) => e.stopPropagation()}>{vndMoiLuot(m.on_dinh) ? <button type="button" className="xv-lienket" title="Mở sổ chi phí để đối chiếu" onClick={() => moNgan({ loai: 'so-chi-phi' })} style={{ font: 'inherit' }}>{fmtVnd(vndMoiLuot(m.on_dinh))}</button> : <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
            <td style={td}><OnDinhO m={m} /></td>
            <td style={so}>{m.on_dinh?.giay ? `${m.on_dinh.giay}s` : <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
            <td style={td}><Khop k={m.khop} tat={m.tat} /></td>
          </tr>))}
          {!dsGia.length && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--fg-4)', padding: 24 }}>Không có model nào khớp bộ lọc.</td></tr>}</tbody></table></div>}

      {tab === 'nguon' && <TheNguon ds={d.nguon} model={d.model} onMo={(k) => setMo({ nguon: k })} />}

      {tab === 'khop' && <div style={{ overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}><table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
        <thead><tr><th style={th}>Model · nguồn</th>{VIEC_NGUON.map((v) => <th key={v} style={{ ...th, textAlign: 'center', whiteSpace: 'normal' }}>{v}</th>)}</tr></thead>
        <tbody>{dsLoai.map((m) => <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setMo({ model: m.id })}>
          <td style={td}><Cham tt={ttM(m)} /><b>{m.model}</b> <span style={{ color: 'var(--fg-4)' }}>{tenNguon(m.nguon_key)}{m.goi ? ` · ${m.goi}` : ''}</span></td>
          {m.khop.map((x, i) => <td key={i} style={{ ...td, textAlign: 'center', color: x === 1 ? '#4ade80' : x === -1 ? 'var(--red)' : x === 0 ? 'var(--amber)' : 'var(--fg-4)' }} title={x === -1 ? m.tat || 'không hợp' : x === 1 ? 'nên dùng' : x === 0 ? 'được' : 'chưa rõ'}>{x === 1 ? '●' : x === -1 ? '✕' : x === 0 ? '○' : '·'}</td>)}
        </tr>)}</tbody></table></div>}

      {tab === 'odinh' && <div style={{ overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}><table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr><th style={th}>Model</th><th style={th}>Nguồn</th><th style={th}>Tỉ lệ đạt</th><th style={{ ...th, textAlign: 'right' }}>Lượt</th><th style={{ ...th, textAlign: 'right' }}>Thời gian</th><th style={th}>Lỗi gần nhất</th></tr></thead>
        <tbody>{dsLoai.filter((m) => m.on_dinh).sort((a, b) => (tiLeDat(a.on_dinh) ?? 0) - (tiLeDat(b.on_dinh) ?? 0)).map((m) => <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setMo({ model: m.id })}>
          <td style={td}><b>{m.model}</b></td><td style={td}>{tenNguon(m.nguon_key)}</td><td style={td}><OnDinhO m={m} />{m.on_dinh!.goi < 5 && <span className="xv-pill" style={{ color: 'var(--amber)', marginLeft: 6 }}>ít lượt</span>}</td>
          <td style={so}>{m.on_dinh!.dat}/{m.on_dinh!.goi}</td><td style={so}>{m.on_dinh!.giay ? `${m.on_dinh!.giay}s` : '—'}</td>
          <td style={{ ...td, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--fg-3)' }} title={m.on_dinh!.loi_gan ?? ''}>{m.on_dinh!.loi_gan ?? '—'}</td></tr>)}
          {!dsLoai.some((m) => m.on_dinh) && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--fg-4)', padding: 24 }}>Chưa có lượt chạy nào của loại này trong 14 ngày.</td></tr>}</tbody></table></div>}

      {tab === 'tk' && <ThamKhao ds={d.nguon.filter((n) => n.trang_thai !== 'dang')} model={d.model} onMo={(k) => setMo({ nguon: k })} onDoi={tai} />}

      {mo && 'model' in mo && (() => { const m = d.model.find((x) => x.id === mo.model); return m ? <ChiTietModel m={m} n={ng.get(m.nguon_key)} cung={d.model.filter((x) => x.loai === m.loai && x.model === m.model && x.id !== m.id)} tenNguon={tenNguon} onMoModel={(id) => setMo({ model: id })} onMoNguon={(k) => setMo({ nguon: k })} onClose={() => setMo(null)} /> : null; })()}
      {mo && 'nguon' in mo && ng.get(mo.nguon) && <ChiTietNguon n={ng.get(mo.nguon)!} model={d.model.filter((x) => x.nguon_key === mo.nguon)} onMoModel={(id) => setMo({ model: id })} onClose={() => setMo(null)} onDoi={tai} />}
    </div>
  );
}

function TheNguon({ ds, model, onMo }: { ds: Nguon[]; model: NguonModel[]; onMo: (k: string) => void }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>{ds.map((n) => (
    <button key={n.key} type="button" className="xv-panel" onClick={() => onMo(n.key)} title={`${model.filter((m) => m.nguon_key === n.key).length} model`} style={{ textAlign: 'left', display: 'grid', gap: 5, padding: 10, cursor: 'pointer', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', color: 'inherit', font: 'inherit', minWidth: 0 }}>
      <b>{n.ten}</b>
      <span><span className="xv-pill" style={{ color: MAU_TT[n.trang_thai], marginRight: 3 }}>{TEN_TRANG_THAI[n.trang_thai]}</span><span className="xv-pill" style={{ marginRight: 3 }}>{n.kieu}</span>{n.co_khoa && <span className="xv-pill" style={{ color: '#4ade80' }}>có khoá trên box</span>}</span>
      <span style={{ color: 'var(--fg-2)', fontSize: 12 }}>{n.loai}</span>
      <span style={mono}>{n.tra_tien}{n.vault ? ` · vault ${n.vault}` : ''}</span>
      {n.rui_ro && <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{n.rui_ro}</span>}
    </button>))}</div>;
}

function ThamKhao({ ds, model, onMo, onDoi }: { ds: Nguon[]; model: NguonModel[]; onMo: (k: string) => void; onDoi: () => Promise<void> }) {
  const [f, setF] = useState({ ten: '', model: '', loai: 'video' as LoaiNguon, gia: '', link: '', goc: '' });
  const [loi, setLoi] = useState(''); const [ban, setBan] = useState(false);
  const them = async () => {
    setBan(true); setLoi('');
    const r = await goiAction(() => themNguonModel({ ten: f.ten, loai: f.loai, model: f.model, gia_vnd: f.gia.trim() ? Number(f.gia) : null, gia_goc: f.goc, link: f.link }));
    setBan(false); setLoi(r.loi); if (!r.loi) { setF({ ten: '', model: '', loai: f.loai, gia: '', link: '', goc: '' }); await onDoi(); }
  };
  return <div style={{ display: 'grid', gap: 10 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>{ds.map((n) => {
      const ms = model.filter((m) => m.nguon_key === n.key).sort((a, b) => (giaHien(a) ?? 1e12) - (giaHien(b) ?? 1e12));
      return <div key={n.key} className="xv-panel" style={{ display: 'grid', gap: 5, padding: 10, border: '1px solid var(--line)', borderRadius: 8, minWidth: 0 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><button type="button" className="xv-lienket" onClick={() => onMo(n.key)} style={{ font: 'inherit', fontWeight: 700 }}>{n.ten}</button><span className="xv-pill" style={{ color: MAU_TT[n.trang_thai] }}>{TEN_TRANG_THAI[n.trang_thai]}</span></span>
        <span style={{ color: 'var(--fg-2)', fontSize: 12 }}>{n.loai}</span>
        {ms.slice(0, 3).map((m) => <span key={m.id} style={{ ...mono, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{m.model}{m.goi ? ` · ${m.goi}` : ''}</span><Gia m={m} /></span>)}
        {n.rui_ro && <span style={{ fontSize: 11.5, color: 'var(--amber)' }}>{n.rui_ro}</span>}
        <span><button type="button" className="xv-btn chinh" onClick={async () => { const r = await goiAction(() => doiTrangThaiNguon(n.key, 'dang')); setLoi(r.loi); if (!r.loi) await onDoi(); }}>Đưa vào dùng</button></span>
      </div>; })}</div>
    <form onSubmit={(e) => { e.preventDefault(); void them(); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6, border: '1px dashed var(--line)', borderRadius: 8, padding: 10 }}>
      <input className="xv-in" required placeholder="Tên bên cung cấp" value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} />
      <input className="xv-in" required placeholder="Model" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
      <select className="xv-in" value={f.loai} onChange={(e) => setF({ ...f, loai: e.target.value as LoaiNguon })} title={LOAI_NGUON.find((l) => l.key === f.loai)?.donVi}>{LOAI_NGUON.map((l) => <option key={l.key} value={l.key}>{l.ten}</option>)}</select>
      <input className="xv-in" type="number" min="0" step="any" placeholder={`₫ / ${LOAI_NGUON.find((l) => l.key === f.loai)?.donVi}`} value={f.gia} onChange={(e) => setF({ ...f, gia: e.target.value })} />
      <input className="xv-in" placeholder="Giá gốc như trên trang" value={f.goc} onChange={(e) => setF({ ...f, goc: e.target.value })} />
      <input className="xv-in" required={!!f.gia.trim()} type="url" placeholder="Link trang chứa giá (bắt buộc khi có giá)" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
      <button type="submit" className="xv-btn chinh" disabled={ban}>＋ Thêm bên</button>
    </form>
    <Loi>{loi}</Loi>
  </div>;
}

function ChiTietModel({ m, n, cung, tenNguon, onMoModel, onMoNguon, onClose }: { m: NguonModel; n?: Nguon; cung: NguonModel[]; tenNguon: (k: string) => string; onMoModel: (id: number) => void; onMoNguon: (k: string) => void; onClose: () => void }) {
  const dong = (a: string, b: React.ReactNode) => <><span style={{ color: 'var(--fg-4)' }}>{a}</span><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{b}</span></>;
  return <Ngan nho onClose={onClose} tieuDe={m.model}>
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '5px 10px', fontSize: 12.5 }}>
        {dong('Nguồn', <><button type="button" className="xv-lienket" style={{ font: 'inherit' }} onClick={() => onMoNguon(m.nguon_key)}>{n?.ten ?? m.nguon_key}</button>{m.goi ? ` · ${m.goi}` : ''}</>)}
        {dong('Trạng thái', TEN_TRANG_THAI[n?.trang_thai ?? 'tham_khao'])}
        {dong('Giá', <><Gia m={m} dam /> <span style={{ color: 'var(--fg-4)' }}>/ {LOAI_NGUON.find((l) => l.key === m.loai)?.donVi}</span></>)}
        {dong('Giá gốc', <span style={mono}>{m.gia_goc || '—'}</span>)}
        {dong('Trang giá', m.link ? <LinkNgoai href={m.link}>{m.link.replace(/^https?:\/\//, '').slice(0, 60)}</LinkNgoai> : '—')}
        {m.link_phu && dong('Trang phụ', <LinkNgoai href={m.link_phu}>{m.link_phu.replace(/^https?:\/\//, '').slice(0, 60)}</LinkNgoai>)}
        {dong('Đọc ngày', m.ngay_doc ?? '—')}
        {dong('Đã trừ / lượt', vndMoiLuot(m.on_dinh) ? <button type="button" className="xv-lienket" style={{ font: 'inherit' }} onClick={() => moNgan({ loai: 'so-chi-phi' })}>{fmtVnd(vndMoiLuot(m.on_dinh))}</button> : '—')}
        {dong('Khả năng', m.kha_nang || '—')}
        {dong('Ổn định', m.on_dinh ? `${m.on_dinh.dat}/${m.on_dinh.goi} lượt${m.on_dinh.giay ? ` · ~${m.on_dinh.giay}s` : ''}` : 'chưa đo')}
        {m.on_dinh?.loi_gan && dong('Lỗi gần nhất', <span style={{ color: 'var(--fg-3)' }}>{m.on_dinh.loi_gan}</span>)}
        {dong('Tật đã gặp', m.tat ? <span style={{ color: 'var(--red)' }}>{m.tat}</span> : '—')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', border: '1px solid var(--line)', borderRadius: 8 }}>{VIEC_NGUON.map((v, i) => <div key={v} style={{ display: 'contents' }}>
        <span style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>{v}</span>
        <span style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', fontSize: 12.5, color: m.khop[i] === 1 ? '#4ade80' : m.khop[i] === -1 ? 'var(--red)' : m.khop[i] === 0 ? 'var(--amber)' : 'var(--fg-4)' }}>{m.khop[i] === 1 ? 'nên dùng' : m.khop[i] === -1 ? 'cấm' : m.khop[i] === 0 ? 'được' : '—'}</span></div>)}</div>
      {cung.length > 0 && <table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr><th style={th}>Cùng model ở nguồn khác</th><th style={{ ...th, textAlign: 'right' }}>Giá</th><th style={th}>Ổn định</th></tr></thead>
        <tbody>{cung.map((x) => <tr key={x.id} style={{ cursor: 'pointer' }} onClick={() => onMoModel(x.id)}><td style={td}>{tenNguon(x.nguon_key)}{x.goi ? ` · ${x.goi}` : ''}</td><td style={so} onClick={(e) => e.stopPropagation()}><Gia m={x} /></td><td style={td}><OnDinhO m={x} /></td></tr>)}</tbody></table>}
    </div>
  </Ngan>;
}

function ChiTietNguon({ n, model, onMoModel, onClose, onDoi }: { n: Nguon; model: NguonModel[]; onMoModel: (id: number) => void; onClose: () => void; onDoi: () => Promise<void> }) {
  const [loi, setLoi] = useState('');
  const dong = (a: string, b: React.ReactNode) => <><span style={{ color: 'var(--fg-4)' }}>{a}</span><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{b}</span></>;
  return <Ngan nho onClose={onClose} tieuDe={n.ten}>
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '5px 10px', fontSize: 12.5 }}>
        {dong('Trạng thái', TEN_TRANG_THAI[n.trang_thai])}{dong('Kiểu', n.kieu || '—')}{dong('Loại', n.loai || '—')}{dong('Trả tiền', n.tra_tien || '—')}
        {dong('Khoá trên box', n.co_khoa ? 'có' : 'chưa')}{dong('Vault', n.vault || '—')}
        {dong('Nạp tiền', n.nap_tien ? <LinkNgoai href={n.nap_tien}>{n.nap_tien.replace(/^https?:\/\//, '').slice(0, 60)}</LinkNgoai> : '—')}
        {dong('Rủi ro', n.rui_ro || '—')}
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr><th style={th}>Model</th><th style={{ ...th, textAlign: 'right' }}>Giá</th><th style={th}>Ổn định</th></tr></thead>
        <tbody>{model.sort((a, b) => a.loai.localeCompare(b.loai) || (giaHien(a) ?? 1e12) - (giaHien(b) ?? 1e12)).map((m) => <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => onMoModel(m.id)}>
          <td style={td}>{m.model}{m.goi ? <span style={{ color: 'var(--fg-4)' }}> · {m.goi}</span> : ''} <span style={{ ...mono, color: 'var(--fg-4)' }}>{LOAI_NGUON.find((l) => l.key === m.loai)?.ten}</span></td>
          <td style={so} onClick={(e) => e.stopPropagation()}><Gia m={m} /></td><td style={td}><OnDinhO m={m} /></td></tr>)}</tbody></table>
      <span style={{ display: 'flex', gap: 6 }}>
        {n.trang_thai !== 'dang' && <button type="button" className="xv-btn chinh" onClick={async () => { const r = await goiAction(() => doiTrangThaiNguon(n.key, 'dang')); setLoi(r.loi); if (!r.loi) await onDoi(); }}>Đưa vào dùng</button>}
        {n.trang_thai === 'dang' && <button type="button" className="xv-btn" onClick={async () => { const r = await goiAction(() => doiTrangThaiNguon(n.key, 'ngung')); setLoi(r.loi); if (!r.loi) await onDoi(); }}>Ngừng dùng</button>}
      </span>
      <Loi>{loi}</Loi>
    </div>
  </Ngan>;
}
