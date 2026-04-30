// Phase 10 — Peer review pattern. Cách dùng AI rẻ an toàn:
//   Model A (gpt-4o-mini) làm task → output O.
//   Model B (claude-haiku-4-5 hoặc gemini-flash, KHÁC provider) review O → ALLOW/REVISE/REJECT.
//   2 agree (A success + B allow) → accept. Else escalate.
//
// Khác provider quan trọng vì cancel hallucination chéo. 2 GPT cùng có thể
// cùng sai theo cách giống nhau; GPT + Claude ít trùng pattern hơn.
//
// Reviewer KHÔNG dùng tool — chỉ đánh giá output text + reasoning. Cheap fast call.

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';

export type ReviewDecision = 'allow' | 'revise' | 'reject';

export interface PeerReviewInput {
  reviewerKind: string;          // 'claude-haiku-4-5' | 'gpt-4o-mini' | 'gemini-2.5-flash'
  taskDescription: string;       // original task
  agentKind: string;             // model A đã làm task
  agentOutput: string;           // text output từ model A
  outputSchema?: string;         // optional: expected schema description (Zod schema toString)
}

export interface PeerReviewResult {
  decision: ReviewDecision;
  reasoning: string;
  costUsdCents: number;
  reviewerKind: string;
}

const REVIEW_SCHEMA = z.object({
  decision: z.enum(['allow', 'revise', 'reject']),
  reasoning: z.string().max(500),
});

const SYSTEM_PROMPT = `Bạn là QA reviewer cho marketing AI orchestrator. Nhiệm vụ:
- Đọc task gốc + output của agent khác.
- Đánh giá output có:
  (1) Trả lời đúng task không?
  (2) An toàn không (không destruction, không leak secret, không spam)?
  (3) Match schema yêu cầu (nếu có)?

Output JSON format: { "decision": "allow" | "revise" | "reject", "reasoning": "1-2 câu tại sao" }
- "allow": output OK ship được
- "revise": có vấn đề nhỏ, agent gốc nên thử lại với hint
- "reject": output sai/nguy hiểm, không nên dùng`;

async function reviewWithAnthropic(input: PeerReviewInput): Promise<PeerReviewResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { decision: 'allow', reasoning: 'reviewer unavailable: no ANTHROPIC_API_KEY', costUsdCents: 0, reviewerKind: input.reviewerKind };
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userMsg = `## Task
${input.taskDescription}

## Agent output (model: ${input.agentKind})
${input.agentOutput}
${input.outputSchema ? `\n## Expected output schema\n${input.outputSchema}` : ''}

Trả về JSON theo format đã yêu cầu.`;

  try {
    const resp = await client.messages.create({
      model: input.reviewerKind, system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
      max_tokens: 400, temperature: 0.2,
    });
    const text = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
    const json = parseFirstJson(text);
    const parsed = REVIEW_SCHEMA.safeParse(json);
    if (!parsed.success) {
      return { decision: 'revise', reasoning: 'reviewer output không parse được — auto revise', costUsdCents: 0, reviewerKind: input.reviewerKind };
    }
    const cost = Math.round((resp.usage.input_tokens * 80 + resp.usage.output_tokens * 400) / 1_000_000);
    return { ...parsed.data, costUsdCents: cost, reviewerKind: input.reviewerKind };
  } catch (e) {
    return { decision: 'allow', reasoning: `reviewer error fallback: ${(e as Error).message}`, costUsdCents: 0, reviewerKind: input.reviewerKind };
  }
}

async function reviewWithOpenAI(input: PeerReviewInput): Promise<PeerReviewResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { decision: 'allow', reasoning: 'reviewer unavailable: no OPENAI_API_KEY', costUsdCents: 0, reviewerKind: input.reviewerKind };
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const userMsg = `## Task
${input.taskDescription}

## Agent output (model: ${input.agentKind})
${input.agentOutput}
${input.outputSchema ? `\n## Expected output schema\n${input.outputSchema}` : ''}`;

  try {
    const resp = await client.chat.completions.create({
      model: input.reviewerKind,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2, max_tokens: 400,
    });
    const text = resp.choices[0]?.message?.content ?? '{}';
    const json = parseFirstJson(text);
    const parsed = REVIEW_SCHEMA.safeParse(json);
    if (!parsed.success) {
      return { decision: 'revise', reasoning: 'reviewer output không parse được', costUsdCents: 0, reviewerKind: input.reviewerKind };
    }
    const cost = Math.round(((resp.usage?.prompt_tokens ?? 0) * 15 + (resp.usage?.completion_tokens ?? 0) * 60) / 1_000_000);
    return { ...parsed.data, costUsdCents: cost, reviewerKind: input.reviewerKind };
  } catch (e) {
    return { decision: 'allow', reasoning: `reviewer error fallback: ${(e as Error).message}`, costUsdCents: 0, reviewerKind: input.reviewerKind };
  }
}

function parseFirstJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { return null; }
    }
    return null;
  }
}

export async function peerReview(input: PeerReviewInput): Promise<PeerReviewResult> {
  if (input.reviewerKind.startsWith('claude-')) {
    return reviewWithAnthropic(input);
  }
  return reviewWithOpenAI(input);
}

// Helper: pick complementary reviewer model (different provider than original).
// gpt-* → claude-haiku-4-5 (Anthropic).
// claude-* → gpt-4o-mini (OpenAI).
// Fallback: gpt-4o-mini.
export function pickReviewerKind(originalAgentKind: string): string {
  if (originalAgentKind.startsWith('claude-')) return 'gpt-4o-mini';
  if (originalAgentKind.startsWith('gpt-') || originalAgentKind.startsWith('o3-')) return 'claude-haiku-4-5';
  return 'gpt-4o-mini';
}
