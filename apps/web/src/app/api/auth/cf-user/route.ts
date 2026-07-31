// Identity gate for course.on.tc (nginx `auth_request`). Unlike /api/auth/verify, this
// admits ANY logged-in MOS2 user (including 'viewer') and forwards their email via the
// x-cf-user response header. The CourseForge control-plane (:3820) decides admin/staff/none
// from its own per-course reviewer lists — so a reviewer is a MOS2 'viewer' whose email is
// shared onto a course. 401 = not logged in → nginx redirects to /login.
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return new Response(null, { status: 401 });
  return new Response(null, { status: 204, headers: { 'x-cf-user': u.email } });
}
