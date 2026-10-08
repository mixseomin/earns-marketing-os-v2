// xv-worker — consumer hàng đợi Cloudflare `xv-jobs`: mỗi tin = một việc sinh ảnh của studio.on.tc.
// Chạy cùng hàm chayViecAnh với studio (ảnh lên R2 img.on.tc), rồi báo kết quả về studio.on.tc/api/xv/xong để ghi sổ.
// KHÔNG retry việc đã gọi model: sinh lại = trả tiền lần hai. Chỉ retry phần báo về studio.
import { chayViecAnh, type ViecAnh, type KqViec } from '../src/lib/xuong-video/viec-anh';

type Env = { STUDIO_URL: string; XV_WORKER_SECRET: string };

async function baoVe(kq: KqViec, env: Env): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${env.STUDIO_URL}/api/xv/xong`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-xv-secret': env.XV_WORKER_SECRET }, body: JSON.stringify(kq),
      });
      if (r.ok) return true;
      console.log('báo về studio lỗi', r.status);
    } catch (e) { console.log('báo về studio lỗi', String(e)); }
    await new Promise((ok) => setTimeout(ok, 2000 * 2 ** i));   // studio đang deploy → chờ 2·4·8·16·32s
  }
  return false;
}

export default {
  async queue(batch: MessageBatch<ViecAnh>, env: Env): Promise<void> {
    for (const m of batch.messages) {
      const v = m.body;
      const kq: KqViec = v.thu ? { job: v.job, ok: false, loi: 'thử hàng đợi' } : await chayViecAnh(v);
      if (!(await baoVe(kq, env))) console.log('MẤT kết quả job', v.job, JSON.stringify(kq));
      m.ack();
    }
  },
  async fetch(): Promise<Response> { return new Response('xv-worker', { status: 200 }); },
};
