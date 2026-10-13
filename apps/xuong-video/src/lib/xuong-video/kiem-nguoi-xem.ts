// Lõi bước "🧑 Kiểm người xem có hiểu không" trên máy chủ — MỘT chỗ cho nút (actions.ts › thuNguoiXemTap) và script (scripts/kiem-nguoi-xem.mts).
// Phần thuần (bản người xem, mã phiên bản, cổng chặn) ở nguoi-xem.ts; lượt Claude ở claude.ts › thuNguoiXem.
import 'server-only';
import { sql } from 'drizzle-orm';
import { thuNguoiXem } from './claude';
import { banNguoiXem, maBan, DIEM_HIEU_DAT } from './nguoi-xem';
import { docKinhThanh, giaChuCents, locNhanh, type ThuNguoiXem } from './kieu';
import { boiCanhTap, mapCanh, type Db, type Row } from './doc-db';

export async function kiemNguoiXemTap(db: Db, tapId: number): Promise<{ ok: true; data: ThuNguoiXem } | { ok: false; loi: string }> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return { ok: false, loi: 'không thấy tập' };
  const canh = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  if (!canh.length) return { ok: false, loi: 'tập chưa tách cảnh — chưa có gì để người xem xem' };
  const kt = docKinhThanh(bc.kt);
  const ban = banNguoiXem(canh);
  const ids = new Set(canh.flatMap((c) => c.nhan_vat));
  const nvTa = bc.nhanVat.filter((v) => ids.has(v.id) && v.loai !== 'phong_cach').map((v) => `- ${v.ten}: ${v.mo_ta.slice(0, 160)}`).join('\n');
  const logline = (kt.series?.dong_co ? kt.series.tap.find((t) => t.so === bc.tap.so)?.logline : '') || kt.logline || '';
  const kq = await thuNguoiXem({ ban, nhanVat: nvTa, logline, brief: bc.tap.brief, kt });
  if (!kq.ok) return kq;
  const gia = giaChuCents(kq.model, kq.tokens.in, kq.tokens.out);
  await db.execute(sql`INSERT INTO xv_job (phim_id, nhan, loai, provider, model, trang_thai, chi_phi_cents, tokens_in, tokens_out)
    VALUES (${bc.tap.phim_id}, ${`Kiểm người xem có hiểu không · tập ${bc.tap.so}`}, 'chu', 'anthropic', ${kq.model}, 'xong', ${Math.round(gia * 100) / 100}, ${kq.tokens.in}, ${kq.tokens.out})`);
  const { xem, doi } = kq.data;
  const t: ThuNguoiXem = { ma: maBan(ban), luc: new Date().toISOString(), model: kq.model, ke_lai: xem.ke_lai, hieu: { ai: xem.ai, muon: xem.muon, can: xem.can, lat: xem.lat, ket: xem.ket },
    diem: Math.max(0, Math.min(10, Math.round(xem.diem))), cho_kho: xem.cho_kho, khop: doi.khop, lech: doi.lech, dat: doi.khop && xem.diem >= DIEM_HIEU_DAT };
  await db.execute(sql`UPDATE xv_tap SET thu_nguoi_xem = ${JSON.stringify(t)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: t };
}
