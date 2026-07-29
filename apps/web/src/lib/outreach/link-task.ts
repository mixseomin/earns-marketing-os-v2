// Core (no auth, no 'use server') to link ONE backlink task to the outreach system: ensure the
// project's backlink campaign, generate a pitch, upsert a prospect carrying task_id (so the
// bidirectional status sync in backlink-outreach-sync applies), and return a deep link into the
// outreach page. Callers add auth — linkTaskToOutreach (admin cookie) + the ext route (token).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getOpenAI, DEFAULT_MODEL } from '@/lib/ai/openai';

type Db = NonNullable<ReturnType<typeof getDb>>;
export const EMAIL_RE = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}';

export const firstNameOf = (name: string | null | undefined): string => String(name || '').trim().split(/\s+/)[0] || '';

// Substitute any placeholder tokens the LLM leaves (e.g. "[Your Name]", "[Company]") with the real
// signer / product so what's stored IS what sends — never a literal "[Your Name]" out the door.
export function fillSignoff(text: string, signer: string, product?: string): string {
  if (!text) return text;
  return text
    .replace(/\[(?:your\s+)?(?:full\s+|first\s+)?name\]/gi, signer || 'Jake')
    .replace(/\[(?:your\s+)?(?:sender|signature)(?:\s+name)?\]/gi, signer || 'Jake')
    .replace(/\[(?:your\s+)?company(?:\s+name)?\]/gi, product || signer || '')
    .replace(/[ \t]*\[[A-Za-z][^\]\n]{0,38}\][ \t]*/g, '')   // strip any remaining bracket placeholder
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

// One short outreach email suggesting a free tool for someone's resource page/list. English only.
// signer = real first name to sign off with (campaign from_name) so no "[Your Name]" survives.
export async function genPitch(proj: Record<string, unknown>, task: Record<string, unknown>, signer?: string): Promise<{ subject: string; body: string } | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  const site = String(proj.website || '').replace(/\/$/, '');
  const sign = firstNameOf(signer) || 'Jake';
  const sys = 'You write ONE short outreach email suggesting a free tool for someone\'s resource page/list. Output ENGLISH only.';
  const usr = `PRODUCT: ${proj.name ?? ''}${site ? ` (${site})` : ''} - ${proj.one_liner ?? ''}
RECIPIENT PAGE: ${task.title ?? ''} · ${task.source_url ?? ''}
HOW IT FITS: ${task.mechanism ?? ''}
TASK NOTES (Vietnamese, obey): ${task.instructions ?? ''}

Rules:
- First line EXACTLY "Subject: <short specific subject>", then a blank line, then the body.
- Body 4-7 short sentences: warm greeting, note their specific page, one-line tool intro, one sentence why it helps their audience, say it's free with no signup, offer the link${site ? ` (${site})` : ''}, thank them, then sign off.
- Sign off EXACTLY with "Best," then a new line then "${sign}". NEVER output a bracketed placeholder such as [Your Name], [Name], or [Your Company] - use "${sign}".
- Human, specific, no "I hope this finds you well", no em dashes (use "-"), no SEO/backlink mention.
Return ONLY the email.`;
  try {
    const c = await ai.chat.completions.create({ model: DEFAULT_MODEL, temperature: 0.7, messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }] });
    const raw = (c.choices[0]?.message?.content || '').trim();
    const m = raw.match(/^\s*subject:\s*(.+?)\s*\n+([\s\S]*)$/i);
    const product = String(proj.name || '');
    if (!m) return { subject: `A free tool for ${String(task.title || 'your page').slice(0, 60)}`, body: fillSignoff(raw, sign, product) };
    return { subject: fillSignoff((m[1] || '').trim(), sign, product), body: fillSignoff((m[2] || '').trim(), sign, product) };
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

export type ProspectState = {
  prospectId: number; projectId: string; email: string; channel: 'email' | 'form';
  subject: string; body: string; status: string; sentAt: string; repliedAt: string;
  followupCount: number; nextFollowupAt: string;
};

// Read the outreach prospect linked to a backlink task — live status + saved pitch for the ext to
// show inline (no MOS2 deep-link needed). Null = task not yet pushed to outreach.
export async function readProspectState(db: Db, taskId: number): Promise<ProspectState | null> {
  const rows = (await db.execute(sql`
    SELECT id, project_id, email, email_subject, email_body, status, sent_at, replied_at, followup_count, next_followup_at
    FROM outreach_prospects WHERE task_id = ${taskId} ORDER BY id DESC LIMIT 1`)) as unknown as Array<Record<string, unknown>>;
  const p = rows[0];
  if (!p) return null;
  const iso = (v: unknown) => (v ? new Date(v as string | number | Date).toISOString() : '');
  return {
    prospectId: Number(p.id), projectId: String(p.project_id || ''),
    email: String(p.email || ''), channel: p.email ? 'email' : 'form',
    subject: String(p.email_subject || ''), body: String(p.email_body || ''),
    status: String(p.status || ''), sentAt: iso(p.sent_at), repliedAt: iso(p.replied_at),
    followupCount: Number(p.followup_count || 0), nextFollowupAt: iso(p.next_followup_at),
  };
}

// Link a single backlink task to outreach. Idempotent (existing prospect by task_id is reused).
// opts.saveSubject/saveBody → persist operator edits (no AI, fillSignoff applied). opts.regenerate →
// force a fresh AI pitch (overwrite). Neither → backfill a pitch only if the prospect has none.
// Works with OR without a recipient email — no email → a form/contact prospect the staffer sends
// manually; email present → the cron auto-sends. Always returns the live prospect state (subject/
// body/status/…) so the ext shows what will send + where it stands.
export async function linkTaskToOutreachCore(
  db: Db, taskId: number,
  opts?: { regenerate?: boolean; saveSubject?: string | null; saveBody?: string | null },
): Promise<{ ok: boolean; error?: string; created?: boolean; campId?: number } & Partial<ProspectState>> {
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
    const host = String(t.source_url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || String(t.title || 'site');
    const camp = await ensureBacklinkCampaign(db, projectId);
    const signer = firstNameOf(camp.from_name);
    const proj = { name: t.pname, website: t.website, one_liner: t.one_liner, bio: t.bio };
    const product = String(t.pname || '');
    const saving = opts?.saveSubject != null || opts?.saveBody != null;

    // Ensure the prospect (task_id link, or the legacy notes marker). On create, seed with the saved
    // pitch when saving, else generate one.
    const ex = (await db.execute(sql`SELECT id FROM outreach_prospects WHERE project_id = ${projectId} AND (task_id = ${taskId} OR notes = ${'từ backlink task #' + taskId}) LIMIT 1`)) as unknown as Array<{ id: number }>;
    let prospectId: number; let created = false;
    if (ex.length) {
      prospectId = ex[0]!.id;
      await db.execute(sql`UPDATE outreach_prospects SET task_id = ${taskId}, contact_url = COALESCE(contact_url, ${String(t.source_url || '')}), updated_at = now() WHERE id = ${prospectId} AND task_id IS NULL`);
    } else {
      // Insert with an empty pitch; the mutation block below fills it (save / regen / backfill) so
      // there is exactly ONE genPitch path and the ON CONFLICT (existing-by-email) row keeps its body.
      const ins = (await db.execute(sql`
        INSERT INTO outreach_prospects (tenant_id, project_id, campaign_id, task_id, agent_name, company, email, contact_url, website, status, source, notes)
        VALUES ('self', ${projectId}, ${camp.id}, ${taskId}, ${host}, ${String(t.title ?? '')}, ${email || null}, ${String(t.source_url ?? '')}, ${String(t.source_url ?? '')}, 'to_send', 'backlink', ${'từ backlink task #' + taskId})
        ON CONFLICT (project_id, email) DO UPDATE SET task_id = ${taskId}, updated_at = now()
        RETURNING id`)) as unknown as Array<{ id: number }>;
      prospectId = Number(ins[0]?.id);
      created = true;
    }

    // Apply the pitch mutation: operator save wins, else regenerate on demand, else backfill if empty.
    const [{ email_body: curBody } = { email_body: null }] = (await db.execute(sql`SELECT email_body FROM outreach_prospects WHERE id = ${prospectId} LIMIT 1`)) as unknown as Array<{ email_body: string | null }>;
    if (saving) {
      await db.execute(sql`UPDATE outreach_prospects SET email_subject = ${fillSignoff(String(opts?.saveSubject ?? ''), signer, product)}, email_body = ${fillSignoff(String(opts?.saveBody ?? ''), signer, product)}, updated_at = now() WHERE id = ${prospectId}`);
    } else if (opts?.regenerate) {
      const pitch = await genPitch(proj, t, signer);
      if (pitch) await db.execute(sql`UPDATE outreach_prospects SET email_subject = ${pitch.subject}, email_body = ${pitch.body}, updated_at = now() WHERE id = ${prospectId}`);
    } else if (!curBody) {
      const pitch = await genPitch(proj, t, signer);
      if (pitch) await db.execute(sql`UPDATE outreach_prospects SET email_subject = ${pitch.subject}, email_body = ${pitch.body}, updated_at = now() WHERE id = ${prospectId}`);
    }

    const state = await readProspectState(db, taskId);
    return { ok: true, created, campId: camp.id, ...(state || {}) };
  } catch (e) {
    return { ok: false, error: `link outreach lỗi: ${(e as Error).message || String(e)}` };
  }
}
