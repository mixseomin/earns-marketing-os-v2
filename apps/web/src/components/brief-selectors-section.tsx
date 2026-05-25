'use client';

// BriefSelectorsSection — UI inspect brief metadata (account ↔ habitat
// relationship) cho 1 habitat. Wrapper thin: fetch resolved selectors
// (prefix "brief.") + map brief.scrapedMeta values, đẩy sang
// <FieldsSection> để render.

import { useState, useEffect } from 'react';
import { resolveSelectors, type ScopeKind, type SelectorSpec } from '@/lib/actions/habitat-selectors';
import { getBriefFieldSchema, parseBriefFieldName } from '@/lib/brief-field-schema';
import { FieldsSection, type FieldRowSpec } from './fields-section';

interface BriefRow {
  id: number;
  accountId: number;
  accountHandle: string | null;
  joinStatus: string;
  scrapedMeta: Record<string, unknown>;
}

interface Props {
  habitatId: number;
  platformKey: string | null;
  briefs: BriefRow[];
  pageKind?: string;
  onRefresh?: () => void;
  /** Khi render trong brief-edit-modal cho 1 brief đơn, pass accountId
   *  để chỉ show value của account đó (không phải tất cả briefs habitat). */
  focusAccountId?: number;
}

export function BriefSelectorsSection({
  habitatId, platformKey, briefs, pageKind = 'subreddit-about',
  onRefresh, focusAccountId,
}: Props) {
  const [resolved, setResolved] = useState<Record<string, { spec: SelectorSpec; scope: ScopeKind }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const all = await resolveSelectors({
        platformKey, technologyKey: null, pageKind,
      });
      if (cancelled) return;
      const briefOnly: typeof resolved = {};
      for (const [field, rf] of Object.entries(all)) {
        const briefKey = parseBriefFieldName(field);
        if (briefKey) briefOnly[briefKey] = { spec: rf.spec, scope: rf.source.scope };
      }
      setResolved(briefOnly);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [habitatId, platformKey, pageKind]);

  const schema = getBriefFieldSchema(pageKind);

  // Filter briefs theo focusAccountId nếu pass — modal brief đơn chỉ
  // muốn value của brief đó, không phải tất cả accounts.
  const relevantBriefs = focusAccountId != null
    ? briefs.filter((b) => b.accountId === focusAccountId)
    : briefs;

  const fieldRows: FieldRowSpec[] = schema.map((f) => {
    const rs = resolved[f.key];
    // Gom values per brief
    const values: Array<{ value: string; handle: string }> = [];
    for (const b of relevantBriefs) {
      let v: unknown;
      if (f.key === 'join_status') {
        v = (b.scrapedMeta && b.scrapedMeta[f.key]) ?? b.joinStatus;
      } else {
        v = b.scrapedMeta?.[f.key];
      }
      if (v != null && v !== '') {
        values.push({ value: String(v), handle: b.accountHandle || `acc#${b.accountId}` });
      }
    }
    // Render value tuỳ context
    let valueNode: FieldRowSpec['value'] = null;
    let valueTooltip: string | undefined;
    if (values.length === 1) {
      // 1 value (focus mode hoặc chỉ 1 brief) → render gọn xanh
      valueNode = (
        <span style={{ color: 'var(--ok)', fontFamily: 'var(--font-mono)' }}>
          {values[0]!.value}
        </span>
      );
      valueTooltip = `${values[0]!.handle}: ${values[0]!.value}`;
    } else if (values.length > 1) {
      // Multi brief → render compact với tooltip full
      valueNode = (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
          {values.map((v) => `${v.handle}=${v.value}`).join(' · ')}
        </span>
      );
      valueTooltip = values.map((v) => `${v.handle}: ${v.value}`).join('\n');
    }
    return {
      key: f.key,
      label: f.label,
      hint: f.hint,
      parse: f.parse,
      selectorScope: rs ? rs.scope : null,
      selectorCss: rs?.spec.css,
      value: valueNode,
      valueTooltip,
      emptyPlaceholder: <em style={{ color: 'var(--fg-4)' }}>chưa có data</em>,
    };
  });

  const subtitle = focusAccountId != null
    ? `${pageKind} · 1 brief`
    : `${pageKind} · ${relevantBriefs.length} brief${relevantBriefs.length === 1 ? '' : 's'}`;

  return (
    <FieldsSection
      title="🔍 Brief auto-detect"
      subtitle={subtitle}
      fields={fieldRows}
      loading={loading}
      onRefresh={onRefresh}
      emptyMessage="Chưa có account nào engage habitat — không có brief để inspect."
      noneTooltip="Chưa có selector trained — ext dùng fallback heuristic (vd join_status từ button text)"
    />
  );
}
