// PHANH CHIẾN DỊCH (20/11/2026, học guardrail của warmbly + ngưỡng dội của sellbird + mốc chuẩn của coldoutboundskills): trước mỗi lượt máy tự gửi,
// xét 7 ngày gần nhất của TỪNG chiến dịch đang bật tự gửi — thư dội ≥ 5%, thư bị chặn vì uy tín ≥ 5%, hoặc xin thôi > 2% thì TẮT tự gửi của chiến dịch đó
// và ghi lý do bằng lời thường vào cau_hinh.phanh; quá nửa ngưỡng thì chỉ cảnh báo (hiện ở ô Cần xử). Ngưỡng + phép xét ở thuan.ts › xetPhanh (có bài kiểm).
// Một danh sách bẩn làm hỏng uy tín tên miền gửi chỉ trong một ngày — sổ chặn từng địa chỉ không cứu được chuyện đó, phanh cả chiến dịch mới cứu được.
// Máy KHÔNG tự bật lại: người vận hành xem lý do, lọc danh sách rồi bật tay.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { xetPhanh } from './thuan';

export type SoPhanh = { id: number; da: string; ten: string; tuGui: boolean; gui: number; doi: number; thoi: number; chanUyTin: number; dung: string | null; canh: string | null; daPhanh: { ly_do: string; luc: string } | null };

/** số liệu 7 ngày + kết luận phanh của mọi chiến dịch đang chạy (đọc; không đổi gì) */
export async function docPhanh(): Promise<SoPhanh[]> {
  const db = getDb(); if (!db) return [];
  try {
    const rs = (await db.execute(sql`
      select c.id::int as id, coalesce(c.project_id, '') as da, c.name as ten, c.auto_send as tu_gui, c.cau_hinh->'phanh' as da_phanh,
        (select count(*)::int from outreach_thu t where t.campaign_id = c.id and t.chieu = 'di' and t.trang_thai = 'ok' and t.luc >= now() - interval '7 days') as gui,
        (select count(*)::int from outreach_thu t where t.campaign_id = c.id and t.chieu = 'den' and t.trang_thai = 'doi' and t.luc >= now() - interval '7 days') as doi,
        (select count(*)::int from outreach_thu t where t.campaign_id = c.id and t.chieu = 'den' and t.trang_thai = 'chan_uy_tin' and t.luc >= now() - interval '7 days') as chan_uy_tin,
        (select count(*)::int from outreach_prospects p where p.campaign_id = c.id and p.status = 'declined' and p.replied_at >= now() - interval '7 days') as thoi
      from outreach_campaigns c where c.status = 'active'`)) as unknown as Record<string, unknown>[];
    return rs.map((r) => {
      const so = { gui: Number(r.gui), doi: Number(r.doi), thoi: Number(r.thoi), chanUyTin: Number(r.chan_uy_tin) }, x = xetPhanh(so);
      const dp = r.da_phanh as { ly_do?: string; luc?: string } | null;
      return { id: Number(r.id), da: String(r.da), ten: String(r.ten), tuGui: r.tu_gui === true, ...so, dung: x.dung, canh: x.canh, daPhanh: dp?.ly_do ? { ly_do: String(dp.ly_do), luc: String(dp.luc ?? '') } : null };
    });
  } catch { return []; }   // bảng outreach_thu chưa có
}

/** TẮT tự gửi của mọi chiến dịch đang bật tự gửi mà chạm ngưỡng dừng. Trả danh sách câu "đã phanh …" cho nhật ký lượt chạy. */
export async function apPhanh(): Promise<string[]> {
  const db = getDb(); if (!db) return [];
  const ra: string[] = [];
  for (const c of await docPhanh()) {
    if (!c.tuGui || !c.dung) continue;
    await db.execute(sql`update outreach_campaigns set auto_send = false,
      cau_hinh = jsonb_set(coalesce(cau_hinh, '{}'::jsonb), '{phanh}', ${JSON.stringify({ ly_do: c.dung, luc: new Date().toISOString() })}::jsonb), updated_at = now() where id = ${c.id}`);
    ra.push(`đã tắt tự gửi "${c.ten}" (${c.da}): ${c.dung}`);
  }
  return ra;
}
