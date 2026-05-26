'use server';

// Astrolas QA API bridge — call /api/v1/qa/answer endpoint Astrolas, save
// answer + sources vào cards. Khác với gpt-4o-mini generic, đây là
// Reasoning Engine của Astrolas (chart interpretation, data-backed).
//
// Spec: wiki/mos2/astrolas-qa-api-spec.md
//
// Fallback: nếu ASTROLAS_API_URL chưa cấu hình → return mock fixture để
// dev/staging test UI flow trước khi endpoint thật ready.

import { eq, sql } from 'drizzle-orm';
import { getDb, cards } from '@mos2/db';
import { getContentRules } from '@/lib/platform-rules';

export interface AstrolasSource {
  title: string;
  url: string;
  snippet?: string;
  type?: string;            // 'article' | 'interpretation' | 'chart_pattern' | ...
}

export interface AstrolasAnswerResult {
  ok: boolean;
  answerMd?: string;
  answerLang?: string;
  sources?: AstrolasSource[];
  confidence?: number;
  costUsd?: number;
  modelUsed?: string;
  warnings?: string[];
  error?: string;
  mock?: boolean;          // true nếu trả mock fixture (Astrolas API chưa config)
}

export async function getAstrolasAnswer(cardId: number): Promise<AstrolasAnswerResult> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL not configured' };

  // Load card + parent context + habitat
  const rows = await db.execute(sql`
    SELECT
      c.id, c.content_type, c.target_lang, c.parent_title, c.parent_body, c.parent_author,
      c.body_target,
      h.name AS habitat_name, h.language AS habitat_lang,
      h.voice_profile,
      pa.handle AS account_handle,
      p.label AS platform_label, p.key AS platform_key
    FROM cards c
    LEFT JOIN community_briefs b ON b.id = c.brief_id
    LEFT JOIN habitats h ON h.id = b.habitat_id
    LEFT JOIN platform_accounts pa ON pa.id = b.account_id
    LEFT JOIN platforms p ON p.key = pa.platform_key
    WHERE c.id = ${cardId}
    LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'Card not found' };

  const contentType = String(r.content_type ?? 'text');
  if (contentType !== 'comment' && contentType !== 'reply') {
    return { ok: false, error: 'Astrolas Answer chỉ hỗ trợ content_type comment/reply' };
  }

  const parentTitle = String(r.parent_title ?? '').trim();
  const parentBody = String(r.parent_body ?? '').trim();
  if (!parentBody) {
    return { ok: false, error: 'Cần parent_body (nội dung thread/post gốc) để Astrolas reasoning. Click "✨ AI parse" hoặc paste body trước.' };
  }

  const platformKey = String(r.platform_key ?? '').toLowerCase();
  const targetLang = String(r.target_lang ?? r.habitat_lang ?? 'en');
  const rules = getContentRules(platformKey, contentType);

  const payload = {
    question_title: parentTitle,
    question_body: parentBody.slice(0, 10000),
    question_lang: targetLang,
    platform: platformKey || 'reddit',
    subreddit: String(r.habitat_name ?? ''),
    tone_target: String(r.voice_profile ?? 'regular'),
    max_length: rules.bodyMax,
    persona_hint: r.account_handle ? String(r.account_handle) : null,
    request_id: `mos2-card-${cardId}`,
  };

  const apiUrl = process.env.ASTROLAS_API_URL;
  const apiKey = process.env.ASTROLAS_QA_KEY;

  // No config → mock fallback (dev/staging). Return realistic shape để UI test.
  if (!apiUrl || !apiKey) {
    return mockAnswer(cardId, payload);
  }

  // Real call
  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/v1/qa/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      // 30s timeout — Reasoning có thể chậm
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `Astrolas API ${res.status}: ${text.slice(0, 300)}` };
    }
    const data = await res.json() as {
      ok: boolean; answer_md?: string; answer_lang?: string;
      sources?: AstrolasSource[]; voice_signals?: { confidence?: number; data_backed?: boolean; model_used?: string; warnings?: string[] };
      cost_estimate_usd?: number; error?: string;
    };
    if (!data.ok || !data.answer_md) {
      return { ok: false, error: data.error ?? 'Astrolas trả empty answer' };
    }

    // Save vào card
    await db.update(cards).set({
      bodyTarget: data.answer_md,
      answerSource: 'astrolas',
      answerSources: data.sources ?? [],
      updatedAt: new Date(),
    }).where(eq(cards.id, cardId));

    return {
      ok: true,
      answerMd: data.answer_md,
      answerLang: data.answer_lang ?? targetLang,
      sources: data.sources ?? [],
      confidence: data.voice_signals?.confidence,
      costUsd: data.cost_estimate_usd,
      modelUsed: data.voice_signals?.model_used,
      warnings: data.voice_signals?.warnings ?? [],
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Mock fixture cho local dev / staging khi Astrolas chưa setup endpoint.
// Save với answerSource='astrolas-mock' để UI biết đây là fake data.
async function mockAnswer(
  cardId: number,
  payload: { question_title: string; question_body: string; question_lang: string; subreddit: string },
): Promise<AstrolasAnswerResult> {
  const db = getDb()!;
  const mock = {
    answer_md: `[MOCK ASTROLAS ANSWER]\n\nVề câu hỏi "${payload.question_title.slice(0, 60)}…" trong ${payload.subreddit}:\n\nĐây là response giả lập từ Astrolas Reasoning Engine (endpoint thật chưa cấu hình ASTROLAS_API_URL + ASTROLAS_QA_KEY).\n\nKhi production setup xong, response thật sẽ có:\n- Phân tích chart-based theo câu hỏi natal/transit\n- Citations từ Astrolas DB (sources[])\n- Multi-language output theo question_lang=${payload.question_lang}`,
    sources: [
      { title: '[MOCK] Sample Astrolas article', url: 'https://astrolas.com/mock/article', snippet: 'Sample snippet…', type: 'article' },
    ] as AstrolasSource[],
  };
  await db.update(cards).set({
    bodyTarget: mock.answer_md,
    answerSource: 'astrolas-mock',
    answerSources: mock.sources,
    updatedAt: new Date(),
  }).where(eq(cards.id, cardId));
  return {
    ok: true,
    answerMd: mock.answer_md,
    answerLang: payload.question_lang,
    sources: mock.sources,
    confidence: 0,
    costUsd: 0,
    modelUsed: 'mock',
    warnings: ['Mock response — ASTROLAS_API_URL chưa cấu hình. Setup .env.production để dùng endpoint thật.'],
    mock: true,
  };
}
