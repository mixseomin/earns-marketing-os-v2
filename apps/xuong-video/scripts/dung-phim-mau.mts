// Dựng MỘT phim quảng cáo từ hồ sơ mẫu (mau/<ten>.json): phim + mục 0 (sản phẩm, QC mẫu) + anchor + tập → Claude viết kịch bản →
// tách cảnh bám mẫu → bài đăng kèm. CHỈ gọi Claude (chữ, vài cent); không sinh ảnh/video (tốn tiền — bấm tay trên studio khi anh chốt).
// Chạy trên box3 (có DB + ANTHROPIC_API_KEY):
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/dung-phim-mau.mts mau/jett-husband.json [--claude]
// MẶC ĐỊNH 0đ: chỉ tạo phim/anchor/tập/QC mẫu, KHÔNG gọi Claude. Muốn Claude viết kịch bản + tách cảnh + bài đăng (≈ $1,1 cho 28 shot)
// thì thêm --claude — và chỉ khi anh bảo chạy (09/10/2026: chạy không hỏi, anh chửi). Chạy lại cùng tệp = tạo phim MỚI (không đè).
// --phim=<id> = chạy TIẾP trên phim đã tạo (đọc kinh thánh + anchor + tập 1 từ DB; có kịch bản rồi thì không viết lại) — dùng khi một bước lỗi giữa chừng.
// --viet-lai  = (kèm --phim) bỏ kịch bản cũ, viết lại từ đầu theo kinh thánh hiện tại trong DB (vd vừa đổi ngôn ngữ phim) — cũng TỐN TIỀN như lượt đầu.
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { vietKichBan, tachCanh, vietBaiDang } from '../src/lib/xuong-video/claude';
import { luuCanhTach } from '../src/lib/xuong-video/luu-canh';
import { boVaoThungRac } from '../src/lib/xuong-video/thung-rac';
import { dsKhuon, taKhuon, ghiKhuonTuCanh, ghiKhuonTuMau } from '../src/lib/xuong-video/khuon-shot';
import { docKinhThanh, giaChuCents, giayMau, type KinhThanh, type LoaiNhanVat, type NhanVat, type MauQc } from '../src/lib/xuong-video/kieu';

type HoSo = {
  project: string; ten: string; mo_ta: string; kinh_thanh: KinhThanh;
  nhan_vat: { loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref?: string[]; giong?: string }[];
  tap: { ten: string; brief: string };
};
const tep = process.argv[2]; const chiTao = !process.argv.includes('--claude');
if (!tep) { console.error('thiếu đường dẫn hồ sơ json'); process.exit(1); }
const hs = JSON.parse(readFileSync(tep, 'utf8')) as HoSo;
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
type Row = Record<string, unknown>;

const docMau = () => { const m = hs.kinh_thanh.qc?.mau as MauQc | undefined; return { mau: m, thoiLuong: m?.shots?.length ? giayMau(m) : 30 }; };
let { mau, thoiLuong } = docMau();
const tiep = Number((process.argv.find((a) => a.startsWith('--phim=')) ?? '').split('=')[1] || 0);
const vietLai = process.argv.includes('--viet-lai');
let phimId: number; let tapId: number; let kichBanCu = '';
const nhanVat: NhanVat[] = [];
if (tiep) {
  phimId = tiep;
  const nv = (await db.execute(sql`SELECT id, loai, ten, mo_ta, anh_ref, giong FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[];
  for (const r of nv) nhanVat.push({ id: Number(r.id), phim_id: phimId, loai: String(r.loai) as LoaiNhanVat, ten: String(r.ten), mo_ta: String(r.mo_ta), anh_ref: (r.anh_ref as string[]) ?? [], giong: String(r.giong ?? ''), bien_the: [] } as NhanVat);
  const t = (await db.execute(sql`SELECT id, kich_ban FROM xv_tap WHERE phim_id = ${phimId} ORDER BY so LIMIT 1`)) as unknown as Row[];
  if (!t[0]) { console.error('phim chưa có tập'); process.exit(1); }
  tapId = Number(t[0].id); kichBanCu = vietLai ? '' : String(t[0].kich_ban ?? '');
  const p = (await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  if (p[0]?.kinh_thanh) { hs.kinh_thanh = p[0].kinh_thanh as KinhThanh; ({ mau, thoiLuong } = docMau()); }   // kinh thánh THẬT của phim (đã sửa trên studio/SQL), không lấy từ tệp mẫu
  console.log(`chạy tiếp phim #${phimId} · tập #${tapId} · ${nhanVat.length} anchor · ngôn ngữ ${hs.kinh_thanh.ngon_ngu ?? 'vi'}${kichBanCu ? ' · đã có kịch bản' : vietLai ? ' · viết lại kịch bản' : ''}`);
} else {
  const p = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh) VALUES (${hs.project}, ${hs.ten}, 'quang_cao', ${hs.mo_ta}, ${JSON.stringify(hs.kinh_thanh)}::jsonb) RETURNING id`)) as unknown as Row[];
  phimId = Number(p[0]!.id);
  console.log(`phim #${phimId} · ${hs.ten}`);
  for (const v of hs.nhan_vat) {
    const r = (await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, giong) VALUES (${phimId}, ${v.loai}, ${v.ten}, ${v.mo_ta}, ${JSON.stringify(v.anh_ref ?? [])}::jsonb, ${v.giong ?? ''}) RETURNING id`)) as unknown as Row[];
    nhanVat.push({ id: Number(r[0]!.id), phim_id: phimId, loai: v.loai, ten: v.ten, mo_ta: v.mo_ta, anh_ref: v.anh_ref ?? [], giong: v.giong ?? '', bien_the: [] } as NhanVat);
    console.log(`  anchor #${r[0]!.id} [${v.loai}] ${v.ten}${v.anh_ref?.length ? ` · ${v.anh_ref.length} ảnh` : ''}`);
  }
  const t = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, brief, thoi_luong_s) VALUES (${phimId}, 1, ${hs.tap.ten}, ${hs.tap.brief}, ${thoiLuong}) RETURNING id`)) as unknown as Row[];
  tapId = Number(t[0]!.id);
  console.log(`  tập #${tapId} · ${hs.tap.ten} · ${thoiLuong}s${mau?.shots?.length ? ` · QC mẫu ${mau.shots.length} shot` : ''}`);
}
const tenSp = hs.kinh_thanh.qc?.ten ?? '';
if (mau?.shots?.length && !tiep) console.log(`  thư viện khuôn: +${await ghiKhuonTuMau(db, mau.shots, nhanVat, tenSp, `QC mẫu · ${mau.nguon.slice(0, 60)}`, phimId)} khuôn mới từ mẫu`);
if (chiTao) { console.log('dừng ở đây (0đ). Gọi Claude viết kịch bản + tách cảnh + bài đăng: thêm --claude (≈ $1,1 / 28 shot) khi anh duyệt.'); process.exit(0); }

const ghiJob = async (nhan: string, r: { model?: string; tokens?: { in: number; out: number } }) => {
  if (!r.model || !r.tokens) return;
  const gia = giaChuCents(r.model, r.tokens.in, r.tokens.out);
  await db.execute(sql`INSERT INTO xv_job (phim_id, nhan, loai, provider, model, trang_thai, chi_phi_cents, tokens_in, tokens_out)
    VALUES (${phimId}, ${nhan}, 'chu', 'anthropic', ${r.model}, 'xong', ${Math.round(gia * 100) / 100}, ${r.tokens.in}, ${r.tokens.out})`);
  console.log(`  ${nhan}: ${r.tokens.in}/${r.tokens.out} tokens ≈ ${(gia / 100).toFixed(3)}$`);
};
const kt = docKinhThanh(hs.kinh_thanh);
let kichBan = kichBanCu;
if (!kichBan) {
  const kb = await vietKichBan({ loai: 'quang_cao', kinhThanh: kt, nhanVat, brief: hs.tap.brief, thoiLuongS: thoiLuong });
  if (!kb.ok) { console.error('viết kịch bản lỗi:', kb.loi); process.exit(1); }
  await ghiJob('Viết kịch bản · tập 1', kb);
  await db.execute(sql`UPDATE xv_tap SET kich_ban = ${kb.kichBan}, updated_at = now() WHERE id = ${tapId}`);
  kichBan = kb.kichBan;
}
const tc = await tachCanh({ loai: 'quang_cao', kinhThanh: kt, nhanVat, kichBan, soCanh: 0, thoiLuongS: thoiLuong, khuon: taKhuon(await dsKhuon(db, { toiDa: 60 })) });
if (!tc.ok) { console.error('tách cảnh lỗi:', tc.loi); process.exit(1); }
await ghiJob('Tách cảnh · tập 1 (bám QC mẫu)', tc);
// --viet-lai = thay cả bộ shot: shot cũ đã có keyframe cũng vào thùng rác (luuCanhTach chỉ dọn shot nháp), kẻo tập có 60 shot (09/10/2026).
if (vietLai) {
  const cu = (await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND trang_thai <> 'nhap'`)) as unknown as Row[];
  if (cu.length) { await boVaoThungRac(db, 'canh', cu.map((x) => Number(x.id)), 'script dung-phim-mau', `${cu.length} shot cũ (viết lại kịch bản)`); console.log(`  ${cu.length} shot cũ đã có keyframe → thùng rác (viết lại)`); }
}
const so = await luuCanhTach(db, { tapId, tenTap: hs.tap.ten, kq: tc, nhanVat, nguoi: 'script dung-phim-mau', thoiLuongS: thoiLuong });
console.log(`  thư viện khuôn: +${await ghiKhuonTuCanh(db, tc.canh, nhanVat, tenSp, `phim #${phimId} tập 1`, phimId)} khuôn mới từ cảnh`);
console.log(`  ${so} cảnh · tổng phát ${tc.canh.filter((c) => !c.nhanh || c.nhanh === 'A').reduce((a, c) => a + (c.phat_s ?? c.thoi_luong_s), 0)}s`);
const bd = await vietBaiDang({ kinhThanh: kt, kichBan, chuMan: tc.canh.map((c) => c.chu_man ?? '') });
if (bd.ok) { await ghiJob('Bài đăng kèm · tập 1', bd); await db.execute(sql`UPDATE xv_tap SET bai_dang = ${JSON.stringify({ ...bd.data, luc: new Date().toISOString() })}::jsonb WHERE id = ${tapId}`); }
else console.error('bài đăng lỗi:', bd.loi);
console.log(`xong → https://studio.on.tc/?m=phim&mId=${phimId}`);
process.exit(0);
