// MÁY → VIDEO từ dòng lệnh (src/lib/xuong-video/may.ts) — cửa cho máy ngoài studio (puzzle-books trên iMac / MacBook đi qua ssh). Mọi lệnh 0đ.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts [--may <mã máy>] <lệnh>
//   (--may mặc định front-porch-only-one)
//   --nap                          đọc JSON đề từ stdin ([{slug, chu_de, de, dang}]) → video của máy (đề đổi thì video cũ bỏ, xuất lại)
//   --ds [--ca-luu-tru]            in JSON { slug: { id, file_url, xuat_luc, da_dang, title, description, link, book, … } } — bên đăng / bên đọc số
//   --xuat <slug|all-chua|all> [--mau <mẫu>] [--song-song N]   dựng video (MP4 + 3 khung) cho một slug, mọi video đang dùng chưa có video, hoặc dựng lại TẤT CẢ (đổi mẫu)
//                                  — --mau chỉ lấy video của một mẫu (vd dựng lại màn kết Only ONE: --xuat all --mau do-chu-mot-dung); song song N lượt (mặc định 3; máy dựng Cloudflare chịu được 6)
//   --anh <slug|all-chua>          cắt ảnh tĩnh (mẫu có khai `anh`, vd scam → 2 ảnh cho nền x_anh) từ video ĐÃ dựng, không dựng lại
//   --ghi-dang <slug> <nền>        stdin JSON { url, ngay, luc?, binhLuan? } → sổ đăng của video (gộp vào lượt đã có)
//   --nap-nguon <tệp.json>         nạp cả tệp nguồn đề của mẫu (vd mau/may/scam-or-real.json) qua tuNguon của mẫu (mau-dung.ts)
//   --nguon                        stdin JSON { dung, tong, mo_ta? } → số của nguồn đề
//   --ghi-du-kien                  stdin JSON { may, ds: [{ ngay, gio, may, nen, slug, title }] } → lịch dự kiến 7 ngày (tab Social › Lịch đăng)
//   --nhat-ky                      stdin JSON { buoc, ok?, slug?, nen?, noi_dung?, url? } → một dòng nhật ký máy (màn máy hiện)
//   --sinh-de <YYYY-MM-DD> [--va-xuat] [--toi-da N]   ô kế hoạch ngày đó chưa có bài đúng góc + dạng → sinh đề bằng chữ AI (may-de.ts) → nạp (→ dựng); TỐN TIỀN vài chục đồng / đề
//   --trang-thai                   stdin JSON { may_mac, giay, ghi?, ds: [{ ma, nen, quyet, ly_do, slug?, url? }] } → trạng thái máy đăng thời gian thực (mos2 Lịch đăng › ⚡ Máy đăng)
//   --may-info                     in JSON máy (ma, ten, chay, dang[] gồm cấu hình kênh br) — máy đăng đọc nơi đăng từ đây
//   --may-chay                     in JSON [mã máy] đang bật (chay) — dang-may.mjs chạy lần lượt
//   --luot-xem                     ĐO THEO DẠNG: đọc lại lượt xem YouTube + Facebook mọi video đã đăng (cũ hơn 12 giờ) → bảng trung bình máy × dạng, 0₫
//   --sinh-game <N>                dạng game Only ONE: tiêu đề theo KHUNG video thắng của kênh (≥ 500 lượt sau 7 ngày, đọc lại lượt xem YouTube trước) + góc spy dùng ít nhất → nạp + dựng, 0₫
//   --sinh-kho <N>                 lấp kho VIDEO cho máy: N đề theo góc spy chưa dùng, dạng ra MP4 xoay vòng → nạp + dựng (TỐN TIỀN chữ AI — lô lớn duyệt qua Telegram)
//   --tu-khoa | --viet-bai           stdin { goc [, cau_hoi, slug] } → JSON câu tìm Quora / câu trả lời (chữ AI rẻ ~1¢; nạp vẫn qua nap-bai.mjs) — puzzle-books sinh-bai.mjs gọi
//   --ke-hoach <YYYY-MM-DD>        in JSON ô KẾ HOẠCH GÓC của máy ngày đó [{ ho, nen, format, dang, goc, dich }] (ke_hoach_goc — mos2 tự sinh hằng tuần); máy đăng ưu tiên bài đúng góc + dùng link đích
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { bucAnh, dsMay, dsVideoDang, ghiDang, ghiNguon, ghiNhatKy, mayTheoMa, napVideo, xuatVideo } from '../src/lib/xuong-video/may';
import { BO_DUNG } from '../src/lib/xuong-video/mau-dung';
import { CHU_VIET } from '../src/lib/xuong-video/may-de';
import { sachHook } from '../src/lib/xuong-video/hook-qc.mjs';

const a = process.argv.slice(2), lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] ?? '' : null; };
const db = getDb(); if (!db) { console.error('thiếu DATABASE_URL'); process.exit(1); }
const ma = lay('--may') ?? 'front-porch-only-one';
const docStdin = async () => { let raw = ''; for await (const c of process.stdin) raw += c; return JSON.parse(raw); };
/** Sản phẩm của máy cho chữ AI (sinh đề video + viết bài): tên, ngách, site, link đích, nhãn, mô tả — MỘT chỗ dựng cho cả hai lệnh. */
async function spCua(ma: string) {
  const r = (await db.execute(sql`SELECT ma, ten, coalesce(ngach, '{}') AS ngach, site_dich, muc_dich, phong_cach FROM xv_may WHERE ma = ${ma}`)) as unknown as { ten: string; ngach: string[]; site_dich: string | null; muc_dich: string; phong_cach: string | null }[];
  const LINK_MAY: Record<string, { link: string; nhan: string; book?: string }> = { 'front-porch-only-one': { link: 'https://pickjot.com/printables/large-print-word-search/', nhan: 'Front Porch Puzzles', book: 'nostalgia' },
    'ratesbyroom-scam-or-real': { link: 'https://ratesbyroom.com/hotel-scam-check/', nhan: 'ratesbyroom.com' }, 'esimfares-before-you-land': { link: 'https://esimfares.com/', nhan: 'esimfares.com' }, 'militarycalc': { link: 'https://militarycalc.com/', nhan: 'MilitaryCalc' }, 'giochap-van-khan': { link: 'https://giochap.com/van-khan', nhan: 'Giỗ Chạp' } };
  // tên máy là nhãn NỘI BỘ tiếng Việt "<dạng> · <thương hiệu>" — chữ đó vào bài thì kiemDe chặn cả lượt (ExamWeight 0/6 đề, 31/10/2026):
  // tên thương hiệu = đoạn sau "·" không dấu tiếng Việt, không có thì tên miền đích
  const nhanTen = (r[0]?.ten ?? '').split('·').map((x) => x.trim()).reverse().find((x) => x && !CHU_VIET.test(x)) ?? r[0]?.site_dich ?? ma;
  const lm = LINK_MAY[ma] ?? { link: `https://${r[0]?.site_dich ?? ''}/`, nhan: nhanTen };
  const sp = { ma, ten: r[0]!.ten, ngach: r[0]!.ngach, site: r[0]!.site_dich, link: lm.link, nhan: lm.nhan, mo_ta: r[0]!.muc_dich, ...(lm.book ? { book: lm.book } : {}), ...(r[0]!.phong_cach ? { phong_cach: r[0]!.phong_cach } : {}) };
  return sp;
}

if (a.includes('--nap')) {
  const ds = await docStdin();
  if (!Array.isArray(ds) || !ds.length) { console.error('stdin phải là mảng đề'); process.exit(1); }
  console.log(JSON.stringify(await napVideo(db, ma, ds)));
} else if (lay('--nap-nguon') != null) {
  const m = await mayTheoMa(db, ma); if (!m) { console.error(`không có máy ${ma}`); process.exit(1); }
  const tu = BO_DUNG[m.mau]?.tuNguon; if (!tu) { console.error(`mẫu ${m.mau} chưa có tuNguon`); process.exit(1); }
  const ds = (JSON.parse(readFileSync(lay('--nap-nguon')!, 'utf8')) as never[]).map((x) => tu(x));
  const kq = await napVideo(db, ma, ds as never); await ghiNguon(db, ma, { dung: 0, tong: ds.length });
  console.log(JSON.stringify(kq));
} else if (lay('--ke-hoach') != null) {
  const ngay = lay('--ke-hoach')!; if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) { console.error('--ke-hoach cần ngày YYYY-MM-DD'); process.exit(1); }
  process.stdout.write(JSON.stringify(await db.execute(sql`SELECT ho, nen, format, dang, can_dung, goc, dich FROM ke_hoach_goc WHERE may = ${ma} AND ngay = ${ngay}::date`)));
} else if (a.includes('--ds')) {
  process.stdout.write(JSON.stringify(await dsVideoDang(db, ma, a.includes('--ca-luu-tru'))));
} else if (lay('--gan-vx') != null) {
  // GẮN CLIP VIDEOEXPRESS vào cảnh (31/10/2026): worker iMac scripts/vx-may.mts tải clip về rồi scp lên box3 → đây nạp R2 + ghi de.canh[i].vx.
  //   --gan-vx <video_id> <cảnh i> <tệp mp4 trên box3>
  const [idV, iC, tep] = [Number(lay('--gan-vx')), Number(a[a.indexOf('--gan-vx') + 2]), a[a.indexOf('--gan-vx') + 3]];
  if (!(idV > 0) || !(iC >= 0) || !tep) { console.error('dùng: --gan-vx <video_id> <cảnh i> <tệp mp4>'); process.exit(2); }
  const { uploadToR2 } = await import('../src/lib/r2'), fs = await import('node:fs');
  const url = await uploadToR2(`xuong-video/may/vx-${idV}-${iC}-${Date.now().toString(36)}.mp4`, fs.readFileSync(tep), 'video/mp4');
  if (!url) { console.error('không đẩy được clip lên R2'); process.exit(1); }
  await db.execute(sql`UPDATE xv_may_video SET de = jsonb_set(de, ${`{canh,${iC},vx}`}::text[], to_jsonb(${url}::text)), updated_at = now() WHERE id = ${idV} AND jsonb_array_length(de->'canh') > ${iC}`);
  console.log(`✓ cảnh ${iC} của video #${idV} → ${url}`);
} else if (lay('--xuat') != null) {
  const muc = lay('--xuat')!, mauLoc = lay('--mau'), mMay = await mayTheoMa(db, ma);
  const ds = Object.entries(await dsVideoDang(db, ma)).filter(([slug, x]) => (muc === 'all' ? true : muc === 'all-chua' ? !x.file_url && !(x.loai === 'link' && x.xuat_luc) : slug === muc)).filter(([, x]) => !mauLoc || ((x as { mau?: string | null }).mau ?? mMay?.mau) === mauLoc);   // bài link không có video: đã chốt bản (xuat_luc) là xong
  if (!ds.length) { console.error(muc === 'all-chua' ? 'không còn video nào chưa dựng' : `không có video "${muc}" (đang dùng) trong máy ${ma}`); process.exit(muc === 'all-chua' ? 0 : 1); }
  let hong = 0, i = 0;
  const SONG_SONG = Math.min(8, Math.max(1, Number(lay('--song-song') ?? 3))), lam = async () => { while (i < ds.length) {
    const [slug, x] = ds[i++]!, t = Date.now(), r = await xuatVideo(db, Number(x.id));
    console.log(r.ok ? `✓ ${slug} ${((Date.now() - t) / 1000).toFixed(1)}s` : `✗ ${slug}: ${r.loi}`); if (!r.ok) hong++;
  } };
  await Promise.all(Array.from({ length: Math.min(SONG_SONG, ds.length) }, lam));
  if (hong) process.exit(1);
} else if (lay('--anh') != null) {
  const muc = lay('--anh')!, ds = Object.entries(await dsVideoDang(db, ma)).filter(([slug, x]) => x.file_url && (muc === 'all-chua' ? !(x.anh as string[] | undefined)?.length : slug === muc));
  let hong = 0;
  for (const [slug, x] of ds) { const r = await bucAnh(db, Number(x.id)); console.log(r.ok ? `✓ ${slug} ${r.so} ảnh` : `✗ ${slug}: ${r.loi}`); if (!r.ok) hong++; }
  if (!ds.length) console.error('không có video nào cần cắt ảnh');
  if (hong) process.exit(1);
} else if (lay('--ghi-dang') != null) {
  const i = a.indexOf('--ghi-dang'), slug = a[i + 1], nen = a[i + 2];
  if (!slug || !nen) { console.error('dùng: --ghi-dang <slug> <nền> < x.json'); process.exit(2); }
  if (!(await ghiDang(db, ma, slug, nen, await docStdin()))) { console.error(`không có video "${slug}" trong máy ${ma}`); process.exit(1); }
  console.log(`✓ sổ đăng ${slug} · ${nen}`);
} else if (a.includes('--nhat-ky')) {
  await ghiNhatKy(db, ma, await docStdin()); console.log('✓ nhật ký');
} else if (lay('--sinh-kho') != null) {
  // LẤP KHO VIDEO cho máy (anh 29/10/2026: Page cũ #625 hết bài DUYỆT để hẹn — --sinh-de chỉ sinh theo ô kế hoạch tuần, Page cũ không có ô): N đề VIDEO
  // (dạng ra MP4 — Reel lên Page được), góc spy CHƯA DÙNG của máy trước, dạng xoay vòng; nạp + dựng; Phòng Nội dung chấm như mọi bài. TỐN TIỀN (chữ AI ckey,
  // sinhJson tự gác ngưỡng) — chạy lô lớn qua nút ✅ Duyệt trên Telegram (worker/duyet-chi.mjs) hoặc DUYET_SINH_1_LAN=1 ngay sau khi anh duyệt.
  const N = Math.max(1, Math.min(40, Number(lay('--sinh-kho')) || 10)), m = await mayTheoMa(db, ma); if (!m) { console.error(`không có máy ${ma}`); process.exit(1); }
  const { sinhDe } = await import('../src/lib/xuong-video/may-de');
  const sp = await spCua(ma), dl = (sp.ngach ?? []).includes('du-lich');
  // giai-thich-giong: lời dẫn giọng AI heygen (bước 6, 30/10/2026) — mỗi video thêm ~$0,002–0,004 tiền giọng, cộng vào tổng lượt. --dang <mã>: chỉ sinh đúng một dạng (thử mẫu mới)
  const DANG_TAT_CA = ['lam-tuong', 'dung-sai', 'top-n', 'so-sanh', 'spot-the-fake', 'cau-do-meo', 'vat-lac-loai', 'canh-dong', 'giai-thich-giong', ...(dl ? ['cau-noi-theo-nuoc'] : [])];
  const DANG_VIDEO = lay('--dang') ? DANG_TAT_CA.filter((d) => d === lay('--dang')) : DANG_TAT_CA;
  if (!DANG_VIDEO.length) { console.error(`--dang ${lay('--dang')} không phải dạng video (${DANG_TAT_CA.join(', ')})`); process.exit(1); }
  const dongMay = ((await db.execute(sql`SELECT goc_sp, hook_sp FROM xv_may WHERE ma = ${ma}`)) as unknown as { goc_sp: number[] | null; hook_sp: number[] | null }[])[0];
  const nhom = (dongMay?.goc_sp ?? []).map(Number), nhomHook = [...new Set([...nhom, ...(dongMay?.hook_sp ?? []).map(Number)])];   // hook_sp: nhóm lân cận CHỈ để mượn hook (migration 0382)
  if (!nhom.length) { console.error(`máy ${ma} chưa gắn nhóm góc spy (goc_sp)`); process.exit(1); }
  const fs = await import('node:fs'), url = process.env.SPY_DATABASE_URL ?? fs.readFileSync('/root/.secrets/spy.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice(13);
  const spy = (await import('postgres')).default(url!, { max: 1, prepare: false });
  const gocs = (await spy`select sp_id as sp, id, loai, ten, coalesce(qc_ids, '{}') as qc_ids from goc where sp_id = any(${nhom}) order by id`) as unknown as { sp: number; id: number; loai: string; ten: string; qc_ids: string[] }[];
  // NGÔN NGỮ THEO THỊ TRƯỜNG của nhóm góc (31/10/2026, Giỗ Chạp): nhóm thị trường VN → đề + chữ đăng tiếng Việt; dạng cần giọng tiếng Anh (heygen Vincent) / câu nói ngoại ngữ thì bỏ
  const tt = ((await spy`select thi_truong from goc_sp where id = any(${nhom})`) as unknown as { thi_truong: string[] | null }[]).flatMap((x) => x.thi_truong ?? []);
  // HOOK GỐC TỪ QC THẬT (anh 31/10/2026, "rule quan trọng"): dòng đầu của QC chạy LÂU NHẤT khớp nhóm góc (biểu thức liên quan của spy, \b → \y cho Postgres),
  // đúng ngôn ngữ thị trường, 20–140 ký tự, bỏ trùng chữ. Góc có QC gắn sẵn (goc.qc_ids) thì QC của góc đứng trước. AI chọn một, sửa nhẹ (may-de.ts › kiemDe).
  const vi = tt.length > 0 && tt.every((t) => /^VN/i.test(t));
  // QC phải NÓI VỀ ngách ngay phần đầu (280 ký tự đầu khớp biểu thức liên quan) — khớp ở cuối thân QC = QC chủ đề khác (#875 xe đưa đón du thuyền lọt vào máy khách sạn)
  type HookDong = { id: string; chu: string; ngay: number; page: string };
  const hookTu = (rows: { library_id: string; dong: string; ngay: number; page_ten: string | null }[]) => { const thay = new Set<string>(), ra: HookDong[] = [];
    for (const r of rows) { const chu = sachHook(r.dong), k = chu.toLowerCase(); if (chu.length < 20 || chu.length > 140 || thay.has(k) || /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(chu) !== vi) continue; thay.add(k); ra.push({ id: String(r.library_id), chu, ngay: Number(r.ngay) || 0, page: String(r.page_ten ?? '') }); }
    return ra; };
  const hookNhom = hookTu((await spy`select library_id, split_part(noi_dung, E'\n', 1) as dong, (coalesce(lan_cuoi, now())::date - bat_dau::date) as ngay, page_ten from qc_meta
    where bat_dau is not null and left(noi_dung, 280) ~* any(select replace(lien_quan, '\\b', '\\y') from goc_sp where id = any(${nhomHook}) and lien_quan is not null)
    order by (coalesce(lan_cuoi, now()) - bat_dau) desc, bien_the desc nulls last limit 400`) as never).slice(0, 100);
  // VIDEO THẮNG của chính máy (anh duyệt 31/10/2026: hook đã chứng minh = QC spy chạy lâu HOẶC video kênh ≥ 500 lượt sau 7 ngày) → đứng ĐẦU kho hook
  const { THANG_LUOT_XEM, THANG_SAU_NGAY } = await import('../src/lib/xuong-video/luot-xem');
  const { docLaiLuotXem, NGAY_DANG_SQL } = await import('../src/lib/xuong-video/luot-xem-db'); await docLaiLuotXem(db, Number(m.id));
  const thangKenh: HookDong[] = ((await db.execute(sql`SELECT id, dang->>'title' AS title, luot_xem FROM xv_may_video WHERE may_id = ${m.id} AND luot_xem >= ${THANG_LUOT_XEM}
    AND ${sql.raw(NGAY_DANG_SQL)} <= current_date - ${THANG_SAU_NGAY}::int ORDER BY luot_xem DESC LIMIT 10`)) as unknown as { id: number; title: string; luot_xem: number }[])
    .map((v) => ({ id: `kenh:${v.id}`, chu: sachHook(v.title.replace(/\s*#\w+/g, '')), ngay: v.luot_xem, page: `video thắng của kênh (${v.luot_xem} lượt xem)` }));
  const qcGoc = [...new Set(gocs.flatMap((g) => g.qc_ids ?? []))];
  const hookCuaQc = new Map(hookTu(qcGoc.length ? (await spy`select library_id, split_part(noi_dung, E'\n', 1) as dong, (coalesce(lan_cuoi, now())::date - bat_dau::date) as ngay, page_ten from qc_meta where library_id = any(${qcGoc})`) as never : []).map((h) => [h.id, h]));
  /** 6 hook cho một góc: QC của góc trước, rồi QC chạy lâu của nhóm (xoay theo thứ tự để các bài không cùng một hook). */
  // hook QC spy dùng NGUYÊN VĂN → hook nằm trong bất kỳ bài chưa cất nào (kể cả bài bị chặn) không đưa lại — trả về kho chỉ khi bài đó được cất
  // (31/10: trả hook của bài SỬA LẠI về kho → bài mới trùng tiêu đề bài cũ, vòng lặp phí). Hook video thắng của kênh (kenh:) thì dùng nhiều lần, mỗi lần đổi chủ thể.
  // hook dùng NGUYÊN VĂN → một hook chỉ một bài đang chờ đăng của máy (31/10/2026: 5 bài Front Porch cùng một câu → Phòng Nội dung chặn trùng tiêu đề)
  const hookDaDung = new Set(((await db.execute(sql`SELECT v.dang->'hook'->>'qc' AS qc FROM xv_may_video v WHERE v.may_id = ${m.id} AND NOT coalesce(v.luu_tru, false) AND v.dang->'hook'->>'qc' IS NOT NULL AND v.dang->'hook'->>'qc' NOT LIKE 'kenh:%'`)) as unknown as { qc: string }[]).map((x) => x.qc));
  const hooksCho = (g: { qc_ids: string[] }, i: number): HookDong[] => { const rieng = (g.qc_ids ?? []).map((id) => hookCuaQc.get(String(id))).filter((x): x is HookDong => !!x && !hookDaDung.has(x.id)).slice(0, 3);
    const con = hookNhom.filter((h) => !hookDaDung.has(h.id));
    const chung = con.length ? Array.from({ length: Math.min(6, con.length) }, (_, k) => con[(i * 3 + k) % con.length]!) : [];
    return [...rieng, ...chung.filter((h, k, ds) => !rieng.some((r) => r.id === h.id) && ds.findIndex((x) => x.id === h.id) === k)].slice(0, 6); };
  await spy.end();
  // NGỌC LỌC KHO HOOK TRƯỚC KHI SINH (31/10/2026): cùng phép xét của Phòng Nội dung (cham-dang.mjs › xetHookAi — lệch ngách / hứa điều thương hiệu không có),
  // hook bị chặn thì không đưa cho AI viết — sinh ra là bài SỬA LẠI, đốt tiền. Xét 100 hook nhóm chạy lâu nhất (câu đã xét đọc sổ xet-hook.json, không tốn lại) + QC gắn góc; vài đồng một hook.
  {
    const { xetHookAi } = await import('../../cty/worker/cham-dang.mjs');
    const suThat = await import('node:fs').then((f) => { try { return f.readFileSync(new URL(`../su-that/${ma}.md`, import.meta.url), 'utf8'); } catch { return null; } });
    const muc = ((await db.execute(sql`SELECT muc_dich FROM xv_may WHERE ma = ${ma}`)) as unknown as { muc_dich: string | null }[])[0]?.muc_dich ?? null;
    const xet = async (ds: HookDong[]) => { const loi = await xetHookAi(ds.map((h) => ({ qc: h.id, ma, nhan: sp.nhan, muc_dich: muc, su_that: suThat, goc: h.chu, dong: [h.chu] }))); return ds.filter((_, k) => !loi[k]); };
    const truoc = hookNhom.length + hookCuaQc.size, nhomDat = await xet(hookNhom.slice(0, 100)), qcDat = new Set((await xet([...hookCuaQc.values()])).map((h) => h.id));
    hookNhom.splice(0, hookNhom.length, ...nhomDat); for (const k of [...hookCuaQc.keys()]) if (!qcDat.has(k)) hookCuaQc.delete(k);
    console.log(`· Ngọc lọc kho hook: giữ ${hookNhom.length + hookCuaQc.size}/${truoc}`);
  }
  hookNhom.unshift(...thangKenh);   // video thắng của kênh: đã chứng minh trên đúng tệp người xem của máy, không qua kho spy
  console.log(`· hook QC gốc: ${hookNhom.length} hook nhóm (chạy lâu nhất ${hookNhom[0]?.ngay ?? 0} ngày), ${hookCuaQc.size} QC gắn góc, ${hookDaDung.size} đã dùng ở bài đang chờ`);
  // KHÔNG có hook QC thì DỪNG: bài hook tự viết bị Phòng Nội dung chặn (cham-dang luật 8) — sinh ra là đốt tiền (31/10: Sidecue / MilitaryCalc / Giỗ Chạp 17 bài SỬA LẠI)
  if (!hookNhom.length && !hookCuaQc.size) { console.error(`✗ máy ${ma}: nhóm spy ${nhomHook.join(', ')} (góc + hook_sp) chưa có QC nào khớp làm hook — cần cào QC cho nhóm (hoặc gắn nhóm lân cận) trước khi sinh`); process.exit(1); }
  if (tt.length && tt.every((t) => /^VN/i.test(t))) { (sp as { ngon_ngu?: 'vi' }).ngon_ngu = 'vi'; DANG_VIDEO.splice(0, DANG_VIDEO.length, ...DANG_VIDEO.filter((d) => d !== 'giai-thich-giong' && d !== 'cau-noi-theo-nuoc')); console.log('· máy thị trường VN: viết tiếng Việt'); }
  const daCo = (await db.execute(sql`SELECT v.dang->'goc'->>'id' AS goc, v.dang->>'title' AS title FROM xv_may_video v WHERE v.may_id = ${m.id} AND NOT coalesce(v.luu_tru, false)`)) as unknown as { goc: string | null; title: string | null }[];
  const dem = new Map<number, number>(); for (const x of daCo) if (x.goc) dem.set(Number(x.goc), (dem.get(Number(x.goc)) ?? 0) + 1);
  const thuTu = [...gocs].sort((g1, g2) => (dem.get(g1.id) ?? 0) - (dem.get(g2.id) ?? 0));   // góc chưa dùng trước, rồi góc dùng ít
  const daDung = daCo.map((x) => x.title ?? '').filter(Boolean);
  let vnd = 0, n = 0, i = 0, hongLien = 0; const ra: string[] = [];
  for (const g of thuTu) {
    if (n >= N) break;
    const d = DANG_VIDEO[i++ % DANG_VIDEO.length]!;
    const hk = hooksCho(g, n); if (!hk.length) { ra.push(`· hết hook QC chưa dùng (${hookDaDung.size} hook đều đã có bài chờ đăng) — dừng lượt`); break; }
    const kq = await sinhDe({ sp, goc: g, dang_bai: d, daDung, hooks: hk }); vnd += kq.vnd;
    // 3 đề hỏng liền nhau = lỗi hệ thống, không phải đề xấu → dừng, không đốt tiền tiếp (31/10/2026: 5/6 hỏng cùng một lỗi, 449₫)
    if (!kq.ok) { ra.push(`✗ #${g.id} ${d}: ${kq.loi}`); hongLien++; if (/TỐN TIỀN/.test(kq.loi) || hongLien >= 3) { if (hongLien >= 3) ra.push('· 3 đề hỏng liền — dừng lượt'); break; } continue; }
    hongLien = 0;
    await napVideo(db, ma, [kq.de]); daDung.push(kq.de.dang.title ?? ''); const hq = (kq.de.dang as { hook?: { qc?: string } }).hook?.qc; if (hq) hookDaDung.add(hq);
    const v = ((await db.execute(sql`SELECT id FROM xv_may_video WHERE may_id = ${m.id} AND slug = ${kq.de.slug}`)) as unknown as { id: number }[])[0];
    const x = v ? await xuatVideo(db, Number(v.id)) : { ok: false as const, loi: 'không thấy dòng vừa nạp' };
    if (v) { const gv = Number(((await db.execute(sql`SELECT de->>'giong_vnd' AS g FROM xv_may_video WHERE id = ${v.id}`)) as unknown as { g: string | null }[])[0]?.g ?? 0); if (gv) { vnd += gv; kq.vnd += gv; } }   // tiền giọng lời dẫn (giong-heygen.ts) vào tổng lượt
    ra.push(`${x.ok ? '✓' : '⚠'} #${g.id} ${d} → ${kq.de.slug} (${Math.round(kq.vnd)}₫)${x.ok ? '' : ` · dựng ✗ ${x.loi}`}`); n++;
  }
  console.log(ra.join('\n')); console.log(`sinh kho ${ma}: ${n}/${N} đề, ${Math.round(vnd)}₫`);
} else if (a.includes('--luot-xem')) {
  // ĐO THEO DẠNG (bước 7): đọc lại lượt xem YouTube mọi video đã đăng của MỌI máy (cũ hơn 12 giờ) rồi in trung bình theo máy × dạng — 0₫
  const { docLaiLuotXem } = await import('../src/lib/xuong-video/luot-xem-db');
  const { doc, tong: ds } = await docLaiLuotXem(db, null);
  const bang = (await db.execute(sql`SELECT m.ma, coalesce(v.dang->>'dang_bai', v.mau, m.mau) AS dang, count(*)::int AS n, round(avg(v.luot_xem))::int AS tb, max(v.luot_xem) AS cao
    FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE v.luot_xem IS NOT NULL GROUP BY 1, 2 ORDER BY 1, tb DESC`)) as unknown as { ma: string; dang: string; n: number; tb: number; cao: number }[];
  console.log(`· đọc ${doc}/${ds} video`); for (const r of bang) console.log(`${r.ma.padEnd(28)} ${String(r.dang).padEnd(22)} ${String(r.n).padStart(3)} video  tb ${String(r.tb).padStart(6)}  cao ${r.cao}`);
} else if (lay('--sinh-game') != null) {
  // DẠNG GAME "Only ONE says ___" (anh duyệt 31/10/2026: hook lấy từ VIDEO THẮNG của chính kênh, cạnh QC spy) — 0₫, không gọi AI:
  //   1. đọc lại lượt xem YouTube các video đã đăng của máy (luot-xem.ts) → video thắng = ≥ 500 lượt sau ≥ 7 ngày
  //   2. từ chưa từng đăng (đề đố chữ đã dựng sẵn trong kho lưu trữ) + góc spy dùng ít nhất của máy → đề mới, tiêu đề = KHUNG video thắng chỉ đổi từ
  //   3. nạp + dựng; Phòng Nội dung chấm như mọi bài (hook bám gốc, Ngọc xét nhạt / lệch ngách)
  const N = Math.max(1, Math.min(30, Number(lay('--sinh-game')) || 6)), m = await mayTheoMa(db, ma); if (!m) { console.error(`không có máy ${ma}`); process.exit(1); }
  const { THANG_LUOT_XEM, THANG_SAU_NGAY } = await import('../src/lib/xuong-video/luot-xem');
  const { docLaiLuotXem, NGAY_DANG_SQL } = await import('../src/lib/xuong-video/luot-xem-db');
  const { doc, tong } = await docLaiLuotXem(db, Number(m.id)); const daDang = { length: tong };
  const thang = (await db.execute(sql`SELECT id, dang->>'title' AS title, luot_xem FROM xv_may_video WHERE may_id = ${m.id} AND de ? 'dich' AND luot_xem >= ${THANG_LUOT_XEM}
    AND ${sql.raw(NGAY_DANG_SQL)} <= current_date - ${THANG_SAU_NGAY}::int AND dang->>'title' ~ ${'^Only ONE says [A-Z]+\\.'} ORDER BY luot_xem DESC`)) as unknown as { id: number; title: string; luot_xem: number }[];
  console.log(`· đọc lượt xem ${doc}/${daDang.length} video; video thắng: ${thang.length}${thang[0] ? ` (cao nhất ${thang[0].luot_xem} lượt — "${thang[0].title.slice(0, 60)}")` : ''}`);
  if (!thang.length) { console.error(`✗ máy ${ma}: chưa có video thắng (≥ ${THANG_LUOT_XEM} lượt sau ${THANG_SAU_NGAY} ngày) làm hook — dừng`); process.exit(1); }
  // từ trộn ngẫu nhiên (lấy theo ABC thì một lượt toàn ACROBAT, ACTIVITY, AIRPORT… — đơn điệu)
  const tu = (await db.execute(sql`SELECT de, dang FROM (SELECT DISTINCT ON (v.de->>'dich') v.de, v.dang FROM xv_may_video v WHERE v.may_id = ${m.id} AND v.de ? 'dich' AND v.da_dang = '{}'::jsonb
    AND v.de->>'dich' NOT IN (SELECT w.de->>'dich' FROM xv_may_video w WHERE w.may_id = ${m.id} AND w.de ? 'dich' AND (w.da_dang <> '{}'::jsonb OR NOT coalesce(w.luu_tru, false)))
    ORDER BY v.de->>'dich', v.id) x ORDER BY random() LIMIT ${N}`)) as unknown as { de: { dich: string; o: string[]; cho: number; goi: string; mau: unknown }; dang: { description?: string; link?: string; book?: string } }[];
  const nhom = (((await db.execute(sql`SELECT goc_sp FROM xv_may WHERE ma = ${ma}`)) as unknown as { goc_sp: number[] | null }[])[0]?.goc_sp ?? []).map(Number);
  const fs = await import('node:fs'), url = process.env.SPY_DATABASE_URL ?? fs.readFileSync('/root/.secrets/spy.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice(13);
  const spy = (await import('postgres')).default(url!, { max: 1, prepare: false });
  const gocs = (await spy`select sp_id as sp, id, loai, ten from goc where sp_id = any(${nhom}) order by id`) as unknown as { sp: number; id: number; loai: string; ten: string }[]; await spy.end();
  const daCo = (await db.execute(sql`SELECT dang->'goc'->>'id' AS goc FROM xv_may_video WHERE may_id = ${m.id} AND NOT coalesce(luu_tru, false)`)) as unknown as { goc: string | null }[];
  const dem = new Map<number, number>(); for (const x of daCo) if (x.goc) dem.set(Number(x.goc), (dem.get(Number(x.goc)) ?? 0) + 1);
  const thuTu = [...gocs].sort((g1, g2) => (dem.get(g1.id) ?? 0) - (dem.get(g2.id) ?? 0));
  if (!thuTu.length) { console.error(`máy ${ma} chưa có góc spy (goc_sp)`); process.exit(1); }
  const ra: string[] = [];
  for (const [k, x] of tu.entries()) {
    const h = thang[k % thang.length]!, g = thuTu[k % thuTu.length]!, dich = x.de.dich;
    const title = h.title.replace(/^Only ONE says [A-Z]+\./, `Only ONE says ${dich}.`);   // khung video thắng, chỉ đổi từ
    const description = (x.dang.description ?? '').replace(/^35 of these are misspelled by one letter\. Only one says [A-Z]+\./, `35 of these are misspelled by one letter. Only one says ${dich}.`);
    const slug = `game-${g.id}-${dich.toLowerCase()}`;
    await napVideo(db, ma, [{ slug, chu_de: x.de.goi, de: { dich, o: x.de.o, cho: x.de.cho, goi: x.de.goi, mau: x.de.mau }, dang: { title, description, link: x.dang.link, book: x.dang.book, words: [dich], nhom: 'Góc spy', dang_bai: 'only-one',
      goc: { sp: g.sp, id: g.id, loai: g.loai, ten: g.ten }, hook: { qc: `kenh:${h.id}`, goc: h.title, page: 'video thắng của kênh', ngay: 0, nguon: 'kenh', luot_xem: h.luot_xem } } } as never]);
    const v = ((await db.execute(sql`SELECT id FROM xv_may_video WHERE may_id = ${m.id} AND slug = ${slug}`)) as unknown as { id: number }[])[0];
    const kq = v ? await xuatVideo(db, Number(v.id)) : { ok: false as const, loi: 'không thấy dòng vừa nạp' };
    ra.push(`${kq.ok ? '✓' : '⚠'} ${slug} ← khung #${h.id} (${h.luot_xem} lượt)${kq.ok ? '' : ` · dựng ✗ ${kq.loi}`}`);
  }
  console.log(ra.join('\n')); console.log(`sinh game ${ma}: ${ra.filter((x) => x.startsWith('✓')).length}/${N} video, 0₫`);
} else if (a.includes('--tu-khoa') || a.includes('--viet-bai')) {
  // BÀI VIẾT bằng chữ AI rẻ (followup #1470): stdin { goc: { sp, id, loai, ten } [, cau_hoi, link] } → JSON. Một bài ~1¢ trở xuống (Haiku qua ckey) — dưới ngưỡng tự chạy;
  // máy gọi: puzzle-books scripts/sinh-bai.mjs (tìm câu hỏi Quora thật bằng br → --viet-bai → nap-bai.mjs). Không nạp ở đây: nạp chỉ một đường (nap-bai.mjs).
  const { tuKhoaQuora, vietBai } = await import('../src/lib/xuong-video/may-de');
  const x = await docStdin(), sp = await spCua(ma);   // tiền: sinhJson (claude.ts) tự gác theo giá thật mỗi lượt — không gác thêm ở đây (gác hai lần = cộng dồn sai, chặn oan 28/10)
  if (a.includes('--tu-khoa')) { console.log(JSON.stringify(await tuKhoaQuora({ sp, goc: x.goc }))); }
  else {
    if (!x.cau_hoi) { console.error('--viet-bai cần cau_hoi'); process.exit(1); }
    // link đích dựng MỘT chỗ ở đây: trang đích của máy (spCua) + UTM theo slug bài — người gọi không tự ghép
    const utm = `utm_source=quora&utm_medium=answer&utm_campaign=${encodeURIComponent(x.slug ?? 'quora')}`, link = x.link ?? `${sp.link}${sp.link.includes('?') ? '&' : '?'}${utm}`;
    // tệp SỰ THẬT đã kiểm của máy (apps/xuong-video/su-that/<máy>.md) — có thì mô hình chỉ dùng số liệu trong đó + chọn trang đích trong danh sách của nó
    const suThat = await import('node:fs').then((f) => { try { return f.readFileSync(new URL(`../su-that/${ma}.md`, import.meta.url), 'utf8'); } catch { return null; } });
    console.log(JSON.stringify(await vietBai({ sp, goc: x.goc, cauHoi: x.cau_hoi, link, utm, suThat })));
  }
} else if (lay('--sinh-de') != null) {
  // MÁY SINH ĐỀ THEO GÓC (bước 3, 27/10/2026): ô kế hoạch của máy ngày đó chưa có bài DUYỆT đúng góc + dạng → sinh đề bằng chữ AI rẻ (may-de.ts) → nạp (→ --va-xuat dựng luôn; không dùng chữ --xuat vì nhánh --xuat <slug> đứng trước trong chuỗi lệnh).
  // TỐN TIỀN (vài chục đồng / đề qua ckey): chạy bằng script cần DUYET_SINH_1_LAN=1 khi quá ngưỡng tự chạy (chot-tien.ts); --toi-da N giới hạn số đề một lượt.
  const ngay = lay('--sinh-de')!; if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) { console.error('--sinh-de cần ngày YYYY-MM-DD'); process.exit(1); }
  const { sinhDe, MAU_CUA_DANG, MAU_SINH } = await import('../src/lib/xuong-video/may-de');
  const toiDa = Number(lay('--toi-da') ?? 50), m = await mayTheoMa(db, ma); if (!m) { console.error(`không có máy ${ma}`); process.exit(1); }
  const sp = await spCua(ma);
  const o = (await db.execute(sql`SELECT k.nen, k.dang, k.goc, k.dich FROM ke_hoach_goc k WHERE k.may = ${ma} AND k.ngay = ${ngay}::date AND k.dang IS NOT NULL`)) as unknown as { nen: string; dang: string; goc: { sp: number; id: number; loai: string; ten: string }; dich: string | null }[];
  const daCo = (await db.execute(sql`SELECT v.dang->'goc'->>'id' AS goc, v.dang->>'dang_bai' AS dang, v.dang->>'title' AS title FROM xv_may_video v WHERE v.may_id = ${m.id} AND NOT coalesce(v.luu_tru, false)`)) as unknown as { goc: string | null; dang: string | null; title: string | null }[];
  const daDung = daCo.map((x) => x.title ?? '').filter(Boolean);
  let vnd = 0, n = 0; const ra: string[] = [];
  for (const oKe of o) {
    if (n >= toiDa) break;
    const mau = MAU_CUA_DANG[oKe.dang]; if (!mau || !MAU_SINH.has(mau)) { ra.push(`· ${oKe.nen} ${oKe.dang}: dạng chưa có mẫu sinh đề — máy đăng dùng bài kho`); continue; }
    if (daCo.some((x) => Number(x.goc) === Number(oKe.goc?.id) && x.dang === oKe.dang)) { ra.push(`· ${oKe.nen} ${oKe.dang} #${oKe.goc.id}: đã có bài đúng góc + dạng`); continue; }
    // tiền: sinhJson (claude.ts) gác từng lượt mô hình theo giá thật, cộng dồn cả lượt chạy — quá ngưỡng tự chạy thì cần DUYET_SINH_1_LAN=1 (trước 28/10 gác thêm 0,4¢ ở đây = tính hai lần)
    const kq = await sinhDe({ sp, goc: oKe.goc, dang_bai: oKe.dang, dich: oKe.dich, daDung });
    vnd += kq.vnd; n++;
    if (!kq.ok) { ra.push(`✗ ${oKe.nen} ${oKe.dang} #${oKe.goc.id}: ${kq.loi}`); continue; }
    await napVideo(db, ma, [kq.de]); daDung.push(kq.de.dang.title ?? ''); daCo.push({ goc: String(oKe.goc.id), dang: oKe.dang, title: kq.de.dang.title ?? null });
    let xuat = '';
    if (a.includes('--va-xuat')) { const v = ((await db.execute(sql`SELECT id FROM xv_may_video WHERE may_id = ${m.id} AND slug = ${kq.de.slug}`)) as unknown as { id: number }[])[0]; const x = v ? await xuatVideo(db, Number(v.id)) : { ok: false as const, loi: 'không thấy dòng vừa nạp' }; xuat = x.ok ? ` · dựng ✓ ${x.url}` : ` · dựng ✗ ${x.loi}`; }
    ra.push(`✓ ${oKe.nen} ${oKe.dang} #${oKe.goc.id} → ${kq.de.slug} (${kq.model}, ${Math.round(kq.vnd)}₫) "${kq.de.dang.title}"${xuat}`);
  }
  console.log(ra.join('\n')); console.log(`sinh đề ${ma} ${ngay}: ${n} lượt mô hình, ${Math.round(vnd)}₫`);
} else if (a.includes('--trang-thai')) {
  // lượt 10 phút của máy đăng liên tục ghi về (dang-lien-tuc.mjs): stdin { may_mac, giay, ghi?, ds: [{ ma, nen, quyet, ly_do, slug?, url? }] } → may_dang_trang_thai (ghi đè) + may_dang_luot
  const t = (await docStdin()) as { may_mac: string; giay: number; ghi?: string; ds: { ma: string; nen: string; quyet: string; ly_do?: string; slug?: string | null; url?: string | null }[] };
  for (const x of t.ds ?? []) await db.execute(sql`INSERT INTO may_dang_trang_thai (ma, nen, luc, may_mac, quyet, ly_do, slug, url) VALUES (${x.ma}, ${x.nen}, now(), ${t.may_mac ?? ''}, ${x.quyet}, ${x.ly_do ?? ''}, ${x.slug ?? null}, ${x.url ?? null})
    ON CONFLICT (ma, nen) DO UPDATE SET luc = now(), may_mac = EXCLUDED.may_mac, quyet = EXCLUDED.quyet, ly_do = EXCLUDED.ly_do, slug = EXCLUDED.slug, url = EXCLUDED.url`);
  const dem = (q: string) => (t.ds ?? []).filter((x) => x.quyet === q).length;
  await db.execute(sql`INSERT INTO may_dang_luot (may_mac, giay, so_dang, so_hong, so_bo, ghi) VALUES (${t.may_mac ?? ''}, ${Math.round(t.giay ?? 0)}, ${dem('dang')}, ${dem('hong')}, ${dem('bo') + dem('dung')}, ${t.ghi ?? ''})`);
  console.log(`✓ trạng thái ${(t.ds ?? []).length} kênh`);
} else if (a.includes('--may-info')) {
  const m = await mayTheoMa(db, ma); if (!m) { console.error(`không có máy ${ma}`); process.exit(1); }
  process.stdout.write(JSON.stringify(m));
} else if (a.includes('--may-chay')) {
  process.stdout.write(JSON.stringify((await dsMay(db)).filter((m) => m.chay).map((m) => m.ma)));
} else if (a.includes('--ghi-du-kien')) {   // lịch dự kiến 7 ngày do dang-may tính (nhip-an-toan.mjs › duKienTuan) — stdin { may, ds: [...] }
  const x = await docStdin(); if (!Array.isArray(x?.ds)) { console.error('stdin phải là { may, ds: [] }'); process.exit(2); }
  await db.execute(sql`INSERT INTO xv_lich_du_kien (id, luc, may, ds) VALUES (1, now(), ${String(x.may ?? '')}, ${JSON.stringify(x.ds)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET luc = now(), may = EXCLUDED.may, ds = EXCLUDED.ds`);
  console.log(`✓ lịch dự kiến ${x.ds.length} lượt`);
} else if (a.includes('--nguon')) {
  await ghiNguon(db, ma, await docStdin()); console.log('✓ nguồn');
} else { console.error('dùng: may-dung.mts [--may mã] --nap < de.json | --ds [--ca-luu-tru] | --xuat <slug|all-chua> | --anh <slug|all-chua> | --ghi-dang <slug> <nền> < x.json | --nguon < n.json | --nhat-ky < x.json | --may-info | --may-chay'); process.exit(2); }
// chờ stdout xả hết rồi mới thoát: stdout là ống (ssh) thì ghi bất đồng bộ — exit ngay cắt mất phần sau ~64 KB (21/10/2026: --ds máy Hotel 65 KB → JSON cụt)
await new Promise<void>((xong) => process.stdout.write('', () => xong()));
process.exit(0);
