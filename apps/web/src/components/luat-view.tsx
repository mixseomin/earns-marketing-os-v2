'use client';
// TAB "LUẬT CAMP" — thư viện luật điều hành campaign theo kệ (chung / search / dsa / video / display /
// pmax / pop), mỗi luật tự khai NHẮM vào đâu (loại · chiến lược · tài khoản · thị trường · bậc · camp
// áp thêm · camp trừ · hoặc "nhắm như luật X"), TRỌNG SỐ phân xử khi nhiều luật cùng chạm một đơn vị.
// Nguồn nằm bên be.adfond (luat-camp.ts + bảng luat / luat_cau_hinh); tab này chỉ là màn sửa qua
// /api/adfond/luat: mở là đọc lại, lưu là gửi sang, adfond kiểm (kiemLuat) rồi mới ghi.
// Hai góc nhìn, một cơ chế: nhìn từ THƯ VIỆN (luật này nhắm ai) và nhìn từ CAMP (camp này chịu luật nào;
// "áp thêm"/"trừ" ở đây chính là sửa nham.camp / nham.tru_camp của luật).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Collapsible, ConfirmDeleteButton, Drawer, EmptyState, GuardedButton, MultiSelect, Panel, Pill, Segmented, SelectField, SimpleTable, Spinner, TextAreaField, TextField } from '@/components/ui';

type Tang = 'chung' | 'loai' | 'chien_luoc' | 'camp';
type Op = '>=' | '<=' | '>' | '<';
type DieuKien = { chi_so: string; op: Op; nguong: number | string };
type Nham = { loai?: string[]; chien_luoc?: number[]; tai_khoan?: number[]; thi_truong?: string[]; bac?: number[]; camp?: number[]; tru_camp?: number[]; theo_luat?: string };
type Luat = {
  ma: string; ten: string; thu_vien: string; pham_vi: string; nham: Nham; trong_so: number; bat: boolean;
  dong_ho?: { tu?: number; den?: number }; lien_tiep?: number; sau_luat?: string;
  khi: DieuKien[]; tru?: DieuKien[]; lam: string; muc?: number; gac: 'may' | 'nguoi'; vi_sao: string;
};
type DongLuat = Luat & { nguon: 'mac_dinh' | 'nguoi'; nguoi: string | null; cap_nhat: string; khac_mac_dinh: boolean };
type ThamSo = Record<string, number | string | number[] | null>;
type DongGhiDe = { tang: Tang; khoa: string; ghi_de: { tham_so?: Partial<ThamSo> }; nguoi: string | null; cap_nhat: string };
type Camp = { id: number; name: string; loai: string; chien_luoc_id: number | null; tai_khoan_id: number | null; thi_truong: string | null; status: string | null; tran: number | null; ngan_sach: number | null };
type Du = {
  tu_vung: { tang: Tang[]; thu_vien: string[]; loai: string[]; pham_vi: string[]; hanh_dong: string[]; hanh_dong_nguoi: string[]; truc: Record<string, string | null>; chi_so: { ma: string; ten: string; nguon: string }[]; tham_so: string[]; mac_dinh_tham_so: ThamSo };
  thu_vien: DongLuat[]; mac_dinh: string[];
  ghi_de: DongGhiDe[];
  chien_luoc: { id: number; ten: string; trang_thai: string | null }[];
  tai_khoan: { id: number; name: string }[];
  camp: Camp[];
  don_vi: { dv: { loai: string; camp_id?: number | null; chien_luoc_id?: number | null }; tham_so: ThamSo; khop: Record<string, { khop: boolean; vi_sao: string }> } | null;
};

const TANG_NHAN: Record<Tang, string> = { chung: 'Chung', loai: 'Loại camp', chien_luoc: 'Chiến lược', camp: 'Camp' };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11 };
const nho: React.CSSProperties = { fontSize: 11, color: 'var(--fg-3)' };
const nutNho: React.CSSProperties = { ...nho, cursor: 'pointer', background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 8px' };
const nutChinh: React.CSSProperties = { fontSize: 12, cursor: 'pointer', border: '1px solid var(--fg-2)', background: 'var(--bg-2)', color: 'var(--fg-1)', borderRadius: 6, padding: '4px 12px' };
const lienKet: React.CSSProperties = { ...nho, cursor: 'pointer', background: 'none', border: 0, textDecoration: 'underline', padding: 0 };

const docDongHo = (l: Luat) => [l.dong_ho ? `D${l.dong_ho.tu ?? 0}${l.dong_ho.den != null ? `–${l.dong_ho.den}` : '+'}` : '', l.lien_tiep ? `${l.lien_tiep} ngày liền` : '', l.sau_luat ? `sau ${l.sau_luat}` : ''].filter(Boolean).join(' · ') || '—';
const docLam = (l: Luat) => l.muc != null ? `${l.lam} ×${l.muc}` : l.lam;
const soNguong = (n: number | string, t: ThamSo | null): string => {
  if (typeof n === 'number' || !t) return String(n);
  const m = /^\$([a-z_0-9]+)(?:\s*([*+/-])\s*([\d.]+))?$/.exec(n);
  if (!m) return n;
  const g = t[m[1] ?? ''];
  if (typeof g !== 'number') return `${n} (chưa có)`;
  const k = Number(m[3]);
  const v = !m[2] ? g : m[2] === '*' ? g * k : m[2] === '/' ? g / k : m[2] === '+' ? g + k : g - k;
  return `${n}=${+v.toFixed(3)}`;
};
const docNham = (n: Nham, du: Du): string[] => {
  const ra: string[] = [];
  if (n.theo_luat) ra.push(`như ${n.theo_luat}`);
  if (n.loai?.length) ra.push(`loại ${n.loai.join('/')}`);
  if (n.chien_luoc?.length) ra.push(`CL ${n.chien_luoc.map((x) => `#${x}`).join(',')}`);
  if (n.tai_khoan?.length) ra.push(`TK ${n.tai_khoan.map((x) => du.tai_khoan.find((t) => t.id === x)?.name ?? x).join(',')}`);
  if (n.thi_truong?.length) ra.push(`TT ${n.thi_truong.join(',')}`);
  if (n.bac?.length) ra.push(`bậc ${n.bac.join(',')}`);
  if (n.camp?.length) ra.push(`+${n.camp.length} camp`);
  if (n.tru_camp?.length) ra.push(`−${n.tru_camp.length} camp`);
  return ra;
};
const soList = (s: string) => s.split(/[ ,]+/).map(Number).filter((x) => Number.isFinite(x));

export function LuatView() {
  const [du, setDu] = useState<Du | null>(null);
  const [loi, setLoi] = useState('');
  const [ke, setKe] = useState('chung');
  const [chiKhop, setChiKhop] = useState(false);
  const [campId, setCampId] = useState<number | null>(null);
  const [sua, setSua] = useState<{ goc: string; l: Luat; moi: boolean } | null>(null);
  /* tham số tầng đang sửa */
  const [tang, setTang] = useState<Tang>('camp');
  const [tsNhap, setTsNhap] = useState<Partial<ThamSo>>({});
  const [tsGoc, setTsGoc] = useState<Partial<ThamSo>>({});
  const [dangLuu, setDangLuu] = useState(false);

  const tai = useCallback(async (c: number | null, loai?: string) => {
    setLoi('');
    const qs = c != null ? `?camp=${c}` : loai ? `?loai=${loai}` : '';
    const r = await fetch(`/api/adfond/luat${qs}`, { cache: 'no-store' });
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

  const khop = du.don_vi?.khop ?? {};
  const bang = du.thu_vien.filter((l) => l.thu_vien === ke).filter((l) => !chiKhop || khop[l.ma]?.khop);
  const demKe = (k: string) => du.thu_vien.filter((l) => l.thu_vien === k).length;
  const mauMoi = (): Luat => ({ ma: '', ten: '', thu_vien: ke, pham_vi: 'nhom', nham: {}, trong_so: 50, bat: true, khi: [{ chi_so: 'click_ads', op: '>=', nguong: 10 }], lam: 'canh_bao', gac: 'may', vi_sao: '' });
  const tsHieuLuc = du.don_vi?.tham_so ?? null;
  const dongTang = du.ghi_de.find((x) => x.tang === tang && x.khoa === khoaTang);

  const datThamSo = (k: string, raw: string) => {
    const ts: Partial<ThamSo> = { ...tsNhap };
    if (raw.trim() === '') delete ts[k];
    else if (k === 'ngay_mo_mau') ts[k] = soList(raw);
    else if (k === 'mo_hinh') ts[k] = raw.trim();
    else if (/^null$/i.test(raw.trim())) ts[k] = null;
    else { const n = Number(raw); if (Number.isFinite(n)) ts[k] = n; else return; }
    setTsNhap(ts);
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {loi && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{loi}</div>}

      <Panel title="Thư viện luật" subtitle="// kệ = chỗ xếp · Nhắm = áp vào đâu · Trọng số = ai thắng khi đá nhau (hoà thì đi xuống thắng)"
        actions={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {du.don_vi?.dv.camp_id != null && <label style={{ ...nho, display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={chiKhop} onChange={(e) => setChiKhop(e.target.checked)} /> chỉ luật khớp camp đang xem</label>}
          <button onClick={() => setSua({ goc: '', l: mauMoi(), moi: true })} style={nutNho}>+ Luật mới vào kệ {ke}</button>
        </span>}>
        <Segmented options={du.tu_vung.thu_vien.map((k) => ({ value: k, label: `${k} (${demKe(k)})` }))} value={ke} onChange={setKe} style={{ marginBottom: 10 }} />
        {bang.length === 0 ? <EmptyState icon="⚖" title={chiKhop ? 'Không luật nào ở kệ này khớp camp đang xem' : 'Kệ trống'} compact /> : (
          <SimpleTable rows={bang} getRowKey={(l) => l.ma} columns={[
            { key: 'bat', header: 'Bật', width: 36, cell: (l) => <input type="checkbox" checked={l.bat} onChange={(e) => void luuLuat({ ...l, bat: e.target.checked })} title={l.bat ? 'đang bật' : 'đang tắt — không áp vào đâu'} /> },
            { key: 'ma', header: 'Mã', cell: (l) => <button onClick={() => setSua({ goc: JSON.stringify(l), l: structuredClone(l), moi: false })} style={{ ...lienKet, ...mono, textDecoration: l.bat ? 'underline' : 'line-through' }}>{l.ma}</button> },
            { key: 'ten', header: 'Luật', cell: (l) => <span title={l.vi_sao} style={{ color: l.bat ? undefined : 'var(--fg-3)' }}>{l.ten}</span> },
            { key: 'pv', header: 'Phạm vi', cell: (l) => <span style={mono}>{l.pham_vi}</span> },
            { key: 'dh', header: 'Khi nào', cell: (l) => <span style={mono}>{docDongHo(l)}</span> },
            { key: 'khi', header: 'Điều kiện', cell: (l) => <span style={mono}>{l.khi.map((d) => `${d.chi_so} ${d.op} ${soNguong(d.nguong, tsHieuLuc)}`).join(' & ')}{l.tru?.length ? ` · trừ ${l.tru.map((d) => `${d.chi_so} ${d.op} ${d.nguong}`).join(' | ')}` : ''}</span> },
            { key: 'lam', header: 'Làm', cell: (l) => <span style={mono}>{docLam(l)}</span> },
            { key: 'gac', header: 'Gác', width: 56, cell: (l) => <Pill color={l.gac === 'nguoi' ? 'var(--warn, #d9a441)' : 'var(--fg-3)'} label={l.gac === 'nguoi' ? 'người' : 'máy'} size="sm" /> },
            { key: 'ts', header: 'Trọng số', align: 'right', width: 60, cell: (l) => <span style={mono}>{l.trong_so}</span> },
            { key: 'nham', header: 'Nhắm', cell: (l) => { const c = docNham(l.nham, du); return <span style={{ ...mono, color: c.length ? undefined : 'var(--fg-3)' }}>{c.length ? c.join(' · ') : l.thu_vien === 'chung' ? 'mọi đơn vị' : `mọi ${l.thu_vien}`}</span>; } },
            ...(du.don_vi ? [{ key: 'khop', header: camp ? 'Camp đang xem' : `Loại ${du.don_vi.dv.loai}`, cell: (l: DongLuat) => { const k = khop[l.ma]; return <span style={{ ...nho, color: k?.khop ? 'var(--ok, #4caf50)' : 'var(--fg-3)' }}>{k?.khop ? '✓ ' : '— '}{k?.vi_sao}</span>; } }] : []),
            { key: 'nguon', header: 'Nguồn', cell: (l) => <span style={nho}>{l.nguon === 'nguoi' ? `người · ${l.nguoi ?? '?'}` : l.khac_mac_dinh ? `mặc định, đã sửa · ${l.nguoi ?? '?'}` : 'mặc định'}</span> },
          ]} />
        )}
      </Panel>

      <Panel title="Áp vào camp" subtitle="// nhìn từ phía một camp: luật nào đang chịu, vì sao; áp thêm / trừ = sửa nhắm của luật đó"
        actions={<SelectField label="" size="sm" value={campId ?? ''} onChange={(e) => setCampId(Number(e.target.value))} style={{ minWidth: 360 }}>
          {du.chien_luoc.map((cl) => { const cs = du.camp.filter((c) => c.chien_luoc_id === cl.id); return cs.length ? <optgroup key={cl.id} label={`#${cl.id} ${cl.ten}`}>{cs.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.loai} · {c.status}</option>)}</optgroup> : null; })}
          <optgroup label="Không gắn chiến lược">{du.camp.filter((c) => c.chien_luoc_id == null).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.loai} · {c.status}</option>)}</optgroup>
        </SelectField>}>
        {camp && du.don_vi ? (
          <>
            <div style={{ ...nho, marginBottom: 8 }}>
              <b style={{ color: 'var(--fg-1)' }}>{camp.name}</b> · loại <b>{camp.loai}</b> · chiến lược {camp.chien_luoc_id != null ? `#${camp.chien_luoc_id}` : '—'} · tài khoản {du.tai_khoan.find((t) => t.id === camp.tai_khoan_id)?.name ?? '—'} · thị trường {camp.thi_truong ?? '—'} · trần ${camp.tran ?? '—'} · ngân sách ${camp.ngan_sach ?? '—'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 4 }}>
              {du.thu_vien.map((l) => {
                const k = khop[l.ma];
                const apThemRoi = l.nham.camp?.includes(camp.id);
                const truRoi = l.nham.tru_camp?.includes(camp.id);
                return (
                  <div key={l.ma} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 6px', borderRadius: 6, background: k?.khop ? 'var(--bg-2)' : 'transparent' }}>
                    <span style={{ ...mono, width: 64, color: k?.khop ? 'var(--fg-1)' : 'var(--fg-3)' }}>{k?.khop ? '✓' : '—'} {l.ma}</span>
                    <span style={{ fontSize: 12, flex: 1, color: k?.khop ? undefined : 'var(--fg-3)' }} title={l.vi_sao}>{l.ten} <span style={nho}>· {k?.vi_sao}</span></span>
                    <span style={mono}>{l.trong_so}</span>
                    {apThemRoi || truRoi
                      ? <button onClick={() => void goBo(l, camp.id)} style={lienKet}>gỡ {apThemRoi ? 'áp thêm' : 'trừ'}</button>
                      : k?.khop
                        ? <button onClick={() => void truCamp(l, camp.id)} style={lienKet}>trừ camp này</button>
                        : l.bat && <button onClick={() => void apThem(l, camp.id)} style={lienKet}>áp cho camp này</button>}
                  </div>
                );
              })}
            </div>
          </>
        ) : <EmptyState icon="🎯" title="Chọn một camp" compact />}
      </Panel>

      <Panel title="Tham số" subtitle="// bốn tầng đè nhau: chung ← loại ← chiến lược ← (trần + ngân sách thật của camp) ← camp · ô trống = kế thừa"
        actions={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Segmented size="xs" options={du.tu_vung.tang.map((t) => ({ value: t, label: `${TANG_NHAN[t]}${t === 'chung' ? '' : ` ${khoaTang}`}` }))} value={tang} onChange={setTang} />
          {dongTang && <span style={nho}>đã đè · {dongTang.nguoi ?? '?'} · {dongTang.cap_nhat.slice(0, 16)}</span>}
          {dongTang && <ConfirmDeleteButton onDelete={() => void goi('DELETE', { tang, khoa: khoaTang })} labelIdle="Xoá tầng này" labelArmed="Về tầng trên?" />}
          <GuardedButton reason={!tsDirty ? 'Chưa sửa gì' : dangLuu ? 'Đang lưu…' : !khoaTang ? 'Chưa có khoá tầng' : null} onClick={() => void goi('PUT', { tang, khoa: khoaTang, tham_so: tsNhap })} style={nutChinh}>Lưu tham số</GuardedButton>
        </span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {du.tu_vung.tham_so.map((k) => {
            const v = tsNhap[k];
            const kt = tsHieuLuc?.[k] ?? du.tu_vung.mac_dinh_tham_so[k];
            const hien = v === undefined ? '' : v === null ? 'null' : Array.isArray(v) ? v.join(' ') : String(v);
            return <TextField key={k} label={k} size="sm" mono value={hien} placeholder={kt == null ? 'null' : Array.isArray(kt) ? kt.join(' ') : String(kt)}
              onChange={(e) => datThamSo(k, e.target.value)} style={v !== undefined ? { borderColor: 'var(--fg-2)' } : undefined} />;
          })}
        </div>
        {tsHieuLuc && (
          <div style={{ ...nho, marginTop: 8 }}>
            Hiệu lực cho camp đang xem: CPC hoà vốn = {(() => { const a = tsHieuLuc.aov, b = tsHieuLuc.bien, c = tsHieuLuc.cvr; return typeof a === 'number' && typeof b === 'number' && typeof c === 'number' ? `$${(a * b * c).toFixed(2)}` : 'chưa đủ vế'; })()}
            {' · '}trần ${String(tsHieuLuc.tran)} · ngân sách {tsHieuLuc.ngan_sach == null ? 'chưa khai' : `$${tsHieuLuc.ngan_sach}`} · mô hình {String(tsHieuLuc.mo_hinh)}
          </div>
        )}
      </Panel>

      <Collapsible title="Từ vựng — chỉ số, hành động, trục xung đột" hint="thứ luật được phép nhắc tới; chỉ số chưa cấp từ kho thì luật dùng nó treo, không sai">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11 }}>
          <div>{du.tu_vung.chi_so.map((c) => <div key={c.ma} style={mono}><b>{c.ma}</b> · {c.ten} <span style={nho}>← {c.nguon}</span></div>)}</div>
          <div>
            <div style={nho}>Máy tự làm: {du.tu_vung.hanh_dong.filter((h) => !du.tu_vung.hanh_dong_nguoi.includes(h)).join(', ')}</div>
            <div style={{ ...nho, marginTop: 4 }}>Người quyết (máy chỉ đề xuất): {du.tu_vung.hanh_dong_nguoi.join(', ')}</div>
            <div style={{ ...nho, marginTop: 8 }}>Trục xung đột: {Object.entries(du.tu_vung.truc).filter(([, t]) => t).map(([h, t]) => `${h}→${t}`).join(' · ')}. Tạm dừng / đóng SP đá mọi hành động đổi bid, tiền, bậc, mẫu.</div>
            <div style={{ ...nho, marginTop: 8 }}>Ngưỡng: số, <code>$tham_so</code>, <code>$tham_so*1.3</code>. <code>dong_ho</code> = ngày trọn vẹn từ lúc bật. <code>lien_tiep</code> = n ngày liền. <code>sau_luat</code> = chỉ chạm nếu luật kia đã chạm.</div>
          </div>
        </div>
      </Collapsible>

      {sua && <SuaLuat du={du} goc={sua.goc} luat={sua.l} moi={sua.moi} dangLuu={dangLuu} onClose={() => setSua(null)} onSave={luuLuat}
        onVeMacDinh={async (ma) => { if (await goi('POST', { ma, ve_mac_dinh: true })) setSua(null); }} />}
    </div>
  );
}

/* ── Drawer sửa một luật ── */
function SuaLuat({ du, goc, luat, moi, dangLuu, onClose, onSave, onVeMacDinh }: {
  du: Du; goc: string; luat: Luat; moi: boolean; dangLuu: boolean; onClose: () => void; onSave: (l: Luat) => void; onVeMacDinh: (ma: string) => void;
}) {
  const [l, setL] = useState<Luat>(luat);
  const dirty = JSON.stringify(l) !== goc;
  const dat = <K extends keyof Luat>(k: K, v: Luat[K]) => setL({ ...l, [k]: v });
  const datNham = <K extends keyof Nham>(k: K, v: Nham[K]) => setL({ ...l, nham: { ...l.nham, [k]: v } });
  const laNguoi = du.tu_vung.hanh_dong_nguoi.includes(l.lam);
  const dk = (key: 'khi' | 'tru') => {
    const rows = l[key] ?? [];
    const set = (rs: DieuKien[]) => setL({ ...l, [key]: rs });
    return (
      <div style={{ display: 'grid', gap: 4 }}>
        {rows.map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr 24px', gap: 4 }}>
            <SelectField label="" size="sm" mono value={d.chi_so} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, chi_so: e.target.value } : x)))}>
              {du.tu_vung.chi_so.map((c) => <option key={c.ma} value={c.ma}>{c.ma} · {c.ten}</option>)}
            </SelectField>
            <SelectField label="" size="sm" mono value={d.op} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, op: e.target.value as Op } : x)))}>
              {['>=', '<=', '>', '<'].map((o) => <option key={o} value={o}>{o}</option>)}
            </SelectField>
            <TextField label="" size="sm" mono value={String(d.nguong)} placeholder="42 hoặc $tran*1.3" onChange={(e) => { const raw = e.target.value; const n = Number(raw); set(rows.map((x, j) => (j === i ? { ...x, nguong: raw.trim() !== '' && Number.isFinite(n) ? n : raw } : x))); }} />
            <button onClick={() => set(rows.filter((_, j) => j !== i))} style={{ ...lienKet, color: 'var(--danger)' }} title="bỏ điều kiện">✕</button>
          </div>
        ))}
        <button onClick={() => set([...rows, { chi_so: 'click_ads', op: '>=', nguong: 0 }])} style={{ ...nutNho, justifySelf: 'start' }}>+ điều kiện</button>
      </div>
    );
  };
  const opsCl = du.chien_luoc.map((c) => ({ value: c.id, label: `#${c.id} ${c.ten}` }));
  const opsTk = du.tai_khoan.map((t) => ({ value: t.id, label: t.name }));
  const opsCamp = du.camp.map((c) => ({ value: c.id, label: `${c.name} · ${c.loai}` }));
  const opsLuat = du.thu_vien.filter((x) => x.ma !== l.ma).map((x) => x.ma);
  return (
    <Drawer onClose={onClose} width={680} dirty={dirty}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{moi ? 'Luật mới' : `Luật ${l.ma}`}</h3>
      <div style={{ ...nho, marginBottom: 12 }}>adfond kiểm lúc lưu: chỉ số phải có trong từ vựng, hành động tăng tiền / mở mẩu / đóng SP bắt buộc gác người, theo_luat / sau_luat phải trỏ vào luật có thật.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <TextField label="Mã" size="sm" mono value={l.ma} disabled={!moi} onChange={(e) => dat('ma', e.target.value.trim())} placeholder="K9 / D30-x" />
        <SelectField label="Kệ" size="sm" value={l.thu_vien} onChange={(e) => dat('thu_vien', e.target.value)}>{du.tu_vung.thu_vien.map((k) => <option key={k} value={k}>{k}</option>)}</SelectField>
        <SelectField label="Phạm vi" size="sm" value={l.pham_vi} onChange={(e) => dat('pham_vi', e.target.value)}>{du.tu_vung.pham_vi.map((k) => <option key={k} value={k}>{k}</option>)}</SelectField>
        <TextField label="Tên" size="sm" gridColumn="1 / 4" value={l.ten} onChange={(e) => dat('ten', e.target.value)} />
        <TextField label="Trọng số 0-100" size="sm" mono type="number" value={l.trong_so} onChange={(e) => dat('trong_so', Number(e.target.value))} />
        <SelectField label="Gác" size="sm" value={laNguoi ? 'nguoi' : l.gac} disabled={laNguoi} lockReason={laNguoi ? 'hành động này bắt buộc gác người' : undefined} onChange={(e) => dat('gac', e.target.value as 'may' | 'nguoi')}>
          <option value="may">máy tự làm</option><option value="nguoi">người quyết</option>
        </SelectField>
        <label style={{ ...nho, display: 'flex', alignItems: 'center', gap: 6, marginTop: 18 }}><input type="checkbox" checked={l.bat} onChange={(e) => dat('bat', e.target.checked)} /> đang bật</label>
      </div>

      <div style={{ ...nho, marginTop: 14, marginBottom: 4 }}>Khi nào</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        <TextField label="Từ ngày (D)" size="sm" mono value={l.dong_ho?.tu ?? ''} onChange={(e) => dat('dong_ho', { ...l.dong_ho, tu: e.target.value === '' ? undefined : Number(e.target.value) })} />
        <TextField label="Đến ngày" size="sm" mono value={l.dong_ho?.den ?? ''} onChange={(e) => dat('dong_ho', { ...l.dong_ho, den: e.target.value === '' ? undefined : Number(e.target.value) })} />
        <TextField label="N ngày liền" size="sm" mono value={l.lien_tiep ?? ''} onChange={(e) => dat('lien_tiep', e.target.value === '' ? undefined : Number(e.target.value))} />
        <SelectField label="Chỉ sau luật" size="sm" value={l.sau_luat ?? ''} onChange={(e) => dat('sau_luat', e.target.value || undefined)}><option value="">—</option>{opsLuat.map((m) => <option key={m} value={m}>{m}</option>)}</SelectField>
      </div>

      <div style={{ ...nho, marginTop: 14, marginBottom: 4 }}>Điều kiện (tất cả phải thoả)</div>
      {dk('khi')}
      <div style={{ ...nho, marginTop: 10, marginBottom: 4 }}>Trừ khi (một cái thoả là bỏ qua)</div>
      {dk('tru')}

      <div style={{ ...nho, marginTop: 14, marginBottom: 4 }}>Làm gì</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
        <SelectField label="Hành động" size="sm" value={l.lam} onChange={(e) => { const lam = e.target.value; setL({ ...l, lam, gac: du.tu_vung.hanh_dong_nguoi.includes(lam) ? 'nguoi' : l.gac }); }}>
          {du.tu_vung.hanh_dong.map((h) => <option key={h} value={h}>{h}{du.tu_vung.hanh_dong_nguoi.includes(h) ? ' (người)' : ''}</option>)}
        </SelectField>
        <TextField label="Mức (×k / bậc)" size="sm" mono value={l.muc ?? ''} onChange={(e) => dat('muc', e.target.value === '' ? undefined : Number(e.target.value))} />
      </div>
      <TextAreaField label="Vì sao luật này tồn tại" size="sm" value={l.vi_sao} onChange={(e) => dat('vi_sao', e.target.value)} style={{ minHeight: 44 }} />

      <div style={{ ...nho, marginTop: 14, marginBottom: 4 }}>Nhắm — áp vào đâu (rỗng = mọi đơn vị cùng kệ)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <MultiSelect label="Loại camp" compact options={du.tu_vung.loai.map((x) => ({ value: x, label: x }))} selected={l.nham.loai ?? []} onChange={(v) => datNham('loai', v.length ? v : undefined)} hideSearch />
        <MultiSelect label="Chiến lược" compact options={opsCl} selected={l.nham.chien_luoc ?? []} onChange={(v) => datNham('chien_luoc', v.length ? v : undefined)} />
        <MultiSelect label="Tài khoản" compact options={opsTk} selected={l.nham.tai_khoan ?? []} onChange={(v) => datNham('tai_khoan', v.length ? v : undefined)} />
        <TextField label="Thị trường" size="sm" mono value={(l.nham.thi_truong ?? []).join(',')} placeholder="US,IT" onChange={(e) => datNham('thi_truong', e.target.value.split(/[ ,]+/).filter(Boolean).length ? e.target.value.split(/[ ,]+/).filter(Boolean) : undefined)} style={{ width: 90 }} />
        <TextField label="Bậc thầu" size="sm" mono value={(l.nham.bac ?? []).join(',')} placeholder="0,1" onChange={(e) => datNham('bac', soList(e.target.value).length ? soList(e.target.value) : undefined)} style={{ width: 70 }} />
        <SelectField label="Nhắm như luật" size="sm" value={l.nham.theo_luat ?? ''} onChange={(e) => datNham('theo_luat', e.target.value || undefined)}><option value="">—</option>{opsLuat.map((m) => <option key={m} value={m}>{m}</option>)}</SelectField>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <MultiSelect label="Áp thêm cho camp" compact options={opsCamp} selected={l.nham.camp ?? []} onChange={(v) => datNham('camp', v.length ? v : undefined)} popupWidth={420} />
        <MultiSelect label="Trừ camp" compact options={opsCamp} selected={l.nham.tru_camp ?? []} onChange={(v) => datNham('tru_camp', v.length ? v : undefined)} popupWidth={420} />
      </div>

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
