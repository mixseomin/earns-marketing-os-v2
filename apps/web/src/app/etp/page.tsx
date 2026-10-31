// etp.on.tc (anh 24/10/2026: "hệ thống quản lý backend riêng tập trung chạy trên subdomain on.tc"): quản lý camp / creative / ROI từ kho `etp`.
// nginx etp.on.tc gác bằng SSO mos2 (auth_request → /api/auth/verify) rồi chuyển / → /etp; vào được: admin mos2 + người có tên trong etp.quyen.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { docEtp } from '@/lib/etp-doc';
import { catChoNguoi, docCheDo, hetPhienEthopex, ngCua, quyenEtp, suaNguoi } from '@/lib/etp-quyen';
import { EtpView } from '@/components/etp-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ETP · camp', robots: { index: false, follow: false } };

// ?t=<tab>&v=<kiểu xem> đọc NGAY trên máy chủ → lần vẽ đầu đã đúng tab (anh 25/10/2026: F5 ở ?t=camp&v=bang bị về Tổng quan —
// trước đây tab mặc định 'tong' rồi trình duyệt mới đọc URL, lượt ghi URL chạy với giá trị mặc định đè mất lựa chọn)
export default async function EtpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const me = await getCurrentUser();
  // đăng nhập lại thì quay về ĐÚNG chỗ đang xem (giữ ?t=…&v=…&l=…), không rơi về /etp trần
  if (!me) redirect(`/login?next=${encodeURIComponent(`/etp?${new URLSearchParams(Object.entries(q).filter(([, v]) => typeof v === 'string') as [string, string][]).toString()}`)}`);
  // QUYỀN (etp.quyen, anh 31/10/2026): chủ = admin mos2 · admin etp = xem hết + sửa camp của mình · người = chỉ phần của mình (dữ liệu cắt TRÊN MÁY CHỦ, không chỉ ẩn tab)
  const quyen = await quyenEtp(me);
  if (!quyen) redirect('/');
  const mot = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : undefined);
  const [du, het] = await Promise.all([docEtp(ngCua(quyen, mot('ng')), true), hetPhienEthopex(suaNguoi(quyen))]);
  const cheDo = du.nguoi.ngoai ? await docCheDo(quyen, du.nguoi.dang) : null;   // chế độ luật máy của người đang xem (etp.che_do_luat)
  return <EtpView chiXem={quyen.vai !== 'chu'} quyen={{ vai: quyen.vai, sua: suaNguoi(quyen), het, cheDo }} du={quyen.vai === 'nguoi' ? catChoNguoi(du, quyen.nguoiId!) : du} dauVao={{ t: mot('t'), v: mot('v'), l: mot('l'), p: mot('p'), lu: mot('lu'), d: mot('d'), b: mot('b'), ll: mot('ll'), tu: mot('tu'), ngan: mot('ngan') }} />;
}
