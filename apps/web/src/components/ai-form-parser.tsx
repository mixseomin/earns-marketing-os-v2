'use client';

// Generic AI form parser. Drop-in component cho mọi form modal/page có 3+ fields.
// User paste text hoặc paste/drop image → AI fill form values via parseFormInput.

import { useState, useTransition, useRef } from 'react';
import { parseFormInput, type FormFieldSchema } from '@/lib/actions/ai-parse';

export type { FormFieldSchema };

interface AIFormParserProps {
  schema: FormFieldSchema[];
  onApply: (values: Record<string, string | number | boolean>) => void;
  context?: string;
  placeholder?: string;
  /** Current form values — passed to enable "Enrich" mode (fills only empty fields). */
  currentValues?: Record<string, string | number | boolean | null | undefined>;
}

// Match a single URL (text content is just URL, possibly trimmed)
const URL_REGEX = /^https?:\/\/\S+$/i;

// Build a context string from current form values for enrich mode.
function buildEnrichInput(values: Record<string, string | number | boolean | null | undefined>, schema: FormFieldSchema[]): { text: string; urlToFetch: string | null; emptyKeys: string[] } {
  const filled: string[] = [];
  const emptyKeys: string[] = [];
  let urlToFetch: string | null = null;
  for (const f of schema) {
    const v = values[f.key];
    // 0 is a legitimate value for number fields (size, cost, ...) — only null/undefined/'' = empty
    if (v === null || v === undefined || v === '') {
      emptyKeys.push(f.key);
    } else {
      filled.push(`${f.label}: ${String(v)}`);
      // Pick first URL-shaped value to fetch (signupUrl, sourceUrl, etc.)
      if (!urlToFetch && typeof v === 'string' && /^https?:\/\//.test(v.trim())) {
        urlToFetch = v.trim();
      }
    }
  }
  const text = `Existing form values:\n${filled.join('\n')}\n\nFill ONLY the empty fields based on what's known + URL fetched. Do NOT overwrite the existing values above.`;
  return { text, urlToFetch, emptyKeys };
}

export function AIFormParser({ schema, onApply, context, placeholder, currentValues }: AIFormParserProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Auto-detect: if textarea content is a single URL, mirror to url field
  const trimmedText = text.trim();
  const isTextJustUrl = URL_REGEX.test(trimmedText);
  const effectiveUrl = url.trim() || (isTextJustUrl ? trimmedText : '');
  const effectiveText = isTextJustUrl ? '' : text;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image too large (max 8MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is data URL: "data:image/png;base64,..."
      const [, base64] = result.split(',');
      setImage({ base64: base64 || '', mime: file.type, name: file.name });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          handleFile(file);
          return;
        }
      }
    }
    // Otherwise let default paste fill the textarea
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const enrichMissing = () => {
    if (!currentValues) return;
    const { text, urlToFetch, emptyKeys } = buildEnrichInput(currentValues, schema);
    if (emptyKeys.length === 0) {
      setError('Tất cả fields đã có giá trị, không có gì để enrich.');
      return;
    }
    setError(null);
    setNotes(null);
    startTransition(async () => {
      const res = await parseFormInput({
        text,
        url: urlToFetch ?? undefined,
        // Only ask AI to fill the missing fields
        schema: schema.filter((f) => emptyKeys.includes(f.key)),
        context: `${context ?? ''}\n[ENRICH MODE] Only fill empty fields. Use existing values + fetched URL as source.`,
      });
      if (!res.ok) { setError(res.error || 'Enrich thất bại'); return; }
      if (res.values) {
        const cleaned: Record<string, string | number | boolean> = {};
        for (const [k, v] of Object.entries(res.values)) {
          if (v !== null && v !== undefined) cleaned[k] = v;
        }
        onApply(cleaned);
      }
      if (res.notes) setNotes(res.notes);
    });
  };

  const submit = () => {
    setError(null);
    setNotes(null);
    if (!effectiveText.trim() && !effectiveUrl && !image) {
      setError('Paste text, URL, or drop an image');
      return;
    }
    startTransition(async () => {
      const res = await parseFormInput({
        text: effectiveText.trim() || undefined,
        url: effectiveUrl || undefined,
        imageBase64: image?.base64,
        imageMimeType: image?.mime,
        schema,
        context,
      });
      if (!res.ok) {
        setError(res.error || 'Parse failed');
        return;
      }
      if (res.values && Object.keys(res.values).length > 0) {
        const cleaned: Record<string, string | number | boolean> = {};
        for (const [k, v] of Object.entries(res.values)) {
          if (v !== null && v !== undefined) cleaned[k] = v;
        }
        onApply(cleaned);
      }
      if (res.notes) setNotes(res.notes);
      setText('');
      setUrl('');
      setImage(null);
      setExpanded(false);
    });
  };

  // Count empty fields for enrich-pill hint
  const emptyCount = currentValues
    ? schema.filter((f) => {
        const v = currentValues[f.key];
        return v === null || v === undefined || v === '';
      }).length
    : 0;
  const canEnrich = !!currentValues && emptyCount > 0 && emptyCount < schema.length;

  if (!expanded) {
    return (
      <div style={{
        margin: '8px 14px 4px',
        padding: '6px 10px',
        background: 'rgba(157,108,255,0.06)',
        border: '1px dashed rgba(157,108,255,0.4)',
        borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11,
      }}>
        <span style={{ fontSize: 14 }}>✨</span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            color: 'var(--neon-violet)', fontWeight: 600, fontSize: 11,
          }}
        >AI fill</button>
        <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          paste text / URL / image → {schema.length} fields
        </span>
        {canEnrich && (
          <>
            <span style={{ color: 'var(--fg-4)' }}>·</span>
            <button
              type="button"
              onClick={enrichMissing}
              disabled={isPending}
              style={{
                background: 'transparent', border: 'none', padding: 0, cursor: isPending ? 'wait' : 'pointer',
                color: 'var(--neon-amber)', fontWeight: 600, fontSize: 11,
              }}
            >
              {isPending ? '✦ enriching…' : '✦ Enrich missing'}
            </button>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
              ({emptyCount} empty)
            </span>
          </>
        )}
        {error && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--bad)' }}>⚠ {error}</span>}
        {notes && !error && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-3)', fontStyle: 'italic' }}>{notes}</span>}
      </div>
    );
  }

  return (
    <div style={{
      margin: '8px 14px 4px',
      padding: 10,
      background: 'rgba(157,108,255,0.06)',
      border: '1px solid rgba(157,108,255,0.4)',
      borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>✨</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--neon-violet)' }}>AI fill</span>
        <span style={{ flex: 1, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
          text · URL · Ctrl+V image · drag-drop
        </span>
        <button onClick={() => setExpanded(false)} style={{
          background: 'transparent', border: 'none', color: 'var(--fg-3)',
          cursor: 'pointer', fontSize: 12, padding: 0,
        }}>✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>🔗</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://... (server fetches & parses)"
          style={{
            flex: 1, padding: '5px 8px', fontSize: 12,
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            borderRadius: 4, color: 'var(--fg-0)', outline: 'none',
            fontFamily: 'var(--font-mono)',
          }}
        />
      </div>

      <div
        ref={dropRef}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={handleDrop}
        style={{
          border: '1px dashed var(--line)', borderRadius: 5,
          background: 'var(--bg-2)',
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder || 'Paste raw text, JSON, signature, URL, or paste/drop a screenshot...'}
          style={{
            width: '100%', minHeight: 70, padding: 8,
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--fg-0)', fontSize: 12, fontFamily: 'var(--font-mono)',
            resize: 'vertical',
          }}
        />
        {image && (
          <div style={{
            padding: '4px 8px', borderTop: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--fg-3)',
          }}>
            <span>📷 {image.name}</span>
            <button onClick={() => setImage(null)} style={{
              background: 'transparent', border: 'none', color: 'var(--fg-3)',
              cursor: 'pointer', marginLeft: 'auto', fontSize: 11,
            }}>remove</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          ref={fileInputRef}
          type="file" accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '4px 8px', fontSize: 10, background: 'var(--bg-2)',
            border: '1px solid var(--line)', borderRadius: 4,
            color: 'var(--fg-2)', cursor: 'pointer',
          }}
        >📎 Upload image</button>
        <span style={{ flex: 1 }} />
        {canEnrich && (
          <button
            type="button"
            onClick={enrichMissing}
            disabled={isPending}
            title={`Enrich ${emptyCount} empty fields based on existing values + URL`}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 600,
              background: 'transparent',
              border: '1px solid var(--neon-amber)',
              borderRadius: 4,
              color: 'var(--neon-amber)',
              cursor: isPending ? 'wait' : 'pointer',
            }}
          >
            ✦ Enrich {emptyCount} empty
          </button>
        )}
        <button
          onClick={submit}
          disabled={isPending || (!text.trim() && !url.trim() && !image)}
          style={{
            padding: '5px 12px', fontSize: 11, fontWeight: 600,
            background: isPending ? 'var(--bg-3)' : 'var(--neon-violet)',
            border: 'none', borderRadius: 4,
            color: isPending ? 'var(--fg-3)' : 'var(--bg-0)',
            cursor: isPending ? 'wait' : 'pointer',
          }}
        >
          {isPending ? '✦ parsing…' : '✦ AI fill'}
        </button>
      </div>

      {error && <div style={{ fontSize: 10, color: 'var(--bad)' }}>⚠ {error}</div>}
      {notes && <div style={{ fontSize: 10, color: 'var(--fg-3)', fontStyle: 'italic' }}>note: {notes}</div>}
    </div>
  );
}
