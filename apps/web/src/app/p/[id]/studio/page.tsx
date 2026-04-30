import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ContentStudioPage } from '@/components/content-studio';
import { EmptyState } from '@/components/ui';
import { getProject, getProjectMode, listProjects } from '@/lib/data';

export default async function StudioRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects] = await Promise.all([getProjectMode(id, project.mode), listProjects()]);

  // Demo: render mock ContentStudio cho design preview.
  // Real: Studio chưa wire DB → EmptyState với link tới Board.
  const isDemo = project.isDemo === true;

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="studio">
      {isDemo ? (
        <ContentStudioPage />
      ) : (
        <div style={{ padding: 16 }}>
          <EmptyState
            icon="🎬"
            title="Content Studio — UI chưa wire DB"
            description={
              <>
                Schema <code>content_pieces</code> sẽ ship phase tới (drafts theo channel, AI co-pilot qua OpenAI gpt-4o-mini,
                multi-channel preview như FB/email/ad/reel/landing/DM).
                <br />Hiện tại: dùng <a href={`/p/${id}/board`} style={{ color: 'var(--accent)' }}>Command Board</a> để quản lý content tasks
                {' '}(đã có {mode.cards.length} card sync từ Directus).
              </>
            }
          />
        </div>
      )}
    </AppShell>
  );
}
