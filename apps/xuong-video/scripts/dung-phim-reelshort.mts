// DỰNG PHIM MỚI THEO CÁCH ReelShort, KHÔNG 3D (0đ; anh 23/10/2026: "làm 1 film studio mới độc lập không 3D làm theo cách mới" — tham-khao/reelshort.md):
// chép nhân vật + đạo cụ + biến thể (ảnh mẫu giữ nguyên) từ phim nguồn sang phim MỚI, bối cảnh lấy ảnh chuẩn từ keyframe đã duyệt (không bộ set 3D), rồi
// dựng tập 1 từ bảng mảnh JSON (mỗi mảnh một việc 1–2 s: co · giay · nv · bt · hd · anh · vid · thoai). Clip sinh 4 / 6 / 8 s, phát cắt theo giay
// (phat_s). Phim nguồn không bị đụng. kinh_thanh.khong_3d = true.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/dung-phim-reelshort.mts --tu-phim=132 --manh=scripts/du-lieu/reelshort-thang-may.json [--ten="…"]
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import type { Row } from '../src/lib/xuong-video/doc-db';
import { lamTronClip } from '../src/lib/xuong-video/kieu';

type Manh = { co: string; giay: number; /** điểm vào clip (giây) — ky_thuat.vao_s */ vao?: number; /** tiếng hiệu ứng (sfx.ts) — ky_thuat.am_thanh */ am?: string[]; nv: string[]; bt?: string[]; hd: string; anh: string; vid: string; thoai?: { nhan_vat: string; loi: string; dien_xuat?: string }[] };
const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const tuPhim = Number(gia('tu-phim')); const tep = gia('manh');
if (!tuPhim || !tep) { console.error('cần --tu-phim=<id> --manh=<tệp.json>'); process.exit(1); }
const du = JSON.parse(readFileSync(tep, 'utf8')) as { phan_doan: string; anh_boi_canh: Record<string, string>; shot: Manh[] };
const db = getDb()!;
const kq = await db.transaction(async (tx) => {
  const t = async (s: ReturnType<typeof sql>) => (await tx.execute(s)) as unknown as Row[];
  const goc = (await t(sql`SELECT * FROM xv_phim WHERE id = ${tuPhim}`))[0]; if (!goc) throw new Error('không thấy phim nguồn');
  const ten = gia('ten') || `${String(goc.ten)} (ReelShort, không 3D)`;
  const phimId = Number((await t(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh, trang_thai)
    SELECT project, ${ten}, loai, mo_ta, coalesce(kinh_thanh, '{}'::jsonb) || '{"khong_3d": true, "phu_de": true}'::jsonb, trang_thai FROM xv_phim WHERE id = ${tuPhim} RETURNING id`))[0]!.id);
  // Nhân vật + đạo cụ (không phải đồ cố định của bộ set 3D) + biến thể; bối cảnh của các mảnh: ảnh chuẩn từ keyframe đã duyệt
  const canNv = new Set(du.shot.flatMap((s) => s.nv));
  const doiNv = new Map<string, number>(); const doiBt = new Map<string, number>();
  for (const v of await t(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tuPhim} ORDER BY id`)) {
    const tenNv = String(v.ten); if (!canNv.has(tenNv)) continue;
    const laBoiCanh = v.loai === 'boi_canh'; if (!laBoiCanh && v.bo_set_id != null) continue;
    const anh = laBoiCanh ? (du.anh_boi_canh[tenNv] ? [du.anh_boi_canh[tenNv]] : []) : (v.anh_ref as string[]);
    const m = (await t(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, tieu_su, anh_ref, giong, giong_model, giong_id, giong_mau_url, doi_chieu)
      VALUES (${phimId}, ${String(v.loai)}, ${tenNv}, ${String(v.mo_ta ?? '')}, ${v.tieu_su ?? null}, ${JSON.stringify(anh)}::jsonb, ${String(v.giong ?? '')}, ${String(v.giong_model ?? '')}, ${String(v.giong_id ?? '')}, ${v.giong_mau_url ?? null}, ${v.doi_chieu ? JSON.stringify(v.doi_chieu) : null}::jsonb) RETURNING id`))[0]!;
    doiNv.set(tenNv, Number(m.id));
    for (const b of await t(sql`SELECT * FROM xv_bien_the WHERE nhan_vat_id = ${Number(v.id)} ORDER BY id`)) {
      const mb = (await t(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta, anh_url) VALUES (${Number(m.id)}, ${b.nhom ?? null}, ${String(b.ten)}, ${String(b.mo_ta ?? '')}, ${b.anh_url ?? null}) RETURNING id`))[0]!;
      doiBt.set(String(b.ten), Number(mb.id));
    }
  }
  const thieu = [...canNv].filter((x) => !doiNv.has(x)); if (thieu.length) throw new Error(`phim nguồn không có: ${thieu.join(', ')}`);
  const tongGiay = du.shot.reduce((a, s) => a + s.giay, 0);
  const tapId = Number((await t(sql`INSERT INTO xv_tap (phim_id, so, ten, trang_thai, thoi_luong_s) VALUES (${phimId}, 1, ${du.phan_doan}, 'nhap', ${Math.round(tongGiay)}) RETURNING id`))[0]!.id);
  for (const [i, s] of du.shot.entries()) {
    const nv = s.nv.map((x) => doiNv.get(x)!); const bt = (s.bt ?? []).map((x) => doiBt.get(x)).filter((x): x is number => x != null);
    // vid = khối DIỄN của mảnh (một việc): dan_dung.dien — khuôn video bắt buộc khối diễn (prompt-khoi.ts › KHUON.video); prompt_video để trống cho khỏi lặp
    await t(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, phan_doan, hanh_dong, nhan_vat, bien_the, ky_thuat, thoi_luong_s, phat_s, prompt_anh, prompt_video, dan_dung, thoai, trang_thai)
      VALUES (${tapId}, ${i + 1}, ${du.phan_doan}, ${du.phan_doan}, ${s.hd}, ${JSON.stringify(nv)}::jsonb, ${JSON.stringify(bt)}::jsonb, ${JSON.stringify({ co_canh: s.co, ...(s.vao != null ? { vao_s: s.vao } : {}), ...(s.am?.length ? { am_thanh: s.am } : {}) })}::jsonb,
        ${lamTronClip(s.giay)}, ${s.giay}, ${s.anh}, '', ${JSON.stringify({ dien: s.vid })}::jsonb, ${JSON.stringify(s.thoai ?? [])}::jsonb, 'nhap')`);
  }
  return { phimId, tapId, soManh: du.shot.length, giay: tongGiay, ten };
});
console.log(JSON.stringify(kq));
process.exit(0);
