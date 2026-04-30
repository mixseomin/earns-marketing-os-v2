import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { TribesPage } from '@/components/tribes-page';
import { EmptyState } from '@/components/ui';
import { getProject, getProjectMode, listProjects } from '@/lib/data';

export default async function TribesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects] = await Promise.all([getProjectMode(id, project.mode), listProjects()]);

  // Demo projects render mock TribesPage cho design preview.
  // Real projects (Orit, Astrolas, user-created) chỉ show DB data — phase tới sẽ wire UI đọc tribes/habitats table.
  const isDemo = project.isDemo === true;

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="tribes">
      {isDemo ? (
        <TribesPage />
      ) : (
        <div style={{ padding: 16 }}>
          <EmptyState
            icon="◍"
            title="Tribes — UI chưa wire DB"
            description={
              <>
                Bridge sync từ as.on.tc đã import data vào tables <code>tribes</code> + <code>habitats</code>
                {' '}(Astrolas có 1 tribe + 26 habitats; Orit chưa có).
                <br />UI đọc từ DB sẽ ship phase tới — xem <a href="/roadmap" style={{ color: 'var(--accent)' }}>/roadmap</a> Phase 8.
                <br />Hiện tại tránh leak mock content vào project thật.
              </>
            }
          />
        </div>
      )}
    </AppShell>
  );
}
