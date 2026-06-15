import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { RevenueView } from '@/components/revenue-view';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { getAdsenseSummary } from '@/lib/adsense/reports';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProjectRevenuePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const days = Math.max(7, Math.min(90, parseInt(sp.days ?? '30') || 30));
  const me = await getCurrentUser();
  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects, summary] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    getAdsenseSummary({ projectId: id, windowDays: days }),
  ]);
  return (
    <AppShell mode={mode} project={project} projects={projects} tab="resources"
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <RevenueView summary={summary} scope="project" projectName={project.name} />
    </AppShell>
  );
}
