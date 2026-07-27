// Lightweight session check for nginx `auth_request` SSO across *.on.tc subdomains.
// 204 = logged in (allow), 401 = not (nginx redirects to /login). No body.
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return new Response(null, { status: 401 });          // not logged in → nginx → /login
  // Reviewers (role 'viewer') are confined to the user.on.tc review portal. Full-access
  // surfaces behind auth_request (course.on.tc, …) reject them → nginx bounces to user.on.tc.
  if (u.role === 'viewer') return new Response(null, { status: 403 });
  return new Response(null, { status: 204 });
}
