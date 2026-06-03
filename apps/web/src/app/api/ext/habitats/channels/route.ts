import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { getDb } from '@mos2/db';
import { listChannelsForHabitat, createChannel } from '@/lib/actions/habitat-channels';
import { forumSubForumKey } from '@/lib/channel-support';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/ext/habitats/channels { habitatId, channels:[{ name, url?, description? }] }
// UPSERT-an-toàn: chỉ INSERT channel có name CHƯA tồn tại (dedup case-insensitive theo
// name); KHÔNG xoá/ghi đè channel cũ. Dùng cho ext detect sub-forum (XenForo p-navEl-link
// /forums/<slug>.<id>/, vBulletin/phpBB/Discourse) → 1-click thêm làm channels.
// → { ok, added, skipped, total, addedNames }
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  const body = await req.json().catch(() => ({})) as {
    habitatId?: number;
    channels?: Array<{ name?: string; url?: string | null; description?: string }>;
  };
  const habitatId = Number(body.habitatId);
  if (!habitatId) return NextResponse.json({ ok: false, error: 'habitatId required' }, { status: 400 });
  const incoming = (body.channels || []).filter((c) => c && (c.name || '').trim()).slice(0, 80);
  if (!incoming.length) return NextResponse.json({ ok: false, error: 'channels required' }, { status: 400 });

  const existing = await listChannelsForHabitat(habitatId);
  const seen = new Set(existing.map((e) => e.name.trim().toLowerCase()));
  let order = existing.length;
  const addedNames: string[] = [];
  for (const c of incoming) {
    const name = (c.name || '').trim();
    const key = name.toLowerCase();
    if (seen.has(key)) continue;            // đã có → skip (không ghi đè)
    seen.add(key);
    const r = await createChannel(habitatId, {
      name,
      url: c.url ?? null,
      externalId: forumSubForumKey(c.url),   // slug.id từ URL → match khi sync rules sau
      description: (c.description || '').slice(0, 200),
      sortOrder: order++,
    });
    if (r.ok) addedNames.push(name);
  }
  return NextResponse.json({
    ok: true, added: addedNames.length, skipped: incoming.length - addedNames.length,
    total: seen.size, addedNames,
  });
}
