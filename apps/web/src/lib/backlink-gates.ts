// Single source of truth for how a source's learned `automation` level is classified + rendered.
// Imported by BOTH the server action (reportSourceOutcome) and the plays UI (badge / panel / drawer) so
// "which automation needs a human", its icon/label/colour, live in ONE place — no divergent copies.
// Pure module (NOT 'use server') so it can export objects the actions and components share.

export type Automation = 'auto' | 'assisted' | 'manual' | 'blocked' | 'dead';

export interface AutomationMeta { icon: string; label: string; color: string; needsHuman: boolean }

export const AUTOMATION_META: Record<string, AutomationMeta> = {
  auto: { icon: '🤖', label: 'auto', color: '#22c55e', needsHuman: false },
  assisted: { icon: '🖐', label: 'assisted', color: '#ffb03c', needsHuman: true },
  manual: { icon: '🖐', label: 'manual', color: '#ffb03c', needsHuman: true },
  blocked: { icon: '🚫', label: 'blocked', color: 'var(--bad,#ef4444)', needsHuman: true },
  dead: { icon: '⛔', label: 'dead', color: 'var(--bad,#ef4444)', needsHuman: false },
};

export function automationNeedsHuman(a?: string | null): boolean {
  return !!a && !!AUTOMATION_META[a]?.needsHuman;
}

// Should this automation level get a badge on a task card? Everything except plain 'auto' (nothing to flag).
export function automationBadge(a?: string | null): AutomationMeta | null {
  return a && a !== 'auto' ? AUTOMATION_META[a] ?? null : null;
}
