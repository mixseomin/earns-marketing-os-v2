// Phần THUẦN của mô hình lịch (worker/lich-may.mjs): không import gì → ô chỉnh lịch phía trình duyệt (components/chinh-lich.tsx) dùng chung.
export const MOI = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 720];
/** Lịch → chữ: { kieu: 'moi', phut } → "mỗi 5 phút" / "mỗi 2 giờ" · { kieu: 'luc', gio } → "03:30 hằng ngày". */
export const chuLich = (l) => (!l ? '' : l.kieu === 'luc' ? `${l.gio} hằng ngày` : l.phut === 1 ? 'mỗi 1 phút' : l.phut % 60 === 0 ? `mỗi ${l.phut / 60} giờ` : `mỗi ${l.phut} phút`);
/** Chữ lịch đang chạy (viec-may lichNguoi) → mô hình; dạng không đổi được (nhiều giờ, theo thứ, chạy liền) → null. */
export function tuChu(chu) {
  const s = String(chu).trim(); let m;
  if (s === 'mỗi phút' || s === '1 lần/phút') return { kieu: 'moi', phut: 1 };
  if ((m = s.match(/^mỗi (\d+) (phút|giờ)$/)) || (m = s.match(/^(\d+) (phút)\/lần$/))) return { kieu: 'moi', phut: Number(m[1]) * (m[2] === 'giờ' ? 60 : 1) };
  if (/^mỗi giờ/.test(s)) return { kieu: 'moi', phut: 60 };
  if ((m = s.match(/^(?:lúc )?(\d\d:\d\d)(?: hằng ngày)?$/))) return { kieu: 'luc', gio: m[1] };
  return null;
}
