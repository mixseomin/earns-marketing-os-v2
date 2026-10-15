'use client';
// KHO CREATIVE THEO SẢN PHẨM (kho-creative.ts) — tab 📦 Sản phẩm trên trang chủ → ngăn một sản phẩm, 6 tab cố định:
// Creative (bảng, gom / lọc / chọn → so cạnh nhau) · Bản đồ (loại góc × dòng khuôn, mở ma trận góc × khuôn) · Góc (cây loại › góc › creative)
// · Thành phần (mỗi loại một bảng: dùng ở bao nhiêu creative) · Lô sinh · Kết quả. Nhãn chỉ ghi tên, số ở hover (YDNI luật 3).
import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Ngan } from './ngan';
import { Seg, Pill, LinkNgoai, Nut, Loi, mono } from './ui';
import { useNho } from './nho';
import { docKhoSanPham, dsGocSpy, type KhoSanPham } from '@/lib/actions';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { LOAI_GOC_SPY, loaiGocSpy, linkGocSpy, linkSpSpy, type GocSpy } from '@/lib/xuong-video/goc-spy';
import { COT_DONG, COT_KHUON, LOAI_THANH_PHAN, banDo, dongCua, oMaTran, type DongCreative, type ThanhPhan } from '@/lib/xuong-video/kho-creative';
import { nhomPhim, anhDaiDien } from '@/lib/xuong-video/nhom-phim';
import { DONG_TEMPLATE, type Phim } from '@/lib/xuong-video/kieu';

type TabSp = 'creative' | 'ban_do' | 'goc' | 'thanh_phan' | 'lo' | 'ket_qua';
const TAB_SP: { value: TabSp; label: string }[] = [
  { value: 'creative', label: 'Creative' }, { value: 'ban_do', label: 'Bản đồ' }, { value: 'goc', label: 'Góc' },
  { value: 'thanh_phan', label: 'Thành phần' }, { value: 'lo', label: 'Lô sinh' }, { value: 'ket_qua', label: 'Kết quả' },
];
const tenKhuon = (c: Pick<DongCreative, 'tpl'>) => (c.tpl ? DONG_TEMPLATE.find((d) => d.key === c.tpl!.dong)?.khuon.find((k) => k.key === c.tpl!.khuon)?.ten ?? c.tpl.khuon : 'Ngoài template');
const o: CSSProperties = { borderBottom: '1px solid var(--line)', padding: '5px 8px', textAlign: 'left', verticalAlign: 'middle' };
const th: CSSProperties = { ...o, position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-2)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-3)', fontWeight: 500 };

/** Danh sách sản phẩm (tab 📦 Sản phẩm): mỗi sản phẩm một dòng, bấm mở ngăn. Nhóm theo sản phẩm của phim QC (nhom-phim.ts › sanPhamPhim). */
export function DanhSachSanPham({ phim, onMo }: { phim: Phim[]; onMo: (key: string) => void }) {
  const ds = nhomPhim(phim, { kieu: 'quang_cao' }).filter((g) => g.key.startsWith('sp:'));
  if (!ds.length) return <div className="xv-panel" style={mono}>Chưa có creative quảng cáo nào gắn sản phẩm (ô Sản phẩm + link trang bán ở tab 🎭 Phim của phim QC).</div>;
  return (
    <div className="xv-panel" style={{ padding: 0, marginBottom: 0 }}>
      {ds.map((g) => {
        const anh = g.phim.map(anhDaiDien).find(Boolean) ?? null;
        const goc = new Set(g.phim.flatMap((p) => (p.goc_spy ?? []).map((x) => x.id)));
        return (
          <button key={g.key} type="button" onClick={() => onMo(g.key.slice(3))} title={`${g.phim.length} creative · ${goc.size} góc spy đã dùng`}
            style={{ all: 'unset', cursor: 'pointer', display: 'grid', gridTemplateColumns: '26px 1fr', columnGap: 10, alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid var(--line)', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ width: 26, height: 38, borderRadius: 3, border: '1px solid var(--line)', background: anh ? `center / cover no-repeat url(${anhNho(anh, 160)}), #111` : 'var(--bg-2)' }} />
            <b style={{ fontSize: 14.5 }}>📦 {g.ten}</b>
          </button>
        );
      })}
    </div>
  );
}

/** Ngăn một sản phẩm. onMoPhim = mở ngăn phim (chồng lên). */
export function NganSanPham({ spKey, onClose, onMoPhim, onMoTemplate }: { spKey: string; onClose: () => void; onMoPhim: (id: number) => void; onMoTemplate: () => void }) {
  const [d, setD] = useState<KhoSanPham | null>(null);
  const [loi, setLoi] = useState('');
  const [goc, setGoc] = useState<(GocSpy & { so_nhac: number })[]>([]);
  const [tab, setTab] = useNho<TabSp>('xv-sp-tab', 'creative', TAB_SP.map((t) => t.value), 'sptab');
  const [chon, setChon] = useState<number[]>([]);
  const [soSanh, setSoSanh] = useState(false);
  const [locGoc, setLocGoc] = useState<number | null>(null);
  useEffect(() => { void docKhoSanPham(spKey).then((r) => (r.ok ? setD(r.data) : setLoi(r.loi))); }, [spKey]);
  useEffect(() => { if (d?.sp.spy) void dsGocSpy(d.sp.spy).then((r) => r.ok && setGoc(r.data)); }, [d?.sp.spy]);
  const moGoc = (id: number) => { setLocGoc(id); setTab('creative'); };
  if (loi) return <Ngan onClose={onClose}><Loi>{loi}</Loi></Ngan>;
  if (!d) return <Ngan onClose={onClose}><span style={mono}>đang tải…</span></Ngan>;
  return (
    <Ngan onClose={onClose} tieuDe={`📦 ${d.sp.ten}`} nut={<>
      {d.sp.spy && <LinkNgoai href={linkSpSpy(d.sp.spy)} className="xv-lienket xv-mono" title="Mở nhóm góc của sản phẩm trên spy.on.tc (tab mới)">góc trên spy ↗</LinkNgoai>}
      {d.sp.link && <LinkNgoai href={d.sp.link} className="xv-lienket xv-mono" title={d.sp.link}>trang bán ↗</LinkNgoai>}
    </>} dau={<Seg options={TAB_SP} value={tab} onChange={setTab} />}>
      {tab === 'creative' && <BangCreative d={d} goc={goc} locGoc={locGoc} setLocGoc={setLocGoc} chon={chon} setChon={setChon} onMoPhim={onMoPhim} onSoSanh={() => setSoSanh(true)} />}
      {tab === 'ban_do' && <BanDo d={d} goc={goc} onMoPhim={onMoPhim} onMoGoc={moGoc} />}
      {tab === 'goc' && <CayGoc d={d} goc={goc} onMoPhim={onMoPhim} onMoGoc={moGoc} />}
      {tab === 'thanh_phan' && <ThuVienThanhPhan tp={d.thanh_phan} onMoPhim={onMoPhim} />}
      {tab === 'lo' && <Trong tieu="Chưa có lô sinh" chu="Lô sinh = tạo nhiều creative một lượt từ một ô góc × khuôn. Hiện tạo từng phim từ template." nut={<Nut onClick={onMoTemplate}>🧩 Mở Template</Nut>} />}
      {tab === 'ket_qua' && <Trong tieu="Chưa có số liệu quảng cáo" chu="Studio chưa nhận chi / đơn của quảng cáo đang chạy, nên chưa biết creative, góc hay thành phần nào thắng." />}
      {soSanh && <SoSanh ds={d.creative.filter((c) => chon.includes(c.id))} tp={d.thanh_phan} onClose={() => setSoSanh(false)} onMoPhim={onMoPhim} />}
    </Ngan>
  );
}

function Trong({ tieu, chu, nut }: { tieu: string; chu: string; nut?: ReactNode }) {
  return <div style={{ padding: '28px 12px', textAlign: 'center', display: 'grid', gap: 6, justifyItems: 'center' }}><b>{tieu}</b><span style={{ ...mono, maxWidth: 520 }}>{chu}</span>{nut}</div>;
}

/** Ảnh nhỏ + 5 nấc sản xuất (màu = trạng thái, số ở hover). */
function NacSx({ c }: { c: DongCreative }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }} title={c.nac.map((x) => `${x.ten}: ${x.key === 'kich_ban' || x.key === 'xuat' ? (x.tt === 'xong' ? 'có' : 'chưa') : `${x.so}/${x.tong}`}`).join(' · ')}>
      {c.nac.map((x) => <i key={x.key} style={{ width: 13, height: 7, borderRadius: 2, background: x.tt === 'xong' ? '#4ade80' : x.tt === 'dang' ? 'var(--amber)' : 'var(--line)' }} />)}
      <span style={{ ...mono, marginLeft: 5 }}>{c.ket}</span>
    </span>
  );
}
const ChipGoc = ({ g, on }: { g: GocSpy; on?: () => void }) => (
  <button type="button" onClick={on} title={`${loaiGocSpy(g.loai).ten}: ${g.ten} · bấm để lọc theo góc này`}
    style={{ all: 'unset', cursor: 'pointer', fontSize: 11, padding: '0 6px', borderRadius: 4, border: '1px solid var(--cyan)', color: 'var(--cyan)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle' }}>{loaiGocSpy(g.loai).ic} {g.ten}</button>
);

type Gom = 'khong' | 'loai' | 'khuon';
function BangCreative({ d, goc, locGoc, setLocGoc, chon, setChon, onMoPhim, onSoSanh }: { d: KhoSanPham; goc: GocSpy[]; locGoc: number | null; setLocGoc: (x: number | null) => void; chon: number[]; setChon: (x: number[]) => void; onMoPhim: (id: number) => void; onSoSanh: () => void }) {
  const [gom, setGom] = useNho<Gom>('xv-sp-gom', 'loai', ['khong', 'loai', 'khuon']);
  const [xep, setXep] = useNho<'moi' | 'gan_xong'>('xv-sp-xep', 'moi', ['moi', 'gan_xong']);
  const [tim, setTim] = useState('');
  const ds = useMemo(() => {
    const t = tim.trim().toLowerCase();
    const l = d.creative.filter((c) => (locGoc == null || c.goc.some((g) => g.id === locGoc)) && (!t || [c.ten, c.hook, c.cta, ...c.goc.map((g) => g.ten)].some((x) => x.toLowerCase().includes(t))));
    const diem = (c: DongCreative) => c.nac.filter((x) => x.tt === 'xong').length;
    return [...l].sort((a, b) => (xep === 'gan_xong' ? diem(b) - diem(a) : 0) || b.sua_luc.localeCompare(a.sua_luc));
  }, [d.creative, locGoc, tim, xep]);
  const nhom: { ten: string; ds: DongCreative[] }[] = gom === 'khong' ? [{ ten: '', ds }]
    : gom === 'khuon' ? [...new Set(ds.map(tenKhuon))].map((k) => ({ ten: k, ds: ds.filter((c) => tenKhuon(c) === k) }))
    : LOAI_GOC_SPY.map((l) => ({ ten: `${l.ic} ${l.ten}`, ds: ds.filter((c) => c.goc.some((g) => g.loai === l.key)) })).filter((x) => x.ds.length);
  const gocLoc = locGoc != null ? (goc.find((g) => g.id === locGoc) ?? d.creative.flatMap((c) => c.goc).find((g) => g.id === locGoc)) : null;
  const doi = (id: number) => setChon(chon.includes(id) ? chon.filter((x) => x !== id) : [...chon, id]);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={mono}>Gom</span><Seg options={[{ value: 'loai' as Gom, label: 'Loại góc' }, { value: 'khuon' as Gom, label: 'Khuôn' }, { value: 'khong' as Gom, label: 'Không' }]} value={gom} onChange={setGom} />
        <span style={mono}>Xếp</span><Seg options={[{ value: 'moi' as const, label: 'Mới sửa' }, { value: 'gan_xong' as const, label: 'Sắp xong' }]} value={xep} onChange={setXep} />
        <input className="xv-in" style={{ width: 200 }} value={tim} onChange={(e) => setTim(e.target.value)} placeholder="🔍 tên, hook, CTA, góc…" />
        {gocLoc && <Pill color="var(--cyan)" title="Bỏ lọc góc"><button type="button" onClick={() => setLocGoc(null)} style={{ all: 'unset', cursor: 'pointer' }}>{loaiGocSpy(gocLoc.loai).ic} {gocLoc.ten} ✕</button></Pill>}
      </div>
      <div style={{ overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 980, fontSize: 12 }}>
          <thead><tr><th style={{ ...th, width: 24 }} /><th style={th}>Creative</th><th style={th}>Góc</th><th style={th}>Khuôn</th><th style={th}>Hook</th><th style={th}>CTA</th><th style={th}>Ngôn ngữ</th><th style={th}>Sản xuất</th></tr></thead>
          <tbody>
            {nhom.map((g) => (
              <Fragment key={g.ten || 'tat_ca'}>
                {g.ten && <tr><td colSpan={8} style={{ ...o, background: 'var(--bg-2)', fontWeight: 600 }} title={`${g.ds.length} creative`}>{g.ten}</td></tr>}
                {g.ds.map((c) => {
                  const chinh = (gom === 'loai' ? c.goc.find((x) => `${loaiGocSpy(x.loai).ic} ${loaiGocSpy(x.loai).ten}` === g.ten) : null) ?? c.goc[0];
                  const phu = c.goc.filter((x) => x !== chinh);
                  return (
                    <tr key={`${g.ten}-${c.id}`} style={{ background: chon.includes(c.id) ? 'color-mix(in srgb, var(--cyan) 8%, transparent)' : undefined }}>
                      <td style={o}><input type="checkbox" checked={chon.includes(c.id)} onChange={() => doi(c.id)} aria-label={`chọn #${c.id}`} /></td>
                      <td style={{ ...o, minWidth: 260 }}>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                          <span style={{ width: 22, height: 32, flexShrink: 0, borderRadius: 3, border: '1px solid var(--line)', background: c.anh ? `center / cover no-repeat url(${anhNho(c.anh, 160)}), #111` : 'var(--bg-2)' }} />
                          <button type="button" onClick={() => onMoPhim(c.id)} title={`#${c.id} · ${c.ten} · ${c.so_shot} shot${c.xuat ? ' · đã xuất' : ''}`} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>{c.ten.replace(/^[^·]*·\s*/, '')}</button>
                          {c.sua_sau_xuat && <span style={{ ...mono, color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 4, padding: '0 4px', whiteSpace: 'nowrap' }} title="Có shot sửa sau lần xuất gần nhất — bản xuất đang dùng đã cũ">sửa sau xuất</span>}
                        </span>
                      </td>
                      <td style={o}>{chinh ? <ChipGoc g={chinh} on={() => setLocGoc(chinh.id)} /> : <span style={mono}>chưa gắn</span>}{phu.length > 0 && <span style={{ ...mono, marginLeft: 4 }} title={phu.map((x) => `${loaiGocSpy(x.loai).ic} ${x.ten}`).join('\n')}>+{phu.length}</span>}</td>
                      <td style={o}><Pill color="var(--fg-2)" title={c.tpl ? `template #${c.tpl.id}` : 'không tạo từ template'}>{tenKhuon(c)}</Pill></td>
                      <td style={{ ...o, maxWidth: 220 }}><span title={c.hook} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.hook || '—'}</span></td>
                      <td style={{ ...o, maxWidth: 180 }}><span title={c.cta} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cta || '—'}</span></td>
                      <td style={o}><Pill color="var(--cyan)" title="ngôn ngữ của lời / chữ màn (kinh thánh)">{c.ngon_ngu.toUpperCase()}</Pill></td>
                      <td style={o}><NacSx c={c} /></td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {!ds.length && <tr><td colSpan={8} style={{ ...o, ...mono }}>Không có creative khớp bộ lọc.</td></tr>}
          </tbody>
        </table>
      </div>
      {chon.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', border: '1px solid var(--cyan)', borderRadius: 8 }}>
          <b style={{ fontSize: 12 }} title={chon.map((x) => `#${x}`).join(' ')}>Đã chọn</b>
          <Nut chinh ly={(chon.length < 2 || chon.length > 4) && 'chọn 2–4 creative để so'} onClick={onSoSanh}>So cạnh nhau</Nut>
          <Nut onClick={() => setChon([])}>Bỏ chọn</Nut>
        </div>
      )}
    </div>
  );
}

function BanDo({ d, goc, onMoPhim, onMoGoc }: { d: KhoSanPham; goc: (GocSpy & { so_nhac: number })[]; onMoPhim: (id: number) => void; onMoGoc: (id: number) => void }) {
  const bd = banDo(d.creative);
  const [mo, setMo] = useState<string | null>(null);
  const [het, setHet] = useState(false);
  const cot = COT_DONG.filter((c) => c.key !== 'ngoai' || d.creative.some((x) => dongCua(x) === 'ngoai'));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, border: '1px solid var(--line)' }}>
        <thead><tr><th style={th}>Loại góc</th>{cot.map((c) => <th key={c.key} style={th}>{c.ten}</th>)}</tr></thead>
        <tbody>
          {LOAI_GOC_SPY.map((l) => {
            const soGoc = goc.filter((g) => g.loai === l.key).length;
            return (
              <tr key={l.key} style={{ background: mo === l.key ? 'color-mix(in srgb, var(--cyan) 8%, transparent)' : undefined }}>
                <td style={o}><button type="button" onClick={() => setMo(mo === l.key ? null : l.key)} title={`${soGoc} góc trên spy · bấm để mở ma trận góc × khuôn`} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700 }}>{mo === l.key ? '▾' : '▸'} {l.ic} {l.ten}</button></td>
                {cot.map((c) => { const ids = bd[l.key]?.[c.key] ?? []; return <td key={c.key} style={{ ...o, fontWeight: 700, color: ids.length ? 'var(--fg-1)' : 'var(--fg-4)' }} title={ids.length ? ids.map((x) => `#${x}`).join(' ') + ' (một creative gắn nhiều góc nên có thể ở nhiều hàng)' : 'chưa có creative'}>{ids.length}</td>; })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {mo && (() => {
        // Góc ĐÃ có creative lên đầu (không thì góc dùng nhiều nhất có thể rơi khỏi 12 dòng đầu), rồi theo lượt nhắc.
        const coCr = (id: number) => d.creative.some((c) => c.goc.some((x) => x.id === id));
        const ds = goc.filter((g) => g.loai === mo).sort((a, b) => Number(coCr(b.id)) - Number(coCr(a.id)) || b.so_nhac - a.so_nhac);
        const hien = het ? ds : ds.slice(0, 12);
        const cotK = COT_KHUON.filter((k) => k.dong !== 'ngoai' || d.creative.some((x) => dongCua(x) === 'ngoai'));
        return (
          <div style={{ overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
            {!ds.length && <div style={{ ...mono, padding: 10 }}>Chưa tải được góc từ spy cho loại này.</div>}
            {ds.length > 0 && <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr><th style={{ ...th, minWidth: 240 }}>Góc</th>{cotK.map((k) => <th key={`${k.dong}.${k.khuon}`} style={{ ...th, textAlign: 'center', width: 26, borderLeft: k === cotK.find((x) => x.dong === k.dong) ? '1px solid var(--fg-4)' : undefined }} title={k.ten}>{k.ngan}</th>)}</tr></thead>
              <tbody>
                {hien.map((g) => (
                  <tr key={g.id}>
                    <td style={{ ...o, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${g.so_nhac} lượt nhắc${g.mo_ta ? ` · ${g.mo_ta}` : ''}`}><button type="button" onClick={() => onMoGoc(g.id)} style={{ all: 'unset', cursor: 'pointer' }}>{g.ten}</button></td>
                    {cotK.map((k) => { const ids = oMaTran(d.creative, g.id, k); return (
                      <td key={`${k.dong}.${k.khuon}`} style={{ ...o, textAlign: 'center', padding: 2, borderLeft: k === cotK.find((x) => x.dong === k.dong) ? '1px solid var(--fg-4)' : undefined }}>
                        <button type="button" disabled={!ids.length} onClick={() => ids[0] && onMoPhim(ids[0])} title={ids.length ? ids.map((x) => `#${x}`).join(' ') : `${g.ten} × ${k.ten}: trống`}
                          style={{ all: 'unset', cursor: ids.length ? 'pointer' : 'default', display: 'inline-block', width: 12, height: 12, borderRadius: 2, border: '1px solid var(--line)', background: ids.length ? '#4ade80' : 'transparent' }} />
                      </td>); })}
                  </tr>
                ))}
              </tbody>
            </table>}
            {ds.length > 12 && <button type="button" className="xv-lienket xv-mono" style={{ margin: 8 }} onClick={() => setHet(!het)} title={`${ds.length} góc`}>{het ? '▴ chỉ góc nhiều lượt nhắc' : '▾ hiện hết góc'}</button>}
          </div>
        );
      })()}
    </div>
  );
}

function CayGoc({ d, goc, onMoPhim, onMoGoc }: { d: KhoSanPham; goc: (GocSpy & { so_nhac: number })[]; onMoPhim: (id: number) => void; onMoGoc: (id: number) => void }) {
  const [het, setHet] = useState(false);
  const ds = goc.length ? goc : d.creative.flatMap((c) => c.goc.map((g) => ({ ...g, so_nhac: 0 })));
  const theo = (id: number) => d.creative.filter((c) => c.goc.some((g) => g.id === id));
  return (
    <div style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
      <button type="button" className="xv-lienket xv-mono" style={{ justifySelf: 'start' }} onClick={() => setHet(!het)}>{het ? '▴ chỉ góc đã có creative' : '▾ hiện cả góc chưa có creative'}</button>
      {LOAI_GOC_SPY.map((l) => {
        const gl = [...new Map(ds.filter((g) => g.loai === l.key).map((g) => [g.id, g])).values()];
        const co = gl.filter((g) => theo(g.id).length);
        return (
          <details key={l.key} open={co.length > 0}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }} title={`${gl.length} góc · ${co.length} góc có creative`}>{l.ic} {l.ten}</summary>
            <div style={{ marginLeft: 12, paddingLeft: 10, borderLeft: '1px solid var(--line)', display: 'grid', gap: 3, margin: '4px 0 6px 12px' }}>
              {(het ? gl : co).map((g) => { const cr = theo(g.id); return (
                <div key={g.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', color: cr.length ? undefined : 'var(--fg-4)' }}>
                  <button type="button" onClick={() => onMoGoc(g.id)} title={`${g.so_nhac} lượt nhắc · ${cr.length} creative · bấm để lọc bảng creative`} style={{ all: 'unset', cursor: 'pointer' }}>{g.ten}</button>
                  <LinkNgoai href={linkGocSpy(g)} className="xv-lienket xv-mono" title="Bằng chứng của góc trên spy (tab mới)">spy ↗</LinkNgoai>
                  {cr.map((c) => <button key={c.id} type="button" className="xv-lienket xv-mono" onClick={() => onMoPhim(c.id)} title={c.ten}>#{c.id}</button>)}
                </div>); })}
              {!het && !co.length && <span style={mono}>chưa góc nào có creative</span>}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function ThuVienThanhPhan({ tp, onMoPhim }: { tp: ThanhPhan[]; onMoPhim: (id: number) => void }) {
  const [loai, setLoai] = useNho<string>('xv-sp-tp', 'hook', LOAI_THANH_PHAN.map((l) => l.key));
  const ds = tp.filter((t) => t.loai === loai);
  const lop = (nhom: 'chu' | 'hinh') => LOAI_THANH_PHAN.filter((l) => l.nhom === nhom).map((l) => ({ value: l.key, label: l.ten, title: `${tp.filter((t) => t.loai === l.key).length} thành phần` }));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span style={mono}>Lời / chữ</span><Seg options={lop('chu')} value={loai} onChange={setLoai} /></span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span style={mono}>Hình / tiếng</span><Seg options={lop('hinh')} value={loai} onChange={setLoai} /></span>
      </div>
      <div style={{ overflow: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead><tr><th style={th}>Nội dung</th><th style={th}>Hình / mô tả</th><th style={th}>Dùng ở</th></tr></thead>
          <tbody>
            {ds.map((t, i) => (
              <tr key={i}>
                <td style={{ ...o, maxWidth: 360 }}>{t.noi_dung}</td>
                <td style={{ ...o, ...mono, maxWidth: 300 }} title={t.phu}><span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.phu || '—'}</span></td>
                <td style={o} title={`${t.dung_o.length} creative${t.co_media ? ` · ${t.co_media} lần có hình / clip sẵn` : ''}`}>
                  <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{t.dung_o.map((x) => <button key={x} type="button" className="xv-lienket xv-mono" onClick={() => onMoPhim(x)}>#{x}</button>)}</span>
                </td>
              </tr>
            ))}
            {!ds.length && <tr><td colSpan={3} style={{ ...o, ...mono }}>Chưa có thành phần loại này trong các creative của sản phẩm.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** So 2–4 creative theo từng thành phần; ô khác nhau tô vàng. Ngăn chồng lên ngăn sản phẩm. */
function SoSanh({ ds, tp, onClose, onMoPhim }: { ds: DongCreative[]; tp: ThanhPhan[]; onClose: () => void; onMoPhim: (id: number) => void }) {
  const cua = (id: number, loai: string) => tp.filter((t) => t.loai === loai && t.dung_o.includes(id)).map((t) => t.noi_dung).join(' · ') || '—';
  const hang: [string, (c: DongCreative) => string][] = [
    ['Góc', (c) => c.goc.map((g) => g.ten).join(' · ') || '—'], ['Khuôn', tenKhuon], ['Hook', (c) => c.hook || '—'], ['CTA', (c) => c.cta || '—'], ['Ngôn ngữ', (c) => c.ngon_ngu.toUpperCase()],
    ...LOAI_THANH_PHAN.filter((l) => !['hook', 'cta'].includes(l.key)).map((l) => [l.ten, (c: DongCreative) => cua(c.id, l.key)] as [string, (c: DongCreative) => string]),
    ['Sản xuất', (c) => c.ket],
  ];
  return (
    <Ngan onClose={onClose} tieuDe="So cạnh nhau">
      <div style={{ overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 220 * ds.length }}>
          <thead><tr><th style={th} />{ds.map((c) => <th key={c.id} style={th}><button type="button" onClick={() => onMoPhim(c.id)} style={{ all: 'unset', cursor: 'pointer', color: 'var(--cyan)' }} title={c.ten}>#{c.id}</button></th>)}</tr></thead>
          <tbody>{hang.map(([ten, f]) => { const v = ds.map(f); const khac = new Set(v).size > 1; return (
            <tr key={ten}><td style={{ ...o, ...mono }}>{ten}</td>{v.map((x, i) => <td key={i} style={{ ...o, background: khac ? 'color-mix(in srgb, var(--amber) 16%, transparent)' : undefined, maxWidth: 280 }}>{x}</td>)}</tr>); })}</tbody>
        </table>
      </div>
    </Ngan>
  );
}
