// Đẩy việc ảnh vào hàng đợi Cloudflare (xv-jobs → Worker xv-worker) + ghi kết quả về sổ. File server thường, KHÔNG 'use server':
// hàm ở đây không được thành server action gọi từ trình duyệt (hoanTatAnh chỉ cho route callback có khoá bí mật).
//
// Vì sao Worker: việc sinh chạy ngoài tiến trình studio → deploy/khởi động lại studio không giết ảnh đang sinh dở, và số việc song song
// do Cloudflare gánh (max_concurrency trong worker/wrangler.toml) chứ không phải 4 khe của một tiến trình Node.
// Hàng đợi không nhận (thiếu khoá, Cloudflare lỗi) → chạy ngay trong tiến trình như cũ, nút bấm không bao giờ chết theo.
import { giaAnhCong } from './cong-ai';
import 'server-only';
import { sql } from 'drizzle-orm';
import { luuVaoKho } from './kho';
import { getDb } from '@mos2/db';
import { modelFal } from './fal';
import { jobDangCho } from './doc-db';
import { lamSanNho } from './anh-nho-may';
import { giaAnhCents, thuongHieu, type KinhThanh } from './kieu';
import { chayViecAnh, type ViecAnh, type KqViec } from './viec-anh';
import { chayViecAm, type ViecAm, type KqViecAm } from './viec-am';
import { baoHetTien } from './bao-het-tien';
import { catNen, ganCatNenVaoLop } from './cat-nen';

type Row = Record<string, unknown>;

/** Giá ảnh theo danh mục fal (động) nếu là model fal:, không thì bảng tĩnh. */
export async function giaAnhSv(model: string): Promise<number> {
  if (model.startsWith('fal:')) { const m = await modelFal(model.slice(4)); if (m?.giaCents != null) return m.giaCents; return 4; }
  const cong = giaAnhCong(model); if (cong != null) return cong;   // cổng đích danh (ckey: / shopaikey:) — giá VNĐ thật, không lấy giá niêm yết Google
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
    WHERE id = ${kq.job} AND trang_thai = 'cho' RETURNING canh_id, nhan_vat_id, request, model`)) as unknown as Row[];
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
      // Ghi kèm giọng đã đọc ("model|voice") vào dòng — bản xuất đếm số giọng của lời dẫn để chặn phim lẫn giọng.
      await db.execute(sql`UPDATE xv_canh SET thoai = CASE WHEN jsonb_array_length(thoai) > ${i} THEN jsonb_set(jsonb_set(thoai, ${`{${i},url}`}::text[], to_jsonb(${kq.url}::text)), ${`{${i},giong}`}::text[], to_jsonb(${String(rq.giong ?? '')}::text)) #- ${`{${i},gon}`}::text[] ELSE thoai END,
        thoai_url = CASE WHEN ${i} = 0 THEN ${kq.url} ELSE thoai_url END, chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${Number(j.canh_id)}`);
    } else await db.execute(sql`UPDATE xv_canh SET thoai_url = ${kq.url}, chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${Number(j.canh_id)}`);
  }
  if (dich === 'thoai' && j.canh_id != null) await khopSauGiong(Number(j.canh_id));
  if (dich === 'thoai' && j.canh_id != null && rq.sau_video) await videoSauGiong(Number(j.canh_id), rq.sau_video as { moHinh?: string; ban: 'nhap' | 'cuoi' });
  if (dich === 'sfx' && j.canh_id != null) await db.execute(sql`UPDATE xv_canh SET am_thanh_url = ${kq.url}, chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${Number(j.canh_id)}`);
  if (dich === 'nhac' && rq.tap_id != null) {
    if (rq.phan_doan) await db.execute(sql`UPDATE xv_tap SET nhac_phan_canh = nhac_phan_canh || jsonb_build_object(${String(rq.phan_doan)}::text, ${kq.url}::text), updated_at = now() WHERE id = ${Number(rq.tap_id)}`);
    else await db.execute(sql`UPDATE xv_tap SET nhac_url = ${kq.url}, updated_at = now() WHERE id = ${Number(rq.tap_id)}`);
    // Nhạc nền luôn dùng lại được → tự vào kho tài sản (creative sau chọn từ kho thay vì sinh lại).
    const p = (await db.execute(sql`SELECT p.id, p.project, p.kinh_thanh, p.ten, t.so FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${Number(rq.tap_id)}`)) as unknown as Array<Record<string, unknown>>;
    if (p[0]) await luuVaoKho(db, { loai: 'nhac', url: kq.url, ten: `Nhạc · ${String(p[0].ten)} · tập ${String(p[0].so)}${rq.phan_doan ? ` · ${String(rq.phan_doan)}` : ''}`, thuong_hieu: thuongHieu(String(p[0].project ?? ''), p[0].kinh_thanh as KinhThanh),
      mo_ta: String(rq.prompt ?? ''), so_do: { model: String(j.model ?? '') }, nguon: { phim_id: Number(p[0].id), tap_id: Number(rq.tap_id) } }).catch((e) => console.error('[kho] lưu nhạc hỏng', e));
  }
  if (dich === 'giong_mau' && j.nhan_vat_id != null) await db.execute(sql`UPDATE xv_nhan_vat SET giong_mau_url = ${kq.url}, updated_at = now() WHERE id = ${Number(j.nhan_vat_id)}`);
  // GIỌNG ĐÃ THỬ (anh 17/10/2026 "lưu cả các giọng lại, lát chọn lại trên studio"): nghe thử + lượt thử giọng (casting) vào danh sách của nhân vật,
  // cùng model + giọng thì thay bản cũ. chonGiong lấy lại url ở đây → chọn lại không phải sinh lại.
  if ((dich === 'giong_mau' || dich === 'thu_giong') && j.nhan_vat_id != null && rq.voice) {
    const m = String(rq.giong_model ?? String(j.model ?? '').replace(/^fal:/, ''));
    const dong = { model: m, voice: String(rq.voice), url: kq.url, cau: String(rq.text ?? ''), luc: new Date().toISOString() };
    await db.execute(sql`UPDATE xv_nhan_vat SET giong_thu = coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(giong_thu) x WHERE NOT (x->>'model' = ${m} AND x->>'voice' = ${dong.voice})), '[]'::jsonb) || jsonb_build_array(${JSON.stringify(dong)}::jsonb), updated_at = now() WHERE id = ${Number(j.nhan_vat_id)}`);
  }
  return true;
}
export const thuHangDoi = (job = 0) => guiHangDoi({ job, model: '', prompt: '', thamChieuUrl: [], tiLe: '1:1', thuMuc: 'thu', thu: true });

/** Giọng vừa về → độ dài shot khớp theo giọng ngay (hau-ky.ts › khopGiongTap: cắt lặng, giây phát vừa khít câu), khi tập không còn lượt giọng
 *  nào đang chạy. Trước đây là nút ⏱ bấm tay, không ai bấm → lời dẫn 3s nằm trong shot 2,5s tràn sang đè câu của Felix (13/10/2026). */
async function khopSauGiong(canhId: number): Promise<void> {
  const db = getDb();
  if (!db) return;
  const t = (await db.execute(sql`SELECT tap_id FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[];
  if (!t[0]) return;
  const tapId = Number(t[0].tap_id);
  const con = (await db.execute(sql`SELECT 1 FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE c.tap_id = ${tapId} AND j.loai = 'am' AND j.request->>'dich' = 'thoai'
    AND ${jobDangCho('j')} LIMIT 1`)) as unknown as Row[];
  if (con.length) return;
  const { khopGiongTap } = await import('./hau-ky');
  const r = await khopGiongTap(db, tapId, 'tự khớp sau khi sinh giọng').catch((e: unknown) => ({ ok: false as const, loi: String(e) }));
  if (!r.ok) console.error('[khớp giọng tự động]', tapId, r.loi);
}

/** Giọng của shot vừa đủ (không còn dòng thiếu, không còn lượt giọng đang chạy) → gửi video mà người bấm "Sinh nháp" đã đặt.
 *  Nhận việc bằng cách gỡ cờ sau_video khỏi mọi job giọng của shot: hai dòng xong cùng lúc thì chỉ bên gỡ được mới gửi (không trả tiền đôi). */
async function videoSauGiong(canhId: number, sau: { moHinh?: string; ban: 'nhap' | 'cuoi' }): Promise<void> {
  const db = getDb();
  if (!db) return;
  const con = (await db.execute(sql`SELECT 1 FROM xv_job WHERE canh_id = ${canhId} AND loai = 'am' AND request->>'dich' = 'thoai' AND ${jobDangCho()} LIMIT 1`)) as unknown as Row[];
  if (con.length) return;
  const nhan = (await db.execute(sql`UPDATE xv_job SET request = request - 'sau_video' WHERE canh_id = ${canhId} AND loai = 'am' AND request->'sau_video' IS NOT NULL RETURNING id`)) as unknown as Row[];
  if (!nhan.length) return;
  const { batDauVideoCanh } = await import('./sinh-video');
  const r = await batDauVideoCanh(db, canhId, sau.moHinh, sau.ban);
  if (!r.ok) await db.execute(sql`UPDATE xv_canh SET loi = ${`Giọng xong nhưng chưa gửi được video: ${r.loi}`}, updated_at = now() WHERE id = ${canhId}`);
}

/** Ghi kết quả một việc ảnh: sổ job + đích (ảnh gốc của anchor / ảnh biến thể / ứng viên keyframe của cảnh).
 *  Chỉ nhận job còn 'cho' → Worker gửi lặp hay hai nơi cùng báo thì lần sau bỏ qua, không cộng tiền hai lần. */
export async function hoanTatAnh(kq: KqViec): Promise<boolean> {
  const db = getDb();
  if (!db || !kq.job) return false;
  // Ảnh đi qua cổng (cong-ai.ts) → giá THẬT của cổng (VNĐ quy cent) + nhà cung cấp = cổng; còn lại theo bảng giá model như cũ.
  const n0 = kq.nguon;
  const gia = kq.ok ? (n0?.cents != null ? n0.cents : await giaAnhSv(kq.model)) : 0;
  const prov = n0?.cong && n0.cong !== 'google' ? n0.cong : null;
  const r = (await db.execute(sql`UPDATE xv_job SET trang_thai = ${kq.ok ? 'xong' : 'loi'},
      output_url = ${kq.ok ? kq.url : null}, model = coalesce(${kq.ok ? kq.model : null}, model),
      provider = CASE WHEN ${prov ?? ''} <> '' THEN ${prov ?? ''} WHEN ${kq.ok ? kq.model : ''} LIKE 'gpt-%' THEN 'openai' WHEN ${kq.ok ? kq.model : ''} LIKE 'fal:%' THEN 'fal' ELSE provider END,
      chi_phi_cents = ${Math.round(gia * 1000) / 1000}, loi = ${kq.ok ? '' : kq.loi}, nguon = ${n0 ? JSON.stringify(n0) : null}::jsonb, updated_at = now()
    WHERE id = ${kq.job} AND trang_thai = 'cho' RETURNING canh_id, nhan_vat_id, bien_the_id, phim_id, nhan, request->>'dich' AS dich, request->>'anh_qc_id' AS anh_qc_id, request->>'lan' AS lan, request->>'goc' AS goc, request->>'thu' AS thu, request->'hop' AS hop`)) as unknown as Row[];
  const j = r[0];
  if (!j) return false;
  // Một cổng trong chuỗi hỏng vì HẾT TIỀN → báo Telegram để nạp (studio đã tự sang cổng kế). Không chặn việc ghi sổ.
  if (n0?.thu.some((b) => b.het_tien)) void baoHetTien(db, n0.thu, `job #${kq.job} · ${String(j.nhan ?? '')}`).catch((e) => console.log('[bao-het-tien]', String(e)));
  const canh = j.canh_id == null ? null : Number(j.canh_id);
  if (!kq.ok) {
    if (canh != null) await db.execute(sql`UPDATE xv_canh SET loi = ${kq.loi}, updated_at = now() WHERE id = ${canh}`);
    return true;
  }
  // Ảnh nhỏ cho timeline / thẻ (anh-nho.ts) làm sẵn ngay — lần mở đầu không phải chờ thu nhỏ. Chạy nền, hỏng thì lúc xem làm lại.
  void lamSanNho(kq.url);
  if (j.bien_the_id != null) {
    await db.execute(sql`UPDATE xv_bien_the SET anh_url = ${kq.url}, updated_at = now() WHERE id = ${Number(j.bien_the_id)}`);
  } else if (canh != null && j.dich === 'sua_mat') {
    // 🩹 sửa mặt (soi-mat.ts › suaMatCanh): soi lại ảnh sửa → đạt thì thành keyframe, chưa thì thử lại từ ảnh gốc (tối đa 3 lần)
    const { xongSuaMat } = await import('./soi-mat');
    await xongSuaMat(db, canh, kq.url, gia, { lan: j.lan as string | null, goc: j.goc as string | null, thu: j.thu as string | null, job: kq.job, hop: (j.hop as number[] | null) ?? null });
  } else if (canh != null && j.dich === 'keyframe_ket') {
    // keyframe KẾT (sinh-anh.ts › sinhKeyframeKetCanh): khung cuối của shot — video nhận làm ảnh cuối
    await db.execute(sql`UPDATE xv_canh SET keyframe_ket = ${kq.url}, chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${canh}`);
  } else if (canh != null) {
    await db.execute(sql`UPDATE xv_canh SET keyframe_uv = (keyframe_uv || ${JSON.stringify([kq.url])}::jsonb),
      keyframe_url = coalesce(keyframe_url, ${kq.url}), trang_thai = CASE WHEN trang_thai = 'nhap' THEN 'co_keyframe' ELSE trang_thai END,
      chi_phi_cents = chi_phi_cents + ${gia}, loi = '', updated_at = now() WHERE id = ${canh}`);
  } else if (j.dich === 'poster' && j.phim_id != null) {
    // poster (sinh-anh.ts › sinhPosterPhim): bản mới lên ĐẦU dải; phim chưa có poster thì bản này thành poster đang dùng
    await db.execute(sql`UPDATE xv_phim SET poster_uv = (${JSON.stringify([kq.url])}::jsonb || poster_uv), poster_url = coalesce(poster_url, ${kq.url}), updated_at = now() WHERE id = ${Number(j.phim_id)}`);
  } else if (j.dich === 'anh_qc' && j.anh_qc_id != null) {
    // ảnh QC (sinh-anh.ts › sinhAnhQcDb): bản mới lên ĐẦU dải; ảnh chưa có bản đang dùng thì bản này thành bản đang dùng
    await db.execute(sql`UPDATE xv_anh_qc SET uv = (${JSON.stringify([kq.url])}::jsonb || uv), url = coalesce(url, ${kq.url}), updated_at = now() WHERE id = ${Number(j.anh_qc_id)}`);
  } else if (j.dich === 'cat_nen' && j.nhan_vat_id != null && j.phim_id != null) {
    // ảnh người nền xanh (sinh-anh.ts › sinhAnhCatNen) → tách nền → PNG vào lớp phủ ID_LOP_CAT_NEN của tập (cat-nen.ts). Không vào anh_ref
    // (nền xanh làm tham chiếu keyframe sẽ lẫn màu). Ảnh gốc giữ ở output_url của job để soát.
    const png = await catNen(kq.url, `cat-nen/${Number(j.nhan_vat_id)}`);
    if (png) { const n = await ganCatNenVaoLop(db, Number(j.phim_id), png); await db.execute(sql`UPDATE xv_job SET loi = ${n ? '' : 'tách nền xong nhưng tập không có lớp phủ cat-nen (template không mang lớp này)'} WHERE id = ${kq.job}`); }
    else await db.execute(sql`UPDATE xv_job SET loi = 'tách nền hỏng (ffmpeg) — ảnh nền xanh giữ ở output_url' WHERE id = ${kq.job}`);
  } else if (j.nhan_vat_id != null) {
    // ảnh gốc mới lên ĐẦU: thẻ anchor hiện ảnh đầu, nối vào cuối thì trông như bấm không ăn (08/10/2026)
    await db.execute(sql`UPDATE xv_nhan_vat SET anh_ref = (${JSON.stringify([kq.url])}::jsonb || anh_ref), updated_at = now() WHERE id = ${Number(j.nhan_vat_id)}`);
  }
  return true;
}
