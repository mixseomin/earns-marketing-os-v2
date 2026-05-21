'use client';

// FormModal — full modal shell: backdrop + modal frame + ModalHeader + body.
// Replaces ~85 LOC of boilerplate in each *-modal.tsx file.
//
// Behavior:
//   - Backdrop click → close (UNLESS preventBackdropClose=true to avoid data loss
//     for forms with unsaved edits — see feedback_modal_close_outside.md)
//   - ESC key → close (unless preventEscClose)
//   - Body is scrollable, header sticky
//
// Width presets: 'sm' (480px) | 'md' (760px) | 'lg' (1100px) | 'xl' (1480px) | custom number
//
// Usage:
//   <FormModal kind="account" action="edit" title="@oritapp" idText="#13"
//              width="md" onClose={onClose} preventBackdropClose>
//     <YourFormFields/>
//     <FormModalFooter>
//       <button onClick={onClose}>Huỷ</button>
//       <button className="btn primary" onClick={save}>Lưu</button>
//     </FormModalFooter>
//   </FormModal>

import { useEffect, type ReactNode, type CSSProperties } from 'react';
import { ModalHeader, type ModalKind } from './modal-header';

type ActionKind = 'edit' | 'create' | 'view';

export type ModalWidth = 'sm' | 'md' | 'lg' | 'xl' | number;

const WIDTH_MAP: Record<Exclude<ModalWidth, number>, string> = {
  sm: 'min(480px, 95vw)',
  md: 'min(760px, 95vw)',
  lg: 'min(1100px, 95vw)',
  xl: 'min(1480px, 97vw)',
};

export interface FormModalProps {
  kind: ModalKind;
  action: ActionKind;
  title: ReactNode;
  idText?: string;
  subtitle?: ReactNode;
  context?: ReactNode;
  accentColor?: string;
  width?: ModalWidth;
  /** When true, backdrop click does NOT close (data loss safety for forms with unsaved edits). Default false. */
  preventBackdropClose?: boolean;
  /** When true, ESC does NOT close. Default false. */
  preventEscClose?: boolean;
  /** Extra style on the modal frame (rare — prefer width prop) */
  modalStyle?: CSSProperties;
  /** Extra style on the body wrapper */
  bodyStyle?: CSSProperties;
  /** Body padding. Default 0 (children control). */
  bodyPadding?: string | number;
  /** Z-index override. Default 1000. */
  zIndex?: number;
  onClose: () => void;
  children: ReactNode;
}

export function FormModal({
  kind, action, title, idText, subtitle, context, accentColor,
  width = 'md', preventBackdropClose, preventEscClose,
  modalStyle, bodyStyle, bodyPadding,
  zIndex, onClose, children,
}: FormModalProps) {
  // ESC to close
  useEffect(() => {
    if (preventEscClose) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, preventEscClose]);

  const widthCss = typeof width === 'number' ? `${width}px` : WIDTH_MAP[width];

  return (
    <div className="modal-backdrop"
         style={zIndex ? { zIndex } : undefined}
         onClick={(e) => {
           if (preventBackdropClose) return;
           if (e.target === e.currentTarget) onClose();
         }}>
      <div className="modal"
           style={{ width: widthCss, maxWidth: typeof width === 'number' ? width : undefined, ...modalStyle }}
           onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          kind={kind}
          action={action}
          title={title}
          idText={idText}
          subtitle={subtitle}
          context={context}
          accentColor={accentColor}
          onClose={onClose}
        />
        <div style={{
          padding: bodyPadding ?? 0,
          overflow: 'auto',
          flex: 1,
          ...bodyStyle,
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Sticky footer at bottom of FormModal body.
 * Standardized layout: right-aligned buttons with 8px gap.
 * Pass children as <button>s — primary action LAST (rightmost).
 */
export function FormModalFooter({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      padding: '12px 16px',
      borderTop: '1px solid var(--line)',
      background: 'var(--bg-1)',
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end',
      position: 'sticky',
      bottom: 0,
      ...style,
    }}>
      {children}
    </div>
  );
}

/**
 * Body section with consistent padding. Use as `<FormModalSection>` for typical forms.
 * For full-bleed content, set bodyPadding={0} on FormModal and skip this.
 */
export function FormModalSection({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ padding: '14px 16px', ...style }}>{children}</div>
  );
}
