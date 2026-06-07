import { eq, and, sql } from 'drizzle-orm';
import { getDb, habitatChannels } from '@mos2/db';
import { forumSubForumKey } from '@/lib/channel-support';

// Find-or-create habitat_channel cho 1 sub-forum (từ breadcrumb thread mà ext gửi)
// → trả channel db id để gắn card.channel_id. Nhờ vậy sub-forum reader hiện
// "đã đăng N bài". Trả null nếu URL không phải forum sub-forum (forumSubForumKey null).
//
// LƯU Ý unique index: (habitat_id, LOWER(name)). Channel có thể đã được tạo trước
// (sidepanel sync) với externalId khác/null. Nếu chỉ match theo externalId rồi insert
// → đụng unique (habitat_id, lower(name)) → 500. Vì vậy match 2 tầng (externalId → name)
// + insert onConflictDoNothing rồi re-select (an toàn race + trùng tên).
export async function resolveForumChannelId(
  db: NonNullable<ReturnType<typeof getDb>>,
  habitatId: number, channelUrl?: string | null, channelName?: string | null,
): Promise<number | null> {
  const u = (channelUrl ?? '').trim();
  if (!habitatId || !u) return null;
  const key = forumSubForumKey(u);
  if (!key) return null;
  const name = (channelName ?? '').trim() || key;

  // Tier 1: match theo externalId (ổn định nhất).
  const byKey = await db.select({ id: habitatChannels.id }).from(habitatChannels)
    .where(and(eq(habitatChannels.habitatId, habitatId), eq(habitatChannels.externalId, key))).limit(1);
  if (byKey[0]) return byKey[0].id;

  // Tier 2: match theo LOWER(name) = chính unique key → KHÔNG insert trùng (hết 500).
  // Backfill externalId nếu channel cũ thiếu → lần sau match tier 1.
  const byName = await db.select({ id: habitatChannels.id, externalId: habitatChannels.externalId }).from(habitatChannels)
    .where(and(eq(habitatChannels.habitatId, habitatId), sql`LOWER(${habitatChannels.name}) = LOWER(${name})`)).limit(1);
  if (byName[0]) {
    if (!byName[0].externalId) {
      await db.update(habitatChannels).set({ externalId: key, url: u }).where(eq(habitatChannels.id, byName[0].id));
    }
    return byName[0].id;
  }

  // Tier 3: tạo mới — onConflictDoNothing phòng race, rồi re-select theo name.
  const ins = await db.insert(habitatChannels).values({
    habitatId, name, externalId: key, url: u,
  }).onConflictDoNothing().returning({ id: habitatChannels.id });
  if (ins[0]) return ins[0].id;
  const re = await db.select({ id: habitatChannels.id }).from(habitatChannels)
    .where(and(eq(habitatChannels.habitatId, habitatId), sql`LOWER(${habitatChannels.name}) = LOWER(${name})`)).limit(1);
  return re[0]?.id ?? null;
}
