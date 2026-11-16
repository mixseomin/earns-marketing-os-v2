// KẾ HOẠCH CỤM SEEDANCE của một tập (0đ, chỉ đọc) — anh 14/11/2026 "tổ chức lại cụm video để sinh". Chia cụm cân trong từng phân cảnh (cum-shot.ts › chiaCumCan,
// trần 15 s của Seedance 2.0), đặt tên A, B, C…, ước giá Kie (có video vào: $0,034/s 480p · $0,075/s 720p × (giây vào + giây ra)).
// Dòng cuối là JSON cho scripts/bo-set/cum-seedance-tap.sh (iMac: dựng clip 3D nối của một cụm rồi gửi thu-seedance-cum.mts).
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/cum-seedance.mts --tap=3074 [--dpg=480p]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { chiaCumCan, giayClipSeedance } from '../src/lib/xuong-video/cum-shot';
import { giayPhat, chatLieuPhim, docKinhThanh, clip3dMoi, type KinhThanh } from '../src/lib/xuong-video/kieu';
import { chonCachKhopMoi } from '../src/lib/xuong-video/khop-moi-cach';
import { loiCoMay, shotCoMay, loiLapHanhDong, shotHanhDong } from '../src/lib/xuong-video/chan-gui-video';

const arg = (k: string, d = ''): string => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const tap = Number(arg('tap')); const dpg = arg('dpg', '480p'); if (!tap) { console.error('cần --tap'); process.exit(1); }
const db = getDb()!;
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
const gia = dpg === '720p' ? 7.5 : 3.4;
// KHÔNG SINH LẠI ĐOẠN ĐÃ CÓ (anh 14/11/2026: "đoạn nào sinh rồi thì không sinh lại vì phí, chỉ sinh lại đoạn lỗi"): shot có clip mà job sinh ra nó đã dùng ĐÚNG
// keyframe hiện tại (request.anh / request.khungDau chứa keyframe_url) thì giữ. Keyframe đổi sau lần sinh (vd #10 sửa dáng) = clip cũ → sinh lại. Anh muốn bỏ một
// clip đạt-về-máy nhưng sai ý → gỡ video_url của shot đó (hoặc --lai=<số shot>) rồi chạy lại.
const lai = new Set(arg('lai').split(',').map(Number).filter(Boolean));
const jobIds = ds.map((c) => Number((c.nguon_video as { job?: number } | null)?.job)).filter((x) => x > 0);
const jobs = new Map(((jobIds.length ? await db.execute(sql`SELECT id, request FROM xv_job WHERE id = ANY(${`{${jobIds.join(',')}}`}::int[]) AND output_url IS NOT NULL`) : []) as unknown as Row[]).map((r) => [Number(r.id), JSON.stringify(r.request ?? {})]));
// keyframe của CHÍNH shot lúc sinh: nguon_video.khung_dau (ghi khi gắn clip) — danh sách ảnh gửi đi (request.anh) bị trần 9 ảnh cắt bớt nên không dùng làm bằng chứng
// (15/11/2026: cụm #2–7 thiếu keyframe #6 #7 trong request.anh, kế hoạch đòi sinh lại oan). Bản ghi cũ chưa có khung_dau → đọc request như trước.
const conDung = (c: (typeof ds)[number]) => { const nv = c.nguon_video as { job?: number; khung_dau?: string; cd?: string } | null; const j = Number(nv?.job);
  // chuyển động máy lúc sinh khác chuyển động đang khai (doc-db.ts › CD_LUC_SINH) → clip cũ, sinh lại (#2–#4 phim #3071 còn cú đẩy vào sau khi đổi máy đứng)
  if (nv?.cd && nv.cd !== (c.ky_thuat?.chuyen_dong || 'tinh')) return false;
  // khớp thoại (can-giong.ts › khopTheoTiengClip) báo không đạt → sinh lại
  if ((c.nguon_video as { mieng?: { dat?: boolean } } | null)?.mieng?.dat === false) return false;
  return !lai.has(c.thu_tu) && !!c.video_url && !!c.keyframe_url && (nv?.khung_dau ? nv.khung_dau === c.keyframe_url : !!jobs.get(j)?.includes(c.keyframe_url)); };
const giu = ds.filter(conDung);
// đoạn CẦN SINH liền nhau (shot giữ cắt đôi đoạn) → chia cụm cân trong từng đoạn
const doan: (typeof ds)[] = []; for (const c of ds) { if (conDung(c)) { doan.push([]); continue; } (doan.at(-1) ?? doan[doan.push([]) - 1]!).push(c); }
// MỖI CỤM MỘT NGƯỜI NÓI (luật 15/11/2026): Seedance nhép lẫn khi ≥ 2 người nói trong một lần sinh — cắt đoạn trước shot đổi người nói rồi mới chia cân
const nguoiNoi = (c: (typeof ds)[number]) => [...new Set((c.thoai ?? []).filter((d) => d.url && d.loi?.trim()).map((d) => d.nhan_vat))];
const tachNoi = (d: (typeof ds)): (typeof ds)[] => { const out: (typeof ds)[] = [[]]; let ai: string | null = null;
  // SHOT THOẠI ĐỨNG CUỐI CỤM (luật 15/11/2026, đo #4 #6: Seedance nói trễ 0,4–0,8 s và chậm ×1,2): chỉ shot cuối có đuôi 2 s để khớp thoại dời điểm vào; shot thoại
  // ở giữa nói trễ là lấn đoạn shot kế → khớp thoại chặn → sinh lại cả cụm. Cắt cụm NGAY SAU mỗi shot có thoại gửi giọng (cổng: chan-gui-video.ts › loiThoaiCuoiCum).
  for (const c of d) { const n = nguoiNoi(c); const moi = n.find((x) => x !== ai) ?? null; if (n.length > 1 || (moi && ai && moi !== ai)) out.push([]); if (n.length) ai = n.length > 1 ? null : n[0]!; out.at(-1)!.push(c); if (n.length) out.push([]); }
  return out.filter((x) => x.length); };
// CÁCH KHỚP MÔI theo loại phim (khop-moi-cach.ts) — mỗi cụm có thoại: một người nói → theo chất liệu / ngôn ngữ; nhiều người → khớp sau / tách cụm
const kt = docKinhThanh(((await db.execute(sql`SELECT p.kinh_thanh FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tap}`)) as unknown as Row[])[0]?.kinh_thanh as KinhThanh);
const cachCua = (ids: number[]) => { const noi = new Set(ds.filter((c) => ids.includes(c.id)).flatMap((c) => (c.thoai ?? []).filter((d) => d.url && d.loi?.trim()).map((d) => d.nhan_vat)));
  return noi.size ? chonCachKhopMoi({ chatLieu: chatLieuPhim(kt), ngonNgu: kt.ngon_ngu, soNguoiNoi: noi.size }) : null; };
const lapTap = loiLapHanhDong(ds.map(shotHanhDong));
const cum = doan.filter((d) => d.length).flatMap(tachNoi).flatMap((d) => chiaCumCan(d, 15)).map((c, i) => {
  // giây clip = cum-shot.ts › giayClipSeedance (MỘT nguồn với lượt gửi thu-seedance-cum.mts): đuôi 2 s khi shot cuối có thoại gửi giọng — trước 15/11/2026 báo giá thiếu đuôi
  const cuoi = c.at(-1)!; const cuoiNoi = cachCua(c.map((x) => x.id))?.cach === 'seedance_audio' && (cuoi.thoai ?? []).some((d) => d.url && d.loi?.trim());
  const tong = c.reduce((a, x) => a + giayPhat(x), 0); const ra = giayClipSeedance(c.map((x) => giayPhat(x)), { cuoiCoThoai: cuoiNoi });
  const thieu = c.filter((x) => !clip3dMoi(x) || !x.keyframe_url).map((x) => x.thu_tu);   // clip 3D cũ (khung hoặc chuyển động máy đã đổi) — kieu.ts › clip3dMoi
  // lặp hành động xét trên CẢ tập (cụm khác nhau vẫn lặp được — #14 cụm cũ, #16 cụm khác), báo ở shot thuộc cụm này
  const lech = [...loiCoMay(c.map(shotCoMay)), ...lapTap.filter((l) => c.some((x) => l.startsWith(`#${x.thu_tu}:`)))];   // cỡ cảnh / máy lệch giữa chữ và ky_thuat (chan-gui-video.ts › loiCoMay) — lượt gửi sẽ chặn, sửa dữ liệu trước khi tiêu tiền
  return { ten: String.fromCharCode(65 + i), phan_doan: c[0]!.phan_doan, shot: c.map((x) => ({ id: x.id, so: x.thu_tu, phat: giayPhat(x), clip: x.khung_xam?.clip?.url ?? null, vao: x.khung_xam?.clip?.vao ?? 0 })),
    tong: +tong.toFixed(2), ra, cents: +(gia * (ra + ra)).toFixed(1), thieu, lech };   // giây vào = clip tham chiếu, kéo dài bằng clip ra (cum-seedance-tap.sh)
});
console.log(`giữ clip (không sinh lại): ${giu.length ? giu.map((c) => `#${c.thu_tu}`).join(' ') : 'không có'}`);
// shot đang giữ mà dữ liệu cỡ / máy lệch: clip hiện tại có thể đã đạt, nhưng lần sinh lại sau sẽ hỏng — báo để sửa dữ liệu
const lechGiu = [...loiCoMay(giu.map(shotCoMay)), ...lapTap.filter((l) => giu.some((x) => l.startsWith(`#${x.thu_tu}:`)))]; if (lechGiu.length) console.log(`dữ liệu thẻ shot lệch luật (shot đang giữ — cỡ / máy, lặp hành động): ${lechGiu.join(' | ')}`);
// LUẬT KHỚP MÔI (anh 15/11/2026 "shot 4 có voice nhưng không thấy mồm nói"): clip Seedance câm — shot có clip + lời thoại có file giọng mà chưa qua bước khớp môi
// (nguon_video.khop_moi) thì báo, chạy scripts/khop-moi-shot.mts --canh=<id>.
const chuaKhop = ds.filter((c) => c.video_url && (c.nguon_video as { mieng?: { dat?: boolean } } | null)?.mieng?.dat == null &&   // dat === false đã vào cụm sinh lại ở dưới
  (c.thoai ?? []).some((d) => d.url && d.loi?.trim() && !/ngoài khung|v\.?o\.?|lời dẫn|off/i.test(d.dien_xuat ?? '')));
if (chuaKhop.length) console.log(`chưa qua khớp thoại (có thoại): ${chuaKhop.map((c) => `#${c.thu_tu} (id ${c.id})`).join(' ')} — chạy khớp thoại cho clip đang gắn: thu-seedance-cum.mts --canh=<id> --chinh-giong (0đ)`);
for (const c of cum) console.log(`cụm ${c.ten} · ${c.phan_doan} · #${c.shot.map((x) => x.so).join(' #')} · ${c.tong} s → clip ${c.ra} s · ~${c.cents}¢${c.thieu.length ? ` · THIẾU clip 3D / keyframe: #${c.thieu.join(' #')}` : ''}${c.lech.length ? ` · CHẶN cỡ / máy: ${c.lech.join(' | ')}` : ''}${(() => { const k = cachCua(c.shot.map((x) => x.id)); return k ? ` · khớp môi: ${k.cach} (${k.vi})` : ''; })()}`);
console.log(`tổng ~${cum.reduce((a, c) => a + c.cents, 0).toFixed(1)}¢ (${dpg})`);
console.log(JSON.stringify(cum));
process.exit(0);
