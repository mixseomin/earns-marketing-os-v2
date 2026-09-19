// Sổ ý tưởng & bước — logic dùng chung cho API ext (CLI ~/bin/ideas) và trang /y-tuong.
// Quy ước trạng thái (anh chốt 19-20/09/2026): Xong phải có kết quả · Kẹt phải ghi chờ gì · Đang chỉ khi đang làm.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export * from './y-tuong-shared';
import { BUOC_TRANG_THAI, type Buoc, type YTuong, type YTuongChiTiet, type BuocPatch } from './y-tuong-shared';

const rows = <T,>(r: unknown) => r as T[];
function db() { const d = getDb(); if (!d) throw new Error('db'); return d; }

/** "⛔ #3 …" (kẹt) → "▶ #n" (đang) → "○ #n" (chưa) → "✓ hết bước" / "(chưa có bước)". */
export function buocHienTai(b: Pick<Buoc, 'thu_tu' | 'buoc' | 'trang_thai'>[]): string {
  const pick = (st: string, mark: string) => { const x = b.find((s) => s.trang_thai === st); return x ? `${mark} #${x.thu_tu} ${x.buoc}` : null; };
  return pick('Kẹt', '⛔') ?? pick('Đang', '▶') ?? pick('Chưa', '○') ?? (b.length ? '✓ hết bước' : '(chưa có bước)');
}

const SUMMARY = sql`
  SELECT y.*, s.tong, s.xong, s.cap_nhat, s.buoc_json
  FROM y_tuong y
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS tong, count(*) FILTER (WHERE b.trang_thai = 'Xong')::int AS xong,
           to_char(max(b.ngay_xong), 'YYYY-MM-DD') AS cap_nhat,
           COALESCE(json_agg(json_build_object('thu_tu', b.thu_tu, 'buoc', b.buoc, 'trang_thai', b.trang_thai) ORDER BY b.thu_tu) FILTER (WHERE b.id IS NOT NULL), '[]'::json) AS buoc_json
    FROM y_tuong_buoc b WHERE b.y_tuong_id = y.id
  ) s ON true`;

function mapRow(r: Record<string, unknown>): YTuong {
  const buoc = (r.buoc_json as Array<Pick<Buoc, 'thu_tu' | 'buoc' | 'trang_thai'>>) ?? [];
  const { buoc_json: _b, ...rest } = r;
  return { ...(rest as unknown as YTuong), tong: Number(r.tong ?? 0), xong: Number(r.xong ?? 0), cap_nhat: (r.cap_nhat as string | null) ?? null, buoc_hien_tai: buocHienTai(buoc) };
}

export async function listYTuong(nhom?: string): Promise<YTuong[]> {
  const r = await db().execute(sql`${SUMMARY} ${nhom ? sql`WHERE y.nhom = ${nhom}` : sql``} ORDER BY y.nhom, y.ma`);
  return rows<Record<string, unknown>>(r).map(mapRow);
}

export async function getYTuong(id: number): Promise<YTuongChiTiet | null> {
  const r = rows<Record<string, unknown>>(await db().execute(sql`${SUMMARY} WHERE y.id = ${id}`));
  const first = r[0];
  if (!first) return null;
  const buoc = rows<Buoc>(await db().execute(sql`SELECT id, y_tuong_id, thu_tu, buoc, trang_thai, to_char(ngay_xong, 'YYYY-MM-DD') AS ngay_xong, ket_qua, ghi_chu, updated_at FROM y_tuong_buoc WHERE y_tuong_id = ${id} ORDER BY thu_tu`));
  const nhat_ky = rows<{ ts: string; noi_dung: string; buoc_id: number | null }>(await db().execute(sql`SELECT ts, noi_dung, buoc_id FROM y_tuong_nhat_ky WHERE y_tuong_id = ${id} ORDER BY ts DESC LIMIT 50`));
  return { ...mapRow(first), buoc, nhat_ky };
}

/** Mã kế tiếp trong nhóm: chữ đầu của nhóm (viết hoa) + 2 số — iOS → I01, ExamWeight → E01. */
export async function maKeTiep(nhom: string): Promise<string> {
  const prefix = (nhom.trim()[0] ?? 'X').toUpperCase();
  const r = rows<{ n: number }>(await db().execute(sql`SELECT COALESCE(max(NULLIF(regexp_replace(ma, '\D', '', 'g'), '')::int), 0)::int AS n FROM y_tuong WHERE nhom = ${nhom}`));
  return `${prefix}${String((r[0]?.n ?? 0) + 1).padStart(2, '0')}`;
}

export interface YTuongInput { nhom: string; ten: string; uu_tien?: number; trang_thai?: string; lan?: string; goc?: string; mo_ta?: string; ghi_chu?: string; link?: string; tab?: string; project_id?: string | null; ma?: string }

export async function themYTuong(i: YTuongInput, buoc: string[] = []): Promise<YTuongChiTiet> {
  const ma = i.ma?.trim() || (await maKeTiep(i.nhom));
  const r = rows<{ id: number }>(await db().execute(sql`
    INSERT INTO y_tuong (nhom, ma, ten, uu_tien, trang_thai, lan, goc, mo_ta, ghi_chu, link, tab, project_id)
    VALUES (${i.nhom}, ${ma}, ${i.ten}, ${i.uu_tien ?? 2}, ${i.trang_thai ?? 'Ý tưởng'}, ${i.lan ?? ''}, ${i.goc ?? ''}, ${i.mo_ta ?? ''}, ${i.ghi_chu ?? ''}, ${i.link ?? ''}, ${i.tab ?? ''}, ${i.project_id ?? null})
    RETURNING id`));
  const id = r[0]?.id;
  if (!id) throw new Error('insert y_tuong');
  if (buoc.length) await datBuoc(id, buoc, 'append');
  await ghiNhatKy(id, null, `tạo ý tưởng ${ma} · ${i.ten}`);
  return (await getYTuong(id))!;
}

export async function suaYTuong(id: number, patch: Partial<YTuongInput>): Promise<YTuongChiTiet | null> {
  const cols: Record<string, unknown> = {};
  for (const k of ['nhom', 'ma', 'ten', 'uu_tien', 'trang_thai', 'lan', 'goc', 'mo_ta', 'ghi_chu', 'link', 'tab', 'project_id'] as const) if (patch[k] !== undefined) cols[k] = patch[k];
  if (!Object.keys(cols).length) return getYTuong(id);
  const sets = Object.entries(cols).map(([k, v]) => sql`${sql.identifier(k)} = ${v as string | number | null}`);
  await db().execute(sql`UPDATE y_tuong SET ${sql.join(sets, sql`, `)}, updated_at = now() WHERE id = ${id}`);
  if (patch.trang_thai) await ghiNhatKy(id, null, `ý tưởng → ${patch.trang_thai}`);
  return getYTuong(id);
}

/** append: thêm vào cuối; replace: viết lại toàn bộ, bước cùng chữ giữ trạng thái/ngày/kết quả/ghi chú. */
export async function datBuoc(id: number, buoc: string[], mode: 'append' | 'replace'): Promise<Buoc[]> {
  const d = db();
  const cu = rows<Buoc>(await d.execute(sql`SELECT * FROM y_tuong_buoc WHERE y_tuong_id = ${id} ORDER BY thu_tu`));
  if (mode === 'append') {
    let n = cu.reduce((m, b) => Math.max(m, b.thu_tu), 0);
    for (const b of buoc) { n++; await d.execute(sql`INSERT INTO y_tuong_buoc (y_tuong_id, thu_tu, buoc) VALUES (${id}, ${n}, ${b})`); }
    await ghiNhatKy(id, null, `thêm ${buoc.length} bước (#${n - buoc.length + 1}..#${n})`);
  } else {
    const keep = new Map(cu.map((b) => [b.buoc, b]));
    await d.execute(sql`DELETE FROM y_tuong_buoc WHERE y_tuong_id = ${id}`);
    for (const [i, text] of buoc.entries()) {
      const k = keep.get(text);
      await d.execute(sql`INSERT INTO y_tuong_buoc (y_tuong_id, thu_tu, buoc, trang_thai, ngay_xong, ket_qua, ghi_chu)
        VALUES (${id}, ${i + 1}, ${text}, ${k?.trang_thai ?? 'Chưa'}, ${k?.ngay_xong ?? null}, ${k?.ket_qua ?? ''}, ${k?.ghi_chu ?? ''})`);
    }
    await ghiNhatKy(id, null, `viết lại bước: ${cu.length} → ${buoc.length}`);
  }
  await tinhLaiTrangThai(id);
  return rows<Buoc>(await d.execute(sql`SELECT id, y_tuong_id, thu_tu, buoc, trang_thai, to_char(ngay_xong, 'YYYY-MM-DD') AS ngay_xong, ket_qua, ghi_chu, updated_at FROM y_tuong_buoc WHERE y_tuong_id = ${id} ORDER BY thu_tu`));
}

export async function suaBuoc(buocId: number, p: BuocPatch): Promise<{ buoc: Buoc; y_tuong: YTuongChiTiet } | null> {
  const d = db();
  const cu = rows<Buoc>(await d.execute(sql`SELECT * FROM y_tuong_buoc WHERE id = ${buocId}`))[0];
  if (!cu) return null;
  if (p.trang_thai && !(BUOC_TRANG_THAI as readonly string[]).includes(p.trang_thai)) throw new Error('trạng thái bước: ' + BUOC_TRANG_THAI.join(' | '));
  const tt = p.trang_thai ?? cu.trang_thai;
  // Xong → điền ngày (giữ ngày cũ nếu đã Xong); Chưa → xoá ngày; còn lại giữ nguyên
  const ngay = tt === 'Xong' ? sql`COALESCE(CASE WHEN ${cu.trang_thai} = 'Xong' THEN ngay_xong END, CURRENT_DATE)` : tt === 'Chưa' ? sql`NULL` : sql`ngay_xong`;
  await d.execute(sql`UPDATE y_tuong_buoc SET trang_thai = ${tt}, ngay_xong = ${ngay}, ket_qua = ${p.ket_qua ?? cu.ket_qua}, ghi_chu = ${p.ghi_chu ?? cu.ghi_chu}, buoc = ${p.buoc ?? cu.buoc}, updated_at = now() WHERE id = ${buocId}`);
  const parts = [p.trang_thai && p.trang_thai !== cu.trang_thai ? `#${cu.thu_tu} → ${tt}` : null, p.ket_qua !== undefined && p.ket_qua !== cu.ket_qua ? 'kết quả' : null, p.ghi_chu !== undefined && p.ghi_chu !== cu.ghi_chu ? 'ghi chú' : null].filter(Boolean);
  if (parts.length) await ghiNhatKy(cu.y_tuong_id, buocId, parts.join(' · '));
  await tinhLaiTrangThai(cu.y_tuong_id);
  const yt = (await getYTuong(cu.y_tuong_id))!;
  return { buoc: yt.buoc.find((b) => b.id === buocId)!, y_tuong: yt };
}

/** Trạng thái ý tưởng theo bước (trừ Tạm dừng/Bỏ đặt tay): có Kẹt → Kẹt; tất cả Xong → Xong; có Đang/Xong → Đang làm. */
export async function tinhLaiTrangThai(id: number): Promise<void> {
  const d = db();
  const yt = rows<{ trang_thai: string }>(await d.execute(sql`SELECT trang_thai FROM y_tuong WHERE id = ${id}`))[0];
  if (!yt || yt.trang_thai === 'Tạm dừng' || yt.trang_thai === 'Bỏ') return;
  const b = rows<{ trang_thai: string }>(await d.execute(sql`SELECT trang_thai FROM y_tuong_buoc WHERE y_tuong_id = ${id} AND trang_thai <> 'Bỏ'`));
  let moi = yt.trang_thai;
  if (b.some((x) => x.trang_thai === 'Kẹt')) moi = 'Kẹt';
  else if (b.length && b.every((x) => x.trang_thai === 'Xong')) moi = 'Xong';
  else if (b.some((x) => x.trang_thai === 'Đang' || x.trang_thai === 'Xong')) moi = 'Đang làm';
  else if (yt.trang_thai === 'Kẹt' || yt.trang_thai === 'Đang làm' || yt.trang_thai === 'Xong') moi = 'Sẵn sàng';
  if (moi !== yt.trang_thai) {
    await d.execute(sql`UPDATE y_tuong SET trang_thai = ${moi}, updated_at = now() WHERE id = ${id}`);
    await ghiNhatKy(id, null, `ý tưởng → ${moi} (theo bước)`);
  }
}

export async function ghiNhatKy(id: number, buocId: number | null, noiDung: string): Promise<void> {
  await db().execute(sql`INSERT INTO y_tuong_nhat_ky (y_tuong_id, buoc_id, noi_dung) VALUES (${id}, ${buocId}, ${noiDung})`);
}

/** Bước đang Kẹt toàn portfolio — cho /now (blocker) và trang. */
export async function listBuocKet(): Promise<Array<{ nhom: string; ma: string; ten: string; thu_tu: number; buoc: string; ghi_chu: string; updated_at: string }>> {
  return rows(await db().execute(sql`
    SELECT y.nhom, y.ma, y.ten, b.thu_tu, b.buoc, b.ghi_chu, b.updated_at
    FROM y_tuong_buoc b JOIN y_tuong y ON y.id = b.y_tuong_id
    WHERE b.trang_thai = 'Kẹt' AND y.trang_thai NOT IN ('Bỏ', 'Tạm dừng') ORDER BY b.updated_at`));
}
