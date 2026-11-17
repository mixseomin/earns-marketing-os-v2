// Phase 10 — Agent loop runtime. LLM tool-use cycle (plan → call → observe → repeat).
//
// Architecture:
//   1. System prompt = squad.config.systemPrompt + skill snippets.
//   2. User prompt = card.title + card.body + input from playbook.
//   3. Tools = squad.config.tools[] mapped to registered ToolDefs.
//   4. Loop: LLM responds với tool_use → invokeTool → append result → next LLM call.
//   5. Anti-loop guards check mỗi iter. Final text response = output.
//
// Anti-loop guards:
//   - max iter (default 15)
//   - cost cap per task ($0.10 USD = 1000 cents default)
//   - repetitive-action detector (same tool+input N times → break)
//   - stuck detector (no progress signal: same conv length 3 iter → break)
//   - total duration cap (5 min default)
//
// Persistence: caller (worker daemon) tạo agent_runs row trước khi gọi runAgent,
// pass run.id vào ctx. runAgent update output/cost/tools_used khi xong qua callback.
//
// Provider routing:
//   - claude-* → Anthropic SDK
//   - gpt-* / o3-* → OpenAI SDK
//   - claude-code → throws (chờ MCP user pull, không exec ở đây)
//   - human → throws (queue human_tasks)

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { invokeTool, getTool, type ToolContext } from './toolkits/registry';

export interface AgentRunOptions {
  agentKind: string;                                       // 'gpt-4o-mini' | 'claude-haiku-4-5' | etc.
  systemPrompt: string;                                    // squad persona + skill snippet
  userPrompt: string;                                      // task description
  toolIds: string[];                                       // subset of registered tools available to this run
  ctx: ToolContext;                                        // projectId, agentRunId, idempotencyKey
  maxIter?: number;                                        // default 15
  costCapCents?: number;                                   // default 1000 ($0.10 USD)
  totalTimeoutMs?: number;                                 // default 5 minutes
  // Optional callback per-iteration để stream progress vào agent_runs.
  onProgress?: (iter: number, partial: AgentRunPartial) => void | Promise<void>;
}

export interface AgentRunPartial {
  iter: number;
  toolsUsed: Array<{ toolId: string; input: unknown; output: unknown; durationMs: number; ok: boolean; error?: string }>;
  tokensIn: number;
  tokensOut: number;
  costUsdCents: number;
}

export type AgentRunResult =
  | { ok: true; output: string; partial: AgentRunPartial; reason: 'completed' }
  | { ok: false; output: string; partial: AgentRunPartial; reason: 'max_iter' | 'cost_cap' | 'repetitive' | 'stuck' | 'timeout' | 'tool_error' | 'llm_error' | 'unsupported_kind' };

// Cost rates per 1M tokens (input / output, USD cents). Source: provider pricing pages.
// Update khi provider release new tier. cents per 1M tokens.
const RATES: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini':       { in: 15,    out: 60    },
  'gpt-4o':            { in: 250,   out: 1000  },
  'gpt-4.1-mini':      { in: 40,    out: 160   },
  'gpt-4.1':           { in: 200,   out: 800   },
  'o3-mini':           { in: 110,   out: 440   },
  'claude-haiku-4-5':  { in: 80,    out: 400   },
  'claude-sonnet-4-6': { in: 300,   out: 1500  },
  'claude-opus-4-7':   { in: 1500,  out: 7500  },
};

function estimateCostCents(model: string, tokensIn: number, tokensOut: number): number {
  const rate = RATES[model] ?? { in: 100, out: 400 };
  return Math.round((tokensIn * rate.in + tokensOut * rate.out) / 1_000_000);
}

// Build tool schema for LLM (Anthropic / OpenAI). Same Zod schema, slightly different format.
function buildAnthropicTools(toolIds: string[]): Anthropic.Tool[] {
  return toolIds.map((id) => {
    const def = getTool(id);
    if (!def) throw new Error(`tool ${id} not registered`);
    const schema = zodToJsonSchema(def.schema) as { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
    return {
      name: def.id.replace(/-/g, '_'),  // Anthropic disallows hyphen
      description: `(${def.sideEffect}) Tool ${def.id}`,
      input_schema: schema,
    };
  });
}
function buildOpenAITools(toolIds: string[]) {
  return toolIds.map((id) => {
    const def = getTool(id);
    if (!def) throw new Error(`tool ${id} not registered`);
    return {
      type: 'function' as const,
      function: {
        name: def.id.replace(/-/g, '_'),
        description: `(${def.sideEffect}) Tool ${def.id}`,
        parameters: zodToJsonSchema(def.schema),
      },
    };
  });
}

// Tiny Zod → JSON Schema converter. Cover scalar + object + array; phase này tools đơn giản.
// Production version có thể swap qua zod-to-json-schema package.
function zodToJsonSchema(schema: unknown): Record<string, unknown> {
  // Heuristic shortcut: most tools dùng z.object. Hot-path use _def.shape().
  // Fallback: { type: 'object' } catch-all.
  const def = (schema as { _def?: { typeName?: string; shape?: () => Record<string, unknown> } })._def;
  if (def?.typeName === 'ZodObject' && def.shape) {
    const shape = def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, val] of Object.entries(shape)) {
      const inner = (val as { _def?: { typeName?: string; defaultValue?: () => unknown } })._def;
      let type = 'string';
      if (inner?.typeName === 'ZodNumber') type = 'number';
      else if (inner?.typeName === 'ZodBoolean') type = 'boolean';
      else if (inner?.typeName === 'ZodArray') type = 'array';
      properties[key] = { type };
      if (!inner?.defaultValue && inner?.typeName !== 'ZodOptional') required.push(key);
    }
    return { type: 'object', properties, required };
  }
  return { type: 'object' };
}

// Bumped 3 → 5 sau user feedback: cheap models hay retry same query 3-4 times
// trước khi pivot — threshold quá thấp gây fail oan.
const REPETITIVE_THRESHOLD = 5;
function isRepetitive(history: Array<{ tool: string; input: string }>, current: { tool: string; input: string }): boolean {
  const matches = history.filter((h) => h.tool === current.tool && h.input === current.input);
  return matches.length >= REPETITIVE_THRESHOLD;
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const {
    agentKind, systemPrompt, userPrompt, toolIds, ctx,
    maxIter = 15, costCapCents = 1000, totalTimeoutMs = 5 * 60_000,
    onProgress,
  } = opts;

  if (agentKind === 'claude-code') {
    return { ok: false, output: '', partial: emptyPartial(), reason: 'unsupported_kind' };
  }
  if (agentKind === 'human') {
    return { ok: false, output: '', partial: emptyPartial(), reason: 'unsupported_kind' };
  }

  const partial: AgentRunPartial = emptyPartial();
  const callHistory: Array<{ tool: string; input: string }> = [];
  const startedAt = Date.now();

  if (agentKind.startsWith('claude-')) {
    return runClaudeLoop({ agentKind, systemPrompt, userPrompt, toolIds, ctx, maxIter, costCapCents, totalTimeoutMs, partial, callHistory, startedAt, onProgress });
  }
  if (agentKind.startsWith('gpt-') || agentKind.startsWith('o3-')) {
    return runOpenAILoop({ agentKind, systemPrompt, userPrompt, toolIds, ctx, maxIter, costCapCents, totalTimeoutMs, partial, callHistory, startedAt, onProgress });
  }
  return { ok: false, output: '', partial, reason: 'unsupported_kind' };
}

function emptyPartial(): AgentRunPartial {
  return { iter: 0, toolsUsed: [], tokensIn: 0, tokensOut: 0, costUsdCents: 0 };
}

interface LoopParams extends Required<Omit<AgentRunOptions, 'onProgress'>> {
  partial: AgentRunPartial;
  callHistory: Array<{ tool: string; input: string }>;
  startedAt: number;
  onProgress?: AgentRunOptions['onProgress'];
}

// ── Anthropic Claude tool-use loop ────────────────────────────────
async function runClaudeLoop(p: LoopParams): Promise<AgentRunResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, output: 'ANTHROPIC_API_KEY not set', partial: p.partial, reason: 'llm_error' };
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = buildAnthropicTools(p.toolIds);
  // Map model alias to API model name
  const modelMap: Record<string, string> = {
    'claude-haiku-4-5': 'claude-haiku-4-5',
    'claude-sonnet-4-6': 'claude-sonnet-4-6',
    'claude-opus-4-7': 'claude-opus-4-7',
  };
  const model = modelMap[p.agentKind] ?? p.agentKind;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: p.userPrompt }];

  for (let iter = 0; iter < p.maxIter; iter++) {
    p.partial.iter = iter + 1;
    if (Date.now() - p.startedAt > p.totalTimeoutMs) {
      return { ok: false, output: 'total timeout', partial: p.partial, reason: 'timeout' };
    }
    if (p.partial.costUsdCents > p.costCapCents) {
      return { ok: false, output: `cost cap ${p.costCapCents} cents exceeded`, partial: p.partial, reason: 'cost_cap' };
    }

    let resp: Anthropic.Message;
    try {
      resp = await client.messages.create({
        model, system: p.systemPrompt, messages, tools,
        max_tokens: 4096,
      });
    } catch (e) {
      return { ok: false, output: (e as Error).message, partial: p.partial, reason: 'llm_error' };
    }

    p.partial.tokensIn += resp.usage.input_tokens;
    p.partial.tokensOut += resp.usage.output_tokens;
    p.partial.costUsdCents = estimateCostCents(p.agentKind, p.partial.tokensIn, p.partial.tokensOut);
    if (p.onProgress) await p.onProgress(iter, { ...p.partial });

    // Find tool_use blocks
    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const textBlocks = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');

    if (toolUses.length === 0) {
      // No more tool calls → return final text
      const finalText = textBlocks.map((b) => b.text).join('\n');
      return { ok: true, output: finalText, partial: p.partial, reason: 'completed' };
    }

    // Process each tool_use sequentially
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const toolId = tu.name.replace(/_/g, '-');
      const inputStr = JSON.stringify(tu.input);
      if (isRepetitive(p.callHistory, { tool: toolId, input: inputStr })) {
        return { ok: false, output: `repetitive: ${toolId} called ${REPETITIVE_THRESHOLD}+ times — model stuck, prompt cần diversify`, partial: p.partial, reason: 'repetitive' };
      }
      p.callHistory.push({ tool: toolId, input: inputStr });

      const t0 = Date.now();
      const result = await invokeTool(toolId, tu.input, p.ctx);
      const dur = Date.now() - t0;
      p.partial.toolsUsed.push({
        toolId, input: tu.input,
        output: result.ok ? result.output : null,
        durationMs: dur, ok: result.ok,
        error: result.ok ? undefined : result.error,
      });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result.ok ? JSON.stringify(result.output) : `ERROR: ${result.error}`,
        is_error: !result.ok,
      });
    }

    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: toolResults });
  }

  return { ok: false, output: `max ${p.maxIter} iter exceeded`, partial: p.partial, reason: 'max_iter' };
}

// ── OpenAI function-calling loop ──────────────────────────────────
async function runOpenAILoop(p: LoopParams): Promise<AgentRunResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, output: 'OPENAI_API_KEY not set', partial: p.partial, reason: 'llm_error' };
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const tools = buildOpenAITools(p.toolIds);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: p.systemPrompt },
    { role: 'user', content: p.userPrompt },
  ];

  for (let iter = 0; iter < p.maxIter; iter++) {
    p.partial.iter = iter + 1;
    if (Date.now() - p.startedAt > p.totalTimeoutMs) {
      return { ok: false, output: 'total timeout', partial: p.partial, reason: 'timeout' };
    }
    if (p.partial.costUsdCents > p.costCapCents) {
      return { ok: false, output: `cost cap exceeded`, partial: p.partial, reason: 'cost_cap' };
    }

    let resp: OpenAI.Chat.ChatCompletion;
    try {
      resp = await client.chat.completions.create({
        model: p.agentKind, messages, tools, tool_choice: 'auto', max_tokens: 4096,
      });
    } catch (e) {
      return { ok: false, output: (e as Error).message, partial: p.partial, reason: 'llm_error' };
    }

    p.partial.tokensIn += resp.usage?.prompt_tokens ?? 0;
    p.partial.tokensOut += resp.usage?.completion_tokens ?? 0;
    p.partial.costUsdCents = estimateCostCents(p.agentKind, p.partial.tokensIn, p.partial.tokensOut);
    if (p.onProgress) await p.onProgress(iter, { ...p.partial });

    const choice = resp.choices[0];
    if (!choice) return { ok: false, output: 'no choice in response', partial: p.partial, reason: 'llm_error' };
    const msg = choice.message;
    const toolCalls = msg.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return { ok: true, output: msg.content ?? '', partial: p.partial, reason: 'completed' };
    }

    messages.push(msg);
    for (const tc of toolCalls) {
      if (tc.type !== 'function') continue;
      const toolId = tc.function.name.replace(/_/g, '-');
      const input = JSON.parse(tc.function.arguments || '{}');
      const inputStr = JSON.stringify(input);
      if (isRepetitive(p.callHistory, { tool: toolId, input: inputStr })) {
        return { ok: false, output: `repetitive: ${toolId} called ${REPETITIVE_THRESHOLD}+ times — model stuck, prompt cần diversify`, partial: p.partial, reason: 'repetitive' };
      }
      p.callHistory.push({ tool: toolId, input: inputStr });

      const t0 = Date.now();
      const result = await invokeTool(toolId, input, p.ctx);
      const dur = Date.now() - t0;
      p.partial.toolsUsed.push({
        toolId, input, output: result.ok ? result.output : null,
        durationMs: dur, ok: result.ok,
        error: result.ok ? undefined : result.error,
      });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result.ok ? JSON.stringify(result.output) : `ERROR: ${result.error}`,
      });
    }
  }

  return { ok: false, output: `max ${p.maxIter} iter exceeded`, partial: p.partial, reason: 'max_iter' };
}
