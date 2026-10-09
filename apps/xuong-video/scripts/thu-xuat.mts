// Thử bản xuất với DỮ LIỆU THẬT của một tập, không qua server action, không lên R2 — dùng khi sửa xuat.ts để xem khung hình thật (ffmpeg -ss … tile).
// Chạy trên box3 (nơi có DB + ffmpeg): cd /opt/earns-marketing-os-v2 && TAP=5 NHANH= node_modules/.bin/tsx apps/xuong-video/scripts/thu-xuat.mts
import { keHoachXuat, urlCanXuat } from '../src/lib/xuong-video/xuat';
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
const TAP = Number(process.env.TAP || 5); const NHANH = process.env.NHANH || null;
const psql = (q: string) => execFileSync('bash', ['-c', `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -tAc ${JSON.stringify(q)}`]).toString().trim();
const tap = JSON.parse(psql(`SELECT row_to_json(t) FROM (SELECT t.id, t.nhac_url, t.nhac_phan_canh, p.loai, p.kinh_thanh FROM xv_tap t JOIN xv_phim p ON p.id=t.phim_id WHERE t.id=${TAP}) t`));
const canh = JSON.parse(psql(`SELECT coalesce(json_agg(row_to_json(c) ORDER BY thu_tu),'[]') FROM xv_canh c WHERE tap_id=${TAP}`));
const nhanVat = JSON.parse(psql(`SELECT coalesce(json_agg(row_to_json(v)),'[]') FROM xv_nhan_vat v WHERE phim_id=(SELECT phim_id FROM xv_tap WHERE id=${TAP})`));
for (const c of canh) { c.phat_s = c.phat_s == null ? null : Number(c.phat_s); c.thoai = c.thoai ?? []; c.chu_man = c.chu_man ?? ''; c.nhanh = c.nhanh ?? ''; }
const kt = tap.kinh_thanh ?? {};
const dir = `/tmp/xv-thu-xuat/t${TAP}`; mkdirSync(dir, { recursive: true });
const urls = urlCanXuat(canh, nhanVat, tap, NHANH, kt.qc);
console.log('shot', canh.length, 'url cần tải', urls.length);
const probe = (f: string) => { try { const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', f]).toString()); return { dai: Number(j.format?.duration) || null, coAm: (j.streams ?? []).some((s: any) => s.codec_type === 'audio') }; } catch { return { dai: null, coAm: false }; } };
const nguyenLieu = urls.map((url, i) => { const duong = `${dir}/${i}.${(url.split('?')[0].split('.').pop() || 'bin').slice(0, 5)}`; if (!existsSync(duong)) execFileSync('curl', ['-sfL', '-o', duong, url]); return { url, duong, ...probe(duong) }; });
const kh = keHoachXuat({ loai: tap.loai, tiLe: kt.ti_le || '9:16', canh, nhanVat, tap, qc: kt.qc, nhanh: NHANH, nguyenLieu, font: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', thuMuc: dir, ra: `${dir}/ra.mp4` });
for (const t of kh.tep) writeFileSync(t.duong, t.noiDung);
console.log('giây', kh.giay, 'thiếu hình:', kh.canhThieu.join(', ') || 'không');
const t0 = Date.now(); execFileSync('ffmpeg', kh.args, { stdio: 'inherit' }); console.log('ffmpeg xong', ((Date.now() - t0) / 1000).toFixed(1), 's →', `${dir}/ra.mp4`);
