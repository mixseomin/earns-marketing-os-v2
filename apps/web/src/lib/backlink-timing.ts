// Canonical per-site timing stamps for a backlink task status transition. Pure module (NOT 'use server')
// so BOTH setBacklinkSite (board / play CLI / runners / site-status API) AND syncProspectToTask (outreach
// reverse-sync) import the SAME logic — the stamps can never diverge (one root, no patch-work).
//
// On →submitted: stamp site_submitted_at (waiting-since) AND default a follow-up/check-back date
//   site_scheduled_at = submitted + `followDays` if none is set → an awaiting-approval task ALWAYS has a
//   follow date (that's the requirement).
// On →completed/verified: stamp site_done_at + clear the submitted stamp + the follow date (done).
// Otherwise: clear the submitted stamp, and leave any user-planned schedule date untouched.
import { sql } from 'drizzle-orm';

export function siteTimingMerges(site: string, status: string, nowIso: string, followDays = 7) {
  const done = status === 'completed' || status === 'verified';
  const submitted = status === 'submitted';
  const doneMerge = done
    ? sql`|| jsonb_build_object('site_done_at', COALESCE(prep_payload->'site_done_at', '{}'::jsonb) || jsonb_build_object(${site}::text, to_jsonb(COALESCE(prep_payload->'site_done_at'->>${site}, ${nowIso}))))`
    : sql`|| jsonb_build_object('site_done_at', (COALESCE(prep_payload->'site_done_at', '{}'::jsonb) - ${site}::text))`;
  const submittedMerge = submitted
    ? sql`|| jsonb_build_object('site_submitted_at', COALESCE(prep_payload->'site_submitted_at', '{}'::jsonb) || jsonb_build_object(${site}::text, to_jsonb(COALESCE(prep_payload->'site_submitted_at'->>${site}, ${nowIso}))))`
    : sql`|| jsonb_build_object('site_submitted_at', (COALESCE(prep_payload->'site_submitted_at', '{}'::jsonb) - ${site}::text))`;
  // follow-up date = submitted date + followDays (YYYY-MM-DD); default only if unset (preserve a manual one).
  // Anchor to UTC so the calendar day is deterministic regardless of the DB session TimeZone (no off-by-one).
  const followExpr = sql`to_char(((COALESCE(prep_payload->'site_submitted_at'->>${site}, ${nowIso}))::timestamptz AT TIME ZONE 'UTC')::date + ${followDays}, 'YYYY-MM-DD')`;
  const scheduledMerge = submitted
    ? sql`|| jsonb_build_object('site_scheduled_at', COALESCE(prep_payload->'site_scheduled_at', '{}'::jsonb) || jsonb_build_object(${site}::text, to_jsonb(COALESCE(prep_payload->'site_scheduled_at'->>${site}, ${followExpr}))))`
    : done
      ? sql`|| jsonb_build_object('site_scheduled_at', (COALESCE(prep_payload->'site_scheduled_at', '{}'::jsonb) - ${site}::text))`
      : sql``;
  return sql`${doneMerge} ${submittedMerge} ${scheduledMerge}`;
}
