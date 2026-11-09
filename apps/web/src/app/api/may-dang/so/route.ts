import { NextResponse } from 'next/server';
import { getCurrentUser, getEffectiveUser } from '@/lib/auth';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// TAB MÁY ĐĂNG (anh 09/11/2026) — sổ lượt đăng 7 bước (may_dang_so, máy đăng puzzle-books ghi qua dang-lien-tuc → may-dung.mts --trang-thai).
// GET ?ngay=1|3|7 [&tu=<iso>]: dòng trong khoảng (tu = chỉ dòng mới / vừa cập nhật sau mốc đó — trang hỏi lại mỗi 5 giây) + lượt ĐANG CHẠY lấy thẳng từ
//   nhật ký máy (bat-dau chưa có kết quả; quá 40 phút = mất dấu) để trang thấy ngay, không chờ hết vòng 10 phút.
// POST { id, viec }: thu_lai (lệnh cho máy iMac xoá sổ hỏng → vòng kế đăng lại) · bo_bai (bài này không lên nền này nữa) ·
//   go_chua_xn (gỡ sổ "đã bấm nhưng chưa xác nhận" để máy được đăng lại bài) · ghi_chu { chu }.
// Phạm vi: admin thấy mọi dự án; người khác chỉ dòng của dự án mà họ là thành viên (members.project_id).

type Dong = Record<string, unknown>;

async function phamVi(d: NonNullable<ReturnType<typeof getDb>>) {
  const eff = await getEffectiveUser();
  if (!eff) return null;
  if (eff.role === 'admin') return { tatCa: true as const, duAn: [] as string[], ten: eff.email };
  const r = (await d.execute(sql`SELECT DISTINCT project_id FROM members WHERE user_id = ${eff.id} AND project_id IS NOT NULL`)) as unknown as { project_id: string }[];
  return { tatCa: false as const, duAn: r.map((x) => x.project_id), ten: eff.email };
}

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const d = getDb(); if (!d) return NextResponse.json({ error: 'không có DB' }, { status: 500 });
  const pv = await phamVi(d); if (!pv) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const u = new URL(req.url), ngay = [1, 3, 7, 14].includes(Number(u.searchParams.get('ngay'))) ? Number(u.searchParams.get('ngay')) : 3;
  const tu = u.searchParams.get('tu'), tuOk = tu && !Number.isNaN(Date.parse(tu)) ? tu : null;
  const loc = pv.tatCa ? sql`true` : sql`s.du_an = ANY(${pv.duAn})`;
  const rows = (await d.execute(sql`SELECT s.id, s.ma, coalesce(m.ten, s.ma) AS may_ten, s.nen, s.du_an, s.may_mac, s.bd, s.kt, s.giay, s.ket, s.buoc_dung, s.ma_ly, s.loi, s.slug, s.url,
      s.acct, s.profile, s.duong, s.buoc, s.lan, s.nguon, s.ghi_chu,
      (SELECT v.da_dang->s.nen FROM xv_may_video v WHERE v.may_id = m.id AND v.slug = s.slug) AS so_dang,
      (SELECT json_build_object('id', l.id, 'luc', l.luc, 'xong_luc', l.xong_luc) FROM may_dang_lenh l WHERE l.luot_id = s.id ORDER BY l.id DESC LIMIT 1) AS lenh
    FROM may_dang_so s LEFT JOIN xv_may m ON m.ma = s.ma
    WHERE coalesce(s.kt, s.bd) > now() - make_interval(days => ${ngay}) AND ${loc}
      ${tuOk ? sql`AND (s.kt >= ${tuOk}::timestamptz OR s.bd >= ${tuOk}::timestamptz OR EXISTS (SELECT 1 FROM may_dang_lenh l WHERE l.luot_id = s.id AND coalesce(l.xong_luc, l.luc) >= ${tuOk}::timestamptz))` : sql``}
    ORDER BY s.bd DESC LIMIT 4000`)) as unknown as Dong[];
  // ĐANG CHẠY: 'bat-dau' trong 3 giờ chưa có kết quả (dang/hỏng) cùng máy × nền sau nó và chưa vào sổ — vòng 10 phút chỉ gửi sổ khi xong cả vòng
  const locM = pv.tatCa ? sql`true` : sql`m.du_an = ANY(${pv.duAn})`;
  const chay = (await d.execute(sql`SELECT b.id, m.ma, m.ten AS may_ten, b.nen, m.du_an, b.luc AS bd, b.slug, b.noi_dung,
      (SELECT json_build_object('luc', e.luc, 'ok', e.ok, 'url', e.url, 'noi_dung', e.noi_dung) FROM xv_may_nhat_ky e WHERE e.may_id = b.may_id AND e.nen = b.nen AND e.buoc = 'dang'
         AND e.luc >= b.luc AND (e.noi_dung LIKE 'Đã đăng%' OR NOT e.ok) ORDER BY e.luc LIMIT 1) AS kq
    FROM xv_may_nhat_ky b JOIN xv_may m ON m.id = b.may_id
    WHERE b.buoc = 'bat-dau' AND b.luc > now() - interval '3 hours' AND ${locM}
      AND NOT EXISTS (SELECT 1 FROM may_dang_so s WHERE s.ma = m.ma AND s.nen = b.nen AND s.bd >= b.luc - interval '15 minutes' AND s.nguon = 'may')
    ORDER BY b.luc DESC LIMIT 50`)) as unknown as Dong[];
  return NextResponse.json({ rows, chay, luc: new Date().toISOString(), ngay, admin: pv.tatCa });
}

export async function POST(req: Request) {
  const me = await getCurrentUser(); if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const d = getDb(); if (!d) return NextResponse.json({ error: 'không có DB' }, { status: 500 });
  const pv = await phamVi(d); if (!pv) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: number; viec?: string; chu?: string };
  const id = Number(b.id); if (!id) return NextResponse.json({ error: 'thiếu id lượt' }, { status: 400 });
  const r = ((await d.execute(sql`SELECT id, ma, nen, du_an, slug, ket FROM may_dang_so WHERE id = ${id}`)) as unknown as { id: number; ma: string; nen: string; du_an: string; slug: string | null; ket: string }[])[0];
  if (!r) return NextResponse.json({ error: `không có lượt #${id}` }, { status: 404 });
  if (!pv.tatCa && !pv.duAn.includes(r.du_an)) return NextResponse.json({ error: 'lượt này thuộc dự án anh/chị không được giao' }, { status: 403 });
  const ai = me.email ?? String(me.id), ghi = (chu: string) => d.execute(sql`UPDATE may_dang_so SET ghi_chu = ghi_chu || ${JSON.stringify([{ ai, luc: new Date().toISOString(), chu }])}::jsonb WHERE id = ${id}`);

  if (b.viec === 'ghi_chu') {
    const chu = String(b.chu ?? '').trim().slice(0, 2000); if (!chu) return NextResponse.json({ error: 'ghi chú trống' }, { status: 400 });
    await ghi(chu); return NextResponse.json({ ok: true, bao: 'đã lưu ghi chú' });
  }
  if (b.viec === 'thu_lai') {
    // máy đọc lệnh đầu vòng 10 phút kế (dang-lien-tuc › nhanLenh), xoá sổ hỏng máy|nền → không chờ 30 phút / tới mai
    const cho = (await d.execute(sql`SELECT id FROM may_dang_lenh WHERE ma = ${r.ma} AND nen = ${r.nen} AND loai = 'thu_lai' AND xong_luc IS NULL`)) as unknown as unknown[];
    if (!cho.length) await d.execute(sql`INSERT INTO may_dang_lenh (loai, ma, nen, luot_id, boi) VALUES ('thu_lai', ${r.ma}, ${r.nen}, ${id}, ${ai})`);
    await ghi('⟳ thử lại: lệnh gửi máy — máy nhận ở vòng kế (≤ 10 phút), xoá đếm hỏng rồi đăng theo nhịp an toàn');
    return NextResponse.json({ ok: true, bao: cho.length ? 'đã có lệnh thử lại đang chờ máy nhận' : 'đã gửi lệnh — máy nhận ở vòng kế (≤ 10 phút)' });
  }
  if (b.viec === 'bo_bai' || b.viec === 'go_chua_xn') {
    if (!r.slug) return NextResponse.json({ error: 'lượt này chưa chọn bài' }, { status: 400 });
    const may = sql`(SELECT id FROM xv_may WHERE ma = ${r.ma})`;
    if (b.viec === 'bo_bai') {
      // đánh dấu trong sổ đăng của bài: máy đăng bỏ bài đã có mục ở nền này (chọn bài lọc !da_dang[nen]); không có ngay/luc nên không tính vào trần / tuổi kênh
      const x = (await d.execute(sql`UPDATE xv_may_video SET da_dang = jsonb_set(da_dang, ARRAY[${r.nen}], ${JSON.stringify({ bo: true, boi: ai, bo_luc: new Date().toISOString(), url: null })}::jsonb), updated_at = now()
        WHERE may_id = ${may} AND slug = ${r.slug} AND NOT (da_dang ? ${r.nen}) RETURNING id`)) as unknown as unknown[];
      if (!x.length) return NextResponse.json({ error: 'bài đã có trong sổ đăng nền này (đã lên / đã bỏ) — không đổi' }, { status: 409 });
      await ghi(`✕ bỏ bài ${r.slug} khỏi ${r.nen} — máy không chọn lại`);
      return NextResponse.json({ ok: true, bao: `máy sẽ không đăng ${r.slug} lên ${r.nen}` });
    }
    const x = (await d.execute(sql`UPDATE xv_may_video SET da_dang = da_dang - ${r.nen}, updated_at = now()
      WHERE may_id = ${may} AND slug = ${r.slug} AND (da_dang->${r.nen}->>'chuaXacNhan') = 'true' AND coalesce(da_dang->${r.nen}->>'url', '') = '' RETURNING id`)) as unknown as unknown[];
    if (!x.length) return NextResponse.json({ error: 'sổ đăng không ghi "chưa xác nhận" cho bài này (hoặc đã có link) — không gỡ' }, { status: 409 });
    await ghi(`↺ gỡ "chưa xác nhận" của ${r.slug} trên ${r.nen} — máy được đăng lại bài này`);
    return NextResponse.json({ ok: true, bao: 'đã gỡ — lượt kế máy có thể đăng lại bài này' });
  }
  return NextResponse.json({ error: 'việc không biết' }, { status: 400 });
}
