'use client';

// ModalHeader — header CHUẨN cho mọi modal: nhận ra NGAY (1) loại modal
// (chip KIND màu riêng + icon), (2) đang LÀM GÌ (pill action), (3) entity
// nào (title to), (4) vì sao (context). Thay cho .modal-head rời rạc.

import type { ReactNode } from 'react';
import {
  IconUser, IconSliders, IconClock, IconList, IconCommunity, IconGear, IconX,
} from './icons';

export type ModalKind =
  | 'account' | 'brief' | 'lanes' | 'pipeline' | 'tribe' | 'schedule' | 'generic';

const KIND_META: Record<ModalKind, { label: string; color: string; Icon: typeof IconUser }> = {
  account:  { label: 'ACCOUNT',  color: '#60a5fa', Icon: IconUser },
  brief:    { label: 'BRIEF',    color: '#7c9cff', Icon: IconSliders },
  lanes:    { label: 'LANES',    color: '#fbbf24', Icon: IconClock },
  schedule: { label: 'LANES',    color: '#fbbf24', Icon: IconClock },
  pipeline: { label: 'PIPELINE', color: '#2dd4bf', Icon: IconList },
  tribe:    { label: 'TRIBE',    color: '#a78bfa', Icon: IconCommunity },
  generic:  { label: 'MODAL',    color: 'var(--fg-3)', Icon: IconGear },
};

type ActionKind = 'edit' | 'create' | 'view';
const ACTION_LABEL: Record<ActionKind, string> = {
  edit: 'ĐANG SỬA', create: 'TẠO MỚI', view: 'XEM',
};

export function ModalHeader({
  kind, action, title, idText, subtitle, context, accentColor, onClose,
}: {
  kind: ModalKind;
  action: ActionKind;
  title: ReactNode;
  idText?: string;             // vd "#14"
  subtitle?: ReactNode;        // platform · habitat …
  context?: ReactNode;         // dòng vàng "vì sao bạn ở đây"
  accentColor?: string;        // override màu (vd theo phase)
  onClose: () => void;
}) {
  const m = KIND_META[kind] ?? KIND_META.generic;
  const c = accentColor ?? m.color;
  return (
    <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px' }}>
        {/* Khối icon màu loại modal — nhận diện tức thì */}
        <div style={{
          flexShrink: 0, width: 38, height: 38, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `color-mix(in srgb, ${c} 18%, transparent)`,
          border: `1px solid color-mix(in srgb, ${c} 55%, transparent)`,
          color: c,
        }}>
          <m.Icon size={20} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              padding: '1px 7px', fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 800,
              letterSpacing: '.08em', borderRadius: 3, color: c,
              background: `color-mix(in srgb, ${c} 16%, transparent)`,
              border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`,
            }}>{m.label}</span>
            <span style={{
              padding: '1px 7px', fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '.06em', borderRadius: 3, color: 'var(--fg-2)',
              background: 'var(--bg-3)', border: '1px solid var(--line)',
            }}>{ACTION_LABEL[action]}</span>
            {idText && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>{idText}</span>
            )}
          </div>
          <h2 style={{ margin: '5px 0 0', fontFamily: 'var(--font-display)', fontSize: 17,
                       fontWeight: 700, lineHeight: 1.25, color: 'var(--fg-0)',
                       overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </h2>
          {subtitle && (
            <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--fg-3)' }}>{subtitle}</div>
          )}
        </div>

        <button onClick={onClose} aria-label="Đóng"
                style={{ flexShrink: 0, appearance: 'none', background: 'var(--bg-3)',
                         border: '1px solid var(--line)', width: 30, height: 30, borderRadius: 7,
                         color: 'var(--fg-1)', cursor: 'pointer', display: 'flex',
                         alignItems: 'center', justifyContent: 'center' }}>
          <IconX size={15} />
        </button>
      </div>

      {context && (
        <div style={{
          padding: '7px 16px', fontSize: 11.5, color: 'var(--fg-1)',
          background: 'rgba(251,191,36,.10)', borderTop: '1px solid rgba(251,191,36,.30)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: 'var(--warn)', fontWeight: 700, flexShrink: 0 }}>▸ Vì sao:</span>
          <span>{context}</span>
        </div>
      )}
    </div>
  );
}
