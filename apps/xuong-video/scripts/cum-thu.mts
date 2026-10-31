// THỬ PROMPT CỤM (A/B/C) — nửa chạy trên BOX (có DB): dựng prompt các biến thể cho một đoạn shot + ghi clip thử về Studio. Nửa gửi VideoExpress chạy trên iMac
// (scripts/vx-cum.mts, phiên trình duyệt). Biến thể: cu = promptCum (mốc giây + khối trạng thái) · moi = promptCumMoi (cớ → phản ứng, cắt theo động tác)
// · gop = promptCumMoi gộp shot con (#2.9 / #3.1) vào câu của shot cha. Clip thử KHÔNG đè video_url: lưu R2 + ky_thuat.cum_thu[<bien>] ở shot đầu đoạn.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx \
//     scripts/cum-thu.mts --tap=356 --tu=2 --den=3                       → in JSON {dau, cuoi, bien:{cu,moi,gop}}
//     scripts/cum-thu.mts --tap=356 --tu=2 --den=3 --gan=moi:/tmp/x.mp4 [--nguon=vx]  → R2 + ghi ky_thuat.cum_thu.moi
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { promptCum, promptCumMoi, anhNeoCuoi } from '../src/lib/xuong-video/cum-shot';
import { uploadToR2 } from '../src/lib/r2';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tap = Number(gia('tap')), tu = Number(gia('tu')), den = Number(gia('den'));
if (!tap || !tu || !den) { console.error('cần --tap --tu --den (số xếp phát: --tu=2 --den=3 gồm cả #2.9 / #3.1)'); process.exit(1); }
const db = getDb()!;
const cum = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND thu_tu BETWEEN ${tu} AND ${den} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
if (!cum.length) { console.error('đoạn rỗng'); process.exit(1); }
const ten = `#${cum[0]!.thu_tu}–#${cum.at(-1)!.thu_tu}`;

const gan = gia('gan');
if (gan) {
  const [bien, tep] = [gan.slice(0, gan.indexOf(':')), gan.slice(gan.indexOf(':') + 1)];
  const url = await uploadToR2(`xuong-video/video/cum-thu-${tap}-${tu}-${den}-${bien}-${randomUUID()}.mp4`, readFileSync(tep), 'video/mp4');
  const ghi = { url, nguon: gia('nguon') ?? 'vx', shot: cum.map((c) => c.thu_tu), luc: new Date().toISOString() };
  await db.execute(sql`UPDATE xv_canh SET ky_thuat = jsonb_set(coalesce(ky_thuat, '{}'::jsonb), '{cum_thu}', coalesce(ky_thuat->'cum_thu', '{}'::jsonb) || ${JSON.stringify({ [bien]: ghi })}::jsonb), updated_at = now() WHERE id = ${cum[0]!.id}`);
  console.log(`${ten} ${bien}: ${url}`);
  process.exit(0);
}
const vao = (await Promise.all(cum.map((c) => boiCanhCanh(db, c.id)))).map((x) => ({ canh: x!.canh, nhanVat: x!.nhanVat }));
const cuoi = anhNeoCuoi(cum) ?? (cum.length > 1 ? cum.at(-1)!.keyframe_url : null);
console.log(JSON.stringify({ ten, dau: cum[0]!.keyframe_url, cuoi, bien: { cu: promptCum(vao), moi: promptCumMoi(vao), gop: promptCumMoi(vao, { gopCon: true }) } }));
process.exit(0);
