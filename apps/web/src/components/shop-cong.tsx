'use client';
// /shop › Thanh toán (anh yêu cầu 02/10/2026): cổng thanh toán của từng shop + SỨC KHOẺ cổng. Một cổng = một tài khoản Stripe (acct_…), nhiều shop/site
// có thể dùng chung — Stripe chấm điểm cả tài khoản nên sức khoẻ tính trên cả tài khoản. Số thô: lib/shop/cong.ts (CHỈ ĐỌC Stripe, cron ~6 giờ/lần);
// đỏ/vàng: lib/shop/cong-luat.ts danhGiaCong theo ngưỡng sửa được ở đây. Màn = MỘT bảng cổng (sức khoẻ + vấn đề đầu đứng ngay dòng) + bảng pháp nhân;
// chi tiết từng cổng (số, webhook, rút tiền, lịch sử) nằm trong drawer ?cong=xem&congId= (anh 02/10/2026: ba khối cây chồng nhau nhìn rối).
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Cay, DataTable, Drawer, EmptyState, LaBang, LinkChip, NutCay, Panel, PickField, Pill, StatsStrip, TextAreaField, TextField, oLa, type CotLa, type DataColumn } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { gio, tien } from '@/lib/shop/buoc';
import { KIEU_CONG, LOAI_PHAP_NHAN, NGUONG_MAC_DINH, NHAN_NGUONG, TRANG_THAI_PN, TRANG_THAI_TAY, VAI_CONG, danhGiaMotCong, danhGiaPhapNhan, tyLeCong,
  type CongDong, type NguongCong, type PhapNhanDong } from '@/lib/shop/cong-luat';
import type { CuaHangDong } from '@/lib/shop/doc';
import { shopDocCong, shopKiemCong, shopSuaCong, shopSuaPhapNhan } from '@/lib/actions/shop';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const MUC: Record<'tot' | 'vang' | 'do', [string, string]> = { tot: ['Khoẻ', 'var(--ok)'], vang: ['Cần để ý', 'var(--warn)'], do: ['Nguy hiểm', 'var(--bad)'] };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const ptChu = (x: number | null) => (x == null ? '—' : `${x}%`);
const COT_LS: CotLa[] = [{ h: 'Ngày', rong: 110 }, { h: 'GD thành công 90 ngày', phai: true }, { h: 'Dispute 90 ngày', phai: true }, { h: 'Hoàn 90 ngày', phai: true }, { h: 'Thất bại 30 ngày', phai: true }, { h: 'Số dư khả dụng', phai: true }];

/** Số cổng đang đỏ/vàng — badge của tab. */
export const soCongCanXem = (ds: CongDong[]) => ds.filter((g) => danhGiaMotCong(g).muc !== 'tot').length;
const tenKieu = (g: CongDong) => KIEU_CONG[g.loai]?.ten ?? g.loai;
const PN_MOI: PhapNhanDong = { id: 0, ten: '', loai: 'llc_us', nuoc: 'US', bang: null, maSoCuoi: null, nguoiDaiDien: null, daiLy: null, ngayLap: null, hanBaoCao: null,
  trangThai: 'hoat_dong', link: null, ghiChu: null, shops: [] };

export function BangCong({ ds, phapNhan, cuaHang, ch }: { ds: CongDong[]; phapNhan: PhapNhanDong[]; cuaHang: CuaHangDong[]; ch: string }) {
  const router = useRouter();
  const [dang, batDau] = useTransition();
  const [bao, setBao] = useState<string | null>(null);
  const [sua, setSua] = useState<CongDong | null>(null);
  const [suaPn, setSuaPn] = useState<PhapNhanDong | null>(null);
  const modal = useModalParam('cong');
  const shops = cuaHang.filter((c) => ch === 'all' || c.khoa === ch);
  // lọc theo shop: cổng thu của shop đó + cổng nhận mà các cổng thu ấy rút về
  const thuCh = ds.filter((g) => ch === 'all' || g.shops.includes(ch));
  const hien = ch === 'all' ? ds : [...thuCh, ...ds.filter((g) => !thuCh.includes(g) && thuCh.some((x) => x.veCongId === g.id))];
  const tenCong = (id: number | null) => { const x = ds.find((g) => g.id === id); return x ? `${tenKieu(x)} · ${x.ten ?? x.ma}` : null; };
  const chuaCo = shops.filter((c) => !ds.some((g) => g.shops.includes(c.khoa)));
  const tenShop = (k: string) => cuaHang.find((c) => c.khoa === k)?.ten ?? k;
  const docLai = () => batDau(async () => { setBao(null); const r = await shopDocCong().catch((e) => ({ ok: false, kq: [{ loi: (e as Error).message }] }));
    setBao(r.ok ? 'Đã đọc lại từ Stripe' : `Lỗi: ${r.kq.map((x) => ('loi' in x ? x.loi : '')).filter(Boolean).join(' · ')}`); router.refresh(); });
  const pnCua = (g: CongDong) => phapNhan.find((p) => p.id === g.phapNhanId);
  const nguong = (g: CongDong, k: keyof typeof NGUONG_MAC_DINH) => g.nguong[k] ?? NGUONG_MAC_DINH[k];

  /* MỘT bảng cổng — mỗi cổng một dòng, đủ để liếc: sức khoẻ + vấn đề đầu, pháp nhân, shop, tiền về, 3 tỷ lệ, số dư. Chi tiết trong drawer. */
  const cot: DataColumn<CongDong>[] = [
    { key: 'ten', header: 'Cổng', align: 'left', cell: (g) => <><b style={{ fontWeight: 500 }}>{tenKieu(g)} · {g.ten ?? g.sucKhoe?.tai_khoan.ten ?? g.ma}</b>
      <div style={{ fontSize: 11.5, ...phu }}>{VAI_CONG[g.vai]}{KIEU_CONG[g.loai]?.api ? '' : ' · ghi tay'}</div></>, sortValue: (g) => `${g.vai}${tenKieu(g)}` },
    { key: 'sk', header: 'Sức khoẻ', align: 'left', cell: (g) => { const d = danhGiaMotCong(g);
      return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', maxWidth: 320 }}><Pill color={MUC[d.muc][1]} label={MUC[d.muc][0]} uppercase={false} mono={false} />
        {d.van_de[0] && <span style={{ fontSize: 12, color: d.van_de[0].muc === 'do' ? 'var(--bad)' : 'var(--warn)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.van_de[0].chu}{d.van_de.length > 1 ? ` (+${d.van_de.length - 1})` : ''}</span>}</span>; },
      cellTitle: (g) => danhGiaMotCong(g).van_de.map((v) => v.chu).join('\n'), sortValue: (g) => ({ do: 0, vang: 1, tot: 2 })[danhGiaMotCong(g).muc] },
    { key: 'pn', header: 'Pháp nhân', align: 'left', cell: (g) => pnCua(g)?.ten ?? <span style={{ color: 'var(--warn)' }}>chưa gán</span> },
    { key: 'shop', header: 'Shop / tiền về', align: 'left', cell: (g) => { const ngoai = g.sucKhoe?.webhook.filter((w) => !w.cua_minh).length ?? 0;
      return g.vai === 'thu'
        ? <>{g.shops.map(tenShop).join(', ') || <span style={phu}>chưa gán shop</span>}{ngoai ? <span style={phu}> +{ngoai} site khác</span> : null}
            <div style={{ fontSize: 11.5, ...phu }}>tiền về {tenCong(g.veCongId) ?? <span style={{ color: 'var(--warn)' }}>chưa ghi</span>}</div></>
        : <span style={phu}>nhận từ {ds.filter((x) => x.veCongId === g.id).map((x) => `${tenKieu(x)} · ${x.ten ?? x.ma}`).join(', ') || '—'}</span>; } },
    { key: 'dp', header: 'Dispute 90n', cell: (g) => { const t = g.sucKhoe ? tyLeCong(g.sucKhoe).dispute : null;
      return <span style={{ color: t != null && t >= nguong(g, 'dispute_vang') ? 'var(--warn)' : undefined }}>{ptChu(t)}</span>; },
      sortValue: (g) => (g.sucKhoe ? tyLeCong(g.sucKhoe).dispute ?? -1 : -1) },
    { key: 'hoan', header: 'Hoàn 90n', cell: (g) => ptChu(g.sucKhoe ? tyLeCong(g.sucKhoe).hoan : null) },
    { key: 'tb', header: 'Thất bại 30n', cell: (g) => ptChu(g.sucKhoe ? tyLeCong(g.sucKhoe).that_bai : null) },
    { key: 'du', header: 'Số dư', cell: (g) => (g.sucKhoe ? tien(g.sucKhoe.so_du.kha_dung) : '—'), sortValue: (g) => g.sucKhoe?.so_du.kha_dung ?? -1 },
    { key: 'doc', header: 'Đọc / kiểm', align: 'left', cell: (g) => <span style={phu}>{(KIEU_CONG[g.loai]?.api ? g.docLuc : g.kiemLuc) ? gio((KIEU_CONG[g.loai]?.api ? g.docLuc : g.kiemLuc)!) : 'chưa'}</span> },
  ];
  /* Pháp nhân: bảng gọn — ai đứng tên cổng / shop nào, vấn đề pháp lý. Bấm dòng để sửa. */
  const cotPn: DataColumn<PhapNhanDong>[] = [
    { key: 'ten', header: 'Pháp nhân', align: 'left', cell: (p) => <b style={{ fontWeight: 500 }}>{p.ten}</b>, sortValue: (p) => p.ten },
    { key: 'loai', header: 'Loại · nơi', align: 'left', cell: (p) => <span style={phu}>{LOAI_PHAP_NHAN[p.loai] ?? p.loai}{p.bang ? ` · ${p.bang}` : ''}{p.nuoc ? ` · ${p.nuoc}` : ''}</span> },
    { key: 'sk', header: 'Tình trạng', align: 'left', cell: (p) => { const d = danhGiaPhapNhan(p, ds);
      return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Pill color={MUC[d.muc][1]} label={TRANG_THAI_PN[p.trangThai]?.[0] ?? p.trangThai} uppercase={false} mono={false} />
        {d.van_de[0] && <span style={{ fontSize: 12, color: d.van_de[0].muc === 'do' ? 'var(--bad)' : 'var(--warn)' }}>{d.van_de[0].chu}</span>}</span>; } },
    { key: 'cong', header: 'Cổng đứng tên', align: 'left', cell: (p) => ds.filter((g) => g.phapNhanId === p.id).map((g) => `${tenKieu(g)} · ${g.ten ?? g.ma}`).join(', ') || <span style={phu}>—</span> },
    { key: 'shop', header: 'Shop bán dưới tên', align: 'left', cell: (p) => p.shops.map(tenShop).join(', ') || <span style={phu}>—</span> },
    { key: 'bc', header: 'Báo cáo năm', align: 'left', cell: (p) => <span style={phu}>{p.hanBaoCao ?? '—'}</span> },
  ];
  const mo = modal.value === 'xem' ? ds.find((g) => g.id === Number(modal.id)) : undefined;
  const chuaGan = ds.filter((g) => !g.phapNhanId).length;

  return (<div data-comp="BangCong" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, ...phu }}>Chỉ ĐỌC từ cổng — không ghi gì sang Stripe. Máy đọc lại ~6 giờ một lần.</span>
      <span style={{ flex: 1 }} />
      {bao && <span style={{ fontSize: 12.5, color: bao.startsWith('Lỗi') ? 'var(--bad)' : 'var(--fg-2)' }}>{bao}</span>}
      <button className="btn ghost" disabled={dang} onClick={docLai}>{dang ? 'Đang đọc Stripe…' : 'Đọc lại ngay'}</button>
      <button className="btn" onClick={() => setSua({ id: 0, loai: 'payoneer', vai: 'nhan', ma: '', ten: '', ghiChu: null, taiKhoan: null, link: null, veCongId: null, phapNhanId: null,
        trangThaiTay: null, kiemLuc: null, nguong: {}, sucKhoe: null, docLuc: null, loi: null, shops: [], lichSu: [] })}>+ Cổng</button>
      <button className="btn" onClick={() => setSuaPn(PN_MOI)}>+ Pháp nhân</button>
    </div>
    <Panel pad={8} title="Cổng thanh toán" subtitle={`${hien.length} cổng · bấm một dòng để xem chi tiết${chuaCo.length ? ` · chưa có cổng: ${chuaCo.map((c) => c.ten).join(', ')}` : ''}`}>
      {hien.length ? <DataTable rows={hien} columns={cot} getRowKey={(g) => String(g.id)} persistKey="shop-cong" minWidth={980} onRowClick={(g) => modal.open('xem', String(g.id))} />
        : <EmptyState compact icon="💳" title={`Chưa có cổng nào${ch !== 'all' ? ' cho cửa hàng này' : ''}`}
            description='Stripe: máy tự nhận khi shop có khoá (SHOP_<KHOÁ>_STRIPE_SK). PayPal / Payoneer / PingPong: bấm "+ Cổng".' />}
    </Panel>
    <Panel pad={8} title="Pháp nhân" subtitle={`chủ thể pháp lý đứng tên cổng / bán hàng${chuaGan ? ` · ${chuaGan} cổng chưa gán pháp nhân` : ''}`}>
      {phapNhan.length ? <DataTable rows={phapNhan} columns={cotPn} getRowKey={(p) => String(p.id)} persistKey="shop-phap-nhan" minWidth={860} onRowClick={(p) => setSuaPn(p)} />
        : <EmptyState compact icon="🏛" title="Chưa có pháp nhân" description='Bấm "+ Pháp nhân" (LLC, công ty, cá nhân…), rồi chọn pháp nhân đứng tên trong drawer của từng cổng.' />}
    </Panel>
    {mo && <XemCong g={mo} ds={ds} cuaHang={cuaHang} onClose={() => modal.close()} onSua={() => { modal.close(); setSua(mo); }} />}
    {sua && <SuaCong g={sua} ds={ds} phapNhan={phapNhan} cuaHang={cuaHang} onClose={() => setSua(null)} />}
    {suaPn && <SuaPhapNhan p={suaPn} cuaHang={cuaHang} onClose={() => setSuaPn(null)} />}
  </div>);
}

/** Mục chi tiết THU GỌN mặc định — bấm tên để mở (cây không tự bung webhook / lịch sử ra cả màn). */
function MucGon(p: Omit<React.ComponentProps<typeof NutCay>, 'mo' | 'onDoi'>) {
  const [mo, setMo] = useState(false);
  return <NutCay {...p} mo={mo} onDoi={() => setMo(!mo)} />;
}

/** Drawer một cổng: vấn đề → số chính → (ghi tay: nút kiểm) → các mục chi tiết THU GỌN (shop dùng chung, webhook, Stripe đòi, rút tiền, lịch sử). */
function XemCong({ g, ds, cuaHang, onClose, onSua }: { g: CongDong; ds: CongDong[]; cuaHang: CuaHangDong[]; onClose: () => void; onSua: () => void }) {
  const router = useRouter();
  const [dang, batDau] = useTransition();
  const s = g.sucKhoe, dg = danhGiaMotCong(g), ty = s ? tyLeCong(s) : null;
  const api = !!KIEU_CONG[g.loai]?.api;
  const ngoai = s?.webhook.filter((w) => !w.cua_minh) ?? [];
  const tenShop = (k: string) => cuaHang.find((c) => c.khoa === k)?.ten ?? k;
  const tenCong = (id: number | null) => { const x = ds.find((y) => y.id === id); return x ? `${tenKieu(x)} · ${x.ten ?? x.ma}` : null; };
  const link = g.link ?? KIEU_CONG[g.loai]?.link;
  return (
    <Drawer onClose={onClose} width={720}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{tenKieu(g)} · {g.ten ?? s?.tai_khoan.ten ?? g.ma}</h2>
          <Pill color={MUC[dg.muc][1]} label={MUC[dg.muc][0]} uppercase={false} mono={false} />
          <span style={{ flex: 1 }} />
          {link && <LinkChip href={link} tone="neutral" size="xs">Trang {tenKieu(g)} ↗</LinkChip>}
          <button className="btn ghost" onClick={onSua}>Sửa</button>
        </div>
        <div style={{ fontSize: 12.5, ...phu }}>{VAI_CONG[g.vai]}{api ? ` · ${g.ma}` : ' · ghi tay (chưa nối API)'}{g.taiKhoan ? ` · ${g.taiKhoan}` : ''}
          {s?.tai_khoan.nuoc ? ` · ${s.tai_khoan.nuoc}` : ''}{s?.tai_khoan.tien_te ? ` · ${s.tai_khoan.tien_te.toUpperCase()}` : ''}
          {g.vai === 'thu' ? ` · dùng cho ${g.shops.map(tenShop).join(', ') || '—'}` : ''}{g.veCongId ? ` · tiền về ${tenCong(g.veCongId)}` : ''}
          {` · ${api ? 'đọc' : 'kiểm'} ${(api ? g.docLuc : g.kiemLuc) ? gio((api ? g.docLuc : g.kiemLuc)!) : 'chưa'}`}</div>
        {dg.van_de.length
          ? <div style={{ display: 'grid', gap: 4 }}>{dg.van_de.map((v, i) => <div key={i} style={{ fontSize: 13, color: v.muc === 'do' ? 'var(--bad)' : 'var(--warn)' }}>{v.muc === 'do' ? '●' : '○'} {v.chu}</div>)}</div>
          : <div style={{ fontSize: 13, color: 'var(--ok)' }}>{api ? 'Không có vấn đề — nhận và rút tiền bình thường, các tỷ lệ dưới ngưỡng.' : `Bình thường theo lần kiểm tay ${g.kiemLuc ? gio(g.kiemLuc) : ''}.`}</div>}
        {!api && <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
          <span style={phu}>Vừa mở trang {tenKieu(g)} kiểm xong — ghi lại:</span>
          {Object.entries(TRANG_THAI_TAY).map(([k, [nhan]]) => <button key={k} className="btn ghost" disabled={dang} onClick={() => batDau(async () => { await shopKiemCong(g.id, k); router.refresh(); })}>Đã kiểm · {nhan}</button>)}
        </div>}
        {g.ghiChu && <div style={{ fontSize: 12.5, ...phu }}>{g.ghiChu}</div>}
        {s && ty && <StatsStrip minColWidth={130} cards={[
          { key: 'nhan', label: 'Nhận tiền', value: s.tai_khoan.nhan_tien ? 'bật' : 'TẮT', color: s.tai_khoan.nhan_tien ? undefined : 'var(--bad)', sub: s.tai_khoan.rut_tien ? 'rút tiền: bật' : 'rút tiền: TẮT' },
          { key: 'dp', label: 'Dispute 90 ngày', value: ptChu(ty.dispute), color: ty.dispute != null && ty.dispute >= (g.nguong.dispute_vang ?? NGUONG_MAC_DINH.dispute_vang) ? 'var(--warn)' : undefined,
            sub: `${s.ky90.dispute}/${s.ky90.thanh_cong} giao dịch${s.ky90.dispute_mo ? ` · ${s.ky90.dispute_mo} chờ bằng chứng` : ''}` },
          { key: 'hoan', label: 'Hoàn 90 ngày', value: ptChu(ty.hoan), sub: `${s.ky90.hoan} lần · ${tien(s.ky90.tien_hoan)}` },
          { key: 'tb', label: 'Thất bại 30 ngày', value: ptChu(ty.that_bai), sub: `${s.ky30.that_bai} hỏng / ${s.ky30.thanh_cong} thành công${s.ky90.chan_rui_ro ? ` · Radar chặn ${s.ky90.chan_rui_ro}` : ''}` },
          { key: 'efw', label: 'Cảnh báo gian lận', value: s.ky90.efw, color: s.ky90.efw ? 'var(--warn)' : undefined, sub: '90 ngày (EFW từ ngân hàng)' },
          { key: 'dt', label: 'Thu 90 ngày', value: tien(s.ky90.tien), sub: `${s.ky90.thanh_cong} giao dịch${s.ky90.doc_het ? '' : ' · chỉ đọc 1000 gần nhất'}` },
          { key: 'du', label: 'Số dư', value: tien(s.so_du.kha_dung), sub: `chờ ${tien(s.so_du.cho)}${s.tai_khoan.lich_rut ? ` · rút ${s.tai_khoan.lich_rut}` : ''}` },
        ]} />}
        {s && <div style={{ border: '1px solid var(--line)', borderRadius: 6 }}><Cay label="Chi tiết cổng">
          <MucGon ten={<b>Shop dùng cổng này</b>} phu={`${g.shops.length} shop của mình${ngoai.length ? ` · ${ngoai.length} site khác dùng chung tài khoản — dispute/hoàn của họ cũng tính vào sức khoẻ` : ''}`}>
            {g.shops.map((k) => <NutCay key={k} ten={<span>{tenShop(k)}</span>} phu={cuaHang.find((c) => c.khoa === k)?.domain} />)}
            {ngoai.map((w) => <NutCay key={w.url} mo_nhat ten={<span>{host(w.url)}</span>} phu="site khác (không thuộc /shop) — dùng chung tài khoản Stripe" />)}
          </MucGon>
          {(s.tai_khoan.thieu.length > 0 || s.tai_khoan.qua_han.length > 0) && <NutCay ten={<b>Stripe đòi bổ sung</b>} phu="làm trên Stripe Dashboard (chủ tài khoản tự nhập — mos2 không điền hộ)">
            {[...s.tai_khoan.qua_han.map((x) => [x, true] as const), ...s.tai_khoan.thieu.map((x) => [x, false] as const)].map(([x, qua]) =>
              <NutCay key={x} ten={<span style={{ color: qua ? 'var(--bad)' : 'var(--warn)' }}>{x}{qua ? ' · quá hạn' : ''}</span>} />)}
          </NutCay>}
          <MucGon ten={<b>Webhook</b>} phu={`${s.webhook.length} endpoint · ${s.webhook.filter((w) => w.trang_thai !== 'enabled').length} tắt · ${s.su_kien_treo} sự kiện chưa giao được (≥ 1 giờ)`}>
            <LaBang cot={[{ h: 'Địa chỉ' }, { h: 'Trạng thái', rong: 90 }, { h: 'Loại sự kiện', rong: 100, phai: true }, { h: 'Thuộc', rong: 120 }]}>
              <tbody>{s.webhook.map((w) => <tr key={w.url} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={oLa()} title={w.url}>{w.url}</td>
                <td style={{ ...oLa(), color: w.trang_thai === 'enabled' ? undefined : 'var(--warn)' }}>{w.trang_thai === 'enabled' ? 'bật' : w.trang_thai}</td>
                <td style={oLa(true)}>{w.so_su_kien}</td>
                <td style={{ ...oLa(), ...phu }}>{w.cua_minh ? 'shop của mình' : 'site khác'}</td></tr>)}</tbody>
            </LaBang>
          </MucGon>
          <MucGon ten={<b>Rút tiền gần nhất</b>} phu={s.rut.length ? `${s.rut.length} lần` : 'chưa có lần rút nào'}>
            {s.rut.length > 0 && <LaBang cot={[{ h: 'Ngày về', rong: 110 }, { h: 'Số tiền', rong: 110, phai: true }, { h: 'Trạng thái', rong: 110 }, { h: 'Lỗi' }]}>
              <tbody>{s.rut.map((r) => <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={oLa()}>{r.ngay}</td><td style={oLa(true)}>{tien(r.so)}</td>
                <td style={{ ...oLa(), color: r.trang_thai === 'failed' ? 'var(--bad)' : undefined }}>{r.trang_thai}</td><td style={{ ...oLa(), ...phu }}>{r.loi ?? '—'}</td></tr>)}</tbody>
            </LaBang>}
          </MucGon>
          <MucGon ten={<b>Lịch sử 30 ngày</b>} phu={g.lichSu.length ? `${g.lichSu.length} ngày đã chụp — xem tỷ lệ có đang leo không` : 'chưa có'}>
            {g.lichSu.length > 0 && <LaBang cot={COT_LS}>
              <tbody>{[...g.lichSu].reverse().map((l) => { const t = tyLeCong({ ...s, ky90: l.so.ky90, ky30: l.so.ky30 });
                return <tr key={l.ngay} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={oLa()}>{l.ngay}</td><td style={oLa(true)}>{l.so.ky90.thanh_cong}</td><td style={oLa(true)}>{ptChu(t.dispute)}</td>
                  <td style={oLa(true)}>{ptChu(t.hoan)}</td><td style={oLa(true)}>{ptChu(t.that_bai)}</td><td style={oLa(true)}>{tien(l.so.so_du.kha_dung)}</td></tr>; })}</tbody>
            </LaBang>}
          </MucGon>
        </Cay></div>}
      </div>
    </Drawer>
  );
}

/** Thêm (id 0) / sửa phía mos2 của một cổng: loại, tên, tài khoản (CHỈ email/mã), trang quản trị, tiền về cổng nào, shop dùng, ghi chú, ngưỡng.
 *  Không đụng gì phía cổng. Cổng Stripe: loại + mã acct do máy nhận, không sửa ở đây. */
function SuaCong({ g, ds, phapNhan, cuaHang, onClose }: { g: CongDong; ds: CongDong[]; phapNhan: PhapNhanDong[]; cuaHang: CuaHangDong[]; onClose: () => void }) {
  const [pn, setPn] = useState<number | null>(g.phapNhanId);
  const moi = g.id === 0;
  const [loai, setLoai] = useState(g.loai);
  const [ten, setTen] = useState(g.ten ?? '');
  const [tk, setTk] = useState(g.taiKhoan ?? '');
  const [link, setLink] = useState(g.link ?? '');
  const [ve, setVe] = useState<number | null>(g.veCongId);
  const [shops, setShops] = useState<string[]>(g.shops);
  const [gc, setGc] = useState(g.ghiChu ?? '');
  const [ng, setNg] = useState<Record<string, string>>(Object.fromEntries(Object.keys(NGUONG_MAC_DINH).map((k) => [k, g.nguong[k] != null ? String(g.nguong[k]) : ''])));
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const kieu = KIEU_CONG[loai] ?? KIEU_CONG.khac!;
  const nhan = ds.filter((x) => x.vai === 'nhan' && x.id !== g.id);
  return (
    <Drawer onClose={onClose} width={620}>
      <div style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{moi ? 'Thêm cổng thanh toán' : `Cổng · ${KIEU_CONG[g.loai]?.ten ?? g.loai} · ${g.ten ?? g.ma}`}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10 }}>
          <PickField label="Loại" value={loai} disabled={!moi} hint={`${VAI_CONG[kieu.vai]}${kieu.api ? ' · máy tự đọc sức khoẻ' : ' · ghi tay (chưa nối API)'}`}
            options={Object.entries(KIEU_CONG).map(([k, x]) => ({ value: k, label: `${x.ten} — ${VAI_CONG[x.vai].toLowerCase()}` }))} onChange={(k) => k && setLoai(k)} />
          <TextField id="cong-ten" label="Tên gọi" placeholder={`${kieu.ten} chính`} value={ten} onChange={(e) => setTen(e.target.value)} />
        </div>
        {loai !== 'stripe' && <TextField id="cong-tk" label="Tài khoản" hint="CHỈ email đăng nhập / mã tài khoản (vd Payoneer ID). Không mật khẩu, không số thẻ / số tài khoản ngân hàng." value={tk} onChange={(e) => setTk(e.target.value)} />}
        <TextField id="cong-link" label="Trang quản trị" placeholder={kieu.link ?? 'https://…'} value={link} onChange={(e) => setLink(e.target.value)} />
        <PickField label="Đứng tên pháp nhân" value={pn} placeholder="— chưa ghi —" clearable hint={phapNhan.length ? undefined : 'chưa có pháp nhân — thêm bằng nút "+ Pháp nhân"'}
          options={phapNhan.map((p) => ({ value: p.id, label: `${p.ten} · ${LOAI_PHAP_NHAN[p.loai] ?? p.loai}` }))} onChange={(k) => setPn(k ?? null)} />
        {kieu.vai === 'thu' && <>
          <PickField label="Tiền rút về" value={ve} placeholder="— chưa ghi —" clearable hint={nhan.length ? undefined : 'chưa có cổng nhận (Payoneer/PingPong) — thêm trước rồi chọn ở đây'}
            options={nhan.map((x) => ({ value: x.id, label: `${KIEU_CONG[x.loai]?.ten ?? x.loai} · ${x.ten ?? x.ma}` }))} onChange={(k) => setVe(k ?? null)} />
          <div style={{ display: 'grid', gap: 4 }}><b style={{ fontSize: 13 }}>Shop dùng cổng này</b>
            {loai === 'stripe' ? <span style={{ fontSize: 12.5, ...phu }}>Stripe: máy tự gán theo khoá của từng shop.</span>
              : <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{cuaHang.map((c) => <label key={c.khoa} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={shops.includes(c.khoa)} onChange={(e) => setShops(e.target.checked ? [...shops, c.khoa] : shops.filter((x) => x !== c.khoa))} />{c.ten}</label>)}</span>}
          </div>
        </>}
        <TextAreaField id="cong-gc" label="Ghi chú (ai giữ tài khoản, phí, lưu ý)" rows={3} value={gc} onChange={(e) => setGc(e.target.value)} />
        {kieu.api && <>
          <b style={{ fontSize: 13 }}>Ngưỡng cảnh báo — trống = mặc định</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(Object.keys(NGUONG_MAC_DINH) as (keyof NguongCong)[]).map((k) => (
              <TextField key={k} id={`cong-ng-${k}`} label={NHAN_NGUONG[k]} inputMode="decimal" placeholder={String(NGUONG_MAC_DINH[k])} value={ng[k] ?? ''} onChange={(e) => setNg({ ...ng, [k]: e.target.value })} />
            ))}
          </div>
        </>}
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" disabled={dang} onClick={() => batDau(async () => {
            const nguong = Object.fromEntries(Object.entries(ng).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v)]));
            const r = await shopSuaCong(moi ? null : g.id, { loai, ten, taiKhoan: tk, link, veCongId: ve, phapNhanId: pn, shops: loai === 'stripe' ? undefined : shops, ghiChu: gc, nguong })
              .catch((e) => ({ ok: false, loi: (e as Error).message }));
            if (r.ok) onClose(); else setLoi(('loi' in r && r.loi) || 'lỗi');
          })}>{dang ? 'Đang lưu…' : 'Lưu'}</button>
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </Drawer>
  );
}

/** Thêm (id 0) / sửa một PHÁP NHÂN: tên pháp lý, loại, nơi đăng ký, 4 số cuối mã số thuế, người đại diện, đại lý đăng ký, ngày lập, hạn báo cáo năm,
 *  trạng thái, shop bán dưới tên nó. Không lưu số ngân hàng / thẻ; mã số thuế chỉ 4 số cuối. */
function SuaPhapNhan({ p, cuaHang, onClose }: { p: PhapNhanDong; cuaHang: CuaHangDong[]; onClose: () => void }) {
  const moi = p.id === 0;
  const [v, setV] = useState({ ten: p.ten, loai: p.loai, nuoc: p.nuoc ?? '', bang: p.bang ?? '', maSoCuoi: p.maSoCuoi ?? '', nguoiDaiDien: p.nguoiDaiDien ?? '', daiLy: p.daiLy ?? '',
    ngayLap: p.ngayLap ?? '', hanBaoCao: p.hanBaoCao ?? '', trangThai: p.trangThai, link: p.link ?? '', ghiChu: p.ghiChu ?? '', shops: p.shops });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const dat = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  return (
    <Drawer onClose={onClose} width={620}>
      <div style={{ display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{moi ? 'Thêm pháp nhân' : `Pháp nhân · ${p.ten}`}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 10 }}>
          <TextField id="pn-ten" label="Tên pháp lý đầy đủ" placeholder="Mellowstep LLC" value={v.ten} onChange={dat('ten')} />
          <PickField label="Loại" value={v.loai} options={Object.entries(LOAI_PHAP_NHAN).map(([k, t]) => ({ value: k, label: t }))} onChange={(k) => k && setV({ ...v, loai: k })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px', gap: 10 }}>
          <TextField id="pn-nuoc" label="Nước" value={v.nuoc} onChange={dat('nuoc')} />
          <TextField id="pn-bang" label="Bang / tỉnh đăng ký" placeholder="Wyoming" value={v.bang} onChange={dat('bang')} />
          <TextField id="pn-ms" label="EIN / MST — 4 số cuối" mono inputMode="numeric" value={v.maSoCuoi} onChange={dat('maSoCuoi')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <TextField id="pn-dd" label="Người đại diện" value={v.nguoiDaiDien} onChange={dat('nguoiDaiDien')} />
          <TextField id="pn-dl" label="Đại lý đăng ký (registered agent)" value={v.daiLy} onChange={dat('daiLy')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <TextField id="pn-ngay" label="Ngày lập" type="date" value={v.ngayLap} onChange={dat('ngayLap')} />
          <TextField id="pn-han" label="Hạn báo cáo năm kế" type="date" value={v.hanBaoCao} onChange={dat('hanBaoCao')} />
          <PickField label="Trạng thái" value={v.trangThai} options={Object.entries(TRANG_THAI_PN).map(([k, [t]]) => ({ value: k, label: t }))} onChange={(k) => k && setV({ ...v, trangThai: k })} />
        </div>
        <TextField id="pn-link" label="Trang tra cứu / cổng của bang" placeholder="https://…" value={v.link} onChange={dat('link')} />
        <div style={{ display: 'grid', gap: 4 }}><b style={{ fontSize: 13 }}>Shop bán dưới tên pháp nhân này</b>
          <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{cuaHang.map((c) => <label key={c.khoa} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={v.shops.includes(c.khoa)} onChange={(e) => setV({ ...v, shops: e.target.checked ? [...v.shops, c.khoa] : v.shops.filter((x) => x !== c.khoa) })} />{c.ten}</label>)}</span>
        </div>
        <TextAreaField id="pn-gc" label="Ghi chú (ngân hàng dùng — chỉ tên, thuế, giấy phép…)" rows={3} value={v.ghiChu} onChange={dat('ghiChu')} />
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" disabled={dang} onClick={() => batDau(async () => {
            const r = await shopSuaPhapNhan(moi ? null : p.id, v).catch((e) => ({ ok: false, loi: (e as Error).message }));
            if (r.ok) onClose(); else setLoi(('loi' in r && r.loi) || 'lỗi');
          })}>{dang ? 'Đang lưu…' : 'Lưu'}</button>
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </Drawer>
  );
}
