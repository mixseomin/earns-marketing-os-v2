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
    // Gom values per brief — track source để hiện rõ value đến từ
    // scrapedMeta (ext scrape gần đây) vs legacy column joinStatus
    // (set tay / migration cũ, chưa được ext xác nhận).
    const values: Array<{ value: string; handle: string; source: 'scraped' | 'legacy' }> = [];
    for (const b of relevantBriefs) {
      let v: unknown;
      let source: 'scraped' | 'legacy' = 'scraped';
      if (f.key === 'join_status') {
        const scraped = b.scrapedMeta?.[f.key];
        if (scraped != null && scraped !== '') {
          v = scraped;
        } else {
          v = b.joinStatus;
          source = 'legacy';
        }
      } else {
        v = b.scrapedMeta?.[f.key];
      }
      if (v != null && v !== '') {
        values.push({ value: String(v), handle: b.accountHandle || `acc#${b.accountId}`, source });
      }
    }
    // Render value tuỳ context. Legacy value (chưa có scraped_meta) →
    // dim grey + italic + tooltip giải thích, KHÔNG xanh authoritative.
    let valueNode: FieldRowSpec['value'] = null;
    let valueTooltip: string | undefined;
    const allLegacy = values.length > 0 && values.every((v) => v.source === 'legacy');
    if (values.length === 1) {
      const v0 = values[0]!;
      const color = v0.source === 'legacy' ? 'var(--fg-3)' : 'var(--ok)';
      const fontStyle = v0.source === 'legacy' ? 'italic' : 'normal';
      valueNode = (
        <span style={{ color, fontFamily: 'var(--font-mono)', fontStyle }}>
          {v0.value}{v0.source === 'legacy' ? ' (legacy)' : ''}
        </span>
      );
      valueTooltip = v0.source === 'legacy'
        ? `${v0.handle}: ${v0.value}\n\n⚠ Value từ DB column legacy (joinStatus), CHƯA có ext POST /api/ext/briefs.\nF5 reddit page logged in → ext scrape + flip value chính xác.`
        : `${v0.handle}: ${v0.value}`;
    } else if (values.length > 1) {
      valueNode = (
        <span style={{ fontFamily: 'var(--font-mono)', color: allLegacy ? 'var(--fg-3)' : 'var(--fg-2)', fontStyle: allLegacy ? 'italic' : 'normal' }}>
          {values.map((v) => `${v.handle}=${v.value}${v.source === 'legacy' ? '*' : ''}`).join(' · ')}
        </span>
      );
      valueTooltip = values.map((v) =>
        `${v.handle}: ${v.value}${v.source === 'legacy' ? ' (legacy, chưa ext scrape)' : ''}`
      ).join('\n');
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
