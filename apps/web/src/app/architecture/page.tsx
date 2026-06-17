import { redirect } from 'next/navigation';
import { listProjects } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { ArchitectureStudio } from '@/components/architecture/studio';

export const dynamic = 'force-dynamic';

// System architecture map — consolidates the EXISTING MOS2 model (objects · links ·
// flows) into one full-bleed studio. Read-only; full viewport (no AppShell chrome).
export default async function ArchitectureRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/architecture');
  if (me.role !== 'admin') redirect('/?error=admin-only');

  const projects = await listProjects();
  const lite = projects.map((p) => ({ id: p.id, name: p.name }));

  return <ArchitectureStudio projects={lite} />;
}
