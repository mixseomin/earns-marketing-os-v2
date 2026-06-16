import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { listPlatformsWithUsage, createPlatform } from '@/lib/actions/platforms';

export const dynamic = 'force-dynamic';

// GET /api/ext/platforms?q=&category=
// List platforms (slim) cho PlatformPicker khi map forum habitat (Req#1).
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') ?? '').trim().toLowerCase();
  const category = (sp.get('category') ?? '').trim();

  const all = await listPlatformsWithUsage();
  const rows = all
    .filter((p) => !category || p.category === category)
    .filter((p) => !q || p.key.toLowerCase().includes(q) || p.label.toLowerCase().includes(q))
    .map((p) => ({
      key: p.key,
      label: p.label,
      category: p.category ?? null,
      technologyKey: p.technologyKey ?? null,
      signupUrl: p.signupUrl ?? '',
      accountsCount: p.accountsCount ?? 0,
    }));
  return NextResponse.json({ ok: true, platforms: rows });
}

// POST /api/ext/platforms { key?, label, signupUrl?, technologyKey?, category? }
// Tạo platform mới khi forum lạ chưa có platform phù hợp (Req#1).
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const body = await req.json().catch(() => ({})) as {
    key?: string;
    label?: string;
    signupUrl?: string;
    technologyKey?: string | null;
    category?: string;
  };
  if (!body.label?.trim()) {
    return errorResponse('label required', 400);
  }

  const res = await createPlatform({
    key: (body.key ?? '').trim(),
    label: body.label.trim(),
    // signupUrl bắt buộc trong createPlatform — forum thì dùng URL trang/base.
    signupUrl: (body.signupUrl ?? '').trim() || 'https://example.invalid/',
    priority: 'medium',
    iconSlug: '',
    technologyKey: body.technologyKey ?? null,
    // category optional — cast vì PlatformCategory enum hẹp; createPlatform tự xử lý.
    ...(body.category ? { category: body.category as never } : {}),
  });

  if (!res.ok) return errorResponse(res.error, 400);
  return NextResponse.json({ ok: true, key: res.key, directusWarning: res.directusWarning });
}
