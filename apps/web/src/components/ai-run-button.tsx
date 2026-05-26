'use client';

// AIRunButton — button gọi AI action với UX "click → popover chọn model → run".
//
// Lý do refactor (2026-05-26): trước đây Sinh draft / Sinh ảnh / Regen
// suggestion ở nhiều nơi đều có 1 button + chip chọn model BÊN CẠNH → user
// phải nhớ đổi model TRƯỚC khi click. Quên = chạy với model default → tốn
// token / mất time. Giờ click button = popup model picker, default highlight
// preference cũ + giá đầy đủ → chọn explicit mới chạy.
//
// API:
//   <AIRunButton
//     label="✨ Sinh draft đầy đủ"
//     busyLabel="Đang sinh draft"
//     prefKey="mos2.draft.textModel"          // localStorage key remember choice
//     defaultModelId="o4-mini"
//     options={TEXT_MODELS}                   // catalog từ lib/ai/model-options
//     onRun={(modelId) => handleGenerate(modelId)}
//     disabled={someCondition}
//     variant="primary"
//   />

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Spinner } from './ui';
import { costBadge, formatPrice, modelTooltip, type ModelOption } from '@/lib/ai/model-options';

export interface AIRunButtonProps {
  /** Text khi idle (vd "✨ Sinh draft đầy đủ"). */
  label: string;
  /** Text khi busy (vd "Đang sinh draft"). */
  busyLabel: string;
  /** localStorage key remember last model choice across sessions. */
  prefKey: string;
  /** Default model id nếu localStorage trống. */
  defaultModelId: string;
  /** Model catalog (TEXT_MODELS hoặc IMAGE_MODELS). */
  options: ModelOption[];
  /** Hàm gọi action — nhận modelId user đã chọn. Phải trả Promise. */
  onRun: (modelId: string) => Promise<void> | void;
  /** Tooltip cho button (giải thích action sẽ làm gì). */
  title?: string;
  /** Disabled state ngoài (vd thiếu data). Mặc định KHÔNG disabled — busy
   *  tự handle qua state nội bộ. */
  disabled?: boolean;
  /** Visual variant: 'primary' (highlight) hoặc 'secondary' (mờ hơn). */
  variant?: 'primary' | 'secondary';
  /** Tự đóng popover sau khi click model (default true). False = giữ mở để
   *  user chọn nhiều lần (vd "3 phương án" cần variant model). */
  closeOnPick?: boolean;
}

export function AIRunButton({
  label, busyLabel, prefKey, defaultModelId, options, onRun, title,
  disabled = false, variant = 'primary', closeOnPick = true,
}: AIRunButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pref, setPref] = useState<string>(defaultModelId);
  const [hydrated, setHydrated] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Hydrate preference từ localStorage. Validate ID có trong options
  // (model bị loại khỏi catalog → reset về default).
  useEffect(() => {
    setHydrated(true);
    try {
      const stored = window.localStorage.getItem(prefKey);
      const validIds = new Set(options.map((m) => m.id));
      if (stored && validIds.has(stored)) setPref(stored);
      else if (stored && !validIds.has(stored)) {
        window.localStorage.setItem(prefKey, defaultModelId);
      }
    } catch { /* SSR or private mode */ }
    // options identity change → re-validate (rare, only on hot-reload).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefKey, defaultModelId]);

  // Click outside → close popover
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Defer 1 tick để click open không tự close ngay.
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [open]);

  const handlePick = async (modelId: string) => {
    if (hydrated) {
      try { window.localStorage.setItem(prefKey, modelId); } catch { /* ignore */ }
    }
    setPref(modelId);
    if (closeOnPick) setOpen(false);
    setBusy(true);
    try {
      const ret = onRun(modelId);
      if (ret instanceof Promise) await ret;
    } finally {
      setBusy(false);
    }
  };

  const buttonStyle: CSSProperties = variant === 'primary'
    ? { fontSize: 11, padding: '4px 11px', fontWeight: 700 }
    : { fontSize: 11, padding: '4px 11px' };

  return (
    <span ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button"
              className={variant === 'primary' ? 'btn primary' : 'btn'}
              onClick={() => setOpen((v) => !v)}
              disabled={disabled || busy}
              title={title ? `${title}\n\nClick để chọn model + chạy. Lần chọn cuối: ${pref}.` : `Click để chọn model + chạy. Lần cuối: ${pref}.`}
              style={buttonStyle}>
        {busy ? <><Spinner size="xs" /> {busyLabel}</> : label}
      </button>
      {open && (
        <ModelPickerPopover options={options} currentId={pref} onPick={handlePick} onClose={() => setOpen(false)} />
      )}
    </span>
  );
}

// Popover render model list with name + hint + price detail + reasoning flag.
function ModelPickerPopover({
  options, currentId, onPick, onClose,
}: {
  options: ModelOption[];
  currentId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div role="dialog" aria-label="Chọn AI model"
         style={{
           position: 'absolute', top: '100%', left: 0, zIndex: 2000,
           marginTop: 4, padding: 6, minWidth: 360, maxWidth: 480,
           background: 'var(--bg-1)', border: '1px solid var(--accent-line)',
           borderRadius: 8, boxShadow: '0 10px 32px rgba(0,0,0,.5)',
           maxHeight: 460, overflowY: 'auto',
         }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 8px',
                    borderBottom: '1px dashed var(--accent-line)',
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
                    textTransform: 'uppercase', letterSpacing: '.06em' }}>
        <span style={{ flex: 1 }}>🤖 Chọn AI model</span>
        <button type="button" onClick={onClose}
                title="Hủy — không chạy"
                style={{ fontSize: 9, padding: '1px 6px', background: 'transparent', color: 'var(--fg-3)',
                         border: '1px solid var(--line)', borderRadius: 3, cursor: 'pointer',
                         fontFamily: 'var(--font-mono)' }}>
          ✕ hủy
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
        {options.map((m) => {
          const isCur = m.id === currentId;
          return (
            <button key={m.id} type="button"
                    onClick={() => onPick(m.id)}
                    title={modelTooltip(m)}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto',
                      gap: 8, alignItems: 'center',
                      padding: '7px 9px', cursor: 'pointer',
                      background: isCur ? 'var(--accent-soft)' : 'transparent',
                      border: `1px solid ${isCur ? 'var(--accent-line)' : 'transparent'}`,
                      borderRadius: 5, textAlign: 'left',
                      fontFamily: 'var(--font-sans)',
                    }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)',
                              display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.label}
                  {m.reasoning && (
                    <span title="Reasoning model — có thinking phase"
                          style={{ fontSize: 9, padding: '0 4px', background: 'rgba(167,139,250,.2)',
                                   color: '#a78bfa', borderRadius: 2, fontWeight: 700,
                                   fontFamily: 'var(--font-mono)' }}>
                      🧠 reasoning
                    </span>
                  )}
                  {isCur && (
                    <span style={{ fontSize: 9, padding: '0 4px', background: 'var(--accent)',
                                   color: '#fff', borderRadius: 2, fontWeight: 700,
                                   fontFamily: 'var(--font-mono)' }}>
                      ✓ DEFAULT
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>
                  {m.hint}
                </div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)',
                             fontWeight: 700, whiteSpace: 'nowrap' }}
                    title="Đơn giá">
                💰 {formatPrice(m)}
              </span>
              <span style={{ fontSize: 10, color: m.cost === 'cheap' ? 'var(--ok)' : m.cost === 'mid' ? 'var(--fg-2)' : 'var(--warn)',
                             fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                    title={`Cost tier: ${m.cost}`}>
                {costBadge(m.cost)}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ padding: '6px 8px 2px', fontSize: 9, color: 'var(--fg-4)',
                    fontFamily: 'var(--font-mono)', fontStyle: 'italic' }}>
        💡 Click model bất kỳ để chạy ngay. Lần sau sẽ nhớ lựa chọn này.
      </div>
    </div>
  );
}
