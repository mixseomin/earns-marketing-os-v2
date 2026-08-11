// task-type — canonical TAXONOMY for /plays cards: archetype (drawer skeleton) + produce-format
// (production sub-tools) + a distinct ICON per leaf type so every surface (calendar pill · list ·
// drawer header · filter) distinguishes types at a glance. YDNI: the SHAPE distinguishes the type;
// COLOUR is reserved for status. Detection is conservative — an explicit prep_payload.archetype/
// format always wins; otherwise we fall back to the proven taskKind() router + light keyword hints,
// so existing backlink/seed/email/build cards keep their current drawer. See task-kind.ts.
import { taskKind, isEmailSend } from './task-kind';

// ── Archetype = the drawer skeleton (what work order this card is) ──
export type Archetype =
  | 'backlink' | 'seed' | 'email-send' | 'email-pitch'   // distribution (place / seed / send / pitch)
  | 'produce'                                            // create a deliverable (format decides the tools)
  | 'publish' | 'account' | 'research' | 'review';       // ship-to-store · account setup/warm · research→decision · QA

// ── Produce format = which production tools the `produce` skeleton surfaces ──
export type ProduceFormat =
  | 'article' | 'video' | 'image' | 'post' | 'audio'
  | 'carousel' | 'pdf' | 'landing' | 'dataset' | 'course'
  | 'build';   // generic / multi-step product (fallback)

// Leaf key used for the icon + label (an archetype, OR a produce-format when archetype==='produce').
export type TaskTypeKey = Exclude<Archetype, 'produce'> | ProduceFormat | 'product';

export type TypeGroup = 'distribution' | 'produce' | 'ops';
export interface TypeMeta { label: string; glyph: string; group: TypeGroup }

// One distinct glyph per leaf type (glyph names resolve in ui/type-glyph). 'product' = the batch/lô container.
export const TYPE_META: Record<TaskTypeKey, TypeMeta> = {
  // distribution
  backlink:      { label: 'Backlink',    glyph: 'link',        group: 'distribution' },
  seed:          { label: 'Seed',        glyph: 'sprout',      group: 'distribution' },
  'email-send':  { label: 'Email blast', glyph: 'mail',        group: 'distribution' },
  'email-pitch': { label: 'Email pitch', glyph: 'send',        group: 'distribution' },
  publish:       { label: 'Publish',     glyph: 'rocket',      group: 'distribution' },
  // produce (formats)
  article:       { label: 'Bài viết',    glyph: 'docpen',      group: 'produce' },
  video:         { label: 'Video',       glyph: 'film',        group: 'produce' },
  image:         { label: 'Ảnh',         glyph: 'image',       group: 'produce' },
  post:          { label: 'Post',        glyph: 'chat',        group: 'produce' },
  audio:         { label: 'Audio',       glyph: 'mic',         group: 'produce' },
  carousel:      { label: 'Carousel',    glyph: 'layers',      group: 'produce' },
  pdf:           { label: 'PDF/Magnet',  glyph: 'filedoc',     group: 'produce' },
  landing:       { label: 'Landing',     glyph: 'window',      group: 'produce' },
  dataset:       { label: 'Dataset/Tool',glyph: 'grid',        group: 'produce' },
  course:        { label: 'Course',      glyph: 'cap',         group: 'produce' },
  build:         { label: 'Build',       glyph: 'brief',       group: 'produce' },
  // ops
  account:       { label: 'Account',     glyph: 'user',        group: 'ops' },
  research:      { label: 'Research',    glyph: 'scope',       group: 'ops' },
  review:        { label: 'Review',      glyph: 'badgecheck',  group: 'ops' },
  // batch container (a product = many cards)
  product:       { label: 'Sản phẩm',    glyph: 'book',        group: 'produce' },
};

// Fields the detectors read (same shape taskKind takes + explicit overrides + free text).
export interface TaskTypeInput {
  title?: string | null;
  mechanism?: string | null;
  communitySeed?: boolean;
  product?: boolean | string | null;
  instructions?: string | null;
  archetype?: string | null;      // prep_payload.archetype — explicit override (wins)
  format?: string | null;         // prep_payload.format — explicit produce-format (wins)
}

const has = (re: RegExp, ...s: (string | null | undefined)[]) => re.test(s.filter(Boolean).join(' '));

// STRONG keyword hints for the NEW archetypes — only fire on clear signals so existing
// backlink/seed/email/build cards are never mis-routed (default stays the proven taskKind path).
const isPublish  = (t: TaskTypeInput) => has(/\b(publish|listing|xuất bản|đăng bán|submit (to|your) (store|gumroad|udemy|directory)|go[- ]?live|indexnow|niêm yết)\b/i, t.title, t.mechanism, t.instructions);
const isAccount  = (t: TaskTypeInput) => has(/\b(tạo (tài khoản|account)|đăng ký (tài khoản|account)|register account|warm[- ]?up|warm the account|verify (the )?account|xác minh tài khoản|2fa setup)\b/i, t.title, t.mechanism, t.instructions);
// "đo nhu cầu/demand/volume" là dạng nghiên cứu hay gặp nhất ở đây (yt-demand, keyword volume) mà
// bản cũ không bắt → card rơi nhầm sang làn việc và mất hút khi đóng sổ (dính card #372).
const isResearch = (t: TaskTypeInput) => has(/\b(nghiên cứu|research|keyword research|competitor|đối thủ|market viability|phân tích thị trường|site[- ]?flip|thẩm định|feasibility|đo (nhu cầu|demand|volume|thị trường)|khảo sát)\b/i, t.title, t.mechanism, t.instructions);
const isReview   = (t: TaskTypeInput) => has(/\b(duyệt (bài|draft)|review draft|qa\b|kiểm duyệt|resolve (bug|flag)|site audit|rà soát)\b/i, t.title, t.mechanism, t.instructions);

const ARCH = new Set<Archetype>(['backlink','seed','email-send','email-pitch','produce','publish','account','research','review']);

/** The drawer skeleton for a card. Explicit prep_payload.archetype wins; else proven router + hints. */
export function taskArchetype(t: TaskTypeInput): Archetype {
  if (t.archetype && ARCH.has(t.archetype as Archetype)) return t.archetype as Archetype;
  if (isEmailSend(t.title, t.mechanism)) return 'email-send';
  if (t.communitySeed) return 'seed';
  if (isPublish(t)) return 'publish';
  if (isAccount(t)) return 'account';
  if (isResearch(t)) return 'research';
  if (isReview(t)) return 'review';
  const k = taskKind(t);                 // build | email | seed | backlink
  if (k === 'email') return 'email-pitch';
  if (k === 'seed') return 'seed';
  if (k === 'build') return 'produce';
  return 'backlink';
}

const FMT = new Set<ProduceFormat>(['article','video','image','post','audio','carousel','pdf','landing','dataset','course','build']);

/** For a `produce` card, which production tools to surface. Explicit prep_payload.format wins. */
export function taskFormat(t: TaskTypeInput): ProduceFormat {
  if (t.format && FMT.has(t.format as ProduceFormat)) return t.format as ProduceFormat;
  const s = [t.title, t.mechanism, t.instructions].filter(Boolean).join(' ');
  if (/\b(video|clip|youtube|shorts|tiktok|reel|quay|ghi hình|lecture|screencast)\b/i.test(s)) return 'video';
  if (/\b(podcast|audio|voice[- ]?over|narrat|thu âm|lồng tiếng|giọng đọc)\b/i.test(s)) return 'audio';
  if (/\b(carousel|slide deck|multi[- ]?slide|nhiều slide)\b/i.test(s)) return 'carousel';
  if (/\b(course|khoá học|lecture series|udemy)\b/i.test(s)) return 'course';
  if (/\b(cover|thumbnail|infographic|\bpin\b|banner|bìa|ảnh|image|graphic|og image)\b/i.test(s)) return 'image';
  if (/\b(pdf|ebook|cheatsheet|lead[- ]?magnet|template pack|guide pdf|zip)\b/i.test(s)) return 'pdf';
  if (/\b(landing|landing page|tool page|trang công cụ|web page|pSEO|programmatic page)\b/i.test(s)) return 'landing';
  if (/\b(dataset|calculator|tool build|data set|bộ dữ liệu|feature build)\b/i.test(s)) return 'dataset';
  if (/\b(thread|tweet|reddit|forum post|social post|đăng bài|caption|comment)\b/i.test(s)) return 'post';
  if (/\b(bài viết|article|blog|guide|rulebook|manuscript|write[- ]?up|essay|long[- ]?form)\b/i.test(s)) return 'article';
  return 'build';
}

/** The leaf type key (for icon + label): the archetype, or the produce-format when producing. */
export function taskTypeKey(t: TaskTypeInput): TaskTypeKey {
  const a = taskArchetype(t);
  return a === 'produce' ? taskFormat(t) : a;
}

// ── Per-type drawer layout (YDNI) ──────────────────────────────────────────────
// Each task type surfaces a curated section set: 'primary' = open/inline (the hero
// work), 'advanced' = collapsed behind one click, 'hidden' = not this type's job.
// This is the SINGLE source of truth for "what does a <type> drawer look like" —
// the drawer reads it instead of ad-hoc isBuild/isEmailSend booleans, so a produce
// card never leaks the Account/verify sections a backlink card needs. Sections not
// listed here (source+steps, assign, status, handover, feedback, footer, schedule)
// are universal to every drawer. Availability still applies (e.g. paste kit only
// shows when the project HAS kit copy) — policy just says where it belongs.
export type SectionVis = 'primary' | 'advanced' | 'hidden';
export type DrawerSection = 'account' | 'stack' | 'pasteKit' | 'draft' | 'aiContent' | 'media' | 'linkResult';
export type SectionPolicy = Record<DrawerSection, SectionVis>;

const BASE: Record<Archetype, SectionPolicy> = {
  backlink:      { account: 'primary', stack: 'advanced', pasteKit: 'advanced', draft: 'advanced', aiContent: 'advanced', media: 'advanced', linkResult: 'primary' },
  seed:          { account: 'primary', stack: 'hidden',   pasteKit: 'advanced', draft: 'primary',  aiContent: 'advanced', media: 'advanced', linkResult: 'primary' },
  'email-send':  { account: 'hidden',  stack: 'hidden',   pasteKit: 'hidden',   draft: 'hidden',   aiContent: 'hidden',   media: 'hidden',   linkResult: 'primary' },
  'email-pitch': { account: 'primary', stack: 'hidden',   pasteKit: 'advanced', draft: 'hidden',   aiContent: 'primary',  media: 'hidden',   linkResult: 'advanced' },
  produce:       { account: 'hidden',  stack: 'hidden',   pasteKit: 'advanced', draft: 'advanced', aiContent: 'advanced', media: 'advanced', linkResult: 'primary' },
  publish:       { account: 'primary', stack: 'advanced', pasteKit: 'advanced', draft: 'hidden',   aiContent: 'advanced', media: 'advanced', linkResult: 'primary' },
  account:       { account: 'primary', stack: 'hidden',   pasteKit: 'hidden',   draft: 'hidden',   aiContent: 'hidden',   media: 'hidden',   linkResult: 'hidden' },
  research:      { account: 'hidden',  stack: 'hidden',   pasteKit: 'hidden',   draft: 'hidden',   aiContent: 'advanced', media: 'hidden',   linkResult: 'hidden' },
  review:        { account: 'hidden',  stack: 'hidden',   pasteKit: 'hidden',   draft: 'advanced', aiContent: 'hidden',   media: 'hidden',   linkResult: 'hidden' },
};

/** The drawer section layout for a card. produce-format refines the deliverable tools. */
export function taskSectionPolicy(t: TaskTypeInput): SectionPolicy {
  const arch = taskArchetype(t);
  const pol: SectionPolicy = { ...BASE[arch] };
  if (arch !== 'produce') return pol;
  // Promote the format's hero tool; hide tools that format never uses.
  const fmt = taskFormat(t);
  if (fmt === 'image')                          { pol.media = 'primary'; pol.draft = 'hidden'; pol.aiContent = 'hidden'; }
  else if (fmt === 'article' || fmt === 'post') { pol.draft = 'primary'; pol.aiContent = 'primary'; }
  else if (fmt === 'video')                     { pol.media = 'primary'; pol.aiContent = 'primary'; }   // thumbnail + script
  else if (fmt === 'carousel')                  { pol.media = 'primary'; }
  // ponytail: video/audio/pdf/landing/dataset/course/build inherit produce defaults
  //           (all deliverable tools collapsed). Give a format its own hero tool here
  //           when a dedicated studio (video render, carousel builder) lands — Phase B.
  return pol;
}
