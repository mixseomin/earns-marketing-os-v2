// Đưa tệp trên box lên R2 (kho ảnh img.on.tc) để làm ảnh tham chiếu / keyframe / lớp phủ — 0đ, không gọi model.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/tai-len.mts /tmp/anh.png [thu-muc]
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { uploadToR2 } from '../src/lib/r2';

const tep = process.argv[2]; const thuMuc = process.argv[3] || 'tai-len';
if (!tep) { console.error('thiếu đường dẫn tệp'); process.exit(1); }
const duoi = (tep.split('.').pop() || 'png').toLowerCase();
const mime = duoi === 'jpg' || duoi === 'jpeg' ? 'image/jpeg' : duoi === 'webp' ? 'image/webp' : duoi === 'mp4' ? 'video/mp4' : 'image/png';
const url = await uploadToR2(`xuong-video/${thuMuc}/${randomUUID()}.${duoi}`, readFileSync(tep), mime);
if (!url) { console.error('R2 không nhận tệp'); process.exit(1); }
console.log(url);
process.exit(0);
