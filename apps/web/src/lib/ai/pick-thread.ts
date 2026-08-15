// Chọn thread để comment — TẠI CHỖ, từ danh sách bài ĐANG có trong nhóm lúc chạy.
//
// Đây là mảnh còn thiếu của vòng "kế hoạch → làm": kế hoạch KHÔNG được đoán trước nhóm đang bàn
// gì (viết trước = bịa), nên nó chỉ nói "đến giờ vào nhóm đọc xem đang nói gì". Hàm này là bước
// "đọc xem đang nói gì rồi chọn": ext quét bài trên trang, gửi lên, model chọn ĐÚNG MỘT bài mà
// mình có thứ thật để đóng góp, và nói vì sao. Không có bài nào đáng thì trả về không chọn — thà
// bỏ lượt còn hơn comment lấy lệ.
import { getOpenAI, aiEnabled } from './openai';

export interface ThreadCandidate {
  url: string;
  title?: string;
  snippet?: string;
  author?: string;
  /** Giờ kể từ lúc đăng — bài quá cũ thì comment vào không ai đọc. */
  ageH?: number | null;
  replies?: number | null;
  likes?: number | null;
}

export interface PickResult {
  ok: boolean;
  index: number | null;      // vị trí trong mảng đưa vào; null = không bài nào đáng
  why: string;               // vì sao bài này (hoặc vì sao bỏ lượt)
  error?: string;
  modelUsed?: string;
}

const MODEL = 'gpt-4.1-mini';

export async function pickThread(opts: {
  /** Kế hoạch đã lưu trên card (tiêu chí + hướng nói + ranh giới). */
  plan: string;
  /** Nơi đăng, để model biết mình đang ở đâu. */
  place: string;
  /** Mình bán/làm gì — để biết cái gì mới là "đóng góp thật". */
  context?: string;
  threads: ThreadCandidate[];
}): Promise<PickResult> {
  const list = opts.threads.slice(0, 30);
  if (!list.length) return { ok: false, index: null, why: '', error: 'không quét được bài nào trên trang' };
  if (!aiEnabled()) return { ok: false, index: null, why: '', error: 'OPENAI_API_KEY chưa cấu hình' };
  const client = getOpenAI();
  if (!client) return { ok: false, index: null, why: '', error: 'OpenAI client unavailable' };

  const rows = list.map((t, i) => {
    const meta = [
      t.ageH != null ? `${t.ageH}h trước` : null,
      t.replies != null ? `${t.replies} trả lời` : null,
      t.likes != null ? `${t.likes} tương tác` : null,
      t.author ? `bởi ${t.author}` : null,
    ].filter(Boolean).join(' · ');
    return `[${i}] ${t.title || '(không có tiêu đề)'}${meta ? `\n    (${meta})` : ''}${t.snippet ? `\n    ${t.snippet.slice(0, 400).replace(/\s+/g, ' ')}` : ''}`;
  }).join('\n');

  const prompt = `Bạn đang đứng trong ${opts.place || 'một cộng đồng'} và phải chọn ĐÚNG MỘT bài để trả lời.

KẾ HOẠCH đã đặt cho lượt này:
${opts.plan || '(chưa có kế hoạch — tự phán đoán theo ngữ cảnh)'}
${opts.context ? `\nMÌNH LÀM GÌ (để biết đâu là đóng góp thật):\n${opts.context}` : ''}

CÁC BÀI ĐANG CÓ TRONG NHÓM LÚC NÀY:
${rows}

Chọn bài mà mình có thứ THẬT để đóng góp: người ta đang hỏi/hiểu sai/thiếu đúng cái mình biết chắc.
Bỏ qua bài chỉ để tán gẫu, bài đã có câu trả lời đầy đủ, bài quá cũ (không ai đọc comment mới nữa),
và bài mà muốn trả lời thì phải quảng cáo mới nói được gì.
Không bài nào đáng thì trả index = null — bỏ lượt là lựa chọn hợp lệ, comment lấy lệ thì không.

Trả JSON: { "index": <số hoặc null>, "why": "<1 câu tiếng Việt: vì sao bài này / vì sao bỏ lượt>" }`;

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Bạn chọn chỗ để đóng góp trong cộng đồng. Thà bỏ lượt còn hơn nói cho có. Trả JSON đúng schema.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 300,
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as { index?: unknown; why?: unknown };
    const idx = typeof parsed.index === 'number' && parsed.index >= 0 && parsed.index < list.length
      ? Math.floor(parsed.index) : null;
    return { ok: true, index: idx, why: typeof parsed.why === 'string' ? parsed.why : '', modelUsed: MODEL };
  } catch (e) {
    return { ok: false, index: null, why: '', error: (e as Error).message };
  }
}

/** Bài đáng THẢ CẢM XÚC: ít tương tác nhất + còn mới. Không cần model — luật rõ thì đừng gọi AI.
 *  Ít like thì tên mình nằm trong danh sách 3-5 người và người đăng nhìn thấy; bài 200 like thì
 *  mình là hạt cát. Bài quá cũ thì thả cũng không ai biết. */
export function pickToEngage(threads: ThreadCandidate[], take = 5, maxAgeH = 24): ThreadCandidate[] {
  return threads
    .filter((t) => t.url && (t.ageH == null || t.ageH <= maxAgeH))
    .sort((a, b) => (a.likes ?? 0) - (b.likes ?? 0) || (a.ageH ?? 99) - (b.ageH ?? 99))
    .slice(0, take);
}
