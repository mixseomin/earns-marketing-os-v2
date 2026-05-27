'use client';

// LocalStorage-backed filter presets cho tab 'Tất cả bài đăng' trong /seeding.
// Scope per-project. User save bộ filter hiện tại + đặt tên → chip xuất hiện
// trong toolbar để 1-click apply.
//
// Key format: 'mos2.seeding.posts.presets.<projectId>' → JSON array.

import type { AllPostedFilters } from '@/lib/actions/brief-posts';

export interface PostsTabPreset {
  id: string;          // uuid hoặc timestamp-based
  name: string;
  icon?: string;       // emoji optional
  filters: AllPostedFilters;
  createdAt: number;   // ms epoch
}

function keyFor(projectId: string): string {
  return `mos2.seeding.posts.presets.${projectId}`;
}

export function loadPresets(projectId: string): PostsTabPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(keyFor(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is PostsTabPreset =>
      p && typeof p.id === 'string' && typeof p.name === 'string' && p.filters
    );
  } catch {
    return [];
  }
}

export function savePresets(projectId: string, presets: PostsTabPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyFor(projectId), JSON.stringify(presets));
  } catch (e) {
    console.warn('[mos2] savePresets failed', e);
  }
}

export function addPreset(projectId: string, name: string, filters: AllPostedFilters, icon?: string): PostsTabPreset {
  const preset: PostsTabPreset = {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'Untitled',
    icon: icon?.trim() || undefined,
    filters,
    createdAt: Date.now(),
  };
  const list = loadPresets(projectId);
  list.push(preset);
  savePresets(projectId, list);
  return preset;
}

export function removePreset(projectId: string, id: string): void {
  const list = loadPresets(projectId).filter((p) => p.id !== id);
  savePresets(projectId, list);
}
