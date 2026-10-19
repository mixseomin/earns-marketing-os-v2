// THỬ 🩹 SỬA HƯỚNG NHÌN trên một tập mà KHÔNG ghi gì vào shot (anh 19/10/2026 "thử sinh 1 ảnh theo đúng hướng nhìn cần thiết xem có đáp ứng không"):
// đo mặt + hướng nhìn cả tập (soi-mat.ts › soiMatTap ghi: false, 0đ) → in từng shot: ai, nhìn bao nhiêu độ, cần phía nào, lỗi gì → chọn shot
// (--canh=<id> hoặc shot đầu tiên sai ánh mắt) → in kế hoạch (khung.ts › keHoachSuaMat). --chay = gửi MỘT lượt thử (TỐN ~110₫): ảnh sửa + soi lại
// chỉ ghi vào job (request.ghep, request.soi_lai), keyframe của shot giữ nguyên.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-sua-nhin.mts --tap=122 [--canh=1041] [--chay]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiMatTap, suaMatCanh } from '../src/lib/xuong-video/soi-mat';
import { loiNhin, keHoachSuaMat, nhinSai } from '../src/lib/xuong-video/khung';
import { dichNhin } from '../src/lib/xuong-video/bo-set-3d';
import { mapCanh, mapNhanVat, type Row } from '../src/lib/xuong-video/doc-db';

const val = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] ?? '';
const tapId = Number(val('tap')); if (!tapId) { console.error('thiếu --tap=<id>'); process.exit(1); }
const db = getDb(); if (!db) { console.error('không có DATABASE_URL'); process.exit(1); }
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as Row[];

const r = await soiMatTap(db, tapId, { tatCa: true, ghi: false });
if (!r.ok) { console.error(r.loi); process.exit(1); }
const canh = (await q(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)).map(mapCanh);
const ket = r.data.ket ?? {};
for (const c of canh) {
  const sm = ket[c.id]; if (!sm) continue;
  const mat = sm.ket.filter((k) => k.nhin).map((k) => `${k.ten} ${k.nhin!.g > 0 ? '+' : ''}${k.nhin!.g}°${k.nhin!.can ? ` cần ${k.nhin!.can > 0 ? 'PHẢI' : 'TRÁI'}${k.nhin!.tu ? ` (cặp #${k.nhin!.tu})` : ''}` : ' (không biết phía)'}${nhinSai(k) ? ' ✗' : ''}`);
  if (mat.length) console.log(`  #${c.thu_tu} (${c.id}): ${mat.join(' · ')}`);
}
const chon = Number(val('canh')) || canh.find((c) => ket[c.id] && loiNhin(ket[c.id]!).length)?.id;
if (!chon) { console.log('→ không shot nào sai ánh mắt (thêm --canh=<id> để thử một shot cụ thể)'); process.exit(0); }
const c = canh.find((x) => x.id === chon)!; const sm = ket[chon];
if (!sm) { console.log(`→ shot ${chon} chưa đo được`); process.exit(0); }
const nv = (await q(sql`SELECT * FROM xv_nhan_vat WHERE id = ANY(${`{${c.nhan_vat.join(',') || 0}}`}::int[])`)).map(mapNhanVat);
const nguoi = (c.may_3d?.vi_tri ?? []).filter((v) => !v.cam && !v.an);
const kh = keHoachSuaMat(sm, nv, (ten) => { const v = nguoi.find((x) => x.ten === ten); return v ? dichNhin(v, nguoi)?.ten : undefined; });
console.log(`\n→ shot #${c.thu_tu} (${c.id}) keyframe ${c.keyframe_url}\n  lỗi: ${loiNhin(sm).join('; ') || '(không có lỗi ánh mắt)'}`);
if ('loi' in kh) { console.log(`  kế hoạch: ${kh.loi}`); process.exit(0); }
console.log(`  kế hoạch: ${kh.che_do === 'nhin' ? 'sửa hướng nhìn' : 'sửa mặt'} · ${kh.ten} · ảnh mẫu ${kh.mau}\n  lệnh: ${kh.prompt}`);
if (!process.argv.includes('--chay')) process.exit(0);

const g = await suaMatCanh(db, chon, 1, undefined, true, sm);
if (!g.ok) { console.error(`✗ ${g.loi}`); process.exit(1); }
const t0 = Date.now(); let j: Row | undefined;
while (Date.now() - t0 < 10 * 60_000) {
  j = (await q(sql`SELECT trang_thai, loi, output_url, chi_phi_cents, provider, request->'ghep' AS ghep, request->'soi_lai' AS soi_lai FROM xv_job WHERE id = ${g.data}`))[0];
  if (j && j.trang_thai !== 'cho' && (j.trang_thai === 'loi' || j.ghep !== null)) break;
  await new Promise((ok) => setTimeout(ok, 5000));
}
console.log(`\n  job ${g.data}: ${j?.trang_thai} · ${j?.provider} · ${Number(j?.chi_phi_cents ?? 0).toFixed(3)}¢${j?.loi ? ` · ${String(j.loi).slice(0, 160)}` : ''}`);
console.log(`  ảnh vùng đầu: ${j?.output_url}\n  ảnh ghép cả khung: ${j?.ghep}`);
const sl = j?.soi_lai as { ket?: { ten: string; giong: number | null; dat: boolean; nhin?: { g: number; can?: number } }[] } | null;
for (const k of sl?.ket ?? []) console.log(`  soi lại ${k.ten}: giống ${Math.round((k.giong ?? 0) * 100)}% ${k.dat ? '✓' : '✗'} · nhìn ${k.nhin ? `${k.nhin.g > 0 ? '+' : ''}${k.nhin.g}°` : '—'}`);
process.exit(0);
