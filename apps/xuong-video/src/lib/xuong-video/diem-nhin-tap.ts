// ĐIỂM NHÌN CẢ TẬP — phần máy chủ của diem-nhin.ts (eye trace qua cú cắt, anh 25/10/2026 "phải chuẩn hoá vào studio"). 0đ (ffmpeg + soi-mat.py).
// Gọi TỰ ĐỘNG ở mỗi lần xuất (xuat-tap.ts, trước chayXuat) và từ scripts/diem-nhin.mts. Mỗi shot: cắt khung MỞ / ĐÓNG của đúng đoạn clip bản dựng dùng
// (cùng phép tính điểm vào với xuat.ts), soi mặt → điểm chú ý = mặt người đang nói trong khung, không thì người đầu tiên quay mặt ra máy theo sơ đồ
// (ky_thuat.huong_so). Kết quả nhớ ở ky_thuat.diem_nhin theo khoá (clip · điểm vào · giây phát) — chỉ đo lại shot đổi. Rồi tính khung dựng lại cả cảnh
// (khungCanh) → ky_thuat.khung_lai (xuat.ts phóng + dịch). Shot khai ky_thuat.khung_lai_tat = giữ khung gốc (người dựng tắt trên thẻ shot / timeline).
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { sql } from 'drizzle-orm';
import { mapCanh, type Db, type Row } from './doc-db';
import { soiAnh } from './soi-mat';
import { giayPhat, type Canh } from './kieu';
import { DUOI_CLIP_BO } from './xuat';
import { khungCanh, type Diem, type KhungLai } from './diem-nhin';

const chay = promisify(execFile);
type HS = Record<string, { lung?: boolean }>;
export type DiemNhinShot = { khoa: string; dau: Diem | null; cuoi: Diem | null; ten_dau?: string; ten_cuoi?: string; lech_goc?: number | null; lech_sau?: number | null };

const khoaCua = (url: string, boDau: number, phat: number) => createHash('sha1').update(`${url}|${boDau.toFixed(2)}|${phat.toFixed(2)}`).digest('hex').slice(0, 16);

export async function doDiemNhinTap(db: Db, tapId: number, o: { ghi?: boolean; lamLai?: boolean } = {}): Promise<{ shot: { thu_tu: number; dn: DiemNhinShot | null; k: KhungLai }[] }> {
  const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  const thu = `/tmp/diem-nhin-${tapId}`; mkdirSync(thu, { recursive: true });
  const tai = async (url: string) => { const f = `${thu}/${createHash('sha1').update(url).digest('hex').slice(0, 12)}.mp4`; if (!existsSync(f)) await chay('curl', ['-sfL', '-o', f, url], { timeout: 120_000 }); return f; };
  const dai = async (f: string) => Number((await chay('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f])).stdout.trim());
  const cat = async (f: string, g: number, ra: string) => { await chay('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, g)), '-i', f, '-frames:v', '1', '-q:v', '3', ra], { timeout: 60_000 }); return ra; };

  const cu = new Map<number, DiemNhinShot>(); const moi = new Map<number, string>();   // id shot → điểm đã nhớ còn đúng / khoá mới cần đo
  const anh: { id: number; url: string; ten: string[] }[] = []; const ai = new Map<number, string[]>(); const vao = new Map<string, number>(); let n = 1;
  for (const c of ds) {
    const url = c.video_cuoi_url || c.video_url; if (!url || c.ky_thuat?.co_canh === 'insert') continue;   // cận đồ vật: không có mặt để đo
    const f = await tai(url); const d = await dai(f); const phat = giayPhat(c);
    const v = c.ky_thuat?.vao_s; const boDau = v != null && v >= 0 ? Math.max(0, Math.min(v, d - phat - DUOI_CLIP_BO)) : Math.max(0, Math.min(0.5, d - phat - DUOI_CLIP_BO));
    const khoa = khoaCua(url, boDau, phat); const nho = (c.ky_thuat as { diem_nhin?: DiemNhinShot } | undefined)?.diem_nhin;
    if (!o.lamLai && nho?.khoa === khoa) { cu.set(c.id, nho); continue; }
    moi.set(c.id, khoa);
    const noi = (c.thoai ?? []).filter((t) => t.loi?.trim() && t.nhan_vat?.trim()).map((t) => t.nhan_vat.trim());
    for (const [luc, g, hs] of [['dau', boDau + 0.06, c.ky_thuat?.huong_so], ['cuoi', boDau + phat - 0.1, (c.ky_thuat as { huong_so_ket?: HS } | undefined)?.huong_so_ket ?? c.ky_thuat?.huong_so]] as const) {
      const thay = Object.entries((hs ?? {}) as HS).filter(([, x]) => !x.lung).map(([t]) => t); if (!thay.length) continue;
      vao.set(`${c.id}:${luc}`, n); ai.set(n, [...noi.filter((t) => thay.includes(t)), ...thay.filter((t) => !noi.includes(t))]);
      anh.push({ id: n++, url: await cat(f, g, `${thu}/${c.thu_tu}-${luc}.jpg`), ten: thay });
    }
  }
  const soi = anh.length ? await soiAnh(db, tapId, anh) : new Map();
  const diem = (cid: number, luc: 'dau' | 'cuoi'): { p: Diem; ten: string } | null => {
    const k = vao.get(`${cid}:${luc}`); if (k == null) return null; const kq = soi.get(k)?.ket ?? [];
    // mặt NHẬN CHẮC (tin: giống ảnh mẫu, không sát nút với người khác) trước; mặt gán không chắc chỉ dùng khi khung chỉ có MỘT mặt (không thể là người khác)
    const tim = (t: string) => kq.find((x: { ten: string; o?: Diem; tin?: boolean }) => x.ten === t && x.o && (x.tin || (soi.get(k)?.mat ?? 0) === 1)) as { o?: Diem } | undefined;
    for (const t of ai.get(k) ?? []) { const m = tim(t); if (m?.o) return { p: { x: m.o.x, y: m.o.y }, ten: t }; }
    return null;
  };
  const dn = new Map<number, DiemNhinShot>(cu);
  for (const [cid, khoa] of moi) { const a = diem(cid, 'dau'), b = diem(cid, 'cuoi'); dn.set(cid, { khoa, dau: a?.p ?? null, cuoi: b?.p ?? null, ten_dau: a?.ten, ten_cuoi: b?.ten }); }
  const tat = (c: Canh) => !!(c.ky_thuat as { khung_lai_tat?: boolean } | undefined)?.khung_lai_tat;
  const kq = khungCanh(ds.map((c) => ({ thu_tu: c.thu_tu, dau: dn.get(c.id)?.dau ?? null, cuoi: dn.get(c.id)?.cuoi ?? null, tat: tat(c) })));
  const out = ds.map((c, i) => { const d = dn.get(c.id); return { thu_tu: c.thu_tu, dn: d ? { ...d, lech_goc: kq[i]!.lech_goc, lech_sau: kq[i]!.lech_truoc } : null, k: kq[i]!.k }; });
  if (o.ghi) for (const [i, c] of ds.entries()) {
    const { dn: d, k } = out[i]!; const kl = k.s > 1 ? JSON.stringify(k) : null;
    await db.execute(sql`UPDATE xv_canh SET ky_thuat = (coalesce(ky_thuat, '{}'::jsonb) - 'khung_lai' - 'diem_nhin')
      || CASE WHEN ${kl}::text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('khung_lai', ${kl}::jsonb) END
      || CASE WHEN ${d ? JSON.stringify(d) : null}::text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('diem_nhin', ${d ? JSON.stringify(d) : null}::jsonb) END WHERE id = ${c.id}`);
  }
  return { shot: out };
}
