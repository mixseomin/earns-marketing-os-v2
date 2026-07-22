import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { readSeeds, writeSeeds, type WarmupSeed } from '@/lib/warmup-seeds-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Sensible IMAP/SMTP defaults per provider so the form only needs email + app-password.
const PRESET: Record<string, Partial<WarmupSeed>> = {
  gmail: { imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 587 },
  outlook: { imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp-mail.outlook.com', smtpPort: 587 },
  yahoo: { imapHost: 'imap.mail.yahoo.com', imapPort: 993, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 587 },
};

// A public email address belongs to exactly one provider — derive it from the domain so a
// gmail.com address can't be saved with Outlook's IMAP host (which would fail login).
// Returns null for custom domains (e.g. Google Workspace on your own domain) → trust the picker.
function providerFromEmail(email: string): WarmupSeed['provider'] | null {
  const dom = (email.split('@')[1] || '').toLowerCase();
  if (/^(gmail|googlemail)\.com$/.test(dom)) return 'gmail';
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(dom)) return 'outlook';
  if (/^(yahoo|ymail|rocketmail)\.[a-z.]+$/.test(dom)) return 'yahoo';
  return null;
}

async function admin() { const me = await getCurrentUser(); return me && me.role === 'admin'; }

// GET → list seeds with the password concealed (never leave the box).
export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const seeds = await readSeeds();
  return NextResponse.json({ seeds: seeds.map(({ pass, ...s }) => ({ ...s, hasPass: !!pass })) });
}

// POST { id?, provider, email, pass, imapHost?, ... } → add or update a seed.
export async function POST(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Partial<WarmupSeed>;
  const email = (b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  // Email domain wins over the picker when it clearly identifies a provider (prevents
  // gmail.com being saved as Outlook). Custom domains fall back to the picked provider.
  const known = providerFromEmail(email);
  const provider = known || ((b.provider || 'other') as WarmupSeed['provider']);
  const preset = PRESET[provider] || {};
  const list = await readSeeds();
  const existing = b.id ? list.find((s) => s.id === b.id) : list.find((s) => s.email === email);
  const seed: WarmupSeed = {
    id: existing?.id || randomUUID(),
    provider, email,
    // For a known provider the preset hosts are authoritative (a gmail.com seed must use
    // imap.gmail.com), so they overwrite any stale/wrong stored host. Custom domains keep theirs.
    imapHost: known ? preset.imapHost! : (b.imapHost || existing?.imapHost || preset.imapHost || ''),
    imapPort: known ? preset.imapPort! : Number(b.imapPort || existing?.imapPort || 993),
    smtpHost: known ? preset.smtpHost! : (b.smtpHost || existing?.smtpHost || preset.smtpHost || ''),
    smtpPort: known ? preset.smtpPort! : Number(b.smtpPort || existing?.smtpPort || 587),
    user: b.user || email,
    // App-passwords are shown with spaces (e.g. "abcd efgh ijkl mnop") but IMAP/SMTP AUTH needs
    // them stripped — otherwise login fails. Keep old pass if not re-supplied.
    pass: (b.pass || '').replace(/\s+/g, '') || existing?.pass || '',
    active: b.active !== undefined ? b.active : (existing?.active ?? true),
  };
  if (!seed.pass) return NextResponse.json({ error: 'app-password required' }, { status: 400 });
  if (!seed.imapHost || !seed.smtpHost) return NextResponse.json({ error: 'imap/smtp host required (unknown provider)' }, { status: 400 });
  const next = existing ? list.map((s) => (s.id === seed.id ? seed : s)) : [...list, seed];
  await writeSeeds(next);
  return NextResponse.json({ ok: true, id: seed.id });
}

// DELETE ?id= → remove a seed.
export async function DELETE(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const list = await readSeeds();
  await writeSeeds(list.filter((s) => s.id !== id));
  return NextResponse.json({ ok: true });
}
