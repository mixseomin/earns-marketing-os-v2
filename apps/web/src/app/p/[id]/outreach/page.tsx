import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { OutreachPage } from '@/components/outreach-page';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listOutreachProspects } from '@/lib/actions/outreach';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function OutreachRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const isDemo = project.isDemo === true;
  const [mode, projects, prospects] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    isDemo ? Promise.resolve([]) : listOutreachProspects(id),
  ]);

  return (
    <AppShell
      mode={mode}
      project={project}
      projects={projects}
      tab="outreach"
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}
    >
      <OutreachPage projectId={id} prospects={prospects} />
    </AppShell>
  );
}
