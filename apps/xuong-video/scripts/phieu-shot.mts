// PHIẾU PROMPT TỪ SƠ ĐỒ SHOT — vỏ đọc tệp: dữ liệu sơ đồ (so-do/<cảnh>.json) + SỔ ĐỒ VẬT của cảnh (xv_tap.khong_gian, --tap) → phieuShot của lõi
// studio (src/lib/xuong-video/phieu-shot.ts — một nguồn với bang-gom.mts). Cảnh báo khi sơ đồ vẽ đồ lệch sổ (sổ là nguồn đúng).
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && set -a; . ../../.env.production; set +a; NODE_OPTIONS=--conditions=react-server \
//     ../../node_modules/.bin/tsx scripts/phieu-shot.mts scripts/so-do/thang-may-356.json scripts/so-do/thang-may-356-phieu.md --tap=356
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { MaBieuCam } from '../src/lib/xuong-video/qc-cam-xuc';
import { trangThai } from '../src/lib/xuong-video/so-vat';
import { phieuShot as phieuLoi, type ShotPhieu } from '../src/lib/xuong-video/phieu-shot';
import type { KhongGian } from '../src/lib/xuong-video/khong-gian';

type Nguoi = { ma: string; x: number; lung?: boolean; mat?: [MaBieuCam, MaBieuCam]; quay?: number; nhin_vao?: string; nhin_huong?: string; cam?: string[]; deo?: string[] };
export type Shot = { so: number; /** biến thể trang phục theo mã người (id xv_bien_the) — đè bien_the của bảng */ bien_the?: Record<string, number>; so_cu?: number; giay: number; co: string; goc?: string; nguoi?: Nguoi[]; do?: { loai: string }[]; dien_en?: string; thoai?: string };
export type BangShot = { /** biến thể trang phục mặc định của cảnh theo mã người */ bien_the?: Record<string, number>; phan_doan?: string; vat_so?: Record<string, string>; ten_vat_en?: Record<string, string>; canh_en: string;
  nhan_vat: Record<string, { en: string; nhan: string; gioi?: string; ten_db?: string }>; shot: Shot[] };

/** Một shot của bảng sơ đồ → khuôn của lõi (tên theo danh sách nhân vật / sổ đồ vật). */
/** taDb: tả NGƯỜI theo studio (mô tả gốc + biến thể trang phục của shot) — có thì thay câu tả nháp trong bảng. */
export function sangPhieu(b: BangShot, s: Shot, taDb?: Record<string, string>): ShotPhieu {
  const ten = (m: string) => b.nhan_vat[m]?.ten_db ?? b.vat_so?.[m] ?? b.ten_vat_en?.[m] ?? m;
  const ng = s.nguoi ?? []; const noi = ng.find((n) => !n.lung);
  return { co: s.co, goc: s.goc as ShotPhieu['goc'], so_cu: s.so_cu, dien_en: s.dien_en, khai: (s.do ?? []).map((o) => b.vat_so?.[o.loai]).filter((x): x is string => !!x),
    thoai: s.thoai && noi ? { ai: ten(noi.ma), loi: s.thoai } : null, may_dong: /push-in|đẩy chậm/i.test(s.dien_en ?? '') ? 'Very slow push-in, no other camera move.' : undefined,
    nguoi: ng.map((n) => ({ ten: ten(n.ma), ta: taDb?.[ten(n.ma)] ?? b.nhan_vat[n.ma]?.en, x: n.x, lung: n.lung, mat: n.mat, quay: n.quay, nam: b.nhan_vat[n.ma]?.gioi === 'nam',
      nhin_vao: n.nhin_vao === 'phia_truoc' ? undefined : n.nhin_vao ? ten(n.nhin_vao) : undefined, nhin_huong: (n.nhin_vao === 'phia_truoc' ? 'truoc' : n.nhin_huong) as ShotPhieu['nguoi'][number]['nhin_huong'] })) };
}
export function phieuShot(b: BangShot, s: Shot, kg?: KhongGian | null, db?: { ta?: Record<string, string>; vat_ta?: Record<string, string> }): string {
  return phieuLoi(sangPhieu(b, s, db?.ta), { canh_en: b.canh_en, so_vat: kg?.so_vat, vat_ta: db?.vat_ta, ten_en: { ...Object.fromEntries(Object.entries(b.ten_vat_en ?? {}).map(([k, v]) => [b.vat_so?.[k] ?? k, v])), ...(kg?.ten_en ?? {}) } });   // tên của SỔ thắng tên nháp
}
/** Sơ đồ vẽ đồ khác sổ (người đeo / cầm món mà sổ nói không phải họ) → cảnh báo. */
export function lechSo(b: BangShot, kg: KhongGian): string[] {
  const loi: string[] = []; const so = kg.so_vat ?? {};
  for (const s of b.shot) { if (s.so_cu == null) { loi.push(`#${s.so}: thiếu so_cu`); continue; }
    const tt = trangThai(so, s.so_cu, 'ket');
    for (const n of s.nguoi ?? []) for (const k of [...(n.deo ?? []), ...(n.cam ?? [])]) { const mon = b.vat_so?.[k.split('_')[0]!]; const ai = b.nhan_vat[n.ma]?.ten_db;
      if (mon && tt[mon] && tt[mon]!.ai !== ai) loi.push(`#${s.so}: sơ đồ vẽ ${ai} có "${mon}" nhưng sổ ghi ${tt[mon]!.ai ?? 'không ai'} giữ`); } }
  return loi;
}
/** Sổ không gian (gồm SỔ ĐỒ VẬT) của một cảnh trong tập — xv_tap.khong_gian[phan_doan]. */
export async function khongGianTap(tapId: number, phanDoan: string): Promise<KhongGian | null> {
  const { sql } = await import('drizzle-orm'); const { getDb } = await import('@mos2/db');
  const r = (await getDb()!.execute(sql`SELECT khong_gian FROM xv_tap WHERE id = ${tapId}`)) as unknown as { khong_gian: Record<string, KhongGian> | null }[];
  return r[0]?.khong_gian?.[phanDoan] ?? null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [vao, ra] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  const b = JSON.parse(readFileSync(vao!, 'utf8')) as BangShot;
  const tap = Number(process.argv.find((x) => x.startsWith('--tap='))?.slice(6)); const kg = tap ? await khongGianTap(tap, b.phan_doan ?? '') : null;
  if (kg) for (const l of lechSo(b, kg)) console.error(`LỆCH SỔ: ${l}`);
  const md = b.shot.map((s) => `### #${s.so} · ${s.giay}s · ${s.co}\n\n\`\`\`\n${phieuShot(b, s, kg)}\n\`\`\``).join('\n\n');
  if (ra) writeFileSync(ra, `# Phiếu prompt — ${vao}\n\n${md}\n`); else console.log(md);
  process.exit(0);   // kết nối DB (--tap) giữ tiến trình sống
}
