import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CommandBoard } from '@/components/board';
import { getProject, getProjectMode, listProjects } from "@/lib/data";
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/board`);

  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects] = await Promise.all([getProjectMode(id, project.mode), listProjects()]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="board"
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <CommandBoard mode={mode} projectId={id} />
    </AppShell>
  );
}
