import { doBaiDang } from './cham-dang.mjs';
const anh = ['https://img.on.tc/xuong-video/anh-le/5fff6a49.png'];
const nen = { xuat_luc: new Date().toISOString(), anh, anh_ai: true, persona: true, can_goc: false };

const ca = [
  ['bài Mia thật (phải ĐẠT)', { ...nen, dang: { loai: 'anh', title: 'rain again',
      description: 'rain again. third morning in a row & im not even mad about it. stayed up til 2 finishing a series i swore id only watch one episode of' } }, false],
  ['persona mà giọng quảng cáo (phải CHẶN)', { ...nen, dang: { loai: 'anh', title: 'rain again',
      description: 'watch now! you need to see this series, link in bio' } }, true],
  ['persona mà viết hoa nhấn (phải CHẶN)', { ...nen, dang: { loai: 'anh', title: 'rain again',
      description: 'this series is INSANE i could not stop' } }, true],
  ['persona mà nhét link vào bài (phải CHẶN)', { ...nen, dang: { loai: 'anh', title: 'rain again',
      description: 'loved this one https://reelslink.com/cps/f4COvp' } }, true],
  ['persona mà dài lê thê (phải CHẶN)', { ...nen, dang: { loai: 'anh', title: 'rain again',
      description: 'a'.repeat(320) } }, true],
  ['persona 4 hashtag (phải CHẶN)', { ...nen, dang: { loai: 'anh', title: 'rain again',
      description: 'cozy morning #rain #seattle #coffee #drama' } }, true],
  // Máy SX (11/11/2026): Reel cắt từ phim thật — có video + mã phim → không bị luật "nền màu phẳng" chặn; video mẫu không mã phim vẫn bị chặn
  ['Reel cắt cảnh phim thật (phải ĐẠT)', { xuat_luc: new Date().toISOString(), persona: true, can_goc: false, video_url: 'https://img.on.tc/xuong-video/mia-reel/a.mp4',
      dang: { loai: 'video', phim: 149304, title: 'she ran with the baby and took nothing',
        description: 'she ran with the baby and took nothing, not even her own name. five years later the man funding her shelter is the one she ran from' } }, false],
  ['video KHÔNG mã phim, không nền (phải CHẶN như cũ)', { xuat_luc: new Date().toISOString(), persona: true, can_goc: false, video_url: 'https://img.on.tc/x.mp4',
      dang: { loai: 'video', title: 'she ran with the baby and took nothing',
        description: 'she ran with the baby and took nothing, not even her own name. five years later the man funding her shelter is the one she ran from' } }, true],
  ['KHÔNG persona, ảnh AI (phải CHẶN như cũ)', { xuat_luc: new Date().toISOString(), nen_url: 'https://img.on.tc/x.png', can_goc: false,
      dang: { loai: 'anh', title: 'a title that is definitely long enough here', description: 'x' } }, true],
];
let dat = 0;
for (const [ten, v, mongChan] of ca) {
  const r = doBaiDang(v, 'Mia Calloway');
  const bichan = (r.chan_cung ?? []).length > 0;
  const ok = bichan === mongChan;
  if (ok) dat++;
  console.log(`${ok ? 'ĐẠT ' : 'TRƯỢT'} · ${ten}${bichan ? ' → ' + (r.chan_cung ?? []).slice(0, 2).join(" | ") : ''}`);
}
console.log(`\n${dat}/${ca.length} ca đúng`);
