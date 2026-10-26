// PHIẾU PROMPT TỪ SƠ ĐỒ SHOT (anh 26/10/2026: "diễn tả chi tiết hơn để AI sinh đúng video — nhất là khuôn mặt, hướng nhìn"). 0đ, thuần.
// Cùng tệp dữ liệu với ve-so-do-shot.py (hình) → mỗi shot một khối tiếng Anh: cỡ khung + điểm neo mắt, CHỈ những người có trong khung (không người lạ),
// trái / phải màn, góc quay đầu, nhìn ai ở phía nào (không nhìn ống kính), nét mặt đầu → cuối + nét cấm (câu lấy từ BIEU_CAM của studio), đồ trên người,
// một động tác, ánh sáng chung cả cảnh. Ảnh sơ đồ đi kèm làm ảnh 1 (bố cục) cho bước sinh ảnh người thật.
//   node_modules/.bin/tsx apps/xuong-video/scripts/phieu-shot.mts <bang-shot.json> [ra.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { bieuCam, camThuc, type MaBieuCam } from '../src/lib/xuong-video/qc-cam-xuc';

type Nguoi = { ma: string; x: number; lung?: boolean; mat?: [MaBieuCam, MaBieuCam]; quay?: number; nhin_vao?: string; nhin_huong?: string; cam?: string[]; deo?: string[] };
export type Shot = { so: number; giay: number; co: string; goc?: string; nguoi?: Nguoi[]; do?: { loai: string; en?: string }[]; dien_en?: string; thoai?: string };
export type BangShot = { vat_theo_doi?: Record<string, string>; nhan_vat: Record<string, { en: string; nhan: string; gioi?: string; ten_db?: string }>; canh_en: string; ten_vat_en?: Record<string, string>; shot: Shot[] };
let b: BangShot;
const ten = (m: string) => b.nhan_vat[m]?.en.split(' (')[0] ?? b.ten_vat_en?.[m] ?? m;
const phia = (x: number) => (x < 0.4 ? 'screen left' : x > 0.6 ? 'screen right' : 'the centre of the frame');
// CỠ KHUNG ghi CHỖ CẮT + "không mở rộng": AI hay nới khung ra toàn thân theo ảnh mẫu (26/10/2026 sơ đồ #11 trung → toàn, #12 cận → trung cận)
const KHUNG: Record<string, string> = { cu: 'TIGHT close-up: head and neck, cropped just below the collarbones — never widen the framing', mcu: 'medium close-up cropped at mid-chest — never widen the framing', trung: 'medium shot cropped at the waist — legs and feet NOT visible, never widen to a full-body shot', toan: 'wide shot, full bodies, lots of floor and ceiling', qua_vai: 'over-the-shoulder shot cropped at chest height', can_do: 'extreme close-up insert of an object, no faces at all' };
const quayDau = (q = 0) => { const h = q > 0 ? 'screen right' : 'screen left'; const a = Math.abs(q);
  return a < 10 ? 'face frontal to the camera' : a < 25 ? `face almost frontal, turned slightly toward ${h}` : a <= 60 ? `three-quarter view, head turned toward ${h}` : `profile, facing ${h}`; };
const DO: Record<string, string> = { the: 'a white staff ID badge on a dark blue lanyard around her neck, resting on her chest', thung: 'hugs a cardboard box of her belongings (a small potted plant and a mug) against her chest with both arms', the_treo: 'holds the SNAPPED dark blue lanyard in her right hand, the white badge dangling below her fingers (never holding the card itself)' };

/** Phiếu prompt tiếng Anh cho một shot của bảng (dùng cả ở anh-tu-so-do.mts). */
export function phieuShot(bang: BangShot, s: Shot): string { b = bang; return phieu(s); }
function phieu(s: Shot): string {
  const ng = s.nguoi ?? []; const thay = ng.filter((n) => !n.lung);
  const dong: string[] = [`Vertical 9:16 photoreal live-action drama still, ${KHUNG[s.co]}${s.goc === 'thap' ? ', LOW camera angle looking up (power shot)' : s.goc === 'cao' ? ', high camera angle looking down' : ''}.`, b.canh_en];
  if (ng.length) dong.push(`IN FRAME — ONLY these people, nobody else: ${ng.map((n) => n.lung ? `${ten(n.ma)} seen from behind as a soft out-of-focus foreground shoulder at ${phia(n.x)}` : `${b.nhan_vat[n.ma]!.en} at ${phia(n.x)}`).join('; ')}.`);
  else dong.push('No people and no faces in frame.');
  const chinh = thay[0];
  if (chinh && s.co !== 'toan') dong.push(`${ten(chinh.ma)}'s eyes sit on the upper-third line at the horizontal centre of the frame; the face fills about ${s.co === 'cu' ? '30–35' : s.co === 'mcu' ? '22–28' : '15–20'}% of the frame height.`);
  for (const n of thay) {
    const t = n.nhin_vao; const tg = t && ng.find((x) => x.ma === t);
    const nhin = !t ? 'eyes looking ahead past the camera, never into the lens'
      : t === 'phia_truoc' ? 'staring straight ahead past the camera, deliberately NOT looking at anyone, never into the lens'
      : tg ? `eyes on ${ten(t)}, who is in frame at ${phia(tg.x)}`
      : n.nhin_huong === 'len' ? `eyes lifted UP toward ${b.ten_vat_en?.[t] ?? ten(t)} above, out of frame`
      : n.nhin_huong === 'xuong' ? `eyes lowered DOWN to ${b.ten_vat_en?.[t] ?? ten(t)}`
      : `eyes looking off-screen to ${n.nhin_huong === 'trai' ? 'screen left' : 'screen right'} at ${b.ten_vat_en?.[t] ?? ten(t)}, at eye level, never into the lens`;
    let c = `${ten(n.ma)}: ${quayDau(n.quay)}; ${nhin}.`;
    if (n.mat) { const [d0, d1] = n.mat; c += ` Expression at the start: ${bieuCam(d0)?.en}.${d1 !== d0 ? ` By the end: ${bieuCam(d1)?.en}.` : ' Keep this expression the whole shot.'}`;
      const cam = camThuc({ nv: n.ma, dau: d0, cuoi: d1 }); if (cam.length) c += ` Never: ${cam.map((k) => bieuCam(k)!.en).join('; ')}.`; }
    const dd = [...(n.deo ?? []), ...(n.cam ?? [])].map((k) => DO[k]).filter(Boolean);
    const ho = b.nhan_vat[n.ma]?.gioi === 'nam' ? ['He', 'he'] : ['She', 'she']; if (dd.length) c += ` ${ho[0]} ${dd.join(`; ${ho[1]} `)}.`.replace(/around her neck|in her right hand/g, (x) => ho[0] === 'He' ? x.replace('her', 'his') : x);
    // ĐỒ ĐÃ MẤT phải nói ra: phiếu chỉ kể đồ đang có thì AI giữ đồ cũ trên người (#12 Hạ vừa bị giật thẻ vẫn đeo dây thẻ)
    const mat_do = Object.entries(b.vat_theo_doi ?? {}).filter(([k]) => ![...(n.deo ?? []), ...(n.cam ?? [])].some((x) => x === k || x.startsWith(`${k}_`))).map(([, en]) => en);
    if (mat_do.length) c += ` ${ten(n.ma)} has NO ${mat_do.join(' and NO ')} on ${b.nhan_vat[n.ma]?.gioi === 'nam' ? 'him' : 'her'}.`;
    dong.push(c);
  }
  for (const o of s.do ?? []) if (o.en) dong.push(o.en);
  dong.push(`ONE motion only: ${s.dien_en}${s.thoai ? ` ${ten((s.nguoi ?? []).find((n) => !n.lung)?.ma ?? '')} says (lip-sync, Vietnamese): "${s.thoai}"` : ''} Static locked-off camera unless stated. No text, no captions.`);
  return dong.join('\n');
}
const chinh = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (chinh) { const [vao, ra] = process.argv.slice(2); b = JSON.parse(readFileSync(vao!, 'utf8')) as BangShot;
const md = b.shot.map((s) => `### #${s.so} · ${s.giay}s · ${s.co}\n\n\`\`\`\n${phieu(s)}\n\`\`\``).join('\n\n');
if (ra) writeFileSync(ra, `# Phiếu prompt — ${vao}\n\n${md}\n`); else console.log(md); }
