// CONCEPT MÓN của worlds.on.tc (repo mixseomin/worlds, trang tĩnh) — cùng khuôn /api/worlds/danh-gia: trang GET/POST same-origin
// /api/concept → nginx worlds chuyển vào đây kèm cookie SSO mos2. Phục vụ card #1804 (Giang).
// Ghi vào <món>.concept trong /opt/worlds/public/tien-do/<thế giới>.json (món = phần tử ke_hoach.dac_biet / ke_hoach.ho theo "ten"),
// cùng khuôn scripts/concept.mjs: { anh: [...], chon: <chỉ số anh|null>, tham_khao: [...], ... }. Ba thứ lưu:
//   chon       — bản concept anh chọn (chỉ số trong anh[], null = bỏ chọn)
//   tham_khao  — ảnh tham khảo anh gửi (data URL) → hinh/<tg>/concept/<món>-tk-<n>.<đuôi>, nối vào concept.tham_khao
//   anh_moi    — ảnh mới sinh (data URL) → hinh/<tg>/concept/<món>-<n>.<đuôi>, nối vào concept.anh
// Route KHÔNG gọi mô hình AI (không tốn tiền) — chỉ lưu thứ trang gửi lên.
import { NextResponse } from 'next/server';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GOC = '/opt/worlds/public';
const DUOI: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const TRAN_ANH = 8 * 1024 * 1024;

type Mon = { ten?: string; concept?: Record<string, unknown> & { anh?: string[]; chon?: number | null; tham_khao?: string[] } };
type TienDo = { ke_hoach?: { dac_biet?: Mon[]; ho?: Mon[] } };

const tenTg = (x: unknown) => (typeof x === 'string' && /^[a-z0-9-]{1,60}$/.test(x) ? x : null);
const tep = (tg: string) => join(GOC, 'tien-do', `${tg}.json`);
const loi = (s: string, status = 400) => NextResponse.json({ ok: false, loi: s }, { status });
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'mon';
const docTd = async (tg: string): Promise<TienDo | null> => { try { return JSON.parse(await readFile(tep(tg), 'utf8')); } catch { return null; } };
const tatCa = (td: TienDo) => [...(td.ke_hoach?.dac_biet || []), ...(td.ke_hoach?.ho || [])];

function giaiAnh(x: unknown): { buf: Buffer; duoi: string } | string {
  if (typeof x !== 'string') return 'ảnh phải là data URL (data:image/…;base64,…).';
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(x);
  if (!m) return 'ảnh phải là data URL jpeg / png / webp.';
  const buf = Buffer.from(m[2] ?? '', 'base64');
  if (!buf.length) return 'ảnh rỗng.';
  if (buf.length > TRAN_ANH) return `ảnh quá ${TRAN_ANH / 1024 / 1024} MB.`;
  return { buf, duoi: DUOI[m[1] ?? ''] ?? 'jpg' };
}

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return loi('Chưa đăng nhập mos2.', 401);
  const q = new URL(req.url).searchParams;
  const tg = tenTg(q.get('the_gioi'));
  if (!tg) return loi('Thiếu ?the_gioi=<id thế giới>.');
  const td = await docTd(tg);
  if (!td) return loi(`Không có tien-do/${tg}.json.`, 404);
  const so: Record<string, unknown> = {};
  for (const d of tatCa(td)) if (d.ten) so[d.ten] = d.concept ?? null;
  const mon = q.get('mon');
  return NextResponse.json({ ok: true, so: mon ? { [mon]: so[mon] ?? null } : so });
}

export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!u) return loi('Chưa đăng nhập mos2.', 401);
  const b = await req.json().catch(() => null) as { the_gioi?: unknown; mon?: unknown; chon?: unknown; tham_khao?: unknown; anh_moi?: unknown } | null;
  const tg = tenTg(b?.the_gioi);
  if (!tg) return loi('Thiếu the_gioi.');
  if (typeof b?.mon !== 'string' || !b.mon.trim()) return loi('Thiếu mon (tên món trong ke_hoach).');
  const td = await docTd(tg);
  if (!td) return loi(`Không có tien-do/${tg}.json.`, 404);
  const d = tatCa(td).find((x) => x.ten === b.mon);
  if (!d) return loi(`Không có món "${b.mon}" trong ke_hoach.dac_biet / ho của ${tg}.`, 404);

  const ds = (x: unknown) => (x == null ? [] : Array.isArray(x) ? x : [x]);
  const tk = ds(b.tham_khao).map(giaiAnh), moi = ds(b.anh_moi).map(giaiAnh);
  const hong = [...tk, ...moi].find((x) => typeof x === 'string');
  if (hong) return loi(hong as string);
  if (tk.length + moi.length > 12) return loi('Tối đa 12 ảnh mỗi lần gửi.');

  const c = (d.concept ||= {});
  c.anh ||= [];
  const thu = join(GOC, 'hinh', tg, 'concept');
  if (tk.length || moi.length) await mkdir(thu, { recursive: true });
  const ten = slug(d.ten!), luc = Date.now().toString(36);
  for (const [i, a] of (moi as { buf: Buffer; duoi: string }[]).entries()) {
    const f = `${ten}-${c.anh.length + 1}-${luc}${i}.${a.duoi}`;
    await writeFile(join(thu, f), a.buf);
    c.anh.push(`hinh/${tg}/concept/${f}`);
  }
  if (tk.length) {
    c.tham_khao ||= [];
    for (const [i, a] of (tk as { buf: Buffer; duoi: string }[]).entries()) {
      const f = `${ten}-tk-${c.tham_khao.length + 1}-${luc}${i}.${a.duoi}`;
      await writeFile(join(thu, f), a.buf);
      c.tham_khao.push(`hinh/${tg}/concept/${f}`);
    }
  }
  if (b.chon !== undefined) {
    if (b.chon !== null && !(Number.isInteger(b.chon) && (b.chon as number) >= 0 && (b.chon as number) < c.anh.length)) return loi(`chon phải là chỉ số 0…${c.anh.length - 1} trong concept.anh, hoặc null.`);
    c.chon = b.chon as number | null;
  } else c.chon ??= null;
  c.nguoi = u.displayName || u.email || String(u.id);
  c.luc = new Date().toISOString();

  await writeFile(tep(tg) + '.tam', JSON.stringify(td, null, 2) + '\n');
  await rename(tep(tg) + '.tam', tep(tg));
  return NextResponse.json({ ok: true, mon: d.ten, concept: c });
}
