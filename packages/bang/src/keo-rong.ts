// KÉO MÉP ĐỂ ĐỔI BỀ NGANG CỘT — cùng luật với thư viện bảng chuẩn adfond/packages/ui/src/lib/keo-rong.ts (spy.on.tc web/keo-rong.js là bản chép JS).
// Ba bẫy bản gốc đã dẫm: nghe trên CỬA SỔ (không bắt con trỏ vào tay nắm — kéo nhanh ra ngoài vẫn theo) · Pointer Events (chuột + cảm ứng chung) · kẹp [min, max].
// Thuần — tự kiểm: node_modules/.bin/tsx packages/bang/src/keo-rong.test.mts

/** Bề ngang mới khi kéo được `lech` điểm ảnh. Kẹp trong [min, max]; trần nhỏ hơn sàn thì lấy sàn. */
export function rongMoi(dau: number, lech: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(min, max), Math.max(min, dau + lech)));
}

const kho = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

/** Bề ngang từng cột của một bảng. Hỏng / không có → {}, không bao giờ ném. */
export function docRongCot(khoa: string): Record<string, number> {
  const k = kho(); if (!k) return {};
  try {
    const v: unknown = JSON.parse(k.getItem(khoa) || 'null');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((x): x is [string, number] => typeof x[1] === 'number' && Number.isFinite(x[1]) && x[1] > 0));
  } catch { return {}; }
}
export function ghiRongCot(khoa: string, v: Record<string, number>): void {
  const k = kho(); if (!k) return;
  try { if (!Object.keys(v).length) k.removeItem(khoa); else k.setItem(khoa, JSON.stringify(v)); } catch { /* kho đầy / chặn: cột vẫn giãn trong phiên, chỉ không nhớ */ }
}

/** Bắt đầu một lượt kéo — gọi trong pointerdown của tay nắm. */
export function batDauKeo(e: { clientX: number; preventDefault: () => void }, o: { dau: number; min: number; max: () => number; doi: (v: number) => void; xong: (v: number) => void }): void {
  e.preventDefault();
  const x0 = e.clientX; let cuoi = o.dau;
  const buoc = (ev: PointerEvent) => { cuoi = rongMoi(o.dau, ev.clientX - x0, o.min, o.max()); o.doi(cuoi); };
  const tha = () => {
    window.removeEventListener('pointermove', buoc); window.removeEventListener('pointerup', tha); window.removeEventListener('pointercancel', tha);
    document.body.style.userSelect = ''; o.xong(cuoi);
  };
  document.body.style.userSelect = 'none';
  window.addEventListener('pointermove', buoc); window.addEventListener('pointerup', tha); window.addEventListener('pointercancel', tha);
}
