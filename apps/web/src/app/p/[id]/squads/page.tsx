import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SquadsPage } from '@/components/squads-page';
import { getProject, getProjectMode, listProjects } from "@/lib/data";

export default async function SquadsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects] = await Promise.all([getProjectMode(id, project.mode), listProjects()]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="squads">
      <SquadsPage mode={mode} />
    </AppShell>
  );
}
