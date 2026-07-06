// Prompt builder for backlink-placement content pieces. Extracted from actions/ai-content.ts
// so BOTH the admin drawer (session-authed server action) AND the Crew ext endpoint
// (token-authed /api/ext/tasks/[id]/gen-content) fuse identical context into the same brief.
// Plain module (NOT 'use server') → exports a sync helper the ext route can import directly.

export interface AiContentCtx {
  projectName: string; website?: string; oneLiner?: string; bio?: string;
  platformLabel?: string; mechanism?: string; instructions?: string;
}

// The single place that fuses every requirement + context into one brief.
export function buildContentPrompt(ctx: AiContentCtx, kind: string, extra: string): string {
  const site = (ctx.website || '').replace(/\/$/, '');
  // Email/outreach genre: resource-page & editorial-pitch tasks need a real email to a
  // site owner/librarian, not an "off-site post". Detected from the requested piece.
  if (/\b(email|outreach|pitch)\b/i.test(kind)) {
    const followUp = /\b(follow-?up|nudge|reminder|remind)\b/i.test(kind);
    return [
      followUp
        ? `Write ONE short, friendly FOLLOW-UP email nudging the owner/editor/librarian about an earlier email you already sent suggesting our free tool for their resource list. They have not replied yet. Output ENGLISH only.`
        : `Write ONE outreach email to the owner/editor/librarian of an external resource page, asking them to add our free tool to their list of resources. Output ENGLISH only.`,
      extra ? `EXTRA REQUIREMENTS: ${extra}` : '',
      ``,
      `PRODUCT: ${ctx.projectName}${site ? ` (${site})` : ''}`,
      ctx.oneLiner ? `WHAT IT DOES: ${ctx.oneLiner}` : '',
      ctx.platformLabel ? `RECIPIENT SITE / PAGE: ${ctx.platformLabel}` : '',
      ctx.mechanism ? `WHERE/WHY IT FITS: ${ctx.mechanism}` : '',
      ctx.instructions ? `TASK NOTES (internal, Vietnamese — obey them):\n${ctx.instructions}` : '',
      ``,
      `RULES:`,
      `- Format EXACTLY: first line "Subject: <short specific subject>", then a blank line, then the body.`,
      followUp
        ? `- Body = 2-3 short sentences ONLY: lightly reference your earlier note, a one-line reminder of the free tool + its value, a soft ask if they would consider adding it. Do NOT re-pitch in full or paste the whole description again. Sign off with a generic first name.`
        : `- Body = 4-7 short sentences: a warm greeting, note that you came across their specific page/resource, introduce the free tool in one line, one sentence on why it genuinely helps their audience (students / veterans / retirees / applicants as relevant), state it is free with no signup, offer the link${site ? ` (${site})` : ''}, thank them. Sign off with a generic first name.`,
      `- Human and specific: reference something concrete about their page if the notes name it. No "I hope this email finds you well", no marketing fluff, no em dashes (use "-"), vary sentence length.`,
      `- Do NOT mention SEO, backlinks, or link building. This is a genuine resource suggestion.`,
      `Return ONLY the email (Subject line + body), no preamble, no explanation.`,
    ].filter((l) => l !== '').join('\n');
  }
  return [
    `Produce ONE ready-to-post piece of content for an off-site backlink placement. Output ENGLISH only.`,
    ``,
    `WHAT TO PRODUCE: ${kind}`,
    extra ? `EXTRA REQUIREMENTS: ${extra}` : '',
    ``,
    `PRODUCT: ${ctx.projectName}${site ? ` (${site})` : ''}`,
    ctx.oneLiner ? `ONE-LINER: ${ctx.oneLiner}` : '',
    ctx.bio ? `BIO: ${ctx.bio}` : '',
    ctx.platformLabel ? `PLATFORM: ${ctx.platformLabel}` : '',
    ctx.mechanism ? `MECHANISM: ${ctx.mechanism}` : '',
    ctx.instructions ? `FULL BUILD INSTRUCTIONS (internal, Vietnamese — obey them):\n${ctx.instructions}` : '',
    ``,
    `RULES:`,
    `- Match the platform's norms and the specific piece requested (a title is short; a comment is conversational; a bio is tight; an answer is helpful and specific).`,
    `- Human voice: no em dashes (use "-"), no "in today's fast-paced world", no "delve", vary sentence length, sound like a real practitioner.`,
    site ? `- If (and only if) this piece should carry the link, reference ${ctx.projectName} and include ${site} naturally, once. Do not spam the URL.` : '',
    `- Do not mention that this is for a backlink or SEO.`,
    `Return ONLY the content, no preamble, no explanation.`,
  ].filter((l) => l !== '').join('\n');
}
