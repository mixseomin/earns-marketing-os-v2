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
//   node scripts/sx-may.mjs --het [--ngay 3]                MỌI máy có bài thiếu tệp tới hạn — lượt theo lịch của sổ việc nền cty gọi lệnh này
//                                                          (apps/cty/cong-ty/viec-nen.json › iMac:com.earns.may-san-xuat)
//
// VÌ SAO CHẠY Ở iMAC: dạng Reel dùng ffmpeg — luật nhà cấm dựng video trên box3. Dạng ảnh tự gọi sang box3 (khoá R2 ở đó).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { HOST_PHIM, LAM, LOI_VINH_VIEN, MIET_THI, doanSach, shq, taiTap } from './sx-bai.mjs';
import { nhapCty } from '../src/lib/xuong-video/cty.mjs';
const { loiChuPersona } = await nhapCty('worker/cham-dang.mjs');   // mã chấm của cty — repo riêng, nạp lúc chạy (tách 18/11/2026)

const BOX = 'root@167.233.241.16';
const D = path.dirname(new URL(import.meta.url).pathname);
const SO = JSON.parse(readFileSync(path.join(D, '..', 'kieu-sx.json'), 'utf8'));
const ag = process.argv.slice(2), co = (t) => ag.includes(t);
// `i >= 0` chứ KHÔNG phải `i > 0`: cờ đứng NGAY ĐẦU (node sx-may.mjs --may x) có chỉ số 0,
// viết `i > 0` thì đúng cái cờ đầu tiên luôn bị bỏ qua — hỏng lượt chạy đầu 11/11/2026.
const doc = (ag, k) => { const i = ag.indexOf(k); return i >= 0 ? ag[i + 1] ?? null : null; };
const lay = (k) => doc(ag, k);

/** psql trên box3 — chữ SQL đi qua tệp để không vướng dấu nháy (bài học 11/11/2026: nhồi SQL vào -c bị shell nuốt). */
// `-q`: chỉ in DỮ LIỆU, không in chữ báo lệnh (CREATE VIEW, ALTER TABLE, UPDATE 0…) — audit 11/11/2026: gộp CREATE VIEW + ALTER vào cùng
// lượt SELECT thì các chữ đó lọt vào kết quả, canDung đọc chúng như một bài và vỡ (padEnd của undefined).
// Tệp tạm MANG TÊN RIÊNG mỗi lần gọi (audit 11/11/2026: trước ghi chung /tmp/sx-tam.sql — hai lượt chạy cùng lúc, vd lịch tự chạy + con chạy tay,
// ghi đè SQL của nhau trước khi scp, lượt này chạy nhầm câu của lượt kia).
let soGoi = 0;
function psql(sql) {
  const ten = `sx-${process.pid}-${Date.now()}-${++soGoi}.sql`, cuc = `/tmp/${ten}`, t = `/tmp/${ten}`;
  writeFileSync(cuc, `SET client_min_messages TO warning;\n${sql}`);   // NOTICE "đã có, bỏ qua" của CREATE/ALTER IF NOT EXISTS không phải lỗi — đừng in ra nhật ký
  execFileSync('scp', ['-q', cuc, `${BOX}:${t}`], { timeout: 120_000 });
  return execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -qtAf ${t}`], { encoding: 'utf8', timeout: 300_000 });
}

/** Dạng bài mặc định suy từ NỀN khi bài chưa khai dang.kieu_sx — ĐỌC SỔ (kieu-sx.json › mac_dinh: true), không gõ lại trong mã.
 *  Audit 11/11/2026: mặc định từng nằm cứng ở đây trong khi tab Máy SX gõ nhãn riêng — đổi Reel mặc định sang bản FREE (anh 11/11/2026:
 *  bản FREE 236 lượt phát so với 22 của bản thường cùng cảnh) thì máy đổi mà trang vẫn ghi "Reel cắt cảnh 9s". Giờ một nguồn. */
const kieuMacDinh = (nen, so = SO) => Object.keys(so).find((k) => !k.startsWith('_') && so[k].nen === nen && so[k].mac_dinh) ?? null;

const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

/** MỘT ĐỊNH NGHĨA "BÀI CHỜ DỰNG" cho cả máy lẫn tab Máy SX (audit 11/11/2026: điều kiện này từng chép ở 3 nơi — đây, gom.ts và API tab —
 *  sửa một chỗ là lệch). View do máy tự tạo/cập nhật mỗi lượt, như bảng may_sx_luot; apps/web/src/lib/may-sx/gom.ts đọc đúng view này. */
const VIEW_CHO_DUNG = `CREATE OR REPLACE VIEW xv_bai_cho_dung AS
SELECT v.id, v.slug, m.id AS may_id, m.ma AS may, m.ten AS may_ten, m.chay, v.dang->>'dang_bai' AS nen, nullif(v.dang->>'dang_tu','') AS dang_tu,
  v.dang->>'kieu_sx' AS kieu_sx, v.dang->>'phim' AS phim, v.dang->>'y' AS huong, v.dang->>'prompt' AS prompt,
  coalesce(v.dang->>'y', v.dang->>'title', v.chu_de) AS ten, v.updated_at
FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id
WHERE v.da_dang = '{}'::jsonb AND NOT coalesce(v.luu_tru, false) AND v.video_url IS NULL AND jsonb_array_length(coalesce(v.anh, '[]'::jsonb)) = 0;`;

/** Bài CẦN DỰNG: đã có ngày đăng trong N ngày tới (view xv_bai_cho_dung). */
function canDung(may, ngay) {
  const r = psql(`${VIEW_CHO_DUNG}
${BANG_LUOT}
SELECT may||E'\\t'||slug||E'\\t'||coalesce(nen,'')||E'\\t'||dang_tu||E'\\t'||coalesce(kieu_sx,'')||E'\\t'||coalesce(phim,'')||E'\\t'||coalesce(huong,'')||E'\\t'||coalesce(prompt,'')
FROM xv_bai_cho_dung WHERE ${may ? `may=${q(may)}` : 'chay'} AND dang_tu IS NOT NULL
  AND dang_tu::date <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + ${Number(ngay)}
ORDER BY dang_tu;`);
  return r.split('\n').filter(Boolean).map((d) => {
    const [mayDong, slug, nen, dangTu, kieuSx, phim, y, prompt] = d.split('\t');
    return { slug, nen, dangTu, kieu: kieuSx || kieuMacDinh(nen), phim: phim ? Number(phim) : null, huong: y, prompt, may: mayDong };
  });
}

// ── LẤP KHO VIDEO (sổ kieu-sx.json › _kho) ────────────────────────────────────────────────────────────────────────────────────────
// Gốc 12/11/2026: kho video của các máy social chỉ được lấp khi có người tạo tin xin duyệt chi → 7 máy cạn kho, máy đăng ghi "Hết video đã dựng
// chưa đăng" trên mọi nền mà không ai được báo. Giờ mỗi lượt --het tự đếm và lấp, cộng dồn tiền dưới trần của sổ.
const KHO = SO._kho ?? null;
/** Máy lấp kho bằng lệnh riêng (sổ _kho.rieng, vd Front Porch --sinh-game 0₫) — không có thì --sinh-kho với giá vnd_de chung. */
const rieng = (may, k = KHO) => ({ lenh: '--sinh-kho', vnd_de: k.vnd_de, ...(k.rieng?.[may] ?? {}) });
// SỐ THIẾU = MỘT NGUỒN (anh 19/11/2026 "Thiếu thì sx chứ sao nữa" + "chỉ sx trước vài bài so với ngày lên lịch, không sx hàng loạt"):
// trước đây máy tự đếm ba kiểu — gộp mọi nền rồi bù lên len_toi 6 (astrolas còn 9 bài Substack nên Facebook:632 trống mà máy coi là đủ), nền link / poll
// bù cho đủ 7 ngày, còn Phòng Nội dung đếm từng nền 2 ngày và giao Khang (Khang chạm trần token → kho trống cả ngày). Nay chỉ đọc cty cham-dang.mjs --thieu
// (từng nền, đủ 2 ngày đăng theo trần nền) và làm ĐÚNG số đó. Loại nền đọc sổ nền đăng chung nen-dang.json.
const NEN_LOAI = Object.fromEntries(Object.entries(JSON.parse(readFileSync(path.join(D, '..', 'nen-dang.json'), 'utf8')).nen).map(([k, v]) => [k, v.loai]));
const loaiNen = (nen) => NEN_LOAI[String(nen).split(':')[0]] ?? 'video';
const DANG_LOAI = { link: 'bai-link', poll: 'binh-chon' };   // --sinh-kho --dang cho nền link / poll
/** Kế hoạch lấp kho. Thuần: rows = [{ma, nen, thieu}] của Phòng Nội dung. Máy trong sổ _kho: video → --sinh-kho (hoặc lệnh `rieng`), link / poll →
 *  --sinh-kho --dang, bài viết → sinh-bai.mjs; MỘT bộ cho mọi nền cùng loại nên n = nền thiếu nhiều nhất trong loại (không cộng). Ảnh, và mọi nền
 *  (trừ bài viết) của máy ngoài sổ không thuộc duong_rieng (vd AngleBrief) → ô kế hoạch (--sinh-de --nen). Máy thiếu nhiều trước; trần tiền cắt phần sau. */
function keHoachKho(rows, k = KHO, may = null) {
  const g = new Map();
  for (const r of rows) {
    if ((may && r.ma !== may) || !/^[a-z0-9-]+$/.test(r.ma) || !/^[a-z0-9_:]+$/.test(r.nen) || (k.duong_rieng ?? []).includes(r.ma)) continue;
    const l = loaiNen(r.nen), trong = k.may.includes(r.ma);
    // link / poll: --sinh-kho --dang cho MỌI máy (ô kế hoạch bai-link chưa có mẫu sinh đề — AngleBrief 19/11); ảnh + video của máy ngoài sổ: ô kế hoạch
    const loai = l === 'link' || l === 'poll' ? (rieng(r.ma, k).lenh === '--sinh-kho' ? l : null) : l === 'anh' || (!trong && l !== 'bai') ? 'o' : !trong ? null : l === 'bai' ? 'bai' : 'video';
    if (!loai) continue;
    const kh = `${r.ma}|${loai}`, x = g.get(kh) ?? { may: r.ma, loai, n: 0, nen: [] }; x.n = Math.max(x.n, r.thieu); x.nen.push(r.nen); g.set(kh, x);
  }
  const ra = []; let uoc = 0;
  for (const x of [...g.values()].sort((a, b) => b.n - a.n)) {
    const gia = giaMot(x, k); let n = x.n;
    if (gia > 0) n = Math.min(n, Math.floor((k.tran_vnd_luot - uoc) / gia)); if (n <= 0) continue;
    ra.push({ ...x, n, ...(DANG_LOAI[x.loai] ? { dang: DANG_LOAI[x.loai] } : {}) }); uoc += n * gia;
  }
  return ra;
}
const giaMot = (x, k = KHO) => (x.loai === 'bai' ? k.vnd_bai : x.loai === 'o' ? k.vnd_de : rieng(x.may, k).vnd_de);
const giaKho = (x, k = KHO) => x.n * giaMot(x, k);
/** Máy đi đường riêng (sổ _kho.duong_rieng) KHÔNG lấp được bằng --sinh-kho — nhưng Phòng Nội dung vẫn đếm thiếu từng nền.
 *  Trước 28/11/2026 keHoachKho lặng lẽ bỏ qua chúng nên `--may mia-calloway --xem` in "kho: mọi nền đủ bài 2 ngày đăng"
 *  trong khi cham-dang.mjs --thieu báo mia-calloway facebook thiếu 1: người trực đọc thấy đủ, không ai thêm đề, hôm sau thiếu bài.
 *  Nay đếm riêng và IN RA kèm lệnh lấp của sổ (_kho.rieng.<máy>.lenh) — cùng một nguồn thiếu, chỉ khác cách lấp. */
function khoRieng(rows, k = KHO, may = null) {
  const g = new Map();
  for (const r of rows) {
    if ((may && r.ma !== may) || !(k.duong_rieng ?? []).includes(r.ma) || !(Number(r.thieu) > 0) || !/^[a-z0-9-]+$/.test(r.ma)) continue;
    const x = g.get(r.ma) ?? { may: r.ma, n: 0, nen: [], lenh: rieng(r.ma, k).lenh }; x.n = Math.max(x.n, Number(r.thieu)); x.nen.push(r.nen); g.set(r.ma, x);
  }
  return [...g.values()].sort((a, b) => b.n - a.n);
}
/** Số thiếu từng nền — của Phòng Nội dung trên box3 (cty /opt/cty), không tự đếm lại ở đây. */
function thieuKho() {
  return JSON.parse(execFileSync('ssh', [BOX, 'cd /opt/cty && set -a; . /opt/earns-marketing-os-v2/.env.production; set +a; CTY_DATA_DIR=/var/lib/cty node worker/cham-dang.mjs --thieu'], { encoding: 'utf8', timeout: 120_000 }).trim().split('\n').pop());
}
/** Bài viết (Quora / Substack / Medium): máy viết puzzle-books sinh-bai.mjs chạy ngay ở iMac — Phòng Nội dung tự chấm, máy đăng tự lấy. */
function sinhBai(may, n) {
  return docTongBai(execFileSync(process.execPath, ['/Users/htuan/puzzle-books/scripts/sinh-bai.mjs', '--may', may, '--so', String(Number(n))], { encoding: 'utf8', timeout: 1_800_000, stdio: ['ignore', 'pipe', 'pipe'] }));
}
const docTongBai = (ra) => { const ok = ra.split('\n').filter((l) => /^✓ /.test(l)), vnd = [...ra.matchAll(/(\d+)₫\)/g)].reduce((t, m) => t + Number(m[1]), 0);
  return { so: ok.length, vnd, ...(ok.length ? {} : { loi: ra.split('\n').filter((l) => /^✗ /.test(l)).slice(-3).join(' · ').slice(0, 280) || ra.trim().split('\n').slice(-2).join(' · ').slice(0, 200) }) }; };
/** Ô kế hoạch → bài: --sinh-de một ngày trên box3 cho đúng các nền thiếu (trước 19/11 --sinh-de không lịch nào gọi — AngleBrief có ô mà không có bài). */
function sinhO(may, ngayD, nen, n) {
  const ra = execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts --may ${shq(may)} --sinh-de ${ngayD} --va-xuat --nen ${shq(nen.join(','))} --toi-da ${Number(n)} 2>&1`], { encoding: 'utf8', timeout: 1_800_000 });
  const t = /sinh đề [^:]+: (\d+) lượt mô hình, ([\d.,]+)₫/.exec(ra);
  return { so: ra.split('\n').filter((l) => /^✓ /.test(l)).length, vnd: t ? Number(t[2].replace(/[.,]/g, '')) : 0, ghi: ra.split('\n').filter((l) => /^[✓✗·] /.test(l)).slice(-4).join(' · ').slice(0, 300), loi: t ? null : ra.trim().split('\n').slice(-2).join(' · ').slice(0, 200) };
}
const ngayVN = (them = 0) => new Date(Date.now() + 7 * 3600e3 + them * 864e5).toISOString().slice(0, 10);
/** Chạy --sinh-kho trên box3 (dựng Cloudflare; sinhJson tự gác ngưỡng tiền), trả số đề + tiền thật đọc từ dòng tổng của lệnh. */
function sinhKho(may, n, dang = null) {
  const ra = execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts --may ${shq(may)} ${rieng(may).lenh} ${Number(n)}${dang ? ` --dang ${shq(dang)}` : ''} 2>&1`], { encoding: 'utf8', timeout: 1_800_000 });
  return docTongKho(ra);
}
// 0 đề mà không có lý do = mù (ratesbyroom 16/11/2026 "0/6 đề"): kèm các dòng ✗ / "· hết hook…" / "· … dừng lượt" vào loi để sổ may_sx_luot nói vì sao
const lyDoKho = (ra) => ra.split('\n').filter((l) => /^✗ |^· .*(hết hook|dừng)/.test(l)).slice(-3).join(' · ').slice(0, 280) || undefined;
const docTongKho = (ra) => { const m = /sinh (?:kho|game) [^:]+: (\d+)\/(\d+) (?:đề|video), ([\d.,]+)₫/.exec(ra); return m ? { so: Number(m[1]), xin: Number(m[2]), vnd: Number(m[3].replace(/[.,]/g, '')), ...(Number(m[1]) ? {} : { loi: lyDoKho(ra) && `0/${m[2]} đề: ${lyDoKho(ra)}` }) } :{ so: 0, xin: 0, vnd: 0, loi: ra.trim().split('\n').slice(-2).join(' · ').slice(0, 200) }; };

/** Link trang phim để tải tập (thư viện Ethopex, schema `etp` — KHÔNG phải public). */
function urlPhim(id) {
  const r = psql(`SELECT coalesce(url,'') FROM etp.thu_vien_phim WHERE content_id=${Number(id)} LIMIT 1;`).trim();
  return r || null;
}

/** NHẬT KÝ LƯỢT DỰNG → bảng may_sx_luot (tab Máy SX trên mos2 đọc). Bảng do CHÍNH MÁY tự tạo: migration dùng chung của monorepo
 *  (packages/db) không thuộc app này. Ghi hỏng thì chỉ cảnh báo, không làm hỏng lượt dựng.
 *  GHI HAI LẦN (audit 11/11/2026): một dòng `trang_thai='dang'` NGAY KHI BẮT ĐẦU, rồi cập nhật 'xong' / 'hong' khi kết thúc. Trước chỉ ghi lúc xong,
 *  nên lượt 18:00 bị ngắt giữa chừng (phiên đóng) không để lại vết nào — clip đã dựng nằm trên iMac, bài không có tệp, sổ trống. Giờ dòng 'dang'
 *  mà quá 40 phút chưa cập nhật = lượt bị ngắt, tab Máy SX hiện "mất dấu". */
const BANG_LUOT = `CREATE TABLE IF NOT EXISTS may_sx_luot (id bigserial PRIMARY KEY, luc timestamptz NOT NULL DEFAULT now(), may text NOT NULL, slug text NOT NULL,
  kieu text, ngay_dang text, ok boolean NOT NULL, vnd integer NOT NULL DEFAULT 0, ghi text, loi text, tep text);
CREATE INDEX IF NOT EXISTS may_sx_luot_luc ON may_sx_luot (luc DESC);
ALTER TABLE may_sx_luot ADD COLUMN IF NOT EXISTS trang_thai text, ADD COLUMN IF NOT EXISTS xong_luc timestamptz;
UPDATE may_sx_luot SET trang_thai = CASE WHEN ok THEN 'xong' ELSE 'hong' END WHERE trang_thai IS NULL;`;
function moLuot(b) {
  try { return Number(psql(`${BANG_LUOT}
INSERT INTO may_sx_luot (may, slug, kieu, ngay_dang, ok, trang_thai) VALUES (${q(b.may)}, ${q(b.slug)}, ${q(b.kieu)}, ${q(b.dangTu)}, false, 'dang') RETURNING id;`).trim().split('\n').filter((x) => /^\d+$/.test(x.trim())).pop()) || null; }
  catch (e) { console.log(`⚠ không mở được dòng nhật ký: ${String(e.message).split('\n')[0].slice(0, 120)}`); return null; }
}
function dongLuot(id, b, ok, kq = {}, loi = null) {
  const gt = `ok=${ok}, trang_thai=${q(ok ? 'xong' : 'hong')}, xong_luc=now(), vnd=${Number(kq.vnd ?? 0)}, ghi=${q(kq.ghi ?? null)}, loi=${q(loi)}, tep=${q(kq.video_url ?? kq.anh?.[0] ?? null)}`;
  try {
    psql(id ? `UPDATE may_sx_luot SET ${gt} WHERE id=${Number(id)};`
      : `${BANG_LUOT}\nINSERT INTO may_sx_luot (may, slug, kieu, ngay_dang, ok, trang_thai, xong_luc, vnd, ghi, loi, tep) VALUES (${q(b.may)}, ${q(b.slug)}, ${q(b.kieu)}, ${q(b.dangTu)}, ${ok}, ${q(ok ? 'xong' : 'hong')}, now(), ${Number(kq.vnd ?? 0)}, ${q(kq.ghi ?? null)}, ${q(loi)}, ${q(kq.video_url ?? kq.anh?.[0] ?? null)});`);
  } catch (e) { console.log(`⚠ không ghi được nhật ký lượt: ${String(e.message).split('\n')[0].slice(0, 120)}`); }
}

/** [title, description] của bài persona (bài thường trả [] → loiChuPersona bỏ qua). Đọc base64 để tab / xuống dòng trong chữ không làm vỡ dòng psql. */
function chuBai(slug) {
  const r = psql(`SELECT translate(encode(convert_to(coalesce(dang->>'title',''),'UTF8'),'base64'),E'\\n','')||E'\\t'||translate(encode(convert_to(coalesce(dang->>'description',''),'UTF8'),'base64'),E'\\n','') FROM xv_may_video WHERE slug=${q(slug)} AND (dang->>'persona')::boolean IS TRUE;`).trim();
  if (!r) return ['', ''];
  return r.split('\t').map((x) => Buffer.from(x, 'base64').toString('utf8'));
}

async function dungMot(b) {
  const ham = LAM[b.kieu];
  if (!b.kieu) throw new Error(`${b.slug}: nền '${b.nen}' chưa có dạng bài mặc định — khai dang.kieu_sx`);
  if (!ham) throw new Error(`${b.slug}: dạng '${b.kieu}' không có hàm trong sx-bai.mjs`);
  // CHỮ BÀI PERSONA chặn TRƯỚC khi dựng, cùng luật phòng chấm (loiChuPersona): 11/11/2026 ba bài Mia dài 311–316 ký tự / có "limited time" vẫn
  // dựng ảnh rồi mới bị SỬA LẠI. Lỗi ném ra → lượt ghi 'hong' → việc về Khang sửa chữ, không tốn tiền dựng bài chắc chắn bị chặn.
  const cl = loiChuPersona(...chuBai(b.slug)); if (cl.length) throw new Error(`${b.slug}: chữ bài persona sẽ bị Phòng Nội dung chặn: ${cl.join(' · ')} — sửa dang.title / description trước khi dựng`);
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
    // MỖI NỀN TỐI ĐA MỘT dạng mặc định — hai dạng cùng khai mac_dinh thì máy chọn theo thứ tự khoá trong tệp, tức là chọn ngẫu nhiên theo người sửa sổ
    for (const nen of new Set(dang.map((k) => SO[k].nen))) a.ok(dang.filter((k) => SO[k].nen === nen && SO[k].mac_dinh).length <= 1, `nền '${nen}' có hơn một dạng mac_dinh trong sổ`);
    a.equal(kieuMacDinh('fb_anh'), 'anh_doi_thuong'); a.equal(kieuMacDinh('facebook'), 'reel_canh9_free'); a.equal(kieuMacDinh('x'), null);
    a.equal(kieuMacDinh('facebook', { a: { nen: 'facebook' }, b: { nen: 'facebook', mac_dinh: true } }), 'b', 'đọc mặc định từ SỔ, không từ mã');
    a.equal(q("o'neil"), "'o''neil'"); a.equal(q(null), 'NULL');
    // shq: chuỗi đi qua shell THẬT phải ra nguyên vẹn ($, `, nháy đơn/kép) — prompt ảnh đi đường này sang box3
    for (const x of ["person's lap $HOME `id` \"q\" \\n", '--prompt=a  b']) a.equal(execFileSync('sh', ['-c', `printf %s ${shq(x)}`], { encoding: 'utf8' }), x, `shq làm hỏng chuỗi: ${x}`);
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
    // chữ persona: đúng 3 bài Mia bị chặn 11/11 (tiêu đề + chữ đăng > 300, "limited time") phải bị chặn trước khi dựng; chữ ngắn sạch thì qua
    a.ok(loiChuPersona('his family made her sign a paper before the wedding', 'his family made her sign a paper before the wedding saying she would leave with nothing. she signed it in front of everyone. what none of them checked was whose name was already on the building. it is free to watch for a limited time, i put it in the comments').length === 2, 'bài Mia 15/11 phải dính cả trần lẫn limited time');
    a.equal(loiChuPersona('they kicked the man sleeping behind the restaurant', 'one phone call later he owns the place.').length, 0);
    // LẤP KHO theo số thiếu Phòng Nội dung: nhóm theo loại nền, n = nền thiếu nhiều nhất của loại (không cộng), máy thiếu nhiều trước, trần tiền cắt phần sau
    const K = { may: ['a', 'b', 'c'], duong_rieng: ['y'], vnd_de: 45, vnd_bai: 60, tran_vnd_luot: 400 };
    const R = [{ ma: 'b', nen: 'facebook:632', thieu: 2 }, { ma: 'b', nen: 'youtube', thieu: 1 }, { ma: 'b', nen: 'quora', thieu: 1 }, { ma: 'b', nen: 'fb_link', thieu: 2 },
      { ma: 'a', nen: 'youtube', thieu: 6 }, { ma: 'y', nen: 'youtube', thieu: 2 }, { ma: 'z', nen: 'fb_anh', thieu: 1 }, { ma: 'z', nen: 'fb_link', thieu: 2 }, { ma: 'z', nen: 'quora', thieu: 3 }];
    const kh = keHoachKho(R, K);
    a.deepEqual(kh.map((x) => [x.may, x.loai, x.n]), [['a', 'video', 6], ['b', 'video', 2]], 'máy thiếu nhiều trước; b video = max(2,1); phần sau bị trần 400₫ cắt');
    a.ok(kh.reduce((t, x) => t + giaKho(x, K), 0) <= K.tran_vnd_luot, 'tổng ước không vượt trần');
    const kh2 = keHoachKho(R, { ...K, tran_vnd_luot: 4000 });
    a.deepEqual(kh2.filter((x) => x.may === 'b').map((x) => [x.loai, x.n, x.dang ?? '']), [['video', 2, ''], ['link', 2, 'bai-link'], ['bai', 1, '']], 'máy trong sổ: video + link (--dang bai-link) + bài viết');
    a.deepEqual(kh2.filter((x) => x.may === 'z').map((x) => [x.loai, x.nen.join(','), x.n]), [['link', 'fb_link', 2], ['o', 'fb_anh', 1]], 'máy ngoài sổ: link qua --sinh-kho --dang, ảnh qua ô kế hoạch, bài viết bỏ');
    a.ok(!kh2.some((x) => x.may === 'y'), 'máy đi đường riêng (kênh lịch sử, Mia) không sinh');
    // ...nhưng KHÔNG được lặng im: thiếu của máy đường riêng vẫn hiện ra kèm lệnh lấp của sổ (28/11/2026: Mia thiếu 1 bài mà --xem in "mọi nền đủ bài")
    a.deepEqual(khoRieng(R, K).map((x) => [x.may, x.n, x.lenh]), [['y', 2, '--sinh-kho']], 'máy đường riêng: đếm thiếu + in lệnh lấp, không ẩn');
    a.deepEqual(khoRieng([{ ma: 'y', nen: 'youtube', thieu: 0 }], K), [], 'máy đường riêng đủ bài thì không hiện');
    a.deepEqual(khoRieng([{ ma: 'y', nen: 'youtube', thieu: 1 }], K, 'a'), [], 'lọc đúng máy khi --may');
    a.equal(keHoachKho([], K).length, 0, 'không thiếu thì không làm gì');
    a.deepEqual(docTongBai('✓ quora-1 (m, 33₫) → x\n✗ viết bài góc #2: lỗi (0₫)\n✓ quora-3 (m, 30₫) → y'), { so: 2, vnd: 63 });
    a.ok(docTongBai('✗ viết bài góc #2: hết câu hỏi (0₫)').loi.includes('hết câu hỏi'), '0 bài phải kèm lý do');
    a.ok(KHO.duong_rieng.includes('yesterdays-news-tonight') && KHO.duong_rieng.includes('mia-calloway'), 'sổ: kênh lịch sử + Mia đi đường riêng');
    // NGUỒN PHIM: hai danh sách site phải TRÙNG nhau, lệch là một bên cho qua còn bên kia chặn (hoặc ngược lại) — 27/11/2026 mia-calloway chỉ nhận
    // "tai-tap.py không lấy được tập nào của phim 219774" mà không biết nguồn flickreels; nay báo rõ nguồn + không thử lần hai.
    const HOST_MAY = [...readFileSync(path.join(D, '..', 'src', 'lib', 'xuong-video', 'phim-tai.ts'), 'utf8').match(/HOST_PHIM\s*=\s*\[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    a.deepEqual(HOST_PHIM, HOST_MAY, 'HOST_PHIM ở sx-bai.mjs và phim-tai.ts phải trùng');
    try { taiTap(219774, 'https://www.flickreels.net/playlist/called-a-jinx/14928/episode-1'); a.ok(false, 'nguồn flickreels phải bị chặn ngay'); } catch (e) { a.ok(e.message.includes(LOI_VINH_VIEN) && /flickreels\.net/.test(e.message), 'nguồn phim lạ phải báo LỖI VĨNH VIỄN + tên nguồn, không đi tải'); }
    // MỌI máy đi đường riêng PHẢI khai lệnh lấp kho riêng, không có là may-dung.mts chỉ in câu "chưa khai" (24/11/2026: Mia thiếu 1 bài facebook).
    // giochap-van-khan từng được miễn với lý do "Phòng Nội dung không xếp việc kho|" — SAI: cham-dang.mjs chỉ bỏ qua máy trong _kho.may, còn duong_rieng
    // vẫn nhận việc kho|, nên máy đó kẹt cứng ở câu "chưa khai" (25/11/2026). Nay khai đủ lệnh thật cho cả ba.
    for (const mrieng of KHO.duong_rieng) a.ok(typeof KHO.rieng?.[mrieng]?.lenh === 'string' && KHO.rieng[mrieng].lenh.length > 10, `sổ _kho.rieng.${mrieng}.lenh: lệnh lấp kho riêng phải có trong sổ`);
    a.ok(KHO && KHO.tran_vnd_luot < 5000 && KHO.may.length && !KHO.may.includes('mia-calloway'), 'sổ _kho: trần dưới ngưỡng tự chạy 5.000₫, Mia đi đường lịch bài');
    a.deepEqual(docTongKho('✓ #1 top-n → x (26₫)\nsinh kho militarycalc: 5/6 đề, 1.150₫'), { so: 5, xin: 6, vnd: 1150 });
    a.ok(docTongKho('✗ #9 top-n: hook trùng\n· hết hook QC chưa dùng (3 hook đều đã có bài chờ đăng) — dừng lượt\nsinh kho r: 0/6 đề, 0₫').loi.includes('hết hook'), '0 đề phải kèm lý do');
    // máy lấp bằng lệnh riêng 0₫ (Front Porch --sinh-game): trần tiền đã chạm vẫn lấp được; đọc đúng dòng tổng của --sinh-game
    const K2 = { ...K, may: ['a', 'g'], rieng: { g: { lenh: '--sinh-game', vnd_de: 0 } } };
    a.deepEqual(keHoachKho([{ ma: 'a', nen: 'youtube', thieu: 9 }, { ma: 'g', nen: 'youtube', thieu: 3 }, { ma: 'g', nen: 'fb_link', thieu: 2 }], K2).map((x) => [x.may, x.loai, x.n]), [['a', 'video', 8], ['g', 'video', 3]], 'máy 0₫ không bị trần cắt; máy lệnh riêng không lấp link bằng --sinh-kho');
    a.equal(rieng('g', K2).lenh, '--sinh-game'); a.equal(rieng('b', K2).lenh, '--sinh-kho');
    a.deepEqual(docTongKho('✓ game-1-apple\nsinh game front-porch-only-one: 4/5 video, 0₫'), { so: 4, xin: 5, vnd: 0 });
    a.ok(KHO.may.includes('front-porch-only-one') && rieng('front-porch-only-one').lenh === '--sinh-game', 'sổ: Front Porch lấp kho bằng --sinh-game');
    a.equal(docTongKho('Error: mẫu lạ van-khan-ngoai').so, 0); a.ok(docTongKho('Error: mẫu lạ van-khan-ngoai').loi.includes('mẫu lạ'), 'lệnh hỏng không có dòng tổng → báo lỗi, không coi là xong');
    console.log(`sx-may: ${dang.length} dạng bài, sổ ↔ bảng hàm khớp · ${dang.length * 3 + 17}/${dang.length * 3 + 17} ok`);
    return;
  }
  const may = lay('--may'), slug = lay('--slug'), ngay = Number(lay('--ngay') ?? 3);
  if (!may && !slug && !co('--het')) { console.error('cần --may <mã> | --slug <slug> | --het (hoặc --tu-kiem)'); process.exit(1); }
  // --het và --slug đọc mọi máy đang chạy (may = null); --may chỉ một máy
  let ds = canDung(may, ngay);
  if (slug) ds = ds.filter((x) => x.slug === slug);
  if (!ds.length) console.log(`không có bài nào thiếu tệp tới hạn trong ${ngay} ngày`);
  // kho chỉ lấp ở lượt máy (--het / --may), không ở --slug (dựng đúng một bài)
  const thieu = KHO && !slug ? thieuKho() : [];
  const kho = thieu.length ? keHoachKho(thieu, KHO, may) : [];
  const rieng2 = thieu.length ? khoRieng(thieu, KHO, may) : [];

  if (co('--xem')) {
    for (const b of ds) console.log(`→ ${b.dangTu} ${b.slug.padEnd(34)} ${b.nen.padEnd(9)} ${b.kieu ?? '(KHÔNG BIẾT DẠNG)'} · ${SO[b.kieu]?.vnd ?? '?'}₫ · ${b.huong || '(chưa có hướng)'}`);
    if (ds.length) console.log(`tổng ước: ${ds.reduce((t, b) => t + (SO[b.kieu]?.vnd ?? 0), 0)}₫ cho ${ds.length} bài`);
    for (const k of kho) console.log(`→ kho ${k.may.padEnd(28)} thiếu ${k.n} ở ${k.nen.join(', ')} → ${k.loai === 'bai' ? 'sinh-bai.mjs' : k.loai === 'o' ? `--sinh-de ${ngayVN()}…${ngayVN(ngay - 1)} (ô kế hoạch)` : `${rieng(k.may).lenh} ${k.n}${k.dang ? ` --dang ${k.dang}` : ''}`} · ước ${giaKho(k)}₫`);
    // máy đường riêng: máy KHÔNG lấp tự động (thêm đề vào tệp nguồn của máy rồi --slug) — in để người trực biết mà làm, không lặng im "đủ"
    for (const k of rieng2) console.log(`→ kho ${k.may.padEnd(28)} thiếu ${k.n} ở ${k.nen.join(', ')} · đường riêng, máy không tự lấp → ${k.lenh}`);
    if (KHO && !slug) console.log(kho.length || rieng2.length ? `kho: ước ${kho.reduce((t, k) => t + giaKho(k), 0)}₫ (trần lượt ${KHO.tran_vnd_luot}₫)${rieng2.length ? ` · ${rieng2.length} máy đường riêng phải thêm đề tay` : ''}` : 'kho: mọi nền đủ bài 2 ngày đăng');
    return;
  }
  if (!ds.length && !kho.length) return;

  let tien = 0, hong = 0;
  for (const b of ds) {
    const id = moLuot(b);
    // THỬ LẠI MỘT LẦN: lỗi mạng / R2 / ssh chập chờn thường qua ở lần hai (Reel 13₫, ảnh 65₫). Vẫn hỏng thì ghi 'hong' — Phòng Nội dung xếp việc
    // `social:sx|<máy>` cho Khang (cham-dang.mjs › xepKhang) sửa gốc rồi dựng lại; không ai phải mở tab mới biết.
    // LỖI VĨNH VIỄN (nguồn phim sai, chữ persona sai…) thì KHÔNG thử lại: lần hai chắc chắn hỏng y hệt, chỉ tốn thời gian và làm log khó đọc.
    const thu2 = async () => { try { return await dungMot(b); } catch (e) { if (String(e.message).includes(LOI_VINH_VIEN)) throw e; console.log(`↻ ${b.slug}: thử lại (${String(e.message).split('\n')[0].slice(0, 120)})`); return dungMot(b); } };
    try { const kq = await thu2(); tien += kq.vnd ?? 0; dongLuot(id, b, true, kq); console.log(`✓ ${b.slug} (${b.kieu}) ${kq.vnd ?? 0}₫ — ${kq.ghi ?? ''}`); }
    catch (e) { hong++; const l = String(e.message).split('\n')[0].slice(0, 300); dongLuot(id, b, false, {}, l); console.log(`✗ ${b.slug} (${b.kieu}): ${l.slice(0, 200)}`); }
  }
  if (ds.length) console.log(`dựng ${ds.length - hong}/${ds.length} bài · ${tien}₫`);
  // lấp kho: trần tính trên tiền THẬT cộng dồn cả lượt (bài lịch + kho), không phải trên ước
  for (const k of kho) {
    if (tien + giaKho(k) > KHO.tran_vnd_luot) { console.log(`· kho ${k.may}: dừng — cộng dồn ${tien}₫ sắp chạm trần ${KHO.tran_vnd_luot}₫`); break; }
    if (k.loai === 'o') {   // ô kế hoạch: từng ngày trong tầm --ngay, dừng khi đủ số thiếu
      let con = k.n;
      for (let d = 0; d < ngay && con > 0; d++) {
        const b = { may: k.may, slug: `ke-hoach:${k.may}:${ngayVN(d)}`, kieu: 'sinh_de', dangTu: ngayVN(d) }, id = moLuot(b);
        try { const r = sinhO(k.may, ngayVN(d), k.nen, con); tien += r.vnd; con -= r.so;
          if (r.loi) { hong++; dongLuot(id, b, false, { vnd: r.vnd }, `sinh đề ${k.may} ${ngayVN(d)} hỏng: ${r.loi}`); console.log(`✗ ô ${k.may} ${ngayVN(d)}: ${r.loi}`); }
          else { dongLuot(id, b, true, { vnd: r.vnd, ghi: `+${r.so} bài · ${r.ghi}` }); console.log(`${r.so ? '✓' : '·'} ô ${k.may} ${ngayVN(d)}: +${r.so} bài · ${r.vnd}₫${r.so ? '' : ` (${r.ghi})`}`); } }
        catch (e) { hong++; const l = `sinh đề ${k.may} ${ngayVN(d)} hỏng (mã ${e.status ?? e.signal}): ${String(e.stdout || e.message).trim().split('\n').slice(-3).join(' · ').slice(-400)}`; dongLuot(id, b, false, {}, l); console.log(`✗ ${l}`); }
      }
      continue;
    }
    // một dòng sổ lượt `kho:<máy>` — tab Máy SX hiện, hỏng thì Phòng Nội dung xếp việc social:sx|<máy> cho Khang (cham-dang.mjs › xepKhang)
    const b = { may: k.may, slug: k.loai === 'bai' ? `kho:${k.may}:bai` : `kho:${k.may}${k.dang ? `:${k.dang}` : ''}`, kieu: k.loai === 'bai' ? 'sinh_bai' : k.dang ? 'sinh_kho_link' : 'sinh_kho', dangTu: null }, id = moLuot(b);
    try {
      const r = k.loai === 'bai' ? sinhBai(k.may, k.n) : sinhKho(k.may, k.n, k.dang ?? null); tien += r.vnd;
      if (r.loi || !r.so) { hong++; const l = `sinh ${k.loai === 'bai' ? 'bài viết' : 'kho'} ${k.may} hỏng: ${r.loi ?? `0/${r.xin} đề`}`; dongLuot(id, b, false, { vnd: r.vnd }, l); console.log(`✗ ${l}`); }
      else { const nhan = k.loai === 'bai' ? ' bài viết' : k.dang === 'binh-chon' ? ' bài bình chọn' : k.dang ? ' bài link' : '', ghi = `thiếu ${k.n} (${k.nen.join(', ')}) → +${r.so}${r.xin ? `/${r.xin}` : ''}${nhan || ' đề video'}`; dongLuot(id, b, true, { vnd: r.vnd, ghi }); console.log(`✓ kho ${k.may}: ${ghi} · ${r.vnd}₫`); }
    } catch (e) {
      // e.message dòng đầu chỉ là câu lệnh — nguyên nhân thật nằm ở mã thoát + đuôi stdout/stderr (lượt #42 14/11 mất hẳn lý do)
      const duoi = String(e.stdout || e.stderr || '').trim().split('\n').slice(-4).join(' · ');
      hong++; const l = `sinh kho ${k.may} hỏng (${e.signal ? `bị ngắt ${e.signal}` : `mã ${e.status}`}): ${(duoi || String(e.message).split('\n')[0]).slice(-500)}`; dongLuot(id, b, false, {}, l); console.log(`✗ ${l}`); }
  }
  if (kho.length) console.log(`cả lượt: ${tien}₫`);
  // nộp Phòng Nội dung chấm — máy đăng chỉ lấy bài DUYỆT
  try { execFileSync('ssh', [BOX, 'cd /opt/cty && set -a; . /opt/earns-marketing-os-v2/.env.production; set +a; CTY_DATA_DIR=/var/lib/cty node worker/cham-dang.mjs --chay'], { encoding: 'utf8', timeout: 600_000 }); console.log('đã nộp Phòng Nội dung chấm'); }
  catch (e) { console.log(`⚠ chưa chấm được: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
};
main().catch((e) => { console.error(`sx-may: ${e.message}`); process.exit(1); });
