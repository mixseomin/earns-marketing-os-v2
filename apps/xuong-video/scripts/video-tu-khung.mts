// VIDEO TỪ KHUNG ĐÃ DUYỆT (quy trình làm mới, anh 26/10/2026 — sau anh-tu-so-do.mts). Mỗi shot: khung so-N-that.png → Vidu Q2 Turbo, độ dài = max(2, làm tròn
// lên giây phát) (Vidu nhận từ 2 giây — shot ngắn trả đúng mức tối thiểu, cắt lấy đoạn đẹp khi dựng). Prompt ghép từ PHIẾU SHOT (phieu-shot.ts): động tác ĐẶT
// ĐẦU (prompt dài bị cắt đuôi thì vẫn còn động tác), rồi nét mặt đầu → cuối, nhìn ai, trạng thái đồ. Có so-N-cuoi.png (clip-dau-cuoi.mts --chi-khung) →
// khoá cả khung cuối (shot đổi trạng thái: giật đồ, cửa mở, quay đi). Song song có trần. Vidu $0,05/giây 720p.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/video-tu-khung.mts --bang=scripts/so-do/thang-may-356.json --khung=/tmp/khung-356 --so=1,3,4 --phim=353 --shot=1822 [--song=4] [--xem]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { mapNhanVat, kemBienThe, type Row } from '../src/lib/xuong-video/doc-db';
import { guiFal, docFal } from '../src/lib/xuong-video/fal';
import { uploadToR2 } from '../src/lib/r2';
import { sinhAnhMotCong } from '../src/lib/xuong-video/cong-ai';
import { bieuCam } from '../src/lib/xuong-video/qc-cam-xuc';
import { phieuShot, khongGianTap, type BangShot } from './phieu-shot.mts';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const bang = JSON.parse(readFileSync(gia('bang')!, 'utf8')) as BangShot; const thu = gia('khung')!; const phim = Number(gia('phim')); const shotMau = Number(gia('shot') || 0);
const xem = process.argv.includes('--xem');
const ds = (gia('so') || '').split(',').map(Number).filter(Boolean);
if (!thu || !phim || !ds.length) { console.error('cần --bang --khung --so --phim'); process.exit(1); }
if (!process.env.DUYET_SINH_1_LAN && !xem) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1 (hoặc --xem để chỉ in prompt)'); process.exit(2); }
const db = getDb()!;
const tapId = Number(((await db.execute(sql`SELECT tap_id FROM xv_canh WHERE id = ${shotMau}`)) as unknown as Row[])[0]?.tap_id ?? 0);
const kg = tapId ? await khongGianTap(tapId, bang.phan_doan ?? '') : null;
const nv = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phim} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
// tả người theo BIẾN THỂ của shot (cùng cách anh-tu-so-do.mts) + mô tả chuẩn đạo cụ
const taCua = (s: { bien_the?: Record<string, number> }) => Object.fromEntries(Object.keys(bang.nhan_vat).flatMap((ma) => { const id = s.bien_the?.[ma] ?? bang.bien_the?.[ma]; const v = nv.find((x) => x.ten === bang.nhan_vat[ma]?.ten_db); const bt = (v?.bien_the ?? []).find((b) => b.id === id); return v ? [[v.ten, `${v.ten} (${v.mo_ta}; wearing: ${bt?.mo_ta ?? 'as in the first frame'})`]] : []; }));
const vatTa = Object.fromEntries(nv.filter((x) => x.loai === 'dao_cu' && x.mo_ta).map((x) => [x.ten, x.mo_ta]));
const len = async (f: string, k: string, mime: string) => { const u = await uploadToR2(`xuong-video/thu/${k}-${randomUUID()}${f.slice(f.lastIndexOf('.'))}`, readFileSync(f), mime); if (!u) throw new Error(`không tải lên được ${f}`); return u; };

function prompt(so: number): string {
  const s = bang.shot.find((x) => x.so === so)!;
  const dong = phieuShot(bang, s, kg, { ta: taCua(s), vat_ta: vatTa }).split('\n');
  const dongTac = dong.find((d) => d.startsWith('ONE motion only:')) ?? '';
  const nguoi = dong.filter((d) => /^[^:]{2,30}: (face|three-quarter|profile)/.test(d));   // nét mặt + nhìn ai từng người
  const con = dong.filter((d) => d !== dongTac && !nguoi.includes(d) && !d.startsWith('Vertical 9:16'));
  return [`Photorealistic live-action vertical short drama clip; the first frame is exact.`, dongTac, ...nguoi, ...con].join(' ').replace(/\s+/g, ' ').slice(0, 2400);
}
async function motShot(so: number) {
  const s = bang.shot.find((x) => x.so === so); if (!s) return console.log(`#${so}: không có trong bảng`);
  if (!existsSync(`${thu}/so-${so}-that.png`)) return console.log(`#${so}: chưa có khung so-${so}-that.png`);
  // so-N-dau.png = KHUNG ĐẦU riêng (khung đã duyệt vẽ trạng thái SAU động tác — #11 thẻ đã trong tay Vivian, #28 Hạ đã quay mặt ra): khi đó khung đã duyệt
  // thành khung CUỐI. Không có thì khung đã duyệt là khung đầu, so-N-cuoi.png (nếu có) là khung cuối.
  // SHOT CẬN luôn khoá khung cuối (26/10/2026: chỉ khung đầu thì Vidu tự lùi máy ra toàn thân sau ~0,8 giây ở MỌI shot cận — biên độ 'small' cũng không
  // giữ được): nét mặt không đổi → khung cuối = chính khung đầu (0đ); nét đổi → sửa khung đầu sang nét cuối (câu BIEU_CAM, ~110₫).
  if (['cu', 'mcu', 'ecu'].includes(s.co) && !existsSync(`${thu}/so-${so}-dau.png`) && !existsSync(`${thu}/so-${so}-cuoi.png`) && !xem) {
    const n = (s.nguoi ?? []).find((x) => !x.lung && x.mat); const doi = n?.mat && n.mat[0] !== n.mat[1];
    if (!doi) writeFileSync(`${thu}/so-${so}-cuoi.png`, readFileSync(`${thu}/so-${so}-that.png`));
    else { const ai = bang.nhan_vat[n!.ma]?.ten_db ?? 'the person';
      const a = await sinhAnhMotCong('ckey', 'wowztools/nano-banana-2', { prompt: `Edit this photo. Keep EXACTLY the same camera position, framing and crop, lighting, background, ${ai}'s face identity, hair, outfit, props and head direction; the eyes keep looking the same way. ONLY change ${ai}'s facial expression to: ${bieuCam(n!.mat![1])?.en}. Nothing else changes. No text.`, thamChieuUrl: [await len(`${thu}/so-${so}-that.png`, `vk-${so}-nen`, 'image/png')], tiLe: '9:16' });
      if (!a.anh) return console.log(`#${so}: khung cuối hỏng — ${a.loi}`);
      writeFileSync(`${thu}/so-${so}-cuoi.png`, a.anh.data); }
  }
  const dauRieng = existsSync(`${thu}/so-${so}-dau.png`);
  const fDau = dauRieng ? `${thu}/so-${so}-dau.png` : `${thu}/so-${so}-that.png`, fCuoi = dauRieng ? `${thu}/so-${so}-that.png` : existsSync(`${thu}/so-${so}-cuoi.png`) ? `${thu}/so-${so}-cuoi.png` : null;
  const p = prompt(so); const coCuoi = !!fCuoi; const giay = Math.max(2, Math.ceil(s.giay));
  if (xem) return console.log(`---- #${so} · ${giay}s${coCuoi ? ' · khoá cuối' : ''}\n${p}`);
  const g = await guiFal('fal-ai/vidu/q2/image-to-video/turbo', { image_url: await len(fDau, `vk-${so}`, 'image/png'), ...(fCuoi ? { end_image_url: await len(fCuoi, `vk-${so}-cuoi`, 'image/png') } : {}),
    // shot CẬN / TRUNG CẬN: biên độ 'small' — 'auto' cho máy tự lùi ra toàn thân ở nửa sau clip (26/10/2026 #7 #9 #21 #27; lùi ra còn vẽ thêm thẻ đeo trên ngực Vivian)
    prompt: p, duration: giay, resolution: '720p', movement_amplitude: ['cu', 'mcu', 'ecu', 'insert', 'ots'].includes(s.co) ? 'small' : 'auto' });
  if (!g.ok) return console.log(`#${so}: Vidu từ chối — ${g.loi}`);
  for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 10_000)); const d = await docFal(g.taskId);
    if (d.done && d.ok) { writeFileSync(`${thu}/so-${so}.mp4`, Buffer.from(await (await fetch(d.uri)).arrayBuffer())); return console.log(`#${so}: ${await len(`${thu}/so-${so}.mp4`, `video-${so}`, 'video/mp4')}`); }
    if (d.done) return console.log(`#${so}: Vidu hỏng — ${d.loi}`); }
  console.log(`#${so}: quá 20 phút`);
}
const hang = [...ds]; await Promise.all(Array.from({ length: Math.min(Number(gia('song') || 4), hang.length) }, async () => { for (let so = hang.shift(); so != null; so = hang.shift()) await motShot(so); }));
process.exit(0);
