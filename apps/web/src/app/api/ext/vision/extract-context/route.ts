import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { getOpenAI, aiEnabled } from '@/lib/ai/openai';

// POST /api/ext/vision/extract-context
// Body: { imageUrls: string[], habitatId?: number, briefId?: number, hint?: string }
//
// Use case: Reddit/FB thread chỉ có image (vd astrology chart, screenshot,
// meme, infographic). Ext detect <img> → gửi list URL lên đây → OpenAI
// gpt-4o vision extract structured context (text mô tả chi tiết) để
// Astrolas/AI reasoning có data làm việc.
//
// Cap: max 4 ảnh / call (cost control). gpt-4o vision ~$0.005-0.02/image
// tùy detail level. Mặc định "low" (rẻ, OK với chart đơn giản).
//
// Output: { ok, contextText, perImage[{url, description}], costUsd, durationMs }

const MAX_IMAGES = 4;
const MODEL = 'gpt-4o';   // 4o native multimodal; mini không hỗ trợ vision đủ tốt cho chart
// 'high' = tile ảnh đọc glyph nhỏ (natal chart wheel có ký hiệu hành tinh + độ rất nhỏ).
// 'auto'/'low' từng làm vision đọc chart CHUNG CHUNG ("12 cung Aries→Pisces") → AI sai placement.
const DETAIL: 'low' | 'high' | 'auto' = 'high';

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;
  if (!aiEnabled()) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY chưa cấu hình' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as {
    imageUrls?: string[];
    habitatId?: number;
    briefId?: number;
    hint?: string;
  };

  const urls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)) : [];
  if (urls.length === 0) {
    return NextResponse.json({ ok: false, error: 'imageUrls required' }, { status: 400 });
  }
  const capped = urls.slice(0, MAX_IMAGES);

  // Resolve tribe/habitat hint để prompt vision phù hợp.
  // Vd astrology habitat → prompt "describe astrology chart elements (signs, houses, aspects, planets)"
  // Generic habitat → prompt "describe image content (objects, people, text, layout)"
  let tribeSlug = '';
  let habitatName = '';
  let topics: string[] = [];
  if (body.habitatId) {
    const db = getDb();
    if (db) {
      const rows = await db.execute(sql`
        SELECT h.name AS habitat_name, h.dominant_topics, t.slug AS tribe_slug
        FROM habitats h
        LEFT JOIN tribes t ON t.id = h.tribe_id
        WHERE h.id = ${Number(body.habitatId)}
        LIMIT 1
      `);
      const r = (rows as unknown as Array<Record<string, unknown>>)[0];
      if (r) {
        habitatName = String(r.habitat_name ?? '');
        tribeSlug = String(r.tribe_slug ?? '');
        topics = Array.isArray(r.dominant_topics) ? (r.dominant_topics as string[]) : [];
      }
    }
  }

  const systemPrompt = buildSystemPrompt(tribeSlug, topics, body.hint);

  const client = getOpenAI()!;
  const startedAt = Date.now();

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text' as const, text: 'Mô tả chi tiết các ảnh sau (text dùng cho AI reasoning, KHÔNG phải caption ngắn):' },
            ...capped.map((url) => ({
              type: 'image_url' as const,
              image_url: { url, detail: DETAIL },
            })),
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    });

    const text = completion.choices[0]?.message?.content ?? '';
    const usage = completion.usage;
    // gpt-4o pricing: $2.50/M in, $10/M out
    const costUsd = usage
      ? (usage.prompt_tokens / 1_000_000) * 2.5 + (usage.completion_tokens / 1_000_000) * 10
      : 0;

    return NextResponse.json({
      ok: true,
      contextText: text.trim(),
      imageCount: capped.length,
      imagesSkipped: urls.length - capped.length,
      costUsd: Number(costUsd.toFixed(5)),
      durationMs: Date.now() - startedAt,
      model: MODEL,
      tribeHint: tribeSlug || null,
      habitatName: habitatName || null,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: (e as Error).message,
      durationMs: Date.now() - startedAt,
    }, { status: 200 });
  }
}

function buildSystemPrompt(tribeSlug: string, topics: string[], userHint?: string): string {
  // Domain detection: substring match trong tribeSlug + topics (case-insensitive).
  // Mở rộng dần khi thêm domain mới.
  const allHints = [tribeSlug, ...topics].join(' ').toLowerCase();

  const isAstrology = /astro|chart|natal|zodiac|horoscope|tử vi|chiêm tinh|hoàng đạo|synastry|vedic/i.test(allHints);
  const isBiohack = /biohack|whoop|oura|apple ?health|cgm|hrv|sleep|metric/i.test(allHints);
  const isDev = /dev|coder|programming|code|api|github|terminal|ide/i.test(allHints);

  let tribePrompt: string;
  if (isAstrology) {
    tribePrompt = `Bạn là chuyên gia astrology đọc natal chart / transit chart / synastry chart.
Khi gặp chart wheel: extract đầy đủ + CHÍNH XÁC từng giá trị (đọc ký hiệu hành tinh + cung + độ):
  - 4 GÓC bắt buộc đọc rõ: Ascendant (ASC/Rising), Midheaven (MC), Descendant (DSC), IC — mỗi góc ở CUNG nào (+ độ nếu thấy).
  - Sun/Moon + 8 hành tinh (Mercury..Pluto) + nếu có (Chiron, North Node): mỗi cái ở "<cung> trong nhà <N>" + độ.
  - 12 houses (cusp sign + planets trong mỗi house).
  - Aspects chính (conjunction/opposition/trine/square/sextile + orb degree).
  - Notable patterns (stellium, grand trine, T-square, yod, kite); modalities/elements nếu rõ.
Khi gặp screenshot app (astro-seek, co-star, TimePassages…) hoặc natal table: extract verbatim, format "Sun 12°34' Aries in 5th house".
BẢNG KÝ HIỆU — map glyph CHÍNH XÁC (lỗi hay gặp: nhầm ♓ Pisces ↔ ♉ Taurus, ♊ Gemini ↔ ♋ Cancer):
  Cung: ♈ Aries · ♉ Taurus · ♊ Gemini · ♋ Cancer · ♌ Leo · ♍ Virgo · ♎ Libra · ♏ Scorpio · ♐ Sagittarius · ♑ Capricorn · ♒ Aquarius · ♓ Pisces.
  Hành tinh/điểm: ☉ Sun · ☽ Moon · ☿ Mercury · ♀ Venus · ♂ Mars · ♃ Jupiter · ♄ Saturn · ♅ Uranus · ♆ Neptune · ♇ Pluto · ☊ North Node · AC/ASC · MC.
Đọc TỪNG ô: nhìn kỹ glyph → tra bảng trên → ghi tên cung tương ứng. KHÔNG suy cung từ độ (độ không cho biết cung).
Output structured text dễ parse, KHÔNG interpret/giải nghĩa (engine làm).
⚠ TUYỆT ĐỐI KHÔNG đoán / KHÔNG khái quát kiểu "12 cung từ Aries đến Pisces". Glyph/cung/độ/nhà nào KHÔNG đọc rõ → ghi "[không đọc được]" cho đúng mục đó. THÀ thiếu còn hơn sai.`;
  } else if (isBiohack) {
    tribePrompt = `Bạn extract chi tiết screenshot Oura/Whoop/Apple Health/CGM/lab results:
  - Metrics + values + units + reference ranges
  - Time period covered
  - Trends nếu có chart
Output structured text, KHÔNG diagnose.`;
  } else if (isDev) {
    tribePrompt = `Bạn extract code/terminal/IDE screenshot:
  - Code language + key snippets verbatim
  - Error messages exact text
  - Stack traces
  - Config/JSON contents
Output dùng code blocks cho code, plain text cho mô tả.`;
  } else {
    tribePrompt = `Bạn là image content extractor cho AI reasoning engine.
Mô tả chi tiết:
  - Text trong ảnh (OCR verbatim)
  - Objects/people/scene (nếu có)
  - Data/chart values (nếu có)
  - Layout structure
Output dạng structured text, factual, KHÔNG opinion/interpretation.`;
  }

  const topicHint = topics.length > 0 ? `\nHabitat topics liên quan: ${topics.slice(0, 5).join(', ')}` : '';
  const userHintBlock = userHint?.trim() ? `\n[USER HINT — operator instruction]: ${userHint.trim().slice(0, 300)}` : '';

  return `${tribePrompt}${topicHint}${userHintBlock}

QUY TẮC CHỐNG BỊA (mọi domain): chỉ ghi cái ĐỌC RÕ trong ảnh. Số liệu/nhãn/placement mờ
hoặc không chắc → "[không đọc được]". KHÔNG suy đoán, KHÔNG mô tả chung chung thay cho giá
trị cụ thể. Sai 1 con số có thể làm AI phân tích sai toàn bộ.
Trả về plain text (không markdown header), dùng bullet/section ngắn. Cap ~800 từ.`;
}
