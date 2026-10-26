// ANIMATIC TỪ SƠ ĐỒ SHOT (anh 26/10/2026: quy trình làm mới — duyệt nhịp TRƯỚC khi trả tiền ảnh / video; luat-dung › animatic_duyet_nhip).
// Mỗi shot: khung sơ đồ ĐẦU (→ CUỐI nếu nét mặt đổi / đầu bắt đầu quay) đúng số giây phát, phụ đề thoại / lời kể, giọng + tiếng động. 0đ phần hình.
//   Giọng thoại: dòng thoại CÙNG NGUYÊN VĂN đã có trong tập (--tap) thì dùng lại tệp; câu bị chia hai shot thì tách tệp ở chỗ ngắt câu (silencedetect).
//   Lời kể (ke) chưa có tệp → sinh (fal ElevenLabs v3, giọng --giong-ke, mặc định Sarah), nhớ vào <bảng>.am.json để chạy lại không trả tiền lần nữa.
//   Tiếng động: am_thanh_url của shot tập cũ ứng với so_cu (mỗi mảnh cũ dùng một lần).
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/animatic-so-do.mts --bang=scripts/so-do/thang-may-356.json --tap=356 --ra=/tmp/animatic-356.mp4
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { svgSoDoShot, type VeShot } from '../src/lib/xuong-video/so-do-shot';

const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const tepBang = gia('bang')!; const ra = gia('ra') ?? '/tmp/animatic.mp4'; const tap = Number(gia('tap') || 0);
if (!tepBang) { console.error('cần --bang'); process.exit(1); }
type N = { ma: string; x: number; lung?: boolean; quay?: number; nhin_vao?: string; nhin_huong?: string; mat?: [string, string]; cam?: string[]; deo?: string[] };
type S = { so: number; so_cu?: number; /** tiếng hiệu ứng của studio: public/sfx/<key>.mp3 (dung-sfx.mjs) */ sfx?: string; giay: number; co: string; goc?: string; nguoi?: N[]; do?: { loai: string }[]; dien?: string; thoai?: string; ke?: string };
const b = JSON.parse(readFileSync(tepBang, 'utf8')) as { ten: string; vat_so?: Record<string, string>; ten_vat_vi?: Record<string, string>; nhan_vat: Record<string, { ao: string; toc?: string; ten_db?: string }>; shot: S[] };
const thu = `/tmp/animatic-${tepBang.replace(/\W+/g, '-')}`; mkdirSync(thu, { recursive: true });
const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const dai = (f: string) => Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());
const tai = (u: string, f: string) => { if (!existsSync(f)) execFileSync('curl', ['-sfL', '-o', f, u]); return f; };

// ---- hình: VeShot từ bảng (cùng cách ve-so-do.mts) ----
const ten = (m: string) => b.nhan_vat[m]?.ten_db ?? b.vat_so?.[m] ?? b.ten_vat_vi?.[m] ?? m;
const mon = (k: string) => b.vat_so?.[k.split('_')[0]!] ?? b.ten_vat_vi?.[k] ?? k;
const ve = (s: S, luc: 'dau' | 'ket'): VeShot => ({ so: s.so, co: s.co, goc: s.goc, luc, khai: (s.do ?? []).map((o) => mon(o.loai)),
  nguoi: (s.nguoi ?? []).map((n) => ({ ten: ten(n.ma), x: n.x, lung: n.lung, quay: n.quay, ao: b.nhan_vat[n.ma]?.ao ?? '#888', toc: b.nhan_vat[n.ma]?.toc as never,
    mat: n.mat ? (luc === 'ket' ? [n.mat[1], n.mat[1]] : [n.mat[0], n.mat[0]]) : undefined,
    nhin_vao: n.nhin_vao === 'phia_truoc' ? null : n.nhin_vao ? ten(n.nhin_vao) : null,
    nhin_huong: ({ trai: -1, phai: 1, len: 'len', xuong: 'xuong' } as Record<string, -1 | 1 | 'len' | 'xuong'>)[n.nhin_huong ?? ''] ?? (n.quay ? (n.quay > 0 ? 1 : -1) : 0),
    do: [...(n.deo ?? []).map((k) => ({ mon: mon(k), cam: false })), ...(n.cam ?? []).map((k) => ({ mon: mon(k), cam: true }))] })) });
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ngat = (t: string, n = 28) => { const o: string[] = []; let d = ''; for (const w of t.split(/\s+/)) { if ((d + ' ' + w).trim().length > n) { o.push(d); d = w; } else d = `${d} ${w}`.trim(); } if (d) o.push(d); return o; };
async function khung(s: S, luc: 'dau' | 'ket', f: string) {
  const sub = s.thoai ? s.thoai : s.ke ? `(kể) ${s.ke.replace(/\s*\(nháp\)\s*$/, '')}` : '';
  const dong = ngat(sub);
  // toạ độ theo viewBox 360 × 640 của sơ đồ (ảnh ra 720 × 1280)
  const phu = dong.map((t, i) => `<text x="180" y="${562 - (dong.length - 1 - i) * 23}" font-size="18" font-weight="700" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" font-family="DejaVu Sans, Arial, sans-serif">${esc(t)}</text>`).join('');
  const nhan = `<rect x="0" y="605" width="360" height="35" fill="#000" opacity="0.6"/><text x="8" y="627" font-size="13" fill="#ddd" font-family="DejaVu Sans, Arial, sans-serif">${esc(`#${s.so} · ${s.giay}s · ${(s.dien ?? '').slice(0, 44)}`)}</text>`;
  const svg = svgSoDoShot(ve(s, luc)).replace(/width="360" height="640"/, 'width="720" height="1280"').replace('</svg>', '') ;
  await sharp(Buffer.from(`${svg}<g>${phu}${nhan}</g></svg>`)).png().toFile(f);
}

// ---- tiếng: thoại có sẵn trong tập, lời kể sinh một lần, tiếng động theo so_cu ----
type Dong = { loi: string; url?: string; nhan_vat?: string };
const tapThoai: { thu_tu: number; thoai: Dong[]; am?: string | null }[] = [];
if (tap) { const { sql } = await import('drizzle-orm'); const { getDb } = await import('@mos2/db');
  for (const r of (await getDb()!.execute(sql`SELECT thu_tu, thoai, am_thanh_url FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as { thu_tu: number; thoai: Dong[] | null; am_thanh_url: string | null }[])
    tapThoai.push({ thu_tu: r.thu_tu, thoai: r.thoai ?? [], am: r.am_thanh_url }); }
const chuan = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
/** Khoảng lặng của tệp tiếng: [bắt đầu, kết thúc] (ffmpeg silencedetect — ffmpeg in ra stderr). */
const khoangLang = (f: string): [number, number][] => { const t = execFileSync('sh', ['-c', `ffmpeg -i '${f}' -af silencedetect=n=-35dB:d=0.2 -f null - 2>&1`]).toString();
  const a = [...t.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1])), z = [...t.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1])); return a.map((x, k) => [x, z[k] ?? x] as [number, number]); };
/** Tệp giọng của câu `loi`: khớp nguyên dòng thoại đã có trong tập, hoặc là MỘT CÂU của dòng dài — tách ở (số câu − 1) khoảng lặng DÀI NHẤT (chỗ ngắt câu dài hơn
 *  chỗ ngắt dấu phẩy), không sinh lại giọng. */
function giongCo(loi: string, f: string): string | null {
  for (const r of tapThoai) for (const d of r.thoai) { if (!d.url || !d.loi) continue;
    if (chuan(d.loi) === chuan(loi)) return tai(d.url, f);
    const cau = d.loi.split(/(?<=[.!?…])\s+/); const i = cau.findIndex((c) => chuan(c) === chuan(loi)); if (i < 0 || cau.length < 2) continue;
    const goc = tai(d.url, `${f}.goc.mp3`); const tong = dai(goc);
    const lang = khoangLang(goc).filter(([a, z]) => a > 0.2 && z < tong - 0.1).sort((x, y) => (y[1] - y[0]) - (x[1] - x[0])).slice(0, cau.length - 1).sort((x, y) => x[0] - y[0]);
    if (lang.length < cau.length - 1) continue;
    const dau = i === 0 ? 0 : (lang[i - 1]![0] + lang[i - 1]![1]) / 2, het = i === cau.length - 1 ? tong : (lang[i]![0] + lang[i]![1]) / 2;
    sh('ffmpeg', ['-loglevel', 'error', '-y', '-i', goc, '-ss', dau.toFixed(3), '-to', het.toFixed(3), f]); return f;
  }
  return null;
}
const amNho = `${tepBang}.am.json`; const nho: Record<string, string> = existsSync(amNho) ? JSON.parse(readFileSync(amNho, 'utf8')) : {};
async function sinhKe(loi: string, f: string): Promise<string | null> {
  if (nho[loi]) return tai(nho[loi]!, f);
  if (!process.env.DUYET_SINH_1_LAN) { console.log(`lời kể chưa có tệp, bỏ qua (cần DUYET_SINH_1_LAN=1 để sinh): ${loi}`); return null; }
  // đường chạy âm chuẩn của studio (viec-am.ts › chayViecAm — tự tìm khoá tệp âm thanh trong kết quả fal, đẩy lên R2); 26/10/2026 docFal chỉ đọc video → mất tệp
  const { chayViecAm } = await import('../src/lib/xuong-video/viec-am'); const { dauVaoGiongTheoModel } = await import('../src/lib/xuong-video/giong');
  const model = 'fal-ai/elevenlabs/tts/eleven-v3';
  const r = await chayViecAm({ kieu: 'am', job: 0, model, thuMuc: 'thoai/animatic', input: await dauVaoGiongTheoModel(model, { text: loi, voice: gia('giong-ke') ?? 'Sarah', ngonNgu: 'vi', camXuc: 0, theLoai: 'phim_doc' }) });
  if (!r.ok) { console.log(`lời kể hỏng — ${r.loi}`); return null; }
  nho[loi] = r.url; writeFileSync(amNho, JSON.stringify(nho, null, 1)); return tai(r.url, f);
}

const daDungAm = new Set<number>(); const doan: { v: string; a: string; d: number }[] = [];
for (const s of b.shot) {
  const g = s.thoai ? giongCo(s.thoai, `${thu}/g-${s.so}.mp3`) : s.ke ? await sinhKe(s.ke.replace(/\s*\(nháp\)\s*$/, ''), `${thu}/k-${s.so}.mp3`) : null;
  const dg = g ? dai(g) : 0; const d = Math.max(s.giay, dg ? dg + 0.25 : 0);
  const kho = s.sfx ? new URL(`../public/sfx/${s.sfx}.mp3`, import.meta.url).pathname : null;
  const cu = tapThoai.find((r) => r.thu_tu === s.so_cu); const sfx = kho && existsSync(kho) ? kho : cu?.am && !daDungAm.has(s.so_cu!) ? tai(cu.am, `${thu}/s-${s.so_cu}.mp3`) : null; if (sfx && !kho) daDungAm.add(s.so_cu!);
  const doi = (s.nguoi ?? []).some((n) => n.mat && n.mat[0] !== n.mat[1]);
  await khung(s, 'dau', `${thu}/f-${s.so}-a.png`); if (doi) await khung(s, 'ket', `${thu}/f-${s.so}-b.png`);
  const v = `${thu}/v-${s.so}.mp4`, a = `${thu}/a-${s.so}.wav`;
  const vin = doi ? ['-loop', '1', '-t', String(d * 0.55), '-i', `${thu}/f-${s.so}-a.png`, '-loop', '1', '-t', String(d * 0.45 + 0.3), '-i', `${thu}/f-${s.so}-b.png`] : ['-loop', '1', '-t', String(d), '-i', `${thu}/f-${s.so}-a.png`];
  sh('ffmpeg', ['-loglevel', 'error', '-y', ...vin, '-filter_complex', doi ? `[0][1]xfade=transition=fade:duration=0.3:offset=${(d * 0.55 - 0.15).toFixed(2)},fps=24,format=yuv420p[v]` : '[0]fps=24,format=yuv420p[v]', '-map', '[v]', '-t', String(d), v]);
  const ain = ['-f', 'lavfi', '-t', String(d), '-i', 'anullsrc=r=44100:cl=stereo', ...(g ? ['-i', g] : []), ...(sfx ? ['-i', sfx] : [])];
  const mix = ['[0]'].concat(g ? ['[1]adelay=100|100'] : [], sfx ? [`[${g ? 2 : 1}]volume=0.45`] : []);
  const loc = mix.map((x, i) => (i === 0 ? '' : `${x}[m${i}];`)).join('') + `[0]${mix.slice(1).map((_, i) => `[m${i + 1}]`).join('')}amix=inputs=${mix.length}:duration=first:normalize=0[a]`;
  sh('ffmpeg', ['-loglevel', 'error', '-y', ...ain, '-filter_complex', loc, '-map', '[a]', '-t', String(d), a]);
  doan.push({ v, a, d }); console.log(`#${s.so} ${d.toFixed(2)}s${g ? ' · giọng' : ''}${sfx ? ' · tiếng động' : ''}${doi ? ' · đầu→cuối' : ''}`);
}
writeFileSync(`${thu}/v.txt`, doan.map((x) => `file '${x.v}'`).join('\n')); writeFileSync(`${thu}/a.txt`, doan.map((x) => `file '${x.a}'`).join('\n'));
sh('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${thu}/v.txt`, '-f', 'concat', '-safe', '0', '-i', `${thu}/a.txt`, '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-shortest', ra]);
console.log(ra, `${doan.reduce((t, x) => t + x.d, 0).toFixed(1)}s`, `${doan.length} shot`);
process.exit(0);
