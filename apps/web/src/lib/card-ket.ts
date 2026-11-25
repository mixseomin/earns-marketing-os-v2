// CARD GÓP Ý KẸT của mọi hòm — cho M7 "Việc theo phòng" trên /home (anh 25/11/2026: "Phải cho các phòng bị kẹt lên đầu").
// Luật kẹt y như chấm đỏ của nút góp ý (packages/gop-y dem.ts): trạng thái hòm 'broken', hoặc 'claimed' quá trần phiên
// mà không phiên nào chạy. Người giữ card: thẻ máy "· chờ kỹ sư a, b]" (việc đã CHUYỂN) thắng; không có thì tên kỹ sư
// trong tin "[Tên · …]" mới nhất của AI — ra phòng ở phía trình duyệt (phong-viec.tsx) theo danh sách agent của cty.
import 'server-only';
import { cache } from 'react';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { TRAN_DANG_LAM_MS } from '@mos2/gop-y/server';
import type { CardKet } from './cty-agents-kieu';

const CHO_KY_SU = /· chờ kỹ sư ([a-z, ]+)\]/;
const TEN_TIN = /^\[([^\]·]+?) ·/;

/** từ các tin AI (cũ → mới) → { cho: id kỹ sư đang được chờ, ten: tên kỹ sư nói cuối } */
export function nguoiGiu(tin: string[]): { cho: string[]; ten: string | null } {
  const cuoi = tin[tin.length - 1] || '';
  const m = cuoi.match(CHO_KY_SU);
  const cho = m ? m[1]!.split(',').map((x) => x.trim()).filter(Boolean) : [];
  let ten: string | null = null;
  for (let i = tin.length - 1; i >= 0 && !ten; i--) {
    const t = tin[i]!.match(TEN_TIN)?.[1]?.trim();
    if (t && !/^máy\b/i.test(t)) ten = t;
  }
  return { cho, ten };
}

// cache: dải số, bảng agents, M7 cùng một màn chỉ hỏi DB một lần
export const docCardKet = cache(async (): Promise<CardKet[]> => {
  const phut = Math.round(TRAN_DANG_LAM_MS / 60_000);
  const db = getDb();
  if (!db) throw new Error('chưa nối được DB mos2');
  const r = (await db.execute(sql`
    SELECT h.id, h.project_id AS hom, h.title,
           coalesce(h.prep_payload->'site_status'->>h.project_id, h.status) AS tt,
           (SELECT coalesce(jsonb_agg(t->>'noiDung'), '[]'::jsonb) FROM jsonb_array_elements(coalesce(h.prep_payload->'trao_doi', '[]'::jsonb)) t
             WHERE t->>'nguoi' = 'claude') AS ai
      FROM human_tasks h
     WHERE h.prep_payload->>'source_platform' = 'feedback'
       AND h.status NOT IN ('completed', 'verified', 'dropped')
       AND (coalesce(h.prep_payload->'site_status'->>h.project_id, h.status) = 'broken'
            OR (coalesce(h.prep_payload->'site_status'->>h.project_id, h.status) = 'claimed' AND h.updated_at < now() - make_interval(mins => ${phut})))
     ORDER BY h.updated_at DESC LIMIT 200`)) as unknown as Array<{ id: number; hom: string; title: string | null; tt: string; ai: string[] }>;
  return r.map((x) => ({ id: x.id, hom: x.hom, tieuDe: (x.title || '').slice(0, 80), treo: x.tt === 'claimed', ...nguoiGiu(x.ai || []) }));
});
