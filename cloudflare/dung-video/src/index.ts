// CỬA VÀO máy dựng ffmpeg trên Cloudflare Containers (anh 21/10/2026: nhẹ tải box3, cần thì chạy song song).
// Studio (box3) gửi POST /ffmpeg (dựng MP4) hoặc POST /soi (soi chữ clip — soi-chu.ts) kèm header x-dung-khoa; Worker chia lượt vào một trong SO_MAY container (mỗi container dựng một video một lúc),
// container tự ngủ sau 20 giây rảnh (sleepAfter) — không tốn tiền lúc không có việc.
import { Container, getRandom } from '@cloudflare/containers';

const SO_MAY = 4;   // tối đa 4 video dựng song song

export class MayDung extends Container {
  defaultPort = 8080;
  sleepAfter = '20s';   // Cloudflare tính tiền cả lúc container thức: rảnh 20 giây là ngủ (khởi động lại chỉ thêm vài giây — đo 21/10)
}

interface Env { MAY_DUNG: DurableObjectNamespace<MayDung>; DUNG_KHOA: string }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.headers.get('x-dung-khoa') !== env.DUNG_KHOA) return new Response('sai khoá', { status: 401 });
    const u = new URL(req.url);
    if (u.pathname === '/song') return new Response('ok');
    if (req.method !== 'POST' || (u.pathname !== '/ffmpeg' && u.pathname !== '/soi')) return new Response('không có', { status: 404 });
    const may = await getRandom(env.MAY_DUNG, SO_MAY);
    return may.fetch(new Request(`http://may${u.pathname}`, { method: 'POST', body: req.body, headers: { 'content-type': 'application/json' } }));
  },
};
