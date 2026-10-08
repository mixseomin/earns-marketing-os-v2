// Đẩy việc ảnh vào hàng đợi Cloudflare (xv-jobs → Worker xv-worker) + ghi kết quả về sổ. File server thường, KHÔNG 'use server':
// hàm ở đây không được thành server action gọi từ trình duyệt (hoanTatAnh chỉ cho route callback có khoá bí mật).
//
// Vì sao Worker: việc sinh chạy ngoài tiến trình studio → deploy/khởi động lại studio không giết ảnh đang sinh dở, và số việc song song
// do Cloudflare gánh (max_concurrency trong worker/wrangler.toml) chứ không phải 4 khe của một tiến trình Node.
// Hàng đợi không nhận (thiếu khoá, Cloudflare lỗi) → chạy ngay trong tiến trình như cũ, nút bấm không bao giờ chết theo.
import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { danhMucFal } from './fal';
import { giaAnhCents } from './kieu';
import { chayViecAnh, type ViecAnh, type KqViec } from './viec-anh';
import { chayViecAm, type ViecAm, type KqViecAm } from './viec-am';

type Row = Record<string, unknown>;

/** Giá ảnh theo danh mục fal (động) nếu là model fal:, không thì bảng tĩnh. */
export async function giaAnhSv(model: string): Promise<number> {
  if (model.startsWith('fal:')) { const m = (await danhMucFal()).find((x) => x.id === model.slice(4)); if (m?.giaCents != null) return m.giaCents; return 4; }
  return giaAnhCents(model);
}

// ── Hàng nền trong tiến trình (dự phòng) ─────────────────────────────────────────────────────────────────────────
const TOI_DA_NEN = 4;
const hangNen: { dang: number; cho: Array<() => Promise<void>> } = { dang: 0, cho: [] };
export function chayNen(viec: () => Promise<void>): void {
  hangNen.cho.push(viec);
  bomNen();
}
function bomNen(): void {
  while (hangNen.dang < TOI_DA_NEN && hangNen.cho.length) {
    const f = hangNen.cho.shift()!;
    hangNen.dang++;
    f().catch((e) => console.error('[xuong-video nền]', e)).finally(() => { hangNen.dang--; bomNen(); });
  }
}

// ── Hàng đợi Cloudflare ──────────────────────────────────────────────────────────────────────────────────────────
// Tài khoản Cloudflare của Astrolas (gói Workers Paid — gói Free chỉ cho 10ms CPU/lần, không đủ cho ảnh), hàng đợi xv-jobs.
export const CF_ACCOUNT_XV = process.env.XV_CF_ACCOUNT || 'f1fefdd1431b68732ec5eab5cd5d7e23';
const QUEUE_ID = process.env.XV_QUEUE_ID || 'ba020585788a4b5297905b925e4af820';
async function guiHangDoi(v: ViecAnh | ViecAm): Promise<boolean> {
  const email = process.env.CF_EMAIL, key = process.env.CF_API_KEY;
  if (!email || !key || !process.env.XV_WORKER_SECRET || process.env.XV_HANG_DOI === 'tat') return false;
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_XV}/queues/${QUEUE_ID}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-Auth-Email': email, 'X-Auth-Key': key },
      body: JSON.stringify({ body: v, content_type: 'json' }), signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return true;
    console.error('[xuong-video hàng đợi]', r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error('[xuong-video hàng đợi]', e); }
  return false;
}

/** Đưa một việc ảnh đi chạy: hàng đợi Cloudflare trước, không được thì hàng nền cục bộ. Trả nơi chạy để ghi vào sổ. */
export async function dayViecAnh(v: ViecAnh): Promise<'cf' | 'noi_bo'> {
  if (await guiHangDoi(v)) return 'cf';
  chayNen(async () => { await hoanTatAnh(await chayViecAnh(v)); });
  return 'noi_bo';
}
/** Việc âm (giọng / hiệu ứng / nhạc): cùng hàng đợi Cloudflare, dự phòng hàng nền. */
export async function dayViecAm(v: ViecAm): Promise<'cf' | 'noi_bo'> {
  if (await guiHangDoi(v)) return 'cf';
  chayNen(async () => { await hoanTatAm(await chayViecAm(v)); });
  return 'noi_bo';
}
/** Route callback gọi hàm này: job âm hay job ảnh do sổ job nói (loai). */
export async function hoanTatViec(kq: KqViec | KqViecAm): Promise<boolean> {
  const db = getDb();
  if (!db || !kq.job) return false;
  const r = (await db.execute(sql`SELECT loai FROM xv_job WHERE id = ${kq.job}`)) as unknown as Row[];
  return String(r[0]?.loai) === 'am' ? hoanTatAm(kq as KqViecAm) : hoanTatAnh(kq as KqViec);
}
/** Ghi kết quả việc âm: sổ job (tiền đã tính lúc đẩy, nằm ở request.gia) + gắn file vào đích (request.dich). */
export async function hoanTatAm(kq: KqViecAm): Promise<boolean> {
  const db = getDb();
  if (!db || !kq.job) return false;
  const r = (await db.execute(sql`UPDATE xv_job SET trang_thai = ${kq.ok ? 'xong' : 'loi'}, output_url = ${kq.ok ? kq.url : null},
      chi_phi_cents = CASE WHEN ${kq.ok} THEN coalesce((request->>'gia')::numeric, 0) ELSE 0 END, loi = ${kq.ok ? '' : kq.loi}, updated_at = now()
    WHERE id = ${kq.job} AND trang_thai = 'cho' RETURNING canh_id, nhan_vat_id, request`)) as unknown as Row[];
  const j = r[0];
  if (!j) return false;
  const rq = (j.request ?? {}) as Record<string, unknown>;
  const dich = String(rq.dich ?? '');
  if (!kq.ok) {
    if (j.canh_id != null) await db.execute(sql`UPDATE xv_canh SET loi = ${`${dich === 'thoai' ? 'Giọng' : 'Âm thanh'}: ${kq.loi}`}, updated_at = now() WHERE id = ${Number(j.canh_id)}`);
    return true;
  }
  const gia = Number(rq.gia ?? 0);
  if (dich === 'thoai' && j.canh_id != null) {
    if (rq.dong != null) {
      const i = Number(rq.dong);
      await db.execute(sql`UPDATE xv_canh SET thoai = CASE WHEN jsonb_array_length(thoai) > ${i} THEN jsonb_set(thoai, ${`{${i},url}`}::text[], to_jsonb(${kq.url}::text)) ELSE thoai END,
        thoai_url = CASE WHEN ${i} = 0 THEN ${kq.url} ELSE thoai_url END, chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${Number(j.canh_id)}`);
    } else await db.execute(sql`UPDATE xv_canh SET thoai_url = ${kq.url}, chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${Number(j.canh_id)}`);
  }
  if (dich === 'sfx' && j.canh_id != null) await db.execute(sql`UPDATE xv_canh SET am_thanh_url = ${kq.url}, chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${Number(j.canh_id)}`);
  if (dich === 'nhac' && rq.tap_id != null) {
    if (rq.phan_doan) await db.execute(sql`UPDATE xv_tap SET nhac_phan_canh = nhac_phan_canh || jsonb_build_object(${String(rq.phan_doan)}::text, ${kq.url}::text), updated_at = now() WHERE id = ${Number(rq.tap_id)}`);
    else await db.execute(sql`UPDATE xv_tap SET nhac_url = ${kq.url}, updated_at = now() WHERE id = ${Number(rq.tap_id)}`);
  }
  if (dich === 'giong_mau' && j.nhan_vat_id != null) await db.execute(sql`UPDATE xv_nhan_vat SET giong_mau_url = ${kq.url}, updated_at = now() WHERE id = ${Number(j.nhan_vat_id)}`);
  return true;
}
export const thuHangDoi = (job = 0) => guiHangDoi({ job, model: '', prompt: '', thamChieuUrl: [], tiLe: '1:1', thuMuc: 'thu', thu: true });

/** Ghi kết quả một việc ảnh: sổ job + đích (ảnh gốc của anchor / ảnh biến thể / ứng viên keyframe của cảnh).
 *  Chỉ nhận job còn 'cho' → Worker gửi lặp hay hai nơi cùng báo thì lần sau bỏ qua, không cộng tiền hai lần. */
export async function hoanTatAnh(kq: KqViec): Promise<boolean> {
  const db = getDb();
  if (!db || !kq.job) return false;
  const gia = kq.ok ? await giaAnhSv(kq.model) : 0;
  const r = (await db.execute(sql`UPDATE xv_job SET trang_thai = ${kq.ok ? 'xong' : 'loi'},
      output_url = ${kq.ok ? kq.url : null}, model = coalesce(${kq.ok ? kq.model : null}, model),
      provider = CASE WHEN ${kq.ok ? kq.model : ''} LIKE 'gpt-%' THEN 'openai' WHEN ${kq.ok ? kq.model : ''} LIKE 'fal:%' THEN 'fal' ELSE provider END,
      chi_phi_cents = ${Math.round(gia * 1000) / 1000}, loi = ${kq.ok ? '' : kq.loi}, updated_at = now()
    WHERE id = ${kq.job} AND trang_thai = 'cho' RETURNING canh_id, nhan_vat_id, bien_the_id`)) as unknown as Row[];
  const j = r[0];
  if (!j) return false;
  const canh = j.canh_id == null ? null : Number(j.canh_id);
  if (!kq.ok) {
    if (canh != null) await db.execute(sql`UPDATE xv_canh SET loi = ${kq.loi}, updated_at = now() WHERE id = ${canh}`);
    return true;
  }
  if (j.bien_the_id != null) {
    await db.execute(sql`UPDATE xv_bien_the SET anh_url = ${kq.url}, updated_at = now() WHERE id = ${Number(j.bien_the_id)}`);
  } else if (canh != null) {
    await db.execute(sql`UPDATE xv_canh SET keyframe_uv = (keyframe_uv || ${JSON.stringify([kq.url])}::jsonb),
      keyframe_url = coalesce(keyframe_url, ${kq.url}), trang_thai = CASE WHEN trang_thai = 'nhap' THEN 'co_keyframe' ELSE trang_thai END,
      chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${canh}`);
  } else if (j.nhan_vat_id != null) {
    // ảnh gốc mới lên ĐẦU: thẻ anchor hiện ảnh đầu, nối vào cuối thì trông như bấm không ăn (08/10/2026)
    await db.execute(sql`UPDATE xv_nhan_vat SET anh_ref = (${JSON.stringify([kq.url])}::jsonb || anh_ref), updated_at = now() WHERE id = ${Number(j.nhan_vat_id)}`);
  }
  return true;
}
