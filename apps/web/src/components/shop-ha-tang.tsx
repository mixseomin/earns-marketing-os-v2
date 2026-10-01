'use client';
// /shop › HẠ TẦNG QC — bộ tài nguyên chạy quảng cáo của từng shop MOS, TÁCH HẲN dự án khác (anh 02/10/2026). Mỗi shop:
//   KIỂM CÔ LẬP (đỏ = dùng chung với nơi khác — người, proxy, browser profile, thẻ, mã BM/TK/Trang/pixel; vàng = thiếu / yếu),
//   CHUẨN BỊ CHẠY (9 bước, máy tự tick từ sổ), NUÔI TÀI KHOẢN (shop-nuoi.tsx), SƠ ĐỒ cây BM → người · TK QC (+ thẻ) · Trang · pixel, và THẺ.
// Luật ở lib/shop/qc-ha-tang.ts (thuần, có test), sổ ở lib/shop/qc-doc.ts. Thẻ chỉ có nhãn + 4 số cuối — không ô nào nhận số đầy đủ.
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Cay, Drawer, EmptyState, EntityRef, NutCay, Panel, PickField, Pill, SelectField, Spinner, TextAreaField, TextField } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { shopHaTang, shopQcGanThietBi, shopQcHienToken, shopQcLuu, shopQcProxyMoi, shopQcToken, type LoaiQc } from '@/lib/actions/shop';
import type { BoHaTang } from '@/lib/shop/qc-doc';
import { NuoiShop } from './shop-nuoi';
import { LOAI_PROXY, LOAI_THE, NGUON_NGUOI, NGUON_TS, TRANG_THAI_QC, TRANG_THAI_THE, VAI_TRO_QC, type HaTang } from '@/lib/shop/qc-ha-tang';

const phu: React.CSSProperties = { color: 'var(--fg-3)', fontSize: 12 };
const MAU_TT: Record<string, string> = { song: 'var(--ok)', han_che: 'var(--warn)', khoa: 'var(--bad)', mat: 'var(--bad)', bo: 'var(--fg-4)', het_han: 'var(--warn)' };
const TEN_LOAI: Record<LoaiQc, string> = { nguoi: 'người', bm: 'BM', tk: 'TK QC', the: 'thẻ', proxy: 'proxy', trang: 'Trang', pixel: 'pixel' };

type TaiKhoan = { id: number; ten: string; loai: string; proxy: string | null; profile: string | null };
type Kho = { taiKhoan: TaiKhoan[]; proxyKho: { id: number; ten: string; loai: string; noi: string | null }[]; profileKho: { id: number; ten: string }[] };
type Truong = { k: string; nhan: string; kieu: 'text' | 'so' | 'ngay' | 'chon' | 'bat' | 'bm' | 'the' | 'acc' | 'trang_acc' | 'dai' | 'proxy_kho' | 'proxy_acc' | 'profile_acc'; so?: Record<string, string>;
  goiY?: string; mono?: boolean; rong?: boolean };
/* TRƯỜNG THEO LOẠI — một chỗ khai, drawer chung vẽ. Tên trường = tên tham số của shopQcLuu. */
const TRUONG: Record<LoaiQc, Truong[]> = {
  nguoi: [{ k: 'accountId', nhan: 'Tài khoản Facebook trong kho', kieu: 'acc', goiY: 'Proxy + browser profile gắn ngay dưới — ghi thẳng vào tài khoản trong kho (màn Môi trường cùng thấy)' },
    { k: 'ten', nhan: 'Tên gọi', kieu: 'text' }, { k: 'bmId', nhan: 'Quản trị BM', kieu: 'bm' },
    { k: 'proxyAcc', nhan: 'Proxy của tài khoản', kieu: 'proxy_acc' }, { k: 'profileAcc', nhan: 'Browser profile của tài khoản', kieu: 'profile_acc' },
    { k: 'vaiTro', nhan: 'Vai trò', kieu: 'chon', so: VAI_TRO_QC }, { k: 'nguon', nhan: 'Nguồn', kieu: 'chon', so: NGUON_NGUOI },
    { k: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', so: TRANG_THAI_QC }, { k: 'ghiChu', nhan: 'Ghi chú', kieu: 'dai' }],
  bm: [{ k: 'ten', nhan: 'Tên BM', kieu: 'text' }, { k: 'extId', nhan: 'Mã BM', kieu: 'text', mono: true },
    { k: 'nguon', nhan: 'Nguồn', kieu: 'chon', so: NGUON_TS }, { k: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', so: TRANG_THAI_QC },
    { k: 'noiMua', nhan: 'Nơi mua', kieu: 'text', goiY: 'vd vuavia.io' }, { k: 'maDon', nhan: 'Mã đơn mua', kieu: 'text', mono: true },
    { k: 'giaMua', nhan: 'Giá mua (₫)', kieu: 'so' }, { k: 'ngayMua', nhan: 'Ngày mua', kieu: 'ngay' }, { k: 'baoHanhDen', nhan: 'Bảo hành tới', kieu: 'ngay' },
    { k: 'xacMinh', nhan: 'Đã xác minh doanh nghiệp', kieu: 'bat' }, { k: 'daGoNguoiBan', nhan: 'Đã gỡ tài khoản người bán', kieu: 'bat' },
    { k: 'ghiChu', nhan: 'Ghi chú', kieu: 'dai' }],
  tk: [{ k: 'ten', nhan: 'Tên TK QC', kieu: 'text' }, { k: 'extId', nhan: 'Mã (act_…)', kieu: 'text', mono: true }, { k: 'bmId', nhan: 'Thuộc BM', kieu: 'bm' },
    { k: 'tienTe', nhan: 'Tiền tệ', kieu: 'text', mono: true }, { k: 'muiGio', nhan: 'Múi giờ', kieu: 'text' }, { k: 'hanMuc', nhan: 'Hạn mức / ngày', kieu: 'so' },
    { k: 'theId', nhan: 'Thẻ đang gắn', kieu: 'the' }, { k: 'nguon', nhan: 'Nguồn', kieu: 'chon', so: NGUON_TS }, { k: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', so: TRANG_THAI_QC },
    { k: 'noiMua', nhan: 'Nơi mua', kieu: 'text' }, { k: 'maDon', nhan: 'Mã đơn mua', kieu: 'text', mono: true }, { k: 'giaMua', nhan: 'Giá mua (₫)', kieu: 'so' },
    { k: 'baoHanhDen', nhan: 'Bảo hành tới', kieu: 'ngay' }, { k: 'ghiChu', nhan: 'Ghi chú', kieu: 'dai' }],
  the: [{ k: 'nhan', nhan: 'Nhãn gợi nhớ', kieu: 'text', goiY: 'vd Visa ảo TPB #1' },
    { k: 'soCuoi', nhan: '4 số cuối', kieu: 'text', mono: true, goiY: 'CHỈ 4 số cuối — không bao giờ nhập số đầy đủ / CVV. Thẻ nhập vào nền tảng là anh tự làm.' },
    { k: 'nhaPhatHanh', nhan: 'Nhà phát hành', kieu: 'text' }, { k: 'loai', nhan: 'Loại', kieu: 'chon', so: LOAI_THE },
    { k: 'chuThe', nhan: 'Tên chủ thẻ', kieu: 'text' }, { k: 'hetHan', nhan: 'Hạn (MM/YY)', kieu: 'text', mono: true },
    { k: 'dichVu', nhan: 'Dịch vụ phát hành', kieu: 'text', goiY: 'Ngân hàng / app thẻ ảo cấp thẻ này' }, { k: 'ngayCap', nhan: 'Ngày cấp', kieu: 'ngay' },
    { k: 'phiThang', nhan: 'Phí / tháng', kieu: 'so' }, { k: 'hanMuc', nhan: 'Hạn mức thẻ', kieu: 'so' },
    { k: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', so: TRANG_THAI_THE }, { k: 'ghiChu', nhan: 'Ghi chú', kieu: 'dai' }],
  trang: [{ k: 'ten', nhan: 'Tên Trang', kieu: 'text' }, { k: 'extId', nhan: 'Page ID', kieu: 'text', mono: true },
    { k: 'accountId', nhan: 'Trang trong kho (nếu có)', kieu: 'trang_acc' }, { k: 'bmId', nhan: 'Thuộc BM', kieu: 'bm' },
    { k: 'nguon', nhan: 'Nguồn', kieu: 'chon', so: NGUON_TS }, { k: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', so: TRANG_THAI_QC }, { k: 'ghiChu', nhan: 'Ghi chú', kieu: 'dai' }],
  proxy: [{ k: 'proxyId', nhan: 'Proxy trong kho', kieu: 'proxy_kho', goiY: 'Endpoint / mật khẩu proxy nằm ở kho (màn Môi trường) — ở đây chỉ phần mua bán của shop' },
    { k: 'nhaCungCap', nhan: 'Nhà cung cấp', kieu: 'text' }, { k: 'giaThang', nhan: 'Giá / tháng', kieu: 'so' }, { k: 'giaHanDen', nhan: 'Gia hạn trước ngày', kieu: 'ngay' },
    { k: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', so: TRANG_THAI_QC }, { k: 'ghiChu', nhan: 'Ghi chú', kieu: 'dai' }],
  pixel: [{ k: 'ten', nhan: 'Tên pixel', kieu: 'text' }, { k: 'extId', nhan: 'Mã pixel', kieu: 'text', mono: true }, { k: 'bmId', nhan: 'Thuộc BM', kieu: 'bm' },
    { k: 'tenMien', nhan: 'Tên miền', kieu: 'text' }, { k: 'xacMinhMien', nhan: 'Đã xác minh tên miền trong BM', kieu: 'bat' },
    { k: 'capi', nhan: 'Đã gửi sự kiện từ máy chủ (CAPI)', kieu: 'bat' }, { k: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', so: TRANG_THAI_QC }, { k: 'ghiChu', nhan: 'Ghi chú', kieu: 'dai' }],
};

const tt = (x: { trangThai: string }, so: Record<string, string> = TRANG_THAI_QC) =>
  <Pill color={MAU_TT[x.trangThai] ?? 'var(--fg-3)'} label={so[x.trangThai] ?? x.trangThai} size="xs" />;

function DrawerQc({ loai, id, bo, kho, onClose, onLuu }: { loai: LoaiQc; id: string; bo: BoHaTang; kho: Kho; onClose: () => void; onLuu: () => void }) {
  const taiKhoan = kho.taiKhoan;
  const h = bo.h;
  const moi = id.startsWith('moi');
  const nId = moi ? null : Number(id);
  const goc = useMemo(() => {
    const ds = (h as unknown as Record<string, Record<string, unknown>[]>)[loai] ?? [];
    const x = nId != null ? ds.find((r) => r.id === nId) : null;
    const v: Record<string, unknown> = {};
    for (const t of TRUONG[loai]) v[t.k] = x?.[t.k] ?? (t.kieu === 'bat' ? false : t.kieu === 'chon' ? Object.keys(t.so!)[0] : loai === 'tk' && t.k === 'tienTe' ? 'USD' : loai === 'pixel' && t.k === 'tenMien' ? h.domain : null);
    if (loai === 'nguoi') { const a = (x as { acc?: { proxyId: number | null; profileId: number | null } } | null)?.acc; v.proxyAcc = a?.proxyId ?? null; v.profileAcc = a?.profileId ?? null; }
    return v;
  }, [h, loai, nId]);
  const [v, setV] = useState(goc);
  const [taoProxy, setTaoProxy] = useState({ bat: false, label: '', loai: 'isp', endpoint: '', noi: 'US' });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(goc);
  const dat = (k: string, x: unknown) => setV((o) => ({ ...o, [k]: x }));
  const luu = () => batDau(async () => {
    setLoi(null);
    const r = await (loai === 'proxy' && moi && taoProxy.bat
      ? shopQcProxyMoi(h.cuaHangId, taoProxy, v) : shopQcLuu(loai, nId, h.cuaHangId, v)).catch((e) => ({ ok: false, loi: (e as Error).message }));
    if (!r.ok) { setLoi(r.loi ?? 'lỗi'); return; }
    /* người: proxy + profile ghi thẳng vào tài khoản trong kho (một nguồn) — chỉ khi đổi */
    if (loai === 'nguoi' && v.accountId != null && (v.proxyAcc !== goc.proxyAcc || v.profileAcc !== goc.profileAcc || v.accountId !== goc.accountId))
      await shopQcGanThietBi(Number(v.accountId), (v.proxyAcc as number | null) ?? null, (v.profileAcc as number | null) ?? null);
    onLuu(); onClose();
  });
  const bm = h.bm.filter((b) => b.trangThai !== 'bo' || b.id === v.bmId);
  const the = h.the.filter((t) => t.trangThai !== 'bo' || t.id === v.theId);
  const o = (t: Truong) => {
    const val = v[t.k];
    if (t.kieu === 'chon') return <SelectField key={t.k} id={`qc-${t.k}`} label={t.nhan} value={String(val ?? '')} onChange={(e) => dat(t.k, e.target.value)}>
      {Object.entries(t.so!).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</SelectField>;
    if (t.kieu === 'bat') return <label key={t.k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
      <input type="checkbox" checked={!!val} onChange={(e) => dat(t.k, e.target.checked)} /> {t.nhan}</label>;
    if (t.kieu === 'bm') return <PickField key={t.k} label={t.nhan} clearable value={(val as number | null) ?? undefined} onChange={(x) => dat(t.k, x ?? null)}
      placeholder="— chưa vào BM —" options={bm.map((b) => ({ value: b.id, label: `${b.ten}${b.extId ? ` · ${b.extId}` : ''}` }))} />;
    if (t.kieu === 'the') return <PickField key={t.k} label={t.nhan} clearable value={(val as number | null) ?? undefined} onChange={(x) => dat(t.k, x ?? null)}
      placeholder="— chưa gắn thẻ —" options={the.map((c) => ({ value: c.id, label: `${c.nhan} · …${c.soCuoi}` }))} />;
    if (t.kieu === 'acc' || t.kieu === 'trang_acc') {
      const ds = taiKhoan.filter((a) => (t.kieu === 'acc' ? a.loai !== 'page' : a.loai === 'page'));
      return <PickField key={t.k} label={t.nhan} hint={t.goiY} clearable value={(val as number | null) ?? undefined}
        onChange={(x) => { dat(t.k, x ?? null); const a = ds.find((y) => y.id === x); if (a && !v.ten) dat('ten', a.ten); }}
        placeholder="— chọn trong kho —" options={ds.map((a) => ({ value: a.id, label: `${a.ten}${a.proxy ? ` · proxy ${a.proxy}` : ' · CHƯA proxy'}${a.profile ? ` · ${a.profile}` : ''}` }))} />;
    }
    if (t.kieu === 'proxy_kho') {
      if (moi && taoProxy.bat) return null;
      return <PickField key={t.k} label={t.nhan} hint={t.goiY} value={(val as number | null) ?? undefined} onChange={(x) => dat(t.k, x ?? null)}
        placeholder="— chọn proxy trong kho —" options={kho.proxyKho.map((p) => ({ value: p.id, label: `${p.ten} · ${LOAI_PROXY[p.loai as keyof typeof LOAI_PROXY] ?? p.loai}${p.noi ? ` · ${p.noi}` : ''}` }))} />;
    }
    if (t.kieu === 'proxy_acc' || t.kieu === 'profile_acc') {
      if (v.accountId == null) return null;
      const ds = t.kieu === 'proxy_acc'
        ? [...h.proxy.filter((p) => p.trangThai !== 'bo').map((p) => ({ value: p.proxyId, label: `${p.label} · trong bộ` })),
           ...kho.proxyKho.filter((p) => !h.proxy.some((x) => x.proxyId === p.id)).map((p) => ({ value: p.id, label: `${p.ten} · ngoài bộ` }))]
        : kho.profileKho.map((p) => ({ value: p.id, label: p.ten }));
      return <PickField key={t.k} label={t.nhan} clearable value={(val as number | null) ?? undefined} onChange={(x) => dat(t.k, x ?? null)}
        placeholder={t.kieu === 'proxy_acc' ? '— chưa proxy —' : '— chưa profile —'} options={ds} />;
    }
    if (t.kieu === 'dai') return <TextAreaField key={t.k} id={`qc-${t.k}`} label={t.nhan} rows={3} value={String(val ?? '')} onChange={(e) => dat(t.k, e.target.value)} />;
    return <TextField key={t.k} id={`qc-${t.k}`} label={t.nhan} hint={t.goiY} mono={t.mono} type={t.kieu === 'ngay' ? 'date' : undefined}
      inputMode={t.kieu === 'so' ? 'decimal' : undefined} value={val == null ? '' : String(val)} onChange={(e) => dat(t.k, e.target.value)} />;
  };
  return (
    <Drawer onClose={onClose} width={600} dirty={dirty}>
      <div style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{moi ? `Thêm ${TEN_LOAI[loai]}` : `Sửa ${TEN_LOAI[loai]}`} · {h.khoa}</h2>
        {loai === 'proxy' && moi && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={taoProxy.bat} onChange={(e) => setTaoProxy({ ...taoProxy, bat: e.target.checked })} /> Proxy mới — chưa có trong kho</label>}
        {loai === 'proxy' && moi && taoProxy.bat && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <TextField id="px-label" label="Nhãn" value={taoProxy.label} onChange={(e) => setTaoProxy({ ...taoProxy, label: e.target.value })} />
          <SelectField id="px-loai" label="Loại" value={taoProxy.loai} onChange={(e) => setTaoProxy({ ...taoProxy, loai: e.target.value })}>
            {Object.entries(LOAI_PROXY).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</SelectField>
          <div style={{ gridColumn: '1 / -1' }}><TextField id="px-ep" label="Endpoint (user:pass@host:port)" mono type="password" value={taoProxy.endpoint}
            onChange={(e) => setTaoProxy({ ...taoProxy, endpoint: e.target.value })} hint="Vào kho proxy (màn Môi trường) như mọi proxy khác" /></div>
          <TextField id="px-noi" label="Nơi (nước / bang)" value={taoProxy.noi} onChange={(e) => setTaoProxy({ ...taoProxy, noi: e.target.value })} />
        </div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {TRUONG[loai].map((t) => { const x = o(t); return x && <div key={t.k} style={{ gridColumn: t.kieu === 'dai' || t.kieu === 'acc' || t.kieu === 'trang_acc' || t.kieu === 'proxy_kho' || t.goiY ? '1 / -1' : undefined }}>{x}</div>; })}
        </div>
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div><button className="btn primary" disabled={dang} onClick={luu}>{dang ? 'Đang lưu…' : 'Lưu'}</button>
          {!moi && <span style={{ ...phu, marginLeft: 10 }}>Không xoá — muốn bỏ thì đổi trạng thái sang &quot;Thôi dùng&quot;.</span>}</div>
        {loai === 'bm' && nId != null && <TokenBm bo={bo} bmId={nId} onLuu={onLuu} />}
      </div>
    </Drawer>
  );
}

/** Token người dùng hệ thống của BM: đặt / thay / gỡ, hiện khi cần chép — lưu mã hoá, danh sách không bao giờ mang giá trị. */
function TokenBm({ bo, bmId, onLuu }: { bo: BoHaTang; bmId: number; onLuu: () => void }) {
  const b = bo.h.bm.find((x) => x.id === bmId)!;
  const [moi, setMoi] = useState(''); const [quyen, setQuyen] = useState(b.tokenQuyen ?? 'ads_read');
  const [hien, setHien] = useState<string | null>(null); const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const chay = (f: () => Promise<{ ok: boolean; loi?: string }>) => batDau(async () => { setLoi(null); const r = await f(); if (!r.ok) setLoi(r.loi ?? 'lỗi'); else { setMoi(''); onLuu(); } });
  return (
    <Panel title="Token người dùng hệ thống" subtitle={b.coToken ? `Đã có (${b.tokenQuyen ?? '—'}) · đặt lúc ${b.tokenLuc?.slice(0, 16).replace('T', ' ') ?? '?'}` : 'Chưa có — máy báo cáo chưa đọc được số chi'}>
      <div style={{ display: 'grid', gap: 8 }}>
        <TextField id="qc-token" label={b.coToken ? 'Thay bằng token mới' : 'Dán token'} mono type="password" value={moi} onChange={(e) => setMoi(e.target.value)}
          hint="Lưu mã hoá (pgcrypto) — không hiện trong danh sách, không vào log" />
        <TextField id="qc-quyen" label="Quyền của token" value={quyen} onChange={(e) => setQuyen(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={dang || !moi.trim()} onClick={() => chay(() => shopQcToken(bmId, moi, quyen))}>Lưu token</button>
          {b.coToken && <button className="btn ghost" disabled={dang} onClick={() => batDau(async () => { const r = await shopQcHienToken(bmId); setHien(r.token || '(rỗng)'); })}>Hiện để chép</button>}
          {b.coToken && <button className="btn ghost" disabled={dang} onClick={() => chay(() => shopQcToken(bmId, ''))}>Gỡ token</button>}
        </div>
        {hien && <code style={{ wordBreak: 'break-all', fontSize: 11 }}>{hien}</code>}
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
      </div>
    </Panel>
  );
}

function BoShop({ bo, mo, onLuu }: { bo: BoHaTang; mo: (loai: LoaiQc, id: string) => void; onLuu: () => void }) {
  const { h, kq, ck } = bo;
  const theCua = (id: number | null) => h.the.find((t) => t.id === id);
  const sua = (loai: LoaiQc, id: number) => <button className="btn ghost" onClick={() => mo(loai, String(id))}>Sửa</button>;
  const nhanh = (bmId: number | null) => {
    const ng = h.nguoi.filter((n) => n.bmId === bmId), tk = h.tk.filter((k) => k.bmId === bmId), tr = h.trang.filter((t) => t.bmId === bmId), px = h.pixel.filter((p) => p.bmId === bmId);
    return <>
      {ng.map((n) => <NutCay key={`n${n.id}`} mo_nhat={n.trangThai === 'bo'}
        ten={<><b style={{ fontWeight: 500 }}>{n.ten}</b><span style={phu}>{VAI_TRO_QC[n.vaiTro as keyof typeof VAI_TRO_QC] ?? n.vaiTro} · {NGUON_NGUOI[n.nguon as keyof typeof NGUON_NGUOI] ?? n.nguon}</span></>}
        phu={n.acc ? <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <EntityRef kind="account" id={n.accountId} label={n.acc.handle ?? n.acc.email ?? `#${n.accountId}`} size="xs" />
          {n.acc.proxyId ? <EntityRef kind="proxy" id={n.acc.proxyId} label={`${n.acc.proxy}${n.acc.proxyNoi ? ` · ${n.acc.proxyNoi}` : ''}`} size="xs" /> : <span style={{ color: 'var(--warn)' }}>chưa proxy</span>}
          {n.acc.profileId ? <EntityRef kind="browser-profile" id={n.acc.profileId} label={n.acc.profile ?? `#${n.acc.profileId}`} size="xs" /> : <span style={{ color: 'var(--warn)' }}>chưa browser profile</span>}
        </span> : <span style={{ color: 'var(--warn)' }}>chưa nối tài khoản trong kho</span>}
        phai={<>{tt(n)}{sua('nguoi', n.id)}</>} />)}
      {tk.map((k) => { const c = theCua(k.theId); return <NutCay key={`k${k.id}`} mo_nhat={k.trangThai === 'bo'}
        ten={<><b style={{ fontWeight: 500 }}>TK QC · {k.ten}</b>{k.extId && <code style={phu}>{k.extId}</code>}</>}
        phu={<>{k.tienTe}{k.hanMuc != null ? ` · hạn mức ${k.hanMuc}/ngày` : ''} · {c ? `thẻ ${c.nhan} …${c.soCuoi}` : <span style={{ color: 'var(--warn)' }}>chưa gắn thẻ</span>}
          {k.baoHanhDen ? ` · bảo hành tới ${k.baoHanhDen}` : ''}</>} phai={<>{tt(k)}{sua('tk', k.id)}</>} />; })}
      {tr.map((t) => <NutCay key={`t${t.id}`} mo_nhat={t.trangThai === 'bo'} ten={<><b style={{ fontWeight: 500 }}>Trang · {t.ten}</b>{t.extId && <code style={phu}>{t.extId}</code>}</>}
        phu={NGUON_TS[t.nguon as keyof typeof NGUON_TS]} phai={<>{tt(t)}{sua('trang', t.id)}</>} />)}
      {px.map((p) => <NutCay key={`p${p.id}`} mo_nhat={p.trangThai === 'bo'} ten={<><b style={{ fontWeight: 500 }}>Pixel · {p.ten}</b>{p.extId && <code style={phu}>{p.extId}</code>}</>}
        phu={<>{p.tenMien ?? h.domain} · {p.xacMinhMien ? 'đã xác minh tên miền' : <span style={{ color: 'var(--warn)' }}>chưa xác minh tên miền</span>} · {p.capi ? 'có CAPI' : <span style={{ color: 'var(--warn)' }}>chưa CAPI</span>}</>}
        phai={<>{tt(p)}{sua('pixel', p.id)}</>} />)}
    </>;
  };
  const le = h.nguoi.some((n) => n.bmId == null) || h.tk.some((k) => k.bmId == null) || h.trang.some((t) => t.bmId == null) || h.pixel.some((p) => p.bmId == null);
  const soDo = kq.filter((x) => x.muc === 'do').length, soVang = kq.length - soDo;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>{h.khoa}</b><span style={phu}>{h.domain}</span>
        <span style={{ flex: 1 }} />
        {(Object.keys(TEN_LOAI) as LoaiQc[]).map((l) => <button key={l} className="btn ghost" onClick={() => mo(l, `moi-${h.cuaHangId}`)}>+ {TEN_LOAI[l]}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
        <Panel title="Kiểm cô lập" subtitle={kq.length ? `${soDo} đỏ · ${soVang} vàng` : 'Sạch — không mảnh nào dùng chung với nơi khác'} pad={12}>
          {kq.length ? <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 6, fontSize: 13 }}>
            {kq.map((x) => <li key={x.ma} style={{ display: 'flex', gap: 8 }}><span aria-hidden style={{ flex: 'none', width: 8, height: 8, marginTop: 6, borderRadius: 4,
              background: x.muc === 'do' ? 'var(--bad)' : 'var(--warn)' }} /><span>{x.chu}</span></li>)}</ul>
            : <div style={phu}>Đỏ = dùng chung với shop / tài khoản khác (người, proxy, browser profile, thẻ, mã BM/TK/Trang/pixel). Vàng = còn thiếu / yếu.</div>}
        </Panel>
        <Panel title="Chuẩn bị chạy" subtitle={`${ck.filter((b) => b.xong).length}/${ck.length} bước — máy tự tick từ sổ`} pad={12}>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 5, fontSize: 13 }}>
            {ck.map((b) => <li key={b.ma} style={{ display: 'flex', gap: 8 }}><span aria-hidden style={{ width: 14, color: b.xong ? 'var(--ok)' : 'var(--fg-4)' }}>{b.xong ? '✓' : '○'}</span>
              <span style={{ fontWeight: b.xong ? 400 : 500 }}>{b.nhan}</span><span style={{ ...phu, marginLeft: 'auto', textAlign: 'right' }}>{b.chu}</span></li>)}
          </ul>
        </Panel>
      </div>
      <NuoiShop bo={bo} onLuu={onLuu} />
      <Panel title="Sơ đồ" subtitle="BM → người quản trị · TK QC (+ thẻ) · Trang · pixel" pad={0}>
        {h.bm.length || le ? <Cay label="Sơ đồ hạ tầng quảng cáo">
          {h.bm.map((b) => <NutCay key={b.id} mo_nhat={b.trangThai === 'bo'}
            ten={<><b style={{ fontWeight: 600 }}>BM · {b.ten}</b>{b.extId && <code style={phu}>{b.extId}</code>}</>}
            phu={<>{NGUON_TS[b.nguon as keyof typeof NGUON_TS]}{b.noiMua ? ` · ${b.noiMua}` : ''}{b.maDon ? ` #${b.maDon}` : ''}{b.baoHanhDen ? ` · bảo hành tới ${b.baoHanhDen}` : ''}
              {' · '}{b.xacMinh ? 'đã xác minh DN' : 'chưa xác minh DN'}{b.nguon === 'mua' ? (b.daGoNguoiBan ? ' · đã gỡ người bán' : ' · CHƯA gỡ người bán') : ''} · token {b.coToken ? 'có' : 'chưa'}</>}
            phai={<>{tt(b)}{sua('bm', b.id)}</>}>{nhanh(b.id)}</NutCay>)}
          {le && <NutCay ten={<span style={phu}>Chưa vào BM nào</span>}>{nhanh(null)}</NutCay>}
        </Cay> : <EmptyState compact icon="🧱" title="Chưa có mảnh nào" description="Bắt đầu bằng người cầm chính (tài khoản trong kho, đã gắn proxy + browser profile riêng), rồi BM, TK QC, thẻ, Trang, pixel." />}
      </Panel>
      <Panel title="Proxy" subtitle="Mỗi người một proxy riêng, cố định — không dùng chung với tài khoản / dự án nào khác" pad={0}>
        {h.proxy.length ? <Cay label="Proxy">{h.proxy.map((x) => { const dung = h.nguoi.filter((n) => n.acc?.proxyId === x.proxyId && n.trangThai !== 'bo');
          return <NutCay key={x.id} mo_nhat={x.trangThai === 'bo'}
            ten={<><EntityRef kind="proxy" id={x.proxyId} label={x.label} size="xs" /><span style={phu}>{LOAI_PROXY[x.loai as keyof typeof LOAI_PROXY] ?? x.loai}{x.noi ? ` · ${x.noi}` : ''}{x.host ? ` · ${x.host}` : ''}</span></>}
            phu={<>{x.nhaCungCap ?? 'chưa ghi nhà cung cấp'}{x.giaThang != null ? ` · ${x.giaThang}/tháng` : ''}{x.giaHanDen ? ` · gia hạn trước ${x.giaHanDen}` : ''} · {dung.length ? `gắn ${dung.map((n) => n.ten).join(', ')}` : <span style={{ color: 'var(--warn)' }}>chưa gắn ai</span>}</>}
            phai={<>{tt(x)}{sua('proxy', x.id)}</>} />; })}</Cay>
          : <div style={{ ...phu, padding: 12 }}>Chưa ghi proxy nào — bấm &quot;+ proxy&quot; để chọn trong kho hoặc tạo mới.</div>}
      </Panel>
      <Panel title="Thẻ" subtitle="Chỉ nhãn + 4 số cuối. Mỗi TK QC một thẻ, không dùng chung với dự án khác." pad={0}>
        {h.the.length ? <Cay label="Thẻ">{h.the.map((c) => { const dung = h.tk.filter((k) => k.theId === c.id && k.trangThai !== 'bo');
          return <NutCay key={c.id} mo_nhat={c.trangThai === 'bo'} ten={<><b style={{ fontWeight: 500 }}>{c.nhan}</b><code style={phu}>…{c.soCuoi}</code></>}
            phu={<>{LOAI_THE[c.loai as keyof typeof LOAI_THE] ?? c.loai}{c.nhaPhatHanh ? ` · ${c.nhaPhatHanh}` : ''}{c.dichVu ? ` · ${c.dichVu}` : ''}{c.hetHan ? ` · hạn ${c.hetHan}` : ''}
              {c.hanMuc != null ? ` · hạn mức ${c.hanMuc}` : ''}{c.phiThang != null ? ` · phí ${c.phiThang}/tháng` : ''} · {dung.length ? `gắn ${dung.map((k) => k.ten).join(', ')}` : 'chưa gắn TK nào'}</>}
            phai={<>{tt(c, TRANG_THAI_THE)}{sua('the', c.id)}</>} />; })}</Cay>
          : <div style={{ ...phu, padding: 12 }}>Chưa ghi thẻ nào.</div>}
      </Panel>
    </div>
  );
}

export function BangHaTang({ ch }: { ch: string }) {
  const [data, setData] = useState<({ ds: BoHaTang[] } & Kho) | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const modal = useModalParam('qc');
  const tai = useCallback(() => { shopHaTang().then(setData).catch((e: Error) => setLoi(e.message)); }, []);
  useEffect(() => { tai(); }, [tai]);
  if (loi) return <div style={{ color: 'var(--bad)' }}>{loi}</div>;
  if (!data) return <Spinner />;
  const ds = data.ds.filter((b) => ch === 'all' ? !/^demo/.test(b.h.khoa) : b.h.khoa === ch);
  /* drawer: ?qc=<loai>&qcId=<id | moi-<cuaHangId>> */
  const mId = modal.id ?? '';
  const boMo = modal.value ? data.ds.find((b) => (mId.startsWith('moi-') ? b.h.cuaHangId === Number(mId.slice(4))
    : (b.h as unknown as Record<string, { id: number }[]>)[modal.value!]?.some((x) => x.id === Number(mId)))) : null;
  return (
    <div data-comp="BangHaTang" style={{ display: 'grid', gap: 24 }}>
      {ds.length ? ds.map((b) => <BoShop key={b.h.cuaHangId} bo={b} mo={(l, id) => modal.open(l, id)} onLuu={tai} />)
        : <EmptyState compact icon="🧱" title="Không có shop nào" description="Chọn cửa hàng ở hàng chip trên cùng." />}
      {modal.value && boMo && modal.value in TRUONG && <DrawerQc key={`${modal.value}-${mId}`} loai={modal.value as LoaiQc} id={mId} bo={boMo} kho={data}
        onClose={() => modal.close()} onLuu={tai} />}
    </div>
  );
}

export type { HaTang };
