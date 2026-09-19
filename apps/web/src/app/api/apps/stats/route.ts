// GET /api/apps/stats?app=<key>&days=30 — số theo ngày + retention cohort (Bearer MOS2_EXT_KEY).
// Mỗi ngày: cài mới, DAU (install có sự kiện), phiên, ván, interstitial, rewarded (xem hết), mua bỏ ads.
// Retention: cohort cài ngày d → % có sự kiện đúng ngày d+1 / d+7 / d+30 (classic day-N).
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../ext/_auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await checkAuth(req);
  if (denied) return denied;
  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'db' }, { status: 503 });
  const u = new URL(req.url);
  const app = u.searchParams.get('app') ?? '';
  const days = Math.min(365, Math.max(1, Number(u.searchParams.get('days')) || 30));
  if (!app) {
    const apps = await db.execute(sql`
      SELECT a.key, a.ten, a.bundle_id, a.project_id, a.created_at,
             (SELECT count(*) FROM app_cai c WHERE c.app_key = a.key) AS installs,
             (SELECT count(DISTINCT install_id) FROM app_su_kien s WHERE s.app_key = a.key AND s.ts >= now() - interval '1 day') AS dau
      FROM app_ung_dung a ORDER BY a.created_at`);
    return NextResponse.json({ ok: true, apps });
  }
  const ngay = await db.execute(sql`
    WITH d AS (SELECT generate_series((now() - make_interval(days => ${days} - 1))::date, now()::date, '1 day')::date AS ngay)
    SELECT d.ngay,
      (SELECT count(*) FROM app_cai c WHERE c.app_key = ${app} AND c.first_seen::date = d.ngay) AS cai,
      (SELECT count(DISTINCT install_id) FROM app_su_kien s WHERE s.app_key = ${app} AND s.ts::date = d.ngay) AS dau,
      (SELECT count(*) FROM app_su_kien s WHERE s.app_key = ${app} AND s.ts::date = d.ngay AND s.ten = 'session_start') AS phien,
      (SELECT count(*) FROM app_su_kien s WHERE s.app_key = ${app} AND s.ts::date = d.ngay AND s.ten = 'game_end') AS van,
      (SELECT count(*) FROM app_su_kien s WHERE s.app_key = ${app} AND s.ts::date = d.ngay AND s.ten = 'ad_interstitial' AND (s.props->>'shown')::boolean) AS interstitial,
      (SELECT count(*) FROM app_su_kien s WHERE s.app_key = ${app} AND s.ts::date = d.ngay AND s.ten = 'ad_rewarded' AND (s.props->>'rewarded')::boolean) AS rewarded,
      (SELECT count(*) FROM app_su_kien s WHERE s.app_key = ${app} AND s.ts::date = d.ngay AND s.ten = 'iap_remove_ads') AS mua
    FROM d ORDER BY d.ngay`);
  const giu = await db.execute(sql`
    WITH c AS (SELECT install_id, first_seen::date AS d0 FROM app_cai WHERE app_key = ${app} AND first_seen >= now() - make_interval(days => ${days}))
    SELECT n AS ngay_thu, count(*) AS cohort,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM app_su_kien s WHERE s.app_key = ${app} AND s.install_id = c.install_id AND s.ts::date = c.d0 + n)) AS quay_lai
    FROM c CROSS JOIN (VALUES (1), (7), (30)) AS v(n)
    WHERE c.d0 + n <= now()::date
    GROUP BY n ORDER BY n`);
  return NextResponse.json({ ok: true, app, days, ngay, giu });
}
