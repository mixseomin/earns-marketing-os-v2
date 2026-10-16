'use client';
// Sổ nguồn AI (nguon-ai.ts) — ngăn chung mở từ header: Bảng giá · Nguồn · Khớp nội dung · Ổn định · Tham khảo. Bấm dòng = ngăn chi tiết chồng lên.
// Mọi bảng là DataTable dùng chung (@mos2/bang — cùng bảng với mos2): sắp xếp, lọc cột, ô tìm, ghim cột đầu có sẵn.
// Giá chỉ hiện kèm link trang chứa giá (giaHien); tiền thật đã trừ lấy từ sổ job, mở sổ chi phí để đối chiếu.
import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '@mos2/bang/data-table';
import { dsNguonAi, doiTrangThaiNguon, themNguonModel } from '@/lib/actions';
import { LOAI_NGUON, TEN_TRANG_THAI, VIEC_NGUON, fmtVnd, giaHien, mucOnDinh, tiLeDat, vndMoiLuot, type LoaiNguon, type Nguon, type NguonModel, type O } from '@/lib/xuong-video/nguon-ai';
import { Seg, Loi, LinkNgoai, mono, goiAction } from './ui';
import { Ngan } from './ngan';
import { moNgan } from './ngan-chung';
import { useNho } from './nho';

type Tab = 'gia' | 'nguon' | 'khop' | 'odinh' | 'tk';
const MAU_TT: Record<string, string> = { dang: 'var(--lime)', co_tk: 'var(--amber)', tham_khao: 'var(--fg-4)', ngung: 'var(--fg-4)' };
const MAU_OD = { do: 'var(--red)', vang: 'var(--amber)', tot: 'var(--lime)' } as const;
const MAU_O = (x: O) => (x === 1 ? 'var(--lime)' : x === -1 ? 'var(--red)' : x === 0 ? 'var(--amber)' : 'var(--fg-4)');
const CHU_O = (x: O) => (x === 1 ? 'nên dùng' : x === -1 ? 'cấm' : x === 0 ? 'được' : '—');

function Cham({ tt }: { tt: string }) { return <span title={TEN_TRANG_THAI[tt as keyof typeof TEN_TRANG_THAI]} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: MAU_TT[tt] ?? 'var(--fg-4)', marginRight: 6, verticalAlign: 'middle' }} />; }
function OnDinhO({ m }: { m: NguonModel }) {
  const t = tiLeDat(m.on_dinh), muc = mucOnDinh(m.on_dinh);
  if (t == null || !muc) return <span style={{ color: 'var(--fg-4)' }}>chưa đo</span>;
  return <span title={`${m.on_dinh!.dat}/${m.on_dinh!.goi} lượt đạt · 14 ngày`}><span style={{ display: 'inline-block', width: 52, height: 5, borderRadius: 3, background: 'var(--line)', verticalAlign: 'middle', marginRight: 6, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.round(t * 100)}%`, background: MAU_OD[muc] }} /></span>{Math.round(t * 100)}%</span>;
}
/** Giá luôn bọc link trang chứa giá; không có link thì không có giá. */
function Gia({ m, dam }: { m: NguonModel; dam?: boolean }) {
  const g = giaHien(m);
  if (g == null) return <span style={{ color: 'var(--fg-4)' }} title={m.gia_goc || 'chưa có giá kèm nguồn'}>—</span>;
  return <LinkNgoai href={m.link} title={`${m.gia_goc} · đọc ${m.ngay_doc ?? '?'}`} style={{ color: 'inherit', fontWeight: dam ? 700 : 500 }}>{fmtVnd(g)}</LinkNgoai>;
}
function DaTru({ m }: { m: NguonModel }) {
  const v = vndMoiLuot(m.on_dinh);
  return v ? <button type="button" className="xv-lienket" title="Tiền thật đã trừ chia lượt đạt (sổ job 14 ngày) — mở sổ chi phí" onClick={(e) => { e.stopPropagation(); moNgan({ loai: 'so-chi-phi' }); }} style={{ font: 'inherit' }}>{fmtVnd(v)}</button> : <span style={{ color: 'var(--fg-4)' }}>—</span>;
}
function Khop({ k, tat }: { k: O[]; tat: string }) {
  return <>{VIEC_NGUON.map((v, i) => k[i] === 1 ? <span key={v} className="xv-pill" style={{ color: 'var(--lime)', marginRight: 3 }}>{v}</span> : k[i] === -1 ? <span key={v} className="xv-pill" title={tat} style={{ color: 'var(--red)', marginRight: 3 }}>cấm {v}</span> : null)}</>;
}
const tenModel = (m: NguonModel) => <><b>{m.model}</b>{m.goi && <span style={{ color: 'var(--fg-4)' }}> · {m.goi}</span>}</>;

export function SoNguonAi() {
  const [d, setD] = useState<{ nguon: Nguon[]; model: NguonModel[] } | null>(null);
  const [loi, setLoi] = useState('');
  const [tab, setTab] = useNho<Tab>('xv-nguon-tab', 'gia', ['gia', 'nguon', 'khop', 'odinh', 'tk']);
  const [loai, setLoai] = useNho<LoaiNguon>('xv-nguon-loai', 'video', ['video', 'anh', 'giong', 'am', 'chu']);
  const [tt, setTt] = useState<'tat_ca' | 'dang' | 'chua'>('tat_ca');
  const [mo, setMo] = useState<{ model: number } | { nguon: string } | null>(null);
  const tai = async () => { const r = await goiAction(() => dsNguonAi()); setLoi(r.loi); if (r.kq?.ok) setD(r.kq.data); };
  useEffect(() => { void tai(); }, []);
  const ng = useMemo(() => new Map((d?.nguon ?? []).map((n) => [n.key, n])), [d]);
  if (!d) return <div style={mono}>{loi || 'đang tải…'}</div>;
  const ttM = (m: NguonModel) => ng.get(m.nguon_key)?.trang_thai ?? 'tham_khao';
  const tenNguon = (k: string) => ng.get(k)?.ten ?? k;
  const dv = LOAI_NGUON.find((l) => l.key === loai)!.donVi;
  const dsLoai = d.model.filter((m) => m.loai === loai);
  const dsGia = dsLoai.filter((m) => tt === 'tat_ca' || (tt === 'dang' ? ttM(m) === 'dang' : ttM(m) !== 'dang'));
  const moModel = (m: NguonModel) => setMo({ model: m.id });

  const cotModel: DataColumn<NguonModel> = { key: 'model', header: 'Model', align: 'left', cell: tenModel, sortValue: (m) => `${m.model} ${m.goi}` };
  const cotNguon: DataColumn<NguonModel> = { key: 'nguon', header: 'Nguồn', align: 'left', cell: (m) => <><Cham tt={ttM(m)} />{tenNguon(m.nguon_key)}</>, sortValue: (m) => tenNguon(m.nguon_key) };
  const cotOnDinh: DataColumn<NguonModel> = { key: 'odinh', header: 'Ổn định · 14 ngày', align: 'left', cell: (m) => <OnDinhO m={m} />, sortValue: (m) => tiLeDat(m.on_dinh) };
  const cotGiay: DataColumn<NguonModel> = { key: 'giay', header: 'Thời gian (trung vị)', title: 'Trung vị thời gian một lượt đạt, tính cả chờ hàng đợi', cell: (m) => (m.on_dinh?.giay ? `${m.on_dinh.giay}s` : '—'), sortValue: (m) => m.on_dinh?.giay ?? null };
  const cotGia: DataColumn<NguonModel>[] = [
    cotModel, cotNguon,
    // Đơn vị nằm TRONG tên cột: giá niêm yết theo đơn vị chuẩn của loại; tiền đã trừ là theo lượt THẬT (dài ngắn tuỳ shot) — hai đơn vị khác nhau,
    // không đặt cạnh nhau để khỏi so thẳng (260₫ / bản 30s cạnh 238₫ / lượt trông như "rẻ hơn niêm yết").
    { key: 'gia', header: `Giá / ${dv}`, title: `Giá niêm yết quy về VNĐ cho ${dv} — bấm số để mở trang chứa giá`, cell: (m) => <Gia m={m} />, sortValue: (m) => giaHien(m) },
    cotOnDinh, cotGiay,
    { key: 'da_tru', header: 'Đã trừ / lượt thật', title: 'Tiền thật đã trừ chia số lượt đạt (sổ job 14 ngày) — một lượt dài ngắn tuỳ shot, KHÔNG cùng đơn vị với cột Giá', cell: (m) => <DaTru m={m} />, sortValue: (m) => vndMoiLuot(m.on_dinh) },
    { key: 'khop', header: 'Khớp', align: 'left', cell: (m) => <Khop k={m.khop} tat={m.tat} /> },
  ];
  const cotKhop: DataColumn<NguonModel>[] = [
    { ...cotModel, cell: (m) => <><Cham tt={ttM(m)} />{tenModel(m)} <span style={{ color: 'var(--fg-4)' }}>{tenNguon(m.nguon_key)}</span></> },
    ...VIEC_NGUON.map((v, i): DataColumn<NguonModel> => ({ key: `k${i}`, header: v, align: 'center', cell: (m) => <span style={{ color: MAU_O(m.khop[i] ?? null) }}>{m.khop[i] === 1 ? '●' : m.khop[i] === -1 ? '✕' : m.khop[i] === 0 ? '○' : '·'}</span>, cellTitle: (m) => (m.khop[i] === -1 ? m.tat || 'không hợp' : CHU_O(m.khop[i] ?? null)), sortValue: (m) => m.khop[i] ?? null })),
  ];
  const cotOd: DataColumn<NguonModel>[] = [
    cotModel, cotNguon, cotOnDinh,
    { key: 'luot', header: 'Lượt', cell: (m) => `${m.on_dinh!.dat}/${m.on_dinh!.goi}`, sortValue: (m) => m.on_dinh?.goi ?? 0 },
    cotGiay,
    { key: 'co', header: 'Cờ', align: 'left', cell: (m) => <>{m.on_dinh!.goi < 5 && <span className="xv-pill" style={{ color: 'var(--amber)' }}>ít lượt</span>}{m.tat && <span className="xv-pill" style={{ color: 'var(--red)', marginLeft: 3 }}>có tật</span>}</> },
    { key: 'loi', header: 'Lỗi gần nhất', align: 'left', cell: (m) => <span style={{ color: 'var(--fg-3)' }}>{(m.on_dinh!.loi_gan ?? '—').slice(0, 70)}</span>, cellTitle: (m) => m.on_dinh!.loi_gan ?? undefined },
  ];

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Seg options={[{ value: 'gia' as const, label: 'Bảng giá', title: `${d.model.length} model` }, { value: 'nguon' as const, label: 'Nguồn', title: `${d.nguon.length} nguồn` }, { value: 'khop' as const, label: 'Khớp nội dung' }, { value: 'odinh' as const, label: 'Ổn định', title: 'tính từ sổ job 14 ngày' }, { value: 'tk' as const, label: 'Tham khảo', title: `${d.nguon.filter((n) => n.trang_thai !== 'dang').length} bên chưa dùng` }]} value={tab} onChange={(v) => { setTab(v); setMo(null); }} />
      {(tab === 'gia' || tab === 'khop' || tab === 'odinh') && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Seg options={LOAI_NGUON.map((l) => ({ value: l.key, label: l.ten, title: `${d.model.filter((m) => m.loai === l.key).length} model · đơn vị: ${l.donVi}` }))} value={loai} onChange={setLoai} />
          {tab === 'gia' && <Seg options={[{ value: 'tat_ca' as const, label: 'Tất cả' }, { value: 'dang' as const, label: 'Đang dùng' }, { value: 'chua' as const, label: 'Chưa dùng' }]} value={tt} onChange={setTt} />}
          <span style={{ ...mono, marginLeft: 'auto' }}>{dv}</span>
        </div>
      )}
      <Loi>{loi}</Loi>

      {tab === 'gia' && <DataTable key={`gia-${loai}`} rows={dsGia} columns={cotGia} getRowKey={(m) => String(m.id)} onRowClick={moModel} persistKey="xv-nguon-gia"
        searchText={(m) => `${m.model} ${m.goi} ${tenNguon(m.nguon_key)}`} searchPlaceholder="model, nguồn…" minWidth={900} />}
      {tab === 'nguon' && <TheNguon ds={d.nguon} model={d.model} onMo={(k) => setMo({ nguon: k })} />}
      {tab === 'khop' && <DataTable key={`khop-${loai}`} rows={dsLoai} columns={cotKhop} getRowKey={(m) => String(m.id)} onRowClick={moModel} persistKey="xv-nguon-khop" minWidth={820} />}
      {tab === 'odinh' && <DataTable key={`od-${loai}`} rows={dsLoai.filter((m) => m.on_dinh)} columns={cotOd} getRowKey={(m) => String(m.id)} onRowClick={moModel} persistKey="xv-nguon-odinh" minWidth={860} />}
      {tab === 'tk' && <ThamKhao ds={d.nguon.filter((n) => n.trang_thai !== 'dang')} model={d.model} onMo={(k) => setMo({ nguon: k })} onDoi={tai} />}

      {mo && 'model' in mo && (() => { const m = d.model.find((x) => x.id === mo.model); return m ? <ChiTietModel m={m} n={ng.get(m.nguon_key)} cung={d.model.filter((x) => x.loai === m.loai && x.model === m.model && x.id !== m.id)} tenNguon={tenNguon} onMoModel={(id) => setMo({ model: id })} onMoNguon={(k) => setMo({ nguon: k })} onClose={() => setMo(null)} /> : null; })()}
      {mo && 'nguon' in mo && ng.get(mo.nguon) && <ChiTietNguon n={ng.get(mo.nguon)!} model={d.model.filter((x) => x.nguon_key === mo.nguon)} onMoModel={(id) => setMo({ model: id })} onClose={() => setMo(null)} onDoi={tai} />}
    </div>
  );
}

function TheNguon({ ds, model, onMo }: { ds: Nguon[]; model: NguonModel[]; onMo: (k: string) => void }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 8 }}>{ds.map((n) => (
    <button key={n.key} type="button" onClick={() => onMo(n.key)} title={`${model.filter((m) => m.nguon_key === n.key).length} model`} style={{ textAlign: 'left', display: 'grid', gap: 5, padding: 10, cursor: 'pointer', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', color: 'inherit', font: 'inherit', minWidth: 0 }}>
      <b>{n.ten}</b>
      <span><span className="xv-pill" style={{ color: MAU_TT[n.trang_thai], marginRight: 3 }}>{TEN_TRANG_THAI[n.trang_thai]}</span><span className="xv-pill" style={{ marginRight: 3 }}>{n.kieu}</span>{n.co_khoa && <span className="xv-pill" style={{ color: 'var(--lime)' }}>có khoá trên box</span>}</span>
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
      return <div key={n.key} style={{ display: 'grid', gap: 5, padding: 10, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)', minWidth: 0 }}>
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

/** Hai cột nhãn : giá trị trong ngăn chi tiết. */
function DanhSach({ dong }: { dong: [string, React.ReactNode][] }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '5px 10px', fontSize: 12.5 }}>{dong.map(([a, b]) => <div key={a} style={{ display: 'contents' }}><span style={{ color: 'var(--fg-4)' }}>{a}</span><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{b}</span></div>)}</div>;
}
const linkNgan = (u: string) => (u ? <LinkNgoai href={u}>{u.replace(/^https?:\/\//, '').slice(0, 60)}</LinkNgoai> : '—');

function ChiTietModel({ m, n, cung, tenNguon, onMoModel, onMoNguon, onClose }: { m: NguonModel; n?: Nguon; cung: NguonModel[]; tenNguon: (k: string) => string; onMoModel: (id: number) => void; onMoNguon: (k: string) => void; onClose: () => void }) {
  return <Ngan nho onClose={onClose} tieuDe={m.model}>
    <div style={{ display: 'grid', gap: 12 }}>
      <DanhSach dong={[
        ['Nguồn', <><button type="button" className="xv-lienket" style={{ font: 'inherit' }} onClick={() => onMoNguon(m.nguon_key)}>{n?.ten ?? m.nguon_key}</button>{m.goi ? ` · ${m.goi}` : ''}</>],
        ['Trạng thái', TEN_TRANG_THAI[n?.trang_thai ?? 'tham_khao']],
        ['Giá', <><Gia m={m} dam /> <span style={{ color: 'var(--fg-4)' }}>/ {LOAI_NGUON.find((l) => l.key === m.loai)?.donVi}</span></>],
        ['Giá gốc', <span style={mono}>{m.gia_goc || '—'}</span>],
        ['Trang giá', linkNgan(m.link)],
        ...(m.link_phu ? [['Trang phụ', linkNgan(m.link_phu)] as [string, React.ReactNode]] : []),
        ['Đọc ngày', m.ngay_doc ?? '—'],
        ['Đã trừ / lượt đạt', <DaTru m={m} />],
        ['Khả năng', m.kha_nang || '—'],
        ['Ổn định · 14 ngày', m.on_dinh ? `${m.on_dinh.dat}/${m.on_dinh.goi} lượt${m.on_dinh.giay ? ` · trung vị ~${m.on_dinh.giay}s` : ''}` : 'chưa đo'],
        ...(m.on_dinh?.loi_gan ? [['Lỗi gần nhất', <span style={{ color: 'var(--fg-3)' }}>{m.on_dinh.loi_gan}</span>] as [string, React.ReactNode]] : []),
        ['Tật đã gặp', m.tat ? <span style={{ color: 'var(--red)' }}>{m.tat}</span> : '—'],
      ]} />
      <DanhSach dong={VIEC_NGUON.map((v, i) => [v, <span style={{ color: MAU_O(m.khop[i] ?? null) }}>{CHU_O(m.khop[i] ?? null)}</span>])} />
      {cung.length > 0 && <DataTable rows={cung} getRowKey={(x) => String(x.id)} onRowClick={(x) => onMoModel(x.id)} minWidth={320} stickyFirst={false} columns={[
        { key: 'n', header: 'Cùng model ở nguồn khác', align: 'left', cell: (x) => `${tenNguon(x.nguon_key)}${x.goi ? ` · ${x.goi}` : ''}` },
        { key: 'g', header: 'Giá', cell: (x) => <Gia m={x} />, sortValue: (x) => giaHien(x) },
        { key: 'o', header: 'Ổn định', align: 'left', cell: (x) => <OnDinhO m={x} />, sortValue: (x) => tiLeDat(x.on_dinh) },
      ]} />}
    </div>
  </Ngan>;
}

function ChiTietNguon({ n, model, onMoModel, onClose, onDoi }: { n: Nguon; model: NguonModel[]; onMoModel: (id: number) => void; onClose: () => void; onDoi: () => Promise<void> }) {
  const [loi, setLoi] = useState('');
  const doi = async (tt: 'dang' | 'ngung') => { const r = await goiAction(() => doiTrangThaiNguon(n.key, tt)); setLoi(r.loi); if (!r.loi) await onDoi(); };
  return <Ngan nho onClose={onClose} tieuDe={n.ten}>
    <div style={{ display: 'grid', gap: 12 }}>
      <DanhSach dong={[['Trạng thái', TEN_TRANG_THAI[n.trang_thai]], ['Kiểu', n.kieu || '—'], ['Loại', n.loai || '—'], ['Trả tiền', n.tra_tien || '—'], ['Khoá trên box', n.co_khoa ? 'có' : 'chưa'], ['Vault', n.vault || '—'], ['Nạp tiền', linkNgan(n.nap_tien)], ['Rủi ro', n.rui_ro || '—']]} />
      <DataTable rows={model} getRowKey={(m) => String(m.id)} onRowClick={(m) => onMoModel(m.id)} minWidth={320} stickyFirst={false} columns={[
        { key: 'm', header: 'Model', align: 'left', cell: (m) => <>{tenModel(m)} <span style={{ color: 'var(--fg-4)' }}>{LOAI_NGUON.find((l) => l.key === m.loai)?.ten}</span></>, sortValue: (m) => `${m.loai} ${m.model}` },
        { key: 'g', header: 'Giá', cell: (m) => <Gia m={m} />, sortValue: (m) => giaHien(m) },
        { key: 'o', header: 'Ổn định', align: 'left', cell: (m) => <OnDinhO m={m} />, sortValue: (m) => tiLeDat(m.on_dinh) },
      ]} />
      <span style={{ display: 'flex', gap: 6 }}>
        {n.trang_thai !== 'dang' ? <button type="button" className="xv-btn chinh" onClick={() => void doi('dang')}>Đưa vào dùng</button> : <button type="button" className="xv-btn" onClick={() => void doi('ngung')}>Ngừng dùng</button>}
      </span>
      <Loi>{loi}</Loi>
    </div>
  </Ngan>;
}
