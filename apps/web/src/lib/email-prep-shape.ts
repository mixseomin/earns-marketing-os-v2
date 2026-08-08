// Shape + empty default for an email-issue send package. PLAIN module (deliberately NOT 'use server')
// so the value export EMPTY_EMAIL_PREP can be imported by BOTH the server-action file and client
// components. A 'use server' file may only export async functions — exporting this object from there
// crashes at runtime ("A 'use server' file can only export async functions, found object") and takes
// down every page that imports the email-prep chain (/plays, /communities). See email-prep.ts.

// A cited source for a news claim in the email. Stored ON the task so any claim is verifiable.
// Rule: news must be fresh - a source dated more than MAX_SOURCE_AGE_DAYS before the write date is
// "stale" and cannot back a news claim. `date` is the source's publication date (YYYY-MM-DD).
export interface EmailSource {
  title: string;
  url: string;            // link to the reference (internal knowledge/wiki entry or the real article)
  date: string;           // 'YYYY-MM-DD' publication date - drives the freshness check
  publisher?: string;
}

export const MAX_SOURCE_AGE_DAYS = 31; // "không cũ quá 1 tháng" from the write date

// Age in whole days of a source relative to `ref` (default = now = the write date). null = unparseable.
export function sourceAgeDays(date: string, ref: Date = new Date()): number | null {
  const d = new Date(`${date}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return Math.floor((ref.getTime() - d.getTime()) / 86400000);
}
// Fresh = dated on/before the write date and within the max age window.
export function isFreshSource(date: string, ref?: Date): boolean {
  const a = sourceAgeDays(date, ref);
  return a !== null && a >= 0 && a <= MAX_SOURCE_AGE_DAYS;
}

export interface EmailPrep {
  fromName: string;
  fromEmail: string;
  subject: string;        // primary subject line
  subjectB: string;       // optional A/B variant
  preheader: string;      // inbox preview text
  bodyMd: string;         // the real email body (what recipients read)
  keyPoints: string[];    // 3-5 short bullets = the email's main beats (so you know its gist at a glance)
  sources: EmailSource[]; // ≥1 required to back the news; each must be fresh (≤MAX_SOURCE_AGE_DAYS)
  listName: string;       // e.g. "MilitaryCalc list"
  segment: string;        // e.g. "Engaged (opened ≤90d)"
  recipientCount: string; // e.g. "~800"
  listTotal: string;      // e.g. "11,028"
  // Send DATE is NOT here — it lives on the card schedule (siteScheduledAt / the calendar) and
  // shifts with strategy. Only the time-of-day lives here: the "golden hour" from analysing when
  // the audience actually opens, constant across whatever date the issue lands on.
  sendTime: string;       // 'HH:mm' local time-of-day
  sendTimeWhy: string;    // why this hour (demand analysis note)
  provider: string;       // e.g. "Mailjet"
  offerLabel: string;
  offerUrl: string;
  status: 'draft' | 'ready';
}

export const EMPTY_EMAIL_PREP: EmailPrep = {
  fromName: '', fromEmail: '', subject: '', subjectB: '', preheader: '', bodyMd: '', keyPoints: [], sources: [],
  listName: '', segment: '', recipientCount: '', listTotal: '', sendTime: '', sendTimeWhy: '', provider: 'Mailjet',
  offerLabel: '', offerUrl: '', status: 'draft',
};
