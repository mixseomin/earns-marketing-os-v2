import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { IdentitiesPage } from '@/components/identities-page';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listIdentities } from '@/lib/actions/identities';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function IdentitiesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/identities`);
  if (me.role !== 'admin') redirect(`/p/${id}/inbox`);

  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects, items] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listIdentities(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects}
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <IdentitiesPage projectId={id} initial={items} />
    </AppShell>
  );
}
