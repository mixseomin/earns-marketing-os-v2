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
  const provider = (b.provider || 'other') as WarmupSeed['provider'];
  const preset = PRESET[provider] || {};
  const list = await readSeeds();
  const existing = b.id ? list.find((s) => s.id === b.id) : list.find((s) => s.email === email);
  const seed: WarmupSeed = {
    id: existing?.id || randomUUID(),
    provider, email,
    imapHost: b.imapHost || existing?.imapHost || preset.imapHost || '',
    imapPort: Number(b.imapPort || existing?.imapPort || preset.imapPort || 993),
    smtpHost: b.smtpHost || existing?.smtpHost || preset.smtpHost || '',
    smtpPort: Number(b.smtpPort || existing?.smtpPort || preset.smtpPort || 587),
    user: b.user || email,
    pass: b.pass || existing?.pass || '',   // keep old pass if not re-supplied
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
