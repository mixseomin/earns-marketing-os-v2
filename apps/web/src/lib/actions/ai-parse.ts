'use server';

// Generic AI form parser. Accepts free-form text + optional image (base64),
// returns JSON matching the requested field schema. Used by <AIFormParser>.

export interface FormFieldSchema {
  key: string;
  label: string;
  description?: string;       // hint cho LLM về cách map
  type?: 'string' | 'number' | 'boolean' | 'enum';
  enumValues?: string[];      // nếu type=enum
}

export interface ParseResult {
  ok: boolean;
  values?: Record<string, string | number | boolean | null>;
  error?: string;
  notes?: string;             // model có thể thêm note (vd "không thấy field X trong input")
}

export async function parseFormInput(input: {
  text?: string;
  imageBase64?: string;       // data URL hoặc raw base64 (PNG/JPG)
  imageMimeType?: string;     // 'image/png' | 'image/jpeg'
  schema: FormFieldSchema[];
  context?: string;           // mô tả form (vd "Proxy form for anti-detect setup")
}): Promise<ParseResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY not configured' };
  if (!input.text?.trim() && !input.imageBase64) {
    return { ok: false, error: 'Provide text or image' };
  }
  if (!input.schema?.length) return { ok: false, error: 'Schema empty' };

  const hasImage = !!input.imageBase64;
  const model = hasImage ? 'gpt-4o' : 'gpt-4o-mini';   // vision needs gpt-4o

  // Build JSON Schema for structured output
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const f of input.schema) {
    let prop: Record<string, unknown>;
    if (f.type === 'number') prop = { type: ['number', 'null'] };
    else if (f.type === 'boolean') prop = { type: ['boolean', 'null'] };
    else if (f.type === 'enum' && f.enumValues?.length) {
      prop = { type: ['string', 'null'], enum: [...f.enumValues, null] };
    } else prop = { type: ['string', 'null'] };
    if (f.description) prop.description = f.description;
    else prop.description = f.label;
    properties[f.key] = prop;
    required.push(f.key);
  }
  const responseSchema = {
    type: 'object',
    properties: { ...properties, _notes: { type: ['string', 'null'], description: 'Optional note about ambiguity' } },
    required: [...required, '_notes'],
    additionalProperties: false,
  };

  const systemMsg = `You parse free-form input (text and/or image) into structured form values.
${input.context ? `\nContext: ${input.context}` : ''}
For each field, extract the most likely value from the input. Set null if not present.
Do not invent data. Be concise. If field is enum, pick the closest match.`;

  // Build user message — multi-modal if image provided
  const userContent: Array<Record<string, unknown>> = [];
  if (input.text?.trim()) {
    userContent.push({ type: 'text', text: `Input text:\n\n${input.text.trim()}` });
  }
  if (input.imageBase64) {
    const mime = input.imageMimeType || 'image/png';
    const dataUrl = input.imageBase64.startsWith('data:')
      ? input.imageBase64
      : `data:${mime};base64,${input.imageBase64}`;
    userContent.push({
      type: 'image_url',
      image_url: { url: dataUrl, detail: 'high' },
    });
    userContent.push({ type: 'text', text: 'Parse the form values from the image above.' });
  }
  if (userContent.length === 0) {
    userContent.push({ type: 'text', text: 'No input provided.' });
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'form_values', strict: true, schema: responseSchema },
        },
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `OpenAI ${res.status}: ${errText.slice(0, 300)}` };
    }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) return { ok: false, error: 'Empty response' };
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const notes = (parsed._notes as string | null) ?? null;
    delete parsed._notes;
    // Strip nulls so caller can spread without overwriting existing values
    const values: Record<string, string | number | boolean | null> = {};
    for (const f of input.schema) {
      const v = parsed[f.key];
      if (v !== undefined && v !== null) {
        values[f.key] = v as string | number | boolean;
      }
    }
    return { ok: true, values, notes: notes ?? undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
