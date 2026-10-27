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
//   --ke-hoach <YYYY-MM-DD>        in JSON ô KẾ HOẠCH GÓC của máy ngày đó [{ ho, nen, format, dang, goc, dich }] (ke_hoach_goc — mos2 tự sinh hằng tuần); máy đăng ưu tiên bài đúng góc + dùng link đích
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { bucAnh, dsMay, dsVideoDang, ghiDang, ghiNguon, ghiNhatKy, mayTheoMa, napVideo, xuatVideo } from '../src/lib/xuong-video/may';
import { BO_DUNG } from '../src/lib/xuong-video/mau-dung';

const a = process.argv.slice(2), lay = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] ?? '' : null; };
const db = getDb(); if (!db) { console.error('thiếu DATABASE_URL'); process.exit(1); }
const ma = lay('--may') ?? 'front-porch-only-one';
const docStdin = async () => { let raw = ''; for await (const c of process.stdin) raw += c; return JSON.parse(raw); };

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
} else if (lay('--sinh-de') != null) {
  // MÁY SINH ĐỀ THEO GÓC (bước 3, 27/10/2026): ô kế hoạch của máy ngày đó chưa có bài DUYỆT đúng góc + dạng → sinh đề bằng chữ AI rẻ (may-de.ts) → nạp (→ --va-xuat dựng luôn; không dùng chữ --xuat vì nhánh --xuat <slug> đứng trước trong chuỗi lệnh).
  // TỐN TIỀN (vài chục đồng / đề qua ckey): chạy bằng script cần DUYET_SINH_1_LAN=1 khi quá ngưỡng tự chạy (chot-tien.ts); --toi-da N giới hạn số đề một lượt.
  const ngay = lay('--sinh-de')!; if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) { console.error('--sinh-de cần ngày YYYY-MM-DD'); process.exit(1); }
  const { sinhDe, MAU_CUA_DANG, MAU_SINH } = await import('../src/lib/xuong-video/may-de');
  const { chotTien } = await import('../src/lib/xuong-video/chot-tien');
  const toiDa = Number(lay('--toi-da') ?? 50), m = await mayTheoMa(db, ma); if (!m) { console.error(`không có máy ${ma}`); process.exit(1); }
  const r = (await db.execute(sql`SELECT ma, ten, coalesce(ngach, '{}') AS ngach, site_dich, muc_dich FROM xv_may WHERE ma = ${ma}`)) as unknown as { ten: string; ngach: string[]; site_dich: string | null; muc_dich: string }[];
  const LINK_MAY: Record<string, { link: string; nhan: string; book?: string }> = { 'front-porch-only-one': { link: 'https://pickjot.com/printables/large-print-word-search/', nhan: 'Front Porch Puzzles', book: 'nostalgia' },
    'ratesbyroom-scam-or-real': { link: 'https://ratesbyroom.com/hotel-scam-check/', nhan: 'ratesbyroom.com' }, 'esimfares-before-you-land': { link: 'https://esimfares.com/', nhan: 'esimfares.com' }, 'giochap-van-khan': { link: 'https://giochap.com/van-khan', nhan: 'Giỗ Chạp' } };
  const lm = LINK_MAY[ma] ?? { link: `https://${r[0]?.site_dich ?? ''}/`, nhan: r[0]?.ten ?? ma };
  const sp = { ma, ten: r[0]!.ten, ngach: r[0]!.ngach, site: r[0]!.site_dich, link: lm.link, nhan: lm.nhan, mo_ta: r[0]!.muc_dich, ...(lm.book ? { book: lm.book } : {}) };
  const o = (await db.execute(sql`SELECT k.nen, k.dang, k.goc, k.dich FROM ke_hoach_goc k WHERE k.may = ${ma} AND k.ngay = ${ngay}::date AND k.dang IS NOT NULL`)) as unknown as { nen: string; dang: string; goc: { sp: number; id: number; loai: string; ten: string }; dich: string | null }[];
  const daCo = (await db.execute(sql`SELECT v.dang->'goc'->>'id' AS goc, v.dang->>'dang_bai' AS dang, v.dang->>'title' AS title FROM xv_may_video v WHERE v.may_id = ${m.id} AND NOT coalesce(v.luu_tru, false)`)) as unknown as { goc: string | null; dang: string | null; title: string | null }[];
  const daDung = daCo.map((x) => x.title ?? '').filter(Boolean);
  let vnd = 0, n = 0; const ra: string[] = [];
  for (const oKe of o) {
    if (n >= toiDa) break;
    const mau = MAU_CUA_DANG[oKe.dang]; if (!mau || !MAU_SINH.has(mau)) { ra.push(`· ${oKe.nen} ${oKe.dang}: dạng chưa có mẫu sinh đề — máy đăng dùng bài kho`); continue; }
    if (daCo.some((x) => Number(x.goc) === Number(oKe.goc?.id) && x.dang === oKe.dang)) { ra.push(`· ${oKe.nen} ${oKe.dang} #${oKe.goc.id}: đã có bài đúng góc + dạng`); continue; }
    chotTien(`sinh đề ${oKe.dang} #${oKe.goc.id}`, { cents: 0.4 });   // ~13₫ ước theo ckey Haiku; quá ngưỡng cộng dồn thì cần DUYET_SINH_1_LAN=1
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
