import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SquadsPage } from '@/components/squads-page';
import { getProject, getProjectMode, listProjects } from "@/lib/data";
import { getAvailableModels } from '@/lib/ai-providers';
import { listTools, listSkills } from '@/lib/actions/library';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SquadsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/squads`);
  if (me.role !== 'admin') redirect(`/p/${id}/inbox`);

  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects, dbTools, dbSkills] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listTools(),
    listSkills(),
  ]);
  const availableModels = getAvailableModels();

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="squads"
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <SquadsPage mode={mode} projectId={id} availableModels={availableModels} dbTools={dbTools} dbSkills={dbSkills} />
    </AppShell>
  );
}
