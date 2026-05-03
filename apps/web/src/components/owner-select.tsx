'use client';

// Reusable "Owner" dropdown for entity forms (Account, Proxy, BrowserProfile, Tribe).
// Operator chỉ thấy entity họ owns; admin có thể assign cho bất kỳ active member.

import type { TeamMemberRow } from '@/lib/actions/team';

interface Props {
  members: TeamMemberRow[];
  value: number | null;
  onChange: (userId: number | null) => void;
  fld?: React.CSSProperties;
  /** Show only active members in dropdown. Default true. */
  activeOnly?: boolean;
}

export function OwnerSelect({ members, value, onChange, fld, activeOnly = true }: Props) {
  const visible = members.filter((m) => !activeOnly || m.active);
  const owner = members.find((m) => m.userId === value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        title="Assign cho member quản lý — có thể revoke khi hết plan/project"
        style={fld ?? {
          flex: 1, padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)',
          borderRadius: 5, color: 'var(--fg-0)', fontSize: 13, outline: 'none',
        }}
      >
        <option value="">◌ Chưa assign (chỉ admin thấy)</option>
        {visible.map((m) => (
          <option key={m.userId} value={m.userId}>
            👤 {m.displayName} · {m.specialty}
          </option>
        ))}
      </select>
      {owner && (
        <span style={{
          padding: '2px 6px', fontSize: 9, fontFamily: 'var(--font-mono)',
          background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 3,
          whiteSpace: 'nowrap',
        }}>
          {owner.email}
        </span>
      )}
    </div>
  );
}
