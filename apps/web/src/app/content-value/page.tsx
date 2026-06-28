import { redirect } from 'next/navigation';
import { listProjects } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { getContentValue } from '@/lib/actions/content-value';
import { ContentValuePage } from '@/components/content-value-page';

export const dynamic = 'force-dynamic';

// Pha A của loop content-ops (#4) — đo giá trị & độ bền bài đã đăng. Admin-only, full-bleed.
export default async function ContentValueRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/content-value');
  if (me.role !== 'admin') redirect('/?error=admin-only');

  const [projects, data] = await Promise.all([listProjects(), getContentValue()]);
  const lite = projects.map((p) => ({ id: p.id, name: p.name }));
  return <ContentValuePage data={data} projects={lite} />;
}
