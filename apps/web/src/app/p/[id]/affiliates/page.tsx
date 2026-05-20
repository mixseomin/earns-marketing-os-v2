import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { AwinProgrammesView } from '@/components/awin-programmes-view';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listAwinProgrammes } from '@/lib/awin/programmes';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AwinAffiliatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects, programmes] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listAwinProgrammes(),
  ]);
  return (
    <AppShell mode={mode} project={project} projects={projects} tab="resources"
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <AwinProgrammesView programmes={programmes} />
    </AppShell>
  );
}
