// Lõi 🔍 Kiểm khung trên máy chủ — MỘT chỗ cho nút trên lưới (actions.ts › kiemKhungTapAction) và script (scripts/kiem-khung.mts).
// Mỗi khối cảnh có keyframe chưa kiểm → MỘT lượt Claude nhìn cả khối (ảnh nhỏ 640px) + thẻ shot → ghi xv_canh.kiem_khung cho từng shot
// (gắn url keyframe đã kiểm). Luật thuần + cổng ở khung.ts. TỐN TIỀN: ~1 lượt Claude / khối cảnh.
import 'server-only';
import { sql } from 'drizzle-orm';
import { kiemKhungCanh } from './claude';
import { khoiCanKiem, giaKiemKhung } from './khung';
import { damBaoNho } from './anh-nho-may';
import { docKinhThanh, locNhanh, type Canh, type KiemKhung } from './kieu';
import { boiCanhTap, mapCanh, ghiTienChu, type Db, type Row } from './doc-db';
import { kyThuat } from './dien-anh';
import { soiMatTap } from './soi-mat';


export async function kiemKhungTap(db: Db, tapId: number, o: { tatCa?: boolean; uoc?: boolean } = {}): Promise<{ ok: true; data: { khoi: number; shot: number; lech: { thu_tu: number; loi: KiemKhung['loi'] }[]; cents: number } } | { ok: false; loi: string }> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return { ok: false, loi: 'không thấy tập' };
  // 🙂 Soi mặt trước (0đ, máy chủ): mặt lệch ảnh mẫu thì cổng chặn ngay, khỏi tốn lượt Claude nhìn lại. Lỗi soi không chặn kiểm khung.
  if (!o.uoc) { const sm = await soiMatTap(db, tapId).catch((e: unknown) => ({ ok: false as const, loi: String(e) })); if (!sm.ok) console.error('[soi mặt]', sm.loi); }
  const kt = docKinhThanh(bc.kt);
  const ds = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  const khoi = khoiCanKiem(ds, o.tatCa);
  if (o.uoc) return { ok: true, data: { khoi: khoi.length, shot: khoi.reduce((a, k) => a + k.length, 0), lech: [], cents: giaKiemKhung(kt.mo_hinh_chu, khoi.map((k) => k.length)) } };
  const ten = (id: number) => bc.nhanVat.find((v) => v.id === id);
  let cents = 0; const lech: { thu_tu: number; loi: KiemKhung['loi'] }[] = [];
  for (const k of khoi) {
    const pc = bc.tap.phan_canh.find((p) => p.ten === k[0]!.phan_doan);
    const anh = async (c: Canh) => { const r = await fetch((await damBaoNho(c.keyframe_url!, 640)) ?? c.keyframe_url!); if (!r.ok) throw new Error(`không tải được keyframe shot #${c.thu_tu} (${r.status})`); return Buffer.from(await r.arrayBuffer()).toString('base64'); };
    // Shot liền trước khối (cuối cảnh trước) — để soi cú chuyển cảnh qua ranh giới, chỗ hay hỏng nhất.
    const i0 = ds.indexOf(k[0]!); const tr = i0 > 0 ? ds[i0 - 1]! : null;
    const truoc = tr?.keyframe_url ? { so: tr.thu_tu, b64: await anh(tr), the: theShot(tr, ten, null) } : null;
    const shot = [];
    // Khung xám gốc là PNG — chỉ gửi bản nhỏ JPEG (damBaoNho) cho đúng media_type; không làm được bản nhỏ thì bỏ ảnh xám, không gửi sai loại.
    const xam = async (c: Canh) => { const u = c.khung_xam?.xam ? await damBaoNho(c.khung_xam.xam, 640) : null; if (!u) return null; const r = await fetch(u); return r.ok ? Buffer.from(await r.arrayBuffer()).toString('base64') : null; };
    for (const c of k) { const j = ds.indexOf(c); shot.push({ so: c.thu_tu, b64: await anh(c), xam: await xam(c), the: theShot(c, ten, j > 0 ? ds[j - 1]! : null) }); }
    const canh = [k[0]!.phan_doan, pc?.noi && `nơi: ${pc.noi}`, pc?.luc && `lúc: ${pc.luc}`, pc?.anh_sang && `ánh sáng: ${kyThuat(pc.anh_sang, 'anh_sang')?.ten ?? pc.anh_sang}`, pc?.mau_mo_ta && `màu: ${pc.mau_mo_ta}`].filter(Boolean).join(' · ');
    const kq = await kiemKhungCanh({ canh, banDo: kt.ban_do ?? '', phongCach: kt.phong_cach, truoc, shot, kt });
    if (!kq.ok) return kq;
    cents += await ghiTienChu(db, bc.tap.phim_id, `Kiểm khung · tập ${bc.tap.so} · ${k[0]!.phan_doan}`, kq.model, kq.tokens);
    const luc = new Date().toISOString();
    for (const c of k) {
      const loi = kq.data.shot.find((x) => x.shot === c.thu_tu)?.loi ?? [];
      const kk: KiemKhung = { url: c.keyframe_url!, dat: !loi.length, loi, luc, model: kq.model };
      await db.execute(sql`UPDATE xv_canh SET kiem_khung = ${JSON.stringify(kk)}::jsonb WHERE id = ${c.id}`);
      if (loi.length) lech.push({ thu_tu: c.thu_tu, loi });
    }
  }
  return { ok: true, data: { khoi: khoi.length, shot: khoi.reduce((a, k) => a + k.length, 0), lech, cents } };
}

/** Thẻ shot gửi kèm ảnh: vai · cỡ · góc, bố cục, trạng thái mở, hướng, ai/cái gì có mặt. */
function theShot(c: Canh, ten: (id: number) => { ten: string; loai: string } | undefined, tr: Canh | null): string {
  const kt = c.ky_thuat ?? {}; const dd = c.dan_dung ?? {};
  const vao = tr ? `vào shot này từ shot #${tr.thu_tu} bằng: ${kyThuat(tr.ky_thuat?.chuyen_canh ?? 'cat', 'chuyen_canh')?.ten ?? 'cắt thẳng'}${tr.phan_doan !== c.phan_doan ? ' (sang cảnh mới)' : ''}; shot trước kết ở: ${tr.dan_dung?.ket || tr.hanh_dong}` : '';
  const co = c.nhan_vat.map(ten).filter((v): v is { ten: string; loai: string } => !!v && v.loai !== 'phong_cach').map((v) => `${v.ten} (${v.loai})`);
  return [
    vao,
    `máy: ${[kt.vai, kt.co_canh, kt.goc, kt.chuyen_dong].filter(Boolean).join(' · ')}${c.goc_may ? ` — ${c.goc_may}` : ''}`,
    dd.bo_cuc && `bố cục: ${dd.bo_cuc}`, `trạng thái MỞ (khung này): ${dd.mo || c.prompt_anh}`, dd.huong && `hướng: ${dd.huong}`,
    `có mặt: ${co.join(', ') || '—'}`, `hành động cả shot: ${c.hanh_dong}`,
  ].filter(Boolean).join('\n');
}

/** Người nhận khung dù máy báo lệch (máy báo sai) — ghi tên người, kết quả vẫn gắn url keyframe. */
export async function duyetKhungTay(db: Db, canhId: number, nguoi: string): Promise<{ ok: true } | { ok: false; loi: string }> {
  const r = (await db.execute(sql`SELECT keyframe_url, kiem_khung FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[];
  const kk = r[0]?.kiem_khung as KiemKhung | null;
  if (!r[0] || !kk || kk.url !== r[0].keyframe_url) return { ok: false, loi: 'shot chưa được máy kiểm khung (hoặc keyframe đã đổi) — kiểm trước' };
  await db.execute(sql`UPDATE xv_canh SET kiem_khung = ${JSON.stringify({ ...kk, duyet_tay: nguoi })}::jsonb WHERE id = ${canhId}`);
  return { ok: true };
}
