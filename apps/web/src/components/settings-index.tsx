'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCopyToClipboard } from '@/lib/use-copy-clipboard';

export function SettingsIndex({ extKey }: { extKey: string }) {
  const [revealed, setRevealed] = useState(false);
  const { copied, copy: doCopy } = useCopyToClipboard();

  const masked = extKey ? `${extKey.slice(0, 6)}${'•'.repeat(Math.max(0, extKey.length - 10))}${extKey.slice(-4)}` : '';

  const copy = () => { if (extKey) void doCopy(extKey); };

  return (
    <div className="page" style={{ padding: 16, maxWidth: 980 }}>
      <div className="page-head">
        <h1 className="page-title">⚙ Settings</h1>
        <p className="page-sub">Admin-only configuration. Sub-pages for specific areas.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Extension Key */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">
              ⚓ MOS2 Crew Extension
              <small>// API key cho Chrome extension</small>
            </div>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
            {!extKey ? (
              <div style={{ fontSize: 12, color: 'var(--bad)', fontStyle: 'italic' }}>
                ⚠ <code>MOS2_EXT_KEY</code> chưa set trong <code>/opt/earns-marketing-os-v2/.env.production</code>.
                SSH vào server, thêm <code>MOS2_EXT_KEY=$(openssl rand -hex 32)</code> rồi <code>systemctl restart mos2-web</code>.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                  Paste key này vào popup của extension <strong>MOS2 Crew</strong> (field <em>API Key</em>) →
                  <strong>Save</strong>. Token chỉ lưu local trong storage của extension, không gửi đi đâu khác.
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 4,
                  padding: '6px 10px',
                }}>
                  <code style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {revealed ? extKey : masked}
                  </code>
                  <button type="button" onClick={() => setRevealed((v) => !v)}
                    style={{
                      fontSize: 11, padding: '3px 8px', background: 'var(--bg-3)',
                      border: '1px solid var(--line)', borderRadius: 3, color: 'var(--fg-2)', cursor: 'pointer',
                    }}>
                    {revealed ? '🙈 hide' : '👁 show'}
                  </button>
                  <button type="button" onClick={copy}
                    style={{
                      fontSize: 11, padding: '3px 10px', fontWeight: 600,
                      background: copied ? 'var(--ok-soft)' : 'var(--accent)',
                      color: copied ? 'var(--ok)' : '#0d1117',
                      border: 'none', borderRadius: 3, cursor: 'pointer',
                    }}>
                    {copied ? '✓ copied' : '📋 copy'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--fg-2)' }}>Setup steps:</strong>
                  <ol style={{ margin: '4px 0 0 18px', padding: 0 }}>
                    <li>Chrome → Extensions → Load unpacked → chọn <code>earns-dashboard/public/extensions/mos2-crew/</code></li>
                    <li>Click icon ⚓ trên toolbar → popup hiện</li>
                    <li>Server URL: <code>https://mos2.on.tc</code></li>
                    <li>API Key: paste key ở trên → Save</li>
                    <li>Project picker hiện ra → chọn project active → Done</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Other settings links */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">🔑 Other</div>
          </div>
          <div className="panel-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/settings/api" style={{ color: 'var(--accent)', fontSize: 12, textDecoration: 'none' }}>
              → AI Provider API keys (OpenAI, Anthropic, etc.)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
