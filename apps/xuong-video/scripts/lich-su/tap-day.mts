// ĐẨY TẬP ĐÃ DỰNG LÊN STUDIO (02/11/2026). Chạy trên box3 — lam-tap.mjs gọi sau khi dựng xong:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/tap-day.mts <tập.json> <video.mp4>
// MỖI KÊNH MỘT PHIM Studio ("Kênh lịch sử · <tên kênh>" theo kenh.json) để anh quản trong Studio; mỗi tập = một xv_tap (khoá ho_so.ma_tap = id tập):
// video R2 xuong-video/lich-su/tap/<id>.mp4, kịch bản (lời đọc từng câu + nguồn), thời lượng. Chạy lại = cập nhật đúng tập đó, không đẻ tập mới.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../../src/lib/r2';
import { createHash } from 'node:crypto';
// TÊN TỆP R2 MANG DẤU NỘI DUNG (03/11/2026: tên cố định <tập>.mp4 → CDN img.on.tc trả bản cũ 181 s sau khi dựng lại 179 s, Phòng Nội dung không chấm lại vì URL không đổi)
const dau = (b: Buffer) => createHash('md5').update(b).digest('hex').slice(0, 10);

// tsx tap-day.mts <tập.json> <video.mp4> [khung.jpg…] [--canh <canh.json> --kho <kho.json>]
//   khung → R2 xuong-video/lich-su/tap/<id>-khung-<i>.jpg (khung[] cho máy đăng) · --canh = STORYBOARD: [{ k, bd, kt, anh }] mỗi câu một cảnh (keyframe giữa cảnh)
//   → xv_canh của tập · --kho = kho.json → THÀNH PHẦN của phim kênh (nhân vật / cờ / phương tiện tập dùng, ảnh gốc + dáng) — anh 02/11/2026: phim kênh phải có
//   storyboard + thành phần như mọi phim Studio, không chỉ video + chữ.
const argv = process.argv.slice(2), cuoi = argv.findIndex((x) => x.startsWith('--')), vt = cuoi < 0 ? argv : argv.slice(0, cuoi);
const lay = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const [tepTap, mp4, ...tepKhung] = vt;
if (!tepTap || !mp4) { console.error('tsx tap-day.mts <tập.json> <video.mp4> [khung.jpg…] [--canh canh.json --kho kho.json]'); process.exit(2); }
const tap = JSON.parse(readFileSync(tepTap, 'utf8'));
const kenhId = tap.kenh ?? 'saga', K = JSON.parse(readFileSync(new URL('./kenh.json', import.meta.url), 'utf8'))[kenhId];
const db = getDb()!, q = async <T,>(s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];
// PHIM STUDIO CỦA KÊNH (anh 02/11/2026: "mỗi kênh có một file Studio quản lý"): tìm theo mã máy / mã kênh ghi trong kinh_thanh (đổi tên phim không đẻ phim mới);
// tên phim = tên công khai của kênh (kenh.json ten_kenh)
const PHIM = K.ten_kenh ?? `Kênh lịch sử · ${K.ten}`, khoaPhim = K.may ?? kenhId;
let phim = (await q<{ id: number }>(sql`SELECT id FROM xv_phim WHERE kinh_thanh->>'may' = ${khoaPhim} OR (kinh_thanh->>'may' IS NULL AND ten = ${PHIM}) ORDER BY id LIMIT 1`))[0]?.id;
if (!phim) phim = (await q<{ id: number }>(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai) VALUES ('studio', ${PHIM}, 'short',
  ${`Các tập kênh "${kenhId}" dựng bằng code (bản đồ + nhân vật kho chung). Khuôn: ${K.do_dai}; giọng đọc ${K.giong}; theme ${K.theme}. Máy: apps/xuong-video/scripts/lich-su/lam-tap.mjs --kenh ${kenhId}; hồ sơ kênh: kenh.json`},
  ${JSON.stringify({ chat_lieu: 've_2d', the_loai: 'tai_lieu', ti_le: '9:16', kenh: kenhId, may: khoaPhim, theme: K.theme })}::jsonb, 'nhap') RETURNING id`))[0]!.id;
const giay = Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' })));
const bMp4 = readFileSync(mp4), url = await uploadToR2(`xuong-video/lich-su/tap/${tap.id}-${dau(bMp4)}.mp4`, bMp4, 'video/mp4');
if (!url) { console.error('✗ tải R2 hỏng'); process.exit(1); }
const kichBan = tap.cau.map((c: { chu: string; su_that?: unknown[] }, i: number) => `${i + 1}. ${c.chu}${c.su_that?.length ? '' : '  [câu đùa]'}`).join('\n') + `\n\nNguồn:\n${(tap.nguon || []).join('\n')}`;
const hoSo = { ma_tap: tap.id, kenh: kenhId, playlist: tap.playlist ?? null, ngon_ngu: tap.ngon_ngu, chu_de: tap.chu_de, tep: `apps/xuong-video/scripts/lich-su/tap/${tap.id}.json` };
const co = (await q<{ id: number }>(sql`SELECT id FROM xv_tap WHERE phim_id = ${phim} AND ho_so->>'ma_tap' = ${tap.id} LIMIT 1`))[0]?.id;
let tapId = co;
if (co) await db.execute(sql`UPDATE xv_tap SET ten = ${tap.tieu_de}, kich_ban = ${kichBan}, tom_tat = ${tap.chu_de ?? tap.tieu_de}, video_url = ${url}, thoi_luong_s = ${giay}, ho_so = ${JSON.stringify(hoSo)}::jsonb, trang_thai = 'nhap', updated_at = now() WHERE id = ${co}`);
else { const so = (await q<{ n: number }>(sql`SELECT COALESCE(MAX(so), 0) + 1 AS n FROM xv_tap WHERE phim_id = ${phim}`))[0]!.n;
  tapId = (await q<{ id: number }>(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban, tom_tat, trang_thai, video_url, thoi_luong_s, ho_so) VALUES (${phim}, ${so}, ${tap.tieu_de}, ${kichBan}, ${tap.chu_de ?? tap.tieu_de}, 'nhap', ${url}, ${giay}, ${JSON.stringify(hoSo)}::jsonb) RETURNING id`))[0]!.id; }
const khung: string[] = [];
for (const [i, f] of tepKhung.entries()) { const b = readFileSync(f), u = await uploadToR2(`xuong-video/lich-su/tap/${tap.id}-khung-${i}-${dau(b)}.jpg`, b, 'image/jpeg'); if (u) khung.push(u); }

// ---------- STORYBOARD: mỗi câu một cảnh (cập nhật theo thứ tự cảnh — không xoá) ----------
type CanhTap = { nhin?: string[]; nam?: number; chu_to?: string; ket?: string; to?: { noi: string; chu?: string }[]; ten?: unknown[]; ke?: { nhan?: string }[]; xe?: { anh: string }[]; co?: { anh: string }[];
  dau?: { text: string }[]; nguoi?: { anh: string; ten: string; dang?: { dang: string }[] }[]; tranh?: { mo_ta?: string; commons?: string } };
const khoTs = lay('kho') ? (JSON.parse(readFileSync(lay('kho')!, 'utf8')).tai_san as Record<string, { loai: string; ten: string; ghi?: string; tu?: number; den?: number; dang?: Record<string, string> }>) : {};
let soCanh = 0; const anhCanh: string[] = [];
if (lay('canh')) {
  const ds = JSON.parse(readFileSync(lay('canh')!, 'utf8')) as { k: number; bd: number; kt: number; anh: string | null }[];
  for (const x of ds) {
    const c = tap.cau[x.k] as { chu: string; canh: CanhTap }, cv = c.canh ?? {};
    const bA = x.anh ? readFileSync(x.anh) : null, anh = bA ? await uploadToR2(`xuong-video/lich-su/tap/${tap.id}/canh-${x.k + 1}-${dau(bA)}.jpg`, bA, 'image/jpeg') : null;
    const nv = (cv.nguoi ?? []).map((n) => khoTs[n.anh]?.ten ?? n.ten);
    const viec = [
      ...(cv.to ?? []).map((t) => `tô ${t.noi}${t.chu ? ` (chủ ${t.chu})` : ''}`), ...((cv.ten ?? []).length ? [`${(cv.ten ?? []).length} mũi tên`] : []),
      ...(cv.ke ?? []).map((k) => `đường kẻ${k.nhan ? ` ${k.nhan}` : ''}`), ...(cv.xe ?? []).map((v) => `xe ${khoTs[v.anh]?.ten ?? v.anh}`), ...(cv.co ?? []).map((f) => `cắm ${khoTs[f.anh]?.ten ?? f.anh}`),
      ...(cv.nguoi ?? []).map((n) => `${khoTs[n.anh]?.ten ?? n.ten}${n.dang?.length ? ` (${n.dang.map((d) => d.dang).join(' → ')})` : ''}`),
      ...(cv.dau ?? []).map((d) => `con dấu ${d.text}`), ...(cv.tranh ? [`tranh: ${cv.tranh.commons ?? cv.tranh.mo_ta ?? ''}`] : []),
    ];
    const canh = `Bản đồ: ${(cv.nhin ?? []).join(', ') || '—'}${cv.nam ? ` · năm ${cv.nam}` : ''}`, chuMan = [cv.chu_to, ...(cv.dau ?? []).map((d) => d.text), cv.ket].filter(Boolean).join(' · ');   // chu_man NOT NULL (mặc định '')
    const tt = x.k + 1, dai = Math.max(1, Math.round(x.kt - x.bd));
    const cu = (await q<{ id: number }>(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND thu_tu = ${tt} LIMIT 1`))[0]?.id;
    if (cu) await db.execute(sql`UPDATE xv_canh SET canh = ${canh}, hanh_dong = ${viec.join(' · ') || 'giữ khung'}, loi_thoai = ${c.chu}, thoi_luong_s = ${dai}, phat_s = ${x.bd}, nhan_vat = ${JSON.stringify(nv)}::jsonb,
      keyframe_url = coalesce(${anh}, keyframe_url), chu_man = ${chuMan}, trang_thai = 'xong', updated_at = now() WHERE id = ${cu}`);
    else await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, loi_thoai, thoi_luong_s, phat_s, nhan_vat, keyframe_url, chu_man, trang_thai)
      VALUES (${tapId}, ${tt}, ${canh}, ${viec.join(' · ') || 'giữ khung'}, ${c.chu}, ${dai}, ${x.bd}, ${JSON.stringify(nv)}::jsonb, ${anh}, ${chuMan}, 'xong')`);
    if (anh) anhCanh.push(anh); soCanh++;
  }
}
// ---------- THÀNH PHẦN của phim kênh: món kho tập dùng (cập nhật theo tên — không xoá); dáng = biến thể nhóm 'dang' ----------
let soTp = 0;
if (lay('kho')) {
  const ids = [...new Set((tap.cau as { canh: CanhTap }[]).flatMap((c) => [...(c.canh?.nguoi ?? []), ...(c.canh?.co ?? []), ...(c.canh?.xe ?? [])].map((m) => m.anh)))].filter((x) => khoTs[x]);
  for (const ma of ids) {
    const t = khoTs[ma]!, loai = t.loai === 'nhan_vat' ? 'nhan_vat' : 'dao_cu', goc = t.dang?.goc ?? null, tieuSu = `Mã kho ${ma} · dùng được ${t.tu ?? '?'}–${t.den ?? '?'} · kho chung "Kênh lịch sử · kho tài sản"`;
    let nv = (await q<{ id: number }>(sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${phim} AND ten = ${t.ten} LIMIT 1`))[0]?.id;
    if (nv) await db.execute(sql`UPDATE xv_nhan_vat SET loai = ${loai}, mo_ta = ${t.ghi ?? ''}, anh_ref = ${JSON.stringify(goc ? [goc] : [])}::jsonb, tieu_su = ${tieuSu}, updated_at = now() WHERE id = ${nv}`);
    else nv = (await q<{ id: number }>(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, tieu_su) VALUES (${phim}, ${loai}, ${t.ten}, ${t.ghi ?? ''}, ${JSON.stringify(goc ? [goc] : [])}::jsonb, ${tieuSu}) RETURNING id`))[0]!.id;
    for (const [d, u] of Object.entries(t.dang ?? {})) { if (d === 'goc') continue;
      const b = (await q<{ id: number }>(sql`SELECT id FROM xv_bien_the WHERE nhan_vat_id = ${nv} AND nhom = 'dang' AND ten = ${d} LIMIT 1`))[0]?.id;
      if (b) await db.execute(sql`UPDATE xv_bien_the SET anh_url = ${u}, updated_at = now() WHERE id = ${b}`);
      else await db.execute(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta, anh_url) VALUES (${nv}, 'dang', ${d}, ${`Dáng ${d} của ${t.ten}`}, ${u})`); }
    soTp++;
  }
}
// soat = 8 keyframe rải đều suốt tập — Phòng Nội dung (Ngọc xem hình) soi cả phim dài, không chỉ 3 khung
const soat = anhCanh.length <= 8 ? anhCanh : Array.from({ length: 8 }, (_, i) => anhCanh[Math.round((i * (anhCanh.length - 1)) / 7)]!);
console.log(JSON.stringify({ phim, tap: tapId, url, giay, khung, canh: soCanh, thanh_phan: soTp, soat }));
process.exit(0);
