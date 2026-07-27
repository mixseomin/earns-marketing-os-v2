// Staff review queue — the human side of the generic review mechanism.
// Served at user.on.tc (confined by middleware) and at mos2.on.tc/review.
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ReviewQueue } from './review-queue';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  // No valid session (missing/stale cookie) → send to login, not a 500. requireAuth() throws.
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/review');
  return <ReviewQueue reviewer={user.displayName || user.name || user.email} />;
}
