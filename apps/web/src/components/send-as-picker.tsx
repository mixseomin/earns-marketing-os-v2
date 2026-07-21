'use client';

// SendAsPicker — "comment/DM as" identity chooser. Thin wrapper over the house <EntityPicker> primitive:
// it only maps send-as options ⇄ EntityOption and wires the CRUD callbacks (create global account, rename,
// delete, adopt-from-Directus on pick). All the modal/search/inline-CRUD/rich-row UI lives in EntityPicker.
import { useCallback } from 'react';
import { EntityPicker, type EntityOption } from '@/components/ui';
import { listSendAs, addSendAsAccount, renameSendAsAccount, deleteSendAsAccount, adoptSendAsFromDirectus, type SendAsOption, type SentAs } from '@/lib/actions/outreach-touches';

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
  editable: o.editable,
  data: o,
});

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
      hint="Page/account bạn sở hữu (dùng chung mọi dự án). Chọn, tạo mới, sửa hoặc xoá."
      load={load}
      value={value?.id != null ? { key: `${value.kind || 'account'}:${value.id}` } : undefined}
      onPick={handlePick}
      onClose={onClose}
      onCreate={(name) => addSendAsAccount(projectId, channel, name).then((r) => ({ ok: r.ok, error: r.error }))}
      onRename={(opt, name) => renameSendAsAccount((opt.data as SendAsOption).id, name)}
      onDelete={(opt) => deleteSendAsAccount((opt.data as SendAsOption).id)}
      createPlaceholder="Tạo mới: nhập tên Page/account…"
      emptyHint={<>Chưa có danh tính. Tạo mới ở trên, hoặc nhập hàng loạt bằng nút <b>⬇ Nhập Pages</b> của ext trên facebook.com.</>}
    />
  );
}
