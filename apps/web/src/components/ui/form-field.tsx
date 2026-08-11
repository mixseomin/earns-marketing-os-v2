'use client';

// FormField — shared form primitive replacing 31 ad-hoc `const fld` declarations
// scattered across modals/pages. Provides:
//   1. Label (uppercase mono + optional required mark + tooltip)
//   2. Input slot (children) with standardized field styling via fieldStyle()
//   3. Hint line (info) or Error line (red) or LockNote line (mutually exclusive)
//
// Use child variants for common cases:
//   <TextField label="Name" value={v} onChange={...} />
//   <SelectField label="Status">{...options}</SelectField>
//   <TextAreaField label="Notes" rows={3} value={...} />
//   <DateTimeField label="Posted at" value={...} onChange={...} />
//
// For non-trivial input markup, wrap manually:
//   <FormField label="..." hint="...">
//     <input style={fieldStyle()} ... />
//   </FormField>
//
// Sizes: sm (4px 6px), md (6px 9px, default), lg (8px 10px).
// Variant: 'default' | 'mono' (monospace + slightly smaller text)

import type { CSSProperties, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { IconLock, IconPencil } from './icons';
import { InfoHint } from './info-hint';

export type FieldSize = 'sm' | 'md' | 'lg';

export function fieldStyle(opts?: {
  size?: FieldSize;
  disabled?: boolean;
  invalid?: boolean;
  mono?: boolean;
}): CSSProperties {
  const size = opts?.size ?? 'md';
  const padding =
    size === 'sm' ? '4px 6px' :
    size === 'lg' ? '8px 10px' : '6px 9px';
  const fontSize = size === 'sm' ? 11.5 : size === 'lg' ? 13 : 12;
  return {
    width: '100%',
    padding,
    background: opts?.disabled ? 'var(--bg-1)' : 'var(--bg-2)',
    border: `1px solid ${opts?.invalid ? 'var(--bad)' : 'var(--line)'}`,
    borderRadius: 5,
    color: opts?.disabled ? 'var(--fg-3)' : 'var(--fg-0)',
    fontSize,
    fontFamily: opts?.mono ? 'var(--font-mono)' : undefined,
    outline: 'none',
    cursor: opts?.disabled ? 'not-allowed' : undefined,
    opacity: opts?.disabled ? 0.7 : 1,
  };
}

// display:flex sẵn — nhãn thường phải chứa thêm icon info / khoá / badge; để 'block'
// thì mỗi chỗ lại {...lbl, display:'flex'} (đã lặp 9 nơi). Flex vẫn là block-level box.
export const labelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--fg-3)',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 4,
  fontWeight: 700,
};

export interface FormFieldProps {
  label?: ReactNode;
  /** Visual `*` next to label */
  required?: boolean;
  /** Tooltip on label */
  labelTooltip?: string;
  /** Subtle note under input (gray, italic) */
  hint?: ReactNode;
  /** Error message under input (red) - takes priority over hint */
  error?: ReactNode;
  /** Lock reason (when input is disabled because of policy) - takes priority over hint, NOT over error */
  lockReason?: string;
  /** Suggestion to fill (when empty but soon-to-be locked) */
  fillNote?: string;
  /** Column span hint (CSS gridColumn). Default: not set. */
  gridColumn?: string;
  /** Extra style on the wrapping div */
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Generic wrapper. Pass any input/select/textarea inside.
 * Note: input itself should use `fieldStyle({...})` for consistent look.
 */
export function FormField({
  label, required, labelTooltip, hint, error, lockReason, fillNote,
  gridColumn, style, children,
}: FormFieldProps) {
  // YDNI: giải thích dài KHÔNG nằm trên bề mặt. hint -> icon info cạnh label (hover
  // 0ms mới hiện); khoá / gợi-ý-điền GIỮ icon (lock, pencil = trạng thái phải thấy)
  // nhưng lời giải thích vào tooltip. Chỉ `error` còn in thành dòng — lỗi phải đọc
  // được ngay. Sửa ở đây = 37 field khắp modal/drawer im cùng lúc, không vá từng chỗ.
  const badges = (
    <>
      {hint && <InfoHint size={11}>{hint}</InfoHint>}
      {lockReason && (
        <span title={lockReason} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help', color: 'var(--fg-4)' }}>
          <IconLock size={10} />
        </span>
      )}
      {fillNote && (
        <span title={fillNote} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help', color: 'var(--warn)' }}>
          <IconPencil size={10} />
        </span>
      )}
    </>
  );
  return (
    <div data-comp="ui.FormField" style={{ ...(gridColumn ? { gridColumn } : {}), ...style }}>
      {label ? (
        <label title={labelTooltip} style={{ ...labelStyle, cursor: labelTooltip ? 'help' : undefined }}>
          <span>
            {label}
            {required && <span style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
          </span>
          {badges}
        </label>
      ) : (hint || lockReason || fillNote) ? (
        // Không có label -> không có chỗ neo icon: đặt ngay trên input, vẫn 1 hàng icon.
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>{badges}</div>
      ) : null}
      {children}
      {error && <div style={noteStyle('var(--bad)')}>⚠ {error}</div>}
    </div>
  );
}

function noteStyle(color: string): CSSProperties {
  return {
    marginTop: 3,
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    color,
    fontStyle: color === 'var(--fg-4)' ? 'italic' : undefined,
  };
}

// ── Typed input variants ──────────────────────────────────────────────

type CommonFieldProps = Omit<FormFieldProps, 'children'> & { size?: FieldSize; invalid?: boolean; mono?: boolean };

export interface TextFieldProps extends CommonFieldProps,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {}

export function TextField({
  label, required, labelTooltip, hint, error, lockReason, fillNote,
  gridColumn, size, invalid, mono, style, ...inputProps
}: TextFieldProps) {
  const fs = fieldStyle({ size, disabled: inputProps.disabled, invalid: invalid || !!error, mono });
  return (
    <FormField label={label} required={required} labelTooltip={labelTooltip}
               hint={hint} error={error} lockReason={lockReason} fillNote={fillNote}
               gridColumn={gridColumn}>
      <input {...inputProps} style={{ ...fs, ...style }} />
    </FormField>
  );
}

export interface SelectFieldProps extends CommonFieldProps,
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  children: ReactNode;   // <option>s or <optgroup>s
}

export function SelectField({
  label, required, labelTooltip, hint, error, lockReason, fillNote,
  gridColumn, size, invalid, mono, style, children, ...selectProps
}: SelectFieldProps) {
  const fs = fieldStyle({ size, disabled: selectProps.disabled, invalid: invalid || !!error, mono });
  return (
    <FormField label={label} required={required} labelTooltip={labelTooltip}
               hint={hint} error={error} lockReason={lockReason} fillNote={fillNote}
               gridColumn={gridColumn}>
      <select {...selectProps} style={{ ...fs, ...style }}>{children}</select>
    </FormField>
  );
}

export interface TextAreaFieldProps extends CommonFieldProps,
  TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function TextAreaField({
  label, required, labelTooltip, hint, error, lockReason, fillNote,
  gridColumn, size, invalid, mono, style, ...textareaProps
}: TextAreaFieldProps) {
  const fs = fieldStyle({ size, disabled: textareaProps.disabled, invalid: invalid || !!error, mono });
  return (
    <FormField label={label} required={required} labelTooltip={labelTooltip}
               hint={hint} error={error} lockReason={lockReason} fillNote={fillNote}
               gridColumn={gridColumn}>
      <textarea {...textareaProps}
                style={{ ...fs, resize: 'vertical', minHeight: 60, ...style }} />
    </FormField>
  );
}

/**
 * Datetime-local input (HTML5 standard). Pass value as 'YYYY-MM-DDTHH:mm'.
 * Use helper {@link toDatetimeLocal} to convert Date/ISO → input value.
 */
export function DateTimeField(props: TextFieldProps) {
  return <TextField type="datetime-local" {...props} />;
}

/**
 * Date Date|string|null → 'YYYY-MM-DDTHH:mm' (local timezone) for datetime-local input.
 * Returns '' for null/invalid.
 */
export function toDatetimeLocal(v: Date | string | null | undefined): string {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}
