'use server';
// NGĂN PHIM (anh 02/11/2026 "Ko có khả năng xem nội dung phim đang có là gì!!!?"): mở theo mã phim thư viện (= content_id của camp) — đọc nội dung thật
// từ Ethopex (GET api-multi-be /api/v2/movie/groups/{group_id}, group_id ở etp.thu_vien do apps/etp/thu_vien_phim.py ghi), lưu đệm 7 ngày ở etp.noi_dung_phim;
// kèm bảng điểm chọn phim (xv_khoa_ngoai['ethopex_co_the_test'] — chon-phim-moi.py), trang phim workspace, số camp. CHỈ ĐỌC Ethopex.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

const CDN = 'https://acdn.dofez.com';   // CDN ảnh của Ethopex (app.ethopex.dev cdn-url: assetCdnBaseUrl mặc định)
const anhUrl = (p: unknown) => (typeof p === 'string' && p.trim() ? (/^https?:\/\//.test(p) ? p : `${CDN}/${p.replace(/^\/+/, '')}`) : null);

export type PhimNoiDung = {
  id: number; ten: string | null; locale: string | null; nguon: string | null; anh: string | null; url: string | null;
  tom_tat: string | null; mo_ta: string | null; cot_truyen: string | null; the: string[]; so_tap: number | null; doc_luc: string | null; loi_doc: string | null;
  diem: { hang: number; tong: number; diem: number; ct: [string, number][]; qc_dang: number | null; qc_tra: string | null } | null;
  trang: { ws: number; nguoi: string | null; thieu: string[] }[];
  camp: { nha: number; doi: number; chay: number };
};

export async function docPhimEtp(id: number): Promise<{ ok: true; phim: PhimNoiDung } | { loi: string }> {
  if (!(await quyenEtp(await getCurrentUser()))) return { loi: 'không có quyền' };
  const db = getDb()!, ma = Math.trunc(Number(id));
  if (!(ma > 0)) return { loi: 'mã phim không hợp lệ' };
  const run = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
  const [tv] = await run<{ nhom_id: string | null; ten: string | null; locale: string | null; anh: string | null; url: string | null }>(sql`select nhom_id, ten, locale, anh, url from etp.thu_vien where content_id = ${ma}`);
  const [ph] = await run<{ ten: string | null; locale: string | null; nguon: string | null }>(sql`select ten, locale, nguon from etp.phim where content_id = ${ma}`);
  // nội dung: bản đệm < 7 ngày, không có thì gọi Ethopex theo group_id
  let nd: Record<string, unknown> | null = null, docLuc: string | null = null, loiDoc: string | null = null;
  const [dem] = await run<{ du_lieu: Record<string, unknown>; luc: string }>(sql`select du_lieu, luc::text luc from etp.noi_dung_phim where content_id = ${ma} and luc > now() - interval '7 days'`);
  if (dem) { nd = dem.du_lieu; docLuc = dem.luc; }
  else if (tv?.nhom_id) {
    try {
      const [k] = await run<{ t: string | null }>(sql`select gia_tri->>'access_token' t from xv_khoa_ngoai where ten = 'ethopex'`);
      const r = await fetch(`https://api-multi-be.ethopex.dev/api/v2/movie/groups/${encodeURIComponent(String(tv.nhom_id))}`, { headers: { authorization: `Bearer ${k?.t ?? ''}`, 'user-agent': 'mos2-etp' }, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
      if (!r.ok) loiDoc = `Ethopex trả ${r.status}`;
      else {
        nd = ((await r.json()) as { item?: Record<string, unknown> }).item ?? null;
        if (nd) { await db.execute(sql`insert into etp.noi_dung_phim (content_id, du_lieu) values (${ma}, ${JSON.stringify(nd)}::jsonb) on conflict (content_id) do update set du_lieu = excluded.du_lieu, luc = now()`); docLuc = new Date().toISOString(); }
      }
    } catch (e) { loiDoc = `không đọc được Ethopex: ${(e as Error).message.slice(0, 120)}`; }
  } else loiDoc = 'phim chưa có trong kho thư viện (etp.thu_vien) — chưa biết group_id để đọc nội dung';
  const [ct] = await run<{ x: Record<string, unknown>; i: string; tong: string }>(sql`select x, i, jsonb_array_length(gia_tri->'ds') tong from xv_khoa_ngoai, jsonb_array_elements(gia_tri->'ds') with ordinality t(x, i)
      where ten = 'ethopex_co_the_test' and x->>'id' = ${String(ma)}`);
  const trang = await run<{ content_id: string; nguoi: string | null; thieu: string[] }>(sql`select content_id, nguoi, thieu from etp.trang_phim_v where ref_id = ${ma} order by sua desc`);
  const [cp] = await run<{ nha: string; doi: string; chay: string }>(sql`select (select count(*) from etp.camp where content_id = ${ma}) nha, (select count(*) from etp.camp_ngoai where content_id = ${ma}) doi,
      (select count(*) from etp.camp where content_id = ${ma} and trang_thai = 'ACTIVE') + (select count(*) from etp.camp_ngoai where content_id = ${ma} and trang_thai = 'ACTIVE') chay`);
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const url = s(nd?.redirect_url) ?? tv?.url ?? null;
  return { ok: true, phim: {
    id: ma, ten: s(nd?.title) ?? tv?.ten ?? ph?.ten ?? null, locale: s(nd?.locale) ?? tv?.locale ?? ph?.locale ?? null,
    nguon: url && url.includes('//') ? url.split('/')[2]!.replace(/^www\./, '') : ph?.nguon ?? null, anh: anhUrl(nd?.thumbnail ?? tv?.anh), url,
    tom_tat: s(nd?.short_description), mo_ta: s(nd?.description), cot_truyen: s(nd?.storyline),
    the: (s(nd?.tags) ?? '').split(',').map((x) => x.trim()).filter(Boolean), so_tap: nd?.total_episodes ? Number(nd.total_episodes) : null, doc_luc: docLuc, loi_doc: loiDoc,
    diem: ct ? { hang: Number(ct.i), tong: Number(ct.tong), diem: Number(ct.x.diem), ct: (Array.isArray(ct.x.diem_ct) ? ct.x.diem_ct : []) as [string, number][],
      qc_dang: ct.x.qc_dang == null ? null : Number(ct.x.qc_dang), qc_tra: (ct.x.qc_tra as string) ?? null } : null,
    trang: trang.map((t) => ({ ws: Number(t.content_id), nguoi: t.nguoi, thieu: Array.isArray(t.thieu) ? t.thieu : [] })),
    camp: { nha: Number(cp?.nha ?? 0), doi: Number(cp?.doi ?? 0), chay: Number(cp?.chay ?? 0) },
  } };
}
