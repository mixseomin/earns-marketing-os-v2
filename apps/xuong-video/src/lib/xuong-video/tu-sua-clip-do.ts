// LUẬT PROMPT VIDEO học từ clip hỏng (anh 17/10/2026: "tự động hoàn thành, fix làm sao ra được video không bị lỗi"). Mỗi luật là một kiểu
// prompt đã làm model vẽ hỏng, có ca thật. Dùng ở hai chỗ: lint prompt trước khi tiêu tiền và lời dặn cho lượt viết lại prompt (tu-sua-clip.ts).
// Thuần — tự kiểm: tu-sua-clip-do.test.mts.
export type LuatPrompt = { key: string; re: RegExp; vi: string; en: string };
export const LUAT_PROMPT: LuatPrompt[] = [
  { key: 'cam_vat', re: /\b(pick(s|ing)?\s+(up\s+)?(a|an|the|something|it)\b|pick(s|ing)?\s+\w+\s+(off|from|up)\b|grab(s|bing)?\s+(a|an|the)\s+(?!waistband|belt)|holding\s+(a|an)\s+\w+)/i,
    vi: 'nhặt / cầm đồ vật — model làm vật hiện ra, biến mất, lơ lửng hoặc méo tay (#120 shot 4: điện thoại hiện rồi mất, tất lơ lửng)',
    en: 'Do not have the person pick up, hold or handle any object; keep hands empty and resting on the body or the product.' },
  { key: 'dung_day', re: /\b(stand(s|ing)?\s+(back\s+)?up|rise(s)?\s+(up|from)|get(s)?\s+up\s+from)\b/i,
    vi: 'đứng dậy từ ngồi xổm / ngồi — pha chuyển lớn làm quần phồng, đũng tụt (#120 shot 4 bản đầu)',
    en: 'Do not change pose from squatting/sitting to standing (or back); hold one pose with only small natural movement.' },
  { key: 'cap_khoa', re: /\b(unbutton|unzip|open(s|ing)?\s+(the\s+)?(fly|zip|button)|stretch(es|ing)?\s+(it|the\s+waistband)\s+wide|pull(s|ing)?\s+(the\s+)?waistband\s+(open|away|down))/i,
    vi: 'kéo giãn / mở cạp, khoá — model mở khoá quần, lộ đồ lót có chữ (#120 shot 3)',
    en: 'Never open, unbutton or pull the waistband away from the body; the button and zip stay closed and the inside of the garment is never visible.' },
  { key: 'tu_nhay_cam', re: /\b(underwear|boxers?|briefs|nothing\s+(under|beneath)|naked|undress)/i,
    vi: 'từ nhạy cảm — Google chặn ở khâu an toàn, không ra clip (#120 shot 3 lần 2)',
    en: 'Do not mention underwear, nudity or anything beneath the clothing.' },
];
/** Luật bị prompt vi phạm (rỗng = sạch). */
export const lintPrompt = (p: string): LuatPrompt[] => LUAT_PROMPT.filter((l) => l.re.test(p));
/** Lời dặn viết lại prompt video sau một lần hỏng: giữ đúng ý shot + chữ màn, tránh lỗi vừa gặp, theo đủ luật. */
export function loiDanSuaPrompt(o: { prompt: string; chu: string; loi: string[]; daThu: string[] }): string {
  return `You rewrite ONE short motion prompt for an image-to-video model (Veo). The first frame (keyframe) is fixed; the prompt only describes the motion over a few seconds.
Current prompt: ${o.prompt}
On-screen text this shot must support (keep the same meaning): ${o.chu || '(none)'}
The last generated clip had these defects (fix their cause): ${o.loi.join(' | ') || '(generation was refused)'}
${o.daThu.length ? `Prompts already tried that FAILED (do not repeat their approach): ${o.daThu.map((x) => `"${x}"`).join(' ; ')}\n` : ''}Rules:
${LUAT_PROMPT.map((l) => `- ${l.en}`).join('\n')}
- Prefer one simple, small, continuous action that is easy to render; keep the camera steady.
- Keep exactly what is in the keyframe and the current prompt: the same product, and the same people — if the current prompt has no person (a product-only shot), do NOT add any person, body or hands. Plain English, one or two sentences, under 60 words.`;
}
/** Lỗi TẠM của nhà cung cấp (không phải do prompt): gửi lại đúng prompt cũ sau một lúc, không tính là một lần thử, không viết lại prompt.
 *  17/10/2026 #120 shot 3: Kie "Internal Error, Please try again later" ba lần liền → vòng cũ đốt cả 3 lần thử + viết lại prompt thêm người vào shot sản phẩm. */
export const laLoiTam = (loi: string): boolean => /internal error|try again later|temporarily|timeout|timed out|503|502|rate limit|hạn mức|overloaded|busy|系统繁忙|请稍后重试/i.test(loi);
/** Giọng lời dẫn theo mô tả người kể (ô giong / nhân vật): nữ → Jessica, còn lại → Chris (giọng nam Mỹ #120). ElevenLabs v3 qua fal. */
export const MODEL_GIONG_DAN = 'fal-ai/elevenlabs/tts/eleven-v3';
/** Giọng theo giới + tuổi trong mô tả (ô giong): nam <30 Liam · 30–44 Chris · 45–59 Brian · ≥60 Bill; nữ <35 Jessica · 35–59 Sarah · ≥60 Matilda;
 *  phi nhị nguyên River. Không ghi tuổi thì nam Chris / nữ Jessica. */
export function chonGiongDan(moTa: string): string {
  const tuoi = Number((moTa.match(/(?<!\d)(\d{2})(?!\d)/) ?? [])[1] ?? 0);
  if (/non-binary|phi nhị nguyên/i.test(moTa)) return 'River';
  const nu = /(?<!\p{L})(woman|female|girl|lady|mother|mom|wife|grandma|grandmother|nữ|bà|mẹ|vợ)(?!\p{L})/iu.test(moTa);
  if (nu) return !tuoi ? 'Jessica' : tuoi < 35 ? 'Jessica' : tuoi < 60 ? 'Sarah' : 'Matilda';
  return !tuoi ? 'Chris' : tuoi < 30 ? 'Liam' : tuoi < 45 ? 'Chris' : tuoi < 60 ? 'Brian' : 'Bill';
}
/** Model video TỪ CHỐI theo nội dung — viết lại prompt không cứu được, phải đổi model (Veo "unable to generate audio" lặp 3 lần #127 shot 10, 14;
 *  "prominent public figure" — mặt keyframe giống người nổi tiếng, #127 shot 13). */
export const laTuChoiModel = (loi: string): boolean => /unable to generate audio|public figure|safety review|flagged/i.test(loi);
export const laMatNoiTieng = (loi: string): boolean => /public figure|celebrity/i.test(loi);
/** Model video dự phòng khi Veo từ chối theo nội dung / Kie lỗi nội bộ: Grok qua ShopAIKey — 3.250₫/clip, rẻ nhất sổ giá (cong-ai.ts › GIA_VIDEO_VND).
 *  Trước là Kling v3 pro (~11.500₫/clip): #127 đốt $3,56 vào 8 lượt Kling, hơn nửa tiền video cả phim (17/10/2026). */
export const VIDEO_DU_PHONG = 'shopaikey:grok-video-3-10s';
