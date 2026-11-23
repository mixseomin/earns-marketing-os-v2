// NÚT "DỰNG 3D" + "TÁCH BỘ PHẬN" của thư viện worlds.on.tc (repo mixseomin/worlds, trang tĩnh): trang POST/GET same-origin /api/dung-3d
// → nginx worlds chuyển vào đây kèm cookie SSO mos2. Hai việc, cùng khuôn gửi → hỏi → tải → nén → lưu:
//   dung: ảnh thư viện → fal-ai/trellis (~520₫) → <id>.glb
//   tach: GLB đã dựng → R2 (fal đòi link http) → hitem3d/hi3d/split (~10.400₫) → <id>-bo-phan.glb (mỗi bộ phận một mesh)
// Lưu ở /opt/worlds-du-lieu/thu-vien-3d/ + sổ so.json (nginx worlds phục vụ /du-lieu-3d/). Mọi lượt AI qua cổng chung (@mos2/cong-ai).
// Bản CLI cùng việc trên iMac: /Users/htuan/Me/GitHub/worlds/scripts/dung-3d-anh.mjs, tach-bo-phan.mjs (khuôn nén = scripts/nen-glb.mjs).
import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { congUrl, congKhoa } from '@mos2/cong-ai';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2 } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const THU_VIEN = '/opt/worlds/public/thu-vien';
const KHO = '/opt/worlds-du-lieu/thu-vien-3d';
const SO = join(KHO, 'so.json');
const VIEC = {
  dung: { model: 'fal-ai/trellis', vnd: 520, tep: (id: string) => `${id}.glb` },
  tach: { model: 'hitem3d/hi3d/split', vnd: 10400, tep: (id: string) => `${id}-bo-phan.glb` },
} as const;
type Viec = keyof typeof VIEC;
type Ket = { tep: string; model: string; ngay: string; gia_vnd: number };
type Muc = Partial<Record<Viec, Ket>> & { dang?: { viec: Viec; task_id: string; luc: number }; loi?: string };

const docSo = async (): Promise<Record<string, Muc>> => JSON.parse(await readFile(SO, 'utf8').catch(() => '{}'));
const ghiSo = async (so: Record<string, Muc>) => { await mkdir(KHO, { recursive: true }); await writeFile(SO + '.tam', JSON.stringify(so, null, 2)); await rename(SO + '.tam', SO); };

async function cong(b: Record<string, unknown>) {
  const khoa = congKhoa();
  if (!khoa) throw new Error('máy chủ không có CONG_AI_KEY');
  const r = await fetch(congUrl(), { method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json' }, body: JSON.stringify({ viec: 'worlds:dung-3d', ...b }), signal: AbortSignal.timeout(120e3) });
  const j = await r.json().catch(() => ({ loi: `cổng AI trả ${r.status}` }));
  if (j.loi) throw new Error(String(j.loi));
  return j;
}

async function chiAdmin() {
  const u = await getCurrentUser();
  return u?.role === 'admin' ? null : NextResponse.json({ ok: false, loi: 'Chỉ admin mos2 được dựng / tách 3D (mỗi lượt tốn tiền AI).' }, { status: 403 });
}

/** Nén GLB: ảnh vân PNG nhúng → JPEG (sharp), metallicFactor 0 (TRELLIS bỏ trống → đen), ghép lại BIN canh 4 byte. */
async function nenGlb(b: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString());
  const binDau = 20 + jl + 8, bin = b.subarray(binDau, binDau + b.readUInt32LE(20 + jl));
  const phan: Buffer[] = j.bufferViews.map((v: { byteOffset?: number; byteLength: number }) => Buffer.from(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)));
  for (const im of j.images || []) {
    if (im.mimeType !== 'image/png' || im.bufferView == null) continue;
    phan[im.bufferView] = await sharp(phan[im.bufferView]).jpeg({ quality: 82 }).toBuffer();
    im.mimeType = 'image/jpeg';
  }
  for (const m of j.materials || []) { m.pbrMetallicRoughness ||= {}; m.pbrMetallicRoughness.metallicFactor = 0; }
  let off = 0; const khoi: Buffer[] = [];
  phan.forEach((p, i) => { const pad = (4 - (off % 4)) % 4; if (pad) { khoi.push(Buffer.alloc(pad)); off += pad; } j.bufferViews[i].byteOffset = off; j.bufferViews[i].byteLength = p.length; khoi.push(p); off += p.length; });
  const binMoi = Buffer.concat([...khoi, Buffer.alloc((4 - (off % 4)) % 4)]);
  j.buffers = [{ byteLength: binMoi.length }];
  let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const dau = Buffer.alloc(12), cj = Buffer.alloc(8), cb = Buffer.alloc(8);
  dau.write('glTF', 0); dau.writeUInt32LE(2, 4); dau.writeUInt32LE(12 + 8 + js.length + 8 + binMoi.length, 8);
  cj.writeUInt32LE(js.length, 0); cj.write('JSON', 4); cb.writeUInt32LE(binMoi.length, 0); cb.write('BIN\0', 4);
  return Buffer.concat([dau, cj, js, cb, binMoi]);
}

/** GLB nguyên khối của mục: bản dựng bằng nút (kho) trước, không có thì bản dựng bằng CLI trong repo worlds. */
async function glbCua(id: string, so: Record<string, Muc>, tv: { muc: { id: string; glb?: string }[] }): Promise<Buffer | null> {
  if (so[id]?.dung) return readFile(join(KHO, so[id].dung!.tep)).catch(() => null);
  const g = tv.muc.find((x) => x.id === id)?.glb;
  return g ? readFile(join(THU_VIEN, g)).catch(() => null) : null;
}

/** POST {id, viec:'dung'|'tach', lai?}: gửi lượt sang fal. Mục đang có lượt chưa xong (<20 phút) thì không gửi thêm. */
export async function POST(req: Request) {
  const chan = await chiAdmin(); if (chan) return chan;
  const { id, viec = 'dung', lai } = (await req.json().catch(() => ({}))) as { id?: string; viec?: Viec; lai?: boolean };
  if (!id || !/^[a-z0-9-]+$/.test(id) || !(viec in VIEC)) return NextResponse.json({ ok: false, loi: 'thiếu id mục hoặc việc sai' }, { status: 400 });
  const tv = JSON.parse(await readFile(join(THU_VIEN, 'index.json'), 'utf8')) as { muc: { id: string; tep: string; glb?: string }[] };
  const m = tv.muc.find((x) => x.id === id);
  if (!m) return NextResponse.json({ ok: false, loi: `không có mục "${id}" trong thư viện` }, { status: 404 });
  const so = await docSo();
  if (so[id]?.dang && Date.now() - so[id].dang!.luc < 20 * 60e3) return NextResponse.json({ ok: true, ...so[id] });
  if (so[id]?.[viec] && !lai) return NextResponse.json({ ok: true, ...so[id] });
  const v = VIEC[viec];
  try {
    let input: Record<string, unknown>;
    if (viec === 'dung') {
      const sharp = (await import('sharp')).default;
      const anh = await sharp(await readFile(join(THU_VIEN, m.tep))).resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
      input = { image_url: `data:image/jpeg;base64,${anh.toString('base64')}`, texture_size: 2048, mesh_simplify: 0.9 };
    } else {
      const glb = await glbCua(id, so, tv);
      if (!glb) return NextResponse.json({ ok: false, loi: 'Mục chưa có mô hình 3D — bấm Dựng 3D trước.' }, { status: 400 });
      const url = await uploadToR2(`worlds-3d/${id}-${randomUUID()}.glb`, glb, 'model/gltf-binary');
      if (!url) throw new Error('không tải được GLB lên R2 (fal cần link http)');
      input = { mesh_url: url, model: 'general', level: 'medium', export_format: 'glb' };
    }
    const { task_id } = await cong({ loai: 'fal_gui', model: v.model, vnd: v.vnd, ma: id, input });
    so[id] = { ...(so[id] || {}), dang: { viec, task_id, luc: Date.now() }, loi: undefined };
    await ghiSo(so);
    return NextResponse.json({ ok: true, ...so[id] });
  } catch (e) {
    return NextResponse.json({ ok: false, loi: `Không gửi được sang ${v.model}: ${(e as Error).message}` }, { status: 502 });
  }
}

/** GET ?id=: trạng thái mục; có lượt đang chạy thì hỏi cổng, xong thì tải GLB → nén → lưu. */
export async function GET(req: Request) {
  const chan = await chiAdmin(); if (chan) return chan;
  const id = new URL(req.url).searchParams.get('id') || '';
  const so = await docSo();
  const muc = so[id];
  if (!muc?.dang) return NextResponse.json({ ok: !muc?.loi, ...(muc || {}) });
  const { viec, task_id, luc } = muc.dang, v = VIEC[viec];
  try {
    const d = await cong({ loai: 'fal_doc', task_id });
    if (!d.done) return NextResponse.json({ ok: true, ...muc, giay: Math.round((Date.now() - luc) / 1000) });
    if (!d.ok) throw new Error(`fal báo hỏng: ${d.loi}`);
    const url = d.kq?.model_mesh?.url || d.kq?.model_urls?.glb?.url;
    if (!url) throw new Error(`fal không trả mô hình: ${JSON.stringify(d.kq).slice(0, 200)}`);
    const b = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(180e3) })).arrayBuffer());
    if (b.length < 1000 || b.subarray(0, 4).toString() !== 'glTF') throw new Error(`tệp trả về không phải GLB (${b.length} byte)`);
    await mkdir(KHO, { recursive: true });
    await writeFile(join(KHO, v.tep(id)), await nenGlb(b));
    so[id] = { ...muc, dang: undefined, [viec]: { tep: v.tep(id), model: v.model, ngay: new Date().toISOString().slice(0, 10), gia_vnd: v.vnd } };
    await ghiSo(so);
    return NextResponse.json({ ok: true, ...so[id] });
  } catch (e) {
    so[id] = { ...muc, dang: undefined, loi: (e as Error).message };
    await ghiSo(so);
    return NextResponse.json({ ok: false, ...so[id] }, { status: 502 });
  }
}
