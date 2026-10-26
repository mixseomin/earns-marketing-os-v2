// PHIẾU SHOT — câu prompt ảnh / video ghép từ DỮ LIỆU shot (anh 26/10/2026: "diễn tả chi tiết hơn để AI sinh đúng — nhất là khuôn mặt, hướng nhìn";
// "gắn vào studio để còn dùng lại"). Một nguồn cho: đường phân cảnh (scripts/bang-gom.mts), ảnh từ sơ đồ (scripts/anh-tu-so-do.mts). Thuần.
//   - cỡ khung theo mã co_canh của studio + CHỖ CẮT + "không mở rộng" (AI hay nới khung ra toàn thân theo ảnh mẫu — đo 26/10/2026 sơ đồ #11 / #12)
//   - điểm neo mắt NEO_MAT cho shot thấy mặt (eye trace bằng quy ước khung — luat-dung › eye_trace)
//   - CHỈ người có trong khung, trái / phải màn, góc quay đầu, nhìn ai ở phía nào (không nhìn ống kính)
//   - nét mặt đầu → cuối + nét cấm (qc-cam-xuc › BIEU_CAM), trạng thái đồ từ SỔ ĐỒ VẬT (so-vat › cauVat — gồm câu "không còn trên người")
// Tự kiểm: phieu-shot.test.mts.
import { bieuCam, camThuc, type MaBieuCam } from './qc-cam-xuc';
import { cauVat, trangThai, type SoVat } from './so-vat';
import { NEO_MAT } from './diem-nhin';

/** Cỡ khung (mã co_canh studio — dien-anh.ts THU_VIEN) → câu tiếng Anh có chỗ cắt. Mã lạ → không ghi câu khung. */
export const KHUNG_EN: Record<string, string> = {
  ews: 'extreme wide shot, people tiny in the location', ws: 'wide shot, full bodies, lots of floor and ceiling',
  toan_than: 'full-body shot, head to feet', trung_toan: 'medium-wide shot cropped at the knees',
  ms: 'medium shot cropped at the waist — legs and feet NOT visible, never widen to a full-body shot',
  two: 'medium two-shot cropped at the waist — legs and feet NOT visible, never widen to a full-body shot',
  mcu: 'medium close-up cropped at mid-chest — never widen the framing',
  cu: 'TIGHT close-up: head and neck, cropped just below the collarbones — never widen the framing',
  ecu: 'extreme close-up on part of the face — never widen the framing',
  insert: 'extreme close-up insert of an object, no faces at all',
  ots: 'over-the-shoulder shot: the near person is a soft out-of-focus shoulder and back of the head at the frame edge, the far person framed chest up',
  pov: "point-of-view shot through a character's eyes — the viewer's own face is never seen",
};
/** Cỡ thấy mặt rõ → áp điểm neo mắt; giá trị = phần trăm chiều cao khung mặt chiếm (đo phim mẫu: cận 0,3–0,36, trung cận ~0,25, trung ~0,19). */
export const CO_NEO: Record<string, string> = { cu: '30–35', mcu: '22–28', ots: '20–25', ms: '15–20', two: '15–20' };

/** Câu cỡ khung + điểm neo mắt của chủ thể (ten rỗng = "the main subject"). */
export function cauKhung(co: string | null | undefined, ten = ''): string {
  const k = KHUNG_EN[String(co ?? '')]; if (!k) return '';
  const neo = CO_NEO[String(co)];
  const ai = ten ? `${ten}'s` : "The main subject's";
  return `${k[0]!.toUpperCase()}${k.slice(1)}.${neo ? ` ${ai} eyes sit on the upper-third line (${Math.round(NEO_MAT.y * 100)}% from the top) at the horizontal centre of the frame; the face fills about ${neo}% of the frame height.` : ''}`;
}

/** Góc quay đầu (độ, + = về phía phải màn) → chữ. */
export function cauQuayDau(q = 0): string {
  const h = q > 0 ? 'screen right' : 'screen left'; const a = Math.abs(q);
  return a < 10 ? 'face frontal to the camera' : a < 25 ? `face almost frontal, turned slightly toward ${h}` : a <= 60 ? `three-quarter view, head turned toward ${h}` : `profile, facing ${h}`;
}
export const phiaMan = (x: number) => (x < 0.4 ? 'screen left' : x > 0.6 ? 'screen right' : 'the centre of the frame');

/** Một người trong phiếu. ten = tên trong sổ / danh sách nhân vật; ta = tả ngoại hình tiếng Anh; nhin_vao = tên người / vật được nhìn. */
export type NguoiPhieu = { ten: string; ta?: string; x: number; lung?: boolean; mat?: [MaBieuCam, MaBieuCam]; quay?: number; nhin_vao?: string; nhin_huong?: 'trai' | 'phai' | 'len' | 'xuong' | 'truoc'; nam?: boolean };
export type ShotPhieu = { co: string; goc?: 'thap' | 'cao' | 'ngang'; nguoi: NguoiPhieu[]; /** món trong khung mà người giữ ở ngoài khung (cận chèn) */ khai?: string[];
  dien_en?: string; thoai?: { ai: string; loi: string } | null; /** mảnh của sổ đồ vật áp cho shot */ so_cu?: number; may_dong?: string };
export type NguonPhieu = { canh_en: string; so_vat?: SoVat; ten_en?: Record<string, string>; /** tả trang phục MỌI người của cảnh — người giữ đồ ở NGOÀI khung (cận chèn) thì tả tay áo của họ */ ta_nguoi?: Record<string, string>; /** MÔ TẢ CHUẨN của đạo cụ (xv_nhan_vat.mo_ta) — món có trong khung thì chép nguyên câu này */ vat_ta?: Record<string, string> };

export function phieuShot(s: ShotPhieu, n: NguonPhieu): string {
  const en = (t: string) => n.ten_en?.[t] ?? t;
  const thay = s.nguoi.filter((x) => !x.lung);
  const dong: string[] = [`Vertical 9:16 photoreal live-action drama still. ${cauKhung(s.co, thay[0]?.ten)}${s.goc === 'thap' ? ' LOW camera angle looking up (power shot).' : s.goc === 'cao' ? ' High camera angle looking down.' : ''}`, n.canh_en];
  dong.push(s.nguoi.length ? `IN FRAME — ONLY these people, nobody else: ${s.nguoi.map((x) => x.lung ? `${x.ten} seen from behind as a soft out-of-focus foreground shoulder at ${phiaMan(x.x)}` : `${x.ta ?? x.ten} at ${phiaMan(x.x)}`).join('; ')}.` : 'No people and no faces in frame.');
  for (const x of thay) {
    const t = x.nhin_vao; const tg = t ? s.nguoi.find((y) => y.ten === t) : undefined;
    const nhin = !t || x.nhin_huong === 'truoc' ? 'staring straight ahead past the camera, not looking at anyone, never into the lens'
      : tg ? `eyes on ${t}, who is in frame at ${phiaMan(tg.x)}`
      : x.nhin_huong === 'len' ? `eyes lifted UP toward ${en(t)}, out of frame` : x.nhin_huong === 'xuong' ? `eyes lowered DOWN to ${en(t)}`
      : `eyes looking off-screen to ${x.nhin_huong === 'trai' ? 'screen left' : 'screen right'} at ${en(t)}, at eye level, never into the lens`;
    let c = `${x.ten}: ${cauQuayDau(x.quay)}; ${nhin}.`;
    if (x.mat) { const [d0, d1] = x.mat; c += ` Expression at the start: ${bieuCam(d0)?.en}.${d1 !== d0 ? ` By the end: ${bieuCam(d1)?.en}.` : ' Keep this expression the whole shot.'}`;
      const cam = camThuc({ nv: x.ten, dau: d0, cuoi: d1 }); if (cam.length) c += ` Never: ${cam.map((k) => bieuCam(k)!.en).join('; ')}.`; }
    dong.push(c);
  }
  if (n.so_vat && s.so_cu != null) {
    const ai = s.nguoi.map((x) => x.ten); const khai = s.khai ?? [];
    const dau = cauVat(n.so_vat, s.so_cu, ai, en, khai, 'dau'), ket = cauVat(n.so_vat, s.so_cu, ai, en, khai, 'ket');
    if (dau && ket && dau !== ket) dong.push(`At the start — ${dau}`, `By the end — ${ket}`); else if (ket) dong.push(ket);
    // CẦM ≠ ĐEO (26/10/2026: Vivian cầm thẻ bằng dây đứt mà model vẽ thêm một thẻ đeo trên cổ cô) + người giữ ở NGOÀI khung: chỉ tay họ vào khung, đúng tay áo
    for (const [t, m] of Object.entries(trangThai(n.so_vat, s.so_cu, 'ket'))) {
      if (!m.ai) continue; const trong = ai.includes(m.ai), chen = khai.includes(t);
      if ((trong || chen) && /\b(hand|holds?|held|grip|fist|pinch)/i.test(m.cach)) dong.push(`${en(t)} is HELD in ${m.ai}'s hand only — it is NOT worn around anyone's neck; ${m.ai} wears no badge or lanyard of their own. Exactly one ${en(t)} in the frame.`);
      if (chen && !trong && n.ta_nguoi?.[m.ai]) dong.push(`Only ${m.ai}'s hand and forearm enter the frame, never their face — the sleeve and skin match ${m.ai}: ${n.ta_nguoi[m.ai]}.`);
    }
  }
  // HÌNH DẠNG CHUẨN của đạo cụ trong khung (26/10/2026: thẻ #7 tự in chữ + ảnh, thùng đổi đồ bên trong — mô tả chuẩn có sẵn mà phiếu không dùng)
  if (n.vat_ta) { const ai = s.nguoi.map((x) => x.ten); const giu = n.so_vat && s.so_cu != null ? Object.entries(trangThai(n.so_vat, s.so_cu, 'dau')).filter(([, m]) => m.ai && ai.includes(m.ai)).map(([t]) => t) : [];
    for (const t of [...new Set([...(s.khai ?? []), ...giu])]) if (n.vat_ta[t]) dong.push(`${t} looks exactly like this (same in every shot): ${n.vat_ta[t]}.`); }
  dong.push(`ONE motion only: ${s.dien_en ?? ''}${s.thoai?.loi ? ` ${s.thoai.ai} says (lip-sync): "${s.thoai.loi}"` : ''} ${s.may_dong ?? 'Static locked-off camera.'} No text, no captions.`.replace(/\s+/g, ' ').trim());
  return dong.join('\n');
}
