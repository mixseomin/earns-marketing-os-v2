'use client';
/** BIỂN PHANH CHỢ (anh 16/11/2026: "Khi ở ngày có cảnh báo thì có dấu hiệu nhìn rõ ràng cho cả team trên etp và etp2").
 * Đọc etp.cau_hinh.phanh_cho do apps/etp/gia_adsense.py xet_phanh ghi (sổ luật chung phanh_cho): đang phanh → dải đỏ trọn bề ngang đầu trang,
 * 13h–20h VN mới là cảnh báo sớm → dải vàng. Tệp này có HAI bản giống hệt (apps/web + apps/etp2) — apps/etp2/kiem-gop-y.mjs chặn khi lệch. */
import BANG_LUAT from '@/lib/etp-bang-luat.json';

type TrangThai = {
  hom_nay?: { ngay: string; irpm: number | null; nen: number | null; ti: number | null } | null;
  som?: boolean;
  phanh?: { ngay: string; nguon: 'so' | 'lich'; ti: number | null; den_tang: string; den_len: string; ly_do: string } | null;
  /** ba nấc cảnh báo sớm (anh 17/11/2026, gia_adsense.xet_som) */
  gia6?: { ti: number; den: string } | null;
  /** tỉ lệ giá chợ 6 giờ trọn gần nhất so nền 7 ngày, cập nhật mỗi lượt đồng bộ (null = thiếu số) */
  gia6_nay?: number | null;
  roi_sang?: { ngay: string; roi: number; kem: number; den: string } | null;
  rut?: { ngay: string; gia: number; roi: number; den: string } | null;
};
const PC = BANG_LUAT.phanh_cho;
const p2 = (n: number) => String(n).padStart(2, '0');
/** mốc ISO (UTC) → "07:00 17/11" giờ VN */
const gioVn = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3600_000); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`; };
const KHUNG = { margin: '0 0 8px', padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;   // MỘT dòng (anh 16/11/2026 "Hiện gọn hơn") — chi tiết ở chữ rê

/** phanh đang chạy → câu cảnh báo cho bước xác nhận thao tác tay (tang = tăng ngân sách, len = tạo camp / nhân bản); null = không phanh việc đó.
 *  Thao tác tay KHÔNG bị chặn (anh 16/11/2026) — chỉ cảnh báo một lần ở bước xác nhận. */
export function canhBaoPhanh(cauHinh: { khoa: string; gia_tri: unknown }[]): { tang: string | null; len: string | null } {
  const ph = ((cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null)?.phanh, nay = Date.now();
  const tt0 = (cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null;
  const som = tt0?.gia6 && Date.parse(tt0.gia6.den) > nay ? `⛔ Đang phanh chợ (giá chợ 6 giờ ${Math.round(tt0.gia6.ti * 100)}% nền)` : tt0?.roi_sang && Date.parse(tt0.roi_sang.den) > nay ? `⛔ Đang phanh mở rộng (ROI sáng kém nền ${Math.abs(Math.round(tt0.roi_sang.kem))} điểm)` : null;
  if (som && !ph) return { tang: `${som}. Bấm Làm là vẫn tăng.`, len: `${som}. Bấm Làm là vẫn tạo.` };
  if (!ph) return { tang: null, len: null };
  const dau = `⛔ Đang phanh chợ${ph.ti != null ? ` (giá chợ ${Math.round(ph.ti * 100)}% nền)` : ''}`;
  return { tang: Date.parse(ph.den_tang) > nay ? `${dau} — máy dừng tăng tới ${gioVn(ph.den_tang)}. Bấm Làm là vẫn tăng.` : null,
           len: Date.parse(ph.den_len) > nay ? `${dau} — máy dừng camp mới tới ${gioVn(ph.den_len)}. Bấm Làm là vẫn tạo.` : null };
}

/** MỘT DẢI MỘT DÒNG cho mọi trạng thái (anh 17/11/2026 chụp ba dải chồng nhau: "đéo ai làm thế này"): chỉ hiện trạng thái NẶNG NHẤT đang bật
 *  (rút › phanh giá 6 giờ › phanh ROI sáng › phanh chốt 20h › cảnh báo sớm), bảo trì Ethopex ghép vào cùng dòng; các trạng thái còn lại nằm ở chữ rê. */
export function BienPhanhCho({ cauHinh }: { cauHinh: { khoa: string; gia_tri: unknown }[] }) {
  const tt = (cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null, nay = Date.now();
  const bt = (cauHinh.find((c) => c.khoa === 'bao_tri_len')?.gia_tri ?? null) as { bat?: boolean; tu?: string } | null;
  const con = <T extends { den: string }>(x: T | null | undefined) => (x && Date.parse(x.den) > nay ? x : null);
  const rut = con(tt?.rut), g6 = con(tt?.gia6), rs = con(tt?.roi_sang), ph = tt?.phanh && Date.parse(tt.phanh.den_len) > nay ? tt.phanh : null, h = tt?.hom_nay;
  const ds: { chu: string; nen: string; mau: string }[] = [];   // nặng → nhẹ
  if (rut) ds.push({ chu: `🚨 RÚT KHỎI CHỢ · giá sáng ${Math.round(rut.gia * 100)}% nền, ROI sáng ${Math.round(rut.roi)}% · máy tắt camp thường đang âm tới ${gioVn(rut.den)}`, nen: '#7f1d1d', mau: '#fff' });
  if (g6) ds.push({ chu: `⛔ PHANH CHỢ · giá chợ ${Math.round(g6.ti * 100)}% nền · dừng tăng + camp mới tới khi giá về ≥ ${Math.round(PC.truot.nguong * 100)}%`, nen: '#d93025', mau: '#fff' });
  if (rs) ds.push({ chu: `⛔ PHANH MỞ RỘNG · ROI sáng kém nền ${Math.abs(Math.round(rs.kem))} điểm · dừng tăng + camp mới tới ${gioVn(rs.den)}`, nen: '#d93025', mau: '#fff' });
  if (ph) ds.push({ chu: `⛔ PHANH CHỢ${ph.ti != null ? ` · giá chợ ${Math.round(ph.ti * 100)}% nền` : ' · lịch'} · ${Date.parse(ph.den_tang) > nay ? `tăng dừng tới ${gioVn(ph.den_tang)}` : 'tăng đã mở'} · camp mới dừng tới ${gioVn(ph.den_len)}`, nen: '#d93025', mau: '#fff' });
  if (tt?.som && h?.ti != null) ds.push({ chu: `⚠ Giá chợ ${Math.round(h.ti * 100)}% nền · ${PC.gio_chot}:00 có thể phanh`, nen: '#f59e0b', mau: '#1a1a1a' });
  if (bt?.bat) ds.push({ chu: `🛠 Ethopex bảo trì lên camp${bt.tu ? ` từ ${bt.tu}` : ''} · máy dừng tạo camp`, nen: '#7c3aed', mau: '#fff' });
  const dau = ds[0]; if (!dau) return null;
  return <div role="alert" data-bien="phanh-cho" title={ds.map((x) => x.chu).join('\n')} style={{ ...KHUNG, background: dau.nen, color: dau.mau }}>
    {dau.chu}{ds.length > 1 ? ` · +${ds.length - 1}` : ''}
  </div>;
}


/** NHIỆT KẾ GIÁ CHỢ (anh 17/11/2026: "Thêm 1 cái badge giống biểu đồ nhiệt kế show giá của chợ so với nền hiển thị sticky + ở nhiều nơi"):
 *  Impression RPM cả chợ 6 giờ trọn gần nhất so trung bình cùng khung 7 ngày trước (etp.cau_hinh.phanh_cho.gia6_nay, 10 phút cập nhật một lần).
 *  Bầu + ống: đỏ dưới mốc rút, vàng dưới mốc phanh, xanh từ mốc phanh trở lên; vạch trắng = mốc phanh. dinh = dính góc dưới phải màn, cuộn / đổi tab vẫn thấy. */
export function NhietKeCho({ cauHinh, dinh }: { cauHinh: { khoa: string; gia_tri: unknown }[]; dinh?: boolean }) {
  const tt = (cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null;
  const ti = tt?.gia6_nay ?? tt?.hom_nay?.ti ?? null;
  if (ti == null) return null;
  const pt = Math.round(ti * 100), phanh = Math.round(PC.truot.nguong * 100), rut = Math.round(PC.rut.gia * 100), TRAN = 130;
  const mau = pt < rut ? '#ef4444' : pt < phanh ? '#f59e0b' : '#22c55e';
  return <span data-nhiet-ke={dinh ? 'dinh' : 'dong'} title={`Giá quảng cáo cả chợ ${PC.truot.gio} giờ gần nhất = ${pt}% mức thường (trung bình cùng khung 7 ngày trước). Dưới ${phanh}%: máy phanh mở rộng · dưới ${rut}% kèm ROI sáng âm: máy rút. Cập nhật 10 phút một lần.`}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px 2px 6px', borderRadius: 999, border: `1px solid ${mau}`, background: 'var(--bg-1, #0b0d12)', color: 'var(--fg, #e5e7eb)', fontSize: 12, lineHeight: 1.4, whiteSpace: 'nowrap', alignSelf: 'center',
      ...(dinh ? { position: 'fixed' as const, right: 12, bottom: 12, zIndex: 70, boxShadow: '0 2px 10px #0009' } : {}) }}>
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: mau, marginRight: -2, zIndex: 1 }} />
      <span style={{ position: 'relative', width: 58, height: 5, borderRadius: '0 3px 3px 0', background: 'var(--line, #333)', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(pt, TRAN) / TRAN * 100}%`, background: mau }} />
        <span style={{ position: 'absolute', left: `${phanh / TRAN * 100}%`, top: 0, bottom: 0, width: 1.5, background: '#fff' }} />
      </span>
    </span>
    <span style={{ color: 'var(--fg-2, #9ca3af)' }}>Giá chợ</span><b style={{ color: mau }}>{pt}%</b>
  </span>;
}
