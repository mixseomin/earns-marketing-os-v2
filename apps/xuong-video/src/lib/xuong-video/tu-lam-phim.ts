// TỰ LÀM PHIM TỪ ĐẦU qua đúng quy trình studio (anh 17/10/2026: "bước sinh video sau này phải tự động hoàn toàn nhưng đều phải qua studio để tuân thủ
// mọi quy trình, quy định"). Thứ tự = thứ tự cổng (quy-trinh.ts): kiểm người xem → ảnh gốc → keyframe → giọng (độ dài shot theo giọng) → clip
// (vòng tự sửa: soi keyframe, soi clip, viết lại prompt) → nhạc nền. Xuất MP4 ở script (tu-lam-phim.mts) khi mọi shot sạch.
// Người xem chấm bằng Gemini (~0.2¢/đoạn) theo ĐÚNG lời dặn + khuôn của nút 🧑 (heNguoiXem / vaoNguoiXem / đối chiếu ý đồ) — không đạt thì DỪNG:
// kịch bản chưa hiểu được thì không tiêu tiền hình.
import 'server-only';
import { sql } from 'drizzle-orm';
import { dauVaoNguoiXemCanh, kiemNguoiXemCanh } from './kiem-nguoi-xem';
import { heNguoiXem, vaoNguoiXem } from './claude';
import { goiGeminiJson, MO_HINH_BD } from './soi-bien-dang';
import { sinhAnhGoc, sinhKeyframeCanh } from './sinh-anh';
import { sinhGiongShots } from './sinh-giong';
import { khopGiongTap } from './hau-ky';
import { sinhNhacTap } from './sinh-nhac';
import { tuSuaClipTap, type KetTuSua } from './tu-sua-clip';
import { chonGiongDan, MODEL_GIONG_DAN } from './tu-sua-clip-do';
import { boiCanhTap, ghiTienChu, mapCanh, type Db, type Row } from './doc-db';
import { docKinhThanh, locNhanh } from './kieu';

const ngu = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
async function doiJob(db: Db, ids: number[], phut = 10): Promise<void> {
  const t0 = Date.now();
  while (ids.length && Date.now() - t0 < phut * 60_000) {
    const r = (await db.execute(sql`SELECT count(*) AS n FROM xv_job WHERE id = ANY(${`{${ids.join(',')}}`}::int[]) AND trang_thai IN ('cho', 'chay')`)) as unknown as Row[];
    if (Number(r[0]?.n) === 0) return; await ngu(5000);
  }
}
const XEM_SCHEMA = { type: 'OBJECT', properties: { ke_lai: { type: 'STRING' }, ai: { type: 'STRING' }, muon: { type: 'STRING' }, can: { type: 'STRING' }, lat: { type: 'STRING' }, ket: { type: 'STRING' },
  diem: { type: 'NUMBER' }, cho_kho: { type: 'ARRAY', items: { type: 'OBJECT', properties: { shot: { type: 'NUMBER' }, van_de: { type: 'STRING' }, sua: { type: 'STRING' } }, required: ['shot', 'van_de', 'sua'] } },
  cat: { type: 'ARRAY', items: { type: 'OBJECT', properties: { shot: { type: 'NUMBER' }, bot_s: { type: 'NUMBER' }, ly_do: { type: 'STRING' } }, required: ['shot', 'bot_s', 'ly_do'] } } },
  required: ['ke_lai', 'ai', 'muon', 'can', 'lat', 'ket', 'diem', 'cho_kho', 'cat'] };

/** Kiểm người xem MỘT đoạn (phân cảnh) bằng Gemini, ghi qua đúng kiemNguoiXemCanh (cùng mã, cùng cổng). */
async function nguoiXemDoan(db: Db, tapId: number, phanDoan: string, phimId: number): Promise<{ dat: boolean; ta: string } | null> {
  const v = await dauVaoNguoiXemCanh(db, tapId, phanDoan); if (!v.ok) return null;
  const x = await goiGeminiJson<Parameters<typeof kiemNguoiXemCanh>[3] extends infer T ? T extends { xem: infer X } ? X : never : never>(
    [{ text: `${heNguoiXem(v.kt, v.doDai, v.qc)}\n\n${vaoNguoiXem({ ban: v.ban, nhanVat: v.nvTa })}` }], XEM_SCHEMA);
  if (!x) return null;
  const xem = x.data;
  const d = await goiGeminiJson<{ khop: boolean; lech: string }>([{ text: `Bạn so điều MỘT NGƯỜI XEM nhận được từ một quảng cáo với ý đồ của người làm QC. Chỉ đánh giá người xem có nhận đúng sản phẩm, vấn đề, lợi ích chính và ưu đãi mà ĐOẠN NÀY gánh không — không chấm văn, không xét đúng sai của ưu đãi / số liệu.\n\nÝ ĐỒ QC\n${v.yDo || '(không có)'}\nBrief: ${v.brief || '(không có)'}\n\nNGƯỜI XEM NHẬN ĐƯỢC\n${xem.ke_lai}\nSản phẩm: ${xem.ai}\nVấn đề: ${xem.muon}\nLợi ích: ${xem.can}\nƯu đãi / việc làm tiếp: ${xem.ket}` }],
    { type: 'OBJECT', properties: { khop: { type: 'BOOLEAN' }, lech: { type: 'STRING' } }, required: ['khop', 'lech'] });
  if (!d) return null;
  await ghiTienChu(db, phimId, `Kiểm người xem đoạn “${phanDoan}” (Gemini)`, MO_HINH_BD, { in: x.tk.in + d.tk.in, out: x.tk.out + d.tk.out }, 'google');
  const r = await kiemNguoiXemCanh(db, tapId, phanDoan, { xem, doi: d.data, nguoi: MO_HINH_BD });
  if (!r.ok) return null;
  return { dat: r.data.dat, ta: `${phanDoan}: ${r.data.diem}/10${r.data.khop ? '' : ` · lệch: ${r.data.lech}`}${r.data.cho_kho.length ? ` · vấp: ${r.data.cho_kho.map((c) => `#${c.shot} ${c.van_de}`).join('; ')}` : ''}` };
}

export type KetLamPhim = { ok: boolean; buoc: string; loi: string[]; clip: KetTuSua[] };
export async function lamPhimTuDau(db: Db, tapId: number, log: (s: string) => void, o: { toiDa?: number } = {}): Promise<KetLamPhim> {
  const bc = await boiCanhTap(db, tapId); if (!bc) return { ok: false, buoc: 'tập', loi: ['không thấy tập'], clip: [] };
  const phimId = bc.tap.phim_id; const kt = docKinhThanh(bc.kt);
  const canhA = () => db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`).then((r) => locNhanh((r as unknown as Row[]).map(mapCanh), 'A'));
  // 1. người xem từng đoạn
  const doan = [...new Set((await canhA()).map((c) => c.phan_doan).filter(Boolean))];
  const daKiem = (bc.tap.thu_nguoi_xem?.canh ?? {}) as Record<string, { dat?: boolean }>;
  const truot: string[] = [];
  for (const p of doan) {
    if (daKiem[p]?.dat) continue;
    const k = await nguoiXemDoan(db, tapId, p, phimId);
    if (!k) { truot.push(`${p}: không chấm được`); continue; }
    log(`  người xem ${k.dat ? '✓' : '✗'} ${k.ta}`);
    if (!k.dat) truot.push(k.ta);
  }
  if (truot.length) return { ok: false, buoc: 'người xem', loi: truot, clip: [] };
  // 2. ảnh gốc anchor còn thiếu (sản phẩm dùng ảnh thật, không sinh)
  const thieuAnh = bc.nhanVat.filter((v) => v.loai !== 'phong_cach' && v.loai !== 'san_pham' && !v.anh_ref.length);
  const jobA: number[] = [];
  for (const v of thieuAnh) { const r = await sinhAnhGoc(db, v.id); if (r.ok) jobA.push(r.data); else log(`  ✗ ảnh gốc ${v.ten}: ${r.loi}`); }
  await doiJob(db, jobA); if (jobA.length) log(`  ảnh gốc: ${jobA.length}`);
  // 3. keyframe còn thiếu (soi + sinh lại do vòng tự sửa lo)
  const jobK: number[] = [];
  for (const c of (await canhA()).filter((c) => !c.keyframe_url)) { const r = await sinhKeyframeCanh(db, c.id, 1); if (r.ok) jobK.push(...r.data); else log(`  ✗ keyframe #${c.thu_tu}: ${r.loi}`); }
  await doiJob(db, jobK); if (jobK.length) log(`  keyframe: ${jobK.length}`);
  const conThieuKf = (await canhA()).filter((c) => !c.keyframe_url);
  if (conThieuKf.length) return { ok: false, buoc: 'keyframe', loi: conThieuKf.map((c) => `#${c.thu_tu} chưa có keyframe`), clip: [] };
  // 4. giọng (trước video — độ dài shot khớp theo giọng)
  // giọng dẫn theo ô "giong" của phim (người kể thật của creative) — kinh thánh có thể mang giọng của phim mẫu (T60: giọng nữ 70 tuổi)
  const moTaGiong = String(((bc.kt ?? {}) as { tu_template?: { gia_tri?: Record<string, string> } }).tu_template?.gia_tri?.giong ?? '');
  const voice = chonGiongDan(moTaGiong);
  const g = await sinhGiongShots(db, tapId, (await canhA()).map((c) => c.id), { chiThieu: true, ...(moTaGiong || !kt.giong_dan?.voice ? { theoNguoi: { '': { model: MODEL_GIONG_DAN, voice } } } : {}) });
  if (g.ok && g.data) {
    for (let i = 0; i < 60; i++) { const r = (await db.execute(sql`SELECT count(*) AS n FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE c.tap_id = ${tapId} AND j.loai = 'am' AND j.trang_thai = 'cho'`)) as unknown as Row[]; if (Number(r[0]?.n) === 0) break; await ngu(5000); }
    const kg = await khopGiongTap(db, tapId, 'tự làm phim'); log(`  giọng: ${g.data} dòng (${voice})${kg.ok ? ` · khớp giây ${kg.data.tong}s` : ''}`);
  } else if (!g.ok) log(`  ✗ giọng: ${g.loi}`);
  // 5. clip — vòng tự sửa (soi keyframe → video → soi clip → viết lại prompt), mọi shot nhánh A
  const clip = await tuSuaClipTap(db, tapId, { toiDa: o.toiDa ?? 3, log });
  // 6. nhạc nền cả tập
  const tap = ((await db.execute(sql`SELECT nhac_url FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0];
  if (!tap?.nhac_url) { const r = await sinhNhacTap(db, tapId, 'cassetteai/music-generator', undefined, 'warm light acoustic, hopeful, ad background, no vocals');
    if (r.ok) { await doiJob(db, [r.data], 5); log('  nhạc nền: xong'); } else log(`  ✗ nhạc: ${r.loi}`); }
  const conLoi = clip.filter((k) => k.ket !== 'sach');
  return { ok: !conLoi.length, buoc: 'clip', loi: conLoi.map((k) => `#${k.thu_tu}: ${k.loi.join(' | ')}`), clip };
}
