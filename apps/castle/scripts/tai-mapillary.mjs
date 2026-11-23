#!/usr/bin/env node
// ẢNH SO TỪ MAPILLARY (CC BY-SA 4.0): ảnh đường phố có vị trí + hướng camera do Mapillary TÍNH LẠI bằng ghép nhiều ảnh (computed_*),
// đáng tin hơn toạ độ ảnh Commons. Chọn ảnh thường (không 360°) cách công trình RMIN–RMAX m, hướng nhìn lệch ≤ 30° so với hướng tới tâm,
// chia đều quanh công trình (mỗi góc 30° lấy tối đa 2 ảnh, ưu tiên gần + mới) → tải bản 2048 px vào public/du-lieu/anh/ và THÊM vào <lâu>-anh.json
// kèm camera ban đầu (yaw từ hướng la bàn, ống kính từ tiêu cự, đứng 1,6 m trên đất) để scripts/khop-camera.mjs tinh chỉnh.
//   MLY_TOKEN=… node apps/castle/scripts/tai-mapillary.mjs --lau neuschwanstein [RMIN=25] [RMAX=160] [số ảnh tối đa=16]
// Khoá: vault acct #689 (api client_token) — `acct reveal 689 api client_token token`; không in khoá ra.
// tra-repo-ok: gọi Graph API Mapillary trực tiếp (như apps/xuong-video/scripts/pho-di-bo/lay-anh.py).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PUB, du, doiSo } from './chung.mjs';
import { taiMang } from '../server/tai-mang.mjs';
const T = process.env.MLY_TOKEN; if (!T) { console.error('thiếu MLY_TOKEN'); process.exit(1); }
const D = JSON.parse(readFileSync(du('').replace(/-\.json$/, '.json'), 'utf8')), [la0, lo0] = D.tam;
const [RMIN = 25, RMAX = 160, TOI_DA = 16] = doiSo.map(Number);
const M = 111320, MX = M * Math.cos(la0 * Math.PI / 180), p = (RMAX + 40) / M;
const f = 'id,computed_geometry,geometry,computed_compass_angle,compass_angle,camera_parameters,camera_type,width,height,is_pano,captured_at,creator';
const r = await taiMang(`https://graph.mapillary.com/images?access_token=${T}&fields=${f}&bbox=${lo0 - p * M / MX},${la0 - p},${lo0 + p * M / MX},${la0 + p}&limit=2000`);
if (!r.ok) { console.error('Mapillary', r.status, await r.text()); process.exit(1); }
const ds = (await r.json()).data.filter((x) => !x.is_pano && x.camera_type !== 'spherical' && x.computed_geometry && x.computed_compass_angle != null).map((x) => {
  const [lo, la] = x.computed_geometry.coordinates, dx = (lo - lo0) * MX, dz = -(la - la0) * M, kc = Math.hypot(dx, dz);
  const toi = (Math.atan2(-dx, dz) * 180 / Math.PI + 360) % 360, lech = Math.abs(((x.computed_compass_angle - toi) % 360 + 540) % 360 - 180); // hướng la bàn tới tâm (bắc = 0, theo chiều kim)
  return { ...x, la, lo, kc, lech, goc: Math.floor(((Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360) / 30) };
}).filter((x) => x.kc >= RMIN && x.kc <= RMAX && x.lech <= 30 && (x.width || 0) >= 1500);
const chon = [];
for (let g = 0; g < 12; g++) chon.push(...ds.filter((x) => x.goc === g).sort((a, b) => a.kc - b.kc || b.captured_at - a.captured_at).slice(0, 2));
chon.sort((a, b) => a.kc - b.kc); chon.splice(TOI_DA);
console.log(`${ds.length} ảnh hợp lệ (${RMIN}–${RMAX} m, nhìn về công trình) → chọn ${chon.length} chia đều quanh`);
const tepDs = du('anh'), ANH = existsSync(tepDs) ? JSON.parse(readFileSync(tepDs, 'utf8')) : [];
for (const x of chon) {
  if (ANH.some((a) => a.mly === x.id)) { console.log('đã có', x.id); continue; }
  const m = await (await taiMang(`https://graph.mapillary.com/${x.id}?access_token=${T}&fields=thumb_2048_url,width,height`)).json();
  const b = await taiMang(m.thumb_2048_url); if (!b.ok) { console.log('tải lỗi', x.id); continue; }
  const tep = `anh/mly-${x.id}.jpg`; writeFileSync(join(PUB, 'du-lieu', tep), Buffer.from(await b.arrayBuffer()));
  const W = m.width || x.width, H = m.height || x.height, sc = 2048 / Math.max(W, H), rong = Math.round(W * sc), cao = Math.round(H * sc);
  const fN = x.camera_parameters?.[0] || 0.8, fovDoc = 2 * Math.atan((cao / Math.max(rong, cao)) / 2 / fN) * 180 / Math.PI; // tiêu cự chuẩn hoá theo cạnh dài → ống kính dọc
  ANH.push({ tieuDe: `Mapillary ${x.id}`, tep, trang: `https://www.mapillary.com/app/?pKey=${x.id}`, mly: x.id, lat: x.la, lng: x.lo, rong, cao,
    tacGia: x.creator?.username ? `${x.creator.username} / Mapillary` : 'Mapillary contributors', giayPhep: 'CC BY-SA 4.0', giayPhepUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    nhan: `Mapillary ${Math.round(x.kc)} m · ${['B', 'BĐB', 'ĐB', 'Đ', 'ĐĐN', 'ĐN', 'N', 'NTN', 'TN', 'T', 'TTB', 'TB'][x.goc] || ''}`,
    cameraDau: { yaw: +(-x.computed_compass_angle * Math.PI / 180).toFixed(4), pitch: 0.1, fov: +fovDoc.toFixed(1) }, camera: null });
  console.log(`tải ${tep} · ${Math.round(x.kc)} m · lệch hướng ${Math.round(x.lech)}° · ống kính dọc ${fovDoc.toFixed(0)}°`);
}
writeFileSync(tepDs, JSON.stringify(ANH, null, 1) + '\n'); console.log('ghi', tepDs, ANH.length, 'ảnh');
