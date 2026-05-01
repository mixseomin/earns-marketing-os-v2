import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { fetchPlatform } from './fetchers';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

export interface MonitorReport {
  checked: number;
  newActivities: number;
  tasksSpawned: number;
  errors: Array<{ publicationId: number; url: string; error: string }>;
}

export async function runPublicationMonitor(limit = 20): Promise<MonitorReport> {
  const db = getDb();
  if (!db) return { checked: 0, newActivities: 0, tasksSpawned: 0, errors: [] };

  const pubRows = await db.execute(sql`
    SELECT id, project_id, url, title, platform_key, account_id,
           last_checked_at, last_activity_at, reply_count, check_interval_hours, metadata
    FROM publications
    WHERE tenant_id = ${TENANT}
      AND status = 'active'
      AND (next_check_at IS NULL OR next_check_at <= NOW())
    ORDER BY next_check_at ASC NULLS FIRST
    LIMIT ${limit}
  `);

  const pubs = pubRows as unknown as Array<{
    id: number; project_id: string; url: string; title: string | null;
    platform_key: string; account_id: number | null;
    last_checked_at: string | null; last_activity_at: string | null;
    reply_count: number; check_interval_hours: number;
    metadata: Record<string, unknown>;
  }>;

  const report: MonitorReport = { checked: 0, newActivities: 0, tasksSpawned: 0, errors: [] };

  for (const pub of pubs) {
    try {
      const result = await fetchPlatform(pub.platform_key, pub.url, pub.last_activity_at);
      report.checked++;

      await db.execute(sql`
        UPDATE publications SET
          last_checked_at = NOW(),
          next_check_at = NOW() + (check_interval_hours || ' hours')::interval,
          title = COALESCE(${result.title ?? null}, title),
          reply_count = COALESCE(${result.replyCount ?? null}, reply_count),
          view_count = COALESCE(${result.viewCount ?? null}, view_count),
          score = COALESCE(${result.score ?? null}, score),
          last_activity_at = CASE
            WHEN ${result.lastActivityAt ?? null}::timestamptz > last_activity_at OR last_activity_at IS NULL
            THEN ${result.lastActivityAt ?? null}::timestamptz
            ELSE last_activity_at
          END,
          updated_at = NOW()
        WHERE id = ${pub.id}
      `);

      for (const activity of result.newActivities) {
        const actRows = await db.execute(sql`
          INSERT INTO publication_activities (
            publication_id, detected_at, activity_type, external_id,
            author, content_snippet, activity_url
          ) VALUES (
            ${pub.id}, NOW(), 'reply', ${activity.externalId},
            ${activity.author}, ${activity.contentSnippet}, ${activity.activityUrl}
          )
          ON CONFLICT (publication_id, external_id) DO NOTHING
          RETURNING id
        `);
        const actRow = (actRows as unknown as Array<{ id: number }>)[0];
        if (!actRow) continue;

        report.newActivities++;

        const taskTitle = `💬 Reply — ${pub.title ?? pub.url}`;
        const taskInstr = `Reply mới trên **${pub.platform_key}**:\n\n**Tác giả:** ${activity.author}\n**Nội dung:**\n> ${activity.contentSnippet}\n\n**Link trực tiếp:** ${activity.activityUrl}\n\n**Bài gốc:** ${pub.url}\n\n---\nReply thân thiện, đúng tone. Nếu hỏi về sản phẩm → giới thiệu ngắn gọn + link landing page.`;

        const taskRows2 = await db.execute(sql`
          INSERT INTO human_tasks (
            tenant_id, project_id,
            title, instructions, prep_payload,
            platform_key, status
          ) VALUES (
            'self', ${pub.project_id},
            ${taskTitle}, ${taskInstr},
            ${JSON.stringify({ publicationId: pub.id, activityId: actRow.id, activityUrl: activity.activityUrl, author: activity.author, type: 'publication_reply' })}::jsonb,
            ${pub.platform_key}, 'pending'
          ) RETURNING id
        `);

        const taskRow = (taskRows2 as unknown as Array<{ id: number }>)[0];
        if (taskRow) {
          report.tasksSpawned++;
          await db.execute(sql`UPDATE publication_activities SET human_task_id = ${taskRow.id} WHERE id = ${actRow.id}`);
        }
      }
    } catch (err) {
      report.errors.push({ publicationId: pub.id, url: pub.url, error: String(err) });
      await db.execute(sql`
        UPDATE publications SET
          last_checked_at = NOW(),
          next_check_at = NOW() + (check_interval_hours || ' hours')::interval,
          updated_at = NOW()
        WHERE id = ${pub.id}
      `);
    }
  }

  return report;
}
