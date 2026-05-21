'use server';

// Infer "visual style descriptor" cho habitat từ icon + community description.
// Vision call 1x mỗi habitat (kết quả cache vào habitats.visual_style_descriptor),
// sau đó được inject vào image-gen prompt để ảnh sinh fit theme.
//
// Vd output: "purple cosmic gradient, mystical astrology aesthetic, soft glow,
// celestial symbols, dark navy background".

import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';

export async function inferHabitatVisualStyle(
  habitatId: number,
): Promise<{ ok: true; descriptor: string } | { ok: false; error: string }> {
  if (!aiEnabled()) return { ok: false, error: 'OPENAI_API_KEY not configured' };
  const client = getOpenAI();
  if (!client) return { ok: false, error: 'OpenAI client unavailable' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DATABASE_URL not configured' };

  // Pull icon + descriptive fields cho vision context.
  const rows = await db.execute(sql`
    SELECT id, name, kind, icon_url, posting_rules, dominant_topics, community_type
      FROM habitats WHERE id = ${habitatId} LIMIT 1
  `);
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!r) return { ok: false, error: 'habitat not found' };
  const iconUrl = r.icon_url ? String(r.icon_url) : null;
  if (!iconUrl) return { ok: false, error: 'habitat chưa có icon — extract icon trước' };

  const name = String(r.name ?? '');
  const kind = String(r.kind ?? '');
  const topics = Array.isArray(r.dominant_topics) ? (r.dominant_topics as string[]) : [];

  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',                // vision-capable, cheap
      messages: [
        {
          role: 'system',
          content: 'You produce a concise visual style descriptor for AI image generation. Output 1 short phrase (max 25 words). Capture: dominant palette, mood/aesthetic, era/style references, key visual motifs. NO meta-commentary. NO "this image shows". Output ONLY the descriptor.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Community: "${name}" (${kind})${topics.length > 0 ? ` — topics: ${topics.slice(0, 5).join(', ')}` : ''}.\n\nDescribe the visual aesthetic for content matching this community (based on the icon).` },
            { type: 'image_url', image_url: { url: iconUrl, detail: 'low' } },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 80,
    });
    const descriptor = (res.choices[0]?.message?.content ?? '').trim()
      .replace(/^["']+|["']+$/g, '')      // strip wrapping quotes
      .replace(/\.$/, '')                   // strip trailing period
      .slice(0, 200);
    if (!descriptor) return { ok: false, error: 'AI trả empty' };

    // Cache vào DB
    await db.execute(sql`
      UPDATE habitats SET visual_style_descriptor = ${descriptor}, updated_at = now()
      WHERE id = ${habitatId}
    `);
    return { ok: true, descriptor };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
