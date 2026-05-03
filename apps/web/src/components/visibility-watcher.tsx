'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function VisibilityWatcher({ initialVersion }: { initialVersion: number }) {
  const router = useRouter();
  const versionRef = useRef(initialVersion);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/me/config-version', { cache: 'no-store' });
        if (!res.ok) return;
        const { version } = await res.json();
        if (version !== versionRef.current) {
          versionRef.current = version;
          router.refresh();
        }
      } catch {
        // Silently ignore fetch errors (offline, etc.)
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
