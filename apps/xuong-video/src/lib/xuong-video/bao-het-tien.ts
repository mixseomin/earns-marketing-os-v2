// BÁO HẾT TIỀN (15/10/2026 — anh: "nếu hết tiền thì phải báo trên telegram (MINE, topic Quản lý), kèm tên nhà cung cấp, link, email
// đăng ký để gia hạn"). Gọi khi một bước của chuỗi cổng (cong-ai.ts) hỏng vì hết tiền — studio đã tự chuyển sang cổng kế, tin này để
// anh nạp. Bot + nhóm đọc từ vault MOS2 (acct #476, như ~/bin/tg), không cần khoá riêng. Mỗi cổng tối đa một tin / 6 giờ.
import 'server-only';
import { sql } from 'drizzle-orm';
import { CONG, type BuocNguon, type CongKey } from './cong-ai';
import type { Db, Row } from './doc-db';

const ACCT_BOT = 476;
const NHOM = 'mine';
const TOPIC = 'Quản lý';
export const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const gioVn = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(11, 16) + ' ' + new Date(Date.now() + 7 * 3600_000).toISOString().slice(8, 10) + '/' + new Date(Date.now() + 7 * 3600_000).toISOString().slice(5, 7);

/** Gửi một tin HTML vào nhóm MINE, topic Quản lý (bot đọc từ vault). Dùng chung: hết tiền cổng, lượt sinh vượt ngân sách. `nut` = hàng nút (cty phim-nut.mjs xử),
 *  `traLoi` = mã tin để trả lời dưới nó. */
export async function baoTelegram(db: Db, text: string, { nut, traLoi }: { nut?: { text: string; callback_data: string }[]; traLoi?: number } = {}): Promise<boolean> {
  const k = process.env.MOS2_SECRET_KEY;
  if (!k) { console.log('[bao-telegram] thiếu MOS2_SECRET_KEY'); return false; }
  const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
  const tok = String((await q(sql`SELECT pgp_sym_decrypt(decode(data->>'token_enc','base64'), ${k}) AS t FROM account_state WHERE account_id = ${ACCT_BOT} AND kind = 'api' AND ref = 'bot_token'`))[0]?.t ?? '');
  const g = (await q(sql`SELECT data FROM account_state WHERE account_id = ${ACCT_BOT} AND kind = 'property' AND ref = ${NHOM}`))[0]?.data as { chat_id?: number; topics?: Record<string, number> } | undefined;
  if (!tok.includes(':') || !g?.chat_id) { console.log('[bao-telegram] không đọc được bot/nhóm từ vault'); return false; }
  const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: g.chat_id, message_thread_id: g.topics?.[TOPIC], text, parse_mode: 'HTML', disable_web_page_preview: true,
      ...(nut ? { reply_markup: { inline_keyboard: [nut] } } : {}), ...(traLoi ? { reply_parameters: { message_id: traLoi, allow_sending_without_reply: true } } : {}) }),
  }).catch((e) => { console.log('[bao-telegram] gửi lỗi', String(e)); return null; });
  if (r && !r.ok) console.log('[bao-telegram] Telegram trả', r.status, (await r.text()).slice(0, 200));
  return !!r?.ok;
}

export async function baoHetTien(db: Db, thu: BuocNguon[] | undefined, nguCanh: string): Promise<void> {
  const het = [...new Map((thu ?? []).filter((b) => b.het_tien && b.cong in CONG).map((b) => [b.cong, b])).values()];
  if (!het.length) return;
  const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];
  for (const b of het) {
    const cong = b.cong as CongKey;
    // chống báo dồn: chỉ gửi khi lần báo trước của cổng này đã quá 6 giờ
    const moi = await q(sql`INSERT INTO xv_bao_het_tien (cong) VALUES (${cong}) ON CONFLICT (cong) DO UPDATE SET luc = now(), lan = xv_bao_het_tien.lan + 1
      WHERE xv_bao_het_tien.luc < now() - interval '6 hours' RETURNING cong`);
    if (!moi.length) continue;
    const c = CONG[cong];
    const tk = c.vault ? (await q(sql`SELECT email, handle FROM platform_accounts WHERE id = ${c.vault}`))[0] : undefined;
    const text = [
      `<b>Hết tiền: ${esc(c.ten)}</b> — studio.on.tc đã tự chuyển sang cổng dự phòng`,
      `1. Nạp: ${esc(c.napTien)}`,
      `2. Email đăng ký: ${esc(String(tk?.email ?? 'tài khoản Google gắn GOOGLE_API_KEY'))}${c.vault ? ` (vault #${c.vault}, mật khẩu trong vault)` : ''}`,
      `3. Ghi chú: ${esc(c.ghiChu)}`,
      `Lỗi: <i>${esc((b.loi ?? '').slice(0, 200))}</i>`,
      `Lượt: ${esc(nguCanh)} · ${gioVn()}`,
    ].join('\n');
    await baoTelegram(db, text);
  }
}
