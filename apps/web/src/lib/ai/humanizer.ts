// Human authenticity layer — biến output AI thành "giống người thật đăng".
// Bộ knob bật/tắt (chip ở ext composer) → 1 block prompt inject vào buildDraftPrompt
// (và append best-effort cho astrolas-answer). CHỈ áp cho bodyTarget (bản đăng thật);
// bodyReview (tiếng Việt review) luôn giữ CHUẨN. Viết tắt theo NGÔN NGỮ community
// (targetLang), không phải tiếng Việt. Tôn trọng human-voice skill (KHÔNG em dash).

export type HumanizerIntensity = 'light' | 'medium' | 'heavy';

export interface HumanizerOpts {
  knobs: string[];               // các key đang bật (xem HUMANIZER_KEYS)
  intensity?: HumanizerIntensity;
}

// Key canonical — ext gửi đúng các key này. Label để UI ext tự render (ext hardcode).
export const HUMANIZER_KEYS = [
  // STANCE/VOICE (cái làm post "thật" nhất — quan trọng hơn typo bề mặt)
  'opinion', 'react-specific', 'no-corporate', 'profanity',
  // FORM (bề mặt)
  'one-sentence', 'two-three', 'spoken', 'typos', 'abbrev', 'lowercase', 'lazy-caps',
  'no-end-punct', 'humor', 'filler', 'reaction-first', 'mundane', 'emoji',
] as const;
export type HumanizerKey = typeof HUMANIZER_KEYS[number];

// Viết tắt casual phổ biến theo ngôn ngữ community (KHÁC tribe lexicon = jargon riêng).
// Fallback 'en'. Mở rộng dần khi thêm community ngôn ngữ mới.
const ABBREV_PACKS: Record<string, string[]> = {
  en: ['idk', 'tbh', 'ngl', 'imo', 'rn', 'lol', 'fwiw', 'iirc', 'smh', 'btw'],
  vi: ['ko', 'dc', 'đc', 'vs', 'mn', 'j', 'bt', 'cx', 'vl', 'thg'],
  es: ['xq', 'tb', 'pq', 'q', 'tmb', 'dnd', 'xfa'],
  pt: ['pq', 'vc', 'tbm', 'blz', 'mds', 'kkk'],
  fr: ['jsp', 'tkt', 'mdr', 'ptdr', 'bcp', 'dsl'],
  de: ['kp', 'vllt', 'eig', 'wmgl', 'lg'],
};
function abbrevPack(targetLang: string): string[] {
  const k = (targetLang || 'en').slice(0, 2).toLowerCase();
  return ABBREV_PACKS[k] ?? ABBREV_PACKS.en ?? [];
}

function typoCount(intensity: HumanizerIntensity): string {
  return intensity === 'light' ? '1-2' : intensity === 'heavy' ? '3-4' : '2-3';
}
function abbrevCount(intensity: HumanizerIntensity): string {
  return intensity === 'light' ? '2-3' : intensity === 'heavy' ? '4-5' : '3-4';
}

// Mỗi knob → 1 dòng chỉ thị. targetLang/intensity cho các knob cần.
function knobLine(key: string, targetLang: string, intensity: HumanizerIntensity): string | null {
  switch (key) {
    case 'opinion':
      return '- QUAN ĐIỂM RÕ: nêu lập trường THẬT (đồng tình / phản đối / hoài nghi / cà khịa). KHÔNG tóm tắt trung lập, KHÔNG cân bằng 2 phía kiểu báo chí. Người thật có ý kiến.';
    case 'react-specific':
      return '- BẮT 1 Ý: phản ứng vào 1 CHI TIẾT/câu cụ thể trong thread gốc (vd "that line about X has me raising eyebrows"), KHÔNG bao quát toàn chủ đề, KHÔNG nhắc lại nội dung gốc kiểu tóm tắt.';
    case 'no-corporate':
      return '- CẤM GIỌNG PR/MARKETING: tuyệt đối không "is a significant step", "ensures", "is essential", "plays a key role", "aims to", "comprehensive", "exciting initiative". Không khen sáo, không liệt kê lợi ích. Nói như 1 người bình thường, hoài nghi/critical cũng được.';
    case 'profanity':
      return '- CHỬI NHẸ/SLANG: OK dùng nếu cộng đồng vậy (bullshit, shit, damn, lol, ngl, kinda) — tự nhiên, không gượng, không quá đà.';
    case 'one-sentence':
      return '- ĐỘ DÀI (RULE CỨNG, ĐÈ MỌI hướng dẫn độ dài khác — voice/platform/reply rules): bodyTarget = ĐÚNG 1 CÂU, ≤ 30 từ. 1 mệnh đề duy nhất, KHÔNG xuống dòng, KHÔNG liệt kê, KHÔNG 2 câu, KHÔNG mở rồi giải thích thêm. Nếu lỡ viết dài hơn PHẢI rút lại còn 1 câu trước khi trả.';
    case 'two-three':
      return '- ĐỘ DÀI (RULE CỨNG, ĐÈ MỌI hướng dẫn độ dài khác): bodyTarget = 2-3 câu NGẮN, tổng ≤ 60 từ. KHÔNG đoạn văn, KHÔNG hơn 3 câu.';
    case 'spoken':
      return '- VĂN NÓI (không phải văn viết): dùng contraction, rút chủ ngữ ("watching this rn"), câu cụt, bắt đầu bằng "and/but/so" cũng được. Như gõ vội trên điện thoại.';
    case 'typos':
      return `- TYPO (BẮT BUỘC — KHÔNG được bỏ qua, KHÔNG "viết cho sạch"): gài ÍT NHẤT ${typoCount(intensity)} lỗi gõ NHẸ vẫn đọc hiểu: đảo 2 ký tự ("teh","adn","taht","wiht"), thiếu 1 ký tự ("realy","jus","abou"), nhân đôi ký tự ("reallly"), hoặc double space. Người gõ vội trên điện thoại LUÔN có lỗi — bản 0 lỗi = lộ AI ngay. TUYỆT ĐỐI không để typo trong link, @handle, #hashtag, con số, hay ticker viết hoa (ETH/BTC). Đây là yêu cầu CỨNG, không phải tuỳ chọn.`;
    case 'abbrev': {
      const pack = abbrevPack(targetLang);
      return `- VIẾT TẮT BẢN ĐỊA: chèn TỰ NHIÊN ${abbrevCount(intensity)} viết tắt theo ngôn ngữ community (vd: ${pack.join(', ')}). Đặt đúng chỗ người bản xứ hay dùng, không nhồi.`;
    }
    case 'lowercase':
      return '- LOWERCASE: viết thường toàn bộ, KHÔNG viết hoa đầu câu (trừ "I" trong tiếng Anh nếu thấy tự nhiên). Tell casual của Reddit/Discord.';
    case 'lazy-caps':
      return '- LƯỜI VIẾT HOA (NGẪU NHIÊN, KHÔNG đều): phần lớn vẫn hoa đầu câu bình thường, NHƯNG thỉnh thoảng (1-2 chỗ, KHÔNG mọi câu) quên hoa đầu câu sau dấu chấm, hoặc dùng "i" thường thay "I". Lỗi rải rác như gõ vội — KHÁC lowercase (thường toàn bộ).';
    case 'no-apostrophe':
      return '- BỎ DẤU NHÁY (casual): bỏ apostrophe trong contraction — "dont, cant, im, youre, its, thats, ive, dont" thay vì don\'t/can\'t/I\'m… Tự nhiên kiểu gõ nhanh.';
    case 'homophone':
      return '- LẪN ĐỒNG ÂM (thỉnh thoảng, 1 chỗ): lỗi người hay mắc — your↔you\'re, their↔there↔they\'re, its↔it\'s, to↔too, then↔than. Chỉ 1 chỗ, ko nhiều (vẫn đọc hiểu được).';
    case 'no-end-punct':
      return '- DẤU CÂU: bỏ dấu chấm ở câu cuối; có thể dùng "..." lửng hoặc "?!" thay cho dấu chuẩn.';
    case 'humor':
      return '- HÀI: thêm 1 nhịp đùa nhẹ / self-deprecating / dry sarcasm phù hợp ngữ cảnh. Không gượng, không pun rẻ tiền.';
    case 'filler':
      return '- FILLER/HEDGE: rải softener tự nhiên ("i guess", "kinda", "lowkey", "ngl", "or smth") như người thật do dự.';
    case 'reaction-first':
      return '- PHẢN ỨNG TRƯỚC: mở bằng phản ứng cảm xúc ngắn rồi mới vào nội dung ("oh man this is so real", "wait that\'s wild").';
    case 'mundane':
      return '- CHI TIẾT VU VƠ: cài 1 chi tiết đời thường + số lẻ KHÔNG tròn ("like 6-7 weeks", "on my 3rd coffee") để tăng độ thật.';
    case 'emoji':
      return '- EMOJI: tối đa 1 reaction emoji ở CUỐI (💀😭🙃 v.v.), không emoji trang trí giữa bài.';
    default:
      return null;
  }
}

// CẮT CỨNG độ dài sau gen — model (đb gpt-4o-mini) hay phớt lờ "1 câu" dù prompt
// ép. Đây là safety net deterministic: one-sentence → giữ 1 câu đầu; two-three →
// 3 câu đầu. CHỈ áp bodyTarget (bodyReview giữ đầy đủ để review). No-op nếu model
// đã tuân thủ (slice >= số câu hiện có).
// Số câu (xấp xỉ) — để quyết định có cần condense không.
export function sentenceCount(text: string): number {
  const t = (text || '').replace(/\s*\n+\s*/g, ' ').trim();
  if (!t) return 0;
  const parts = t.match(/.*?[.!?]+(?=\s|$)|.+$/g);
  return parts ? parts.length : 1;
}
// Số câu tối đa theo knob (0 = không giới hạn).
export function maxSentencesFor(opts: HumanizerOpts | null | undefined): number {
  if (!opts || !Array.isArray(opts.knobs)) return 0;
  return opts.knobs.includes('one-sentence') ? 1 : opts.knobs.includes('two-three') ? 3 : 0;
}

// Biến markdown / ký tự AI-tell → prose phẳng giống người gõ tay. Áp TRƯỚC injectTypos.
// human-voice skill: KHÔNG em dash, KHÔNG markdown (#/**/>/bullet/header), KHÔNG emoji-cấu-trúc.
// Người thật reply forum/Reddit KHÔNG bao giờ gõ "## Heading" hay "- bullet" hay "—".
export function stripAITells(s: string): string {
  return (s || '')
    .replace(/```[\s\S]*?```/g, ' ')                         // code fence
    .replace(/`([^`]+)`/g, '$1')                             // inline code
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')                      // # headers
    .replace(/^\s{0,3}>\s?/gm, '')                           // > blockquote
    .replace(/^\s*[-*+]\s+/gm, '')                           // - * + bullets
    .replace(/^\s*\d+[.)]\s+/gm, '')                         // 1. / 1) numbered
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')                      // --- *** hr
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')                     // **bold**
    .replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1$2$3')     // *italic*
    .replace(/(^|[^_])__([^_\n]+)__([^_]|$)/g, '$1$2$3')     // __bold__
    .replace(/[—–]/g, '-')                                   // em/en dash → hyphen
    .replace(/[ \t]*[❌✅⚠️📌🔴🟢▶️➡️➤»«•◦‣]️?[ \t]*/g, ' ')  // marker/bullet emoji cấu trúc (giữ emoji cảm xúc)
    .replace(/[ \t]{2,}/g, ' ')                              // double space
    .replace(/[ \t]+\n/g, '\n')                              // trailing space
    .replace(/\n{3,}/g, '\n\n')                              // 3+ newline
    .trim();
}

export function clampDraftLength(bodyTarget: string, opts: HumanizerOpts | null | undefined): string {
  if (!opts || !Array.isArray(opts.knobs)) return bodyTarget;
  const max = opts.knobs.includes('one-sentence') ? 1 : opts.knobs.includes('two-three') ? 3 : 0;
  if (max === 0) return bodyTarget;
  const t = (bodyTarget || '').replace(/\s*\n+\s*/g, ' ').trim();
  if (!t) return bodyTarget;
  // Tách câu: cụm tới khi gặp . ! ? (gồm "..."/"?!"), hoặc cụm cuối không dấu.
  const parts = t.match(/.*?[.!?]+(?=\s|$)|.+$/g);
  if (!parts || parts.length <= max) return t;
  return parts.slice(0, max).map((s) => s.trim()).join(' ').trim();
}

// Build block prompt từ opts. Trả '' nếu không bật knob nào.
export function buildHumanizerBlock(opts: HumanizerOpts | null | undefined, targetLang: string): string {
  if (!opts || !Array.isArray(opts.knobs) || opts.knobs.length === 0) return '';
  const intensity: HumanizerIntensity = opts.intensity || 'medium';
  const lines = opts.knobs.map((k) => knobLine(k, targetLang, intensity)).filter(Boolean) as string[];
  if (lines.length === 0) return '';
  // Enforce độ dài lần cuối (model hay phớt lờ 1-câu vì các length hint khác).
  const lenEnforce = opts.knobs.includes('one-sentence')
    ? '\n⛔ KIỂM TRA CUỐI: bodyTarget PHẢI đúng 1 câu ≤ 30 từ. Đếm lại — nếu >1 câu hoặc >30 từ, VIẾT LẠI ngắn hơn. Đây là rule không thể bỏ qua.'
    : opts.knobs.includes('two-three')
      ? '\n⛔ KIỂM TRA CUỐI: bodyTarget tối đa 3 câu, ≤ 60 từ. Nếu dài hơn, cắt bớt.'
      : '';
  const typoEnforce = opts.knobs.includes('typos')
    ? `\n⛔ KIỂM TRA CUỐI (TYPO): đếm lại bodyTarget — PHẢI có ít nhất ${typoCount(intensity)} lỗi gõ nhẹ. Nếu sạch lỗi, THÊM ngay (đảo/thiếu ký tự ở từ thường, KHÔNG ở link/@/#/số/ticker). Bản sạch quá = fail.`
    : '';
  return [
    '',
    '═══════════════════════════════════════════════════════════',
    `🧬 HUMAN AUTHENTICITY (HIGH PRIORITY) — làm bodyTarget giống NGƯỜI THẬT đăng (mức: ${intensity})`,
    'CHỈ áp dụng cho bodyTarget (bản đăng thật). bodyReview giữ tiếng Việt CHUẨN — KHÔNG áp các rule dưới.',
    'MINDSET: viết như 1 thành viên forum THẬT đang lướt thấy thread này và buột miệng phản ứng — ngắn, có cảm xúc/quan điểm, đậm chất cá nhân. KHÔNG phải thông cáo báo chí, KHÔNG phải bài luận cân bằng, KHÔNG tóm tắt lại nội dung gốc. Ví dụ giọng thật (GIỮ HOA chuẩn đầu câu + tên riêng — casual KHÔNG nghĩa là viết thường): "All the protections will prob be bullshit that doesnt stop deepfakes lol", "That line about AI agents for students has me raising eyebrows I didnt know I had", "The fact that this guy was the best we could do...".',
    ...lines,
    'RÀNG BUỘC CHUNG:',
    '- KHÔNG dùng em dash "—", luôn dùng "-" (human-voice rule).',
    // CHƯA bật lowercase/lazy-caps mà các knob casual (spoken/abbrev/no-apostrophe…) + ví dụ
    // giọng lowercase ở trên hay khiến model TỰ viết thường toàn bộ → ép giữ hoa chuẩn.
    ...((!opts.knobs.includes('lowercase') && !opts.knobs.includes('lazy-caps'))
      ? ['- VIẾT HOA CHUẨN (BẮT BUỘC): hoa chữ đầu câu + "I" (tiếng Anh) như bình thường. Casual/typo/viết tắt KHÔNG đồng nghĩa viết thường toàn bộ — CHƯA bật lowercase thì PHẢI giữ hoa chuẩn. Các ví dụ lowercase phía trên CHỈ minh hoạ giọng, KHÔNG phải bỏ viết hoa.']
      : []),
    '- Vẫn phải đọc hiểu + đúng ý; "messy" có chủ đích, đừng phá nội dung.',
    '- Đây là tín hiệu giả-người ƯU TIÊN CAO: nếu xung đột với rule "văn phong chuẩn" ở trên, ưu tiên block này cho bodyTarget.',
    ...(lenEnforce ? [lenEnforce] : []),
    ...(typoEnforce ? [typoEnforce] : []),
    '═══════════════════════════════════════════════════════════',
    '',
  ].join('\n');
}

// Post-process TYPO — lưới an toàn deterministic (model hay "viết sạch" dù prompt ép).
// CHỈ áp bodyTarget khi bật chip 'typos'. Gài typo NHẸ vào từ Latin thường (>=4 ký tự,
// ko ALLCAPS/ticker), TRÁNH link/@/#/số. Bỏ qua script CJK/non-Latin (typo khác cơ chế).
const TYPO_COMMON: Record<string, string> = {
  the: 'teh', and: 'adn', that: 'taht', with: 'wiht', just: 'jsut', what: 'waht',
  this: 'tihs', really: 'realy', because: 'becuase', people: 'poeple', your: 'youre',
  about: 'abuot', would: 'woud', their: 'thier', think: 'thikn', know: 'knwo',
};
function matchCase(src: string, dst: string): string {
  if (src === src.toUpperCase()) return dst.toUpperCase();
  if ((src[0] ?? '') === (src[0] ?? '').toUpperCase()) return (dst[0] ?? '').toUpperCase() + dst.slice(1);
  return dst;
}
function typoWord(w: string): string {
  const m = w.match(/^([^A-Za-z]*)([A-Za-z][A-Za-z'-]*[A-Za-z]|[A-Za-z])([^A-Za-z]*)$/);
  if (!m) return w;
  const pre = m[1] ?? '', core = m[2] ?? '', suf = m[3] ?? '';
  const lc = core.toLowerCase();
  if (TYPO_COMMON[lc]) return pre + matchCase(core, TYPO_COMMON[lc] as string) + suf;
  if (core.length < 4) return w;
  const i = 1 + Math.floor(Math.random() * (core.length - 2));   // tránh ký tự đầu/cuối
  const r = Math.random();
  let out: string;
  if (r < 0.45 && i < core.length - 1) out = core.slice(0, i) + core[i + 1] + core[i] + core.slice(i + 2); // đảo
  else if (r < 0.75) out = core.slice(0, i) + core.slice(i + 1);  // thiếu
  else out = core.slice(0, i + 1) + core[i] + core.slice(i + 1);  // nhân đôi
  return pre + out + suf;
}
export function injectTypos(text: string, opts: HumanizerOpts | null | undefined): string {
  if (!opts || !Array.isArray(opts.knobs) || !opts.knobs.includes('typos') || !text) return text;
  if (/[一-鿿぀-ヿ가-힯Ѐ-ӿ؀-ۿ฀-๿]/.test(text)) return text;   // CJK/non-Latin → bỏ qua
  const intensity = opts.intensity || 'medium';
  const target = intensity === 'light' ? 1 : intensity === 'heavy' ? 3 : 2;
  const toks = text.split(/(\s+)/);
  const eligible: number[] = [];
  toks.forEach((w, i) => {
    if (/^\s*$/.test(w) || /^(https?:|@|#)/.test(w) || /\d/.test(w)) return;
    const core = w.replace(/[^A-Za-z]/g, '');
    if (core.length < 4 || core === core.toUpperCase()) return;   // ngắn / ALLCAPS ticker
    eligible.push(i);
  });
  if (!eligible.length) return text;
  // đã có typo sẵn (model tuân thủ)? đếm thô từ common-misspell → giảm target
  let already = 0;
  for (const w of toks) { if (TYPO_COMMON[w.replace(/[^A-Za-z]/g, '').toLowerCase()]) already++; }
  const need = Math.max(0, Math.min(target - already, eligible.length));
  if (need === 0) return text;
  for (let k = eligible.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); const tmp = eligible[k]!; eligible[k] = eligible[j]!; eligible[j] = tmp; }
  eligible.slice(0, need).forEach((i) => { const tw = toks[i]; if (tw != null) toks[i] = typoWord(tw); });
  return toks.join('');
}

// Post-process LỖI NGƯỜI THẬT (lazy-caps / no-apostrophe / homophone). CHỈ bodyTarget,
// bỏ qua CJK. Deterministic (model hay tự "sửa sạch" nên ép bằng code).
const _CJK_RE = /[一-鿿぀-ヿ가-힯Ѐ-ӿ؀-ۿ฀-๿]/;
export function applyHumanErrors(text: string, opts: HumanizerOpts | null | undefined): string {
  if (!opts || !Array.isArray(opts.knobs) || !text || _CJK_RE.test(text)) return text;
  const has = (k: string) => opts.knobs.includes(k);
  let out = text;
  // BỎ DẤU NHÁY — người bỏ thì bỏ hết contraction (don't→dont, I'm→im, it's→its).
  if (has('no-apostrophe')) out = out.replace(/\b([A-Za-z]+)['’]([A-Za-z]+)\b/g, (_m, a, b) => a + b);
  // VIẾT HOA CHUẨN (DETERMINISTIC) — KHÔNG bật lowercase/lazy-caps thì ÉP hoa đầu câu + "I", kể cả
  // khi model lỡ viết thường TOÀN BỘ (knob casual spoken/abbrev/typos hay kéo gpt-4.1-mini xuống
  // lowercase dù prompt cấm). Không tin LLM. (Text đã hoa đúng → no-op.)
  if (!has('lowercase') && !has('lazy-caps')) {
    out = out
      .replace(/(^|[.!?]["')\]]?\s+)([a-z])/g, (_m, sep, ch) => sep + (ch as string).toUpperCase())   // hoa đầu câu
      .replace(/\bi\b/g, 'I')                                                                          // đại từ i → I
      .replace(/\bi(m|ve)\b/g, (m) => 'I' + m.slice(1));                                               // im/ive (sau bỏ-nháy) → Im/Ive
  }
  // LƯỜI HOA (ngẫu nhiên, ko đều) — chỉ khi KHÔNG bật lowercase.
  if (has('lazy-caps') && !has('lowercase')) {
    out = out.replace(/([.!?]["')\]]?\s+)([A-Z])/g, (m, sep, ch) => (Math.random() < 0.38 ? sep + (ch as string).toLowerCase() : m));
    out = out.replace(/\bI\b/g, (m) => (Math.random() < 0.25 ? 'i' : m));
    if (/^[A-Z]/.test(out) && Math.random() < 0.18) out = (out[0] ?? '').toLowerCase() + out.slice(1);
  }
  // LẪN ĐỒNG ÂM — 1 chỗ ngẫu nhiên (~45% có lỗi).
  if (has('homophone') && Math.random() < 0.45) {
    const swaps: Array<[RegExp, string]> = [
      [/\byou're\b/i, 'your'], [/\byour\b/, "you're"], [/\bthey're\b/i, 'their'],
      [/\btheir\b/, 'there'], [/\bit's\b/i, 'its'], [/\btoo\b/, 'to'], [/\bthen\b/, 'than'],
    ];
    for (const i of swaps.map((_, j) => j).sort(() => Math.random() - 0.5)) {
      const pair = swaps[i]; if (!pair) continue; const [re, rep] = pair;
      if (re.test(out)) { out = out.replace(re, (mm) => (mm[0] === (mm[0] ?? '').toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep)); break; }
    }
  }
  return out;
}
