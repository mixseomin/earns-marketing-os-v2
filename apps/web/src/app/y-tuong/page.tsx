import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { YTuongPage } from '@/components/y-tuong-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listYTuong } from '@/lib/y-tuong';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

// Sổ ý tưởng & bước — portfolio (mọi nhóm: iOS, ExamWeight, Bra…). Gốc của Google Sheet "Projects IDEAS 2026";
// CLI ~/bin/ideas ghi vào cùng bảng. Admin only.
export default async function YTuongRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/y-tuong');
  if (me.role !== 'admin') redirect('/?error=admin-only');
  const [projects, lastProject, fallbackMode, items] = await Promise.all([listProjects(), getLastProject(), getMode('affiliate'), listYTuong()]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;
  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <YTuongPage items={items} />
    </AppShell>
  );
}
