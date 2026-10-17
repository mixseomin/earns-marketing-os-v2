// ĐIỂM PROMPT TỪNG SHOT (anh 17/10/2026: "trên timeline cũng show điểm của prompt"): chấm mọi prompt keyframe (sinh-anh.ts › chamKeyframe) + prompt video
// (sinh-video.ts › chamVideo) rồi ghi xv_canh.diem_prompt — timeline đọc thẳng cột này (diem-prompt-noi.tsx › ChipPrompt). Ghi lại mỗi lượt cổng
// (kiem-cong-shot.mts) và mỗi lần nhận khung 3D mới (bo-set.mts --nhap): điểm đi theo dữ liệu đang có, không phải lần chấm cũ.
import 'server-only';
import { sql } from 'drizzle-orm';
import { boiCanhCanh, type Db, type Row } from './doc-db';
import { chamKeyframe } from './sinh-anh';
import { chamVideo } from './sinh-video';
import type { DiemPrompt } from './kieu';

export async function ghiDiemPrompt(db: Db, canhId: number): Promise<DiemPrompt | null> {
  const bc = await boiCanhCanh(db, canhId); if (!bc) return null;
  const k = chamKeyframe(bc); const v = chamVideo(bc);
  const d: DiemPrompt = { diem: Math.min(k.diem, v.diem), diem_keyframe: k.diem, diem_video: v.diem, loi: [...k.loi, ...v.loi], luc: new Date().toISOString() };
  await db.execute(sql`UPDATE xv_canh SET diem_prompt = ${JSON.stringify(d)}::jsonb WHERE id = ${canhId}`);
  return d;
}
export async function ghiDiemPromptTap(db: Db, tapId: number): Promise<number> {
  const ds = (await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId}`)) as unknown as Row[];
  for (const r of ds) await ghiDiemPrompt(db, Number(r.id)).catch((e: unknown) => console.error(`[điểm prompt] shot ${String(r.id)}:`, e));
  return ds.length;
}
