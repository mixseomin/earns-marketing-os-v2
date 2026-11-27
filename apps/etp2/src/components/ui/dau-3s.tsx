'use client';
// 3 GIÂY ĐẦU CỦA VIDEO — thứ người xem thấy trước khi quyết định lướt qua (anh 27/11/2026 "Câu đọc và nội dung trong 3s đầu của video là tối quan trọng nên phải show rõ ràng ra").
// Thẻ duyệt (Chờ lên, Chờ anh duyệt): khung đầu video + nhãn "3s đầu"; RÊ CHUỘT vào thẻ mới chạy lặp 0–3s (tắt tiếng), rời chuột dừng.
// KHÔNG tự chạy khi thẻ vào màn (anh 27/11/2026 "SAO LẠI BẬT PLAY HẾT VIDEO CÙNG 1 LÚC" — bản trước IntersectionObserver phát mọi thẻ đang hiện).
// Bấm = mở cả video có tiếng qua VideoXem (khung chung, nhớ lựa chọn tiếng).
import { useState } from 'react';
import { VideoXem } from './video-xem';

const GIAY = 3;
const KHUNG = { width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 4, display: 'block' } as const;

export function Dau3s({ video, anh }: { video: string | null; anh: string | null }) {
  const [mo, setMo] = useState(false);
  if (mo && video) return <VideoXem src={video} controls style={KHUNG} onEnded={() => setMo(false)} />;
  if (!video) return anh ? <img src={anh} alt="" style={KHUNG} /> : <span style={{ ...KHUNG, background: 'var(--line)' }} />;
  return <button type="button" data-o="dau-3s" title="rê chuột: 3 giây đầu (tắt tiếng, lặp lại) — bấm để xem cả video có tiếng" onClick={() => setMo(true)}
    onMouseEnter={(e) => { const v = e.currentTarget.querySelector('video'); if (v) void v.play().catch(() => {}); }}
    onMouseLeave={(e) => { const v = e.currentTarget.querySelector('video'); if (v) { v.pause(); v.currentTime = 0; } }}
    style={{ padding: 0, border: '2px solid #f59e0b', borderRadius: 6, background: 'none', cursor: 'pointer', position: 'relative', width: '100%', display: 'block', overflow: 'hidden' }}>
    <video src={`${video}#t=0,${GIAY}`} poster={anh ?? undefined} muted playsInline preload="metadata" style={{ ...KHUNG, borderRadius: 0 }}
      onTimeUpdate={(e) => { const v = e.currentTarget; if (v.currentTime >= GIAY) { v.currentTime = 0; void v.play().catch(() => {}); } }}
      onEnded={(e) => { const v = e.currentTarget; v.currentTime = 0; void v.play().catch(() => {}); }} />
    <span style={{ position: 'absolute', top: 3, left: 3, padding: '1px 5px', borderRadius: 4, background: '#f59e0b', color: '#111', fontSize: 10.5, fontWeight: 700 }}>3s đầu</span>
    <span style={{ position: 'absolute', bottom: 3, right: 3, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,.65)', color: '#fff', fontSize: 10.5 }}>▶ cả video</span>
  </button>;
}
