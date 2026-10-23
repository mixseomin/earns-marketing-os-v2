// BẢNG TRUYỆN TRANH của một tập (0đ — anh 23/10/2026: "nhìn keyframe phải giống như truyện tranh, đọc không cũng nắm được logic"): keyframe xếp
// theo thứ tự, dưới mỗi ô là #N · hành động (tiếng Việt) · thoại · cớ cắt sang ô sau. Đọc bảng này phải hiểu ai ở đâu, làm gì, vì sao cắt.
//   … tsx scripts/truyen-tranh.mts <tap_id> [--ra=/tmp/truyen.jpg] [--cot=4]
import sharp from 'sharp';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { TEN_NOI } from '../src/lib/xuong-video/noi-nhip';
import { ngatDong } from '../src/lib/xuong-video/ngat-dong';

const tap = Number(process.argv[2]); if (!tap) { console.error('cần <tap_id>'); process.exit(1); }
const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const ra = gia('ra') || `/tmp/truyen-${tap}.jpg`; const cot = Number(gia('cot') || 4);
const W = 360, H = 640, CHU = 190, LE = 14;
const ds = ((await (getDb()!).execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const o = await Promise.all(ds.map(async (c) => {
  const anh = c.keyframe_url ? await fetch(c.keyframe_url).then((r) => r.arrayBuffer()).then((b) => sharp(Buffer.from(b)).resize(W, H, { fit: 'cover' }).toBuffer()).catch(() => null) : null;
  const dong = [
    ...ngatDong(`#${c.thu_tu} · ${c.hanh_dong}`, 34).map((d) => ({ d, mau: '#fff', dam: true })),
    ...c.thoai.filter((t) => t.loi.trim()).flatMap((t) => ngatDong(`${t.nhan_vat}: “${t.loi}”`, 36).map((d) => ({ d, mau: '#ffd666', dam: false }))),
    ...(c.dan_dung?.noi ? [{ d: `↳ cắt ${TEN_NOI[c.dan_dung.noi]}`, mau: '#8fd3ff', dam: false }] : []),
  ].slice(0, 7);
  const svg = `<svg width="${W}" height="${CHU}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/>${dong.map((x, i) => `<text x="10" y="${26 + i * 24}" font-family="DejaVu Sans" font-size="17" ${x.dam ? 'font-weight="bold"' : ''} fill="${x.mau}">${esc(x.d)}</text>`).join('')}</svg>`;
  const o1 = await sharp({ create: { width: W, height: H + CHU, channels: 3, background: '#222' } }).composite([...(anh ? [{ input: anh, top: 0, left: 0 }] : []), { input: Buffer.from(svg), top: H, left: 0 }]).png().toBuffer();
  return o1;
}));
const hang = Math.ceil(o.length / cot);
await sharp({ create: { width: cot * (W + LE) + LE, height: hang * (H + CHU + LE) + LE, channels: 3, background: '#000' } })
  .composite(o.map((b, i) => ({ input: b, left: LE + (i % cot) * (W + LE), top: LE + Math.floor(i / cot) * (H + CHU + LE) }))).jpeg({ quality: 82 }).toFile(ra);
console.log(ra);
process.exit(0);
