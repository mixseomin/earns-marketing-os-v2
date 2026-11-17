'use client';
// Thanh trên (#1290 "không nhìn ra nút nào với nút nào"): mỗi mục là MỘT ô bấm (đệm, nền khi rê), mục đang đứng có nền + màu nhấn,
// các mục cách nhau bằng khoảng trống thay vì chữ trơn nối liền. Client vì cần biết trang đang đứng.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const MUC: [string, string][] = [['/', 'Sơ đồ'], ['/luat', 'Luật chung'], ['/muc-tieu', 'Mục tiêu · ngân sách'], ['/nhan-su', 'Đội ngũ'], ['/quy-trinh', 'Quy trình'], ['/nhat-ky', 'Nhật ký']];

export function ThanhTren() {
  const p = usePathname() ?? '/';
  // góp ý #1658: tiêu đề bảng DataTable (.dt-dau) dính top 0 trong khi .cty-top cũng dính top 0 → hai thứ chồng, hở khe lộ dòng thân bảng.
  // Đo chiều cao thanh trên ra --cty-top-h để .dt-dau dính ngay DƯỚI nó (cty.css).
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.cty-top'); if (!el) return;
    const dat = () => document.documentElement.style.setProperty('--cty-top-h', `${el.getBoundingClientRect().height}px`);
    const ro = new ResizeObserver(dat); ro.observe(el); dat();
    return () => ro.disconnect();
  }, []);
  const dang = (h: string) => (h === '/' ? p === '/' : p === h || p.startsWith(`${h}/`));
  return (
    <nav className="cty-dh" aria-label="Mục chính">
      {MUC.map(([h, t]) => <Link key={h} href={h} className="cty-dh-muc" aria-current={dang(h) ? 'page' : undefined}>{t}</Link>)}
      <a href="/vp/cong-ty/" className="cty-dh-muc">Văn phòng pixel ↗</a>
    </nav>
  );
}
