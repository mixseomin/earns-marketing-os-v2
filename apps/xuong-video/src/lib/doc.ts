// Phía trình duyệt của đường đọc song song (lib/doc-ham.ts · /api/xv/doc): cùng tên + cùng kiểu với hàm trong actions.ts, nhưng gọi bằng
// fetch thường nên nhiều lệnh đọc chạy CÙNG LÚC thay vì xếp hàng như server action. Import hàm đọc từ đây thay vì '@/lib/actions'.
import type { HamDoc } from './doc-ham';

async function goi<K extends keyof HamDoc>(ham: K, args: Parameters<HamDoc[K]>): Promise<Awaited<ReturnType<HamDoc[K]>>> {
  const r = await fetch('/api/xv/doc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ham, args }), cache: 'no-store' });
  const j = (await r.json().catch(() => ({ loi: `máy chủ trả ${r.status}` }))) as { kq?: unknown; loi?: string };
  if (!r.ok || j.loi) throw new Error(`${ham}: ${j.loi ?? r.status}`);
  return j.kq as Awaited<ReturnType<HamDoc[K]>>;
}
const tao = <K extends keyof HamDoc>(ham: K) => (...args: Parameters<HamDoc[K]>) => goi(ham, args);

export const tongQuanPhim = tao('tongQuanPhim');
export const dsPhimTemplate = tao('dsPhimTemplate');
export const dsNhomTuDo = tao('dsNhomTuDo');
export const dsSanPhamTong = tao('dsSanPhamTong');
export const dsPhim = tao('dsPhim');
export const docPhim = tao('docPhim');
export const dsMoHinh = tao('dsMoHinh');
export const dsCanh = tao('dsCanh');
export const dsThungRac = tao('dsThungRac');
export const phieuShotsTap = tao('phieuShotsTap');
export const baoCaoChuanBiAction = tao('baoCaoChuanBiAction');
export const docHoanTac = tao('docHoanTac');
export const uocTien = tao('uocTien');
export const uocAm = tao('uocAm');
export const kiemVideo = tao('kiemVideo');
