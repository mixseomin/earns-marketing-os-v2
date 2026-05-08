'use client';

// Edit one community brief (account × habitat). Used from both AccountFormModal
// (per-account view, listing all habitats this persona engages in) and from
// the Tribes/Habitats page (per-habitat view, listing all accounts engaging
// here). Same shared editor.

import { useState, useTransition, useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertBrief, deleteBrief, saveBriefSuggestion,
  type BriefRow, type BriefTemplate,
} from '@/lib/actions/community-briefs';
import { suggestBrief, type BriefSuggestion, type BriefSuggestionLang } from '@/lib/ai/brief-suggest';
import { AIFormParser } from './ai-form-parser';
import { Spinner } from './ui';

type SuggestableField = 'approachMd' | 'cadence' | 'tone' | 'doMd' | 'dontMd';

export interface BriefEditModalProps {
  projectId: string;
  accountId: number;
  habitatId: number;
  // Display headers (read-only)
  accountLabel: string;     // e.g. "@oritapp · Reddit"
  habitatLabel: string;     // e.g. "r/SaaS · subreddit · 1.2M"
  // Existing row, or null if creating
  existing: BriefRow | null;
  onClose: () => void;
}

export function BriefEditModal({
  projectId, accountId, habitatId,
  accountLabel, habitatLabel,
  existing, onClose,
}: BriefEditModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [approachMd, setApproachMd] = useState(existing?.approachMd ?? '');
  const [cadence,    setCadence]    = useState(existing?.cadence ?? '');
  const [tone,       setTone]       = useState(existing?.tone ?? '');
  const [doMd,       setDoMd]       = useState(existing?.doMd ?? '');
  const [dontMd,     setDontMd]     = useState(existing?.dontMd ?? '');
  const [templates,  setTemplates]  = useState<BriefTemplate[]>(existing?.templates ?? []);

  // ── AI suggestion state ─────────────────────────────────────────
  // Hydrate from DB when modal opens — surviving F5 / re-open. Generate
  // is expensive (LLM tokens + 2-3s) so we cache it in community_briefs
  // (columns ai_suggestion + ai_suggestion_at).
  const [suggestion, setSuggestion]       = useState<BriefSuggestion | null>(
    (existing?.aiSuggestion as BriefSuggestion | null) ?? null,
  );
  const [suggestionAt, setSuggestionAt]   = useState<string | null>(existing?.aiSuggestionAt ?? null);
  const [suggestBusy, setSuggestBusy]     = useState(false);
  const [suggestError, setSuggestError]   = useState<string | null>(null);
  // Default UI language preference for actions (Replace/Append).
  const [suggestLang, setSuggestLang]     = useState<'en' | 'vi'>('vi');
  // Free-form extra instruction for the LLM, e.g. "more aggressive tone",
  // "skip emojis", "focus on indie devs". Persisted only in this modal
  // session — not saved to DB.
  const [extraInstruction, setExtraInstruction] = useState<string>('');

  const handleGenerateSuggestion = () => {
    setSuggestBusy(true);
    setSuggestError(null);
    startTransition(async () => {
      const res = await suggestBrief({
        accountId, habitatId,
        current: { approachMd, cadence, tone, doMd, dontMd },
        extraInstruction: extraInstruction.trim() || undefined,
      });
      if (!res.ok || !res.suggestion) {
        setSuggestBusy(false);
        setSuggestError(res.error ?? 'Suggest failed');
        return;
      }
      // Persist BEFORE flipping busy so user knows the cache is real.
      const saved = await saveBriefSuggestion(projectId, accountId, habitatId, res.suggestion);
      setSuggestBusy(false);
      if (!saved.ok) {
        // Suggestion still usable in-memory — surface the cache error softly.
        setSuggestError(`Generated OK but cache failed: ${saved.error ?? 'unknown'}`);
      }
      setSuggestion(res.suggestion);
      setSuggestionAt(new Date().toISOString());
    });
  };

  const setterFor = (k: SuggestableField): ((v: string) => void) => {
    if (k === 'approachMd') return setApproachMd;
    if (k === 'cadence')    return setCadence;
    if (k === 'tone')       return setTone;
    if (k === 'doMd')       return setDoMd;
    return setDontMd;
  };
  const currentFor = (k: SuggestableField): string => {
    if (k === 'approachMd') return approachMd;
    if (k === 'cadence')    return cadence;
    if (k === 'tone')       return tone;
    if (k === 'doMd')       return doMd;
    return dontMd;
  };

  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)',
    border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)',
    fontSize: 13, outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  };

  const handleSave = () => {
    setBusy(true);
    setError(null);
    startTransition(async () => {
      const res = await upsertBrief(projectId, accountId, habitatId, {
        approachMd, cadence, tone, doMd, dontMd, templates,
      });
      setBusy(false);
      if (!res.ok) { setError(res.error || 'Save failed'); return; }
      router.refresh();
      onClose();
    });
  };

  const handleDelete = () => {
    if (!existing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    setBusy(true);
    startTransition(async () => {
      await deleteBrief(projectId, existing.id);
      setBusy(false);
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 'min(880px, 100%)', maxWidth: 880 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="id-line">
              {existing ? `Brief #${existing.id}` : 'NEW BRIEF'} · 🎯 Phương án tiếp cận
            </div>
            <h2 style={{ fontSize: 15, marginTop: 4 }}>
              <span style={{ color: 'var(--accent)' }}>{accountLabel}</span>
              <span style={{ color: 'var(--fg-3)', margin: '0 6px' }}>×</span>
              <span style={{ color: 'var(--fg-0)' }}>{habitatLabel}</span>
            </h2>
          </div>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
          <AIFormParser
            context={`Tạo phương án tiếp cận cho persona "${accountLabel}" khi engage trong "${habitatLabel}". Dựa vào community rules / brand voice / competitor posts. Trả về JSON đúng schema. approachMd nên là markdown 4-8 dòng. doMd/dontMd dùng bullet list "- ".`}
            schema={[
              { key: 'approachMd', label: 'Approach (markdown narrative)', type: 'string', description: 'Tổng quan chiến thuật 4-8 dòng' },
              { key: 'cadence',    label: 'Cadence',                       type: 'string', description: 'e.g. "3 replies/day", "1 post/week"' },
              { key: 'tone',       label: 'Tone',                          type: 'string', description: 'e.g. "helpful expert, mystical, casual VN"' },
              { key: 'doMd',       label: 'DO list (markdown bullets)',    type: 'string' },
              { key: 'dontMd',     label: "DON'T list (markdown bullets)", type: 'string' },
            ]}
            currentValues={{ approachMd, cadence, tone, doMd, dontMd }}
            onApply={(v) => {
              if (v.approachMd != null) setApproachMd(String(v.approachMd));
              if (v.cadence != null) setCadence(String(v.cadence));
              if (v.tone != null) setTone(String(v.tone));
              if (v.doMd != null) setDoMd(String(v.doMd));
              if (v.dontMd != null) setDontMd(String(v.dontMd));
            }}
          />

          {/* ── AI auto-suggest from context ────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
            borderRadius: 6, fontSize: 11.5, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 14 }}>✨</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ color: 'var(--fg-0)', fontWeight: 600 }}>
                AI đề xuất phương án (en + vi)
                {suggestionAt && (
                  <span style={{ marginLeft: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontWeight: 400 }}>
                    · cached {fmtAgo(suggestionAt)}
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--fg-3)', fontSize: 10.5 }}>
                Đọc account + habitat + nội dung hiện có → đề xuất song ngữ. Lưu lại để F5 không mất. Không ghi đè input — chủ động Replace/Append.
              </div>
            </div>
            {suggestion && (
              <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: 'var(--bg-1)', border: '1px solid var(--accent-line)', borderRadius: 5 }}>
                {(['vi', 'en'] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setSuggestLang(l)}
                          title={`Default lang for Replace/Append actions (${l.toUpperCase()})`}
                          style={{
                            padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            background: suggestLang === l ? 'var(--accent)' : 'transparent',
                            color: suggestLang === l ? '#fff' : 'var(--accent)',
                            border: 'none', borderRadius: 3, cursor: 'pointer',
                          }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <button type="button"
                    onClick={handleGenerateSuggestion} disabled={suggestBusy}
                    className="btn primary" style={{ fontSize: 11, padding: '4px 10px' }}>
              {suggestBusy
                ? <><Spinner size="xs" /> Generating</>
                : suggestion ? '↻ Regenerate' : '✨ Generate'}
            </button>
          </div>
          {/* Optional custom instruction — appended to LLM prompt as high-priority. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', flexShrink: 0 }}>🎙 Custom prompt</span>
            <input
              type="text"
              value={extraInstruction}
              onChange={(e) => setExtraInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !suggestBusy) handleGenerateSuggestion(); }}
              placeholder='Optional: "more aggressive", "tránh emoji", "focus indie devs", "kèm meme tham khảo"…'
              autoComplete="off" data-1p-ignore data-lpignore="true" name="extra-instr"
              style={{
                flex: 1, padding: '5px 8px', fontSize: 11,
                background: 'var(--bg-2)', color: 'var(--fg-0)',
                border: '1px solid var(--line)', borderRadius: 4, outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
            {extraInstruction && (
              <button type="button" onClick={() => setExtraInstruction('')}
                      title="Clear custom prompt"
                      style={{ fontSize: 10, padding: '3px 7px', background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                ✕
              </button>
            )}
          </div>
          {suggestError && (
            <div style={{ padding: 6, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)', color: 'var(--bad)', fontSize: 11, borderRadius: 5 }}>
              ⚠ {suggestError}
            </div>
          )}
          {suggestion?.[suggestLang]?.rationale && (
            <div style={{ fontSize: 11, color: 'var(--fg-2)', padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 5, borderLeft: '3px solid var(--accent)' }}>
              <strong style={{ color: 'var(--accent)' }}>Why ({suggestLang.toUpperCase()}):</strong> {suggestion[suggestLang].rationale}
            </div>
          )}

          <div>
            <FieldLabel label="Approach" hint="markdown — tổng quan chiến thuật" lbl={lbl}
                        suggestion={suggestion} suggestLang={suggestLang} field="approachMd" current={approachMd}
                        onApply={(v) => setApproachMd(v)} />
            <textarea
              value={approachMd}
              onChange={(e) => setApproachMd(e.target.value)}
              rows={5}
              style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
              placeholder="vd: Tham gia trả lời chart-reading. Reply dài 5-8 dòng, dẫn nguồn từ Astrolas. Soft-mention link app cuối reply nếu user hỏi sâu thêm."
            />
            <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="approachMd" current={approachMd}
                              setterFor={setterFor} currentFor={currentFor} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <FieldLabel label="Cadence" lbl={lbl}
                          suggestion={suggestion} suggestLang={suggestLang} field="cadence" current={cadence}
                          onApply={(v) => setCadence(v)} />
              <input type="text" value={cadence} onChange={(e) => setCadence(e.target.value)}
                     style={fld} placeholder="3 replies/day" />
              <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="cadence" current={cadence}
                                setterFor={setterFor} currentFor={currentFor} />
            </div>
            <div>
              <FieldLabel label="Tone" lbl={lbl}
                          suggestion={suggestion} suggestLang={suggestLang} field="tone" current={tone}
                          onApply={(v) => setTone(v)} />
              <input type="text" value={tone} onChange={(e) => setTone(e.target.value)}
                     style={fld} placeholder="helpful expert, mystical" />
              <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="tone" current={tone}
                                setterFor={setterFor} currentFor={currentFor} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <FieldLabel label="✅ DO" hint="markdown bullets" lbl={lbl}
                          suggestion={suggestion} suggestLang={suggestLang} field="doMd" current={doMd}
                          onApply={(v) => setDoMd(v)} />
              <textarea value={doMd} onChange={(e) => setDoMd(e.target.value)} rows={5}
                        style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
                        placeholder={'- Cite chart house + aspect\n- Acknowledge OP\'s feeling\n- Offer 1 actionable insight'} />
              <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="doMd" current={doMd}
                                setterFor={setterFor} currentFor={currentFor} />
            </div>
            <div>
              <FieldLabel label="🚫 DON&apos;T" hint="markdown bullets" lbl={lbl}
                          suggestion={suggestion} suggestLang={suggestLang} field="dontMd" current={dontMd}
                          onApply={(v) => setDontMd(v)} />
              <textarea value={dontMd} onChange={(e) => setDontMd(e.target.value)} rows={5}
                        style={{ ...fld, fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
                        placeholder={'- Drop link in first sentence\n- Sound salesy\n- Ignore mod rules about astrology accuracy claims'} />
              <SuggestionInline suggestion={suggestion} defaultLang={suggestLang} field="dontMd" current={dontMd}
                                setterFor={setterFor} currentFor={currentFor} />
            </div>
          </div>

          <TemplatesEditor templates={templates} onChange={setTemplates} />

          {error && (
            <div style={{ padding: 8, background: 'rgba(255,77,94,.1)', border: '1px solid rgba(255,77,94,.4)', color: 'var(--bad)', fontSize: 12, borderRadius: 5 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <div className="meta">
            {existing ? `Editing #${existing.id}` : 'New brief'}
          </div>
          <div className="modal-foot-actions">
            {existing && (
              <button className="btn danger" onClick={handleDelete} disabled={busy}
                      style={confirmDelete ? { animation: 'pulseDanger 1s ease-in-out infinite' } : undefined}>
                {confirmDelete ? '⚠ Click again to confirm' : '🗑 Delete'}
              </button>
            )}
            <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={handleSave} disabled={busy}>
              {busy ? <><Spinner size="xs" /> Saving</> : (existing ? 'Save' : 'Create brief')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplatesEditor({
  templates, onChange,
}: {
  templates: BriefTemplate[];
  onChange: (t: BriefTemplate[]) => void;
}) {
  const fld: React.CSSProperties = {
    width: '100%', padding: '6px 8px', background: 'var(--bg-2)',
    border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)',
    fontSize: 12, outline: 'none',
  };
  const update = (i: number, patch: Partial<BriefTemplate>) => {
    const next = [...templates];
    next[i] = { ...next[i]!, ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(templates.filter((_, j) => j !== i));
  const add = () => onChange([...templates, { label: '', body: '' }]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          📝 Reusable reply templates
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>{templates.length}</span>
        <span style={{ flex: 1 }} />
        <button className="btn" type="button" onClick={add} style={{ fontSize: 10, padding: '3px 8px' }}>+ Template</button>
      </div>
      {templates.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--fg-3)', padding: 8, background: 'var(--bg-2)', borderRadius: 5, border: '1px dashed var(--line)' }}>
          Chưa có template. Add 1-3 reply skeleton reusable.
        </div>
      )}
      {templates.map((t, i) => (
        <div key={i} style={{ marginTop: 6, padding: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="text" placeholder="Label (e.g. chart-reading reply)"
                   value={t.label} onChange={(e) => update(i, { label: e.target.value })}
                   style={{ ...fld, flex: 1 }} />
            <button className="btn ghost" type="button" onClick={() => remove(i)}
                    style={{ fontSize: 11, padding: '3px 8px', color: 'var(--bad)' }}>Remove</button>
          </div>
          <textarea value={t.body} onChange={(e) => update(i, { body: e.target.value })}
                    rows={3} placeholder="Reply skeleton with {variables} like in account snippets…"
                    style={{ ...fld, fontFamily: 'var(--font-mono)', resize: 'vertical' }} />
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// FieldLabel — label with optional ✨ icon when AI has a suggestion
// for this field. Click ✨ → quick "Replace" using the modal's default
// suggestion language.
// ──────────────────────────────────────────────────────────────────
function FieldLabel({
  label, hint, lbl, suggestion, suggestLang, field, current, onApply,
}: {
  label: string;
  hint?: string;
  lbl: CSSProperties;
  suggestion: BriefSuggestion | null;
  suggestLang: 'en' | 'vi';
  field: SuggestableField;
  current: string;
  onApply: (v: string) => void;
}) {
  const sug = suggestion?.[suggestLang]?.[field] ?? '';
  const hasSug = sug.trim().length > 0 && sug.trim() !== current.trim();
  return (
    <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span dangerouslySetInnerHTML={{ __html: label }} />
      {hint && <span style={{ color: 'var(--fg-4)', textTransform: 'none' }}>// {hint}</span>}
      {hasSug && (
        <button type="button"
                onClick={() => onApply(sug)}
                title={`AI có đề xuất ${suggestLang.toUpperCase()} — click để Replace ngay`}
                style={{
                  marginLeft: 'auto', fontSize: 11, padding: '0 5px',
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  border: '1px solid var(--accent-line)', borderRadius: 3,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600,
                }}>
          ✨ replace ({suggestLang.toUpperCase()})
        </button>
      )}
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────
// SuggestionInline — collapsible card BELOW each input. Shows EN + VI
// side-by-side (or per-card lang toggle in narrow space) so user reads
// both before picking. Replace / Append / Copy actions apply the
// CURRENTLY-SELECTED card language.
// ──────────────────────────────────────────────────────────────────
function SuggestionInline({
  suggestion, defaultLang, field, current, setterFor, currentFor,
}: {
  suggestion: BriefSuggestion | null;
  defaultLang: 'en' | 'vi';
  field: SuggestableField;
  current: string;
  setterFor: (k: SuggestableField) => (v: string) => void;
  currentFor: (k: SuggestableField) => string;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeLang, setActiveLang] = useState<'en' | 'vi'>(defaultLang);

  // Modal-level default switch propagates to all cards (per-card override
  // still allowed — user just clicks the card's own toggle after).
  useEffect(() => { setActiveLang(defaultLang); }, [defaultLang]);

  const sugVi = suggestion?.vi?.[field]?.trim() ?? '';
  const sugEn = suggestion?.en?.[field]?.trim() ?? '';
  if (!sugVi && !sugEn) return null;
  if ((sugVi === current.trim() || !sugVi) && (sugEn === current.trim() || !sugEn)) return null;

  const sug = activeLang === 'vi' ? sugVi : sugEn;
  const setter = setterFor(field);
  const curr = currentFor(field);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(sug); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  const handleReplace = () => setter(sug);
  const handleAppend = () => setter([curr, sug].filter(Boolean).join('\n\n'));

  return (
    <div style={{
      marginTop: 4, fontSize: 11.5, lineHeight: 1.5,
      background: 'var(--accent-soft)', border: '1px dashed var(--accent-line)',
      borderRadius: 5, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px', cursor: 'pointer',
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
      }}
           onClick={() => setOpen((o) => !o)}>
        <span>✨ AI suggestion</span>
        {/* Per-card lang switch */}
        <div onClick={(e) => e.stopPropagation()}
             style={{ display: 'inline-flex', gap: 0, padding: 1, background: 'var(--bg-1)', border: '1px solid var(--accent-line)', borderRadius: 3 }}>
          {(['vi', 'en'] as const).map((l) => {
            const txt = l === 'vi' ? sugVi : sugEn;
            const dis = !txt;
            return (
              <button key={l} type="button"
                      onClick={() => !dis && setActiveLang(l)}
                      disabled={dis}
                      title={dis ? `(${l.toUpperCase()} chưa có)` : `Switch card to ${l.toUpperCase()}`}
                      style={{
                        padding: '1px 6px', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                        background: activeLang === l ? 'var(--accent)' : 'transparent',
                        color: activeLang === l ? '#fff' : (dis ? 'var(--fg-4)' : 'var(--accent)'),
                        border: 'none', borderRadius: 2, cursor: dis ? 'not-allowed' : 'pointer',
                      }}>{l.toUpperCase()}</button>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        {open && sug && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); handleReplace(); }}
                    title={`Replace input với suggestion ${activeLang.toUpperCase()}`}
                    style={btnStyle('var(--accent)', '#fff')}>↻ Replace</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); handleAppend(); }}
                    title={`Append suggestion ${activeLang.toUpperCase()} vào sau nội dung hiện có`}
                    style={btnStyle('transparent', 'var(--accent)', 'var(--accent-line)')}>+ Append</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                    title={`Copy suggestion ${activeLang.toUpperCase()} vào clipboard`}
                    style={btnStyle('transparent', 'var(--accent)', 'var(--accent-line)')}>
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </>
        )}
        <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && sug && (
        <pre style={{
          margin: 0, padding: '6px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5,
          color: 'var(--fg-1)', background: 'var(--bg-1)',
          borderTop: '1px dashed var(--accent-line)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{sug}</pre>
      )}
    </div>
  );
}

function btnStyle(bg: string, fg: string, border?: string): CSSProperties {
  return {
    fontSize: 9.5, padding: '2px 7px', fontFamily: 'var(--font-mono)', fontWeight: 600,
    background: bg, color: fg, border: `1px solid ${border ?? bg}`,
    borderRadius: 3, cursor: 'pointer',
  };
}

function fmtAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60)         return `${diffSec}s ago`;
  if (diffSec < 3600)       return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400)      return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}
