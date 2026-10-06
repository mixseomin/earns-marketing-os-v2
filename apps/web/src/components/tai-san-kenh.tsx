'use client';
// Panel "Kênh kéo khách" của tab Tài sản — MA TRẬN tựa × phương pháp trong một DataTable (trang 25 dòng, ô tìm, sort, thẻ trên mobile).
// Bản đầu là cây mỗi tựa một nút 2 dòng + bảng lá 9 cột: 114 tựa thành một trang cuộn dài, anh chê 06/10/2026 → một dòng một tựa,
// mỗi phương pháp một CỘT, ô = chip (bước · tiến độ · lượt 7n · ⚠), chi tiết ở tooltip + drawer khi bấm ô.
// Phương pháp đọc từ THƯ VIỆN (bảng phuong_phap, sửa ở drawer 📚), áp lên mọi sản phẩm theo `nham` (lib/tai-san/ap-dung.ts):
// ô chưa có dòng sổ = "·" (chưa làm), số để TRỐNG (chưa đo ≠ 0). Shop không phương pháp nào nhắm tới hiện thành một dòng "thiếu".
// Ô do máy repo ghi không sửa tay (kenh.mjs đè lại); ô ảo / ô tay sửa ở drawer.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Drawer, EntityRef, GuardedButton, LaBang, Panel, SelectField, TextAreaField, TextField, TienDo, oLa, type DataColumn } from '@/components/ui';
import { extLinkProps } from '@/lib/external-url';
import { TT_SP, type KenhO, type PhuongPhap } from '@/lib/tai-san/kieu';
import { NGUON_DO, demO, type ApDung, type Tua } from '@/lib/tai-san/ap-dung';
import { datApDung, luuPhuongPhap } from '@/lib/actions/phuong-phap';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const mo: React.CSSProperties = { color: 'var(--fg-4)' };
const nutNho: React.CSSProperties = { fontSize: 11.5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };
const nutChinh: React.CSSProperties = { fontSize: 12.5, padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--bg-0, #fff)', cursor: 'pointer' };
type Shop = { khoa: string; ten: string };
const gonUrl = (u: string) => u.replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/\/$/, '');
const PP_TRONG = (key: string): PhuongPhap => ({ key, nhan: key, moTa: '', nham: [], buoc: ['chưa làm'], noi: { tk: [] }, may: null, nguong: null, thuTu: 0, bat: true });

/** Một ô tựa × phương pháp, gọn một dòng: thanh bước · tên bước · a/b · lượt 7n · ⚠. Ô ảo = một chấm mờ. */
function ChipO({ o, k }: { o: KenhO; k: PhuongPhap }) {
  if (o.ao) return <span style={mo}>·</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' }}>
      <TienDo xong={o.muc} tong={k.buoc.length - 1} buoc={k.buoc.slice(1)} so={false} rong={32} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', fontSize: 12 }}>{k.buoc[o.muc] ?? o.muc}</span>
      {o.tong != null && <span style={{ ...phu, fontSize: 11 }}>{o.xong ?? 0}/{o.tong}</span>}
      {o.luot7 != null && <span style={{ fontSize: 11, color: o.luot7 ? 'var(--fg-1)' : 'var(--fg-3)' }}>👁{o.luot7}</span>}
      {o.canhBao && <span style={{ color: 'var(--warn)' }}>⚠</span>}
    </span>
  );
}
/** Tooltip của ô: mọi thứ bảng cũ bày thành 9 cột, nay rê chuột là thấy. */
function tipO(o: KenhO, k: PhuongPhap, may: boolean) {
  if (o.ao) return `${k.nhan}: chưa làm — bấm để bắt đầu`;
  const d = [`${k.nhan} — bước ${o.muc}/${k.buoc.length - 1}: ${k.buoc[o.muc] ?? o.muc}`];
  if (o.tong != null) d.push(`Tiến độ ${o.xong ?? 0}/${o.tong}`);
  const nd = NGUON_DO[o.kenh];
  d.push(nd ? (o.luot7 == null ? `Lượt 7n: chưa có số (${nd.moTa})` : `Lượt 7n: ${o.luot7} (${nd.moTa})`) : 'Lượt 7n: chưa có nguồn đo cho phương pháp này');
  if (o.ngayDang) d.push(`Đăng từ ${o.ngayDang}`);
  if (o.dich) d.push(`Trỏ về ${gonUrl(o.dich)}`);
  if (o.canhBao) d.push(`Cần làm: ${o.canhBao}`);
  if (o.the) d.push(`Card #${o.the.id} · ${o.the.trangThai}`);
  d.push(may ? 'máy repo ghi ô này (kenh.mjs) — sửa ở repo đó' : 'bấm để sửa bước / link / ngày đăng');
  return d.join('\n');
}

const soThat = (t: Tua) => Object.values(t.o).filter((o) => !o.ao).length;

/** Thẻ trên điện thoại: tựa chưa bắt đầu = một dòng; có việc = mỗi phương pháp một dòng chip, bấm dòng → drawer. */
function TheTua({ t, bat, onSua }: { t: Tua; bat: PhuongPhap[]; onSua: (o: KenhO) => void }) {
  const os = bat.filter((k) => t.o[k.key] && !t.o[k.key]!.ao);
  return (
    <div style={{ display: 'grid', gap: 6, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, opacity: os.length ? 1 : 0.65 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0 }}>
        <b style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.ten}</b>
        <span style={{ ...phu, fontSize: 11, flex: 'none' }}>{t.ban.map((x) => x.noi).join(' · ') || 'chưa lên sàn'}</span>
      </div>
      {os.length ? os.map((k) => { const o = t.o[k.key]!; const may = !!t.may;
        return (
          <div key={k.key} onClick={may ? undefined : () => onSua(o)} title={tipO(o, k, may)}
            style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: may ? 'default' : 'pointer' }}>
            <span style={{ ...phu, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', width: 92, flex: 'none' }}>{k.nhan}</span>
            <ChipO o={o} k={k} />
          </div>);
      }) : <div onClick={() => { const k = bat.find((p) => t.o[p.key]); if (k) onSua(t.o[k.key]!); }} style={{ ...mo, fontSize: 12, cursor: 'pointer' }}>
            chưa bắt đầu · {Object.keys(t.o).length} phương pháp — bấm để bắt đầu</div>}
    </div>
  );
}

export function TaiSanKenh({ ap, lib, shops }: { ap: ApDung; lib: PhuongPhap[]; shops: Shop[] }) {
  const [thuVien, datThuVien] = useState(false);
  const [sua, datSua] = useState<{ t: Tua; o: KenhO } | null>(null);
  const ppCua = Object.fromEntries(lib.map((p) => [p.key, p]));
  const dem = demO(ap);
  const bat = lib.filter((p) => p.bat);
  // Tựa có việc thật lên đầu, rồi tựa bán ở nhiều shop, rồi tên — người mở panel xem cái đang chạy trước.
  const rows = [...ap.tua].sort((a, b) => soThat(b) - soThat(a) || b.ban.length - a.ban.length || a.ten.localeCompare(b.ten));
  const cot: DataColumn<Tua>[] = [
    { key: 'ten', header: 'Tựa', align: 'left', width: 260, sortValue: (t) => t.ten,
      cellTitle: (t) => t.ban.map((x) => `${x.noi} · ${TT_SP.find((k) => k.key === x.trangThai)!.chu}`).join('\n') || 'chưa lên sàn',
      cell: (t) => <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
        <span style={{ fontWeight: 600 }}>{t.ten}</span>
        <span style={{ ...phu, fontSize: 11, marginLeft: 6 }}>{t.ban.length ? t.ban.map((x) => x.noi).join(' · ') : 'chưa lên sàn'}</span></span> },
    ...bat.map((k): DataColumn<Tua> => ({
      key: `pp:${k.key}`, header: k.nhan, align: 'left', width: 200,
      title: [k.moTa, k.noi.tk.length ? `Đăng ở: ${k.noi.tk.map((x) => x.nhan).join(', ')}` : '', k.noi.url ? gonUrl(k.noi.url) : ''].filter(Boolean).join('\n'),
      sortValue: (t) => (t.o[k.key]?.ao === undefined && t.o[k.key] ? t.o[k.key]!.muc : null),
      cellTitle: (t) => (t.o[k.key] ? tipO(t.o[k.key]!, k, !!t.may && !t.o[k.key]!.ao) : undefined),
      onCellClick: (t) => { const o = t.o[k.key]; if (o && !(t.may && !o.ao)) datSua({ t, o }); },
      cell: (t) => (t.o[k.key] ? <ChipO o={t.o[k.key]!} k={k} /> : <span style={mo}>—</span>),
    })),
    { key: 'can_lam', header: 'Cần làm', align: 'left', width: 220, sortValue: (t) => -Object.values(t.o).filter((o) => o.canhBao).length || null,
      cellTitle: (t) => Object.values(t.o).flatMap((o) => (o.canhBao ? [`${ppCua[o.kenh]?.nhan ?? o.kenh}: ${o.canhBao}`] : [])).join('\n') || undefined,
      cell: (t) => { const ds = Object.values(t.o).flatMap((o) => (o.canhBao ? o.canhBao.split(' · ') : []));
        return ds.length ? <span style={{ color: 'var(--warn)', fontFamily: 'var(--font-sans)', fontSize: 12 }}>{ds[0]}{ds.length > 1 && <span style={phu}> +{ds.length - 1}</span>}</span> : <span style={mo}>—</span>; } },
  ];
  return (
    <Panel title="📣 Kênh kéo khách theo sản phẩm"
      subtitle={`${ap.tua.length} tựa · ${dem.that} ô có việc · ${dem.ao} ô chưa làm${dem.sp ? ` · ${dem.sp} sản phẩm chưa có phương pháp nào` : ''}`}
      actions={<button type="button" onClick={() => datThuVien(true)} style={nutNho}>📚 Thư viện ({bat.length})</button>}>
      {rows.length > 0 && (
        <DataTable rows={rows} columns={cot} getRowKey={(t) => t.khoa} persistKey="tai-san-kenh" pageSize={25} fixedLayout
          card={{ render: (t) => <TheTua t={t} bat={bat} onSua={(o) => datSua({ t, o })} />, minWidth: 300 }}
          minWidth={260 + 200 * bat.length + 220} searchText={(t) => `${t.ten} ${t.ban.map((x) => x.noi).join(' ')}`} searchPlaceholder="tìm tựa / nơi bán…"
          rowStyle={(t) => (soThat(t) ? undefined : { opacity: 0.65 })} />
      )}
      {ap.thieu.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, ...phu }}>
          <span style={{ color: 'var(--warn)' }}>Chưa có phương pháp nào nhắm tới:</span>{' '}
          {ap.thieu.map((x) => `${x.ten} (${x.soSp})`).join(' · ')}
          <span style={mo}> — thêm shop vào "nhắm" của một phương pháp trong 📚 Thư viện, hoặc thêm phương pháp mới.</span>
        </div>
      )}
      {thuVien && <ThuVien lib={lib} shops={shops} onClose={() => datThuVien(false)} />}
      {sua && <SuaO t={sua.t} o={sua.o} pp={ppCua[sua.o.kenh] ?? PP_TRONG(sua.o.kenh)} onClose={() => datSua(null)} />}
    </Panel>
  );
}

/** Drawer sửa MỘT ô (tựa × phương pháp) — bước, link trỏ về, ngày đăng, cần làm. Chỉ ô ảo hoặc ô sửa tay. */
function SuaO({ t, o, pp, onClose }: { t: Tua; o: KenhO; pp: PhuongPhap; onClose: () => void }) {
  const router = useRouter();
  const [dang, batDau] = useTransition();
  const [v, datV] = useState({ muc: o.muc, dich: o.dich ?? '', ngayDang: o.ngayDang ?? '', canhBao: o.canhBao ?? '' });
  const [loi, datLoi] = useState('');
  const luu = () => batDau(async () => {
    const r = await datApDung({ sanPham: t.khoa, ten: t.ten, kenh: o.kenh, muc: v.muc, dich: v.dich || null, ngayDang: v.ngayDang || null, canhBao: v.canhBao || null });
    if (!r.ok) { datLoi(r.error ?? 'Lỗi không rõ.'); return; }
    router.refresh(); onClose();
  });
  return (
    <Drawer onClose={onClose} width={480} dirty={v.muc !== o.muc || v.dich !== (o.dich ?? '') || v.ngayDang !== (o.ngayDang ?? '') || v.canhBao !== (o.canhBao ?? '')}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div><b style={{ fontSize: 14 }}>{pp.nhan}</b><div style={{ fontSize: 12, ...phu }}>{t.ten}</div>
          {(pp.noi.tk.length > 0 || pp.noi.url || o.the) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, fontSize: 12 }}>
              {pp.noi.tk.length > 0 && <span style={phu}>Đăng ở</span>}
              {pp.noi.tk.map((x) => <EntityRef key={x.id} kind="account" id={x.id} label={x.nhan} size="sm" />)}
              {pp.noi.url && <a {...extLinkProps(pp.noi.url)} style={{ color: 'var(--fg-2)' }}>{gonUrl(pp.noi.url)} ↗</a>}
              {o.the && <><span style={phu}>· Card</span><EntityRef kind="task" id={o.the.id} project={o.the.project ?? undefined} label={`#${o.the.id}`} title={o.the.ten} size="sm" />
                <span style={{ fontSize: 11, color: o.the.trangThai === 'completed' ? 'var(--ok)' : 'var(--fg-3)' }}>{o.the.trangThai}</span></>}
            </div>)}
        </div>
        <SelectField label="Bước" value={v.muc} onChange={(e) => datV({ ...v, muc: Number(e.target.value) })}>
          {pp.buoc.map((b, i) => <option key={i} value={i}>{i}. {b}</option>)}
        </SelectField>
        <TextField label="Trỏ về (link đích)" value={v.dich} onChange={(e) => datV({ ...v, dich: e.target.value })} placeholder="https://…" />
        <TextField label="Đăng từ" type="date" value={v.ngayDang} onChange={(e) => datV({ ...v, ngayDang: e.target.value })}
          hint="ngày đăng đầu tiên — mốc cho lớp đo sau này" />
        <TextField label="Cần làm" value={v.canhBao} onChange={(e) => datV({ ...v, canhBao: e.target.value })} placeholder="một ý ngắn; nhiều ý nối bằng ' · '" />
        {loi && <div style={{ fontSize: 12.5, color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 6, padding: '6px 10px' }}>{loi}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={nutNho}>Huỷ</button>
          <GuardedButton disabled={dang} onClick={luu} style={nutChinh}>{dang ? 'Đang ghi…' : 'Lưu'}</GuardedButton>
        </div>
      </div>
    </Drawer>
  );
}

/** Drawer THƯ VIỆN: danh sách phương pháp + form sửa/thêm. Nhắm = tick shop trên cây, hoặc gõ thêm nền ('etsy') / '*'. */
function ThuVien({ lib, shops, onClose }: { lib: PhuongPhap[]; shops: Shop[]; onClose: () => void }) {
  const [chon, datChon] = useState<PhuongPhap | 'moi' | null>(null);
  return (
    <Drawer onClose={onClose} width={640} closeOnOutside={!chon}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 14 }}>📚 Thư viện phương pháp</b>
          <span style={{ fontSize: 12, ...phu }}>{lib.length} phương pháp · áp cho sản phẩm theo "nhắm"</span>
          <button type="button" onClick={() => datChon('moi')} style={{ ...nutNho, marginLeft: 'auto' }}>+ Thêm</button>
        </div>
        {chon ? <FormPp pp={chon === 'moi' ? null : chon} shops={shops} onXong={() => datChon(null)} />
          : <LaBang cot={[{ h: 'Phương pháp', rong: 150 }, { h: 'Nhắm', rong: 200 }, { h: 'Bước', rong: 60, phai: true }, { h: 'Máy làm', rong: 190 }]}>
              <tbody>
                {lib.map((p) => (
                  <tr key={p.key} onClick={() => datChon(p)} title="bấm để sửa" style={{ borderTop: '1px solid var(--line)', cursor: 'pointer', opacity: p.bat ? 1 : 0.5 }}>
                    <td style={oLa()} title={p.moTa}>{p.nhan}{!p.bat && <span style={{ ...mo, marginLeft: 6, fontSize: 11 }}>tắt</span>}</td>
                    <td style={{ ...oLa(), whiteSpace: 'normal', fontSize: 11.5, ...phu }}>{p.nham.map((n) => shops.find((s) => s.khoa === n)?.ten ?? n).join(' · ') || <span style={mo}>không nhắm shop nào</span>}</td>
                    <td style={oLa(true)}>{p.buoc.length - 1}</td>
                    <td style={{ ...oLa(), ...phu, fontSize: 11.5 }} title={p.may ?? ''}>{p.may ?? <span style={mo}>làm tay</span>}</td>
                  </tr>
                ))}
              </tbody>
            </LaBang>}
      </div>
    </Drawer>
  );
}

const TRANG_PP: PhuongPhap = { key: '', nhan: '', moTa: '', nham: [], buoc: ['chưa làm', ''], noi: { tk: [] }, may: null, nguong: null, thuTu: 0, bat: true };
function FormPp({ pp, shops, onXong }: { pp: PhuongPhap | null; shops: Shop[]; onXong: () => void }) {
  const router = useRouter();
  const [dang, batDau] = useTransition();
  const [v, datV] = useState<PhuongPhap>(pp ?? TRANG_PP);
  const [buoc, datBuoc] = useState(v.buoc.slice(1).join('\n'));
  const [tk, datTk] = useState(v.noi.tk.map((x) => `${x.id} ${x.nhan}`).join('\n'));
  const [them, datThem] = useState(v.nham.filter((n) => !shops.some((s) => s.khoa === n)).join(', '));
  const [loi, datLoi] = useState('');
  const tick = (khoa: string, on: boolean) => datV({ ...v, nham: on ? [...new Set([...v.nham, khoa])] : v.nham.filter((n) => n !== khoa) });
  const luu = () => batDau(async () => {
    const nham = [...v.nham.filter((n) => shops.some((s) => s.khoa === n)), ...them.split(',').map((x) => x.trim()).filter(Boolean)];
    const noiTk = tk.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(\d+)\s+(.+)$/); return m ? { id: Number(m[1]), nhan: m[2]! } : null; })
      .filter((x): x is { id: number; nhan: string } => !!x);
    const r = await luuPhuongPhap({ ...v, nham, buoc: ['chưa làm', ...buoc.split('\n').map((b) => b.trim()).filter(Boolean)], noi: { tk: noiTk, url: v.noi.url } });
    if (!r.ok) { datLoi(r.error ?? 'Lỗi không rõ.'); return; }
    router.refresh(); onXong();
  });
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <TextField label="Khoá" value={v.key} disabled={!!pp} onChange={(e) => datV({ ...v, key: e.target.value })} placeholder="vd. email, seo-trang" mono
          hint={pp ? 'khoá không đổi — trùng kenh_sp.kenh' : 'chữ thường, số, gạch'} />
        <TextField label="Tên" value={v.nhan} onChange={(e) => datV({ ...v, nhan: e.target.value })} />
      </div>
      <TextAreaField label="Mô tả (hiện khi rê chuột vào tên)" rows={2} value={v.moTa} onChange={(e) => datV({ ...v, moTa: e.target.value })} />
      <div>
        <div style={{ fontSize: 11, ...phu, marginBottom: 4 }}>Nhắm — áp cho sản phẩm của shop nào</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12.5 }}>
          {shops.map((s) => <label key={s.khoa} style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <input type="checkbox" checked={v.nham.includes(s.khoa)} onChange={(e) => tick(s.khoa, e.target.checked)} />{s.ten}</label>)}
        </div>
        <TextField value={them} onChange={(e) => datThem(e.target.value)} placeholder="thêm theo nền: etsy, gumroad — hoặc * = mọi shop" size="sm" style={{ marginTop: 6 }} />
      </div>
      <TextAreaField label="Các bước (mỗi dòng một bước; bước 0 'chưa làm' có sẵn)" rows={4} value={buoc} onChange={(e) => datBuoc(e.target.value)} mono />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <TextAreaField label="Đăng ở — tài khoản vault (mỗi dòng: id nhãn)" rows={3} value={tk} onChange={(e) => datTk(e.target.value)} placeholder="503 Pinterest" mono />
        <TextField label="Đăng ở — trang" value={v.noi.url ?? ''} onChange={(e) => datV({ ...v, noi: { ...v.noi, url: e.target.value } })} placeholder="https://…" />
      </div>
      <TextField label="Máy làm (script / playbook); trống = làm tay" value={v.may ?? ''} onChange={(e) => datV({ ...v, may: e.target.value })} mono />
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12.5 }}>
        <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={v.bat} onChange={(e) => datV({ ...v, bat: e.target.checked })} /> đang dùng</label>
        <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>thứ tự <input type="number" value={v.thuTu} onChange={(e) => datV({ ...v, thuTu: Number(e.target.value) || 0 })} style={{ width: 56 }} /></label>
        <span style={{ fontSize: 11, ...mo }}>ngưỡng đạt/dừng: để trống tới khi có số thật</span>
      </div>
      {loi && <div style={{ fontSize: 12.5, color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 6, padding: '6px 10px' }}>{loi}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onXong} style={nutNho}>Quay lại</button>
        <GuardedButton disabled={dang} onClick={luu} style={nutChinh}>{dang ? 'Đang ghi…' : 'Lưu phương pháp'}</GuardedButton>
      </div>
    </div>
  );
}
