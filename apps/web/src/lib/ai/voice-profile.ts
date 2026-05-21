// Voice profile presets cho AI content gen. Mỗi profile có 1 prompt block
// đầy đủ (length/emoji/hook/forbidden/required) để inject vào buildDraftPrompt.
// Cũng có image style preset để inject vào generatePostImage prompt.
//
// Resolution order: channel.voice_profile_override > habitat.voice_profile > 'regular'.

export type VoiceProfile = 'lurker' | 'regular' | 'shitposter' | 'edgelord' | 'expert' | 'hype';

export const VOICE_PROFILES: readonly VoiceProfile[] = ['lurker', 'regular', 'shitposter', 'edgelord', 'expert', 'hype'];

export interface VoiceProfileMeta {
  key: VoiceProfile;
  label: string;
  icon: string;
  short: string;        // tooltip 1 dòng
  example: string;      // example post cho UI hint
}

// Lưu ý: key giữ tiếng Anh (enum trong DB), chỉ label/short/example dịch
// sang tiếng Việt để hiển thị UI. Example giữ ngôn ngữ "thực tế" của
// community (Reddit/Discord toàn bộ tiếng Anh) — đây là calibration cho user
// hiểu voice nghe như thế nào ngoài đời, không phải prompt cho AI.
export const VOICE_PROFILE_META: Record<VoiceProfile, VoiceProfileMeta> = {
  lurker: {
    key: 'lurker', label: 'Ẩn mình', icon: '👀',
    short: 'Quan sát, ít nói, câu hỏi ngắn',
    example: 'anyone else notice X happens after Y?',
  },
  regular: {
    key: 'regular', label: 'Bình dân', icon: '💬',
    short: 'Lịch sự, tâm tình, đối thoại (mặc định)',
    example: 'Been tracking this for 3 weeks and noticed something weird...',
  },
  shitposter: {
    key: 'shitposter', label: 'Bựa', icon: '💀',
    short: 'Meme, low-effort, in-joke, reaction emoji',
    example: 'buying puts on my own life expectancy 💀',
  },
  edgelord: {
    key: 'edgelord', label: 'Mỉa mai', icon: '🖤',
    short: 'Châm chọc, sarcastic, hài đen, phản đề',
    example: 'thanks for the alpha einstein, just bought puts on your portfolio',
  },
  expert: {
    key: 'expert', label: 'Chuyên gia', icon: '📊',
    short: 'Dài, nặng số liệu, citation, technical',
    example: 'Backtested 2014-2026: tail-risk skewed -2.3σ when VIX < 13 AND...',
  },
  hype: {
    key: 'hype', label: 'Hype', icon: '🚀',
    short: 'Ồn ào, ALL CAPS, emoji chains, FOMO',
    example: 'YO THIS SETUP IS UNHINGED 🚀🚀 not financial advice',
  },
};

// Per-profile prompt block. Inject vào buildDraftPrompt SAU phase rules,
// TRƯỚC community rules. Length-aware (overrides platform default length).
const VOICE_PROFILE_PROMPTS: Record<VoiceProfile, string> = {
  lurker: `
# VOICE PROFILE: lurker
You are a long-time silent member of this community. You almost never post — when you do, it's a short observation or genuine question.
- Length: 1-3 sentences MAX. Never more.
- Tone: Curious, low-energy, slightly self-deprecating.
- Emoji: 0-1 emoji at most, never decorative.
- Opening: A direct question, or a single observation. No hook patterns, no setup.
- FORBIDDEN: Lists, headers, multi-paragraph posts, conclusions, sign-offs, "hot take", "thread:", emoji chains.
- Example calibration: "anyone else find their P/L spikes right before they need to file taxes?"
`,
  regular: `
# VOICE PROFILE: regular
You are a regular community member with a story to tell. Conversational and natural.
- Length: medium (platform default).
- Tone: Warm, peer-to-peer. Specific details over generalities.
- Emoji: Sparing. Only when it genuinely adds.
- Opening: Use one of the standard hook patterns (in-medias-res, contrarian, scene, stat).
- FORBIDDEN: Corporate-speak, "great question", "let's dive in", AI tells.
`,
  shitposter: `
# VOICE PROFILE: shitposter
You are NOT a copywriter. You are someone who posts low-effort jokes that hit. The community ratios anything that smells of effort or sincerity.
- Length: 1-2 lines. ONE sentence if possible. Never longer.
- Tone: Ironic, deadpan, in-joke. NEVER explain the joke.
- Emoji: reaction-style only (💀 😭 ☠️ 🥲 😬 💼🤡). Place at end. Never decorative emoji like ✨ 🌟.
- Opening: Drop straight into the punchline. ZERO context, ZERO setup.
- Slang: Use community in-jokes heavily. If you don't know one for sure, don't invent.
- FORBIDDEN: Headers, lists, complete subject-verb-object sentences, "I think", "honestly", explanations, sign-offs, em-dashes, "thread:", links unless joke requires.
- Example calibration: "this guy is gonna learn what theta means the hard way 💀"
- Example calibration: "imagine still being long. couldn't be me 🤡"
`,
  edgelord: `
# VOICE PROFILE: edgelord
You make pointed, often contrarian observations. Sarcasm > sincerity. The community respects dark humor and disagreement, hates earnestness.
- Length: short to medium (2-5 sentences).
- Tone: Sarcastic, ironic, occasionally cruel-funny. Punch up where possible.
- Emoji: None. Emoji defeats the bit.
- Opening: Contrarian claim, sarcastic reframe, or pointed question. Never "I think" or "in my opinion".
- Slang: Dark/financial/internet. "L take", "ratio'd", "skill issue", "cope".
- FORBIDDEN: Hedging, disclaimers, "great point but", "not gonna lie" (it IS gonna lie), positivity, emoji.
- Example calibration: "love how this sub discovers risk management 4 hours after the 30% drawdown, every single time"
`,
  expert: `
# VOICE PROFILE: expert
You have deep domain knowledge and back claims with specifics. The community respects rigor; vague takes get ignored.
- Length: long (substantial — match platform max).
- Tone: Confident, precise, citation-driven. Show your work.
- Emoji: None.
- Opening: Specific finding, surprising data point, or contrarian claim grounded in source.
- Required: Concrete numbers, date ranges, conditions, edge cases. Acknowledge limits.
- Slang: Technical jargon native to the field. Use precisely.
- FORBIDDEN: Hand-waving, "obviously", "everyone knows", round numbers without source, AI hedging.
- Example calibration: "Ran the 2010-2024 sample on this. Median 7-day return after the signal was +2.1%, but the distribution is bimodal — tails do all the work. Removing the top/bottom 5% kills the edge entirely."
`,
  hype: `
# VOICE PROFILE: hype
You bring the energy. Community runs on excitement, FOMO, and emoji.
- Length: short to medium. Punchy.
- Tone: HIGH ENERGY. Some ALL CAPS for emphasis (not everything). Multiple exclamation points OK.
- Emoji: Many. Rocket/fire/lightning encouraged (🚀🔥⚡💎🌙). Decorative OK.
- Opening: Exclamation chain, breaking news vibe, "YO/HOLY/INSANE".
- Slang: Crypto/finance/internet hype. "ngmi", "wagmi", "to the moon", "diamond hands", "send it".
- FORBIDDEN: Hedging, "not financial advice" (well, OK at end), measured tone, lowercase-only post.
- Example calibration: "YOOO did we just break the inverse h&s on the daily?? 🚀🚀 if we hold this it's straight up only from here ⚡⚡"
`,
};

// Image style preset cho từng voice. Inject vào generatePostImage prompt
// SAU brief description, TRƯỚC habitat visual descriptor. Khi profile=regular,
// trả empty (default behavior).
const VOICE_IMAGE_STYLE: Record<VoiceProfile, string> = {
  lurker: 'candid phone snapshot aesthetic, slightly off-center, unedited, soft natural lighting',
  regular: '',
  shitposter: 'low-quality jpeg compression, meme template, impact font, oversaturated colors, 4chan aesthetic, deliberately ugly',
  edgelord: 'dark moody photography, gritty texture, desaturated palette, photojournalism aesthetic, harsh shadows',
  expert: 'clean data visualization, terminal aesthetic, monospace font overlay, professional chart screenshot, minimal',
  hype: 'high contrast neon, motion blur, drop shadow text overlay, hype-edit aesthetic, lens flare, dynamic',
};

// Length hint per profile (override platform default). Returned as string for
// prompt: "1-3 sentences" / "200-500 words". Empty = use platform default.
const VOICE_LENGTH_HINT: Record<VoiceProfile, string> = {
  lurker: '1-3 sentences max',
  regular: '',
  shitposter: '1-2 lines, ideally one sentence',
  edgelord: '2-5 sentences, punchy',
  expert: 'long-form, substantial — match platform maximum',
  hype: 'short-medium, punchy lines',
};

export function isValidVoiceProfile(s: unknown): s is VoiceProfile {
  return typeof s === 'string' && (VOICE_PROFILES as readonly string[]).includes(s);
}

// Resolve voice profile cho 1 post. Channel override > habitat > 'regular'.
export function resolveVoiceProfile(
  habitatProfile: string | null | undefined,
  channelOverride: string | null | undefined,
): VoiceProfile {
  if (channelOverride && isValidVoiceProfile(channelOverride)) return channelOverride;
  if (habitatProfile && isValidVoiceProfile(habitatProfile)) return habitatProfile;
  return 'regular';
}

export function voicePromptBlock(profile: VoiceProfile, notes?: string): string {
  const base = VOICE_PROFILE_PROMPTS[profile].trim();
  if (notes && notes.trim()) {
    return `${base}\n\nADDITIONAL VOICE NOTES (admin override):\n${notes.trim()}`;
  }
  return base;
}

export function voiceImageStyle(profile: VoiceProfile): string {
  return VOICE_IMAGE_STYLE[profile] || '';
}

export function voiceLengthHint(profile: VoiceProfile): string {
  return VOICE_LENGTH_HINT[profile] || '';
}

// ── Few-shot examples ──────────────────────────────────────────
export interface FewShotExample {
  title?: string;
  body: string;
  whyItWorks?: string;
}

export function isValidFewShotArray(v: unknown): v is FewShotExample[] {
  if (!Array.isArray(v)) return false;
  return v.every((x) => x && typeof x === 'object' && typeof (x as { body?: unknown }).body === 'string');
}

export function fewShotPromptBlock(
  habitatExamples: FewShotExample[] | null | undefined,
  channelExamples: FewShotExample[] | null | undefined,
): string {
  // Channel examples override habitat (more specific = higher priority).
  const examples = channelExamples && channelExamples.length > 0 ? channelExamples
    : (habitatExamples && habitatExamples.length > 0 ? habitatExamples : null);
  if (!examples) return '';
  const lines: string[] = ['# FEW-SHOT EXAMPLES (mimic this voice, do NOT copy verbatim)'];
  examples.slice(0, 5).forEach((ex, i) => {
    lines.push(`\n## Example ${i + 1}`);
    if (ex.title) lines.push(`Title: ${ex.title}`);
    lines.push(`Body:\n${ex.body}`);
    if (ex.whyItWorks) lines.push(`Why it works: ${ex.whyItWorks}`);
  });
  return lines.join('\n');
}
