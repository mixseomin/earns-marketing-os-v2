'use client';
/** BIỂN PHANH CHỢ (anh 16/11/2026: "Khi ở ngày có cảnh báo thì có dấu hiệu nhìn rõ ràng cho cả team trên etp và etp2").
 * Đọc etp.cau_hinh.phanh_cho do apps/etp/gia_adsense.py xet_phanh ghi (sổ luật chung phanh_cho): đang phanh → dải đỏ trọn bề ngang đầu trang,
 * 13h–20h VN mới là cảnh báo sớm → dải vàng. Tệp này có HAI bản giống hệt (apps/web + apps/etp2) — apps/etp2/kiem-gop-y.mjs chặn khi lệch. */
import BANG_LUAT from '@/lib/etp-bang-luat.json';

type TrangThai = {
  hom_nay?: { ngay: string; irpm: number | null; nen: number | null; ti: number | null } | null;
  som?: boolean;
  phanh?: { ngay: string; nguon: 'so' | 'lich'; ti: number | null; den_tang: string; den_len: string; ly_do: string } | null;
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
  if (!ph) return { tang: null, len: null };
  const dau = `⛔ Đang phanh chợ${ph.ti != null ? ` (giá chợ ${Math.round(ph.ti * 100)}% nền)` : ''}`;
  return { tang: Date.parse(ph.den_tang) > nay ? `${dau} — máy dừng tăng tới ${gioVn(ph.den_tang)}. Bấm Làm là vẫn tăng.` : null,
           len: Date.parse(ph.den_len) > nay ? `${dau} — máy dừng camp mới tới ${gioVn(ph.den_len)}. Bấm Làm là vẫn tạo.` : null };
}

export function BienPhanhCho({ cauHinh }: { cauHinh: { khoa: string; gia_tri: unknown }[] }) {
  const tt = (cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null;
  if (!tt) return null;
  const nay = Date.now(), ph = tt.phanh && Date.parse(tt.phanh.den_len) > nay ? tt.phanh : null;
  if (ph) {
    const conTang = Date.parse(ph.den_tang) > nay;
    return <div role="alert" data-bien="phanh-cho" title={`${ph.ly_do}. Giảm / tắt vẫn chạy. Không chặn: camp ★ ROAS, camp thay bài bị từ chối, lệnh anh.`} style={{ ...KHUNG, background: '#d93025', color: '#fff' }}>
      ⛔ PHANH CHỢ{ph.ti != null ? ` · giá chợ ${Math.round(ph.ti * 100)}% nền` : ' · lịch'} · {conTang ? `tăng dừng tới ${gioVn(ph.den_tang)}` : 'tăng đã mở'} · camp mới dừng tới {gioVn(ph.den_len)}
    </div>;
  }
  const h = tt.hom_nay;
  if (tt.som && h?.ti != null && h.irpm != null && h.nen != null)
    return <div role="alert" data-bien="phanh-cho-som" title={`Impression RPM cả chợ 07–13h hôm nay ${Math.round(h.irpm)}, trung bình 7 ngày ${Math.round(h.nen)}. Tới ${PC.gio_chot}:00 vẫn dưới ${Math.round(PC.nguong * 100)}% thì đêm nay không tăng bậc, ngày mai không lên camp mới / nhân bản.`} style={{ ...KHUNG, background: '#f59e0b', color: '#1a1a1a' }}>
      ⚠ Giá chợ {Math.round(h.ti * 100)}% nền · {PC.gio_chot}:00 có thể phanh
    </div>;
  return null;
}
