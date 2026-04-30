// Phase 10 — Playbook DAG resolver.
// Step output → next step input qua JSONPath-like template.
//
// Step definition (stored in playbooks.steps jsonb):
//   {
//     id: 'research',
//     action: 'agent' | 'human',
//     agentKind?: 'claude-haiku-4-5',
//     agentRef?: 'RES-04',
//     trustRequired: 1|2|3|4,
//     dependsOn: ['previousStep'],     // step IDs phải completed trước
//     inputMapping: { topic: '$.input.niche', context: '$.steps.research.output.summary' },
//     outputSchema: { type: 'object', properties: {...} },  // JSON schema (or Zod stringified)
//     retry: { max: 3, backoffMs: 1000 },
//     timeoutSec: 300,
//   }
//
// Use cases:
//   - resolveStepInputs: thay placeholders before exec.
//   - topologicalSort: detect cycles, return execution order.
//   - validateStepOutput: schema check after exec.

import 'server-only';

export interface PlaybookStep {
  id: string;
  action: 'agent' | 'human';
  agentKind?: string;
  agentRef?: string;
  trustRequired: 1 | 2 | 3 | 4;
  dependsOn?: string[];
  inputMapping?: Record<string, string>;        // placeholder → JSONPath
  outputSchema?: unknown;
  retry?: { max: number; backoffMs: number };
  timeoutSec?: number;
}

export interface CompletedStep {
  id: string;
  output: Record<string, unknown>;
  artifacts?: Array<Record<string, unknown>>;
}

export interface PlaybookContext {
  input: Record<string, unknown>;                // playbook-level inputs
  steps: Record<string, CompletedStep>;          // by step id
}

// Resolve "$.input.foo" / "$.steps.research.output.bar" / "$.steps.research.artifacts[0].path"
function resolvePath(path: string, ctx: PlaybookContext): unknown {
  if (!path.startsWith('$.')) return path;       // literal value passthrough
  const parts = path.slice(2).split(/\.|\[|\]/).filter(Boolean);
  let cur: unknown = ctx;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    const idx = Number(part);
    if (Number.isFinite(idx) && Array.isArray(cur)) {
      cur = cur[idx];
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function resolveStepInputs(step: PlaybookStep, ctx: PlaybookContext): Record<string, unknown> {
  if (!step.inputMapping) return {};
  const result: Record<string, unknown> = {};
  for (const [key, path] of Object.entries(step.inputMapping)) {
    result[key] = resolvePath(path, ctx);
  }
  return result;
}

// Kahn's algorithm — topological sort with cycle detection.
// Returns ordered execution list. Throws if cycle detected.
export function topologicalSort(steps: PlaybookStep[]): PlaybookStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const s of steps) {
    inDegree.set(s.id, 0);
    adj.set(s.id, []);
  }
  for (const s of steps) {
    for (const dep of s.dependsOn ?? []) {
      if (!byId.has(dep)) throw new Error(`step '${s.id}' depends on unknown '${dep}'`);
      adj.get(dep)!.push(s.id);
      inDegree.set(s.id, (inDegree.get(s.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
  const ordered: PlaybookStep[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    ordered.push(byId.get(id)!);
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  if (ordered.length !== steps.length) {
    const remaining = steps.filter((s) => !ordered.includes(s)).map((s) => s.id);
    throw new Error(`playbook has cycle involving steps: ${remaining.join(', ')}`);
  }
  return ordered;
}

// Step ready? all deps in completedRuns.
export function isStepReady(step: PlaybookStep, ctx: PlaybookContext): boolean {
  for (const dep of step.dependsOn ?? []) {
    if (!ctx.steps[dep]) return false;
  }
  return true;
}
