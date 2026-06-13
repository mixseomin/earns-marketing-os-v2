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
  // Strip mọi prefix có thể: u/, @, /u/, /user/, etc → handle thuần
  const rawHandle = (url.searchParams.get('handle') ?? '').trim();
  const handle = rawHandle
    .replace(/^\/+/, '')
    .replace(/^u\//i, '')
    .replace(/^user\//i, '')
    .replace(/^@/, '')
    .trim();
  const platformKey = (url.searchParams.get('platformKey') ?? '').trim().toLowerCase();
  const habitatId = Number(url.searchParams.get('habitatId') ?? 0);
  // projectId (optional) — PREFER account trong project đang chọn khi 1 handle
  // dùng ở nhiều project. KHÔNG hard-filter (vẫn resolve cross-project).
  const projectId = (url.searchParams.get('projectId') ?? '').trim();
  const projectPref = projectId ? sql`(pa.project_id = ${projectId}) DESC, ` : sql``;

  if (!handle || !platformKey) {
    return NextResponse.json({ ok: false, error: 'handle + platformKey required' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 503 });

  // 1. Lookup account — case-insensitive + cross-project (1 handle dùng nhiều projects)
  // Reddit/FB preserve case nhưng login state có thể return lowercase trong API
  // (vd /me.json), nên TRIM + LOWER 2 phía.
  const accRows = await db.execute(sql`
    SELECT
      pa.id, pa.project_id, pa.handle, pa.email, pa.status, pa.block_reason,
      pa.persona, pa.tags, pa.notes, pa.account_kind,
      pa.follow_up_at, pa.warmup_checklist,
      p.label AS platform_label
    FROM platform_accounts pa
    LEFT JOIN platforms p ON p.key = pa.platform_key
    WHERE pa.platform_key = ${platformKey}
      AND LOWER(TRIM(pa.handle)) = LOWER(TRIM(${handle}))
    ORDER BY ${projectPref} pa.updated_at DESC NULLS LAST
    LIMIT 1
  `);
  const acc = (accRows as unknown as Array<Record<string, unknown>>)[0];

  if (!acc) {
    // Debug: log để verify tại sao miss
    console.warn('[ext/accounts/profile] miss', { platformKey, handle, rawHandle });
    // Fuzzy fallback: ILIKE handle để bắt typo / case / whitespace.
    // Reddit/FB strip whitespace nhưng user có thể nhập tay vào MOS2 với
    // space lung tung; case-insensitive lookup ở trên đã handle case nên
    // chỉ test ILIKE để bắt typo + handles tương tự.
    const fuzzy = await db.execute(sql`
      SELECT id, handle FROM platform_accounts
      WHERE platform_key = ${platformKey}
        AND handle ILIKE ${'%' + handle + '%'}
      LIMIT 5
    `);
    const fuzzyMatches = (fuzzy as unknown as Array<Record<string, unknown>>)
      .map((r) => ({ id: Number(r.id), handle: String(r.handle ?? '') }))
      .filter((m) => m.handle);

    const candidates = await db.execute(sql`
      SELECT handle FROM platform_accounts
      WHERE platform_key = ${platformKey} AND handle IS NOT NULL
      ORDER BY updated_at DESC LIMIT 20
    `);
    const candList = (candidates as unknown as Array<Record<string, unknown>>)
      .map((r) => String(r.handle ?? '')).filter(Boolean);
    return NextResponse.json({
      ok: true,
      account: null,
      debug: { handle, platformKey, rawHandle, candidates: candList, fuzzyMatches },
      message: fuzzyMatches.length
        ? `Không match exact "@${handle}", nhưng có ${fuzzyMatches.length} handle tương tự: ${fuzzyMatches.map((m) => '@' + m.handle).join(', ')}.`
        : `Chưa tìm thấy account @${handle} trên ${platformKey} trong MOS2. (Có ${candList.length} account khác)`,
    });
  }

  const persona = (acc.persona as Record<string, unknown> | null) ?? {};

  // Participations: MỌI project account tham gia (primary = profile-target). Account
  // tham gia nhiều project; ext hiện chips + biết project chính.
  const partRows = await db.execute(sql`
    SELECT pj.project_id, pj.role, p.name AS project_name, p.emoji
    FROM project_accounts pj LEFT JOIN projects p ON p.id = pj.project_id
    WHERE pj.account_id = ${Number(acc.id)}
    ORDER BY (pj.role = 'primary') DESC, p.name
  `);
  const participations = (partRows as unknown as Array<Record<string, unknown>>).map((r) => ({
    projectId: String(r.project_id),
    role: String(r.role ?? 'shared'),
    name: String(r.project_name ?? r.project_id),
    emoji: r.emoji ? String(r.emoji) : '',
  }));

  // 2. Brief context — pass habitatId từ ext. Brief = pair (account, habitat).
  // Nếu pair chưa có → null. UI side panel sẽ hiển thị nút tạo brief.
  let brief: Record<string, unknown> | null = null;
  let habitat: Record<string, unknown> | null = null;
  // Trả list ALL briefs của account (cross-habitat) → side panel có thể
  // hiển thị "có brief ở 3 habitat khác" + link mở.
  const allBriefRows = await db.execute(sql`
    SELECT b.id, b.habitat_id, h.name AS habitat_name, b.current_phase, b.join_status
    FROM community_briefs b
    LEFT JOIN habitats h ON h.id = b.habitat_id
    WHERE b.account_id = ${Number(acc.id)}
    ORDER BY b.updated_at DESC
    LIMIT 20
  `);
  const otherBriefs = (allBriefRows as unknown as Array<Record<string, unknown>>)
    .map((r) => ({
      id: Number(r.id),
      habitatId: Number(r.habitat_id),
      habitatName: String(r.habitat_name ?? ''),
      currentPhase: String(r.current_phase ?? ''),
      joinStatus: String(r.join_status ?? ''),
    }));

  if (habitatId > 0) {
    const briefRows = await db.execute(sql`
      SELECT
        b.id, b.current_phase, b.approach_md, b.narrative_md, b.tone, b.do_md, b.dont_md,
        b.humanizer,
        b.join_status, b.join_note, b.join_url, b.join_checklist, b.follow_up_at,
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
        humanizer: br.humanizer ?? null,   // override per-habitat (null = kế thừa account)
        doMd: String(br.do_md ?? ''),
        dontMd: String(br.dont_md ?? ''),
        joinStatus: String(br.join_status ?? ''),
        joinNote: br.join_note ? String(br.join_note) : '',
        joinUrl: br.join_url ? String(br.join_url) : '',
        joinChecklist: (br.join_checklist as Record<string, { done?: boolean }>) ?? {},
        followUpAt: br.follow_up_at ? new Date(br.follow_up_at as string).toISOString() : null,
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
    otherBriefs,
    participations,
    account: {
      id: Number(acc.id),
      projectId: String(acc.project_id),
      handle: String(acc.handle ?? ''),
      email: acc.email ? String(acc.email) : null,
      platformKey,
      platformLabel: String(acc.platform_label ?? platformKey),
      status: String(acc.status ?? 'unknown'),
      blockReason: acc.block_reason ? String(acc.block_reason) : null,
      accountKind: String(acc.account_kind ?? 'user'),
      // Link tới identity (lưu trong persona lúc tạo) → view account hiện đúng identity.
      identityId: persona.identityId != null ? Number(persona.identityId) : null,
      // Full persona object → ext 🧩 Profile fields restore giá trị ĐÃ tự lưu vào
      // profile account này (vals lưu dưới persona[fieldKey] qua personaUpdates).
      persona,
      // Post-reg follow-up (tier 1): ngày hẹn + progress steps (warmup_checklist).
      followUpAt: acc.follow_up_at ? new Date(acc.follow_up_at as string).toISOString() : null,
      warmupChecklist: (acc.warmup_checklist as Record<string, { done?: boolean; updatedAt?: string }>) ?? {},
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
