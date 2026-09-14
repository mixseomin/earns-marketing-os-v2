// /p/[id]/phu — MỘT trang quản lý quá trình phủ affiliate + traffic mua của project (anh chốt
// 14/09/2026: không track vào adfond, chỉ mos2.on.tc; mọi adapter/postback cắm vào đây).
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PhuView } from '@/components/phu-view';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { getPhu } from '@/lib/phu';
import { getCurrentUser } from '@/lib/auth';
import { BACKLINK_SITES } from '@/lib/backlink-sites';

export const dynamic = 'force-dynamic';

export default async function PhuPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const me = await getCurrentUser();
  const project = await getProject(id);
  if (!project) notFound();
  const [mode, projects, data] = await Promise.all([getProjectMode(id, project.mode), listProjects(), getPhu(id, days)]);
  // Host của site để dựng link cửa ra: lấy từ lander/nền tảng đã khai, không thì domain trong sổ site.
  const host = data.landers[0]?.host.replace(/^[a-z]+\./, '') ?? BACKLINK_SITES.find((s) => s.slug === id)?.domain ?? 'chatwhenbored.com';
  return (
    <AppShell mode={mode} project={project} projects={projects} tab="phu"
      currentUser={me ? { id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty } : undefined}>
      <PhuView data={data} projectId={id} host={host} />
    </AppShell>
  );
}
