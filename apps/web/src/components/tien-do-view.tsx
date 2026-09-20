'use client';
// View "📈 Tiến độ" của trang Plays (per-project và /plays toàn cục) — sổ tiến độ: hạng mục → bước → trạng thái.
// Đọc như sheet "Bra Shop 2026": mỗi nhóm một khối, dòng tô màu theo trạng thái, bấm ▸ mở bảng bước phẳng ngay dưới
// dòng (# · bước · trạng thái · ngày · kết quả · ghi chú) và sửa tại chỗ. Drawer chỉ cho mô tả/ghi chú/Ai/Số/Cổng/nhật ký.
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { useModalParam } from '@/lib/use-modal-param';
import { Drawer, Panel, SimpleTable, DataTable, TextField, TextAreaField, SelectField, EmptyState, ResourcePicker, FilterChips, Pill, StickyBar, type DataColumn, type DataGroup } from '@/components/ui';
import { tdGet, tdList, tdSuaBuoc, tdSuaTrangThai, tdSuaTruong, tdThemBuoc, tdThem } from '@/lib/actions/tien-do';
import { HANG_MUC_DANG_CHAY, HANG_MUC_TRANG_THAI, BUOC_TRANG_THAI, TRANG_THAI_MARK, soText, type HangMuc, type HangMucChiTiet, type Buoc } from '@/lib/tien-do-shared';

// Nền dòng theo trạng thái — cùng bảng màu với conditional formatting trên sheet, độ đậm cho nền tối.
// Đang làm = XANH LÁ đậm để nhìn lướt là thấy việc đang chạy (anh chốt 20/09/2026); Xong nhạt/trung tính để không tranh với Đang.
const TINT: Record<string, string> = {
  'Kẹt': 'rgba(255,107,107,.14)', 'Đợi số': 'rgba(230,180,80,.13)', 'Xong': 'rgba(255,255,255,.05)', 'Đang làm': 'rgba(70,220,110,.24)', 'Đang': 'rgba(70,220,110,.24)',
  'Tạm dừng': 'rgba(255,190,80,.12)', 'Chờ': 'rgba(255,190,80,.08)', 'Bỏ': 'rgba(255,255,255,.04)', 'Sẵn sàng': 'rgba(120,220,120,.06)',
};
const tint = (s: string): CSSProperties | undefined => (TINT[s] ? { background: TINT[s] } : undefined);
const DA_XONG: ReadonlySet<string> = new Set(['Xong', 'Bỏ']);   // ẩn mặc định ở cả hạng mục lẫn bước
const MARK: Record<string, string> = TRANG_THAI_MARK;
const mono: CSSProperties = { fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontSize: 11 };
const linkBtn: CSSProperties = { background: 'none', border: 0, padding: 0, color: 'var(--fg-1)', cursor: 'pointer', font: 'inherit', textAlign: 'left' };
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

export function TienDoView({ items: all, groupBy = 'nhom', projectNames = {}, projectId, stickyTop = 0, live = true, scopeProjectId }: {
  items: HangMuc[];
  /** Thời gian thực: mỗi 10s (tab đang nhìn) kéo lại danh sách + bước của các dòng đang mở. Không phụ thuộc F5. */
  live?: boolean;
  /** Trang per-project: giới hạn poll về đúng project đó (trang toàn cục để trống = mọi dự án). */
  scopeProjectId?: string;
  /** Chiều cao thanh công cụ dính của trang (barH) — tiêu đề nhóm dính ngay dưới nó khi cuộn. */
  stickyTop?: number;
  /** Lọc theo project (chip Project của trang /plays). undefined = mọi dự án. */
  projectId?: string;
  /** 'nhom' = khối theo nhóm (per-project) · 'project' = khối theo dự án rồi nhóm (/plays toàn cục) */
  groupBy?: 'nhom' | 'project';
  projectNames?: Record<string, string>;
}) {
  // Bộ lọc + dòng đang mở + drawer đều nằm trong URL (F5/share giữ nguyên): ?tdp= dự án · ?tdtt= trạng thái ·
  // ?tdo= id các hạng mục đang mở bước · ?td=hm&tdId= drawer · ô lọc bảng do DataTable lưu (tiendo.q). Ghi shallow (replaceState) như các bộ lọc khác của trang Plays.
  const sp = useSearchParams();
  const [base, setBase] = useState<HangMuc[]>(all);      // danh sách từ server: prop lúc vào trang, poll 10s ghi đè
  useEffect(() => setBase(all), [all]);
  const [extra, setExtra] = useState<HangMuc[]>([]);   // hạng mục vừa thêm ở trang này, chưa kịp về qua poll
  const [proj, setProj] = useState<string | undefined>(() => sp.get('tdp') || projectId);
  useEffect(() => { if (projectId) setProj(projectId); }, [projectId]);
  const everything = useMemo(() => [...base, ...extra.filter((e) => !base.some((a) => a.id === e.id))], [base, extra]);
  const initial = useMemo(() => (proj ? everything.filter((i) => (i.project_id ?? '—') === proj) : everything), [everything, proj]);
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]);
  const [tt, setTt] = useState<string>(() => sp.get('tdtt') || 'all');
  // Mặc định ẨN việc đã xong (hạng mục Xong/Bỏ + bước Xong/Bỏ) — anh chốt 20/09/2026; ?tdxong=1 hiện lại (F5/share giữ).
  const [showDone, setShowDone] = useState<boolean>(() => sp.get('tdxong') === '1');
  const [open, setOpen] = useState<Set<number>>(() => new Set((sp.get('tdo') ?? '').split(',').map(Number).filter(Boolean)));   // YDNI: bước chỉ mở khi bấm ▸ (nhớ trong URL)
  const modal = useModalParam('td');
  const drawerId = modal.is('hm') ? modal.numId : null;
  const setDrawerId = (id: number | null) => (id == null ? modal.close() : modal.open('hm', id));
  useEffect(() => {
    const u = new URL(window.location.href);
    const set = (k: string, v: string) => { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); };
    set('tdp', proj && proj !== projectId ? proj : ''); set('tdtt', tt === 'all' ? '' : tt); set('tdo', [...open].join(',')); set('tdxong', showDone ? '1' : '');
    if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.href);
  }, [proj, projectId, tt, open, showDone]);
  const [detail, setDetail] = useState<Record<number, HangMucChiTiet>>({});
  const [, start] = useTransition();

  const visible = items.filter((i) => (tt === 'all' ? showDone || !DA_XONG.has(i.trang_thai) : i.trang_thai === tt));
  const nDone = items.filter((i) => DA_XONG.has(i.trang_thai)).length;
  const count = (f: (i: HangMuc) => boolean) => items.filter(f).length;
  const groups = useMemo(() => {
    const key = (i: HangMuc) => (groupBy === 'project' ? `${i.project_id ?? '—'}|${i.nhom}` : i.nhom);
    const m = new Map<string, HangMuc[]>();
    for (const i of items) { const k = key(i); if (!m.has(k)) m.set(k, []); m.get(k)!.push(i); }
    return [...m.keys()];
  }, [items, groupBy]);
  const groupTitle = (k: string) => {
    if (groupBy !== 'project') return k;
    const i = k.indexOf('|'); const pid = i < 0 ? k : k.slice(0, i); const nhom = i < 0 ? '' : k.slice(i + 1);
    const pn = projectNames[pid] ?? pid;
    return nhom && nhom !== pn ? `${pn} · ${nhom}` : pn;
  };
  const inGroup = (i: HangMuc, k: string) => (groupBy === 'project' ? `${i.project_id ?? '—'}|${i.nhom}` === k : i.nhom === k);
  const all0 = (k: string) => items.find((i) => inGroup(i, k));

  const put = useCallback((y: HangMucChiTiet | null) => { if (!y) return; setItems((xs) => xs.map((i) => (i.id === y.id ? { ...i, ...y } : i))); setDetail((d) => ({ ...d, [y.id]: y })); }, []);
  // ▸ chỉ lật cờ mở: bước đã nằm sẵn trong dòng (listHangMuc kèm buoc[]) → hiện tức thì, không gọi server.
  const toggle = (id: number) => { setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  // THỜI GIAN THỰC (anh chốt 20/09/2026): CLI/phiên khác ghi → bảng đổi trong ≤10s, không F5. Poll = MỘT call (danh sách đã
  // kèm bước của mọi dòng, kể cả dòng đang mở). Bỏ qua khi tab ẩn. Ô đang gõ không bị đè: Inline chỉ đồng bộ khi không edit.
  useEffect(() => {
    if (!live) return;
    let busy = false;
    const tick = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const list = await tdList(scopeProjectId);
        setBase(list);
        setExtra((xs) => xs.filter((e) => !list.some((l) => l.id === e.id)));
      } finally { busy = false; }
    };
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, [live, scopeProjectId]);
  const suaBuoc = (buocId: number, p: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => start(async () => put(await tdSuaBuoc(buocId, p)));
  const them = (project_id: string, nhom: string, ten: string) => start(async () => { const y = await tdThem(project_id, nhom, ten); setExtra((xs) => [...xs, y]); setDetail((d) => ({ ...d, [y.id]: y })); });
  const [pickOpen, setPickOpen] = useState(false);
  const themBuoc = (id: number, text: string) => start(async () => put(await tdThemBuoc(id, text)));

  const projs = useMemo(() => [...new Set(everything.map((i) => i.project_id ?? '—'))], [everything]);
  const nAll = (pid: string) => everything.filter((i) => (i.project_id ?? '—') === pid).length;
  // Chip CHỈ cho dự án đang chạy (≥1 hạng mục Sẵn sàng/Chờ/Đang làm/Kẹt). Dự án ít mở — toàn Ý tưởng/Tạm dừng/Xong/Bỏ —
  // và dự án chưa có sổ đều nằm trong picker "＋ dự án khác…" (anh chốt 20/09/2026: "dự án ít mở thì ẩn đi"). Dự án đang
  // chọn qua URL vẫn có chip dù ngủ. Đổi trạng thái là chip tự hiện/ẩn theo poll — không cần F5.
  const dangChay = useMemo(() => projs.filter((pid) => everything.some((i) => (i.project_id ?? '—') === pid && HANG_MUC_DANG_CHAY.has(i.trang_thai))), [projs, everything]);
  const chips = proj && !dangChay.includes(proj) ? [...dangChay, proj] : dangChay;
  const others = useMemo(() => [...projs.filter((pid) => !dangChay.includes(pid)), ...Object.keys(projectNames).filter((pid) => !projs.includes(pid))]
    .sort((a, b) => (nAll(b) > 0 ? 1 : 0) - (nAll(a) > 0 ? 1 : 0) || (projectNames[a] ?? a).localeCompare(projectNames[b] ?? b)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [projectNames, projs, dangChay]);

  return (
    <div data-comp="tien-do.View">
      {/* MỘT dòng bộ lọc: dự án (toàn cục) · trạng thái · tìm — primitive nhà (FilterChips/SearchInput), không chip tự chế */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}
        title="Xong phải có kết quả · Kẹt phải ghi chờ ai/chờ gì · Đợi số = đang chạy, chỉ chờ dữ liệu · Đang chỉ khi đang làm · ▸ mở bước">
        {groupBy === 'project' && projs.length > 1 && (<>
          <FilterChips value={proj ?? 'all'} onChange={(v) => setProj(v === 'all' ? undefined : v)} urlKey="tdp"
            counts={Object.fromEntries([['all', everything.length], ...chips.map((pid) => [pid, nAll(pid)])])}
            options={[{ value: 'all', label: 'Mọi dự án' }, ...chips.map((pid) => ({ value: pid, label: projectNames[pid] ?? pid }))]} />
          {others.length > 0 && <Pill label={`＋ ${others.length} dự án khác…`} size="xs" color="var(--fg-3)" onClick={() => setPickOpen(true)} />}
          <span style={{ color: 'var(--line)' }}>|</span>
        </>)}
        <FilterChips value={tt} onChange={setTt} urlKey="tdtt"
          counts={Object.fromEntries([['all', items.length], ...HANG_MUC_TRANG_THAI.map((s) => [s, count((i) => i.trang_thai === s)])])}
          options={[{ value: 'all', label: 'Tất cả' }, ...HANG_MUC_TRANG_THAI.filter((s) => count((i) => i.trang_thai === s)).map((s) => ({ value: s, label: `${MARK[s] ?? ''} ${s}`.trim() }))]} />
        {(nDone > 0 || showDone) && <Pill label={showDone ? '✓ ẩn đã xong' : `✓ hiện ${nDone} đã xong`} size="xs" color={showDone ? 'var(--fg-2)' : 'var(--fg-3)'} onClick={() => setShowDone((v) => !v)}
          title="Hạng mục Xong/Bỏ và bước Xong/Bỏ mặc định ẩn; bấm để hiện (lưu vào URL ?tdxong=1)" />}
      </div>

      {items.length === 0 && (
        <section style={{ marginBottom: 18 }}>
          <EmptyState icon="📈" compact title={proj ? `${projectNames[proj] ?? proj}: chưa có hạng mục` : 'Chưa có hạng mục'} description="Gõ hạng mục đầu tiên bên dưới, Enter để tạo (hoặc CLI: tiendo add … --du-an <project>)" />
          {proj && proj !== '—' && <ThemHangMuc onAdd={(t) => them(proj, projectNames[proj] ?? proj, t)} />}
        </section>
      )}
      {pickOpen && (
        <ResourcePicker title="Dự án khác" hint="Ngủ (không hạng mục nào Sẵn sàng/Chờ/Đang làm/Kẹt) hoặc chưa có sổ — chọn để mở; có việc chạy là tự lên chip" items={others} getKey={(pid) => pid}
          renderItem={(pid) => ({ title: projectNames[pid] ?? pid, subtitle: nAll(pid) ? `${pid} · ${nAll(pid)} hạng mục, không việc đang chạy` : `${pid} · chưa có sổ` })}
          onPick={(pid) => { setProj(pid); setPickOpen(false); }} onClose={() => setPickOpen(false)} />
      )}

      {groups.map((g) => {
        const all = items.filter((i) => inGroup(i, g));
        const rows = visible.filter((i) => inGroup(i, g));
        const sub = `${all.length} hạng mục · ⛔ ${all.filter((i) => i.trang_thai === 'Kẹt').length} · ▶ ${all.filter((i) => i.trang_thai === 'Đang làm').length} · ✓ ${all.filter((i) => i.trang_thai === 'Xong').length}`;
        // Cột "Số" tách theo khoá — mỗi dự án đo thứ khác (ExamWeight: Vol đầu/th · CPC · Cạnh tranh · Lớp mua · Ads đối thủ;
        // Bra: một cột Số). Khoá toàn số → hẹp, canh phải; có chữ → rộng, canh trái. Không nhét chung một ô nữa.
        const soKeys = [...new Set(all.flatMap((i) => Object.keys(i.so ?? {})))];
        const numeric = (k: string) => all.every((i) => !i.so?.[k] || /^[\d.,%$\s-]+$/.test(String(i.so[k])));
        const soCols: DataColumn<HangMuc>[] = soKeys.map((k) => ({ key: 'so:' + k, group: 'so', header: k, width: numeric(k) ? 72 : 150, align: numeric(k) ? 'right' : 'left',
          title: `Số · ${k}`, cellTitle: (r) => r.so?.[k] ?? '', sortValue: (r) => (numeric(k) ? Number(String(r.so?.[k] ?? '').replace(/[^\d.-]/g, '')) || 0 : r.so?.[k] ?? ''),
          cell: (r) => <span style={{ color: 'var(--fg-2)' }}>{numeric(k) ? (r.so?.[k] ?? '') : clip(r.so?.[k] ?? '', 40)}</span> }));
        const cols: DataColumn<HangMuc>[] = [
          { key: 'x', header: '', width: 22, align: 'center', cell: (r) => <button type="button" onClick={(e) => { e.stopPropagation(); toggle(r.id); }} title={open.has(r.id) ? 'Thu bước' : `Mở ${r.tong} bước`} style={{ ...linkBtn, color: 'var(--fg-3)' }}>{open.has(r.id) ? '▾' : '▸'}</button> },
          { key: 'ma', header: 'ID', width: 44, align: 'left', sortValue: (r) => r.ma, cell: (r) => <span style={mono}>{r.ma}</span> },
          { key: 'ten', header: 'Hạng mục', width: 300, align: 'left', sortValue: (r) => r.ten, cellTitle: (r) => r.mo_ta || r.ten,
            cell: (r) => <button type="button" onClick={(e) => { e.stopPropagation(); setDrawerId(r.id); }} style={{ ...linkBtn, fontFamily: 'inherit', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.ten}</button> },
          { key: 'uu', header: 'Ưu', width: 28, align: 'center', title: '1 làm trước · 2 kế · 3 để dành · 4 gần như bỏ', sortValue: (r) => r.uu_tien, cell: (r) => r.uu_tien },
          { key: 'tt', header: 'Trạng thái', width: 92, align: 'left', sortValue: (r) => r.trang_thai, cell: (r) => <span>{MARK[r.trang_thai] ?? ''} {r.trang_thai}</span> },
          { key: 'tien', header: 'Tiến độ', width: 56, align: 'center', title: 'bước Xong / tổng', sortValue: (r) => (r.tong ? r.xong / r.tong : -1), cell: (r) => (r.tong ? `${r.xong}/${r.tong}` : '–') },
          { key: 'buoc', header: 'Bước hiện tại', width: 360, align: 'left', title: '⛔ bước kẹt → ▶ bước đang → ○ bước chưa đầu tiên', cellTitle: (r) => r.buoc_hien_tai,
            cell: (r) => <span style={{ color: r.buoc_hien_tai.startsWith('⛔') ? 'var(--neon-red, #ff6b6b)' : 'var(--fg-2)', fontFamily: 'inherit' }}>{clip(r.buoc_hien_tai, 70)}</span> },
          { key: 'ai', group: 'dh', header: 'Ai', width: 56, align: 'left', title: 'Người làm', sortValue: (r) => r.ai, cell: (r) => r.ai },
          { key: 'cong', group: 'dh', header: 'Cổng đi/dừng', width: 200, align: 'left', title: 'Điều kiện đi tiếp hay dừng', cellTitle: (r) => r.cong, cell: (r) => <span style={{ color: 'var(--fg-3)', fontFamily: 'inherit' }}>{clip(r.cong, 48)}</span> },
          { key: 'cn', group: 'dh', header: 'Cập nhật', width: 80, align: 'left', sortValue: (r) => r.cap_nhat ?? '', cell: (r) => <span style={mono}>{r.cap_nhat ?? ''}</span> },
          ...soCols,
        ];
        const dtGroups: DataGroup[] = [{ key: 'dh', label: 'Ai · Cổng · Cập nhật', defaultOn: true }, ...(soKeys.length ? [{ key: 'so', label: `Số (${soKeys.length})`, defaultOn: false }] : [])];
        return (
          <section key={g} style={{ marginBottom: 18 }}>
            {/* Tiêu đề nhóm dính ngay dưới thanh công cụ của trang: cuộn tới đâu vẫn biết đang ở dự án nào */}
            <StickyBar top={stickyTop} zIndex={5} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontWeight: 700, color: 'var(--fg-1)' }}>{groupTitle(g)}</span>
              <span style={mono}>{sub}</span>
            </StickyBar>
            {rows.length === 0 ? <EmptyState icon="📈" title="Không dòng nào khớp bộ lọc" compact /> : (
              // DataTable: nhóm cột bật/tắt ở ⚙ (Số mặc định TẮT — mỗi dự án đo thứ khác, bật khi cần), sort, ô lọc riêng, cuộn ngang gói trong khung.
              <DataTable rows={rows} columns={cols} groups={dtGroups} getRowKey={(r) => String(r.id)} persistKey={`tiendo.${g.replace(/[^\w-]+/g, '_')}`}
                minWidth={900} rowStyle={(r) => tint(r.trang_thai)} searchText={(r) => `${r.ma} ${r.ten} ${r.mo_ta} ${r.ghi_chu} ${r.goc} ${r.ai} ${soText(r.so)}`} searchPlaceholder="lọc hạng mục…"
                renderExpanded={(r) => (open.has(r.id) ? <BuocTable y={r} showDone={showDone} onToggleDone={() => setShowDone((v) => !v)} onPatch={suaBuoc} onAdd={(t) => themBuoc(r.id, t)} /> : null)} />
            )}
            {(() => { const first = all0(g); return first?.project_id ? <ThemHangMuc onAdd={(t) => them(first.project_id!, first.nhom, t)} /> : null; })()}
          </section>
        );
      })}

      {drawerId != null && <ChiTietDrawer y={detail[drawerId] ?? null} id={drawerId} onLoad={put} onClose={() => setDrawerId(null)} />}
    </div>
  );
}

// Ô thêm hạng mục ở cuối khối: gõ tên + Enter. Mã (H01…) và tab do server đặt; bước thêm sau khi mở ▸.
function ThemHangMuc({ onAdd }: { onAdd: (ten: string) => void }) {
  const [v, setV] = useState('');
  return (
    <TextField size="sm" value={v} onChange={(e) => setV(e.target.value)} placeholder="＋ hạng mục mới — gõ tên, Enter" aria-label="Thêm hạng mục"
      onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onAdd(v.trim()); setV(''); } }} style={{ marginTop: 6, borderStyle: 'dashed' }} />
  );
}

// ── bảng bước phẳng (mở ngay dưới dòng) — đọc trước, sửa tại chỗ ─────────────────────────────
function BuocTable({ y, showDone, onToggleDone, onPatch, onAdd }: { y: HangMuc; showDone: boolean; onToggleDone: () => void; onPatch: (buocId: number, p: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => void; onAdd: (text: string) => void }) {
  const [moi, setMoi] = useState('');
  const [err, setErr] = useState<Record<number, string>>({});
  const rows = showDone ? y.buoc : y.buoc.filter((b) => !DA_XONG.has(b.trang_thai));   // bước đã xong gấp vào một dòng
  const nAn = y.buoc.length - rows.length;
  const save = (b: Buoc, p: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => {
    const next = { trang_thai: p.trang_thai ?? b.trang_thai, ket_qua: p.ket_qua ?? b.ket_qua, ghi_chu: p.ghi_chu ?? b.ghi_chu };
    const e = next.trang_thai === 'Xong' && !next.ket_qua.trim() ? 'Xong phải có kết quả — điền ô Kết quả trước'
      : next.trang_thai === 'Kẹt' && !next.ghi_chu.trim() ? 'Kẹt phải ghi chờ ai / chờ gì — điền ô Ghi chú trước'
      : next.trang_thai === 'Đợi số' && !next.ghi_chu.trim() ? 'Đợi số phải ghi CHỜ SỐ NÀO, bao lâu — điền ô Ghi chú trước' : '';
    setErr((x) => ({ ...x, [b.id]: e }));
    if (!e) onPatch(b.id, p);
  };
  return (
    <div>
      {(nAn > 0 || (showDone && y.buoc.some((b) => DA_XONG.has(b.trang_thai)))) && (
        <button type="button" onClick={onToggleDone} style={{ ...linkBtn, ...mono, display: 'block', margin: '2px 0 6px' }}>
          {showDone ? '▾ ẩn bước đã xong' : `▸ ${nAn} bước đã xong · hiện`}
        </button>
      )}
      {y.buoc.length === 0 ? <span style={mono}>chưa có bước</span> : rows.length === 0 ? null : (
        <SimpleTable rows={rows} getRowKey={(b) => String(b.id)} rowStyle={(b) => tint(b.trang_thai)} columns={[
          { key: 'n', header: '#', width: 28, cell: (b) => <span style={mono}>{b.thu_tu}</span> },
          { key: 'b', header: 'Bước', cell: (b) => <div>{b.buoc}{err[b.id] && <div style={{ color: 'var(--neon-red, #ff6b6b)', fontSize: 11, marginTop: 2 }}>{err[b.id]}</div>}</div> },
          { key: 'tt', header: 'Trạng thái', width: 96, cell: (b) => (
            <SelectField size="sm" value={b.trang_thai} onChange={(e) => save(b, { trang_thai: e.target.value })} title="Chưa · Đang · Đợi số · Xong · Kẹt · Bỏ">
              {BUOC_TRANG_THAI.map((s) => <option key={s} value={s}>{MARK[s]} {s}</option>)}
            </SelectField>) },
          { key: 'd', header: 'Ngày', width: 78, cell: (b) => <span style={mono}>{b.ngay_xong ?? ''}</span> },
          { key: 'kq', header: 'Kết quả / link', width: 260, cell: (b) => <Inline value={b.ket_qua} placeholder="link / số liệu" onSave={(v) => save(b, { ket_qua: v })} /> },
          { key: 'gc', header: 'Ghi chú (Kẹt: chờ ai/gì · Đợi số: chờ số nào)', width: 240, cell: (b) => <Inline value={b.ghi_chu} placeholder={b.trang_thai === 'Kẹt' ? 'chờ ai / chờ gì' : b.trang_thai === 'Đợi số' ? 'chờ số nào, bao lâu' : 'ghi chú'} onSave={(v) => save(b, { ghi_chu: v })} /> },
        ]} />
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
        <span style={mono}>#{y.buoc.length + 1}</span>
        <div style={{ flex: 1 }}><TextField size="sm" value={moi} onChange={(e) => setMoi(e.target.value)} placeholder="Thêm bước — việc cụ thể, đủ để chat khác làm tiếp; Enter để lưu"
          onKeyDown={(e) => { if (e.key === 'Enter' && moi.trim()) { onAdd(moi.trim()); setMoi(''); } }} /></div>
      </div>
    </div>
  );
}

// Ô chữ sửa tại chỗ: hiện chữ; bấm → textarea; Enter/blur lưu, Esc bỏ.
function Inline({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => { if (!edit) setV(value); }, [value, edit]);
  if (!edit) {
    return <button type="button" onClick={() => setEdit(true)} title="Bấm để sửa"
      style={{ ...linkBtn, width: '100%', fontSize: 12, color: value ? 'var(--fg-2)' : 'var(--fg-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value || placeholder}</button>;
  }
  return <textarea autoFocus value={v} rows={Math.min(6, Math.max(2, Math.ceil(v.length / 40)))} onChange={(e) => setV(e.target.value)}
    onBlur={() => { setEdit(false); if (v !== value) onSave(v); }}
    onKeyDown={(e) => { if (e.key === 'Escape') { setV(value); setEdit(false); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
    style={{ width: '100%', background: 'var(--bg-1)', color: 'var(--fg-1)', border: '1px solid var(--neon-cyan)', borderRadius: 4, padding: '4px 6px', font: 'inherit', fontSize: 12, resize: 'vertical' }} />;
}

// ── drawer chi tiết: mô tả / ghi chú / ai / số / cổng / link / trạng thái đặt tay / nhật ký ─────
const soToLines = (so: Record<string, string>) => Object.entries(so).map(([k, v]) => `${k}: ${v}`).join('\n');
const linesToSo = (t: string): Record<string, string> => Object.fromEntries(t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, '']; }));

function ChiTietDrawer({ id, y, onLoad, onClose }: { id: number; y: HangMucChiTiet | null; onLoad: (y: HangMucChiTiet | null) => void; onClose: () => void }) {
  const [busy, start] = useTransition();
  const fetched = useRef<number | null>(null);   // mỗi id chỉ tải 1 lần dù cha render lại
  useEffect(() => { if (!y && fetched.current !== id) { fetched.current = id; tdGet(id).then(onLoad); } }, [id, y, onLoad]);
  const apply = (p: Promise<HangMucChiTiet | null>) => start(async () => onLoad(await p));
  return (
    <Drawer onClose={onClose} width={640}>
      {!y ? <div style={{ padding: 16, ...mono }}>Đang tải…</div> : (
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div>
            <div style={mono}>{y.nhom} {y.ma} · ưu tiên {y.uu_tien}{y.lan ? ` · ${y.lan}` : ''}{y.nguon ? ` · nguồn ${y.nguon}` : ''}</div>
            <h2 style={{ margin: '2px 0 0', fontSize: 18 }}>{y.ten}</h2>
            {y.goc && <div style={{ color: 'var(--fg-3)', fontSize: 12, marginTop: 2 }}>Gốc: {y.goc}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SelectField label="Trạng thái hạng mục (đặt tay — không tự nhảy theo bước)" size="sm" value={y.trang_thai} disabled={busy}
              onChange={(e) => apply(tdSuaTrangThai(y.id, e.target.value))}>
              {HANG_MUC_TRANG_THAI.map((s) => <option key={s} value={s}>{MARK[s]} {s}</option>)}
            </SelectField>
            <TextField label="Ai (anh / em / tên người)" size="sm" defaultValue={y.ai} onBlur={(e) => { if (e.target.value !== y.ai) apply(tdSuaTruong(y.id, { ai: e.target.value })); }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <TextAreaField label="Số — mỗi dòng 'tên: giá trị' (Vol đầu/th: 12k)" size="sm" defaultValue={soToLines(y.so)} rows={3}
              onBlur={(e) => { if (e.target.value !== soToLines(y.so)) apply(tdSuaTruong(y.id, { so: linesToSo(e.target.value) })); }} />
            <TextAreaField label="Cổng đi/dừng — điều kiện đi tiếp hay dừng" size="sm" defaultValue={y.cong} rows={3}
              onBlur={(e) => { if (e.target.value !== y.cong) apply(tdSuaTruong(y.id, { cong: e.target.value })); }} />
          </div>
          <TextField label="Link (web / store / repo)" size="sm" defaultValue={y.link} onBlur={(e) => { if (e.target.value !== y.link) apply(tdSuaTruong(y.id, { link: e.target.value })); }} />
          <TextAreaField label="Mô tả" size="sm" defaultValue={y.mo_ta} rows={4} onBlur={(e) => { if (e.target.value !== y.mo_ta) apply(tdSuaTruong(y.id, { mo_ta: e.target.value })); }} />
          <TextAreaField label="Ghi chú (lý do ưu tiên, rủi ro, quyết định kèm ngày)" size="sm" defaultValue={y.ghi_chu} rows={4} onBlur={(e) => { if (e.target.value !== y.ghi_chu) apply(tdSuaTruong(y.id, { ghi_chu: e.target.value })); }} />
          {y.nhat_ky.length > 0 && (
            <Panel title="Nhật ký" subtitle="mới nhất trước">
              <ul style={{ margin: 0, padding: '0 0 0 16px', color: 'var(--fg-2)', fontSize: 12, lineHeight: 1.7 }}>
                {y.nhat_ky.slice(0, 20).map((n, i) => <li key={i}><span style={mono}>{String(n.ts).slice(0, 16).replace('T', ' ')}</span> · {n.noi_dung}</li>)}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </Drawer>
  );
}
