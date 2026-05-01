// Phase 10 — Worker daemon. Cron-triggered batch:
//   1. Select cards trong 'approved' col + agent_kind set + squad.useAgentLoop=true
//   2. Filter out claude-code (chờ MCP) + human (queue human_tasks)
//   3. Per card:
//      a. Breaker check
//      b. Create agent_runs (status=running)
//      c. Build runAgent opts từ squad config + card
//      d. Run loop với onProgress streaming vào agent_runs
//      e. Optional peer review
//      f. Update agent_runs final state + advance card column
//
// Trigger: POST /api/cron/worker với x-cron-secret. Hourly hoặc 5-min cadence.
// Idempotency: check card.idempotency_key — skip nếu đã có completed run cùng key.

import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { runAgent } from './agent-runtime';
import { checkBreaker } from './circuit-breaker';
import { peerReview, pickReviewerKind } from './peer-review';
import type { ToolContext } from './toolkits/registry';
// Side-effect import: populates tool runtime registry before invokeTool calls.
import './toolkits';

interface CardRow {
  id: number;
  project_id: string;
  card_ref: string;
  title: string;
  body: string | null;
  squad_key: string;
  agent_kind: string;
  agent_ref: string | null;
  level: number;
  idempotency_key: string | null;
  col: string;
  dispatch_ready: boolean;
}

interface SquadConfig {
  systemPrompt?: string;
  skillsMd?: string;
  tools?: string[];
  model?: string;
  trustLevel?: 1 | 2 | 3 | 4;
  useAgentLoop?: boolean;
}

interface SquadRow {
  config: SquadConfig | null;
  squad_key: string;
  project_id: string;
}

export interface WorkerCycleReport {
  processed: number;
  skipped: number;
  failed: number;
  details: Array<{
    cardId: number;
    cardRef: string;
    status: 'ok' | 'skipped' | 'failed';
    runId?: number;
    reason?: string;
  }>;
}

export async function runWorkerCycle(maxCards: number = 5): Promise<WorkerCycleReport> {
  const db = getDb();
  if (!db) return { processed: 0, skipped: 0, failed: 0, details: [] };

  // Pick dispatch_ready cards với agent_kind dispatchable.
  // Mode-agnostic: KHÔNG dùng col vì mỗi mode (affiliate/sales/...) có column ID khác nhau.
  // Card form có toggle "Ready to dispatch" → set dispatch_ready=true.
  const cardRows = await db.execute(sql`
    SELECT c.id, c.project_id, c.card_ref, c.title, c.body, c.squad_key,
           c.agent_kind, c.agent_ref, c.level, c.idempotency_key, c.col, c.dispatch_ready
    FROM cards c
    WHERE c.tenant_id = 'self'
      AND c.archived_at IS NULL
      AND c.dispatch_ready = true
      AND c.agent_kind IS NOT NULL
      AND c.agent_kind NOT IN ('claude-code', 'human')
      AND NOT EXISTS (
        SELECT 1 FROM agent_runs ar
        WHERE ar.card_id = c.id
          AND ar.status IN ('running', 'completed')
          AND (c.idempotency_key IS NULL OR ar.idempotency_key = c.idempotency_key)
      )
    ORDER BY c.created_at ASC
    LIMIT ${maxCards}
  `);
  const cards = (cardRows as unknown as CardRow[]);
  const report: WorkerCycleReport = { processed: 0, skipped: 0, failed: 0, details: [] };

  for (const card of cards) {
    try {
      // Load squad config
      const squadRows = await db.execute(sql`
        SELECT config, squad_key, project_id FROM squads
        WHERE tenant_id = 'self' AND project_id = ${card.project_id} AND squad_key = ${card.squad_key}
        LIMIT 1
      `);
      const squad = (squadRows as unknown as SquadRow[])[0];
      if (!squad) {
        report.skipped++;
        report.details.push({ cardId: card.id, cardRef: card.card_ref, status: 'skipped', reason: 'squad not found' });
        continue;
      }

      const cfg = squad.config ?? {};
      if (!cfg.useAgentLoop) {
        report.skipped++;
        report.details.push({ cardId: card.id, cardRef: card.card_ref, status: 'skipped', reason: 'squad.useAgentLoop=false' });
        continue;
      }

      // Breaker check
      const breaker = await checkBreaker(card.agent_kind);
      if (!breaker.allowed) {
        report.skipped++;
        report.details.push({
          cardId: card.id, cardRef: card.card_ref, status: 'skipped',
          reason: `breaker paused until ${breaker.pausedUntil?.toISOString()}`,
        });
        continue;
      }

      // Pre-call gate check (will re-check per tool inside runtime).
      // Here just check kill switch + spend cap by gating against a "noop" read tool.
      // Skip granular check; runtime gates per-call.

      // Create agent_runs row (status=running)
      const runRows = await db.execute(sql`
        INSERT INTO agent_runs (
          tenant_id, project_id, card_id, agent_kind, agent_ref, status,
          started_at, timeout_at, input, idempotency_key, attempt
        ) VALUES (
          'self', ${card.project_id}, ${card.id}, ${card.agent_kind}, ${card.agent_ref ?? null},
          'running', NOW(), NOW() + INTERVAL '5 minutes',
          ${JSON.stringify({ cardRef: card.card_ref, title: card.title, body: card.body })}::jsonb,
          ${card.idempotency_key ?? null}, 1
        ) RETURNING id
      `);
      const run = (runRows as unknown as Array<{ id: number }>)[0]!;

      const ctx: ToolContext = {
        projectId: card.project_id,
        agentRunId: run.id,
        cardId: card.id,
        idempotencyKey: card.idempotency_key ?? `card-${card.id}`,
        trustDecision: 'allow',  // gate per-tool inside runtime via invokeTool
      };

      const systemPrompt = [cfg.systemPrompt, cfg.skillsMd].filter(Boolean).join('\n\n---\n\n');

      // Append hard tool-use instruction dựa trên tools available trong squad config.
      // Cheap models (gpt-4o-mini) thường skip persistence step nếu không buộc rõ.
      const toolHints: string[] = [];
      const tools = cfg.tools ?? [];
      if (tools.includes('save-knowledge')) {
        toolHints.push(
          `BẮT BUỘC: trước khi trả lời cuối cùng, gọi tool 'save-knowledge' với title rõ ràng + content tóm tắt kết quả + tags liên quan. KHÔNG được dừng loop nếu chưa gọi save-knowledge ít nhất 1 lần. Output cuối chỉ là 1 dòng confirm "Đã save knowledge #ID".`,
        );
      }
      if (tools.includes('web-search')) {
        toolHints.push(`Dùng web-search để tìm nguồn primary, rồi web-scrape (nếu cần) để đọc chi tiết. Đừng search lặp cùng query.`);
      }

      const userPrompt = [
        `Card #${card.card_ref}: ${card.title}`,
        '',
        card.body ?? '',
        '',
        toolHints.length > 0 ? '## Instructions\n' + toolHints.join('\n') : '',
      ].filter(Boolean).join('\n');

      const result = await runAgent({
        agentKind: card.agent_kind,
        systemPrompt: systemPrompt || `Bạn là agent thuộc squad ${card.squad_key}.`,
        userPrompt,
        toolIds: cfg.tools ?? [],
        ctx,
        onProgress: async (iter, partial) => {
          await db.execute(sql`
            UPDATE agent_runs SET
              tools_used = ${JSON.stringify(partial.toolsUsed)}::jsonb,
              tokens_in = ${partial.tokensIn},
              tokens_out = ${partial.tokensOut},
              cost_usd_cents = ${partial.costUsdCents},
              updated_at = NOW()
            WHERE id = ${run.id}
          `);
        },
      });

      // Optional peer review (only if agent succeeded + write/destroy side effect detected).
      // For simplicity: peer review whenever output non-trivial.
      let reviewJson: Record<string, unknown> | null = null;
      if (result.ok && result.output && result.output.length > 50) {
        const reviewer = pickReviewerKind(card.agent_kind);
        const review = await peerReview({
          reviewerKind: reviewer,
          taskDescription: userPrompt,
          agentKind: card.agent_kind,
          agentOutput: result.output,
        });
        reviewJson = { ...review };
      }

      // Final update. KHÔNG move column (mode-specific) — chỉ clear dispatch_ready
      // để worker không pick lại. User decide column transition theo project flow.
      const finalStatus = result.ok ? (reviewJson?.decision === 'reject' ? 'rejected' : 'completed') : 'failed';

      const peerReviewSqlValue = reviewJson ? JSON.stringify(reviewJson) : null;
      await db.execute(sql`
        UPDATE agent_runs SET
          status = ${finalStatus},
          completed_at = NOW(),
          duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
          output = ${JSON.stringify({ text: result.output, reason: result.reason })}::jsonb,
          tools_used = ${JSON.stringify(result.partial.toolsUsed)}::jsonb,
          tokens_in = ${result.partial.tokensIn},
          tokens_out = ${result.partial.tokensOut},
          cost_usd_cents = ${result.partial.costUsdCents},
          peer_review = ${peerReviewSqlValue}::jsonb,
          error = ${result.ok ? null : result.output},
          updated_at = NOW()
        WHERE id = ${run.id}
      `);

      // Clear dispatch flag — worker không re-pick. User toggle lại nếu cần re-run.
      await db.execute(sql`UPDATE cards SET dispatch_ready = false, updated_at = NOW() WHERE id = ${card.id}`);

      if (result.ok) {
        report.processed++;
        report.details.push({ cardId: card.id, cardRef: card.card_ref, status: 'ok', runId: run.id });
      } else {
        report.failed++;
        report.details.push({ cardId: card.id, cardRef: card.card_ref, status: 'failed', runId: run.id, reason: result.reason });
      }
    } catch (e) {
      report.failed++;
      report.details.push({ cardId: card.id, cardRef: card.card_ref, status: 'failed', reason: (e as Error).message });
    }
  }

  return report;
}
