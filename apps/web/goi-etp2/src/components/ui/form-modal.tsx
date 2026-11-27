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

import { type ReactNode, type CSSProperties } from 'react';
import { ModalHeader, type ModalKind } from './modal-header';
import { Drawer } from './drawer';

type ActionKind = 'edit' | 'create' | 'view';

export type ModalWidth = 'sm' | 'md' | 'lg' | 'xl' | number;

// Was centered-modal widths; now drawer panel widths (px, caps at 96vw in Drawer).
const WIDTH_PX: Record<Exclude<ModalWidth, number>, number> = {
  sm: 480, md: 760, lg: 1100, xl: 1480,
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
  /** Form has UNSAVED edits → outside/ESC asks an inline discard-confirm instead of closing.
   * The house standard (close-unless-dirty). Prefer this over blanket preventBackdropClose. */
  dirty?: boolean;
  /** Extra style on the modal frame (rare — prefer width prop) */
  modalStyle?: CSSProperties;
  /** Extra style on the body wrapper */
  bodyStyle?: CSSProperties;
  /** Body padding. Default 0 (children control). */
  bodyPadding?: string | number;
  /** Z-index override. Default 1000. */
  zIndex?: number;
  onClose: () => void;
  /** Optional refresh button cạnh close (ModalHeader lo spin). Cho modal cần reload data. */
  onRefresh?: () => void | Promise<void>;
  children: ReactNode;
}

// Renders as a right-side slide-over Drawer (stackable, resizable, ESC-topmost) —
// converted from centered modal so viewing detail keeps list context and doesn't
// break rhythm. API unchanged; every FormModal consumer flips to a drawer at once.
export function FormModal({
  kind, action, title, idText, subtitle, context, accentColor,
  width = 'md', preventBackdropClose, preventEscClose, dirty,
  modalStyle, bodyStyle, bodyPadding,
  zIndex, onClose, onRefresh, children,
}: FormModalProps) {
  const widthPx = typeof width === 'number' ? width : WIDTH_PX[width];

  return (
    <Drawer
      onClose={onClose}
      width={widthPx}
      zIndex={zIndex ?? 1000}
      closeOnOutside={!preventBackdropClose}
      closeOnEsc={!preventEscClose}
      dirty={dirty}
      padding={0}
      // Panel is a flex column: sticky header + scrollable body. Own scroll lives on the
      // body div, so the panel itself must not also scroll. modalStyle merges last (rare).
      bodyStyle={{ overflowY: 'hidden', display: 'flex', flexDirection: 'column', ...modalStyle }}
    >
      <ModalHeader
        kind={kind}
        action={action}
        title={title}
        idText={idText}
        subtitle={subtitle}
        context={context}
        accentColor={accentColor}
        onClose={onClose}
        onRefresh={onRefresh}
      />
      <div data-comp="ui.FormModal" style={{ padding: bodyPadding ?? 0, overflow: 'auto', flex: 1, ...bodyStyle }}>
        {children}
      </div>
    </Drawer>
  );
}

/**
 * Sticky footer at bottom of FormModal body.
 * Standardized layout: right-aligned buttons with 8px gap.
 * Pass children as <button>s — primary action LAST (rightmost).
 */
export function FormModalFooter({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div data-comp="ui.FormModalFooter" style={{
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
    <div data-comp="ui.FormModalSection" style={{ padding: '14px 16px', ...style }}>{children}</div>
  );
}
