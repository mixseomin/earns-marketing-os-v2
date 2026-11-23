// LUẬT CHẤM TRƯỚC KHI GỬI MODEL VIDEO (anh 14/11/2026: "sửa xong phải luôn cho các phát sinh này vào luật chấm trước khi gửi cho AI"). Mỗi luật là một lỗi đã
// gặp thật ở phim #3071 — có lỗi thì KHÔNG gửi (không tốn tiền), báo đúng câu. Thuần, tự kiểm: chan-gui-video.test.mts.
//   - mã nội bộ lọt prompt ("looks … at dau_ga") — model không hiểu, có khi vẽ chữ
//   - tên nhân vật / chữ tiếng Việt ngoài lời thoại ("Reference image 1 is Chú", câu diễn tiếng Việt) — model không biết tên, in tên lên hình
//   - tả khung ngược tỉ lệ phim ("vertical film" cho phim 16:9 — promptCumMoi ghi cứng trước đây)
//   - clip 3D tham chiếu không phải bản xuất SẠCH (còn tia nhìn / dây đường đi vàng — Seedance chép nguyên vào phim, cụm #2–7)
import { coTiengViet, type Canh } from './kieu';
import { DIEN_RONG } from './prompt-khoi';
import { BAC_CO } from './khong-gian';   // MỘT thang bậc cỡ cảnh (ews 0 … ecu 5)
import { diChuThe, DI_NGANG_CM } from './nhip-hinh';
import { chuThe } from './bo-set-3d';

/** Bỏ lời thoại ("<ai> says: <câu>") — lời thoại tiếng Việt là ĐÚNG (miệng nhép theo), không tính vào luật chữ. Câu thoại kết ở dấu chấm trước một câu tiếng Anh mới. */
export const boLoiThoai = (p: string): string => p.replace(/says:\s[\s\S]*?(?=[.!?…]\s+(?:Shot \d|Keep|No |Reference|Every|The |A |An |Camera|Throughout|Static|Nobody|Real|WHITELIST|Emotional|EXPRESSION)|[.!?…]?$)/g, 'says: …');

export function loiPromptGui(prompt: string, o: { tiLe?: string | null; tenNhanVat?: string[] }): string[] {
  const loi: string[] = []; const p = boLoiThoai(prompt);
  const ma = [...new Set(p.match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? [])];
  if (ma.length) loi.push(`prompt lộ mã nội bộ: ${ma.slice(0, 5).join(', ')} — đổi sang tên tiếng Anh nhìn thấy được (sổ ten_moc của bộ set)`);
  const ten = (o.tenNhanVat ?? []).filter((t) => t.trim() && new RegExp(`(^|[^\\p{L}])${t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^\\p{L}]|$)`, 'u').test(p));
  if (ten.length) loi.push(`prompt gọi tên nhân vật ngoài lời thoại: ${ten.join(', ')} — model không biết tên (đảo vai / in tên lên hình): gọi bằng dáng nhìn thấy`);
  if (coTiengViet(p)) { const m = p.match(/[^.;:]*[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ][^.;:]*/i)?.[0]?.trim(); loi.push(`prompt còn chữ tiếng Việt ngoài lời thoại${m ? `: "${m.slice(0, 80)}"` : ''} — chỉ lời thoại được tiếng Việt`); }
  if (o.tiLe === '16:9' && /\bvertical\b/i.test(p)) loi.push('prompt tả "vertical" trong khi phim 16:9');
  if (o.tiLe === '9:16' && /\bwidescreen\b/i.test(p)) loi.push('prompt tả "widescreen" trong khi phim 9:16');
  return loi;
}

/** Clip 3D tham chiếu phải là bản xuất SẠCH (xuat-clip.cjs › dungSach, cờ clip.sach) — clip cũ còn tia vàng thì xuất lại (clip-three-tap.sh). */
/** THOẠI TRONG CÂU LỆNH (15/11/2026 phim #3071 #6: câu lệnh gửi đi có câu thoại HAI lần, một lần bị đổi chữ → model nói hai lần, không theo file giọng).
 *  Mỗi câu thoại của cụm phải có NGUYÊN VĂN trong câu lệnh đúng số lần nó được nói (thường một): 0 lần = bị đổi chữ / rơi mất, nhiều hơn = model nói lặp. Thuần. */
export function loiThoaiPrompt(prompt: string, cau: readonly string[]): string[] {
  const gon = (c: string) => c.trim().replace(/["“”]/g, '').replace(/[.\s]+$/, '');
  const can = new Map<string, number>(); for (const c of cau.map(gon).filter(Boolean)) can.set(c, (can.get(c) ?? 0) + 1);
  // số lần "says:" phải bằng số câu thoại: bắt bản sao bị ĐỔI CHỮ đứng cạnh bản đúng (câu lệnh thật job 8322: nguyên văn có đúng 1 lần nên phép đếm nguyên văn
  // không thấy, nhưng "says:" có 2 lần cho 1 câu) và câu có chữ mà chưa có file giọng lọt vào cụm đang gửi giọng
  const says = (prompt.match(/\bsays:/g) ?? []).length; const tong = [...can.values()].reduce((a, b) => a + b, 0);
  const lech = tong && says !== tong ? [`câu lệnh có ${says} lần "says:" cho ${tong} câu thoại có giọng — có câu ghi lặp / bị đổi chữ, hoặc câu thoại chưa có file giọng`] : [];
  return [...lech, ...[...can].flatMap(([c, n]) => { const co = prompt.split(c).length - 1;
    return co === n ? [] : [co < n ? `câu thoại «${c}» ${co ? `chỉ có ${co}/${n} lần` : 'không có nguyên văn'} trong câu lệnh (bị đổi chữ / rơi mất) — model sẽ nói khác file giọng` : `câu thoại «${c}» lặp ${co} lần trong câu lệnh (cần ${n}) — model nói lặp`]; })];
}

export function loiClipThamChieu(ds: { so: number; clip?: { sach?: boolean } | null }[]): string[] {
  const cu = ds.filter((x) => x.clip && x.clip.sach !== true).map((x) => `#${x.so}`);
  return cu.length ? [`clip 3D tham chiếu ${cu.join(' ')} chưa phải bản xuất sạch (còn tia nhìn / dây đường đi) — chạy lại clip-three-tap.sh`] : [];
}

/** TỪNG SHOT TRONG CÂU LỆNH CỤM (15/11/2026, soát cụm C / E phim #3071 trước khi sinh):
 *  - shot ghi "nobody speaks" mà động tác lại là NÓI ("man frowns and fires questions" — câu hỏi thật nằm ở shot sau) → model sinh tiếng / nhép miệng bịa;
 *    «questions» chỉ là NÓI khi đứng sau động từ hỏi ("fires questions") hoặc làm động từ ("questions him"); "the two written questions" trong sổ là chữ, không phải lời (23/11/2026 phim #7999 cảnh 10 bị chặn nhầm);
 *  - câu diễn rỗng mặc định (prompt-khoi.ts › DIEN_RONG) còn lọt → shot không có động tác nào, model tự bịa. Thuần. */
export function loiShotPrompt(prompt: string): string[] {
  const NOI = /\b(?:says?|said|asks?|asking|(?:fires?|firing|throws?|poses?) (?:off )?(?:a |more |the )?questions?|questions (?:him|her|them|me|you|the \w+)|questioning|shouts?|yells?|calls? (?:out|to)|talk(?:s|ing)?|tells?|repl(?:y|ies)|answers?|whispers?|mutters?|scolds?|argues?|chats?)\b/i;
  return [...prompt.matchAll(/Shot (\d+) \(about [^)]*\):([\s\S]*?)(?=Shot \d+ \(about|Keep it subtitle-free|$)/g)].flatMap(([, so, t]) => {
    const loi: string[] = []; const cau = t!.replace(/says:[\s\S]*$/, '');
    if (/nobody speaks/i.test(cau)) { const m = cau.replace(/nobody speaks[\s\S]*$/i, '').match(NOI); if (m) loi.push(`shot ${so} ghi "nobody speaks" mà động tác có «${m[0]}» — model sẽ sinh tiếng nói / nhép miệng bịa: viết lại câu diễn thành động tác câm`); }
    for (const r of DIEN_RONG) if (cau.toLowerCase().includes(r)) loi.push(`shot ${so} còn câu diễn rỗng «${r}» — không có động tác: viết câu diễn / mở → kết`);
    return loi;
  });
}

/** ẢNH KHUNG TỪNG SHOT (15/11/2026 cụm C phim #3071: 5 ảnh người + bối cảnh + 4 khung = trần 9 → shot 5, shot CÓ THOẠI, không có ảnh khung): mỗi shot của cụm phải
 *  có keyframe của nó trong ảnh tham chiếu — thiếu thì bớt ảnh người phụ (thamChieuCum toiDa), không bớt khung shot. */
export const loiAnhCum = (soShot: number, soKhung: number): string[] => (soKhung < soShot ? [`chỉ ${soKhung}/${soShot} shot có ảnh khung trong tham chiếu (trần 9 ảnh) — bớt ảnh người phụ`] : []);

/** SHOT THOẠI ĐỨNG CUỐI CỤM (15/11/2026, soát cụm E phim #3071 trước khi sinh: câu "Cháu đi nhé!" ở shot 2/4): Seedance nói trễ 0,4–0,8 s và chậm ×1,2 (đo #4, #6) —
 *  chỉ shot cuối có đuôi để khớp thoại (can-giong.ts) dời điểm vào; shot thoại ở giữa thì lấn đoạn shot kế, chắc chắn hỏng. soCoThoai = số thứ tự (1…n) shot có câu gửi giọng. */
export const loiThoaiCuoiCum = (soCoThoai: readonly number[], soShot: number): string[] => {
  const giua = [...new Set(soCoThoai)].filter((s) => s < soShot);
  return giua.length ? [`shot ${giua.join(', ')} có thoại mà không đứng cuối cụm (${soShot} shot) — không có đuôi bù giờ nói: tách cụm sau shot thoại (cum-seedance.mts)`] : [];
};

/** SÀN VIDEO THAM CHIẾU (16/11/2026, phim #3071 #2 job 8364: cụm một shot 1,2 s → Kie / Seedance r2v từ chối "video duration must be ≥ 1.8"): clip 3D gửi đi
 *  phải ≥ 1,8 s. Cụm ngắn hơn: cum-seedance-tap.sh lấy dài shot cuối từ phần dư của clip 3D (giữ dáng cuối), câu lệnh vẫn ghi giây phát thật. */
export const SAN_VIDEO_THAM_CHIEU = 1.8;
export const loiVideoThamChieu = (giay: number): string[] => (giay < SAN_VIDEO_THAM_CHIEU ? [`clip 3D tham chiếu ${giay.toFixed(2)} s < ${SAN_VIDEO_THAM_CHIEU} s (sàn Seedance r2v) — lấy dài shot cuối (cum-seedance-tap.sh)`] : []);

/** CỠ CẢNH + MÁY CÓ MỘT NGUỒN: ky_thuat (16/11/2026, phim #3071 #14: ky_thuat ws + lia, mà dan_dung mở "two-shot", kết "close on boy", mục đích "máy đẩy liền" —
 *  câu lệnh gửi "Wide shot, smooth horizontal pan … then close on boy": lia không đổi được cỡ cảnh nên model làm NGƯỢC, mở cận nhóc rồi lia ra toàn. #3 cùng lớp:
 *  máy đã đổi sang tinh mà câu hướng còn "camera moves toward him" → cú zoom vào anh chê ở #2 #3). Chữ mở / diễn / kết / hướng là ĐỘNG TÁC; cỡ cảnh và chuyển động máy
 *  chỉ khai ở ky_thuat. Chữ nhắc cỡ / máy thì phải KHỚP ky_thuat, lệch → chặn trước khi gửi (và cum-seedance.mts báo trước khi tiêu tiền):
 *    (1) cỡ cảnh tả ở mở (hoặc bố cục) cách co_canh ≥ 2 bậc;
 *    (2) cỡ ở kết khác cỡ ở mở ≥ 2 bậc mà máy không đổi cỡ (gần hơn cần day_vao / zoom_cham / dolly_zoom / zoom_gat; xa hơn cần lui_ra / cau) — trừ khi chủ thể TỰ đi
 *        lại gần / ra xa máy ≥ 150 cm (dàn cảnh theo chiều sâu: người bước vào cận, máy đứng);
 *    (3) chữ nói máy chuyển động (push in, camera moves toward, pull back, pan, follows / tracking, tilt / crane, orbit, handheld, static…) trái với chuyen_dong;
 *    (4) chữ có cú cắt (cut to) trong một shot; (5) chữ nói hướng đi (away from / toward camera) ngược hướng đi của chủ thể trong 3D. Thuần.
 *  Chạy ở cổng TIỀN KỲ (quy-trinh.ts › chanTienKy — trước keyframe) và cổng gửi video. */
const CO_TU: [RegExp, number][] = [
  [/\bextreme close[- ]?up\b|\bdetail shot\b/i, 5], [/\bmedium close[- ]?up\b|\bchest[- ]up\b/i, 3],
  // "close up to his face" (đưa sát mặt) là ĐỘNG TÁC, không phải cỡ cảnh: chỉ nhận close-up / closeup / close up of|on / close on
  [/\bclose-?up\b|\bclose up (?:of|on)\b|\bclose on\b|\bclose shot\b|\bface fill(?:s|ing) (?:the )?frame\b/i, 4],
  [/\bextreme wide\b|\bestablishing shot\b/i, 0], [/\bmedium shot\b|\btwo[- ]shot\b|\bwaist[- ]up\b/i, 2],   // "over-the-shoulder" là góc đặt máy, không phải cỡ (quét 16/11/2026: phim 16 #32 cận qua vai bị bắt oan)
  [/\bwide (?:shot|view|frame)\b|\bfull shot\b|\blong shot\b/i, 1],
];
/** bậc cỡ cảnh của câu: cụm từ cỡ xuất hiện SỚM nhất trong câu (câu tả khung mở đầu bằng cỡ cảnh) */
export const bacCoChu = (t?: string | null): number | null => {
  let tot: { i: number; b: number } | null = null;
  for (const [r, b] of CO_TU) { const m = r.exec(t ?? ''); if (m && (!tot || m.index < tot.i)) tot = { i: m.index, b }; }
  return tot?.b ?? null;
};
const MAY_VAO = ['day_vao', 'zoom_cham', 'dolly_zoom', 'zoom_gat', 'fpv', 'xuyen_vat', 'cau_xuong'], MAY_RA = ['lui_ra', 'cau', 'hyperlapse'];
/** máy tự đổi cỡ trong shot: co_canh có thể tả đầu HOẶC cuối shot (drone lùi: mở "close on the house", khai ews — phim 963 #35) → không so cỡ mở với co_canh */
const doiCo = (cd: string) => MAY_VAO.includes(cd) || MAY_RA.includes(cd) || cd.startsWith('drone');
const MAY_TU: { r: RegExp; can: string[]; vi: string }[] = [
  { r: /\bpush(?:es|ing)?[- ]in\b|\bcamera (?:moves|pushes|creeps|drifts|glides|dollies) (?:in|closer|toward)|\bdoll(?:y|ies|ying) in\b|\bzoom(?:s|ing)? in\b/i, can: MAY_VAO, vi: 'máy tiến vào' },
  { r: /\bpull(?:s|ing)?[- ](?:out|back)\b|\bcamera (?:moves|pulls|drifts|dollies) (?:back|away|out)\b|\bzoom(?:s|ing)? out\b/i, can: MAY_RA, vi: 'máy lùi ra' },
  { r: /\bcamera pans\b|\bpan(?:s|ning)? (?:left|right|across|with|to)\b/i, can: ['lia', 'quat', 'chuyen_chu_the'], vi: 'máy lia' },
  { r: /\bcamera (?:follows|tracks|trails)\b|\btracking shot\b|\bsteadicam\b/i, can: ['theo', 'dan_truoc', 'truot_ngang', 'lia', 'vong', 'cung'], vi: 'máy bám theo' },
  { r: /\bcamera (?:tilts|cranes|rises|lowers|booms)\b|\b(?:tilt|crane|boom)s? (?:up|down)\b/i, can: ['nghieng_len', 'cau', 'cau_xuong'], vi: 'máy nghiêng / cẩu' },
  { r: /\bcamera (?:orbits|circles|arcs)\b|\borbit(?:s|ing)? around\b/i, can: ['vong', 'cung'], vi: 'máy vòng' },
  { r: /\bhandheld\b|\bshaky cam/i, can: ['cam_tay'], vi: 'máy cầm tay' },
  { r: /\bcamera (?:does not|doesn't|never) move|\bstatic camera\b|\blocked[- ]off\b/i, can: ['tinh'], vi: 'máy đứng' },
];
const DI = '(?:walk|run|step|stroll|come|head|bolt|rush|sprint|dash|jog|march|crawl|roll|ride|drive|race|hurr(?:y|ie)|wander|stride|trot)\\w*';
const DI_XA = new RegExp(`\\b${DI}\\b[^.;,]{0,40}?\\baway from (?:the )?camera\\b|\\b${DI}\\b[^.;,]{0,30}?\\binto the distance\\b`, 'i');
const DI_GAN = new RegExp(`\\b${DI}\\b[^.;,]{0,40}?\\b(?:toward|towards|up to) (?:the )?camera\\b`, 'i');
export type ShotCoMay = { so: number; co_canh?: string | null; chuyen_dong?: string | null; mo?: string | null; dien?: string | null; ket?: string | null; huong?: string | null; bo_cuc?: string | null; /** chủ thể đi dọc trục máy (cm): âm = lại gần máy, dương = ra xa (nhip-hinh.ts › diChuThe) — người TỰ đi vào cận / đi xa thì cỡ đổi không cần máy */ di_sau_cm?: number | null };
export function loiCoMay(ds: readonly ShotCoMay[]): string[] {
  return ds.flatMap((s) => {
    const loi: string[] = []; const cd = s.chuyen_dong || 'tinh'; const co = BAC_CO[s.co_canh ?? ''] ?? null;
    // bố cục 3 lớp chỉ tính khi MỞ ĐẦU bằng cỡ cảnh ("close-up: the man's face…") — cỡ nhắc giữa câu bố cục là tả một lớp, không phải cỡ khung
    const dau = bacCoChu(s.mo) ?? (/^\W*(?:extreme |medium )?(?:close|wide|full|long|two)/i.test(s.bo_cuc ?? '') ? bacCoChu(s.bo_cuc) : null), cuoi = bacCoChu(s.ket);
    if (dau != null && co != null && Math.abs(dau - co) >= 2 && !doiCo(cd)) loi.push(`#${s.so}: mở / bố cục tả cỡ bậc ${dau} mà cỡ cảnh khai ${s.co_canh} (bậc ${co}) — sửa chữ mở hoặc co_canh cho khớp`);
    const goc = dau ?? co;
    if (cuoi != null && goc != null) {
      const laiGan = (s.di_sau_cm ?? 0) <= -DI_NGANG_CM, raXa = (s.di_sau_cm ?? 0) >= DI_NGANG_CM;   // dàn cảnh theo chiều sâu: người đi vào cận / đi xa dần, máy đứng vẫn đổi cỡ
      if (cuoi - goc >= 2 && !doiCo(cd) && !laiGan) loi.push(`#${s.so}: kết gần hơn mở ${cuoi - goc} bậc ("${(s.ket ?? '').slice(0, 40)}") mà máy ${cd} không đổi cỡ và chủ thể không đi lại gần máy — model tự xoay xở (#14 làm ngược): máy day_vao hoặc bỏ cỡ ở kết`);
      if (goc - cuoi >= 2 && !doiCo(cd) && !raXa) loi.push(`#${s.so}: kết xa hơn mở ${goc - cuoi} bậc mà máy ${cd} không đổi cỡ và chủ thể không đi ra xa máy — máy lui_ra hoặc bỏ cỡ ở kết`);
    }
    // ("cut to black" là chuyển cảnh KẾT shot, không phải cú cắt trong shot — phim 119 #28)
    // MỘT SHOT KHÔNG CÓ CÚ CẮT: chữ "cut to / cuts to" trong thẻ shot là hai shot nhồi một — model cắt giữa clip, đoạn đo theo cú cắt lệch hết (cum-shot.ts › vaoTuCatThat)
    for (const [ten, t] of [['mở', s.mo], ['diễn', s.dien], ['kết', s.ket]] as const) { const k = /\b(?:hard |smash |jump )?cuts? (?:to(?! black)|back|away)\b|\bthen cut\b(?! to black)/i.exec(t ?? ''); if (k) loi.push(`#${s.so}: chữ ${ten} có cú cắt «${k[0]}» — một shot là một khung liền: tách thành hai shot`); }
    // HƯỚNG ĐI chữ ↔ 3D (#18 phim #3071: kịch bản "runs away from camera", máy 3D đặt cuối sân ga nên trong 3D nhóc chạy VỀ PHÍA máy 1.280 cm — clip tham chiếu
    // và câu lệnh nói ngược nhau). Chỉ câu có ĐỘNG TỪ đi ("looks toward camera" là nhìn, không tính); chủ thể đi ngược ≥ 150 cm mới chặn.
    if (s.di_sau_cm != null) for (const [ten, t] of [['mở', s.mo], ['diễn', s.dien], ['kết', s.ket], ['hướng', s.huong]] as const) {
      const xa = DI_XA.exec(t ?? ''), gan = DI_GAN.exec(t ?? '');
      if (xa && s.di_sau_cm <= -DI_NGANG_CM) loi.push(`#${s.so}: chữ ${ten} «${xa[0]}» mà trong 3D chủ thể đi VỀ PHÍA máy ${Math.round(-s.di_sau_cm)} cm — đặt lại máy 3D (hoặc sửa chữ) cho cùng một hướng`);
      if (gan && s.di_sau_cm >= DI_NGANG_CM) loi.push(`#${s.so}: chữ ${ten} «${gan[0]}» mà trong 3D chủ thể đi RA XA máy ${Math.round(s.di_sau_cm)} cm — đặt lại máy 3D (hoặc sửa chữ) cho cùng một hướng`);
    }
    // chưa khai chuyen_dong = máy lấy từ CHỮ (cum-shot.ts › promptCumMoi: kyThuat(undefined) → câu máy trong chữ) — chữ là nguồn, không có gì để trái (quét 16/11/2026: phim 322 / 353)
    if (s.chuyen_dong) for (const [ten, t] of [['mở', s.mo], ['diễn', s.dien], ['kết', s.ket], ['hướng', s.huong]] as const)
      for (const m of MAY_TU) { const k = m.r.exec(t ?? ''); if (k && !m.can.includes(cd)) loi.push(`#${s.so}: chữ ${ten} «${k[0]}» (${m.vi}) trái máy khai ${cd} — câu lệnh nói hai máy, model chọn bừa: bỏ chữ máy khỏi ${ten}`); }
    return loi;
  });
}
/** shot (xv_canh) → dữ liệu cho loiCoMay — một chỗ đọc, mọi đường gửi / kế hoạch dùng chung */
export const shotCoMay = (c: Canh): ShotCoMay => ({ so: c.thu_tu, co_canh: c.ky_thuat?.co_canh, chuyen_dong: c.ky_thuat?.chuyen_dong,
  mo: c.dan_dung?.mo, dien: c.dan_dung?.dien, ket: c.dan_dung?.ket, huong: c.dan_dung?.huong, bo_cuc: c.dan_dung?.bo_cuc,
  di_sau_cm: c.may_3d ? diChuThe(c.may_3d, c.may_3d.nham ? [c.may_3d.nham] : chuThe(c.may_3d))?.sau ?? null : null });

/** HÀNH ĐỘNG CHỈ DIỄN MỘT LẦN (anh 16/11/2026, phim #3071: "15 đã đưa tiền lên rồi thì 16 không đưa tiếp nữa — bộ chấm đâu?"). Nghề: liên tục hành động của script
 *  supervisor — động tác đã làm ở shot trước thì shot sau MỞ từ trạng thái đó (vẫn chìa / đã đưa), không làm lại từ đầu; cắt giữa động tác (match on action) là
 *  ĐI TIẾP động tác, không lặp. Luật: trong cùng phân cảnh, một món đã được ĐƯA / CHÌA ở shot trước mà chưa có ai NHẬN, shot sau lại đưa / chìa chính món đó (và
 *  cũng không ai nhận) → lặp. Ca thật: #14 kết "boy holding out change", #16 kết "he raises the crumpled change toward the window" (model còn tự cho #15 đưa tiền).
 *  Đọc chữ mở / diễn / kết tiếng Anh. Thuần, tự kiểm: chan-gui-video.test.mts. */
const DUA = /\b(?:hold(?:s|ing)? out|hold(?:s|ing)? up|rais(?:e|es|ing)|offer(?:s|ing)?|hand(?:s|ing)? (?:over|up)|lift(?:s|ing)? up|push(?:es|ing)? up|stretch(?:es|ing)? out)\b(?:\s+(?:a|an|the|his|her|their|its|some|this|that|crumpled|folded|small|little|wet|cold|empty|half[- ]empty|[0-9.,]+(?:-dong)?))*\s+([a-z]+)/gi;
const NHAN = /\b(?:take[sn]?|taking|took|grab(?:s|bed|bing)?|snatch(?:es|ed|ing)?|receiv(?:e|es|ed|ing)|accept(?:s|ed|ing)?|catch(?:es|ing)?|caught)\b/i;
export type ShotHanhDong = { so: number; phan_doan?: string | null; mo?: string | null; dien?: string | null; ket?: string | null };
export function loiLapHanhDong(ds: readonly ShotHanhDong[]): string[] {
  const loi: string[] = []; let canh: string | null | undefined; const dang = new Map<string, number>();   // món đang được chìa (chưa ai nhận) → shot
  for (const s of ds) {
    if (s.phan_doan !== canh) { dang.clear(); canh = s.phan_doan; }
    const chu = [s.mo, s.dien, s.ket].filter(Boolean).join('; '); const nhan = NHAN.test(chu);
    const mon = [...new Set([...chu.matchAll(DUA)].map((m) => m[1]!.toLowerCase()).filter((x) => !['toward', 'towards', 'to', 'and', 'his', 'her', 'head', 'eyes', 'hand', 'hands', 'arm', 'arms', 'finger', 'voice', 'face', 'chin'].includes(x)))];
    for (const m of mon) { const i = dang.get(m); if (i != null && !nhan) loi.push(`#${s.so}: lại đưa / chìa «${m}» đã chìa ở #${i} mà chưa ai nhận — một hành động chỉ diễn MỘT lần: shot này mở từ trạng thái của #${i} (vẫn đang chìa, hoặc ghi ai NHẬN), không làm lại`); }
    if (nhan) dang.clear(); else for (const m of mon) if (!dang.has(m)) dang.set(m, s.so);
  }
  return loi;
}
export const shotHanhDong = (c: Canh): ShotHanhDong => ({ so: c.thu_tu, phan_doan: c.phan_doan, mo: c.dan_dung?.mo, dien: c.dan_dung?.dien, ket: c.dan_dung?.ket });
