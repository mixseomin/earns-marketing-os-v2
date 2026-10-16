// MÁY TỰ CHẤM CLIP (16/10/2026 — anh: "làm sao để hệ thống chấm điểm hoạt động độc lập và tự động"). 0đ, CPU box3, ~6 giây/clip.
// Đo: scripts/do-cam-xuc.py (venv /opt/xv-camxuc) · Xét: qc-cam-xuc.ts › chamMay · Ghi: xv_canh.soat.may cho ĐÚNG clip đang dùng.
// Chạy tự động khi clip sinh xong (sinh-video.ts › kiemVideoTap, cạnh máy soi clip) + scripts/cham-may.mts để chấm lại cả tập.
// Người soát (soat.clip) luôn thắng máy (qc-cam-xuc.ts › soatClip); máy "cần mắt" = chưa đạt cho tới khi người nhìn.
import 'server-only';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { mapCanh, mapNhanVat, mapBienThe, type Db, type Row } from './doc-db';
import { chamMay, type DoClip, type KqMay } from './qc-cam-xuc';

const PY = '/opt/xv-camxuc/bin/python';
const KICH_BAN = () => [path.join(process.cwd(), 'scripts/do-cam-xuc.py'), '/opt/earns-marketing-os-v2/apps/xuong-video/scripts/do-cam-xuc.py'].find((p) => existsSync(p));

type VaoDo = { nv: { ten: string; anh: string[] }[]; clips: { id: string; url: string; phat?: number | null; truoc_url?: string | null }[] };
function doCamXuc(vao: VaoDo): Promise<Record<string, DoClip>> {
  const kb = KICH_BAN();
  if (!kb || !existsSync(PY)) return Promise.reject(new Error('máy đo cảm xúc chưa cài (/opt/xv-camxuc + scripts/do-cam-xuc.py)'));
  return new Promise((ok, hong) => {
    const p = execFile(PY, [kb], { maxBuffer: 1 << 26, timeout: 15 * 60_000 }, (e, out, err) => {
      if (e) return hong(new Error(`do-cam-xuc: ${String(err || e.message).slice(-400)}`));
      try { ok(JSON.parse(String(out))); } catch { hong(new Error(`do-cam-xuc trả không phải JSON: ${String(out).slice(0, 200)}`)); }
    });
    p.stdin?.end(JSON.stringify(vao));
  });
}

/** Chấm máy các shot (mặc định cả tập). Trả số shot đã chấm + kết quả từng shot. */
export async function chamMayShots(db: Db, tapId: number, canhIds?: number[]): Promise<{ id: number; thu_tu: number; ket: KqMay['ket']; loi: string[] }[]> {
  const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  const nvPhim = ((await db.execute(sql`SELECT v.* FROM xv_nhan_vat v JOIN xv_tap t ON t.phim_id = v.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[]).map(mapNhanVat);
  const bt = ((await db.execute(sql`SELECT b.* FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id JOIN xv_tap t ON t.phim_id = v.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[]).map(mapBienThe);
  const clip = (c: (typeof ds)[number]) => c.video_cuoi_url || c.video_url;
  const chon = ds.filter((c) => clip(c) && (!canhIds || canhIds.includes(c.id)));
  if (!chon.length) return [];
  // Ảnh mẫu: anchor + biến thể có ảnh của mọi nhân vật trong các shot được chấm (SFace nhận ai là ai).
  const nvIds = new Set(chon.flatMap((c) => c.nhan_vat));
  const nv = nvPhim.filter((v) => v.loai === 'nhan_vat' && nvIds.has(v.id))
    .map((v) => ({ ten: v.ten, anh: [...v.anh_ref, ...bt.filter((b) => b.nhan_vat_id === v.id && b.anh_url).map((b) => b.anh_url!)].slice(0, 3) }))
    .filter((v) => v.anh.length);
  // Shot nối liền: so khung đầu với khung cuối clip shot liền trước CÙNG nhánh.
  const truoc = (c: (typeof ds)[number]) => { if (!c.noi_lien) return null; const t = ds.filter((x) => x.thu_tu < c.thu_tu && (x.nhanh || '') === (c.nhanh || '')).pop(); return t ? clip(t) : null; };
  const doRa = await doCamXuc({ nv, clips: chon.map((c) => ({ id: String(c.id), url: clip(c)!, phat: c.phat_s, truoc_url: truoc(c) })) });
  const luc = new Date().toISOString();
  const out: { id: number; thu_tu: number; ket: KqMay['ket']; loi: string[] }[] = [];
  for (const c of chon) {
    const d = doRa[String(c.id)]; if (!d) continue;
    const k = chamMay(d, c.bieu_cam, { phat: c.phat_s, noiLien: c.noi_lien });
    const may: KqMay = { url: clip(c)!, luc, ket: k.ket, loi: k.loi };
    // jsonb_set trên soat hiện có — không đè soát của người (clip / keyframe).
    await db.execute(sql`UPDATE xv_canh SET soat = jsonb_set(coalesce(soat, '{}'::jsonb), '{may}', ${JSON.stringify(may)}::jsonb) WHERE id = ${c.id}`);
    out.push({ id: c.id, thu_tu: c.thu_tu, ...k });
  }
  return out;
}

/** Một shot vừa có clip mới (gọi từ kiemVideoTap) — chỉ phim quảng cáo (Murch QC). */
export async function chamMayCanh(db: Db, canhId: number): Promise<void> {
  const r = (await db.execute(sql`SELECT c.tap_id, p.loai FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id JOIN xv_phim p ON p.id = t.phim_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!r[0] || r[0].loai !== 'quang_cao') return;
  await chamMayShots(db, Number(r[0].tap_id), [canhId]);
}
