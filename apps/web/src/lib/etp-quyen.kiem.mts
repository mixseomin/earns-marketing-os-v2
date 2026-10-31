// KIỂM CHỐNG LỘ — vai "người" trên etp.on.tc (anh 31/10/2026: Kiên "chỉ xem phần của Kiên, ko được xem các phần khác").
// Dựng ĐÚNG dữ liệu trang gửi cho vai người (docEtp bản nhẹ → catChoNguoi) từ DB thật cho MỌI người ngoài nhà, rồi đối chiếu:
//   mọi camp_id / creative / phim / camp trong số ngày · xét luật · sổ bậc phải thuộc tài khoản QC của chính người đó; không mang tên người khác; trường nhà phải rỗng.
// Chạy trên box3 (cần DB):  cd /opt/earns-marketing-os-v2/apps/web && set -a; . ../../.env.production; set +a; node_modules/.bin/tsx --conditions=react-server src/lib/etp-quyen.kiem.mts [--pha-thu]
//   --pha-thu = bỏ catChoNguoi (gửi nguyên dữ liệu) → PHẢI đỏ; xanh nghĩa là bộ kiểm đang nhìn chỗ khác.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { docEtp } from './etp-doc';
import { catChoNguoi } from './etp-quyen';

const phaThu = process.argv.includes('--pha-thu');
const db = getDb()!;
const run = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
const nguoi = await run<{ id: number; ten: string; nha: boolean }>(sql`select nguoi_id id, max(nguoi) ten, bool_or(nha) nha from etp.tai_khoan where nguoi_id is not null group by 1`);
const nhaCamp = new Set((await run<{ c: number }>(sql`select camp_id c from etp.camp`)).map((r) => Number(r.c)));
let loi = 0;
const sai = (ng: number, chu: string) => { loi++; console.error(`✕ người #${ng}: ${chu}`); };
for (const ng of nguoi.filter((x) => !x.nha && !nguoi.some((y) => y.id === x.id && y.nha))) {
  const id = Number(ng.id);
  const cua = new Set((await run<{ c: number }>(sql`select c.camp_id c from etp.camp_ngoai c join etp.tai_khoan t on t.ad_account_id = c.ad_account_id where t.nguoi_id = ${id} and not t.nha`)).map((r) => Number(r.c)));
  const goc = await docEtp(String(id), true);
  const d = phaThu ? goc : catChoNguoi(goc, id);
  const camp = new Set<number>([...d.camps.map((c) => c.camp_id), ...d.soNgay.map((x) => x.c), ...Object.keys(d.xetLuat).map(Number), ...Object.keys(d.lsBac).map(Number)]);
  const la = [...camp].filter((c) => !cua.has(c));
  if (la.length) sai(id, `${la.length} camp không thuộc tài khoản của người này (vd ${la.slice(0, 5).join(', ')})`);
  const nhaLo = [...camp].filter((c) => nhaCamp.has(c));
  if (nhaLo.length) sai(id, `${nhaLo.length} camp NHÀ lộ ra (vd ${nhaLo.slice(0, 5).join(', ')})`);
  const crCua = new Set(d.camps.map((c) => c.creative_id)), phCua = new Set(d.camps.map((c) => c.content_id));
  if (d.creatives.some((x) => !crCua.has(x.creative_id))) sai(id, 'có creative không chạy trong camp của người này');
  if (d.phims.some((x) => !phCua.has(x.content_id))) sai(id, 'có phim không chạy trong camp của người này');
  if (d.nguoi.ds.length !== 1 || d.nguoi.ds[0]!.id !== id || d.nguoi.nha !== null) sai(id, `danh sách người lộ ${d.nguoi.ds.length} người / người nhà #${d.nguoi.nha}`);
  const json = JSON.stringify(d);
  for (const k of nguoi) if (Number(k.id) !== id && k.ten && json.includes(k.ten)) sai(id, `có tên "${k.ten}"`);
  const nha = { thuVien: d.thuVien.length, nhatKy: d.nhatKy.length, canhBao: d.canhBao.length, boTk: Object.keys(d.boTk).length, taiNguyen: d.taiNguyen.length, roas: d.roas.length, roasChay: d.roasChay.length,
    bao: d.bao.length, cham: Object.keys(d.cham).length, dangSx: d.dangSx.length, lichGio: d.lichGio.length, soLuat: d.soLuat.length, phot: d.phot.length, cauHinh: d.cauHinh.filter((k) => !['thang_bo', 'thang_muc'].includes(k.khoa)).length };
  const con = Object.entries(nha).filter(([, v]) => v > 0);
  if (con.length) sai(id, `trường nhà chưa rỗng: ${con.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  if (!loi) console.log(`✓ người #${id} ${ng.ten}: ${d.camps.length} camp · ${d.creatives.length} creative · ${d.phims.length} phim · ${camp.size} camp có số — không lộ`);
}
if (loi) { console.error(`✕ ${loi} chỗ lộ${phaThu ? ' (phá thử: ĐÚNG là phải đỏ)' : ''}`); process.exit(phaThu ? 0 : 1); }
if (phaThu) { console.error('✕ phá thử mà vẫn xanh — bộ kiểm không bắt được lộ'); process.exit(1); }
console.log('✓ etp vai người: không lộ dữ liệu ngoài phần của mình');
process.exit(0);
