// Publisher toolkit (Phase 12) — CHỈ còn human-handoff: đẩy việc vào hàng human_tasks khi nền không tự đăng được.
// reddit-post / twitter-post đã bỏ 28/10/2026 (anh: "không được tách ra lắm phiên bản đăng bài"): chưa từng chạy (box3 không có REDDIT_CLIENT_ID),
// và đăng bài chỉ còn MỘT đường — máy đăng puzzle-books dang-may.mjs + sổ nền apps/xuong-video/nen-dang.json (luật ~/.claude/CLAUDE.md).

import 'server-only';
import { sql } from 'drizzle-orm';
import { textArray } from '@/lib/sql-array';
import { getDb } from '@mos2/db';
import { register, z } from './registry';

// ── human-handoff ────────────────────────────────────────────
// Generic queue tool. Agent gọi when can't auto-post (FB/IG/TikTok DM).
register({
  id: 'human-handoff',
  schema: z.object({
    platform: z.string().min(1),
    title: z.string().min(1).max(300),
    instructions: z.string().min(1).max(2000),
    prepPayload: z.object({
      caption: z.string().optional(),
      imageUrls: z.array(z.string()).optional(),
      hashtags: z.array(z.string()).optional(),
      bestTimeIso: z.string().optional(),
    }).optional(),
    slaMinutes: z.number().int().min(5).max(10080).default(120),
    accountId: z.number().int().optional(),
  }),
  output: z.object({
    humanTaskId: z.number(),
    status: z.string(),
    slaDueAt: z.string(),
  }),
  sideEffect: 'write',
  costEstimateCents: 0,
  timeoutMs: 5_000,
  fn: async (input, ctx) => {
    const db = getDb();
    if (!db) throw new Error('DATABASE_URL not configured');
    const slaDue = new Date(Date.now() + (input.slaMinutes ?? 120) * 60_000);

    // Auto-link account: if no accountId passed, look up active/creating
    // account for this project+platform. Picks most recently used one.
    let accountId = input.accountId ?? null;
    if (!accountId) {
      const lookupRows = await db.execute(sql`
        SELECT id FROM platform_accounts
        WHERE tenant_id = 'self'
          AND project_id = ${ctx.projectId}
          AND platform_key = ${input.platform}
          AND status IN ('active', 'creating', 'todo')
        ORDER BY (status = 'active') DESC, last_used_at DESC NULLS LAST, id ASC
        LIMIT 1
      `);
      const acc = (lookupRows as unknown as Array<{ id: number | string }>)[0];
      if (acc) accountId = Number(acc.id);
    }

    // Auto-assign to a team member by squad → specialty mapping.
    // wf-writer / writer → specialty 'writer'
    // wf-publisher / publish → specialty 'community' (community manager posts)
    // wf-designer → 'designer'
    // wf-monitor / monitor → 'community'
    // fallback: marketing-lead, then founder
    let assignedUserId: number | null = null;
    try {
      const squadKey = (ctx as { squadKey?: string }).squadKey ?? '';
      const specPrefs: string[] = (
        squadKey.includes('writer')      ? ['writer','marketing-lead'] :
        squadKey.includes('publisher')   ? ['community','marketing-lead'] :
        squadKey.includes('designer')    ? ['designer','marketing-lead'] :
        squadKey.includes('monitor')     ? ['community','marketing-lead'] :
        squadKey.includes('research')    ? ['analytics','marketing-lead'] :
                                            ['marketing-lead','founder']
      );
      // Pick first active member matching one of the preferred specialties.
      const pickRows = await db.execute(sql`
        SELECT u.id FROM users u
        JOIN members m ON m.user_id = u.id AND m.project_id IS NULL AND m.active = true
        WHERE u.tenant_id = 'self'
          AND m.specialty = ANY(${textArray(specPrefs)})
        ORDER BY array_position(${textArray(specPrefs)}, m.specialty) ASC,
                 (SELECT COUNT(*) FROM human_tasks WHERE assigned_user_id = u.id AND status = 'pending') ASC
        LIMIT 1
      `);
      const pick = (pickRows as unknown as Array<{ id: number | string }>)[0];
      if (pick) assignedUserId = Number(pick.id);
    } catch { /* best-effort, keep null */ }

    const insRows = await db.execute(sql`
      INSERT INTO human_tasks (
        tenant_id, project_id, parent_run_id, title, instructions,
        prep_payload, platform_key, account_id, sla_due_at, status, assigned_user_id
      ) VALUES (
        'self', ${ctx.projectId},
        ${ctx.agentRunId ?? null},
        ${input.title},
        ${input.instructions},
        ${JSON.stringify(input.prepPayload ?? {})}::jsonb,
        ${input.platform},
        ${accountId},
        ${slaDue.toISOString()}::timestamptz,
        'pending',
        ${assignedUserId}
      ) RETURNING id
    `);
    const r = (insRows as unknown as Array<{ id: number | string }>)[0]!;
    return { humanTaskId: Number(r.id), status: 'pending', slaDueAt: slaDue.toISOString() };
  },
});

export const PUBLISHER_TOOLKIT_LOADED = true;
