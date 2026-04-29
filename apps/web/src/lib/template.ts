// Variable substitution for content snippet templates.
// Replaces {{key}} with vars[key] when defined; leaves the placeholder
// literal otherwise so user can fill manually after copy.

export function fillTemplate(text: string, vars: Record<string, string | undefined | null>): string {
  return text.replace(/\{\{(\w[\w\s\-]*)\}\}/g, (match, key: string) => {
    const v = vars[key.trim()];
    return v != null && v !== '' ? String(v) : match;
  });
}
