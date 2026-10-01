'use client';
// /shop › Cửa hàng — MỌI cơ chế điều khiển mặt tiền của một shop nằm ở đây (anh chốt 01/10/2026: tập trung trong mos2, không sửa DB/
// mã/script để đổi hành vi). Mỗi mục đọc/ghi đúng một khoá của shop_cua_hang.mat_tien (@mos2/shop/mat-tien) qua shopSuaMatTien, có xem
// trước ngay tại chỗ. Khoá bí mật (Stripe/SMTP/CJ…) KHÔNG sửa ở đây — mục Kết nối chỉ báo có/không + tên biến cần đặt.
// URL: ?cs=<mục>.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { DateTimeField, Drawer, FilterChips, LinkChip, Pill, SelectField, SimpleTable, TextAreaField, TextField, toDatetimeLocal } from '@/components/ui';
import { CHANG_BAO_THU, CHANG_KHACH, camKetGiao, cauHinhGiao, duKienGiao, khoangUS } from '@mos2/shop/giao';
import { TRANG_TINH } from '@mos2/shop/mat-tien';
import type { CuaHangDong } from '@/lib/shop/doc';
import { shopKetNoi, shopLinkXemTruoc, shopSuaMatTien, shopXemThu } from '@/lib/actions/shop';

const MUC = [
  { value: 'mat_tien', label: 'Mặt tiền', title: 'Dải trên, ưu đãi, cam kết, màu, logo, liên hệ, ship, mã đo lường' },
  { value: 'giao', label: 'Giao hàng & cam kết', title: 'Ngày nhận dự kiến + cam kết giao hàng khách thấy ở trang sản phẩm, checkout, thư, trang theo dõi' },
  { value: 'thu', label: 'Thư khách', title: 'Bật/tắt từng thư tự động + xem trước' },
  { value: 'tu_van', label: 'Tư vấn (chat)', title: 'Ô chat trên site: bật/tắt, máy tự gửi loại an toàn, lời chào, model' },
  { value: 'faq', label: 'FAQ & ưu đãi', title: 'FAQ trang sản phẩm, mã giảm giá, ô đăng ký nhận mã' },
  { value: 'trang', label: 'Trang chính sách', title: 'Shipping / Refund / Terms / Privacy / Contact' },
  { value: 'ket_noi', label: 'Kết nối & xem trước', title: 'Stripe, thư, CJ, 17TRACK, GA4 — có/không; link xem trước' },
] as const;
type Muc = (typeof MUC)[number]['value'];
const phu: React.CSSProperties = { color: 'var(--fg-3)' };

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

export function CauHinhCuaHang({ c }: { c: CuaHangDong }) {
  const [muc, setMuc] = useState<Muc>((useSearchParams().get('cs') as Muc) || 'mat_tien');
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (muc !== 'mat_tien') u.set('cs', muc); else u.delete('cs');
    const qs = u.toString();
    window.history.replaceState(window.history.state, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [muc]);
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'grid', gap: 10 }}>
      <FilterChips urlKey="cs" value={muc} onChange={(v) => setMuc(v as Muc)} allValue="mat_tien" options={MUC.map((m) => ({ value: m.value, label: m.label, title: m.title }))} />
      {muc === 'mat_tien' && <MatTien c={c} />}
      {muc === 'giao' && <GiaoHang c={c} />}
      {muc === 'thu' && <ThuKhach c={c} />}
      {muc === 'tu_van' && <TuVan c={c} />}
      {muc === 'faq' && <FaqUuDai c={c} />}
      {muc === 'trang' && <TrangChinhSach c={c} />}
      {muc === 'ket_noi' && <KetNoi c={c} />}
    </div>
  );
}

/* ── Mặt tiền ── */
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Pill color={c.nenTang === 'mos' ? 'var(--ok)' : 'var(--warn)'} label={c.nenTang === 'mos' ? 'đang phục vụ' : 'xem trước'} />
      <LinkChip href={`https://${xemTruoc}`} tone="neutral" size="xs">{xemTruoc} ↗</LinkChip>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
      <TextField id={`mt-tren-${c.khoa}`} label="Dải đen trên cùng" value={v.thanh_tren} onChange={dat('thanh_tren')} />
      <TextField id={`mt-bac-${c.khoa}`} label="Mua nhiều giảm nhiều" hint='"2:10, 3:15" = 2 món giảm 10%, từ 3 món giảm 15%' value={v.bac_giam} onChange={dat('bac_giam')} />
      <TextAreaField id={`mt-sale-${c.khoa}`} label="Khối đỏ/cam giữa cột mua (2 dòng)" hint="Chỉ ưu đãi có thật" rows={2} value={v.dong_sale} onChange={dat('dong_sale')} />
      <TextAreaField id={`mt-ck-${c.khoa}`} label="Cam kết dưới nút mua (mỗi dòng một ô)" hint="Phải đúng chính sách ship/đổi trả" rows={3} value={v.cam_ket} onChange={dat('cam_ket')} />
      <DateTimeField id={`mt-het-${c.khoa}`} label="Đợt sale hết lúc" hint="Trống = ẩn đồng hồ đếm ngược. Chỉ đặt khi đợt giảm giá thật sự kết thúc lúc đó." value={v.sale_het} onChange={dat('sale_het')} />
      <TextField id={`mt-mau-${c.khoa}`} label="Màu nhấn (nút chọn)" hint="#4A90E2 như Crossian" value={v.mau_nhan} onChange={dat('mau_nhan')} />
      <TextField id={`mt-logo-${c.khoa}`} label="Logo (URL ảnh)" hint="Trống = dựng chữ tên shop" value={v.logo} onChange={dat('logo')} />
      <TextField id={`mt-email-${c.khoa}`} label="Email hỗ trợ" hint="Người gửi mọi thư khách + hộp nhận form liên hệ" value={v.email} onChange={dat('email')} />
      <TextField id={`mt-dc-${c.khoa}`} label="Địa chỉ chân trang" value={v.dia_chi} onChange={dat('dia_chi')} />
      <TextField id={`mt-ship-ten-${c.khoa}`} label="Tên dòng ship ở checkout" value={v.ship_ten} onChange={dat('ship_ten')} />
      <TextField id={`mt-ship-phi-${c.khoa}`} label="Phí ship (USD)" inputMode="decimal" value={v.ship_phi} onChange={dat('ship_phi')} />
      <TextField id={`mt-ship-mien-${c.khoa}`} label="Miễn ship từ (USD)" hint="Trống = không có ngưỡng" inputMode="decimal" value={v.ship_mien} onChange={dat('ship_mien')} />
      <TextField id={`mt-ga-${c.khoa}`} label="GA4" mono value={v.ga4} onChange={dat('ga4')} />
      <TextField id={`mt-px-${c.khoa}`} label="Meta Pixel ID" mono value={v.meta_pixel} onChange={dat('meta_pixel')} />
      <TextField id={`mt-gads-${c.khoa}`} label="Google Ads (AW-…)" mono value={v.gads} onChange={dat('gads')} />
    </div>
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
