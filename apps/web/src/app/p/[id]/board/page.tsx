import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CommandBoard } from '@/components/board';
import { getProject } from '@/lib/mock/projects';
import { getMode } from '@/lib/mock/modes';

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();
  const mode = getMode(project.mode);

  return (
    <AppShell mode={mode} project={project} tab="board">
      <CommandBoard mode={mode} />
    </AppShell>
  );
}
