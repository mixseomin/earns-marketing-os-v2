// 16 platforms catalog ported from earns-dashboard's OritChannels.tsx (2026-04-29).
// Source of truth for: signup URL, post URL, priority/fallbacks, simpleicons slug,
// image specs, per-platform checklist items (phase + action url + tip).
//
// Update this file when:
// - new platform added (e.g. ProductHunt clone)
// - signup URL changes (rare but happens — Twitter → X migration etc.)
// - new warmup checklist item discovered (gotcha learned the hard way)

export type Priority = 'critical' | 'high' | 'medium';
export type Phase = 'creating' | 'warming' | 'active';
export type ImageKind = 'avatar' | 'banner' | 'logo' | 'square';

export interface ImageSpec {
  kind: ImageKind;
  label: string;
  w: number;
  h: number;
  note?: string;
}

export interface ChecklistItemDef {
  key: string;            // 'profile_complete', 'karma', 'posts'...
  phase: Phase;
  actionUrl?: string;     // direct deep-link to platform setting page
  tip?: string;           // short helper sentence
  imageRelevant?: boolean; // show download buttons (avatar/banner)
  snippets?: SnippetDef[]; // ready-to-paste content templates
}

export interface SnippetDef {
  label: string;
  text: string;           // with {{handle}} {{platform}} {{website}} {{persona}} {{bio}} {{hashtags}} placeholders
  maxLen?: number;        // platform char limit; UI warns when over
  alt?: string[];         // shorter fallback variants for over-limit cases
}

export interface PlatformDef {
  key: string;            // slug — primary key
  label: string;          // display name
  signupUrl: string;
  postUrl?: string;       // compose new post URL (or null for platforms w/o pure post UI)
  priority: Priority;
  fallbackKeys: string[];
  iconSlug: string;       // simpleicons.org slug
  imageSpecs: ImageSpec[];
  checklist: ChecklistItemDef[];
  autoCheck: boolean;     // dashboard-side auto poll (Reddit/HN/Bluesky)
}

const IMAGE_RELEVANT = new Set([
  'profile_complete', 'profile_bio', 'profile', 'profile_100', 'photo_banner',
  'page_setup', 'channel_setup', 'publication',
]);

// Ported verbatim from earns-dashboard OritChannels.tsx CONTENT_SNIPPETS.
// Variable placeholders: {{handle}} {{platform}} {{website}} {{persona}}
// {{bio}} {{hashtags}} {{one-liner}} — UI substitutes from account+project
// at render time; unknown vars stay literal so user knows to fill.
const SNIPPETS: Record<string, Record<string, SnippetDef[]>> = {
  producthunt: {
    profile_complete: [
      { label: 'Headline', text: 'Find anyone\'s contact in seconds — solo founder building {{handle}}', maxLen: 60, alt: [
        'Find any contact in seconds. Solo, building {{handle}}',
        'Solo founder building {{handle}} — reach intelligence',
        'Building {{handle}} — find any contact in seconds',
      ] },
      { label: 'Bio',     text: '{{bio}}\n\nBuilding @{{handle}} → {{website}}\n\n{{hashtags}}', maxLen: 500 },
      { label: 'Twitter', text: '@{{handle}}' },
      { label: 'Website', text: '{{website}}' },
    ],
    comments_made: [
      { label: 'Comment 1 (curious)',  text: 'Cool angle on {{X}} — how do you handle {{edge case}}? Have been wrestling with the same in our flow.' },
      { label: 'Comment 2 (specific)', text: 'The {{feature}} screenshot is what sold me. Bookmarking to dig in this weekend.' },
      { label: 'Comment 3 (ask)',     text: 'Genuine question: did you find {{integration}} hard to keep maintained, or is the API stable enough?' },
    ],
    maker_badge: [
      { label: 'Hunter ask DM', text: 'Hi {{hunter}} — I\'m launching {{handle}} ({{website}}) on PH soon. Big fan of your hunts in the {{niche}} space. Would you be open to hunting it? Happy to share an early demo first.' },
    ],
  },
  reddit: {
    profile_bio: [
      { label: 'Bio', text: 'Solo dev building tools that scratch my own itch. Currently: {{persona}}. Reach me: {{website}}', maxLen: 200 },
    ],
    organic_posts: [
      { label: 'Post — lessons',   text: 'Title: What I learned shipping {{small thing}} in {{N}} weeks\n\nBody: …(3 concrete lessons, no link)…' },
      { label: 'Post — question',  text: 'Title: How are you all handling {{problem}} in {{stack}}?\n\nBody: …(genuine question, share what you tried)…' },
    ],
    organic_comments: [
      { label: 'Helpful template', text: 'For {{their problem}}, what worked for me was {{specific tactic}}. Took ~{{time}} to set up but saved {{benefit}}. DM if you want the exact config.' },
    ],
  },
  twitter: {
    profile_complete: [
      { label: 'Bio', text: '{{persona}} • building @{{handle}} → {{website}} • {{hashtags}}', maxLen: 160, alt: [
        'Building @{{handle}} → {{website}}',
        'Solo founder. Building @{{handle}} — {{one-liner}}. {{website}}',
      ] },
      { label: 'Location', text: 'Solo / Remote', maxLen: 30 },
      { label: 'Website',  text: '{{website}}', maxLen: 100 },
    ],
    posts: [
      { label: 'Tweet — observation', text: 'Realized today: {{insight}}.\n\nProbably obvious to most, but it just clicked for me.', maxLen: 280 },
      { label: 'Tweet — small win',   text: 'Shipped {{small feature}} this morning. {{N}} lines of code. Took longer to name it than to build it.', maxLen: 280 },
      { label: 'Tweet — question',    text: 'Genuine question for {{audience}}: when you {{action}}, do you {{X}} or {{Y}}? Trying to figure out the better default.', maxLen: 280 },
      { label: 'Tweet — link share',  text: 'This thread on {{topic}} is gold → {{url}}\n\nThe part about {{specific point}} alone is worth saving.', maxLen: 280 },
      { label: 'Tweet — soft promo',  text: 'Working on @{{handle}} — {{one-liner}}. Open to early users if anyone wants to try: {{website}}', maxLen: 280 },
    ],
  },
  hackernews: {
    about_filled: [
      { label: 'About', text: '{{persona}}. Building {{handle}} ({{website}}). Email: hello@{{handle}}.app.' },
    ],
  },
  linkedin: {
    profile_100: [
      { label: 'Headline', text: 'Solo founder, {{handle}} • {{one-liner}}', maxLen: 220 },
      { label: 'About',    text: '{{bio}}\n\nMost recent: building {{handle}} → {{website}}\n\n{{hashtags}}', maxLen: 2600 },
    ],
    posts: [
      { label: 'Post — story',     text: '{{insight from a real situation, 3-4 short paragraphs, no hashtag soup}}' },
      { label: 'Post — milestone', text: 'Small milestone: {{handle}} crossed {{N}} this week. What worked: {{tactic}}. What didn\'t: {{tactic}}.' },
    ],
  },
  indiehackers: {
    profile: [
      { label: 'Headline', text: 'Building {{handle}} — {{one-liner}}', maxLen: 80 },
      { label: 'Bio',      text: '{{bio}}\n\nFollow at {{website}}', maxLen: 500 },
    ],
    milestone_post: [
      { label: 'Just shipped post', text: 'Just shipped: {{feature}}\n\nWhy: {{problem it solves}}\n\nHow it went: {{honest detail}}\n\nNext: {{next step}}' },
    ],
  },
  bluesky: {
    profile: [
      { label: 'Bio', text: '{{persona}} • building {{handle}} → {{website}}', maxLen: 256 },
    ],
  },
  threads: {
    profile: [
      { label: 'Bio', text: '{{persona}} • {{handle}} • {{website}}', maxLen: 150 },
    ],
  },
  medium: {
    non_promo_post: [
      { label: 'Outline', text: '# {{Title — concrete claim}}\n\n## Why it matters\n\n## What I tried\n\n## What worked\n\n## What I\'d do differently\n\n## Take this with you' },
    ],
  },
  devto: {
    non_promo_post: [
      { label: 'Outline', text: '# {{Title — howto / TIL}}\n\nTL;DR: {{one line}}\n\n## The problem\n\n## The fix\n\n```{{lang}}\n{{code snippet}}\n```\n\n## Why it works\n\n## Edge cases / gotchas' },
    ],
  },
  hashnode: {
    non_promo_post: [
      { label: 'Outline', text: '# {{Title}}\n\n## Context\n\n## Implementation\n\n## Lessons\n\n## Source: {{repo or gist link}}' },
    ],
  },
  beehiiv: {
    welcome_email: [
      { label: 'Welcome email', text: 'Subject: You\'re in 👋\n\nHey,\n\nThanks for subscribing to {{handle}}. Here\'s what to expect:\n\n• {{frequency}}\n• {{topics}}\n• Reply anytime — I read every email.\n\n— {{persona}}' },
    ],
  },
  substack: {
    welcome_post: [
      { label: 'Start here post', text: '# Start here\n\nIf you\'re new: {{handle}} is about {{topic}}.\n\nThe 3 posts to read first:\n1. {{post}}\n2. {{post}}\n3. {{post}}\n\nReply with what you\'re working on — I read every email.' },
    ],
  },
  youtube: {
    channel_setup: [
      { label: 'Description', text: '{{handle}} — {{one-liner}}\n\nNew videos: {{cadence}}\nReach me: {{website}}\n\n{{hashtags}}' },
    ],
  },
  discord: {
    profile: [
      { label: 'About me', text: '{{persona}} • building {{handle}} • {{website}}' },
    ],
  },
};

const item = (key: string, phase: Phase, actionUrl?: string, tip?: string): ChecklistItemDef => ({
  key, phase, actionUrl, tip,
  imageRelevant: IMAGE_RELEVANT.has(key) || undefined,
});

// Post-process: attach platform-specific SNIPPETS to matching checklist items.
// Done after PLATFORMS array is built so we don't need to modify ~50 item() calls.
function attachSnippets(platforms: PlatformDef[]): PlatformDef[] {
  return platforms.map((p) => {
    const platformSnippets = SNIPPETS[p.key];
    if (!platformSnippets) return p;
    return {
      ...p,
      checklist: p.checklist.map((c) => ({
        ...c,
        snippets: platformSnippets[c.key] ?? c.snippets,
      })),
    };
  });
}

const PLATFORMS_RAW: PlatformDef[] = [
  {
    key: 'producthunt', label: 'Product Hunt',
    signupUrl: 'https://www.producthunt.com/signup',
    postUrl: 'https://www.producthunt.com/posts/new',
    priority: 'critical', fallbackKeys: ['hackernews', 'indiehackers', 'reddit'],
    iconSlug: 'producthunt',
    imageSpecs: [{ kind: 'avatar', label: 'Avatar', w: 400, h: 400 }],
    autoCheck: false,
    checklist: [
      item('profile_complete', 'creating', 'https://www.producthunt.com/my/settings', 'Headline, photo, Twitter, website.'),
      item('hunters_followed', 'warming', 'https://www.producthunt.com/hunters', 'Follow 10 active hunters in your category.'),
      item('upvotes_given',    'warming', 'https://www.producthunt.com/', 'Upvote 10 products; reduces "new account" flag on launch day.'),
      item('comments_made',    'warming', undefined, 'Leave 3 thoughtful comments on recent launches.'),
      item('maker_badge',      'warming', undefined, 'Ship a small product first (or ask a maker-friend to hunt).'),
    ],
  },
  {
    key: 'hackernews', label: 'Hacker News',
    signupUrl: 'https://news.ycombinator.com/',
    postUrl: 'https://news.ycombinator.com/submit',
    priority: 'critical', fallbackKeys: ['devto', 'reddit', 'hashnode'],
    iconSlug: 'ycombinator',
    imageSpecs: [],
    autoCheck: true,
    checklist: [
      item('email_verified',   'creating', 'https://news.ycombinator.com/', 'Login (top-right) → click username → add email. /login direct link soft-blocked.'),
      item('about_filled',     'creating', 'https://news.ycombinator.com/', 'Login → click username in header → edit → fill "about" field.'),
      item('account_age_days', 'warming', undefined, 'Wait. Show HN post within 7 days of signup often flagged.'),
      item('karma',            'warming', 'https://news.ycombinator.com/ask', 'Comment thoughtfully on Ask HN. 5 karma ≈ 1-2 good comments.'),
    ],
  },
  {
    key: 'reddit', label: 'Reddit',
    signupUrl: 'https://www.reddit.com/register',
    postUrl: 'https://www.reddit.com/submit',
    priority: 'critical', fallbackKeys: ['discord', 'indiehackers', 'hackernews'],
    iconSlug: 'reddit',
    imageSpecs: [{ kind: 'avatar', label: 'Avatar', w: 256, h: 256 }, { kind: 'banner', label: 'Banner', w: 1280, h: 384 }],
    autoCheck: true,
    checklist: [
      item('profile_bio',       'creating', 'https://www.reddit.com/settings/profile', 'Add avatar + banner + 1-line bio. No URL yet.'),
      item('email_verified',    'creating', 'https://www.reddit.com/settings/account', 'Check inbox for verification email.'),
      item('account_age_days',  'warming', undefined, 'Just wait. Don\'t post from a fresh account.'),
      item('karma',             'warming', 'https://www.reddit.com/r/FreeKarma4U/', 'Genuine comments in niche subs beat karma farming.'),
      item('organic_posts',     'warming', 'https://www.reddit.com/submit', 'Post in subs matching your topic. No self-promo.'),
      item('organic_comments',  'warming', 'https://www.reddit.com/r/SideProject/new/', 'Comment helpfully on 10 recent posts in your niche.'),
    ],
  },
  {
    key: 'twitter', label: 'Twitter / X',
    signupUrl: 'https://twitter.com/i/flow/signup',
    postUrl: 'https://twitter.com/compose/tweet',
    priority: 'critical', fallbackKeys: ['bluesky', 'threads', 'linkedin'],
    iconSlug: 'x',
    imageSpecs: [{ kind: 'avatar', label: 'Avatar', w: 400, h: 400 }, { kind: 'banner', label: 'Header', w: 1500, h: 500 }],
    autoCheck: false,
    checklist: [
      item('profile_complete', 'creating', 'https://twitter.com/settings/profile', 'Avatar + banner + bio + website link.'),
      item('email_verified',   'creating', 'https://twitter.com/settings/email', 'Verify email + check inbox.'),
      item('phone_verified',   'creating', 'https://twitter.com/settings/phone', 'Required to avoid shadow-limits.'),
      item('followers',        'warming', 'https://twitter.com/home', 'Follow 50 relevant accounts; some will follow back.'),
      item('posts',            'warming', 'https://twitter.com/compose/tweet', 'Post 5 organic (observations, not pitches).'),
      item('replies',          'warming', undefined, 'Reply thoughtfully to 10 recent tweets in your niche.'),
    ],
  },
  {
    key: 'indiehackers', label: 'Indie Hackers',
    signupUrl: 'https://www.indiehackers.com/signup',
    postUrl: 'https://www.indiehackers.com/post',
    priority: 'high', fallbackKeys: ['hackernews', 'reddit', 'medium'],
    iconSlug: 'indiehackers',
    imageSpecs: [{ kind: 'avatar', label: 'Avatar', w: 400, h: 400 }],
    autoCheck: false,
    checklist: [
      item('profile',         'creating', 'https://www.indiehackers.com/account/edit', 'Headline + bio + links.'),
      item('milestone_post',  'warming', 'https://www.indiehackers.com/post', '"Just shipped / Lessons learned" post format works well.'),
      item('engagements',     'warming', undefined, 'Comment on 5 recent posts.'),
    ],
  },
  {
    key: 'linkedin', label: 'LinkedIn',
    signupUrl: 'https://www.linkedin.com/signup',
    postUrl: 'https://www.linkedin.com/feed/',
    priority: 'high', fallbackKeys: ['medium', 'indiehackers', 'twitter'],
    iconSlug: 'linkedin',
    imageSpecs: [{ kind: 'avatar', label: 'Profile photo', w: 400, h: 400 }, { kind: 'banner', label: 'Banner', w: 1584, h: 396 }],
    autoCheck: false,
    checklist: [
      item('profile_100',  'creating', 'https://www.linkedin.com/in/me/', 'Hit all "Complete your profile" prompts.'),
      item('photo_banner', 'creating', 'https://www.linkedin.com/in/me/edit/intro/', 'Professional photo + banner matching your brand.'),
      item('connections',  'warming', 'https://www.linkedin.com/mynetwork/', 'Accept + send requests to colleagues and relevant peers.'),
      item('posts',        'warming', 'https://www.linkedin.com/feed/', '3 posts in last 30d. Mix long-form + short.'),
      item('engagements',  'warming', undefined, 'Comment + react on 10 posts/week to build feed signal.'),
    ],
  },
  {
    key: 'devto', label: 'DEV.to',
    signupUrl: 'https://dev.to/enter?state=new-user',
    postUrl: 'https://dev.to/new',
    priority: 'high', fallbackKeys: ['hashnode', 'medium', 'reddit'],
    iconSlug: 'devdotto',
    imageSpecs: [{ kind: 'avatar', label: 'Profile image', w: 320, h: 320 }],
    autoCheck: false,
    checklist: [
      item('profile',        'creating', 'https://dev.to/settings', 'Tech stack, bio, avatar, social links.'),
      item('non_promo_post', 'warming', 'https://dev.to/new', '1 tech post (howto or learning log).'),
    ],
  },
  {
    key: 'hashnode', label: 'Hashnode',
    signupUrl: 'https://hashnode.com/signup',
    postUrl: 'https://hashnode.com/draft',
    priority: 'medium', fallbackKeys: ['devto', 'medium'],
    iconSlug: 'hashnode',
    imageSpecs: [{ kind: 'avatar', label: 'Avatar', w: 400, h: 400 }],
    autoCheck: false,
    checklist: [
      item('profile',        'creating', 'https://hashnode.com/settings', 'Username, bio, social + custom domain.'),
      item('non_promo_post', 'warming', 'https://hashnode.com/draft', '1 technical post.'),
    ],
  },
  {
    key: 'medium', label: 'Medium',
    signupUrl: 'https://medium.com/m/signin?operation=register',
    postUrl: 'https://medium.com/new-story',
    priority: 'medium', fallbackKeys: ['hashnode', 'devto'],
    iconSlug: 'medium',
    imageSpecs: [{ kind: 'avatar', label: 'Avatar', w: 512, h: 512 }],
    autoCheck: false,
    checklist: [
      item('profile',        'creating', 'https://medium.com/me/settings', 'Photo + bio + top writers list.'),
      item('non_promo_post', 'warming', 'https://medium.com/new-story', '1 non-promo post establishes topic authority.'),
    ],
  },
  {
    key: 'bluesky', label: 'Bluesky',
    signupUrl: 'https://bsky.app/',
    priority: 'medium', fallbackKeys: ['threads', 'twitter'],
    iconSlug: 'bluesky',
    imageSpecs: [{ kind: 'avatar', label: 'Avatar', w: 400, h: 400 }, { kind: 'banner', label: 'Banner', w: 3000, h: 1000 }],
    autoCheck: true,
    checklist: [
      item('profile',   'creating', 'https://bsky.app/settings/profile', 'Avatar + banner + bio.'),
      item('followers', 'warming', undefined, 'Follow 30 relevant accounts; many follow back.'),
      item('posts',     'warming', undefined, '3+ organic posts before launch.'),
      item('age_days',  'warming', undefined, 'Account age (auto-fetched).'),
    ],
  },
  {
    key: 'threads', label: 'Threads',
    signupUrl: 'https://www.threads.net/',
    priority: 'medium', fallbackKeys: ['twitter', 'bluesky'],
    iconSlug: 'threads',
    imageSpecs: [{ kind: 'avatar', label: 'Avatar', w: 1080, h: 1080 }],
    autoCheck: false,
    checklist: [
      item('profile', 'creating', 'https://www.threads.net/', 'Linked to Instagram. Bio + avatar match brand.'),
      item('posts',   'warming', undefined, '3+ posts (reuse Twitter content).'),
    ],
  },
  {
    key: 'beehiiv', label: 'beehiiv',
    signupUrl: 'https://www.beehiiv.com/sign-up',
    priority: 'medium', fallbackKeys: ['substack'],
    iconSlug: 'beehiiv',
    imageSpecs: [{ kind: 'logo', label: 'Publication logo', w: 1024, h: 1024 }],
    autoCheck: false,
    checklist: [
      item('publication',   'creating', 'https://app.beehiiv.com/onboarding', 'Create publication.'),
      item('domain',        'creating', 'https://app.beehiiv.com/', 'Settings → Custom domain.'),
      item('welcome_email', 'warming', undefined, 'Automations → welcome email on subscribe.'),
    ],
  },
  {
    key: 'substack', label: 'Substack',
    signupUrl: 'https://substack.com/signup',
    priority: 'medium', fallbackKeys: ['beehiiv'],
    iconSlug: 'substack',
    imageSpecs: [{ kind: 'logo', label: 'Publication logo', w: 1024, h: 1024 }],
    autoCheck: false,
    checklist: [
      item('publication',  'creating', 'https://substack.com/home', 'Create publication.'),
      item('about',        'warming', undefined, 'Write a clear about page. Who, what, why.'),
      item('welcome_post', 'warming', undefined, 'Pin a "Start here" post.'),
    ],
  },
  {
    key: 'youtube', label: 'YouTube',
    signupUrl: 'https://accounts.google.com/signup/v2/webcreateaccount?service=youtube',
    priority: 'medium', fallbackKeys: [],
    iconSlug: 'youtube',
    imageSpecs: [
      { kind: 'avatar', label: 'Channel icon', w: 800, h: 800 },
      { kind: 'banner', label: 'Channel banner', w: 2048, h: 1152, note: 'safe area 1546×423' },
    ],
    autoCheck: false,
    checklist: [
      item('channel_setup',   'creating', 'https://studio.youtube.com/channel/UC/editing', 'Banner 2048×1152, avatar, description.'),
      item('verified',        'creating', 'https://www.youtube.com/verify', 'Phone verify → unlocks custom thumbnails.'),
      item('subscribers',     'warming', undefined, '10 subs threshold for being indexed in search.'),
      item('non_promo_video', 'warming', 'https://studio.youtube.com/', 'Upload 1 non-promo video (demo or walkthrough).'),
    ],
  },
  {
    key: 'discord', label: 'Discord',
    signupUrl: 'https://discord.com/register',
    postUrl: 'https://discord.com/channels/@me',
    priority: 'medium', fallbackKeys: ['threads', 'bluesky', 'reddit'],
    iconSlug: 'discord',
    imageSpecs: [{ kind: 'avatar', label: 'Avatar', w: 512, h: 512 }],
    autoCheck: false,
    checklist: [
      item('profile',         'creating', 'https://discord.com/channels/@me', 'User Settings → avatar + username + about-me.'),
      item('email_verified',  'creating', undefined, 'Check inbox.'),
      item('phone_verified',  'creating', 'https://discord.com/channels/@me', 'User Settings → My Account → phone.'),
      item('servers_joined',  'warming', undefined, 'Join 5 dev/SaaS/outreach-adjacent Discord servers.'),
      item('active_chats',    'warming', undefined, 'Chat in 3+ for a few days. Don\'t pitch.'),
    ],
  },
  {
    key: 'buymeacoffee', label: 'Buy Me a Coffee',
    signupUrl: 'https://www.buymeacoffee.com/',
    priority: 'medium', fallbackKeys: [],
    iconSlug: 'buymeacoffee',
    imageSpecs: [{ kind: 'avatar', label: 'Page photo', w: 400, h: 400 }],
    autoCheck: false,
    checklist: [
      item('page_setup',       'creating', 'https://www.buymeacoffee.com/dashboard/account', 'Username + cover + bio.'),
      item('stripe_connected', 'creating', 'https://www.buymeacoffee.com/dashboard/withdraw', 'Connect Stripe for payouts.'),
    ],
  },
];

export const PLATFORMS: PlatformDef[] = attachSnippets(PLATFORMS_RAW);
