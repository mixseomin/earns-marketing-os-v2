import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { FlowDiagram } from '@/components/flow-diagram';
import { getFlowData } from '@/lib/actions/flow';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { getAvailableModels } from '@/lib/ai-providers';
import { listTools, listSkills } from '@/lib/actions/library';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function FlowRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const me = await getCurrentUser();
  if (me?.role !== 'admin') redirect(`/p/${id}/inbox`);

  const [mode, projects, flowData, dbTools, dbSkills] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    getFlowData(id),
    listTools(),
    listSkills(),
  ]);
  const availableModels = getAvailableModels();

  return (
    <AppShell mode={mode} project={project} projects={projects} currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 10 }}>
          🗺 Flow Diagram
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>
            // {id}
          </small>
        </h1>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 20, fontFamily: 'var(--font-mono)' }}>
          Hover squad để xem chi tiết · Click để edit · Tự refresh 15s
        </p>
        <FlowDiagram
          data={flowData}
          projectId={id}
          squadDetails={mode.squads ?? []}
          availableModels={availableModels}
          dbTools={dbTools}
          dbSkills={dbSkills}
        />
      </div>
    </AppShell>
  );
}
