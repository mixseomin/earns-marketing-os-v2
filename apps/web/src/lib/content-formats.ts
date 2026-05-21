// Content-format catalog cho seeding. 1 brief × phase có thể sinh nhiều
// KIỂU nội dung (text / image / video / link / thread / poll / carousel /
// story / doc), không chỉ text. Mỗi platform (theo category) chỉ hỗ trợ 1
// tập format + có "mix" gợi ý (trọng số) → seeding xoay vòng theo mix.
//
// Dùng được cả ở server actions lẫn client (chỉ là const + pure fn).

export interface ContentFormat {
  key: string;
  label: string;   // hiển thị (tiếng Việt cho UI nội bộ)
  icon: string;    // emoji nhận diện nhanh
  hint: string;    // scaffold/định hướng ngắn
  color: string;   // hue nhận diện riêng (badge bg/fg/border tự suy ra)
}

// Thứ tự = thứ tự hiển thị trong menu.
// Màu: mỗi format 1 hue riêng → nhìn 1 phát biết loại bài. Tránh đụng
// --ok/--bad/--accent (semantic chung).
export const CONTENT_FORMATS: ContentFormat[] = [
  { key: 'text',     label: 'Bài chữ',      icon: '📝', color: '#94a3b8', hint: 'Post thuần text — kể chuyện / chia sẻ / hỏi đáp' },
  { key: 'image',    label: 'Bài ảnh',      icon: '🖼️', color: '#fbbf24', hint: 'Caption + 1 ảnh/đồ hoạ (meme, infographic, screenshot)' },
  { key: 'video',    label: 'Video',        icon: '🎬', color: '#f87171', hint: 'Hook 3s + script beats + shot list + caption/CTA' },
  { key: 'link',     label: 'Bài link',     icon: '🔗', color: '#60a5fa', hint: 'Link đính kèm + góc bài + comment seeding mồi' },
  { key: 'thread',   label: 'Thread',       icon: '🧵', color: '#a78bfa', hint: 'Chuỗi nhiều post nối tiếp (tweet 1 = hook)' },
  { key: 'poll',     label: 'Poll',         icon: '📊', color: '#22d3ee', hint: 'Câu hỏi + lựa chọn + comment follow-up' },
  { key: 'carousel', label: 'Carousel',     icon: '🎠', color: '#f472b6', hint: 'Nhiều slide (outline từng slide)' },
  { key: 'story',    label: 'Story/Reel',   icon: '⚡', color: '#fb923c', hint: 'Khung dọc ngắn frame-by-frame' },
  { key: 'doc',      label: 'Tài liệu',     icon: '📄', color: '#34d399', hint: 'Bài dài có cấu trúc / guide / writeup' },
];

export const CONTENT_FORMAT_MAP: Record<string, ContentFormat> =
  Object.fromEntries(CONTENT_FORMATS.map((f) => [f.key, f]));

export function formatMeta(key: string): ContentFormat {
  return CONTENT_FORMAT_MAP[key] ?? CONTENT_FORMAT_MAP.text!;
}

// Helper: convert hex màu format → bg-soft + border (med alpha) cho badge.
export function formatColors(key: string): { fg: string; bg: string; border: string } {
  const c = formatMeta(key).color;
  return { fg: c, bg: c + '1f', border: c + '66' };
}

// ── Completeness ──
// Bài "đủ data" để có thể đăng = tuỳ loại bài:
//   - visual (image/carousel/story): cần media_asset_id (caption optional).
//   - text-first (text/link/poll/thread/doc/video script...): cần body_target
//     dài ≥50 ký tự MEANING (strip heading/blockquote/placeholder).
// Client-safe (pure fn) → dùng được trong PostRow badge optimistic.
export const VISUAL_NEEDS_MEDIA = ['image', 'carousel', 'story'];

export function meaningfulLen(body: string): number {
  return (body || '')
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith('#') && !t.startsWith('>') && !/^_\(.*\)_$/.test(t);
    })
    .join(' ')
    .replace(/[#>*_`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

export function postCompleteness(
  contentType: string, bodyTarget: string, mediaAssetId: number | null,
): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (VISUAL_NEEDS_MEDIA.includes(contentType)) {
    if (mediaAssetId == null) missing.push('ảnh');
  } else {
    if (meaningfulLen(bodyTarget) < 50) missing.push('nội dung');
  }
  return { complete: missing.length === 0, missing };
}

// ── Mix achievement ──
// So sánh share THỰC TẾ (đếm cards theo content_type) vs share MỤC TIÊU
// (effectiveMix → trọng số → share %). Trả về per-format breakdown để UI
// vẽ bar/chip "đạt/chưa đạt" theo tiêu chí.
//
// verdict per format:
//   - 'ok'    : actualShare ≥ targetShare (đạt hoặc vượt)
//   - 'under' : actualShare < targetShare nhưng > 0 (đang thiếu, đã có ít)
//   - 'miss'  : actualShare = 0 (chưa có bài loại này — cần làm)
//   - 'extra' : actual > 0 nhưng format không có trong target (thừa loại)
export interface FormatAchievement {
  key: string;
  actual: number;            // số bài hiện có
  actualShare: number;       // 0..1
  target: number;            // số bài "lý tưởng" theo target × total actual
  targetShare: number;       // 0..1
  verdict: 'ok' | 'under' | 'miss' | 'extra';
}

export function computeMixAchievement(
  counts: Record<string, number>,         // {text: 3, image: 0, link: 1, ...}
  targetMix: Record<string, number>,      // effectiveMix output
): { items: FormatAchievement[]; total: number; doneCount: number; missCount: number } {
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const targetTotal = Object.values(targetMix).reduce((s, w) => s + Number(w), 0) || 1;
  const allKeys = new Set([...Object.keys(targetMix), ...Object.keys(counts)]);
  const items: FormatAchievement[] = [];
  for (const k of allKeys) {
    const actual = counts[k] ?? 0;
    const tw = Number(targetMix[k] ?? 0);
    const targetShare = tw / targetTotal;
    const actualShare = total > 0 ? actual / total : 0;
    const target = Math.round(targetShare * total);
    let verdict: FormatAchievement['verdict'];
    if (tw === 0 && actual > 0) verdict = 'extra';
    else if (actual === 0 && tw > 0) verdict = 'miss';
    else if (actualShare >= targetShare) verdict = 'ok';
    else verdict = 'under';
    items.push({ key: k, actual, actualShare, target, targetShare, verdict });
  }
  // Sort: targetShare desc rồi actual desc — loại quan trọng nhất ở đầu.
  items.sort((a, b) => b.targetShare - a.targetShare || b.actual - a.actual);
  const doneCount = items.filter((i) => i.verdict === 'ok').length;
  const missCount = items.filter((i) => i.verdict === 'miss' || i.verdict === 'under').length;
  return { items, total, doneCount, missCount };
}

// platforms.category → format hỗ trợ + mix mặc định (trọng số tương đối).
// Category list (schema): tech/social/video/blog/launch/community/
// messaging/marketplace/newsletter/design/other.
interface FormatProfile { formats: string[]; mix: Record<string, number> }

const PROFILE_BY_CATEGORY: Record<string, FormatProfile> = {
  social:      { formats: ['text', 'image', 'video', 'link', 'thread', 'poll', 'carousel', 'story'],
                 mix: { image: 4, text: 3, video: 2, link: 1, poll: 1 } },
  community:   { formats: ['text', 'image', 'link', 'poll', 'thread'],
                 mix: { text: 5, image: 2, link: 2, poll: 1 } },
  video:       { formats: ['video', 'image', 'text'],
                 mix: { video: 6, image: 2, text: 1 } },
  messaging:   { formats: ['text', 'image', 'link', 'poll'],
                 mix: { text: 4, image: 2, link: 2 } },
  blog:        { formats: ['doc', 'link', 'text'],
                 mix: { doc: 4, link: 2, text: 1 } },
  newsletter:  { formats: ['doc', 'link', 'text'],
                 mix: { doc: 5, link: 2 } },
  launch:      { formats: ['text', 'image', 'link', 'video'],
                 mix: { text: 3, image: 2, link: 2, video: 1 } },
  design:      { formats: ['image', 'carousel', 'video', 'text'],
                 mix: { image: 4, carousel: 2, video: 2, text: 1 } },
  marketplace: { formats: ['text', 'image', 'link'],
                 mix: { image: 3, text: 2, link: 1 } },
  tech:        { formats: ['text', 'link', 'image', 'doc'],
                 mix: { text: 4, link: 2, image: 1, doc: 1 } },
};

const DEFAULT_PROFILE: FormatProfile = {
  formats: ['text', 'image', 'link'],
  mix: { text: 3, image: 2, link: 1 },
};

// Một số platform-key lệch khỏi category của nó.
const PROFILE_BY_KEY: Record<string, FormatProfile> = {
  youtube:   { formats: ['video', 'image', 'text'], mix: { video: 7, image: 1, text: 1 } },
  tiktok:    { formats: ['video', 'story'], mix: { video: 8, story: 2 } },
  instagram: { formats: ['image', 'carousel', 'story', 'video'], mix: { image: 4, carousel: 2, story: 2, video: 2 } },
  pinterest: { formats: ['image', 'carousel'], mix: { image: 6, carousel: 2 } },
  reddit:    { formats: ['text', 'link', 'image', 'poll'], mix: { text: 5, link: 2, image: 2, poll: 1 } },
  twitter:   { formats: ['text', 'image', 'thread', 'video', 'poll'], mix: { text: 4, image: 3, thread: 2, video: 1, poll: 1 } },
  x:         { formats: ['text', 'image', 'thread', 'video', 'poll'], mix: { text: 4, image: 3, thread: 2, video: 1, poll: 1 } },
  discord:   { formats: ['text', 'image', 'link'], mix: { text: 5, image: 2, link: 1 } },
  telegram:  { formats: ['text', 'image', 'link', 'poll'], mix: { text: 4, image: 2, link: 2, poll: 1 } },
};

export function formatProfile(platformKey?: string | null, category?: string | null): FormatProfile {
  if (platformKey && PROFILE_BY_KEY[platformKey]) return PROFILE_BY_KEY[platformKey]!;
  if (category && PROFILE_BY_CATEGORY[category]) return PROFILE_BY_CATEGORY[category]!;
  return DEFAULT_PROFILE;
}

// Resolve order (cao → thấp):
//   1. habitatOverride (habitats.allowed_formats_override) — community cấm
//      thêm 1 số loại (vd r/AskReddit cấm link).
//   2. platformOverride (platforms.allowed_formats) — admin tự định nghĩa
//      cho từng platform thay vì hardcoded.
//   3. PROFILE_BY_KEY[platformKey] / PROFILE_BY_CATEGORY[category] hardcoded
//      fallback (content-formats.ts) cho platform chưa configured.
//
// Mỗi tầng trả về list format keys hợp lệ; nullable/empty = fallback xuống
// tầng dưới. Format keys bất hợp lệ (không trong CONTENT_FORMATS) bị filter.
export function allowedFormats(
  platformKey?: string | null,
  category?: string | null,
  platformOverride?: string[] | null,
  habitatOverride?: string[] | null,
): ContentFormat[] {
  let keys: string[];
  if (habitatOverride && habitatOverride.length > 0) keys = habitatOverride;
  else if (platformOverride && platformOverride.length > 0) keys = platformOverride;
  else keys = formatProfile(platformKey, category).formats;
  const set = new Set(keys);
  return CONTENT_FORMATS.filter((f) => set.has(f.key));
}

// Mix hiệu lực — resolve order: PhaseEntry override → platforms.format_mix
// DB override → hardcoded profile.mix. Allowed list cũng theo cùng order
// (habitat → platform → hardcoded) để chỉ giữ key hợp lệ với community.
export function effectiveMix(
  platformKey: string | null | undefined,
  category: string | null | undefined,
  override?: Record<string, number> | null,
  platformMixOverride?: Record<string, number> | null,
  platformAllowedOverride?: string[] | null,
  habitatAllowedOverride?: string[] | null,
): Record<string, number> {
  const profile = formatProfile(platformKey, category);
  const allowedList = allowedFormats(platformKey, category, platformAllowedOverride, habitatAllowedOverride).map((f) => f.key);
  const allowed = new Set(allowedList);
  const base = override && Object.keys(override).length > 0
    ? override
    : (platformMixOverride && Object.keys(platformMixOverride).length > 0
        ? platformMixOverride
        : profile.mix);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) {
    if (allowed.has(k) && Number(v) > 0) out[k] = Number(v);
  }
  if (Object.keys(out).length === 0) {
    for (const [k, v] of Object.entries(profile.mix)) if (allowed.has(k)) out[k] = v;
  }
  if (Object.keys(out).length === 0) out.text = 1;
  return out;
}

// Xoay vòng có trọng số, deterministic theo n (vd số card seed đã có của
// brief). Dựng chuỗi từ trọng số (round-robin theo tỉ lệ) rồi index theo n.
export function pickFormatByRotation(mix: Record<string, number>, n: number): string {
  const entries = Object.entries(mix).filter(([, w]) => w > 0);
  if (entries.length === 0) return 'text';
  if (entries.length === 1) return entries[0]![0];
  // Bresenham-ish: lặp tới tổng trọng số, mỗi vòng phát format có "nợ" lớn nhất.
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const seq: string[] = [];
  const acc: Record<string, number> = {};
  for (const [k] of entries) acc[k] = 0;
  for (let i = 0; i < total; i++) {
    let best = entries[0]![0];
    let bestVal = -Infinity;
    for (const [k, w] of entries) {
      acc[k]! += w;
      if (acc[k]! > bestVal) { bestVal = acc[k]!; best = k; }
    }
    acc[best]! -= total;
    seq.push(best);
  }
  return seq[((n % seq.length) + seq.length) % seq.length]!;
}
