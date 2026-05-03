import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ProjectSettingsForm } from '@/components/project-settings-form';
import { getProject, getProjectMode, listProjects, listModes } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SettingsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const [mode, projects, allModes] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listModes(),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="settings" currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <ProjectSettingsForm project={project} allModes={allModes} />
    </AppShell>
  );
}
