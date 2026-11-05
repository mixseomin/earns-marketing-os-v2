// CAMP CHẠY / CHỜ GIỜ / ĐANG TẠO — MỘT định nghĩa cho mọi màn etp (Camp, Sản xuất / dòng phim), anh 06/11/2026 "Sao camp AT lại chạy luôn? Phải lên theo lịch chứ?":
// Ethopex để camp hẹn giờ ở ACTIVE ngay từ lúc tạo — trang lấy ACTIVE là "chạy" thì camp hẹn 07:00 hiện như đang chạy từ 23:00 tối trước.
type CampTt = { trang_thai: string | null; lich: string | null; dong_bo: string | null };
/** camp Ethopex còn đang tạo / kiểm ad (dong_bo ≠ done · synced · error): PAUSED tới khi kiểm xong, không phải đã tắt */
export const dangTao = (c: Pick<CampTt, 'dong_bo'>) => !!c.dong_bo && !['done', 'synced', 'error'].includes(c.dong_bo);
/** đã tạo, hẹn chạy lúc c.lich (lịch lên camp nhan-ban.lich_len) */
export const choGio = (c: CampTt, now = Date.now()) => !!c.lich && Date.parse(c.lich) > now && (c.trang_thai === 'ACTIVE' || dangTao(c));
/** đang chạy thật = ACTIVE và đã tới giờ chạy */
export const dangChay = (c: CampTt, now = Date.now()) => c.trang_thai === 'ACTIVE' && !choGio(c, now);
/** "hẹn 07:00" (trong 24 giờ tới) / "hẹn 07:00 08/11" cho camp chờ giờ */
export const chuHen = (lich: string, now = Date.now()) => { const t = Date.parse(lich), d = new Date(t + 7 * 3600_000); const p = (n: number) => String(n).padStart(2, '0');
  return `hẹn ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}${t - now < 86_400_000 ? '' : ` ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`}`; };   // trong 24 giờ tới chỉ ghi giờ (ô hẹp)
