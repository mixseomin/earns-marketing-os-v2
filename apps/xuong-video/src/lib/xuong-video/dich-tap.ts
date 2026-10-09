// Dịch cả tập sang ngôn ngữ khác — MỘT đường cho server action (dichTapSang) và script trên box (scripts/dich-tap.mts).
// Giữ shot/keyframe/video/kỹ thuật, chỉ đổi chữ: kịch bản, chữ màn, lời thoại, bài đăng; rồi ghi ngon_ngu mới vào kinh thánh
// để các bước sau (viết lại shot, bài đăng, giọng) sinh đúng ngôn ngữ. Giọng đã sinh (thoai_url) KHÔNG xoá — trả về số shot cần sinh lại.
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { ghepThoai, giaChuCents, type BaiDang, type DongThoai, type KinhThanh } from './kieu';
import type { DauVaoDich } from './claude';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;
export type NoiDungDich = { phimId: number; kt: KinhThanh; dauVao: Omit<DauVaoDich, 'sang' | 'kinhThanh'>; thoaiGoc: Map<number, DongThoai[]>; soCoGiong: number; chars: number };

/** Gom chữ cần dịch của một tập (0đ). */
export async function docNoiDungDich(db: Db, tapId: number): Promise<NoiDungDich | null> {
  const t = (await db.execute(sql`SELECT t.phim_id, t.kich_ban, t.bai_dang, p.kinh_thanh FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return null;
  const rows = (await db.execute(sql`SELECT id, chu_man, thoai, thoai_url FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[];
  const thoaiGoc = new Map<number, DongThoai[]>();
  const canh = rows.map((r) => {
    const th = (Array.isArray(r.thoai) ? r.thoai : []) as DongThoai[];
    thoaiGoc.set(Number(r.id), th);
    return { id: Number(r.id), chu_man: String(r.chu_man ?? ''), thoai: th.map((d) => d.loi) };
  });
  const bd = (t[0].bai_dang ?? null) as BaiDang | null;
  const dauVao = { kichBan: String(t[0].kich_ban ?? ''), baiDang: bd ? { chu_bai: bd.chu_bai, tieu_de: bd.tieu_de, mo_ta: bd.mo_ta, cta: bd.cta } : null, canh };
  return { phimId: Number(t[0].phim_id), kt: (t[0].kinh_thanh ?? {}) as KinhThanh, dauVao, thoaiGoc, soCoGiong: rows.filter((r) => r.thoai_url).length, chars: demChu(dauVao) };
}
export const demChu = (d: Omit<DauVaoDich, 'sang' | 'kinhThanh'>): number => d.kichBan.length + JSON.stringify(d.baiDang ?? '').length + d.canh.reduce((a, c) => a + c.chu_man.length + c.thoai.join('').length, 0);
/** Ước lượng tiền (cents) một lượt dịch: ~3 ký tự/token đầu vào (tiếng Việt có dấu), bản dịch ra cỡ 0,8 lần đầu vào + 1,5k token khuôn/hệ thống. */
export const uocDichCents = (model: string, chars: number): number => giaChuCents(model, Math.ceil(chars / 3) + 1500, Math.ceil((chars * 0.8) / 3) + 300);

/** Gộp lời đã dịch vào dòng thoại gốc (giữ nhân vật, diễn xuất, url). Lệch số dòng → giữ dòng gốc cho phần thiếu. */
export function gopThoaiDich(goc: DongThoai[], loiMoi: string[]): DongThoai[] {
  return goc.map((d, i) => ({ ...d, loi: (loiMoi[i] ?? '').trim() || d.loi }));
}

export type KqDich = { kich_ban: string; bai_dang: Omit<BaiDang, 'luc'> | null; canh: { id: number; chu_man: string; thoai: string[] }[] };
/** Ghi bản dịch vào DB + đổi ngon_ngu trong kinh thánh. Trả về số shot đã đổi chữ. */
export async function apDungDich(db: Db, nd: NoiDungDich, tapId: number, sang: string, kq: KqDich): Promise<{ soShot: number; thieu: number }> {
  const theoId = new Map(kq.canh.map((c) => [c.id, c]));
  let soShot = 0, thieu = 0;
  for (const c of nd.dauVao.canh) {
    const m = theoId.get(c.id);
    if (!m) { thieu += 1; continue; }
    const thoai = gopThoaiDich(nd.thoaiGoc.get(c.id) ?? [], m.thoai);
    await db.execute(sql`UPDATE xv_canh SET chu_man = ${m.chu_man}, thoai = ${JSON.stringify(thoai)}::jsonb, loi_thoai = CASE WHEN ${thoai.length} > 0 THEN ${ghepThoai(thoai)} ELSE loi_thoai END, updated_at = now() WHERE id = ${c.id}`);
    soShot += 1;
  }
  const bd: BaiDang | null = kq.bai_dang && nd.dauVao.baiDang ? { ...kq.bai_dang, luc: new Date().toISOString() } : null;
  await db.execute(sql`UPDATE xv_tap SET kich_ban = CASE WHEN ${kq.kich_ban.trim().length > 0} THEN ${kq.kich_ban} ELSE kich_ban END, bai_dang = COALESCE(${bd ? JSON.stringify(bd) : null}::jsonb, bai_dang), updated_at = now() WHERE id = ${tapId}`);
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{ngon_ngu}', to_jsonb(${sang}::text)), updated_at = now() WHERE id = ${nd.phimId}`);
  return { soShot, thieu };
}
