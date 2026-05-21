import { notFound, redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { AppShell } from '@/components/app-shell';
import { getProject, getProjectMode, listProjects } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@mos2/db';

export const dynamic = 'force-dynamic';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

interface PlanCard {
  id: number;
  slug: string;
  name: string;
  status: string;
  targetMrrUsd: number;
  currentMrrUsd: number;
  description: string | null;
  goalCount: number;
  stepCount: number;
  doneStepCount: number;
}

async function listProjectPlans(projectId: string): Promise<PlanCard[]> {
  const db = getDb();
  if (!db) return [];
  const rows = (await db.execute(sql`
    SELECT p.id, p.slug, p.name, p.status, p.target_mrr_usd, p.current_mrr_usd, p.description,
           (SELECT COUNT(*) FROM plan_goals g WHERE g.plan_id = p.id) AS goal_count,
           (SELECT COUNT(*) FROM plan_steps s
              JOIN plan_goals g ON g.id = s.goal_id WHERE g.plan_id = p.id) AS step_count,
           (SELECT COUNT(*) FROM plan_steps s
              JOIN plan_goals g ON g.id = s.goal_id
              WHERE g.plan_id = p.id AND s.status = 'done') AS done_count
    FROM plans p
    WHERE p.tenant_id = ${TENANT} AND p.project_id = ${projectId}
    ORDER BY p.created_at DESC
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    status: String(r.status),
    targetMrrUsd: Number(r.target_mrr_usd),
    currentMrrUsd: Number(r.current_mrr_usd),
    description: r.description as string | null,
    goalCount: Number(r.goal_count),
    stepCount: Number(r.step_count),
    doneStepCount: Number(r.done_count),
  }));
}

const STATUS_COLOR: Record<string, string> = {
  brainstorm: '#9ca3af', planning: '#3b82f6', building: '#a78bfa', live: '#10b981', paused: '#f59e0b', dropped: '#6b7280',
};
const STATUS_LABEL_VI: Record<string, string> = {
  brainstorm: 'Brainstorm', planning: 'Lập kế hoạch', building: 'Đang xây', live: 'Đang chạy', paused: 'Tạm dừng', dropped: 'Bỏ',
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; slug?: string }>;
}

export default async function ProjectPlansListRoute({ params, searchParams }: PageProps) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${id}/plans`);

  const project = await getProject(id);
  if (!project) notFound();

  const sp = await searchParams;
  const [plans, mode, projects] = await Promise.all([
    listProjectPlans(id),
    getProjectMode(id, project.mode),
    listProjects(),
  ]);

  return (
    <AppShell
      mode={mode}
      project={project}
      projects={projects}
      tab="plans"
      currentUser={{ id: me.id, displayName: me.displayName, email: me.email, role: me.role, specialty: me.specialty }}
    >
      <div style={styles.root}>
        <header style={styles.header}>
          <div>
            <div style={styles.title}>Kế hoạch của {project.name}</div>
            <div style={styles.subtitle}>Kế hoạch chiến lược (mục tiêu → bước cockpit) thuộc project này</div>
          </div>
          <button style={styles.btnPrimary} disabled title="Sắp có">+ Kế hoạch mới</button>
        </header>

        {sp.error === 'plan-unlinked' && (
          <div style={styles.warn}>
            ⚠️ Kế hoạch <code>{sp.slug}</code> tồn tại nhưng chưa link tới project nào. Cần update <code>plans.project_id</code> trong DB.
          </div>
        )}

        {plans.length === 0 ? (
          <div style={styles.empty}>
            Chưa có kế hoạch nào cho project này.
            <br/><span style={{ fontSize: 11, color: '#6b7280' }}>Tạo kế hoạch mới qua seed script hoặc DB insert. UI form sắp có.</span>
          </div>
        ) : (
          <div style={styles.grid}>
            {plans.map((p) => {
              const stepPct = p.stepCount > 0 ? Math.round((p.doneStepCount / p.stepCount) * 100) : 0;
              const mrrPct = p.targetMrrUsd > 0 ? Math.round((p.currentMrrUsd / p.targetMrrUsd) * 100) : 0;
              return (
                <a key={p.id} href={`/p/${id}/plans/${p.slug}`} style={styles.card}>
                  <div style={styles.cardHead}>
                    <span style={styles.cardName}>🎯 {p.name}</span>
                    <span style={{ ...styles.cardStatus, color: STATUS_COLOR[p.status] || '#9ca3af', borderColor: STATUS_COLOR[p.status] || '#9ca3af' }}>
                      {STATUS_LABEL_VI[p.status] || p.status}
                    </span>
                  </div>
                  {p.description && <div style={styles.cardDesc}>{p.description}</div>}
                  <div style={styles.cardStats}>
                    <div style={styles.statBlock}>
                      <span style={styles.statLabel}>Mục tiêu</span>
                      <span style={styles.statValue}>{p.goalCount}</span>
                    </div>
                    <div style={styles.statBlock}>
                      <span style={styles.statLabel}>Bước xong</span>
                      <span style={styles.statValue}>{p.doneStepCount}/{p.stepCount}</span>
                      <div style={styles.miniBar}><div style={{ ...styles.miniFill, width: `${stepPct}%`, background: '#10b981' }} /></div>
                    </div>
                    <div style={styles.statBlock}>
                      <span style={styles.statLabel}>MRR</span>
                      <span style={styles.statValue}>${p.currentMrrUsd}/${p.targetMrrUsd}</span>
                      <div style={styles.miniBar}><div style={{ ...styles.miniFill, width: `${mrrPct}%`, background: '#3b82f6' }} /></div>
                    </div>
                  </div>
                  <div style={styles.cardFoot}>Mở cockpit →</div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { padding: 16, color: '#e5e7eb' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 600 },
  subtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  btnPrimary: { background: '#3b82f6', color: 'white', padding: '6px 12px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'not-allowed', opacity: 0.6 },
  warn: { background: '#1c1917', border: '1px solid #f59e0b', borderRadius: 6, padding: 12, marginBottom: 12, color: '#fbbf24', fontSize: 12 },
  empty: { padding: 40, textAlign: 'center', color: '#9ca3af', border: '1px dashed #374151', borderRadius: 8 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 },
  card: { background: '#161922', border: '1px solid #2d3748', borderRadius: 8, padding: 14, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.15s' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 14, fontWeight: 600 },
  cardStatus: { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 6px', borderRadius: 4, border: '1px solid' },
  cardDesc: { fontSize: 11, color: '#9ca3af', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  cardStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, paddingTop: 8, borderTop: '1px solid #2d3748' },
  statBlock: { display: 'flex', flexDirection: 'column', gap: 2 },
  statLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 13, fontWeight: 500 },
  miniBar: { height: 3, background: '#1f2937', borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  miniFill: { height: '100%' },
  cardFoot: { fontSize: 11, color: '#60a5fa', textAlign: 'right' },
};
