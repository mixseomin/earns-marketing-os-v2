// Tools / functions library. Squad config refs by `tools: string[]` of IDs.
// Adding a new tool: append to TOOLS_LIBRARY. UI groups by category.

export type ToolCategory = 'platform' | 'data' | 'ai' | 'storage' | 'comms' | 'analytics';

export interface ToolDef {
  id: string;
  name: string;
  desc: string;
  category: ToolCategory;
  icon: string;
  // Optional: env var or service the tool depends on. UI can mark unavailable.
  requires?: string;
}

export const TOOL_CATEGORIES: { id: ToolCategory; label: string; color: string }[] = [
  { id: 'platform',  label: 'Platform',  color: 'var(--neon-cyan)' },
  { id: 'data',      label: 'Data',      color: 'var(--neon-lime)' },
  { id: 'ai',        label: 'AI',        color: 'var(--neon-violet)' },
  { id: 'storage',   label: 'Storage',   color: 'var(--neon-amber)' },
  { id: 'comms',     label: 'Comms',     color: '#ff3ca8' },
  { id: 'analytics', label: 'Analytics', color: '#3c9bff' },
];

export const TOOLS_LIBRARY: ToolDef[] = [
  // ── Platform ──
  { id: 'reddit-script',   name: 'Reddit Script',     desc: 'OAuth posting + comment monitoring',           category: 'platform', icon: '🔴', requires: 'REDDIT_CLIENT_ID' },
  { id: 'twitter-api',     name: 'Twitter / X API',   desc: 'Tweet, search, mentions',                      category: 'platform', icon: '🐦' },
  { id: 'gumroad-api',     name: 'Gumroad API',       desc: 'Sales / products / customers',                 category: 'platform', icon: '💰' },
  { id: 'youtube-data',    name: 'YouTube Data API',  desc: 'Channel + video metadata',                     category: 'platform', icon: '📺' },
  { id: 'tiktok-display',  name: 'TikTok Display',    desc: 'Public profile/video metrics',                 category: 'platform', icon: '🎵' },
  { id: 'producthunt-api', name: 'Product Hunt API',  desc: 'Launches + comments',                          category: 'platform', icon: '🚀' },

  // ── Data ──
  { id: 'web-search',     name: 'Web Search',        desc: 'SerpAPI / Google Custom Search',                category: 'data', icon: '🔍' },
  { id: 'web-scrape',     name: 'Web Scraper',       desc: 'Playwright / Puppeteer headless',               category: 'data', icon: '🕷' },
  { id: 'directus-api',   name: 'Directus API',      desc: 'as.on.tc backend CRUD',                         category: 'data', icon: '🗄' },
  { id: 'rss-fetch',      name: 'RSS Fetch',         desc: 'Pull feeds / trending lists',                   category: 'data', icon: '📰' },
  { id: 'similarweb',     name: 'SimilarWeb',        desc: 'Traffic estimates per domain',                  category: 'data', icon: '📊' },

  // ── AI ──
  { id: 'gpt',         name: 'OpenAI GPT',         desc: 'gpt-4o / gpt-4.1 / o3',          category: 'ai', icon: '🤖', requires: 'OPENAI_API_KEY' },
  { id: 'claude',      name: 'Anthropic Claude',   desc: 'Haiku / Sonnet / Opus',          category: 'ai', icon: '✨', requires: 'ANTHROPIC_API_KEY' },
  { id: 'gemini',      name: 'Google Gemini',      desc: 'Flash / Pro',                    category: 'ai', icon: '✦',  requires: 'GOOGLE_API_KEY' },
  { id: 'image-gen',   name: 'Image Generation',   desc: 'DALL-E / Flux / SDXL',           category: 'ai', icon: '🎨' },
  { id: 'embeddings',  name: 'Embeddings',         desc: 'text-embedding-3-small/large',   category: 'ai', icon: '🔢' },

  // ── Storage ──
  { id: 'postgres',  name: 'Postgres DB',     desc: 'mos2_prod schema',          category: 'storage', icon: '🐘' },
  { id: 's3',        name: 'Object Storage',  desc: 'Hetzner volumes / S3',      category: 'storage', icon: '📦' },
  { id: 'cdn',       name: 'CDN',             desc: 'Cloudflare / Bunny edge',   category: 'storage', icon: '🌐' },

  // ── Comms ──
  { id: 'telegram',     name: 'Telegram Bot',  desc: 'Send messages / alerts',                category: 'comms', icon: '✈️' },
  { id: 'discord',      name: 'Discord Bot',   desc: 'Gani/OpenClaw integration',             category: 'comms', icon: '💬' },
  { id: 'email-smtp',   name: 'Email SMTP',    desc: 'Resend / Hetzner mail / orit-inbox',    category: 'comms', icon: '📧' },
  { id: 'webhook',      name: 'Webhook',       desc: 'Generic POST to URL',                   category: 'comms', icon: '🔗' },

  // ── Analytics ──
  { id: 'plausible',  name: 'Plausible',       desc: 'Privacy-friendly site analytics',     category: 'analytics', icon: '📈' },
  { id: 'posthog',    name: 'PostHog',         desc: 'Product analytics + funnels',         category: 'analytics', icon: '📉' },
  { id: 'cron',       name: 'Cron Scheduler',  desc: 'systemd timers / GHA cron',           category: 'analytics', icon: '⏱' },
];

export function getToolById(id: string): ToolDef | undefined {
  return TOOLS_LIBRARY.find((t) => t.id === id);
}
