import { eq, and } from 'drizzle-orm';
import { getDb, habitatChannels } from '@mos2/db';
import { forumSubForumKey } from '@/lib/channel-support';

// Find-or-create habitat_channel cho 1 sub-forum (từ breadcrumb thread mà ext gửi)
// → trả channel db id để gắn card.channel_id. Nhờ vậy sub-forum reader hiện
// "đã đăng N bài". Trả null nếu URL không phải forum sub-forum (forumSubForumKey null).
export async function resolveForumChannelId(
  db: NonNullable<ReturnType<typeof getDb>>,
  habitatId: number, channelUrl?: string | null, channelName?: string | null,
): Promise<number | null> {
  const u = (channelUrl ?? '').trim();
  if (!habitatId || !u) return null;
  const key = forumSubForumKey(u);
  if (!key) return null;
  const found = await db.select({ id: habitatChannels.id }).from(habitatChannels)
    .where(and(eq(habitatChannels.habitatId, habitatId), eq(habitatChannels.externalId, key))).limit(1);
  if (found[0]) return found[0].id;
  const ins = await db.insert(habitatChannels).values({
    habitatId, name: (channelName ?? '').trim() || key, externalId: key, url: u,
  }).returning({ id: habitatChannels.id });
  return ins[0]?.id ?? null;
}
