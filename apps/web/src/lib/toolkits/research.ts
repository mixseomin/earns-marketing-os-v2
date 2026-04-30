// Phase 12 — Research toolkit. REAL executable functions registered vào tool runtime.
//
// 4 tools:
//   web-search    — Brave Search API (env BRAVE_SEARCH_API_KEY) hoặc DDG HTML fallback.
//   web-scrape    — fetch HTML + extract text (no JS rendering — infra heavy lifted later).
//   embed         — OpenAI text-embedding-3-small. Returns vector cho similarity ops.
//   save-knowledge — insert into knowledge_items DB table.
//
// Squad config "research" tools list = ['web-search', 'web-scrape', 'embed', 'save-knowledge'].
// library_tools.runtime_module='toolkits/research' để DB knows tool callable.

import 'server-only';
import OpenAI from 'openai';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { register, z } from './registry';

// ── web-search ──────────────────────────────────────────────────
register({
  id: 'web-search',
  schema: z.object({
    query: z.string().min(1).max(500),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  output: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    })),
  }),
  sideEffect: 'read',
  costEstimateCents: 0,    // free if Brave free tier; ~0.01 cents each call
  timeoutMs: 15_000,
  fn: async (input) => {
    const limit = input.limit ?? 10;
    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveKey) {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(input.query)}&count=${limit}`;
      const res = await fetch(url, { headers: { 'X-Subscription-Token': braveKey, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`brave search http ${res.status}`);
      const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
      return {
        results: (data.web?.results ?? []).slice(0, limit).map((r) => ({
          title: r.title, url: r.url, snippet: r.description ?? '',
        })),
      };
    }
    // Fallback: DuckDuckGo HTML (free, scrappy parsing).
    const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(input.query)}`, {
      headers: { 'User-Agent': 'mos2-research/1.0' },
    });
    if (!ddgRes.ok) throw new Error(`ddg http ${ddgRes.status}`);
    const html = await ddgRes.text();
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    // Simple HTML parse for result blocks
    const blockRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(html)) && results.length < limit) {
      const cleanUrl = decodeURIComponent(m[1]!.replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0] ?? m[1]!);
      results.push({
        url: cleanUrl,
        title: m[2]!.trim(),
        snippet: m[3]!.replace(/<[^>]+>/g, '').trim(),
      });
    }
    return { results };
  },
});

// ── web-scrape ──────────────────────────────────────────────────
register({
  id: 'web-scrape',
  schema: z.object({
    url: z.string().url(),
    maxChars: z.number().int().min(100).max(50_000).default(10_000),
  }),
  output: z.object({
    url: z.string(),
    title: z.string().optional(),
    text: z.string(),
    charsExtracted: z.number(),
  }),
  sideEffect: 'read',
  costEstimateCents: 0,
  timeoutMs: 20_000,
  fn: async (input) => {
    const res = await fetch(input.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 mos2-research/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`scrape http ${res.status}`);
    const html = await res.text();
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1]!.trim() : undefined;
    // Strip scripts + styles + tags. Naive — production sẽ Readability lib.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, input.maxChars);
    return { url: input.url, title, text, charsExtracted: text.length };
  },
});

// ── embed ────────────────────────────────────────────────────────
register({
  id: 'embed',
  schema: z.object({
    text: z.string().min(1).max(8000),
    model: z.string().default('text-embedding-3-small'),
  }),
  output: z.object({
    vector: z.array(z.number()),
    dimensions: z.number(),
    model: z.string(),
  }),
  sideEffect: 'read',
  costEstimateCents: 1,    // ~$0.00002/1K tokens ≈ 1 cent per call
  timeoutMs: 10_000,
  fn: async (input) => {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY chưa set');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = input.model ?? 'text-embedding-3-small';
    const res = await client.embeddings.create({ model, input: input.text });
    const vec = res.data[0]?.embedding ?? [];
    return { vector: vec, dimensions: vec.length, model };
  },
});

// ── save-knowledge ──────────────────────────────────────────────
register({
  id: 'save-knowledge',
  schema: z.object({
    projectId: z.string().optional(),         // null = portfolio-wide
    kind: z.enum(['playbook', 'spec', 'note', 'research', 'reference']).default('research'),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(50_000),
    tags: z.array(z.string()).default([]),
  }),
  output: z.object({
    id: z.number(),
    saved: z.boolean(),
  }),
  sideEffect: 'write',
  costEstimateCents: 0,
  timeoutMs: 5_000,
  fn: async (input, ctx) => {
    const db = getDb();
    if (!db) throw new Error('DATABASE_URL not configured');
    const projectId = input.projectId ?? ctx.projectId;
    const rows = await db.execute(sql`
      INSERT INTO knowledge_items (tenant_id, project_id, kind, title, content, tags, imported_from)
      VALUES ('self', ${projectId ?? null}, ${input.kind}, ${input.title}, ${input.content},
              ${JSON.stringify(input.tags)}::jsonb, ${`agent-run-${ctx.agentRunId ?? 'unknown'}`})
      RETURNING id
    `);
    const r = (rows as unknown as Array<{ id: number }>)[0]!;
    return { id: r.id, saved: true };
  },
});

// Touch import to ensure register() side effects run when this module is imported.
export const RESEARCH_TOOLKIT_LOADED = true;
