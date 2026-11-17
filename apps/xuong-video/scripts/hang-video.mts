// HÀNG SINH VIDEO THEO CỤM (góp ý #1638) — nút Sinh của studio xếp shot vào hàng (xv_job loai 'video', trang_thai 'hang', provider = bộ sinh chính của phim:
// 'seedance' | 'h3', sinh-video.ts › xepHangCum). Lệnh này chỉ ĐỌC / ĐÓNG hàng, 0đ; scripts/h3/chay-hang.sh (iMac) gọi nó qua ssh.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/hang-video.mts --ds
//       → JSON [{ tap, bo, so: [thứ tự shot], ids: [id shot] }] — shot đang xếp hàng, gom theo tập + bộ
//   … --h3            → JSON [{ job, cum: [id shot], vao }] — job cụm H3 đã dựng đầu vào (thu-seedance-cum.mts --bo=h3), chờ máy thuê
//   … --dong --tap=<id> --bo=<seedance|h3>
//       → đóng hàng của tập: shot đã có phiên bản nhãn của bộ MỚI HƠN lúc xếp hàng = xong (output_url = clip đó); chưa có = lỗi (bấm Sinh lại), không giữ hàng
//         để lượt sau không tự chạy lại một cụm hỏng (tốn tiền mỗi lần).
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { BO_SINH_VIDEO } from '../src/lib/xuong-video/kieu';

const arg = (k: string): string => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const co = (k: string) => process.argv.includes(`--${k}`);
const db = getDb()!;
type R = Record<string, unknown>;
const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as R[];

if (co('ds')) {
  const rows = await q(sql`SELECT c.tap_id, j.provider, c.thu_tu, c.id FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id
    WHERE j.loai = 'video' AND j.trang_thai = 'hang' ORDER BY c.tap_id, j.provider, c.thu_tu, c.id`);
  const nhom = new Map<string, { tap: number; bo: string; so: number[]; ids: number[] }>();
  for (const r of rows) {
    const k = `${r.tap_id}:${r.provider}`;
    if (!nhom.has(k)) nhom.set(k, { tap: Number(r.tap_id), bo: String(r.provider), so: [], ids: [] });
    nhom.get(k)!.so.push(Number(r.thu_tu)); nhom.get(k)!.ids.push(Number(r.id));
  }
  console.log(JSON.stringify([...nhom.values()]));
} else if (co('h3')) {
  const rows = await q(sql`SELECT id, request FROM xv_job WHERE provider = 'h3' AND trang_thai = 'hang_h3' AND request->>'thu' = 'h3-cum' ORDER BY id`);
  console.log(JSON.stringify(rows.map((r) => { const rq = r.request as { cum: number[]; vao: unknown }; return { job: Number(r.id), cum: rq.cum, vao: rq.vao }; })));
} else if (co('dong')) {
  const tap = Number(arg('tap')); const bo = arg('bo'); const nhan = BO_SINH_VIDEO.find((b) => b.value === bo)?.nhan;
  if (!tap || !nhan) { console.error('cần --tap=<id> --bo=<seedance|h3>'); process.exit(1); }
  const rows = await q(sql`SELECT j.id, j.created_at, c.thu_tu, c.video_url, c.video_phien_ban FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id
    WHERE c.tap_id = ${tap} AND j.loai = 'video' AND j.trang_thai = 'hang' AND j.provider = ${bo}`);
  let xong = 0, hong = 0;
  for (const r of rows) {
    const luc = new Date(String(r.created_at)).getTime();
    const v = [...((r.video_phien_ban ?? []) as { url: string; nhan?: string; luc?: string }[])].reverse().find((x) => x.nhan === nhan && x.luc && new Date(x.luc).getTime() > luc);
    if (v) { await db.execute(sql`UPDATE xv_job SET trang_thai = 'xong', output_url = ${v.url}, loi = '', updated_at = now() WHERE id = ${r.id}`); xong++; }
    else { await db.execute(sql`UPDATE xv_job SET trang_thai = 'loi', loi = ${`cụm ${nhan} đã chạy mà shot #${Number(r.thu_tu)} chưa gắn clip mới (xem nhật ký chay-hang.sh / lỗi trên thẻ shot) — bấm Sinh lại`}, updated_at = now() WHERE id = ${r.id}`); hong++; }
  }
  console.log(`tập ${tap} · ${nhan}: ${xong} shot xong · ${hong} shot chưa gắn`);
} else { console.error('cần --ds | --h3 | --dong --tap=<id> --bo=<seedance|h3>'); process.exit(1); }
process.exit(0);
