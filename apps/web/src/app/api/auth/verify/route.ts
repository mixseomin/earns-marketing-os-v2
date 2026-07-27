// Lightweight session check for nginx `auth_request` SSO across *.on.tc subdomains.
// 204 = logged in (allow), 401 = not (nginx redirects to /login). No body.
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getCurrentUser();
  return new Response(null, { status: u ? 204 : 401 });
}
