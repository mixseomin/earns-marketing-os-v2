import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Dashboard } from '@/components/dashboard';
import { getProject, getProjectMode, listProjects } from "@/lib/data";

export default async function ProjectDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects] = await Promise.all([getProjectMode(id, project.mode), listProjects()]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="dashboard">
      <Dashboard mode={mode} />
    </AppShell>
  );
}
