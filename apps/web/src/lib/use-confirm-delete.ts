'use client';

// useConfirmDelete — 2-step destructive action pattern (click → "thực sự?"
// → click lại → execute). See feedback_destructive_actions.md.
//
// Used in 9+ files. Pattern before:
//   const [confirmDelete, setConfirmDelete] = useState(false);
//   const handle = () => {
//     if (!confirmDelete) {
//       setConfirmDelete(true);
//       setTimeout(() => setConfirmDelete(false), 4000);
//       return;
//     }
//     doDelete();
//   };
//
// After:
//   const del = useConfirmDelete(() => doDelete());
//   <button onClick={del.trigger}>
//     {del.confirming ? '⚠ Click lần nữa' : '🗑 Delete'}
//   </button>

import { useCallback, useRef, useState } from 'react';

export interface UseConfirmDelete {
  /** Currently in "confirm armed" state */
  confirming: boolean;
  /** First click arms (returns false), second click within window executes (returns true). */
  trigger: () => boolean;
  /** Manually disarm (e.g. when modal closes or unmounts) */
  reset: () => void;
}

export function useConfirmDelete(
  onConfirm: () => void,
  /** Window in ms to disarm if no second click. Default 4000. */
  windowMs = 4000,
): UseConfirmDelete {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  const reset = useCallback(() => {
    clearTimer();
    setConfirming(false);
  }, []);

  const trigger = useCallback((): boolean => {
    if (confirming) {
      clearTimer();
      setConfirming(false);
      onConfirm();
      return true;
    }
    setConfirming(true);
    timer.current = setTimeout(() => setConfirming(false), windowMs);
    return false;
  }, [confirming, onConfirm, windowMs]);

  return { confirming, trigger, reset };
}
