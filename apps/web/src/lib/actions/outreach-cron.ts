'use server';

// Outreach automation: one daily pass that (1) sends every due follow-up and
// (2) sends a paced batch of fresh cold pitches. Reuses sendProspectEmail so the
// pipeline-advance + Mailjet logic stays in one place. Triggered by a systemd timer
// hitting /api/cron/outreach (x-cron-secret). Project-agnostic - reads project_id per row.
//
// Cold-send pacing: INITIAL_DAILY_CAP keeps cold volume low so militarycalc.com's
// sender reputation (shared with the 11k newsletter) stays clean and the sends read
// human, not bulk. Follow-ups are capped at 2 per prospect by sendProspectEmail itself.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { sendProspectEmail } from './outreach-send';
import { dauNgayVn } from '@/lib/outreach/gui';
import { doThuDen } from '@/lib/outreach/thu-den';

// Thư đầu mỗi ngày đi theo TRẦN CỦA TỪNG CHIẾN DỊCH (outreach_campaigns.daily_cap) trừ số thư đầu chiến dịch đó đã gửi hôm nay (giờ Việt Nam);
// trần của cả tên miền gửi do lõi gửi (lib/outreach/gui.ts) chặn thêm một lớp. Trước 20/11/2026 là một con số cứng 15 cho mọi chiến dịch cộng lại.
const TRAN_MOT_LUOT = 300; // chốt chặn cuối cho một lượt máy chạy
const FOLLOWUP_PER_RUN = 25; // generous - follow-ups go to already-contacted, lower risk

type Row = { id: number; project_id: string };

export async function runOutreachCron(): Promise<{
  ok: boolean;
  followups: number;
  initials: number;
  errors: string[];
  thuDen?: Awaited<ReturnType<typeof doThuDen>>;
}> {
  const db = getDb();
  if (!db) return { ok: false, followups: 0, initials: 0, errors: ['DB unavailable'] };
  const errors: string[] = [];

  // 0) Dò thư trả lời TRƯỚC khi gửi: ai đã trả lời / xin thôi / bị dội thì ra khỏi chuỗi nhắc ngay trong lượt này.
  let thuDen: Awaited<ReturnType<typeof doThuDen>> | undefined;
  try { thuDen = await doThuDen(); if (!thuDen.ok && thuDen.loi) errors.push(`thư đến: ${thuDen.loi}`); }
  catch (e) { errors.push(`thư đến: ${String((e as Error).message ?? e).slice(0, 160)}`); }

  // Auto-send ONLY campaigns with auto_send=true + status=active. A manual campaign
  // (auto_send=false, e.g. quality .edu backlink) is left for the operator to send by hand
  // (Gmail preview) — the cron never touches it. Form-only prospects (no email) are skipped
  // here regardless. sendProspectEmail sends the prospect's stored content (backlink pitch) or
  // the embed template, and refuses a backlink prospect with no content.
  // 1) Due follow-ups: already contacted, not snoozed, still has a follow-up left.
  const due = (await db.execute(sql`
    SELECT p.id, p.project_id FROM outreach_prospects p
    JOIN outreach_campaigns c ON c.id = p.campaign_id
    WHERE c.status = 'active' AND c.auto_send = true
      AND (p.status = 'sent' OR p.status LIKE 'followup\\_%')
      AND p.email IS NOT NULL AND p.email <> ''
      AND p.next_followup_at IS NOT NULL AND p.next_followup_at <= now()
      AND (p.snooze_until IS NULL OR p.snooze_until <= now())
    ORDER BY p.next_followup_at ASC
    LIMIT ${FOLLOWUP_PER_RUN}`)) as unknown as Row[];

  let followups = 0;
  for (const r of due) {
    const res = await sendProspectEmail(String(r.project_id), Number(r.id));
    if (res.ok) followups++;
    else errors.push(`followup#${r.id}: ${res.error}`);
  }

  // 2) Paced fresh cold pitches (active email campaigns: embed + backlink).
  const dauNgay = dauNgayVn();
  const fresh = (await db.execute(sql`
    SELECT id, project_id FROM (
      SELECT p.id, p.project_id, c.daily_cap,
             row_number() OVER (PARTITION BY c.id ORDER BY p.id) AS rn,
             (SELECT count(*) FROM outreach_thu t WHERE t.campaign_id = c.id AND t.chieu = 'di' AND t.trang_thai = 'ok' AND t.buoc = 0 AND t.luc >= ${dauNgay}) AS da_gui
      FROM outreach_prospects p
      JOIN outreach_campaigns c ON c.id = p.campaign_id
      WHERE c.status = 'active' AND c.auto_send = true
        AND p.status = 'to_send'
        AND p.email IS NOT NULL AND p.email <> ''
        AND (p.snooze_until IS NULL OR p.snooze_until <= now())
    ) x
    WHERE rn <= GREATEST(0, daily_cap - da_gui)
    ORDER BY id ASC
    LIMIT ${TRAN_MOT_LUOT}`)) as unknown as Row[];

  let initials = 0;
  for (const r of fresh) {
    const res = await sendProspectEmail(String(r.project_id), Number(r.id));
    if (res.ok) initials++;
    else errors.push(`initial#${r.id}: ${res.error}`);
  }

  return { ok: true, followups, initials, errors, thuDen };
}
