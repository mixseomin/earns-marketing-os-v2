'use client';

// SendAsPicker — "comment/DM as" identity chooser. Thin wrapper over the house <EntityPicker> primitive:
// maps send-as options ⇄ EntityOption + wires create / adopt-from-Directus / rich edit. Both CREATE and EDIT
// open the SAME stacked detail Drawer (SendAsDetailDrawer) with all fields — never a bare inline handle box.
// Delete lives in that drawer (confirm), so the picker list shows no inline ✕.
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { EntityPicker, Drawer, ConfirmDeleteButton, type EntityOption } from '@/components/ui';
import {
  listSendAs, adoptSendAsFromDirectus,
  getSendAsAccount, createSendAsAccount, updateSendAsAccount, deleteSendAsAccount,
  type SendAsOption, type SentAs,
} from '@/lib/actions/outreach-touches';

const fmtK = (n?: number): string => n == null ? '' : n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
const shortUrl = (u?: string): string => (u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const keyOf = (o: SendAsOption): string => o.directusId ? 'dx:' + o.directusId : `${o.kind}:${o.id}`;

const toOption = (o: SendAsOption): EntityOption => ({
  key: keyOf(o),
  label: o.label,
  sub: [o.followers ? `${fmtK(o.followers)} followers` : '', o.url ? shortUrl(o.url) : ''].filter(Boolean).join(' · ') || o.sub,
  avatar: o.avatar,
  fallbackIcon: o.kind === 'identity' ? '👤' : '•',
  badge: o.directusId ? '⬇ Directus' : undefined,
  badgeTitle: o.directusId ? 'Có trong Directus — chọn để nhập vào MOS2' : undefined,
  match: o.match,
  editable: o.editable,          // only global MOS2 accounts (project_id null) → editable
  data: o,
});

const lbl: CSSProperties = { display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-3)', marginBottom: 4 };
const inp: CSSProperties = { width: '100%', padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12, outline: 'none' };
type Fields = { id: number; handle: string; displayName: string; fbUrl: string; followers: string; status: string; platformKey: string };
const EMPTY: Fields = { id: 0, handle: '', displayName: '', fbUrl: '', followers: '', status: 'active', platformKey: '' };

// One rich Drawer for BOTH create (accountId null → empty form) and edit (load fields). Delete only in edit.
function SendAsDetailDrawer({ projectId, channel, accountId, onClose }: { projectId: string; channel: string; accountId: number | null; onClose: () => void }) {
  const isCreate = accountId == null;
  const [f, setF] = useState<Fields | null>(isCreate ? { ...EMPTY } : null);
  const [loading, setLoading] = useState(!isCreate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (accountId == null) return;   // create mode → empty form, nothing to load
    let live = true;
    getSendAsAccount(accountId).then((a) => { if (live) { setF(a ? { ...a } : null); setLoading(false); } });
    return () => { live = false; };
  }, [accountId]);
  const set = (k: 'handle' | 'displayName' | 'fbUrl' | 'followers' | 'status', v: string) => setF((p) => p ? { ...p, [k]: v } : p);
  const save = async () => {
    if (!f) return;
    const payload = { handle: f.handle, displayName: f.displayName, fbUrl: f.fbUrl, followers: f.followers, status: f.status };
    setBusy(true); setErr('');
    const r = isCreate ? await createSendAsAccount(projectId, channel, payload) : await updateSendAsAccount(accountId as number, payload);
    setBusy(false); if (r.ok) onClose(); else setErr(r.error || 'lỗi lưu');
  };
  const del = async () => { if (accountId == null) return; setBusy(true); setErr(''); const r = await deleteSendAsAccount(accountId); setBusy(false); if (r.ok) onClose(); else setErr(r.error || 'lỗi xoá'); };

  return (
    <Drawer onClose={onClose} width={460} zIndex={640} closeOnOutside={false} padding={0}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px 12px', borderBottom: '1px solid var(--line)' }}>
          <h2 style={{ flex: 1, fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--fg-0)' }}>{isCreate ? 'Tạo danh tính mới' : 'Sửa danh tính'}</h2>
          <button className="btn ghost" onClick={onClose} style={{ padding: '2px 8px' }}>✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Đang tải…</div> : !f ? <div style={{ color: 'var(--bad)', fontSize: 12 }}>Không thấy account.</div> : (
            <>
              <label><span style={lbl}>Tên hiển thị</span><input value={f.displayName} onChange={(e) => set('displayName', e.target.value)} autoFocus style={inp} placeholder="VD: Animals Care" /></label>
              <label><span style={lbl}>Handle {isCreate && <span style={{ textTransform: 'none', color: 'var(--fg-4)' }}>(bỏ trống = tự tạo từ tên)</span>}</span><input value={f.handle} onChange={(e) => set('handle', e.target.value)} style={inp} placeholder="vanity hoặc id" /></label>
              <label><span style={lbl}>URL trang FB</span><input value={f.fbUrl} onChange={(e) => set('fbUrl', e.target.value)} style={inp} placeholder="https://facebook.com/…" />
                {f.fbUrl && <a href={f.fbUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--accent)', marginTop: 3, display: 'inline-block' }}>↗ mở</a>}</label>
              <label><span style={lbl}>Followers</span><input value={f.followers} onChange={(e) => set('followers', e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" style={inp} placeholder="số" /></label>
              <label><span style={lbl}>Trạng thái</span>
                <select value={f.status} onChange={(e) => set('status', e.target.value)} style={inp}>
                  {['active', 'warming', 'limited', 'blocked', 'banned'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {err && <div style={{ fontSize: 11, color: 'var(--bad)' }}>✗ {err}</div>}
            </>
          )}
        </div>
        {!loading && f && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
            {!isCreate && <ConfirmDeleteButton onDelete={del} labelIdle="🗑 Xoá" />}
            <span style={{ flex: 1 }} />
            <button className="btn ghost" onClick={onClose} style={{ padding: '7px 13px' }}>Huỷ</button>
            <button className="btn primary" onClick={save} disabled={busy} style={{ padding: '7px 15px' }}>{busy ? '…' : (isCreate ? 'Tạo' : 'Lưu')}</button>
          </div>
        )}
      </div>
    </Drawer>
  );
}

export function SendAsPicker({ projectId, channel, value, onPick, onClose }: {
  projectId: string; channel: string; value?: SentAs; onPick: (sa: SentAs) => void; onClose: () => void;
}) {
  const load = useCallback(async (): Promise<EntityOption[]> => (await listSendAs(projectId, channel)).map(toOption), [projectId, channel]);

  const handlePick = async (opt: EntityOption) => {
    const o = opt.data as SendAsOption;
    if (o.id === 0 && o.directusId) {   // from the Directus registry → import once into the global pool, then select
      const r = await adoptSendAsFromDirectus(projectId, channel, o.directusId);
      if (r.ok && r.option) onPick({ kind: r.option.kind, id: r.option.id, label: r.option.label });
      else throw new Error(r.error || 'lỗi nhập từ Directus');
      return;
    }
    onPick({ kind: o.kind, id: o.id, label: o.label });
  };

  return (
    <EntityPicker
      title="Gửi bằng — chọn danh tính"
      hint="Page/account FB bạn sở hữu (dùng chung mọi dự án). Chọn, ＋ tạo mới, hoặc ✎ sửa chi tiết."
      load={load}
      value={value?.id != null ? { key: `${value.kind || 'account'}:${value.id}` } : undefined}
      onPick={handlePick}
      onClose={onClose}
      renderEditor={(opt, close) => (
        <SendAsDetailDrawer projectId={projectId} channel={channel} accountId={opt ? (opt.data as SendAsOption).id : null} onClose={close} />
      )}
      emptyHint={<>Chưa có danh tính. Bấm <b>＋ Tạo mới</b> ở trên, hoặc nhập hàng loạt bằng nút <b>⬇ Nhập Pages</b> của ext trên facebook.com.</>}
    />
  );
}
