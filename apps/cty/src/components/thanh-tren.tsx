'use client';
// Thanh trên (#1290 "không nhìn ra nút nào với nút nào"): mỗi mục là MỘT ô bấm (đệm, nền khi rê), mục đang đứng có nền + màu nhấn,
// các mục cách nhau bằng khoảng trống thay vì chữ trơn nối liền. Client vì cần biết trang đang đứng.
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MUC: [string, string][] = [['/', 'Sơ đồ'], ['/luat', 'Luật chung'], ['/muc-tieu', 'Mục tiêu · ngân sách'], ['/nhan-su', 'Đội ngũ'], ['/quy-trinh', 'Quy trình'], ['/nhat-ky', 'Nhật ký']];

export function ThanhTren() {
  const p = usePathname() ?? '/';
  const dang = (h: string) => (h === '/' ? p === '/' : p === h || p.startsWith(`${h}/`));
  return (
    <nav className="cty-dh" aria-label="Mục chính">
      {MUC.map(([h, t]) => <Link key={h} href={h} className="cty-dh-muc" aria-current={dang(h) ? 'page' : undefined}>{t}</Link>)}
      <a href="/vp/cong-ty/" className="cty-dh-muc">Văn phòng pixel ↗</a>
    </nav>
  );
}
