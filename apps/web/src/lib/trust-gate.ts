// Phase 10 — Trust gate middleware. Mọi tool call qua agent runtime PHẢI đi qua
// gate(). Output 1 trong 3:
//   ALLOW       → tool runs ngay (read action / pre-approved L1+L2 templates)
//   QUEUE_HUMAN → tạo human_tasks, agent runtime treat as paused
//   DENY        → reject hoàn toàn (kill switch, destroy action, budget exceeded)
//
// Trust matrix L1-L4 hardcoded v1. Configurable later qua trust_thresholds table.
//
// 4 sources of veto (chỉ cần 1 → DENY hoặc QUEUE_HUMAN):
//   1. Kill switch active (system_settings flag)
//   2. Daily spend cap exceeded cho project
//   3. Side effect vs trust level (ma trận)
//   4. Platform autoPostSupported=false → publisher tools auto-queue human

import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getTool, type SideEffect } from './toolkits/registry';

export type Decision = 'allow' | 'queue_human' | 'deny';

export interface GateInput {
  agentKind: string;            // 'gpt-4o-mini' | 'claude-haiku-4-5' | etc
  agentRef?: string;            // 'RES-04'
  trustLevel: 1 | 2 | 3 | 4;    // from squad.config.trustLevel
  toolId: string;               // tool đang muốn invoke
  toolInput: unknown;
  context: {
    projectId: string;
    cardId?: number;
    estimatedCostCents?: number;  // estimate trước call để compare cap
  };
}

export interface GateResult {
  decision: Decision;
  reason: string;
  detail?: Record<string, unknown>;
}

// In-memory kill switch fallback (DB query mỗi call quá nặng).
// Cache 30s. Production sẽ dùng pub/sub revalidate.
let killSwitchCache: { value: boolean; fetchedAt: number } | null = null;
const KILL_CACHE_TTL_MS = 30_000;

async function isKillSwitchActive(): Promise<boolean> {
  if (killSwitchCache && Date.now() - killSwitchCache.fetchedAt < KILL_CACHE_TTL_MS) {
    return killSwitchCache.value;
  }
  const db = getDb();
  if (!db) return false;
  // For now, use env var. Future: settings table key 'kill_switch'.
  const value = process.env.MOS2_KILL_SWITCH === '1';
  killSwitchCache = { value, fetchedAt: Date.now() };
  return value;
}

// Check daily spend cap via aggregated agent_runs cost today.
async function checkSpendCap(projectId: string, additionalCents: number): Promise<{ within: boolean; spent: number; cap: number }> {
  const db = getDb();
  if (!db) return { within: true, spent: 0, cap: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.execute(sql`
    SELECT
      COALESCE((SELECT cap_usd_cents FROM daily_spend_caps
                WHERE tenant_id = 'self' AND day = ${today}
                  AND (project_id = ${projectId} OR project_id IS NULL)
                ORDER BY project_id DESC NULLS LAST LIMIT 1), 0) AS cap,
      COALESCE((SELECT SUM(cost_usd_cents)::int FROM agent_runs
                WHERE tenant_id = 'self' AND project_id = ${projectId}
                  AND created_at::date = ${today}::date), 0) AS spent
  `);
  const r = (rows as unknown as Array<{ cap: number; spent: number }>)[0];
  if (!r || r.cap === 0) return { within: true, spent: r?.spent ?? 0, cap: 0 };  // 0 = unlimited
  return { within: r.spent + additionalCents <= r.cap, spent: r.spent, cap: r.cap };
}

// Trust matrix: side effect × trust level → decision.
// L1 AUTO: read OK. write OK if pre-approved (assumed when trustLevel=1 set explicitly). destroy → DENY.
// L2 NOTIFY: read OK, write OK + log. destroy → DENY.
// L3 APPROVE: read OK. write/destroy → QUEUE_HUMAN.
// L4 ESCALATE: anything except read → QUEUE_HUMAN.
function trustMatrix(side: SideEffect, trust: 1 | 2 | 3 | 4): Decision {
  if (side === 'read') return 'allow';
  if (side === 'destroy') {
    return trust >= 3 ? 'queue_human' : 'deny';  // L1+L2 không được destroy ngay cả khi pre-approved
  }
  // write
  if (trust <= 2) return 'allow';
  return 'queue_human';
}

export async function gate(input: GateInput): Promise<GateResult> {
  // 1. Kill switch
  if (await isKillSwitchActive()) {
    return { decision: 'deny', reason: 'kill switch active', detail: { source: 'env MOS2_KILL_SWITCH' } };
  }

  // 2. Tool exists?
  const tool = getTool(input.toolId);
  if (!tool) {
    return { decision: 'deny', reason: `tool '${input.toolId}' not registered`, detail: { reason: 'unknown_tool' } };
  }

  // 3. Spend cap
  const additionalCents = input.context.estimatedCostCents ?? tool.costEstimateCents ?? 0;
  const cap = await checkSpendCap(input.context.projectId, additionalCents);
  if (!cap.within) {
    return {
      decision: 'deny',
      reason: `daily spend cap exceeded`,
      detail: { spentCents: cap.spent, capCents: cap.cap, additionalCents },
    };
  }

  // 4. Trust matrix vs side effect
  const matrixDecision = trustMatrix(tool.sideEffect, input.trustLevel);
  if (matrixDecision !== 'allow') {
    return {
      decision: matrixDecision,
      reason: `trust L${input.trustLevel} + ${tool.sideEffect} action`,
      detail: { sideEffect: tool.sideEffect, trustLevel: input.trustLevel },
    };
  }

  return { decision: 'allow', reason: 'all checks passed' };
}
