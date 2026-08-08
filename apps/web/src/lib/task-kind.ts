// task-kind — MỘT nguồn phân loại "loại việc" cho plays, thay các regex `^📧` / mechanism rải rác
// (trước: TaskDrawer tự test `/^📧/.test(title)` — chắp vá, dễ lệch). Client-safe (pure).
//
// email-send = blast newsletter (Mailjet), KHÔNG cần account nền tảng, "done" = đã gửi. Nhận diện qua
// mechanism='email' HOẶC title tiền tố 📧 (convention cũ — giữ để data cũ không gãy, nhưng icon giờ
// là SVG `mail` do CODE gán, không phải emoji trong title). seed = community link-gated. còn lại = backlink.

export type TaskKind = 'email' | 'seed' | 'backlink' | 'build';

const EMAIL_TITLE = /^\s*📧\s*/;
const EMAIL_MECH = /^\s*email\s*$/i;
// build = việc LÀM RA sản phẩm (viết chương, dựng hình, đóng gói, quay video). Không đặt link ở đâu
// cả → "xong" của nó là một artifact, không phải live URL. Nhận diện: card thuộc một sản phẩm
// (prep_payload.product) HOẶC mechanism là một động từ sản xuất (play add --mech writing).
const BUILD_MECH = /^\s*(writing|design|build|product|video)\s*$/i;

/** True nếu là email-send task (dùng ở cả drawer lẫn calendar — 1 định nghĩa). */
export function isEmailSend(title?: string | null, mechanism?: string | null): boolean {
  return EMAIL_TITLE.test(title || '') || EMAIL_MECH.test(mechanism || '');
}

export function taskKind(t: { title?: string | null; mechanism?: string | null; communitySeed?: boolean; product?: boolean | string | null }): TaskKind {
  if (isEmailSend(t.title, t.mechanism)) return 'email';
  if (t.product || BUILD_MECH.test(t.mechanism || '')) return 'build';
  if (t.communitySeed) return 'seed';
  return 'backlink';
}

// Bỏ tiền tố 📧 khỏi title khi hiển thị — icon SVG `mail` đã thay nó (không để emoji trong title làm marker).
export function stripKindPrefix(title?: string | null): string {
  return (title || '').replace(EMAIL_TITLE, '').trim();
}

// key khớp GlyphName của MonthCalendar.
export const KIND_ICON: Record<TaskKind, 'mail' | 'sprout' | 'link' | 'book'> = { email: 'mail', seed: 'sprout', backlink: 'link', build: 'book' };
