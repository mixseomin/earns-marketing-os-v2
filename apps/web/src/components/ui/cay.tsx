'use client';
// CÂY — MỘT cách vẽ dữ liệu cha → con (anh chốt 01/10/2026: chỗ nào có tầng thì trình bày dạng cây cho logic + nhìn ra ngay).
// <NutCay> lồng nhau là đủ: mỗi tầng con lùi vào một nấc, có đường dẫn dọc + nhánh ngang; nút có `con` mới có ▸/▾.
// Mở/gập do NGƯỜI GỌI giữ (để đưa vào URL nếu cần) — truyền `mo` + `onDoi`; không truyền thì nút luôn mở (tầng chỉ để nhóm).
// Dùng ở: /shop › Sản phẩm (sản phẩm → màu → biến thể), Nhà cung cấp (kênh → NCC; sản phẩm NCC → màu → biến thể → shop dùng; liên kết).
import { createContext, useContext } from 'react';

const Tang = createContext(0);
const phu: React.CSSProperties = { color: 'var(--fg-3)' };

export type NutCayProps = {
  ten: React.ReactNode;
  /** dòng phụ dưới tên (số liệu ngắn) */ phu?: React.ReactNode;
  /** ảnh / biểu tượng trước tên */ dau?: React.ReactNode;
  /** cụm bên phải (pill, nút) — bấm vào đây không mở/gập */ phai?: React.ReactNode;
  mo?: boolean; onDoi?: () => void;
  /** đang chọn (tô nền) */ chon?: boolean; onChon?: () => void;
  /** làm mờ (vd. chưa dùng) */ mo_nhat?: boolean;
  children?: React.ReactNode;
};

export function NutCay({ ten, phu: dongPhu, dau, phai, mo, onDoi, chon, onChon, mo_nhat, children }: NutCayProps) {
  const tang = useContext(Tang);
  const coCon = children !== undefined && children !== null && children !== false;
  const dangMo = coCon && (mo ?? true);
  const bam = onChon ?? (coCon && onDoi ? onDoi : undefined);
  return (
    <div role="treeitem" aria-expanded={coCon ? dangMo : undefined} aria-selected={chon || undefined} style={tang ? undefined : { borderBottom: '1px solid var(--line)' }}>
      <div tabIndex={bam ? 0 : undefined} onClick={bam} onKeyDown={(e) => { if (bam && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); bam(); } }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: tang ? '5px 10px 5px 0' : '9px 12px', cursor: bam ? 'pointer' : undefined,
          background: chon ? 'var(--bg-2)' : undefined, opacity: mo_nhat ? 0.6 : 1, borderRadius: 4 }}>
        {tang > 0 && <span aria-hidden style={{ width: 12, height: 1, background: 'var(--line)', flex: 'none' }} />}
        <span aria-hidden onClick={coCon && onDoi && onChon ? (e) => { e.stopPropagation(); onDoi(); } : undefined}
          style={{ width: 12, flex: 'none', fontSize: 11, ...phu, cursor: coCon && onDoi ? 'pointer' : undefined }}>{coCon && onDoi ? (dangMo ? '▾' : '▸') : ''}</span>
        {dau}
        <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>{ten}</div>
          {dongPhu && <div style={{ fontSize: 12, ...phu, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{dongPhu}</div>}
        </div>
        {phai && <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{phai}</div>}
      </div>
      {dangMo && (
        <div role="group" style={{ marginLeft: tang ? 26 : 18, borderLeft: '1px solid var(--line)', marginBottom: tang ? 0 : 6 }}>
          <Tang.Provider value={tang + 1}>{children}</Tang.Provider>
        </div>
      )}
    </div>
  );
}

/** Khung ngoài của một cây (gốc). Mỗi nút gốc cách nhau một đường kẻ. */
export function Cay({ children, label }: { children: React.ReactNode; label: string }) {
  return <div role="tree" aria-label={label} style={{ display: 'grid' }}>{children}</div>;
}

/** Bảng đặt làm LÁ của cây (các cột thẳng hàng giữa nhiều dòng cùng tầng). */
export function LaBang({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '2px 10px 6px 12px', overflowX: 'auto' }}>{children}</div>;
}
