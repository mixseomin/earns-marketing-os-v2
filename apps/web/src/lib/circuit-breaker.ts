// Phase 10 — Circuit breaker per agent_kind.
// 5 fail liên tiếp / 10 phút → pause agent_kind globally 1h. Manual override
// qua admin panel sau (chưa có). Anti-runaway burn khi AI điên.
//
// Storage: in-memory Map (single Next.js process). Multi-instance scale sẽ
// move sang Redis hoặc DB key-value. Hiện solo nên in-memory đủ.

import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

interface BreakerState {
  pausedUntil: number;          // epoch ms; 0 = active
}

const FAILURE_WINDOW_MS = 10 * 60_000;   // 10 minutes
const FAILURE_THRESHOLD = 5;
const PAUSE_DURATION_MS = 60 * 60_000;   // 1 hour

const breakerStates = new Map<string, BreakerState>();

export interface BreakerCheckResult {
  allowed: boolean;
  pausedUntil?: Date;
  recentFailures?: number;
}

export async function checkBreaker(agentKind: string): Promise<BreakerCheckResult> {
  // 1. Check in-memory pause flag (fast path)
  const state = breakerStates.get(agentKind);
  if (state && state.pausedUntil > Date.now()) {
    return { allowed: false, pausedUntil: new Date(state.pausedUntil) };
  }

  // 2. Query DB recent failures (slow path, every call)
  const db = getDb();
  if (!db) return { allowed: true };

  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS fail_count
    FROM agent_runs
    WHERE agent_kind = ${agentKind}
      AND status IN ('failed', 'timed_out')
      AND created_at > NOW() - INTERVAL '10 minutes'
  `);
  const r = (rows as unknown as Array<{ fail_count: number }>)[0];
  const recentFailures = r?.fail_count ?? 0;

  if (recentFailures >= FAILURE_THRESHOLD) {
    const pausedUntil = Date.now() + PAUSE_DURATION_MS;
    breakerStates.set(agentKind, { pausedUntil });
    return { allowed: false, pausedUntil: new Date(pausedUntil), recentFailures };
  }
  return { allowed: true, recentFailures };
}

// Manual reset (admin override hoặc UI button later).
export function resetBreaker(agentKind: string): void {
  breakerStates.delete(agentKind);
}

export function listPausedKinds(): Array<{ agentKind: string; pausedUntil: Date }> {
  const now = Date.now();
  const out: Array<{ agentKind: string; pausedUntil: Date }> = [];
  for (const [kind, state] of breakerStates.entries()) {
    if (state.pausedUntil > now) out.push({ agentKind: kind, pausedUntil: new Date(state.pausedUntil) });
  }
  return out;
}
