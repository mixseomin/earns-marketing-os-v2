import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';
import crypto from 'crypto';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Parse Reddit subreddit sidebar HTML qua OpenAI gpt-4.1-mini. Cache theo
// SHA256 hash HTML — Reddit redesign = HTML structure đổi = hash đổi =
// LLM call lần đầu, sau đó reuse. Cost ~$0.001/call cho gpt-4.1-mini.
//
// Cache table: ext_html_parse_cache (mig 0060).

interface ParseRequest {
  platform_key: string;        // 'reddit'
  page_kind: string;           // 'subreddit-about' | 'subreddit-rules'
  html: string;                // raw HTML sidebar
  current_fields?: Record<string, unknown>; // detector đã scrape được gì rồi
}

interface ParseResponse {
  ok: boolean;
  cached: boolean;
  hash: string;
  fields?: Record<string, unknown>;
  model?: string;
  error?: string;
}

const SCHEMAS: Record<string, string> = {
  'subreddit-about': `Bạn parse Reddit subreddit "About community" panel HTML. Trả về JSON CHỈ với fields này (null nếu không có):
{
  "members": number | null,           // total subscribers ("2.3K" → 2300, "1.2M" → 1200000)
  "weekly_visitors": number | null,   // weekly unique visitors
  "weekly_contributions": number | null,  // posts + comments tuần
  "privacy": "public" | "restricted" | "private" | null,
  "created_at": string | null,        // ISO date YYYY-MM-DD
  "description": string | null,       // community description text
  "icon_url": string | null           // subreddit icon image URL
}
Pattern Reddit 2025-2026: "2K Members", "2K Weekly visitors", "280 Weekly contributions", "Created Aug 14, 2017", "Public" hoặc "🔒 Private community" / "Restricted".`,
  'subreddit-rules': `Parse Reddit subreddit rules list. Trả về JSON:
{
  "rules": [{"priority": number, "short_name": string, "description": string}]
}`,
};

export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  if (!aiEnabled()) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 503 });
  }

  const body = (await req.json()) as ParseRequest;
  if (!body.html || !body.platform_key || !body.page_kind) {
    return NextResponse.json({ ok: false, error: 'platform_key + page_kind + html required' }, { status: 400 });
  }

  // Truncate HTML to 30KB safety (LLM input cap + cost control)
  const html = body.html.slice(0, 30_000);
  const hash = crypto.createHash('sha256')
    .update(`${body.platform_key}:${body.page_kind}:${html}`)
    .digest('hex').slice(0, 16);

  const db = getDb();

  // ── Cache check ────────────────────────────────────────────────
  if (db) {
    try {
      const cached = await db.execute(sql`
        SELECT fields_json, model FROM ext_html_parse_cache
        WHERE html_hash = ${hash}
        LIMIT 1
      `);
      const row = (cached as unknown as Array<{ fields_json: unknown; model: string }>)[0];
      if (row) {
        return NextResponse.json({
          ok: true, cached: true, hash,
          fields: row.fields_json as Record<string, unknown>,
          model: row.model,
        } satisfies ParseResponse);
      }
    } catch (e) {
      console.warn('[habitat-html-parse] cache read failed:', e);
    }
  }

  // ── LLM call (OpenAI gpt-4.1-mini) ─────────────────────────────
  const schema = SCHEMAS[body.page_kind] || 'Trả về JSON với fields scrape được.';
  const ai = getOpenAI();
  if (!ai) {
    return NextResponse.json({ ok: false, error: 'OpenAI client unavailable' }, { status: 503 });
  }
  const model = 'gpt-4.1-mini';

  let parsed: Record<string, unknown> | null = null;
  try {
    const completion = await ai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: schema },
        { role: 'user', content: `HTML:\n\`\`\`html\n${html}\n\`\`\`` },
      ],
    });
    const txt = completion.choices[0]?.message?.content?.trim() ?? '';
    parsed = JSON.parse(txt);
  } catch (e) {
    return NextResponse.json({
      ok: false, cached: false, hash, error: (e as Error).message,
    } satisfies ParseResponse, { status: 502 });
  }

  // ── Cache write ────────────────────────────────────────────────
  if (db && parsed) {
    try {
      await db.execute(sql`
        INSERT INTO ext_html_parse_cache (html_hash, platform, page_kind, fields_json, model, created_at)
        VALUES (${hash}, ${body.platform_key}, ${body.page_kind}, ${JSON.stringify(parsed)}::jsonb, ${model}, NOW())
        ON CONFLICT (html_hash) DO NOTHING
      `);
    } catch (e) {
      console.warn('[habitat-html-parse] cache write failed:', e);
    }
  }

  return NextResponse.json({
    ok: true, cached: false, hash, fields: parsed ?? {}, model,
  } satisfies ParseResponse);
}
