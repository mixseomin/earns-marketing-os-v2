// Dựng MỘT phim quảng cáo từ hồ sơ mẫu (mau/<ten>.json): phim + mục 0 (sản phẩm, QC mẫu) + anchor + tập → Claude viết kịch bản →
// tách cảnh bám mẫu → bài đăng kèm. CHỈ gọi Claude (chữ, vài cent); không sinh ảnh/video (tốn tiền — bấm tay trên studio khi anh chốt).
// Chạy trên box3 (có DB + ANTHROPIC_API_KEY):
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; NODE_OPTIONS=--conditions=react-server \
//     node_modules/.bin/tsx apps/xuong-video/scripts/dung-phim-mau.mts apps/xuong-video/mau/jett-husband.json [--chi-tao]
// --chi-tao = chỉ tạo phim/anchor/tập, không gọi Claude. Chạy lại cùng tệp = tạo phim MỚI (không đè).
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { vietKichBan, tachCanh, vietBaiDang } from '../src/lib/xuong-video/claude';
import { luuCanhTach } from '../src/lib/xuong-video/luu-canh';
import { dsKhuon, taKhuon, ghiKhuonTuCanh, ghiKhuonTuMau } from '../src/lib/xuong-video/khuon-shot';
import { docKinhThanh, giaChuCents, giayMau, type KinhThanh, type LoaiNhanVat, type NhanVat, type MauQc } from '../src/lib/xuong-video/kieu';

type HoSo = {
  project: string; ten: string; mo_ta: string; kinh_thanh: KinhThanh;
  nhan_vat: { loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref?: string[]; giong?: string }[];
  tap: { ten: string; brief: string };
};
const tep = process.argv[2]; const chiTao = process.argv.includes('--chi-tao');
if (!tep) { console.error('thiếu đường dẫn hồ sơ json'); process.exit(1); }
const hs = JSON.parse(readFileSync(tep, 'utf8')) as HoSo;
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
type Row = Record<string, unknown>;
const mau = hs.kinh_thanh.qc?.mau as MauQc | undefined;
const thoiLuong = mau?.shots?.length ? giayMau(mau) : 30;

const p = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh) VALUES (${hs.project}, ${hs.ten}, 'quang_cao', ${hs.mo_ta}, ${JSON.stringify(hs.kinh_thanh)}::jsonb) RETURNING id`)) as unknown as Row[];
const phimId = Number(p[0]!.id);
console.log(`phim #${phimId} · ${hs.ten}`);
const nhanVat: NhanVat[] = [];
for (const v of hs.nhan_vat) {
  const r = (await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, giong) VALUES (${phimId}, ${v.loai}, ${v.ten}, ${v.mo_ta}, ${JSON.stringify(v.anh_ref ?? [])}::jsonb, ${v.giong ?? ''}) RETURNING id`)) as unknown as Row[];
  nhanVat.push({ id: Number(r[0]!.id), phim_id: phimId, loai: v.loai, ten: v.ten, mo_ta: v.mo_ta, anh_ref: v.anh_ref ?? [], giong: v.giong ?? '', bien_the: [] } as NhanVat);
  console.log(`  anchor #${r[0]!.id} [${v.loai}] ${v.ten}${v.anh_ref?.length ? ` · ${v.anh_ref.length} ảnh` : ''}`);
}
const t = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, brief, thoi_luong_s) VALUES (${phimId}, 1, ${hs.tap.ten}, ${hs.tap.brief}, ${thoiLuong}) RETURNING id`)) as unknown as Row[];
const tapId = Number(t[0]!.id);
console.log(`  tập #${tapId} · ${hs.tap.ten} · ${thoiLuong}s${mau?.shots?.length ? ` · QC mẫu ${mau.shots.length} shot` : ''}`);
const tenSp = hs.kinh_thanh.qc?.ten ?? '';
if (mau?.shots?.length) console.log(`  thư viện khuôn: +${await ghiKhuonTuMau(db, mau.shots, nhanVat, tenSp, `QC mẫu · ${mau.nguon.slice(0, 60)}`, phimId)} khuôn mới từ mẫu`);
if (chiTao) { console.log('--chi-tao: dừng, chưa gọi Claude'); process.exit(0); }

const ghiJob = async (nhan: string, r: { model?: string; tokens?: { in: number; out: number } }) => {
  if (!r.model || !r.tokens) return;
  const gia = giaChuCents(r.model, r.tokens.in, r.tokens.out);
  await db.execute(sql`INSERT INTO xv_job (phim_id, nhan, loai, provider, model, trang_thai, chi_phi_cents, tokens_in, tokens_out)
    VALUES (${phimId}, ${nhan}, 'chu', 'anthropic', ${r.model}, 'xong', ${Math.round(gia * 100) / 100}, ${r.tokens.in}, ${r.tokens.out})`);
  console.log(`  ${nhan}: ${r.tokens.in}/${r.tokens.out} tokens ≈ ${(gia / 100).toFixed(3)}$`);
};
const kt = docKinhThanh(hs.kinh_thanh);
const kb = await vietKichBan({ loai: 'quang_cao', kinhThanh: kt, nhanVat, brief: hs.tap.brief, thoiLuongS: thoiLuong });
if (!kb.ok) { console.error('viết kịch bản lỗi:', kb.loi); process.exit(1); }
await ghiJob('Viết kịch bản · tập 1', kb);
await db.execute(sql`UPDATE xv_tap SET kich_ban = ${kb.kichBan}, updated_at = now() WHERE id = ${tapId}`);
const tc = await tachCanh({ loai: 'quang_cao', kinhThanh: kt, nhanVat, kichBan: kb.kichBan, soCanh: 0, thoiLuongS: thoiLuong, khuon: taKhuon(await dsKhuon(db, { toiDa: 60 })) });
if (!tc.ok) { console.error('tách cảnh lỗi:', tc.loi); process.exit(1); }
await ghiJob('Tách cảnh · tập 1 (bám QC mẫu)', tc);
const so = await luuCanhTach(db, { tapId, tenTap: hs.tap.ten, kq: tc, nhanVat, nguoi: 'script dung-phim-mau', thoiLuongS: thoiLuong });
console.log(`  thư viện khuôn: +${await ghiKhuonTuCanh(db, tc.canh, nhanVat, tenSp, `phim #${phimId} tập 1`, phimId)} khuôn mới từ cảnh`);
console.log(`  ${so} cảnh · tổng phát ${tc.canh.filter((c) => !c.nhanh || c.nhanh === 'A').reduce((a, c) => a + (c.phat_s ?? c.thoi_luong_s), 0)}s`);
const bd = await vietBaiDang({ kinhThanh: kt, kichBan: kb.kichBan, chuMan: tc.canh.map((c) => c.chu_man ?? '') });
if (bd.ok) { await ghiJob('Bài đăng kèm · tập 1', bd); await db.execute(sql`UPDATE xv_tap SET bai_dang = ${JSON.stringify({ ...bd.data, luc: new Date().toISOString() })}::jsonb WHERE id = ${tapId}`); }
else console.error('bài đăng lỗi:', bd.loi);
console.log(`xong → https://studio.on.tc/?m=phim&mId=${phimId}`);
process.exit(0);
