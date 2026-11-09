// voice-score — chấm một đoạn văn tiếng Anh theo luật human-voice. Dùng cho MỌI nội dung AI viết
// trong hệ thống: draft backlink, comment, email outreach, mô tả sản phẩm.
//
// Vì sao là CODE chứ không phải một dòng trong prompt: prompt sinh draft ĐÃ dặn "no em dashes, no
// delve, no fluff" từ lâu, mà quét 18 draft thật trong human_tasks vẫn ra 4 cái trượt - 7 em dash
// cùng "myriad", "vital", "crucial" (2026-08-09). Model quên lời dặn; find-and-replace thì không.
// Lỗi nào tìm được bằng find thì đừng để người gác.
//
// Ba luật CỨNG (chặn duyệt): em dash · từ máy hay dùng · cụm dạo đầu. Ba cảnh báo MỀM (chỉ nhắc,
// người quyết): nhịp phẳng, rào đón dày, không có dữ kiện kiểm được - mấy cái này cần đọc mới biết
// đúng sai, chặn máy móc sẽ chặn nhầm bài tham khảo viết đúng kiểu.
//
// PURE, client-safe: drawer gọi để làm mờ nút Duyệt (nói lý do trước khi bấm), server gọi lại ở
// submitDraftReview để ext/API không lách. Cùng bộ luật với ~/bin/voice-score.mjs (bản CLI dùng
// ngoài repo và cho sách Write Like a Person) - sửa luật thì sửa cả hai.

const HEDGE = /\b(generally|typically|in most cases|may|might|could potentially|tends to|often|some experts|arguably|relatively|fairly|somewhat|various|several|potentially|essentially|virtually|approximately|roughly|around|nearly|up to)\b/gi;
const BANNED = /\b(delve|leverage|utilizes?|crucial|vital|comprehensive|robust|streamline|moreover|furthermore|seamless|cutting-edge|state-of-the-art|game-changer|ecosystem|foster|navigate|landscape|realm|myriad|plethora|tapestry|testament|underscore|pivotal|meticulous|unwavering|profound|resonate|embark|harness|unlock|elevate|curated|bespoke|holistic|paradigm|synergy)\b/gi;
const THROAT = /(it's worth noting|it is worth noting|it's important to note|it is important to note|it's important to understand|it is important to understand|when it comes to|in today's|at the end of the day|needless to say|in conclusion|to summarize|rest assured)/gi;
const CONTRACTION = /\b\w+'(s|t|re|ve|ll|d|m)\b/gi;
// Vệt NGƯỜI GÕ: contraction rụng dấu nháy, viết tắt, chữ thường đầu câu. Comment sạch bong 100%
// chính tả vừa bị máy chấm-AI bắt, vừa lạc giữa luồng người ta gõ vội trên điện thoại.
const HANDTYPED = /\b(dont|isnt|cant|wont|didnt|doesnt|wasnt|arent|thats|youre|theyre|ive|im|hes|shes|whats|gonna|kinda|til|tho|yeah|yep|nah|tbh|imo|fwiw|ngl|prob|def|w\/|&)\b/gi;
const NUMBER = /(\$\s?[\d,.]+|\b\d+(\.\d+)?\s?(percent|%)|\b(19|20)\d{2}\b|\b\d[\d,.]*\b)/g;
const PROPER = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+|[A-Z]{2,})\b/g;

const wordsOf = (t: string) => t.split(/\s+/).filter(Boolean).length;
const sentencesOf = (t: string) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 1);
const hits = (t: string, re: RegExp) => t.match(re) || [];
const uniq = (a: string[]) => [...new Set(a.map((x) => x.toLowerCase()))];

/** Bỏ code block, bảng, blockquote, URL — chấm phần VĂN, không chấm dữ liệu dán vào. */
export function prose(md: string): string {
  return (md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/^\s*\|.*$/gm, ' ')
    .replace(/^\s*>.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ');
}

export interface VoiceScore {
  words: number; sentences: number; spread: number;
  hedgesPer200: number; banned: string[]; throat: string[]; marked: number;
  checkablePer100: number; checkable: number; contractions: number; handTyped: number; capRate: number; emDashes: number;
  hard: string[]; soft: string[]; ok: boolean; human100: number;
}

export function voiceScore(raw: string, mode: 'post' | 'comment' = 'post'): VoiceScore {
  const t = prose(raw);
  const w = wordsOf(t);
  const lens = sentencesOf(t).map(wordsOf);
  const per = (n: number, base: number) => (w ? +(n / (w / base)).toFixed(1) : 0);
  const banned = uniq(hits(t, BANNED));
  const throat = uniq(hits(t, THROAT));
  const m = {
    words: w,
    sentences: lens.length,
    spread: lens.length ? Math.max(...lens) - Math.min(...lens) : 0,
    hedgesPer200: per(hits(t, HEDGE).length, 200),
    banned, throat,
    marked: banned.length + throat.length,
    checkablePer100: per(hits(t, NUMBER).length + hits(t, PROPER).length, 100),
    // Đếm TUYỆT ĐỐI, không theo mật độ: một comment 30 từ có mật độ cao nhưng vẫn có thể rỗng dữ
    // kiện. Chiều sâu ngách đo được ở đây — số tiền, mốc ngày, tên form (DD 1561), viết tắt nghề
    // (LES, BAH, TDY). Không có hai thứ đó thì câu nào cũng đúng cho mọi ngách, tức là chẳng của ai.
    checkable: hits(t, NUMBER).length + hits(t, PROPER).length,
    contractions: hits(t, CONTRACTION).length,
    handTyped: hits(t, HANDTYPED).length,
    // Bỏ hoa đầu câu KHÔNG phải vệt gõ tay — nó đọc ra nham nhở. Vệt đúng nghĩa là contraction
    // rụng dấu nháy và viết tắt; chữ hoa vẫn phải đa phần đúng thì mới ra giọng người gõ vội.
    capRate: (() => { const ss = sentencesOf(t); if (!ss.length) return 1;
      return +(ss.filter((x) => /^[A-Z0-9$"'(]/.test(x)).length / ss.length).toFixed(2); })(),
    emDashes: hits(t, /—|–/g).length,
  };
  const hard: string[] = [];
  const soft: string[] = [];
  if (m.emDashes) hard.push(`${m.emDashes} em dash (thay bằng " - ")`);
  if (banned.length) hard.push(`từ máy hay dùng: ${banned.slice(0, 6).join(', ')}`);
  if (throat.length) hard.push(`cụm dạo đầu: ${throat.slice(0, 3).join(', ')}`);
  // Ngưỡng mềm từ 60 từ: comment 60-100 từ đã đủ dài để lộ nhịp phẳng và giọng không-contraction,
  // đúng hai thứ máy chấm-AI bắt trước nhất. Mốc cũ 120 làm mọi comment lọt sạch không lời nhắc.
  if (m.words >= 60) {
    if (m.spread < 10) soft.push(`nhịp phẳng (câu dài nhất hơn ngắn nhất ${m.spread} từ)`);
    if (m.hedgesPer200 > 4) soft.push(`rào đón dày (${m.hedgesPer200}/200 từ)`);
    if (m.checkablePer100 < 1) soft.push(`gần như không có số/tên kiểm được (${m.checkablePer100}/100 từ)`);
    if (m.contractions === 0) soft.push('không một contraction nào (viết đủ chữ = giọng máy)');
  }
  // Comment cộng đồng chơi luật khác bài viết: quanh nó là câu một hai dòng. Đoạn 70 từ chỉn chu
  // đọc như thông cáo, người ta lướt qua và chủ trang thấy ngay là tài khoản đi rải nội dung.
  if (mode === 'comment') {
    if (m.words > 70) hard.push(`dài ${m.words} từ — comment quá 70 từ đọc như thông cáo`);
    else if (m.words > 45) soft.push(`hơi dài (${m.words} từ, nên dưới 45)`);
    if (m.handTyped === 0) soft.push('không vệt gõ tay nào — sạch quá thành giọng máy');
    if (m.capRate < 0.6) soft.push(`${Math.round((1 - m.capRate) * 100)}% câu không viết hoa đầu — nham nhở`);
    if (m.checkable < 2) soft.push('chưa có dữ kiện ngách (số tiền, mốc ngày, tên form/thuật ngữ) — nói chung chung thì ai cũng viết được');
  }
  let human100 = 100;
  human100 -= m.emDashes * 25 + banned.length * 15 + throat.length * 15;
  if (mode === 'comment') {
    if (m.words > 70) human100 -= 25; else if (m.words > 45) human100 -= 12;
    if (m.handTyped === 0) human100 -= 15;
    if (m.capRate < 0.6) human100 -= 12;
    if (m.checkable < 2) human100 -= 15;
  }
  if (m.words >= 60) {
    if (m.spread < 10) human100 -= 12;
    if (m.hedgesPer200 > 4) human100 -= 10;
    if (m.checkablePer100 < 1) human100 -= 10;
    if (m.contractions === 0) human100 -= 12;
  }
  human100 = Math.max(0, Math.min(100, human100));
  return { ...m, hard, soft, ok: !hard.length, human100 };
}

/** '' = được duyệt. Chuỗi = lý do chặn, hiện thẳng trên nút (GuardedButton), không nuốt cú bấm. */
export function draftBlockReason(draft: string | null | undefined, mode: 'post' | 'comment' = 'post'): string {
  const d = (draft || '').trim();
  if (!d) return '';   // chưa có draft thì nút duyệt vốn đã không có việc gì để làm
  const s = voiceScore(d, mode);
  return s.ok ? '' : `Draft còn lỗi tìm-bằng-find: ${s.hard.join(' · ')}. Sửa rồi mới duyệt được.`;
}
