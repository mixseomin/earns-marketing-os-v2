// task-kind — MỘT nguồn phân loại "loại việc" cho plays, thay các regex `^📧` / mechanism rải rác
// (trước: TaskDrawer tự test `/^📧/.test(title)` — chắp vá, dễ lệch). Client-safe (pure).
//
// email-send = blast newsletter (Mailjet), KHÔNG cần account nền tảng, "done" = đã gửi. Nhận diện qua
// mechanism='email' HOẶC title tiền tố 📧 (convention cũ — giữ để data cũ không gãy, nhưng icon giờ
// là SVG `mail` do CODE gán, không phải emoji trong title). seed = community link-gated. còn lại = backlink.

export type TaskKind = 'email' | 'seed' | 'backlink';

const EMAIL_TITLE = /^\s*📧\s*/;
const EMAIL_MECH = /^\s*email\s*$/i;

/** True nếu là email-send task (dùng ở cả drawer lẫn calendar — 1 định nghĩa). */
export function isEmailSend(title?: string | null, mechanism?: string | null): boolean {
  return EMAIL_TITLE.test(title || '') || EMAIL_MECH.test(mechanism || '');
}

export function taskKind(t: { title?: string | null; mechanism?: string | null; communitySeed?: boolean }): TaskKind {
  if (isEmailSend(t.title, t.mechanism)) return 'email';
  if (t.communitySeed) return 'seed';
  return 'backlink';
}

// Bỏ tiền tố 📧 khỏi title khi hiển thị — icon SVG `mail` đã thay nó (không để emoji trong title làm marker).
export function stripKindPrefix(title?: string | null): string {
  return (title || '').replace(EMAIL_TITLE, '').trim();
}

// key khớp GlyphName của MonthCalendar.
export const KIND_ICON: Record<TaskKind, 'mail' | 'sprout' | 'link'> = { email: 'mail', seed: 'sprout', backlink: 'link' };
