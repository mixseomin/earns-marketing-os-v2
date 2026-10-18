// Ý ĐỒ KHÁN GIẢ (anh 18/10/2026: "timeline cần thêm yếu tố khán giả — kỳ vọng của đạo diễn về khán giả ở mỗi thời điểm: vui buồn, tò mò, bất ngờ,
// nhiều khi là đánh lừa theo hướng A nhưng thực tế là B, gieo sự phân vân, sợ hãi").
// Thư viện HIỆU ỨNG KHÁN GIẢ (mỗi loại có kiến thức ngành + nguồn) + ý đồ của một tập (xv_tap.khan_gia: đoạn shot → hiệu ứng muốn có) + máy SOÁT theo luật
// ngành: đánh lừa phải có cú lật (Bordwell), bất ngờ phải gieo trước (setup/payoff), hồi hộp cần khán giả biết trước điều nhân vật chưa biết (Hitchcock),
// nhẹ nhõm / hả hê phải đến sau căng thẳng (Zillmann). Khác làn ❤ cảm xúc (dương / âm theo shot): đây là LOẠI phản ứng đạo diễn nhắm, theo đoạn.
// Thuần, client lẫn server dùng được. Tự kiểm: khan-gia.test.mts.
import type { NganhKyThuat } from './dien-anh-nganh';
import { moTaNganh, TAN, SMITH, STERNBERG, BORDWELL_NARRATION, CARROLL_HORROR, LOEWENSTEIN, ZILLMANN, ARISTOTLE, TRUFFAUT, MCKEE } from './nguon-nganh';

export type MaKhanGia = 'vui' | 'buon' | 'to_mo' | 'hoi_hop' | 'bat_ngo' | 'danh_lua' | 'phan_van' | 'so_hai' | 'uc_che' | 'ha_he' | 'nhe_nhom';
export type HieuUngKhanGia = { key: MaKhanGia; ten: string; ic: string; mau: string; mo_ta: string; nganh: NganhKyThuat };

export const HIEU_UNG_KHAN_GIA: HieuUngKhanGia[] = [
  { key: 'vui', ten: 'Vui · buồn cười', ic: '😄', mau: '#facc15', mo_ta: 'Khán giả cười / thấy dễ chịu — câu đùa, tình huống trớ trêu, nhân vật dễ thương.',
    nganh: moTaNganh('Amusement / comic relief', 'Một nhịp lệch kỳ vọng nhẹ (incongruity) rồi bung ra — khán giả cười.', 'Gài kỳ vọng rồi bẻ nhỏ; giữ phản ứng của nhân vật khác; nhịp cắt gọn sau câu đùa.', 'Làm nhẹ giữa hai đoạn căng, cho khán giả yêu nhân vật.', 'Thả lỏng, gần gũi.', 'Đùa giữa lúc đang dồn căng làm xì hơi cao trào.', `${TAN}; Noël Carroll — Humour: A Very Short Introduction (2014), thuyết lệch kỳ vọng`) },
  { key: 'buon', ten: 'Buồn · thương', ic: '😢', mau: '#60a5fa', mo_ta: 'Khán giả thương nhân vật — mất mát, bị đối xử bất công, cô đơn.',
    nganh: moTaNganh('Sadness / sympathy (allegiance)', 'Khán giả đứng về phía nhân vật rồi thấy họ chịu mất mát.', 'Cho khán giả gắn với nhân vật trước (muốn gì, tốt ở đâu); giữ phản ứng, bớt nhạc, khoảng lặng.', 'Sau thất bại, mất mát, trước cú vùng lên.', 'Thương, muốn nhân vật được bù đắp.', 'Ép khóc bằng nhạc khi khán giả chưa kịp gắn với nhân vật.', `${SMITH}; ${TAN}`) },
  { key: 'to_mo', ten: 'Tò mò', ic: '❓', mau: '#a78bfa', mo_ta: 'Khán giả muốn biết điều đang bị giấu — ai, cái gì, vì sao.',
    nganh: moTaNganh('Curiosity (information gap)', 'Mở một câu hỏi rõ ràng mà phim chưa trả lời.', 'Cho thấy một mảnh (vật lạ, câu nói dở, phản ứng khó hiểu) và giấu phần còn lại; trả lời muộn nhưng phải trả.', 'Mở tập, mở cảnh, móc cuối tập.', 'Muốn xem tiếp để biết.', 'Câu hỏi mơ hồ tới mức khán giả không biết mình đang muốn biết gì; giấu mãi không trả.', `${STERNBERG}; ${LOEWENSTEIN}`) },
  { key: 'hoi_hop', ten: 'Hồi hộp', ic: '⏳', mau: '#fb923c', mo_ta: 'Khán giả biết điều nhân vật chưa biết và chờ nó xảy ra.',
    nganh: moTaNganh('Suspense', 'Khán giả được báo trước mối nguy / kết cục có thể; nhân vật chưa biết — căng chờ.', 'Cho khán giả thấy "quả bom dưới bàn" trước; kéo dài thời gian, xen cắt đồng hồ / mối nguy với nhân vật.', 'Trước cú lật, trước cuộc đối đầu.', 'Nín thở, muốn hét cảnh báo nhân vật.', 'Không báo trước gì cả (thành bất ngờ một giây, không phải hồi hộp); kéo quá dài thành nhàm.', `${TRUFFAUT}, thuyết quả bom dưới bàn; ${STERNBERG}`) },
  { key: 'bat_ngo', ten: 'Bất ngờ', ic: '⚡', mau: '#f472b6', mo_ta: 'Điều khán giả không chờ xảy ra — nhưng nghĩ lại thì đã được gieo.',
    nganh: moTaNganh('Surprise', 'Một thông tin / sự việc đến khi khán giả không chờ, đảo nghĩa những gì vừa xem.', 'Gieo chi tiết từ trước mà không nhấn; lúc lộ: cắt nhanh, giữ phản ứng; cho khán giả kịp "à" bằng cách nhắc lại chi tiết đã gieo.', 'Cú lật giữa tập, điểm xoay, cuối tập.', 'Giật mình rồi thoả mãn (nếu đã gieo) — hoặc thấy bị lừa (nếu chưa).', 'Bất ngờ không gieo (deus ex machina); bất ngờ quá dày làm khán giả hết tin.', `${TRUFFAUT}, phân biệt bất ngờ / hồi hộp; ${STERNBERG}; ${MCKEE} — setup/payoff`) },
  { key: 'danh_lua', ten: 'Đánh lừa (A → thật ra B)', ic: '🎭', mau: '#ef4444', mo_ta: 'Dắt khán giả tin hướng A, rồi lật ra sự thật là B.',
    nganh: moTaNganh('Misdirection / red herring (twist)', 'Khán giả được dẫn tới giả thuyết A (sai); đến cú lật mới lộ B — và mọi dấu hiệu B đã có sẵn từ đầu.', 'Cho bằng chứng nghiêng về A thật rõ; để dấu hiệu B nằm trong hình nhưng không nhấn; cú lật nhắc lại các dấu hiệu B.', 'Twist, phim bí ẩn, tổng tài giấu thân phận.', 'Choáng rồi muốn xem lại để tìm dấu hiệu.', 'Lật mà không có dấu hiệu B nào (gian lận); A yếu quá khán giả không tin.', `${BORDWELL_NARRATION}; ví dụ: Psycho (1960) nhân vật chính chết giữa phim, The Sixth Sense (1999)`) },
  { key: 'phan_van', ten: 'Gieo phân vân', ic: '🤔', mau: '#94a3b8', mo_ta: 'Khán giả không chắc nên tin ai / điều gì — giữ hai khả năng cùng lúc.',
    nganh: moTaNganh('Ambiguity / doubt (competing hypotheses)', 'Cho hai cách hiểu đều có lý; khán giả cân nhắc, chưa chọn được.', 'Đưa bằng chứng hai phía; nhân vật phản ứng nước đôi; giấu một mảnh quyết định.', 'Nhân vật có thể là đồng minh hoặc kẻ phản; trước khi lộ động cơ.', 'Bất an, chú ý từng chi tiết.', 'Mập mờ kéo dài không có lối ra; cả hai phía đều yếu.', `${BORDWELL_NARRATION}; ${STERNBERG}`) },
  { key: 'so_hai', ten: 'Sợ hãi', ic: '😨', mau: '#7c3aed', mo_ta: 'Khán giả thấy mối đe doạ thật với nhân vật hoặc với chính họ.',
    nganh: moTaNganh('Fear / dread', 'Mối đe doạ hiện diện (thấy hoặc đoán); khán giả sợ thay nhân vật.', 'Giấu mối nguy một phần (khung che, bóng tối, âm thanh ngoài khung); hồi hộp trước, doạ sau.', 'Kinh dị, đe doạ, nhân vật yếu thế đối mặt kẻ mạnh.', 'Căng người, muốn quay đi mà vẫn xem.', 'Doạ giật mình liên tục không có mối nguy thật; lộ hết mối nguy quá sớm.', `${CARROLL_HORROR}; ${TRUFFAUT}`) },
  { key: 'uc_che', ten: 'Ức chế · bất bình', ic: '😤', mau: '#dc2626', mo_ta: 'Khán giả bực thay nhân vật bị chèn ép — dồn nén chờ được trả.',
    nganh: moTaNganh('Injustice / anger (moral allegiance)', 'Nhân vật khán giả thương bị đối xử bất công; kẻ ác đắc thắng.', 'Cho thấy bất công thật rõ (hành động, không chỉ lời); giữ phản ứng nhẫn nhịn của nạn nhân; tăng dần mức chèn ép.', 'Nửa đầu phim tổng tài / trả thù trước cú vả mặt.', 'Bực, muốn thấy kẻ ác bị trả.', 'Dồn ức chế mà không bao giờ trả; ức chế vô lý khiến khán giả bỏ phim.', `${SMITH}, allegiance đạo đức; lệ "ức chế → vả mặt" của phim ngắn dọc (đoản kịch) là quy ước thể loại`) },
  { key: 'ha_he', ten: 'Hả hê · giải toả', ic: '🔥', mau: '#22c55e', mo_ta: 'Khán giả sướng khi kẻ ác bị trả / nhân vật được minh oan.',
    nganh: moTaNganh('Catharsis / vindication (payoff)', 'Áp lực dồn từ trước được xả: kẻ ác bị lật, nạn nhân đứng lên.', 'Trả đúng thứ đã dồn (cùng người, cùng chỗ); cho thấy phản ứng của kẻ thua; nhạc và nhịp lên.', 'Sau ức chế / hồi hộp — cao trào, vả mặt.', 'Sướng, thoả mãn.', 'Trả nhẹ hơn mức đã dồn; trả quá sớm làm hết lực kéo.', `${ARISTOTLE}; ${ZILLMANN}; ${TAN}`) },
  { key: 'nhe_nhom', ten: 'Nhẹ nhõm', ic: '😮‍💨', mau: '#2dd4bf', mo_ta: 'Căng thẳng được gỡ — nhân vật thoát nạn.',
    nganh: moTaNganh('Relief (tension release)', 'Sau một đoạn căng, mối nguy tan; khán giả thở ra.', 'Hạ nhạc, khung rộng ra, nhịp chậm lại; có khi kèm một câu đùa nhỏ.', 'Ngay sau hồi hộp / sợ hãi.', 'Thở phào — và kích thích còn lại làm cảm giác vui mạnh hơn.', 'Gỡ căng khi chưa từng dồn; gỡ quá lâu thành chết nhịp.', `${ZILLMANN}; ${TAN}`) },
];
export const hieuUngKG = (k: string | undefined) => HIEU_UNG_KHAN_GIA.find((x) => x.key === k);

/** Một ý đồ của đạo diễn: từ shot `tu` tới shot `den` (id xv_canh), khán giả cần cảm `y`. Đánh lừa: `a` = điều khán giả tin, `b` = sự thật, `lat` = shot lộ B. */
export type YDoKhanGia = { y: MaKhanGia; tu: number; den: number; ghi?: string; a?: string; b?: string; lat?: number };
export type KetYDo = { yd: YDoKhanGia; i: number; tu: number; den: number; loi: string[] };

type ShotKG = { id: number; thu_tu: number; ky_thuat?: { luat?: string[] } | null };
const CANG: MaKhanGia[] = ['hoi_hop', 'so_hai', 'uc_che'];
const GIEO: MaKhanGia[] = ['to_mo', 'phan_van', 'danh_lua'];

/** SOÁT ý đồ khán giả theo luật ngành. tu/den/lat trả về theo VỊ TRÍ shot trong tập (0-based) để vẽ. Shot không còn trong tập → lỗi, không vẽ. */
export function soatKhanGia(ds: YDoKhanGia[] | null | undefined, shots: ShotKG[]): KetYDo[] {
  const vt = new Map(shots.map((s, i) => [s.id, i] as const));
  const coLuat = (tu: number, den: number, l: string) => shots.slice(tu, den + 1).some((s) => (s.ky_thuat?.luat ?? []).includes(l));
  const ket = (ds ?? []).map((yd, i): KetYDo => {
    const a = vt.get(yd.tu), b = vt.get(yd.den);
    if (a == null || b == null) return { yd, i, tu: -1, den: -1, loi: ['đoạn trỏ vào shot không còn trong tập — chọn lại shot'] };
    return { yd, i, tu: Math.min(a, b), den: Math.max(a, b), loi: [] };
  });
  for (const k of ket) {
    if (k.tu < 0) continue;
    const y = k.yd.y; const truoc = ket.filter((x) => x !== k && x.tu >= 0 && x.tu < k.tu);
    if (!hieuUngKG(y)) k.loi.push(`hiệu ứng "${y}" không có trong thư viện`);
    if (y === 'danh_lua') {
      if (!k.yd.a?.trim() || !k.yd.b?.trim()) k.loi.push('đánh lừa phải ghi rõ A (khán giả tin gì) và B (sự thật là gì)');
      const l = k.yd.lat != null ? vt.get(k.yd.lat) : undefined;
      if (l == null) k.loi.push('đánh lừa chưa có cú LẬT (shot lộ B) — lừa mà không lật là bỏ dở (misdirection phải có payoff)');
      else if (l < k.den) k.loi.push('cú lật đứng TRƯỚC đoạn đánh lừa kết thúc — lật phải sau khi khán giả đã tin A');
    }
    if (y === 'bat_ngo' && !truoc.some((x) => GIEO.includes(x.yd.y)) && !coLuat(0, k.tu, 'tu_ke_du') && !coLuat(0, k.tu, 'motif'))
      k.loi.push('bất ngờ chưa có gì gieo trước (đoạn tò mò / phân vân / đánh lừa, hoặc shot gắn luật gài–trả / motif) — dễ thành bất ngờ gian lận');
    if (y === 'hoi_hop' && !coLuat(0, k.den, 'chenh_thong_tin'))
      k.loi.push('hồi hộp cần khán giả biết trước điều nhân vật chưa biết — gắn luật "chênh lệch thông tin" cho shot báo trước (Hitchcock: quả bom dưới bàn)');
    if ((y === 'nhe_nhom' || y === 'ha_he') && !truoc.some((x) => CANG.includes(x.yd.y)))
      k.loi.push(`${y === 'ha_he' ? 'hả hê' : 'nhẹ nhõm'} phải đến SAU một đoạn dồn căng (hồi hộp / sợ hãi / ức chế) — không có gì để xả`);
  }
  return ket;
}

/** Xếp đoạn chồng nhau vào nhiều hàng (đoạn sau chồng đoạn trước → hàng mới) — làn nào cũng một dòng. */
export function xepHangYDo(ket: KetYDo[]): KetYDo[][] {
  const hang: KetYDo[][] = [];
  for (const k of ket.filter((x) => x.tu >= 0).sort((a, b) => a.tu - b.tu)) {
    const h = hang.find((r) => r.every((x) => x.den < k.tu || x.tu > k.den)); if (h) h.push(k); else hang.push([k]);
  }
  return hang;
}

/** Làm sạch trước khi lưu: bỏ hiệu ứng lạ, ép số, cắt chữ. */
export function lamSachKhanGia(ds: unknown): YDoKhanGia[] {
  if (!Array.isArray(ds)) return [];
  return ds.flatMap((x): YDoKhanGia[] => {
    const o = x as Record<string, unknown>; const y = String(o.y ?? '') as MaKhanGia; const tu = Number(o.tu), den = Number(o.den);
    if (!hieuUngKG(y) || !(tu > 0) || !(den > 0)) return [];
    const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : undefined);
    const lat = Number(o.lat);
    return [{ y, tu, den, ...(s(o.ghi) ? { ghi: s(o.ghi) } : {}), ...(s(o.a) ? { a: s(o.a) } : {}), ...(s(o.b) ? { b: s(o.b) } : {}), ...(lat > 0 ? { lat } : {}) }];
  });
}
