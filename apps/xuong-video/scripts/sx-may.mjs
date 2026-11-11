#!/usr/bin/env node
// MÁY SẢN XUẤT (anh 11/11/2026: "cần làm 1 con Máy sx để tạo nội dung cho tập trung giống Máy đăng. Sau sửa chữa, nâng cấp cho dễ").
// Song song với máy đăng: sổ dạng bài apps/xuong-video/kieu-sx.json → lõi scripts/sx-bai.mjs (mỗi dạng một hàm) → điều phối ở đây.
// Việc của máy: tìm bài ĐÃ CÓ TRONG LỊCH mà CHƯA CÓ TỆP, dựng tệp, đưa lên R2, ghi vào xv_may_video, rồi nộp Phòng Nội dung chấm.
// Máy đăng sau đó tự lấy bài DUYỆT theo lịch — không ai phải bấm tay.
//
//   node scripts/sx-may.mjs --tu-kiem                       sổ dạng bài ↔ bảng hàm khớp nhau chưa
//   node scripts/sx-may.mjs --may mia-calloway --xem        xem sẽ dựng gì (không dựng, không tiêu tiền)
//   node scripts/sx-may.mjs --may mia-calloway [--ngay 3]   dựng mọi bài thiếu tệp tới hạn trong N ngày (mặc định 3)
//   node scripts/sx-may.mjs --slug <slug>                   dựng đúng một bài
//
// VÌ SAO CHẠY Ở iMAC: dạng Reel dùng ffmpeg — luật nhà cấm dựng video trên box3. Dạng ảnh tự gọi sang box3 (khoá R2 ở đó).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LAM, MIET_THI, doanSach } from './sx-bai.mjs';

const BOX = 'root@167.233.241.16';
const D = path.dirname(new URL(import.meta.url).pathname);
const SO = JSON.parse(readFileSync(path.join(D, '..', 'kieu-sx.json'), 'utf8'));
const ag = process.argv.slice(2), co = (t) => ag.includes(t);
// `i >= 0` chứ KHÔNG phải `i > 0`: cờ đứng NGAY ĐẦU (node sx-may.mjs --may x) có chỉ số 0,
// viết `i > 0` thì đúng cái cờ đầu tiên luôn bị bỏ qua — hỏng lượt chạy đầu 11/11/2026.
const doc = (ag, k) => { const i = ag.indexOf(k); return i >= 0 ? ag[i + 1] ?? null : null; };
const lay = (k) => doc(ag, k);

/** psql trên box3 — chữ SQL đi qua tệp để không vướng dấu nháy (bài học 11/11/2026: nhồi SQL vào -c bị shell nuốt). */
function psql(sql) {
  const t = `/tmp/sx-${Date.now()}.sql`;
  writeFileSync('/tmp/sx-tam.sql', sql);
  execFileSync('scp', ['-q', '/tmp/sx-tam.sql', `${BOX}:${t}`], { timeout: 120_000 });
  return execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -tAf ${t}`], { encoding: 'utf8', timeout: 300_000 });
}

/** Dạng bài mặc định suy từ NỀN khi bài chưa khai dang.kieu_sx — nền Reel → cắt cảnh, nền ảnh → ảnh đời thường. */
// Reel mặc định = bản có chữ FREE (anh 11/11/2026 "video mới nhất của Mia có nhiều view hẳn. Rút kinh nghiệm"): cùng cảnh 9s, cùng phim, bản FREE 236 lượt phát /
// 42 lượt xem lại / xem TB 4,8s so với bản thường 22 lượt (Graph video_insights 11/11/2026). Còn lệch giờ đăng (07:26 vs 00:24 giờ VN) nên đo tiếp, nhưng mặc định theo bản thắng.
const kieuMacDinh = (nen) => (nen === 'fb_anh' ? 'anh_doi_thuong' : nen === 'facebook' ? 'reel_canh9_free' : null);

/** Bài CẦN DỰNG: đã có ngày đăng trong N ngày tới, chưa đăng, chưa có tệp (video lẫn ảnh đều trống). */
function canDung(may, ngay) {
  const r = psql(`SELECT v.slug||E'\\t'||coalesce(v.dang->>'dang_bai','')||E'\\t'||coalesce(v.dang->>'dang_tu','')||E'\\t'||coalesce(v.dang->>'kieu_sx','')||E'\\t'||coalesce(v.dang->>'phim','')||E'\\t'||coalesce(v.dang->>'y','')||E'\\t'||coalesce(v.dang->>'prompt','')
FROM xv_may_video v JOIN xv_may m ON m.id=v.may_id
WHERE m.ma='${may}' AND v.da_dang='{}'::jsonb AND NOT coalesce(v.luu_tru,false)
  AND v.video_url IS NULL AND jsonb_array_length(coalesce(v.anh,'[]'::jsonb))=0
  AND coalesce(v.dang->>'dang_tu','') <> ''
  AND (v.dang->>'dang_tu')::date <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + ${Number(ngay)}
ORDER BY v.dang->>'dang_tu';`);
  return r.split('\n').filter(Boolean).map((d) => {
    const [slug, nen, dangTu, kieuSx, phim, y, prompt] = d.split('\t');
    return { slug, nen, dangTu, kieu: kieuSx || kieuMacDinh(nen), phim: phim ? Number(phim) : null, huong: y, prompt, may };
  });
}

/** Link trang phim để tải tập (thư viện Ethopex, schema `etp` — KHÔNG phải public). */
function urlPhim(id) {
  const r = psql(`SELECT coalesce(url,'') FROM etp.thu_vien_phim WHERE content_id=${Number(id)} LIMIT 1;`).trim();
  return r || null;
}

/** NHẬT KÝ LƯỢT DỰNG → bảng may_sx_luot (tab Máy SX trên mos2 đọc). Bảng do CHÍNH MÁY tự tạo: migration dùng chung của monorepo
 *  (packages/db) không thuộc app này. Ghi hỏng thì chỉ cảnh báo, không làm hỏng lượt dựng. */
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
function ghiLuot(b, ok, kq = {}, loi = null) {
  try {
    psql(`CREATE TABLE IF NOT EXISTS may_sx_luot (id bigserial PRIMARY KEY, luc timestamptz NOT NULL DEFAULT now(), may text NOT NULL, slug text NOT NULL,
  kieu text, ngay_dang text, ok boolean NOT NULL, vnd integer NOT NULL DEFAULT 0, ghi text, loi text, tep text);
CREATE INDEX IF NOT EXISTS may_sx_luot_luc ON may_sx_luot (luc DESC);
INSERT INTO may_sx_luot (may, slug, kieu, ngay_dang, ok, vnd, ghi, loi, tep) VALUES (${q(b.may)}, ${q(b.slug)}, ${q(b.kieu)}, ${q(b.dangTu)}, ${ok}, ${Number(kq.vnd ?? 0)}, ${q(kq.ghi ?? null)}, ${q(loi)}, ${q(kq.video_url ?? kq.anh?.[0] ?? null)});`);
  } catch (e) { console.log(`⚠ không ghi được nhật ký lượt: ${String(e.message).split('\n')[0].slice(0, 120)}`); }
}

async function dungMot(b) {
  const ham = LAM[b.kieu];
  if (!b.kieu) throw new Error(`${b.slug}: nền '${b.nen}' chưa có dạng bài mặc định — khai dang.kieu_sx`);
  if (!ham) throw new Error(`${b.slug}: dạng '${b.kieu}' không có hàm trong sx-bai.mjs`);
  const de = { ...b, urlPhim: b.phim ? urlPhim(b.phim) : null };
  const kq = await ham(de);
  // ghi tệp vào sổ bài — KHÔNG đụng chữ bài (chữ do người/khâu viết lo, máy chỉ làm tệp)
  const dat = kq.video_url
    ? `video_url='${kq.video_url}'`
    : `anh='${JSON.stringify(kq.anh ?? [])}'::jsonb`;
  psql(`UPDATE xv_may_video SET ${dat}, xuat_luc=now(), updated_at=now() WHERE slug='${b.slug}';`);
  return kq;
}

const main = async () => {
  if (co('--tu-kiem')) {
    const a = (await import('node:assert')).strict;
    const dang = Object.keys(SO).filter((k) => !k.startsWith('_'));
    // MỘT ĐƯỜNG SẢN XUẤT: sổ và bảng hàm phải khớp cả hai chiều — thêm dạng mà quên một bên là đỏ ở đây
    for (const k of dang) a.ok(LAM[k], `dạng '${k}' có trong sổ kieu-sx.json nhưng THIẾU hàm trong sx-bai.mjs`);
    for (const k of Object.keys(LAM)) a.ok(dang.includes(k), `hàm '${k}' trong sx-bai.mjs nhưng THIẾU dòng trong sổ kieu-sx.json`);
    for (const k of dang) { const v = SO[k]; a.ok(v.ten && v.nen && v.may, `dạng '${k}' thiếu ten/nen/may trong sổ`); }
    a.equal(kieuMacDinh('fb_anh'), 'anh_doi_thuong'); a.equal(kieuMacDinh('facebook'), 'reel_canh9_free'); a.equal(kieuMacDinh('x'), null);
    // đọc cờ: cờ ĐẦU TIÊN cũng phải đọc được (chỉ số 0), cờ không có trả null, cờ đứng cuối không có giá trị trả null
    a.equal(doc(['--may', 'mia'], '--may'), 'mia'); a.equal(doc(['--xem', '--may', 'mia'], '--may'), 'mia');
    a.equal(doc(['--xem'], '--may'), null); a.equal(doc(['--may'], '--may'), null);
    // CHỌN CẢNH: câu thoại ĐÃ LỌT ngày 11/11/2026 phải bị chặn; chữ thường không bị chặn nhầm
    a.ok(MIET_THI.test("Oh my God... let's see this cripple eat shit!"), 'câu miệt thị người khuyết tật lọt 11/11 phải bị chặn');
    a.ok(!MIET_THI.test('a triple shot of espresso') && !MIET_THI.test('he still cannot stand on his own'), 'chữ thường không bị chặn nhầm');
    const rms = Array.from({ length: 100 }, (_, i) => (i === 50 ? 999 : 10)), chu = Array.from({ length: 100 }, (_, i) => ({ s: i, chu: `c${i}`, cam: i === 50 ? 'cripple' : null }));
    const uv = doanSach(rms, chu);
    a.ok(uv.length > 0 && uv.every((x) => x.bat_dau + 9 <= 50 || x.bat_dau > 50), 'không đoạn nào chứa giây dính từ cấm — kể cả khi giây đó to tiếng nhất');
    a.ok(uv.every((x, i) => uv.every((y, j) => i === j || Math.abs(x.bat_dau - y.bat_dau) >= 6)), 'các đoạn ứng viên cách nhau ≥ 6 giây');
    a.equal(doanSach(rms, chu.map((x) => ({ ...x, cam: 'x' }))).length, 0, 'mọi giây dính từ cấm → không có đoạn sạch (máy ném lỗi, không cắt bừa)');
    console.log(`sx-may: ${dang.length} dạng bài, sổ ↔ bảng hàm khớp · ${dang.length * 2 + 13}/${dang.length * 2 + 13} ok`);
    return;
  }
  const may = lay('--may'), slug = lay('--slug'), ngay = Number(lay('--ngay') ?? 3);
  if (!may && !slug) { console.error('cần --may <mã> hoặc --slug <slug> (hoặc --tu-kiem)'); process.exit(1); }
  let ds = canDung(may ?? '', ngay);
  if (slug) ds = ds.filter((x) => x.slug === slug);
  if (!ds.length) { console.log(`không có bài nào thiếu tệp tới hạn trong ${ngay} ngày`); return; }

  if (co('--xem')) {
    for (const b of ds) console.log(`→ ${b.dangTu} ${b.slug.padEnd(34)} ${b.nen.padEnd(9)} ${b.kieu ?? '(KHÔNG BIẾT DẠNG)'} · ${SO[b.kieu]?.vnd ?? '?'}₫ · ${b.huong || '(chưa có hướng)'}`);
    console.log(`tổng ước: ${ds.reduce((t, b) => t + (SO[b.kieu]?.vnd ?? 0), 0)}₫ cho ${ds.length} bài`);
    return;
  }

  let tien = 0, hong = 0;
  for (const b of ds) {
    try { const kq = await dungMot(b); tien += kq.vnd ?? 0; ghiLuot(b, true, kq); console.log(`✓ ${b.slug} (${b.kieu}) ${kq.vnd ?? 0}₫ — ${kq.ghi ?? ''}`); }
    catch (e) { hong++; const l = String(e.message).split('\n')[0].slice(0, 300); ghiLuot(b, false, {}, l); console.log(`✗ ${b.slug} (${b.kieu}): ${l.slice(0, 200)}`); }
  }
  console.log(`dựng ${ds.length - hong}/${ds.length} bài · ${tien}₫`);
  // nộp Phòng Nội dung chấm — máy đăng chỉ lấy bài DUYỆT
  try { execFileSync('ssh', [BOX, 'cd /opt/earns-marketing-os-v2/apps/cty && set -a; . /opt/earns-marketing-os-v2/.env.production; set +a; node worker/cham-dang.mjs --chay'], { encoding: 'utf8', timeout: 600_000 }); console.log('đã nộp Phòng Nội dung chấm'); }
  catch (e) { console.log(`⚠ chưa chấm được: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
};
main().catch((e) => { console.error(`sx-may: ${e.message}`); process.exit(1); });
