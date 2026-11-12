'use client';
// LỖI TRANG KÊU TO (etp2 #1562 anh 12/11/2026): trước đây một lỗi JS trong trang → Next thay cả màn bằng câu tiếng Anh "Application error… see the browser console"
// — trên điện thoại không có console, anh chỉ thấy màn đen, con không biết lỗi gì. Khung này giữ nút Góp ý (nằm ở layout), in nguyên câu lỗi + vài dòng vết
// để ảnh chụp góp ý mang theo, và cho thử lại ngay không cần tải lại.
import { useEffect } from 'react';

export default function LoiTrang({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[etp2] lỗi trang', error); }, [error]);
  const vet = (error.stack ?? '').split('\n').slice(0, 6).join('\n');
  const nut: React.CSSProperties = { fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit', cursor: 'pointer' };
  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '40px auto', color: 'var(--fg-1)' }}>
      <div style={{ border: '1px solid #f87171', background: 'rgba(248,113,113,.1)', borderRadius: 10, padding: 14 }}>
        <b style={{ color: '#f87171', fontSize: 15 }}>Trang ETP2 gặp lỗi — bấm Góp ý chụp màn này gửi Huy</b>
        <div style={{ marginTop: 8, fontSize: 13, wordBreak: 'break-word' }}>{error.message || String(error)}{error.digest ? ` · mã ${error.digest}` : ''}</div>
        {vet ? <pre style={{ marginTop: 8, fontSize: 10.5, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 160, overflow: 'auto' }}>{vet}</pre> : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" style={nut} onClick={() => reset()}>Thử lại</button>
          <button type="button" style={nut} onClick={() => location.reload()}>Tải lại trang</button>
        </div>
      </div>
    </div>
  );
}
