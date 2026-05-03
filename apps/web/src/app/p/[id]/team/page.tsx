import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ProjectTeamPage } from '@/components/project-team-page';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { listProjectMembers } from '@/lib/actions/assignments';
import { listTeamMembers } from '@/lib/actions/team';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProjectTeamRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/team`);

  const project = await getProject(id);
  if (!project) notFound();

  const [mode, projects, projectMembers, allMembers] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    listProjectMembers(id),
    me.role === 'admin' ? listTeamMembers() : Promise.resolve([]),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects}
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <ProjectTeamPage
        projectId={id}
        projectName={project.name}
        members={projectMembers}
        allMembers={allMembers}
        currentUserId={me.id}
        currentRole={me.role}
      />
    </AppShell>
  );
}
