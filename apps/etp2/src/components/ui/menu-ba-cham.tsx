'use client';
// MENU "⋯" DÙNG CHUNG cho dòng bảng (tách từ SiteMenu bảng Website, 02/11/2026 — Kênh nội dung dùng cùng): nhóm mục, mục là link (trong / ngoài) hoặc nút,
// tuỳ chọn khối chèn dưới tiêu đề (vd lịch nhỏ). Neo + portal + bấm ngoài đóng + lật ở mép màn = primitive nhà AnchoredPopover (@mos2/bang), KHÔNG tự dựng.
// YDNI: mỗi mục MỘT dòng (không xuống hàng) — menu nở theo mục dài nhất.
import { useEffect, useRef, useState } from 'react';
import { wrapExternalUrl } from '@/lib/external-url';
import { AnchoredPopover } from './anchored-popover';

export type MucMenu = { label: string; emoji: string; href?: string; external?: boolean; onClick?: () => void };
export type NhomMenu = { label: string; items: MucMenu[] };

export function MenuBaCham({ tieuDe, phu, groups, title, chen }: { tieuDe: string; phu: string; groups: NhomMenu[]; title?: string; /** khối chèn dưới tiêu đề (vd lịch kế hoạch nhỏ của kênh) */ chen?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    padding: '5px 10px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)',
    textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, whiteSpace: 'nowrap',
  };

  return (
    <>
      <button ref={btnRef} type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title={title ?? tieuDe}
        style={{ marginLeft: 8, padding: '1px 6px', fontSize: 13, lineHeight: 1, color: open ? 'var(--fg-1)' : 'var(--fg-3)',
          background: open ? 'var(--bg-3)' : 'transparent', border: '1px solid var(--line)', borderRadius: 5, cursor: 'pointer' }}>
        ⋯
      </button>
      <AnchoredPopover anchorRef={btnRef} open={open} onClose={() => setOpen(false)} zIndex={1000}>
        <div style={{ minWidth: 218, maxWidth: 420, width: 'max-content', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)', padding: 4 }}>
          <div style={{ padding: '4px 10px 5px', marginBottom: 2, borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{tieuDe}</div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phu}</div>
          </div>
          {chen && <div style={{ padding: '6px 8px 4px', borderBottom: '1px solid var(--line)' }}>{chen}</div>}
          {groups.map((g) => (
            <div key={g.label}>
              <div style={{ padding: '6px 10px 2px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{g.label}</div>
              {g.items.map((it) => it.href ? (
                <a key={it.label} href={it.external ? wrapExternalUrl(it.href) : it.href}
                  {...(it.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  onClick={() => setOpen(false)}
                  style={itemStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                  <span>{it.emoji}</span><span>{it.label}</span>
                  {it.external && <span style={{ marginLeft: 'auto', color: 'var(--fg-3)', fontSize: 10 }}>↗</span>}
                </a>
              ) : (
                <button key={it.label} type="button" onClick={() => { setOpen(false); it.onClick?.(); }} style={itemStyle}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}>
                  <span>{it.emoji}</span><span>{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </AnchoredPopover>
    </>
  );
}
