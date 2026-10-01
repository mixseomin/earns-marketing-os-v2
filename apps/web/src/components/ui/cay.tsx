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

/** Bảng đặt làm LÁ của cây. Một cây thường có NHIỀU bảng lá (mỗi màu một bảng) — để các cột THẲNG HÀNG giữa các bảng, mọi bảng lá dùng
 *  cùng một bộ cột có độ rộng cố định (table-layout: fixed + colgroup). Cột không ghi `rong` chia phần còn lại. Ô tràn thì cắt "…", đủ chữ ở title.
 *  children = các <tbody>/<tr> của bảng. */
export type CotLa = { h: string; rong?: number; phai?: boolean };
export function LaBang({ cot, children }: { cot: CotLa[]; children: React.ReactNode }) {
  const toiThieu = cot.reduce((t, c) => t + (c.rong ?? 160), 0);
  return (
    <div style={{ padding: '2px 10px 6px 12px', overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: toiThieu, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <colgroup>{cot.map((c, i) => <col key={i} style={c.rong ? { width: c.rong } : undefined} />)}</colgroup>
        <thead><tr style={{ color: 'var(--fg-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {cot.map((c, i) => <th key={i} style={{ textAlign: c.phai ? 'right' : 'left', padding: '5px 10px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.h}</th>)}
        </tr></thead>
        {children}
      </table>
    </div>
  );
}
/** Ô của bảng lá — căn theo cột, một dòng, tràn thì "…". */
export const oLa = (phai?: boolean): React.CSSProperties => ({ padding: '5px 10px', textAlign: phai ? 'right' : 'left', fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top' });
