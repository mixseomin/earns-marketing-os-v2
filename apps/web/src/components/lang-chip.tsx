'use client';

// LangChip — chip ngôn ngữ chung cho mọi nơi cần hiển thị habitat/post/...
// language. Pattern: 🇪🇸 [ES] Español. Khi đổi giao diện chip này → sửa 1 chỗ,
// MỌI nơi cập nhật. KHÔNG được redefine inline ở các component khác.
//
// 3 modes:
//   - 'static':   read-only display (vd chip trong list / header tooltip)
//   - 'button':   click → callback (vd mở habitat modal sửa, route đi đâu đó)
//   - 'select':   inline editor — dropdown đổi value tại chỗ (langs[] required)
//
// Khi cần dùng:
//   <LangChip mode="button" code="es" onClick={() => openHabitatModal()} />
//   <LangChip mode="select" code={form.language} onChange={(v) => setF('language', v)}
//             langs={LANGUAGES} />
//   <LangChip mode="static" code="es" size="sm" />

import type { CSSProperties, ReactNode } from 'react';
import { getLangMeta, langTooltip } from '@/lib/lang-meta';

interface BaseProps {
  /** ISO code (en/vi/es/...) hoặc '' nếu chưa biết. */
  code: string | null | undefined;
  /** sm = compact (font 10), md = default (font 11). */
  size?: 'sm' | 'md';
  /** Custom tooltip override — mặc định dùng langTooltip(code). */
  title?: string;
  /** Variant màu nền:
   *  - 'ok' (default): empty=warn vàng, có code=ok xanh
   *  - 'neutral': bg-2 mọi case (cho header tối)
   *  - 'accent': accent-soft (cho action context) */
  variant?: 'ok' | 'neutral' | 'accent';
}

interface StaticProps extends BaseProps { mode: 'static'; }
interface ButtonProps extends BaseProps {
  mode: 'button';
  onClick: () => void;
  ariaLabel?: string;
}
interface SelectProps extends BaseProps {
  mode: 'select';
  onChange: (newCode: string) => void;
  /** Danh sách codes cho dropdown (vd LANGUAGES const). */
  langs: readonly string[];
  /** Disabled state (loading / busy). */
  disabled?: boolean;
}

export type LangChipProps = StaticProps | ButtonProps | SelectProps;

const SIZE_STYLE: Record<NonNullable<BaseProps['size']>, {
  padX: number; padY: number; font: number; flagSize: number; codeFont: number; gap: number;
}> = {
  sm: { padX: 6, padY: 1, font: 10,   flagSize: 11, codeFont: 9,  gap: 4 },
  md: { padX: 8, padY: 2, font: 11,   flagSize: 13, codeFont: 10, gap: 5 },
};

export function LangChip(props: LangChipProps) {
  const { code, size = 'md', variant = 'ok' } = props;
  const m = getLangMeta(code);
  const isSet = !!(code && code.trim());
  const codeText = (code ?? '').toUpperCase();
  const sz = SIZE_STYLE[size];

  const { bg, fg, border, codeBg } = (() => {
    if (variant === 'neutral') return {
      bg: 'var(--bg-2)', fg: 'var(--fg-2)', border: 'var(--line)',
      codeBg: 'var(--bg-1)',
    };
    if (variant === 'accent') return {
      bg: 'var(--accent-soft)', fg: 'var(--accent)', border: 'var(--accent-line)',
      codeBg: 'var(--bg-1)',
    };
    // 'ok' default
    return isSet
      ? { bg: 'rgba(74,222,128,.12)', fg: 'var(--ok)', border: 'rgba(74,222,128,.4)', codeBg: 'rgba(74,222,128,.2)' }
      : { bg: 'rgba(251,191,36,.15)', fg: 'var(--warn)', border: 'rgba(251,191,36,.5)', codeBg: 'rgba(251,191,36,.2)' };
  })();

  const baseStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: sz.gap,
    padding: `${sz.padY}px ${sz.padX}px`, fontSize: sz.font, fontWeight: 700,
    color: fg, background: bg, border: `1px solid ${border}`,
    borderRadius: 4, letterSpacing: '.02em',
  };

  const tooltip = props.title ?? langTooltip(code);

  const innerContent: ReactNode = (
    <>
      <span style={{ fontSize: sz.flagSize, lineHeight: 1 }}>{m.flag}</span>
      {isSet && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: sz.codeFont,
                       padding: '0 4px', borderRadius: 2,
                       background: codeBg, letterSpacing: '.04em' }}>
          {codeText}
        </span>
      )}
      <span style={{ fontWeight: 600 }}>{m.label}</span>
    </>
  );

  if (props.mode === 'static') {
    return <span style={baseStyle} title={tooltip}>{innerContent}</span>;
  }

  if (props.mode === 'button') {
    return (
      <button type="button" onClick={props.onClick} title={tooltip}
              aria-label={props.ariaLabel ?? `Language: ${m.label}`}
              style={{ ...baseStyle, cursor: 'pointer' }}>
        {innerContent}
      </button>
    );
  }

  // mode === 'select': overlay layout — native <select> giữ click + dropdown
  // popup; overlay <span> hiển thị flag + code + label custom (browser ko
  // cho style option khi collapsed).
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span style={{ ...baseStyle, position: 'absolute', inset: 0,
                     padding: `0 ${sz.padX + 12}px 0 ${sz.padX}px`,
                     pointerEvents: 'none', zIndex: 1, border: 'none' }}>
        {innerContent}
      </span>
      <select value={code ?? ''}
              onChange={(e) => props.onChange(e.target.value)}
              disabled={props.disabled}
              title={tooltip}
              style={{
                appearance: 'none', WebkitAppearance: 'none',
                padding: `${sz.padY + 1}px ${sz.padX + 12}px ${sz.padY + 1}px ${sz.padX}px`,
                fontSize: sz.font, fontWeight: 700, fontFamily: 'var(--font-sans)',
                letterSpacing: '.01em',
                background: bg, color: 'transparent',
                border: `1px solid ${border}`, borderRadius: 4,
                cursor: props.disabled ? 'wait' : 'pointer',
                minWidth: 150,
              }}>
        {props.langs.map((l) => {
          const opt = getLangMeta(l);
          return (
            <option key={l} value={l} style={{ color: 'var(--fg-0)' }}>
              {opt.flag} {l ? `${l.toUpperCase()} · ` : ''}{opt.label}
            </option>
          );
        })}
      </select>
      <span style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
                     fontSize: 8, color: fg, pointerEvents: 'none', zIndex: 2 }}>▾</span>
    </span>
  );
}
