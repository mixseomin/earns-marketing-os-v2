'use client';
// Drawer đơn /shop — các khối theo bố cục trang đơn Shopdy (anh so 02/10/2026), cộng phần mos2 có hơn (vốn, lãi, tiền về tới đâu):
//   MonDon  — món: ảnh, biến thể, SKU, đơn giá (gạch giá gốc), × số lượng, thành tiền, mã NCC
//   TienDon — tiền khách: tạm tính · giảm · ship · tổng · hoàn; rồi phần của mình: vốn NCC · ship NCC · phí cổng · lãi ước
//   KhachDon — khách (liên hệ, địa chỉ + bản đồ, đơn thứ mấy) · hành trình mua (số phiên, phiên đầu từ đâu, mất bao lâu) · thiết bị · nguồn traffic · rủi ro
// Dữ liệu: lib/shop/doc.ts docChiTietDon (sổ phiên mặt tiền shop_phien; không lưu IP — so nước theo IP với nước giao).
import { gio, tien } from '@/lib/shop/buoc';
import type { ChiTietDon, DonDong } from '@/lib/shop/doc';
import { ruiRoDon } from '@/lib/shop/tt-don-luat';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const tieuDe: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-3)', margin: '0 0 6px' };
const khoi: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 8, padding: 12, display: 'grid', gap: 6 };
const dongKV = (k: string, v: React.ReactNode) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '108px 1fr', gap: 8, fontSize: 13 }}><span style={phu}>{k}</span><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{v ?? '—'}</span></div>;
const thoiGian = (s: number | null) => (s == null ? null : s < 60 ? `${s} giây` : s < 3600 ? `${Math.floor(s / 60)} phút ${s % 60} giây` : s < 86400 ? `${Math.floor(s / 3600)} giờ ${Math.floor((s % 3600) / 60)} phút` : `${Math.floor(s / 86400)} ngày ${Math.floor((s % 86400) / 3600)} giờ`);

export function MonDon({ mon }: { mon: ChiTietDon['mon'] }) {
  return (
    <div style={khoi}>
      <h4 style={tieuDe}>Món · {mon.reduce((s, m) => s + m.sl, 0)}</h4>
      {mon.map((m, i) => {
        const donGia = m.sl ? m.gia / m.sl : m.gia;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', paddingTop: i ? 8 : 0, borderTop: i ? '1px solid var(--line)' : undefined }}>
            {m.anh ? <img src={m.anh} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} /> : <span style={{ width: 48, height: 48, borderRadius: 6, background: 'var(--bg-2)' }} />}
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{m.ten.split(' / ')[0]}</span>
              <span style={{ fontSize: 12.5, ...phu }}>{m.tuyChon ?? m.ten.split(' / ').slice(1).join(' / ')}{m.sku ? ` · SKU ${m.sku}` : ''}</span>
              <span style={{ fontSize: 12, ...phu }}>{m.maNcc ? 'có nguồn NCC' : <span style={{ color: 'var(--bad)' }}>chưa có nguồn NCC</span>}{m.giaVon != null ? ` · vốn ${tien(m.giaVon * m.sl)}` : ''}</span>
            </div>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
              <div>{tien(donGia)}{m.giaGoc && m.giaGoc > donGia + 0.009 && <span style={{ ...phu, textDecoration: 'line-through', marginLeft: 6 }}>{tien(m.giaGoc)}</span>} × {m.sl}</div>
              <b>{tien(m.gia)}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TienDon({ ct, d }: { ct: ChiTietDon; d: DonDong }) {
  const t = ct.tien;
  const dong = (k: string, v: React.ReactNode, dam = false) => (
    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: dam ? 600 : undefined }}><span style={dam ? undefined : phu}>{k}</span><span>{v}</span></div>);
  return (
    <div style={khoi}>
      <h4 style={tieuDe}>Tiền</h4>
      {t ? <>{dong('Tạm tính', tien(t.tamTinh))}{t.giam > 0 && dong('Giảm giá', `− ${tien(t.giam)}`)}{dong('Ship khách trả', tien(t.ship))}{dong('Tổng khách trả', tien(t.tong), true)}</>
        : dong('Tổng khách trả', tien(d.tong), true)}
      {d.hoan > 0 && dong('Đã hoàn', `− ${tien(d.hoan)}`)}
      <div style={{ borderTop: '1px dashed var(--line)', margin: '4px 0' }} />
      {dong('Vốn NCC', `− ${tien(d.giaVon)}`)}{dong('Ship NCC', `− ${tien(d.shipNcc)}`)}{dong('Phí cổng', `− ${tien(d.phiCong)}`)}
      {dong('Lãi ước', <span style={{ color: d.lai == null ? undefined : d.lai >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{tien(d.lai)}</span>, true)}
    </div>
  );
}

export function KhachDon({ ct, d }: { ct: ChiTietDon; d: DonDong }) {
  const dc = ct.diaChi, p = ct.phien, dt = p?.dat ?? null;
  const diaChi = [dc.dong1, dc.dong2, [dc.thanh_pho, dc.bang, dc.zip].filter(Boolean).join(', '), dc.nuoc].filter(Boolean);
  const rr = ruiRoDon(d.tt, dt?.nuoc ?? null, dc.nuoc ?? null);
  const MUC_RR = { thap: ['Thấp', 'var(--ok)'], vua: ['Vừa', 'var(--warn)'], cao: ['Cao', 'var(--bad)'] } as const;
  const utm = dt?.utm ?? {};
  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      <div style={khoi}>
        <h4 style={tieuDe}>Khách</h4>
        <b style={{ fontSize: 14 }}>{d.khach || '—'}</b>
        <span style={{ fontSize: 13 }}>{d.email || '—'}{ct.sdt ? ` · ${ct.sdt}` : <span style={phu}> · không có số điện thoại</span>}</span>
        <span style={{ fontSize: 13, lineHeight: 1.5 }}>{dc.ten && dc.ten !== d.khach ? <>{dc.ten}<br /></> : null}{diaChi.map((x, i) => <span key={i}>{x}<br /></span>)}</span>
        {diaChi.length > 0 && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(diaChi.join(', '))}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>Xem bản đồ ↗</a>}
        <span style={{ fontSize: 12.5, ...phu }}>{ct.khachSo.tong ? `Đơn thứ ${ct.khachSo.thuTu} của khách · ${ct.khachSo.tong} đơn tất cả${ct.khachSo.tong > 1 && ct.khachSo.dauLuc ? ` · đơn đầu ${gio(ct.khachSo.dauLuc)}` : ''}` : 'Đơn đầu tiên của khách'}</span>
      </div>
      <div style={khoi}>
        <h4 style={tieuDe}>Hành trình mua</h4>
        {p ? <>
          {dongKV('Số phiên', `${p.soPhien} phiên${p.tuLuc ? ` · từ ${gio(p.tuLuc)}` : ''}`)}
          {dongKV('Phiên đầu', p.dau ? `${p.dau.nguon ?? 'direct'} → ${p.dau.trang ?? '—'}` : null)}
          {dongKV('Trước khi mua', thoiGian(p.truocKhiMua) ? `${thoiGian(p.truocKhiMua)} trong phiên đặt đơn${p.soPhien > 1 ? ` · ${thoiGian(p.tuPhienDau)} từ phiên đầu` : ''}` : null)}
          {dongKV('Trang đã xem', dt ? `${dt.soTrang} trang trong phiên đặt đơn` : null)}
        </> : <span style={{ fontSize: 12.5, ...phu }}>Không có phiên mặt tiền gắn với đơn này (đơn Woo cũ, đơn demo, hoặc khách chặn theo dõi).</span>}
      </div>
      {dt && <div style={khoi}>
        <h4 style={tieuDe}>Thiết bị</h4>
        {dongKV('Máy', [dt.thietBi, dt.heDieuHanh, dt.trinhDuyet].filter(Boolean).join(' · ') || null)}
        {dongKV('Vị trí theo IP', [dt.thanhPho, dt.nuoc].filter(Boolean).join(', ') || null)}
        {dongKV('Múi giờ', dt.muiGio)}{dongKV('Ngôn ngữ', dt.ngonNgu)}{dongKV('Màn hình', dt.manHinh)}
        <span style={{ fontSize: 11.5, ...phu }}>Không lưu địa chỉ IP — chỉ nước/thành phố theo IP để so với nơi giao.</span>
      </div>}
      {dt && <div style={khoi}>
        <h4 style={tieuDe}>Nguồn traffic</h4>
        {dongKV('Nguồn', dt.nguon ?? 'direct')}
        {dongKV('Kênh', utm.medium ?? utm.utm_medium ?? null)}
        {dongKV('Chiến dịch', utm.campaign ?? utm.utm_campaign ?? null)}
        {dongKV('Quảng cáo / nội dung', utm.content ?? utm.utm_content ?? utm.term ?? null)}
        {dongKV('Trang đích', dt.trangDau)}
      </div>}
      <div style={khoi}>
        <h4 style={tieuDe}>Rủi ro đơn</h4>
        {rr.muc ? <>
          <div style={{ display: 'flex', gap: 4 }}>{(['thap', 'vua', 'cao'] as const).map((m) => <span key={m} style={{ flex: 1, textAlign: 'center', fontSize: 12, padding: '3px 0', borderRadius: 4,
            background: rr.muc === m ? MUC_RR[m][1] : 'var(--bg-2)', color: rr.muc === m ? 'var(--bg)' : 'var(--fg-3)', fontWeight: rr.muc === m ? 600 : undefined }}>{MUC_RR[m][0]}</span>)}</div>
          {rr.ly_do.map((x, i) => <span key={i} style={{ fontSize: 12.5, ...phu }}>{x}</span>)}
          {d.tt?.rui_ro?.ghi && <span style={{ fontSize: 12.5, ...phu }}>Cổng ghi: {d.tt.rui_ro.ghi}</span>}
        </> : <span style={{ fontSize: 12.5, ...phu }}>Chưa có dữ liệu để chấm — cần lần đọc cổng thanh toán của đơn (máy đọc theo nhịp).</span>}
      </div>
    </div>
  );
}
