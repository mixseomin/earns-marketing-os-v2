'use client';
// /shop › Cửa hàng — tổng quan gọn + cài đặt trong drawer (anh chốt 01/10/2026: mọi điều khiển nằm trong mos2, nhưng bản cũ mở hết mọi ô
// của mọi shop cùng lúc nên "khó nhìn, khó hiểu"). Màn = mỗi shop MỘT thẻ: trạng thái + tóm tắt cấu hình đọc một lượt; bấm Cài đặt → drawer:
// cột trái là các mục, mỗi mục kèm một dòng tóm tắt giá trị đang đặt (chưa mở đã biết), cột phải là form của đúng mục đó, chia nhóm.
// Mỗi mục đọc/ghi một khoá của shop_cua_hang.mat_tien (@mos2/shop/mat-tien) qua shopSuaMatTien (Vận hành: cau_hinh qua shopSuaCauHinh).
// Khoá bí mật (Stripe/SMTP/CJ…) KHÔNG sửa ở đây — mục Kết nối chỉ báo có/không + tên biến. URL: ?m=cai-dat&mId=<id>&cs=<mục>.
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { DateTimeField, Drawer, LinkChip, Panel, Pill, SelectField, SimpleTable, TextAreaField, TextField, toDatetimeLocal } from '@/components/ui';
import { CHANG_BAO_THU, CHANG_KHACH, camKetGiao, cauHinhGiao, duKienGiao, khoangUS } from '@mos2/shop/giao';
import { TRANG_TINH } from '@mos2/shop/mat-tien';
import { gio } from '@/lib/shop/buoc';
import type { CuaHangDong } from '@/lib/shop/doc';
import { shopDongBo, shopKetNoi, shopLinkXemTruoc, shopSuaCauHinh, shopSuaMatTien, shopXemThu } from '@/lib/actions/shop';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };

/** Các mục cài đặt + một dòng tóm tắt giá trị đang đặt (hiện ở thẻ tổng quan và cột trái drawer). */
const MUC: { value: string; label: string; tom: (c: CuaHangDong) => string }[] = [
  { value: 'van_hanh', label: 'Vận hành', tom: (c) => `${c.trangThai === 'bat' ? 'Đồng bộ bật' : 'Đồng bộ tắt'} · ${c.cauHinh.tu_sang_ncc ? 'tự sang NCC' : 'sang NCC tay'} · ship ≤ ${c.cauHinh.ngay_ship_max ?? 11} ngày` },
  { value: 'mat_tien', label: 'Mặt tiền', tom: (c) => `${(c.matTien.bac_giam ?? []).map((b) => `${b.sl}+ món −${b.pt}%`).join(', ') || 'không bậc giảm'} · ${(c.matTien.cam_ket ?? []).length} cam kết` },
  { value: 'giao', label: 'Giao hàng & cam kết', tom: (c) => { const g = cauHinhGiao(c.matTien.giao); return `${g.xu_ly[0] + g.van_chuyen[0]}–${g.xu_ly[1] + g.van_chuyen[1]} ngày${g.ngay_lam_viec ? ' làm việc' : ''} · bảo đảm ${g.dam_bao_ngay} ngày`; } },
  { value: 'thu', label: 'Thư khách', tom: (c) => { const t = c.matTien.thu ?? {}; const n = (t.xac_nhan !== false ? 1 : 0) + (t.da_gui !== false ? 1 : 0) + (t.chang ?? [...CHANG_BAO_THU]).length; return `${n}/${2 + CHANG_BAO_THU.length} thư tự gửi`; } },
  { value: 'tu_van', label: 'Tư vấn (chat)', tom: (c) => { const t = c.matTien.tu_van ?? {}; return t.bat === false ? 'Chat tắt' : `Chat bật · ${t.tu_gui === false ? 'duyệt hết' : 'máy tự gửi loại an toàn'}${t.khi_truc ? ' · chỉ khi có người trực' : ''}`; } },
  { value: 'faq', label: 'FAQ & ưu đãi', tom: (c) => `${(c.matTien.faq ?? []).length} câu FAQ · ${(c.matTien.ma_giam ?? []).length} mã giảm${c.matTien.dang_ky ? ' · có ô đăng ký' : ''}` },
  { value: 'trang', label: 'Trang chính sách', tom: (c) => `${Object.values(c.matTien.trang ?? {}).filter((t) => t?.html).length}/${TRANG_TINH.length + 1} trang có nội dung` },
  { value: 'ket_noi', label: 'Kết nối & xem trước', tom: () => 'Stripe · thư · CJ · 17TRACK · GA4 · link xem như khách' },
];

function useLuu(khoa: string) {
  const [bao, setBao] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const luu = (v: Record<string, unknown>, xong = 'Đã lưu — mặt tiền đổi trong ≤30 giây') => batDau(async () => {
    const r = await shopSuaMatTien(khoa, v).catch((e) => ({ ok: false, loi: (e as Error).message }));
    setBao(r.ok ? xong : `Lỗi: ${'loi' in r ? r.loi : ''}`);
  });
  const Bao = () => (bao ? <span style={{ fontSize: 12.5, color: bao.startsWith('Lỗi') ? 'var(--bad)' : 'var(--fg-2)' }}>{bao}</span> : null);
  return { luu, dang, Bao, setBao };
}

/** Nhóm trong một mục: tiêu đề + một dòng giải thích + lưới ô. */
function Nhom({ ten, ghi, children, cot = 2 }: { ten: string; ghi?: string; children: ReactNode; cot?: number }) {
  return (
    <section style={{ display: 'grid', gap: 8, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      <div><b style={{ fontSize: 13 }}>{ten}</b>{ghi && <div style={{ fontSize: 12, ...phu, marginTop: 2 }}>{ghi}</div>}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cot}, minmax(0, 1fr))`, gap: 10 }}>{children}</div>
    </section>
  );
}

/* ── Thẻ tổng quan một cửa hàng (màn chính của tab) ── */
export function TheCuaHang({ c, moCaiDat }: { c: CuaHangDong; moCaiDat: (muc?: string) => void }) {
  const mo = c.trangThai === 'bat';
  return (
    <Panel
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{c.ten}
        <Pill color={mo ? 'var(--ok)' : 'var(--fg-3)'} label={mo ? 'đang chạy' : 'tắt'} /></span>}
      subtitle={`${c.nenTang === 'mos' ? 'mặt tiền MOS' : 'WooCommerce'} · NCC ${c.ncc.toUpperCase()} · ${c.soDon} đơn · ${c.soSanPham} sản phẩm`}
      actions={<>
        {c.domain && !c.domain.endsWith('.invalid') && <LinkChip href={`https://${c.domain}`} tone="neutral">{c.domain} ↗</LinkChip>}
        <button className="btn primary" onClick={() => moCaiDat()}>Cài đặt</button>
      </>}>
      <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
        <div style={{ fontSize: 12.5, color: c.dongBoLoi ? 'var(--bad)' : 'var(--fg-3)' }}>
          Đồng bộ gần nhất {gio(c.dongBoLuc)}{c.dongBoLoi ? ` · lỗi: ${c.dongBoLoi}` : ''}
          {c.thieuMa > 0 && <> · <span style={{ color: 'var(--bad)' }}>{c.thieuMa} biến thể thiếu mã CJ</span></>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 6 }}>
          {MUC.filter((m) => m.value !== 'ket_noi').map((m) => (
            <button key={m.value} type="button" onClick={() => moCaiDat(m.value)} title={`Mở cài đặt: ${m.label}`}
              style={{ textAlign: 'left', display: 'grid', gap: 1, padding: '6px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'inherit', cursor: 'pointer' }}>
              <span style={{ fontSize: 10.5, ...phu, textTransform: 'uppercase', letterSpacing: '.05em' }}>{m.label}</span>
              <span style={{ fontSize: 12.5 }}>{m.tom(c)}</span>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ── Drawer cài đặt một cửa hàng: cột trái mục + tóm tắt, cột phải form ── */
export function DrawerCaiDat({ c, onClose }: { c: CuaHangDong; onClose: () => void }) {
  // đọc thẳng location (không qua useSearchParams): thẻ tổng quan vừa ghi ?cs=<mục> bằng replaceState ngay trước khi mở drawer
  const [muc, setMuc] = useState<string>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cs')) || 'van_hanh');
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (muc !== 'van_hanh') u.set('cs', muc); else u.delete('cs');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${u.toString()}`);
    return () => { const v = new URLSearchParams(window.location.search); v.delete('cs'); window.history.replaceState(window.history.state, '', `${window.location.pathname}?${v.toString()}`); };
  }, [muc]);
  return (
    <Drawer onClose={onClose} width={1040}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Cài đặt · {c.ten}</h2>
          <Pill color={c.trangThai === 'bat' ? 'var(--ok)' : 'var(--fg-3)'} label={c.trangThai === 'bat' ? 'đang chạy' : 'tắt'} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '230px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <nav aria-label="Mục cài đặt" style={{ display: 'grid', gap: 2, position: 'sticky', top: 0 }}>
            {MUC.map((m) => {
              const on = m.value === muc;
              return (
                <button key={m.value} type="button" onClick={() => setMuc(m.value)} aria-current={on ? 'page' : undefined}
                  style={{ textAlign: 'left', display: 'grid', gap: 2, padding: '8px 10px', borderRadius: 6, border: 0, cursor: 'pointer', color: 'inherit',
                    background: on ? 'var(--accent-soft)' : 'transparent', borderLeft: `2px solid ${on ? 'var(--accent)' : 'transparent'}` }}>
                  <span style={{ fontSize: 13, fontWeight: on ? 700 : 500 }}>{m.label}</span>
                  <span style={{ fontSize: 11.5, ...phu, lineHeight: 1.35 }}>{m.tom(c)}</span>
                </button>
              );
            })}
          </nav>
          <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{MUC.find((m) => m.value === muc)?.label}</div>
            {muc === 'van_hanh' && <VanHanh c={c} />}
            {muc === 'mat_tien' && <MatTien c={c} />}
            {muc === 'giao' && <GiaoHang c={c} />}
            {muc === 'thu' && <ThuKhach c={c} />}
            {muc === 'tu_van' && <TuVan c={c} />}
            {muc === 'faq' && <FaqUuDai c={c} />}
            {muc === 'trang' && <TrangChinhSach c={c} />}
            {muc === 'ket_noi' && <KetNoi c={c} />}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Vận hành (đồng bộ · NCC · ship · GA4) — shop_cua_hang.cau_hinh ── */
function VanHanh({ c }: { c: CuaHangDong }) {
  const goc = { ngay_ship_max: c.cauHinh.ngay_ship_max ?? 11, tu_sang_ncc: !!c.cauHinh.tu_sang_ncc, tu_tra_ncc: !!c.cauHinh.tu_tra_ncc, trang_thai: c.trangThai as 'bat' | 'tat', ga4_property: c.cauHinh.ga4_property ?? '' };
  const [cfg, setCfg] = useState(goc);
  const [bao, setBao] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const tick = (k: 'tu_sang_ncc' | 'tu_tra_ncc', nhan: string, chu: string) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
      <input type="checkbox" checked={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} style={{ marginTop: 3 }} />
      <span><b>{nhan}</b><br /><span style={phu}>{chu}</span></span>
    </label>
  );
  return (<>
    <div style={{ fontSize: 12.5, color: c.dongBoLoi ? 'var(--bad)' : 'var(--fg-3)' }}>
      Đồng bộ gần nhất {gio(c.dongBoLuc)}{c.dongBoLoi ? ` · lỗi: ${c.dongBoLoi}` : c.nenTang === 'woo' ? ' · Woo đẩy đơn tức thì, máy kéo bù mỗi 10 phút' : ' · đơn vào ngay khi khách trả tiền (Stripe), máy đối soát + theo dõi NCC/vận đơn mỗi 10 phút'}
    </div>
    <Nhom ten="Đồng bộ & nhà cung cấp" cot={1}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
        <input type="checkbox" checked={cfg.trang_thai === 'bat'} onChange={(e) => setCfg({ ...cfg, trang_thai: e.target.checked ? 'bat' : 'tat' })} style={{ marginTop: 3 }} />
        <span><b>Bật đồng bộ</b><br /><span style={phu}>Tắt = máy không đụng tới shop này (không kéo đơn, không sang NCC, không gửi thư).</span></span>
      </label>
      {tick('tu_sang_ncc', 'Tự sang NCC', 'Đơn vừa trả tiền tự đặt sang CJ — chỉ TẠO đơn, chưa trả CJ, không tiêu tiền.')}
      {tick('tu_tra_ncc', 'Tự trả NCC (trừ ví CJ)', 'Tạo xong tự trả CJ từ ví — TIÊU TIỀN không cần bấm. Mặc định tắt.')}
    </Nhom>
    <Nhom ten="Tuyến ship & đo lường">
      <TextField id={`vh-ship-${c.khoa}`} label="Ship tối đa (ngày)" hint="Chỉ chọn tuyến giao tối đa ≤ số ngày này; trong đó lấy tuyến rẻ nhất." type="number" min={3} max={30}
        value={String(cfg.ngay_ship_max)} onChange={(e) => setCfg({ ...cfg, ngay_ship_max: Number(e.target.value) })} />
      <TextField id={`vh-ga4-${c.khoa}`} label="GA4 property" hint="Số property (Admin › Property details) — tab Khách trực tiếp kéo GA4 thời gian thực." inputMode="numeric"
        value={cfg.ga4_property} placeholder="vd 556926376" onChange={(e) => setCfg({ ...cfg, ga4_property: e.target.value })} />
    </Nhom>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn primary" disabled={JSON.stringify(cfg) === JSON.stringify(goc) || dang} onClick={() => batDau(async () => { await shopSuaCauHinh(c.khoa, cfg); setBao('Đã lưu vận hành'); })}>Lưu vận hành</button>
      <button className="btn ghost" disabled={dang} title="Kéo lại toàn bộ đơn + sản phẩm từ nguồn (Woo) / đối soát (MOS) ngay bây giờ" onClick={() => batDau(async () => {
        const r = await shopDongBo(c.khoa, true).catch((e) => ({ ok: false, loi: (e as Error).message }));
        setBao(r.ok ? 'Đã kéo lại đơn + sản phẩm' : `Lỗi: ${r.loi}`);
      })}>{dang ? 'Đang chạy…' : 'Kéo lại cả sản phẩm'}</button>
      {bao && <span style={{ fontSize: 12.5, color: bao.startsWith('Lỗi') ? 'var(--bad)' : 'var(--fg-2)' }}>{bao}</span>}
    </div>
  </>);
}

/* ── Mặt tiền — chia nhóm: ưu đãi · cam kết · thương hiệu & liên hệ · ship · đo lường (gập) ── */
function MatTien({ c }: { c: CuaHangDong }) {
  const m = c.matTien;
  const goc = {
    thanh_tren: m.thanh_tren ?? '', dong_sale: m.dong_sale ?? '', sale_het: toDatetimeLocal(m.sale_het ?? null),
    bac_giam: (m.bac_giam ?? []).map((b) => `${b.sl}:${b.pt}`).join(', '), cam_ket: (m.cam_ket ?? []).join('\n'),
    mau_nhan: m.mau_nhan ?? '', ga4: m.do?.ga4 ?? '', meta_pixel: m.do?.meta_pixel ?? '', gads: m.do?.gads ?? '',
    logo: m.logo ?? '', email: m.email ?? '', dia_chi: m.dia_chi ?? '',
    ship_ten: m.ship?.ten ?? 'Free Shipping', ship_phi: String(m.ship?.phi ?? 0), ship_mien: m.ship?.mien_phi_tu == null ? '' : String(m.ship.mien_phi_tu),
  };
  const [v, setV] = useState(goc);
  const { luu, dang, Bao, setBao } = useLuu(c.khoa);
  const doi = JSON.stringify(v) !== JSON.stringify(goc);
  const dat = (k: keyof typeof goc) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const xemTruoc = c.tenMien.find((t) => t !== c.domain && !t.startsWith('www.')) ?? c.domain;
  const nop = () => {
    const bac = v.bac_giam.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const [sl, pt] = x.split(':').map(Number); return { sl: sl!, pt: pt! }; });
    if (bac.some((b) => !(b.sl >= 2 && b.pt > 0 && b.pt < 90))) { setBao('Lỗi: bậc giảm dạng "2:10, 3:15" (số món : % giảm)'); return; }
    luu({ thanh_tren: v.thanh_tren.trim(), dong_sale: v.dong_sale.trim(), sale_het: v.sale_het ? new Date(v.sale_het).toISOString() : null,
      bac_giam: bac, cam_ket: v.cam_ket.split('\n').map((x) => x.trim()).filter(Boolean), mau_nhan: v.mau_nhan.trim() || undefined,
      do: { ...m.do, ga4: v.ga4.trim() || undefined, meta_pixel: v.meta_pixel.trim() || undefined, gads: v.gads.trim() || undefined },
      logo: v.logo.trim() || null, email: v.email.trim(), dia_chi: v.dia_chi.trim(),
      ship: { ten: v.ship_ten.trim(), phi: Number(v.ship_phi) || 0, mien_phi_tu: v.ship_mien.trim() === '' ? null : Number(v.ship_mien) } });
  };
  return (<>
    {xemTruoc && !xemTruoc.endsWith('.invalid') && <div><LinkChip href={`https://${xemTruoc}`} tone="neutral" size="xs">Xem mặt tiền: {xemTruoc} ↗</LinkChip></div>}
    <Nhom ten="Ưu đãi" ghi="Chỉ ghi ưu đãi CÓ THẬT — khách thấy ở dải trên cùng và cột mua.">
      <TextField id={`mt-tren-${c.khoa}`} label="Dải đen trên cùng" value={v.thanh_tren} onChange={dat('thanh_tren')} />
      <TextField id={`mt-bac-${c.khoa}`} label="Mua nhiều giảm nhiều" hint='"2:10, 3:15" = 2 món −10%, từ 3 món −15%' value={v.bac_giam} onChange={dat('bac_giam')} />
      <TextAreaField id={`mt-sale-${c.khoa}`} label="Khối đỏ/cam giữa cột mua (2 dòng)" rows={2} value={v.dong_sale} onChange={dat('dong_sale')} />
      <DateTimeField id={`mt-het-${c.khoa}`} label="Đợt sale hết lúc" hint="Trống = ẩn đồng hồ đếm ngược." value={v.sale_het} onChange={dat('sale_het')} />
    </Nhom>
    <Nhom ten="Cam kết dưới nút mua" ghi="Mỗi dòng một ô — phải đúng chính sách ship/đổi trả." cot={1}>
      <TextAreaField id={`mt-ck-${c.khoa}`} rows={3} value={v.cam_ket} onChange={dat('cam_ket')} />
    </Nhom>
    <Nhom ten="Thương hiệu & liên hệ">
      <TextField id={`mt-logo-${c.khoa}`} label="Logo (URL ảnh)" hint="Trống = dựng chữ tên shop" value={v.logo} onChange={dat('logo')} />
      <TextField id={`mt-mau-${c.khoa}`} label="Màu nhấn (nút chọn)" hint="#4A90E2 như Crossian" value={v.mau_nhan} onChange={dat('mau_nhan')} />
      <TextField id={`mt-email-${c.khoa}`} label="Email hỗ trợ" hint="Người gửi mọi thư khách + hộp nhận form liên hệ" value={v.email} onChange={dat('email')} />
      <TextField id={`mt-dc-${c.khoa}`} label="Địa chỉ chân trang" value={v.dia_chi} onChange={dat('dia_chi')} />
    </Nhom>
    <Nhom ten="Phí ship ở checkout" cot={3}>
      <TextField id={`mt-ship-ten-${c.khoa}`} label="Tên dòng ship" value={v.ship_ten} onChange={dat('ship_ten')} />
      <TextField id={`mt-ship-phi-${c.khoa}`} label="Phí (USD)" inputMode="decimal" value={v.ship_phi} onChange={dat('ship_phi')} />
      <TextField id={`mt-ship-mien-${c.khoa}`} label="Miễn ship từ (USD)" hint="Trống = không ngưỡng" inputMode="decimal" value={v.ship_mien} onChange={dat('ship_mien')} />
    </Nhom>
    <details style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <summary style={{ cursor: 'pointer', fontSize: 13 }}><b>Mã đo lường</b> <span style={phu}>· GA4 {v.ga4 || '—'} · Pixel {v.meta_pixel || '—'} · Ads {v.gads || '—'}</span></summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 10 }}>
        <TextField id={`mt-ga-${c.khoa}`} label="GA4 (G-…)" mono value={v.ga4} onChange={dat('ga4')} />
        <TextField id={`mt-px-${c.khoa}`} label="Meta Pixel ID" mono value={v.meta_pixel} onChange={dat('meta_pixel')} />
        <TextField id={`mt-gads-${c.khoa}`} label="Google Ads (AW-…)" mono value={v.gads} onChange={dat('gads')} />
      </div>
    </details>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button className="btn primary" disabled={!doi || dang} onClick={nop}>{dang ? 'Đang lưu…' : 'Lưu mặt tiền'}</button><Bao />
    </div>
  </>);
}

/* ── Giao hàng & cam kết ── */
function GiaoHang({ c }: { c: CuaHangDong }) {
  const g0 = cauHinhGiao(c.matTien.giao);
  const goc = { x0: String(g0.xu_ly[0]), x1: String(g0.xu_ly[1]), v0: String(g0.van_chuyen[0]), v1: String(g0.van_chuyen[1]), lv: g0.ngay_lam_viec, bd: String(g0.dam_bao_ngay) };
  const [v, setV] = useState(goc);
  const { luu, dang, Bao } = useLuu(c.khoa);
  const g = { xu_ly: [Number(v.x0) || 0, Number(v.x1) || 0] as [number, number], van_chuyen: [Number(v.v0) || 0, Number(v.v1) || 0] as [number, number], ngay_lam_viec: v.lv, dam_bao_ngay: Number(v.bd) || 30 };
  const dat = (k: 'x0' | 'x1' | 'v0' | 'v1' | 'bd') => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const o = (k: 'x0' | 'x1' | 'v0' | 'v1' | 'bd', nhan: string) => <TextField id={`gh-${k}-${c.khoa}`} label={nhan} inputMode="numeric" value={v[k]} onChange={dat(k)} style={{ width: 90 }} />;
  return (<>
    <div style={{ fontSize: 12.5, ...phu }}>Số ngày phải KHỚP trang Shipping Policy (mục Trang chính sách) — khách thấy ngày này ở trang sản phẩm, checkout, trang cảm ơn, thư xác nhận, trang theo dõi.</div>
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'flex-end' }}>{o('x0', 'Xử lý từ')}{o('x1', 'đến (ngày)')}</span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'flex-end' }}>{o('v0', 'Vận chuyển từ')}{o('v1', 'đến (ngày)')}</span>
      {o('bd', 'Bảo đảm (ngày sau khi gửi)')}
      <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, paddingBottom: 8 }}>
        <input type="checkbox" checked={v.lv} onChange={(e) => setV({ ...v, lv: e.target.checked })} /> Tính ngày làm việc (bỏ T7, CN)</label>
    </div>
    <div style={{ display: 'grid', gap: 6, padding: 10, border: '1px dashed var(--line)', borderRadius: 6, fontSize: 13 }}>
      <span style={phu}>Khách sẽ thấy (đặt hôm nay):</span>
      <span>📦 Order today, get it <b>{khoangUS(duKienGiao(g))}</b></span>
      <span>🛡️ {camKetGiao(g)}</span>
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button className="btn primary" disabled={JSON.stringify(v) === JSON.stringify(goc) || dang} onClick={() => luu({ giao: g })}>{dang ? 'Đang lưu…' : 'Lưu giao hàng'}</button><Bao />
    </div>
  </>);
}

/* ── Thư khách ── */
function ThuKhach({ c }: { c: CuaHangDong }) {
  const t = c.matTien.thu ?? {};
  const goc = { xac_nhan: t.xac_nhan !== false, da_gui: t.da_gui !== false, chang: (t.chang ?? [...CHANG_BAO_THU]) as string[] };
  const [v, setV] = useState(goc);
  const [xem, setXem] = useState<{ loai: string; tieuDe: string; html: string } | null>(null);
  const { luu, dang, Bao } = useLuu(c.khoa);
  const ds: { loai: string; nhan: string; khi: string; bat: boolean; doi: (b: boolean) => void }[] = [
    { loai: 'xac_nhan', nhan: 'Xác nhận đơn', khi: 'Ngay khi khách trả tiền — kèm ngày dự kiến + cam kết', bat: v.xac_nhan, doi: (b) => setV({ ...v, xac_nhan: b }) },
    { loai: 'da_gui', nhan: 'Đã gửi hàng', khi: 'Khi CJ cấp mã vận đơn — kèm link theo dõi', bat: v.da_gui, doi: (b) => setV({ ...v, da_gui: b }) },
    ...CHANG_BAO_THU.map((k) => ({ loai: k, nhan: CHANG_KHACH[k].nhan, khi: `Khi đơn sang chặng "${CHANG_KHACH[k].nhan}" (mỗi đơn một lần)`, bat: v.chang.includes(k),
      doi: (b: boolean) => setV({ ...v, chang: b ? [...v.chang, k] : v.chang.filter((x) => x !== k) }) })),
  ];
  return (<>
    <SimpleTable rows={ds} getRowKey={(r) => r.loai} columns={[
      { key: 'b', header: 'Gửi', width: 50, cell: (r) => <input type="checkbox" aria-label={`Gửi thư ${r.nhan}`} checked={r.bat} onChange={(e) => r.doi(e.target.checked)} /> },
      { key: 'n', header: 'Thư', cell: (r) => <b>{r.nhan}</b> },
      { key: 'k', header: 'Gửi khi', cell: (r) => <span style={phu}>{r.khi}</span> },
      { key: 'x', header: '', width: 70, cell: (r) => <button className="btn ghost" onClick={async () => { const x = await shopXemThu(c.khoa, r.loai); if (x) setXem({ loai: r.loai, tieuDe: x.tieuDe, html: x.html }); }}>Xem</button> },
    ]} />
    <div style={{ fontSize: 12.5, ...phu }}>Nội dung thư lấy từ tên shop, email hỗ trợ và mục Giao hàng &amp; cam kết — đổi ở đó là thư đổi theo. Tắt một thư thì máy bỏ qua thư đó, các thư khác vẫn gửi.</div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button className="btn primary" disabled={JSON.stringify(v) === JSON.stringify(goc) || dang} onClick={() => luu({ thu: v })}>{dang ? 'Đang lưu…' : 'Lưu thư khách'}</button><Bao />
    </div>
    {xem && <Drawer onClose={() => setXem(null)} width={680}>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, ...phu }}>Tiêu đề</div><b>{xem.tieuDe}</b>
        <iframe title="Xem trước thư" srcDoc={xem.html} sandbox="" style={{ width: '100%', height: 760, border: '1px solid var(--line)', borderRadius: 6, background: '#fff' }} />
      </div>
    </Drawer>}
  </>);
}

/* ── Tư vấn (chat) ── */
function TuVan({ c }: { c: CuaHangDong }) {
  const t = c.matTien.tu_van ?? {};
  const goc = { bat: t.bat !== false, tu_gui: t.tu_gui !== false, khi_truc: !!t.khi_truc, chao: t.chao ?? '', model: t.model ?? '' };
  const [v, setV] = useState(goc);
  const { luu, dang, Bao } = useLuu(c.khoa);
  return (<>
    <div style={{ fontSize: 12.5, ...phu }}>Khách nhắn ở ô chat góc dưới phải → máy soạn từ sản phẩm, chính sách, FAQ, ngày giao và hành trình đơn thật → bước Kiểm → loại an toàn gửi ngay, loại nhạy cảm (tiền, giảm giá, đổi trả, khiếu nại) và tin bị chặn chờ anh duyệt ở tab Tư vấn.</div>
    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={v.bat} onChange={(e) => setV({ ...v, bat: e.target.checked })} /> Hiện ô chat trên site</label>
    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }} title="Có người trực = có ai đang mở tab Tư vấn trong 2 phút gần nhất. Tắt (mặc định): ô chat luôn hiện, máy trả lời câu thường 24/7, đầu ô chat nói thật đội có online hay không.">
      <input type="checkbox" checked={v.khi_truc} onChange={(e) => setV({ ...v, khi_truc: e.target.checked })} /> Chỉ hiện ô chat khi có người trực (đang mở tab Tư vấn)</label>
    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={v.tu_gui} onChange={(e) => setV({ ...v, tu_gui: e.target.checked })} /> Máy tự gửi trả lời loại an toàn đã qua bước Kiểm (tắt = mọi tin chờ anh duyệt)</label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
      <TextAreaField id={`tv-chao-${c.khoa}`} label="Lời chào trong ô chat" rows={2} value={v.chao} onChange={(e) => setV({ ...v, chao: e.target.value })} hint="Trống = câu mặc định hỏi về size, ship, đơn" />
      <TextField id={`tv-model-${c.khoa}`} label="Model soạn (OpenAI)" mono value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} hint="Trống = OPENAI_MODEL của máy chủ (gpt-4o-mini)" />
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button className="btn primary" disabled={JSON.stringify(v) === JSON.stringify(goc) || dang} onClick={() => luu({ tu_van: v })}>{dang ? 'Đang lưu…' : 'Lưu tư vấn'}</button><Bao />
    </div>
  </>);
}

/* ── FAQ & ưu đãi ── */
function FaqUuDai({ c }: { c: CuaHangDong }) {
  const m = c.matTien;
  const goc = { faq: (m.faq ?? []).map((f) => ({ ...f })), ma: (m.ma_giam ?? []).map((x) => ({ ma: x.ma, pt: String(x.pt) })),
    dk: { tieu_de: m.dang_ky?.tieu_de ?? '', chu: m.dang_ky?.chu ?? '', ma: m.dang_ky?.ma ?? '' } };
  const [v, setV] = useState(goc);
  const { luu, dang, Bao } = useLuu(c.khoa);
  const doiFaq = (i: number, k: 'hoi' | 'dap', x: string) => setV({ ...v, faq: v.faq.map((f, j) => (j === i ? { ...f, [k]: x } : f)) });
  const doiCho = (i: number, b: number) => { const f = [...v.faq]; const [x] = f.splice(i, 1); f.splice(i + b, 0, x!); setV({ ...v, faq: f }); };
  return (<>
    <b style={{ fontSize: 13 }}>FAQ cuối trang sản phẩm · {v.faq.length} câu</b>
    <div style={{ fontSize: 12.5, ...phu }}>Câu trả lời phải đúng chính sách shop (ship, đổi trả, hoàn tiền). Câu trả lời nhận HTML đơn giản.</div>
    {v.faq.map((f, i) => (
      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <TextField id={`faq-h-${c.khoa}-${i}`} size="sm" value={f.hoi} onChange={(e) => doiFaq(i, 'hoi', e.target.value)} placeholder="Câu hỏi" />
          <TextAreaField id={`faq-d-${c.khoa}-${i}`} rows={2} value={f.dap} onChange={(e) => doiFaq(i, 'dap', e.target.value)} placeholder="Trả lời" />
        </div>
        <div style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
          <button className="btn ghost" disabled={i === 0} onClick={() => doiCho(i, -1)} aria-label="Lên">↑</button>
          <button className="btn ghost" disabled={i === v.faq.length - 1} onClick={() => doiCho(i, 1)} aria-label="Xuống">↓</button>
          <button className="btn ghost" onClick={() => setV({ ...v, faq: v.faq.filter((_, j) => j !== i) })}>Bỏ</button>
        </div>
      </div>
    ))}
    <div><button className="btn ghost" onClick={() => setV({ ...v, faq: [...v.faq, { hoi: '', dap: '' }] })}>+ Thêm câu hỏi</button></div>

    <b style={{ fontSize: 13, marginTop: 8 }}>Mã giảm giá ở checkout</b>
    {v.ma.map((x, i) => (
      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <TextField id={`ma-${c.khoa}-${i}`} size="sm" label={i === 0 ? 'Mã' : undefined} mono value={x.ma} onChange={(e) => setV({ ...v, ma: v.ma.map((y, j) => (j === i ? { ...y, ma: e.target.value.toUpperCase() } : y)) })} style={{ width: 160 }} />
        <TextField id={`ma-pt-${c.khoa}-${i}`} size="sm" label={i === 0 ? '% giảm' : undefined} inputMode="numeric" value={x.pt} onChange={(e) => setV({ ...v, ma: v.ma.map((y, j) => (j === i ? { ...y, pt: e.target.value } : y)) })} style={{ width: 80 }} />
        <button className="btn ghost" onClick={() => setV({ ...v, ma: v.ma.filter((_, j) => j !== i) })}>Bỏ</button>
      </div>
    ))}
    <div><button className="btn ghost" onClick={() => setV({ ...v, ma: [...v.ma, { ma: '', pt: '10' }] })}>+ Thêm mã</button></div>

    <b style={{ fontSize: 13, marginTop: 8 }}>Ô đăng ký nhận mã (chân trang)</b>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
      <TextField id={`dk-td-${c.khoa}`} label="Tiêu đề" hint="Trống = ẩn ô đăng ký" value={v.dk.tieu_de} onChange={(e) => setV({ ...v, dk: { ...v.dk, tieu_de: e.target.value } })} />
      <TextField id={`dk-chu-${c.khoa}`} label="Lời mời" value={v.dk.chu} onChange={(e) => setV({ ...v, dk: { ...v.dk, chu: e.target.value } })} />
      <SelectField id={`dk-ma-${c.khoa}`} label="Tặng mã" value={v.dk.ma} onChange={(e) => setV({ ...v, dk: { ...v.dk, ma: e.target.value } })}>
        <option value="">— chọn mã —</option>{v.ma.filter((x) => x.ma).map((x) => <option key={x.ma} value={x.ma}>{x.ma} · {x.pt}%</option>)}</SelectField>
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button className="btn primary" disabled={JSON.stringify(v) === JSON.stringify(goc) || dang}
        onClick={() => luu({ faq: v.faq, ma_giam: v.ma.map((x) => ({ ma: x.ma, pt: Number(x.pt) })), dang_ky: v.dk.tieu_de.trim() ? v.dk : null })}>{dang ? 'Đang lưu…' : 'Lưu FAQ & ưu đãi'}</button><Bao />
    </div>
  </>);
}

/* ── Trang chính sách ── */
const TRANG_DS = [...TRANG_TINH.map((t) => ({ khoa: t.khoa, ten: t.ten, duong: `/static/${t.khoa}` })), { khoa: 'contact', ten: 'Contact us (lời mở đầu)', duong: '/contact' }];
function TrangChinhSach({ c }: { c: CuaHangDong }) {
  const [k, setK] = useState(TRANG_DS[0]!.khoa);
  const goc = c.matTien.trang?.[k] ?? { tieu_de: TRANG_DS.find((t) => t.khoa === k)!.ten, html: '' };
  const [v, setV] = useState(goc);
  useEffect(() => setV(c.matTien.trang?.[k] ?? { tieu_de: TRANG_DS.find((t) => t.khoa === k)!.ten, html: '' }), [k, c.matTien.trang]);
  const { luu, dang, Bao } = useLuu(c.khoa);
  const t = TRANG_DS.find((x) => x.khoa === k)!;
  return (<>
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <SelectField id={`tr-k-${c.khoa}`} label="Trang" value={k} onChange={(e) => setK(e.target.value)} style={{ width: 'auto' }}>
        {TRANG_DS.map((x) => <option key={x.khoa} value={x.khoa}>{x.ten}</option>)}</SelectField>
      <LinkChip href={`https://${c.domain}${t.duong}`} tone="neutral" size="xs">xem trên shop ↗</LinkChip>
    </div>
    <TextField id={`tr-td-${c.khoa}`} label="Tiêu đề" value={v.tieu_de} onChange={(e) => setV({ ...v, tieu_de: e.target.value })} />
    <TextAreaField id={`tr-html-${c.khoa}`} label="Nội dung (HTML)" rows={14} value={v.html} onChange={(e) => setV({ ...v, html: e.target.value })}
      hint={k === 'orders-shipping' ? 'Số ngày xử lý/giao + bảo đảm ở đây phải khớp mục Giao hàng & cam kết.' : undefined} />
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button className="btn primary" disabled={JSON.stringify(v) === JSON.stringify(goc) || dang}
        onClick={() => luu({ trang: { ...(c.matTien.trang ?? {}), [k]: v } })}>{dang ? 'Đang lưu…' : 'Lưu trang'}</button><Bao />
    </div>
  </>);
}

/* ── Kết nối & xem trước ── */
function KetNoi({ c }: { c: CuaHangDong }) {
  const [kn, setKn] = useState<Awaited<ReturnType<typeof shopKetNoi>> | null>(null);
  const [lk, setLk] = useState<Awaited<ReturnType<typeof shopLinkXemTruoc>> | null | undefined>(undefined);
  useEffect(() => { shopKetNoi(c.khoa).then(setKn).catch(() => setKn([])); shopLinkXemTruoc(c.khoa).then(setLk).catch(() => setLk(null)); }, [c.khoa]);
  const dau = useMemo(() => (ok: boolean | null) => <Pill color={ok === null ? 'var(--warn)' : ok ? 'var(--ok)' : 'var(--bad)'} label={ok === null ? 'không rõ' : ok ? 'có' : 'thiếu'} uppercase={false} mono={false} />, []);
  return (<>
    <b style={{ fontSize: 13 }}>Kết nối</b>
    {!kn ? <span style={phu}>Đang kiểm…</span> : <SimpleTable rows={kn} getRowKey={(r) => r.ten} columns={[
      { key: 'o', header: '', width: 70, cell: (r) => dau(r.ok) },
      { key: 't', header: 'Kết nối', cell: (r) => r.ten },
      { key: 'c', header: 'Chi tiết / chỗ cấu hình', cell: (r) => <span style={{ ...phu, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{r.chi_tiet}</span> },
    ]} />}
    <div style={{ fontSize: 12.5, ...phu }}>Khoá bí mật nằm trong .env.production trên máy chủ, không hiện và không sửa ở đây. Thiếu cái nào thì đặt đúng tên biến ở cột chi tiết.</div>
    <b style={{ fontSize: 13, marginTop: 8 }}>Xem trước như khách</b>
    {lk === undefined ? <span style={phu}>Đang dựng link…</span> : !lk ? <span style={phu}>Chưa có shop mặt tiền nào đang chạy để mượn khung.</span> : (
      <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
        {lk.muon && <span style={phu}>Shop này chưa phục vụ trên tên miền riêng — trang theo dõi mượn khung {lk.khung} (link có khoá xem trước, đừng gửi ra ngoài).</span>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lk.trangChu && <LinkChip href={lk.trangChu} tone="neutral" size="xs">Trang chủ ↗</LinkChip>}
          {lk.sanPham && <LinkChip href={lk.sanPham} tone="neutral" size="xs">Trang sản phẩm ↗</LinkChip>}
        </div>
        {lk.theoDoi.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lk.theoDoi.map((x) => <LinkChip key={x.so} href={x.url} tone="neutral" size="xs">Theo dõi #{x.so} · {x.chang}{x.tre ? ' · trễ' : ''} ↗</LinkChip>)}
        </div> : <span style={phu}>Chưa có đơn nào để xem trang theo dõi.</span>}
      </div>
    )}
  </>);
}
