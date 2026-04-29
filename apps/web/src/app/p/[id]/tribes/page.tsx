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

  const isBlank = mode.squads.length === 0 && mode.cards.length === 0;

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="tribes">
      {isBlank ? (
        <div style={{ padding: 16 }}>
          <EmptyState
            icon="◍"
            title="Tribes — chưa wire DB"
            description={
              <>
                Layer 1 (Habitats: subreddit, FB group, hashtag) + Layer 2 (Tribes: audience identity) chưa có schema thật.
                Hiện tại hiện mock data cho demo projects, ẩn cho project blank để không nhiễu.
                Phase 8 sẽ wire DB theo bridge sync từ as.on.tc Directus tribes.
              </>
            }
          />
        </div>
      ) : (
        <TribesPage />
      )}
    </AppShell>
  );
}
