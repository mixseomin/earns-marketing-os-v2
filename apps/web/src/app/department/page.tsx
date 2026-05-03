import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { DepartmentPage } from '@/components/department-page';
import { listProjects, getMode, getProjectMode } from '@/lib/data';
import { listDepartment } from '@/lib/actions/department';
import { getCurrentUser } from '@/lib/auth';
import { getLastProject } from '@/lib/last-project';

export const dynamic = 'force-dynamic';

export default async function DepartmentRoute({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/department');
  if (me.role !== 'admin') redirect('/?error=admin-only');

  const sp = await searchParams;
  const filterProject = sp.project;

  const [projects, lastProject, fallbackMode, entries] = await Promise.all([
    listProjects(),
    getLastProject(),
    getMode('affiliate'),
    listDepartment(filterProject),
  ]);
  const mode = lastProject ? await getProjectMode(lastProject.id, lastProject.mode) : fallbackMode;

  return (
    <AppShell mode={mode} project={lastProject} projects={projects} isPortfolio
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <DepartmentPage entries={entries} projects={projects} filterProject={filterProject ?? null} />
    </AppShell>
  );
}
