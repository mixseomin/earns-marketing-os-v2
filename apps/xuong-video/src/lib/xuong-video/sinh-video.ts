// Lõi sinh video cho một shot + nhận kết quả (Veo qua Google hoặc model fal) — tách khỏi actions.ts để script trên box
// (scripts/sinh-shot.mts) và server action (sinhVideoCanh / kiemVideo) dùng CÙNG một đường; actions chỉ kiểm quyền rồi gọi vào đây.
import { chanDanDat } from './dan-dat';
import { CHAT_LIEU, ghep, ghepTrongTran, goiTenEn, khoi, KHUON, LOAI_VIDEO, tenNgonNguEn, type ChatLieu, type Khoi } from './prompt-khoi';
import { chamPrompt, NGUONG_CHAN, type LoiPrompt } from './kiem-prompt';
import { batCamXuc } from './qc-cam-xuc';
import { moTaChuyenDong, bienTheTheoSo } from './bo-set-3d';
import { tinhCatCuoi } from './cat-cuoi';
import 'server-only';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { uploadToR2 } from '@/lib/r2';
import { batDauVeo, docVeo, taiVeo, taiAnhBase64 } from './google';
import { docFal, guiFal, dauVaoTheoSchema, khoaFal, tranPrompt } from './fal';
import './cong-plenxai';   // đăng ký cổng PlenX (token ở tệp trên box — chỉ máy chủ) vào chuỗi video
import { donVideoCong, CONG_VIDEO, chuoiVideo, guiVideoCong, docVideoCong, giaVideoCong, hieuDaiNhip, laHetTien, tachKhoa, MO_HINH_CONG, type BuocNguon, type NguonSinh } from './cong-ai';
import { baoHetTien } from './bao-het-tien';
import { promptKyThuatVideo, cauVatLy } from './dien-anh';
import { dongThoai, promptCamXuc, laLoiDan, dungTiengClip } from './am-thanh';
import { noiKhungTuClipTruoc } from './noi-khung-clip';
import { promptBieuCam, doiModelVideo, doiModelCanhKho } from './qc-cam-xuc';
import { tronModelCanh } from './sinh-anh';
import { chanVideo } from './quy-trinh';
import { chupTruoc } from './hoan-tac';
import { soiClipCanh, khungDauThieuSp } from './soi-clip';
import { chamMayCanh } from './cham-may';
import { sinhGiongShots } from './sinh-giong';
import { type Canh, type TapHoSo, chatLieuPhim, hopQc, coMau, camCongCuVe, loaiCongCuVe, laTayNguoi, lamTronClip, noiKhungShot, boThoaiTrongPrompt, tenNgonNgu, chanChuModel, phongCachHinh, MO_HINH_VIDEO, NANG_CAP, KHOP_MIENG } from './kieu';
import { cauKhongKhi } from './khan-gia';
import { doiTayDo, cauDoiTayVideo, thieuCachThao } from './thao-do';
import { boiCanhCanh, canhDaThayThe, taoJob, xongJob, mapJob, giaVideoSv, s, mapCanh, type Db, type Row } from './doc-db';
/** Khung hình sống (nhip-hinh.ts): clip AI hay đứng như ảnh — nhân vật làm hành động bằng cả thân, chuyển động phụ không ngừng. */

type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

/** Prompt gửi model video cho một shot — tách riêng để script xem trước (0đ) đúng câu sẽ gửi (scripts/sinh-shot.mts --xem). */
/** Thẻ shot cho clip: hành động đi trọn từ trạng thái mở tới trạng thái kết, giữ hướng màn hình (trục 180°). */
// rendau = khung đầu là ẢNH RENDER 3D (mesh thật, vật liệu thật): diễn như CON RỐI stop-motion — thân giữ nguyên khối. Thử #23 (16/10/2026): câu
// "squash and stretch" làm Veo kéo Tango chảy nhão, tay rối như sợi mì.
// Lối diễn theo CHẤT LIỆU PHIM (prompt-khoi.ts › CHAT_LIEU.dien_video): trước đây ghi cứng "Cartoon acting… squash and stretch" — phim người thật tập 122 sẽ
// diễn kiểu hoạt hình.
const theVideo = (dd: Canh['dan_dung'], cl: ChatLieu, rendau = false): string => [dd?.mo?.trim() && dd?.ket?.trim() ? `The action runs completely from: ${dd.mo.trim()} — to: ${dd.ket.trim()}` : '', dd?.dien?.trim() ? `${CHAT_LIEU[cl].dien_video(rendau)}: ${dd.dien.trim().replace(/[.\s]+$/, '')}` : '', dd?.huong?.trim() ? `Keep screen direction: ${dd.huong.trim()}` : ''].filter(Boolean).map((x) => `${x}.`).join(' ');
/** Bỏ câu đã nói ở khối khác (mở / kết của thẻ shot nằm cả trong prompt_video lẫn câu "from… to…" — bộ chấm báo lặp ở 9 shot tập 122). */
const boCauTrung = (t: string, cum: (string | undefined)[]) => { const c = cum.map((x) => (x ?? '').trim().toLowerCase().replace(/[.\s]+$/, '')).filter((x) => x.split(/\s+/).length >= 3); return t.split(/(?<=[.!?])\s+/).filter((x) => !c.some((k) => x.toLowerCase().includes(k))).join(' '); };
/** DÁNG NHÌN THẤY của từng nhân vật trong prompt video (không gọi tên — model không biết tên): đầy đủ "the woman in the fitted burgundy … dress" + GỌI GỌN
 *  "the woman in the dress" (giới + danh từ cuối của bộ đồ, thêm chữ tới khi không trùng người khác) — lần nhắc sau dùng gọn khi model có trần ký tự. */
export function dangNhinVideo(bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>): { ten: string; day: string; gon: string }[] {
  const ds = ((bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? []).filter((x) => bc.nhanVat.some((n) => n.ten === x.ten && n.loai === 'nhan_vat')).map((v) => {   // mayDu: bộ đồ kế thừa từ shot trước (shot chỉ khai chỗ đổi) — đọc may_3d trơn thì mất đồ, ra 'the woman' trơn
    const nv = bc.nhanVat.find((n) => n.ten === v.ten)!; const ao = (bienTheTheoSo(v, nv)[0]?.mo_ta ?? '').split(/[,;]| with | tucked /)[0]!.trim().toLowerCase();
    const gioi = /\bwoman\b/i.test(nv.mo_ta ?? '') ? 'woman' : /\bman\b/i.test(nv.mo_ta ?? '') ? 'man' : 'person';
    return { ten: v.ten, gioi, tu: ao ? ao.split(/\s+/) : [], day: ao ? `the ${gioi} in the ${ao}` : `the ${gioi}` };
  });
  return ds.map((x) => {
    let gon = x.day;
    for (let k = 1; k < x.tu.length; k++) { const g = `the ${x.gioi} in the ${x.tu.slice(-k).join(' ')}`; if (!ds.some((y) => y !== x && (y.day === g || y.day.endsWith(` ${x.tu.slice(-k).join(' ')}`) && y.gioi === x.gioi))) { gon = g; break; } }
    return { ten: x.ten, day: x.day, gon };
  });
}
/** KHỐI prompt video (prompt-khoi.ts) — promptVideoCanh ghép, chamVideo chấm theo KHUON.video. */
export function khoiVideoCanh(bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>): Khoi[] {
  // CƠ CHẾ ĐỔI TAY / THÁO ĐỒ ĐEO (thao-do.ts) nối vào lối diễn TRƯỚC khi thay thẻ — #132 #15 chỉ ghi "snatches the badge off her neck", Kling kéo thẳng dây xuyên đầu
  { const ct = cauDoiTayVideo(doiTayDo((bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? [], (t) => bc.nhanVat.some((v) => v.ten === t && v.loai === 'nhan_vat')));
    if (ct) bc = { ...bc, canh: { ...bc.canh, dan_dung: { ...(bc.canh.dan_dung ?? {}), dien: `${bc.canh.dan_dung?.dien ?? ''} ${ct}`.trim() } } }; }
  bc = canhDaThayThe(bc);   // thẻ {Tên} → mô tả en của đúng vật
  // Shot đã có file giọng riêng → clip KHÔNG được tự đọc thoại (Veo đọc giọng lơ lớ, chồng với TTS — #1219); miệng vẫn cử động để khớp miệng sau.
  const coGiong = dongThoai(bc.canh, bc.nhanVat).some((d) => d.url);
  // Sản phẩm/người/bối cảnh phải giữ y như khung đầu (keyframe đã duyệt): Veo tự "sửa" quần theo chữ tả trong prompt_video và cho nhân vật
  // đi khỏi khung (thử 2 shot 09/10/2026) — nói rõ khung đầu là chân lý, chủ thể ở trong khung suốt clip, không chữ.
  const coSp = bc.nhanVat.some((v) => v.loai === 'san_pham');
  const lv = LOAI_VIDEO[bc.loai] ?? LOAI_VIDEO.phim;
  const giuKhung = `The main subject stays fully in frame for the whole clip${coSp ? `; ${lv.sp_giu} stays exactly as in the first frame` : ''}.`;
  // Shot có sản phẩm mà hành động chỉ tả mặt ("cười, gật đầu", "push-in") + câu khung sống (CHAT_LIEU.song_video) đòi cử động cả thân → model tự bịa cử chỉ vào món
  // gần tay nhất: #54 shot 9 (16/10/2026) ông Mike kéo cổ áo polo trong phim bán QUẦN, máy đẩy vào cắt mất quần. Cử chỉ phải dồn vào sản phẩm.
  const tenSp = bc.nhanVat.filter((v) => v.loai === 'san_pham').map((v) => v.ten.trim()).filter(Boolean).join(', ');
  const spTrongTam = coSp ? lv.sp_tam(tenSp) : '';
  // KHÔNG THÊM GÌ NGOÀI KHUNG ĐẦU (anh 15/10/2026: "bắt sinh ảnh, video phải tuân thủ tuyệt đối cái gì 3D đặt vào — chỉ được format, chuyển động"):
  // khung đầu dựng từ 3D đã có đủ thứ trong khung; clip chỉ được làm chúng chuyển động. Ai / món gì khung 3D kết mới thấy (đi vào khung) thì được vào.
  const vaoKhung = (bc.canh.khung_xam?.di ?? []).filter((d) => d.tu.some((x) => x < 0 || x > 1) && d.den.every((x) => x >= 0 && x <= 1)).map((d) => d.ten);
  const khongThem = CHAT_LIEU[chatLieuPhim(bc.kt)].khong_them(vaoKhung.length ? ` (only ${vaoKhung.map(goiTenEn([...bc.nhanVat, ...bc.nvPhim])).join(', ')} may enter, as the action says)` : '');   // mọi shot, kể cả không 3D (khối bắt buộc — prompt-khoi.ts › KHUON)
  // Thoại: KHÔNG lấy câu trong ngoặc kép của prompt_video (ngôn ngữ cũ, Veo in thành phụ đề) — ghép từ dòng thoại hiện tại của shot;
  // có file giọng riêng rồi thì clip câm (chỉ cử miệng). Nên sinh GIỌNG trước VIDEO.
  const dong = dongThoai(bc.canh, bc.nhanVat).filter((d) => d.loi.trim());
  // Lời dẫn ngoài khung (V.O./voice-over/không có người nói) KHÔNG được cho ai trong khung nhép miệng — thử 09/10/2026: lời Linda V.O. mà prompt
  // bảo "nhân vật cử miệng" thì ông Tom nhép câu của vợ. Chỉ người nói có mặt trong shot + không ghi V.O. mới cử miệng.
  const laVO = (d: { nhan_vat: string; dien_xuat: string }) => !d.nhan_vat.trim() || laLoiDan(d.dien_xuat);
  const trongKhung = dong.filter((d) => !laVO(d));
  const thoaiVeo = coGiong || !dong.length ? '' : [
    trongKhung.length ? `On-camera dialogue (${tenNgonNguEn(bc.kt.ngon_ngu)}, natural lip-sync, no subtitles): ${trongKhung.map((d) => `${d.nhan_vat} says "${d.loi.trim()}"`).join('; ')}.` : '',
    dong.some(laVO) ? `Off-screen voice-over (${tenNgonNguEn(bc.kt.ngon_ngu)}, nobody in frame moves their lips for it): ${dong.filter(laVO).map((d) => `"${d.loi.trim()}"`).join(' ')}` : '',
  ].filter(Boolean).join(' ');
  // Khung đầu là ảnh render 3D: KHÔNG câu phong cách chung (nó có "bokeh", "monitor glow" → Veo thêm đèn mờ sau nền, #23) — giữ đúng ảnh đầu.
  // Cấm chữ / nhãn tên (Veo in "Mr. Wipe", "Lint" lên hình vì prompt gọi tên) và mặt hoạt hình vẽ thêm (Lint mọc mắt nhắm miệng méo).
  const rendau = !!bc.canh.khung_xam?.mau && bc.canh.keyframe_url === bc.canh.khung_xam.mau;
  const cl = chatLieuPhim(bc.kt);
  // GIỮ KHUNG ĐẦU theo chất liệu (CHAT_LIEU.giu_video): hoạt hình chỉ khi khung đầu là ảnh render 3D; người thật luôn (giữ mặt, đồ, bối cảnh).
  const giuAnh = CHAT_LIEU[cl].giu_video;
  const chen = bc.canh.ky_thuat?.co_canh === 'insert';   // cận chèn: không đòi cử động cả người, không biểu cảm mặt (mặt ngoài khung)
  // KHÔNG GỌI TÊN trong prompt video (19/10/2026 #1): model video không biết tên ai — hai phụ nữ tóc đen chỉ gọi "Vivian" / "Hạ" thì Veo đảo vai, và
  // tên trong prompt bị in lên hình ("Vivian" ở góc khung). Mọi tên nhân vật (đầy đủ + tên gọi tắt) thay bằng DÁNG NHÌN THẤY: giới + bộ đồ của shot.
  const moTaNhin = new Map(dangNhinVideo(bc).map((x) => [x.ten, x.day] as const));
  const thayTen = (t: string): string => {
    let o = t;
    for (const [ten, mt] of [...moTaNhin].sort((x, y) => y[0].length - x[0].length)) {
      const goi = ten.trim().split(/\s+/); const cac = [ten, ...(goi.length >= 2 ? [goi[goi.length - 1]!] : [])];
      for (const c of cac) o = o.replace(new RegExp(`(^|[^\\p{L}])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^\\p{L}]|$)`, 'gu'), (_m, tr: string) => `${tr}${mt}`);
    }
    return o;
  };
  const ds: Khoi[] = [
    khoi('phong_cach', !rendau && phongCachHinh(bc.kt.phong_cach) ? `Visual style: ${phongCachHinh(bc.kt.phong_cach).replace(/[.\s]+$/, '')}.` : ''),
    // KHOẢNH KHẮC: prompt_video riêng của shot (nếu có); thẻ có mở / kết thì khối diễn đã nói — không lấy hanh_dong (mô tả cho người đọc, có thể tiếng Việt)
    khoi('cong_cu', camCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat))), khoi('khoanh_khac', boCauTrung(boThoaiTrongPrompt(bc.canh.prompt_video.trim() || (bc.canh.dan_dung?.mo && bc.canh.dan_dung?.ket ? '' : bc.canh.hanh_dong)), [bc.canh.dan_dung?.mo, bc.canh.dan_dung?.ket])),
    // đường đi: đồ đang cầm / đeo (vi_tri.cam) đi theo người, không tả riêng — tả riêng làm video phô món đó (#12 tổng tài: vòng ngọc gài lộ trước cú trả #25)
    khoi('dien', theVideo(bc.canh.dan_dung, cl, rendau)), khoi('chuyen_dong', moTaChuyenDong(bc.canh.khung_xam?.di?.filter((d) => !bc.canh.may_3d?.vi_tri.some((v) => v.ten === d.ten && v.cam)), goiTenEn([...bc.nhanVat, ...bc.nvPhim]), (t) => [...bc.nhanVat, ...bc.nvPhim].some((v) => v.ten === t && v.loai === 'nhan_vat'), (t) => bc.canh.may_3d?.vi_tri.some((v) => v.ten === t && v.den && Math.hypot(v.den[0]! - v.tam[0]!, v.den[1]! - v.tam[1]!, (v.den[2] ?? 0) - (v.tam[2] ?? 0)) >= 15) ?? true)), khoi('khac', lv.song(coMau(bc.kt.qc)) ? CHAT_LIEU[cl].song_video(chen) : ''), khoi('vat', spTrongTam),
    khoi('thoai', thoaiVeo), khoi('giu', `${giuAnh} ${giuKhung} ${cauVatLy(bc.kt.the_loai)}`.trim()), khoi('khong_them', khongThem), khoi('cam_chu', 'No on-screen text, captions, subtitles or logos.'),
    khoi('trang_thai', bc.canh.trang_phuc.trim() ? `Clothing stays exactly: ${bc.canh.trang_phuc.trim()}; no extra garments.` : ''), khoi('may', promptKyThuatVideo(bc.canh.ky_thuat)),
    khoi('cam_xuc', chen ? '' : promptCamXuc(bc.canh, bc.nhanVat, 'video')), khoi('bieu_cam', chen ? '' : promptBieuCam(bc.canh.bieu_cam, 'video')),
    // Ý đồ khán giả → KHÔNG KHÍ (khan-gia.ts › cauKhongKhi): chỉ không khí / ánh sáng / nhịp, không đổi nét mặt đã khai ở khối bieu_cam.
    khoi('khong_khi', cauKhongKhi(bc.khanGia ?? [])),
    khoi('thoai', coGiong ? (trongKhung.length ? `${[...new Set(trongKhung.map((d) => d.nhan_vat))].join(' and ')} speak their lines with natural lip movement; the dialogue audio is replaced by a separate voice recording in the edit.` : 'The lines are an off-screen voice-over: nobody in frame talks or moves their lips as if speaking.') : ''   /* 19/10/2026: "audio must contain NO spoken words" + mấp máy môi nói → Veo báo 'unable to generate audio' (4 shot tập 122, hỏng lặp lại); bản xuất đã bỏ tiếng clip khi có giọng riêng */),
  ];
  return ds.map((k) => ({ ...k, chu: thayTen(k.chu) }));
}
export const promptVideoCanh = (bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>): string => ghep(khoiVideoCanh(bc));
/** CHẤM prompt video (kiem-prompt.ts, khuôn KHUON.video): chất liệu phim, tiếng Việt lọt vào, cận chèn tả mặt, lặp — chặn trước khi gửi model video. */
export function chamVideo(bc: NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>): { diem: number; loi: LoiPrompt[] } {
  return chamPrompt([{ ten: KHUON.video.ten, duong: 'video', khoi: khoiVideoCanh(bc) }], { co_canh: bc.canh.ky_thuat?.co_canh, chat_lieu: chatLieuPhim(bc.kt), ten_rieng: bc.nhanVat.map((v) => v.ten), nguoi: [], vat: [],
    di: (bc.canh.khung_xam?.di ?? []).map((d) => ({ ten: d.ten, dx: d.den[0]! - d.tu[0]! })),
    // ngoài khung CẢ shot: nhân vật của shot mà 3D không thấy lúc mở và không đi vào (khung_xam.kiem / di)
    ngoai: bc.canh.khung_xam?.kiem ? bc.nhanVat.filter((v) => v.loai === 'nhan_vat' && !bc.canh.khung_xam!.kiem!.some((k) => k.nhan_vat === v.ten && k.trong_khung) && !(bc.canh.khung_xam!.di ?? []).some((d) => d.ten === v.ten && d.den.every((x) => x >= 0 && x <= 1))).map((v) => v.ten) : [] });
}

/** Nối cảnh: khung cuối = keyframe cảnh kế (cùng tập) khi tập bật noi_khung → các clip ghép liền mạch, bản cuối khớp bố cục bản nháp.
 *  Một chỗ cho lúc sinh thật và sơ đồ nguồn. */
/** Câu giải thích ảnh thứ 2 có dải nhịp (thử 19/10/2026: không giải thích thì model coi cả tờ là khung cuối). */
export const cauChuoiCuoi = (soNhip: number): string => `The SECOND reference image is the FINAL SHOT of this clip with a small white-framed storyboard strip of ${soNhip} beats laid over its top edge. The strip is NOT part of the film — it only shows the beats in order (${soNhip === 3 ? 'the opening, the middle of the action, the final moment' : 'the opening, the final moment'}). Follow those beats and end on the full-frame scene underneath the strip; never show the strip, panels, borders or white frames at any moment.`;
/** Dựng ảnh thứ 2: ảnh KẾT đầy khung + dải nhịp (các ảnh theo thứ tự, ô cuối = ảnh kết) trong khung trắng ở mép trên (~21 % chiều cao). null = hỏng. */
export async function anhCuoiChuoi(canhId: number, nhip: string[]): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const tai = async (u: string) => Buffer.from(await (await fetch(u)).arrayBuffer());
    const ket = await tai(nhip[nhip.length - 1]!); const m = await sharp(ket).metadata(); const W = m.width!, H = m.height!;
    const th = Math.round(H * 0.21), tw = Math.round((th * W) / H), gap = Math.round(W * 0.017), vien = Math.round(W * 0.011);
    const tong = nhip.length * tw + (nhip.length - 1) * gap; const x0 = Math.round((W - tong) / 2), y0 = Math.round(H * 0.008);
    const o = await Promise.all(nhip.map(async (u) => sharp(await tai(u)).resize(tw, th, { fit: 'cover' }).jpeg().toBuffer()));
    const nen = await sharp({ create: { width: tong + 2 * vien, height: th + 2 * vien, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    const out = await sharp(ket).composite([{ input: nen, left: x0 - vien, top: y0 }, ...o.map((b, i) => ({ input: b, left: x0 + i * (tw + gap), top: y0 + vien }))]).jpeg({ quality: 92 }).toBuffer();
    return await uploadToR2(`xuong-video/keyframe/${canhId}-chuoi-${Date.now()}.jpg`, out, 'image/jpeg');
  } catch (e) { console.error('[ảnh cuối chuỗi]', e); return null; }
}
/** Đọc ảnh / clip thành khung xám 90×160 (24 khung/giây) bằng ffmpeg. */
async function khungXam(url: string): Promise<Uint8Array[]> {
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  const { stdout } = await promisify(execFile)('ffmpeg', ['-v', 'error', '-i', url, '-vf', 'scale=90:160,format=gray,fps=24', '-f', 'rawvideo', '-'], { encoding: 'buffer', maxBuffer: 256 << 20, timeout: 120_000 });
  const n = 90 * 160; const F: Uint8Array[] = []; for (let i = 0; i + n <= stdout.length; i += n) F.push(new Uint8Array(stdout.subarray(i, i + n)));
  return F;
}
/** Điểm cắt cuối của clip: so từng khung với ảnh thứ 2 (có dải nhịp) và ảnh kết (không dải) — cat-cuoi.ts. */
export async function catCuoiClip(url: string, anhChuoi: string, anhKet: string): Promise<number | null> {
  const [F, A, B] = await Promise.all([khungXam(url), khungXam(anhChuoi), khungXam(anhKet)]);
  return A[0] && B[0] ? tinhCatCuoi(F, A[0], B[0], 24) : null;
}
export async function khungCuoiCanh(db: Db, canhId: number): Promise<string | null> {
  // Keyframe KẾT của chính shot (sinh từ khung màu chỗ kết của bản 3D) thắng mọi nguồn khác: video phải đi đúng từ chỗ mở tới chỗ kết.
  const kk = (await db.execute(sql`SELECT keyframe_ket FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[];
  if (kk[0]?.keyframe_ket) return s(kk[0].keyframe_ket);
  const ke = (await db.execute(sql`SELECT c2.keyframe_url, t.noi_khung, c.ky_thuat FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id
    LEFT JOIN LATERAL (SELECT keyframe_url FROM xv_canh x WHERE x.tap_id = c.tap_id AND x.thu_tu > c.thu_tu ORDER BY x.thu_tu LIMIT 1) c2 ON true WHERE c.id = ${canhId}`)) as unknown as Row[];
  return ke[0] && noiKhungShot(ke[0].noi_khung === true, { ky_thuat: ke[0].ky_thuat as { chuyen_canh?: string } | null }) && ke[0].keyframe_url ? s(ke[0].keyframe_url) : null;
}

/** Veo trên Google → cùng model trên fal (dự phòng khi Google hết lượt/ngày). Id đã kiểm tồn tại trên fal.ai/models 15/10/2026. */
const VEO_SANG_FAL: Record<string, string> = {
  'veo-3.1-lite-generate-preview': 'fal-ai/veo3.1/lite/image-to-video',
  'veo-3.1-fast-generate-preview': 'fal-ai/veo3.1/fast/image-to-video',
  'veo-3.1-generate-preview': 'fal-ai/veo3.1/image-to-video',
};

/** Gửi một shot đi sinh video (nháp hoặc bản cuối) — shot phải đã duyệt keyframe. Trả về id job; kết quả về qua kiemVideoTap. */
/** tuDong (nút "Sinh nháp" một lần bấm, 13/10/2026 — "không lỗi thì chặn"): keyframe đang chọn chưa duyệt → bấm sinh video = duyệt nó;
 *  còn dòng thoại/lời dẫn chưa có giọng → sinh giọng trước, giọng xong máy tự gửi video (hoanTatAm). Trả data = 0 khi mới xếp giọng. */
/** thu = SINH THỬ ngoài quy trình (anh 14/10/2026: "phải cho thử ngoài quy trình"): bỏ cổng sản xuất (duyệt keyframe, kiểm khung, animatic,
 *  giọng trước) — vẫn cần keyframe; job ghi rõ 🧪 THỬ. Chỉ admin bấm, tiền tính như thường. */
/** boQuaCong: đi thẳng model đã chọn (Google), không qua chuỗi cổng — dùng khi task cổng vừa treo/hỏng và đang sinh lại. */
/** Ô PlenX (đo 21/10/2026, phim #222): một tài khoản nhận tối đa 4 video đang xử lý (quá → 429 "Đã đạt giới hạn 4 video"), và 4 task gửi dồn trong vài
 *  giây thì PlenX NHẬN rồi tự hỏng "Quá nhiều request" / "Tạo nội dung thất bại". Nên: đếm ô đang chạy trong DB (mọi tiến trình) — đủ XV_PLENX_TOI_DA
 *  (mặc định 3) thì trả lý do để chuỗi tràn sang cổng sau; và các lần gửi PlenX trong một tiến trình xếp lần lượt, cách nhau ≥ XV_PLENX_GIAN_MS (4s). */
const PLENX_TOI_DA = Math.max(1, Number(process.env.XV_PLENX_TOI_DA || 3));
async function oPlenx(db: Db): Promise<string | null> {
  const n = Number(((await db.execute(sql`SELECT count(*) AS n FROM xv_job WHERE provider = 'plenxai' AND loai = 'video' AND trang_thai = 'chay' AND created_at > now() - interval '30 minutes'`)) as unknown as Row[])[0]?.n ?? 0);
  return n >= PLENX_TOI_DA ? `PlenX đầy ô (${n}/${PLENX_TOI_DA} đang chạy) — tràn sang cổng sau` : null;
}
let hangPlenx: Promise<unknown> = Promise.resolve(); let lanCuoiPlenx = 0;
function guiPlenxGian<T>(f: () => Promise<T>): Promise<T> {
  const p = hangPlenx.then(async () => {
    const cho = lanCuoiPlenx + Math.max(0, Number(process.env.XV_PLENX_GIAN_MS || 4000)) - Date.now();
    if (cho > 0) await new Promise((r) => setTimeout(r, cho));
    try { return await f(); } finally { lanCuoiPlenx = Date.now(); }
  });
  hangPlenx = p.catch(() => null); return p;
}
export async function batDauVideoCanh(db: Db, canhId: number, moHinh?: string, ban: 'nhap' | 'cuoi' = 'nhap', tuDong = false, thu = false, boQuaCong = false): Promise<Kq<number>> {
  let bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  // Shot nối liền (Murch QC): khung đầu = khung cuối clip shot trước — đặt trước mọi cổng để cổng xét đúng keyframe sẽ dùng.
  if (bc.canh.noi_lien) { const e = await noiKhungTuClipTruoc(db, bc.canh); if (e) return loi(`Shot #${bc.canh.thu_tu}: ${e}`); bc = (await boiCanhCanh(db, canhId))!; }
  if (!thu && tuDong && bc.canh.keyframe_url && (bc.canh.trang_thai === 'co_keyframe' || bc.canh.trang_thai === 'nhap')) {
    await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['trang_thai', 'loi'], moTa: 'duyệt keyframe (bấm Sinh nháp)', nguoi: 'Sinh nháp' });
    await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet', loi = '', updated_at = now() WHERE id = ${canhId}`);
    bc = (await boiCanhCanh(db, canhId))!;
  }
  if (!thu && tuDong && dongThoai(bc.canh, bc.nhanVat).some((d) => d.loi.trim() && !d.url)) {
    const g = await sinhGiongShots(db, bc.canh.tap_id, [canhId], { chiThieu: true, sauVideo: { moHinh, ban } });
    return g.ok ? { ok: true, data: 0 } : loi(`Sinh giọng trước video không được: ${g.loi}`);
  }
  // Cổng sản xuất (quy-trinh.ts): keyframe đã duyệt + GIỌNG TRƯỚC VIDEO.
  // + ANIMATIC đã duyệt (quy-trinh.ts › chanAnimatic): đọc hồ sơ tập + mọi shot của tập để so mã.
  const tapR = ((await db.execute(sql`SELECT t.ho_so, p.loai FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${bc.canh.tap_id}`)) as unknown as Row[])[0];
  const dsTap = ((await db.execute(sql`SELECT thu_tu, nhanh, keyframe_url, phat_s, thoi_luong_s FROM xv_canh WHERE tap_id = ${bc.canh.tap_id}`)) as unknown as Row[]).map((r) => ({ thu_tu: Number(r.thu_tu), nhanh: String(r.nhanh ?? ''), keyframe_url: (r.keyframe_url as string | null) ?? null, phat_s: r.phat_s == null ? null : Number(r.phat_s), thoi_luong_s: Number(r.thoi_luong_s) }));
  const qt = chanVideo(bc.canh, bc.nhanVat, tapR?.loai === 'quang_cao', { hoSo: (tapR?.ho_so ?? {}) as TapHoSo, ds: dsTap, camXucQc: batCamXuc(String(tapR?.loai ?? ''), bc.kt) });
  // Cổng DẪN DẮT + khuôn chuỗi (dan-dat.ts) — cùng luật với keyframe (quy-trinh.ts › chanShot).
  { const t = ((await db.execute(sql`SELECT phan_canh, khuon_chuoi FROM xv_tap WHERE id = ${bc.canh.tap_id}`)) as unknown as Row[])[0];
    const dsDd = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${bc.canh.tap_id} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh).filter((x) => (x.nhanh || 'A') === (bc.canh.nhanh || 'A') || !x.nhanh);
    qt.push(...chanDanDat(bc.canh.id, dsDd, { phan_canh: (t?.phan_canh ?? []) as never, khuon_chuoi: (t?.khuon_chuoi ?? []) as never }, bc.kt.the_loai)); }
  // Một cảnh một model ảnh (sinh-anh.ts › tronModelCanh): keyframe lệch model của cảnh thì không tiêu tiền video lên nó.
  { const tm = await tronModelCanh(db, bc.canh); if (tm) qt.push(tm); }
  // QC: keyframe gắn sản phẩm mà không thấy màu sản phẩm (soi-clip.ts) — mặc sai quần thì clip nào cũng sai, không tiêu tiền lên nó.
  if (tapR?.loai === 'quang_cao') { const sp = await khungDauThieuSp(db, bc.canh).catch((e) => { console.error(`đo màu sản phẩm keyframe shot ${canhId}:`, e); return null; }); if (sp) qt.push(sp); }
  if ((!thu && qt.length) || !bc.canh.keyframe_url) return loi(`Shot #${bc.canh.thu_tu} chưa qua quy trình: ${qt.join('; ') || 'chưa có keyframe'}`);
  const chan = chanChuModel(bc.kt.ngon_ngu, { phongCach: bc.kt.phong_cach, shot: bc.canh, anchor: bc.nhanVat });
  if (chan) return loi(chan);
  // Cổng nhận được lấy từ MỘT chỗ (cong-ai.ts › tachKhoa) — trước là regex chép tay, thêm cổng mới (kie, wavespeed) là ô chọn bị lờ đi.
  if (moHinh && (moHinh.startsWith('fal:') || tachKhoa(moHinh).kieu !== 'tu_chon' || MO_HINH_VIDEO.some((m) => m.key === moHinh))) bc.kt.mo_hinh_video = moHinh as typeof bc.kt.mo_hinh_video;
  // Model theo NỘI DUNG (qc-cam-xuc.ts): có trẻ em → Veo từ chối → đổi sang Kling TRƯỚC khi gửi (Jett #61 shot 1/2/11 hỏng 3 lượt).
  const doiM = doiModelVideo(bc.kt.mo_hinh_video, bc.nhanVat.filter((v) => v.loai === 'nhan_vat'));
  if (doiM) bc.kt.mo_hinh_video = doiM.model as typeof bc.kt.mo_hinh_video;
  // CẢNH KHÓ (qc-cam-xuc.ts › canhKho): ≥ 2 người cùng đi / món cầm đổi chỗ → Kling — lượt chỉ đích danh model (moHinh) thì giữ model đó
  const kho = moHinh ? null : doiModelCanhKho(bc.kt.mo_hinh_video, (bc.mayDu ?? bc.canh.may_3d)?.vi_tri, (t) => bc.nhanVat.some((v) => v.ten === t && v.loai === 'nhan_vat'));
  if (kho) { bc.kt.mo_hinh_video = kho.model as typeof bc.kt.mo_hinh_video; console.log(`[video] shot #${bc.canh.thu_tu}: ${kho.ly_do}`); }
  // Lượt THỬ ngoài quy trình (thu) được dùng model cấm QC khi anh chỉ đích danh (16/10/2026: "grok trước sinh ổn mà, thử lại xem" — Veo chặn ảnh có
  // trẻ em, Jett #61 shot 1/2/11); clip thử vẫn qua máy soi chữ lạ (soi-clip.ts) như mọi clip. Sản xuất (không thu) giữ chặn.
  if (!thu && !hopQc(bc.kt.mo_hinh_video, tapR?.loai === 'quang_cao')) return loi(`${bc.kt.mo_hinh_video} không dùng cho video quảng cáo (Pika thiếu cảm xúc, Grok tự in phụ đề giả) — chọn Veo qua Google / Kling`);
  // Khoá model (cong-ai.ts › tachKhoa): 'shopaikey:<model>' = đúng cổng đó (không dự phòng) · 'google:<model>' = Google trực tiếp · trần = tự chọn.
  const khoaVid = tachKhoa(bc.kt.mo_hinh_video);
  if (khoaVid.kieu === 'google') { bc.kt.mo_hinh_video = khoaVid.model as typeof bc.kt.mo_hinh_video; boQuaCong = true; }
  // BỘ CHẤM PROMPT VIDEO: lỗi nặng (chất liệu sai, tiếng Việt lọt vào…) thì không tiêu tiền video lên prompt rác — kể cả lượt thử
  { const cv = chamVideo(bc).loi.filter((l) => l.phat >= NGUONG_CHAN); if (cv.length) return loi(`Shot #${bc.canh.thu_tu} — bộ chấm prompt video: ${cv.map((l) => l.chu).join(' · ')}`); }
  const giay = lamTronClip(bc.canh.thoi_luong_s);
  const laFal = bc.kt.mo_hinh_video.startsWith('fal:');
  { const t = thieuCachThao(doiTayDo((bc.mayDu ?? bc.canh.may_3d)?.vi_tri ?? [], (x) => bc.nhanVat.some((v) => v.ten === x && v.loai === 'nhan_vat'))); if (t) return loi(`Shot #${bc.canh.thu_tu}: ${t}`); }
  const khungCuoi0 = await khungCuoiCanh(db, canhId);
  // NỀN ẢNH KẾT = NỀN ẢNH ĐẦU (ghep-vung.ts › thieuGhepNen): shot máy yên mà ảnh kết / giữa chưa chép nền từ keyframe mở thì không tiêu tiền video —
  // model đi tới ảnh kết, nền ảnh kết lệch là clip đổi phòng (#132 #16 #19, 23/10/2026)
  if (khungCuoi0 && khungCuoi0 === bc.canh.keyframe_ket) { const { soatGhepNen } = await import('./ghep-vung'); const gn = await soatGhepNen(db, bc.canh); if (gn.chan) return loi(`Shot #${bc.canh.thu_tu}: ${gn.chan}`); if (gn.boGiua) { console.log(`[video] shot #${bc.canh.thu_tu}: ảnh GIỮA không đạt ghép nền — bỏ, chỉ đi tới ảnh kết`); bc.canh.keyframe_giua = null; } }
  // ẢNH THỨ 2 = ẢNH KẾT THẬT + DẢI NHỊP (anh 19/10/2026, thử #1 tập 122): model video luôn "đi tới" ảnh thứ 2 — ảnh kết thật đầy khung kèm dải 3 nhịp
  // (đầu → giữa → kết) ở mép trên dẫn hành động + ghim kết cục; ~0,5 giây cuối clip hoà tan ra dải nhịp → máy dò lúc dải hiện (catCuoiClip) và
  // bản xuất cắt trước đó. Chỉ khi ảnh cuối là keyframe KẾT của chính shot (không áp cho nối khung sang shot kế).
  const chuoiCuoi = !!(khungCuoi0 && bc.canh.keyframe_ket && khungCuoi0 === bc.canh.keyframe_ket && bc.canh.keyframe_url)
    ? await anhCuoiChuoi(canhId, [bc.canh.keyframe_url!, bc.canh.keyframe_giua ?? '', bc.canh.keyframe_ket!].filter(Boolean)) : null;
  // ảnh thứ 2 + prompt THEO MODEL: chỉ model hiểu dải nhịp (cong-ai.ts › hieuDaiNhip) nhận ảnh kết + dải; model khác nhận ảnh kết trơn, không câu dải
  const promptTron = promptVideoCanh(bc);
  const cuoiCho = (model: string) => (chuoiCuoi && hieuDaiNhip(model) ? chuoiCuoi : khungCuoi0);
  // Trần ký tự theo model (fal.ts › tranPrompt): Kling 2.500 → bỏ dần khối phụ (prompt-khoi.ts › ghepTrongTran); vẫn quá thì gửi nguyên — fal trả lỗi rõ, không tốn tiền
  const khoiV = khoiVideoCanh(bc);
  const promptCho = (model: string) => { const t = tranPrompt(model.replace(/^fal:/, '')); const goc = t ? ghepTrongTran(khoiV, t, dangNhinVideo(bc).map((x) => [x.day, x.gon] as const)) ?? promptTron : promptTron; return chuoiCuoi && hieuDaiNhip(model) ? `${goc} ${cauChuoiCuoi(bc.canh.keyframe_giua ? 3 : 2)}` : goc; };
  const khungCuoi = cuoiCho(bc.kt.mo_hinh_video); const prompt = promptCho(bc.kt.mo_hinh_video);
  // Tiếng clip chỉ sinh khi shot có người nói trong khung chưa có giọng riêng — cùng luật bản xuất dùng tiếng clip (dungTiengClip).
  // Google Veo (Gemini API) không có công tắc tiếng: vẫn sinh, bản xuất tự bỏ.
  const tieng = dungTiengClip(bc.canh, bc.nhanVat);
  const uocCents = await giaVideoSv(bc.kt.mo_hinh_video, bc.kt.do_phan_giai, giay, laFal ? tieng : true).catch(() => undefined);
  const job = await taoJob(db, { cents: uocCents, nhan: `${thu ? '🧪 THỬ (ngoài quy trình) · ' : ''}Video ${ban === 'cuoi' ? 'BẢN CUỐI' : 'nháp'} · cảnh #${bc.canh.thu_tu} ${bc.canh.canh} · ${giay}s${tieng ? '' : ' · không tiếng'}`, canh_id: canhId, loai: 'video', provider: laFal ? 'fal' : 'google', model: bc.kt.mo_hinh_video, request: { prompt, giay, doPhanGiai: bc.kt.do_phan_giai, tiLe: bc.kt.ti_le, ban, khungDau: bc.canh.keyframe_url, khungCuoi, chuoiCuoi: !!chuoiCuoi, tieng: laFal ? tieng : true } });
  let kq: { ok: true; taskId: string } | { ok: false; loi: string };
  // CHUỖI CỔNG (cong-ai.ts): shot dùng Veo → thử Grok qua ShopAIKey trước (rẻ hơn, ~95s); không nhận thì gọi Google như cũ.
  const thuCong: BuocNguon[] = [];
  const chuoi = khoaVid.kieu === 'cong' ? [{ cong: khoaVid.cong, model: khoaVid.model, giay: MO_HINH_CONG.find((m) => m.key === `${khoaVid.cong}:${khoaVid.model}`)?.giay ?? 10 }] : chuoiVideo(bc.kt.mo_hinh_video, tapR?.loai === 'quang_cao');
  if (!laFal && !boQuaCong) {
    for (const [iB, b] of chuoi.entries()) {
      // PlenX đầy ô → TRÀN sang bậc sau (Kie, cùng Veo 3.1) thay vì xếp hàng chờ (anh 21/10/2026: "ko thể để chậm lại đc"). Chỉ khi còn bậc sau.
      const tran = b.cong === 'plenxai' && iB < chuoi.length - 1 ? await oPlenx(db) : null;
      if (tran) { thuCong.push({ cong: b.cong, model: b.model, ok: false, loi: tran }); continue; }
      const pB = promptCho(b.model), cB = cuoiCho(b.model);
      const g = b.cong === 'plenxai' ? await guiPlenxGian(() => guiVideoCong(b.cong, b.model, { prompt: pB, anhDau: bc.canh.keyframe_url!, anhCuoi: cB, giay: b.giay, doPhanGiai: bc.kt.do_phan_giai }))
        : await guiVideoCong(b.cong, b.model, { prompt: pB, anhDau: bc.canh.keyframe_url, anhCuoi: cB, giay: b.giay, doPhanGiai: bc.kt.do_phan_giai });
      if (g.ok) {
        thuCong.push({ cong: b.cong, model: b.model, ok: true });
        const nguon: NguonSinh = { cong: b.cong, model: b.model, ...giaVideoCong(b.cong, b.model), thu: thuCong };
        await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${g.taskId}, provider = ${b.cong}, model = ${b.model}, nguon = ${JSON.stringify(nguon)}::jsonb,
          request = request || ${JSON.stringify({ giay: b.giay, prompt: pB, khungCuoi: cB })}::jsonb, updated_at = now() WHERE id = ${job}`);   // ảnh / prompt THẬT đã gửi bậc này
        await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
        if (thuCong.some((x) => x.het_tien)) void baoHetTien(db, thuCong, `video shot #${bc.canh.thu_tu} · job #${job}`).catch(() => {});
        return { ok: true, data: job };
      }
      thuCong.push({ cong: b.cong, model: b.model, ok: false, loi: g.loi, het_tien: laHetTien(b.cong, g.loi, g.status) });
    }
    // Chọn đích danh một cổng mà cổng không nhận → báo lỗi, KHÔNG tự sang Google (anh đã chọn nguồn).
    if (khoaVid.kieu === 'cong') {
      const l = thuCong[thuCong.length - 1]?.loi ?? 'cổng không nhận';
      await db.execute(sql`UPDATE xv_job SET nguon = ${JSON.stringify({ cong: khoaVid.cong, model: khoaVid.model, thu: thuCong })}::jsonb WHERE id = ${job}`);
      await xongJob(db, job, { loi: l });
      return loi(`${bc.kt.mo_hinh_video}: ${l}`);
    }
    if (thuCong.length) {
      await db.execute(sql`UPDATE xv_job SET nguon = ${JSON.stringify({ cong: 'google', model: bc.kt.mo_hinh_video, thu: [...thuCong, { cong: 'google', model: bc.kt.mo_hinh_video, ok: true }] })}::jsonb WHERE id = ${job}`);
      if (thuCong.some((x) => x.het_tien)) void baoHetTien(db, thuCong, `video shot #${bc.canh.thu_tu} · job #${job}`).catch(() => {});
    }
  }
  if (laFal) {
    const id = bc.kt.mo_hinh_video.slice(4);
    // Khung giữa chỉ khi keyframe là ảnh render 3D (cùng nguồn với khung giữa — keyframe AI không khớp khung giữa render).
    const kx = bc.canh.khung_xam; const khungGiua = kx && bc.canh.keyframe_url === kx.mau ? (kx.giua?.length ? kx.giua : kx.mau_giua ? [kx.mau_giua] : []) : [];
    // clip diễn Blender: model 3D→video chỉ khi keyframe cùng nguồn render; model REFERENCE-to-video thì clip chỉ là khuôn chuyển động (keyframe AI vẫn dùng được)
    const videoNguon = kx && (bc.canh.keyframe_url === kx.mau || /reference-to-video|vace/.test(id)) ? kx.dien ?? null : null;
    kq = await guiFal(id, await dauVaoTheoSchema(id, { prompt, anhDau: bc.canh.keyframe_url, anhCuoi: khungCuoi, khungGiua, videoNguon, giay: bc.canh.thoi_luong_s || giay, giayPhat: bc.canh.phat_s, tiLe: bc.kt.ti_le, tieng, loai: loaiCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)) }));
  } else {
    const anhDau = await taiAnhBase64(bc.canh.keyframe_url);
    if (!anhDau) { await xongJob(db, job, { loi: 'không tải được keyframe' }); return loi('không tải được keyframe'); }
    const anhCuoi = khungCuoi ? await taiAnhBase64(khungCuoi) : null;
    kq = await batDauVeo({ model: bc.kt.mo_hinh_video, prompt, anhDau, anhCuoi, tiLe: bc.kt.ti_le, doPhanGiai: bc.kt.do_phan_giai, giay, loai: loaiCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)) });
    // DỰ PHÒNG CUỐI = cùng Veo qua fal (anh 15/10/2026 "fallback đi, phần video phải vậy mới thông"): Google trực tiếp chỉ ~10 lượt/ngày/model
    // ở Tier 1 → lượt 11 trở đi dính 429 cả ngày. Không áp khi anh chọn đích danh 'google:<model>' (đã chọn nguồn thì báo lỗi, không tự đổi).
    const falId = VEO_SANG_FAL[bc.kt.mo_hinh_video];
    if (!kq.ok && khoaVid.kieu !== 'google' && falId && khoaFal()) {
      const loiGoogle = kq.loi;
      const f = await guiFal(falId, await dauVaoTheoSchema(falId, { prompt, anhDau: bc.canh.keyframe_url, anhCuoi: khungCuoi, giay: bc.canh.thoi_luong_s || giay, tiLe: bc.kt.ti_le, tieng, loai: loaiCongCuVe(bc.kt.phong_cach, laTayNguoi(bc.nhanVat)) }));
      const thu: BuocNguon[] = [...thuCong, { cong: 'google', model: bc.kt.mo_hinh_video, ok: false, loi: loiGoogle }, { cong: 'fal', model: falId, ok: f.ok, ...(f.ok ? {} : { loi: f.loi }) }];
      await db.execute(sql`UPDATE xv_job SET provider = 'fal', model = ${`fal:${falId}`}, nguon = ${JSON.stringify({ cong: 'fal', model: falId, thu })}::jsonb WHERE id = ${job}`);
      kq = f.ok ? f : { ok: false, loi: `Google: ${loiGoogle} · fal: ${f.loi}` };
    }
  }
  if (!kq.ok) {
    await xongJob(db, job, { loi: kq.loi });
    await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = ${kq.loi}, updated_at = now() WHERE id = ${canhId}`);
    return loi(kq.loi);
  }
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${kq.taskId}, updated_at = now() WHERE id = ${job}`);
  await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: job };
}

/** Hỏi provider các job video đang chạy của tập: xong thì tải về R2, ghi tiền, gắn vào shot (nháp/bản cuối/khớp miệng). */
export async function kiemVideoTap(db: Db, tapId: number): Promise<{ conChay: number; vuaXong: number }> {
  const jobs = (await db.execute(sql`SELECT j.* FROM xv_job j JOIN xv_canh c ON c.id = j.canh_id WHERE c.tap_id = ${tapId} AND j.loai = 'video' AND j.trang_thai = 'chay' AND j.task_id IS NOT NULL`)) as unknown as Row[];
  let conChay = 0, vuaXong = 0;
  for (const r of jobs.map(mapJob)) {
    // Nhiều bên cùng hỏi (trang đang mở + script trên box): nhận job theo "thuê" 45s qua updated_at — ai cập nhật trước thì xử, bên kia bỏ
    // qua vòng này; không thì một clip bị tải/ghi hai lần (phiên bản trùng, tiền cộng đôi).
    const thue = (await db.execute(sql`UPDATE xv_job SET updated_at = now() WHERE id = ${r.id} AND trang_thai = 'chay' AND updated_at < now() - interval '45 seconds' RETURNING id`)) as unknown as Row[];
    if (!thue.length) { conChay++; continue; }
    const laCong = CONG_VIDEO.includes(r.provider ?? '');
    const kq = r.provider === 'fal' ? await docFal(r.task_id!) : laCong ? await docVideoCong(r.provider, r.task_id!, r.created_at) : await docVeo(r.task_id!);
    if (!kq.done) { conChay++; continue; }
    // THỬ nhiều shot / một clip (ref2v-chay.ts): job gắn vào shot đầu cảnh chỉ để vòng này hỏi tới — KHÔNG đụng clip / trạng thái shot nào.
    const thuRef = ((await db.execute(sql`SELECT request->>'ref2v' AS ref, request->>'cents' AS cents FROM xv_job WHERE id = ${r.id}`)) as unknown as Row[])[0];
    if (thuRef?.ref === 'true') {
      if (!kq.ok) { await xongJob(db, r.id, { loi: kq.loi }); continue; }
      const b = await fetch(kq.uri).then((x) => (x.ok ? x.arrayBuffer().then((a) => Buffer.from(a)) : null)).catch(() => null);
      const u = b ? await uploadToR2(`xuong-video/ref2v/${r.id}-${randomUUID()}.mp4`, b, 'video/mp4') : null;
      await xongJob(db, r.id, u ? { output_url: u, chi_phi_cents: Number(thuRef.cents) || 0 } : { loi: 'tải/lưu video thất bại' });
      if (u) { vuaXong++; await donVideoCong(r.provider, kq.uri); }
      continue;
    }
    if (!kq.ok) {
      await xongJob(db, r.id, { loi: kq.loi });
      // Task cổng treo / hỏng → sinh lại thẳng qua Google (không qua cổng nữa), shot không đứng chờ.
      if (laCong && r.canh_id != null) {
        const rqc = (((await db.execute(sql`SELECT request FROM xv_job WHERE id = ${r.id}`)) as unknown as Row[])[0]?.request ?? {}) as { ban?: 'nhap' | 'cuoi' };
        const lai = await batDauVideoCanh(db, r.canh_id, undefined, rqc.ban ?? 'nhap', false, false, true);
        if (lai.ok) { conChay++; continue; }
      }
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = ${kq.loi}, updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const buf = r.provider === 'fal' || laCong ? await fetch(kq.uri).then((x) => (x.ok ? x.arrayBuffer().then((a) => Buffer.from(a)) : null)).catch(() => null) : await taiVeo(kq.uri);
    const url = buf ? await uploadToR2(`xuong-video/clip/${r.canh_id}-${randomUUID()}.mp4`, buf, 'video/mp4') : null;
    if (url) await donVideoCong(r.provider, kq.uri);   // đã lưu về R2 → xoá bản trên nền tảng cổng (PlenX)
    if (!url) {
      await xongJob(db, r.id, { loi: 'tải/lưu video thất bại' });
      await db.execute(sql`UPDATE xv_canh SET trang_thai = 'loi', loi = 'tải/lưu video thất bại', updated_at = now() WHERE id = ${r.canh_id}`);
      continue;
    }
    const req = (await db.execute(sql`SELECT request, model FROM xv_job WHERE id = ${r.id}`)) as unknown as Row[];
    const rq = (req[0]?.request ?? {}) as { giay?: number; doPhanGiai?: '720p' | '1080p'; ban?: 'nhap' | 'cuoi'; nangCap?: boolean; khopMieng?: boolean; prompt?: string; khungDau?: string; khungCuoi?: string | null; tieng?: boolean };
    const cong = (r.nguon?.cents != null && laCong) ? r.nguon.cents : null;
    const gia = cong != null ? cong : rq.nangCap ? NANG_CAP.giaGiayCents * (rq.giay ?? 8) : rq.khopMieng ? KHOP_MIENG.giaGiayCents * (rq.giay ?? 8) : await giaVideoSv(s(req[0]?.model), rq.doPhanGiai ?? '720p', rq.giay ?? 8, rq.tieng !== false);
    await xongJob(db, r.id, { output_url: url, chi_phi_cents: gia });
    const pb = JSON.stringify([{ url, ban: rq.ban === 'cuoi' || rq.nangCap ? 'cuoi' : 'nhap', model: s(req[0]?.model), job: r.id, luc: new Date().toISOString() }]);
    await db.execute(sql`UPDATE xv_canh SET video_phien_ban = video_phien_ban || ${pb}::jsonb WHERE id = ${r.canh_id}`);
    if (rq.ban === 'cuoi' || rq.nangCap) {
      await db.execute(sql`UPDATE xv_canh SET video_cuoi_url = ${url}, trang_thai = 'xong', loi = '', chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${r.canh_id}`);
    } else if (rq.khopMieng) {
      // Khớp miệng: thay bản nháp đang dùng, GIỮ nguồn sinh (model/prompt/khung) của clip gốc để bản cuối vẫn tái lập được.
      await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, trang_thai = 'xong', loi = '', chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${r.canh_id}`);
    } else {
      // Nháp: lưu NGUỒN để bản cuối tái lập đúng (model, prompt, khung đầu/cuối).
      const nguon = { model: s(req[0]?.model), prompt: rq.prompt ?? '', khung_dau: rq.khungDau ?? null, khung_cuoi: rq.khungCuoi ?? null, giay: rq.giay ?? null, job: r.id };
      await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, nguon_video = ${JSON.stringify(nguon)}::jsonb, trang_thai = 'xong', loi = '', chi_phi_cents = chi_phi_cents + ${gia}, updated_at = now() WHERE id = ${r.canh_id}`);
    }
    // Máy soi clip (soi-clip.ts, 0đ): chữ lạ model tự in + sản phẩm còn trong khung — lỗi hiện trên thẻ shot, bản xuất không nhận clip lỗi.
    // ĐIỂM CẮT CUỐI (ảnh thứ 2 có dải nhịp): dò lúc dải nhịp hiện ra → cat_cuoi_s; bản xuất không phát quá điểm này.
    if (r.canh_id != null && (rq as { chuoiCuoi?: boolean }).chuoiCuoi) {
      const ket = ((await db.execute(sql`SELECT keyframe_ket FROM xv_canh WHERE id = ${r.canh_id}`)) as unknown as Row[])[0]?.keyframe_ket;
      const cat = rq.khungCuoi && ket ? await catCuoiClip(url, String(rq.khungCuoi), String(ket)).catch((e: unknown) => { console.error(`cắt cuối shot ${r.canh_id}:`, e); return null; }) : null;
      await db.execute(sql`UPDATE xv_canh SET cat_cuoi_s = ${cat} WHERE id = ${r.canh_id}`);
    } else if (r.canh_id != null) await db.execute(sql`UPDATE xv_canh SET cat_cuoi_s = NULL WHERE id = ${r.canh_id}`);
    if (r.canh_id != null) await soiClipCanh(db, r.canh_id).catch((e) => console.error(`soi clip shot ${r.canh_id}:`, e));
    // Máy tự chấm cảm xúc (cham-may.ts, 0đ, ~6s): clip QC có điểm ngay — chip Murch + cổng xuất đọc kết quả này, không chờ người soát.
    if (r.canh_id != null) await chamMayCanh(db, r.canh_id).catch((e) => console.error(`chấm máy shot ${r.canh_id}:`, e));
    vuaXong++;
  }
  return { conChay, vuaXong };
}
