// Staff review queue — the human side of the generic review mechanism.
// Served at user.on.tc (confined by middleware) and at mos2.on.tc/review.
import { requireAuth } from '@/lib/auth';
import { ReviewQueue } from './review-queue';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const user = await requireAuth(); // redirects to /login if not signed in
  return <ReviewQueue reviewer={user.displayName || user.name || user.email} />;
}
