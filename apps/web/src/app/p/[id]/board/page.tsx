import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CommandBoard } from '@/components/board';
import { getProject, getProjectMode } from '@/lib/data';

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const mode = await getProjectMode(id, project.mode);

  return (
    <AppShell mode={mode} project={project} tab="board">
      <CommandBoard mode={mode} />
    </AppShell>
  );
}
