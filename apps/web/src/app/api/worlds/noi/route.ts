// Ô GÕ CHỮ của worlds.on.tc/xem-nhan-vat.html: gõ một câu → nhân vật nói câu đó với cơ mặt (anh 26/11/2026 "thêm gõ chữ trên màn").
// Trang POST same-origin /api/noi {chu, cam?, giong?} → nginx worlds chuyển vào đây kèm cookie SSO mos2.
//   1. tiếng: cổng AI chung loai 'giong' (ElevenLabs, ~156₫/câu)
//   2. cơ mặt: /opt/worlds/scripts/a2f-mat.py (Audio2Face-3D ONNX trên CPU box3, mô hình /opt/a2f, ~2 giây xử lý / 1 giây tiếng, ~2 GB RAM)
// Kết quả lưu /opt/worlds-du-lieu/giong/<băm>.mp3 + <băm>-mat.json (nginx worlds phục vụ /du-lieu-giong/); cùng câu + cảm + giọng gõ lại thì dùng lại, không trả tiền lần nữa.
// Bản CLI cùng việc trên iMac (câu cố định của nhân vật): /Users/htuan/Me/GitHub/worlds/scripts/giong-nhan-vat.mjs
import { NextResponse } from 'next/server';
import { writeFile, mkdir, access, rename, appendFile, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { congUrl, congKhoa } from '@mos2/cong-ai';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KHO = '/opt/worlds-du-lieu/giong';
const PY = '/opt/a2f/.venv/bin/python';
const A2F = '/opt/worlds/scripts/a2f-mat.py';
const TRAN_CHU = 300;   // một câu thoại; dài hơn thì từ chối thành lời (Audio2Face 2 GB RAM, tiếng dài làm box3 hết bộ nhớ)
// cảm xúc bộ nhà (bo-cam.json) → cảm xúc Audio2Face; mức giữ nguyên ("vui:0.4" → joy:0.4). Cùng bảng với giong-nhan-vat.mjs.
const A2F_CAM: Record<string, string> = { vui: 'joy', gian: 'anger', soi: 'anger', dau: 'pain', giat: 'amazement', buon: 'sadness', so: 'fear' };
let dang: Promise<unknown> = Promise.resolve();   // một câu một lúc: hai lượt Audio2Face song song = 4 GB, box3 không đủ
const chay = promisify(execFile);
const co = (p: string) => access(p).then(() => true, () => false);

// LỊCH SỬ (anh 26/11/2026 "sinh xong phải lưu vào lịch sử để xem lại"): mỗi câu nói xong ghi một dòng vào KHO/lich-su.jsonl; GET trả danh sách mới nhất trước.
const SO = join(KHO, 'lich-su.jsonl');
type Dong = { bam: string; chu: string; cam: string; giong: string; vnd: number; nv?: string; luc?: string };   // nv = tên nhân vật (osane, ilo…): mỗi nhân vật một lịch sử
const ghiSo = (d: Dong) => appendFile(SO, JSON.stringify({ ...d, luc: new Date().toISOString() }) + '\n');

export async function GET(req: Request) {
  const nv = new URL(req.url).searchParams.get('nv') || '';
  const u = await getCurrentUser();
  if (u?.role !== 'admin') return NextResponse.json({ ok: false, loi: 'Chỉ admin mos2 xem được lịch sử câu đã sinh.' }, { status: 403 });
  const dong = (await readFile(SO, 'utf8').catch(() => '')).split('\n').filter(Boolean).map((x) => { try { return JSON.parse(x) as Dong; } catch { return null; } }).filter((x): x is Dong => !!x);
  const moi = new Map<string, Dong>(); for (const d of dong) { if (nv && (d.nv || 'osane') !== nv) continue; moi.delete(d.bam); moi.set(d.bam, d); }   // cùng câu nói lại → đưa lên đầu, không lặp
  const ds = [...moi.values()].reverse().map((d) => ({ ...d, am: `/du-lieu-giong/${d.bam}.mp3`, mat: `/du-lieu-giong/${d.bam}-mat.json` }));
  return NextResponse.json({ ok: true, ds });
}

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (u?.role !== 'admin') return NextResponse.json({ ok: false, loi: 'Chỉ admin mos2 được cho nhân vật nói câu mới (mỗi câu tốn ~156₫ tiền giọng).' }, { status: 403 });
  const { chu = '', cam = '', giong = 'Charlotte', nv: nvVao = '' } = (await req.json().catch(() => ({}))) as { chu?: string; cam?: string; giong?: string; nv?: string };
  const nv = /^[a-z0-9-]{1,30}$/.test(nvVao) ? nvVao : '';
  const c = chu.trim();
  if (!c) return NextResponse.json({ ok: false, loi: 'Chưa gõ câu nào.' }, { status: 400 });
  if (c.length > TRAN_CHU) return NextResponse.json({ ok: false, loi: `Câu dài ${c.length} ký tự, tối đa ${TRAN_CHU}. Tách thành nhiều câu ngắn.` }, { status: 400 });
  if (!/^[A-Za-z ]{1,40}$/.test(giong) || !/^[a-z0-9:. ]{0,40}$/.test(cam)) return NextResponse.json({ ok: false, loi: 'giọng hoặc cảm xúc sai dạng' }, { status: 400 });
  const [camTen = '', camMuc = ''] = (cam.trim().split(/\s+/)[0] ?? '').split(':');
  const e = A2F_CAM[camTen] ? `${A2F_CAM[camTen]}:${Math.min(1, +camMuc || 0.6)}` : '';
  const bam = createHash('sha1').update(`${giong}|${e}|${c}`).digest('hex').slice(0, 16);
  const mp3 = join(KHO, `${bam}.mp3`), mat = join(KHO, `${bam}-mat.json`), ket = { ok: true, am: `/du-lieu-giong/${bam}.mp3`, mat: `/du-lieu-giong/${bam}-mat.json`, chu: c, cam };
  if (await co(mat)) { await ghiSo({ bam, chu: c, cam, giong, vnd: 0, nv }); return NextResponse.json({ ...ket, vnd: 0, lai: true }); }
  const viec = dang.then(async () => {
    let vnd = 0;
    await mkdir(KHO, { recursive: true });
    if (!(await co(mp3))) {
      const khoa = congKhoa(); if (!khoa) throw new Error('máy chủ không có CONG_AI_KEY');
      const r = await fetch(congUrl(), { method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(120e3),
        body: JSON.stringify({ viec: 'worlds:noi', loai: 'giong', chu: c, giong, engine: 'v3', language: 'vi' }) });
      const j = await r.json().catch(() => ({ loi: `cổng AI trả ${r.status}` }));
      if (!r.ok || j.loi) throw new Error(`tiếng: ${j.loi || r.status}`);
      await writeFile(mp3 + '.tam', Buffer.from(j.am_b64, 'base64')); await rename(mp3 + '.tam', mp3);
      vnd = Math.round((j.chi_usd || 0) * 26000);
    }
    await chay(PY, [A2F, mp3, mat + '.tam', e], { env: { ...process.env, A2F_DIR: '/opt/a2f' }, timeout: 180e3 })
      .catch((x) => { throw new Error(`cơ mặt Audio2Face: ${String(x.stderr || x.message).trim().split('\n').pop()}`); });
    await rename(mat + '.tam', mat);
    return vnd;
  });
  dang = viec.catch(() => null);
  try { const vnd = await viec; await ghiSo({ bam, chu: c, cam, giong, vnd, nv }); return NextResponse.json({ ...ket, vnd }); }
  catch (x) { return NextResponse.json({ ok: false, loi: (x as Error).message }, { status: 502 }); }
}
