import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb, platformAccounts, platforms, projects } from '@mos2/db';
import { eq } from 'drizzle-orm';
import { getEffectiveSignupFields } from '@/lib/actions/technologies';
import { fillTemplate } from '@/lib/template';

export const dynamic = 'force-dynamic';

// GET /api/ext/account-fields/123
// Returns the SAME fields shown in MOS2 web app's Pre-deployment panel:
// engine signup_fields + platform overrides + platform.checklist[creating]
// snippets — merged via getEffectiveSignupFields().
// Snippet templates are pre-rendered with project + account vars.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ fields: [] });

  const { id } = await params;
  const accountId = Number(id);
  if (!accountId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const [row] = await db
    .select({
      account: platformAccounts,
      platform: platforms,
      project: projects,
    })
    .from(platformAccounts)
    .leftJoin(platforms, eq(platformAccounts.platformKey, platforms.key))
    .leftJoin(projects, eq(platformAccounts.projectId, projects.id))
    .where(eq(platformAccounts.id, accountId))
    .limit(1);

  if (!row || !row.platform) return NextResponse.json({ fields: [], error: 'account-not-found' });

  const status = row.account.status;
  const phase: 'creating' | 'warming' | 'active' =
    status === 'warming' ? 'warming' :
    status === 'active'  ? 'active'  : 'creating';

  // Engine + platform signup fields only matter during creating phase.
  // Strip checklist-derived snippet fields here — they're returned via
  // warmupTasks below to avoid duplication in the UI.
  const allFields = phase === 'creating' ? await getEffectiveSignupFields(row.platform.key) : [];
  const fields = allFields.filter((f) => f.source !== 'checklist');

  const vars: Record<string, string> = {
    handle: row.account.handle ?? '',
    platform: row.platform.label,
    website: row.project?.website ?? '',
    bio: row.project?.bio ?? '',
    persona: row.project?.persona ?? '',
    hashtags: row.project?.hashtags ?? '',
    'one-liner': row.project?.oneLiner ?? '',
    name: row.project?.name ?? '',
    email: row.account.email ?? '',
  };

  const personaJson = (row.account.persona as Record<string, string>) ?? {};
  const out = fields.map((f) => {
    if (f.type === 'snippet') {
      const override = personaJson[f.key];
      // Override (user-edited) wins over template; alt always template-rendered for variant picker
      return {
        ...f,
        template: override || (f.template ? fillTemplate(f.template, vars) : ''),
        alt: f.alt ? f.alt.map((t) => fillTemplate(t, vars)) : f.alt,
        overridden: !!override,
      };
    }
    return { ...f, personaValue: personaJson[f.key] ?? '' };
  });

  // Build warmup tasks for current phase (with snippets nested + done state)
  type ChkSnippet = { label: string; text: string; alt?: string[]; maxLen?: number };
  type ChkItem = { key: string; phase: string; tip?: string; actionUrl?: string; snippets?: ChkSnippet[] };
  const checklist = (row.platform.checklist as ChkItem[]) ?? [];
  const checklistState = (row.account.warmupChecklist as Record<string, { done?: boolean }>) ?? {};

  const warmupTasks = checklist
    .filter((it) => it.phase === phase)
    .map((it) => ({
      key: it.key,
      label: it.key.replace(/_/g, ' '),
      tip: it.tip ?? null,
      actionUrl: it.actionUrl ?? null,
      done: !!checklistState[it.key]?.done,
      snippets: (it.snippets ?? []).map((s) => {
        const snipKey = s.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const override = personaJson[snipKey];
        return {
          key: snipKey,
          label: s.label,
          template: override || fillTemplate(s.text, vars),
          alt: (s.alt ?? []).map((t) => fillTemplate(t, vars)),
          maxLen: s.maxLen ?? null,
          overridden: !!override,
          type: 'snippet' as const,
          source: 'checklist' as const,
        };
      }),
    }));

  return NextResponse.json({
    accountStatus: row.account.status,
    accountHandle: row.account.handle ?? '',
    accountEmail: row.account.email ?? '',
    accountNotes: row.account.notes ?? '',
    platformLabel: row.platform.label,
    projectName: row.project?.name ?? '',
    phase,
    fields: out,        // creating: signup + snippets; warming/active: empty
    warmupTasks,        // tasks for current phase with snippets nested
  });
}
