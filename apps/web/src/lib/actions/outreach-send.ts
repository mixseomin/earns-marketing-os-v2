'use server';

// Gửi thư của một người nhận rồi đẩy trạng thái trong MỘT lần bấm. Từ 20/11/2026 thư đi qua lõi gửi chung lib/outreach/gui.ts
// (đường gửi theo tên miền người gửi, sổ chặn, trần ngày, nhật ký outreach_thu) — không còn gắn cứng Mailjet (cổng đó đã chết).
// Auto-send a prospect's pitch email and advance the
// pipeline in one click. Email-only — form-only prospects must be sent manually. The email body is
// rebuilt server-side from the same template the preview drawer shows, so what you see is what sends.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { touchEntity } from '@/lib/touch-entity';
import { buildEmailForProspect } from '@/lib/outreach-template';
import { syncProspectToTask } from './backlink-outreach-sync';
import { fillSignoff, firstNameOf } from '@/lib/outreach/link-task';
import { guiThuOutreach } from '@/lib/outreach/gui';

const FROM_EMAIL = process.env.MAILJET_FROM || 'hello@militarycalc.com';
const FROM_NAME = 'Jake Miller';

export async function sendProspectEmail(
  projectId: string,
  id: number,
  override?: { subject?: string; body?: string },
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };

  const rows = await db.execute(sql`
    SELECT p.agent_name, p.base, p.email, p.status, p.source, p.email_subject, p.email_body, p.followup_count, p.du_lieu, p.campaign_id,
           c.from_email AS c_from_email, c.from_name AS c_from_name, c.followup_gap_days AS c_gap, c.max_followups AS c_max
    FROM outreach_prospects p
    LEFT JOIN outreach_campaigns c ON c.id = p.campaign_id
    WHERE p.id = ${id} AND p.project_id = ${projectId} LIMIT 1`);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'Prospect not found' };

  // Sender identity comes from the campaign (from_email/from_name set via the identity picker);
  // fall back to the env default. NOTE: Mailjet only sends from a VERIFIED sender/domain.
  const fromEmail = (r.c_from_email && String(r.c_from_email)) || FROM_EMAIL;
  const fromName = (r.c_from_name && String(r.c_from_name)) || FROM_NAME;

  const email = r.email ? String(r.email) : '';
  if (!email) return { ok: false, error: 'Form-only prospect — no email to auto-send' };
  const status = String(r.status ?? 'to_send');

  if (['replied', 'interested', 'embedded', 'declined', 'bounced'].includes(status)) {
    return { ok: false, error: `Already ${status} — not sending` };
  }

  // Content resolution: override (UI edit) > stored per-prospect email (backlink pitch / operator
  // saved) > embed template. A backlink prospect with no stored content is NOT sent (never blast the
  // embed BAH template to a librarian) — its pitch must be generated first (import/generate step).
  const source = r.source ? String(r.source) : '';
  const savedSubject = r.email_subject ? String(r.email_subject) : '';
  const savedBody = r.email_body ? String(r.email_body) : '';
  // CHUỖI THƯ đã soạn sẵn (lib/outreach/soan-thu.ts ghi vào du_lieu.chuoi: [thư đầu, nhắc 1, nhắc 2…]): thư nhắc lấy đúng bước của nó,
  // tiêu đề nối luồng "Re: <tiêu đề thư đầu>". Không có chuỗi → như cũ (gửi lại nội dung đã lưu / mẫu của dự án).
  const buoc = status === 'to_send' ? 0 : Number(r.followup_count ?? 0) + 1;
  const chuoi = (r.du_lieu as { chuoi?: { tieu_de?: string; noi_dung?: string }[] } | null)?.chuoi;
  const buocChuoi = buoc > 0 && Array.isArray(chuoi) && chuoi[buoc]?.noi_dung ? chuoi[buoc]! : null;
  let subject: string, body: string;
  if (override?.subject?.trim() || override?.body?.trim()) {
    subject = override.subject?.trim() || savedSubject;
    body = override.body?.trim() || savedBody;
  } else if (buocChuoi) {
    const dau = String(chuoi![0]?.tieu_de || savedSubject || '').replace(/^(re:\s*)+/i, '');
    subject = buocChuoi.tieu_de?.trim() || `Re: ${dau}`; body = String(buocChuoi.noi_dung);
  } else if (savedBody) {
    subject = savedSubject; body = savedBody;
  } else if (source === 'backlink') {
    return { ok: false, error: 'Backlink prospect chưa có nội dung email — sinh trước (Import từ Backlinks)' };
  } else if (projectId === 'militarycalc') {
    // ponytail: the hardcoded template is MilitaryCalc-only. Other projects MUST have a saved body
    // (✨ Sinh — per-project AI) so we never send MilitaryCalc's BAH pitch under another brand.
    const tpl = buildEmailForProspect({ agentName: r.agent_name as string | null, base: r.base as string | null, status, source: r.source as string | null });
    subject = tpl.subject; body = tpl.body;
  } else {
    return { ok: false, error: 'Chưa có nội dung email — bấm ✨ Sinh (AI viết theo project) trước khi gửi' };
  }
  if (!body.trim()) return { ok: false, error: 'No email body to send' };
  // Defensive: never let a leftover "[Your Name]" placeholder go out — sign with the real sender.
  const signer = firstNameOf(String(fromName));
  body = fillSignoff(body, signer, '');
  subject = fillSignoff(subject, signer, '');

  // thư nhắc nối vào luồng của thư trước (Message-ID thư đi gần nhất của người này)
  let noiVao: string | null = null;
  if (buoc > 0) {
    try {
      const truoc = (await db.execute(sql`select ma_thu from outreach_thu where prospect_id = ${id} and chieu = 'di' and trang_thai = 'ok' and ma_thu is not null order by id desc limit 1`)) as unknown as { ma_thu: string }[];
      noiVao = truoc[0]?.ma_thu ?? null;
    } catch { /* chưa có nhật ký thư → gửi như thư rời */ }
  }
  const kq = await guiThuOutreach({
    tuEmail: String(fromEmail), tuTen: String(fromName), toi: email, toiTen: String(r.agent_name ?? ''), tieuDe: subject, noiDung: body,
    prospectId: id, campaignId: r.campaign_id == null ? null : Number(r.campaign_id), projectId, buoc, noiVao,
  });
  if (!kq.ok) return { ok: false, error: kq.loi };

  // nhịp nhắc theo CHIẾN DỊCH (followup_gap_days, max_followups) — trước 20/11/2026 gắn cứng 3 ngày / 4 ngày / tối đa 2 lần
  const gap = Math.max(1, Number(r.c_gap ?? 3)), max = Math.max(0, Number(r.c_max ?? 2));

  // Advance pipeline: thư đầu → 'sent' (hẹn nhắc sau `gap` ngày nếu chiến dịch còn lượt nhắc); thư nhắc → followup_N, đủ `max` lần → no_response.
  if (status === 'to_send') {
    await db.execute(sql`
      UPDATE outreach_prospects SET
        status = 'sent', sent_at = COALESCE(sent_at, now()),
        email_subject = ${subject}, email_body = ${body},
        next_followup_at = CASE WHEN ${max} > 0 THEN now() + interval '1 day' * ${gap} ELSE NULL END, updated_at = now()
      WHERE id = ${id}`);
  } else {
    await db.execute(sql`
      UPDATE outreach_prospects SET
        followup_count = followup_count + 1,
        status = CASE WHEN followup_count + 1 >= ${max} THEN 'no_response' ELSE 'followup_' || (followup_count + 1)::text END,
        email_subject = ${subject}, email_body = ${body},
        next_followup_at = CASE WHEN followup_count + 1 >= ${max} THEN NULL ELSE now() + interval '1 day' * ${gap} END,
        updated_at = now()
      WHERE id = ${id}`);
  }

  await syncProspectToTask(id);   // reflect sent/followup onto the linked backlink task
  await touchEntity('outreach', { projectId });
  return { ok: true };
}
