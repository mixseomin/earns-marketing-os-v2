// Đổi tốc THẬT (12/10/2026): nhóm "Tốc độ" của shot (ky_thuat.toc_do, dien-anh.ts) → bản xuất dựng lại thời gian của clip bằng setpts
// từng đoạn (Veo làm "speed ramp" theo lời nhắc rất thất thường; ffmpeg làm chính xác). Thuần — MỘT kế hoạch cho bản xuất (setpts) và
// timeline xem trước (playbackRate + currentTime). Ảnh tĩnh không đổi tốc.
// Tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/toc-do.test.mts
/** Đoạn theo PHẦN của giây phát: [phần, tốc]. Đoạn cuối kéo dài thêm phần đuôi mượn cho chuyển cảnh. */
export const DOAN_TOC: Record<string, [number, number][]> = {
  cham: [[1, 0.5]],
  rat_cham: [[1, 0.3]],
  nhanh: [[1, 1.6]],
  ramp: [[0.3, 1.5], [0.4, 0.3], [0.3, 1.6]],      // nhanh → chậm hẳn ở đỉnh → vọt lại
  ramp_treo: [[0.55, 1.4], [0.45, 0.32]],          // nhanh rồi treo chậm tới điểm cắt (trước cắt sốc)
  ramp_bung: [[0.45, 0.32], [0.55, 1.5]],          // mở bằng chậm hẳn rồi bung tốc
};
export type DoanToc = { tuRa: number; denRa: number; tuVao: number; denVao: number; toc: number };
export type KeHoachToc = { doan: DoanToc[]; canVao: number };
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** phat = giây phát, dai = phat + đuôi chuyển cảnh, conLai = giây clip nguồn còn dùng được (sau phần bỏ đầu).
 *  Nguồn không đủ cho mọi tốc → giảm đều mọi tốc theo cùng tỉ lệ (giữ hình dạng nhanh/chậm). Kiểu lạ → null (tốc thường). */
export function keHoachToc(kieu: string | undefined, phat: number, dai: number, conLai: number): KeHoachToc | null {
  const mau = kieu ? DOAN_TOC[kieu] : undefined;
  if (!mau || phat <= 0) return null;
  const lenRa = mau.map(([p], i) => (i === mau.length - 1 ? dai - mau.slice(0, -1).reduce((a, [q]) => a + q * phat, 0) : p * phat));
  const can = lenRa.reduce((a, l, i) => a + l * mau[i]![1], 0);
  const k = can > conLai && conLai > 0 ? conLai / can : 1;
  const doan: DoanToc[] = []; let ra = 0, vao = 0;
  lenRa.forEach((l, i) => { const toc = mau[i]![1] * k; doan.push({ tuRa: r3(ra), denRa: r3(ra + l), tuVao: r3(vao), denVao: r3(vao + l * toc), toc: r3(toc) }); ra += l; vao += l * toc; });
  return { doan, canVao: r3(vao) };
}
/** Biểu thức setpts (giây ra theo giây vào T của clip đã trim, PTS bắt đầu 0) — ffmpeg: setpts='(<bt>)/TB' (để trong nháy đơn, dấu phẩy không phải thoát). */
export function bieuThucToc(kh: KeHoachToc): string {
  const d = kh.doan;
  let bt = `${d[d.length - 1]!.tuRa}+(T-${d[d.length - 1]!.tuVao})/${d[d.length - 1]!.toc}`;
  for (let i = d.length - 2; i >= 0; i--) bt = `if(lt(T,${d[i]!.denVao}),${d[i]!.tuRa}+(T-${d[i]!.tuVao})/${d[i]!.toc},${bt})`;
  return bt;
}
/** Xem trước: giây nguồn ứng với giây ra t, và tốc đang chạy. */
export function nguonTai(kh: KeHoachToc, t: number): { vao: number; toc: number } {
  const x = kh.doan.find((d) => t < d.denRa) ?? kh.doan[kh.doan.length - 1]!;
  return { vao: x.tuVao + (Math.min(t, x.denRa) - x.tuRa) * x.toc, toc: x.toc };
}
