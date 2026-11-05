// CAMP CHẠY / CHỜ GIỜ / ĐANG TẠO — MỘT định nghĩa cho mọi màn etp (Camp, Sản xuất / dòng phim), anh 06/11/2026 "Sao camp AT lại chạy luôn? Phải lên theo lịch chứ?":
// Ethopex để camp hẹn giờ ở ACTIVE ngay từ lúc tạo — trang lấy ACTIVE là "chạy" thì camp hẹn 07:00 hiện như đang chạy từ 23:00 tối trước.
type CampTt = { trang_thai: string | null; lich: string | null; dong_bo?: string | null };   // dong_bo có thể thiếu (CampEtpKho để optional) — dangTao coi thiếu = đã xong
/** camp Ethopex còn đang tạo / kiểm ad (dong_bo ≠ done · synced · error): PAUSED tới khi kiểm xong, không phải đã tắt */
export const dangTao = (c: Pick<CampTt, 'dong_bo'>) => !!c.dong_bo && !['done', 'synced', 'error'].includes(c.dong_bo);
/** đã tạo, hẹn chạy lúc c.lich (lịch lên camp nhan-ban.lich_len) */
// giờ "bây giờ" đi qua ĐỐI TƯỢNG { now } (chỉ bài tự kiểm cần) — tham số số đứng thứ hai bị Array.filter / map truyền SỐ THỨ TỰ vào (06/11/2026: du.camps.filter(choGio)
// coi now = 0, 1, 2… → mọi camp có giờ hẹn thành 'chờ giờ', trang báo 0 camp đang chạy trong khi kho có 178)
type Luc = { now?: number } | number;   // số (số thứ tự từ filter / map) bị bỏ qua
const gio = (o: Luc) => (typeof o === 'object' ? o.now ?? Date.now() : Date.now());
export const choGio = (c: CampTt, o: Luc = {}) => { const now = gio(o); return !!c.lich && Date.parse(c.lich) > now && (c.trang_thai === 'ACTIVE' || dangTao(c)); };
/** đang chạy thật = ACTIVE và đã tới giờ chạy */
export const dangChay = (c: CampTt, o: Luc = {}) => c.trang_thai === 'ACTIVE' && !choGio(c, { now: gio(o) });
/** "hẹn 07:00" (trong 24 giờ tới) / "hẹn 07:00 08/11" cho camp chờ giờ */
export const chuHen = (lich: string, o: Luc = {}) => { const now = gio(o); const t = Date.parse(lich), d = new Date(t + 7 * 3600_000); const p = (n: number) => String(n).padStart(2, '0');
  return `hẹn ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}${t - now < 86_400_000 ? '' : ` ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`}`; };   // trong 24 giờ tới chỉ ghi giờ (ô hẹp)
