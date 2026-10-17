// XUẤT CREATIVE TỪ PHIM GỐC — DÙNG LẠI CLIP (anh 17/10/2026; kho concept: concept.ts · actions-concept.ts). Mỗi BỘ HÌNH (cặp concept × template ×
// một biến thể diễn viên) sản xuất MỘT phim gốc (xv_bien_the_hinh.phim_id); creative cùng bộ hình xuất từ chính clip của phim gốc, chỉ thay
// chữ màn + lời theo phương án của nó: câu đổi thì đọc lại bằng ĐÚNG giọng của câu gốc (tệp khoá theo nội dung → có rồi thì dùng lại), câu giữ
// nguyên dùng file giọng cũ; dựng MP4 0đ (chayXuat — cùng đường với ⬇ Xuất và lồng tiếng long-tieng.ts). Không sinh hình, không gọi Claude.
import { lookPhim } from './look';
import 'server-only';
import { sql } from 'drizzle-orm';
import { uploadToR2 } from '@/lib/r2';
import { chayXuat } from './xuat-chay';
import { gonGiong } from './hau-ky';
import { chayViecAm } from './viec-am';
import { dauVaoGiongTheoModel } from './giong';
import { MODEL_GIONG_MAC_DINH, giongMacDinh } from './sinh-giong';
import { giongDong } from './ban-dich';
import { bam, coTep } from './long-tieng';
import { dienChu } from './template';
import { docKinhThanh, locNhanh, type KinhThanh } from './kieu';
import { boiCanhTap, mapCanh, xongJob, n, s, type Db, type Row } from './doc-db';

type Kq<T> = { ok: true; data: T } | { ok: false; loi: string };
/** Phim gốc + giá trị ô của creative: ô của phim gốc (lúc tạo) đè bằng phương án creative đã chọn. */
export async function nguCanhXuat(db: Db, creativeId: number): Promise<Kq<{ cr: Row; phimGoc: number; tplId: number; gt: Record<string, string>; gtGoc: Record<string, string> }>> {
  const cr = ((await db.execute(sql`SELECT cr.*, c.template_id, b.phim_id AS phim_goc FROM xv_creative cr JOIN xv_cap c ON c.id = cr.cap_id
    LEFT JOIN xv_bien_the_hinh b ON b.id = cr.bien_the_id WHERE cr.id = ${creativeId}`)) as unknown as Row[])[0];
  if (!cr) return { ok: false, loi: 'không thấy creative' };
  if (cr.phim_goc == null) return { ok: false, loi: 'bộ hình chưa có phim gốc — tạo phim gốc trước (nút Tạo phim gốc ở đầu bộ hình)' };
  const p = ((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${n(cr.phim_goc)}`)) as unknown as Row[])[0];
  const gtGoc = (((p?.kinh_thanh ?? {}) as KinhThanh).tu_template?.gia_tri ?? {}) as Record<string, string>;
  const gt = { ...gtGoc };
  const pa = (await db.execute(sql`SELECT o, so, chu FROM xv_phuong_an WHERE cap_id = ${n(cr.cap_id)}`)) as unknown as Row[];
  for (const [k, so] of Object.entries((cr.chon ?? {}) as Record<string, number>)) { const x = pa.find((y) => s(y.o) === k && n(y.so) === so); if (x) gt[k] = s(x.chu); }
  return { ok: true, data: { cr, phimGoc: n(cr.phim_goc), tplId: n(cr.template_id), gt, gtGoc } };
}

/** Shot của tập đầu (nhánh A) theo thứ tự. */
async function shotTap1(db: Db, phimId: number) {
  const t = ((await db.execute(sql`SELECT id FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so LIMIT 1`)) as unknown as Row[])[0];
  if (!t) return null;
  return { tapId: n(t.id), canh: locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${n(t.id)} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A') };
}

export async function xuatCreativeDb(db: Db, creativeId: number, job: number): Promise<Kq<{ url: string }>> {
  const nc = await nguCanhXuat(db, creativeId);
  if (!nc.ok) return nc;
  const goc = await shotTap1(db, nc.data.phimGoc), tpl = await shotTap1(db, nc.data.tplId);
  if (!goc || !tpl) return { ok: false, loi: 'phim gốc hoặc template chưa có tập' };
  // ghép shot phim gốc ↔ shot template theo thứ tự: phim gốc chép từ template nên cùng số shot; lệch = phim gốc đã đổi cấu trúc → không đoán
  if (goc.canh.length !== tpl.canh.length) return { ok: false, loi: `phim gốc có ${goc.canh.length} shot, template ${tpl.canh.length} — cấu trúc đã đổi, không ghép được chữ` };
  const thieuClip = goc.canh.filter((c) => !c.video_url && !c.video_cuoi_url).map((c) => `#${c.thu_tu}`);
  if (thieuClip.length) return { ok: false, loi: `phim gốc còn ${thieuClip.length} shot chưa có clip (${thieuClip.slice(0, 6).join(' ')}) — sinh clip phim gốc trước` };
  const bc = await boiCanhTap(db, goc.tapId);
  if (!bc) return { ok: false, loi: 'không thấy tập phim gốc' };
  const kt = docKinhThanh(bc.kt);
  const loiGiong: string[] = []; let kyTu = 0;
  const canh = [];
  for (const [i, c] of goc.canh.entries()) {
    const t = tpl.canh[i]!;
    // chữ của shot theo creative = chữ template điền giá trị ô creative; giống chữ phim gốc (điền ô gốc) thì giữ nguyên chữ đang có trong phim gốc (có thể đã sửa tay)
    const chuGoc = dienChu(t.chu_man ?? '', nc.data.gtGoc), chuMoi = dienChu(t.chu_man ?? '', nc.data.gt);
    const thoai = [];
    for (const [j, d] of (c.thoai ?? []).entries()) {
      const tj = (t.thoai ?? [])[j];
      const loiMoi = tj ? dienChu(tj.loi ?? '', nc.data.gt) : d.loi, loiGocT = tj ? dienChu(tj.loi ?? '', nc.data.gtGoc) : d.loi;
      if (!tj || loiMoi === loiGocT || !loiMoi.trim()) { thoai.push(d); continue; }
      // câu đổi → đọc lại bằng đúng giọng của câu gốc; khoá theo nội dung (dùng lại giữa các creative / lần xuất)
      const g = giongDong(d, bc.nhanVat, kt) ?? await (async () => { const m = MODEL_GIONG_MAC_DINH(); return { model: m, voice: await giongMacDinh(m) }; })();
      const loiDoc = d.dien_xuat && /eleven/.test(g.model) && /v3/.test(g.model) ? `[${d.dien_xuat}] ${loiMoi}` : loiMoi;
      const key = `xuong-video/am/creative/${bam(JSON.stringify([g.model, g.voice, loiDoc, c.cam_xuc]))}.mp3`;
      let url = await coTep(key);
      if (!url) {
        const kq = await chayViecAm({ kieu: 'am', job, model: g.model, input: await dauVaoGiongTheoModel(g.model, { text: loiDoc, voice: g.voice, ngonNgu: kt.ngon_ngu, camXuc: c.cam_xuc, theLoai: kt.the_loai ?? '' }), thuMuc: `creative/${creativeId}-${c.id}-${j}` });
        if (!kq.ok) { loiGiong.push(`#${c.thu_tu} dòng ${j + 1}: ${kq.loi}`); thoai.push({ ...d, loi: loiMoi, url: null }); continue; }
        kyTu += loiDoc.length;
        const gon = await gonGiong(kq.url, c.id) ?? kq.url;
        const r = await fetch(gon);
        url = r.ok ? await uploadToR2(key, Buffer.from(await r.arrayBuffer()), 'audio/mpeg') ?? gon : gon;
      }
      thoai.push({ ...d, loi: loiMoi, url });
    }
    canh.push({ ...c, chu_man: chuMoi === chuGoc ? c.chu_man : chuMoi, thoai });
  }
  const kq = await chayXuat({ loai: bc.loai, tiLe: kt.ti_le, nhipStopMotion: kt.nhip_stop_motion, look: lookPhim(kt), canh, nhanVat: bc.nhanVat, tap: bc.tap, qc: kt.qc, nhanh: null, choThieuNhac: true });
  if (!kq.ok) return kq;
  const canhBao = [...(loiGiong.length ? [`${loiGiong.length} câu không đọc được (im): ${loiGiong.join(' · ').slice(0, 300)}`] : []), ...kq.canhBao];
  await db.execute(sql`UPDATE xv_creative SET xuat = ${JSON.stringify({ url: kq.url, luc: new Date().toISOString(), job, giay: Math.round(kq.giay * 10) / 10, canh_bao: canhBao, phim_goc: nc.data.phimGoc })}::jsonb WHERE id = ${creativeId}`);
  await xongJob(db, job, { output_url: kq.url });
  if (kyTu) console.log(`[xuất creative] #${creativeId}: đọc mới ${kyTu} ký tự`);
  return { ok: true, data: { url: kq.url } };
}
