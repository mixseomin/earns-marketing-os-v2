'use client';
// TAB "LUẬT CAMP" trên trang chủ — nơi người vận hành xem và sửa bộ luật điều hành campaign.
// Nguồn nằm bên be.adfond (packages/db/src/luat-camp.ts + bảng luat_cau_hinh); tab này chỉ là
// màn sửa qua /api/adfond/luat: mở là đọc lại, lưu là gửi sang, adfond kiểm (kiemLuat) rồi mới
// ghi. Bốn tầng đè nhau: chung ← loại camp ← chiến lược ← camp. Tầng đang chọn = thứ đang sửa;
// bảng "hiệu lực" là bộ đã gộp cho tầng đó (tính bên adfond, không chép lại thứ tự gộp ở đây).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Collapsible, ConfirmDeleteButton, Drawer, EmptyState, GuardedButton, Panel, Pill, Segmented, SelectField, SimpleTable, Spinner, TextAreaField, TextField } from '@/components/ui';

type Tang = 'chung' | 'loai' | 'chien_luoc' | 'camp';
type DieuKien = { chi_so: string; op: string; nguong: number | string };
type Luat = {
  ma: string; ten: string; pham_vi: string; loai?: string[]; dong_ho?: { tu?: number; den?: number };
  bac?: number[]; lien_tiep?: number; khi: DieuKien[]; tru?: DieuKien[]; lam: string; muc?: number;
  gac: 'may' | 'nguoi'; vi_sao: string;
};
type ThamSo = Record<string, number | string | number[] | null>;
type GhiDe = { tham_so?: Partial<ThamSo>; luat_them?: Luat[]; luat_tat?: string[] };
type Dong = { tang: Tang; khoa: string; ghi_de: GhiDe; nguoi: string | null; cap_nhat: string };
type Du = {
  tu_vung: { tang: Tang[]; loai: string[]; pham_vi: string[]; hanh_dong: string[]; hanh_dong_nguoi: string[]; chi_so: { ma: string; ten: string; nguon: string }[]; tham_so: string[] };
  mac_dinh: { tham_so: ThamSo; luat: Luat[] };
  theo_loai: Record<string, GhiDe>;
  ghi_de: Dong[];
  chien_luoc: { id: number; ten: string; trang_thai: string | null }[];
  camp: { id: number; name: string; loai: string; chien_luoc_id: number | null; status: string | null; tran: number | null; ngan_sach: number | null }[];
  hieu_luc: Record<string, { tham_so: ThamSo; luat: Luat[] }> | null;
};

const TANG_NHAN: Record<Tang, string> = { chung: 'Chung', loai: 'Theo loại camp', chien_luoc: 'Chiến lược', camp: 'Một camp' };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11 };
const nho: React.CSSProperties = { fontSize: 11, color: 'var(--fg-3)' };

const docDk = (d: DieuKien) => `${d.chi_so} ${d.op} ${d.nguong}`;
const docDongHo = (l: Luat) => l.dong_ho ? `D${l.dong_ho.tu ?? 0}${l.dong_ho.den != null ? `–${l.dong_ho.den}` : '+'}` : l.lien_tiep ? `${l.lien_tiep} ngày liền` : '—';
const docLam = (l: Luat) => l.muc != null ? `${l.lam} ×${l.muc}` : l.lam;

/** Ngưỡng `$tran*1.3` → số thật theo tham số hiệu lực, để cột điều kiện đọc được luôn. */
function soNguong(n: number | string, t: ThamSo): string {
  if (typeof n === 'number') return String(n);
  const m = /^\$([a-z_0-9]+)(?:\s*([*+/-])\s*([\d.]+))?$/.exec(n);
  if (!m) return n;
  const g = t[m[1] ?? ''];
  if (typeof g !== 'number') return `${n} (chưa có)`;
  const k = Number(m[3]);
  const v = !m[2] ? g : m[2] === '*' ? g * k : m[2] === '/' ? g / k : m[2] === '+' ? g + k : g - k;
  return `${n} = ${+v.toFixed(3)}`;
}

export function LuatView() {
  const [tang, setTang] = useState<Tang>('chung');
  const [khoa, setKhoa] = useState('*');
  const [du, setDu] = useState<Du | null>(null);
  const [loi, setLoi] = useState('');
  const [dangLuu, setDangLuu] = useState(false);
  /* bản đang sửa của tầng đang chọn — so với `goc` để biết dirty */
  const [nhap, setNhap] = useState<GhiDe>({});
  const [goc, setGoc] = useState<GhiDe>({});
  const [suaLuat, setSuaLuat] = useState<{ ma: string | null; json: string; goc: string } | null>(null);
  const [loaiXem, setLoaiXem] = useState<string>('');

  const tai = useCallback(async (t: Tang, k: string) => {
    setLoi('');
    const r = await fetch(`/api/adfond/luat?tang=${t}&khoa=${encodeURIComponent(k)}`, { cache: 'no-store' });
    const j = (await r.json().catch(() => null)) as (Du & { error?: string }) | null;
    if (!r.ok || !j) { setLoi(j?.error || `adfond trả ${r.status}`); return; }
    setDu(j);
    const dong = j.ghi_de.find((d) => d.tang === t && d.khoa === k)?.ghi_de ?? {};
    setNhap(structuredClone(dong)); setGoc(structuredClone(dong));
    const loais = Object.keys(j.hieu_luc ?? {});
    setLoaiXem((cu) => (loais.includes(cu) ? cu : loais[0] ?? ''));
  }, []);
  useEffect(() => { void tai(tang, khoa); }, [tang, khoa, tai]);

  const dirty = JSON.stringify(nhap) !== JSON.stringify(goc);
  const hieuLuc = du?.hieu_luc?.[loaiXem] ?? null;
  /* tham số KẾ THỪA (mọi tầng trên, chưa tính tầng này) = hiệu lực trừ phần tầng này đang đè */
  const keThua = useMemo(() => {
    if (!hieuLuc) return {} as ThamSo;
    const dongGoc = du?.ghi_de.find((d) => d.tang === tang && d.khoa === khoa)?.ghi_de.tham_so ?? {};
    const r: ThamSo = { ...hieuLuc.tham_so };
    for (const k of Object.keys(dongGoc)) {
      // tầng này đang đè → giá trị kế thừa thật là của tầng trên; adfond không trả riêng, lấy mặc định/loại làm gần đúng
      r[k] = du?.theo_loai[loaiXem]?.tham_so?.[k] ?? du?.mac_dinh.tham_so[k] ?? null;
    }
    return r;
  }, [hieuLuc, du, tang, khoa, loaiXem]);

  const chonTang = (t: Tang) => {
    setTang(t);
    setKhoa(t === 'chung' ? '*' : t === 'loai' ? (du?.tu_vung.loai[0] ?? 'search') : t === 'chien_luoc' ? String(du?.chien_luoc[0]?.id ?? '') : String(du?.camp[0]?.id ?? ''));
  };

  const datThamSo = (k: string, raw: string) => {
    const ts: Partial<ThamSo> = { ...(nhap.tham_so ?? {}) };
    if (raw.trim() === '') delete ts[k];
    else if (k === 'ngay_mo_mau') ts[k] = raw.split(/[ ,]+/).map(Number).filter((x) => Number.isFinite(x));
    else if (k === 'mo_hinh') ts[k] = raw.trim();
    else if (/^null$/i.test(raw.trim())) ts[k] = null;
    else { const n = Number(raw); if (Number.isFinite(n)) ts[k] = n; else return; }
    setNhap({ ...nhap, tham_so: ts });
  };
  const tatLuat = (ma: string, tat: boolean) => {
    const cu = new Set(nhap.luat_tat ?? []);
    if (tat) cu.add(ma); else cu.delete(ma);
    setNhap({ ...nhap, luat_tat: [...cu] });
  };
  const luuLuatJson = () => {
    if (!suaLuat) return;
    let l: Luat;
    try { l = JSON.parse(suaLuat.json) as Luat; } catch { setLoi('JSON không hợp lệ.'); return; }
    if (!l.ma) { setLoi('Luật phải có "ma".'); return; }
    const them = (nhap.luat_them ?? []).filter((x) => x.ma !== l.ma && x.ma !== suaLuat.ma);
    setNhap({ ...nhap, luat_them: [...them, l] }); setSuaLuat(null); setLoi('');
  };
  const boLuatThem = (ma: string) => setNhap({ ...nhap, luat_them: (nhap.luat_them ?? []).filter((x) => x.ma !== ma) });

  const luu = async () => {
    setDangLuu(true); setLoi('');
    const r = await fetch('/api/adfond/luat', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tang, khoa, ghi_de: nhap }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setDangLuu(false);
    if (!r.ok) { setLoi(j.error || `lưu lỗi ${r.status}`); return; }
    await tai(tang, khoa);
  };
  const veMacDinh = async () => {
    const r = await fetch('/api/adfond/luat', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tang, khoa }) });
    if (!r.ok) { setLoi(((await r.json().catch(() => ({}))) as { error?: string }).error || `xoá lỗi ${r.status}`); return; }
    await tai(tang, khoa);
  };

  if (!du && !loi) return <div style={{ padding: 20 }}><Spinner /></div>;
  if (!du) return <EmptyState icon="⚖" title="Không đọc được bộ luật từ be.adfond" description={loi} />;

  const dongTangNay = du.ghi_de.find((d) => d.tang === tang && d.khoa === khoa);
  const luatTatSet = new Set(nhap.luat_tat ?? []);
  const luatThemMa = new Set((nhap.luat_them ?? []).map((l) => l.ma));
  const nguonLuat = (l: Luat): { nhan: string; mau: string } => {
    if (luatThemMa.has(l.ma)) return { nhan: 'đè tại đây', mau: 'var(--warn, #d9a441)' };
    const oTren = du.ghi_de.find((d) => !(d.tang === tang && d.khoa === khoa) && d.ghi_de.luat_them?.some((x) => x.ma === l.ma));
    if (oTren) return { nhan: `đè ${TANG_NHAN[oTren.tang]} ${oTren.khoa}`, mau: 'var(--fg-2)' };
    return { nhan: 'mặc định', mau: 'var(--fg-3)' };
  };
  /* bảng hiệu lực + luật vừa thêm/tắt ở tầng này (chưa lưu) để thấy ngay */
  const bang: (Luat & { tat: boolean })[] = [
    ...(hieuLuc?.luat ?? []).filter((l) => !luatThemMa.has(l.ma)).map((l) => ({ ...l, tat: luatTatSet.has(l.ma) })),
    ...(nhap.luat_them ?? []).map((l) => ({ ...l, tat: luatTatSet.has(l.ma) })),
  ];
  const mauLuat: Luat = { ma: 'X1', ten: 'Tên luật', pham_vi: 'nhom', loai: [loaiXem || 'video'], dong_ho: { tu: 7 }, khi: [{ chi_so: 'click_ads', op: '<', nguong: '$du_mau_d7' }], lam: 'canh_bao', gac: 'may', vi_sao: 'vì sao luật này tồn tại' };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Panel title="Tầng đang sửa" subtitle="// chung ← loại camp ← chiến lược ← camp — tầng dưới đè tầng trên; xoá dòng = về tầng trên"
        actions={<span style={nho}>{du.ghi_de.length} dòng ghi đè · nguồn be.adfond</span>}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <Segmented options={du.tu_vung.tang.map((t) => ({ value: t, label: TANG_NHAN[t] }))} value={tang} onChange={chonTang} />
          {tang === 'loai' && <Segmented options={du.tu_vung.loai.map((l) => ({ value: l, label: l }))} value={khoa} onChange={setKhoa} />}
          {tang === 'chien_luoc' && (
            <SelectField label="Chiến lược" size="sm" value={khoa} onChange={(e) => setKhoa(e.target.value)} style={{ minWidth: 340 }}>
              {du.chien_luoc.map((c) => <option key={c.id} value={c.id}>#{c.id} · {c.ten}{c.trang_thai ? ` (${c.trang_thai})` : ''}</option>)}
            </SelectField>
          )}
          {tang === 'camp' && (
            <SelectField label="Camp" size="sm" value={khoa} onChange={(e) => setKhoa(e.target.value)} style={{ minWidth: 340 }}>
              {du.chien_luoc.map((cl) => {
                const cs = du.camp.filter((c) => c.chien_luoc_id === cl.id);
                return cs.length ? <optgroup key={cl.id} label={`#${cl.id} ${cl.ten}`}>{cs.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.loai} · {c.status}</option>)}</optgroup> : null;
              })}
              <optgroup label="Không gắn chiến lược">{du.camp.filter((c) => c.chien_luoc_id == null).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.loai} · {c.status}</option>)}</optgroup>
            </SelectField>
          )}
          {du.hieu_luc && Object.keys(du.hieu_luc).length > 1 && (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={nho}>xem hiệu lực cho</span>
              <Segmented size="xs" options={Object.keys(du.hieu_luc).map((l) => ({ value: l, label: l }))} value={loaiXem} onChange={setLoaiXem} /></span>
          )}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            {dongTangNay && <span style={nho}>đã ghi đè · {dongTangNay.nguoi ?? '?'} · {dongTangNay.cap_nhat.slice(0, 16)}</span>}
            {loi && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{loi}</span>}
            {dongTangNay && <ConfirmDeleteButton onDelete={veMacDinh} labelIdle="Về tầng trên" labelArmed="Xoá ghi đè tầng này?" />}
            <GuardedButton reason={!dirty ? 'Chưa sửa gì' : dangLuu ? 'Đang lưu…' : null} onClick={luu}
              style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--fg-2)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' }}>
              Lưu tầng này
            </GuardedButton>
          </span>
        </div>
        {du.ghi_de.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {du.ghi_de.map((d) => (
              <Pill key={`${d.tang}/${d.khoa}`} color={d.tang === tang && d.khoa === khoa ? 'var(--fg-1)' : 'var(--fg-3)'} uppercase={false}
                label={`${TANG_NHAN[d.tang]} ${d.khoa === '*' ? '' : d.khoa}`.trim()} title={`${Object.keys(d.ghi_de.tham_so ?? {}).length} tham số · ${d.ghi_de.luat_them?.length ?? 0} luật đè · ${d.ghi_de.luat_tat?.length ?? 0} tắt`}
                onClick={() => { setTang(d.tang); setKhoa(d.khoa); }} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Tham số" subtitle="// ô trống = kế thừa (giá trị kế thừa mờ bên trong) · gõ số để đè · 'null' = chưa biết (luật dùng nó sẽ treo)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {du.tu_vung.tham_so.map((k) => {
            const v = nhap.tham_so?.[k];
            const kt = keThua[k];
            const hien = v === undefined ? '' : v === null ? 'null' : Array.isArray(v) ? v.join(' ') : String(v);
            return <TextField key={k} label={k} size="sm" mono value={hien} placeholder={kt == null ? 'null' : Array.isArray(kt) ? kt.join(' ') : String(kt)}
              onChange={(e) => datThamSo(k, e.target.value)} style={v !== undefined ? { borderColor: 'var(--fg-2)' } : undefined} />;
          })}
        </div>
        {hieuLuc && (
          <div style={{ ...nho, marginTop: 8 }}>
            CPC hoà vốn (aov × biên × cvr) = {(() => { const a = hieuLuc.tham_so.aov, b = hieuLuc.tham_so.bien, c = hieuLuc.tham_so.cvr; return typeof a === 'number' && typeof b === 'number' && typeof c === 'number' ? `$${(a * b * c).toFixed(2)}` : 'chưa đủ vế'; })()}
            {' · '}trần đang đặt ${String(hieuLuc.tham_so.tran)} · ngân sách {hieuLuc.tham_so.ngan_sach == null ? 'chưa khai' : `$${hieuLuc.tham_so.ngan_sach}`}
          </div>
        )}
      </Panel>

      <Panel title={`Luật hiệu lực${loaiXem ? ` · ${loaiXem}` : ''}`} subtitle="// bộ đã gộp cho tầng đang chọn · tắt = bỏ khỏi tầng này trở xuống · Đè = sửa bản sao tại tầng này"
        actions={<button onClick={() => setSuaLuat({ ma: null, json: JSON.stringify(mauLuat, null, 2), goc: JSON.stringify(mauLuat, null, 2) })} style={{ ...nho, cursor: 'pointer', background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 8px' }}>+ Luật mới</button>}>
        {bang.length === 0 ? <EmptyState icon="⚖" title="Chưa có luật cho loại này" compact /> : (
          <SimpleTable rows={bang} getRowKey={(l) => l.ma} columns={[
            { key: 'tat', header: 'Bật', width: 36, cell: (l) => <input type="checkbox" checked={!l.tat} onChange={(e) => tatLuat(l.ma, !e.target.checked)} title={l.tat ? 'đang tắt ở tầng này' : 'đang bật'} /> },
            { key: 'ma', header: 'Mã', cell: (l) => <span style={{ ...mono, textDecoration: l.tat ? 'line-through' : undefined }}>{l.ma}</span> },
            { key: 'ten', header: 'Luật', cell: (l) => <span title={l.vi_sao} style={{ color: l.tat ? 'var(--fg-3)' : undefined }}>{l.ten}</span> },
            { key: 'pv', header: 'Phạm vi', cell: (l) => <span style={mono}>{l.pham_vi}{l.bac ? ` · bậc ${l.bac.join(',')}` : ''}</span> },
            { key: 'dh', header: 'Khi nào', cell: (l) => <span style={mono}>{docDongHo(l)}</span> },
            { key: 'khi', header: 'Điều kiện', cell: (l) => <span style={mono}>{l.khi.map((d) => `${d.chi_so} ${d.op} ${soNguong(d.nguong, hieuLuc?.tham_so ?? {})}`).join(' & ')}{l.tru?.length ? ` · trừ ${l.tru.map(docDk).join(' | ')}` : ''}</span> },
            { key: 'lam', header: 'Làm', cell: (l) => <span style={mono}>{docLam(l)}</span> },
            { key: 'gac', header: 'Gác', width: 60, cell: (l) => <Pill color={l.gac === 'nguoi' ? 'var(--warn, #d9a441)' : 'var(--fg-3)'} label={l.gac === 'nguoi' ? 'người' : 'máy'} size="sm" /> },
            { key: 'nguon', header: 'Nguồn', cell: (l) => { const n = nguonLuat(l); return <span style={{ ...nho, color: n.mau }}>{n.nhan}</span>; } },
            { key: 'sua', header: '', width: 90, cell: (l) => (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <button onClick={() => setSuaLuat((() => { const j = JSON.stringify((({ tat: _t, ...r }) => r)(l), null, 2); return { ma: l.ma, json: j, goc: j }; })())} style={{ ...nho, cursor: 'pointer', background: 'none', border: 0, textDecoration: 'underline' }}>Đè</button>
                {luatThemMa.has(l.ma) && <button onClick={() => boLuatThem(l.ma)} style={{ ...nho, cursor: 'pointer', background: 'none', border: 0, textDecoration: 'underline', color: 'var(--danger)' }}>bỏ</button>}
              </span>
            ) },
          ]} />
        )}
      </Panel>

      <Collapsible title="Từ vựng — chỉ số, hành động, phạm vi" hint="thứ luật được phép nhắc tới; chỉ số chưa cấp từ kho thì luật dùng nó treo, không sai">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11 }}>
          <div>
            <div style={nho}>Chỉ số</div>
            {du.tu_vung.chi_so.map((c) => <div key={c.ma} style={mono}><b>{c.ma}</b> · {c.ten} <span style={nho}>← {c.nguon}</span></div>)}
          </div>
          <div>
            <div style={nho}>Hành động (máy được tự làm: {du.tu_vung.hanh_dong.filter((h) => !du.tu_vung.hanh_dong_nguoi.includes(h)).join(', ')})</div>
            <div style={mono}>Người quyết: {du.tu_vung.hanh_dong_nguoi.join(', ')}</div>
            <div style={{ ...nho, marginTop: 8 }}>Phạm vi: {du.tu_vung.pham_vi.join(' · ')} · Loại: {du.tu_vung.loai.join(' · ')}</div>
            <div style={{ ...nho, marginTop: 8 }}>Ngưỡng: số, <code>$tham_so</code>, hoặc <code>$tham_so*1.3</code>. Đồng hồ <code>dong_ho.tu/den</code> = ngày trọn vẹn từ lúc bật. <code>lien_tiep</code> = n ngày liền.</div>
          </div>
        </div>
      </Collapsible>

      {suaLuat && (
        <Drawer onClose={() => setSuaLuat(null)} width={560} dirty={suaLuat.json !== suaLuat.goc}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{suaLuat.ma ? `Đè luật ${suaLuat.ma} tại tầng ${TANG_NHAN[tang]} ${khoa}` : 'Luật mới tại tầng này'}</h3>
          <div style={{ ...nho, marginBottom: 10 }}>Giữ nguyên <code>ma</code> để đè luật cùng mã; đổi <code>ma</code> để thành luật riêng. adfond kiểm lúc lưu: chỉ số phải có trong từ vựng, hành động tăng tiền phải <code>gac: &quot;nguoi&quot;</code>.</div>
          <TextAreaField label="JSON" mono value={suaLuat.json} onChange={(e) => setSuaLuat({ ...suaLuat, json: e.target.value })} style={{ minHeight: 360 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={() => setSuaLuat(null)} style={{ ...nho, cursor: 'pointer', background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px' }}>Huỷ</button>
            <button onClick={luuLuatJson} style={{ fontSize: 12, cursor: 'pointer', border: '1px solid var(--fg-2)', background: 'var(--bg-2)', color: 'var(--fg-1)', borderRadius: 6, padding: '4px 12px' }}>Đưa vào tầng này</button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
