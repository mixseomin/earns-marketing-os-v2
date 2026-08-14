'use client';

// Communities registry vault — mọi habitat (subreddit/FB group/forum) với thành viên · LUẬT ĐĂNG ·
// cổng link · chỗ đứng của mình. Một component, hai chỗ gắn: /communities (toàn hệ, có lọc project)
// và /communities?project=<id>. Bấm dòng → HabitatFormModal (editor đầy đủ) — sửa luật/gate ở một chỗ.
//
// Bảng dùng ui.DataTable + NHÓM CỘT: luật đăng, cổng link, độ hợp, quản trị đều là thứ phải đọc được
// NGAY trên bảng (trước đây nằm trong DB nhưng chỉ mở editor từng dòng mới thấy), nhưng bày 20 cột
// cùng lúc thì không ai quét nổi — nên gom thành nhóm bật/tắt, nhớ theo persistKey.
import { useState, useMemo, useTransition, useEffect, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { HabitatFormModal } from './habitat-form-modal';
import { ListToolbar, Pager, usePaged, MultiSelect, DataTable, AnchoredPopover, EntityRef, type DataColumn, type DataGroup } from './ui';
import { useModalParam } from '@/lib/use-modal-param';
import { getHabitatRowAction, listBriefsForHabitat } from '@/lib/actions/community-briefs';
import type { HabitatRow, TribeRow, PlatformRow } from '@/lib/data';
import type { CommunityRow } from '@/lib/actions/communities';
import { FORMATS } from '@/lib/content-channels';
import { PHASES, PHASE_COLOR, PHASE_LABEL, type Phase } from '@/lib/phase-plan';
import { JOIN_STATUS_LABEL, JOIN_STATUS_COLOR, JOIN_STATUS_ICON, type JoinStatus } from '@/lib/join-status';

const inp: CSSProperties = { padding: '5px 9px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-0)', fontSize: 12 };
const badge: CSSProperties = { fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, whiteSpace: 'nowrap', color: 'var(--fg-2)', border: '1px solid var(--line)', background: 'var(--bg-2)' };
const pill = (c: string): CSSProperties => ({ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, whiteSpace: 'nowrap', color: c, border: `1px solid ${c}55`, background: `${c}14` });
const dim = { color: 'var(--fg-4)' };
// Ô chữ dài (luật, chủ đề): cắt bằng CSS chứ không cắt chuỗi — hover vẫn đọc đủ qua title.
const clip = (w: number): CSSProperties => ({ maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' });

// Cộng đồng này CẤM link hẳn? (soi cùng regex với link-readiness, chỉ để hiển thị.)
function linksBanned(s: string): boolean {
  const v = (s || '').trim().toLowerCase();
  return v === 'never' || v === 'no' || /banned|no self|self.?promo|no link|not allow/.test(v);
}

const GROUPS: DataGroup[] = [
  { key: 'do', label: 'Số đo', color: '#f472b6' },
  { key: 'rules', label: 'Luật đăng', color: '#ffb03c' },
  { key: 'gate', label: 'Cổng link', color: '#34d399' },
  { key: 'fit', label: 'Độ hợp', color: '#38bdf8', defaultOn: false },
  { key: 'meta', label: 'Quản trị', color: '#a78bfa', defaultOn: false },
];

// Kiểu bài của cộng đồng nói CÙNG một ngôn ngữ với tag format: của bài mình sắp đăng — có thế mới
// đối chiếu được "nhóm này ăn kiểu gì" với "mình đang xếp kiểu gì vào đây".
const FMT = new Map(FORMATS.map((f) => [f.id, f]));
const fmtLabel = (id: string) => { const f = FMT.get(id); return f ? `${f.icon} ${f.label}` : id; };
// Gộp "tỉ lệ nhóm đăng" với "cảm xúc trung vị" về CÙNG một hàng cho mỗi kiểu bài, xếp theo mức ăn.
// Kiểu chỉ có ở một trong hai nguồn vẫn hiện (đăng nhiều mà chưa đo được = thông tin, không phải 0).
function fmtRows(r: { formatShare: Array<{ format: string; pct: number }>; formatFit: Array<{ format: string; n: number; medEng: number | null }> }) {
  const share = new Map(r.formatShare.map((f) => [f.format, f.pct]));
  const fit = new Map(r.formatFit.map((f) => [f.format, f]));
  return [...new Set([...share.keys(), ...fit.keys()])]
    .map((k) => ({ k, pct: share.get(k) ?? 0, rx: fit.get(k)?.medEng ?? null, n: fit.get(k)?.n ?? 0 }))
    .sort((a, b) => (b.rx ?? -1) - (a.rx ?? -1) || b.pct - a.pct);
}

export function CommunitiesVault({ projectId, rows, platforms, projects, tribes, gatedKeys }: {
  projectId?: string;
  rows: CommunityRow[];
  platforms: PlatformRow[];
  projects: { id: string; name: string; emoji?: string | null }[];
  tribes: TribeRow[];
  gatedKeys: string[];   // platform keys with link_gate_enabled → 🌱 community-seed class
}) {
  const router = useRouter();
  const modal = useModalParam();   // ?m=habitat-edit&mId=<id> | ?m=habitat-new&mId=<projectId> (house standard)
  const [pending, start] = useTransition();
  // Bộ lọc sống trong URL: F5 hoặc dán link cho nhau phải ra ĐÚNG màn hình đang xem. Trước đây giữ
  // trong state trơn nên mỗi lần tải lại là mất sạch, phải lọc lại từ đầu.
  const sp0 = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [q, setQ] = useState(sp0.get('q') ?? '');
  const [plat, setPlat] = useState<string[]>((sp0.get('plat') || '').split(',').filter(Boolean));
  const [proj, setProj] = useState<string[]>(() => {
    const fromUrl = (sp0.get('proj') || '').split(',').filter(Boolean);
    return fromUrl.length ? fromUrl : (projectId ? [projectId] : []);
  });
  useEffect(() => {
    const u = new URL(window.location.href);
    const set = (k: string, v: string) => { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); };
    set('q', q.trim());
    set('plat', plat.join(','));
    set('proj', projectId ? '' : proj.join(','));   // view theo project đã có ?project=, đừng ghi trùng
    window.history.replaceState(null, '', u);
  }, [q, plat, proj, projectId]);
  const [edit, setEdit] = useState<{ row: HabitatRow | null; projectId: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const gateOn = useMemo(() => new Set(gatedKeys), [gatedKeys]);
  const projName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const platLabel = useMemo(() => new Map(platforms.map((p) => [p.key, p.label])), [platforms]);
  const platKeys = useMemo(() => [...new Set(rows.map((r) => r.platformKey).filter(Boolean))] as string[], [rows]);

  const shown = useMemo(() => rows.filter((r) =>
    (!proj.length || (r.projectId != null && proj.includes(r.projectId)))
    && (!plat.length || (r.platformKey != null && plat.includes(r.platformKey)))
    && (!q || `${r.name} ${r.url || ''} ${r.description || ''} ${r.postingRules} ${r.voiceNotes} ${r.dominantTopics.join(' ')}`
        .toLowerCase().includes(q.toLowerCase())),
  ), [rows, proj, plat, q]);
  // KHÔNG tự cắt trang ở đây nữa: bảng có ô tìm + lọc theo cột của riêng nó, cắt trước là bộ lọc
  // trong bảng chỉ ăn trên trang đang mở. Đưa cả tập vào, bảng tự cắt bằng pageSize.

  const kpis = useMemo(() => ({
    total: shown.length,
    gated: shown.filter((r) => r.platformKey && gateOn.has(r.platformKey)).length,
    joined: shown.reduce((s, r) => s + r.joined, 0),
    seeds: shown.reduce((s, r) => s + r.seeds, 0),
  }), [shown, gateOn]);

  // All open/close routes through these so the URL (useModalParam) always mirrors the drawer state.
  // edit → mId=<habitatId>; create → mId=<projectId> (habitat has no id yet).
  const openHabitat = (row: HabitatRow | null, pid: string) => { setEdit({ row, projectId: pid }); modal.open(row ? 'habitat-edit' : 'habitat-new', row ? row.id : pid); };
  const closeHabitat = () => { setEdit(null); modal.close(); };
  const openEdit = async (r: CommunityRow) => {
    if (!r.projectId) return;
    setBusyId(r.id);
    const full = await getHabitatRowAction(r.projectId, r.id);
    setBusyId(null);
    if (full) openHabitat(full, r.projectId);
  };
  const createPid = (proj.length === 1 ? proj[0] : '') || projectId || '';

  // Deep-link restore on mount: ?m=habitat-edit&mId=<id> reopens that editor, habitat-new opens create.
  useEffect(() => {
    if (modal.is('habitat-new')) { const pid = modal.id || createPid; if (pid) setEdit({ row: null, projectId: pid }); return; }
    if (modal.is('habitat-edit') && modal.id) { const row = rows.find((r) => String(r.id) === modal.id); if (row) openEdit(row); }
  }, []);   // mount only — restore the drawer the URL points at
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🏘 Communities</h2>
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>subreddit/forum · rules · link-gate · standing</span>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[['Communities', kpis.total], ['🌱 gated', kpis.gated], ['joined', kpis.joined], ['seeds landed', kpis.seeds]].map(([l, v]) => (
          <div key={l as string} style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 8, minWidth: 92 }}>
            <div style={{ fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v as number}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="tên · url · luật · quan sát · chủ đề…"
        right={
          <button type="button" onClick={() => createPid && openHabitat(null, createPid)} disabled={!createPid}
            title={createPid ? 'Thêm community mới' : 'Chọn 1 project để thêm'}
            style={{ ...inp, cursor: createPid ? 'pointer' : 'not-allowed', fontWeight: 700, opacity: createPid ? 1 : 0.5 }}>+ Community</button>
        }>
        {!projectId && (
          <MultiSelect label="project" compact selected={proj} onChange={setProj}
            options={projects.map((p) => ({ value: p.id, label: `${p.emoji ? `${p.emoji} ` : ''}${p.name}` }))} />
        )}
        <MultiSelect label="platform" compact selected={plat} onChange={setPlat}
          options={platKeys.map((k) => ({ value: k, label: `${platLabel.get(k) || k}${gateOn.has(k) ? ' 🌱' : ''}` }))} />
      </ListToolbar>

      <DataTable
        rows={shown}
        pageSize={25}
        getRowKey={(r) => String(r.id)}
        groups={GROUPS}
        persistKey="communities"
        minWidth={980}
        onRowClick={(r) => openEdit(r)}
        rowTitle={() => 'Mở editor (luật · cổng · chỗ đứng)'}
        columns={[
          { key: 'community', header: 'Community', align: 'left', width: 260, sortValue: (r) => r.name.toLowerCase(),
            cell: (r) => (
              <div style={{ opacity: busyId === r.id ? 0.5 : 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--fg-0)', ...clip(250) }}>
                  {r.name}{r.privacy === 'private' && <span style={{ marginLeft: 6, ...badge }}>kín</span>}
                </div>
                {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 10.5, color: 'var(--fg-3)', textDecoration: 'underline dotted', ...clip(250) }}>↗ {r.url.replace(/^https?:\/\/(www\.)?/, '')}</a>}
              </div>),
            cellTitle: (r) => r.description || undefined },
          { key: 'platform', header: 'Platform', align: 'left', width: 108, sortValue: (r) => (r.platformKey ? (platLabel.get(r.platformKey) || r.platformKey).toLowerCase() : null),
            cell: (r) => r.platformKey
              ? <span style={badge}>{gateOn.has(r.platformKey) ? '🌱 ' : ''}{platLabel.get(r.platformKey) || r.platformKey}</span>
              : <span style={dim}>—</span> },
          { key: 'members', header: 'Thành viên', width: 86, sortValue: (r) => r.members || null,
            cell: (r) => (r.members ? fmt(r.members) : <span style={dim}>—</span>) },
          { key: 'standing', header: 'Chỗ đứng', width: 152, align: 'left', sortValue: (r) => (r.joined || null),
            cell: (r) => <EngagedCell row={r} /> },

          { group: 'rules', key: 'rulestext', header: 'Luật đăng', align: 'left', width: 300, sortValue: (r) => (r.postingRules ? r.postingRules.length : null),
            cell: (r) => r.postingRules
              ? <span style={{ color: 'var(--fg-2)', ...clip(290) }}>{r.postingRules.replace(/\s+/g, ' ')}</span>
              : <span style={dim}>CHƯA ĐỌC LUẬT</span>,
            cellTitle: (r) => r.postingRules || 'Chưa ghi luật — đọc trước khi đăng bài đầu tiên' },
          { group: 'rules', key: 'rulesurl', header: 'Trang luật', width: 76, align: 'left', sortValue: (r) => (r.postingRulesUrl ? 1 : null),
            cell: (r) => r.postingRulesUrl
              ? <a href={r.postingRulesUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--neon-blue)' }}>mở ↗</a>
              : <span style={dim}>—</span> },
          { group: 'rules', key: 'mod', header: 'Mod', width: 76, align: 'left', sortValue: (r) => ({ high: 3, medium: 2, low: 1 } as Record<string, number>)[r.modStrictness] ?? null,
            cell: (r) => r.modStrictness
              ? <span style={pill(r.modStrictness === 'high' ? '#ef4444' : r.modStrictness === 'medium' ? '#ffb03c' : '#22c55e')}>{r.modStrictness}</span>
              : <span style={dim}>—</span> },
          { group: 'rules', key: 'links', header: 'Chính sách link', align: 'left', width: 168, sortValue: (r) => (r.linksAllowedAfter ? (linksBanned(r.linksAllowedAfter) ? 2 : 1) : null),
            cell: (r) => r.linksAllowedAfter
              ? <span title={r.linksAllowedAfter} style={pill(linksBanned(r.linksAllowedAfter) ? '#ef4444' : '#ffb03c')}>
                  {linksBanned(r.linksAllowedAfter) ? '⛔ cấm link' : `⚠ ${r.linksAllowedAfter}`}</span>
              : <span style={dim}>—</span> },

          { group: 'gate', key: 'age', header: 'Tuổi tk', width: 64, sortValue: (r) => r.minAgeDays || null,
            cell: (r) => (r.minAgeDays ? `${r.minAgeDays}d` : <span style={dim}>—</span>) },
          { group: 'gate', key: 'karma', header: 'Karma', width: 64, sortValue: (r) => r.minKarma || null,
            cell: (r) => (r.minKarma ? String(r.minKarma) : <span style={dim}>—</span>) },
          { group: 'gate', key: 'seedmin', header: 'Seed tối thiểu', width: 92, sortValue: (r) => r.minPosts || null,
            cell: (r) => (r.minPosts ? String(r.minPosts) : <span style={dim}>—</span>) },

          // Đúng cách soi tay: mở nhóm, xem vài bài MỚI NHẤT, tương tác thế nào → sống hay chết.
          // Gộp thành một chữ đọc được ngay, giữ số ở các cột bên cạnh để kiểm lại.
          { group: 'do', key: 'song', header: 'Sức sống', width: 108,
            sortValue: (r) => (r.newestAgeH == null ? null : -r.newestAgeH),
            cellTitle: (r) => r.newestAgeH == null ? 'chưa khảo'
              : `bài mới nhất cách đây ${r.newestAgeH}h · ${r.postsPerDay ?? '?'} bài/ngày · tương tác trung vị ${(r.medReactions ?? 0) + (r.medComments ?? 0)}/bài`,
            cell: (r) => {
              if (r.newestAgeH == null) return <span style={dim}>chưa khảo</span>;
              // Đo hỏng thì phải NÓI LÀ ĐO HỎNG. Trước đây không đọc được số nào cũng ra "ko ai xem"
              // → nhóm 78K bài 203 like bị ghi thành chết.
              if (r.measuredTrend === 0) return <span style={pill('#8b8b8b')}>chưa đo được</span>;
              const tuongTac = r.trendMedRx ?? r.medReactions ?? 0;
              const s = r.newestAgeH > 72 ? { t: 'bỏ hoang', c: '#ef4444' }
                : tuongTac >= 20 ? { t: 'sống khoẻ', c: '#22c55e' }
                : tuongTac >= 5 ? { t: 'sống', c: '#22c55e' }
                : tuongTac >= 1 ? { t: 'lay lắt', c: '#ffb03c' }
                : { t: 'đăng nhưng ko ai xem', c: '#ef4444' };
              return <span style={pill(s.c)}>{s.t}</span>;
            } },
          { group: 'do', key: 'moi', header: 'Bài mới nhất', width: 104, sortValue: (r) => r.newestAgeH,
            cell: (r) => (r.newestAgeH == null ? <span style={dim}>—</span>
              : r.newestAgeH < 1 ? '<1h' : r.newestAgeH < 48 ? `${r.newestAgeH}h` : `${Math.round(r.newestAgeH / 24)}d`) },
          { group: 'do', key: 'nhipngay', header: 'Bài/ngày', width: 86, sortValue: (r) => r.postsPerDay,
            cell: (r) => (r.postsPerDay == null ? <span style={dim}>—</span> : r.postsPerDay) },
          // MỘT cột thay vì hai: "đăng nhiều" và "ăn nhiều" đọc rời nhau thì phải tự ghép trong đầu,
          // mà cái cần biết là ghép rồi — kiểu nào ĐANG ĂN, và nhóm có đăng kiểu đó nhiều không.
          // Xếp theo cảm xúc giảm dần → kiểu đáng đăng nhất nằm đầu. Đậm nhạt = mức ăn.
          { group: 'do', key: 'hieuqua', header: 'Kiểu bài × hiệu quả', align: 'left', width: 320,
            sortValue: (r) => fmtRows(r)[0]?.rx ?? null,
            cellTitle: (r) => fmtRows(r).map((x) => `${fmtLabel(x.k)}: ${x.pct}% số bài · ${x.rx == null ? 'chưa đo được' : `${x.rx} cảm xúc`} (mẫu ${x.n})`).join('\n') || 'chưa khảo',
            cell: (r) => {
              const rows = fmtRows(r);
              if (!rows.length) return <span style={dim}>chưa khảo</span>;
              return (
                <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {rows.slice(0, 4).map((x) => {
                    const c = x.rx == null ? 'var(--fg-4)' : x.rx >= 20 ? '#22c55e' : x.rx >= 5 ? '#a3d977' : x.rx >= 1 ? '#ffb03c' : '#ef4444';
                    return (
                      <span key={x.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 5px',
                        borderRadius: 4, border: `1px solid ${c}55`, background: `${c}14`, fontSize: 10.5, whiteSpace: 'nowrap' }}>
                        <span>{FMT.get(x.k)?.icon ?? '·'}</span>
                        <span style={{ color: 'var(--fg-3)' }}>{x.pct}%</span>
                        <span style={{ color: c, fontWeight: 600 }}>{x.rx == null ? '—' : `${x.rx}rx`}</span>
                      </span>);
                  })}
                </span>);
            } },
          { group: 'do', key: 'eng', header: 'Tương tác/1K TV', width: 116, sortValue: (r) => r.engPerMille,
            cellTitle: (r) => r.engPerMille == null ? 'chưa khảo' : `(cảm xúc + bình luận) trung vị trên 1.000 thành viên · mẫu ${r.sampleSize} bài, khảo ${r.surveyedAt}`,
            cell: (r) => r.engPerMille == null ? <span style={dim}>chưa khảo</span>
              : <span style={{ color: r.engPerMille >= 1 ? '#22c55e' : r.engPerMille >= 0.1 ? '#ffb03c' : '#ef4444' }}>{r.engPerMille.toFixed(2)}</span> },
          // Hai luồng riêng: bài MỚI đo "còn ai ngó không", bài TREND đo "trần của nhóm tới đâu".
          // Gộp một số là mất cả hai nghĩa.
          { group: 'do', key: 'rxmoi', header: 'Cảm xúc · bài mới', width: 120, sortValue: (r) => r.newMedRx,
            cellTitle: () => 'trung vị cảm xúc trên các bài MỚI NHẤT (feed theo thời gian)',
            cell: (r) => (r.newMedRx == null ? <span style={dim}>—</span> : r.newMedRx) },
          { group: 'do', key: 'rxtop', header: 'Cảm xúc · bài trend', width: 128, sortValue: (r) => r.trendMedRx,
            cellTitle: (r) => r.trendMedRx == null ? 'chưa đo được'
              : `trung vị trên bài feed đẩy lên đầu · cao nhất trong mẫu ${r.trendMaxRx} · đo được ${r.measuredTrend}/${r.sampleTrend} bài`,
            cell: (r) => (r.trendMedRx == null ? <span style={dim}>—</span>
              : <span>{r.trendMedRx}{r.trendMaxRx != null && <span style={{ color: 'var(--fg-3)' }}> · đỉnh {r.trendMaxRx}</span>}</span>) },
          { group: 'do', key: 'cmt', header: 'Bình luận/bài', width: 104, sortValue: (r) => r.medComments,
            cell: (r) => (r.medComments == null ? <span style={dim}>—</span> : r.medComments) },
          { group: 'do', key: 'pic', header: 'Bài có ảnh', width: 94, sortValue: (r) => r.pctPhoto,
            cell: (r) => (r.pctPhoto == null ? <span style={dim}>—</span> : `${r.pctPhoto}%`) },
          { group: 'do', key: 'vid', header: 'Bài có video', width: 104, sortValue: (r) => r.pctVideo,
            cell: (r) => (r.pctVideo == null ? <span style={dim}>—</span> : `${r.pctVideo}%`) },
          { group: 'do', key: 'khao', header: 'Khảo ngày', width: 94, sortValue: (r) => r.surveyedAt,
            cell: (r) => r.surveyedAt ?? <span style={dim}>chưa</span> },
          { group: 'rules', key: 'quansat', header: 'Quan sát thực địa', align: 'left', width: 330,
            sortValue: (r) => (r.voiceNotes ? r.voiceNotes.length : null),
            cell: (r) => r.voiceNotes
              ? <span style={{ color: 'var(--fg-2)', ...clip(320) }}>{r.voiceNotes.replace(/\s+/g, ' ')}</span>
              : <span style={dim}>CHƯA VÀO XEM</span>,
            cellTitle: (r) => r.voiceNotes || 'Chưa vào nhóm xem người ta đăng kiểu gì' },
          { group: 'fit', key: 'ctype', header: 'Kiểu', width: 96, align: 'left', sortValue: (r) => r.communityType || null,
            cell: (r) => r.communityType ? <span style={badge}>{r.communityType}</span> : <span style={dim}>—</span> },
          { group: 'fit', key: 'lang', header: 'Ngôn ngữ', width: 72, align: 'left', sortValue: (r) => r.language || null,
            cell: (r) => r.language || <span style={dim}>—</span> },
          { group: 'fit', key: 'act', header: 'Nhịp đăng', width: 96, align: 'left', sortValue: (r) => r.activity || null,
            cell: (r) => r.activity || <span style={dim}>—</span> },
          { group: 'fit', key: 'times', header: 'Giờ tốt', width: 110, align: 'left', sortValue: (r) => r.bestPostTimes || null,
            cell: (r) => r.bestPostTimes ? <span style={clip(104)}>{r.bestPostTimes}</span> : <span style={dim}>—</span>,
            cellTitle: (r) => r.bestPostTimes || undefined },
          { group: 'fit', key: 'topics', header: 'Chủ đề chính', align: 'left', width: 190, sortValue: (r) => r.dominantTopics.length || null,
            cell: (r) => r.dominantTopics.length ? <span style={clip(180)}>{r.dominantTopics.join(' · ')}</span> : <span style={dim}>—</span>,
            cellTitle: (r) => r.dominantTopics.join(' · ') || undefined },
          { group: 'fit', key: 'forbid', header: 'Chủ đề CẤM', align: 'left', width: 170, sortValue: (r) => r.forbiddenTopics.length || null,
            cell: (r) => r.forbiddenTopics.length
              ? <span style={{ color: '#ef4444', ...clip(160) }}>{r.forbiddenTopics.join(' · ')}</span>
              : <span style={dim}>—</span>,
            cellTitle: (r) => r.forbiddenTopics.join(' · ') || undefined },

          { group: 'meta', key: 'status', header: 'Trạng thái', width: 86, align: 'left', sortValue: (r) => r.status || null,
            cell: (r) => r.status ? <span style={badge}>{r.status}</span> : <span style={dim}>—</span> },
          { group: 'meta', key: 'health', header: 'Sức khoẻ', width: 74, align: 'left', sortValue: (r) => r.health || null,
            cell: (r) => r.health ? <span style={pill(r.health === 'ok' ? '#22c55e' : r.health === 'warn' ? '#ffb03c' : '#ef4444')}>{r.health}</span> : <span style={dim}>—</span> },
          { group: 'meta', key: 'kind', header: 'Loại', width: 78, align: 'left', sortValue: (r) => r.kind || null,
            cell: (r) => r.kind || <span style={dim}>—</span> },
          { group: 'meta', key: 'sync', header: 'Đồng bộ', width: 86, sortValue: (r) => r.lastSyncAt,
            cell: (r) => r.lastSyncAt || <span style={dim}>—</span> },
          ...(projectId ? [] : [{ group: 'meta', key: 'project', header: 'Project', align: 'left' as const, width: 120,
            sortValue: (r: CommunityRow) => (r.projectId ? (projName.get(r.projectId) || r.projectId).toLowerCase() : null),
            cell: (r: CommunityRow) => (r.projectId ? (projName.get(r.projectId) || r.projectId) : '—') }]),
        ] as DataColumn<CommunityRow>[]}
      />

      {edit && (
        <HabitatFormModal
          projectId={edit.projectId} habitat={edit.row} tribes={tribes} platforms={platforms}
          onClose={() => { closeHabitat(); start(() => router.refresh()); }}
          onCreated={() => { closeHabitat(); start(() => router.refresh()); }}
        />
      )}
    </div>
  );
}

// ── Chỗ đứng = account đã engage: GLANCE (số + phân bố phase) trong ô, DRILL (từng account) khi bấm ──
// YDNI: ô chỉ hiện số account + micro-bar phase (đủ để liếc "mấy account, đang ở đâu"); bấm mới tải
// danh sách account cụ thể (handle · phase · membership) vào popup — không nhồi hết vào bảng.
type BriefLite = { id: number; accountId: number; handle: string; phase: Phase; joinStatus: JoinStatus; platform: string };

// Micro-bar phân bố phase — CHỈ hiện khi có MIX ≥2 phase. 1 phase duy nhất (vd mọi account đều
// warm-up) thì bar là 1 khối màu đặc GIỐNG HỆT mọi dòng → nhiễu vô nghĩa, ẩn đi. Có mix mới đáng nhìn.
function PhaseBar({ counts }: { counts: Record<string, number> }) {
  const segs = PHASES.filter((p) => (counts[p] ?? 0) > 0);
  if (segs.length < 2) return null;
  return (
    <span title={segs.map((p) => `${PHASE_LABEL[p]}: ${counts[p]}`).join(' · ')}
      style={{ display: 'inline-flex', width: 34, height: 7, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--line)', verticalAlign: 'middle', flexShrink: 0 }}>
      {segs.map((p) => <span key={p} style={{ flexGrow: counts[p], background: PHASE_COLOR[p] }} />)}
    </span>
  );
}

// Join-status ngay trên bảng: icon+số theo màu từng trạng thái (✓ đã join xanh, ○ chưa join xám,
// ⏳ chờ duyệt vàng, ✗/🚫 đỏ). joined trước để "đã join vs chưa" đọc được ngay. Chỉ hiện trạng thái có account.
const JOIN_ORDER: JoinStatus[] = ['joined', 'pending', 'not_joined', 'rejected', 'kicked', 'left'];
function JoinBadges({ counts }: { counts: Record<string, number> }) {
  const segs = JOIN_ORDER.filter((s) => (counts[s] ?? 0) > 0);
  if (!segs.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      {segs.map((s) => (
        <span key={s} title={`${JOIN_STATUS_LABEL[s]}: ${counts[s]}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: JOIN_STATUS_COLOR[s], fontWeight: 700, whiteSpace: 'nowrap' }}>
          {JOIN_STATUS_ICON[s]}{counts[s]}
        </span>
      ))}
    </span>
  );
}

function EngagedCell({ row }: { row: CommunityRow }) {
  const [hover, setHover] = useState(false);
  const [briefs, setBriefs] = useState<BriefLite[] | null>(null);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  // Hover-card: rê vào ô = mở; AnchoredPopover(closeOnPointerOutside) tự đóng khi con trỏ rời khỏi
  // (ô ∪ panel) — KHÔNG timer tự chế nữa (timer dễ kẹt-mở, che mất hàng dưới → không hover/click được).
  // backdrop=false → click ô nổi bọt lên hàng mở drawer như thường.
  useEffect(() => {
    if (!hover || briefs) return;                 // tải LƯỜI 1 lần, chỉ khi rê vào
    let live = true;
    listBriefsForHabitat(row.id)
      .then((rs) => { if (live) setBriefs(rs.map((b) => ({ id: b.id, accountId: b.accountId, handle: b.accountHandle ?? '(no handle)', phase: b.currentPhase, joinStatus: b.joinStatus, platform: b.platformLabel }))); })
      .catch(() => { if (live) setBriefs([]); });
    return () => { live = false; };
  }, [hover, briefs, row.id]);

  if (!row.briefs) return <span style={dim}>chưa track</span>;
  return (
    <span ref={anchorRef} onMouseEnter={() => setHover(true)}
      onClick={() => setHover(false)}   // KHÔNG stopPropagation: click nổi bọt lên hàng (mở drawer), chỉ đóng popup
      title={`${row.joined}/${row.briefs} account đã vào · 🌱${row.seeds} seed sống — rê xem từng account, bấm mở community`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
      <span><span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{row.briefs}</span> acc</span>
      <JoinBadges counts={row.joinCounts} />
      <PhaseBar counts={row.phaseCounts} />
      {row.seeds > 0 && <span style={{ color: 'var(--fg-3)' }}>🌱{row.seeds}</span>}
      <AnchoredPopover anchorRef={anchorRef} open={hover} onClose={() => setHover(false)} align="left" zIndex={1100} backdrop={false} closeOnPointerOutside>
        <AccountsList name={row.name} joined={row.joined} total={row.briefs} briefs={briefs} />
      </AnchoredPopover>
    </span>
  );
}

function AccountsList({ name, joined, total, briefs }: { name: string; joined: number; total: number; briefs: BriefLite[] | null }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,.5)', minWidth: 272, maxWidth: 360, maxHeight: 340, overflow: 'auto' }}>
      <div style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', position: 'sticky', top: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-0)' }}>Account đã engage</div>
        <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{name} · {joined}/{total} đã vào</div>
      </div>
      {briefs == null ? (
        <div style={{ padding: 12, fontSize: 11, color: 'var(--fg-3)' }}>Đang tải…</div>
      ) : briefs.length === 0 ? (
        <div style={{ padding: 12, fontSize: 11, color: 'var(--fg-3)' }}>Chưa account nào có brief ở đây.</div>
      ) : (
        briefs.map((b) => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--line)' }}>
            {/* EntityRef = chip account chuẩn, click mở account drawer qua global host (như engaging list) */}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }} title={b.platform}>
              <EntityRef kind="account" id={b.accountId} label={`@${b.handle}`} size="sm" />
            </span>
            <span title={`Phase: ${PHASE_LABEL[b.phase]}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: PHASE_COLOR[b.phase], flexShrink: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: PHASE_COLOR[b.phase] }} />{PHASE_LABEL[b.phase]}
            </span>
            <span title={`Membership: ${JOIN_STATUS_LABEL[b.joinStatus]}`}
              style={{ fontSize: 10, color: JOIN_STATUS_COLOR[b.joinStatus], flexShrink: 0, whiteSpace: 'nowrap' }}>
              {JOIN_STATUS_ICON[b.joinStatus]} {JOIN_STATUS_LABEL[b.joinStatus]}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
