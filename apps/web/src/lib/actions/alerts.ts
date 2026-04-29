'use server';

// Server Actions for Alerts mutations.

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, alerts } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';

function ensureDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured — server actions require DB.');
  return db;
}

export async function dismissAlert(projectId: string, alertRef: string): Promise<{ ok: boolean; error?: string }> {
  const db = ensureDb();
  const rows = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.tenantId, TENANT), eq(alerts.projectId, projectId), eq(alerts.alertRef, alertRef)))
    .limit(1);
  const a = rows[0];
  if (!a) return { ok: false, error: 'alert not found' };

  await db
    .update(alerts)
    .set({ resolvedAt: new Date() })
    .where(eq(alerts.id, a.id));

  revalidatePath(`/p/${projectId}`);
  revalidatePath(`/p/${projectId}/board`);
  revalidatePath(`/p/${projectId}/squads`);
  revalidatePath(`/p/${projectId}/tribes`);
  revalidatePath(`/p/${projectId}/studio`);
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}
