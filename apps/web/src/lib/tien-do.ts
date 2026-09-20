// Sổ TIẾN ĐỘ (hạng mục → bước) — logic dùng chung cho API ext (CLI ~/bin/tiendo) và view Tiến độ trong Plays.
// Quy ước trạng thái (anh chốt 19-20/09/2026): Xong phải có kết quả · Kẹt phải ghi chờ gì · Đang chỉ khi đang làm.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

export * from './tien-do-shared';
import { BUOC_TRANG_THAI, TRANG_THAI_MARK, type Buoc, type BuocTrangThai, type HangMuc, type HangMucChiTiet, type BuocPatch } from './tien-do-shared';

const rows = <T,>(r: unknown) => r as T[];
function db() { const d = getDb(); if (!d) throw new Error('db'); return d; }

/** "⛔ #3 …" (kẹt) → "▶ #n" (đang) → "○ #n" (chưa) → "✓ hết bước" / "(chưa có bước)". Dấu lấy từ TRANG_THAI_MARK (một nguồn với UI). */
export function buocHienTai(b: Pick<Buoc, 'thu_tu' | 'buoc' | 'trang_thai'>[]): string {
  const pick = (st: BuocTrangThai) => { const x = b.find((s) => s.trang_thai === st); return x ? `${TRANG_THAI_MARK[st]} #${x.thu_tu} ${x.buoc}` : null; };
  return pick('Kẹt') ?? pick('Đang') ?? pick('Đợi số') ?? pick('Chưa') ?? (b.length ? `${TRANG_THAI_MARK.Xong} hết bước` : '(chưa có bước)');
}

const SUMMARY = sql`
  SELECT y.*, s.tong, s.xong, s.cap_nhat, s.buoc_json
  FROM tien_do_hang_muc y
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS tong, count(*) FILTER (WHERE b.trang_thai = 'Xong')::int AS xong,
           to_char(max(b.ngay_xong), 'YYYY-MM-DD') AS cap_nhat,
           COALESCE(json_agg(json_build_object('id', b.id, 'hang_muc_id', b.hang_muc_id, 'thu_tu', b.thu_tu, 'buoc', b.buoc, 'trang_thai', b.trang_thai,
             'ngay_xong', to_char(b.ngay_xong, 'YYYY-MM-DD'), 'ket_qua', b.ket_qua, 'ghi_chu', b.ghi_chu, 'updated_at', b.updated_at) ORDER BY b.thu_tu) FILTER (WHERE b.id IS NOT NULL), '[]'::json) AS buoc_json
    FROM tien_do_buoc b WHERE b.hang_muc_id = y.id
  ) s ON true`;

// Bước ĐẦY ĐỦ đi kèm từng hạng mục ngay trong danh sách (một query, ~1 KB/hạng mục): bấm ▸ là bảng bước hiện tức thì,
// không thêm vòng gọi server — trước đây mỗi ▸ là một server action qua Cloudflare, trên mạng chậm mất 3-12s (anh chửi 20/09/2026).
function mapRow(r: Record<string, unknown>): HangMuc {
  const buoc = (r.buoc_json as Buoc[]) ?? [];
  const { buoc_json: _b, ...rest } = r;
  return { ...(rest as unknown as HangMuc), buoc, tong: Number(r.tong ?? 0), xong: Number(r.xong ?? 0), cap_nhat: (r.cap_nhat as string | null) ?? null, buoc_hien_tai: buocHienTai(buoc) };
}

export async function listHangMuc(f: { project_id?: string; nhom?: string } = {}): Promise<HangMuc[]> {
  const w = [f.project_id ? sql`y.project_id = ${f.project_id}` : null, f.nhom ? sql`y.nhom = ${f.nhom}` : null].filter((x): x is NonNullable<typeof x> => !!x);
  const r = await db().execute(sql`${SUMMARY} ${w.length ? sql`WHERE ${sql.join(w, sql` AND `)}` : sql``} ORDER BY y.project_id, y.nhom, y.ma`);
  return rows<Record<string, unknown>>(r).map(mapRow);
}

export async function getHangMuc(id: number): Promise<HangMucChiTiet | null> {
  const r = rows<Record<string, unknown>>(await db().execute(sql`${SUMMARY} WHERE y.id = ${id}`));
  const first = r[0];
  if (!first) return null;
  const nhat_ky = rows<{ ts: string; noi_dung: string; buoc_id: number | null }>(await db().execute(sql`SELECT ts, noi_dung, buoc_id FROM tien_do_nhat_ky WHERE hang_muc_id = ${id} ORDER BY ts DESC LIMIT 50`));
  return { ...mapRow(first), nhat_ky };
}

/** Mã kế tiếp trong nhóm: chữ đầu của nhóm (viết hoa) + 2 số — iOS → I01, ExamWeight → E01. */
export async function maKeTiep(nhom: string): Promise<string> {
  const prefix = (nhom.trim()[0] ?? 'X').toUpperCase();
  const r = rows<{ n: number }>(await db().execute(sql`SELECT COALESCE(max(NULLIF(regexp_replace(ma, '\D', '', 'g'), '')::int), 0)::int AS n FROM tien_do_hang_muc WHERE nhom = ${nhom}`));
  return `${prefix}${String((r[0]?.n ?? 0) + 1).padStart(2, '0')}`;
}

export interface HangMucInput { nhom: string; ten: string; uu_tien?: number; trang_thai?: string; lan?: string; goc?: string; mo_ta?: string; ghi_chu?: string; ai?: string; so?: Record<string, string>; cong?: string; link?: string; project_id?: string | null; ma?: string; nguon?: string | null }

export async function themHangMuc(i: HangMucInput, buoc: string[] = []): Promise<HangMucChiTiet> {
  const ma = i.ma?.trim() || (await maKeTiep(i.nhom));
  const r = rows<{ id: number }>(await db().execute(sql`
    INSERT INTO tien_do_hang_muc (nhom, ma, ten, uu_tien, trang_thai, lan, goc, mo_ta, ghi_chu, ai, so, cong, link, project_id, nguon)
    VALUES (${i.nhom}, ${ma}, ${i.ten}, ${i.uu_tien ?? 2}, ${i.trang_thai ?? 'Ý tưởng'}, ${i.lan ?? ''}, ${i.goc ?? ''}, ${i.mo_ta ?? ''}, ${i.ghi_chu ?? ''},
            ${i.ai ?? ''}, ${JSON.stringify(i.so ?? {})}::jsonb, ${i.cong ?? ''}, ${i.link ?? ''}, ${i.project_id ?? null}, ${i.nguon ?? null})
    RETURNING id`));
  const id = r[0]?.id;
  if (!id) throw new Error('insert tien_do_hang_muc');
  if (buoc.length) await datBuoc(id, buoc, 'append');
  await ghiNhatKy(id, null, `tạo hạng mục ${ma} · ${i.ten}`);
  return (await getHangMuc(id))!;
}

export async function suaHangMuc(id: number, patch: Partial<HangMucInput>): Promise<HangMucChiTiet | null> {
  const cols: Record<string, unknown> = {};
  for (const k of ['nhom', 'ma', 'ten', 'uu_tien', 'trang_thai', 'lan', 'goc', 'mo_ta', 'ghi_chu', 'ai', 'cong', 'link', 'project_id'] as const) if (patch[k] !== undefined) cols[k] = patch[k];
  if (!Object.keys(cols).length && patch.so === undefined) return getHangMuc(id);
  const sets = Object.entries(cols).map(([k, v]) => sql`${sql.identifier(k)} = ${v as string | number | null}`);
  if (patch.so !== undefined) sets.push(sql`so = ${JSON.stringify(patch.so)}::jsonb`);
  await db().execute(sql`UPDATE tien_do_hang_muc SET ${sql.join(sets, sql`, `)}, updated_at = now() WHERE id = ${id}`);
  if (patch.trang_thai) await ghiNhatKy(id, null, `hạng mục → ${patch.trang_thai}`);
  return getHangMuc(id);
}

/** append: thêm vào cuối; replace: viết lại toàn bộ, bước cùng chữ giữ trạng thái/ngày/kết quả/ghi chú. */
export async function datBuoc(id: number, buoc: string[], mode: 'append' | 'replace'): Promise<Buoc[]> {
  const d = db();
  const cu = rows<Buoc>(await d.execute(sql`SELECT * FROM tien_do_buoc WHERE hang_muc_id = ${id} ORDER BY thu_tu`));
  if (mode === 'append') {
    let n = cu.reduce((m, b) => Math.max(m, b.thu_tu), 0);
    for (const b of buoc) { n++; await d.execute(sql`INSERT INTO tien_do_buoc (hang_muc_id, thu_tu, buoc) VALUES (${id}, ${n}, ${b})`); }
    await ghiNhatKy(id, null, `thêm ${buoc.length} bước (#${n - buoc.length + 1}..#${n})`);
  } else {
    const keep = new Map(cu.map((b) => [b.buoc, b]));
    await d.execute(sql`DELETE FROM tien_do_buoc WHERE hang_muc_id = ${id}`);
    for (const [i, text] of buoc.entries()) {
      const k = keep.get(text);
      await d.execute(sql`INSERT INTO tien_do_buoc (hang_muc_id, thu_tu, buoc, trang_thai, ngay_xong, ket_qua, ghi_chu)
        VALUES (${id}, ${i + 1}, ${text}, ${k?.trang_thai ?? 'Chưa'}, ${k?.ngay_xong ?? null}, ${k?.ket_qua ?? ''}, ${k?.ghi_chu ?? ''})`);
    }
    await ghiNhatKy(id, null, `viết lại bước: ${cu.length} → ${buoc.length}`);
  }
  return rows<Buoc>(await d.execute(sql`SELECT id, hang_muc_id, thu_tu, buoc, trang_thai, to_char(ngay_xong, 'YYYY-MM-DD') AS ngay_xong, ket_qua, ghi_chu, updated_at FROM tien_do_buoc WHERE hang_muc_id = ${id} ORDER BY thu_tu`));
}

export async function suaBuoc(buocId: number, p: BuocPatch): Promise<{ buoc: Buoc; hang_muc: HangMucChiTiet } | null> {
  const d = db();
  const cu = rows<Buoc>(await d.execute(sql`SELECT * FROM tien_do_buoc WHERE id = ${buocId}`))[0];
  if (!cu) return null;
  if (p.trang_thai && !(BUOC_TRANG_THAI as readonly string[]).includes(p.trang_thai)) throw new Error('trạng thái bước: ' + BUOC_TRANG_THAI.join(' | '));
  const tt = p.trang_thai ?? cu.trang_thai;
  // Xong → điền ngày (giữ ngày cũ nếu đã Xong); Chưa → xoá ngày; còn lại giữ nguyên
  const ngay = tt === 'Xong' ? sql`COALESCE(CASE WHEN ${cu.trang_thai} = 'Xong' THEN ngay_xong END, CURRENT_DATE)` : tt === 'Chưa' ? sql`NULL` : sql`ngay_xong`;
  await d.execute(sql`UPDATE tien_do_buoc SET trang_thai = ${tt}, ngay_xong = ${ngay}, ket_qua = ${p.ket_qua ?? cu.ket_qua}, ghi_chu = ${p.ghi_chu ?? cu.ghi_chu}, buoc = ${p.buoc ?? cu.buoc}, updated_at = now() WHERE id = ${buocId}`);
  const parts = [p.trang_thai && p.trang_thai !== cu.trang_thai ? `#${cu.thu_tu} → ${tt}` : null, p.ket_qua !== undefined && p.ket_qua !== cu.ket_qua ? 'kết quả' : null, p.ghi_chu !== undefined && p.ghi_chu !== cu.ghi_chu ? 'ghi chú' : null].filter(Boolean);
  if (parts.length) await ghiNhatKy(cu.hang_muc_id, buocId, parts.join(' · '));
  const yt = (await getHangMuc(cu.hang_muc_id))!;
  return { buoc: yt.buoc.find((b) => b.id === buocId)!, hang_muc: yt };
}

// Trạng thái hạng mục là ĐẶT TAY (anh chốt 20/09/2026 — bản đầu tự nhảy theo bước làm ExamWeight/Bra thành "Đang làm" hết,
// đè lên trạng thái anh đặt trên sheet). Bước Kẹt vẫn lộ qua "bước hiện tại" (⛔) và `tiendo ket` / /now.

export async function ghiNhatKy(id: number, buocId: number | null, noiDung: string): Promise<void> {
  await db().execute(sql`INSERT INTO tien_do_nhat_ky (hang_muc_id, buoc_id, noi_dung) VALUES (${id}, ${buocId}, ${noiDung})`);
}

/** Bước đang Kẹt toàn portfolio — cho /now (blocker) và trang. */
export async function listBuocKet(): Promise<Array<{ project_id: string | null; nhom: string; ma: string; ten: string; thu_tu: number; buoc: string; ghi_chu: string; updated_at: string }>> {
  return rows(await db().execute(sql`
    SELECT y.project_id, y.nhom, y.ma, y.ten, b.thu_tu, b.buoc, b.ghi_chu, b.updated_at
    FROM tien_do_buoc b JOIN tien_do_hang_muc y ON y.id = b.hang_muc_id
    WHERE b.trang_thai = 'Kẹt' AND y.trang_thai NOT IN ('Bỏ', 'Tạm dừng') ORDER BY b.updated_at`));
}
