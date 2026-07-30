import type { Project } from './mock/types';

export function domainOf(website?: string | null): string {
  return (website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim();
}

// Default {{variables}} for a project's referenced knowledge templates. Resolved via
// lib/template.ts fillTemplate; per-project overrides (refs[projectId]) win over these.
// Unset tokens stay literal so the shared template still reads sensibly everywhere.
export function projectKnowledgeVars(
  project: Pick<Project, 'id' | 'name' | 'website' | 'oneLiner' | 'bio' | 'persona' | 'hashtags'>,
): Record<string, string> {
  const domain = domainOf(project.website);
  return {
    product: project.name,
    name: project.name,
    slug: project.id,
    domain,
    website: project.website || (domain ? `https://${domain}` : ''),
    'one-liner': project.oneLiner || '',
    oneLiner: project.oneLiner || '',
    bio: project.bio || '',
    persona: project.persona || '',
    hashtags: project.hashtags || '',
    audience: project.persona || '',
  };
}

// The {{tokens}} a template actually uses — for the catalog editor's "variables" hint.
export function detectTemplateVars(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\{\{(\w[\w\s-]*)\}\}/g)) out.add(m[1].trim());
  return [...out];
}
