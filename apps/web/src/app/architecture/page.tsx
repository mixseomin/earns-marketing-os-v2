import { redirect } from 'next/navigation';
import { getDb } from '@mos2/db';
import { listProjects } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { busiestProjectId, getCrewCapabilities } from '@/lib/actions/architecture';
import { getContentValue } from '@/lib/actions/content-value';
import { getContentCadence } from '@/lib/actions/content-cadence';
import { getSceneEvents } from '@/lib/scene-events';
import { ArchitectureStudio } from '@/components/architecture/studio';

export const dynamic = 'force-dynamic';

// System architecture map — consolidates the EXISTING MOS2 model (objects · links ·
// flows) into one full-bleed studio. Read-only; full viewport (no AppShell chrome).
export default async function ArchitectureRoute() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/architecture');
  if (me.role !== 'admin') redirect('/?error=admin-only');

  const [projects, busiest, caps, contentValue, contentCadence, sceneEvents] = await Promise.all([listProjects(), busiestProjectId(), getCrewCapabilities(), getContentValue(), getContentCadence(), getSceneEvents(getDb())]);
  const lite = projects.map((p) => ({ id: p.id, name: p.name }));
  const defaultProjectId = busiest && lite.some((p) => p.id === busiest) ? busiest : (lite[0]?.id || '');

  return <ArchitectureStudio projects={lite} defaultProjectId={defaultProjectId} caps={caps} contentValue={contentValue} contentCadence={contentCadence} sceneEvents={sceneEvents} />;
}
