import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SquadsPage } from '@/components/squads-page';
import { getProject } from '@/lib/mock/projects';
import { getMode } from '@/lib/mock/modes';

export default async function SquadsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();
  const mode = getMode(project.mode);

  return (
    <AppShell mode={mode} project={project} tab="squads">
      <SquadsPage mode={mode} />
    </AppShell>
  );
}
