// Core (no auth, no 'use server') to link ONE backlink task to the outreach system: ensure the
// project's backlink campaign, generate a pitch, upsert a prospect carrying task_id (so the
// bidirectional status sync in backlink-outreach-sync applies), and return a deep link into the
// outreach page. Callers add auth — linkTaskToOutreach (admin cookie) + the ext route (token).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getOpenAI, DEFAULT_MODEL } from '@/lib/ai/openai';

type Db = NonNullable<ReturnType<typeof getDb>>;
export const EMAIL_RE = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}';

// One short outreach email suggesting a free tool for someone's resource page/list. English only.
export async function genPitch(proj: Record<string, unknown>, task: Record<string, unknown>): Promise<{ subject: string; body: string } | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  const site = String(proj.website || '').replace(/\/$/, '');
  const sys = 'You write ONE short outreach email suggesting a free tool for someone\'s resource page/list. Output ENGLISH only.';
  const usr = `PRODUCT: ${proj.name ?? ''}${site ? ` (${site})` : ''} - ${proj.one_liner ?? ''}
RECIPIENT PAGE: ${task.title ?? ''} · ${task.source_url ?? ''}
HOW IT FITS: ${task.mechanism ?? ''}
TASK NOTES (Vietnamese, obey): ${task.instructions ?? ''}

Rules:
- First line EXACTLY "Subject: <short specific subject>", then a blank line, then the body.
- Body 4-7 short sentences: warm greeting, note their specific page, one-line tool intro, one sentence why it helps their audience, say it's free with no signup, offer the link${site ? ` (${site})` : ''}, thank them, sign off with a generic first name.
- Human, specific, no "I hope this finds you well", no em dashes (use "-"), no SEO/backlink mention.
Return ONLY the email.`;
  try {
    const c = await ai.chat.completions.create({ model: DEFAULT_MODEL, temperature: 0.7, messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }] });
    const raw = (c.choices[0]?.message?.content || '').trim();
    const m = raw.match(/^\s*subject:\s*(.+?)\s*\n+([\s\S]*)$/i);
    if (!m) return { subject: `A free tool for ${String(task.title || 'your page').slice(0, 60)}`, body: raw };
    return { subject: (m[1] || '').trim(), body: (m[2] || '').trim() };
  } catch { return null; }
}

// Ensure the project's backlink campaign exists (sender defaults to the verified embed sender).
export async function ensureBacklinkCampaign(db: Db, projectId: string): Promise<{ id: number; from_email: string | null; from_name: string | null }> {
  let camp = (await db.execute(sql`SELECT id, from_email, from_name FROM outreach_campaigns WHERE project_id = ${projectId} AND type = 'backlink' ORDER BY id LIMIT 1`)) as unknown as Array<{ id: number; from_email: string | null; from_name: string | null }>;
  if (!camp.length) {
    const verified = (await db.execute(sql`SELECT from_email, from_name FROM outreach_campaigns WHERE project_id = ${projectId} AND type = 'embed' AND from_email IS NOT NULL ORDER BY id LIMIT 1`)) as unknown as Array<{ from_email: string; from_name: string }>;
    const ins = await db.execute(sql`INSERT INTO outreach_campaigns (tenant_id, project_id, name, type, status, goal, from_email, from_name, daily_cap, followup_gap_days, max_followups)
      VALUES ('self', ${projectId}, 'Backlink outreach', 'backlink', 'active', 'Xin đặt link (resource page / directory / community)', ${verified[0]?.from_email ?? null}, ${verified[0]?.from_name ?? null}, 10, 5, 2) RETURNING id, from_email, from_name`);
    camp = ins as unknown as Array<{ id: number; from_email: string | null; from_name: string | null }>;
  }
  return camp[0]!;
}

const firstEmail = (s: string): string => (s.match(new RegExp(EMAIL_RE))?.[0] ?? '');

// Link a single backlink task to outreach. Idempotent (existing prospect by task_id is reused +
// pitch backfilled if empty). Works with OR without a recipient email — no email → a form/contact
// prospect the staffer sends manually; email present → the cron auto-sends. Returns a deep link.
export async function linkTaskToOutreachCore(db: Db, taskId: number): Promise<{ ok: boolean; error?: string; prospectId?: number; projectId?: string; campId?: number; email?: string; channel?: 'email' | 'form'; url?: string; created?: boolean }> {
  try {
    const tr = (await db.execute(sql`
      SELECT ht.id, ht.title, ht.project_id, ht.instructions,
             ht.prep_payload->>'source_url' AS source_url, ht.prep_payload->>'mechanism' AS mechanism,
             p.name AS pname, p.website AS website, p.one_liner AS one_liner, p.bio AS bio
      FROM human_tasks ht LEFT JOIN projects p ON p.id = ht.project_id
      WHERE ht.id = ${taskId} AND ht.platform_key = 'backlink' LIMIT 1`)) as unknown as Array<Record<string, unknown>>;
    const t = tr[0];
    if (!t) return { ok: false, error: 'not a backlink task' };
    const projectId = String(t.project_id || '');
    if (!projectId) return { ok: false, error: 'task chưa gắn project' };

    const email = firstEmail(`${t.mechanism || ''} ${t.instructions || ''}`);
    const channel: 'email' | 'form' = email ? 'email' : 'form';
    const host = String(t.source_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || String(t.title || 'site');
    const camp = await ensureBacklinkCampaign(db, projectId);
    const proj = { name: t.pname, website: t.website, one_liner: t.one_liner, bio: t.bio };

    // Existing prospect for this task? (task_id link, or the legacy notes marker). Reuse it.
    const ex = (await db.execute(sql`SELECT id, email_body FROM outreach_prospects WHERE project_id = ${projectId} AND (task_id = ${taskId} OR notes = ${'từ backlink task #' + taskId}) LIMIT 1`)) as unknown as Array<{ id: number; email_body: string | null }>;
    if (ex.length) {
      const pid = ex[0]!.id;
      // Backfill pitch + ensure task_id link if missing.
      if (!ex[0]!.email_body) {
        const pitch = await genPitch(proj, t);
        if (pitch) await db.execute(sql`UPDATE outreach_prospects SET email_subject = ${pitch.subject}, email_body = ${pitch.body}, updated_at = now() WHERE id = ${pid}`);
      }
      await db.execute(sql`UPDATE outreach_prospects SET task_id = ${taskId}, contact_url = COALESCE(contact_url, ${String(t.source_url || '')}), updated_at = now() WHERE id = ${pid} AND task_id IS NULL`);
      return { ok: true, prospectId: pid, projectId, campId: camp.id, email, channel, created: false, url: `/p/${projectId}/outreach?c=${camp.id}&prospect=${pid}` };
    }

    const pitch = await genPitch(proj, t);
    const ins = (await db.execute(sql`
      INSERT INTO outreach_prospects (tenant_id, project_id, campaign_id, task_id, agent_name, company, email, contact_url, website, status, source, email_subject, email_body, notes)
      VALUES ('self', ${projectId}, ${camp.id}, ${taskId}, ${host}, ${String(t.title ?? '')}, ${email || null}, ${String(t.source_url ?? '')}, ${String(t.source_url ?? '')}, 'to_send', 'backlink', ${pitch?.subject ?? null}, ${pitch?.body ?? null}, ${'từ backlink task #' + taskId})
      ON CONFLICT (project_id, email) DO UPDATE SET task_id = ${taskId}, updated_at = now()
      RETURNING id`)) as unknown as Array<{ id: number }>;
    const pid = Number(ins[0]?.id);
    return { ok: true, prospectId: pid, projectId, campId: camp.id, email, channel, created: true, url: `/p/${projectId}/outreach?c=${camp.id}&prospect=${pid}` };
  } catch (e) {
    return { ok: false, error: `link outreach lỗi: ${(e as Error).message || String(e)}` };
  }
}
