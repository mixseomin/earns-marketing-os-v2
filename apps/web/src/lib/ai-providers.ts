// Catalog of LLM providers + models.
// Available models = phụ thuộc API key đã set trong env.
// User configure keys via SSH/.env (phase 1) — phase 2 sẽ encrypt-store DB.

export interface ProviderDef {
  id: string;
  name: string;
  envVar: string;
  setupUrl: string;
  models: { id: string; label: string; cost?: string }[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    setupUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o-mini',   label: 'GPT-4o mini',   cost: '$0.15 / $0.60 per 1M' },
      { id: 'gpt-4o',        label: 'GPT-4o',        cost: '$2.50 / $10.00 per 1M' },
      { id: 'gpt-4.1-mini',  label: 'GPT-4.1 mini',  cost: '$0.40 / $1.60 per 1M' },
      { id: 'gpt-4.1',       label: 'GPT-4.1',       cost: '$2.00 / $8.00 per 1M' },
      { id: 'o3-mini',       label: 'o3-mini',       cost: '$1.10 / $4.40 per 1M' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    setupUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5',  cost: '$0.80 / $4.00 per 1M' },
      { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6', cost: '$3.00 / $15.00 per 1M' },
      { id: 'claude-opus-4-7',    label: 'Claude Opus 4.7',   cost: '$15.00 / $75.00 per 1M' },
    ],
  },
  {
    id: 'google',
    name: 'Google AI',
    envVar: 'GOOGLE_API_KEY',
    setupUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', cost: '$0.075 / $0.30 per 1M' },
      { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   cost: '$1.25 / $5.00 per 1M' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    envVar: 'XAI_API_KEY',
    setupUrl: 'https://console.x.ai/',
    models: [
      { id: 'grok-2',      label: 'Grok 2',      cost: '$2.00 / $10.00 per 1M' },
      { id: 'grok-2-mini', label: 'Grok 2 mini', cost: '$0.30 / $0.50 per 1M' },
    ],
  },
];

export interface ProviderStatus {
  id: string;
  name: string;
  envVar: string;
  setupUrl: string;
  configured: boolean;       // env var present + non-empty
  models: { id: string; label: string; cost?: string }[];
}

// SERVER-ONLY: reads process.env. Don't import from client components.
export function getProviderStatuses(): ProviderStatus[] {
  return PROVIDERS.map((p) => {
    const v = process.env[p.envVar];
    return {
      id: p.id,
      name: p.name,
      envVar: p.envVar,
      setupUrl: p.setupUrl,
      configured: typeof v === 'string' && v.trim().length > 0,
      models: p.models,
    };
  });
}

// Return only models có API key configured. Used by Squad form.
export function getAvailableModels(): Array<{ id: string; label: string; provider: string; cost?: string }> {
  const out: Array<{ id: string; label: string; provider: string; cost?: string }> = [];
  for (const p of getProviderStatuses()) {
    if (!p.configured) continue;
    for (const m of p.models) out.push({ ...m, provider: p.name });
  }
  return out;
}
