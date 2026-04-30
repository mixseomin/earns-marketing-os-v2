CREATE TABLE IF NOT EXISTS "library_tools" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'data' NOT NULL,
	"icon" text DEFAULT '🔧' NOT NULL,
	"requires_env" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill_snippets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_tools_tenant_idx" ON "library_tools" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_tools_category_idx" ON "library_tools" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "skill_snippets_tenant_slug_uniq" ON "skill_snippets" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_snippets_tenant_idx" ON "skill_snippets" USING btree ("tenant_id");
--> statement-breakpoint
-- Seed initial library_tools (idempotent — ON CONFLICT DO NOTHING preserves user edits).
INSERT INTO library_tools (id, name, description, category, icon, requires_env, sort_order) VALUES
  ('reddit-script',   'Reddit Script',     'OAuth posting + comment monitoring',         'platform', '🔴', 'REDDIT_CLIENT_ID', 10),
  ('twitter-api',     'Twitter / X API',   'Tweet, search, mentions',                    'platform', '🐦', NULL,               11),
  ('gumroad-api',     'Gumroad API',       'Sales / products / customers',               'platform', '💰', NULL,               12),
  ('youtube-data',    'YouTube Data API',  'Channel + video metadata',                   'platform', '📺', NULL,               13),
  ('tiktok-display',  'TikTok Display',    'Public profile/video metrics',               'platform', '🎵', NULL,               14),
  ('producthunt-api', 'Product Hunt API',  'Launches + comments',                        'platform', '🚀', NULL,               15),
  ('web-search',      'Web Search',        'SerpAPI / Google Custom Search',             'data',     '🔍', NULL,               20),
  ('web-scrape',      'Web Scraper',       'Playwright / Puppeteer headless',            'data',     '🕷', NULL,               21),
  ('directus-api',    'Directus API',      'as.on.tc backend CRUD',                      'data',     '🗄', NULL,               22),
  ('rss-fetch',       'RSS Fetch',         'Pull feeds / trending lists',                'data',     '📰', NULL,               23),
  ('similarweb',      'SimilarWeb',        'Traffic estimates per domain',               'data',     '📊', NULL,               24),
  ('gpt',             'OpenAI GPT',        'gpt-4o / gpt-4.1 / o3',                      'ai',       '🤖', 'OPENAI_API_KEY',   30),
  ('claude',          'Anthropic Claude',  'Haiku / Sonnet / Opus',                      'ai',       '✨', 'ANTHROPIC_API_KEY',31),
  ('gemini',          'Google Gemini',     'Flash / Pro',                                'ai',       '✦',  'GOOGLE_API_KEY',   32),
  ('image-gen',       'Image Generation',  'DALL-E / Flux / SDXL',                       'ai',       '🎨', NULL,               33),
  ('embeddings',      'Embeddings',        'text-embedding-3-small/large',               'ai',       '🔢', NULL,               34),
  ('postgres',        'Postgres DB',       'mos2_prod schema',                           'storage',  '🐘', NULL,               40),
  ('s3',              'Object Storage',    'Hetzner volumes / S3',                       'storage',  '📦', NULL,               41),
  ('cdn',             'CDN',               'Cloudflare / Bunny edge',                    'storage',  '🌐', NULL,               42),
  ('telegram',        'Telegram Bot',      'Send messages / alerts',                     'comms',    '✈️', NULL,               50),
  ('discord',         'Discord Bot',       'Gani/OpenClaw integration',                  'comms',    '💬', NULL,               51),
  ('email-smtp',      'Email SMTP',        'Resend / Hetzner mail / orit-inbox',         'comms',    '📧', NULL,               52),
  ('webhook',         'Webhook',           'Generic POST to URL',                        'comms',    '🔗', NULL,               53),
  ('plausible',       'Plausible',         'Privacy-friendly site analytics',            'analytics','📈', NULL,               60),
  ('posthog',         'PostHog',           'Product analytics + funnels',                'analytics','📉', NULL,               61),
  ('cron',            'Cron Scheduler',    'systemd timers / GHA cron',                  'analytics','⏱', NULL,               62)
ON CONFLICT (id) DO NOTHING;
