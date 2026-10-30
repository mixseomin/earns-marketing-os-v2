// SỬA BÀI FACEBOOK ĐÃ ĐĂNG QUA GRAPH API (box3, anh 31/10/2026: "mấy con đăng bài kêu không sửa được — làm sao để sửa được với CLI"). Cùng sổ token Page
// + kiểm danh tính với dang-fb-reel.mts (kiemTrang: token phải đúng Page id + tên, sai thì dừng). Máy gọi: puzzle-books scripts/sua-bai.mjs qua ssh.
//   stdin JSON { page_id, ten, url, mo_ta?, tieu_de?, doc?: true } → stdout JSON { id, loai, truoc: {mo_ta, tieu_de}, sau?: {…} }
//   url nhận: https://www.facebook.com/reel/<video_id>/ · fb-hen-api:<video_id>:<giờ> (Reel hẹn qua API, sửa được cả trước giờ lên) ·
//   https://www.facebook.com/<page>/posts/<số> (bài ảnh / link — id bài = <page>_<số>). 'fb-hen:<page>:<giờ>' (hẹn bằng trình duyệt) không có mã bài → báo lỗi rõ.
//   doc: chỉ đọc chữ hiện tại, không sửa. Sửa xong ĐỌC LẠI, khác chữ đã gửi thì báo lỗi (không tin "ok" của API).
import { kiemTrang } from './dang-fb-reel.mts';

const G = 'https://graph.facebook.com/v21.0';   // cùng bản Graph với dang-fb-reel.mts
async function goi(u: string, body?: Record<string, string>): Promise<Record<string, unknown>> {
  const r = await fetch(u, { ...(body ? { method: 'POST', body: new URLSearchParams(body) } : {}), signal: AbortSignal.timeout(60_000) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>, e = j.error as { message?: string; code?: number } | undefined;
  if (!r.ok || e) throw new Error(`Graph ${r.status}: ${e?.message ?? JSON.stringify(j).slice(0, 200)}${e?.code ? ` (mã ${e.code})` : ''}`);
  return j;
}

export function maBai(url: string): { id: string; loai: 'video' | 'bai' } {
  const u = String(url);
  let m = u.match(/^fb-hen-api:(\d+):/) || u.match(/facebook\.com\/reel\/(\d+)/) || u.match(/facebook\.com\/(?:[^/]+\/)?videos\/(\d+)/);
  if (m) return { id: m[1]!, loai: 'video' };
  m = u.match(/facebook\.com\/(\d+)\/posts\/(\d+)/); if (m) return { id: `${m[1]}_${m[2]}`, loai: 'bai' };
  if (/^fb-hen:/.test(u)) throw new Error('bài hẹn bằng trình duyệt (fb-hen:) không lưu mã bài — sổ đăng chưa có link thật của bài này');
  throw new Error(`không nhận ra link Facebook: ${u}`);
}

if (process.argv[1]?.endsWith('sua-fb.mts')) {
  if (process.argv.includes('--tu-kiem')) {
    const { strict: t } = await import('node:assert');
    t.deepEqual(maBai('https://www.facebook.com/reel/2688283618272782/'), { id: '2688283618272782', loai: 'video' });
    t.deepEqual(maBai('fb-hen-api:1443553181266084:2026-11-05T13:30:00.000Z'), { id: '1443553181266084', loai: 'video' });
    t.deepEqual(maBai('https://www.facebook.com/122100376449513767/posts/122109462945513767'), { id: '122100376449513767_122109462945513767', loai: 'bai' });
    t.throws(() => maBai('fb-hen:104223389200602:2026-11-04T13:00:00.000Z'), /trình duyệt/); t.throws(() => maBai('https://x.com/a'), /không nhận ra/);
    console.log('sua-fb: tự kiểm đạt'); process.exit(0);
  }
  let raw = ''; for await (const c of process.stdin) raw += c;
  const x = JSON.parse(raw) as { page_id: string; ten: string; url: string; mo_ta?: string; tieu_de?: string; doc?: boolean };
  const tk = (await kiemTrang(x.page_id, x.ten)).token, b = maBai(x.url);
  const doc = async () => { const j = await goi(`${G}/${b.id}?${new URLSearchParams({ fields: b.loai === 'video' ? 'description,title' : 'message', access_token: tk })}`);
    return b.loai === 'video' ? { mo_ta: String(j.description ?? ''), tieu_de: String(j.title ?? '') } : { mo_ta: String(j.message ?? ''), tieu_de: '' }; };
  const truoc = await doc();
  if (x.doc || (x.mo_ta == null && x.tieu_de == null)) { process.stdout.write(JSON.stringify({ id: b.id, loai: b.loai, truoc })); process.exit(0); }
  if (b.loai === 'bai' && x.tieu_de != null) throw new Error('bài ảnh / link Facebook không có tiêu đề — chỉ sửa được chữ (--chu)');
  const body: Record<string, string> = { access_token: tk };
  if (x.mo_ta != null) body[b.loai === 'video' ? 'description' : 'message'] = x.mo_ta;
  if (x.tieu_de != null) body.name = x.tieu_de;
  await goi(`${G}/${b.id}`, body);
  const sau = await doc();
  if ((x.mo_ta != null && sau.mo_ta !== x.mo_ta) || (x.tieu_de != null && sau.tieu_de !== x.tieu_de)) throw new Error(`Facebook nhận lệnh nhưng đọc lại chưa thấy chữ mới (đang là: "${sau.mo_ta.slice(0, 80)}")`);
  process.stdout.write(JSON.stringify({ id: b.id, loai: b.loai, truoc, sau })); process.exit(0);
}
