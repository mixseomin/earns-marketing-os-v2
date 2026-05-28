// Phase-aware strategy types + default templates for community_briefs.
// See migration 0049_brief_phases.sql.

export const PHASES = ['warm-up', 'value', 'bridge', 'seed', 'direct', 'cooldown', 'paused'] as const;
export type Phase = typeof PHASES[number];

// 5 active phases that have a planned entry by default. cooldown + paused are
// transient states, manually set, no plan entry needed.
export const PLANNED_PHASES: Phase[] = ['warm-up', 'value', 'bridge', 'seed', 'direct'];

export const PHASE_LABEL: Record<Phase, string> = {
  'warm-up':  'Khởi động',
  'value':    'Cống hiến',
  'bridge':   'Bắc cầu',
  'seed':     'Gieo mầm',
  'direct':   'Trực diện',
  'cooldown': 'Hạ nhiệt',
  'paused':   'Tạm dừng',
};

// Tailwind-free CSS-var colors (matches design tokens used elsewhere).
export const PHASE_COLOR: Record<Phase, string> = {
  'warm-up':  '#a78bfa',   // tím - học hỏi
  'value':    '#60a5fa',   // xanh dương - cho đi
  'bridge':   '#34d399',   // xanh lá - bắc cầu
  'seed':     '#fbbf24',   // hổ phách - tín hiệu thương mại đầu
  'direct':   '#f87171',   // đỏ - quảng bá rõ ràng
  'cooldown': '#9ca3af',   // xám - nghỉ
  'paused':   '#6b7280',   // mờ - tạm khóa
};

export const PHASE_DESCRIPTION: Record<Phase, string> = {
  'warm-up':  'Hòa nhập văn hóa community. Không link. Build profile + karma.',
  'value':    'Giúp người khác, chia sẻ kiến thức. Zero quảng bá, chỉ trích dẫn nguồn.',
  'bridge':   'Đăng chart screenshot có watermark. Không link sống.',
  'seed':     'Nhắc khéo Astrolas khi đúng ngữ cảnh. 1 link contextual.',
  'direct':   '"I built this" announcement. Quảng bá rõ ràng, hiếm dùng.',
  'cooldown': 'Tạm ngừng đăng để tránh ban. Quay lại phase trước sau cooldown.',
  'paused':   'Manual pause - không hoạt động trong community này.',
};

export interface PhaseEntry {
  phase: Phase;
  goal: string;                  // "10 helpful replies + 1 intro post"
  startTrigger: string;          // when phase becomes active
  endTrigger: string;            // when to advance to next
  cadence: string;               // "5 replies/day", "2 posts/week"
  tone: string;                  // voice/tone notes
  doMd: string;                  // do guidance (markdown OK)
  dontMd: string;                // dont guidance
  estimatedPosts: number;        // target post count for this phase
  hooks?: string[];              // 3-5 hook patterns for storytelling in this phase
  // 0055: override content-format mix cho phase này (trọng số theo
  // format key). Rỗng/undefined = dùng mặc định theo platform
  // (lib/content-formats.ts effectiveMix).
  formatMix?: Record<string, number>;
  // CPS: override pillar mix cho phase này (trọng số theo pillar.id).
  // Vd { "1": 4, "2": 4, "3": 2 } = phase Bridge: 40% Educational, 40%
  // Personalized, 20% Cultural bridge. Rỗng/undefined = mọi card kế thừa
  // brief.primary_pillar_id (1 pillar duy nhất, không đa dạng).
  // Khi tạo N placeholders, distribute round-robin theo mix.
  pillarMix?: Record<string, number>;
  linkedKnowledgeIds: number[];  // FK knowledge_items.id (e.g. catalog #219)
  linkedCardIds: number[];       // FK cards.id (actual content cards once created)
}

export interface PhaseHistoryEntry {
  from: Phase | null;
  to: Phase;
  at: string;                    // ISO timestamp
  byUserId: number | null;
  reason: string;
}

// Archetype = posture for default plan generation. Inferred from habitat
// metadata (kind, modStrictness, members, language) - see archetypeFor().
type Archetype =
  | 'scholarly'      // Skyscript, Light on Vedic, Saptarishis
  | 'mainstream'     // Astrology Weekly, AstroSeek Forum, AstrologyForums.com
  | 'lifestyle'      // ElsaElsa, DXPnet
  | 'eastern'        // Lyso, Douban, Daum, Tu Vi Ly So
  | 'reddit'         // r/astrology, r/AskAstrologers, etc.
  | 'reddit-strict'  // r/HellenisticAstrology and other scholarly subs
  | 'fb-group'       // Facebook groups
  | 'discord'        // Discord servers
  | 'generic';

export function archetypeFor(habitat: {
  kind: string;
  modStrictness?: string | null;
  language?: string | null;
  members?: number | null;
}): Archetype {
  const k = (habitat.kind || '').toLowerCase();
  const strict = (habitat.modStrictness || '').toLowerCase();

  if (k === 'subreddit' || k === 'reddit') {
    return strict === 'high' ? 'reddit-strict' : 'reddit';
  }
  if (k === 'fb-group' || k === 'fb_group' || k === 'facebook') return 'fb-group';
  if (k === 'discord') return 'discord';

  // Forum kinds: scholarly vs mainstream vs lifestyle vs eastern.
  // Heuristic: language tells us eastern; mod_strictness tells us scholarly.
  const lang = (habitat.language || '').toLowerCase();
  if (['vi', 'zh', 'ko', 'ja'].includes(lang)) return 'eastern';
  if (strict === 'high') return 'scholarly';
  // Default forum/group/cafe → mainstream
  if (k === 'forum' || k === 'group' || k === 'cafe' || k === 'org') {
    return 'mainstream';
  }
  return 'generic';
}

// Default phase plan per archetype. These are baseline templates - user edits
// in BriefEditModal to customize per (account × habitat).
export function defaultPhasePlanFor(habitat: Parameters<typeof archetypeFor>[0]): PhaseEntry[] {
  const a = archetypeFor(habitat);
  return TEMPLATES[a].map((p) => ({ ...p, hooks: p.hooks ?? [], linkedKnowledgeIds: [], linkedCardIds: [] }));
}

// Default narrative/storytelling guidance per archetype - written at brief
// level (community_briefs.narrative_md). User edits/expands per persona.
export function defaultNarrativeFor(habitat: Parameters<typeof archetypeFor>[0]): string {
  const a = archetypeFor(habitat);
  return NARRATIVE_TEMPLATES[a];
}

type Tpl = Omit<PhaseEntry, 'linkedKnowledgeIds' | 'linkedCardIds'>;

const TEMPLATES: Record<Archetype, Tpl[]> = {
  scholarly: [
    { phase: 'warm-up', goal: '20 bài có chiều sâu + intro - mod nhận diện account',
      startTrigger: 'Account tạo + bio set xong',
      endTrigger: '20 bài chất lượng VÀ qua 30+ ngày',
      cadence: '2 bài/tuần (reply technique + 1 câu hỏi)',
      tone: 'Học thuật, dày trích dẫn. Greek/Latin OK. Không emoji. Không slang hiện đại.',
      doMd: '- Reply vào technique thread có sẵn, kèm trích dẫn nguồn gốc\n- Hỏi về 1 đoạn văn bản cụ thể\n- Chia sẻ excerpt-kèm-bình-luận từ Bonatti / Valens / Hand\n- Lurk 7 ngày đầu để học vocabulary của community',
      dontMd: '- KHÔNG đăng chart của bản thân (Skyscript: rule 30 ngày)\n- KHÔNG link dưới mọi hình thức\n- KHÔNG dùng "vibes"/"based on my analysis" — lộ giọng AI\n- KHÔNG nhắc tên tool',
      estimatedPosts: 22 },
    { phase: 'value', goal: 'Trở thành contributor được công nhận; 50+ bài chất lượng',
      startTrigger: 'Hoàn thành Warm-up + ít nhất 1 lần mod tương tác (không xóa bài)',
      endTrigger: '50 bài VÀ 60+ ngày kể từ ngày tạo account',
      cadence: '2-3 own thread/tháng + reply thường xuyên',
      tone: 'Uy tín nhưng khiêm tốn. Trích dẫn, không lên giọng.',
      doMd: '- Own thread deep-dive technique (800-1500 chữ)\n- Phê bình nguồn / so sánh bản dịch\n- Worked horary example (ẩn danh)\n- Engage thread của practitioner khác có chiều sâu',
      dontMd: '- VẪN KHÔNG nhắc tool\n- KHÔNG self-promo trong signature',
      estimatedPosts: 30 },
    { phase: 'bridge', goal: 'Xây dựng style chart visualization (recognition watermark Astrolas)',
      startTrigger: 'Hoàn thành Value phase; 60+ ngày kể từ ngày tạo',
      endTrigger: 'Chart watermarked nhận traffic organic HOẶC qua 90 ngày',
      cadence: '1 bài chart-image/tuần',
      tone: 'Giống Value phase, kèm ví dụ trực quan.',
      doMd: '- Worked example post kèm chart screenshot ẩn danh\n- Watermark luôn hiện diện (astrolas.com 9pt opacity 60%, góc dưới phải)\n- Mô tả tập trung vào kỹ thuật, không phải tool',
      dontMd: '- KHÔNG link trong body post\n- KHÔNG so sánh tool',
      estimatedPosts: 12 },
    { phase: 'seed', goal: 'Lần đầu nhắc tên tool công khai mà không bị phản ứng',
      startTrigger: '90+ ngày kể từ ngày tạo; mod chưa flag gì',
      endTrigger: 'Thread soft-mention đầu tiên có engagement tích cực',
      cadence: 'Tối đa 1 mention/tháng',
      tone: 'Casual, framing "I sketched a script…". Không pitch.',
      doMd: '- Nhắc tool trong context của 1 worked example\n- "Used Astrolas for the SA viz - reproducible if you want"\n- 1 contextual link duy nhất',
      dontMd: '- KHÔNG ngôn ngữ sale\n- KHÔNG lặp lại mention trong cùng thread',
      estimatedPosts: 4 },
    { phase: 'direct', goal: 'Tool announcement post (rất hiếm cho scholarly forum)',
      startTrigger: '6+ tháng presence + goodwill cộng đồng rõ',
      endTrigger: 'Post sống không bị remove',
      cadence: '1 lần duy nhất (hoặc per major feature)',
      tone: '"I built X để solve Y - đây là nó, mong feedback." Không salesmanship.',
      doMd: '- 1 post duy nhất giải thích feature\n- Thừa nhận alternative công khai\n- Mời góp ý phê bình',
      dontMd: '- TUYỆT ĐỐI KHÔNG lặp lại hay khơi lại\n- KHÔNG dùng trong context scholarly trừ khi cộng đồng đã duyệt',
      estimatedPosts: 1 },
  ],

  mainstream: [
    { phase: 'warm-up', goal: '10 reply hữu ích + intro',
      startTrigger: 'Account tạo xong',
      endTrigger: '10 bài hữu ích VÀ 7+ ngày',
      cadence: '3-5 reply/ngày',
      tone: 'Ấm áp, hữu ích, beginner-friendly. English rõ ràng.',
      doMd: '- Reply "please read my chart" với 3-paragraph delineation\n- Thêm context transit khi liên quan\n- Engage thread synastry',
      dontMd: '- CHƯA link\n- KHÔNG self-promo\n- KHÔNG debate opinionated',
      estimatedPosts: 12 },
    { phase: 'value', goal: '30+ bài; được nhận diện là người giúp đỡ thường xuyên',
      startTrigger: 'Xong Warm-up',
      endTrigger: '30+ bài hữu ích',
      cadence: '3-5 reply/ngày + 1 own thread/tuần',
      tone: 'Expert hữu ích. Authority thân thiện.',
      doMd: '- Thread tutorial (Saturn return, transit, synastry walkthrough)\n- Series transit alert hàng tuần\n- Chart help có chiều sâu',
      dontMd: '- VẪN KHÔNG link tool trong post',
      estimatedPosts: 40 },
    { phase: 'bridge', goal: 'Post chart art watermarked; signature link đã active',
      startTrigger: '10+ post, signature link active theo rules forum',
      endTrigger: 'Signature drives clicks ổn định',
      cadence: '1 chart post/tuần + signature trên mọi post',
      tone: 'Giống Value.',
      doMd: '- Synastry/composite chart art post kèm breakdown\n- Watermark trên mọi chart image\n- Forum signature line: "Tools: astrolas.com"',
      dontMd: '- VẪN KHÔNG link trong body\n- KHÔNG signature copy giọng pitch',
      estimatedPosts: 16 },
    { phase: 'seed', goal: 'Soft tool recommendation trong tool-question thread',
      startTrigger: 'Bridge phase khoẻ',
      endTrigger: 'Nhiều mention tự nhiên được chấp nhận',
      cadence: '2-3 mention/tháng khi context phù hợp',
      tone: 'Helpful, list Astrolas cùng với alternatives.',
      doMd: '- "Is there a free X tool?" → recommend 2-3 incl Astrolas\n- KHÔNG BAO GIỜ dẫn đầu bằng Astrolas',
      dontMd: '- KHÔNG BAO GIỜ bash competitor\n- KHÔNG BAO GIỜ pitch khi không được hỏi',
      estimatedPosts: 8 },
    { phase: 'direct', goal: 'Feature highlight post khi có major release',
      startTrigger: '3+ tháng presence + lịch sử seed tích cực',
      endTrigger: 'Post có engagement',
      cadence: '1 lần per major feature',
      tone: '"I made X - here is how it works"',
      doMd: '- Post trong tools subforum nếu có\n- Demo screenshot + giải thích ngắn',
      dontMd: '- KHÔNG BAO GIỜ post vào main discussion area',
      estimatedPosts: 2 },
  ],

  lifestyle: [
    { phase: 'warm-up', goal: '5-7 bài cá nhân trong reply',
      startTrigger: 'Account tạo xong',
      endTrigger: '5+ reply VÀ 5 ngày',
      cadence: '5 lần/tuần reply',
      tone: 'Cá nhân, story-driven, conversational.',
      doMd: '- Reply kèm personal story + astrology insight\n- Acknowledge cảm xúc OP trước',
      dontMd: '- KHÔNG link\n- KHÔNG post thuần kỹ thuật khô khan',
      estimatedPosts: 7 },
    { phase: 'value', goal: 'Trở thành gương mặt quen thuộc trong thread relationship',
      startTrigger: 'Warm-up xong',
      endTrigger: '20+ story post hữu ích',
      cadence: '5 lần/tuần (reply + 1 own thread/tuần)',
      tone: 'Ấm áp, story-led, kỹ-thuật-dễ-tiếp-cận.',
      doMd: '- Thread personal-story-with-insight\n- Compatibility breakdown\n- Thread "Did anyone else…"',
      dontMd: '- KHÔNG post thuần kỹ thuật (không land trên ElsaElsa)',
      estimatedPosts: 30 },
    { phase: 'bridge', goal: 'Signature link + chart story posts',
      startTrigger: '4+ post, signature được phép',
      endTrigger: 'Signature clicks ổn định',
      cadence: '2 chart story post/tuần + signature',
      tone: 'Giọng warm story như trước.',
      doMd: '- Synastry/composite chart story kèm watermark\n- Forum signature link active',
      dontMd: '- KHÔNG promo language trong post',
      estimatedPosts: 16 },
    { phase: 'seed', goal: 'Soft tool mention trong tool-question thread',
      startTrigger: 'Bridge khoẻ',
      endTrigger: '5+ mention được chấp nhận',
      cadence: '2-3 mention/tháng',
      tone: 'Casual recommendation framing.',
      doMd: '- Framing "I rebuilt my chart in [tool] and noticed…" theo story\n- Chỉ mention khi được hỏi',
      dontMd: '- KHÔNG BAO GIỜ pitch',
      estimatedPosts: 6 },
    { phase: 'direct', goal: 'Promo post hiếm',
      startTrigger: '3+ tháng + cộng đồng goodwill',
      endTrigger: 'Post sống được',
      cadence: '1 lần hiếm',
      tone: 'Personal launch story.',
      doMd: '- "Đây là cái tôi build - nghĩ mọi người sẽ thích"',
      dontMd: '- KHÔNG BAO GIỜ pitchy',
      estimatedPosts: 1 },
  ],

  eastern: [
    { phase: 'warm-up', goal: 'Cross-tradition intro + 5 bài engagement khiêm tốn',
      startTrigger: 'Account tạo với handle native theo locale',
      endTrigger: '5+ bài VÀ 14 ngày',
      cadence: '3 lần/tuần',
      tone: 'Tôn trọng truyền thống phương Đông trước. Đặt Western là bổ sung.',
      doMd: '- Intro: "học Tu Vi/Saju + tìm hiểu chiêm tinh phương Tây"\n- Reply trên thread Eastern với sự tôn trọng\n- Hỏi câu hỏi làm rõ',
      dontMd: '- KHÔNG framing "phương Tây hơn"\n- KHÔNG link\n- KHÔNG lên lớp',
      estimatedPosts: 7 },
    { phase: 'value', goal: 'Bridge content độc đáo của người học cross-tradition',
      startTrigger: 'Warm-up xong',
      endTrigger: '15+ bridge post',
      cadence: '2-3 post/tuần',
      tone: 'Scholar-bridge tone. So sánh, không giáo điều.',
      doMd: '- Nội dung mapping "Cung Mệnh ~ Ascendant"\n- Case study khi cả 2 hệ thống cùng dự báo 1 sự kiện\n- Tutorial: đọc chart phương Tây bằng vocabulary phương Đông',
      dontMd: '- KHÔNG nhắc tool',
      estimatedPosts: 20 },
    { phase: 'bridge', goal: 'Chart screenshot locale-native',
      startTrigger: 'Value phase xong',
      endTrigger: 'Locale showcase của Astrolas có thảo luận',
      cadence: '1 chart post/tuần',
      tone: 'Vẫn scholar-bridge.',
      doMd: '- Chart render theo locale (vi/zh/ko/ja)\n- Watermark astrolas.com\n- Comment theo locale về cách đọc',
      dontMd: '- KHÔNG link trong body',
      estimatedPosts: 12 },
    { phase: 'seed', goal: 'Soft tool mention theo góc hỗ trợ locale',
      startTrigger: 'Bridge khoẻ',
      endTrigger: 'Mention được chấp nhận',
      cadence: '1-2 mention/tháng',
      tone: 'Framing "công cụ hỗ trợ [locale]".',
      doMd: '- Định vị là tool friendly với locale\n- Chia sẻ với community như resource',
      dontMd: '- KHÔNG BAO GIỜ cạnh tranh với tool phương Đông',
      estimatedPosts: 4 },
    { phase: 'direct', goal: 'Locale launch announcement',
      startTrigger: '4+ tháng presence',
      endTrigger: 'Post sống được',
      cadence: '1 lần',
      tone: 'Framing đóng góp cho community.',
      doMd: '- "Tool nay đã hỗ trợ [locale]"',
      dontMd: '- KHÔNG BAO GIỜ promo aggressive',
      estimatedPosts: 1 },
  ],

  reddit: [
    { phase: 'warm-up', goal: '100+ comment karma + 30 ngày tuổi account',
      startTrigger: 'Account tạo xong',
      endTrigger: '100+ comment karma VÀ 30 ngày',
      cadence: '10 comment/ngày',
      tone: 'Hữu ích, casual giọng Reddit-native.',
      doMd: '- Comment vào top weekly thread với chart reading hữu ích\n- Reply vào post AskAstrologers\n- Build cross-sub karma ở community lân cận',
      dontMd: '- CHƯA tự post thread (sẽ bị auto-remove)\n- KHÔNG link trong comment',
      estimatedPosts: 60 },
    { phase: 'value', goal: 'Danh tiếng contributor hữu ích',
      startTrigger: '100+ karma + 30 ngày',
      endTrigger: '5+ own thread có engagement tích cực',
      cadence: '1-2 own thread/tuần + comment hàng ngày',
      tone: 'Reddit-native, dễ scan, hook ngay câu đầu.',
      doMd: '- Post giáo dục kiểu TIL\n- Thread transit hàng tuần (series lặp lại)\n- "I read 50 charts last month - patterns I noticed"',
      dontMd: '- KHÔNG link trong post (auto-flagged)\n- KHÔNG self-promo lộ liễu',
      estimatedPosts: 20 },
    { phase: 'bridge', goal: 'Post chart-art image đẹp',
      startTrigger: 'Value phase khoẻ',
      endTrigger: 'Image post lên r/all ổn định',
      cadence: '1 image/tuần',
      tone: 'Visual-led. Caption tối thiểu.',
      doMd: '- Chart render bằng Astrolas có watermark\n- Cross-post r/AstrologyChartShare\n- DM tên tool khi được hỏi',
      dontMd: '- KHÔNG link trong post body\n- KHÔNG pitch trong comment',
      estimatedPosts: 12 },
    { phase: 'seed', goal: '"I built this" post kiểu Devin; mod tolerate',
      startTrigger: 'Bridge phase + đã verify relationship với mod',
      endTrigger: '1 post "I built X" được chấp nhận',
      cadence: 'Tối đa 1 lần/tháng',
      tone: 'Devin Park: giọng data-engineer, không pitch.',
      doMd: '- Show feature qua screenshot\n- Thừa nhận alternative\n- Framing như side project',
      dontMd: '- KHÔNG BAO GIỜ cross-post seed sang nhiều sub trong cùng tuần',
      estimatedPosts: 3 },
    { phase: 'direct', goal: 'Post ở r/SideProject hoặc sub tangential',
      startTrigger: 'Reputation Reddit mạnh',
      endTrigger: 'Post direct được chấp nhận',
      cadence: 'Per major release',
      tone: 'Launch-day voice; show số liệu nếu có.',
      doMd: '- Post ở r/SideProject/r/InternetIsBeautiful\n- Kèm screenshot + tech stack',
      dontMd: '- KHÔNG BAO GIỜ post trực tiếp lên r/astrology',
      estimatedPosts: 2 },
  ],

  'reddit-strict': [
    { phase: 'warm-up', goal: 'Xây giọng scholar; 30+ comment scholar',
      startTrigger: 'Account tạo xong',
      endTrigger: '30+ comment giọng scholar VÀ 30 ngày',
      cadence: '3-5 comment có chiều sâu/ngày',
      tone: 'Hellenistic scholar. Greek terms OK. Trích dẫn primary sources.',
      doMd: '- Comment trên thread technique kèm citation primary-source\n- Engage với content của mods',
      dontMd: '- KHÔNG link\n- KHÔNG giọng Reddit-meme',
      estimatedPosts: 30 },
    { phase: 'value', goal: 'Được công nhận là contributor scholar',
      startTrigger: 'Warm-up xong',
      endTrigger: '10+ scholar thread có engagement tích cực',
      cadence: '1 thread/tuần + comment',
      tone: 'Uy tín, dày citation.',
      doMd: '- Paper technique Profections / Hellenistic\n- Tranh luận bản dịch (Schmidt vs Hand)',
      dontMd: '- KHÔNG giọng casual\n- KHÔNG nhắc tool',
      estimatedPosts: 12 },
    { phase: 'bridge', goal: 'Chart visualization style Hellenistic',
      startTrigger: 'Value phase mạnh',
      endTrigger: 'Mod không remove image post',
      cadence: '1 chart post/tháng',
      tone: 'Scholar visual.',
      doMd: '- Whole-sign chart kèm glyph Hellenistic\n- Watermarked',
      dontMd: '- KHÔNG link trong body',
      estimatedPosts: 3 },
    { phase: 'seed', goal: 'Tool announcement với feature Hellenistic-specific',
      startTrigger: '50+ scholar post',
      endTrigger: 'Announcement được chấp nhận',
      cadence: '1 lần hiếm',
      tone: '"I built X for whole-sign + profections, looking for testers"',
      doMd: '- Chỉ highlight feature Hellenistic-specific',
      dontMd: '- KHÔNG BAO GIỜ pitch feature chung chung',
      estimatedPosts: 1 },
    { phase: 'direct', goal: 'Không khuyến nghị cho subreddit này',
      startTrigger: 'Không bao giờ trigger mặc định',
      endTrigger: '-',
      cadence: '-',
      tone: '-',
      doMd: '- Bỏ qua phase này. Sub scholarly strict không reward promo.',
      dontMd: '- KHÔNG BAO GIỜ post direct trong sub này.',
      estimatedPosts: 0 },
  ],

  'fb-group': [
    { phase: 'warm-up', goal: 'Admin nhận diện contributor; 10+ engagement',
      startTrigger: 'Vào group + DM admin nếu rules yêu cầu',
      endTrigger: '10+ comment trên post của người khác',
      cadence: '10 reaction/comment per group',
      tone: 'Thân thiện, ngắn gọn, mobile-feed-native.',
      doMd: '- Engage trên post group có sẵn\n- React rộng rãi\n- Comment khi mang thêm giá trị',
      dontMd: '- CHƯA tự post (admin ban kẻ spam tần suất)\n- KHÔNG promo language',
      estimatedPosts: 10 },
    { phase: 'value', goal: 'Series content lặp lại trong group',
      startTrigger: 'Warm-up xong + admin OK nếu được hỏi',
      endTrigger: '15+ own post có engagement',
      cadence: 'Tối đa 3 post/tuần',
      tone: 'Dễ scan, image-led.',
      doMd: '- Single-card infographic\n- Trò chơi engagement ("guess the celebrity chart")\n- Reel 30s giải thích 1 technique\n- Post poll',
      dontMd: '- KHÔNG link trong body trừ khi admin cho phép\n- KHÔNG spam tần suất',
      estimatedPosts: 18 },
    { phase: 'bridge', goal: 'Reel demo screen recording tool',
      startTrigger: 'Admin cho phép promo content',
      endTrigger: '5+ Reel demo đã post',
      cadence: '1 Reel/tuần',
      tone: 'Casual screen-rec voiceover.',
      doMd: '- Reel demo Astrolas "Reading my chart in 60 seconds"\n- Watermark trong video',
      dontMd: '- KHÔNG CTA giọng pitch',
      estimatedPosts: 8 },
    { phase: 'seed', goal: 'Comment-pitch trong thread câu hỏi',
      startTrigger: 'Bridge khoẻ',
      endTrigger: 'Mention được chấp nhận',
      cadence: '2-3 mention/tháng',
      tone: 'Framing "I use [tool], shareable".',
      doMd: '- Reply thread "best tool?" với Astrolas + alts',
      dontMd: '- KHÔNG BAO GIỜ pitch trong comment post của chính mình',
      estimatedPosts: 8 },
    { phase: 'direct', goal: 'Launch post (cần admin permission)',
      startTrigger: 'DM admin approval',
      endTrigger: 'Post sống',
      cadence: '1 lần hiếm',
      tone: 'Casual launch.',
      doMd: '- 1 launch post duy nhất với admin permission',
      dontMd: '- KHÔNG BAO GIỜ post mà không có admin permission',
      estimatedPosts: 1 },
  ],

  discord: [
    { phase: 'warm-up', goal: '50+ message hữu ích trong #natal-help và tương tự',
      startTrigger: 'Đã join server + được assign role',
      endTrigger: '50+ message hữu ích',
      cadence: '3-5 message/ngày',
      tone: 'Real-time chat, concise, micro-help.',
      doMd: '- Reply vào chart drop trong #natal-help\n- Daily transit ping trong #transits\n- Engage trong #off-topic khi tự nhiên',
      dontMd: '- KHÔNG spam tin nhắn low-effort\n- KHÔNG link',
      estimatedPosts: 50 },
    { phase: 'value', goal: 'AMA / office hours định kỳ',
      startTrigger: 'Warm-up xong; được nhận diện là helper',
      endTrigger: 'Series AMA đã thiết lập',
      cadence: 'Hiện diện hàng ngày + AMA hàng tuần',
      tone: 'Helper ấm áp.',
      doMd: '- AMA 15 phút free chart reading hàng tuần\n- Drive DM',
      dontMd: '- KHÔNG promo trong AMA',
      estimatedPosts: 20 },
    { phase: 'bridge', goal: 'Tool review trong #resources/#tools (cần admin OK)',
      startTrigger: 'Admin permission',
      endTrigger: 'Review post sống được',
      cadence: '1 lần per server',
      tone: 'Review trung thực.',
      doMd: '- Post trong #tools/#resources với admin OK\n- Thừa nhận alternative',
      dontMd: '- KHÔNG BAO GIỜ spam channel khác',
      estimatedPosts: 1 },
    { phase: 'seed', goal: 'Trả lời DM hỏi về tool',
      startTrigger: 'Bridge xong',
      endTrigger: 'Có flow DM active',
      cadence: 'On demand',
      tone: 'Hữu ích.',
      doMd: '- Trả lời DM hỏi về tool',
      dontMd: '- KHÔNG BAO GIỜ DM-pitch khi không được hỏi',
      estimatedPosts: 0 },
    { phase: 'direct', goal: 'Discord bot integration (dài hạn)',
      startTrigger: 'Astrolas build bot chart',
      endTrigger: 'Bot được install',
      cadence: '-',
      tone: 'Framing tiện ích.',
      doMd: '- Offer bot như utility cho cộng đồng',
      dontMd: '- KHÔNG BAO GIỜ làm mà không có server owner OK',
      estimatedPosts: 0 },
  ],

  generic: [
    { phase: 'warm-up', goal: 'Build profile cơ bản + 10 engagement',
      startTrigger: 'Account tạo xong',
      endTrigger: '10 engagement VÀ 7 ngày',
      cadence: 'Hàng ngày',
      tone: 'Hữu ích, trung tính.',
      doMd: '- Engage với content của người khác\n- Build profile',
      dontMd: '- KHÔNG link',
      estimatedPosts: 10 },
    { phase: 'value', goal: 'Trở thành contributor',
      startTrigger: 'Warm-up xong',
      endTrigger: '20 bài hữu ích',
      cadence: '3 lần/tuần',
      tone: 'Expert hữu ích.',
      doMd: '- Chia sẻ kiến thức\n- Giúp người khác',
      dontMd: '- KHÔNG promo',
      estimatedPosts: 20 },
    { phase: 'bridge', goal: 'Watermark image / signature link',
      startTrigger: 'Value phase xong',
      endTrigger: 'Có traction',
      cadence: 'Hàng tuần',
      tone: 'Giống Value.',
      doMd: '- Visual watermarked\n- Signature link nếu được phép',
      dontMd: '- KHÔNG link trong body',
      estimatedPosts: 10 },
    { phase: 'seed', goal: 'Soft mention',
      startTrigger: 'Bridge xong',
      endTrigger: 'Mention được chấp nhận',
      cadence: 'Hàng tháng',
      tone: 'Casual.',
      doMd: '- Mention trong context',
      dontMd: '- KHÔNG BAO GIỜ pitch',
      estimatedPosts: 4 },
    { phase: 'direct', goal: 'Quảng bá rõ ràng',
      startTrigger: 'Lịch sử lâu',
      endTrigger: 'Post được chấp nhận',
      cadence: '1 lần hiếm',
      tone: 'Framing launch.',
      doMd: '- 1 post giải thích tool',
      dontMd: '- KHÔNG BAO GIỜ lặp lại',
      estimatedPosts: 1 },
  ],
};

// Narrative DNA per archetype - storytelling framework: arc, voice,
// hook patterns, ending style. Single markdown block, user customizes.
const NARRATIVE_TEMPLATES: Record<Archetype, string> = {
  scholarly: `**Vòng cung**: luận điểm → dẫn chứng → phản chứng → tổng hợp
**Giọng**: scholar trích dẫn primary source, không bao giờ tự suy ngôi thứ nhất
**Hook mở bài**: "Reading X (năm Y), tôi nhận thấy…" / "Hand dịch chỗ này là Z, nhưng Schmidt…"
**Climax**: 1 worked example hoặc so sánh bản dịch
**Kết**: "Câu hỏi mở:" + mời collaboration
**Tránh**: ngôn ngữ cảm xúc, slang hiện đại, từ hype, em dash`,

  mainstream: `**Vòng cung**: nỗi đau → chẩn đoán → 3 bước → 1 transit cần để mắt
**Giọng**: helper ấm áp, expert nhưng không trịch thượng
**Hook mở bài**: "Tôi đọc 50 chart tháng trước và nhận thấy Y" / "Khi Saturn vào 7th house, đây là cái thay đổi"
**Climax**: 1 observation cụ thể có thể action
**Kết**: "Trải nghiệm của bạn thế nào?" - mời reply theo story
**Hook pattern**: TIL · listicle · weekly transit alert · "nếu bạn có placement X"`,

  lifestyle: `**Vòng cung**: khoảnh khắc cá nhân → góc astrology → cảm giác phổ quát
**Giọng**: bạn bè kể chuyện bên ly cà phê
**Hook mở bài**: "Tôi nhận thấy partner Venus-Mars cứ xuất hiện trong Mars retro" / "Saturn return của tôi bắt đầu đúng lúc…"
**Climax**: khúc cảm xúc chuyển biến, không phải chi tiết kỹ thuật
**Kết**: câu hỏi mời chia sẻ câu chuyện
**Tránh**: post kỹ thuật khô (không land ở ElsaElsa)`,

  eastern: `**Vòng cung**: tham chiếu truyền thống phương Đông → song hành phương Tây → insight bắc cầu
**Giọng**: học trò tôn trọng cả 2 hệ thống, không Western-superior
**Hook mở bài**: "Cung Mệnh trong Tử Vi tương đương Ascendant theo cách…" / "Khi Saju nói X, natal chart cũng cho dấu hiệu Y"
**Climax**: case study mà cả 2 hệ thống cùng dự báo
**Kết**: mời thảo luận cross-tradition
**Tránh**: hạ thấp truyền thống phương Đông, dùng jargon English không dịch`,

  reddit: `**Vòng cung**: hook 1 câu → context → payoff → CTA-kèm-câu-hỏi
**Giọng**: Reddit-native, dễ scan, không fluff
**Hook mở bài**: "TIL [Hellenistic technique] dự báo X tốt hơn aspect hiện đại" / "Sun sign astrology là junk food tâm lý. Vì sao…"
**Climax**: fact contrarian hoặc thú vị
**Kết**: "Bạn nghĩ sao?" / "Có ai khác thấy thế không?"
**Hook pattern**: TIL · contrarian · meta · "I built X" (giọng Devin) · weekly transit megathread`,

  'reddit-strict': `**Vòng cung**: câu hỏi scholar → trích dẫn primary source → phân tích so sánh → mời peer review
**Giọng**: Hellenistic scholar, Greek terms OK, không Reddit-meme
**Hook mở bài**: "Có ai test [technique] với [biographical timeline] chưa?" / "Bản dịch Schmidt khác Hand ở đoạn này…"
**Climax**: 1 insight kỹ thuật không hiển nhiên
**Kết**: "Curious về takes của practitioner khác"
**Tránh**: emoji, hype, "based on my analysis" (giọng AI)`,

  'fb-group': `**Vòng cung**: hook image → 1 dòng teaser → reveal trong comment
**Giọng**: friendly, mobile-feed-native, image-led
**Hook mở bài**: "Đoán celebrity từ chart này 👀" / "5 placement chỉ writer's block"
**Climax**: payoff visual hoặc list tự nó
**Kết**: "Tag a friend who has this!" / "Drop rising của bạn ở comment"
**Hook pattern**: carousel infographic · guess-the-celebrity · Reel 30s · poll`,

  discord: `**Vòng cung**: micro-help trong chat, không cần story arc cho message hàng ngày
**Giọng**: helper ấm áp, real-time, concise
**Hook mở bài cho AMA thread**: "Office hours mở - drop chart để đọc 15 phút free"
**Hàng ngày**: trả lời chart drop trong #natal-help bằng 2-3 câu delineation
**Tránh**: wall of text trong channel chat, link-spam`,

  generic: `**Vòng cung**: hook → context → insight → mời tham gia
**Giọng**: hữu ích, friendly, dễ scan
**Hook mở bài**: tuỳ platform - adapt scholarly/lifestyle/mainstream ở trên
**Kết**: câu hỏi mời engagement`,
};

// Find the entry for a given phase in a plan; returns null if missing.
export function findPhaseEntry(plan: PhaseEntry[], phase: Phase): PhaseEntry | null {
  return plan.find((p) => p.phase === phase) ?? null;
}

// Order plan entries canonically (planned phases first, in canonical order).
export function sortPlan(plan: PhaseEntry[]): PhaseEntry[] {
  const order = new Map(PLANNED_PHASES.map((p, i) => [p, i] as const));
  return [...plan].sort((a, b) => (order.get(a.phase) ?? 99) - (order.get(b.phase) ?? 99));
}
