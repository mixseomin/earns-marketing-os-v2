// Tool runtime registry — maps library_tools.id → executable typed function.
// Foundation cho Phase 12 squad specialization. Mỗi toolkit module (research,
// publisher, creative, analytics) imports `register()` rồi declare tools.
//
// Pattern:
//   register('web-search', {
//     schema: z.object({ query: z.string(), limit: z.number().default(10) }),
//     output: z.object({ results: z.array(z.object({ title, url, snippet })) }),
//     sideEffect: 'read',
//     fn: async (input, ctx) => { ... },
//   });
//
// Agent runtime (lib/agent-runtime.ts, Phase 10) gọi via:
//   const result = await invokeTool('web-search', { query: '...' }, ctx);

import 'server-only';
import { z, type ZodSchema } from 'zod';

export type SideEffect = 'read' | 'write' | 'destroy';

export interface ToolContext {
  // Caller identity for audit + idempotency.
  projectId: string;
  agentRunId?: number;       // agent_runs.id, nếu invoke từ runtime loop
  cardId?: number;
  idempotencyKey?: string;
  // Trust gate output: ALLOW means execute, QUEUE_HUMAN means queue, DENY means reject.
  // Gate được apply BEFORE invoke; nếu QUEUE_HUMAN tool function không gọi.
  trustDecision?: 'allow' | 'queue_human' | 'deny';
}

export interface ToolDef<I = unknown, O = unknown> {
  id: string;                                // matches library_tools.id
  schema: ZodSchema<I>;                      // input validation
  output: ZodSchema<O>;                      // output schema (Zod) cho runtime validate
  sideEffect: SideEffect;
  fn: (input: I, ctx: ToolContext) => Promise<O>;
  // Optional: max duration before timeout (ms). Default 30s.
  timeoutMs?: number;
  // Optional: cost estimate per call (cents) cho budget pre-check.
  costEstimateCents?: number;
}

// In-memory registry. Populated khi toolkit modules import-side-effect register.
const REGISTRY = new Map<string, ToolDef>();

export function register<I, O>(def: ToolDef<I, O>): void {
  if (REGISTRY.has(def.id)) {
    throw new Error(`Tool '${def.id}' đã đăng ký. Mỗi tool ID phải unique.`);
  }
  REGISTRY.set(def.id, def as ToolDef);
}

export function getTool(id: string): ToolDef | undefined {
  return REGISTRY.get(id);
}

export function listRegisteredTools(): string[] {
  return Array.from(REGISTRY.keys()).sort();
}

// Invoke với schema validation + timeout + side-effect gate check.
// Caller (agent runtime) phải đảm bảo ctx.trustDecision đã set bởi gate.
export async function invokeTool<I = unknown, O = unknown>(
  toolId: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<{ ok: true; output: O } | { ok: false; error: string; reason?: 'unknown_tool' | 'invalid_input' | 'denied' | 'queue_human' | 'timeout' | 'invalid_output' | 'exec_error' }> {
  const def = REGISTRY.get(toolId) as ToolDef<I, O> | undefined;
  if (!def) return { ok: false, error: `Unknown tool '${toolId}'`, reason: 'unknown_tool' };

  // Trust gate enforcement
  if (ctx.trustDecision === 'deny') return { ok: false, error: 'denied by trust gate', reason: 'denied' };
  if (ctx.trustDecision === 'queue_human') return { ok: false, error: 'requires human handoff', reason: 'queue_human' };

  // Side-effect awareness: agent loop nên check before-call. Registry chỉ enforce
  // bằng cách document; gate logic ở caller (agent-runtime hoặc trust-gate module).

  // Input validation
  const parsed = def.schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: `invalid input: ${parsed.error.message}`, reason: 'invalid_input' };
  }

  // Timeout wrapper
  const timeoutMs = def.timeoutMs ?? 30_000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`tool ${toolId} timeout sau ${timeoutMs}ms`)), timeoutMs),
  );

  let raw: O;
  try {
    raw = await Promise.race([def.fn(parsed.data as I, ctx), timeoutPromise]);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('timeout')) return { ok: false, error: msg, reason: 'timeout' };
    return { ok: false, error: msg, reason: 'exec_error' };
  }

  // Output validation
  const outParsed = def.output.safeParse(raw);
  if (!outParsed.success) {
    return { ok: false, error: `invalid output: ${outParsed.error.message}`, reason: 'invalid_output' };
  }
  return { ok: true, output: outParsed.data };
}

// Re-export Zod cho toolkit modules dùng nhanh.
export { z };
