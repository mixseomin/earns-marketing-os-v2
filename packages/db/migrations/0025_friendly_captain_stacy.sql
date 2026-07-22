CREATE TABLE IF NOT EXISTS "account_grants" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"account_id" bigint NOT NULL,
	"grantee_kind" text NOT NULL,
	"grantee_id" text NOT NULL,
	"role" text DEFAULT 'use' NOT NULL,
	"notes" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "adsense_daily" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"project_id" text,
	"pub_id" text NOT NULL,
	"date" text NOT NULL,
	"site_domain" text DEFAULT '' NOT NULL,
	"earnings_usd" text DEFAULT '0' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"rpm_usd" text DEFAULT '0' NOT NULL,
	"cpc_usd" text DEFAULT '0' NOT NULL,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"agent_id" bigint NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"project_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approach_playbooks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"title" text NOT NULL,
	"angle" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_project_id" text,
	"platform_key" text,
	"uses" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "board_project_score" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"board_id" bigint NOT NULL,
	"project_id" text NOT NULL,
	"fit" integer NOT NULL,
	"topic_tier" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"approach" text DEFAULT '' NOT NULL,
	"approach_playbook_id" bigint,
	"manual_tier" text,
	"project_inputs_hash" text NOT NULL,
	"board_inputs_hash" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"stale" boolean DEFAULT false NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "browser_profiles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"label" text NOT NULL,
	"tool" text NOT NULL,
	"external_id" text,
	"user_agent" text,
	"fingerprint" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_proxy_id" bigint,
	"last_opened_at" timestamp with time zone,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_insights_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"card_id" bigint NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"views_count" integer,
	"score" integer,
	"upvote_ratio" numeric(4, 3),
	"reply_count" integer,
	"share_count" integer,
	"award_count" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_briefs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"account_id" integer NOT NULL,
	"habitat_id" integer NOT NULL,
	"approach_md" text DEFAULT '' NOT NULL,
	"cadence" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"do_md" text DEFAULT '' NOT NULL,
	"dont_md" text DEFAULT '' NOT NULL,
	"templates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_suggestion" jsonb,
	"ai_suggestion_at" timestamp with time zone,
	"current_phase" text DEFAULT 'warm-up' NOT NULL,
	"phase_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phase_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"narrative_md" text DEFAULT '' NOT NULL,
	"humanizer" jsonb,
	"primary_pillar_id" bigint,
	"join_status" text DEFAULT 'not_joined' NOT NULL,
	"joined_at" timestamp with time zone,
	"join_url" text,
	"join_note" text,
	"join_checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"follow_up_at" timestamp with time zone,
	"scraped_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_pillar_tribes" (
	"pillar_id" bigint NOT NULL,
	"tribe_id" integer NOT NULL,
	CONSTRAINT "content_pillar_tribes_pillar_id_tribe_id_pk" PRIMARY KEY("pillar_id","tribe_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_pillars" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"positioning_md" text DEFAULT '' NOT NULL,
	"key_messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"forbidden_msgs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages" jsonb DEFAULT '["en"]'::jsonb NOT NULL,
	"voice_profile" text DEFAULT 'regular' NOT NULL,
	"voice_notes" text DEFAULT '' NOT NULL,
	"preferred_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exemplars" jsonb,
	"seo_pillar_url" text,
	"seo_keywords" jsonb DEFAULT '[]'::jsonb,
	"external_tag" text,
	"priority" integer DEFAULT 50 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crew_capabilities" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"version" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dom_samples" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"platform_key" text,
	"technology_key" text,
	"page_kind" text DEFAULT 'page' NOT NULL,
	"url" text,
	"hostname" text,
	"title" text,
	"html" text NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"note" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_offers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"interest" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emails" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"email" text NOT NULL,
	"provider" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ext_call_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"method" text NOT NULL,
	"ext_version" text,
	"page_url" text,
	"payload_meta" jsonb,
	"response_meta" jsonb,
	"status" integer,
	"duration_ms" integer,
	"error_msg" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generators" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"endpoint" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"working" text DEFAULT '' NOT NULL,
	"needs_depth" boolean DEFAULT false NOT NULL,
	"needs_vision" boolean DEFAULT false NOT NULL,
	"default_model" text,
	"monthly_cost" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "habitat_channels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"habitat_id" integer NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"description" text DEFAULT '' NOT NULL,
	"rules" text DEFAULT '' NOT NULL,
	"allowed_formats" jsonb,
	"posting_gates" jsonb,
	"voice_profile_override" text,
	"few_shot_examples" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"external_id" text,
	"topic" text DEFAULT '' NOT NULL,
	"pinned_summary" jsonb,
	"recent_summary" jsonb,
	"synced_at" timestamp with time zone,
	"language" text DEFAULT '' NOT NULL,
	"board_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "habitat_tribes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"habitat_id" integer NOT NULL,
	"tribe_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identities" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"kind" text DEFAULT 'seeding' NOT NULL,
	"handle_base" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"password_enc" text,
	"display_name" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_url" text DEFAULT '' NOT NULL,
	"persona" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_variants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"password_variants_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_projects" (
	"project_id" text NOT NULL,
	"identity_id" bigint NOT NULL,
	"role" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_projects_project_id_identity_id_pk" PRIMARY KEY("project_id","identity_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"people_id" bigint NOT NULL,
	"card_id" bigint,
	"account_id" bigint,
	"thread_url" text,
	"kind" text DEFAULT 'reply' NOT NULL,
	"direction" text DEFAULT 'theirs' NOT NULL,
	"body_excerpt" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outreach_campaigns" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"type" text DEFAULT 'embed' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"goal" text,
	"from_email" text,
	"from_name" text,
	"daily_cap" integer DEFAULT 15 NOT NULL,
	"followup_gap_days" integer DEFAULT 3 NOT NULL,
	"max_followups" integer DEFAULT 2 NOT NULL,
	"auto_send" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outreach_prospects" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"agent_name" text NOT NULL,
	"company" text,
	"base" text,
	"email" text,
	"contact_url" text,
	"website" text DEFAULT '' NOT NULL,
	"website_etld1" text,
	"status" text DEFAULT 'to_send' NOT NULL,
	"source" text DEFAULT 'markdown_pack' NOT NULL,
	"sent_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"embedded_at" timestamp with time zone,
	"embed_host_matched" text,
	"embed_item_id" text,
	"embed_loads" integer DEFAULT 0 NOT NULL,
	"email_subject" text,
	"email_body" text,
	"next_followup_at" timestamp with time zone,
	"followup_count" integer DEFAULT 0 NOT NULL,
	"snooze_until" timestamp with time zone,
	"template_key" text,
	"campaign_id" bigint,
	"task_id" bigint,
	"notes" text,
	"owner" text DEFAULT 'me' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outreach_touches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"prospect_id" bigint NOT NULL,
	"project_id" text,
	"channel" text NOT NULL,
	"target_ref" text,
	"content" text,
	"status" text DEFAULT 'to_send' NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_as" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "people" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text,
	"platform_key" text DEFAULT '' NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"scene_tag" text,
	"habitat_id" bigint,
	"familiarity_score" integer DEFAULT 0 NOT NULL,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"they_replied_back" boolean DEFAULT false NOT NULL,
	"last_engaged_at" timestamp with time zone,
	"status" text DEFAULT 'observed' NOT NULL,
	"notes" text,
	"scraped_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_boards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"platform_key" text,
	"technology_key" text,
	"external_id" text,
	"url" text,
	"name" text NOT NULL,
	"full_path" text,
	"parent_board_id" bigint,
	"description" text DEFAULT '' NOT NULL,
	"members" integer DEFAULT 0 NOT NULL,
	"privacy" text DEFAULT '' NOT NULL,
	"dominant_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"forbidden_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" text DEFAULT '' NOT NULL,
	"raw_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_tech_detections" (
	"host" text PRIMARY KEY NOT NULL,
	"platform_key" text NOT NULL,
	"technology_key" text NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_technologies" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"signup_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_accounts" (
	"project_id" text NOT NULL,
	"account_id" bigint NOT NULL,
	"role" text DEFAULT 'shared' NOT NULL,
	"content_ratio" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proxies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'datacenter' NOT NULL,
	"endpoint" text NOT NULL,
	"location" text,
	"health" text DEFAULT 'unknown' NOT NULL,
	"last_check_at" timestamp with time zone,
	"cost_per_gb_cents" integer DEFAULT 0 NOT NULL,
	"rotates_at" timestamp with time zone,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seeding_schedules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"project_id" text NOT NULL,
	"brief_id" bigint NOT NULL,
	"content_type" text DEFAULT 'mix' NOT NULL,
	"language" text DEFAULT '' NOT NULL,
	"frequency_days" integer DEFAULT 3 NOT NULL,
	"active_phases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"auto_draft" boolean DEFAULT true NOT NULL,
	"last_seeded_at" timestamp with time zone,
	"touch_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "selector_overrides" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'self' NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_key" text NOT NULL,
	"page_kind" text NOT NULL,
	"field_name" text NOT NULL,
	"spec" jsonb NOT NULL,
	"source" text DEFAULT 'llm' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strategy_forward" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"strategy" text NOT NULL,
	"symbol" text NOT NULL,
	"days" integer,
	"trades" integer,
	"wins" integer,
	"win_pct" numeric,
	"net" numeric,
	"fwd_pf" numeric,
	"base_pf" numeric,
	"status" text,
	"open_pos" integer,
	"equity" double precision,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strategy_test_assets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"strategy_name" text NOT NULL,
	"asset" text NOT NULL,
	"trades" integer,
	"win_pct" numeric,
	"pf" numeric,
	"net" numeric,
	"max_dd" numeric
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strategy_tests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"variant" text DEFAULT '',
	"source_url" text DEFAULT '',
	"asset" text DEFAULT '',
	"timeframe" text DEFAULT '',
	"period" text DEFAULT '',
	"codability" text DEFAULT '',
	"trades" integer,
	"span_months" integer,
	"max_dd" numeric,
	"win_pct" numeric,
	"pf" numeric,
	"net" numeric,
	"net_unit" text DEFAULT '',
	"is_pf" numeric,
	"oos_pf" numeric,
	"realtick_pf" numeric,
	"verdict" text DEFAULT '',
	"klass" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'tested' NOT NULL,
	"harness_file" text DEFAULT '',
	"notes" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strategy_trades" (
	"position_id" bigint PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"strategy" text NOT NULL,
	"symbol" text NOT NULL,
	"dir" text,
	"entry_time" timestamp with time zone,
	"exit_time" timestamp with time zone,
	"entry_price" double precision,
	"exit_price" double precision,
	"profit" double precision,
	"lots" double precision,
	"notional" double precision,
	"sl" double precision,
	"tp" double precision,
	"raw" jsonb,
	"magic" integer,
	"is_open" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX IF EXISTS "accounts_proj_platform_handle_uniq";--> statement-breakpoint
ALTER TABLE "platform_accounts" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "base_skill_md" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "title_review" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "workflow_run_id" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "workflow_key" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "workflow_step" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "workflow_context" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "brief_id" bigint;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "brief_phase" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "account_id" bigint;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "habitat_id" bigint;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "body_review" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "body_target" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "target_lang" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "parent_url" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "thread_key" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "parent_title" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "parent_body" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "parent_author" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "parent_snippets" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "answer_source" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "answer_sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "gen_cost_usd" numeric(8, 5);--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "gen_duration_ms" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "gen_model_used" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "gen_confidence" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "gen_tools_called" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "gen_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "gen_log_id" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "content_type" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "media_asset_id" bigint;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "channel_id" bigint;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "pillar_id" bigint;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "content_kind" text DEFAULT 'seed' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "archived_reason" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "post_url" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "posted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "post_screenshot_url" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "post_note" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "post_lifecycle" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "post_lifecycle_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "post_lifecycle_note" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_views_count" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_score" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_upvote_ratio" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_reply_count" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_share_count" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_award_count" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_raw_json" jsonb;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_top_countries" jsonb;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "insights_top_replies" jsonb;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "platform_key" text;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "icon_url" text;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "language" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "community_type" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "status" text DEFAULT 'target' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "mod_strictness" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "posting_rules" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "posting_rules_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "join_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "min_account_age_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "min_karma" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "min_posts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "links_allowed_after" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "dominant_topics" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "forbidden_topics" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "best_post_times" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "technology_key" text;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "allowed_formats_override" jsonb;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "voice_profile" text DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "voice_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "few_shot_examples" jsonb;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "visual_style_descriptor" text;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "created_at_source" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "privacy" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "weekly_visitors" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "weekly_contributions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "scraped_meta" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "ai_content_detection" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "ai_detection_note" text;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "is_own" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "habitats" ADD COLUMN "board_id" bigint;--> statement-breakpoint
ALTER TABLE "human_tasks" ADD COLUMN "feedback_type" text;--> statement-breakpoint
ALTER TABLE "human_tasks" ADD COLUMN "feedback_text" text;--> statement-breakpoint
ALTER TABLE "human_tasks" ADD COLUMN "assigned_user_id" bigint;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "specialty" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "ext_status" text;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "password_enc" text;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "account_stats" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "environment" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "proxy_id" bigint;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "browser_profile_id" bigint;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "owner_user_id" bigint;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "persona" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "account_kind" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "account_type" text DEFAULT 'brand' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD COLUMN "bot_token_enc" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "profile_url_pattern" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "pricing" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "category" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "user_count_estimate" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "technology_key" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "signup_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "signup_verify" text;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "allowed_formats" jsonb;--> statement-breakpoint
ALTER TABLE "platforms" ADD COLUMN "format_mix" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "content_strategy" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stack" text DEFAULT '' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_grants" ADD CONSTRAINT "account_grants_account_id_platform_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "adsense_daily" ADD CONSTRAINT "adsense_daily_account_id_platform_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "adsense_daily" ADD CONSTRAINT "adsense_daily_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approach_playbooks" ADD CONSTRAINT "approach_playbooks_source_project_id_projects_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approach_playbooks" ADD CONSTRAINT "approach_playbooks_platform_key_platforms_key_fk" FOREIGN KEY ("platform_key") REFERENCES "public"."platforms"("key") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board_project_score" ADD CONSTRAINT "board_project_score_board_id_platform_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."platform_boards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board_project_score" ADD CONSTRAINT "board_project_score_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "card_insights_snapshots" ADD CONSTRAINT "card_insights_snapshots_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_briefs" ADD CONSTRAINT "community_briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_briefs" ADD CONSTRAINT "community_briefs_account_id_platform_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_briefs" ADD CONSTRAINT "community_briefs_habitat_id_habitats_id_fk" FOREIGN KEY ("habitat_id") REFERENCES "public"."habitats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_pillar_tribes" ADD CONSTRAINT "content_pillar_tribes_pillar_id_content_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."content_pillars"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_pillar_tribes" ADD CONSTRAINT "content_pillar_tribes_tribe_id_tribes_id_fk" FOREIGN KEY ("tribe_id") REFERENCES "public"."tribes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_pillars" ADD CONSTRAINT "content_pillars_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_offers" ADD CONSTRAINT "email_offers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "habitat_channels" ADD CONSTRAINT "habitat_channels_habitat_id_habitats_id_fk" FOREIGN KEY ("habitat_id") REFERENCES "public"."habitats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "habitat_channels" ADD CONSTRAINT "habitat_channels_board_id_platform_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."platform_boards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "habitat_tribes" ADD CONSTRAINT "habitat_tribes_habitat_id_habitats_id_fk" FOREIGN KEY ("habitat_id") REFERENCES "public"."habitats"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "habitat_tribes" ADD CONSTRAINT "habitat_tribes_tribe_id_tribes_id_fk" FOREIGN KEY ("tribe_id") REFERENCES "public"."tribes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identities" ADD CONSTRAINT "identities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_projects" ADD CONSTRAINT "identity_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_projects" ADD CONSTRAINT "identity_projects_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "interactions" ADD CONSTRAINT "interactions_people_id_people_id_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "interactions" ADD CONSTRAINT "interactions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outreach_prospects" ADD CONSTRAINT "outreach_prospects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "people" ADD CONSTRAINT "people_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "people" ADD CONSTRAINT "people_habitat_id_habitats_id_fk" FOREIGN KEY ("habitat_id") REFERENCES "public"."habitats"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_boards" ADD CONSTRAINT "platform_boards_platform_key_platforms_key_fk" FOREIGN KEY ("platform_key") REFERENCES "public"."platforms"("key") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_boards" ADD CONSTRAINT "platform_boards_technology_key_platform_technologies_key_fk" FOREIGN KEY ("technology_key") REFERENCES "public"."platform_technologies"("key") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_accounts" ADD CONSTRAINT "project_accounts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_accounts" ADD CONSTRAINT "project_accounts_account_id_platform_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seeding_schedules" ADD CONSTRAINT "seeding_schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seeding_schedules" ADD CONSTRAINT "seeding_schedules_brief_id_community_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."community_briefs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strategy_tests" ADD CONSTRAINT "strategy_tests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_grants_account_idx" ON "account_grants" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_grants_grantee_idx" ON "account_grants" USING btree ("grantee_kind","grantee_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "adsense_daily_uniq" ON "adsense_daily" USING btree ("account_id","date","site_domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adsense_daily_date_idx" ON "adsense_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adsense_daily_project_idx" ON "adsense_daily" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "adsense_daily_site_idx" ON "adsense_daily" USING btree ("site_domain","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_messages_agent_time" ON "agent_messages" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_feature_idx" ON "ai_usage" USING btree ("feature");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approach_playbooks_tenant_idx" ON "approach_playbooks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approach_playbooks_platform_idx" ON "approach_playbooks" USING btree ("platform_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "board_project_score_uq" ON "board_project_score" USING btree ("tenant_id","board_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_project_score_project_idx" ON "board_project_score" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_project_score_stale_idx" ON "board_project_score" USING btree ("stale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "browser_profiles_tenant_idx" ON "browser_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "browser_profiles_tool_idx" ON "browser_profiles" USING btree ("tool");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_insights_snap_card_idx" ON "card_insights_snapshots" USING btree ("card_id","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "community_briefs_account_habitat_uniq" ON "community_briefs" USING btree ("account_id","habitat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_briefs_project_idx" ON "community_briefs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_briefs_account_idx" ON "community_briefs" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_briefs_habitat_idx" ON "community_briefs" USING btree ("habitat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_briefs_tenant_idx" ON "community_briefs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_briefs_current_phase_idx" ON "community_briefs" USING btree ("current_phase");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_briefs_join_status_idx" ON "community_briefs" USING btree ("join_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_pillars_project_idx" ON "content_pillars" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_pillars_project_slug_uniq" ON "content_pillars" USING btree ("project_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crew_capabilities_version_idx" ON "crew_capabilities" USING btree ("version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dom_samples_tech_idx" ON "dom_samples" USING btree ("technology_key","page_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dom_samples_plat_idx" ON "dom_samples" USING btree ("platform_key","page_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_offers_project_idx" ON "email_offers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ext_call_log_endpoint_idx" ON "ext_call_log" USING btree ("endpoint","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ext_call_log_created_idx" ON "ext_call_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "habitat_channels_habitat_idx" ON "habitat_channels" USING btree ("habitat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "habitat_channels_board_idx" ON "habitat_channels" USING btree ("board_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "habitat_tribes_uniq" ON "habitat_tribes" USING btree ("habitat_id","tribe_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "habitat_tribes_tribe_idx" ON "habitat_tribes" USING btree ("tribe_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "habitat_tribes_habitat_idx" ON "habitat_tribes" USING btree ("habitat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "habitat_tribes_tenant_idx" ON "habitat_tribes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identities_project_idx" ON "identities" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_projects_identity_idx" ON "identity_projects" USING btree ("identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "interactions_dedup_uidx" ON "interactions" USING btree ("people_id","card_id","direction","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interactions_people_idx" ON "interactions" USING btree ("people_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interactions_thread_idx" ON "interactions" USING btree ("thread_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interactions_card_idx" ON "interactions" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_campaigns_project_idx" ON "outreach_campaigns" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "outreach_prospects_proj_email_uidx" ON "outreach_prospects" USING btree ("project_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_prospects_project_idx" ON "outreach_prospects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_prospects_status_idx" ON "outreach_prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_prospects_followup_idx" ON "outreach_prospects" USING btree ("project_id","next_followup_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_prospects_etld1_idx" ON "outreach_prospects" USING btree ("website_etld1");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_prospects_campaign_idx" ON "outreach_prospects" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_touches_prospect_idx" ON "outreach_touches" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outreach_touches_project_idx" ON "outreach_touches" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "outreach_touches_prospect_channel_uidx" ON "outreach_touches" USING btree ("prospect_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "people_proj_plat_handle_uidx" ON "people" USING btree ("project_id","platform_key","handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "people_project_idx" ON "people" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "people_habitat_idx" ON "people" USING btree ("habitat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "people_scene_idx" ON "people" USING btree ("scene_tag");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_boards_tenant_idx" ON "platform_boards" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_boards_platform_idx" ON "platform_boards" USING btree ("platform_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_boards_parent_idx" ON "platform_boards" USING btree ("parent_board_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_boards_ext_uq" ON "platform_boards" USING btree ("tenant_id","platform_key","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_tech_detections_tech_idx" ON "platform_tech_detections" USING btree ("technology_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_tech_detections_pkey_idx" ON "platform_tech_detections" USING btree ("platform_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_accounts_account_idx" ON "project_accounts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxies_tenant_idx" ON "proxies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxies_type_idx" ON "proxies" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seeding_schedules_brief_lane_uniq" ON "seeding_schedules" USING btree ("brief_id","content_type","language");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seeding_schedules_project_idx" ON "seeding_schedules" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seeding_schedules_tenant_idx" ON "seeding_schedules" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "selector_overrides_uniq" ON "selector_overrides" USING btree ("tenant_id","scope_kind","scope_key","page_kind","field_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "selector_overrides_scope_idx" ON "selector_overrides" USING btree ("scope_kind","scope_key","page_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategy_forward_strat_idx" ON "strategy_forward" USING btree ("strategy");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sta_strat_idx" ON "strategy_test_assets" USING btree ("strategy_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategy_tests_project_idx" ON "strategy_tests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "strategy_trades_strat_idx" ON "strategy_trades" USING btree ("strategy");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "habitats" ADD CONSTRAINT "habitats_platform_key_platforms_key_fk" FOREIGN KEY ("platform_key") REFERENCES "public"."platforms"("key") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "habitats" ADD CONSTRAINT "habitats_technology_key_platform_technologies_key_fk" FOREIGN KEY ("technology_key") REFERENCES "public"."platform_technologies"("key") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "habitats" ADD CONSTRAINT "habitats_board_id_platform_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."platform_boards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platforms" ADD CONSTRAINT "platforms_technology_key_platform_technologies_key_fk" FOREIGN KEY ("technology_key") REFERENCES "public"."platform_technologies"("key") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "habitats_board_idx" ON "habitats" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "human_tasks_assigned_idx" ON "human_tasks" USING btree ("assigned_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_tenant_platform_handle_uniq" ON "platform_accounts" USING btree ("tenant_id","platform_key","handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platforms_category_idx" ON "platforms" USING btree ("category");