import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { FlowDiagram } from '@/components/flow-diagram';
import { getFlowData } from '@/lib/actions/flow';
import { getProject, getProjectMode, listProjects } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function FlowRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [mode, projects, flowData] = await Promise.all([
    getProjectMode(id, project.mode),
    listProjects(),
    getFlowData(id),
  ]);

  return (
    <AppShell mode={mode} project={project} projects={projects}>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 10 }}>
          🗺 Flow Diagram
          <small style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>
            // {id}
          </small>
        </h1>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 20, fontFamily: 'var(--font-mono)' }}>
          Squad architecture · live card counts · workflow connections
        </p>
        <FlowDiagram data={flowData} projectId={id} />
      </div>
    </AppShell>
  );
}
