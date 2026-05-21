import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PlanCockpit } from '@/components/plan-cockpit';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import {
  getPlanBySlug,
  listGoalsByPlan,
  listStepsByPlan,
  listRisksByPlan,
  getAiContext,
  listRecentActivity,
  getProjectBrand,
  listAccountsForProject,
} from '@/lib/data-plan-cockpit';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectPlanCockpitRoute({ params, searchParams }: PageProps) {
  const { id, slug } = await params;
  const sp = await searchParams;

  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/plans/${slug}`);

  const project = await getProject(id);
  if (!project) notFound();

  const plan = await getPlanBySlug(slug);
  if (!plan) notFound();

  // Plan must belong to this project (else redirect to its real project, or to project plan list)
  if (plan.projectId && plan.projectId !== id) {
    redirect(`/p/${plan.projectId}/plans/${slug}`);
  }
  if (!plan.projectId) {
    // Plan exists but unlinked. Redirect to project's plans list with a hint.
    redirect(`/p/${id}/plans?error=plan-unlinked&slug=${slug}`);
  }

  const [goals, steps, risks, aiCtx, activity, projects, mode, projectBrand, accounts] = await Promise.all([
    listGoalsByPlan(plan.id),
    listStepsByPlan(plan.id),
    listRisksByPlan(plan.id),
    getAiContext(plan.id),
    listRecentActivity(plan.id, 5),
    listProjects(),
    getProjectMode(id, project.mode),
    getProjectBrand(id),
    listAccountsForProject(id),
  ]);

  const activeGoalId = (() => {
    const raw = sp.goal;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (!v) return goals.find((g) => g.status === 'doing')?.id ?? goals[0]?.id ?? null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();

  const activeStepId = (() => {
    const raw = sp.step;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();

  return (
    <AppShell
      mode={mode}
      project={project}
      projects={projects}
      tab="plans"
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}
    >
      <PlanCockpit
        plan={plan}
        goals={goals}
        steps={steps}
        risks={risks}
        aiContext={aiCtx}
        activity={activity}
        activeGoalId={activeGoalId}
        activeStepId={activeStepId}
        projectBrand={projectBrand}
        accounts={accounts}
      />
    </AppShell>
  );
}
