import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';

// GET /api/ext/accounts/profile?handle=<h>&platformKey=<k>&habitatId=<id>
//
// Trả profile + persona + voice + strategy (brief) cho account khớp với
// handle Reddit/etc đang login trên page. Ext side panel hover icon
// account → hiển thị panel detail.
//
// Logic:
//   1. Lookup platform_accounts (platform_key + handle, case-insensitive)
//   2. Nếu pass habitatId → JOIN community_briefs để lấy brief active
//      (approachMd, narrativeMd, tone, doMd, dontMd, currentPhase)
//   3. Resolve voice: channel.override > pillar.voice > habitat.voice > 'regular'
//   4. Trả structured object — ext render UI

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const handle = (url.searchParams.get('handle') ?? '').trim().replace(/^u\//i, '').replace(/^@/, '');
  const platformKey = (url.searchParams.get('platformKey') ?? '').trim().toLowerCase();
  const habitatId = Number(url.searchParams.get('habitatId') ?? 0);

  if (!handle || !platformKey) {
    return NextResponse.json({ ok: false, error: 'handle + platformKey required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // 1. Lookup account
  const accRows = await db.execute(sql`
    SELECT
      pa.id, pa.project_id, pa.handle, pa.email, pa.status, pa.block_reason,
      pa.persona, pa.tags, pa.notes, pa.account_kind,
      p.label AS platform_label
    FROM platform_accounts pa
    LEFT JOIN platforms p ON p.key = pa.platform_key
    WHERE pa.platform_key = ${platformKey}
      AND LOWER(pa.handle) = LOWER(${handle})
    LIMIT 1
  `);
  const acc = (accRows as unknown as Array<Record<string, unknown>>)[0];

  if (!acc) {
    return NextResponse.json({
      ok: true,
      account: null,
      message: `Chưa tìm thấy account @${handle} trên ${platformKey} trong MOS2.`,
    });
  }

  const persona = (acc.persona as Record<string, unknown> | null) ?? {};

  // 2. Brief context — nếu có habitatId
  let brief: Record<string, unknown> | null = null;
  let habitat: Record<string, unknown> | null = null;
  if (habitatId > 0) {
    const briefRows = await db.execute(sql`
      SELECT
        b.id, b.current_phase, b.approach_md, b.narrative_md, b.tone, b.do_md, b.dont_md,
        b.join_status, b.cadence_per_week,
        h.id AS habitat_id, h.name AS habitat_name, h.language AS habitat_language,
        h.voice_profile AS habitat_voice, h.voice_notes AS habitat_voice_notes
      FROM community_briefs b
      LEFT JOIN habitats h ON h.id = b.habitat_id
      WHERE b.account_id = ${Number(acc.id)} AND b.habitat_id = ${habitatId}
      LIMIT 1
    `);
    const br = (briefRows as unknown as Array<Record<string, unknown>>)[0];
    if (br) {
      brief = {
        id: Number(br.id),
        currentPhase: String(br.current_phase ?? ''),
        approachMd: String(br.approach_md ?? ''),
        narrativeMd: String(br.narrative_md ?? ''),
        tone: String(br.tone ?? ''),
        doMd: String(br.do_md ?? ''),
        dontMd: String(br.dont_md ?? ''),
        joinStatus: String(br.join_status ?? ''),
        cadencePerWeek: Number(br.cadence_per_week ?? 0),
      };
      habitat = {
        id: Number(br.habitat_id),
        name: String(br.habitat_name ?? ''),
        language: String(br.habitat_language ?? ''),
        voiceProfile: String(br.habitat_voice ?? 'regular'),
        voiceNotes: String(br.habitat_voice_notes ?? ''),
      };
    }
  }

  return NextResponse.json({
    ok: true,
    account: {
      id: Number(acc.id),
      projectId: String(acc.project_id),
      handle: String(acc.handle ?? ''),
      platformKey,
      platformLabel: String(acc.platform_label ?? platformKey),
      status: String(acc.status ?? 'unknown'),
      blockReason: acc.block_reason ? String(acc.block_reason) : null,
      accountKind: String(acc.account_kind ?? 'user'),
      // Persona fields — flatten cho ext convenience
      personaName: String(persona.name_first ?? '') + (persona.name_last ? ' ' + String(persona.name_last) : ''),
      personaGender: persona.gender ? String(persona.gender) : null,
      personaCountry: persona.country ? String(persona.country) : null,
      personaCity: persona.city ? String(persona.city) : null,
      personaBackstory: persona.backstory ? String(persona.backstory) : null,
      personaInterests: Array.isArray(persona.interests) ? (persona.interests as string[]) : [],
      personaVoiceSummary: persona.voice_summary ? String(persona.voice_summary) : null,
      personaNarrativeStyle: persona.narrative_style ? String(persona.narrative_style) : null,
      tags: Array.isArray(acc.tags) ? (acc.tags as string[]) : [],
      notes: acc.notes ? String(acc.notes) : null,
    },
    brief,
    habitat,
  });
}
