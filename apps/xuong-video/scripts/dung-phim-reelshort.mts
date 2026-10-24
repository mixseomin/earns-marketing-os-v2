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
import { lamTronClip, type DanDung } from '../src/lib/xuong-video/kieu';
import { loiNoiNhip } from '../src/lib/xuong-video/noi-nhip';
import { cauHuong, kyVong, loiCanMat, loiChuSoDo, loiTruc, thayHuong, type ManhSoDo, type SoDo } from '../src/lib/xuong-video/so-do-canh';
import { cauVat, dongVat, loiSoVat, vatTrongKhung, type SoVat } from '../src/lib/xuong-video/so-vat';

type Manh = { co: string; giay: number; /** điểm vào clip (giây) — ky_thuat.vao_s */ vao?: number; /** tiếng hiệu ứng (sfx.ts) — ky_thuat.am_thanh */ am?: string[]; /** đầu NHẬN · đuôi GIEO · cớ cắt sang mảnh sau (noi-nhip.ts) */ mo?: string; ket?: string; noi?: DanDung['noi'];
  /** chỗ trong SƠ ĐỒ CẢNH (so-do-canh.ts): máy · ai ở đâu · ai nhìn gì · ai vào từ đâu — hướng trên màn tính từ đây, không viết tay */ sd?: ManhSoDo; /** dùng lại keyframe đã duyệt (URL) */ kf?: string;
  /** STORYBOARD đầu / giữa / cuối: khung vẽ (mặc định đầu + cuối nếu có ket) · câu khung giữa (EN) · câu tả tiếng Việt từng khung · sơ đồ ở khung cuối (đè sd) */ khung_ve?: ('dau' | 'giua' | 'ket')[]; giua?: string; mo_vi?: string; giua_vi?: string; ket_vi?: string; sd_ket?: Partial<ManhSoDo>; nv: string[]; bt?: string[]; hd: string; anh: string; vid: string; thoai?: { nhan_vat: string; loi: string; dien_xuat?: string }[] };
const gia = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? '';
const tuPhim = Number(gia('tu-phim')); const tep = gia('manh');
if (!tuPhim || !tep) { console.error('cần --tu-phim=<id> --manh=<tệp.json>'); process.exit(1); }
const du = JSON.parse(readFileSync(tep, 'utf8')) as { phan_doan: string; anh_boi_canh: Record<string, string>; shot: Manh[]; /** sơ đồ cảnh + tên nhân vật người (để tính trục) */ so_do?: SoDo; nguoi?: string[]; /** SỔ LIÊN TỤC ĐỒ VẬT (so-vat.ts) + tên tiếng Anh của món */ so_vat?: SoVat; ten_en?: Record<string, string> };
/** sơ đồ ở khung CUỐI của mảnh = sd đè bằng sd_ket (người nhìn / đứng khác lúc kết) */
const sdKet = (m: Manh): ManhSoDo | undefined => (m.sd ? { ...m.sd, ...(m.sd_ket ?? {}), o: { ...m.sd.o, ...(m.sd_ket?.o ?? {}) } } : undefined);
const khungVe = (m: Manh): ('dau' | 'giua' | 'ket')[] => m.khung_ve ?? (m.ket ? ['dau', 'ket'] : ['dau']);
// SƠ ĐỒ CẢNH: thay {A→B} trong đầu / đuôi / câu diễn bằng phía màn tính được; chặn vượt trục 180°
if (du.so_do) {
  const sd = du.so_do; const ng = du.nguoi ?? [];
  for (const m of du.shot) if (m.sd) { for (const k of ['mo', 'vid', 'anh'] as const) if (m[k]) m[k] = thayHuong(sd, m.sd, m[k]!); const sk = sdKet(m)!; for (const k of ['ket', 'giua'] as const) if (m[k]) m[k] = thayHuong(sd, sk, m[k]!); }
  const tr = [...loiTruc(sd, du.shot.flatMap((m, i) => (m.sd ? [{ ...m.sd, thu_tu: i + 1 }] : [])), ng), ...loiCanMat(sd, du.shot.flatMap((m, i) => (m.sd ? [{ ...m.sd, thu_tu: i + 1, co: m.co }] : []))),
    // chữ tay trái sơ đồ (mốc đang nhìn bị viết "behind her"…): đầu / ảnh / diễn theo sd, đuôi / giữa theo sd_ket
    ...du.shot.flatMap((m, i) => (m.sd ? [...(['mo', 'vid', 'anh'] as const).flatMap((k) => loiChuSoDo(sd, m.sd!, m[k] ?? '')), ...(['ket', 'giua'] as const).flatMap((k) => loiChuSoDo(sd, sdKet(m)!, m[k] ?? ''))].map((x) => `#${i + 1}: ${x}`) : []))];
  if (tr.length) { console.error(`sơ đồ lỗi (trục 180° / cận mặt quay lưng / chữ trái sơ đồ):\n  ${tr.join('\n  ')}`); process.exit(1); }
}
// SỔ ĐỒ VẬT (anh 24/10/2026: "cảnh trước cầm dây thẻ, cảnh sau lại cầm cái thẻ… ôm hộp lúc có lúc không"): mỗi mảnh nhận câu trạng thái đồ từ sổ (người
// giữ trong khung ⇒ đồ phải vẽ, kể cả khi mảnh không nhắc), món đó vào danh sách ảnh mẫu của mảnh; đổi trạng thái thiếu sự kiện / sự kiện ngoài khung ⇒ chặn.
const nguoiKhung = (s: Manh) => (s.sd ? s.sd.khung ?? Object.keys(s.sd.o) : s.nv).filter((n) => (du.nguoi ?? []).includes(n));
const vatDoc = new Map<number, string[]>(); const vatSo = new Map<number, { ten: string; cach: string }[]>(); const vatDocKet = new Map<number, string[]>(); const vatSoKet = new Map<number, { ten: string; cach: string }[]>();
if (du.so_vat) {
  const loi = loiSoVat(du.so_vat, (n) => (du.shot[n - 1] ? nguoiKhung(du.shot[n - 1]!) : null)); if (loi.length) { console.error(`sổ đồ vật lỗi:\n  ${loi.join('\n  ')}`); process.exit(1); }
  for (const [i, s] of du.shot.entries()) {
    const ng = nguoiKhung(s); const khai = s.nv.filter((x) => x in du.so_vat!); const en = (t: string) => du.ten_en?.[t] ?? t;
    // khung ĐẦU: sự kiện của mảnh chưa xảy ra · khung CUỐI: đã xảy ra (so-vat.ts › LucKhung)
    const thayDau = vatTrongKhung(du.so_vat, i + 1, ng, khai, 'dau'); const thayKet = vatTrongKhung(du.so_vat, i + 1, ng, khai, 'ket');
    vatSo.set(i + 1, thayDau.map(([t, m]) => ({ ten: t, cach: m.cach }))); vatSoKet.set(i + 1, thayKet.map(([t, m]) => ({ ten: t, cach: m.cach })));
    for (const [t] of [...thayDau, ...thayKet]) if (!s.nv.includes(t)) s.nv.push(t);
    const cauDau = cauVat(du.so_vat, i + 1, ng, en, khai, 'dau'); const cauKet = cauVat(du.so_vat, i + 1, ng, en, khai, 'ket');
    if (cauDau) s.anh = `${s.anh} ${cauDau}`.trim();
    s.vid = `${s.vid} ${cauDau}${cauKet && cauKet !== cauDau ? ` By the END of the shot: ${cauKet}` : ''}`.trim();
    if (cauKet && s.ket) s.ket = `${s.ket}. ${cauKet}`;
    vatDoc.set(i + 1, dongVat(du.so_vat, i + 1, 'dau')); vatDocKet.set(i + 1, dongVat(du.so_vat, i + 1, 'ket'));
  }
}
// CẮT CÓ CỚ: bảng mảnh thiếu đuôi gieo / đầu nhận / cớ cắt thì không dựng (cảnh rời rạc — anh 23/10/2026)
const danDung = (s: Manh): DanDung => ({ dien: s.vid, ...(s.mo ? { mo: s.mo } : {}), ...(s.ket ? { ket: s.ket } : {}), ...(s.noi ? { noi: s.noi } : {}),
  ...(s.giua ? { giua: s.giua } : {}), ...(s.mo_vi ? { mo_vi: s.mo_vi } : {}), ...(s.giua_vi ? { giua_vi: s.giua_vi } : {}), ...(s.ket_vi ? { ket_vi: s.ket_vi } : {}),
  ...(du.so_do && s.sd ? { huong: cauHuong(du.so_do, s.sd, du.nguoi ?? []), huong_ket: cauHuong(du.so_do, sdKet(s)!, du.nguoi ?? []) } : {}) });
{ const loi = loiNoiNhip(du.shot.map((s, i) => ({ thu_tu: i + 1, dan_dung: danDung(s), ky_thuat: { am_thanh: s.am } }))); if (loi.length) { console.error(`bảng mảnh chưa nối cắt:\n  ${loi.join('\n  ')}`); process.exit(1); } }
const ktThem = (s: Manh, i: number) => ({ khung_ve: khungVe(s), ...(du.so_do && s.sd ? { huong_so: kyVong(du.so_do, s.sd, du.nguoi ?? []), huong_so_ket: kyVong(du.so_do, sdKet(s)!, du.nguoi ?? []) } : {}),
  ...(vatDoc.get(i + 1)?.length ? { vat: vatDoc.get(i + 1), vat_so: vatSo.get(i + 1) ?? [], vat_ket: vatDocKet.get(i + 1), vat_so_ket: vatSoKet.get(i + 1) ?? [] } : {}) });
const db = getDb()!;
// --cap-nhat=<tap_id>: cập nhật TẬP ĐÃ CÓ theo bảng mảnh (khớp thu_tu) — câu ảnh / diễn / hướng / sổ đồ / nhân vật của mảnh; giữ keyframe, clip, giây phát,
// điểm vào đã chọn. Đổi luật (sổ đồ, sơ đồ) không phải dựng phim mới.
if (gia('cap-nhat')) {
  const tapId = Number(gia('cap-nhat')); const q = async (x: ReturnType<typeof sql>) => (await db.execute(x)) as unknown as Row[];
  const phimId = Number((await q(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`))[0]!.phim_id);
  const nvPhim = await q(sql`SELECT id, ten FROM xv_nhan_vat WHERE phim_id = ${phimId}`); const btPhim = await q(sql`SELECT b.id, b.ten FROM xv_bien_the b JOIN xv_nhan_vat n ON n.id = b.nhan_vat_id WHERE n.phim_id = ${phimId}`);
  const idNv = (x: string) => nvPhim.find((r) => r.ten === x)?.id; const idBt = (x: string) => btPhim.find((r) => r.ten === x)?.id;
  for (const [i, s] of du.shot.entries()) {
    const nv = s.nv.map(idNv).filter((x) => x != null).map(Number); const bt = (s.bt ?? []).map(idBt).filter((x) => x != null).map(Number);
    const kt = { co_canh: s.co, ...(s.am?.length ? { am_thanh: s.am } : {}), ...ktThem(s, i) };
    await db.execute(sql`UPDATE xv_canh SET hanh_dong = ${s.hd}, prompt_anh = ${s.anh}, dan_dung = coalesce(dan_dung, '{}'::jsonb) || ${JSON.stringify(danDung(s))}::jsonb,
      ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || ${JSON.stringify(kt)}::jsonb, nhan_vat = ${JSON.stringify(nv)}::jsonb, bien_the = ${JSON.stringify(bt)}::jsonb, updated_at = now()
      WHERE tap_id = ${tapId} AND thu_tu = ${i + 1}`);
  }
  console.log(`cập nhật ${du.shot.length} mảnh của tập ${tapId}`); process.exit(0);
}
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
    await t(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, phan_doan, hanh_dong, nhan_vat, bien_the, ky_thuat, thoi_luong_s, phat_s, prompt_anh, prompt_video, dan_dung, thoai, keyframe_url, trang_thai)
      VALUES (${tapId}, ${i + 1}, ${du.phan_doan}, ${du.phan_doan}, ${s.hd}, ${JSON.stringify(nv)}::jsonb, ${JSON.stringify(bt)}::jsonb, ${JSON.stringify({ co_canh: s.co, ...(s.vao != null ? { vao_s: s.vao } : {}), ...(s.am?.length ? { am_thanh: s.am } : {}), ...ktThem(s, i) })}::jsonb,
        ${lamTronClip(s.giay)}, ${s.giay}, ${s.anh}, '', ${JSON.stringify(danDung(s))}::jsonb, ${JSON.stringify(s.thoai ?? [])}::jsonb, ${s.kf ?? null}, ${s.kf ? 'co_keyframe' : 'nhap'})`);
  }
  return { phimId, tapId, soManh: du.shot.length, giay: tongGiay, ten };
});
console.log(JSON.stringify(kq));
process.exit(0);
