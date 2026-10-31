// PHÂN RÃ KỊCH BẢN — phần chạy (DB + AI). Lõi thuần + lý do: phan-ra-thuan.ts. MỘT đường cho: tự chạy sau ✂ Tách cảnh (tach-canh-tap.ts),
// nút 📋 Phân rã trên tab Phim, script trên box. TỐN TIỀN: 1 lượt chữ / tập qua chuỗi rẻ trước (ckey → …, claude.ts › sinhJson), ~200₫ / tập.
// Tăng dần: tập có mã băm chữ không đổi từ lần trước → bỏ qua (0đ) — 1000 tập mới chỉ chạy đúng tập mới / tập sửa.
import 'server-only';
import { sql } from 'drizzle-orm';
import { sinhJson } from './claude';
import { boiCanhTap, ghiTienChu, kemBienThe, mapCanh, mapNhanVat, type Db, type Row } from './doc-db';
import { chupTruoc } from './hoan-tac';
import { docKinhThanh, giaAnhCents, giaChuUoc, type NhanVat } from './kieu';
import { VND_MOI_USD } from './cong-ai';
import { PhanRaSchema, HE_PHAN_RA, PHIEN_PHAN_RA, MO_HINH_PHAN_RA, tranTokenPhanRa, taPhanRa, bamPhanRa, keHoach, lienKetShot, baoCaoChuanBi, type BaoCaoChuanBi, type PhanRaTapLuu } from './phan-ra-thuan';

type Kq<T> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });
const nvPhim = async (db: Db, phimId: number): Promise<NhanVat[]> =>
  kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY loai, id`)) as unknown as Row[]).map(mapNhanVat));

export type KqPhanRa = { boQua: boolean; moi: number; themTap: number; shotDoi: number; ghiChu: string[]; khongKhop: string[]; vnd?: number };

/** Phân rã MỘT tập: AI gắn thẻ mọi yếu tố → tạo món thiếu (look / đạo cụ / bối cảnh / cấu kiện / nhân vật) → gắn đúng shot → ghi xv_tap.phan_ra.
 *  ep = chạy lại dù mã băm không đổi. nguoi = ai bấm (sổ hoàn tác). */
export async function phanRaTapDb(db: Db, tapId: number, o: { ep?: boolean; nguoi?: string } = {}): Promise<Kq<KqPhanRa>> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const kt = docKinhThanh(bc.kt);
  const canh = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY coalesce(nhanh, ''), thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  if (!canh.length) return loi('tập chưa có shot — tách cảnh trước');
  const bam = bamPhanRa(bc.tap, canh);
  const cu = ((await db.execute(sql`SELECT phan_ra FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0]?.phan_ra as PhanRaTapLuu | null | undefined;
  if (!o.ep && cu && cu.phien === PHIEN_PHAN_RA && cu.bam === bam) return { ok: true, data: { boQua: true, moi: 0, themTap: 0, shotDoi: 0, ghiChu: cu.ghi_chu ?? [], khongKhop: cu.khong_khop ?? [] } };
  const phimId = bc.tap.phim_id;
  const tenPhim = String(((await db.execute(sql`SELECT ten FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[])[0]?.ten ?? '');
  const { user, ma } = taPhanRa({ tenPhim, loai: bc.loai, phongCach: kt.phong_cach, tap: bc.tap, tomTatTruoc: bc.tapTruoc, nhanVat: bc.nhanVat, canh });
  const kq = await sinhJson({ schema: PhanRaSchema, system: HE_PHAN_RA, user, model: MO_HINH_PHAN_RA, max_tokens: tranTokenPhanRa(canh.length), ten: 'phân rã kịch bản' });
  if (!kq.ok) return loi(`phân rã hỏng: ${kq.loi}`);
  await ghiTienChu(db, phimId, `Phân rã kịch bản · tập ${bc.tap.so}`, kq.model, kq.tokens);
  const nguoi = o.nguoi ?? 'phân rã kịch bản';

  // 1. TẠO MÓN THIẾU — nhân vật / bối cảnh / đạo cụ trước, cấu kiện (cần id bối cảnh) sau, rồi biến thể look (cần id nhân vật)
  const kh = keHoach(kq.data, bc.nhanVat, bc.tap.so);
  // keHoach đã quy tên cha / nhân vật về TÊN THẬT của món có sẵn (khớp gần đúng) → tra khoá chính xác là đủ
  const khoa = (loai: string, ten: string) => `${loai}|${ten.normalize('NFC').toLowerCase().trim()}`;
  const idTheoTen = new Map<string, number>(bc.nhanVat.map((v) => [khoa(v.loai, v.ten), v.id]));
  for (const a of [...kh.taoAnchor.filter((x) => x.loai !== 'cau_kien'), ...kh.taoAnchor.filter((x) => x.loai === 'cau_kien')]) {
    const cha = a.cha ? idTheoTen.get(khoa('boi_canh', a.cha)) ?? null : null;
    const r = (await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, thuoc_id) VALUES (${phimId}, ${a.loai}, ${a.ten}, ${a.mo_ta}, '[]'::jsonb, ${cha}) RETURNING id`)) as unknown as Row[];
    idTheoTen.set(khoa(a.loai, a.ten), Number(r[0]!.id));
  }
  for (const b of kh.taoBienThe) {
    const nvId = idTheoTen.get(khoa('nhan_vat', b.cua));
    if (nvId == null) { kh.khongKhop.push(`không tạo được "${b.cua} · ${b.ten}" — thiếu nhân vật`); continue; }
    await db.execute(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta, dung_tap) VALUES (${nvId}, ${b.nhom}, ${b.ten}, ${b.mo_ta}, ${JSON.stringify(b.dung_tap)}::jsonb)`);
  }
  for (const t of kh.themTap) {
    await chupTruoc(db, { bang: 'xv_bien_the', id: t.id, cot: ['dung_tap'], moTa: `phân rã tập ${bc.tap.so}: thêm tập dùng`, nguoi });
    await db.execute(sql`UPDATE xv_bien_the SET dung_tap = ${JSON.stringify(t.dung_tap)}::jsonb, updated_at = now() WHERE id = ${t.id}`);
  }

  // 2. GẮN SHOT theo thành phần vừa đủ (id mới) — chụp trước mỗi shot đổi (hoàn tác được), ghi phần phân rã của shot (kể cả gắn cũ)
  const lk = lienKetShot(kq.data, ma, canh, await nvPhim(db, phimId));
  const luc = new Date().toISOString();
  let shotDoi = 0;
  for (const x of lk) {
    const c = canh.find((y) => y.id === x.id)!;
    if (x.doi) { await chupTruoc(db, { bang: 'xv_canh', id: x.id, cot: ['nhan_vat', 'bien_the'], moTa: `phân rã tập ${bc.tap.so}: gắn thành phần shot #${c.thu_tu}`, nguoi, nhom: `phan-ra-${tapId}-${luc}` }); shotDoi++; }
    const pr = { luc, dung: x.dung, truoc: { nhan_vat: c.nhan_vat, bien_the: c.bien_the }, khong_khop: x.khong_khop };
    await db.execute(sql`UPDATE xv_canh SET nhan_vat = ${JSON.stringify(x.nhan_vat)}::jsonb, bien_the = ${JSON.stringify(x.bien_the)}::jsonb, phan_ra = ${JSON.stringify(pr)}::jsonb WHERE id = ${x.id}`);
  }
  const khongKhop = [...kh.khongKhop, ...lk.flatMap((x) => x.khong_khop.map((k) => `shot #${canh.find((y) => y.id === x.id)?.thu_tu}: không khớp "${k}"`))];
  const ghi: PhanRaTapLuu = { phien: PHIEN_PHAN_RA, luc, bam, model: kq.model, vnd: kq.tokens.vnd, moi: kh.taoAnchor.length + kh.taoBienThe.length, shot_doi: shotDoi, ghi_chu: kq.data.ghi_chu ?? [], khong_khop: khongKhop };
  await db.execute(sql`UPDATE xv_tap SET phan_ra = ${JSON.stringify(ghi)}::jsonb WHERE id = ${tapId}`);
  return { ok: true, data: { boQua: false, moi: ghi.moi!, themTap: kh.themTap.length, shotDoi, ghiChu: ghi.ghi_chu!, khongKhop, vnd: kq.tokens.vnd } };
}

/** Giá ước: cents (cổng xác nhận tiền của nút — ui.tsx › Nut gia) + VNĐ thật quy đổi (chữ hiện cho anh). */
export type Gia = { cents: number; vnd: number };
const gia = (cents: number): Gia => ({ cents: Math.round(cents * 1000) / 1000, vnd: Math.round((cents / 100) * VND_MOI_USD) });
/** Giá ƯỚC một lượt phân rã từ độ dài chữ đầu vào (theo đường sẽ đi — ckey trước): token vào ≈ ký tự / 3 + danh sách thành phần, ra ≈ 6k. */
export const uocPhanRa = (kyTu: number, soShot: number): Gia => gia(giaChuUoc(MO_HINH_PHAN_RA, Math.ceil(kyTu / 3) + 2500, tranTokenPhanRa(soShot)));

export type BaoCaoPhim = BaoCaoChuanBi & { model: string; /** giá ước phân rã mỗi tập có shot */ uoc: Record<number, Gia>; /** giá ước 1 ảnh mẫu theo model ảnh của phim (nút Sinh hết ảnh thiếu) */ gia_anh: Gia };
/** Báo cáo chuẩn bị cả phim (đọc DB, 0đ) + giá ước phân rã cho tập chưa / cũ. */
export async function baoCaoChuanBiDb(db: Db, phimId: number): Promise<BaoCaoPhim | null> {
  const p = ((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[])[0];
  if (!p) return null;
  const kt = docKinhThanh(p.kinh_thanh as never); const model = MO_HINH_PHAN_RA;
  const tap = ((await db.execute(sql`SELECT id, so, ten, kich_ban, phan_ra FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so`)) as unknown as Row[])
    .map((r) => ({ id: Number(r.id), so: Number(r.so), ten: String(r.ten ?? ''), kich_ban: String(r.kich_ban ?? ''), phan_ra: (r.phan_ra ?? null) as PhanRaTapLuu | null }));
  const canh = ((await db.execute(sql`SELECT c.* FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${phimId}`)) as unknown as Row[]).map((r) => ({ ...mapCanh(r), tap_id: Number(r.tap_id) }));
  const bc = baoCaoChuanBi({ tap, canh, nhanVat: await nvPhim(db, phimId) });
  const uoc: Record<number, Gia> = {};
  for (const t of bc.tap) if (t.trang_thai !== 'trong') uoc[t.id] = uocPhanRa(t.ky_tu, t.so_shot);   // cả tập đã xong (nút chạy lại cũng ghi giá)
  return { ...bc, model, uoc, gia_anh: gia(giaAnhCents(kt.mo_hinh_anh)) };
}
