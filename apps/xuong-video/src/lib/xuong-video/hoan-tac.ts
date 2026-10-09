// Hoàn tác thao tác nhầm (#1252): MỘT cửa cho mọi đường sửa/chọn trong actions.ts — chụp giá trị cũ của đúng các cột sắp đổi
// (chupTruoc) trước khi UPDATE; ↶ Hoàn tác (hoanTacGanNhat) ghi lại giá trị cũ bằng jsonb_populate_record nên kiểu cột do Postgres
// lo, không ép kiểu tay. Tên bảng/cột đi qua sql.raw nên CHỈ nhận thứ nằm trong sổ COT_CHO_PHEP. Xoá/khôi phục là việc của thung-rac.ts.
import 'server-only';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { getDb } from '@mos2/db';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;
export type BangHoanTac = 'xv_phim' | 'xv_tap' | 'xv_canh' | 'xv_nhan_vat' | 'xv_bien_the';
export const COT_CHO_PHEP: Record<BangHoanTac, readonly string[]> = {
  xv_phim: ['ten', 'loai', 'mo_ta', 'kinh_thanh', 'trang_thai'],
  xv_tap: ['ten', 'brief', 'kich_ban', 'tom_tat', 'so', 'noi_khung', 'nhac_mo_ta', 'thoi_luong_s', 'bai_dang', 'beats', 'phan_canh', 'nhac_phan_canh'],
  xv_canh: ['canh', 'goc_may', 'hanh_dong', 'loi_thoai', 'am_thanh', 'thoi_luong_s', 'nhan_vat', 'bien_the', 'prompt_anh', 'prompt_video', 'thu_tu', 'phan_doan', 'cam_xuc', 'ky_thuat', 'thoai', 'thoai_url', 'trang_phuc', 'phat_s', 'chu_man', 'nhanh', 'kieu_chu', 'keyframe_url', 'keyframe_uv', 'trang_thai', 'loi', 'video_url', 'video_cuoi_url'],
  xv_nhan_vat: ['ten', 'mo_ta', 'anh_ref', 'giong', 'giong_model', 'giong_id', 'giong_mau_url'],
  xv_bien_the: ['nhom', 'ten', 'mo_ta'],
};
/** Lọc danh sách cột về đúng sổ cho phép của bảng (cột lạ bỏ, không ném). */
export const locCot = (bang: BangHoanTac, cot: readonly string[]): string[] => [...new Set(cot)].filter((c) => COT_CHO_PHEP[bang].includes(c));
const rows = async (db: Db, q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as Row[];

/** Phim chứa bản ghi (để nút Hoàn tác của phim thấy đúng việc). */
async function phimCua(db: Db, bang: BangHoanTac, id: number): Promise<number | null> {
  const q = bang === 'xv_phim' ? sql`SELECT id AS p FROM xv_phim WHERE id = ${id}`
    : bang === 'xv_tap' ? sql`SELECT phim_id AS p FROM xv_tap WHERE id = ${id}`
    : bang === 'xv_canh' ? sql`SELECT t.phim_id AS p FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${id}`
    : bang === 'xv_nhan_vat' ? sql`SELECT phim_id AS p FROM xv_nhan_vat WHERE id = ${id}`
    : sql`SELECT v.phim_id AS p FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE b.id = ${id}`;
  const r = await rows(db, q);
  return r[0]?.p == null ? null : Number(r[0].p);
}

/** Chụp giá trị CŨ của các cột sắp đổi, gọi NGAY TRƯỚC câu UPDATE. Trả về mã nhóm (để chụp thêm bản ghi cùng thao tác). */
export async function chupTruoc(db: Db, o: { bang: BangHoanTac; id: number; cot: readonly string[]; moTa: string; nguoi: string; nhom?: string }): Promise<string> {
  const nhom = o.nhom ?? randomUUID();
  const cot = locCot(o.bang, o.cot);
  if (!cot.length) return nhom;
  const phimId = await phimCua(db, o.bang, o.id);
  if (phimId == null) return nhom;
  // Một chuỗi raw duy nhất cho phần SELECT: nhúng sql`…` con vào sql`…` thì drizzle bọc ngoặc → "AS truoc(, thu_tu…)" lỗi cú pháp, mọi thao tác
  // sửa shot gãy từ adafb308 tới 4/fix (09/10/2026). Cột lấy từ sổ COT_CHO_PHEP nên raw an toàn.
  const chon = `jsonb_build_object(${cot.map((c) => `'${c}', "${c}"`).join(', ')}) AS truoc${o.bang === 'xv_canh' ? ', thu_tu AS _thu_tu' : ''}`;
  const r = await rows(db, sql`SELECT ${sql.raw(chon)} FROM ${sql.raw(o.bang)} WHERE id = ${o.id}`);
  if (!r[0]) return nhom;
  const moTa = o.bang === 'xv_canh' && r[0]._thu_tu != null ? `${o.moTa} · shot #${r[0]._thu_tu}` : o.moTa;
  await db.execute(sql`INSERT INTO xv_hoan_tac (phim_id, nhom, bang, ban_ghi_id, cot, truoc, mo_ta, nguoi)
    VALUES (${phimId}, ${nhom}, ${o.bang}, ${o.id}, ${`{${cot.join(',')}}`}::text[], ${JSON.stringify(r[0].truoc)}::jsonb, ${moTa}, ${o.nguoi})`);
  return nhom;
}

export type MucHoanTac = { nhom: string; mo_ta: string; luc: string; so: number };
/** Thao tác mới nhất chưa hoàn của phim (để hiện trên nút). */
export async function ganNhat(db: Db, phimId: number): Promise<MucHoanTac | null> {
  const r = await rows(db, sql`SELECT nhom, min(mo_ta) AS mo_ta, max(created_at) AS luc, count(*) AS so FROM xv_hoan_tac WHERE phim_id = ${phimId} AND da_hoan = false GROUP BY nhom ORDER BY max(created_at) DESC LIMIT 1`);
  if (!r[0]) return null;
  return { nhom: String(r[0].nhom), mo_ta: String(r[0].mo_ta), luc: new Date(String(r[0].luc)).toISOString(), so: Number(r[0].so) };
}
/** Ghi lại giá trị cũ của thao tác mới nhất (cả nhóm), đánh dấu đã hoàn. Trả về mô tả việc vừa hoàn. */
export async function hoanTacGanNhat(db: Db, phimId: number): Promise<string | null> {
  const m = await ganNhat(db, phimId);
  if (!m) return null;
  const ds = await rows(db, sql`SELECT id, bang, ban_ghi_id, cot, truoc FROM xv_hoan_tac WHERE nhom = ${m.nhom} AND da_hoan = false ORDER BY id`);
  for (const r of ds) {
    const bang = String(r.bang) as BangHoanTac;
    const cot = locCot(bang, (r.cot as string[]) ?? []);
    if (!COT_CHO_PHEP[bang] || !cot.length) continue;
    await db.execute(sql`UPDATE ${sql.raw(bang)} b SET ${sql.raw(cot.map((c) => `"${c}" = s."${c}"`).join(', '))}, updated_at = now()
      FROM jsonb_populate_record(NULL::${sql.raw(bang)}, ${JSON.stringify(r.truoc)}::jsonb) s WHERE b.id = ${Number(r.ban_ghi_id)}`);
  }
  await db.execute(sql`UPDATE xv_hoan_tac SET da_hoan = true WHERE nhom = ${m.nhom}`);
  return m.mo_ta;
}
