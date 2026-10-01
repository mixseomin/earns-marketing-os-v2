// Chặn spam form công khai (review, liên hệ): mỗi IP tối đa n lần / cửa sổ. Bộ nhớ tiến trình là đủ cho một máy.
const lan = new Map<string, number[]>();
export function quaGioiHan(khoa: string, n = 5, ms = 3600_000): boolean {
  const bayGio = Date.now();
  const ds = (lan.get(khoa) ?? []).filter((t) => bayGio - t < ms);
  if (ds.length >= n) { lan.set(khoa, ds); return true; }
  ds.push(bayGio); lan.set(khoa, ds);
  return false;
}
export const ipCua = (req: Request) => req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'x';
