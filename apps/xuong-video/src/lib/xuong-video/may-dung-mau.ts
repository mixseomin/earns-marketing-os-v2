// SỔ MẪU MÁY DỰNG (thể loại 'may_dung' trong danh sách Phim — anh 16/10/2026: "Máy Dựng") — MỘT chỗ khai. Thuần (màn client + máy chủ cùng đọc).
// Thêm thể loại video mới (đố chữ khác, trích dẫn, top 5…) = thêm một mẫu ở đây + bộ vẽ / kịch bản của nó (vd may-dung-do-chu.ts);
// phim, tập, shot, xuất, danh sách (may-dung.ts, xuat-tap.ts, trang.tsx) không phải đổi.
export const MAU_MAY_DUNG = { 'do-chu-mot-dung': { ten: 'Đố chữ · Only ONE is spelled right' } } as const;
export type MauMayDung = keyof typeof MAU_MAY_DUNG;
