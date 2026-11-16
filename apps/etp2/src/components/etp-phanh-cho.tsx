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
const KHUNG = { margin: '0 0 10px', padding: '8px 12px', borderRadius: 8, fontSize: 13, lineHeight: 1.5 } as const;

export function BienPhanhCho({ cauHinh }: { cauHinh: { khoa: string; gia_tri: unknown }[] }) {
  const tt = (cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null;
  if (!tt) return null;
  const nay = Date.now(), ph = tt.phanh && Date.parse(tt.phanh.den_len) > nay ? tt.phanh : null;
  if (ph) {
    const conTang = Date.parse(ph.den_tang) > nay;
    return <div role="alert" data-bien="phanh-cho" style={{ ...KHUNG, background: '#d93025', color: '#fff' }}>
      <b style={{ fontSize: 15 }}>⛔ PHANH CHỢ</b> — {ph.ly_do}.
      <div><b>Tăng bậc:</b> {conTang ? `dừng tới ${gioVn(ph.den_tang)}` : `đã mở lại từ ${gioVn(ph.den_tang)}`} · <b>Camp mới / nhân bản:</b> dừng tới {gioVn(ph.den_len)} (giờ VN, camp tài khoản nhà).</div>
      <div style={{ opacity: 0.9 }}>Giảm / tắt vẫn chạy như thường. Không bị chặn: camp ★ ROAS, camp thay bài bị từ chối, lệnh anh.</div>
    </div>;
  }
  const h = tt.hom_nay;
  if (tt.som && h?.ti != null && h.irpm != null && h.nen != null)
    return <div role="alert" data-bien="phanh-cho-som" style={{ ...KHUNG, background: '#f59e0b', color: '#1a1a1a' }}>
      <b style={{ fontSize: 15 }}>⚠ CẢNH BÁO SỚM GIÁ CHỢ</b> — Impression RPM cả chợ 07–13h hôm nay {Math.round(h.irpm)}, bằng {Math.round(h.ti * 100)}% trung bình 7 ngày trước ({Math.round(h.nen)}).
      <div>Tới {PC.gio_chot}:00 vẫn dưới {Math.round(PC.nguong * 100)}% thì máy phanh: đêm nay không tăng bậc, ngày mai không lên camp mới / nhân bản.</div>
    </div>;
  return null;
}
