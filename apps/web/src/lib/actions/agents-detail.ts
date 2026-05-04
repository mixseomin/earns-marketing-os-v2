'use server';

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { revalidatePath } from 'next/cache';
import OpenAI from 'openai';

export interface AgentRow {
  id: number;
  projectId: string;
  squadId: number | null;
  agentRef: string;
  label: string | null;
  status: string;
  trustLevel: number;
  baseSkillMd: string;
  updatedAt: Date;
}

export interface AgentLearnRow {
  id: number;
  title: string;
  content: string;
  updatedAt: Date;
}

export interface AgentTimelineRow {
  id: number;
  startedAt: Date;
  status: string;
  costUsdCents: number | null;
  durationMs: number | null;
  cardRef: string;
  cardTitle: string;
}

export interface AgentMessageRow {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

function toAgentRow(r: Record<string, unknown>): AgentRow {
  return {
    id: Number(r.id),
    projectId: String(r.project_id),
    squadId: r.squad_id != null ? Number(r.squad_id) : null,
    agentRef: String(r.agent_ref),
    label: r.label ? String(r.label) : null,
    status: String(r.status),
    trustLevel: Number(r.trust_level),
    baseSkillMd: String(r.base_skill_md ?? ''),
    updatedAt: new Date(r.updated_at as string),
  };
}

export async function listSquadAgents(projectId: string, squadKey: string): Promise<AgentRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT a.id, a.project_id, a.squad_id, a.agent_ref, a.label,
           a.status, a.trust_level, a.base_skill_md, a.updated_at
    FROM agents a
    LEFT JOIN squads s ON s.id = a.squad_id
    WHERE a.project_id = ${projectId}
      AND s.squad_key = ${squadKey}
    ORDER BY a.agent_ref
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map(toAgentRow);
}

// Auto-create missing agent rows khi squad chưa có agents trong DB.
// Prefix = 3 ký tự đầu tên squad (VD: Research → RES).
export async function syncSquadAgents(
  projectId: string,
  squadKey: string,
  squadName: string,
  agentCount: number,
): Promise<AgentRow[]> {
  const db = getDb();
  if (!db) return [];

  const prefix = squadName.slice(0, 3).toUpperCase();

  // Get squad id
  const squadRows = await db.execute(sql`
    SELECT id FROM squads WHERE project_id = ${projectId} AND squad_key = ${squadKey} LIMIT 1
  `);
  const squadId = (squadRows as unknown as Array<{ id: number }>)[0]?.id;
  if (!squadId) return [];

  // Upsert N agents — ON CONFLICT DO NOTHING giữ rows đã tồn tại
  for (let i = 1; i <= agentCount; i++) {
    const ref = `${prefix}-${String(i).padStart(2, '0')}`;
    await db.execute(sql`
      INSERT INTO agents (tenant_id, project_id, squad_id, agent_ref, status, trust_level, base_skill_md)
      VALUES ('self', ${projectId}, ${squadId}, ${ref}, 'active', 2, '')
      ON CONFLICT (project_id, agent_ref) DO NOTHING
    `);
  }

  return listSquadAgents(projectId, squadKey);
}

export async function listAgentLearnings(projectId: string, agentRef: string): Promise<AgentLearnRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT id, title, content, updated_at
    FROM knowledge_items
    WHERE project_id = ${projectId}
      AND tags @> ${JSON.stringify([agentRef])}::jsonb
    ORDER BY updated_at DESC
    LIMIT 20
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    content: String(r.content),
    updatedAt: new Date(r.updated_at as string),
  }));
}

export async function listAgentTimeline(projectId: string, agentRef: string): Promise<AgentTimelineRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT ar.id, ar.started_at, ar.status, ar.cost_usd_cents, ar.duration_ms,
           c.card_ref, c.title as card_title
    FROM agent_runs ar
    JOIN cards c ON ar.card_id = c.id
    WHERE ar.project_id = ${projectId}
      AND ar.agent_ref = ${agentRef}
    ORDER BY ar.started_at DESC
    LIMIT 30
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    startedAt: new Date(r.started_at as string),
    status: String(r.status),
    costUsdCents: r.cost_usd_cents != null ? Number(r.cost_usd_cents) : null,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
    cardRef: String(r.card_ref),
    cardTitle: String(r.card_title),
  }));
}

export async function saveAgentBaseSkill(agentId: number, baseSkillMd: string, projectId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    UPDATE agents SET base_skill_md = ${baseSkillMd}, updated_at = NOW()
    WHERE id = ${agentId}
  `);
  revalidatePath(`/p/${projectId}/squads`);
}

// ── Chat ─────────────────────────────────────────────────────────

export async function listAgentMessages(agentId: number): Promise<AgentMessageRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT id, role, content, created_at
    FROM agent_messages
    WHERE agent_id = ${agentId}
    ORDER BY created_at ASC
    LIMIT 100
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    role: String(r.role) as 'user' | 'assistant',
    content: String(r.content),
    createdAt: new Date(r.created_at as string),
  }));
}

export async function sendAgentMessage(
  agentId: number,
  agentRef: string,
  baseSkillMd: string,
  userContent: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');

  // Save user message
  await db.execute(sql`
    INSERT INTO agent_messages (agent_id, role, content)
    VALUES (${agentId}, 'user', ${userContent})
  `);

  const systemPrompt = baseSkillMd.trim()
    ? `You are ${agentRef}, an AI agent with the following skills and persona:\n\n${baseSkillMd}\n\nRespond in character. When you learn something new or the user teaches you something, acknowledge it clearly so it can be saved as a learning.`
    : `You are ${agentRef}, an AI agent. Respond helpfully and in character. When you learn something new, acknowledge it clearly.`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.slice(-20),
    { role: 'user', content: userContent },
  ];

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY chưa được cấu hình trên server.');
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  });

  const assistantContent = response.choices[0]?.message?.content ?? '';

  // Save assistant response
  await db.execute(sql`
    INSERT INTO agent_messages (agent_id, role, content)
    VALUES (${agentId}, 'assistant', ${assistantContent})
  `);

  return assistantContent;
}

// Save a chat exchange as a knowledge_items learning (tagged with agentRef + projectId)
export async function saveMessageAsLearning(
  projectId: string,
  agentRef: string,
  title: string,
  content: string,
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('DB unavailable');
  await db.execute(sql`
    INSERT INTO knowledge_items (tenant_id, project_id, kind, title, content, tags, imported_from)
    VALUES ('self', ${projectId}, 'lesson', ${title}, ${content},
            ${JSON.stringify([agentRef, 'chat-learning'])}::jsonb, 'agent-chat')
  `);
  revalidatePath(`/p/${projectId}/squads`);
}
