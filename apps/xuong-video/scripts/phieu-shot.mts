// PHIẾU PROMPT TỪ SƠ ĐỒ SHOT (anh 26/10/2026: "diễn tả chi tiết hơn để AI sinh đúng video — nhất là khuôn mặt, hướng nhìn"). 0đ, thuần.
// Cùng tệp dữ liệu với ve-so-do-shot.py (hình) → mỗi shot một khối tiếng Anh: cỡ khung + điểm neo mắt, CHỈ những người có trong khung (không người lạ),
// trái / phải màn, góc quay đầu, nhìn ai ở phía nào (không nhìn ống kính), nét mặt đầu → cuối + nét cấm (câu lấy từ BIEU_CAM của studio), đồ trên người,
// một động tác, ánh sáng chung cả cảnh. Ảnh sơ đồ đi kèm làm ảnh 1 (bố cục) cho bước sinh ảnh người thật.
//   node_modules/.bin/tsx apps/xuong-video/scripts/phieu-shot.mts <bang-shot.json> [ra.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { bieuCam, camThuc, type MaBieuCam } from '../src/lib/xuong-video/qc-cam-xuc';

type Nguoi = { ma: string; x: number; lung?: boolean; mat?: [MaBieuCam, MaBieuCam]; quay?: number; nhin_vao?: string; nhin_huong?: string; cam?: string[]; deo?: string[] };
type Shot = { so: number; giay: number; co: string; goc?: string; nguoi?: Nguoi[]; do?: { loai: string }[]; dien_en?: string; thoai?: string };
const [vao, ra] = process.argv.slice(2);
const b = JSON.parse(readFileSync(vao!, 'utf8')) as { nhan_vat: Record<string, { en: string; nhan: string; gioi?: string }>; canh_en: string; ten_vat_en?: Record<string, string>; shot: Shot[] };
const ten = (m: string) => b.nhan_vat[m]?.en.split(' (')[0] ?? b.ten_vat_en?.[m] ?? m;
const phia = (x: number) => (x < 0.4 ? 'screen left' : x > 0.6 ? 'screen right' : 'the centre of the frame');
const KHUNG: Record<string, string> = { cu: 'close-up, head and top of the shoulders', mcu: 'medium close-up, chest up', trung: 'medium shot, waist up', toan: 'wide shot, full bodies, lots of floor and ceiling', qua_vai: 'over-the-shoulder shot', can_do: 'extreme close-up insert of an object, no faces at all' };
const quayDau = (q = 0) => { const h = q > 0 ? 'screen right' : 'screen left'; const a = Math.abs(q);
  return a < 10 ? 'face frontal to the camera' : a < 25 ? `face almost frontal, turned slightly toward ${h}` : a <= 60 ? `three-quarter view, head turned toward ${h}` : `profile, facing ${h}`; };
const DO: Record<string, string> = { the: 'a white staff ID badge on a dark blue lanyard around her neck, resting on her chest', thung: 'hugs a cardboard box of her belongings (a small potted plant and a mug) against her chest with both arms', the_treo: 'holds the SNAPPED dark blue lanyard in her right hand, the white badge dangling below her fingers (never holding the card itself)' };

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
      : n.nhin_huong === 'len' ? `eyes lifted UP toward the ${b.ten_vat_en?.[t] ?? ten(t)} above, out of frame`
      : n.nhin_huong === 'xuong' ? `eyes lowered DOWN to the ${b.ten_vat_en?.[t] ?? ten(t)}`
      : `eyes looking off-screen to ${n.nhin_huong === 'trai' ? 'screen left' : 'screen right'} at ${b.ten_vat_en?.[t] ?? ten(t)}, at eye level, never into the lens`;
    let c = `${ten(n.ma)}: ${quayDau(n.quay)}; ${nhin}.`;
    if (n.mat) { const [d0, d1] = n.mat; c += ` Expression at the start: ${bieuCam(d0)?.en}.${d1 !== d0 ? ` By the end: ${bieuCam(d1)?.en}.` : ' Keep this expression the whole shot.'}`;
      const cam = camThuc({ nv: n.ma, dau: d0, cuoi: d1 }); if (cam.length) c += ` Never: ${cam.map((k) => bieuCam(k)!.en).join('; ')}.`; }
    const dd = [...(n.deo ?? []), ...(n.cam ?? [])].map((k) => DO[k]).filter(Boolean);
    const ho = b.nhan_vat[n.ma]?.gioi === 'nam' ? ['He', 'he'] : ['She', 'she']; if (dd.length) c += ` ${ho[0]} ${dd.join(`; ${ho[1]} `)}.`.replace(/around her neck|in her right hand/g, (x) => ho[0] === 'He' ? x.replace('her', 'his') : x);
    dong.push(c);
  }
  dong.push(`ONE motion only: ${s.dien_en}${s.thoai ? ` ${ten((s.nguoi ?? []).find((n) => !n.lung)?.ma ?? '')} says (lip-sync, Vietnamese): "${s.thoai}"` : ''} Static locked-off camera unless stated. No text, no captions.`);
  return dong.join('\n');
}
const md = b.shot.map((s) => `### #${s.so} · ${s.giay}s · ${s.co}\n\n\`\`\`\n${phieu(s)}\n\`\`\``).join('\n\n');
if (ra) writeFileSync(ra, `# Phiếu prompt — ${vao}\n\n${md}\n`); else console.log(md);
