import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { getDb, habitats, platforms, platformTechnologies } from '@mos2/db';
import { ilike, eq, and, or, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/ext/platform-info?host=skyscript.co.uk
// Returns BOTH matching habitat + platform separately so the extension
// can show per-target tech state and update each independently
// (a site may run WordPress on main + phpBB on /forum subpath).
export async function GET(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ habitat: null, platform: null, source: 'db-unavailable' });

  const sp = new URL(req.url).searchParams;
  const host = sp.get('host') ?? '';
  const projectId = sp.get('projectId') ?? '';
  if (!host) return NextResponse.json({ error: 'Missing host' }, { status: 400 });

  // Habitats are project-scoped — filter by current project so a Skyscript
  // habitat in `astrolas` doesn't leak into `orit` extension context.
  const habitatWhere = projectId
    ? and(ilike(habitats.url, `%${host}%`), eq(habitats.projectId, projectId))
    : ilike(habitats.url, `%${host}%`);

  const [habitatRow] = await db
    .select({
      id: habitats.id,
      name: habitats.name,
      url: habitats.url,
      projectId: habitats.projectId,
      technologyKey: habitats.technologyKey,
      techLabel: platformTechnologies.label,
    })
    .from(habitats)
    .leftJoin(platformTechnologies, eq(habitats.technologyKey, platformTechnologies.key))
    .where(habitatWhere)
    .limit(1);

  const [platformRow] = await db
    .select({
      key: platforms.key,
      label: platforms.label,
      signupUrl: platforms.signupUrl,
      technologyKey: platforms.technologyKey,
      techLabel: platformTechnologies.label,
      notes: platforms.notes,
      signupVerify: platforms.signupVerify,
      acquisitionMethod: platforms.acquisitionMethod,
    })
    .from(platforms)
    .leftJoin(platformTechnologies, eq(platforms.technologyKey, platformTechnologies.key))
    // match by signupUrl OR by host-slug key (ext-created platforms have empty signupUrl,
    // key = host without www, dots→'-' — same as the widget's platformKeyOf()).
    .where(or(ilike(platforms.signupUrl, `%${host}%`), eq(platforms.key, host.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase())))
    .limit(1);

  // signup quirk: email activation known broken (mail never arrives) → ext warns upfront +
  // skips waiting. Raw sql vì cột chưa map trong Drizzle schema.
  let emailVerifyBroken = false;
  if (platformRow?.key) {
    try {
      const r = await db.execute(sql`SELECT email_verify_broken FROM platforms WHERE key = ${platformRow.key} LIMIT 1`);
      emailVerifyBroken = !!(r as unknown as Array<{ email_verify_broken: boolean }>)[0]?.email_verify_broken;
    } catch { /* cột có thể chưa migrate */ }
  }

  return NextResponse.json({
    habitat: habitatRow ? {
      id: habitatRow.id,
      name: habitatRow.name,
      url: habitatRow.url,
      projectId: habitatRow.projectId,
      technologyKey: habitatRow.technologyKey ?? null,
      techLabel: habitatRow.techLabel ?? null,
    } : null,
    platform: platformRow ? {
      key: platformRow.key,
      label: platformRow.label,
      signupUrl: platformRow.signupUrl,
      technologyKey: platformRow.technologyKey ?? null,
      techLabel: platformRow.techLabel ?? null,
      emailVerifyBroken,
      notes: platformRow.notes ?? '',
      signupVerify: platformRow.signupVerify ?? '',
      acquisitionMethod: platformRow.acquisitionMethod ?? '',
    } : null,
  });
}

// POST /api/ext/platform-info — explicit target update
// Body: { target: 'habitat' | 'platform', id (habitatId) | key (platformKey), technologyKey }
export async function POST(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const body = await req.json() as {
    target: 'habitat' | 'platform';
    id?: number;
    key?: string;
    technologyKey?: string | null;
    emailVerifyBroken?: boolean;
    notes?: string;
    signupVerify?: string;
    acquisitionMethod?: string;
    // P2.4: login challenges per-platform (ext 🛡 recorder) — [{type,label?,note?,prepare?}].
    // Cột platforms.login_challenges (jsonb, raw — accounts GET :116 đã đọc để trả PREP_ICON cho console).
    login_challenges?: Array<Record<string, unknown>>;
  };

  if (body.target === 'habitat') {
    if (!body.id) return NextResponse.json({ error: 'Missing habitat id' }, { status: 400 });
    await db.update(habitats).set({ technologyKey: body.technologyKey ?? null }).where(eq(habitats.id, body.id));
    return NextResponse.json({ ok: true, target: 'habitat', id: body.id });
  }

  if (body.target === 'platform') {
    if (!body.key) return NextResponse.json({ error: 'Missing platform key' }, { status: 400 });
    // flag-only update (email_verify_broken) must NOT clobber technologyKey → set per field provided.
    if (typeof body.emailVerifyBroken === 'boolean') {
      await db.execute(sql`UPDATE platforms SET email_verify_broken = ${body.emailVerifyBroken}, updated_at = now() WHERE key = ${body.key}`);
    }
    if ('technologyKey' in body) {
      await db.update(platforms).set({ technologyKey: body.technologyKey ?? null, updatedAt: new Date() }).where(eq(platforms.key, body.key));
    }
    // Platform KNOWLEDGE tự do (vd "Wikidata: auto-login xong VẪN phải confirm email"). Upsert vì platform
    // do ext tạo có thể chưa tồn tại. Reuse cột platforms.notes (ko đẻ bảng mới).
    if (typeof body.notes === 'string') {
      await db.insert(platforms).values({ key: body.key, label: body.key, signupUrl: '', notes: body.notes })
        .onConflictDoUpdate({ target: platforms.key, set: { notes: body.notes, updatedAt: new Date() } });
    }
    // Yêu cầu xác minh sau signup (map OUTCOMES: active/email/mod/phone) — nhớ per-platform.
    if (typeof body.signupVerify === 'string') {
      await db.insert(platforms).values({ key: body.key, label: body.key, signupUrl: '', signupVerify: body.signupVerify })
        .onConflictDoUpdate({ target: platforms.key, set: { signupVerify: body.signupVerify, updatedAt: new Date() } });
    }
    // P3 no-signup routing: phương thức lấy backlink khi ko tạo account (oauth_only/no_account_form/guest_post_email/gated/no_ugc).
    // '' = clear (chủ đích). Nhớ per-platform → advisor bỏ bước tạo account lần sau + report phân bổ nhân sự.
    if (typeof body.acquisitionMethod === 'string') {
      const am = body.acquisitionMethod.trim().slice(0, 40) || null;
      await db.insert(platforms).values({ key: body.key, label: body.key, signupUrl: '', acquisitionMethod: am })
        .onConflictDoUpdate({ target: platforms.key, set: { acquisitionMethod: am, updatedAt: new Date() } });
    }
    // P2.4: login challenges (mirror pattern signupVerify; cột raw jsonb → sql). Sanitize: giữ string fields
    // quen thuộc, cap 10 entries. Mảng rỗng = clear (chủ đích của user).
    if (Array.isArray(body.login_challenges)) {
      const clean = body.login_challenges.slice(0, 10).map((c) => {
        const o: Record<string, string> = {};
        for (const f of ['type', 'label', 'note', 'prepare'] as const) {
          const v = (c as Record<string, unknown>)[f];
          if (typeof v === 'string' && v.trim()) o[f] = v.trim().slice(0, 120);
        }
        return o;
      }).filter((o) => o.type);
      await db.execute(sql`
        INSERT INTO platforms (key, label, signup_url, login_challenges)
        VALUES (${body.key}, ${body.key}, '', ${JSON.stringify(clean)}::jsonb)
        ON CONFLICT (key) DO UPDATE SET login_challenges = ${JSON.stringify(clean)}::jsonb, updated_at = now()
      `);
    }
    return NextResponse.json({ ok: true, target: 'platform', key: body.key });
  }

  return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
}
