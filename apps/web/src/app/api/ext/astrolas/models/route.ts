import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';

// GET /api/ext/astrolas/models
// Proxy GET https://astrolas.com/api/v1/qa/models — trả list llm_config
// options (deep_reading / default_chat / intent_router / openai_*) với
// pricing để side panel render picker giống AI generic.
//
// Cache 5 phút trong-process để giảm round-trip (catalog ít đổi).

interface AstrolasModel {
  llm_config: string;
  provider: string;
  model_id: string;
  tier: string | null;
  price_in_per_1m: number;
  price_out_per_1m: number;
  notes: string | null;
}

let cache: { ts: number; models: AstrolasModel[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const apiUrl = process.env.ASTROLAS_API_URL;
  const apiKey = process.env.ASTROLAS_QA_KEY;
  if (!apiUrl || !apiKey) {
    return NextResponse.json({ ok: false, error: 'Astrolas chưa cấu hình (ASTROLAS_API_URL + ASTROLAS_QA_KEY)' }, { status: 503 });
  }

  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, models: cache.models, cached: true });
  }

  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/v1/qa/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ ok: false, error: `Astrolas ${res.status}: ${text.slice(0, 200)}` }, { status: 200 });
    }
    const data = await res.json() as { ok?: boolean; models?: AstrolasModel[]; error?: string };
    if (!data.ok || !Array.isArray(data.models)) {
      return NextResponse.json({ ok: false, error: data.error ?? 'Astrolas trả empty models' }, { status: 200 });
    }
    cache = { ts: Date.now(), models: data.models };
    return NextResponse.json({ ok: true, models: data.models });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 200 });
  }
}
