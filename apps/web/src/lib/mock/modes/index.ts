import type { Mode } from '../types';
import { MODES_BASE } from './base';
import { MODES_EXTRA } from './extra';

export const MODES: Record<string, Mode> = { ...MODES_BASE, ...MODES_EXTRA };

export function getMode(id: string): Mode {
  return MODES[id] ?? (MODES.affiliate as Mode);
}
