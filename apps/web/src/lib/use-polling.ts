// usePolling — call router.refresh() on a fixed interval to re-fetch all
// server data (the whole RSC payload). Honors Page Visibility API: pauses
// when tab is hidden, resumes on focus.
//
// Why router.refresh: it re-runs the server component tree but reuses
// React state on the client side. Cheaper than a full reload, simpler
// than wiring per-data-source SWR. Acceptable for 30s cadence.

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface PollingOptions {
  intervalMs: number;
  enabled?: boolean;
}

export interface PollingState {
  /** Unix ms of last successful refresh. null = no refresh yet. */
  lastRefreshAt: number | null;
  /** Whether the tab is currently visible (polling is active). */
  visible: boolean;
  /** Trigger a refresh now (skips waiting for next tick). */
  refreshNow: () => void;
}

export function usePolling({ intervalMs, enabled = true }: PollingOptions): PollingState {
  const router = useRouter();
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doRefresh = () => {
    router.refresh();
    setLastRefreshAt(Date.now());
  };

  // Track Page Visibility — pause when tab hidden to save bandwidth + battery.
  useEffect(() => {
    const onVis = () => {
      const v = document.visibilityState === 'visible';
      setVisible(v);
      if (v) doRefresh(); // immediate refresh on focus to catch up
    };
    document.addEventListener('visibilitychange', onVis);
    setVisible(document.visibilityState === 'visible');
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start/stop interval based on enabled + visible.
  useEffect(() => {
    if (!enabled || !visible) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = setInterval(doRefresh, intervalMs);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, visible, intervalMs]);

  return { lastRefreshAt, visible, refreshNow: doRefresh };
}
