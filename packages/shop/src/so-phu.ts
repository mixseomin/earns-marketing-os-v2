// Sổ PHỦ (report2 MOS2): đơn đã trả → phu_su_kien loai=don; mỗi lần hoàn → loai=hoan. Giá vốn + ship NCC lấy từ sổ shop.
// Dùng chung cho đơn Woo (apps/web dong-bo) và đơn mặt tiền mos (thanh-toan.ts).
import { sql } from 'drizzle-orm';
import { q } from './su-kien';
import { sidPrefix } from './sid';

export type VaoSoPhu = { projectId: string; nguon: string; maDon: string; traLuc: string; tong: number; huy: boolean; sid: string | null;
  phi: number | null; soMon: number; hoan: { ma: string; tien: number; lyDo?: string }[] };

export async function ghiSoPhuDon(donId: number, v: VaoSoPhu) {
  const x = (await q<{ gv: string | null; ship: string | null; ma: string | null; mon: string | null }>(sql`
    SELECT (SELECT SUM(b.gia_von * m.sl) FROM shop_don_mon m JOIN shop_bien_the b ON b.id = m.bien_the_id WHERE m.don_id = ${donId})::text AS gv,
           (SELECT phi_ship::text FROM shop_don_ncc WHERE don_id = ${donId} AND trang_thai NOT IN ('CANCELLED', 'LOI') LIMIT 1) AS ship,
           (SELECT ma_ncc FROM shop_don_ncc WHERE don_id = ${donId} AND trang_thai NOT IN ('CANCELLED', 'LOI') LIMIT 1) AS ma,
           (SELECT ten FROM shop_don_mon WHERE don_id = ${donId} ORDER BY id LIMIT 1) AS mon`))[0]!;
  const phi = v.phi ?? Math.round((v.tong * 0.029 + 0.3) * 100) / 100;
  const raw = { gia_von: Math.round(Number(x.gv ?? 0) * 100) / 100, ship: Number(x.ship ?? 0), phi, so_mon: v.soMon, cj: x.ma ?? '' };
  const ev = [{ ts: v.traLuc, loai: 'don', amount: v.huy ? 0 : v.tong, ma_don: v.maDon, raw: v.huy ? { ...raw, huy: true } : raw as Record<string, unknown> }]
    .concat(v.hoan.map((h) => ({ ts: new Date().toISOString(), loai: 'hoan', amount: h.tien, ma_don: `hoan-${h.ma}`, raw: { don: v.maDon, ly_do: h.lyDo ?? '' } })));
  for (const e of ev) await q(sql`
    INSERT INTO phu_su_kien (project_id, ts, loai, sid, sid_prefix, platform_slug, amount, ma_don, nguon_du_lieu, raw)
    VALUES (${v.projectId}, ${e.ts}::timestamptz, ${e.loai}, ${v.sid}, ${sidPrefix(v.sid ?? undefined)}, ${x.mon}, ${e.amount}, ${e.ma_don}, ${v.nguon}, ${JSON.stringify(e.raw)}::jsonb)
    ON CONFLICT (nguon_du_lieu, ma_don) DO UPDATE SET amount = EXCLUDED.amount, raw = EXCLUDED.raw`);
}
