import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { checkAuth } from '../_auth';
import { getSceneEvents } from '@/lib/scene-events';

// GET /api/ext/config — config dùng-chung cho ext (hiện: scene_events = taxonomy + bảng điểm).
// Ext đọc để _KIND_LABEL + tập toggle KHỚP backend (1 nguồn, hết lệch điểm). Không nhạy cảm → staff OK.
export async function GET(req: Request) {
  const authErr = await checkAuth(req);
  if (authErr) return authErr;
  const sceneEvents = await getSceneEvents(getDb());
  return NextResponse.json({ ok: true, sceneEvents });
}
