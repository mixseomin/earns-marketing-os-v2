// Shape + empty default for an email-issue send package. PLAIN module (deliberately NOT 'use server')
// so the value export EMPTY_EMAIL_PREP can be imported by BOTH the server-action file and client
// components. A 'use server' file may only export async functions — exporting this object from there
// crashes at runtime ("A 'use server' file can only export async functions, found object") and takes
// down every page that imports the email-prep chain (/plays, /communities). See email-prep.ts.

export interface EmailPrep {
  fromName: string;
  fromEmail: string;
  subject: string;        // primary subject line
  subjectB: string;       // optional A/B variant
  preheader: string;      // inbox preview text
  bodyMd: string;         // the real email body (what recipients read)
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
  fromName: '', fromEmail: '', subject: '', subjectB: '', preheader: '', bodyMd: '',
  listName: '', segment: '', recipientCount: '', listTotal: '', sendTime: '', sendTimeWhy: '', provider: 'Mailjet',
  offerLabel: '', offerUrl: '', status: 'draft',
};
