'use client';

// Pillar picker chip cho card header (giống ChannelPickerChip pattern).
// Click chip → dropdown list pillars của project + option "(kế thừa brief)"
// + "(không gắn pillar)". Mark mismatch language để user thấy warning.

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  listProjectPillarsCompact, getCardPillarContext, setCardPillar,
  type PillarPickerOption,
} from '@/lib/actions/content-pillars';

interface Props {
  cardId: number;
  projectId: string;
  initialPillarId: number | null;
  initialPillarName: string | null;
  // Preloaded từ parent: pillars list + brief default → skip fetch riêng
  preloadedPillars?: PillarPickerOption[] | null;
  preloadedBriefPillarId?: number | null;
  preloadedTargetLang?: string;
  onChange?: (pillarId: number | null, pillarName: string | null) => void;
  onAfterChange?: () => void;            // bump để pill voice re-fetch
}

export function PillarPickerChip({
  cardId, projectId, initialPillarId, initialPillarName,
  preloadedPillars, preloadedBriefPillarId, preloadedTargetLang,
  onChange, onAfterChange,
}: Props) {
  // Tất cả hooks declared trước early return (Rules of Hooks)
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pillars, setPillars] = useState<PillarPickerOption[] | null>(preloadedPillars ?? null);
  const [currentId, setCurrentId] = useState<number | null>(initialPillarId);
  const [currentName, setCurrentName] = useState<string | null>(initialPillarName);
  const [briefPillarId, setBriefPillarId] = useState<number | null>(preloadedBriefPillarId ?? null);
  const [targetLang, setTargetLang] = useState<string>(preloadedTargetLang ?? 'en');
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const [, startTransition] = useTransition();
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const recomputePos = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setDropPos({ top: r.bottom + 4, left: r.left });
  };

  useEffect(() => {
    if (!open) return;
    recomputePos();
    const handler = () => recomputePos();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open]);

  // Fetch riêng CHỈ KHI parent không truyền preloaded (backward compat).
  useEffect(() => {
    if (preloadedPillars !== undefined && preloadedPillars !== null) {
      // Parent đã preload — bỏ fetch
      setPillars(preloadedPillars);
      if (preloadedBriefPillarId !== undefined) setBriefPillarId(preloadedBriefPillarId);
      if (preloadedTargetLang) setTargetLang(preloadedTargetLang);
      return;
    }
    let cancel = false;
    Promise.all([
      listProjectPillarsCompact(projectId),
      getCardPillarContext(cardId),
    ]).then(([pillarList, ctxRes]) => {
      if (cancel) return;
      setPillars(pillarList);
      if (ctxRes.ok) {
        setBriefPillarId(ctxRes.ctx.briefPillarId);
        setTargetLang(ctxRes.ctx.targetLang);
      }
    }).catch(() => {});
    return () => { cancel = true; };
  }, [projectId, cardId, preloadedPillars, preloadedBriefPillarId, preloadedTargetLang]);

  // Ẩn chip trong các case sau (giảm noise — pillar là tính năng advanced):
  // 1. Project chưa có pillar nào (CPS chưa setup)
  // 2. Card chưa gắn pillar VÀ brief chưa có pillar default
  //    → User chưa quan tâm pillar cho bài này → không hiện chip
  //    → Muốn add pillar: vào card expanded → có button riêng
  if (pillars !== null && pillars.length === 0) return null;
  const effectivePillarId = currentId ?? briefPillarId;
  if (effectivePillarId == null) return null;     // chưa gắn pillar nào → ẩn

  const effective = pillars?.find((p) => p.id === effectivePillarId) ?? null;
  const isInherited = currentId == null && briefPillarId != null;
  const label = effective ? effective.name.slice(0, 24) : '…';
  const labelColor = isInherited ? 'var(--ok)' : 'var(--neon-violet)';
  void currentName;       // suppress unused warning (currentName tracked via setCurrentName)

  // Language mismatch warning cho effective pillar
  const langMismatch = effective && effective.languages.length > 0
    && !effective.languages.includes(targetLang);

  const pickPillar = async (id: number | null) => {
    // null = clear override (về inherit brief). Nếu user pick id giống brief default → cũng clear (vì inherit = same kết quả).
    const newId = id === briefPillarId ? null : id;
    if (newId === currentId) { setOpen(false); return; }
    setBusy(true);
    try {
      const res = await setCardPillar(projectId, cardId, newId);
      if (!res.ok) { setBusy(false); return; }
      setCurrentId(newId);
      const pickedName = id != null ? pillars?.find((p) => p.id === id)?.name ?? null : null;
      setCurrentName(pickedName);
      onChange?.(newId, pickedName);
      onAfterChange?.();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button ref={btnRef} type="button"
              onClick={() => { recomputePos(); setOpen((v) => !v); }}
              disabled={busy}
              title={effective
                ? `Trụ cột: ${effective.name}${effective.tagline ? `\n"${effective.tagline}"` : ''}\n${isInherited ? '⇣ Kế thừa từ brief (chưa ghi đè)' : '✎ Ghi đè cho riêng bài này'}${langMismatch ? `\n⚠ Trụ cột chỉ hỗ trợ [${effective.languages.join(', ')}], bài target ${targetLang}` : ''}\nClick để đổi trụ cột.`
                : 'Bài này chưa gắn trụ cột. Click để chọn trụ cột.'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', fontSize: 11, fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                background: effective
                  ? (isInherited ? 'rgba(74,222,128,0.10)' : 'rgba(157,108,255,0.12)')
                  : 'var(--bg-2)',
                color: labelColor,
                border: `1px solid ${effective ? (isInherited ? 'rgba(74,222,128,0.35)' : 'rgba(157,108,255,0.4)') : 'var(--line)'}`,
                borderRadius: 4,
                cursor: busy ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}>
        <span>📚</span>
        <span>{label}</span>
        {isInherited && <span style={{ fontSize: 9, opacity: 0.7 }}>kế thừa</span>}
        {langMismatch && <span title="Sai ngôn ngữ trụ cột" style={{ color: 'var(--bad)' }}>⚠</span>}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>

      {open && dropPos && (
        <>
          <div onClick={() => setOpen(false)}
               style={{ position: 'fixed', inset: 0, zIndex: 1100 }} />
          <div style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 1101,
            minWidth: 340, maxWidth: 480, maxHeight: 400,
            background: 'var(--bg-1)', border: '1px solid var(--accent-line)',
            borderRadius: 6, padding: 4,
            display: 'flex', flexDirection: 'column', gap: 2,
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {/* Option: clear (về inherit brief OR no pillar) */}
            <button type="button" onClick={() => pickPillar(null)}
                    style={rowStyle(currentId == null, false)}>
              <span style={{ fontWeight: 700, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                {briefPillarId != null ? `(kế thừa brief)` : `(không gắn trụ cột)`}
              </span>
              {briefPillarId != null && (
                <span style={{ fontSize: 9.5, color: 'var(--fg-4)', fontStyle: 'italic' }}>
                  → {pillars?.find((p) => p.id === briefPillarId)?.name ?? `#${briefPillarId}`}
                </span>
              )}
              {currentId == null && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)' }}>✓</span>}
            </button>
            <div style={{ height: 1, background: 'var(--line)', margin: '2px 4px' }} />
            {pillars?.map((p) => {
              const mismatch = p.languages.length > 0 && !p.languages.includes(targetLang);
              const isCurrent = currentId === p.id || (currentId == null && briefPillarId === p.id);
              return (
                <button key={p.id} type="button"
                        onClick={() => pickPillar(p.id)}
                        title={p.tagline ? `"${p.tagline}"\n\nGiọng: ${p.voiceLabel}\nNgôn ngữ: ${p.languages.join(', ')}\nLoại nội dung ưu tiên: ${p.preferredTypes.join(', ')}` : undefined}
                        style={rowStyle(isCurrent, false)}>
                  <span style={{ fontWeight: 700, color: 'var(--accent)',
                                 fontFamily: 'var(--font-mono)',
                                 minWidth: 80, maxWidth: 180,
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <span title={`Giọng: ${p.voiceLabel}`}
                        style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600 }}>
                    {p.voiceIcon} {p.voiceLabel}
                  </span>
                  {p.languages.length > 0 && (
                    <span title={`Ngôn ngữ: ${p.languages.join(', ')}`}
                          style={{ fontSize: 9, color: mismatch ? 'var(--bad)' : 'var(--fg-3)',
                                   fontFamily: 'var(--font-mono)' }}>
                      {p.languages.join('·')}
                    </span>
                  )}
                  {mismatch && <span title={`Sai ngôn ngữ: bài target ${targetLang} nhưng trụ cột chỉ hỗ trợ [${p.languages.join(', ')}]`}
                                     style={{ fontSize: 9, color: 'var(--bad)' }}>⚠</span>}
                  {p.tagline && (
                    <span style={{ flex: 1, fontSize: 9.5, color: 'var(--fg-4)', fontStyle: 'italic',
                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.tagline}
                    </span>
                  )}
                  {isCurrent && <span style={{ fontSize: 10, color: 'var(--accent)' }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function rowStyle(isCurrent: boolean, isSuggested: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 8px', fontSize: 11,
    background: isCurrent ? 'var(--accent-soft)' : isSuggested ? 'rgba(74,222,128,0.05)' : 'transparent',
    border: 'none', borderRadius: 4, cursor: 'pointer',
    color: 'var(--fg-1)', textAlign: 'left' as const, width: '100%',
  };
}
