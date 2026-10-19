// TỰ LÀM PHIM TỪ ĐẦU qua đúng quy trình studio (anh 17/10/2026: "bước sinh video sau này phải tự động hoàn toàn nhưng đều phải qua studio để tuân thủ
// mọi quy trình, quy định"). Thứ tự = thứ tự cổng (quy-trinh.ts): kiểm người xem → ảnh gốc → keyframe → giọng (độ dài shot theo giọng) → clip
// (vòng tự sửa: soi keyframe, soi clip, viết lại prompt) → nhạc nền. Xuất MP4 ở script (tu-lam-phim.mts) khi mọi shot sạch.
// Người xem chấm bằng Gemini (~0.2¢/đoạn) theo ĐÚNG lời dặn + khuôn của nút 🧑 (heNguoiXem / vaoNguoiXem / đối chiếu ý đồ) — không đạt thì DỪNG:
// kịch bản chưa hiểu được thì không tiêu tiền hình.
import 'server-only';
import { sql } from 'drizzle-orm';
import { kiemNguoiXemTap, type kiemNguoiXemCanh } from './kiem-nguoi-xem';
import { heNguoiXem, vaoNguoiXem, NguoiXemSchema, NguoiXemQcSchema, DoiChieuYSchema, goiClaude, tachJson, modelSoTien, type thuNguoiXem } from './claude';
import { zodSangGemini } from './soi-bien-dang';
import { sinhAnhGoc, sinhKeyframeCanh } from './sinh-anh';
import { sinhGiongShots } from './sinh-giong';
import { khopGiongTap } from './hau-ky';
import { sinhNhacTap } from './sinh-nhac';
import { tuSuaClipTap, sinhKeyframeCoDuPhong, ANH_DU_PHONG, type KetTuSua } from './tu-sua-clip';
import { chonGiongDan, MODEL_GIONG_DAN } from './tu-sua-clip-do';
import { boiCanhTap, ghiTienChu, mapCanh, type Db, type Row } from './doc-db';
import { congTk, docKinhThanh, locNhanh, tien } from './kieu';

const ngu = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
async function doiJob(db: Db, ids: number[], phut = 10): Promise<void> {
  const t0 = Date.now();
  while (ids.length && Date.now() - t0 < phut * 60_000) {
    const r = (await db.execute(sql`SELECT count(*) AS n FROM xv_job WHERE id = ANY(${`{${ids.join(',')}}`}::int[]) AND trang_thai IN ('cho', 'chay')`)) as unknown as Row[];
    if (Number(r[0]?.n) === 0) return; await ngu(5000);
  }
}
/** Bộ chấm người xem bằng CLAUDE (qua đại lý, dự phòng Anthropic — claude.ts › goiClaude) — CÙNG chữ ký + lời dặn với thuNguoiXem để kiemNguoiXemTap
 *  dùng chung: lượt 1 người xem (heNguoiXem + vaoNguoiXem), lượt 2 đối chiếu ý đồ. Chấm CẢ PHIM một lần (phim kể chuyện để sản phẩm / CTA ở cuối).
 *  Khuôn trả lời lấy từ đúng zod của studio (zodSangGemini giữ mô tả trường). Gemini trước đây hiểu sai trường, phải vá nhiều lần (17/10/2026). */
const DU_TRUONG = ['ke_lai', 'ai', 'muon', 'can', 'lat', 'ket', 'diem', 'cho_kho', 'cat'];
const chamClaude: typeof thuNguoiXem = async (o) => {
  for (let lan = 0; lan < 2; lan++) { const r = await chamClaude1(o); if (r.ok || lan) return r; console.error('[chấm người xem] thử lại:', r.loi); }
  return { ok: false, loi: 'không tới' };
};
const chamClaude1: typeof thuNguoiXem = async (o) => {
  const khuon = JSON.stringify(zodSangGemini(o.qc ? NguoiXemQcSchema : NguoiXemSchema));
  const x = await goiClaude({ he: heNguoiXem(o.kt, o.doDai, o.qc), maxTokens: 6000,
    noiDung: [{ text: `${vaoNguoiXem(o)}\n\nTrả lời DUY NHẤT một đối tượng JSON đúng khuôn (mô tả từng trường nằm trong "description"): ${khuon}` }] });
  if (!x.ok) return x;
  const xem = tachJson<Record<string, unknown>>(x.text);
  const thieu = DU_TRUONG.filter((k) => xem?.[k] == null);
  if (!xem || thieu.length || !Number.isFinite(Number(xem.diem))) return { ok: false, loi: `Claude trả thiếu trường: ${thieu.join(', ') || 'diem'}` };
  const d = await goiClaude({ maxTokens: 800, noiDung: [{ text: (o.qc
    ? `Bạn so điều MỘT NGƯỜI XEM nhận được từ một quảng cáo với ý đồ của người làm QC. Chỉ đánh giá người xem có nhận đúng sản phẩm, vấn đề, lợi ích chính và ưu đãi không — không chấm văn, không xét đúng sai của ưu đãi / số liệu.\n\nÝ ĐỒ QC\n${o.logline || '(không có)'}\nBrief: ${o.brief || '(không có)'}\n\nNGƯỜI XEM NHẬN ĐƯỢC\n${xem.ke_lai}\nSản phẩm: ${xem.ai}\nVấn đề: ${xem.muon}\nLợi ích: ${xem.can}\nƯu đãi / việc làm tiếp: ${xem.ket}`
    : `Bạn so câu chuyện MỘT NGƯỜI XEM kể lại với ý đồ của tác giả. Chỉ đánh giá người xem có nhận được đúng câu chuyện, cú lật và kết không — không chấm văn.\n\nÝ ĐỒ TÁC GIẢ\nLogline: ${o.logline || '(không có)'}\nBrief: ${o.brief || '(không có)'}\n\nNGƯỜI XEM KỂ LẠI\n${xem.ke_lai}\nCú lật người xem thấy: ${xem.lat}\nKết người xem nhận: ${xem.ket}`)
    + `\n\nTrả lời DUY NHẤT JSON: ${JSON.stringify(zodSangGemini(DoiChieuYSchema))}` }] });
  if (!d.ok) return d;
  const doi = tachJson<{ khop: boolean; lech: string }>(d.text);
  if (!doi || typeof doi.khop !== 'boolean') return { ok: false, loi: 'Claude không trả đúng khuôn (lượt đối chiếu)' };
  return { ok: true, data: { xem: xem as never, doi: { khop: doi.khop, lech: String(doi.lech ?? '') } }, model: modelSoTien(x), tokens: congTk(x.tokens, d.tokens) } as Awaited<ReturnType<typeof thuNguoiXem>>;
};

export type KetLamPhim = { ok: boolean; buoc: string; loi: string[]; clip: KetTuSua[] };
/** Tiền đã tiêu cho phim (cent, theo sổ xv_job). */
export const tienPhim = async (db: Db, phimId: number): Promise<number> =>
  Number(((await db.execute(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS c FROM xv_job WHERE phim_id = ${phimId} AND tinh_chi`)) as unknown as Row[])[0]!.c);
/** NGÂN SÁCH LƯỢT CHẠY (anh 17/10/2026: "sinh mà tốn tiền quá thì phải báo"): #127 đốt $8,18 vì vòng tự sửa sinh lại mãi không ai hay.
 *  `nganSachCents`: lượt chạy tiêu quá mức này thì DỪNG trước lần tiêu kế, trả buoc 'ngân sách' (script báo Telegram, chờ anh bảo chạy tiếp). */
export const BUOC_NGAN_SACH = 'ngân sách';
export async function lamPhimTuDau(db: Db, tapId: number, log: (s: string) => void, o: { toiDa?: number; nganSachCents?: number; moHinhVideo?: string } = {}): Promise<KetLamPhim> {
  const bc = await boiCanhTap(db, tapId); if (!bc) return { ok: false, buoc: 'tập', loi: ['không thấy tập'], clip: [] };
  const phimId = bc.tap.phim_id; const kt = docKinhThanh(bc.kt);
  const truoc = await tienPhim(db, phimId);
  const vuot = async (): Promise<string | null> => {
    if (o.nganSachCents == null) return null;
    const da = (await tienPhim(db, phimId)) - truoc;
    return da >= o.nganSachCents ? `vượt ngân sách lượt chạy: đã tiêu ${tien(da)} / ${tien(o.nganSachCents)}` : null;
  };
  const dungVi = async (): Promise<KetLamPhim | null> => { const l = await vuot(); return l ? { ok: false, buoc: BUOC_NGAN_SACH, loi: [l], clip: [] } : null; };
  const canhA = () => db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`).then((r) => locNhanh((r as unknown as Row[]).map(mapCanh), 'A'));
  // 1. người xem CẢ PHIM (cùng cổng: thu_nguoi_xem.ma = mã kịch bản) — trượt thì dừng trước khi tiêu tiền hình
  if (!bc.tap.thu_nguoi_xem?.dat) {
    const k = await kiemNguoiXemTap(db, tapId, chamClaude);
    if (!k.ok) return { ok: false, buoc: 'người xem', loi: [k.loi], clip: [] };
    log(`  người xem ${k.data.dat ? '✓' : '✗'} ${k.data.diem}/10${k.data.khop ? '' : ` · lệch: ${k.data.lech}`}`);
    if (!k.data.dat) return { ok: false, buoc: 'người xem', loi: [`${k.data.diem}/10${k.data.khop ? '' : ` · lệch: ${k.data.lech}`}`, ...k.data.cho_kho.map((c) => `#${c.shot} ${c.van_de} → ${c.sua}`)], clip: [] };
  }
  { const d = await dungVi(); if (d) return d; }
  // 2. ảnh gốc anchor còn thiếu (sản phẩm dùng ảnh thật, không sinh)
  const thieuAnh = bc.nhanVat.filter((v) => v.loai !== 'phong_cach' && v.loai !== 'san_pham' && !v.anh_ref.length);
  const jobA: number[] = [];
  for (const v of thieuAnh) { const r = await sinhAnhGoc(db, v.id); if (r.ok) jobA.push(r.data); else log(`  ✗ ảnh gốc ${v.ten}: ${r.loi}`); }
  await doiJob(db, jobA); if (jobA.length) log(`  ảnh gốc: ${jobA.length}`);
  { const d = await dungVi(); if (d) return d; }
  // 3. keyframe còn thiếu (soi + sinh lại do vòng tự sửa lo); chuỗi ảnh mặc định từ chối thì model dự phòng (sinhKeyframeCoDuPhong)
  const jobK: number[] = []; const thieuKf = (await canhA()).filter((c) => !c.keyframe_url);
  for (const c of thieuKf) { const r = await sinhKeyframeCanh(db, c.id, 1); if (r.ok) jobK.push(...r.data); else log(`  ✗ keyframe #${c.thu_tu}: ${r.loi}`); }
  await doiJob(db, jobK); if (jobK.length) log(`  keyframe: ${jobK.length}`);
  for (const c of (await canhA()).filter((x) => !x.keyframe_url)) {
    const kf = await sinhKeyframeCoDuPhong(db, c.id);
    log(`  keyframe #${c.thu_tu} ${kf.url ? `qua model dự phòng ${ANH_DU_PHONG}` : `vẫn hỏng: ${kf.loi.slice(0, 160)}`}`);
  }
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
  { const d = await dungVi(); if (d) return d; }
  const clip = await tuSuaClipTap(db, tapId, { toiDa: o.toiDa ?? 3, log, dung: vuot, moHinhVideo: o.moHinhVideo });
  { const l = await vuot(); if (l) return { ok: false, buoc: BUOC_NGAN_SACH, loi: [l, ...clip.filter((k) => k.ket !== 'sach').map((k) => `#${k.thu_tu}: ${k.loi.join(' | ')}`)], clip }; }
  // 6. nhạc nền cả tập
  const tap = ((await db.execute(sql`SELECT nhac_url FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0];
  if (!tap?.nhac_url) { const r = await sinhNhacTap(db, tapId, 'cassetteai/music-generator', undefined, 'warm light acoustic, hopeful, ad background, no vocals');
    if (r.ok) { await doiJob(db, [r.data], 5); log('  nhạc nền: xong'); } else log(`  ✗ nhạc: ${r.loi}`); }
  const conLoi = clip.filter((k) => k.ket !== 'sach');
  return { ok: !conLoi.length, buoc: 'clip', loi: conLoi.map((k) => `#${k.thu_tu}: ${k.loi.join(' | ')}`), clip };
}
