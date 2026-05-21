'use client';

// useCopyToClipboard — shared hook replacing the navigator.clipboard.writeText
// + setCopied + setTimeout pattern duplicated in 7+ files
// (inbox-page, accounts-vault, brief-edit-modal, dispatch-post-flow,
//  technology-picker, team-page, settings-index).
//
// Behavior:
//   - copy(text) → returns true on success, false on failure
//   - `copied` / `error` state auto-clear after `duration` ms (default 1500)
//   - Single source of clipboard handling = consistent UX across the app

import { useCallback, useState } from 'react';

export interface UseCopyToClipboard {
  copied: boolean;
  error: boolean;
  /** Returns true on success, false on failure (browser permission denied, http context, etc.) */
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

export function useCopyToClipboard(duration = 1500): UseCopyToClipboard {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(false);
      setTimeout(() => setCopied(false), duration);
      return true;
    } catch {
      setError(true);
      setTimeout(() => setError(false), duration + 800);
      return false;
    }
  }, [duration]);

  const reset = useCallback(() => {
    setCopied(false);
    setError(false);
  }, []);

  return { copied, error, copy, reset };
}
