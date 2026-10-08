// /p/[id]/xuong-video — Xưởng video AI: kịch bản → storyboard (keyframe duyệt trước) → clip từng cảnh → ghép.
// Plan: docs/plan-xuong-video-ai.md. Admin-only (tốn tiền model).
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { XuongVideoTrang } from '@/components/xuong-video/trang';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { dsPhim, trangThaiKhoa } from '@/lib/actions/xuong-video';

export const dynamic = 'force-dynamic';

export default async function XuongVideoRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/xuong-video`);
  if (me.role !== 'admin') redirect(`/p/${id}/inbox`);

  const [mode, projects, phim, khoa] = await Promise.all([getProjectMode(id, project.mode), listProjects(), dsPhim(id), trangThaiKhoa()]);

  return (
    <AppShell mode={mode} project={project} projects={projects} tab="xuong-video" currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}>
      <XuongVideoTrang projectId={id} phimDau={phim} khoa={khoa} />
    </AppShell>
  );
}
