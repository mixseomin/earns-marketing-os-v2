'use client';
// Panel "Kênh kéo khách" của tab Tài sản — CÂY theo TỰA (một cuốn bán ở nhiều shop = một tựa), mở ra mỗi PHƯƠNG PHÁP một hàng.
// Phương pháp đọc từ THƯ VIỆN (bảng phuong_phap, sửa ở drawer 📚), áp lên mọi sản phẩm theo `nham` (lib/tai-san/ap-dung.ts):
// ô chưa có dòng sổ = "chưa làm", số để TRỐNG (chưa đo ≠ 0). Shop không phương pháp nào nhắm tới hiện thành một dòng "thiếu" —
// đó là chỗ cần thêm, không phải chỗ để im. Ô do máy repo ghi không sửa tay (kenh.mjs đè lại); ô ảo / ô tay sửa ở drawer.
// Mở/gập ghi ở URL ?kenh=a,b (giống ?shop=).
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Cay, Drawer, EntityRef, GuardedButton, LaBang, NutCay, Panel, Pill, SelectField, TextAreaField, TextField, TienDo, oLa, type CotLa } from '@/components/ui';
import { extLinkProps } from '@/lib/external-url';
import { useShallowParam } from '@/lib/url-shallow';
import { TT_SP, type KenhO, type PhuongPhap } from '@/lib/tai-san/kieu';
import { demO, type ApDung, type Tua } from '@/lib/tai-san/ap-dung';
import { datApDung, luuPhuongPhap } from '@/lib/actions/phuong-phap';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const mo: React.CSSProperties = { color: 'var(--fg-4)' };
const COT: CotLa[] = [{ h: 'Phương pháp', rong: 150 }, { h: 'Đăng ở', rong: 210 }, { h: 'Bước', rong: 190 }, { h: 'Tiến độ', rong: 100, phai: true },
  { h: 'Đăng từ', rong: 90 }, { h: 'Trỏ về', rong: 190 }, { h: 'Cần làm', rong: 260 }, { h: 'Card', rong: 110 }];
const nutNho: React.CSSProperties = { fontSize: 11.5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };
const nutChinh: React.CSSProperties = { fontSize: 12.5, padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--bg-0, #fff)', cursor: 'pointer' };
type Shop = { khoa: string; ten: string };

export function TaiSanKenh({ ap, lib, shops }: { ap: ApDung; lib: PhuongPhap[]; shops: Shop[] }) {
  const [moUrl, datMo] = useShallowParam('kenh', '');
  const [thuVien, datThuVien] = useState(false);
  const [sua, datSua] = useState<{ t: Tua; o: KenhO } | null>(null);
  const dangMo = new Set(moUrl.split(',').filter(Boolean));
  const doi = (k: string) => { const n = new Set(dangMo); if (n.has(k)) n.delete(k); else n.add(k); datMo([...n].join(',')); };
  const ppCua = Object.fromEntries(lib.map((p) => [p.key, p]));
  const dem = demO(ap);
  const thuTu = lib.map((p) => p.key);
  return (
    <Panel title="📣 Kênh kéo khách theo sản phẩm"
      subtitle={`${ap.tua.length} tựa · ${dem.that} ô có việc · ${dem.ao} ô chưa làm${dem.sp ? ` · ${dem.sp} sản phẩm chưa có phương pháp nào` : ''}`}
      actions={<button type="button" onClick={() => datThuVien(true)} style={nutNho}>📚 Thư viện ({lib.filter((p) => p.bat).length})</button>}>
      {ap.tua.length > 0 && (
        <Cay label="Tựa và phương pháp">
          {ap.tua.map((t) => {
            const os = Object.values(t.o).sort((a, b) => thuTu.indexOf(a.kenh) - thuTu.indexOf(b.kenh));
            const viec = os.flatMap((o) => (o.canhBao ? o.canhBao.split(' · ') : []));
            const soThat = os.filter((o) => !o.ao).length;
            return (
              <NutCay key={t.khoa} mo={dangMo.has(t.khoa)} onDoi={() => doi(t.khoa)}
                ten={<b style={{ fontWeight: 600 }}>{t.ten}</b>}
                phu={`${t.ban.length ? t.ban.map((x) => `${x.noi} ${TT_SP.find((k) => k.key === x.trangThai)!.chu}`).join(' · ') : 'chưa lên sàn'}  —  ${soThat}/${os.length} phương pháp có việc`}
                phai={viec.length ? <Pill label={`⚠ ${viec.length} cần làm`} color="var(--warn)" size="xs" tone="soft" uppercase={false} mono={false} title={viec.join('\n')} />
                  : !soThat ? <Pill label="chưa bắt đầu" color="var(--fg-4)" size="xs" tone="soft" uppercase={false} mono={false} /> : null}>
                <LaBang cot={COT}>
                  <tbody>
                    {os.map((o) => {
                      const k = ppCua[o.kenh] ?? { key: o.kenh, nhan: o.kenh, moTa: '', nham: [], buoc: ['chưa làm'], noi: { tk: [] }, may: null, nguong: null, thuTu: 0, bat: true };
                      const ds = o.canhBao ? o.canhBao.split(' · ') : [];
                      const may = !!t.may && !o.ao;   // ô máy repo ghi → không sửa tay
                      return (
                        <tr key={o.kenh} onClick={may ? undefined : () => datSua({ t, o })}
                          title={may ? `máy của repo ${t.may} ghi ô này (kenh.mjs) — sửa ở repo đó` : 'bấm để sửa bước / link / ngày đăng'}
                          style={{ borderTop: '1px solid var(--line)', cursor: may ? 'default' : 'pointer', opacity: o.ao ? 0.6 : 1 }}>
                          <td style={oLa()} title={k.moTa}><span style={{ borderBottom: '1px dotted var(--fg-4)', cursor: 'help' }}>{k.nhan}</span></td>
                          <td style={oLa()}>{k.noi.tk.length || k.noi.url
                            ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                {k.noi.tk.map((x) => <EntityRef key={x.id} kind="account" id={x.id} label={x.nhan} size="sm" />)}
                                {k.noi.url && <a {...extLinkProps(k.noi.url)} style={{ color: 'var(--fg-2)' }}>{k.noi.url.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗</a>}</span>
                            : <span style={mo}>—</span>}</td>
                          <td style={oLa()}>{o.ao ? <span style={mo}>chưa làm</span> : <>
                            <TienDo xong={o.muc} tong={k.buoc.length - 1} buoc={k.buoc.slice(1)} so={false} rong={44} />
                            <span style={{ marginLeft: 6 }}>{k.buoc[o.muc] ?? o.muc}</span></>}</td>
                          <td style={oLa(true)}>{o.tong != null ? <TienDo xong={o.xong ?? 0} tong={o.tong} rong={40} /> : <span style={mo}>—</span>}</td>
                          <td style={{ ...oLa(), fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{o.ngayDang ?? <span style={mo}>—</span>}</td>
                          <td style={{ ...oLa(), ...phu }} title={o.dich ?? ''}>{o.dich
                            ? <a {...extLinkProps(o.dich)} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit' }}>{o.dich.replace(/^https?:\/\//, '').replace(/[?#].*$/, '')}</a> : <span style={mo}>—</span>}</td>
                          <td style={oLa()} title={ds.join('\n')}>{ds.length
                            ? <span style={{ color: 'var(--warn)' }}>{ds[0]}{ds.length > 1 && <span style={phu}> +{ds.length - 1}</span>}</span> : <span style={mo}>—</span>}</td>
                          <td style={oLa()} onClick={(e) => e.stopPropagation()}>{o.the
                            ? <><EntityRef kind="task" id={o.the.id} project={o.the.project ?? undefined} label={`#${o.the.id}`} title={o.the.ten} size="sm" />{' '}
                              <span style={{ fontSize: 11, color: o.the.trangThai === 'completed' ? 'var(--ok)' : 'var(--fg-3)' }}>{o.the.trangThai}</span></>
                            : <span style={mo}>—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </LaBang>
              </NutCay>
            );
          })}
        </Cay>
      )}
      {ap.thieu.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, ...phu }}>
          <span style={{ color: 'var(--warn)' }}>Chưa có phương pháp nào nhắm tới:</span>{' '}
          {ap.thieu.map((x) => `${x.ten} (${x.soSp})`).join(' · ')}
          <span style={mo}> — thêm shop vào "nhắm" của một phương pháp trong 📚 Thư viện, hoặc thêm phương pháp mới.</span>
        </div>
      )}
      {thuVien && <ThuVien lib={lib} shops={shops} onClose={() => datThuVien(false)} />}
      {sua && <SuaO t={sua.t} o={sua.o} pp={ppCua[sua.o.kenh]!} onClose={() => datSua(null)} />}
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
        <div><b style={{ fontSize: 14 }}>{pp.nhan}</b><div style={{ fontSize: 12, ...phu }}>{t.ten}</div></div>
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
