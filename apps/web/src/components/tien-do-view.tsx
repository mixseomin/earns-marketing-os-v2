'use client';
// View "📈 Tiến độ" của trang Plays (per-project và /plays toàn cục) — sổ tiến độ: hạng mục → bước → trạng thái.
// Đọc như sheet "Bra Shop 2026": mỗi nhóm một khối, dòng tô màu theo trạng thái, bấm ▸ mở bảng bước phẳng ngay dưới
// dòng (# · bước · trạng thái · ngày · kết quả · ghi chú) và sửa tại chỗ. Drawer chỉ cho mô tả/ghi chú/Ai/Số/Cổng/nhật ký.
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { Drawer, Panel, SimpleTable, TextField, TextAreaField, SelectField, EmptyState } from '@/components/ui';
import { tdGet, tdSuaBuoc, tdSuaTrangThai, tdSuaTruong, tdThemBuoc } from '@/lib/actions/tien-do';
import { HANG_MUC_TRANG_THAI, BUOC_TRANG_THAI, soText, type HangMuc, type HangMucChiTiet, type Buoc } from '@/lib/tien-do-shared';

// Nền dòng theo trạng thái — cùng bảng màu với conditional formatting trên sheet, độ đậm cho nền tối.
const TINT: Record<string, string> = {
  'Kẹt': 'rgba(255,107,107,.14)', 'Xong': 'rgba(120,220,120,.11)', 'Đang làm': 'rgba(90,180,255,.12)', 'Đang': 'rgba(90,180,255,.12)',
  'Tạm dừng': 'rgba(255,190,80,.12)', 'Chờ': 'rgba(255,190,80,.08)', 'Bỏ': 'rgba(255,255,255,.04)', 'Sẵn sàng': 'rgba(120,220,120,.05)',
};
const tint = (s: string): CSSProperties | undefined => (TINT[s] ? { background: TINT[s] } : undefined);
const MARK: Record<string, string> = { 'Kẹt': '⛔', 'Xong': '✓', 'Đang làm': '▶', 'Đang': '▶', 'Tạm dừng': '⏸', 'Chờ': '⏳', 'Bỏ': '×', 'Chưa': '○', 'Ý tưởng': '○', 'Sẵn sàng': '◔' };
const mono: CSSProperties = { fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontSize: 11 };
const linkBtn: CSSProperties = { background: 'none', border: 0, padding: 0, color: 'var(--fg-1)', cursor: 'pointer', font: 'inherit', textAlign: 'left' };
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

export function TienDoView({ items: all, groupBy = 'nhom', projectNames = {}, projectId }: {
  items: HangMuc[];
  /** Lọc theo project (chip Project của trang /plays). undefined = mọi dự án. */
  projectId?: string;
  /** 'nhom' = khối theo nhóm (per-project) · 'project' = khối theo dự án rồi nhóm (/plays toàn cục) */
  groupBy?: 'nhom' | 'project';
  projectNames?: Record<string, string>;
}) {
  const [proj, setProj] = useState<string | undefined>(projectId);
  useEffect(() => setProj(projectId), [projectId]);
  const initial = useMemo(() => (proj ? all.filter((i) => (i.project_id ?? '—') === proj) : all), [all, proj]);
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]);
  const [tt, setTt] = useState<string>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<number>>(() => new Set(initial.filter((i) => i.trang_thai === 'Kẹt' || i.trang_thai === 'Đang làm').map((i) => i.id)));
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, HangMucChiTiet>>({});
  const [, start] = useTransition();

  const visible = items.filter((i) => (tt === 'all' || i.trang_thai === tt)
    && (!q || `${i.ma} ${i.ten} ${i.mo_ta} ${i.ghi_chu} ${i.goc} ${i.ai} ${soText(i.so)}`.toLowerCase().includes(q.toLowerCase())));
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

  const put = (y: HangMucChiTiet | null) => { if (!y) return; setItems((xs) => xs.map((i) => (i.id === y.id ? { ...i, ...y } : i))); setDetail((d) => ({ ...d, [y.id]: y })); };
  const load = (id: number) => { if (!detail[id]) tdGet(id).then(put); };
  const toggle = (id: number) => { setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else { n.add(id); load(id); } return n; }); };
  const openOnce = useState(() => [...open])[0];
  useEffect(() => { openOnce.forEach(load); }, [openOnce]); // nạp bước cho các dòng mở sẵn lúc vào trang
  const suaBuoc = (buocId: number, p: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => start(async () => put(await tdSuaBuoc(buocId, p)));
  const themBuoc = (id: number, text: string) => start(async () => put(await tdThemBuoc(id, text)));

  const projs = useMemo(() => [...new Set(all.map((i) => i.project_id ?? '—'))], [all]);
  const nAll = (pid: string) => all.filter((i) => (i.project_id ?? '—') === pid).length;
  const chipStyle = (on: boolean): CSSProperties => ({ background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--bg-0)' : 'var(--fg-3)', border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'), borderRadius: 999, padding: '2px 9px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' });

  return (
    <div data-comp="tien-do.View">
      {/* MỘT dòng bộ lọc: project (toàn cục) · trạng thái · tìm — không chiếm chỗ của bảng */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}
        title="Xong phải có kết quả · Kẹt phải ghi chờ ai/chờ gì · Đang chỉ khi đang làm · ▸ mở bước">
        {groupBy === 'project' && projs.length > 1 && (<>
          <button type="button" style={chipStyle(!proj)} onClick={() => setProj(undefined)}>Mọi dự án {all.length}</button>
          {projs.map((pid) => <button key={pid} type="button" style={chipStyle(proj === pid)} onClick={() => setProj(proj === pid ? undefined : pid)}>{projectNames[pid] ?? pid} {nAll(pid)}</button>)}
          <span style={{ color: 'var(--line)' }}>|</span>
        </>)}
        <button type="button" style={chipStyle(tt === 'all')} onClick={() => setTt('all')}>Tất cả {items.length}</button>
        {HANG_MUC_TRANG_THAI.filter((s) => count((i) => i.trang_thai === s)).map((s) => (
          <button key={s} type="button" style={chipStyle(tt === s)} onClick={() => setTt(tt === s ? 'all' : s)}>{MARK[s] ?? ''} {s} {count((i) => i.trang_thai === s)}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="tìm…" aria-label="Tìm hạng mục"
          style={{ marginLeft: 'auto', width: 160, background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 999, padding: '3px 10px', font: 'inherit', fontSize: 11 }} />
      </div>

      {items.length === 0 && <EmptyState icon="📈" title="Chưa có hạng mục" description={'Thêm bằng CLI: tiendo add "Tên hạng mục" --du-an <project> --buoc … — hoặc nhập từ sheet: tiendo import-sheet'} />}

      {groups.map((g) => {
        const all = items.filter((i) => inGroup(i, g));
        const rows = visible.filter((i) => inGroup(i, g));
        const sub = `${all.length} hạng mục · ⛔ ${all.filter((i) => i.trang_thai === 'Kẹt').length} · ▶ ${all.filter((i) => i.trang_thai === 'Đang làm').length} · ✓ ${all.filter((i) => i.trang_thai === 'Xong').length}`;
        return (
          <Panel key={g} title={groupTitle(g)} subtitle={sub} style={{ marginBottom: 16 }}>
            {rows.length === 0 ? <EmptyState icon="📈" title="Không dòng nào khớp bộ lọc" compact /> : (
              <SimpleTable rows={rows} getRowKey={(r) => String(r.id)} rowStyle={(r) => tint(r.trang_thai)}
                renderExpanded={(r) => (open.has(r.id) ? <BuocTable y={detail[r.id]} onPatch={suaBuoc} onAdd={(t) => themBuoc(r.id, t)} /> : null)}
                columns={[
                  { key: 'x', header: '', width: 22, cell: (r) => <button type="button" onClick={() => toggle(r.id)} title={open.has(r.id) ? 'Thu bước' : 'Mở bước'} style={{ ...linkBtn, color: 'var(--fg-3)' }}>{open.has(r.id) ? '▾' : '▸'}</button> },
                  { key: 'ma', header: 'ID', width: 44, cell: (r) => <span style={mono}>{r.ma}</span> },
                  { key: 'ten', header: 'Hạng mục', cell: (r) => (
                    <div>
                      <button type="button" onClick={() => setDrawerId(r.id)} style={linkBtn} title="Mở chi tiết (mô tả, ghi chú, ai, số, cổng, nhật ký)">{r.ten}</button>
                      {r.mo_ta && <div style={{ color: 'var(--fg-3)', fontSize: 11, marginTop: 2 }}>{clip(r.mo_ta, 140)}</div>}
                    </div>) },
                  { key: 'uu', header: 'Ưu', width: 28, align: 'center', title: '1 làm trước · 2 kế · 3 để dành · 4 gần như bỏ', cell: (r) => r.uu_tien },
                  { key: 'tt', header: 'Trạng thái', width: 92, cell: (r) => <span>{MARK[r.trang_thai] ?? ''} {r.trang_thai}</span> },
                  { key: 'tien', header: 'Tiến độ', width: 56, align: 'center', title: 'bước Xong / tổng', cell: (r) => (r.tong ? `${r.xong}/${r.tong}` : '–') },
                  { key: 'buoc', header: 'Bước hiện tại', title: '⛔ bước kẹt → ▶ bước đang → ○ bước chưa đầu tiên', cell: (r) => <span style={{ color: r.buoc_hien_tai.startsWith('⛔') ? 'var(--neon-red, #ff6b6b)' : 'var(--fg-2)' }}>{r.buoc_hien_tai}</span> },
                  { key: 'ai', header: 'Ai', width: 48, title: 'Người làm: anh / em / tên người', cell: (r) => <span style={{ color: 'var(--fg-2)', fontSize: 12 }}>{r.ai}</span> },
                  { key: 'so', header: 'Số', width: 150, title: 'Chỉ số của hạng mục (mỗi dự án đo thứ khác)', cell: (r) => <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{clip(soText(r.so), 90)}</span> },
                  { key: 'cong', header: 'Cổng đi/dừng', width: 150, title: 'Điều kiện để đi tiếp hay dừng', cell: (r) => <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{clip(r.cong, 90)}</span> },
                  { key: 'cn', header: 'Cập nhật', width: 78, cell: (r) => <span style={mono}>{r.cap_nhat ?? ''}</span> },
                ]} />
            )}
          </Panel>
        );
      })}

      {drawerId != null && <ChiTietDrawer y={detail[drawerId] ?? null} id={drawerId} onLoad={put} onClose={() => setDrawerId(null)} />}
    </div>
  );
}

// ── bảng bước phẳng (mở ngay dưới dòng) — đọc trước, sửa tại chỗ ─────────────────────────────
function BuocTable({ y, onPatch, onAdd }: { y: HangMucChiTiet | undefined; onPatch: (buocId: number, p: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => void; onAdd: (text: string) => void }) {
  const [moi, setMoi] = useState('');
  const [err, setErr] = useState<Record<number, string>>({});
  if (!y) return <span style={mono}>Đang tải bước…</span>;
  const save = (b: Buoc, p: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => {
    const next = { trang_thai: p.trang_thai ?? b.trang_thai, ket_qua: p.ket_qua ?? b.ket_qua, ghi_chu: p.ghi_chu ?? b.ghi_chu };
    const e = next.trang_thai === 'Xong' && !next.ket_qua.trim() ? 'Xong phải có kết quả — điền ô Kết quả trước'
      : next.trang_thai === 'Kẹt' && !next.ghi_chu.trim() ? 'Kẹt phải ghi chờ ai / chờ gì — điền ô Ghi chú trước' : '';
    setErr((x) => ({ ...x, [b.id]: e }));
    if (!e) onPatch(b.id, p);
  };
  return (
    <div>
      {y.buoc.length === 0 ? <span style={mono}>chưa có bước</span> : (
        <SimpleTable rows={y.buoc} getRowKey={(b) => String(b.id)} rowStyle={(b) => tint(b.trang_thai)} columns={[
          { key: 'n', header: '#', width: 28, cell: (b) => <span style={mono}>{b.thu_tu}</span> },
          { key: 'b', header: 'Bước', cell: (b) => <div>{b.buoc}{err[b.id] && <div style={{ color: 'var(--neon-red, #ff6b6b)', fontSize: 11, marginTop: 2 }}>{err[b.id]}</div>}</div> },
          { key: 'tt', header: 'Trạng thái', width: 96, cell: (b) => (
            <SelectField size="sm" value={b.trang_thai} onChange={(e) => save(b, { trang_thai: e.target.value })} title="Chưa · Đang · Xong · Kẹt · Bỏ">
              {BUOC_TRANG_THAI.map((s) => <option key={s} value={s}>{MARK[s]} {s}</option>)}
            </SelectField>) },
          { key: 'd', header: 'Ngày', width: 78, cell: (b) => <span style={mono}>{b.ngay_xong ?? ''}</span> },
          { key: 'kq', header: 'Kết quả / link', width: 260, cell: (b) => <Inline value={b.ket_qua} placeholder="link / số liệu" onSave={(v) => save(b, { ket_qua: v })} /> },
          { key: 'gc', header: 'Ghi chú (Kẹt: chờ ai / chờ gì)', width: 240, cell: (b) => <Inline value={b.ghi_chu} placeholder={b.trang_thai === 'Kẹt' ? 'chờ ai / chờ gì' : 'ghi chú'} onSave={(v) => save(b, { ghi_chu: v })} /> },
        ]} />
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
        <span style={mono}>#{y.buoc.length + 1}</span>
        <input value={moi} onChange={(e) => setMoi(e.target.value)} placeholder="Thêm bước — việc cụ thể, đủ để chat khác làm tiếp; Enter để lưu"
          onKeyDown={(e) => { if (e.key === 'Enter' && moi.trim()) { onAdd(moi.trim()); setMoi(''); } }}
          style={{ flex: 1, background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 4, padding: '4px 8px', font: 'inherit', fontSize: 12 }} />
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
            <SelectField label="Trạng thái hạng mục (Tạm dừng/Bỏ đặt tay; còn lại tự nhảy theo bước)" size="sm" value={y.trang_thai} disabled={busy}
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
