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
import { dauNgayVn, goiOutreach } from '@/lib/outreach/app-outreach';

/** kết quả dò thư đến của app outreach (cổng lệnh 'thu-den') */
type KetThuDen = { ok: boolean; loi?: string; doc?: number; moi?: number; traLoi?: number; thoi?: number; doi?: number; tuDong?: number; chanUyTin?: number; khongKhop?: number };

// Thư đầu mỗi ngày đi theo TRẦN CỦA TỪNG CHIẾN DỊCH (outreach_campaigns.daily_cap) trừ số thư đầu chiến dịch đó đã gửi hôm nay (giờ Việt Nam);
// trần của cả tên miền gửi do lõi gửi (lib/outreach/gui.ts) chặn thêm một lớp. Trước 20/11/2026 là một con số cứng 15 cho mọi chiến dịch cộng lại.
const TRAN_MOT_LUOT = 300; // chốt chặn cuối cho một lượt máy chạy
// GIÃN CÁCH (20/11/2026, học warmbly scheduler + sellbird sender: không gửi liền một mạch, không đúng mốc tròn): giữa hai thư nghỉ ngẫu nhiên 35–170 giây.
// Vì thế lượt gọi cron CHỈ xếp hàng rồi trả lời ngay; việc gửi chạy tiếp trong tiến trình máy chủ đang sống (không thêm tiến trình mới).
// Máy chủ khởi động lại giữa chừng → thư chưa gửi vẫn ở trạng thái chờ, lượt ngày mai gửi tiếp. Một lúc chỉ MỘT hàng đang gửi.
const NGHI_MS: [number, number] = [35_000, 170_000];
let dangGui = false;
const FOLLOWUP_PER_RUN = 25; // generous - follow-ups go to already-contacted, lower risk

type Row = { id: number; project_id: string };

export async function runOutreachCron(): Promise<{
  ok: boolean;
  /** số thư nhắc / thư đầu ĐÃ XẾP HÀNG gửi nền (có giãn cách) trong lượt này */
  followups: number;
  initials: number;
  errors: string[];
  thuDen?: KetThuDen;
}> {
  const db = getDb();
  if (!db) return { ok: false, followups: 0, initials: 0, errors: ['DB unavailable'] };
  const errors: string[] = [];

  // 0) Dò thư trả lời TRƯỚC khi gửi: ai đã trả lời / xin thôi / bị dội thì ra khỏi chuỗi nhắc ngay trong lượt này.
  // (dò thư đến + phanh chạy ở app outreach — repo riêng; mos2 chỉ gọi sang)
  const thuDen = await goiOutreach<KetThuDen>('thu-den', { so_ngay: 30 }, 120_000);
  if (!thuDen.ok && thuDen.loi) errors.push(`thư đến: ${thuDen.loi}`);

  // 0b) PHANH: chiến dịch nào 7 ngày qua dội / bị chặn / xin thôi quá ngưỡng thì tắt tự gửi của nó TRƯỚC khi xếp hàng lượt này (lib/outreach/phanh.ts).
  const phanh = await goiOutreach<{ ok: boolean; loi?: string; da?: string[] }>('phanh-ap');
  if (!phanh.ok) errors.push(`phanh: ${phanh.loi}`); else errors.push(...(phanh.da ?? []));
  if (!phanh.ok) return { ok: false, followups: 0, initials: 0, errors, thuDen };   // không xét được phanh thì KHÔNG gửi lượt này (an toàn hơn gửi khi chưa biết chỉ số)

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

  // 3) Gửi NỀN có giãn cách: thư nhắc trước, thư đầu sau. `followups` / `initials` trả về là số thư ĐÃ XẾP HÀNG của lượt này;
  //    kết quả từng thư (gửi được hay bị từ chối, vì sao) nằm ở nhật ký outreach_thu và hiện trên outreach.on.tc.
  const hang = [...due, ...fresh];
  const followups = due.length, initials = fresh.length;
  if (hang.length && dangGui) errors.push('lượt trước còn đang gửi nên lượt này không xếp thêm');
  else if (hang.length) {
    dangGui = true;
    void (async () => {
      try {
        for (const [i, r] of hang.entries()) {
          await sendProspectEmail(String(r.project_id), Number(r.id)).catch(() => undefined);   // lỗi từng thư đã ghi vào outreach_thu
          if (i < hang.length - 1) await new Promise((xong) => setTimeout(xong, NGHI_MS[0] + Math.random() * (NGHI_MS[1] - NGHI_MS[0])));
        }
      } finally { dangGui = false; }
    })();
  }

  return { ok: true, followups, initials, errors, thuDen };
}
