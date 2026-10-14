// (0đ) Dọn MỘT LẦN ảnh render 3D cũ đang tồn trên R2 (khung xám, độ sâu, mặt bằng): ảnh không còn được nhắc ở đâu (shot đang dùng, mặt bằng
// đang dùng, lệnh sinh keyframe đã gửi, bản chụp hoàn tác) thì xoá cùng ảnh nhỏ của nó — luật ở bo-set-3d-may.ts › donRenderCu.
// Từ nay lượt dựng tự dọn bản nó thay thế; script này chỉ cho đống tồn từ trước.
//   cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/don-render-cu.mts [--chay]   (mặc định chạy thử: chỉ đếm)
import { getDb } from '@mos2/db';
import { listR2 } from '../src/lib/r2';
import { donRenderCu } from '../src/lib/xuong-video/bo-set-3d-may';
const db = getDb()!; const chay = process.argv.includes('--chay');
const goc = (process.env.R2_PUBLIC_BASE || 'https://img.on.tc').replace(/\/+$/, '');
const ds = [...(await listR2('xuong-video/khung-xam/')), ...(await listR2('xuong-video/bo-set/'))];
const kq = await donRenderCu(db, ds.map((x) => `${goc}/${x.key}`), !chay);
console.log(JSON.stringify({ tep: ds.length, mb: Math.round(ds.reduce((a, x) => a + x.size, 0) / 1e6), [chay ? 'da_xoa' : 'se_xoa']: kq.xoa, giu: kq.giu }));
process.exit(0);
