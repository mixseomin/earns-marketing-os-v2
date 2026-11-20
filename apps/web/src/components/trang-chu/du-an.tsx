// LƯỚI DỰ ÁN của trang chủ — tab Dự án cũ và widget G1 của /home dùng chung (tách khỏi app/page.tsx 20/11/2026).
import Link from 'next/link';
import { PortfolioGrid } from '@/components/portfolio-grid';
import type { listProjects } from '@/lib/data';

export function DuAnLuoi({ projects }: { projects: Awaited<ReturnType<typeof listProjects>> }) {
  // nút + New Project giao cho lưới đặt: trang thường = hàng riêng góc phải như trước; ô widget /home = cuối hàng lọc gọn
  return <PortfolioGrid projects={projects} totalBudget={projects.reduce((s, p) => s + p.budget, 0)}
    nutMoi={<Link href="/p/new" style={{ background: 'var(--accent)', color: 'var(--bg-0)', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>+ New Project</Link>} />;
}
