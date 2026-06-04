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
  'one-sentence', 'two-three', 'spoken', 'typos', 'abbrev', 'lowercase',
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
      return `- TYPO: cố ý để ${typoCount(intensity)} lỗi gõ NHẸ vẫn đọc hiểu được (vd thiếu/đảo chữ "teh", "adn", thiếu 1 ký tự, double space). TUYỆT ĐỐI không đặt typo trong link, @handle, con số, hay tên riêng.`;
    case 'abbrev': {
      const pack = abbrevPack(targetLang);
      return `- VIẾT TẮT BẢN ĐỊA: chèn TỰ NHIÊN ${abbrevCount(intensity)} viết tắt theo ngôn ngữ community (vd: ${pack.join(', ')}). Đặt đúng chỗ người bản xứ hay dùng, không nhồi.`;
    }
    case 'lowercase':
      return '- LOWERCASE: viết thường toàn bộ, KHÔNG viết hoa đầu câu (trừ "I" trong tiếng Anh nếu thấy tự nhiên). Tell casual của Reddit/Discord.';
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
  return [
    '',
    '═══════════════════════════════════════════════════════════',
    `🧬 HUMAN AUTHENTICITY (HIGH PRIORITY) — làm bodyTarget giống NGƯỜI THẬT đăng (mức: ${intensity})`,
    'CHỈ áp dụng cho bodyTarget (bản đăng thật). bodyReview giữ tiếng Việt CHUẨN — KHÔNG áp các rule dưới.',
    'MINDSET: viết như 1 thành viên forum THẬT đang lướt thấy thread này và buột miệng phản ứng — ngắn, có cảm xúc/quan điểm, đậm chất cá nhân. KHÔNG phải thông cáo báo chí, KHÔNG phải bài luận cân bằng, KHÔNG tóm tắt lại nội dung gốc. Ví dụ giọng thật: "all the protections will prob be bullshit that doesnt stop deepfakes lol", "that line about AI agents for students has me raising eyebrows i didnt know i had", "the fact that this guy was the best we could do...".',
    ...lines,
    'RÀNG BUỘC CHUNG:',
    '- KHÔNG dùng em dash "—", luôn dùng "-" (human-voice rule).',
    '- Vẫn phải đọc hiểu + đúng ý; "messy" có chủ đích, đừng phá nội dung.',
    '- Đây là tín hiệu giả-người ƯU TIÊN CAO: nếu xung đột với rule "văn phong chuẩn" ở trên, ưu tiên block này cho bodyTarget.',
    ...(lenEnforce ? [lenEnforce] : []),
    '═══════════════════════════════════════════════════════════',
    '',
  ].join('\n');
}
