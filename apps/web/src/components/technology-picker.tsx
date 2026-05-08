'use client';

import { useState, useMemo } from 'react';
import type { TechnologyRow } from '@/lib/actions/technologies';

const TECH_ICON: Record<string, string> = {
  vbulletin: '🔧', xenforo: '⚡', phpbb: '🐘', discourse: '💬',
  wordpress: '📝', invisionpower: '🛡', mybb: '📋', custom: '🗂',
};

interface Props {
  technologies: TechnologyRow[];
  value: string | null;
  onChange: (key: string | null) => void;
  fld: React.CSSProperties;
}

export function TechnologyPicker({ technologies, value, onChange, fld }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = technologies.find((t) => t.key === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return technologies;
    return technologies.filter(
      (t) => t.key.includes(q) || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [technologies, query]);

  const select = (key: string | null) => { onChange(key); setOpen(false); setQuery(''); };

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{ ...fld, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? (
          <>
            <span>{TECH_ICON[selected.key] ?? '🗂'}</span>
            <span style={{ flex: 1, color: 'var(--fg-0)', fontWeight: 600 }}>{selected.label}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); select(null); }}
                    style={{ fontSize: 10, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                    title="Clear technology">✕</button>
          </>
        ) : (
          <span style={{ color: 'var(--fg-3)' }}>—  (none / unknown)</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>▾</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, marginTop: 2,
          background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
          borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          maxHeight: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>
            <input
              autoFocus
              placeholder={`Search ${technologies.length} engines…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%', padding: '5px 8px', background: 'var(--bg-2)',
                border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-0)',
                fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div onClick={() => select(null)}
                 style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--fg-3)',
                          borderBottom: '1px solid var(--line)' }}>
              — None / Unknown
            </div>
            {filtered.map((t) => (
              <div key={t.key}
                   onClick={() => select(t.key)}
                   style={{
                     padding: '7px 10px', cursor: 'pointer', fontSize: 12,
                     background: t.key === value ? 'var(--accent-soft)' : 'transparent',
                     borderLeft: `2px solid ${t.key === value ? 'var(--accent)' : 'transparent'}`,
                     display: 'flex', alignItems: 'flex-start', gap: 8,
                   }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{TECH_ICON[t.key] ?? '🗂'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: t.key === value ? 700 : 500, color: 'var(--fg-0)' }}>{t.label}</div>
                  {t.description && (
                    <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.description}
                    </div>
                  )}
                  {t.signupFields.length > 0 && (
                    <div style={{ fontSize: 9.5, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {t.signupFields.filter((f) => f.required).map((f) => f.label).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && selected.signupFields.length > 0 && !open && (
        <div style={{ marginTop: 4, fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
          {selected.notes && (
            <div style={{ color: 'var(--warn)', marginBottom: 2 }}>⚠ {selected.notes.split('.')[0]}.</div>
          )}
          <span style={{ color: 'var(--fg-4)' }}>Required: </span>
          {selected.signupFields.filter((f) => f.required).map((f) => f.label).join(', ')}
        </div>
      )}
    </div>
  );
}

// Snippet field — editable content with variant picker + copy + persona override
function SnippetFieldRow({ field, templateVars, override, onOverrideChange }: {
  field: { key: string; template?: string; alt?: string[]; maxLen?: number };
  templateVars: Record<string, string>;
  override?: string;
  onOverrideChange?: (value: string | null) => void;
}) {
  const fillVars = (text: string) => text.replace(/\{\{(\w[\w\s\-]*)\}\}/g, (m, k: string) => templateVars[k.trim()] ?? m);
  const variants = [field.template ?? '', ...(field.alt ?? [])].map(fillVars);
  const [copied, setCopied] = useState(false);
  const baseText = variants[0] ?? '';
  const value: string = override !== undefined && override !== '' ? override : baseText;
  const overLimit = field.maxLen != null && value.length > field.maxLen;
  const isOverridden = override !== undefined && override !== '' && override !== baseText;

  const onCopy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
  };

  return (
    <div style={{
      padding: '5px 7px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {variants.length > 1 && variants.map((v, i) => (
          <button key={i} type="button"
            onClick={() => onOverrideChange?.(i === 0 ? null : v)}
            title={`Use variant ${i + 1} (clears edit)`}
            style={{
              fontSize: 9, padding: '0 5px', minWidth: 16,
              background: 'var(--bg-3)', color: 'var(--fg-3)',
              border: '1px solid var(--line)', borderRadius: 2, cursor: 'pointer',
            }}>{i + 1}</button>
        ))}
        {isOverridden && (
          <span style={{ fontSize: 9, color: 'var(--warn)', fontStyle: 'italic' }}>· edited</span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: overLimit ? 'var(--bad)' : 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
          {value.length}{field.maxLen ? `/${field.maxLen}` : ''}{overLimit ? ' ⚠' : ''}
        </span>
        <button type="button" onClick={onCopy}
          style={{
            fontSize: 10, padding: '1px 7px',
            background: copied ? 'var(--ok-soft)' : 'var(--bg-3)',
            color: copied ? 'var(--ok)' : 'var(--fg-2)',
            border: '1px solid var(--line)', borderRadius: 3, cursor: 'pointer',
          }}>{copied ? '✓' : '📋'}</button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onOverrideChange?.(e.target.value === baseText ? null : e.target.value)}
        rows={Math.min(6, Math.max(2, Math.ceil(value.length / 60)))}
        spellCheck={false}
        style={{
          fontSize: 11, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)',
          background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 3,
          padding: '4px 6px', outline: 'none', resize: 'vertical', minHeight: 28,
          width: '100%', boxSizing: 'border-box', lineHeight: 1.4,
        }}
      />
    </div>
  );
}

// Read-only inline display of signup fields — used in Account pre-deployment section
// Read-only inline display of signup fields — used in Account pre-deployment section.
// captcha + info types are read-only (runtime-only, cannot be stored in advance).
export function SignupFieldsChecklist({ fields, persona, onPersonaChange, templateVars }: {
  fields: { key: string; label: string; type: string; required: boolean; notes?: string; options?: string[]; template?: string; alt?: string[]; maxLen?: number; source?: string }[];
  persona: Record<string, string>;
  onPersonaChange: (key: string, value: string) => void;
  templateVars?: Record<string, string>;
}) {
  if (fields.length === 0) return null;
  const fld: React.CSSProperties = {
    padding: '4px 7px', background: 'var(--bg-2)', border: '1px solid var(--line)',
    borderRadius: 4, color: 'var(--fg-0)', fontSize: 12, outline: 'none', width: '100%',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {fields.map((f) => {
        const isRuntimeOnly = f.type === 'captcha' || f.type === 'info';
        const isSnippet = f.type === 'snippet';
        return (
          <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'start', opacity: isRuntimeOnly ? 0.55 : 1 }}>
            <div style={{ fontSize: 11, paddingTop: 5 }}>
              <span style={{ color: f.required && !isRuntimeOnly ? 'var(--bad)' : 'var(--fg-2)', fontWeight: 500 }}>
                {f.required && !isRuntimeOnly && <span title="Required" style={{ marginRight: 3 }}>*</span>}
                {f.label}
                {f.source === 'checklist' && (
                  <span title="From platform checklist (creating phase)" style={{ marginLeft: 4, fontSize: 8.5, color: 'var(--fg-4)' }}>📋</span>
                )}
                {f.maxLen && (
                  <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>·{f.maxLen}</span>
                )}
              </span>
              {f.notes && (
                <div style={{ fontSize: 9.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)', marginTop: 2, lineHeight: 1.4 }}>{f.notes}</div>
              )}
            </div>
            <div>
              {isSnippet ? (
                <SnippetFieldRow
                  field={f as { key: string; template?: string; alt?: string[]; maxLen?: number }}
                  templateVars={templateVars ?? {}}
                  override={persona[f.key]}
                  onOverrideChange={(v) => onPersonaChange(f.key, v ?? '')}
                />
              ) : isRuntimeOnly ? (
                <div style={{
                  fontSize: 10.5, color: 'var(--fg-3)', fontStyle: 'italic',
                  padding: '4px 7px', background: 'var(--bg-2)', border: '1px dashed var(--line)',
                  borderRadius: 4,
                }}>
                  {f.type === 'captcha' ? '⚙ Solve at runtime — không lưu trước được' : f.notes}
                </div>
              ) : f.type === 'select' && f.options ? (
                <select value={persona[f.key] ?? ''} onChange={(e) => onPersonaChange(f.key, e.target.value)} style={fld}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'boolean' ? (
                <select value={persona[f.key] ?? ''} onChange={(e) => onPersonaChange(f.key, e.target.value)} style={fld}>
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <input
                  type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
                  value={persona[f.key] ?? ''}
                  onChange={(e) => onPersonaChange(f.key, e.target.value)}
                  style={fld}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Reusable inline fields builder — used in Platform modal + Tech editor.
const FIELD_TYPES_ALL = ['text', 'email', 'phone', 'date', 'select', 'boolean', 'captcha', 'info'] as const;
export function SignupFieldsBuilder({ fields, onChange }: {
  fields: SignupFieldDef[];
  onChange: (fields: SignupFieldDef[]) => void;
}) {
  const fld: React.CSSProperties = {
    padding: '4px 6px', background: 'var(--bg-0)', border: '1px solid var(--line)',
    borderRadius: 4, color: 'var(--fg-0)', fontSize: 11, outline: 'none',
  };
  const addField = () => onChange([...fields, { key: '', label: '', type: 'text', required: false }]);
  const update = (i: number, patch: Partial<SignupFieldDef>) => {
    const next = [...fields];
    next[i] = { ...next[i]!, ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(fields.filter((_, j) => j !== i));

  return (
    <div>
      {fields.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--fg-4)', fontStyle: 'italic', marginBottom: 6 }}>
          Chưa có field — bấm "+ Add" để thêm
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 6 }}>
          {fields.map((f, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 76px 50px 1fr auto', gap: 4, alignItems: 'center', padding: '5px 7px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4 }}>
              <input placeholder="key (dob, phone…)" value={f.key}
                onChange={(e) => update(i, { key: e.target.value })}
                style={{ ...fld, fontFamily: 'var(--font-mono)' }} />
              <input placeholder="Label" value={f.label}
                onChange={(e) => update(i, { label: e.target.value })} style={fld} />
              <select value={f.type} onChange={(e) => update(i, { type: e.target.value as SignupFieldDef['type'] })} style={fld}>
                {FIELD_TYPES_ALL.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10.5, cursor: 'pointer', justifyContent: 'center' }}
                title="Required?">
                <input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} /> req
              </label>
              <input placeholder="Notes (optional)" value={f.notes ?? ''}
                onChange={(e) => update(i, { notes: e.target.value || undefined })}
                style={{ ...fld, fontSize: 10 }} />
              <button type="button" onClick={() => remove(i)}
                title="Xóa field"
                style={{ background: 'none', border: 'none', color: 'var(--bad)', fontSize: 14, cursor: 'pointer', padding: '0 3px', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={addField}
        style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--accent)', cursor: 'pointer' }}>
        + Add field
      </button>
    </div>
  );
}

// Minimal type for the builder (avoids importing from actions in this file)
export interface SignupFieldDef {
  key: string; label: string;
  type: 'text' | 'date' | 'select' | 'boolean' | 'phone' | 'email' | 'captcha' | 'info' | 'snippet';
  required: boolean;
  notes?: string;
  options?: string[];
  template?: string;
  alt?: string[];
  maxLen?: number;
}
