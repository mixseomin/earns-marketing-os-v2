// TẢI TỆP LÊN R2 (img.on.tc) lấy link công khai — đầu vào cho TRELLIS / Tripo / fal. 0đ.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-3d/tai-len.mts <tệp>
import { readFile } from 'node:fs/promises';
import { uploadToR2 } from '../../src/lib/r2';
const f = process.argv[2]; if (!f) { console.error('thiếu <tệp>'); process.exit(1); }
const loai = f.endsWith('.png') ? 'image/png' : f.endsWith('.glb') ? 'model/gltf-binary' : 'image/jpeg';
console.log(await uploadToR2(`xuong-video/thu-3d/${Date.now()}-${f.split('/').pop()}`, await readFile(f), loai));
process.exit(0);
