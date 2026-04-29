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

  const isBlank = mode.squads.length === 0 && mode.cards.length === 0;

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="studio">
      {isBlank ? (
        <div style={{ padding: 16 }}>
          <EmptyState
            icon="🎬"
            title="Content Studio — chưa wire DB"
            description={
              <>
                Studio hiện preview với mock content (FB post, email, ad, reel, landing, DM) cho demo projects.
                Project blank ẩn để không nhiễu. Phase 8 sẽ wire DB cho content_pieces (drafts, AI co-pilot, multi-channel preview).
                Hiện tại: dùng Command Board để quản lý content tasks.
              </>
            }
          />
        </div>
      ) : (
        <ContentStudioPage />
      )}
    </AppShell>
  );
}
