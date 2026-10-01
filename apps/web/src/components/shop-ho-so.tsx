'use client';
// /shop › Khách phản hồi · Nhà cung cấp — HỒ SƠ TRAO ĐỔI, một khuôn cho hai phía (ben). Toàn cảnh trước (dải trạng thái Mới → Đang xử lý
// → Chờ bên kia → Xong, kèm quá hạn / sắp hạn), lọc sau (loại), bảng, drawer luồng tin. Khách: gửi thư trả lời thẳng từ đây (hộp support
// của shop). NCC: CJ không có API nhắn tin → chép lời NCC/mình vào luồng để có một chỗ nhìn lại. Sổ: shop_ho_so (@mos2/shop/ho-so).
// URL: ?hs trạng thái · ?hl loại · ?m=ho-so&mId= drawer.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { DaiLuong, DataTable, Drawer, EmptyState, FilterChips, LinkChip, Panel, Pill, TextAreaField, TextField, type DataColumn } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { fmtAgoVi } from '@/lib/time-format';
import { LOAI_HO_SO, NHAN_LOAI, TRANG_THAI_HO_SO, type Ben } from '@mos2/shop/ho-so';
import { gio, isoCua, tien } from '@/lib/shop/buoc';
import type { HoSoDong, TinHoSo } from '@/lib/shop/ho-so-doc';
import type { CuaHangDong } from '@/lib/shop/doc';
import { shopGhiTin, shopHoSo, shopMoHoSo, shopSuaHoSo, shopTinHoSo, shopTraLoiKhach } from '@/lib/actions/shop';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const ms = (s: string | null) => (s ? new Date(isoCua(s)).getTime() : null);
const NGAY = 86_400_000;
const quaHan = (h: HoSoDong) => h.trangThai !== 'xong' && !!h.han && ms(h.han)! < Date.now();
const sapHan = (h: HoSoDong) => h.trangThai !== 'xong' && !!h.han && !quaHan(h) && ms(h.han)! - Date.now() < 3 * NGAY;
const MAU_TT: Record<string, string> = { moi: 'var(--warn)', dang_xu_ly: 'var(--accent)', cho_ho: 'var(--fg-3)', xong: 'var(--ok)' };
const NHAN_TT = Object.fromEntries(TRANG_THAI_HO_SO.map((t) => [t.key, t.nhan])) as Record<string, string>;
const NGUOI: Record<string, string> = { khach: 'Khách', ncc: 'NCC', minh: 'Mình', may: 'Máy' };

export function BangHoSo({ ben, ch, ds: dau, cuaHang }: { ben: Ben; ch: string; ds: HoSoDong[]; cuaHang: CuaHangDong[] }) {
  const sp = useSearchParams();
  const [ds, setDs] = useState(dau);
  const [tt, setTt] = useState(sp.get('hs') || '');
  const [loai, setLoai] = useState(sp.get('hl') || 'all');
  const [moi, setMoi] = useState(false);
  const modal = useModalParam();
  useEffect(() => setDs(dau), [dau]);
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (tt) u.set('hs', tt); else u.delete('hs');
    if (loai !== 'all') u.set('hl', loai); else u.delete('hl');
    const qs = u.toString();
    window.history.replaceState(window.history.state, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [tt, loai]);
  const nap = () => shopHoSo().then(setDs).catch(() => null);

  const cuaBen = useMemo(() => ds.filter((h) => h.ben === ben && (ch === 'all' || h.cuaHang === ch)), [ds, ben, ch]);
  const theoLoai = useMemo(() => cuaBen.filter((h) => loai === 'all' || h.loai === loai), [cuaBen, loai]);
  const rows = useMemo(() => theoLoai.filter((h) => !tt || h.trangThai === tt), [theoLoai, tt]);
  const demLoai = useMemo(() => { const c: Record<string, number> = { all: cuaBen.length }; for (const h of cuaBen) c[h.loai] = (c[h.loai] ?? 0) + 1; return c; }, [cuaBen]);
  const ai = ben === 'khach' ? 'khách' : 'NCC';

  const cot: DataColumn<HoSoDong>[] = [
    { key: 'id', header: '#', align: 'left', cell: (h) => <b>#{h.id}</b>, sortValue: (h) => h.id },
    { key: 'tt', header: 'Trạng thái', align: 'left', cell: (h) => <Pill color={MAU_TT[h.trangThai] ?? 'var(--fg-3)'} label={NHAN_TT[h.trangThai] ?? h.trangThai} uppercase={false} mono={false} /> },
    { key: 'loai', header: 'Loại', align: 'left', cell: (h) => NHAN_LOAI(ben, h.loai) },
    { key: 'td', header: 'Việc', align: 'left', cell: (h) => <span style={{ display: 'inline-block', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{h.tieuDe}</span>, cellTitle: (h) => h.tieuDe },
    { key: 'ai', header: ben === 'khach' ? 'Khách' : 'NCC', align: 'left', cell: (h) => <>{h.ten ?? '—'}{h.email && <span style={phu}> {h.email}</span>}</> },
    { key: 'don', header: 'Đơn', align: 'left', cell: (h) => (h.soDon ? `#${h.soDon}` : '—') },
    { key: 'tien', header: 'Số tiền', cell: (h) => (h.soTien == null ? '—' : tien(h.soTien)), sortValue: (h) => h.soTien },
    { key: 'han', header: 'Hạn', align: 'left', cell: (h) => (h.han ? <span style={{ color: quaHan(h) ? 'var(--bad)' : sapHan(h) ? 'var(--warn)' : undefined }}>{gio(h.han)}</span> : '—'), sortValue: (h) => h.han ?? '9' },
    { key: 'tin', header: 'Tin cuối', align: 'left', cell: (h) => (h.tinCuoi ? <span title={h.tinCuoi.noiDung}><span style={phu}>{NGUOI[h.tinCuoi.nguoi] ?? h.tinCuoi.nguoi}:</span> {h.tinCuoi.noiDung.slice(0, 50)}</span> : '—') },
    { key: 'cn', header: 'Cập nhật', align: 'left', cell: (h) => fmtAgoVi(new Date(isoCua(h.capNhat)).toISOString()), sortValue: (h) => h.capNhat },
    { key: 'nguon', header: 'Nguồn', align: 'left', cell: (h) => ({ form: 'form liên hệ', stripe: 'Stripe', cj: 'CJ', tay: 'mở tay' } as Record<string, string>)[h.nguon] ?? h.nguon },
  ];
  const mo = ds.find((h) => String(h.id) === modal.id) ?? null;

  return (<>
    <DaiLuong urlKey="hs" value={tt} onChange={setTt} nut={TRANG_THAI_HO_SO.map((t) => {
      const o = theoLoai.filter((h) => h.trangThai === t.key);
      return { key: t.key, nhan: t.nhan, title: t.chuThich, so: o.length, phuDe: t.key === 'xong' ? '90 ngày' : undefined, dau: [
        { n: o.filter(quaHan).length, nhan: 'quá hạn', mau: 'var(--bad)' },
        { n: o.filter(sapHan).length, nhan: 'sắp hạn', mau: 'var(--warn)' },
        { n: o.filter((h) => h.loai === 'dispute').length, nhan: 'dispute', mau: 'var(--bad)' },
      ] };
    })} />
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
      <FilterChips urlKey="hl" value={loai} onChange={setLoai} counts={demLoai}
        options={[{ value: 'all', label: 'Mọi loại' }, ...LOAI_HO_SO[ben].map((l) => ({ value: l.key, label: l.nhan, title: l.chuThich }))]} />
      <span style={{ flex: 1 }} />
      <button className="btn primary" onClick={() => setMoi(true)}>+ Hồ sơ {ai}</button>
    </div>
    {rows.length ? (
      <Panel pad={8}><DataTable rows={rows} columns={cot} getRowKey={(h) => String(h.id)} persistKey={`shop-ho-so-${ben}`} minWidth={1000}
        searchText={(h) => `${h.id} ${h.tieuDe} ${h.ten ?? ''} ${h.email ?? ''} ${h.soDon ?? ''} ${h.maNgoai ?? ''}`} searchPlaceholder="Tìm việc, tên, email, số đơn, mã dispute…"
        onRowClick={(h) => modal.open('ho-so', h.id)} /></Panel>
    ) : <EmptyState icon={ben === 'khach' ? '💬' : '📦'} compact title={cuaBen.length ? 'Không có hồ sơ ở mục này' : `Chưa có hồ sơ ${ai} nào`}
        description={cuaBen.length ? undefined : ben === 'khach' ? 'Form Contact us của mặt tiền và dispute Stripe tự vào đây; việc khác bấm "+ Hồ sơ khách".'
          : 'Dispute CJ tự vào đây (nhịp 10 phút); hỏi/giục NCC thì bấm "+ Hồ sơ NCC" rồi chép lời trao đổi vào.'} />}
    {moi && <MoHoSo ben={ben} cuaHang={cuaHang} ch={ch} onClose={() => setMoi(false)} onXong={(id) => { setMoi(false); nap(); modal.open('ho-so', id); }} />}
    {modal.is('ho-so') && modal.numId != null && <DrawerHoSo id={modal.numId} h={mo} onClose={() => modal.close()} onDoi={nap} />}
  </>);
}

function MoHoSo({ ben, cuaHang, ch, onClose, onXong }: { ben: Ben; cuaHang: CuaHangDong[]; ch: string; onClose: () => void; onXong: (id: number) => void }) {
  const [v, setV] = useState({ khoa: ch !== 'all' ? ch : cuaHang.find((c) => c.trangThai === 'bat')?.khoa ?? cuaHang[0]?.khoa ?? '', loai: LOAI_HO_SO[ben][0]!.key,
    tieuDe: '', soDon: '', ten: '', email: '', noiDung: '', nguoi: ben });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const dat = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  return (
    <Drawer onClose={onClose} width={520} dirty={!!(v.tieuDe || v.noiDung)}>
      <div style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Hồ sơ {ben === 'khach' ? 'khách' : 'nhà cung cấp'} mới</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
          {cuaHang.length > 1 && <select id="hs-moi-ch" aria-label="Cửa hàng" value={v.khoa} onChange={dat('khoa')}>{cuaHang.map((c) => <option key={c.khoa} value={c.khoa}>{c.ten}</option>)}</select>}
          <select id="hs-moi-loai" aria-label="Loại" value={v.loai} onChange={dat('loai')}>{LOAI_HO_SO[ben].map((l) => <option key={l.key} value={l.key}>{l.nhan}</option>)}</select>
        </div>
        <TextField id="hs-moi-td" label="Việc gì" value={v.tieuDe} onChange={dat('tieuDe')} placeholder={ben === 'khach' ? 'vd Khách nhận sai size, muốn đổi' : 'vd Hỏi CJ đơn 5003 sao chưa có vận đơn'} />
        <TextField id="hs-moi-don" label="Số đơn (nếu có)" value={v.soDon} onChange={dat('soDon')} placeholder="5003" />
        {ben === 'khach' && <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><TextField id="hs-moi-ten" label="Tên khách" value={v.ten} onChange={dat('ten')} hint="Trống = lấy theo đơn" /></div>
          <div style={{ flex: 1 }}><TextField id="hs-moi-email" label="Email khách" value={v.email} onChange={dat('email')} hint="Trống = lấy theo đơn" /></div>
        </div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          Tin đầu tiên là lời của
          <select id="hs-moi-nguoi" aria-label="Ai nói" value={v.nguoi} onChange={dat('nguoi')}>
            <option value={ben}>{ben === 'khach' ? 'khách' : 'NCC'}</option><option value="minh">mình (ghi chú)</option></select>
        </div>
        <TextAreaField id="hs-moi-nd" label="Nội dung" rows={5} value={v.noiDung} onChange={dat('noiDung')} hint="Chép lời trao đổi (email, chat CJ…) hoặc ghi chú. Không gửi gì ra ngoài." />
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" disabled={dang || !v.tieuDe.trim()} onClick={() => batDau(async () => {
            const r = await shopMoHoSo({ ...v, ben });
            if (r.ok && r.id) onXong(r.id); else setLoi(r.loi ?? 'lỗi');
          })}>{dang ? 'Đang mở…' : 'Mở hồ sơ'}</button>
          <button className="btn ghost" onClick={onClose}>Thôi</button>
        </div>
      </div>
    </Drawer>
  );
}

function DrawerHoSo({ id, h, onClose, onDoi }: { id: number; h: HoSoDong | null; onClose: () => void; onDoi: () => void }) {
  const [tin, setTin] = useState<TinHoSo[] | null>(null);
  const [nd, setNd] = useState('');
  const [cach, setCach] = useState<'email' | 'minh' | 'khach' | 'ncc'>(h?.ben === 'khach' && h.email ? 'email' : 'minh');
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const nap = () => shopTinHoSo(id).then(setTin).catch(() => null);
  useEffect(() => { nap(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const lam = (f: () => Promise<{ ok: boolean; loi?: string }>) => batDau(async () => {
    setLoi(null);
    const r = await f().catch((e) => ({ ok: false, loi: (e as Error).message }));
    if (!r.ok) setLoi(r.loi ?? 'lỗi'); else setNd('');
    await nap(); onDoi();
  });
  if (!h) return <Drawer onClose={onClose} width={680}><div style={phu}>Không thấy hồ sơ #{id} (có thể đã đóng quá 90 ngày).</div></Drawer>;
  const ben = h.ben;
  return (
    <Drawer onClose={onClose} width={680} dirty={!!nd.trim()}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>#{h.id} · {h.tieuDe}</h2>
          <Pill color={MAU_TT[h.trangThai] ?? 'var(--fg-3)'} label={NHAN_TT[h.trangThai] ?? h.trangThai} uppercase={false} mono={false} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '4px 10px', fontSize: 13 }}>
          <span style={phu}>Loại</span>
          <span><select id={`hs-loai-${id}`} aria-label="Loại" value={h.loai} disabled={dang} onChange={(e) => lam(() => shopSuaHoSo(id, { loai: e.target.value }))}>
            {LOAI_HO_SO[ben].map((l) => <option key={l.key} value={l.key}>{l.nhan}</option>)}</select></span>
          <span style={phu}>{ben === 'khach' ? 'Khách' : 'NCC'}</span><span>{h.ten ?? '—'}{h.email ? ` · ${h.email}` : ''}</span>
          <span style={phu}>Đơn</span><span>{h.soDon ? <LinkChip href={`/shop?m=don&mId=${h.donId}`} tone="neutral" size="xs">#{h.soDon} ↗</LinkChip> : '—'}</span>
          {h.soTien != null && <><span style={phu}>Số tiền</span><span>{tien(h.soTien)}</span></>}
          {h.han && <><span style={phu}>Hạn</span><span style={{ color: quaHan(h) ? 'var(--bad)' : sapHan(h) ? 'var(--warn)' : undefined }}>{gio(h.han)}{quaHan(h) ? ' · QUÁ HẠN' : ''}</span></>}
          {h.maNgoai && <><span style={phu}>Mã {h.nguon === 'stripe' ? 'Stripe' : h.nguon.toUpperCase()}</span><span style={{ fontFamily: 'var(--font-mono)' }}>{h.maNgoai}</span></>}
          {h.ketQua && <><span style={phu}>Kết quả</span><span>{h.ketQua}</span></>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TRANG_THAI_HO_SO.filter((t) => t.key !== h.trangThai).map((t) => (
            <button key={t.key} className={t.key === 'xong' ? 'btn primary' : 'btn ghost'} disabled={dang} title={t.chuThich}
              onClick={() => lam(() => shopSuaHoSo(id, { trangThai: t.key }))}>→ {t.nhan}</button>
          ))}
        </div>

        <Panel pad={8} title={`Trao đổi · ${tin?.length ?? '…'} tin`}>
          <div style={{ display: 'grid', gap: 8 }}>
            {!tin ? <span style={phu}>Đang tải…</span> : !tin.length ? <span style={phu}>Chưa có tin nào.</span> : tin.map((t) => {
              const minh = t.nguoi === 'minh', may = t.nguoi === 'may';
              return (
                <div key={t.id} style={{ justifySelf: minh ? 'end' : 'start', maxWidth: may ? '100%' : '85%', padding: '6px 10px', borderRadius: 8, fontSize: 13,
                  background: may ? 'transparent' : minh ? 'var(--accent-soft)' : 'var(--bg-2)', border: may ? '1px dashed var(--line)' : '1px solid var(--line)',
                  color: t.loi ? 'var(--bad)' : may ? 'var(--fg-3)' : undefined }}>
                  <div style={{ fontSize: 11, ...phu, marginBottom: 2 }}>{NGUOI[t.nguoi] ?? t.nguoi} · {({ form: 'form liên hệ', email: 'email', stripe: 'Stripe', cj: 'CJ', ghi_chu: 'ghi chú', chep: 'chép lại' } as Record<string, string>)[t.kenh] ?? t.kenh} · {gio(t.ts)}</div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{t.noiDung}</div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
            {ben === 'khach' && <label><input type="radio" name={`hs-cach-${id}`} checked={cach === 'email'} disabled={!h.email} onChange={() => setCach('email')} /> Gửi email cho khách{!h.email && ' (chưa có email)'}</label>}
            <label><input type="radio" name={`hs-cach-${id}`} checked={cach === 'minh'} onChange={() => setCach('minh')} /> Ghi chú nội bộ</label>
            <label><input type="radio" name={`hs-cach-${id}`} checked={cach === ben} onChange={() => setCach(ben)} /> Chép lời {ben === 'khach' ? 'khách' : 'NCC'} (từ kênh khác)</label>
          </div>
          <TextAreaField id={`hs-nd-${id}`} rows={4} value={nd} onChange={(e) => setNd(e.target.value)}
            placeholder={cach === 'email' ? `Hi ${h.ten?.split(' ')[0] ?? 'there'},\n\n…` : cach === 'minh' ? 'Ghi chú cho mình (khách/NCC không thấy)' : 'Dán nguyên lời họ nói'} />
          {cach === 'email' && <span style={{ fontSize: 12, ...phu }}>Gửi từ hộp support của shop tới {h.email}, tiêu đề "Re: your message to …". Gửi xong hồ sơ sang "Chờ bên kia".</span>}
          {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
          <div><button className="btn primary" disabled={dang || !nd.trim()} onClick={() => lam(() => (cach === 'email' ? shopTraLoiKhach(id, nd) : shopGhiTin(id, { nguoi: cach, noiDung: nd })))}>
            {dang ? 'Đang chạy…' : cach === 'email' ? 'Gửi email' : 'Ghi vào luồng'}</button></div>
        </div>
      </div>
    </Drawer>
  );
}
