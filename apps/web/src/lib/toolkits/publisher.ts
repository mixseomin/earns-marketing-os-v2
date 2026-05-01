// Phase 12 — Publisher toolkit. REAL executable functions.
//
// 3 tools:
//   reddit-post     — Reddit OAuth submit (script app via REDDIT_CLIENT_ID/SECRET)
//   twitter-post    — placeholder (skip cho first iteration: cần Twitter API
//                     paid tier hoặc OAuth1.0a tokens, env chưa có)
//   human-handoff   — fallback khi platform requires_human=true. Insert vào
//                     human_tasks queue. Agent gọi tool này khi platforms.
//                     auto_post_supported=false (FB/IG/TikTok DM).
//
// Squad config typical:
//   tools: ['reddit-post', 'human-handoff']
//   trustLevel: L2 (write actions logged) hoặc L3 (queue human review).

import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { register, z } from './registry';

// ── Reddit OAuth helper (shared với warmup-checks pattern) ──────
const REDDIT_TOKEN_TTL_MS = 50 * 60 * 1000;
let redditToken: { value: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) return null;
  if (redditToken && redditToken.expiresAt > Date.now()) return redditToken.value;

  const auth = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`,
  ).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': process.env.REDDIT_USER_AGENT || 'mos2-publisher/1.0',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`reddit token http ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  redditToken = { value: data.access_token, expiresAt: Date.now() + REDDIT_TOKEN_TTL_MS };
  return data.access_token;
}

// ── reddit-post ──────────────────────────────────────────────
// CHÚ Ý: submit qua client_credentials token (script app) hiện tại Reddit không
// support — cần user OAuth (refresh token) hoặc dùng /u/me. First iteration
// returns "not_supported" + queue human handoff. Khi user có user-OAuth flow
// với refresh token sẽ thay logic.
register({
  id: 'reddit-post',
  schema: z.object({
    subreddit: z.string().min(1).max(64),
    title: z.string().min(1).max(300),
    text: z.string().optional(),                 // self-post body
    url: z.string().url().optional(),            // link-post URL
    flairId: z.string().optional(),
    nsfw: z.boolean().default(false),
    spoiler: z.boolean().default(false),
  }),
  output: z.object({
    posted: z.boolean(),
    postUrl: z.string().nullable(),
    fullName: z.string().nullable(),             // 't3_xxxxx' Reddit thing ID
    queuedHumanTaskId: z.number().nullable(),
    error: z.string().nullable(),
  }),
  sideEffect: 'write',
  costEstimateCents: 0,
  timeoutMs: 15_000,
  fn: async (input, ctx) => {
    // Hiện tại script-app token KHÔNG submit được — Reddit yêu cầu user OAuth
    // refresh token. Auto-fallback queue human_task để user submit thủ công.
    const token = await getRedditToken();
    if (!token) {
      return await fallbackToHumanTask({
        ctx, platform: 'reddit',
        title: `Post to r/${input.subreddit}: ${input.title}`,
        payload: {
          subreddit: input.subreddit,
          title: input.title,
          text: input.text,
          url: input.url,
        },
        instructions: `1. Mở https://reddit.com/r/${input.subreddit}/submit. 2. Paste title + body. 3. Submit. 4. Upload screenshot URL.`,
      });
    }
    // Future: when user-OAuth refresh token available, call POST /api/submit.
    // For now always fallback.
    return await fallbackToHumanTask({
      ctx, platform: 'reddit',
      title: `Post to r/${input.subreddit}: ${input.title}`,
      payload: { subreddit: input.subreddit, title: input.title, text: input.text, url: input.url },
      instructions: `Reddit script-app token chỉ read được. Cần user OAuth flow để post API. Giờ user submit thủ công.\n1. Mở https://reddit.com/r/${input.subreddit}/submit\n2. Paste title + body\n3. Submit + upload URL`,
    });
  },
});

// ── twitter-post ─────────────────────────────────────────────
// Placeholder — cần TWITTER_BEARER + OAuth1 tokens. Default fallback human_task.
register({
  id: 'twitter-post',
  schema: z.object({
    text: z.string().min(1).max(280),
    replyToId: z.string().optional(),
    mediaUrls: z.array(z.string().url()).optional(),
  }),
  output: z.object({
    posted: z.boolean(),
    tweetUrl: z.string().nullable(),
    queuedHumanTaskId: z.number().nullable(),
    error: z.string().nullable(),
  }),
  sideEffect: 'write',
  timeoutMs: 15_000,
  fn: async (input, ctx) => {
    // Twitter API v2 yêu cầu paid tier. First iteration: always queue human.
    return await fallbackToHumanTask({
      ctx, platform: 'twitter',
      title: `Tweet: ${input.text.slice(0, 60)}${input.text.length > 60 ? '…' : ''}`,
      payload: { text: input.text, replyToId: input.replyToId, mediaUrls: input.mediaUrls },
      instructions: `Twitter API tier v2 paid required. Giờ user post thủ công:\n1. Mở https://twitter.com/compose/tweet\n2. Paste text${input.mediaUrls?.length ? ' + upload media' : ''}\n3. Tweet + paste tweet URL`,
    });
  },
});

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

    const insRows = await db.execute(sql`
      INSERT INTO human_tasks (
        tenant_id, project_id, parent_run_id, title, instructions,
        prep_payload, platform_key, account_id, sla_due_at, status
      ) VALUES (
        'self', ${ctx.projectId},
        ${ctx.agentRunId ?? null},
        ${input.title},
        ${input.instructions},
        ${JSON.stringify(input.prepPayload ?? {})}::jsonb,
        ${input.platform},
        ${accountId},
        ${slaDue.toISOString()}::timestamptz,
        'pending'
      ) RETURNING id
    `);
    const r = (insRows as unknown as Array<{ id: number | string }>)[0]!;
    return { humanTaskId: Number(r.id), status: 'pending', slaDueAt: slaDue.toISOString() };
  },
});

// Helper: tạo human_task fallback từ trong reddit-post / twitter-post tools.
async function fallbackToHumanTask(args: {
  ctx: { projectId: string; agentRunId?: number };
  platform: string;
  title: string;
  payload: Record<string, unknown>;
  instructions: string;
}): Promise<{ posted: false; postUrl: null; fullName: null; queuedHumanTaskId: number; error: string } & {
  tweetUrl: null;
}> {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured');
  const slaDue = new Date(Date.now() + 120 * 60_000);
  const insRows = await db.execute(sql`
    INSERT INTO human_tasks (
      tenant_id, project_id, parent_run_id, title, instructions,
      prep_payload, platform_key, sla_due_at, status
    ) VALUES (
      'self', ${args.ctx.projectId},
      ${args.ctx.agentRunId ?? null},
      ${args.title},
      ${args.instructions},
      ${JSON.stringify(args.payload)}::jsonb,
      ${args.platform},
      ${slaDue.toISOString()}::timestamptz,
      'pending'
    ) RETURNING id
  `);
  const r = (insRows as unknown as Array<{ id: number | string }>)[0]!;
  return {
    posted: false,
    postUrl: null,
    tweetUrl: null,
    fullName: null,
    queuedHumanTaskId: Number(r.id),
    error: `Auto-post not available; queued human_task #${r.id}`,
  };
}

export const PUBLISHER_TOOLKIT_LOADED = true;
