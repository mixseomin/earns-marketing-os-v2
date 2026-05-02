'use client';

// Reusable tags input — chip display + add via comma/Enter.
// Used across all entity edit forms for consistent classification UX.

import { useState, useRef, type KeyboardEvent } from 'react';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** Suggested tags from existing pool — show as quick-add chips below input. */
  suggestions?: string[];
  /** Auto-lowercase + slugify each tag (e.g. "B2B" → "b2b"). Default true. */
  normalize?: boolean;
  className?: string;
}

function normalizeTag(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function TagsInput({ value, onChange, placeholder, suggestions, normalize = true, className }: Props) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const tags = raw.split(/[,\n]/).map((t) => normalize ? normalizeTag(t) : t.trim()).filter(Boolean);
    const next = Array.from(new Set([...value, ...tags]));
    if (next.length !== value.length) onChange(next);
    setDraft('');
  };

  const remove = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (draft.trim()) add(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1]!);
    }
  };

  const filteredSuggestions = (suggestions ?? [])
    .filter((s) => !value.includes(s))
    .filter((s) => !draft || s.toLowerCase().includes(draft.toLowerCase()))
    .slice(0, 8);

  return (
    <div className={className}>
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
          padding: '4px 6px', minHeight: 30,
          background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5,
          cursor: 'text',
        }}
      >
        {value.map((tag) => (
          <span key={tag} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 6px', borderRadius: 3,
            background: 'var(--bg-3)', border: '1px solid var(--line)',
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)',
          }}>
            #{tag}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(tag); }}
                    style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 0, fontSize: 11, lineHeight: 1 }}>
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          data-1p-ignore="true" data-lpignore="true"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length === 0 ? (placeholder ?? 'Add tag — Enter / comma') : ''}
          style={{
            flex: 1, minWidth: 100,
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--fg-0)', fontSize: 12, padding: '2px 0',
          }}
        />
      </div>
      {filteredSuggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>suggest:</span>
          {filteredSuggestions.map((s) => (
            <button key={s} type="button"
                    onClick={() => add(s)}
                    style={{
                      padding: '1px 6px', borderRadius: 3,
                      background: 'transparent', border: '1px dashed var(--line)',
                      fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
                      cursor: 'pointer',
                    }}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tags filter chips (for list pages) ──────────────────────────────
interface FilterProps {
  allTags: string[];                         // full pool from current items
  selected: string[];                        // currently filtered tags
  onChange: (tags: string[]) => void;
  /** counts per tag for badge display */
  counts?: Record<string, number>;
  maxVisible?: number;
}

export function TagsFilterChips({ allTags, selected, onChange, counts, maxVisible = 12 }: FilterProps) {
  const [showAll, setShowAll] = useState(false);
  if (allTags.length === 0) return null;
  const sorted = [...allTags].sort((a, b) => (counts?.[b] ?? 0) - (counts?.[a] ?? 0));
  const visible = showAll ? sorted : sorted.slice(0, maxVisible);

  const toggle = (tag: string) => {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>tags:</span>
      {visible.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button key={tag} type="button" onClick={() => toggle(tag)}
                  style={{
                    padding: '2px 8px', fontSize: 10.5, fontFamily: 'var(--font-mono)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--fg-2)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                    borderRadius: 3, cursor: 'pointer',
                  }}>
            #{tag}{counts?.[tag] ? <span style={{ opacity: 0.5, marginLeft: 3 }}>{counts[tag]}</span> : null}
          </button>
        );
      })}
      {sorted.length > maxVisible && (
        <button type="button" onClick={() => setShowAll((s) => !s)}
                style={{ fontSize: 10, color: 'var(--fg-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          {showAll ? 'less' : `+${sorted.length - maxVisible} more`}
        </button>
      )}
      {selected.length > 0 && (
        <button type="button" onClick={() => onChange([])}
                style={{ fontSize: 10, color: 'var(--fg-3)', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
          clear ✕
        </button>
      )}
    </div>
  );
}
