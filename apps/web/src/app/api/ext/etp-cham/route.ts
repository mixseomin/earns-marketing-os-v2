import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { resolveExtUser } from '../_auth';

// CỬA CHO WORKER CHẤM CREATIVE (Cloudflare Worker etp-cham, tài khoản Eimagini — anh 25/10/2026: "chấm điểm sao lại cài trên iMac" → chọn CF worker).
// Khoá: Bearer MOS2_EXT_KEY (chỉ quyền admin). CHỈ CHẤM — không đụng camp / luật.
//   GET  ?so=N  → nhận tối đa N creative trong hàng etp.cham_hang (nút "Chấm" trên trang ưu tiên, rồi creative mới) + tiêu chí (etp.tieu_chi)
//               + luật từ cấm / CTA (xv_khoa_ngoai ethopex_mau_cam — dong-bo.py xuất từ kiem-thoai.py / cta_qc.py, một nguồn)
//   POST {creative_id, buoc}                                           → báo bước đang làm (bảng chấm trực tiếp trên etp.on.tc)
//   POST {creative_id, loi?, lop, diem, ly_do, khung, meta, afs, ket} → ghi etp.cham + đánh dấu hàng xong / lỗi; lớp giọng lỗi → xếp hàng CHÉP LẠI GIỌNG (nguon='giong')
//   POST {creative_id, giong}                                          → kết quả chép lại giọng: ghép lop.giong vào bản chấm, từ cấm trong lời kéo Meta ngôn từ (≤ 6)
// (anh 23/11/2026 "Hook cũng ko giống với voice trong video ?": 1.358 bản chấm mất giọng vì Whisper 9423 — thẻ lấy chữ trên hình làm hook)
type ViecCham = { creative_id: number; video: string; dur: number; doan: string | null; phim: string | null; nguon: string | null };
const CAM_META = 5, XEM = 7;   // cùng ngưỡng worker etp-cham (apps/etp-cham-worker/src/index.ts)

async function quyen(req: Request) {
  const u = await resolveExtUser(req);
  return u?.mode === 'admin';
}

export async function GET(req: Request) {
  if (!(await quyen(req))) return NextResponse.json({ loi: 'cấm' }, { status: 403 });
  const db = getDb()!;
  const so = Math.min(Math.max(Number(new URL(req.url).searchParams.get('so') ?? 2) || 2, 1), 10);
  // 'dang' quá 30 phút = lượt trước chết giữa chừng → trả về hàng; creative chưa vào kho sau 2 giờ (đồng bộ 10 phút) → lỗi
  await db.execute(sql`update etp.cham_hang set trang_thai = 'cho', bat_dau = null where trang_thai = 'dang' and bat_dau < now() - interval '30 minutes'`);
  await db.execute(sql`update etp.cham_hang h set trang_thai = 'loi', xong = now(), loi = 'creative không có trong kho / không có video sau 2 giờ'
    where trang_thai = 'cho' and luc < now() - interval '2 hours'
      and not exists (select 1 from etp.creative c where c.creative_id = h.creative_id and c.video is not null)`);
  // creative ĐÃ VÀO KHO sau khi bị đánh lỗi trên (vd creative tài khoản khác đưa vào kho sau) → về hàng chờ, chưa có bản chấm thì chấm.
  // Trước 30/10/2026 dòng lỗi nằm im mãi — mọi đường xếp hàng 'on conflict do nothing' (lich-gio, len-creative, nhan-ban) không gỡ được (Dragon Lord 54757)
  await db.execute(sql`update etp.cham_hang h set trang_thai = 'cho', loi = null, xong = null, bat_dau = null, buoc = null, lan_thu = 0, thu_lai_luc = null, luc = now()
    where trang_thai = 'loi' and loi like 'creative không có trong kho%'
      and exists (select 1 from etp.creative c where c.creative_id = h.creative_id and c.video is not null)
      and not exists (select 1 from etp.cham x where x.creative_id = h.creative_id)`);
  const viec = (await db.execute(sql`with nhan as (
      update etp.cham_hang set trang_thai = 'dang', bat_dau = now(), buoc = 'Cloudflare nhận việc', nhat_ky = jsonb_build_array(jsonb_build_object('b', 'Cloudflare nhận việc', 'luc', now())) where creative_id in (
        select h.creative_id from etp.cham_hang h join etp.creative c on c.creative_id = h.creative_id and c.video is not null
        where h.trang_thai = 'cho' and (h.thu_lai_luc is null or h.thu_lai_luc <= now()) order by (h.nguon = 'nut') desc, (h.nguon = 'giong') desc, h.luc limit ${so} for update of h skip locked)
      returning creative_id, nguon)
    select c.creative_id, nhan.nguon, c.video, coalesce(c.den - c.tu, 85) + 4 dur, c.doan, p.ten phim
    from nhan join etp.creative c using (creative_id) left join etp.phim p on p.content_id = c.content_id`)) as unknown as ViecCham[];
  if (!viec.length) return NextResponse.json({ viec: [] });
  const [tieuChi, mau] = await Promise.all([
    db.execute(sql`select nhom, ma, ten, mo_ta from etp.tieu_chi order by nhom desc, thu_tu`),
    db.execute(sql`select gia_tri from xv_khoa_ngoai where ten = 'ethopex_mau_cam'`),
  ]);
  return NextResponse.json({ viec: viec.map((v) => ({ ...v, dur: Number(v.dur) })), tieu_chi: tieuChi, mau: (mau as unknown as { gia_tri: unknown }[])[0]?.gia_tri ?? null });
}

export async function POST(req: Request) {
  if (!(await quyen(req))) return NextResponse.json({ loi: 'cấm' }, { status: 403 });
  const b = (await req.json()) as { buoc?: string; creative_id: number; loi?: string | null; lop?: unknown; diem?: unknown; ly_do?: unknown; khung?: unknown; meta?: number | null; afs?: number | null; ket?: string | null;
    giong?: { luc: string; noi_dung: string; ngon_ngu: string | null; loi: string[] } };
  const id = Number(b.creative_id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ loi: 'creative_id sai' }, { status: 400 });
  const db = getDb()!;
  if (b.buoc && !b.lop) {
    await db.execute(sql`update etp.cham_hang set buoc = ${b.buoc.slice(0, 200)}, nhat_ky = nhat_ky || jsonb_build_array(jsonb_build_object('b', ${b.buoc.slice(0, 200)}::text, 'luc', now()))
      where creative_id = ${id} and trang_thai = 'dang'`);
    return NextResponse.json({ ok: true });
  }
  if (b.giong && typeof b.giong.noi_dung === 'string') {
    const cu = ((await db.execute(sql`select lop, diem, ly_do, loi from etp.cham where creative_id = ${id}`)) as unknown as
      { lop: Record<string, unknown> | null; diem: Record<string, number> | null; ly_do: Record<string, string> | null; loi: string | null }[])[0];
    if (cu) {
      const loiLoi = (b.giong.loi ?? []).filter((x) => String(x).startsWith('lời')).slice(0, 20);
      const lop = { ...(cu.lop ?? {}), giong: { ...b.giong, loi: loiLoi } }, diem = { ...(cu.diem ?? {}) }, ly = { ...(cu.ly_do ?? {}) };
      if (loiLoi.length && 'meta.ngon_tu' in diem) {
        const chuLoi = ((lop as { chu?: { loi?: string[] } }).chu?.loi ?? []).filter((x) => !x.startsWith('lời'));
        diem['meta.ngon_tu'] = Math.min(diem['meta.ngon_tu']!, 6); ly['meta.ngon_tu'] = `máy đọc thấy từ cấm: ${[...chuLoi, ...loiLoi].join('; ')}`.slice(0, 300);
      }
      const vals = (g: string) => Object.entries(diem).filter(([k]) => k.startsWith(`${g}.`)).map(([, x]) => x);
      const meta = vals('meta').length ? Math.min(...vals('meta')) : null, afs = vals('afs').length ? Math.min(...vals('afs')) : null;
      const ket = meta == null ? null : meta <= CAM_META ? 'cam' : meta <= XEM || (afs != null && afs <= XEM) ? 'xem' : 'ok';
      const loi = (cu.loi ?? '').split('; ').filter((x) => x && !x.startsWith('giọng:')).join('; ') || null;
      await db.execute(sql`update etp.cham set lop = ${JSON.stringify(lop)}::jsonb, diem = ${JSON.stringify(diem)}::jsonb, ly_do = ${JSON.stringify(ly)}::jsonb,
        meta = ${meta}, afs = ${afs}, ket = coalesce(${ket}, ket), loi = ${loi}, luc = now() where creative_id = ${id}`);
    }
    const tu = b.giong.noi_dung.split(/\s+/).filter(Boolean).length;
    await db.execute(sql`update etp.cham_hang set trang_thai = 'xong', xong = now(), loi = null, buoc = 'xong · đã chép lại giọng',
      nhat_ky = nhat_ky || jsonb_build_array(jsonb_build_object('b', ${`đã chép lại giọng ${tu} từ${cu ? '' : ' (chưa có bản chấm để ghép)'}`}::text, 'luc', now())) where creative_id = ${id}`);
    return NextResponse.json({ ok: true, giong: tu });
  }
  if (b.lop && b.diem) {
    await db.execute(sql`insert into etp.cham (creative_id, doan, may, lop, diem, ly_do, khung, meta, afs, ket, loi)
      select ${id}, (select doan from etp.creative where creative_id = ${id}), 'cloudflare', ${JSON.stringify(b.lop)}::jsonb, ${JSON.stringify(b.diem)}::jsonb,
        ${JSON.stringify(b.ly_do ?? {})}::jsonb, ${JSON.stringify(b.khung ?? {})}::jsonb, ${b.meta ?? null}, ${b.afs ?? null}, ${b.ket ?? null}, ${b.loi ?? null}
      on conflict (creative_id) do update set doan = excluded.doan, luc = now(), may = excluded.may, lop = excluded.lop, diem = excluded.diem,
        ly_do = excluded.ly_do, khung = excluded.khung, meta = excluded.meta, afs = excluded.afs, ket = excluded.ket, loi = excluded.loi`);
  }
  const xong = !!(b.lop && b.diem);   // một lớp lỗi (vd giọng) vẫn có bản chấm — lỗi ghi kèm, cột lớp đó hiện "–"
  // lớp GIỌNG lỗi (Whisper hết lượt thử) → hàng CHÉP LẠI GIỌNG sau 10 phút, không để thẻ lấy chữ trên hình làm hook mãi
  if (xong && /(^|; )giọng:/.test(b.loi ?? '')) {
    await db.execute(sql`update etp.cham_hang set trang_thai = 'cho', nguon = 'giong', bat_dau = null, xong = null, lan_thu = 0, thu_lai_luc = now() + interval '10 minutes',
      loi = ${b.loi ?? null}, buoc = 'chờ chép lại giọng',
      nhat_ky = nhat_ky || jsonb_build_array(jsonb_build_object('b', ${`đã chấm · ${b.ket ?? ''} · giọng lỗi → chép lại giọng sau 10 phút`}::text, 'luc', now())) where creative_id = ${id}`);
    return NextResponse.json({ ok: true, chep_lai_giong: true });
  }
  // LỖI TẠM THỜI → TỰ THỬ LẠI (anh 26/10/2026: "Lỗi thì phải có cách xử lý chứ mày cứ để mãi ở đấy?"): mất mạng, Cloudflare lỗi nội bộ, đường Claude lỗi, mos2 5xx…
  // xếp lại hàng chờ, giãn 5 / 15 / 45 phút, tối đa 3 lần. Lỗi do VIDEO (> 100 MB, không cắt được khung) không thử lại ở đây — apps/etp/cham-nhe.py dựng bản xem nhẹ rồi xếp lại.
  const loiVideo = /vượt giới hạn 100 MB|cắt được \d+\/\d+ khung|không tải được video \(4|không có trong kho/.test(b.loi ?? '');
  if (!xong && !loiVideo) {
    const r = (await db.execute(sql`update etp.cham_hang set trang_thai = 'cho', bat_dau = null, lan_thu = lan_thu + 1, thu_lai_luc = now() + make_interval(mins => (5 * power(3, lan_thu))::int),
        loi = ${b.loi ?? null}, buoc = 'chờ thử lại',
        nhat_ky = nhat_ky || jsonb_build_array(jsonb_build_object('b', 'lỗi tạm thời, tự thử lại lần ' || (lan_thu + 1) || ' lúc ' || to_char((now() + make_interval(mins => (5 * power(3, lan_thu))::int)) at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI') || ': ' || ${(b.loi ?? '').slice(0, 120)}::text, 'luc', now()))
      where creative_id = ${id} and lan_thu < 3 returning creative_id`)) as unknown as unknown[];
    if (r.length) return NextResponse.json({ ok: true, thu_lai: true });
  }
  await db.execute(sql`update etp.cham_hang set trang_thai = ${xong ? 'xong' : 'loi'}, xong = now(), loi = ${b.loi ?? null}, buoc = ${xong ? 'xong' : 'lỗi'},
    nhat_ky = nhat_ky || jsonb_build_array(jsonb_build_object('b', ${xong ? `xong · ${b.ket ?? ''} · Meta ${b.meta ?? '–'} · AFS ${b.afs ?? '–'}` : `lỗi: ${(b.loi ?? '').slice(0, 150)}`}::text, 'luc', now())) where creative_id = ${id}`);
  return NextResponse.json({ ok: true });
}
