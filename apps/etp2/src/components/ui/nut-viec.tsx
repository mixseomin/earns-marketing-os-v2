'use client';
// NÚT VIỆC CÓ TRẠNG THÁI — cơ chế dùng chung cho mọi nút gọi máy chủ (skill YDNI "BẤM LÀ CÓ DẤU HIỆU ĐÃ NHẬN", anh 03/11/2026):
// khung hình kế tiếp sau click đã đổi sang "⏳ <việc>…" + khoá bấm đôi; xong hiện ✓ + câu máy chủ trả ngay dưới nút; lỗi hiện chữ đỏ đủ câu máy chủ nói.
// `lam` trả chuỗi báo kết quả (hoặc ném Error với câu lỗi). Không viết tay setDang lẻ từng chỗ nữa — dùng cái này.
import { useState } from 'react';

export function NutViec({ nhan, giai, lam, nguy = false }: {
  /** chữ trên nút */ nhan: string;
  /** rê chuột: bấm xong ra sao */ giai: string;
  /** việc chạy khi bấm — trả câu báo kết quả */ lam: () => Promise<string>;
  /** việc khó đảo (bỏ, xoá…) — viền đỏ */ nguy?: boolean;
}) {
  const [tt, setTt] = useState<{ k: 'cho' | 'dang' | 'xong' | 'loi'; chu?: string }>({ k: 'cho' });
  return (
    <span data-comp="ui.NutViec" style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <button type="button" title={giai} disabled={tt.k === 'dang'}
        onClick={async (e) => { e.stopPropagation(); setTt({ k: 'dang' }); try { setTt({ k: 'xong', chu: await lam() }); } catch (er) { setTt({ k: 'loi', chu: (er as Error).message }); } }}
        style={{ border: `1px solid ${nguy ? 'var(--danger, #dc2626)' : 'var(--line)'}`, borderRadius: 6, padding: '2px 8px', fontSize: 12, cursor: tt.k === 'dang' ? 'wait' : 'pointer',
          background: 'var(--bg-2)', color: nguy ? 'var(--danger, #dc2626)' : 'inherit' }}>
        {tt.k === 'dang' ? `⏳ ${nhan}…` : nhan}
      </button>
      {tt.chu && <span style={{ fontSize: 11, color: tt.k === 'loi' ? 'var(--danger, #dc2626)' : 'var(--ok, #16a34a)', maxWidth: 280 }}>{tt.k === 'xong' ? '✓ ' : ''}{tt.chu}</span>}
    </span>
  );
}
