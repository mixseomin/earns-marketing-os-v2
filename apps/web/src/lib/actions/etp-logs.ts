'use server';
// LOGS (anh 08/11/2026: "Bỏ [Lên bậc], thay bằng 1 nút là Logs. Trong đó show group theo giờ hoặc theo 15 phút… tuỳ chọn thời lượng group các logs. Sau khi chọn group thì
// show theo số lượng camp tắt, mở, tăng/giảm bậc,… số creatives sx/duyệt/loại trong kỳ… mọi thứ trong từng group"): máy chủ trả TỪNG SỰ KIỆN của kỳ (mốc giờ + loại + mã + chữ),
// trang gom theo khung (lib/etp-logs gom) — đổi khung 15 phút ↔ 1 giờ không phải gọi lại máy chủ. Nguồn — mọi việc của máy nhà:
//   camp:     etp.nhat_ky (mở / nhân bản / tắt / tăng / giảm / lên ROAS / sang bộ / duyệt tay / lộ trình; ok = false → lệnh lỗi)
//   sản xuất: etp.dong_phim (dòng mới · dòng xong / dừng / lỗi / huỷ) + etp.dong_buoc (bước creative / poster xong = creative đã dựng)
//   chấm:     etp.cham (lần chấm gần nhất: qua / trượt cổng — etp.cham_cong) + etp.cham_duyet (người duyệt cho qua / loại)
//   tiền:     etp.so_gio (chi / thu theo giờ của nhà)
// Chỉ chủ / admin (nhật ký máy nhà) — vai 'nguoi' nhận { loi }.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp, xemNha } from '@/lib/etp-quyen';
import type { DuLogs, HangLog, HangGio } from '@/lib/etp-logs';

const TOI_DA_GIO = 24 * 31;
export async function docLogs(gio: number): Promise<DuLogs | { loi: string }> {
  try {
    const q = await quyenEtp(await getCurrentUser());
    if (!q || !xemNha(q)) return { loi: 'Logs là nhật ký máy nhà — chỉ chủ / admin xem' };
    const h = Math.max(1, Math.min(TOI_DA_GIO, Math.round(Number(gio) || 24)));
    const db = getDb()!;
    const run = async <T,>(s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];
    const [ev, tien] = await Promise.all([
      run<{ t: number; k: string; id: number | null; ghi: string | null; n1: string | null; n2: string | null; phim: number | null }>(sql`with tu as (select now() - make_interval(hours => ${h}::int) t)
        select extract(epoch from n.luc)::bigint t,
          case when n.ok is false then 'loi' else case n.viec when 'tao_camp' then 'mo' when 'nhan_ban' then 'nb' when 'tat' then 'tat' when 'tang' then 'tang' when 'giam' then 'giam'
            when 'roas' then 'roas' when 'sang_bo' then 'sb' when 'duyet_tay' then 'dtc' when 'lo_trinh' then 'lt' else 'khac' end end k,
          n.camp_id id,
          concat_ws(' · ', nullif(left(coalesce(c.ten, ''), 70), ''), case when n.truoc ~ '^[0-9.]+$' and n.sau ~ '^[0-9.]+$' then '$' || n.truoc || ' → $' || n.sau end,
            nullif(left(coalesce(n.loi, n.luat, ''), 140), '')) ghi,
          case when n.ok is false then left(split_part(coalesce(n.loi, '?'), ':', 1), 50) when n.viec = 'duyet_tay' then nullif(left(trim(split_part(split_part(coalesce(n.luat, ''), ':', 2), ',', 1)), 40), '')
            else nullif(trim(left(regexp_replace(regexp_replace(coalesce(n.luat, ''), '^phim [0-9]+ · ', ''), '[[:space:]]*[(:—·].*$', ''), 50)), '') end n1,
          case when n.truoc ~ '^[0-9.]+$' and n.sau ~ '^[0-9.]+$' and n.viec in ('tang', 'giam') then '$' || n.truoc || ' → $' || n.sau
               when n.truoc ~ '^[0-9.]+$' and n.viec = 'tat' then 'đang $' || n.truoc || '/ngày' when n.viec = 'sang_bo' then 'sang bộ ' || coalesce(n.sau, '?') end n2, c.content_id phim
        from etp.nhat_ky n left join etp.camp c using (camp_id), tu where n.luc >= tu.t and (n.ok is not null or n.viec <> 'tao_camp')
        union all
        select extract(epoch from d.tao_luc)::bigint, 'dm', d.id, concat_ws(' · ', d.loai, left(d.ten, 70)), d.loai,
          nullif(left(regexp_replace(regexp_replace(coalesce(d.ai, ''), '^máy:[[:space:]]*', ''), '[[:space:]]*[(·—].*$', ''), 40), ''), d.content_id from etp.dong_phim d, tu where d.tao_luc >= tu.t
        union all
        select extract(epoch from d.xong_luc)::bigint, case d.trang_thai when 'xong' then 'dx' when 'loi' then 'dl' when 'huy' then 'dh' else 'dd' end, d.id,
          concat_ws(' · ', d.loai, left(d.ten, 70), nullif(left(coalesce(d.ly_do, ''), 140), '')), d.loai,
          nullif(left(regexp_replace(split_part(coalesce(d.ly_do, ''), ':', 1), '#?[0-9][0-9:/]*', '…', 'g'), 40), ''), d.content_id
        from etp.dong_phim d, tu where d.xong_luc >= tu.t and d.trang_thai in ('xong', 'loi', 'huy', 'dung')
        union all
        select extract(epoch from b.ket_thuc)::bigint, 'sx', coalesce((b.ket_qua->>'creative_id')::int, d.creative_id), concat_ws(' · ', d.loai, b.buoc, left(d.ten, 70)), d.loai, b.buoc, d.content_id
        from etp.dong_buoc b join etp.dong_phim d on d.id = b.dong_id, tu where b.ket_thuc >= tu.t and b.trang_thai = 'xong' and b.buoc in ('creative', 'poster')
        union all
        select extract(epoch from c.luc)::bigint, case when g.duoc_len then 'cq' else 'ct' end, c.creative_id,
          concat_ws(' · ', r.dang, case when not g.duoc_len then nullif(g.chan_boi, '') end), r.dang,
          case when not g.duoc_len then nullif(regexp_replace(split_part(coalesce(g.chan_boi, ''), ',', 1), '[[:space:]]*[0-9]+$', ''), '') end, r.content_id
        from etp.cham c join etp.cham_cong g using (creative_id) left join etp.creative r using (creative_id), tu where c.luc >= tu.t
        union all
        select extract(epoch from u.luc)::bigint, case when u.ok then 'dq' else 'dlt' end, u.creative_id, concat_ws(' · ', r.dang, nullif(left(coalesce(u.ghi, ''), 120), ''), u.ai), r.dang, nullif(left(coalesce(u.ai, ''), 40), ''), r.content_id
        from etp.cham_duyet u left join etp.creative r using (creative_id), tu where u.luc >= tu.t
        order by 1 desc limit 30000`),
      run<{ t: number; chi: number; thu: number }>(sql`select extract(epoch from ngay + make_interval(hours => gio))::bigint t, sum(chi)::float chi, sum(thu)::float thu
        from etp.so_gio where ngay + make_interval(hours => gio) >= date_trunc('hour', (now() at time zone 'utc') - make_interval(hours => ${h}::int)) group by 1 order by 1`),
    ]);
    return { gio: h, den: Math.floor(Date.now() / 1000),
      ev: ev.map((x): HangLog => [Number(x.t), x.k, x.id == null ? null : Number(x.id), x.ghi ?? '', x.n1 ?? '', x.n2 ?? '', x.phim == null ? null : Number(x.phim)]),
      tien: tien.map((x): HangGio => [Number(x.t), Math.round(Number(x.chi) * 100) / 100, Math.round(Number(x.thu) * 100) / 100]) };
  } catch (e) {
    console.error('docLogs:', e);
    return { loi: `không đọc được nhật ký: ${String((e as Error)?.message ?? e).slice(0, 160)}` };
  }
}
