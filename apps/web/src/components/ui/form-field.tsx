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

export const labelStyle: CSSProperties = {
  display: 'block',
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
  return (
    <div style={{ ...(gridColumn ? { gridColumn } : {}), ...style }}>
      {label && (
        <label title={labelTooltip} style={{ ...labelStyle, cursor: labelTooltip ? 'help' : undefined }}>
          {label}
          {required && <span style={{ color: 'var(--bad)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div style={noteStyle('var(--bad)')}>⚠ {error}</div>
      ) : lockReason ? (
        <div style={{ ...noteStyle('var(--fg-4)'), display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconLock size={10} /> {lockReason}
        </div>
      ) : fillNote ? (
        <div style={{ ...noteStyle('var(--warn)'), display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconPencil size={10} /> {fillNote}
        </div>
      ) : hint ? (
        <div style={noteStyle('var(--fg-4)')}>{hint}</div>
      ) : null}
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
