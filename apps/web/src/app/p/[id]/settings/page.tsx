import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ProjectSettingsForm } from '@/components/project-settings-form';
import { getProject, getProjectMode, listProjects, listModes } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function SettingsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects, allModes] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listModes(),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="settings">
      <ProjectSettingsForm project={project} allModes={allModes} />
    </AppShell>
  );
}
