// ⚖️ ĐỐI CHIẾU BỔ SUNG ảnh keyframe CŨ (sinh trước khi job tự đối chiếu — doi-chieu-anh.ts) với yêu cầu của phiếu shot. Một lõi với job / nút.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/doi-chieu-anh.mts --tap=<id> [--chi=2.9,3.1] [--tat-ca] [--ep]
//   mặc định: ảnh ĐANG CHỌN (khung mở) của mọi shot nhánh chính chưa đối chiếu · --tat-ca: mọi ảnh từng sinh (ứng viên) · --ep: làm lại cả ảnh đã có · --chi: chỉ các shot có SỐ HIỆN đó.
//   TỐN TIỀN ~0,6¢ / ảnh (Gemini rẻ); chot-tien gác như mọi script.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { doiChieuAnh, soLech } from '../src/lib/xuong-video/doi-chieu-anh';
import { songSong } from '../src/lib/xuong-video/song-song';
import type { Row } from '../src/lib/xuong-video/doc-db';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const co = (k: string) => process.argv.includes(`--${k}`);
const tapId = Number(gia('tap') || 0); if (!tapId) { console.error('cần --tap=<id>'); process.exit(1); }
const db = getDb()!;
const ds = (await db.execute(sql`SELECT id, coalesce(so_hien, thu_tu)::float8 AS so, keyframe_url, keyframe_uv, doi_chieu_uv FROM xv_canh WHERE tap_id = ${tapId} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as Row[];
const chi = new Set((gia('chi') ?? '').split(',').filter(Boolean).map(Number));
const viec = ds.filter((r) => !chi.size || chi.has(Number(r.so))).flatMap((r) => {
  const urls = co('tat-ca') ? [...new Set([...((r.keyframe_uv ?? []) as string[]), ...(r.keyframe_url ? [String(r.keyframe_url)] : [])])] : r.keyframe_url ? [String(r.keyframe_url)] : [];
  const da = (r.doi_chieu_uv ?? {}) as Record<string, unknown>;
  return urls.filter((u) => co('ep') || !da[u]).map((u) => ({ id: Number(r.id), so: Number(r.so), url: u }));
});
console.log(`${viec.length} ảnh cần đối chiếu`);
const kq = await songSong(viec, (v) => doiChieuAnh(db, v.id, v.url, 'dau', { ep: co('ep') }));
kq.forEach((x, i) => { const v = viec[i]!; console.log(`#${v.so}: ${!x.ok ? `✗ ${x.loi}` : !x.data ? '✗ bóc hỏng' : soLech(x.data.chieu) ? `lệch ${soLech(x.data.chieu)} — ${x.data.chieu.filter((r) => r.muc !== 'khớp' && r.muc !== 'gần').map((r) => r.thanh_phan).join(', ')}` : '✓ khớp hết'}`); });
process.exit(0);
