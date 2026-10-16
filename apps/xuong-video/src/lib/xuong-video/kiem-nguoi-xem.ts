// Lõi bước "🧑 Kiểm người xem có hiểu không" trên máy chủ — MỘT chỗ cho nút (actions.ts › thuNguoiXemTap) và script (scripts/kiem-nguoi-xem.mts).
// Phần thuần (bản người xem, mã phiên bản, cổng chặn) ở nguoi-xem.ts; lượt Claude ở claude.ts › thuNguoiXem.
import 'server-only';
import { sql } from 'drizzle-orm';
import { thuNguoiXem, suaKichBanTheoNguoiXem, type NguoiXemSchema } from './claude';
import type { z } from 'zod/v4';
type ThuNguoiXemTho = z.infer<typeof NguoiXemSchema>;
import { chupTruoc } from './hoan-tac';
import { banNguoiXem, maKichBan, maTheoCanh, keHoachSua, DIEM_HIEU_DAT } from './nguoi-xem';
import { docKinhThanh, locNhanh, lamTronClip, giayPhat, type ThuNguoiXem } from './kieu';
import { boiCanhTap, mapCanh, ghiTienChu, type Db, type Row } from './doc-db';

/** Phim QC → người xem chấm theo QC (claude.ts › heNguoiXem): đối tượng = người xem, ý đồ = sản phẩm + đối tượng + điểm nổi bật + ưu đãi. */
function yDoQc(loai: string, kt: ReturnType<typeof docKinhThanh>): { qc: { doi_tuong: string } | null; yDo: string } {
  if (loai !== 'quang_cao') return { qc: null, yDo: '' };
  const q = kt.qc;
  return { qc: { doi_tuong: q.doi_tuong }, yDo: [`Sản phẩm: ${q.ten}`, q.doi_tuong && `Đối tượng: ${q.doi_tuong}`, q.diem_noi_bat && `Điểm nổi bật: ${q.diem_noi_bat}`, q.uu_dai && `Ưu đãi: ${q.uu_dai}`].filter(Boolean).join('\n') };
}

export async function kiemNguoiXemTap(db: Db, tapId: number): Promise<{ ok: true; data: ThuNguoiXem } | { ok: false; loi: string }> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return { ok: false, loi: 'không thấy tập' };
  const canh = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  if (!canh.length) return { ok: false, loi: 'tập chưa tách cảnh — chưa có gì để người xem xem' };
  const kt = docKinhThanh(bc.kt);
  const ban = banNguoiXem(canh);
  const ids = new Set(canh.flatMap((c) => c.nhan_vat));
  const nvTa = bc.nhanVat.filter((v) => ids.has(v.id) && v.loai !== 'phong_cach').map((v) => `- ${v.ten}: ${v.mo_ta.slice(0, 160)}`).join('\n');
  const logline = (kt.series?.dong_co ? kt.series.tap.find((t) => t.so === bc.tap.so)?.logline : '') || kt.logline || '';
  // Độ dài để người xem biết được phép THU NHỎ (không chỉ thêm shot): cảnh intro / thẻ kết của series không tính, đúng như ho-so.ts › doTheoThamChieu.
  const intro = new Set(bc.tap.phan_canh.filter((p) => p.intro).map((p) => p.ten));
  const giayTap = Math.round(canh.filter((c) => !intro.has(c.phan_doan)).reduce((a, c) => a + giayPhat(c), 0));
  const tc = kt.series?.tham_chieu;
  const doDai = `tập đang dài ${giayTap} giây (không tính intro / thẻ kết)${tc?.do_dai_s ? `, chuẩn series ${tc.do_dai_s} giây theo ${tc.tac_pham}` : ''}.`;
  const { qc, yDo } = yDoQc(bc.loai, kt);
  const kq = await thuNguoiXem({ ban, nhanVat: nvTa, logline: qc ? yDo : logline, brief: bc.tap.brief, kt, doDai, qc });
  if (!kq.ok) return kq;
  await ghiTienChu(db, bc.tap.phim_id, `Kiểm người xem có hiểu không · tập ${bc.tap.so}`, kq.model, kq.tokens);
  const { xem, doi } = kq.data;
  // Đạt hay không tính trên ĐÚNG con số hiện ra (đã làm tròn) — trước đây so điểm thô: 6,6 hiện "7/10, khớp ý" mà vẫn chặn (Tango & Lint tập 1, 14/10/2026).
  const diem = Math.max(0, Math.min(10, Math.round(xem.diem)));
  const t: ThuNguoiXem = { ma: maKichBan(canh), ma_canh: maTheoCanh(canh), ...(qc ? { qc: true } : {}), luc: new Date().toISOString(), model: kq.model, ke_lai: xem.ke_lai, hieu: { ai: xem.ai, muon: xem.muon, can: xem.can, lat: xem.lat, ket: xem.ket },
    diem, cho_kho: xem.cho_kho, cat: xem.cat, khop: doi.khop, lech: doi.lech, dat: doi.khop && diem >= DIEM_HIEU_DAT };
  await db.execute(sql`UPDATE xv_tap SET thu_nguoi_xem = ${JSON.stringify(t)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: t };
}


/** 🧑 KIỂM RIÊNG MỘT CẢNH (anh 15/10/2026: "tách theo từng cảnh cho rẻ"): người xem chỉ xem các shot của cảnh đó, kèm câu chuyện TRƯỚC đó do chính
 *  người xem kể lại ở lần kiểm cả tập (nếu có); đối chiếu với ý đồ của RIÊNG cảnh (mục tiêu / xung đột / ẩn ý / gag). Kết quả lưu vào
 *  thu_nguoi_xem.canh[phan_doan] — cổng (nguoi-xem.ts › phuTheoCanh) tính cảnh đó là đã qua khi đạt với đúng nội dung hiện tại. */
export async function dauVaoNguoiXemCanh(db: Db, tapId: number, phanDoan: string) {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return { ok: false as const, loi: 'không thấy tập' };
  const tatCa = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  const canh = tatCa.filter((c) => c.phan_doan === phanDoan);
  if (!canh.length) return { ok: false as const, loi: `tập không có cảnh “${phanDoan}”` };
  const kt = docKinhThanh(bc.kt);
  const pc = bc.tap.phan_canh.find((p) => p.ten === phanDoan);
  const truoc = (bc.tap.thu_nguoi_xem as ThuNguoiXem | null)?.ke_lai;
  const ban = `${truoc ? `PHẦN TRƯỚC CẢNH NÀY (bạn đã xem, tóm tắt theo lời bạn kể lần trước): ${truoc}\n\n` : ''}CẢNH ĐANG XEM:\n${banNguoiXem(canh)}`;
  const ids = new Set(canh.flatMap((c) => c.nhan_vat));
  const nvTa = bc.nhanVat.filter((v) => ids.has(v.id) && v.loai !== 'phong_cach').map((v) => `- ${v.ten}: ${v.mo_ta.slice(0, 160)}`).join('\n');
  const q = yDoQc(bc.loai, kt);
  if (q.qc) return { ok: true as const, bc, canh, kt, ban, nvTa, yDo: q.yDo, qc: q.qc, doDai: `đoạn dài ${Math.round(canh.reduce((a, c) => a + giayPhat(c), 0))} giây.`,
    brief: `Chỉ đánh giá RIÊNG đoạn “${phanDoan}” của QC: người xem có nhận được đúng ý của đoạn này (vấn đề / sản phẩm / lợi ích / ưu đãi mà nó gánh) không.` };
  const yDo = pc ? `Cảnh “${pc.ten}” (${pc.beat}). Mục tiêu: ${pc.muc_tieu}. Xung đột: ${pc.xung_dot}. Ẩn ý: ${pc.an_y}.${pc.gag?.length ? ` Gag: ${pc.gag.map((g) => `${g.ten} — gài: ${g.gai}; bùng: ${g.bung}`).join(' | ')}.` : ''}` : `Cảnh “${phanDoan}”.`;
  const brief = 'Chỉ đánh giá RIÊNG cảnh này: người xem có theo được ai muốn gì, chuyện gì xảy ra, cú bùng và kết cảnh không.';
  return { ok: true as const, bc, canh, kt, ban, nvTa, yDo, brief, qc: null, doDai: `cảnh dài ${Math.round(canh.reduce((a, c) => a + giayPhat(c), 0))} giây.` };
}
/** tuCham: kết quả người xem do NGƯỜI KHÁC chấm trên đúng đầu vào dauVaoNguoiXemCanh (anh 15/10/2026: "lúc này cổng kiểm thì mày làm đi" — Claude
 *  trong phiên chat tự chấm, 0đ) — ghi cùng chỗ, cùng mã, model = tên người chấm; không gọi API, không ghi tiền. */
export async function kiemNguoiXemCanh(db: Db, tapId: number, phanDoan: string, tuCham?: { xem: ThuNguoiXemTho; doi: { khop: boolean; lech: string }; nguoi: string }): Promise<{ ok: true; data: ThuNguoiXem } | { ok: false; loi: string }> {
  const v = await dauVaoNguoiXemCanh(db, tapId, phanDoan);
  if (!v.ok) return v;
  const { bc, canh, kt } = v;
  let xem: ThuNguoiXemTho, doi: { khop: boolean; lech: string }, model: string;
  if (tuCham) ({ xem, doi } = tuCham), (model = tuCham.nguoi);
  else {
    const kq = await thuNguoiXem({ ban: v.ban, nhanVat: v.nvTa, logline: v.yDo, brief: v.brief, kt, doDai: v.doDai, qc: v.qc });
    if (!kq.ok) return kq;
    await ghiTienChu(db, bc.tap.phim_id, `Kiểm người xem riêng cảnh “${phanDoan}” · tập ${bc.tap.so}`, kq.model, kq.tokens);
    ({ xem, doi } = kq.data); model = kq.model;
  }
  const diem = Math.max(0, Math.min(10, Math.round(xem.diem)));
  const t: ThuNguoiXem = { ma: maTheoCanh(canh)[phanDoan]!, ...(v.qc ? { qc: true } : {}), luc: new Date().toISOString(), model, ke_lai: xem.ke_lai, hieu: { ai: xem.ai, muon: xem.muon, can: xem.can, lat: xem.lat, ket: xem.ket },
    diem, cho_kho: xem.cho_kho, cat: xem.cat, khop: doi.khop, lech: doi.lech, dat: doi.khop && diem >= DIEM_HIEU_DAT };
  // Ghi vào thu_nguoi_xem.canh[phan_doan]; tập chưa từng kiểm cả tập thì tạo khung rỗng (ma rỗng = cả tập chưa kiểm, cổng chỉ tính theo cảnh).
  const r0 = (await db.execute(sql`SELECT thu_nguoi_xem FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  const cu = (r0[0]?.thu_nguoi_xem as ThuNguoiXem | null) ?? { ma: '', luc: '', model: '', ke_lai: '', hieu: { ai: '', muon: '', can: '', lat: '', ket: '' }, diem: 0, cho_kho: [], khop: false, lech: '', dat: false, ma_canh: {} };
  await db.execute(sql`UPDATE xv_tap SET thu_nguoi_xem = ${JSON.stringify({ ...cu, canh: { ...(cu.canh ?? {}), [phanDoan]: t } })}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: t };
}

/** ✍ Sửa kịch bản theo người xem: Claude sửa đúng các shot bị vấp (+ chèn shot khi cần cho THẤY), máy ghi kèm chụp trước (↶ được).
 *  Câu không đổi giữ giọng cũ; shot đổi hình được đánh dấu cần sinh lại keyframe. Không tự kiểm lại — người bấm kiểm (mỗi bước một lượt tiền). */
export async function suaTheoNguoiXemTap(db: Db, tapId: number, nguoi: string): Promise<{ ok: true; data: { sua: number; them: number; canGiong: number; canHinh: number[]; ghi_chu: string } } | { ok: false; loi: string }> {
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return { ok: false, loi: 'không thấy tập' };
  const t = bc.tap.thu_nguoi_xem;
  if (!t || (!t.cho_kho.length && !t.lech && !t.cat?.length)) return { ok: false, loi: 'chưa có kết quả kiểm người xem (hoặc không có chỗ vấp) — bấm kiểm trước' };
  const tatCa = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh);
  const canh = locNhanh(tatCa, 'A');
  const kt = docKinhThanh(bc.kt);
  const ten = (id: number) => bc.nhanVat.find((v) => v.id === id)?.ten ?? '';
  const bang = canh.map((c) => `#${c.thu_tu} [${c.phan_doan || '—'} · ${c.phat_s ?? c.thoi_luong_s}s · ${c.nhan_vat.map(ten).filter(Boolean).join(', ') || 'không anchor'}]\n  THẤY: ${c.hanh_dong}\n  CHỮ: ${c.chu_man || '—'}\n  LỜI: ${c.thoai.length ? c.thoai.map((d) => `${d.nhan_vat || '(dẫn)'}${d.dien_xuat ? ` (${d.dien_xuat})` : ''}: ${d.loi}`).join(' | ') : '—'}\n  PROMPT ẢNH: ${c.prompt_anh}`).join('\n');
  const anchor = bc.nhanVat.filter((v) => v.loai !== 'phong_cach').map((v) => `- ${v.ten} (${v.loai}): ${v.mo_ta.slice(0, 140)}`).join('\n');
  const vap = [...t.cho_kho.map((x) => `#${x.shot}: ${x.van_de} → gợi ý: ${x.sua}`), ...(t.cat ?? []).map((x) => `#${x.shot}: THU NHỎ được ${x.bot_s}s — ${x.ly_do} (rút phat_s hoặc gộp ý vào shot kề)`)].join('\n');
  const kq = await suaKichBanTheoNguoiXem({ bang, anchor, vap, lech: t.khop ? '' : t.lech, brief: bc.tap.brief, kt });
  if (!kq.ok) return kq;
  await ghiTienChu(db, bc.tap.phim_id, `Sửa kịch bản theo người xem · tập ${bc.tap.so}`, kq.model, kq.tokens);
  const kh = keHoachSua(canh, bc.nhanVat, kq.data.sua, kq.data.them);
  const nhom = await chupTruoc(db, { bang: 'xv_canh', id: kh.capNhat[0]?.id ?? canh[0]!.id, cot: ['thu_tu'], moTa: 'sửa kịch bản theo người xem', nguoi });
  for (const u of kh.capNhat) {
    await chupTruoc(db, { bang: 'xv_canh', id: u.id, cot: ['hanh_dong', 'hanh_dong_vi', 'chu_man', 'thoai', 'loi_thoai', 'thoai_url', 'prompt_anh', 'phat_s', 'loi', 'nhan_vat'], moTa: 'sửa theo người xem', nguoi: '', nhom });
    await db.execute(sql`UPDATE xv_canh SET hanh_dong = ${u.hanh_dong}, hanh_dong_vi = ${u.hanh_dong_vi}, chu_man = ${u.chu_man}, thoai = ${JSON.stringify(u.thoai)}::jsonb, loi_thoai = ${u.loi_thoai}, thoai_url = ${u.thoai_url},
      prompt_anh = ${u.prompt_anh}, prompt_video = ${u.hanh_dong}, nhan_vat = ${JSON.stringify(u.nhan_vat)}::jsonb, phat_s = ${u.phat_s}, thoi_luong_s = GREATEST(thoi_luong_s, ${lamTronClip(u.phat_s)}), loi = ${u.loi}, updated_at = now() WHERE id = ${u.id}`);
  }
  // Shot chèn: chép phân cảnh / kỹ thuật / cảm xúc của shot đứng trước (qua cổng shot list), rồi đánh số lại cả tập theo thuTu.
  const idMoi = new Map<string, number>();
  for (const [i, m] of kh.chen.entries()) {
    const tr = tatCa.find((c) => c.id === m.sau_id)!;
    const r = (await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh, hanh_dong, hanh_dong_vi, chu_man, thoai, loi_thoai, prompt_anh, prompt_video, phat_s, thoi_luong_s, nhan_vat, ky_thuat, phan_doan, cam_xuc, nhanh)
      VALUES (${tapId}, ${tr.thu_tu}, ${m.canh}, ${m.hanh_dong}, ${m.hanh_dong_vi}, ${m.chu_man}, ${JSON.stringify(m.thoai)}::jsonb, ${m.loi_thoai}, ${m.prompt_anh}, ${m.hanh_dong}, ${m.phat_s}, ${lamTronClip(m.phat_s)},
        ${JSON.stringify(m.nhan_vat)}::jsonb, ${JSON.stringify(tr.ky_thuat ?? {})}::jsonb, ${tr.phan_doan}, ${tr.cam_xuc}, ${tr.nhanh}) RETURNING id`)) as unknown as Row[];
    idMoi.set(`m${i}`, Number(r[0]!.id));
  }
  if (kh.chen.length) {
    const ids = kh.thuTu.map((x) => (typeof x === 'number' ? x : idMoi.get(x)!));
    const ngoai = tatCa.filter((c) => !ids.includes(c.id)).map((c) => c.id);   // shot nhánh hook khác: giữ sau cùng, đúng thứ tự cũ
    for (const id of ids) if (typeof id === 'number' && tatCa.some((c) => c.id === id)) await chupTruoc(db, { bang: 'xv_canh', id, cot: ['thu_tu'], moTa: 'đánh số lại', nguoi: '', nhom });
    for (const [i, id] of [...ids, ...ngoai].entries()) await db.execute(sql`UPDATE xv_canh SET thu_tu = ${i + 1} WHERE id = ${id}`);
  }
  const canGiong = [...kh.capNhat.flatMap((u) => u.thoai), ...kh.chen.flatMap((m) => m.thoai)].filter((d) => d.loi.trim() && !d.url).length;
  const canHinh = [...kh.capNhat.filter((u) => u.loi).map((u) => u.id), ...idMoi.values()];
  return { ok: true, data: { sua: kh.capNhat.length, them: kh.chen.length, canGiong, canHinh, ghi_chu: kq.data.ghi_chu } };
}
