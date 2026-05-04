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
import { getWorkflow, getNextStep, getStep, renderBodyTemplate } from './workflows';

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
  workflow_run_id: string | null;
  workflow_key: string | null;
  workflow_step: string | null;
  workflow_context: Record<string, unknown> | null;
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

  // Worker node registration: upsert heartbeat để Scheduler biết node này alive.
  const nodeId = process.env.WORKER_NODE_ID || require('os').hostname();
  const nodeLabel = process.env.WORKER_NODE_LABEL || nodeId;
  await db.execute(sql`
    INSERT INTO worker_nodes (id, label, status, last_heartbeat, updated_at)
    VALUES (${nodeId}, ${nodeLabel}, 'running', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      status = 'running', last_heartbeat = NOW(), updated_at = NOW()
  `).catch(() => {}); // ignore nếu table chưa tồn tại (fresh deploy)

  // Atomic claim: UPDATE...RETURNING với FOR UPDATE SKIP LOCKED.
  // Pattern chuẩn Postgres job queue — chỉ 1 worker claim được 1 card tại 1 thời điểm.
  // processing_since: stuck detection — card bị claim >15 phút → worker crash → re-claimable.
  const cardRows = await db.execute(sql`
    UPDATE cards SET processing_since = NOW(), updated_at = NOW()
    WHERE id IN (
      SELECT id FROM cards
      WHERE tenant_id = 'self'
        AND archived_at IS NULL
        AND dispatch_ready = true
        AND agent_kind IS NOT NULL
        AND agent_kind NOT IN ('claude-code', 'human')
        AND (processing_since IS NULL OR processing_since < NOW() - INTERVAL '15 minutes')
        AND NOT EXISTS (
          SELECT 1 FROM agent_runs ar
          WHERE ar.card_id = cards.id
            AND ar.status IN ('running', 'completed')
            AND (cards.idempotency_key IS NULL OR ar.idempotency_key = cards.idempotency_key)
        )
      ORDER BY created_at ASC
      LIMIT ${maxCards}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, project_id, card_ref, title, body, squad_key,
              agent_kind, agent_ref, level, idempotency_key, col, dispatch_ready,
              workflow_run_id, workflow_key, workflow_step, workflow_context
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

      // Layer 2: Project Brief — knowledge_items WHERE kind='playbook' AND tags @> ['project-brief']
      const briefRows = await db.execute(sql`
        SELECT content FROM knowledge_items
        WHERE tenant_id = 'self'
          AND project_id = ${card.project_id}
          AND kind = 'playbook'
          AND tags @> '["project-brief"]'::jsonb
        ORDER BY updated_at DESC LIMIT 1
      `);
      const projectBrief = (briefRows as unknown as Array<{ content: string }>)[0]?.content ?? null;

      // Layer 3: Squad Learnings — last 5 lessons tagged with squad_key
      const learningRows = await db.execute(sql`
        SELECT content FROM knowledge_items
        WHERE tenant_id = 'self'
          AND project_id = ${card.project_id}
          AND kind = 'lesson'
          AND tags @> ${JSON.stringify([card.squad_key])}::jsonb
        ORDER BY updated_at DESC LIMIT 5
      `);
      const squadLearnings = (learningRows as unknown as Array<{ content: string }>).map((r) => r.content);

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

      const systemPrompt = [
        cfg.systemPrompt,
        cfg.skillsMd,
        projectBrief ? `## Project Brief\n${projectBrief}` : null,
        squadLearnings.length > 0
          ? `## Squad Learnings (${card.squad_key})\n${squadLearnings.join('\n\n---\n\n')}`
          : null,
      ].filter(Boolean).join('\n\n---\n\n');

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

      // Post-run fallback: nếu squad có save-knowledge tool nhưng agent KHÔNG gọi
      // (hoặc gọi fail), worker tự save output làm knowledge entry. Đảm bảo
      // user luôn có 1 row tracking trong knowledge_items per successful run.
      const calledSaveOk = result.partial.toolsUsed.some((t) => t.toolId === 'save-knowledge' && t.ok);
      if (result.ok && !calledSaveOk && (cfg.tools ?? []).includes('save-knowledge') && result.output.trim().length > 100) {
        try {
          const fallbackTitle = `${card.title} — auto-saved`;
          const fallbackTags = ['auto-fallback', card.agent_kind, card.squad_key, ...(card.agent_ref ? [card.agent_ref] : [])];
          const insRows = await db.execute(sql`
            INSERT INTO knowledge_items (tenant_id, project_id, kind, title, content, tags, imported_from)
            VALUES ('self', ${card.project_id}, 'lesson', ${fallbackTitle}, ${result.output},
                    ${JSON.stringify(fallbackTags)}::jsonb, ${`agent-run-${run.id}-fallback`})
            RETURNING id
          `);
          const newId = (insRows as unknown as Array<{ id: number | string }>)[0]?.id;
          // Append to tools_used để UI link tới knowledge entry.
          result.partial.toolsUsed.push({
            toolId: 'save-knowledge',
            input: { fallback: true, title: fallbackTitle },
            output: { id: Number(newId), saved: true },
            durationMs: 0, ok: true,
          });
        } catch (e) {
          console.warn(`[worker] fallback save-knowledge failed: ${(e as Error).message}`);
        }
      }

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

      // Clear dispatch flag + processing lock — worker không re-pick.
      await db.execute(sql`UPDATE cards SET dispatch_ready = false, processing_since = NULL, updated_at = NOW() WHERE id = ${card.id}`);

      // Workflow chain — nếu card thuộc workflow + có next step → spawn next card.
      if (result.ok && card.workflow_key && card.workflow_step && card.workflow_run_id) {
        const prevCtx = (card.workflow_context ?? {}) as Record<string, unknown>;
        // Revise routing: write step + skip_design → jump thẳng tới publish (giữ ảnh cũ).
        // Tiết kiệm DALL-E credit khi feedback chỉ về text.
        let next = getNextStep(card.workflow_key, card.workflow_step);
        if (card.workflow_step === 'write' && prevCtx.revise_skip_design === true) {
          next = getStep(card.workflow_key, 'publish');
        }
        if (next) {
          const stepOutput = result.output;
          // Pluck saved knowledge content + media URL for context.
          const savedKnowledgeContents: string[] = [];
          let savedImageUrl: string | null = null;
          let savedImageAssetId: number | null = null;
          for (const t of result.partial.toolsUsed) {
            if (t.toolId === 'save-knowledge' && t.ok && t.output && typeof t.output === 'object') {
              const id = (t.output as { id?: number }).id;
              if (id) {
                const krows = await db.execute(sql`SELECT content FROM knowledge_items WHERE id = ${id} LIMIT 1`);
                const k = (krows as unknown as Array<{ content: string }>)[0];
                if (k) savedKnowledgeContents.push(k.content);
              }
            }
            if ((t.toolId === 'image-gen') && t.ok && t.output && typeof t.output === 'object') {
              const out = t.output as { url?: string; mediaAssetId?: number };
              if (out.url) savedImageUrl = out.url;
              if (out.mediaAssetId) savedImageAssetId = out.mediaAssetId;
            }
          }

          const nextCtx: Record<string, unknown> = { ...prevCtx };
          // Map step outputs theo step name.
          if (card.workflow_step === 'plan') {
            nextCtx.plan = savedKnowledgeContents.join('\n\n---\n\n') || stepOutput;
            // Try parse imageConcept block
            const concept = (savedKnowledgeContents[0] ?? stepOutput).match(/##\s*Image concept[\s\S]*?\n([\s\S]*?)(?=\n##|\n\n|$)/);
            nextCtx.imageConcept = concept?.[1]?.trim() ?? '';
          }
          if (card.workflow_step === 'write') {
            nextCtx.post = savedKnowledgeContents.join('\n\n---\n\n') || stepOutput;
          }
          if (card.workflow_step === 'design') {
            if (savedImageUrl) nextCtx.imageUrl = savedImageUrl;
            if (savedImageAssetId) nextCtx.imageAssetId = savedImageAssetId;
          }

          const nextBody = renderBodyTemplate(next.bodyTemplate, nextCtx);
          const runShort = card.workflow_run_id.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-5);
          const nextRef = `${runShort}-${next.stepKey.toUpperCase().slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`;

          // Title gốc: tách phần cuối khỏi prefix step labels của các lần spawn trước.
          // Vd "🎨 Design — ✍️ Write — 🧭 Plan — Reddit launch Orit" → "Reddit launch Orit"
          const titleParts = card.title.split(' — ');
          const rootTitle = titleParts[titleParts.length - 1] ?? card.title;
          await db.execute(sql`
            INSERT INTO cards (
              tenant_id, project_id, card_ref, col, title, body,
              squad_key, level, due, agent_kind, dispatch_ready, idempotency_key,
              workflow_run_id, workflow_key, workflow_step, workflow_context, tags
            ) VALUES (
              'self', ${card.project_id}, ${nextRef}, ${card.col},
              ${`${next.label} — ${rootTitle}`}, ${nextBody},
              ${next.squadKey}, ${next.trustLevel}, 'NOW',
              ${next.agentKind}, true,
              ${`${card.workflow_run_id}-${next.stepKey}`},
              ${card.workflow_run_id}, ${card.workflow_key}, ${next.stepKey},
              ${JSON.stringify(nextCtx)}::jsonb,
              ${JSON.stringify([`workflow:${card.workflow_key}`, `step:${next.stepKey}`])}::jsonb
            )
          `);
          // Self-kick: trigger worker endpoint để pick card vừa spawn ngay,
          // không chờ cron tick. Fire-and-forget, không block return.
          const cronSecret = process.env.MOS2_CRON_SECRET || process.env.CRON_SECRET;
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mos2.on.tc';
          if (cronSecret) {
            fetch(`${baseUrl}/api/cron/worker?limit=1`, {
              method: 'POST', headers: { 'x-cron-secret': cronSecret },
            }).catch(() => {});
          }
        }
      }

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
      // Release lock ngay cả khi crash — tránh card bị stuck 15 phút.
      await db.execute(sql`UPDATE cards SET processing_since = NULL, updated_at = NOW() WHERE id = ${card.id}`).catch(() => {});
    }
  }

  // Worker heartbeat: update status → idle sau khi xong cycle.
  await db.execute(sql`
    UPDATE worker_nodes SET
      status = 'idle',
      last_cycle_at = NOW(),
      last_cycle_report = ${JSON.stringify(report)}::jsonb,
      current_card_ids = '[]'::jsonb,
      updated_at = NOW()
    WHERE id = ${nodeId}
  `).catch(() => {});

  return report;
}
