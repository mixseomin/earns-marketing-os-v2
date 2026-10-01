// Số người ĐANG xem một sản phẩm — đếm thật: mỗi tab mở trang gửi nhịp 45 giây/lần, tính phiên có nhịp trong 2 phút gần nhất.
// Giữ trong bộ nhớ tiến trình (mất khi khởi động lại = đếm lại từ 0, đúng nghĩa "đang xem").
const bang = new Map<number, Map<string, number>>();

export function nhipXem(spId: number, phien: string): number {
  const m = bang.get(spId) ?? new Map<string, number>();
  const bayGio = Date.now();
  m.set(phien.slice(0, 40), bayGio);
  for (const [k, ts] of m) if (bayGio - ts > 120_000) m.delete(k);
  bang.set(spId, m);
  return m.size;
}
