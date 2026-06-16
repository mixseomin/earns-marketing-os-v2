import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';
import { renameProfileField } from '@/lib/actions/profile-fields';

export const dynamic = 'force-dynamic';

// POST /api/ext/profile-fields/rename
// Body: { platform_key, page_kind, scope_kind, scope_key, old_name, new_name }
// Renames a profile field EVERYWHERE in one shot: the selector_overrides row at
// (scope, page) + the persona key across every account on the platform. The ext
// editor + dashboard both call this so a rename can never drift between the two
// stores again. Returns the name actually saved (may differ if the CSS-identity
// guard folded it onto an existing field) + how many accounts had a value moved.
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const body = (await req.json().catch(() => ({}))) as {
    platform_key?: string; page_kind?: string;
    scope_kind?: string; scope_key?: string;
    old_name?: string; new_name?: string;
  };

  if (!body.platform_key || !body.page_kind || !body.scope_kind || !body.scope_key || !body.old_name || !body.new_name) {
    return errorResponse('platform_key + page_kind + scope_kind + scope_key + old_name + new_name required', 400);
  }
  const scopeKind = body.scope_kind;
  if (scopeKind !== 'engine' && scopeKind !== 'platform' && scopeKind !== 'habitat') {
    return errorResponse('scope_kind must be engine|platform|habitat', 400);
  }

  const res = await renameProfileField({
    platformKey: body.platform_key,
    pageKind: body.page_kind,
    scopeKind,
    scopeKey: body.scope_key,
    oldName: body.old_name,
    newName: body.new_name,
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
