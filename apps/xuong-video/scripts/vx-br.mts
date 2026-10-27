// CẦU NỐI br ↔ VideoExpress.ai (anh 27/10/2026 "dựng đi") — thư viện dùng chung cho vx-gui.mts (gửi lô) + vx-lay.mts (lấy về).
// $0: lái ĐÚNG giao diện web qua `br` như người thật (nạp ảnh → Image to Video → Create Video), KHÔNG gọi thẳng API riêng bằng cookie → không đụng ToS.
// Giữ mặt nhân vật: nạp KHUNG ĐÃ DUYỆT của studio (so-N-that.png) làm khung đầu, chỉ ra lệnh chuyển động — mặt/áo/thẻ giữ nguyên (đã kiểm 27/10 với Hạ).
// DÙNG eval-click, KHÔNG dùng `br click` cho điều hướng: `br click` khoá cùng một đích 10 phút (chạy lô là throttle → hụt bước).
// Đặt tên media = tag: COPY khung thành <tag>.png rồi nạp (media-name tự lấy tên file) — khỏi phải sửa ô tên trong hộp thoại.
// LƯU Ý: VideoExpress chỉ giữ file 40 ngày → lấy về ngay. Shot < 3s: nó sinh tối thiểu ~4s, dung-tu-video.mts cắt lại theo giây phát.
// Tài khoản: vault acct #677 (profile br htuan82). Chạy sau khi `br use 677` + app mở ở màn editor.
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const BR = `${process.env.HOME}/bin/br`;
export const ngu = (ms: number) => new Promise((r) => setTimeout(r, ms));

// br eval --main: trả JSON ở DÒNG CUỐI (daemon có thể in dòng khai trước) → lấy dòng cuối cùng parse được.
export function brEval<T = unknown>(js: string): T {
  const out = execFileSync(BR, ['eval', '--main', js], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const dong = out.trim().split('\n');
  for (let i = dong.length - 1; i >= 0; i--) { try { return JSON.parse(dong[i]) as T; } catch {} }
  return out.trim() as unknown as T;
}
export const brPost = (verb: string, body: Record<string, unknown>) =>
  execFileSync(BR, ['post', verb, JSON.stringify(body)], { encoding: 'utf8' });
export const taiLai = () => { try { execFileSync(BR, ['goto', 'https://app.videoexpress.ai/'], { encoding: 'utf8' }); } catch {} }; // DOM mới = hết panel/modal rác (nguồn đua trạng thái)

// bấm phần tử CHỮ KHỚP (không cooldown như `br click`): lấy phần tử SÂU NHẤT khớp (nhãn thật) rồi LEO lên nút bấm gần nhất
// (icon làm <button> có nhiều con → khớp vào span rỗng bên trong là bấm hụt; phải leo về button/a).
export const evClick = (reText: string, extra = 'true') =>
  brEval<number>(`(()=>{const re=new RegExp(${JSON.stringify(reText)});const c=[...document.querySelectorAll("button,a,label,div,span")].filter(x=>x.offsetParent&&re.test((x.textContent||"").trim())&&(${extra}));if(!c.length)return 0;c.sort((a,b)=>a.querySelectorAll("*").length-b.querySelectorAll("*").length);(c[0].closest("button,a")||c[0]).click();return 1})()`);
// mở/kích hoạt một tile/thẻ bằng cách bắn đủ chuỗi sự kiện chuột vào tâm phần tử
const evDispatch = (findJs: string) =>
  brEval<string>(`(()=>{const el=${findJs};if(!el)return "none";const r=el.getBoundingClientRect();["mousedown","mouseup","click","dblclick"].forEach(e=>el.dispatchEvent(new MouseEvent(e,{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2})));return "ok"})()`);

export function getMedia(catId: number, limit = 50): { total: string; results: VxItem[] } {
  return brEval(`fetch("/api/library/get_media/4?categoryId=${catId}&page=1&start=0&limit=${limit}&orderBy=id&orderDir=desc",{headers:{"X-Requested-With":"XMLHttpRequest"}}).then(r=>r.json())`);
}
export type VxItem = { id: number; name: string; uuid: string; isPending: boolean; mediaPath: string; fileName: string; extension: string; frameSize: string; duration: number };

export function catId(ten: string): number {
  const j = brEval<{ data: { id: number; name: string }[] }>(`fetch("/library/get_categories/4",{headers:{"X-Requested-With":"XMLHttpRequest"}}).then(r=>r.json())`);
  const c = j.data.find((x) => x.name === ten);
  if (!c) throw new Error(`không thấy folder '${ten}' (${j.data.map((x) => x.name).join(', ')})`);
  return c.id;
}

export function trenApp(): boolean {
  const u = brEval<{ url?: string }>(`({url:location.href})`);
  return !!u.url && /app\.videoexpress\.ai/.test(u.url) && !/\/login/.test(u.url);
}
const dongHet = () => brEval(`(()=>{let n=0;document.querySelectorAll("button").forEach(b=>{if(b.offsetParent&&b.textContent.trim()==="Close"){b.click();n++}});return n})()`);
const thay = (reText: string) => brEval<boolean>(`new RegExp(${JSON.stringify(reText)}).test(document.body.innerText)`);
// mở folder Default (picker Select Image): CLICK THẬT tại TOẠ ĐỘ ô folder qua daemon /clickxy — MouseEvent synthetic bị React bỏ qua,
// còn getByText("Default") click nhầm nhãn theo thứ tự DOM (có thể dưới overlay → đóng picker). Lấy toạ độ nhãn Default rồi clickxy lên Ô (trên nhãn ~40px).
function moDefault() {
  const pos = brEval<{ x: number; y: number } | null>(`(()=>{const l=[...document.querySelectorAll("*")].filter(x=>/^Default$/.test((x.textContent||"").trim())&&x.offsetParent&&x.querySelectorAll("*").length<2);if(!l.length)return null;const r=l[0].getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y-40)}})()`);
  if (pos) { try { brPost('clickxy', { x: pos.x, y: pos.y, dbl: true }); } catch {} }
}
// MỞ panel theo NỘI DUNG, không toggle: chỉ bấm nút rail khi nội dung CHƯA hiện (bấm lại nút rail của panel đang mở = TẮT nó).
async function moPanel(railText: string, noiDung: string) { if (!thay(noiDung)) { evClick(railText); await ngu(1500); } }
// về gốc thư viện (thoát folder đang mở) rồi mở Default
async function veGocRoiMoDefault() {
  await moPanel('^Media Library$', 'My Media');
  evClick('^My Media$'); await ngu(800);               // về gốc (nếu đang trong folder)
  await evDispatch(`[...document.querySelectorAll("*")].find(x=>/^Default$/.test((x.textContent||"").trim())&&x.querySelectorAll("*").length<2&&x.offsetParent)?.closest("div")`);
  await ngu(1500);
}

// NẠP khung lên folder Default với media-name = tag. Bỏ qua nếu tag đã có. Trả true khi thư viện đã có tag.
export async function napKhung(fileGoc: string, tag: string, catDefault: number): Promise<boolean> {
  if (getMedia(catDefault, 100).results.some((r) => r.name.toLowerCase() === tag.toLowerCase())) { console.log(`  · ${tag}: đã có trong thư viện`); return true; }
  const f = `${tmpdir()}/${tag}.png`; copyFileSync(fileGoc, f); // tên file = media-name
  await veGocRoiMoDefault();
  evClick('^Upload file$'); await ngu(700);                       // tạo <input type=file> ẩn
  brPost('upload', { selector: 'input[type=file]', file: f });    // daemon /upload = setInputFiles (không cần hộp thoại OS)
  await ngu(1200);
  evClick('^Upload files$'); // xác nhận
  for (let i = 0; i < 24; i++) { await ngu(2500); if (!brEval<boolean>(`/Upload Media/i.test(document.body.innerText)`)) break; }
  dongHet(); await ngu(800);
  const ok = getMedia(catDefault, 100).results.some((r) => r.name.toLowerCase() === tag.toLowerCase());
  console.log(`  · ${tag}: ${ok ? 'đã nạp' : '⚠ nạp KHÔNG thấy trong thư viện'}`);
  return ok;
}

// mở modal Create Video From Prompt (eval, retry) — trả true khi có 2 textarea
async function moModal(): Promise<boolean> {
  for (let lan = 0; lan < 3; lan++) {
    if (brEval<number>(`document.querySelectorAll("textarea").length`) >= 2) return true;
    await moPanel('^Create with AI$', 'Create Video From Prompt'); await ngu(800);
    // bấm nút tròn tím (mũi tên →) của thẻ "Create Video From Prompt": tìm nút chữ, leo lên card (có button.btn-circle) rồi bấm nút tròn
    brEval(`(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n,hit=null;while(n=w.nextNode()){if(/Create Video From Prompt/.test(n.textContent)){hit=n.parentElement;break}}if(!hit)return 0;let card=hit;for(let i=0;i<8;i++){const b=card.getBoundingClientRect().width;if(b>250&&b<560&&card.querySelector("button.btn-circle, button[class*=circle]"))break;card=card.parentElement||card}const a=card.querySelector("button.btn-circle, button[class*=circle]");if(a){a.click();return 1}return 0})()`);
    await ngu(2500);
    if (brEval<number>(`document.querySelectorAll("textarea").length`) >= 2) return true;
  }
  return false;
}

// GỬI một shot: mở modal → 9:16 → prompt chuyển động → Use from Library → chọn tile tag → Create Video.
// Trả uuid của job vừa tạo (item my_ai_videos mới nhất chưa có trong daBiet), hoặc null.
export async function guiShot(tag: string, prompt: string, catVideo: number, daBiet: Set<string>): Promise<string | null> {
  taiLai(); await ngu(5000); // trang mới, sạch panel rác từ napKhung / lần trước
  if (!(await moModal())) { console.log(`  ! ${tag}: không mở được modal`); return null; }
  // 9:16 + prompt vào ô "Video and Audio Prompt" (ta[1]) + xoá ta[0] + TẮT auto-enhance
  brEval(`(()=>{const v=[...document.querySelectorAll("button")].find(x=>/vertical 9:16/i.test(x.textContent)&&x.offsetParent&&x.getBoundingClientRect().top<160);if(v)v.click();const ta=document.querySelectorAll("textarea");const set=(el,val)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,"value").set;d.call(el,val);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))};if(ta[0])set(ta[0],"");if(ta[1])set(ta[1],${JSON.stringify(prompt)});const enh=[...document.querySelectorAll("input[type=checkbox]")].find(c=>/enhance my image/i.test(c.closest("label")?.textContent||c.parentElement?.textContent||""));if(enh&&enh.checked)enh.click();return 1})()`);
  await ngu(600);
  const coPicker = () => brEval<boolean>(`/Select Image/.test(document.body.innerText)`);
  const coSearch = () => brEval<boolean>(`[...document.querySelectorAll("input")].some(i=>i.offsetParent&&/search/i.test(i.placeholder||""))`); // = đang Ở TRONG folder
  const coDefaultLabel = () => brEval<boolean>(`[...document.querySelectorAll("*")].some(x=>/^Default$/.test((x.textContent||"").trim())&&x.offsetParent&&x.querySelectorAll("*").length<2)`);
  const demTile = () => brEval<number>(`[...document.querySelectorAll("*")].filter(x=>{const b=getComputedStyle(x).backgroundImage||"";return x.offsetParent&&(b.indexOf("cdn-ny-b")>-1||b.indexOf("userfiles")>-1)&&x.getBoundingClientRect().width>80}).length`);
  // 1) mở picker (verify + retry)
  for (let i = 0; i < 8 && !coPicker(); i++) { evClick('use from library', 'true'); await ngu(1000); }
  // 2) vào folder Default (clickxy toạ độ, verify bằng search box; retry) — bỏ qua nếu đã ở trong folder
  for (let i = 0; i < 6 && coPicker() && !coSearch(); i++) { if (coDefaultLabel()) moDefault(); await ngu(1500); }
  // 3) chờ tile load
  let nTile = 0;
  for (let i = 0; i < 8; i++) { nTile = demTile(); if (nTile > 0) break; await ngu(1200); }
  // chọn tile có NHÃN = tag (khớp chính xác), fallback tile đầu nếu chỉ một
  const chon = brEval<string>(`(()=>{document.body.click();const tiles=[...document.querySelectorAll("*")].filter(x=>{const b=getComputedStyle(x).backgroundImage||"";return x.offsetParent&&(b.indexOf("cdn-ny-b")>-1||b.indexOf("userfiles")>-1)&&x.getBoundingClientRect().width>80});const khop=tiles.find(x=>{const box=x.closest("div")?.parentElement||x.parentElement;return new RegExp("^"+${JSON.stringify(tag)}+"$","i").test((box?box.innerText:"").trim())});const tile=khop||(tiles.length===1?tiles[0]:null);if(!tile)return "no-tile("+tiles.length+")";const r=tile.getBoundingClientRect();tile.dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));const c=[...document.querySelectorAll("button")].find(x=>/^\\s*Choose\\s*$/i.test((x.textContent||"").trim())&&x.offsetParent);if(c){c.click();return "chose"}return "no-choose"})()`);
  if (chon !== 'chose') { console.log(`  ! ${tag}: không chọn được khung (${chon}, tile=${nTile})`); dongHet(); return null; }
  await ngu(2000);
  if (!brEval<boolean>(`(()=>{const cv=[...document.querySelectorAll("button")].find(x=>/create video/i.test(x.textContent)&&x.offsetParent);return cv?!cv.disabled:false})()`)) { console.log(`  ! ${tag}: nút Create Video chưa bật`); return null; }
  brEval(`(()=>{const cv=[...document.querySelectorAll("button")].find(x=>/create video/i.test(x.textContent)&&x.offsetParent&&!x.disabled);if(cv)cv.click();return 1})()`);
  await ngu(4000);
  const err = brEval<string>(`(()=>{const t=document.body.innerText;return (t.match(/(error|limit|exceed|maximum|not enough|insufficient)[^\\n]{0,40}/i)||[""])[0]})()`);
  if (err) { console.log(`  ! ${tag}: ${err}`); return null; }
  for (let i = 0; i < 6; i++) { await ngu(2500); const moi = getMedia(catVideo, 5).results.find((r) => !daBiet.has(r.uuid)); if (moi) { daBiet.add(moi.uuid); return moi.uuid; } }
  return null;
}
