// Niche library — preset configs cho affiliate newsletter spawn.
// Mỗi entry = 1 niche có thể spawn thành 1 MOS2 project + 1 plan với
// goals/steps customized (channel_target, merchants, audience).
//
// VN solo operator focus: bỏ personal finance (US-only), health (ESP risk),
// general coupon (red ocean top 5 chiếm 55% market).

export interface NichePreset {
  slug: string;                       // 'vpn-deals' → project_id + plan_slug = '<slug>-newsletter'
  name: string;                       // hiển thị trong list
  emoji: string;
  color: string;                      // hex
  oneLiner: string;                   // value prop
  category: string;                   // grouping: 'creator', 'tech', 'b2b-saas', 'dev', 'consumer-tech'
  estRpmUsd: [number, number];        // [low, high] $/1K subs/tháng
  saturation: 'low' | 'medium' | 'high';
  vnFit: 1 | 2 | 3 | 4 | 5;          // 5 = perfect fit (PayPal/Wise payout, no US-gate)
  topMerchants: string[];             // top 3-5 affiliate programs (commission %)
  primaryNetwork: string;             // 'partnerstack' | 'awin' | 'impact' | 'cj' | 'direct'
  targetSubreddits: Array<{ name: string; size: string; affPolicy: 'ok' | 'restricted' | 'banned' }>;
  targetCommunities: string[];        // Twitter/HN/dev.to/IH/etc
  domainCandidates: string[];         // 3-5 domain ideas
  audience: string;                   // 1-line persona
  notes?: string;                     // gotchas / risks
}

export const NICHES: NichePreset[] = [
  {
    slug: 'creator-econ-news',
    name: 'Creator Economy Newsletter',
    emoji: '🎯',
    color: '#a78bfa',
    oneLiner: 'Weekly curated deals on Beehiiv, ConvertKit, Webflow, Kajabi + 15 creator tools.',
    category: 'creator',
    estRpmUsd: [300, 800],
    saturation: 'low',
    vnFit: 5,
    topMerchants: ['Beehiiv (60% recurring 12mo)', 'ConvertKit/Kit (30% LIFETIME)', 'Webflow (50% 12mo)', 'Kajabi (20% recurring)', 'No Code MBA (50%)'],
    primaryNetwork: 'direct + partnerstack',
    targetSubreddits: [
      { name: 'r/Newsletters', size: '30K', affPolicy: 'ok' },
      { name: 'r/Substack', size: '50K', affPolicy: 'ok' },
      { name: 'r/EmailMarketing', size: '40K', affPolicy: 'ok' },
      { name: 'r/SideProject', size: '300K', affPolicy: 'ok' },
    ],
    targetCommunities: ['Twitter creator community', 'IndieHackers', 'ProductHunt', 'dev.to'],
    domainCandidates: ['creatordeals.email', 'stacksavings.io', 'newsletterdeals.dev', 'creatorstack.deals'],
    audience: 'Newsletter operators, indie creators, course makers, no-coders 25-45',
    notes: 'Dogfood credibility (dùng Beehiiv để promote Beehiiv). Lifetime recurring là Holy Grail.',
  },
  {
    slug: 'ai-tools-deals',
    name: 'AI Tools Deals',
    emoji: '🤖',
    color: '#06b6d4',
    oneLiner: 'Weekly AI tools discounts: writing, image, video, voice, agents.',
    category: 'tech',
    estRpmUsd: [80, 300],
    saturation: 'high',
    vnFit: 4,
    topMerchants: ['Jasper (25-30% recurring 12mo)', 'Copy.ai (45% recurring)', 'Notion AI (50% first 12mo)', 'ElevenLabs (Impact)', 'Anthropic (Impact)'],
    primaryNetwork: 'partnerstack + impact',
    targetSubreddits: [
      { name: 'r/ArtificialIntelligence', size: '1.2M', affPolicy: 'restricted' },
      { name: 'r/ChatGPT', size: '8M', affPolicy: 'restricted' },
      { name: 'r/AItools', size: '40K', affPolicy: 'ok' },
      { name: 'r/SideProject', size: '300K', affPolicy: 'ok' },
    ],
    targetCommunities: ['"AI Twitter"', 'Hacker News', 'ProductHunt'],
    domainCandidates: ['aitooldeals.com', 'agentstack.deals', 'aiweekly.deals', 'promptdeals.io'],
    audience: 'Devs, founders, content creators tò mò AI 22-45',
    notes: 'Saturation cực cao (Ben\'s Bites 120K, Superhuman AI 1M+). Cần differentiate: deals-only, không phải news.',
  },
  {
    slug: 'b2b-saas-deals',
    name: 'B2B SaaS Deals',
    emoji: '💼',
    color: '#3b82f6',
    oneLiner: 'Productivity, automation, marketing SaaS discounts cho founders & teams.',
    category: 'b2b-saas',
    estRpmUsd: [150, 500],
    saturation: 'high',
    vnFit: 4,
    topMerchants: ['Monday.com ($25-100 + recurring)', 'HubSpot (30% recurring up to 1yr)', 'ClickUp (20% recurring)', 'Airtable (Impact)', 'Zapier'],
    primaryNetwork: 'partnerstack + impact',
    targetSubreddits: [
      { name: 'r/SaaS', size: '677K', affPolicy: 'restricted' },
      { name: 'r/Entrepreneur', size: '4M', affPolicy: 'restricted' },
      { name: 'r/smallbusiness', size: '2M', affPolicy: 'restricted' },
    ],
    targetCommunities: ['LinkedIn newsletter', 'IndieHackers', 'TLDR Tech ecosystem'],
    domainCandidates: ['saasweeklydeals.com', 'b2bdeals.io', 'foundertool.deals', 'saasstack.deals'],
    audience: 'Founders, ops/marketing leads at startups & SMBs',
    notes: 'AppSumo Originals (1.5M subs) + SaaS Mantra dominant lifetime deal space. Differentiate qua editorial opinion.',
  },
  {
    slug: 'vpn-privacy',
    name: 'VPN & Privacy Tools',
    emoji: '🔒',
    color: '#10b981',
    oneLiner: 'VPN region price arbitrage, multi-year TCO, streaming compatibility weekly.',
    category: 'consumer-tech',
    estRpmUsd: [200, 800],
    saturation: 'medium',
    vnFit: 5,
    topMerchants: ['NordVPN ($30-100/sale direct)', 'Surfshark ($25-50 Impact)', 'ExpressVPN (up to $100 Impact)', 'Proton ($20-50 Impact)', 'CyberGhost (Awin)'],
    primaryNetwork: 'direct + impact',
    targetSubreddits: [
      { name: 'r/VPN', size: '450K', affPolicy: 'restricted' },
      { name: 'r/PrivacyTools', size: '90K', affPolicy: 'ok' },
      { name: 'r/cordcutters', size: '200K', affPolicy: 'ok' },
      { name: 'r/Piracy', size: '1M', affPolicy: 'banned' },
    ],
    targetCommunities: ['PrivacyGuides.org', 'restoreprivacy.com community', 'r/privacy'],
    domainCandidates: ['vpndeals.io', 'privacystack.deals', 'vpncalc.tools', 'securetoolsweek.ly'],
    audience: 'Privacy-aware users, expats, gamers, streamers 18-50 toàn cầu',
    notes: 'High RPM nhất ($30-100/sale). Pair tốt với VPN calculator microsite (ide #2).',
  },
  {
    slug: 'hosting-deals',
    name: 'Web Hosting & Cloud Deals',
    emoji: '🌐',
    color: '#f59e0b',
    oneLiner: 'Shared/VPS/cloud hosting deals + renewal price warnings cho devs/agencies.',
    category: 'dev',
    estRpmUsd: [100, 400],
    saturation: 'high',
    vnFit: 5,
    topMerchants: ['Hostinger (36%/sale, $60-150 AOV)', 'Bluehost ($65+ flat)', 'Cloudways (12% recurring 12mo OR $30-125 flat)', 'SiteGround (CJ)', 'Hetzner (no aff but credit)'],
    primaryNetwork: 'awin + cj + direct',
    targetSubreddits: [
      { name: 'r/webdev', size: '2M', affPolicy: 'restricted' },
      { name: 'r/wordpress', size: '230K', affPolicy: 'ok' },
      { name: 'r/SideProject', size: '300K', affPolicy: 'ok' },
    ],
    targetCommunities: ['dev.to', 'WordPress Slack/forum', 'Twitter dev community'],
    domainCandidates: ['hostingdeals.email', 'hostingstack.deals', 'serverdeals.dev'],
    audience: 'Devs đang setup project, agency owners, bloggers',
    notes: 'Saturated - chỉ thắng nếu vertical hơn (WordPress hosting deals, JAMstack hosting deals).',
  },
  {
    slug: 'nocode-deals',
    name: 'No-Code Tools Deals',
    emoji: '⚡',
    color: '#ec4899',
    oneLiner: 'No-code app builders, form builders, automation tools weekly deals.',
    category: 'creator',
    estRpmUsd: [150, 500],
    saturation: 'medium',
    vnFit: 5,
    topMerchants: ['Webflow (50% 12mo)', 'Bubble (Rewardful)', 'Tally (referral)', 'Cal.com', 'Carrd', 'Framer'],
    primaryNetwork: 'direct + partnerstack',
    targetSubreddits: [
      { name: 'r/nocode', size: '90K', affPolicy: 'ok' },
      { name: 'r/NoCodeJobs', size: '20K', affPolicy: 'ok' },
      { name: 'r/SideProject', size: '300K', affPolicy: 'ok' },
      { name: 'r/Entrepreneur', size: '4M', affPolicy: 'restricted' },
    ],
    targetCommunities: ['Makerpad/Zapier community', 'IndieHackers', 'No Code MBA'],
    domainCandidates: ['nocodedeals.io', 'builderstack.deals', 'nocodeweekly.deals'],
    audience: 'Solopreneurs, ops folks, founders không code',
    notes: 'Overlap với Creator Economy. Nếu launch cả 2 thì Creator dùng Beehiiv-led, NoCode dùng Webflow-led.',
  },
  {
    slug: 'indie-stack',
    name: 'Indie Hacker Stack',
    emoji: '🚀',
    color: '#8b5cf6',
    oneLiner: 'Indie/founder tools: analytics, auth, payments, infra cho side projects.',
    category: 'dev',
    estRpmUsd: [120, 400],
    saturation: 'medium',
    vnFit: 5,
    topMerchants: ['Lemon Squeezy', 'Plausible (referral)', 'PostHog (open-source)', 'Bunny.net', 'Linear', 'Resend'],
    primaryNetwork: 'direct + partnerstack',
    targetSubreddits: [
      { name: 'r/IndieDev', size: '300K', affPolicy: 'ok' },
      { name: 'r/SideProject', size: '300K', affPolicy: 'ok' },
      { name: 'r/Entrepreneur', size: '4M', affPolicy: 'restricted' },
      { name: 'r/SaaS', size: '677K', affPolicy: 'restricted' },
    ],
    targetCommunities: ['IndieHackers', 'Hacker News', 'Twitter dev/founder', 'Pieter Levels-style audience'],
    domainCandidates: ['indiestack.deals', 'shipstack.email', 'soloweekly.deals', 'indietoolweek.ly'],
    audience: 'Solo devs/founders building side projects, $0-5K MRR range',
    notes: 'Highly engaged audience nhưng size nhỏ. Cap ~10K subs realistic.',
  },
  {
    slug: 'email-marketing-deals',
    name: 'Email Marketing Tools',
    emoji: '✉️',
    color: '#0ea5e9',
    oneLiner: 'Email/newsletter platform deals: Beehiiv, Kit, ActiveCampaign, etc.',
    category: 'creator',
    estRpmUsd: [200, 600],
    saturation: 'low',
    vnFit: 5,
    topMerchants: ['Beehiiv (60% recurring 12mo)', 'ConvertKit/Kit (30% LIFETIME)', 'ActiveCampaign (Impact)', 'Lemlist', 'Loops'],
    primaryNetwork: 'direct + partnerstack',
    targetSubreddits: [
      { name: 'r/EmailMarketing', size: '40K', affPolicy: 'ok' },
      { name: 'r/Newsletters', size: '30K', affPolicy: 'ok' },
      { name: 'r/marketing', size: '1.2M', affPolicy: 'restricted' },
    ],
    targetCommunities: ['Inbox Collective', 'Newsletter operator Twitter', 'IndieHackers'],
    domainCandidates: ['emailtoolweek.ly', 'newsletterstack.deals', 'sendstack.email'],
    audience: 'Newsletter operators, content marketers, agency email leads',
    notes: 'Subset của Creator Economy. Skip nếu đã chọn Creator Economy.',
  },
  {
    slug: 'design-tools-deals',
    name: 'Design Tools Deals',
    emoji: '🎨',
    color: '#f43f5e',
    oneLiner: 'Figma plugins, Canva pro, Framer, design assets weekly.',
    category: 'creator',
    estRpmUsd: [80, 250],
    saturation: 'medium',
    vnFit: 5,
    topMerchants: ['Framer (Rewardful)', 'Canva (Impact)', 'Figma plugins (varied)', 'Envato Elements (Awin)', 'Mockup tools'],
    primaryNetwork: 'awin + impact + direct',
    targetSubreddits: [
      { name: 'r/web_design', size: '200K', affPolicy: 'ok' },
      { name: 'r/graphic_design', size: '900K', affPolicy: 'restricted' },
      { name: 'r/UI_Design', size: '50K', affPolicy: 'ok' },
    ],
    targetCommunities: ['Designer Twitter', 'Dribbble', 'Behance'],
    domainCandidates: ['designdeals.io', 'pixelstack.deals', 'designerweek.ly'],
    audience: 'Freelance designers, agency designers, indie design buyers',
    notes: 'Lower RPM than SaaS niches. Audience visual nên cần landing đẹp hơn baseline.',
  },
  {
    slug: 'productivity-apps',
    name: 'Productivity Apps',
    emoji: '✅',
    color: '#84cc16',
    oneLiner: 'Notion templates, Obsidian plugins, todo apps, time tracking deals.',
    category: 'consumer-tech',
    estRpmUsd: [50, 200],
    saturation: 'high',
    vnFit: 5,
    topMerchants: ['Notion (50% first 12mo)', 'Todoist (Impact)', 'Things 3', 'Toggl (Impact)', 'Notion templates marketplace'],
    primaryNetwork: 'direct + impact',
    targetSubreddits: [
      { name: 'r/productivity', size: '1.4M', affPolicy: 'restricted' },
      { name: 'r/Notion', size: '300K', affPolicy: 'restricted' },
      { name: 'r/ObsidianMD', size: '120K', affPolicy: 'ok' },
      { name: 'r/getstudying', size: '350K', affPolicy: 'ok' },
    ],
    targetCommunities: ['Productivity Twitter', 'YouTube productivity creators'],
    domainCandidates: ['productivitydeals.io', 'noteweekly.deals', 'pkmstack.deals'],
    audience: 'Knowledge workers, students, lifelong learners 22-45',
    notes: 'Lowest RPM trong list. Skip trừ khi user passion về productivity tooling.',
  },
];

export function getNicheBySlug(slug: string): NichePreset | undefined {
  return NICHES.find((n) => n.slug === slug);
}

export function listNiches(): NichePreset[] {
  return NICHES;
}
