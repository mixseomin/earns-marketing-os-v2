'use server';
// LOGS (anh 08/11/2026: "Bỏ [Lên bậc], thay bằng 1 nút là Logs. Trong đó show group theo giờ hoặc theo 15 phút… tuỳ chọn thời lượng group các logs. Sau khi chọn group thì
// show theo số lượng camp tắt, mở, tăng/giảm bậc,… số creatives sx/duyệt/loại trong kỳ… mọi thứ trong từng group"): máy chủ trả TỪNG SỰ KIỆN của kỳ (mốc giờ + loại + mã + chữ),
// trang gom theo khung (lib/etp-logs gom) — đổi khung 15 phút ↔ 1 giờ không phải gọi lại máy chủ. Nguồn — mọi việc của máy nhà:
//   camp:     etp.nhat_ky (mở / nhân bản / tắt / tăng / giảm / lên ROAS / sang bộ / duyệt tay / lộ trình; ok = false → lệnh lỗi)
//   sản xuất: etp.dong_phim (dòng mới · dòng xong / dừng / lỗi / huỷ) + etp.dong_buoc (bước creative / poster xong = creative đã dựng)
//   chấm:     etp.cham (lần chấm gần nhất: qua / trượt cổng — etp.cham_cong) + etp.cham_duyet (người duyệt cho qua / loại)
//   tiền:     etp.so_gio_camp × etp.camp.bo (chi / thu theo giờ × bộ tài khoản)
//   bộ:       mỗi sự kiện mang bộ tài khoản (camp → camp.bo; dòng → bộ camp đã lên; creative → bộ camp dùng creative) — trang lọc theo bộ
// Chỉ chủ / admin (nhật ký máy nhà) — vai 'nguoi' nhận { loi }.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp, xemNha } from '@/lib/etp-quyen';
import type { DuLogs, HangLog, HangGio } from '@/lib/etp-logs';

const TOI_DA_GIO = 24 * 31;
export async function docLogs(gio: number, ids: number[] | null = null): Promise<DuLogs | { loi: string }> {
  try {
    const q = await quyenEtp(await getCurrentUser());
    if (!q || !xemNha(q)) return { loi: 'Logs là nhật ký máy nhà — chỉ chủ / admin xem' };
    const h = Math.max(1, Math.min(TOI_DA_GIO, Math.round(Number(gio) || 24)));
    // ids = tập camp sau BỘ LỌC CAMP của trang (null = không lọc) — tiền chỉ cộng camp trong tập; việc lọc ở trang theo mã camp [11]
    const ds = ids == null ? null : [...new Set(ids.filter((x) => Number.isInteger(x) && x > 0))], mang = ds == null ? null : `{${ds.join(',')}}`;
    const db = getDb()!;
    const run = async <T,>(s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];
    const [ev, tien, luat] = await Promise.all([
      // mỗi sự kiện: ly = lý do / nội dung đầy đủ (đã bỏ tiền tố "lệnh anh dd/mm/yyyy:") · ten = tên camp / phim · doi = thay đổi ($3 → $1, bộ 2 → bộ 1, dạng) · ai = ai ra lệnh
      run<{ t: number; k: string; id: number | null; ly: string | null; n1: string | null; n2: string | null; phim: number | null; bo: string | null; ten: string | null; doi: string | null; ai: string | null; cid: number | null }>(sql`with tu as (select now() - make_interval(hours => ${h}::int) t)
        select extract(epoch from n.luc)::bigint t,
          case when n.ok is false then 'loi' else case n.viec when 'tao_camp' then 'mo' when 'nhan_ban' then 'nb' when 'tat' then 'tat' when 'tang' then 'tang' when 'giam' then 'giam'
            when 'roas' then 'roas' when 'sang_bo' then 'sb' when 'duyet_tay' then 'dtc' when 'lo_trinh' then 'lt' else 'khac' end end k,
          n.camp_id id,
          left(case when n.ok is false then coalesce(n.loi, '') else regexp_replace(regexp_replace(coalesce(n.luat, ''), '[[:space:]]*·[[:space:]]*#[0-9]+:[^·]*', ''), '^(lệnh )?anh [0-9]{1,2}/[0-9]{1,2}/[0-9]{4}[[:space:]]*:?[[:space:]]*', '') end, 240) ly,
          case when n.ok is false then left(split_part(coalesce(n.loi, '?'), ':', 1), 60) when n.viec = 'duyet_tay' then nullif(left(trim(split_part(split_part(coalesce(n.luat, ''), ':', 2), ',', 1)), 40), '')
            else nullif(trim(left(regexp_replace(regexp_replace(regexp_replace(coalesce(n.luat, ''), '^(lệnh )?anh [0-9]{1,2}/[0-9]{1,2}/[0-9]{4}[[:space:]]*:?[[:space:]]*', ''), '^phim [0-9]+ · ', ''), '[[:space:]]*[(:—·].*$', ''), 60)), '') end n1,
          case when n.truoc ~ '^[0-9.]+$' and n.sau ~ '^[0-9.]+$' and n.viec in ('tang', 'giam') then '$' || n.truoc || ' → $' || n.sau
               when n.truoc ~ '^[0-9.]+$' and n.viec = 'tat' then 'đang $' || n.truoc || '/ngày'
               when n.viec = 'sang_bo' then 'bộ ' || coalesce((select g.bo from etp.camp g where g.camp_id = n.goc), '?') || ' → bộ ' || coalesce(n.sau, '?') end n2,
          c.content_id phim, c.bo, c.ten,
          case when n.truoc ~ '^[0-9.]+$' and n.sau ~ '^[0-9.]+$' and n.viec in ('tang', 'giam') then '$' || n.truoc || ' → $' || n.sau
               when n.truoc ~ '^[0-9.]+$' and n.viec = 'tat' then 'đang $' || n.truoc || '/ngày'
               when n.viec = 'sang_bo' then 'bộ ' || coalesce((select g.bo from etp.camp g where g.camp_id = n.goc), '?') || ' → bộ ' || coalesce(n.sau, '?')
               when n.viec = 'nhan_ban' and n.goc = n.camp_id then 'gốc → bản mới chạy theo lịch lên'   -- máy nhân bản ghi nhật ký vào camp GỐC (chưa có mã bản mới)
               when n.viec = 'nhan_ban' and n.goc is not null then 'từ camp #' || n.goc end doi,
          case when coalesce(n.ai, '') ~* 'máy' then 'máy' when n.luat ~ '^(lệnh )?anh [0-9]' or coalesce(n.ai, '') ~* '^anh' then 'lệnh anh' else 'máy' end ai, n.camp_id cid   -- luật anh đặt nhưng máy chạy ("… — máy chạy") = máy
        from etp.nhat_ky n left join etp.camp c using (camp_id), tu where n.luc >= tu.t and (n.ok is not null or n.viec <> 'tao_camp')
          and not (n.viec = 'sang_bo' and coalesce(n.sau, '') = '')   -- sang bộ: lệnh 08/11 ghi thêm dòng cho camp GỐC (không có bộ đích) → chỉ đếm dòng camp mới, kẻo đếm đôi
        union all
        select extract(epoch from d.tao_luc)::bigint, 'dm', d.id, left(regexp_replace(coalesce(d.ai, ''), '^máy:[[:space:]]*', ''), 240), d.loai,
          nullif(left(regexp_replace(regexp_replace(coalesce(d.ai, ''), '^máy:[[:space:]]*', ''), '[[:space:]]*[(·—].*$', ''), 40), ''), d.content_id, (select k.bo from etp.camp k where k.camp_id = d.camp_id),
          d.ten, d.loai, case when coalesce(d.ai, '') ~* '^anh' then 'lệnh anh' else 'máy' end, d.camp_id
        from etp.dong_phim d, tu where d.tao_luc >= tu.t
        union all
        select extract(epoch from d.xong_luc)::bigint, case d.trang_thai when 'xong' then 'dx' when 'loi' then 'dl' when 'huy' then 'dh' else 'dd' end, d.id, left(coalesce(d.ly_do, ''), 240), d.loai,
          nullif(left(regexp_replace(split_part(coalesce(d.ly_do, ''), ':', 1), '#?[0-9][0-9:/]*', '…', 'g'), 40), ''), d.content_id, (select k.bo from etp.camp k where k.camp_id = d.camp_id),
          d.ten, d.loai, 'máy', d.camp_id
        from etp.dong_phim d, tu where d.xong_luc >= tu.t and d.trang_thai in ('xong', 'loi', 'huy', 'dung')
        union all
        select extract(epoch from b.ket_thuc)::bigint, 'sx', coalesce((b.ket_qua->>'creative_id')::int, d.creative_id), case b.buoc when 'poster' then 'dựng xong poster' else 'dựng xong creative' end, d.loai, b.buoc, d.content_id,
          coalesce((select k.bo from etp.camp k where k.camp_id = d.camp_id), (select min(k.bo) from etp.camp k where k.creative_id = d.creative_id)), d.ten, d.loai, 'máy',
          coalesce(d.camp_id, (select min(k.camp_id) from etp.camp k where k.creative_id = d.creative_id))
        from etp.dong_buoc b join etp.dong_phim d on d.id = b.dong_id, tu where b.ket_thuc >= tu.t and b.trang_thai = 'xong' and b.buoc in ('creative', 'poster')
        union all
        select extract(epoch from c.luc)::bigint, case when g.duoc_len then 'cq' else 'ct' end, c.creative_id,
          case when g.duoc_len then 'qua cổng chấm — được lên camp' else 'bị chặn: ' || coalesce((select string_agg(coalesce(t.ten, p.ma) || coalesce(' ' || nullif(p.d, '') || '/10', ''), ' · ')
            from (select split_part(trim(x), ' ', 1) ma, split_part(trim(x), ' ', 2) d from unnest(string_to_array(coalesce(g.chan_boi, ''), ',')) x) p
            left join etp.tieu_chi t on t.nhom || '.' || t.ma = p.ma), '?') end, r.dang,
          case when not g.duoc_len then (select coalesce(t.ten, p.ma) from (select split_part(trim(split_part(coalesce(g.chan_boi, ''), ',', 1)), ' ', 1) ma) p left join etp.tieu_chi t on t.nhom || '.' || t.ma = p.ma) end, r.content_id, (select min(k.bo) from etp.camp k where k.creative_id = c.creative_id),
          (select d2.ten from etp.dong_phim d2 where d2.content_id = r.content_id order by d2.id desc limit 1), r.dang, 'máy chấm', (select min(k.camp_id) from etp.camp k where k.creative_id = c.creative_id)
        from etp.cham c join etp.cham_cong g using (creative_id) left join etp.creative r using (creative_id), tu where c.luc >= tu.t
        union all
        select extract(epoch from u.luc)::bigint, case when u.ok then 'dq' else 'dlt' end, u.creative_id, left(coalesce(nullif(u.ghi, ''), case when u.ok then 'cho qua' else 'loại' end), 240), r.dang,
          nullif(left(coalesce(u.ai, ''), 40), ''), r.content_id, (select min(k.bo) from etp.camp k where k.creative_id = u.creative_id),
          (select d2.ten from etp.dong_phim d2 where d2.content_id = r.content_id order by d2.id desc limit 1), r.dang, coalesce(nullif(left(u.ai, 40), ''), 'người duyệt'), (select min(k.camp_id) from etp.camp k where k.creative_id = u.creative_id)
        from etp.cham_duyet u left join etp.creative r using (creative_id), tu where u.luc >= tu.t
        union all
        -- CHỜ CHẠY (anh 08/11/2026 "Thiếu số camp đã lên đang chờ active?"): camp đã tạo, giờ hẹn (lich) chưa tới, đang ACTIVE hoặc còn đang tạo — CÙNG định nghĩa choGio
        -- của lib/etp-chay.ts (trang Camp / Sản xuất). Mốc = lúc TẠO; không giới hạn theo kỳ (camp tạo trước kỳ vẫn vào nhãn tổng "đang chờ chạy")
        select extract(epoch from c.tao)::bigint, 'cho', c.camp_id, 'đã tạo trên Ethopex, chờ tới giờ hẹn mới chạy', 'hẹn ' || to_char(c.lich at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'),
          r.dang, c.content_id, c.bo, c.ten, 'hẹn ' || to_char(c.lich at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'), 'máy', c.camp_id
        from etp.camp c left join etp.creative r using (creative_id)
        where c.lich > now() and (c.trang_thai = 'ACTIVE' or (c.dong_bo is not null and c.dong_bo not in ('done', 'synced', 'error')))
        union all
        -- BẮT ĐẦU CHẠY (anh 08/11/2026 "Tại sao lại Mở camp vào khung giờ nào vậy?"): cột Mở = giờ TẠO; camp tạo ngoài 07–12h hẹn 07:00 nên giờ chạy thật khác —
        -- mốc = giờ có ĐỒNG CHI ĐẦU TIÊN (etp.so_gio_camp), chỉ camp tạo từ 3 ngày trước kỳ (khỏi quét cả bảng)
        select extract(epoch from f.t)::bigint, 'bd', c.camp_id, 'đồng chi đầu tiên — camp bắt đầu tiêu thật',
          coalesce('hẹn ' || to_char(c.lich at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'), 'không hẹn'), r.dang, c.content_id, c.bo, c.ten,
          'tạo ' || to_char(c.tao at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'), 'Meta', c.camp_id
        from (select g.camp_id, min(g.ngay + make_interval(hours => g.gio)) t from etp.so_gio_camp g join etp.camp k using (camp_id), tu
              where k.tao >= tu.t - interval '3 day' and g.chi > 0 group by 1) f
        join etp.camp c using (camp_id) left join etp.creative r using (creative_id), tu where f.t >= (tu.t at time zone 'utc') - interval '1 hour'
        order by 1 desc limit 30000`),
      // tiền theo GIỜ × BỘ (etp.so_gio_camp + etp.camp.bo — tổng khớp etp.so_gio, đo 07/11: $915,40 cả hai) để lọc bộ tính được cả tiền
      run<{ t: number; bo: string | null; chi: number; thu: number }>(sql`select extract(epoch from g.ngay + make_interval(hours => g.gio))::bigint t, k.bo, sum(g.chi)::float chi, sum(g.thu)::float thu
        from etp.so_gio_camp g join etp.camp k using (camp_id)
        where (${mang}::int[] is null or g.camp_id = any(${mang}::int[])) and g.ngay + make_interval(hours => g.gio) >= date_trunc('hour', (now() at time zone 'utc') - make_interval(hours => ${h}::int)) group by 1, 2 order by 1`),
      // TÊN ĐẦY ĐỦ MÃ LUẬT (T1 → "T1 · tắt sau ngày đầu") — cùng sổ thẻ xét luật máy ghi (etp.xet_luat), trang dịch mã ở thống kê thẻ nổi
      run<{ ma: string; ten: string }>(sql`select distinct on (lower(x->>'ma')) lower(x->>'ma') ma, x->>'ten' ten from etp.xet_luat, jsonb_array_elements(xet) x where x->>'ma' is not null and x->>'ten' is not null order by lower(x->>'ma'), length(x->>'ten')`),
    ]);
    return { gio: h, den: Math.floor(Date.now() / 1000), luat: Object.fromEntries(luat.map((x) => [x.ma, x.ten])),
      ev: ev.map((x): HangLog => [Number(x.t), x.k, x.id == null ? null : Number(x.id), x.ly ?? '', x.n1 ?? '', x.n2 ?? '', x.phim == null ? null : Number(x.phim), x.bo ?? null, x.ten ?? '', x.doi ?? '', x.ai ?? '', x.cid == null ? null : Number(x.cid)]),
      tien: tien.map((x): HangGio => [Number(x.t), Math.round(Number(x.chi) * 100) / 100, Math.round(Number(x.thu) * 100) / 100, x.bo ?? null]) };
  } catch (e) {
    console.error('docLogs:', e);
    return { loi: `không đọc được nhật ký: ${String((e as Error)?.message ?? e).slice(0, 160)}` };
  }
}
