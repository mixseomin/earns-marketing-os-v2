'use client';
// TAB "LUẬT CAMPAIGN" — thư viện luật điều hành campaign theo kệ (chung / search / dsa / video / display /
// pmax / pop), mỗi luật tự khai NHẮM vào đâu (loại · chiến lược · tài khoản · thị trường · bậc · campaign
// áp thêm · campaign trừ · hoặc "nhắm như luật X"), TRỌNG SỐ phân xử khi nhiều luật cùng chạm một đơn vị.
// Nguồn nằm bên be.adfond (luat-camp.ts + bảng luat / luat_cau_hinh); tab này là màn sửa qua
// /api/adfond/luat: mở là đọc lại, lưu là gửi sang, adfond kiểm (kiemLuat) rồi mới ghi.
// Chữ trên màn: CHỈ nhãn có dấu (tu_vung.nhan từ adfond — một sổ nhãn, không tự đặt ở đây); mã máy chỉ nằm
// ở tooltip. Hai góc nhìn, một cơ chế: từ THƯ VIỆN (luật này nhắm ai) và từ CAMPAIGN (campaign này chịu luật nào).
// Mọi ô chọn là <PickField>/<MultiSelect> (select2, gõ để lọc) — không <select> thường (anh ra luật 19/09/2026).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Collapsible, ConfirmDeleteButton, Drawer, EmptyState, GuardedButton, MultiSelect, Panel, PickField, Pill, Segmented, SimpleTable, Spinner, Tabs, TextAreaField, TextField } from '@/components/ui';

type Tang = 'chung' | 'loai' | 'chien_luoc' | 'camp';
type Op = '>=' | '<=' | '>' | '<';
type DieuKien = { chi_so: string; op: Op; nguong: number | string };
type Nham = { loai?: string[]; chien_luoc?: number[]; tai_khoan?: number[]; thi_truong?: string[]; bac?: number[]; camp?: number[]; tru_camp?: number[]; theo_luat?: string };
type Luat = {
  ma: string; ten: string; thu_vien: string; pham_vi: string; nham: Nham; trong_so: number; bat: boolean;
  dong_ho?: { tu?: number; den?: number }; lien_tiep?: number; sau_luat?: string;
  khi: DieuKien[]; tru?: DieuKien[]; hanh_dong: { lam: string; muc?: number }[]; kich_luat?: string[]; bo_luat?: string[]; gac: 'may' | 'nguoi'; vi_sao: string;
};
type DongLuat = Luat & { nguon: 'mac_dinh' | 'nguoi'; nguoi: string | null; cap_nhat: string; khac_mac_dinh: boolean };
type ThamSo = Record<string, number | string | number[] | null>;
type NhanThamSo = { ten: string; dv: 'usd' | 'so' | 'ti_le' | 'ngay' | 'chu' | 'danh_sach'; nhom: string; mo_ta: string };
type DongGhiDe = { tang: Tang; khoa: string; ghi_de: { tham_so?: Partial<ThamSo> }; nguoi: string | null; cap_nhat: string };
type Camp = { id: number; name: string; loai: string; chien_luoc_id: number | null; tai_khoan_id: number | null; thi_truong: string | null; status: string | null; tran: number | null; ngan_sach: number | null };
type Du = {
  tu_vung: {
    tang: Tang[]; thu_vien: string[]; loai: string[]; pham_vi: string[]; hanh_dong: string[]; hanh_dong_nguoi: string[]; truc: Record<string, string | null>;
    chi_so: { ma: string; ten: string; nguon: string }[]; tham_so: string[]; mac_dinh_tham_so: ThamSo;
    nhan: { thu_vien: Record<string, string>; pham_vi: Record<string, string>; hanh_dong: Record<string, string>; gac: Record<string, string>; truc: Record<string, string>; op: Record<string, string>; tham_so: Record<string, NhanThamSo>; nhom_tham_so: Record<string, string>; tang: Record<Tang, string>; loai: Record<string, string> };
  };
  thu_vien: DongLuat[]; mac_dinh: string[];
  ghi_de: DongGhiDe[];
  chien_luoc: { id: number; ten: string; trang_thai: string | null }[];
  tai_khoan: { id: number; name: string }[];
  camp: Camp[];
  /** campaign đang bật → mã luật đang chịu */
  khop_camp: Record<string, string[]>;
  don_vi: { dv: { loai: string; camp_id?: number | null }; tham_so: ThamSo; khop: Record<string, { khop: boolean; vi_sao: string }> } | null;
};

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11 };
const nho: React.CSSProperties = { fontSize: 11, color: 'var(--fg-3)' };
const nutNho: React.CSSProperties = { ...nho, cursor: 'pointer', background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 8px' };
const nutChinh: React.CSSProperties = { fontSize: 12, cursor: 'pointer', border: '1px solid var(--fg-2)', background: 'var(--bg-2)', color: 'var(--fg-1)', borderRadius: 6, padding: '4px 12px' };
const lienKet: React.CSSProperties = { ...nho, cursor: 'pointer', background: 'none', border: 0, textDecoration: 'underline', padding: 0 };
const vung: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', marginTop: 10 };
const tieuDeVung: React.CSSProperties = { ...nho, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 };
const soList = (s: string) => s.split(/[ ,]+/).map(Number).filter((x) => Number.isFinite(x));

/** Số hiện theo đơn vị: tiền "$0,30", tỉ lệ "55%", ngày "30 ngày". */
function hienSo(v: unknown, dv: NhanThamSo['dv']): string {
  if (v == null) return 'chưa biết';
  if (Array.isArray(v)) return v.map((x) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][x] ?? x).join(' ');
  if (typeof v !== 'number') return String(v);
  if (dv === 'usd') return `$${v.toFixed(2)}`;
  if (dv === 'ti_le') return `${+(v * 100).toFixed(2)}%`;
  if (dv === 'ngay') return `${v} ngày`;
  return String(v);
}

export function LuatView() {
  const [du, setDu] = useState<Du | null>(null);
  const [loi, setLoi] = useState('');
  const [ke, setKe] = useState('chung');
  const [chiKhop, setChiKhop] = useState(false);
  const [campId, setCampId] = useState<number | null>(null);
  const [sua, setSua] = useState<{ goc: string; l: Luat; moi: boolean } | null>(null);
  const [tang, setTang] = useState<Tang>('camp');
  const [tsNhap, setTsNhap] = useState<Partial<ThamSo>>({});
  const [tsGoc, setTsGoc] = useState<Partial<ThamSo>>({});
  const [dangLuu, setDangLuu] = useState(false);

  const tai = useCallback(async (c: number | null) => {
    setLoi('');
    const r = await fetch(`/api/adfond/luat${c != null ? `?camp=${c}` : ''}`, { cache: 'no-store' });
    const j = (await r.json().catch(() => null)) as (Du & { error?: string }) | null;
    if (!r.ok || !j) { setLoi(j?.error || `adfond trả ${r.status}`); return; }
    setDu(j);
    if (c == null && j.camp.length) setCampId(j.camp.find((x) => x.status === 'enabled')?.id ?? j.camp[0]!.id);
  }, []);
  useEffect(() => { void tai(campId); }, [campId, tai]);

  const camp = useMemo(() => du?.camp.find((c) => c.id === campId) ?? null, [du, campId]);
  const khoaTang = tang === 'chung' ? '*' : tang === 'loai' ? (camp?.loai ?? 'search') : tang === 'chien_luoc' ? String(camp?.chien_luoc_id ?? '') : String(campId ?? '');
  useEffect(() => {
    const d = du?.ghi_de.find((x) => x.tang === tang && x.khoa === khoaTang)?.ghi_de.tham_so ?? {};
    setTsNhap(structuredClone(d)); setTsGoc(structuredClone(d));
  }, [du, tang, khoaTang]);
  const tsDirty = JSON.stringify(tsNhap) !== JSON.stringify(tsGoc);

  const goi = async (method: 'PUT' | 'POST' | 'DELETE', body: unknown): Promise<boolean> => {
    setDangLuu(true); setLoi('');
    const r = await fetch('/api/adfond/luat', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setDangLuu(false);
    if (!r.ok) { setLoi(j.error || `lỗi ${r.status}`); return false; }
    await tai(campId);
    return true;
  };
  const luuLuat = async (l: Luat) => { if (await goi('PUT', { luat: l })) setSua(null); };
  const apThem = (l: Luat, id: number) => luuLuat({ ...l, nham: { ...l.nham, camp: [...new Set([...(l.nham.camp ?? []), id])], tru_camp: (l.nham.tru_camp ?? []).filter((x) => x !== id) } });
  const truCamp = (l: Luat, id: number) => luuLuat({ ...l, nham: { ...l.nham, tru_camp: [...new Set([...(l.nham.tru_camp ?? []), id])], camp: (l.nham.camp ?? []).filter((x) => x !== id) } });
  const goBo = (l: Luat, id: number) => luuLuat({ ...l, nham: { ...l.nham, camp: (l.nham.camp ?? []).filter((x) => x !== id), tru_camp: (l.nham.tru_camp ?? []).filter((x) => x !== id) } });

  if (!du && !loi) return <div style={{ padding: 20 }}><Spinner /></div>;
  if (!du) return <EmptyState icon="⚖" title="Không đọc được bộ luật từ be.adfond" description={loi} />;

  const N = du.tu_vung.nhan;
  const tenChiSo = (ma: string) => du.tu_vung.chi_so.find((c) => c.ma === ma)?.ten ?? ma;
  const tenCl = (id: number) => { const c = du.chien_luoc.find((x) => x.id === id); return c ? `#${c.id} ${c.ten}` : `#${id}`; };
  const tenTk = (id: number) => du.tai_khoan.find((t) => t.id === id)?.name ?? `#${id}`;
  const tenCamp = (id: number) => du.camp.find((c) => c.id === id)?.name ?? `#${id}`;
  const tsHieuLuc = du.don_vi?.tham_so ?? null;
  /** Ngưỡng: số → số; `$tran*1.3` → "Trần CPC đang đặt ×1,3 (= $0,39)". */
  const docNguong = (n: number | string): string => {
    if (typeof n === 'number') return String(n);
    const m = /^\$([a-z_0-9]+)(?:\s*([*+/-])\s*([\d.]+))?$/.exec(n);
    if (!m) return n;
    const k = m[1] ?? ''; const nhan = N.tham_so[k];
    const g = tsHieuLuc?.[k];
    const phep = m[2] ? ` ${m[2] === '*' ? '×' : m[2] === '/' ? '÷' : m[2]}${m[3]}` : '';
    let so = '';
    if (typeof g === 'number') { const kk = Number(m[3]); const v = !m[2] ? g : m[2] === '*' ? g * kk : m[2] === '/' ? g / kk : m[2] === '+' ? g + kk : g - kk; so = ` (= ${hienSo(v, nhan?.dv ?? 'so')})`; }
    else if (tsHieuLuc) so = ' (chưa có số)';
    return `${nhan?.ten ?? k}${phep}${so}`;
  };
  const docDk = (d: DieuKien) => `${tenChiSo(d.chi_so)} ${N.op[d.op] ?? d.op} ${docNguong(d.nguong)}`;
  const docKhiNao = (l: Luat) => [l.dong_ho ? `ngày ${l.dong_ho.tu ?? 0}${l.dong_ho.den != null ? `–${l.dong_ho.den}` : ' trở đi'}` : '', l.lien_tiep ? `${l.lien_tiep} ngày liền` : '', l.sau_luat ? `sau khi ${l.sau_luat} chạm` : ''].filter(Boolean).join(' · ') || 'mọi ngày';
  const docHd = (h: { lam: string; muc?: number }) => `${N.hanh_dong[h.lam] ?? h.lam}${h.muc != null ? (h.lam.endsWith('bac') ? ` → bậc ${h.muc}` : ` ×${h.muc}`) : ''}`;
  const tenLuat = (ma: string) => du.thu_vien.find((x) => x.ma === ma)?.ten ?? ma;
  const docLam = (l: Luat) => [l.hanh_dong.map(docHd).join(' + '), l.kich_luat?.length ? `kích ${l.kich_luat.map(tenLuat).join(', ')}` : '', l.bo_luat?.length ? `bỏ ${l.bo_luat.map(tenLuat).join(', ')}` : ''].filter(Boolean).join(' · ');
  const docNham = (n: Nham): string[] => {
    const ra: string[] = [];
    if (n.theo_luat) ra.push(`như luật ${n.theo_luat}`);
    if (n.loai?.length) ra.push(`loại ${n.loai.map((x) => N.loai[x] ?? x).join(', ')}`);
    if (n.chien_luoc?.length) ra.push(`chiến lược ${n.chien_luoc.map((x) => `#${x}`).join(', ')}`);
    if (n.tai_khoan?.length) ra.push(`tài khoản ${n.tai_khoan.map(tenTk).join(', ')}`);
    if (n.thi_truong?.length) ra.push(`thị trường ${n.thi_truong.join(', ')}`);
    if (n.bac?.length) ra.push(`bậc ${n.bac.join(', ')}`);
    if (n.camp?.length) ra.push(`áp thêm ${n.camp.length} campaign`);
    if (n.tru_camp?.length) ra.push(`trừ ${n.tru_camp.length} campaign`);
    return ra;
  };

  const khop = du.don_vi?.khop ?? {};
  const bang = du.thu_vien.filter((l) => l.thu_vien === ke).filter((l) => !chiKhop || khop[l.ma]?.khop);
  const demKe = (k: string) => du.thu_vien.filter((l) => l.thu_vien === k).length;
  const mauMoi = (): Luat => ({ ma: '', ten: '', thu_vien: ke, pham_vi: 'nhom', nham: {}, trong_so: 50, bat: true, khi: [{ chi_so: 'click_ads', op: '>=', nguong: 10 }], hanh_dong: [{ lam: 'canh_bao' }], gac: 'may', vi_sao: '' });
  const opsCampChon = [...du.chien_luoc.flatMap((cl) => du.camp.filter((c) => c.chien_luoc_id === cl.id).map((c) => ({ value: c.id, label: `#${cl.id} ${cl.ten} · ${c.name} · ${N.loai[c.loai] ?? c.loai} · ${c.status}` }))),
    ...du.camp.filter((c) => c.chien_luoc_id == null).map((c) => ({ value: c.id, label: `(không chiến lược) · ${c.name} · ${N.loai[c.loai] ?? c.loai} · ${c.status}` }))];
  const dongTang = du.ghi_de.find((x) => x.tang === tang && x.khoa === khoaTang);
  const datThamSo = (k: string, raw: string) => {
    const ts: Partial<ThamSo> = { ...tsNhap };
    if (raw.trim() === '') delete ts[k];
    else if (N.tham_so[k]?.dv === 'danh_sach') ts[k] = soList(raw);
    else if (N.tham_so[k]?.dv === 'chu') ts[k] = raw.trim();
    else if (/^null$/i.test(raw.trim())) ts[k] = null;
    else { const n = Number(raw); if (Number.isFinite(n)) ts[k] = n; else return; }
    setTsNhap(ts);
  };
  const nhomThamSo = Object.entries(N.nhom_tham_so).map(([k, ten]) => ({ k, ten, keys: du.tu_vung.tham_so.filter((p) => N.tham_so[p]?.nhom === k) }));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {loi && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{loi}</div>}

      <Panel title="Thư viện luật" subtitle="// kệ = chỗ xếp · Nhắm = áp vào đâu · Trọng số = ai thắng khi đá nhau (hoà thì đi xuống thắng)"
        actions={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {camp && <label style={{ ...nho, display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={chiKhop} onChange={(e) => setChiKhop(e.target.checked)} /> chỉ luật khớp campaign đang xem</label>}
          <button onClick={() => setSua({ goc: '', l: mauMoi(), moi: true })} style={nutNho}>+ Luật mới vào kệ {N.thu_vien[ke] ?? ke}</button>
        </span>}>
        <Segmented options={du.tu_vung.thu_vien.map((k) => ({ value: k, label: `${N.thu_vien[k] ?? k} (${demKe(k)})` }))} value={ke} onChange={setKe} style={{ marginBottom: 10 }} />
        {bang.length === 0 ? <EmptyState icon="⚖" title={chiKhop ? 'Không luật nào ở kệ này khớp campaign đang xem' : 'Kệ trống'} compact /> : (
          <SimpleTable rows={bang} getRowKey={(l) => l.ma} columns={[
            { key: 'bat', header: 'Bật', width: 36, cell: (l) => <input type="checkbox" checked={l.bat} onChange={(e) => void luuLuat({ ...l, bat: e.target.checked })} title={l.bat ? 'đang bật' : 'đang tắt — không áp vào đâu'} /> },
            { key: 'ten', header: 'Luật', cell: (l) => (
              <button onClick={() => setSua({ goc: JSON.stringify(l), l: structuredClone(l), moi: false })} title={`mã ${l.ma} · ${l.vi_sao}`} style={{ ...lienKet, fontSize: 12, textAlign: 'left', color: l.bat ? 'var(--fg-1)' : 'var(--fg-3)', textDecoration: l.bat ? 'underline' : 'line-through' }}>{l.ten}</button>
            ) },
            { key: 'pv', header: 'Phạm vi', cell: (l) => <span style={{ fontSize: 12 }}>{N.pham_vi[l.pham_vi] ?? l.pham_vi}</span> },
            { key: 'dh', header: 'Khi nào', cell: (l) => <span style={{ fontSize: 12 }}>{docKhiNao(l)}</span> },
            { key: 'khi', header: 'Điều kiện', cell: (l) => <span style={{ fontSize: 12 }}>{l.khi.map(docDk).join(' và ')}{l.tru?.length ? <span style={nho}> · trừ khi {l.tru.map(docDk).join(' hoặc ')}</span> : null}</span> },
            { key: 'lam', header: 'Làm', cell: (l) => <span style={{ fontSize: 12 }}>{docLam(l)}</span> },
            { key: 'gac', header: 'Gác', width: 90, cell: (l) => <Pill color={l.gac === 'nguoi' ? 'var(--warn, #d9a441)' : 'var(--fg-3)'} label={N.gac[l.gac] ?? l.gac} size="sm" uppercase={false} mono={false} /> },
            { key: 'ts', header: 'Trọng số', align: 'right', width: 64, cell: (l) => <span style={mono}>{l.trong_so}</span> },
            { key: 'nham', header: 'Nhắm', cell: (l) => { const c = docNham(l.nham); return <span style={{ fontSize: 12, color: c.length ? undefined : 'var(--fg-3)' }}>{c.length ? c.join(' · ') : l.thu_vien === 'chung' ? 'mọi đơn vị' : `mọi campaign ${N.thu_vien[l.thu_vien] ?? l.thu_vien}`}</span>; } },
            ...(camp ? [{ key: 'khop', header: 'Campaign đang xem', cell: (l: DongLuat) => { const k = khop[l.ma]; return <span style={{ ...nho, color: k?.khop ? 'var(--ok, #4caf50)' : 'var(--fg-3)' }}>{k?.khop ? '✓ ' : '— '}{k?.vi_sao}</span>; } }] : []),
            { key: 'nguon', header: 'Nguồn', cell: (l) => <span style={nho}>{l.nguon === 'nguoi' ? `người tạo · ${l.nguoi ?? '?'}` : l.khac_mac_dinh ? `mặc định, đã sửa · ${l.nguoi ?? '?'}` : 'mặc định'}</span> },
          ]} />
        )}
      </Panel>

      <Panel title="Campaign đang chạy — luật đang chịu" subtitle="// mọi campaign đang bật, mỗi dòng là bộ luật máy sẽ chấm cho nó (khớp nhắm); bấm tên để xem vì sao / áp thêm / trừ ở panel dưới">
        {(() => {
          const chay = du.camp.filter((c) => c.status === 'enabled');
          if (!chay.length) return <EmptyState icon="⏸" title="Không campaign nào đang bật" compact />;
          return <SimpleTable rows={chay} getRowKey={(c) => String(c.id)} columns={[
            { key: 'ten', header: 'Campaign', cell: (c) => <button onClick={() => setCampId(c.id)} style={{ ...lienKet, fontSize: 12, textAlign: 'left', color: c.id === campId ? 'var(--accent)' : 'var(--fg-1)' }}>{c.name}</button> },
            { key: 'loai', header: 'Loại', width: 70, cell: (c) => <span style={{ fontSize: 12 }}>{N.loai[c.loai] ?? c.loai}</span> },
            { key: 'cl', header: 'Chiến lược', cell: (c) => <span style={nho}>{c.chien_luoc_id != null ? tenCl(c.chien_luoc_id) : '—'}</span> },
            { key: 'so', header: 'Luật', align: 'right', width: 48, cell: (c) => <span style={mono}>{(du.khop_camp[c.id] ?? []).length}</span> },
            { key: 'luat', header: 'Đang chịu', cell: (c) => { const ds = du.khop_camp[c.id] ?? []; return ds.length ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{ds.map((ma) => { const l = du.thu_vien.find((x) => x.ma === ma); return <Pill key={ma} color={l?.gac === 'nguoi' ? 'var(--warn, #d9a441)' : 'var(--fg-3)'} label={l?.ten ?? ma} size="sm" uppercase={false} mono={false} />; })}</span> : <span style={nho}>không luật nào — kệ/nhắm chưa phủ tới</span>; } },
          ]} />;
        })()}
      </Panel>

      <Panel title="Áp vào campaign" subtitle="// nhìn từ phía một campaign: luật nào đang chịu, vì sao; áp thêm / trừ = sửa nhắm của luật đó"
        actions={<div style={{ minWidth: 360 }}><PickField label="" options={opsCampChon} value={campId} onChange={(v) => { if (v != null) setCampId(v); }} popupWidth={520} placeholder="— chọn campaign —" /></div>}>
        {camp && du.don_vi ? (
          <>
            <div style={{ ...nho, marginBottom: 8 }}>
              <b style={{ color: 'var(--fg-1)' }}>{camp.name}</b> · loại <b>{N.loai[camp.loai] ?? camp.loai}</b> · chiến lược {camp.chien_luoc_id != null ? tenCl(camp.chien_luoc_id) : '—'} · tài khoản {camp.tai_khoan_id != null ? tenTk(camp.tai_khoan_id) : '—'} · thị trường {camp.thi_truong ?? '—'} · trần CPC {camp.tran != null ? hienSo(camp.tran, 'usd') : '—'} · ngân sách ngày {camp.ngan_sach != null ? hienSo(camp.ngan_sach, 'usd') : '—'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 4 }}>
              {du.thu_vien.map((l) => {
                const k = khop[l.ma];
                const apThemRoi = l.nham.camp?.includes(camp.id);
                const truRoi = l.nham.tru_camp?.includes(camp.id);
                return (
                  <div key={l.ma} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 6px', borderRadius: 6, background: k?.khop ? 'var(--bg-2)' : 'transparent' }}>
                    <span style={{ width: 14, color: k?.khop ? 'var(--ok, #4caf50)' : 'var(--fg-3)' }}>{k?.khop ? '✓' : '—'}</span>
                    <span style={{ fontSize: 12, flex: 1, color: k?.khop ? undefined : 'var(--fg-3)' }} title={`mã ${l.ma} · ${l.vi_sao}`}>{l.ten} <span style={nho}>· {k?.vi_sao}</span></span>
                    <span style={mono} title="trọng số">{l.trong_so}</span>
                    {apThemRoi || truRoi
                      ? <button onClick={() => void goBo(l, camp.id)} style={lienKet}>gỡ {apThemRoi ? 'áp thêm' : 'trừ'}</button>
                      : k?.khop
                        ? <button onClick={() => void truCamp(l, camp.id)} style={lienKet}>trừ campaign này</button>
                        : l.bat && <button onClick={() => void apThem(l, camp.id)} style={lienKet}>áp cho campaign này</button>}
                  </div>
                );
              })}
            </div>
          </>
        ) : <EmptyState icon="🎯" title="Chọn một campaign" compact />}
      </Panel>

      <Panel title="Tham số" subtitle="// bốn tầng đè nhau: chung ← loại ← chiến lược ← (trần + ngân sách thật của campaign) ← campaign · ô trống = kế thừa, số mờ bên trong là giá trị đang hiệu lực"
        actions={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Segmented size="xs" options={du.tu_vung.tang.map((t) => ({ value: t, label: t === 'chung' ? N.tang.chung : t === 'loai' ? `${N.tang.loai}: ${N.loai[khoaTang] ?? khoaTang}` : t === 'chien_luoc' ? `${N.tang.chien_luoc} #${khoaTang}` : `${N.tang.camp}: ${camp?.name ?? ''}` }))} value={tang} onChange={setTang} />
          {dongTang && <span style={nho}>đã đè · {dongTang.nguoi ?? '?'} · {dongTang.cap_nhat.slice(0, 16)}</span>}
          {dongTang && <ConfirmDeleteButton onDelete={() => void goi('DELETE', { tang, khoa: khoaTang })} labelIdle="Xoá tầng này" labelArmed="Về tầng trên?" />}
          <GuardedButton reason={!tsDirty ? 'Chưa sửa gì' : dangLuu ? 'Đang lưu…' : !khoaTang ? 'Chưa có khoá tầng' : null} onClick={() => void goi('PUT', { tang, khoa: khoaTang, tham_so: tsNhap })} style={nutChinh}>Lưu tham số</GuardedButton>
        </span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {nhomThamSo.map((g) => (
            <div key={g.k} style={vung}>
              <div style={tieuDeVung}>{g.ten}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {g.keys.map((k) => {
                  const nhan = N.tham_so[k]!;
                  const v = tsNhap[k];
                  const kt = tsHieuLuc?.[k] ?? du.tu_vung.mac_dinh_tham_so[k];
                  const hien = v === undefined ? '' : v === null ? 'null' : Array.isArray(v) ? v.join(' ') : String(v);
                  return <TextField key={k} label={nhan.ten} labelTooltip={`mã ${k}${nhan.mo_ta ? ` · ${nhan.mo_ta}` : ''}`} size="sm" mono value={hien}
                    placeholder={kt == null ? 'chưa biết' : Array.isArray(kt) ? kt.join(' ') : String(kt)}
                    hint={v === undefined ? `đang hiệu lực: ${hienSo(kt, nhan.dv)}` : 'đè tại tầng này'}
                    onChange={(e) => datThamSo(k, e.target.value)} style={v !== undefined ? { borderColor: 'var(--fg-2)' } : undefined} />;
                })}
              </div>
            </div>
          ))}
        </div>
        {tsHieuLuc && (
          <div style={{ ...nho, marginTop: 10 }}>
            Đang hiệu lực cho campaign đang xem: CPC hoà vốn = {(() => { const a = tsHieuLuc.aov, b = tsHieuLuc.bien, c = tsHieuLuc.cvr; return typeof a === 'number' && typeof b === 'number' && typeof c === 'number' ? hienSo(a * b * c, 'usd') : 'chưa đủ vế (AOV × biên × tỉ lệ mua)'; })()}
            {' · '}trần CPC {hienSo(tsHieuLuc.tran, 'usd')} · ngân sách ngày {tsHieuLuc.ngan_sach == null ? 'chưa khai' : hienSo(tsHieuLuc.ngan_sach, 'usd')} · mô hình {String(tsHieuLuc.mo_hinh)}
          </div>
        )}
      </Panel>

      <Collapsible title="Từ vựng — chỉ số, hành động, trục xung đột" hint="thứ luật được phép nhắc tới; chỉ số chưa cấp từ kho thì luật dùng nó treo, không sai">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
          <div>
            <div style={tieuDeVung}>Chỉ số</div>
            {du.tu_vung.chi_so.map((c) => <div key={c.ma} title={`mã ${c.ma}`}><b>{c.ten}</b> <span style={nho}>← {c.nguon}</span></div>)}
          </div>
          <div>
            <div style={tieuDeVung}>Hành động</div>
            <div>Máy tự làm: {du.tu_vung.hanh_dong.filter((h) => !du.tu_vung.hanh_dong_nguoi.includes(h)).map((h) => N.hanh_dong[h] ?? h).join(', ')}</div>
            <div style={{ marginTop: 4 }}>Người quyết (máy chỉ đề xuất): {du.tu_vung.hanh_dong_nguoi.map((h) => N.hanh_dong[h] ?? h).join(', ')}</div>
            <div style={{ ...tieuDeVung, marginTop: 10 }}>Trục xung đột</div>
            <div>{Object.entries(N.truc).map(([t, ten]) => `${ten}: ${Object.entries(du.tu_vung.truc).filter(([, x]) => x === t).map(([h]) => N.hanh_dong[h] ?? h).join(' / ')}`).join(' · ')}. Tạm dừng / đóng sản phẩm đá mọi hành động đổi bid, tiền, bậc, mẩu.</div>
          </div>
        </div>
      </Collapsible>

      {sua && <SuaLuat du={du} goc={sua.goc} luat={sua.l} moi={sua.moi} dangLuu={dangLuu} onClose={() => setSua(null)} onSave={luuLuat}
        onVeMacDinh={async (ma) => { if (await goi('POST', { ma, ve_mac_dinh: true })) setSua(null); }} docNguong={docNguong} />}
    </div>
  );
}

/* ── Drawer sửa một luật — bốn tab: Chung · Khi nào & điều kiện · Hành động · Nhắm ── */
type TabSua = 'chung' | 'dieu_kien' | 'hanh_dong' | 'nham';
function SuaLuat({ du, goc, luat, moi, dangLuu, onClose, onSave, onVeMacDinh, docNguong }: {
  du: Du; goc: string; luat: Luat; moi: boolean; dangLuu: boolean; onClose: () => void; onSave: (l: Luat) => void; onVeMacDinh: (ma: string) => void; docNguong: (n: number | string) => string;
}) {
  const N = du.tu_vung.nhan;
  const [l, setL] = useState<Luat>(luat);
  const [tab, setTab] = useState<TabSua>('chung');
  const dirty = JSON.stringify(l) !== goc;
  const dat = <K extends keyof Luat>(k: K, v: Luat[K]) => setL({ ...l, [k]: v });
  const datNham = <K extends keyof Nham>(k: K, v: Nham[K]) => setL({ ...l, nham: { ...l.nham, [k]: v } });
  const laNguoi = l.hanh_dong.some((h) => du.tu_vung.hanh_dong_nguoi.includes(h.lam));
  const datHd = (hd: Luat['hanh_dong']) => setL({ ...l, hanh_dong: hd, gac: hd.some((h) => du.tu_vung.hanh_dong_nguoi.includes(h.lam)) ? 'nguoi' : l.gac });
  const opsHd = du.tu_vung.hanh_dong.map((h) => ({ value: h, label: `${N.hanh_dong[h] ?? h}${du.tu_vung.hanh_dong_nguoi.includes(h) ? ' — người quyết' : ''}` }));
  const opsChiSo = du.tu_vung.chi_so.map((c) => ({ value: c.ma, label: c.ten }));
  const opsOp = (['>=', '<=', '>', '<'] as Op[]).map((o) => ({ value: o, label: N.op[o] ?? o }));
  const opsNguong = [{ value: '#', label: 'số cố định…' }, ...du.tu_vung.tham_so.map((p) => ({ value: `$${p}`, label: N.tham_so[p]?.ten ?? p }))];
  const opsKe = du.tu_vung.thu_vien.map((k) => ({ value: k, label: N.thu_vien[k] ?? k }));
  const opsPv = du.tu_vung.pham_vi.map((k) => ({ value: k, label: N.pham_vi[k] ?? k }));
  const opsGac = [{ value: 'may', label: N.gac.may ?? 'Máy tự làm' }, { value: 'nguoi', label: N.gac.nguoi ?? 'Người quyết' }];
  const opsThiTruong = [...new Set([...du.camp.map((c) => c.thi_truong).filter((x): x is string => !!x), ...(l.nham.thi_truong ?? [])])].sort().map((x) => ({ value: x, label: x }));
  const opsBac = [0, 1, 2, 3].map((b) => ({ value: b, label: `Bậc ${b}${b === 0 ? ' (mua click)' : b === 1 ? ' (nới cửa)' : b === 2 ? ' (tCPA)' : ' (tROAS)'}` }));
  const soDk = l.khi.length + (l.tru?.length ?? 0);
  const soNham = Object.values(l.nham).filter((v) => (Array.isArray(v) ? v.length : v)).length;

  const bangDk = (key: 'khi' | 'tru') => {
    const rows = l[key] ?? [];
    const set = (rs: DieuKien[]) => setL({ ...l, [key]: rs });
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 1fr 24px', gap: 6, alignItems: 'end' }}>
            <PickField label={i === 0 ? 'Chỉ số' : ''} options={opsChiSo} value={d.chi_so} onChange={(v) => { if (v) set(rows.map((x, j) => (j === i ? { ...x, chi_so: v } : x))); }} popupWidth={300} />
            <PickField label={i === 0 ? 'So' : ''} options={opsOp} value={d.op} hideSearch onChange={(v) => { if (v) set(rows.map((x, j) => (j === i ? { ...x, op: v } : x))); }} />
            <PickField label={i === 0 ? 'Ngưỡng' : ''} popupWidth={300}
              options={typeof d.nguong === 'string' && /[*+/-]/.test(d.nguong) ? [...opsNguong, { value: d.nguong, label: docNguong(d.nguong) }] : opsNguong}
              value={typeof d.nguong === 'string' ? d.nguong : '#'}
              onChange={(v) => { if (v) set(rows.map((x, j) => (j === i ? { ...x, nguong: v === '#' ? (typeof x.nguong === 'number' ? x.nguong : 0) : v } : x))); }} />
            <button onClick={() => set(rows.filter((_, j) => j !== i))} style={{ ...lienKet, color: 'var(--danger)', marginBottom: 6 }} title="bỏ điều kiện">✕</button>
            {typeof d.nguong === 'number' && (
              <TextField label="" size="sm" mono type="number" step="any" value={d.nguong} gridColumn="3 / 4" onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, nguong: Number(e.target.value) } : x)))} />
            )}
            {typeof d.nguong === 'string' && (
              <TextField label="" size="sm" mono value={d.nguong} gridColumn="3 / 4" hint="tham số, có thể nhân/cộng: $tran*1.3" onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, nguong: e.target.value } : x)))} />
            )}
          </div>
        ))}
        <button onClick={() => set([...rows, { chi_so: 'click_ads', op: '>=', nguong: 0 }])} style={{ ...nutNho, justifySelf: 'start' }}>+ điều kiện</button>
      </div>
    );
  };
  const opsCl = du.chien_luoc.map((c) => ({ value: c.id, label: `#${c.id} ${c.ten}` }));
  const opsTk = du.tai_khoan.map((t) => ({ value: t.id, label: t.name }));
  const opsCamp = du.camp.map((c) => ({ value: c.id, label: `${c.name} · ${N.loai[c.loai] ?? c.loai}` }));
  const opsLuat = du.thu_vien.filter((x) => x.ma !== l.ma);
  const opsLuatChon = opsLuat.map((m) => ({ value: m.ma, label: `${m.ten} · ${N.pham_vi[m.pham_vi] ?? m.pham_vi}` }));
  const opsLuatCungPv = opsLuat.filter((m) => m.pham_vi === l.pham_vi).map((m) => ({ value: m.ma, label: m.ten }));

  return (
    <Drawer onClose={onClose} width={700} dirty={dirty}>
      <h3 style={{ margin: '0 0 2px', fontSize: 15 }}>{moi ? 'Luật mới' : l.ten || l.ma}</h3>
      <div style={{ ...nho, marginBottom: 10 }}>{moi ? `Kệ ${N.thu_vien[l.thu_vien] ?? l.thu_vien}` : `Mã ${l.ma} · kệ ${N.thu_vien[l.thu_vien] ?? l.thu_vien}`} · adfond kiểm lúc lưu: chỉ số phải có trong từ vựng, hành động tăng tiền / mở mẩu / đóng sản phẩm bắt buộc gác người.</div>
      <Tabs items={[
        { key: 'chung', label: 'Chung' },
        { key: 'dieu_kien', label: 'Khi nào & điều kiện', badge: soDk || undefined },
        { key: 'hanh_dong', label: 'Hành động' },
        { key: 'nham', label: 'Nhắm', badge: soNham || undefined },
      ]} value={tab} onChange={setTab} />

      {tab === 'chung' && (
        <div style={vung}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <TextField label="Mã" labelTooltip="chữ/số, không dấu tiếng Việt; không đổi được sau khi tạo" size="sm" mono value={l.ma} disabled={!moi} onChange={(e) => dat('ma', e.target.value.trim())} placeholder="K9" />
            <PickField label="Kệ" options={opsKe} value={l.thu_vien} hideSearch onChange={(v) => { if (v) dat('thu_vien', v); }} />
            <PickField label="Phạm vi" labelTooltip="đơn vị bị chấm" options={opsPv} value={l.pham_vi} hideSearch onChange={(v) => { if (v) dat('pham_vi', v); }} />
            <TextField label="Tên" size="sm" gridColumn="1 / 4" value={l.ten} onChange={(e) => dat('ten', e.target.value)} />
            <TextField label="Trọng số (0-100)" labelTooltip="nhiều luật cùng chạm mà đá nhau thì số cao thắng; hoà thì đi xuống thắng" size="sm" mono type="number" value={l.trong_so} onChange={(e) => dat('trong_so', Number(e.target.value))} />
            <PickField label="Gác" options={opsGac} value={laNguoi ? 'nguoi' : l.gac} hideSearch disabled={laNguoi} lockReason={laNguoi ? 'có hành động bắt buộc người quyết' : undefined} onChange={(v) => { if (v) dat('gac', v as 'may' | 'nguoi'); }} />
            <label style={{ ...nho, display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}><input type="checkbox" checked={l.bat} onChange={(e) => dat('bat', e.target.checked)} /> đang bật</label>
          </div>
          <TextAreaField label="Vì sao luật này tồn tại" size="sm" value={l.vi_sao} onChange={(e) => dat('vi_sao', e.target.value)} style={{ minHeight: 48, marginTop: 6 }} />
        </div>
      )}

      {tab === 'dieu_kien' && (
        <>
          <div style={vung}>
            <div style={tieuDeVung}>Khi nào chấm</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <TextField label="Từ ngày thứ" labelTooltip="ngày trọn vẹn kể từ lúc bật; trống = mọi ngày" size="sm" mono type="number" value={l.dong_ho?.tu ?? ''} onChange={(e) => dat('dong_ho', { ...l.dong_ho, tu: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <TextField label="Đến ngày thứ" size="sm" mono type="number" value={l.dong_ho?.den ?? ''} onChange={(e) => dat('dong_ho', { ...l.dong_ho, den: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <TextField label="Số ngày liền" labelTooltip="mỗi ngày trong chuỗi đều phải thoả; trống = chấm số tích luỹ" size="sm" mono type="number" value={l.lien_tiep ?? ''} onChange={(e) => dat('lien_tiep', e.target.value === '' ? undefined : Number(e.target.value))} />
              <PickField label="Chỉ sau khi luật" labelTooltip="luật này chỉ chạm nếu luật kia đã chạm cùng đơn vị trước đó" options={opsLuatChon} value={l.sau_luat ?? ''} clearable placeholder="—" popupWidth={320} onChange={(v) => dat('sau_luat', v || undefined)} />
            </div>
          </div>
          <div style={vung}>
            <div style={tieuDeVung}>Điều kiện — tất cả phải thoả</div>
            {bangDk('khi')}
          </div>
          <div style={vung}>
            <div style={tieuDeVung}>Trừ khi — một cái thoả là bỏ qua</div>
            {bangDk('tru')}
          </div>
        </>
      )}

      {tab === 'hanh_dong' && (
        <>
          <div style={vung}>
            <div style={tieuDeVung}>Làm gì — nhiều việc, mỗi việc một trục (hai việc cùng trục thì adfond từ chối lưu)</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {l.hanh_dong.map((h, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 24px', gap: 6, alignItems: 'end' }}>
                  <PickField label={i === 0 ? 'Hành động' : ''} options={opsHd} value={h.lam} popupWidth={300} onChange={(v) => { if (v) datHd(l.hanh_dong.map((x, j) => (j === i ? { ...x, lam: v } : x))); }} />
                  <TextField label={i === 0 ? 'Mức' : ''} labelTooltip="hệ số nhân (hạ bid ×0,7 · tăng ngân sách ×2) hoặc bậc đích (lên bậc → 2)" size="sm" mono type="number" step="any" placeholder={h.lam.endsWith('bac') ? 'bậc đích' : '× hệ số'} value={h.muc ?? ''} onChange={(e) => datHd(l.hanh_dong.map((x, j) => (j === i ? { ...x, muc: e.target.value === '' ? undefined : Number(e.target.value) } : x)))} />
                  <button onClick={() => datHd(l.hanh_dong.filter((_, j) => j !== i))} disabled={l.hanh_dong.length <= 1} style={{ ...lienKet, color: l.hanh_dong.length <= 1 ? 'var(--fg-4)' : 'var(--danger)', marginBottom: 6 }} title={l.hanh_dong.length <= 1 ? 'luật phải có ít nhất một hành động' : 'bỏ hành động'}>✕</button>
                </div>
              ))}
              <button onClick={() => datHd([...l.hanh_dong, { lam: du.tu_vung.hanh_dong.find((h) => !l.hanh_dong.some((x) => x.lam === h)) ?? 'canh_bao' }])} style={{ ...nutNho, justifySelf: 'start' }}>+ hành động</button>
            </div>
            <div style={{ ...nho, marginTop: 8 }}>
              Trục xung đột: {[...new Set(l.hanh_dong.map((h) => du.tu_vung.truc[h.lam]).filter(Boolean))].map((t) => N.truc[t!] ?? t).join(', ') || 'không đá luật nào'}. Gác: {N.gac[laNguoi ? 'nguoi' : l.gac]}{laNguoi ? ' (bắt buộc — máy chỉ đề xuất kèm số)' : ''}.
            </div>
          </div>
          <div style={vung}>
            <div style={tieuDeVung}>Khi chạm — kích thêm / bỏ bớt luật khác trên cùng đơn vị (cùng phạm vi {N.pham_vi[l.pham_vi] ?? l.pham_vi}; một cấp)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <MultiSelect label="Kích thêm luật" compact options={opsLuatCungPv.filter((o) => !l.bo_luat?.includes(o.value))} selected={l.kich_luat ?? []} onChange={(v) => dat('kich_luat', v.length ? v : undefined)} popupWidth={360} />
              <MultiSelect label="Bỏ bớt luật đang áp" compact options={opsLuatCungPv.filter((o) => !l.kich_luat?.includes(o.value))} selected={l.bo_luat ?? []} onChange={(v) => dat('bo_luat', v.length ? v : undefined)} popupWidth={360} />
            </div>
            <div style={{ ...nho, marginTop: 6 }}>Kích = luật kia ra hành động ngay dù điều kiện của nó chưa thoả. Bỏ = kết quả của luật kia bị gạt khỏi lượt chấm này trước khi phân xử.</div>
          </div>
        </>
      )}

      {tab === 'nham' && (
        <>
          <div style={vung}>
            <div style={tieuDeVung}>Theo chiều — rỗng = không giới hạn chiều đó (kệ chung = mọi đơn vị)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
              <MultiSelect label="Loại campaign" compact options={du.tu_vung.loai.map((x) => ({ value: x, label: N.loai[x] ?? x }))} selected={l.nham.loai ?? []} onChange={(v) => datNham('loai', v.length ? v : undefined)} hideSearch />
              <MultiSelect label="Chiến lược" compact options={opsCl} selected={l.nham.chien_luoc ?? []} onChange={(v) => datNham('chien_luoc', v.length ? v : undefined)} />
              <MultiSelect label="Tài khoản" compact options={opsTk} selected={l.nham.tai_khoan ?? []} onChange={(v) => datNham('tai_khoan', v.length ? v : undefined)} />
              <MultiSelect label="Thị trường" compact options={opsThiTruong} selected={l.nham.thi_truong ?? []} onChange={(v) => datNham('thi_truong', v.length ? v : undefined)} />
              <MultiSelect label="Bậc thầu" compact options={opsBac} selected={l.nham.bac ?? []} onChange={(v) => datNham('bac', v.length ? v : undefined)} hideSearch />
            </div>
          </div>
          <div style={vung}>
            <div style={tieuDeVung}>Theo campaign cụ thể — bất kể chiều</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <MultiSelect label="Áp thêm cho campaign" compact options={opsCamp} selected={l.nham.camp ?? []} onChange={(v) => datNham('camp', v.length ? v : undefined)} popupWidth={420} />
              <MultiSelect label="Trừ campaign" compact options={opsCamp} selected={l.nham.tru_camp ?? []} onChange={(v) => datNham('tru_camp', v.length ? v : undefined)} popupWidth={420} />
            </div>
          </div>
          <div style={vung}>
            <div style={tieuDeVung}>Hoặc nhắm y như một luật khác</div>
            <PickField label="" options={opsLuatChon} value={l.nham.theo_luat ?? ''} clearable placeholder="— không —" popupWidth={360} onChange={(v) => datNham('theo_luat', v || undefined)} hint="dùng nguyên nhắm của luật đó (một cấp); các chiều ở trên bị bỏ qua khi chọn" />
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginTop: 16 }}>
        {!moi && (du.mac_dinh.includes(l.ma)
          ? <ConfirmDeleteButton onDelete={() => onVeMacDinh(l.ma)} labelIdle="Về bản mặc định" labelArmed="Bỏ mọi sửa của luật này?" />
          : <ConfirmDeleteButton onDelete={() => onVeMacDinh(l.ma)} labelIdle="Xoá luật" labelArmed="Xoá hẳn luật này?" />)}
        <span style={{ flex: 1 }} />
        <button onClick={onClose} style={nutNho}>Huỷ</button>
        <GuardedButton reason={!l.ma ? 'Thiếu mã' : !l.ten ? 'Thiếu tên' : !l.khi.length ? 'Thiếu điều kiện' : dangLuu ? 'Đang lưu…' : !dirty && !moi ? 'Chưa sửa gì' : null} onClick={() => onSave(l)} style={nutChinh}>Lưu vào thư viện</GuardedButton>
      </div>
    </Drawer>
  );
}
