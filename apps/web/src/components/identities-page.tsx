'use client';

// Identities = preset persona/brand/seeding per project, dùng pre-fill form
// tạo account trên platform bất kỳ. UI table + create/edit modal.
// password lưu pgcrypto, reveal just-in-time qua revealIdentityPassword().

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  type IdentityRow, type IdentityInput, type IdentityKind,
  createIdentity, updateIdentity, deleteIdentity, revealIdentityPassword,
} from '@/lib/actions/identities';
import { FormModal, FormModalFooter } from './ui/form-modal';
import { TextField, TextAreaField, SelectField } from './ui/form-field';
import { StatusFlag } from './ui/status-flag';
import { EmptyState } from './ui/empty-state';

type FormState = IdentityInput & { id?: number };

const EMPTY_FORM: FormState = {
  name: '', kind: 'seeding', handleBase: '', email: '', password: '',
  displayName: '', bio: '', avatarUrl: '',
};

export function IdentitiesPage({
  projectId, initial,
}: { projectId: string; initial: IdentityRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [kindFilter, setKindFilter] = useState<'all' | IdentityKind>('all');

  const rows = initial.filter((r) => kindFilter === 'all' || r.kind === kindFilter);

  const openCreate = () => setEditing({ ...EMPTY_FORM });
  const openEdit = (r: IdentityRow) => setEditing({
    id: r.id,
    name: r.name, kind: r.kind, handleBase: r.handleBase, email: r.email,
    password: undefined,                       // undefined = leave alone
    displayName: r.displayName, bio: r.bio, avatarUrl: r.avatarUrl,
    persona: r.persona, customFields: r.customFields,
  });
  const closeModal = () => setEditing(null);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing.id) {
        await updateIdentity(editing.id, editing);
      } else {
        await createIdentity(projectId, editing);
      }
      closeModal();
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setBusy(true);
    try {
      await deleteIdentity(id);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  const counts = {
    all: initial.length,
    brand: initial.filter((r) => r.kind === 'brand').length,
    seeding: initial.filter((r) => r.kind === 'seeding').length,
  };

  return (
    <div className="page" style={{ padding: 16 }}>
      <div className="page-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Identities
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              {initial.length} preset · for project <b>{projectId}</b>
            </span>
          </h1>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-3)' }}>
            Preset persona/brand/seeding để pre-fill form khi tạo account mới trên bất kỳ platform/forum nào (handle, email, password, bio, avatar).
          </div>
        </div>
        <button className="btn primary" onClick={openCreate} disabled={busy}
          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
          + Identity mới
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['all', 'brand', 'seeding'] as const).map((k) => (
          <button key={k}
            onClick={() => setKindFilter(k)}
            style={{
              padding: '4px 10px', fontSize: 11, fontFamily: 'var(--font-mono)',
              background: kindFilter === k ? 'var(--accent-soft)' : 'transparent',
              border: `1px solid ${kindFilter === k ? 'var(--accent)' : 'var(--line)'}`,
              borderRadius: 4, cursor: 'pointer',
              color: kindFilter === k ? 'var(--accent)' : 'var(--fg-2)',
            }}>
            {k.toUpperCase()} <span style={{ opacity: 0.6, marginLeft: 4 }}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="👤"
          title={kindFilter === 'all' ? 'Chưa có identity nào' : `Chưa có identity kind=${kindFilter}`}
          description="Tạo preset để khỏi phải nhập lại handle/email/password mỗi khi đăng ký account mới."
        />
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--fg-3)' }}>
                <th style={th}>Name</th>
                <th style={th}>Kind</th>
                <th style={th}>Handle</th>
                <th style={th}>Email</th>
                <th style={th}>Pwd</th>
                <th style={th}>Display</th>
                <th style={th}>Updated</th>
                <th style={{ ...th, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: 'var(--fg-0)' }}>{r.name}</div>
                    {r.bio && <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.bio}</div>}
                  </td>
                  <td style={td}>
                    <span style={kindChip(r.kind)}>{r.kind.toUpperCase()}</span>
                  </td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>{r.handleBase || '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)' }}>{r.email || '—'}</td>
                  <td style={td}>
                    {r.hasPassword
                      ? <PasswordCell id={r.id} />
                      : <StatusFlag icon="—" tone="info" size="icon" title="Chưa có password" />
                    }
                  </td>
                  <td style={td}>{r.displayName || '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>
                    {new Date(r.updatedAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => openEdit(r)} style={iconBtn} title="Sửa">✎</button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Xoá identity "${r.name}"?`)) remove(r.id);
                      }}
                      style={{ ...iconBtn, color: 'var(--bad)' }} title="Xoá">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <IdentityFormModal
          form={editing}
          setForm={setEditing}
          onClose={closeModal}
          onSave={save}
          busy={busy}
        />
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '6px 10px', textAlign: 'left', fontWeight: 500 };
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top' };
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--line)', borderRadius: 3,
  padding: '2px 6px', fontSize: 11, cursor: 'pointer', marginLeft: 4, color: 'var(--fg-1)',
};

function kindChip(kind: IdentityKind): React.CSSProperties {
  const color = kind === 'brand' ? 'var(--neon-violet)' : 'var(--neon-cyan)';
  return {
    display: 'inline-block', padding: '1px 8px', fontSize: 9, fontFamily: 'var(--font-mono)',
    fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: 3, opacity: 0.85,
  };
}

// PasswordCell — click "👁" reveals password (server decrypt just-in-time).
function PasswordCell({ id }: { id: number }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toggle = async () => {
    if (revealed !== null) { setRevealed(null); return; }
    setLoading(true);
    try { setRevealed(await revealIdentityPassword(id)); }
    finally { setLoading(false); }
  };
  return (
    <button onClick={toggle} disabled={loading}
      style={{ background: 'transparent', border: '1px dashed var(--line)', borderRadius: 3,
        padding: '1px 6px', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
        color: revealed !== null ? 'var(--ok)' : 'var(--fg-2)' }}
      title={revealed !== null ? 'Click ẩn' : 'Click reveal password'}>
      {loading ? '…' : revealed !== null ? revealed : '••••'}
    </button>
  );
}

// Form modal — create/edit. password field empty = leave alone (on edit).
function IdentityFormModal({
  form, setForm, onClose, onSave, busy,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  const isEdit = !!form.id;
  const [showPwd, setShowPwd] = useState(false);

  // Load existing password just-in-time when user clicks "show" on edit.
  useEffect(() => { setShowPwd(false); }, [form.id]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm({ ...form, [k]: v });

  return (
    <FormModal
      kind="account"
      action={isEdit ? 'edit' : 'create'}
      title={form.name || (isEdit ? 'Identity' : 'Identity mới')}
      idText={isEdit ? `#${form.id}` : undefined}
      subtitle={form.kind ?? 'seeding'}
      width="md"
      preventBackdropClose
      onClose={onClose}
    >
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <TextField label="Name (preset label)" required value={form.name ?? ''}
          onChange={(e) => update('name', e.target.value)}
          placeholder="vd: Goodsmart Demo" />
        <SelectField label="Kind" value={form.kind ?? 'seeding'}
          onChange={(e) => update('kind', (e.target.value as IdentityKind))}>
          <option value="seeding">seeding — alt account để seeding</option>
          <option value="brand">brand — official account</option>
        </SelectField>

        <TextField label="Handle base" value={form.handleBase ?? ''}
          onChange={(e) => update('handleBase', e.target.value)}
          placeholder="vd: gsmarter17" mono />
        <TextField label="Display name" value={form.displayName ?? ''}
          onChange={(e) => update('displayName', e.target.value)}
          placeholder="vd: Mia the Astro Enthusiast" />

        <TextField label="Email" value={form.email ?? ''}
          onChange={(e) => update('email', e.target.value)}
          placeholder="goodsmart.demo@gmail.com" mono />

        <PasswordField
          identityId={form.id}
          value={form.password}
          onChange={(v) => update('password', v)}
          show={showPwd}
          setShow={setShowPwd}
          isEdit={isEdit}
        />

        <div style={{ gridColumn: '1 / -1' }}>
          <TextAreaField label="Bio" rows={2} value={form.bio ?? ''}
            onChange={(e) => update('bio', e.target.value)}
            placeholder="Short bio dùng cho profile description ở mọi platform" />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <TextField label="Avatar URL" value={form.avatarUrl ?? ''}
            onChange={(e) => update('avatarUrl', e.target.value)}
            placeholder="https://…/avatar.png" mono />
        </div>
      </div>

      <FormModalFooter>
        <button onClick={onClose} disabled={busy}
          style={{ padding: '6px 12px', fontSize: 12, border: '1px solid var(--line)', background: 'transparent', borderRadius: 4, cursor: 'pointer' }}>
          Huỷ
        </button>
        <button className="btn primary" onClick={onSave} disabled={busy || !(form.name ?? '').trim()}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600 }}>
          {busy ? '…' : isEdit ? 'Lưu' : 'Tạo'}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}

// PasswordField: trên edit, mặc định KHÔNG sửa (undefined). User phải click "Sửa
// password" mới mở input — tránh accidental clear khi save.
function PasswordField({
  identityId, value, onChange, show, setShow, isEdit,
}: {
  identityId?: number;
  value: string | undefined;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (s: boolean) => void;
  isEdit: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const startEditPwd = async () => {
    if (!isEdit || !identityId) { setShow(true); return; }
    setLoading(true);
    try {
      const current = await revealIdentityPassword(identityId);
      onChange(current);
      setShow(true);
    } finally { setLoading(false); }
  };

  if (isEdit && !show) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 500 }}>Password</label>
        <button onClick={startEditPwd} disabled={loading}
          style={{ padding: '6px 10px', fontSize: 11, border: '1px dashed var(--line)', borderRadius: 4, background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--fg-2)' }}>
          {loading ? '…' : '🔒 Click để reveal + sửa password'}
        </button>
      </div>
    );
  }
  return (
    <TextField label="Password" value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isEdit ? 'New password (overwrite)' : 'Plain text - sẽ encrypt khi save'}
      mono />
  );
}
