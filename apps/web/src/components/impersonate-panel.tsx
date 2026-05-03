'use client';

import { useState, useTransition } from 'react';
import { exitImpersonate } from '@/lib/actions/impersonate';
import { saveVisibilityConfig } from '@/lib/actions/visibility';
import type { VisibilityConfig } from '@/lib/visibility';

// NOTE: exitImpersonate and saveVisibilityConfig are server actions imported here as client-callable

interface Props {
  targetUserId: number;
  targetName: string;
  targetRole: string;
  initialConfig: VisibilityConfig;
}

// Toggle row helper
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--fg-1)', padding: '2px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--neon-cyan)', width: 14, height: 14 }} />
      {label}
    </label>
  );
}

export function ImpersonatePanel({ targetUserId, targetName, targetRole, initialConfig }: Props) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'user' | 'role'>('user');
  const [cfg, setCfg] = useState<VisibilityConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [, startExit] = useTransition();

  const setNav = (key: keyof NonNullable<VisibilityConfig['nav']>, v: boolean) =>
    setCfg((c) => ({ ...c, nav: { ...c.nav, [key]: v } }));
  const setRes = (key: keyof NonNullable<VisibilityConfig['resources']>, v: boolean) =>
    setCfg((c) => ({ ...c, resources: { ...c.resources, [key]: v } }));

  const handleSave = async () => {
    setSaving(true);
    await saveVisibilityConfig(targetUserId, cfg, scope);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExit = () => startExit(async () => { await exitImpersonate(); });

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(20,12,40,0.97)', borderBottom: '2px solid var(--neon-violet)',
      padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, height: 44,
      fontFamily: 'var(--font-mono)', fontSize: 12,
    }}>
      <span style={{ color: 'var(--neon-violet)', fontWeight: 700 }}>👁 IMPERSONATE</span>
      <span style={{ color: 'var(--fg-2)' }}>Đang xem với tư cách:</span>
      <span style={{ color: 'var(--neon-cyan)', fontWeight: 600 }}>{targetName}</span>
      <span style={{ color: 'var(--fg-3)', fontSize: 10, background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 4 }}>{targetRole}</span>

      <div style={{ flex: 1 }} />

      <button onClick={() => setOpen((o) => !o)} style={{
        background: open ? 'var(--neon-violet)' : 'var(--bg-2)', border: '1px solid var(--neon-violet)',
        borderRadius: 5, padding: '3px 10px', fontSize: 11, color: open ? '#000' : 'var(--neon-violet)',
        cursor: 'pointer', fontWeight: 600,
      }}>
        Cau hinh hien thi
      </button>

      <button onClick={handleExit} style={{
        background: 'transparent', border: '1px solid var(--line)',
        borderRadius: 5, padding: '3px 10px', fontSize: 11, color: 'var(--fg-2)', cursor: 'pointer',
      }}>
        Thoat
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0,
          background: 'var(--bg-1)', border: '1px solid var(--line-strong)',
          borderRadius: '0 0 0 8px', boxShadow: '0 12px 40px rgba(0,0,0,.8)',
          padding: 16, width: 340, zIndex: 10000,
        }}>
          {/* Scope selector */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>AP DUNG CHO</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['user', 'role'] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)} style={{
                  flex: 1, padding: '5px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
                  border: `1px solid ${scope === s ? 'var(--neon-cyan)' : 'var(--line)'}`,
                  background: scope === s ? 'rgba(0,255,209,0.08)' : 'var(--bg-2)',
                  color: scope === s ? 'var(--neon-cyan)' : 'var(--fg-2)', fontWeight: scope === s ? 700 : 400,
                }}>
                  {s === 'user' ? `User: ${targetName}` : `Role: ${targetRole}`}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation toggles */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>NAVIGATION</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              <Toggle label="Inbox" checked={cfg.nav?.inbox ?? false} onChange={(v) => setNav('inbox', v)} />
              <Toggle label="Command Board" checked={cfg.nav?.board ?? false} onChange={(v) => setNav('board', v)} />
              <Toggle label="Resources" checked={cfg.nav?.resources ?? false} onChange={(v) => setNav('resources', v)} />
            </div>
          </div>

          {/* Resources toggles */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>RESOURCES VAULTS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
              <Toggle label="Accounts" checked={cfg.resources?.accounts ?? false} onChange={(v) => setRes('accounts', v)} />
              <Toggle label="Media" checked={cfg.resources?.media ?? false} onChange={(v) => setRes('media', v)} />
              <Toggle label="Contacts" checked={cfg.resources?.contacts ?? false} onChange={(v) => setRes('contacts', v)} />
              <Toggle label="Infra" checked={cfg.resources?.infra ?? false} onChange={(v) => setRes('infra', v)} />
              <Toggle label="Budget" checked={cfg.resources?.budget ?? false} onChange={(v) => setRes('budget', v)} />
              <Toggle label="Knowledge" checked={cfg.resources?.knowledge ?? false} onChange={(v) => setRes('knowledge', v)} />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} style={{
            width: '100%', padding: '8px', borderRadius: 6, border: 'none',
            background: saved ? 'var(--neon-lime)' : 'var(--neon-cyan)', color: '#000',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}>
            {saving ? 'Dang luu...' : saved ? 'Da luu - user dang cap nhat' : 'Luu cau hinh'}
          </button>
        </div>
      )}
    </div>
  );
}
