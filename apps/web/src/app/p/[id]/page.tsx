import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Dashboard } from '@/components/dashboard';
import { ArbScanner } from '@/components/arb-scanner';
import { NewsCopilotUsage } from '@/components/news-copilot-usage';
import { getProject, getProjectMode, listProjects } from "@/lib/data";
import { getCurrentUser } from '@/lib/auth';

export default async function ProjectDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Operators have no use for the Morning Brief — send them to their task queue
  const me = await getCurrentUser();
  if (me && me.role !== 'admin') redirect(`/p/${id}/inbox`);

  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects] = await Promise.all([getProjectMode(id, project.mode), listProjects()]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="dashboard"
      currentUser={{ id: me!.id, displayName: me!.displayName, email: me!.email, role: me!.role, specialty: me!.specialty }}>
      {id === 'crypto-arbitrage-scanner' && <ArbScanner />}
      {id === 'ai-news-copilot' && <NewsCopilotUsage />}
      <Dashboard mode={mode} project={project} />
    </AppShell>
  );
}
