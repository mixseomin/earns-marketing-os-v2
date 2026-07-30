'use server';

// Phase 11 Human Inbox actions: list / claim / complete / cancel human_tasks.

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export interface HumanTaskRow {
  id: number;
  projectId: string | null;
  projectName: string | null;
  cardId: number | null;
  parentRunId: number | null;
  title: string;
  instructions: string;
  prepPayload: Record<string, unknown>;
  platformKey: string | null;
  accountId: number | null;
  slaDueAt: string | null;
  status: string;
  claimedBy: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  publishUrl: string | null;
  screenshotUrl: string | null;
  notes: string | null;
  feedbackType: string | null;
  feedbackText: string | null;
  createdAt: string;
  workflowRunId: string | null;       // grouping → workflow chain
  descendantTaskId: number | null;    // task mới hơn trong cùng workflow → null = đang revise dở
  assignedUserId: number | null;
  assignedUserName: string | null;    // display_name preferred, fallback to users.name
}

export interface InboxFilter {
  status?: string;             // 'all' | 'pending' | ...
  projectId?: string;
  // assignment: 'all' | 'mine' | 'unassigned' | <userId number>
  assignment?: 'all' | 'mine' | 'unassigned' | number;
  currentUserId?: number;
}

export async function listInbox(
  filterStatus: string = 'all',
  projectId?: string,
  opts?: { assignment?: 'all' | 'mine' | 'unassigned' | number; currentUserId?: number },
): Promise<HumanTaskRow[]> {
  const db = getDb();
  if (!db) return [];
  const assignment = opts?.assignment ?? 'all';
  const currentUid = opts?.currentUserId ?? null;
  const rows = await db.execute(sql`
    WITH ht_with_run AS (
      SELECT ht.*, c.workflow_run_id
      FROM human_tasks ht
      LEFT JOIN agent_runs ar ON ar.id = ht.parent_run_id
      LEFT JOIN cards c ON c.id = ar.card_id
      WHERE ht.tenant_id = ${TENANT}
    )
    SELECT ht.id, ht.project_id, p.name AS project_name, ht.card_id, ht.parent_run_id,
           ht.title, ht.instructions, ht.prep_payload, ht.platform_key, ht.account_id,
           ht.sla_due_at, ht.status, ht.claimed_by, ht.claimed_at, ht.completed_at,
           ht.verified_at, ht.publish_url, ht.screenshot_url, ht.notes,
           ht.feedback_type, ht.feedback_text, ht.created_at, ht.workflow_run_id,
           ht.assigned_user_id,
           u.name AS assigned_user_name,
           m.display_name AS assigned_display_name,
           (SELECT MIN(ht2.id) FROM ht_with_run ht2
              WHERE ht2.workflow_run_id = ht.workflow_run_id AND ht2.id > ht.id) AS descendant_task_id
    FROM ht_with_run ht
    LEFT JOIN projects p ON p.id = ht.project_id
    LEFT JOIN users u ON u.id = ht.assigned_user_id
    LEFT JOIN members m ON m.user_id = ht.assigned_user_id AND m.project_id IS NULL
    WHERE 1=1
      ${filterStatus !== 'all' ? sql`AND ht.status = ${filterStatus}` : sql``}
      ${projectId ? sql`AND ht.project_id = ${projectId}` : sql``}
      ${assignment === 'mine' && currentUid
        ? sql`AND ht.assigned_user_id = ${currentUid}`
        : assignment === 'unassigned'
          ? sql`AND ht.assigned_user_id IS NULL`
          : typeof assignment === 'number'
            ? sql`AND ht.assigned_user_id = ${assignment}`
            : sql``}
    ORDER BY
      CASE ht.status
        WHEN 'pending' THEN 1
        WHEN 'claimed' THEN 2
        WHEN 'in_progress' THEN 3
        WHEN 'completed' THEN 4
        WHEN 'verified' THEN 5
        ELSE 6
      END,
      ht.sla_due_at ASC NULLS LAST,
      ht.created_at DESC
    LIMIT 100
  `);
  const toIso = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return new Date(v).toISOString();
    return null;
  };
  return (rows as unknown as Array<{
    id: number | string; project_id: string | null; project_name: string | null;
    card_id: number | null; parent_run_id: number | null;
    title: string; instructions: string; prep_payload: Record<string, unknown>;
    platform_key: string | null; account_id: number | null;
    sla_due_at: unknown; status: string; claimed_by: string | null;
    claimed_at: unknown; completed_at: unknown; verified_at: unknown;
    publish_url: string | null; screenshot_url: string | null;
    notes: string | null; feedback_type: string | null; feedback_text: string | null;
    created_at: unknown;
    workflow_run_id: string | null;
    descendant_task_id: number | string | null;
    assigned_user_id: number | null;
    assigned_user_name: string | null;
    assigned_display_name: string | null;
  }>).map((r) => ({
    id: Number(r.id),
    projectId: r.project_id, projectName: r.project_name,
    cardId: r.card_id, parentRunId: r.parent_run_id,
    title: r.title, instructions: r.instructions,
    prepPayload: r.prep_payload ?? {},
    platformKey: r.platform_key, accountId: r.account_id,
    slaDueAt: toIso(r.sla_due_at), status: r.status,
    claimedBy: r.claimed_by, claimedAt: toIso(r.claimed_at),
    completedAt: toIso(r.completed_at), verifiedAt: toIso(r.verified_at),
    publishUrl: r.publish_url, screenshotUrl: r.screenshot_url,
    notes: r.notes,
    feedbackType: r.feedback_type, feedbackText: r.feedback_text,
    createdAt: toIso(r.created_at) ?? '',
    workflowRunId: r.workflow_run_id,
    descendantTaskId: r.descendant_task_id != null ? Number(r.descendant_task_id) : null,
    assignedUserId: r.assigned_user_id != null ? Number(r.assigned_user_id) : null,
    assignedUserName: r.assigned_display_name ?? r.assigned_user_name ?? null,
  }));
}

// Get full execution context for a task — account + persona + environment
// (proxy + browser profile) + assigned user info. Called when opening TaskDetailModal.
export interface TaskExecutionContext {
  task: { id: number; title: string };
  assignedUser: { id: number; name: string; displayName: string; specialty: string } | null;
  account: {
    id: number; handle: string | null; email: string | null;
    platformKey: string; platformLabel: string;
    signupUrl: string; postUrl: string | null;
    personaKind: string; personaOwnerName: string | null;
    personaRole: string | null; disclosureText: string | null;
    twoFa: boolean;
  } | null;
  proxy: { id: number; label: string; type: string; endpoint: string; location: string | null; health: string } | null;
  browserProfile: { id: number; label: string; tool: string; externalId: string | null } | null;
}

export async function getTaskExecutionContext(taskId: number): Promise<TaskExecutionContext | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db.execute(sql`
    SELECT
      ht.id AS task_id, ht.title AS task_title,
      ht.assigned_user_id, u.name AS user_name, m.display_name AS user_display, m.specialty AS user_specialty,
      pa.id AS acc_id, pa.handle, pa.email, pa.platform_key,
      pl.label AS platform_label, pl.signup_url, pl.post_url,
      pa.persona_kind, pa.persona_owner_name, pa.persona_role, pa.disclosure_text, pa.has_2fa,
      px.id AS proxy_id, px.label AS proxy_label, px.type AS proxy_type,
      px.endpoint AS proxy_endpoint, px.location AS proxy_location, px.health AS proxy_health,
      bp.id AS bp_id, bp.label AS bp_label, bp.tool AS bp_tool, bp.external_id AS bp_external
    FROM human_tasks ht
    LEFT JOIN users u ON u.id = ht.assigned_user_id
    LEFT JOIN members m ON m.user_id = ht.assigned_user_id AND m.project_id IS NULL
    LEFT JOIN platform_accounts pa ON pa.id = ht.account_id
    LEFT JOIN platforms pl ON pl.key = pa.platform_key
    LEFT JOIN proxies px ON px.id = pa.proxy_id
    LEFT JOIN browser_profiles bp ON bp.id = pa.browser_profile_id
    WHERE ht.id = ${taskId} AND ht.tenant_id = ${TENANT}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return null;
  return {
    task: { id: Number(r.task_id), title: String(r.task_title) },
    assignedUser: r.assigned_user_id ? {
      id: Number(r.assigned_user_id),
      name: String(r.user_name ?? ''),
      displayName: String(r.user_display ?? r.user_name ?? ''),
      specialty: String(r.user_specialty ?? 'other'),
    } : null,
    account: r.acc_id ? {
      id: Number(r.acc_id),
      handle: (r.handle as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      platformKey: String(r.platform_key),
      platformLabel: String(r.platform_label ?? r.platform_key),
      signupUrl: String(r.signup_url ?? ''),
      postUrl: (r.post_url as string | null) ?? null,
      personaKind: String(r.persona_kind ?? 'brand'),
      personaOwnerName: (r.persona_owner_name as string | null) ?? null,
      personaRole: (r.persona_role as string | null) ?? null,
      disclosureText: (r.disclosure_text as string | null) ?? null,
      twoFa: Boolean(r.has_2fa),
    } : null,
    proxy: r.proxy_id ? {
      id: Number(r.proxy_id),
      label: String(r.proxy_label),
      type: String(r.proxy_type),
      endpoint: String(r.proxy_endpoint),
      location: (r.proxy_location as string | null) ?? null,
      health: String(r.proxy_health ?? 'unknown'),
    } : null,
    browserProfile: r.bp_id ? {
      id: Number(r.bp_id),
      label: String(r.bp_label),
      tool: String(r.bp_tool),
      externalId: (r.bp_external as string | null) ?? null,
    } : null,
  };
}

export async function claimTask(taskId: number, userId: string = 'self'): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    UPDATE human_tasks SET status='claimed', claimed_by=${userId}, claimed_at=NOW(), updated_at=NOW()
    WHERE tenant_id = ${TENANT} AND id = ${taskId} AND status = 'pending'
  `);
  revalidatePath('/inbox');
  return { ok: true };
}

export type FeedbackType = 'success' | 'revise' | 'error' | 'more-info';

export async function completeTask(taskId: number, body: {
  publishUrl?: string;
  screenshotUrl?: string;
  notes?: string;
  feedbackType?: FeedbackType;
  feedbackText?: string;
  // 'text': revise writer only, giữ ảnh cũ (default — tiết kiệm DALL-E)
  // 'image': revise designer only, giữ post cũ
  // 'both': re-run writer → designer → publisher
  reviseTarget?: 'text' | 'image' | 'both';
}): Promise<{ ok: boolean; spawnedCardId?: number; spawnedSquad?: string; workflowRunId?: string }> {
  const db = getDb();
  if (!db) return { ok: false };
  // Auto-claim nếu chưa claim — UX: user mở task pending, fill form, bấm Mark complete trực tiếp.
  await db.execute(sql`
    UPDATE human_tasks SET
      status = 'completed',
      claimed_by = COALESCE(claimed_by, 'self'),
      claimed_at = COALESCE(claimed_at, NOW()),
      publish_url = ${body.publishUrl ?? null},
      screenshot_url = ${body.screenshotUrl ?? null},
      notes = ${body.notes ?? null},
      feedback_type = ${body.feedbackType ?? null},
      feedback_text = ${body.feedbackText ?? null},
      completed_at = NOW(),
      updated_at = NOW()
    WHERE tenant_id = ${TENANT} AND id = ${taskId}
  `);

  // Feedback loop: nếu user yêu cầu revise → spawn 1 card downstream với feedback.
  // Routing theo reviseTarget — text (default) revise writer + skip design,
  // image revise designer only, both = full chain từ writer.
  let spawnedCardId: number | undefined;
  let spawnedSquad: string | undefined;
  let workflowRunId: string | undefined;
  if (body.feedbackType === 'revise' || body.feedbackType === 'more-info' || body.feedbackType === 'error') {
    // Lookup task để có parent_run + workflow context.
    const taskRows = await db.execute(sql`
      SELECT ht.parent_run_id, ar.card_id, c.workflow_run_id, c.workflow_key, c.workflow_context, c.project_id, c.col, c.squad_key, c.title
      FROM human_tasks ht
      LEFT JOIN agent_runs ar ON ar.id = ht.parent_run_id
      LEFT JOIN cards c ON c.id = ar.card_id
      WHERE ht.id = ${taskId} LIMIT 1
    `);
    const t = (taskRows as unknown as Array<{
      parent_run_id: number | null; card_id: number | null;
      workflow_run_id: string | null; workflow_key: string | null;
      workflow_context: Record<string, unknown> | null;
      project_id: string | null; col: string | null;
      squad_key: string | null; title: string | null;
    }>)[0];
    if (t?.workflow_run_id && t?.workflow_key === 'reddit-launch') {
      const reviseTarget = body.reviseTarget ?? 'text';
      const baseCtx = (t.workflow_context ?? {}) as Record<string, unknown>;

      // Pull old image from previous publish ctx (workflow_context của publish step có imageUrl/imageAssetId)
      // Nếu human_task spawn từ publish step, parent_run_id → card #publish có ctx đầy đủ.
      const ctx: Record<string, unknown> = {
        ...baseCtx,
        feedback: body.feedbackText ?? '',
        // Khi revise text-only → skip design ở worker chain logic.
        revise_skip_design: reviseTarget === 'text',
      };

      let targetSquad: string;
      let targetStep: 'write' | 'design';
      let stepLabel: string;
      let reviseBody: string;
      if (reviseTarget === 'image') {
        // Spawn designer trực tiếp, giữ post cũ.
        targetSquad = 'wf-designer';
        targetStep = 'design';
        stepLabel = '🎨 Revise image';
        reviseBody = `## Feedback từ human (revise image)
${body.feedbackText ?? '(no detail)'}

## Post hiện tại (giữ nguyên)
${(ctx.post as string) ?? '(empty)'}

## Image concept gốc
${(ctx.imageConcept as string) ?? '(empty)'}

## Yêu cầu
Tạo lại hero image dựa trên feedback. BẮT BUỘC gọi tool image-gen + save-knowledge với title='Image notes revised'.`;
      } else {
        // text / both / error → spawn writer. Error = fix lỗi, revise_skip_design để nhanh.
        targetSquad = 'wf-writer';
        targetStep = 'write';
        stepLabel = body.feedbackType === 'error' ? '🔧 Fix error' : reviseTarget === 'both' ? '✍️ Revise (full)' : '✍️ Revise text';
        if (body.feedbackType === 'error') ctx.revise_skip_design = true; // error fix → skip design, re-publish nhanh
        reviseBody = `## Feedback từ human (revise ${reviseTarget})
${body.feedbackText ?? '(no detail)'}

## Plan gốc
${(ctx.plan as string) ?? '(empty)'}

${reviseTarget === 'text' ? `## Image hiện tại (giữ nguyên — không tái tạo)
${(ctx.imageUrl as string) ?? '(none)'}

` : ''}## Yêu cầu
Revise Reddit post dựa trên feedback. Output title + body markdown. BẮT BUỘC gọi save-knowledge với title='Reddit post revised' + content=full title+body.${reviseTarget === 'text' ? ' Sau bước này hệ thống skip design và đi thẳng publish — giữ ảnh cũ.' : ''}`;
      }

      const newRef = `RV-${Math.floor(1000 + Math.random() * 9000)}`;
      const insRows = await db.execute(sql`
        INSERT INTO cards (
          tenant_id, project_id, card_ref, col, title, body,
          squad_key, level, due, agent_kind, dispatch_ready, idempotency_key,
          workflow_run_id, workflow_key, workflow_step, workflow_context, tags
        ) VALUES (
          'self', ${t.project_id ?? 'orit'}, ${newRef}, ${t.col ?? 'prospecting'},
          ${`${stepLabel} — ${t.title ?? 'Reddit post'}`}, ${reviseBody},
          ${targetSquad}, 2, 'NOW',
          'gpt-4o-mini', true,
          ${`${t.workflow_run_id}-revise-${Date.now()}`},
          ${t.workflow_run_id}, 'reddit-launch', ${targetStep},
          ${JSON.stringify(ctx)}::jsonb,
          ${JSON.stringify(['workflow:reddit-launch', `step:${targetStep}`, 'revise', `target:${reviseTarget}`])}::jsonb
        ) RETURNING id
      `);
      const r = (insRows as unknown as Array<{ id: number | string }>)[0];
      if (r) {
        spawnedCardId = Number(r.id);
        spawnedSquad = targetSquad;
        workflowRunId = t.workflow_run_id ?? undefined;
      }
    }
  }

  // Success + publishUrl → auto-spawn Engage human task với 2h golden-window SLA.
  // Reuse same parent_run_id → CTE trong listInbox tự inherit workflow_run_id,
  // descendant_task_id cho success task sẽ tự trỏ sang engage task → state='chained'.
  if (body.feedbackType === 'success' && body.publishUrl && !spawnedCardId) {
    const srcRows = await db.execute(sql`
      SELECT ht.parent_run_id, c.project_id, c.workflow_run_id, c.title
      FROM human_tasks ht
      LEFT JOIN agent_runs ar ON ar.id = ht.parent_run_id
      LEFT JOIN cards c ON c.id = ar.card_id
      WHERE ht.id = ${taskId} LIMIT 1
    `);
    const src = (srcRows as unknown as Array<{
      parent_run_id: number | null; project_id: string | null;
      workflow_run_id: string | null; title: string | null;
    }>)[0];
    if (src?.parent_run_id && src?.project_id) {
      const rootTitle = (src.title ?? 'Reddit post').split(' — ').pop() ?? 'Reddit post';
      const engageInstructions = `Post đã publish: ${body.publishUrl}

**Engage trong 2h (golden window Reddit):**
- Reply mọi comment, cảm ơn upvotes
- Nếu có câu hỏi về tool → paste link orit.app + elevator pitch ngắn
- Nếu post đạt >10 upvotes → mark success để amplify Twitter/LinkedIn
- Track upvotes + comments mỗi 30 phút

**Mục tiêu:** giữ post sống trên top + convert traffic thành signups.`;
      await db.execute(sql`
        INSERT INTO human_tasks (
          tenant_id, project_id, parent_run_id,
          title, instructions, prep_payload,
          platform_key, sla_due_at, status
        ) VALUES (
          'self', ${src.project_id}, ${src.parent_run_id},
          ${`📊 Engage — ${rootTitle}`},
          ${engageInstructions},
          ${JSON.stringify({ postUrl: body.publishUrl, type: 'engage', workflowRunId: src.workflow_run_id })}::jsonb,
          'reddit',
          NOW() + INTERVAL '2 hours',
          'pending'
        )
      `);
      workflowRunId = src.workflow_run_id ?? undefined;
    }
  }

  // Auto-kick worker nếu vừa spawn — đỡ user phải bấm Run worker tay.
  // Fire-and-forget: response không chờ worker complete (có thể >10s).
  if (spawnedCardId) {
    const cronSecret = process.env.MOS2_CRON_SECRET || process.env.CRON_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://mos2.on.tc';
    const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
    if (cronSecret) {
      fetch(`${url}/api/cron/worker?limit=1`, {
        method: 'POST', headers: { 'x-cron-secret': cronSecret },
      }).catch(() => {});
    }
  }

  revalidatePath('/inbox');
  return { ok: true, spawnedCardId, spawnedSquad, workflowRunId };
}

export async function cancelTask(taskId: number, reason?: string): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    UPDATE human_tasks SET status='cancelled', notes=${reason ?? null}, updated_at=NOW()
    WHERE tenant_id = ${TENANT} AND id = ${taskId}
  `);
  revalidatePath('/inbox');
  return { ok: true };
}

// Phase 12.5 — Task lineage: liệt kê toàn bộ activity trong workflow_run của task này.
// Mục đích: xem lại ai đã làm gì (AI agent + human) qua từng bước, có thể revise nhiều lần.
export interface LineageEntry {
  kind: 'agent_run' | 'human_task';
  ts: string;                     // ISO timestamp
  cardId?: number;
  cardRef?: string;
  stepKey?: string;               // workflow_step
  squadKey?: string;              // wf-planner / wf-writer / wf-designer / wf-publisher
  runId?: number;
  runStatus?: string;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  costCents?: number;
  toolsUsed?: Array<{ toolId: string; ok: boolean }>;
  output?: string;                // run output text hoặc human task title
  // Human task fields
  taskId?: number;
  taskStatus?: string;
  feedbackType?: string | null;
  feedbackText?: string | null;
  publishUrl?: string | null;
  isRevise?: boolean;             // tag revise → highlight chain mới
}
export async function getTaskLineage(taskId: number): Promise<LineageEntry[]> {
  const db = getDb();
  if (!db) return [];

  // Find workflow_run_id của task này.
  const ctxRows = await db.execute(sql`
    SELECT c.workflow_run_id
    FROM human_tasks ht
    LEFT JOIN agent_runs ar ON ar.id = ht.parent_run_id
    LEFT JOIN cards c ON c.id = ar.card_id
    WHERE ht.id = ${taskId} LIMIT 1
  `);
  const ctxRow = (ctxRows as unknown as Array<{ workflow_run_id: string | null }>)[0];
  if (!ctxRow?.workflow_run_id) return [];
  const wfRunId = ctxRow.workflow_run_id;

  // Tất cả agent_runs trong workflow_run.
  const runRows = await db.execute(sql`
    SELECT ar.id, ar.card_id, ar.status, ar.started_at, ar.completed_at, ar.duration_ms,
           ar.tokens_in, ar.tokens_out, ar.cost_usd_cents, ar.tools_used, ar.output,
           c.card_ref, c.workflow_step, c.squad_key, c.tags
    FROM agent_runs ar
    LEFT JOIN cards c ON c.id = ar.card_id
    WHERE c.workflow_run_id = ${wfRunId}
    ORDER BY ar.id ASC
  `);
  const runs = (runRows as unknown as Array<{
    id: number | string; card_id: number | string; status: string;
    started_at: unknown; completed_at: unknown; duration_ms: number | null;
    tokens_in: number | null; tokens_out: number | null; cost_usd_cents: number | null;
    tools_used: unknown; output: unknown;
    card_ref: string | null; workflow_step: string | null; squad_key: string | null;
    tags: string[] | null;
  }>);

  // Tất cả human_tasks trong workflow_run.
  const taskRows = await db.execute(sql`
    SELECT ht.id, ht.parent_run_id, ht.title, ht.status, ht.feedback_type, ht.feedback_text,
           ht.publish_url, ht.created_at, ht.completed_at
    FROM human_tasks ht
    LEFT JOIN agent_runs ar ON ar.id = ht.parent_run_id
    LEFT JOIN cards c ON c.id = ar.card_id
    WHERE c.workflow_run_id = ${wfRunId}
    ORDER BY ht.id ASC
  `);
  const tasks = (taskRows as unknown as Array<{
    id: number | string; parent_run_id: number | null; title: string; status: string;
    feedback_type: string | null; feedback_text: string | null;
    publish_url: string | null; created_at: unknown; completed_at: unknown;
  }>);

  const toIso = (v: unknown): string => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return new Date(v).toISOString();
    return new Date().toISOString();
  };

  const entries: LineageEntry[] = [];
  for (const r of runs) {
    const out = (typeof r.output === 'object' && r.output) ? (r.output as { text?: string }).text ?? '' : '';
    const tools = Array.isArray(r.tools_used) ? r.tools_used as Array<{ toolId: string; ok: boolean }> : [];
    const isRevise = Array.isArray(r.tags) && r.tags.includes('revise');
    entries.push({
      kind: 'agent_run',
      ts: toIso(r.started_at),
      cardId: Number(r.card_id), cardRef: r.card_ref ?? undefined,
      stepKey: r.workflow_step ?? undefined,
      squadKey: r.squad_key ?? undefined,
      runId: Number(r.id), runStatus: r.status,
      durationMs: r.duration_ms ?? undefined,
      tokensIn: r.tokens_in ?? undefined,
      tokensOut: r.tokens_out ?? undefined,
      costCents: r.cost_usd_cents ?? undefined,
      toolsUsed: tools.map((t) => ({ toolId: t.toolId, ok: t.ok })),
      output: out.slice(0, 280),
      isRevise,
    });
  }
  for (const t of tasks) {
    entries.push({
      kind: 'human_task',
      ts: toIso(t.created_at),
      taskId: Number(t.id),
      taskStatus: t.status,
      feedbackType: t.feedback_type, feedbackText: t.feedback_text,
      publishUrl: t.publish_url,
      output: t.title,
    });
  }
  // Sort by timestamp ASC
  entries.sort((a, b) => a.ts.localeCompare(b.ts));
  return entries;
}

// Phase 12.5 — Poll workflow progress sau khi user revise.
// Trả về: latest step đang chạy/xong + new human_task nếu chain đã đến publish.
// Frontend modal poll mỗi ~3s để cập nhật UI realtime, swap sang task mới khi sẵn sàng.
export interface WorkflowProgress {
  steps: Array<{ stepKey: string; cardId: number; cardRef: string; runStatus: 'queued' | 'running' | 'completed' | 'failed' | 'none'; spawnedAt: string }>;
  newTask: HumanTaskRow | null;
  done: boolean;  // true khi có new task pending hoặc tất cả step đã xong
}
export async function pollWorkflowProgress(workflowRunId: string, afterHumanTaskId: number): Promise<WorkflowProgress> {
  const db = getDb();
  if (!db) return { steps: [], newTask: null, done: false };

  // Cards trong workflow_run, sort theo created_at (gồm cả revise spawn).
  // Chỉ lấy cards mới hơn afterHumanTaskId's parent (vì revise spawn sau).
  const stepRows = await db.execute(sql`
    SELECT c.id, c.card_ref, c.workflow_step, c.dispatch_ready, c.created_at,
           (SELECT status FROM agent_runs WHERE card_id = c.id ORDER BY id DESC LIMIT 1) AS run_status
    FROM cards c
    WHERE c.workflow_run_id = ${workflowRunId}
      AND c.id > (SELECT COALESCE(MAX(ar.card_id), 0) FROM human_tasks ht JOIN agent_runs ar ON ar.id = ht.parent_run_id WHERE ht.id = ${afterHumanTaskId})
    ORDER BY c.id ASC
  `);
  const steps = (stepRows as unknown as Array<{
    id: number | string; card_ref: string; workflow_step: string;
    dispatch_ready: boolean; created_at: unknown; run_status: string | null;
  }>).map((r) => {
    let runStatus: 'queued' | 'running' | 'completed' | 'failed' | 'none' = 'none';
    if (r.run_status === 'running') runStatus = 'running';
    else if (r.run_status === 'completed') runStatus = 'completed';
    else if (r.run_status === 'failed') runStatus = 'failed';
    else if (r.dispatch_ready) runStatus = 'queued';
    return {
      stepKey: r.workflow_step, cardId: Number(r.id), cardRef: r.card_ref, runStatus,
      spawnedAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    };
  });

  // New human_task pending có id > afterHumanTaskId.
  const taskRows = await db.execute(sql`
    SELECT ht.id, ht.project_id, p.name AS project_name, ht.card_id, ht.parent_run_id,
           ht.title, ht.instructions, ht.prep_payload, ht.platform_key, ht.account_id,
           ht.sla_due_at, ht.status, ht.claimed_by, ht.claimed_at, ht.completed_at,
           ht.verified_at, ht.publish_url, ht.screenshot_url, ht.notes,
           ht.feedback_type, ht.feedback_text, ht.created_at
    FROM human_tasks ht
    LEFT JOIN projects p ON p.id = ht.project_id
    LEFT JOIN agent_runs ar ON ar.id = ht.parent_run_id
    LEFT JOIN cards c ON c.id = ar.card_id
    WHERE ht.tenant_id = ${TENANT}
      AND ht.id > ${afterHumanTaskId}
      AND c.workflow_run_id = ${workflowRunId}
    ORDER BY ht.id DESC LIMIT 1
  `);
  const toIso = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return new Date(v).toISOString();
    return null;
  };
  const newRow = (taskRows as unknown as Array<{
    id: number | string; project_id: string | null; project_name: string | null;
    card_id: number | null; parent_run_id: number | null;
    title: string; instructions: string; prep_payload: Record<string, unknown>;
    platform_key: string | null; account_id: number | null;
    sla_due_at: unknown; status: string; claimed_by: string | null;
    claimed_at: unknown; completed_at: unknown; verified_at: unknown;
    publish_url: string | null; screenshot_url: string | null;
    notes: string | null; feedback_type: string | null; feedback_text: string | null;
    created_at: unknown;
  }>)[0];
  const newTask: HumanTaskRow | null = newRow ? {
    id: Number(newRow.id),
    projectId: newRow.project_id, projectName: newRow.project_name,
    cardId: newRow.card_id, parentRunId: newRow.parent_run_id,
    title: newRow.title, instructions: newRow.instructions,
    prepPayload: newRow.prep_payload ?? {},
    platformKey: newRow.platform_key, accountId: newRow.account_id,
    slaDueAt: toIso(newRow.sla_due_at), status: newRow.status,
    claimedBy: newRow.claimed_by, claimedAt: toIso(newRow.claimed_at),
    completedAt: toIso(newRow.completed_at), verifiedAt: toIso(newRow.verified_at),
    publishUrl: newRow.publish_url, screenshotUrl: newRow.screenshot_url,
    notes: newRow.notes, feedbackType: newRow.feedback_type, feedbackText: newRow.feedback_text,
    createdAt: toIso(newRow.created_at) ?? '',
    workflowRunId: workflowRunId, descendantTaskId: null,
    assignedUserId: null, assignedUserName: null,
  } : null;

  return { steps, newTask, done: !!newTask };
}

// Resume từ task đã completed nhưng không spawn (vd error type, hoặc workflow chain bị dừng).
// Cho user re-revise với feedback text mới (hoặc giữ lại từ trước) — không bao giờ stuck.
export async function resumeTaskAsRevise(taskId: number, body: {
  feedbackText: string;
  reviseTarget?: 'text' | 'image' | 'both';
}): Promise<{ ok: boolean; spawnedCardId?: number; spawnedSquad?: string; workflowRunId?: string }> {
  const db = getDb();
  if (!db) return { ok: false };

  // Re-use lookup logic.
  const taskRows = await db.execute(sql`
    SELECT ht.parent_run_id, ar.card_id, c.workflow_run_id, c.workflow_key, c.workflow_context, c.project_id, c.col, c.title
    FROM human_tasks ht
    LEFT JOIN agent_runs ar ON ar.id = ht.parent_run_id
    LEFT JOIN cards c ON c.id = ar.card_id
    WHERE ht.id = ${taskId} LIMIT 1
  `);
  const t = (taskRows as unknown as Array<{
    parent_run_id: number | null; card_id: number | null;
    workflow_run_id: string | null; workflow_key: string | null;
    workflow_context: Record<string, unknown> | null;
    project_id: string | null; col: string | null; title: string | null;
  }>)[0];
  if (!t?.workflow_run_id || t?.workflow_key !== 'reddit-launch') return { ok: false };

  const reviseTarget = body.reviseTarget ?? 'text';
  const baseCtx = (t.workflow_context ?? {}) as Record<string, unknown>;
  const ctx: Record<string, unknown> = {
    ...baseCtx,
    feedback: body.feedbackText,
    revise_skip_design: reviseTarget === 'text',
  };
  const reviseBody = `## Feedback từ human (resume revise)
${body.feedbackText}

## Plan gốc
${(ctx.plan as string) ?? '(empty)'}

## Yêu cầu
Revise Reddit post dựa trên feedback. Output title + body markdown. BẮT BUỘC gọi save-knowledge với title='Reddit post resumed' + content=full title+body.`;

  const newRef = `RS-${Math.floor(1000 + Math.random() * 9000)}`;
  const insRows = await db.execute(sql`
    INSERT INTO cards (
      tenant_id, project_id, card_ref, col, title, body,
      squad_key, level, due, agent_kind, dispatch_ready, idempotency_key,
      workflow_run_id, workflow_key, workflow_step, workflow_context, tags
    ) VALUES (
      'self', ${t.project_id ?? 'orit'}, ${newRef}, ${t.col ?? 'prospecting'},
      ${`✍️ Resume — ${t.title ?? 'Reddit post'}`}, ${reviseBody},
      'wf-writer', 2, 'NOW',
      'gpt-4o-mini', true,
      ${`${t.workflow_run_id}-resume-${Date.now()}`},
      ${t.workflow_run_id}, 'reddit-launch', 'write',
      ${JSON.stringify(ctx)}::jsonb,
      ${JSON.stringify(['workflow:reddit-launch', 'step:write', 'resume', `target:${reviseTarget}`])}::jsonb
    ) RETURNING id
  `);
  const r = (insRows as unknown as Array<{ id: number | string }>)[0];
  const spawnedCardId = r ? Number(r.id) : undefined;

  // Auto-kick worker.
  if (spawnedCardId) {
    const cronSecret = process.env.MOS2_CRON_SECRET || process.env.CRON_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mos2.on.tc';
    if (cronSecret) {
      fetch(`${baseUrl}/api/cron/worker?limit=1`, { method: 'POST', headers: { 'x-cron-secret': cronSecret } }).catch(() => {});
    }
  }

  revalidatePath('/inbox');
  return { ok: true, spawnedCardId, spawnedSquad: 'wf-writer', workflowRunId: t.workflow_run_id ?? undefined };
}

export async function unclaimTask(taskId: number): Promise<{ ok: boolean }> {
  const db = getDb();
  if (!db) return { ok: false };
  await db.execute(sql`
    UPDATE human_tasks SET status='pending', claimed_by=NULL, claimed_at=NULL, updated_at=NOW()
    WHERE tenant_id = ${TENANT} AND id = ${taskId}
  `);
  revalidatePath('/inbox');
  return { ok: true };
}
