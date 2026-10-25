// BÀI THỬ MODEL CÓ ẢNH THAM CHIẾU NHÂN VẬT (anh 25/10/2026 "kiểm tra hết các model khác"). Ca thử = cụm mà Veo Lite (chỉ khung mở) BỊA người: nhân vật của
// cụm không có trong khung mở (phim #353 #13–#14: khung mở cận Hạ, shot sau Vivian). Ba model cùng prompt cụm (cum-shot.ts › promptCum):
//   K. Veo 3.1 Lite · Kie REFERENCE_2_VIDEO — 1–3 ảnh tham chiếu (người + bối cảnh), không khung mở, clip 8s
//   V. Vidu Q2 · fal reference-to-video — tới 7 ảnh tham chiếu, không khung mở, 1–8s
//   O. Kling O3 Std · fal reference-to-video — element mỗi người (ảnh chính diện + phụ) + KHUNG MỞ (start_image_url), nhiều prompt nối nhau
// Ảnh người = biến thể trang phục của shot (canh.bien_the — vd Hạ không thẻ sau cú giật) → ảnh sát mặt → ảnh mẫu. Không đụng clip của bản phim.
// Ra: 3 clip + một video ba bản cạnh nhau (K | V | O) trên kho. Tốn (25/10/2026): Kie Veo Lite 4.550₫ · Vidu 720p $0,30 · Kling $0,084/giây. Cần DUYET_SINH_1_LAN=1.
//   … tsx scripts/thu-tham-chieu.mts --tap=356 --tu=13 --den=14 [--chi=K,V,O]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { boiCanhCanh, mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { docVideoCong } from '../src/lib/xuong-video/cong-ai';
import { guiFal, docFal } from '../src/lib/xuong-video/fal';
import { promptCum } from '../src/lib/xuong-video/cum-shot';
import { giayPhat, type NhanVat, type Canh } from '../src/lib/xuong-video/kieu';
import { uploadToR2 } from '../src/lib/r2';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tap = Number(gia('tap')), tu = Number(gia('tu')), den = Number(gia('den')); const chi = (gia('chi') || 'K,V,O').split(',');
if (!tap || !tu || !den) { console.error('cần --tap --tu --den'); process.exit(1); }
if (!process.env.DUYET_SINH_1_LAN) { console.error('tốn tiền — cần DUYET_SINH_1_LAN=1'); process.exit(2); }
const db = getDb()!; const thu = `/tmp/thu-tham-chieu-${tap}-${tu}-${den}`; mkdirSync(thu, { recursive: true });
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND thu_tu BETWEEN ${tu} AND ${den} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
const bc = (await Promise.all(ds.map((c) => boiCanhCanh(db, c.id)))).map((b) => b!);
const tongGiay = ds.reduce((s, c) => s + giayPhat(c), 0);

/** Ảnh một người cho shot: biến thể đang mặc ở shot → ảnh sát mặt → ảnh mẫu. */
const anhNguoi = (v: NhanVat, c: Canh): string[] => {
  const bt = (v.bien_the ?? []).find((b) => c.bien_the.includes(b.id) && b.anh_url)?.anh_url;
  return [...new Set([bt, ...(v.anh_mat?.url ?? []).slice(0, 1), ...v.anh_ref].filter((x): x is string => !!x))];
};
// người của cụm theo lần xuất hiện đầu; ảnh lấy ở shot ĐẦU TIÊN người đó có mặt (đúng trang phục lúc đó)
const nguoi: { v: NhanVat; anh: string[] }[] = [];
for (const [i, b] of bc.entries()) for (const v of b.nhanVat.filter((x) => x.loai === 'nhan_vat')) if (!nguoi.some((n) => n.v.id === v.id)) nguoi.push({ v, anh: anhNguoi(v, ds[i]!) });
const boiCanh = ds[0]!.keyframe_url!;   // khung đã duyệt của shot đầu = hình bối cảnh
const goi = nguoi.map((n, i) => `Reference image ${i + 1} is ${n.v.ten}`).join('; ');
const pr = promptCum(bc.map((b) => ({ canh: b.canh, nhanVat: b.nhanVat })));
console.log(`cụm #${tu}–#${den} · ${tongGiay}s · người: ${nguoi.map((n) => `${n.v.ten} (${n.anh[0]?.split('/').pop()})`).join(', ')}`);

async function cho(nhan: string, doc: () => Promise<{ done: boolean; ok?: boolean; uri?: string; loi?: string }>): Promise<string | null> {
  for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 10_000)); const d = await doc();
    if (d.done && d.ok && d.uri) { const f = `${thu}/${nhan}.mp4`; writeFileSync(f, Buffer.from(await (await fetch(d.uri)).arrayBuffer())); console.log(`  ${nhan}: xong`); return f; }
    if (d.done) { console.log(`  ${nhan}: hỏng — ${d.loi}`); return null; } }
  console.log(`  ${nhan}: quá 20 phút`); return null;
}
async function K(): Promise<string | null> {
  const anh = [...nguoi.map((n) => n.anh[0]!), boiCanh].slice(0, 3);
  const r = await fetch('https://api.kie.ai/api/v1/jobs/createTask', { method: 'POST', headers: { authorization: `Bearer ${process.env.KIE_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'veo-3-1', input: { prompt: `${goi}${anh.length > nguoi.length ? `; reference image ${anh.length} is the location` : ''}. ${pr}`, model: 'veo3_lite', image_urls: anh, generation_type: 'REFERENCE_2_VIDEO', aspect_ratio: '9:16', resolution: '720p', duration: 8 } }) });
  const j = (await r.json().catch(() => ({}))) as { code?: number; msg?: string; data?: { taskId?: string } };
  if (j.code !== 200 || !j.data?.taskId) { console.log(`  K: Kie từ chối — ${j.code} ${j.msg}`); return null; }
  const tao = new Date().toISOString(); return cho('K', () => docVideoCong('kie', j.data!.taskId!, tao));
}
async function V(): Promise<string | null> {
  const anh = [...nguoi.flatMap((n) => n.anh.slice(0, 2)), boiCanh].slice(0, 7);
  const g = await guiFal('fal-ai/vidu/q2/reference-to-video', { prompt: `${goi}. ${pr}`.slice(0, 3000), reference_image_urls: anh, duration: Math.min(8, Math.ceil(tongGiay) + 1), resolution: '720p', aspect_ratio: '9:16' });   // Vidu nhận SỐ (422 với chuỗi)
  if (!g.ok) { console.log(`  V: fal từ chối — ${g.loi}`); return null; }
  return cho('V', () => docFal(g.taskId));
}
async function O(): Promise<string | null> {
  const el = nguoi.map((n, i) => ({ ma: `@Element${i + 1}`, ten: n.v.ten }));
  const doiTen = (t: string) => el.reduce((x, e) => x.split(e.ten).join(e.ma), t);
  // giây từng shot ≥ 1, nguyên; mỗi prompt ≤ ~480 ký tự (giới hạn 512 của model, ref2v-canh.ts)
  const mp = bc.map((b) => ({ prompt: doiTen(`${b.canh.dan_dung?.mo ?? b.canh.canh} → ${b.canh.dan_dung?.ket ?? ''}`).replace(/\s*(OBJECT STATE|BODY POSE|POSE)[\s\S]*$/, '').slice(0, 470), duration: String(Math.max(1, Math.round(giayPhat(b.canh)))) }));
  const tong = mp.reduce((s, x) => s + Number(x.duration), 0);
  const g = await guiFal('fal-ai/kling-video/o3/standard/reference-to-video', { multi_prompt: mp, shot_type: 'customize', duration: String(Math.max(3, Math.min(15, tong))), aspect_ratio: '9:16', generate_audio: false,
    start_image_url: boiCanh, elements: nguoi.map((n) => ({ frontal_image_url: n.anh[0], reference_image_urls: n.anh.length > 1 ? n.anh.slice(1, 4) : [n.anh[0]] })) });
  if (!g.ok) { console.log(`  O: fal từ chối — ${g.loi}`); return null; }
  return cho('O', () => docFal(g.taskId));
}
const chay: Record<string, () => Promise<string | null>> = { K, V, O };
const kq = await Promise.all(chi.map((x) => chay[x]!()));   // ba cổng khác nhau → song song
const co = chi.filter((_, i) => kq[i] && existsSync(kq[i]!)).map((x) => `${thu}/${x}.mp4`);
const ff = (args: string[]) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { timeout: 300_000 });
for (const f of co) { const u = await uploadToR2(`xuong-video/thu/${tap}-thamchieu-${f.split('/').pop()!.replace('.mp4', '')}-${randomUUID()}.mp4`, readFileSync(f), 'video/mp4'); console.log(`  ${f.split('/').pop()}: ${u}`);
  ff(['-i', f, '-vf', 'fps=2,scale=160:-1,tile=8x2', '-frames:v', '1', f.replace('.mp4', '-to.jpg')]); }
if (co.length > 1) { const ra = `${thu}/so-sanh.mp4`;
  ff([...co.flatMap((f) => ['-i', f]), '-filter_complex', `${co.map((_, i) => `[${i}:v]scale=360:640,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=15[v${i}]`).join(';')};${co.map((_, i) => `[v${i}]`).join('')}hstack=${co.length},trim=0:15[o]`, '-map', '[o]', '-c:v', 'libx264', '-preset', 'veryfast', ra]);
  console.log(`\nSO SÁNH (${co.map((f) => f.split('/').pop()!.replace('.mp4', '')).join(' | ')}): ${await uploadToR2(`xuong-video/thu/${tap}-thamchieu-${randomUUID()}.mp4`, readFileSync(ra), 'video/mp4')}`); }
process.exit(0);
