// Seed Plan Cockpit: Creator Economy Newsletter
// Creates MOS2 project (brand entity) + plan + 7 goals + steps + risks.
// Plan links to project for brand identity/accounts/squads.
//
// Run: npx tsx packages/db/src/seed-plan-cockpit.ts

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb } from './client';

const db = getDb();
if (!db) {
  console.error('[plan-cockpit:seed] DATABASE_URL not set — refusing to seed.');
  process.exit(1);
}

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
const PLAN_SLUG = 'creator-economy-newsletter';
const PROJECT_ID = 'creator-econ-news';

async function main() {
  console.log(`[plan-cockpit:seed] tenant=${TENANT} slug=${PLAN_SLUG} project=${PROJECT_ID}`);

  // 0. Ensure 'affiliate' mode exists (should from base seed)
  const modeCheck = await db!.execute(sql`SELECT id FROM modes WHERE id = 'affiliate' LIMIT 1`);
  if (!(modeCheck as unknown as Array<unknown>).length) {
    console.error('[plan-cockpit:seed] mode "affiliate" not found — run base seed first');
    process.exit(1);
  }

  // 1. Create MOS2 project (brand entity) - upsert
  await db!.execute(sql`
    INSERT INTO projects (
      id, tenant_id, name, emoji, mode_id, color, kpi,
      website, one_liner, bio, persona, hashtags,
      revenue, ai_enabled, is_demo
    )
    VALUES (
      ${PROJECT_ID}, ${TENANT}, 'Creator Economy Newsletter', '🎯', 'affiliate', '#a78bfa',
      'subs · MRR · open rate',
      '', '',
      '', '', '',
      '$0', true, false
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      emoji = EXCLUDED.emoji,
      color = EXCLUDED.color,
      kpi = EXCLUDED.kpi,
      updated_at = NOW()
  `);
  console.log(`[plan-cockpit:seed] project upserted: ${PROJECT_ID}`);

  // 2. Plan upsert + link to project
  const planRows = await db!.execute(sql`
    INSERT INTO plans (tenant_id, slug, name, status, niche, target_mrr_usd, current_mrr_usd, description, started_at, target_date, project_id)
    VALUES (
      ${TENANT}, ${PLAN_SLUG},
      'Creator Economy Newsletter',
      'planning',
      'creator-economy',
      2000, 0,
      'Weekly curated deals on Beehiiv, ConvertKit, Webflow, Kajabi + 15 creator tools. Recurring lifetime commission stack via PartnerStack + direct programs. Target $2K MRR by month 12.',
      NULL, NULL, ${PROJECT_ID}
    )
    ON CONFLICT (tenant_id, slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      target_mrr_usd = EXCLUDED.target_mrr_usd,
      current_mrr_usd = 0,
      started_at = NULL,
      target_date = NULL,
      project_id = EXCLUDED.project_id,
      updated_at = NOW()
    RETURNING id
  `);
  const planId = Number((planRows as unknown as Array<{ id: string | number }>)[0]!.id);
  console.log(`[plan-cockpit:seed] plan id=${planId} linked to project=${PROJECT_ID}`);

  // Wipe child rows for clean re-seed
  await db!.execute(sql`DELETE FROM plan_steps WHERE goal_id IN (SELECT id FROM plan_goals WHERE plan_id = ${planId})`);
  await db!.execute(sql`DELETE FROM plan_goals WHERE plan_id = ${planId}`);
  await db!.execute(sql`DELETE FROM plan_risks WHERE plan_id = ${planId}`);
  await db!.execute(sql`DELETE FROM plan_activity_log WHERE plan_id = ${planId}`);

  // 3. Goals — Foundation first, then growth
  const goalsSpec: Array<{ name: string; targetValue: number; unit: string; orderIdx: number }> = [
    { name: '🏗 Phase 0: Foundation', targetValue: 10, unit: 'setup steps', orderIdx: 0 },
    { name: '1,000 subscribers', targetValue: 1000, unit: 'subs', orderIdx: 1 },
    { name: '5,000 subscribers', targetValue: 5000, unit: 'subs', orderIdx: 2 },
    { name: '$500/month MRR', targetValue: 500, unit: 'usd_mrr', orderIdx: 3 },
    { name: '$2K/month MRR + sponsors', targetValue: 2000, unit: 'usd_mrr', orderIdx: 4 },
    { name: '5 newsletter swap partners', targetValue: 5, unit: 'partners', orderIdx: 5 },
    { name: 'Beehiiv Boosts $100/mo budget', targetValue: 100, unit: 'usd_budget', orderIdx: 6 },
  ];

  const goalIdMap: Record<string, number> = {};
  for (const g of goalsSpec) {
    const r = await db!.execute(sql`
      INSERT INTO plan_goals (plan_id, name, target_value, target_unit, current_value, deadline, status, order_index)
      VALUES (${planId}, ${g.name}, ${g.targetValue}, ${g.unit}, 0, NULL, 'todo', ${g.orderIdx})
      RETURNING id
    `);
    goalIdMap[g.name] = Number((r as unknown as Array<{ id: string | number }>)[0]!.id);
  }

  // 4. Foundation steps (10 setup actions)
  const foundationGoalId = goalIdMap['🏗 Phase 0: Foundation']!;
  const foundationSteps: Array<{
    name: string; channel?: string; channelTarget?: string;
    target?: { kind: string; value: number };
    timeEstimate?: string; cadence?: string; notes?: string; orderIdx: number;
  }> = [
    {
      name: 'Pick brand name + value prop (10-min decision)',
      channel: 'decision', channelTarget: '—',
      timeEstimate: '15 phút', cadence: '1 shot',
      notes: 'Candidates: CreatorDeals.email / StackSavings.io / NewsletterDeals.dev. Value prop: "Weekly curated deals on Beehiiv/ConvertKit/Webflow + 15 creator tools. 12-second read."',
      orderIdx: 0,
    },
    {
      name: 'Buy domain ($10-15/year)',
      channel: 'namecheap', channelTarget: 'namecheap.com hoặc porkbun.com',
      timeEstimate: '15 phút', cadence: '1 shot',
      notes: 'Pick .com nếu có; .io / .email cũng OK cho audience tech',
      orderIdx: 1,
    },
    {
      name: 'Setup Beehiiv free account + custom domain DNS',
      channel: 'beehiiv', channelTarget: 'beehiiv.com',
      timeEstimate: '1h', cadence: '1 shot',
      notes: 'Free tier 2.5K subs. Add 4 DNS records vào Cloudflare → verify trong 10-30 phút. Enable SPF/DKIM/DMARC auto.',
      orderIdx: 2,
    },
    {
      name: 'Apply Awin publisher ($5 deposit, 24-48h)',
      channel: 'awin', channelTarget: 'ui.awin.com/awin-signup/publisher',
      timeEstimate: '30 phút apply', cadence: '1 shot',
      notes: 'Cần landing có content tử tế trước khi apply (ít nhất 1 sample issue + about). Refundable deposit khi qualify $20 commission.',
      orderIdx: 3,
    },
    {
      name: 'Apply PartnerStack publisher (primary network)',
      channel: 'partnerstack', channelTarget: 'partnerstack.com',
      timeEstimate: '30 phút', cadence: '1 shot',
      notes: 'PartnerStack chiếm ~50% market PRM B2B SaaS. Coverage Monday/HubSpot/ClickUp/Webflow. VN-friendly, PayPal payout.',
      orderIdx: 4,
    },
    {
      name: 'Apply Impact + CJ + ShareASale (backup networks)',
      channel: 'impact', channelTarget: 'app.impact.com + cj.com + shareasale.com',
      timeEstimate: '1h tổng', cadence: '1 shot',
      notes: 'Coverage merchants Awin/PartnerStack không có. Impact mạnh enterprise (Adobe, HubSpot). Skimlinks fallback đã có.',
      orderIdx: 5,
    },
    {
      name: 'Apply direct: Beehiiv (60% recurring) + Kit (30% lifetime) + Webflow (50%)',
      channel: 'direct', channelTarget: 'Beehiiv + ConvertKit + Webflow affiliate pages',
      timeEstimate: '45 phút', cadence: '1 shot',
      notes: 'Beehiiv 60% recurring 12 tháng (60-day cookie) — rate cao nhất. Kit 30% LIFETIME recurring. Webflow 50% revenue share 12mo.',
      orderIdx: 6,
    },
    {
      name: 'Build "Coming soon + email capture" landing page',
      channel: 'landing', channelTarget: 'Beehiiv hosted landing OR Vercel Next.js',
      timeEstimate: '2h', cadence: '1 shot',
      notes: 'Strong value prop + sample issue preview + subscribe form. KHÔNG dùng generic Beehiiv default landing. Cần để Awin approve.',
      orderIdx: 7,
    },
    {
      name: 'Write 2 mock sample issues (no send, just publish to /archive)',
      channel: 'content', channelTarget: 'Beehiiv editor',
      timeEstimate: '3h', cadence: '1 shot',
      notes: 'Issue #1 + #2 với 8-12 deals mock. Format: tool icon + 2-3 sentence blurb + CTA "Get deal →". Required cho social proof khi outreach.',
      orderIdx: 8,
    },
    {
      name: 'Apply 20-30 specific merchants trong dashboard PartnerStack/Awin',
      channel: 'merchants', channelTarget: 'PartnerStack + Awin merchant directory',
      timeEstimate: '2h', cadence: '1 shot',
      notes: 'Tier 1: Monday, HubSpot, ClickUp, Notion, Webflow, Beehiiv, Kit, Kajabi. Tier 2: indie tools (Tally, Cal, Lemon Squeezy, Carrd, Framer). Mỗi merchant approve riêng.',
      orderIdx: 9,
    },
  ];

  for (const s of foundationSteps) {
    await db!.execute(sql`
      INSERT INTO plan_steps (
        goal_id, name, channel, channel_target, due_date, owner, status,
        target_metric, notes, order_index, time_estimate, cadence
      )
      VALUES (
        ${foundationGoalId}, ${s.name},
        ${s.channel || null}, ${s.channelTarget || null},
        NULL, 'me', 'todo',
        ${JSON.stringify(s.target || {})}::jsonb,
        ${s.notes || null}, ${s.orderIdx},
        ${s.timeEstimate || null}, ${s.cadence || null}
      )
    `);
  }

  // 5. Distribution steps under "1,000 subscribers" (11-channel playbook)
  const subsGoalId = goalIdMap['1,000 subscribers']!;
  const distroSteps: Array<{
    name: string; channel?: string; channelTarget?: string;
    target?: { kind: string; value: number };
    timeEstimate?: string; cadence?: string; notes?: string; orderIdx: number;
  }> = [
    { name: 'Reddit r/Newsletters launch post', channel: 'reddit', channelTarget: 'r/Newsletters (30K)', target: { kind: 'subs', value: 60 }, timeEstimate: '1h', cadence: '1/tuần max', notes: 'Post sau khi đã có 50 subs seed. Mid-week (Wed-Thu).', orderIdx: 0 },
    { name: 'Reddit r/SaaS / r/Entrepreneur / r/IndieDev', channel: 'reddit', channelTarget: 'r/SaaS (677K), r/Entrepreneur (4M), r/IndieDev', target: { kind: 'subs', value: 175 }, timeEstimate: '2h', cadence: '1 post/2 tuần', notes: 'Comment helpful trong threads 2 tuần TRƯỚC khi post; sau đó "Milestone" post.', orderIdx: 1 },
    { name: 'IndieHackers milestone posts', channel: 'indiehackers', channelTarget: 'indiehackers.com', target: { kind: 'subs', value: 90 }, timeEstimate: '1h', cadence: 'mỗi milestone', notes: '"Hit 100/500/1000 subs - here\'s what worked"', orderIdx: 2 },
    { name: 'Twitter/X build-in-public threads', channel: 'twitter', channelTarget: '@me', target: { kind: 'subs', value: 30 }, timeEstimate: '30 phút', cadence: '2-3/tuần', notes: 'Build-in-public threads (numbers, learnings), tag creators relevant', orderIdx: 3 },
    { name: 'dev.to / Hashnode tutorial articles', channel: 'devto', channelTarget: 'dev.to + hashnode', target: { kind: 'subs', value: 60 }, timeEstimate: '3h', cadence: '1/tuần', notes: '"How I built [thing] with Beehiiv" tutorial style, embed subscribe form', orderIdx: 4 },
    { name: 'Hacker News Show HN launch', channel: 'hackernews', channelTarget: 'news.ycombinator.com', target: { kind: 'subs', value: 200 }, timeEstimate: '30 phút', cadence: '1 shot', notes: 'Launch khi đã polish + có 100 beta subs. Tue/Wed sáng EST tốt nhất.', orderIdx: 5 },
    { name: 'ProductHunt launch', channel: 'producthunt', channelTarget: 'producthunt.com', target: { kind: 'subs', value: 200 }, timeEstimate: 'full day', cadence: '1 shot', notes: 'Thứ 3-5 buổi sáng GMT (12:01 AM PST), có hunter + 10 friends upvote ready', orderIdx: 6 },
    { name: 'LinkedIn cross-publish weekly issue', channel: 'linkedin', channelTarget: 'LinkedIn Newsletter', target: { kind: 'subs', value: 20 }, timeEstimate: '0 (auto)', cadence: 'weekly', notes: 'Cross-publish issue dưới dạng LinkedIn Newsletter (free, 5K+ followers easy)', orderIdx: 7 },
    { name: 'SparkLoop Upscribe (free tier)', channel: 'sparkloop', channelTarget: 'sparkloop.app', target: { kind: 'subs', value: 60 }, timeEstimate: '1h setup', cadence: 'setup once', notes: 'Free tier: newsletter này khi user subscribe newsletter khác → recommended → 1-click sub', orderIdx: 8 },
    { name: 'Beehiiv Recommendations swaps', channel: 'beehiiv', channelTarget: 'Beehiiv built-in', target: { kind: 'subs', value: 30 }, timeEstimate: '30 phút outreach', cadence: 'setup', notes: 'Built-in: trao đổi recommendation với 5-10 newsletter tương đương quy mô', orderIdx: 9 },
    { name: 'Niche Discord/Slack participation', channel: 'discord', channelTarget: 'Indie Hackers, Newsletter Operator, Creator Stack', target: { kind: 'subs', value: 12 }, timeEstimate: 'ongoing', cadence: 'not promotional', notes: 'Active member 2 tuần trước, share newsletter khi relevant', orderIdx: 10 },
    { name: 'Beehiiv Boosts paid acquisition', channel: 'beehiiv', channelTarget: 'Beehiiv Boosts marketplace', target: { kind: 'subs', value: 35 }, timeEstimate: '15 phút setup', cadence: 'after 200 subs', notes: '$1-3/sub CPA. Activate $50 test budget khi đã có 200+ subs + first $100 commission. ~33 subs cho $50.', orderIdx: 11 },
  ];

  for (const s of distroSteps) {
    await db!.execute(sql`
      INSERT INTO plan_steps (
        goal_id, name, channel, channel_target, due_date, owner, status,
        target_metric, notes, order_index, time_estimate, cadence
      )
      VALUES (
        ${subsGoalId}, ${s.name},
        ${s.channel || null}, ${s.channelTarget || null},
        NULL, 'me', 'todo',
        ${JSON.stringify(s.target || {})}::jsonb,
        ${s.notes || null}, ${s.orderIdx},
        ${s.timeEstimate || null}, ${s.cadence || null}
      )
    `);
  }

  // 6. Risks
  const risksSpec = [
    { name: 'PartnerStack/Awin reject publisher (empty site)', probability: 'medium', impact: 'high', mitigation: 'Publish landing với sample issue + 200-word "About" trước khi apply. Fallback: direct programs (Beehiiv 60% recurring, Kit 30% lifetime).' },
    { name: '<100 subs sau 4 tuần distribution', probability: 'medium', impact: 'high', mitigation: 'Re-outreach personal network round 2; add dev.to article #2; cân nhắc Beehiiv Boosts sớm hơn plan.' },
    { name: 'Beehiiv ToS violation (affiliate-heavy content)', probability: 'low', impact: 'high', mitigation: 'Editorial style, soft promote, FTC disclosure. Backup: Kit (own affiliate program, friendlier).' },
    { name: 'Newsletter peers refuse swap (no audience parity)', probability: 'medium', impact: 'medium', mitigation: 'Wait until 500+ subs before swap outreach. Lead with offer not ask.' },
  ];
  for (const r of risksSpec) {
    await db!.execute(sql`
      INSERT INTO plan_risks (plan_id, name, probability, impact, mitigation, status)
      VALUES (${planId}, ${r.name}, ${r.probability}, ${r.impact}, ${r.mitigation}, 'open')
    `);
  }

  // 7. AI context — clean
  await db!.execute(sql`
    INSERT INTO plan_ai_context (plan_id, snapshot, refreshed_at)
    VALUES (${planId}, '{}'::jsonb, NOW())
    ON CONFLICT (plan_id) DO UPDATE SET snapshot = '{}'::jsonb, refreshed_at = NOW(), ai_brief = NULL, ai_brief_at = NULL
  `);

  console.log(`[plan-cockpit:seed] OK — plan_id=${planId}, project=${PROJECT_ID}, goals=${goalsSpec.length}, foundation=10, distro=12, risks=${risksSpec.length}`);
  console.log(`[plan-cockpit:seed] view: https://mos2.on.tc/dash/plans/${PLAN_SLUG}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[plan-cockpit:seed] FAILED', e);
  process.exit(1);
});
