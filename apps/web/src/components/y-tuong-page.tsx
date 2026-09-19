'use client';
// /y-tuong — sổ ý tưởng & bước (gốc của Google Sheet "Projects IDEAS 2026" từ 20/09/2026).
// Đọc như sheet: mỗi NHÓM một khối (= tab chính), dòng tô màu theo trạng thái, bấm ▸ mở bảng bước phẳng ngay dưới
// dòng (# · bước · trạng thái · ngày · kết quả · ghi chú) và sửa tại chỗ. Drawer chỉ cho mô tả/ghi chú/link/nhật ký.
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { Drawer, FilterChips, ListToolbar, Panel, SimpleTable, TextField, TextAreaField, SelectField, EmptyState } from '@/components/ui';
import { ytGet, ytSuaBuoc, ytSuaTrangThai, ytSuaTruong, ytThemBuoc } from '@/lib/actions/y-tuong';
import { Y_TUONG_TRANG_THAI, BUOC_TRANG_THAI, type YTuong, type YTuongChiTiet, type Buoc } from '@/lib/y-tuong-shared';

// Nền dòng theo trạng thái — cùng bảng màu với conditional formatting trên sheet, độ đậm cho nền tối.
const TINT: Record<string, string> = {
  'Kẹt': 'rgba(255,107,107,.14)', 'Xong': 'rgba(120,220,120,.11)', 'Đang làm': 'rgba(90,180,255,.12)', 'Đang': 'rgba(90,180,255,.12)',
  'Tạm dừng': 'rgba(255,190,80,.12)', 'Bỏ': 'rgba(255,255,255,.04)', 'Sẵn sàng': 'rgba(120,220,120,.05)',
};
const tint = (s: string): CSSProperties | undefined => (TINT[s] ? { background: TINT[s] } : undefined);
const MARK: Record<string, string> = { 'Kẹt': '⛔', 'Xong': '✓', 'Đang làm': '▶', 'Đang': '▶', 'Tạm dừng': '⏸', 'Bỏ': '×', 'Chưa': '○', 'Ý tưởng': '○', 'Sẵn sàng': '◔' };
const mono: CSSProperties = { fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontSize: 11 };
const linkBtn: CSSProperties = { background: 'none', border: 0, padding: 0, color: 'var(--fg-1)', cursor: 'pointer', font: 'inherit', textAlign: 'left' };

export function YTuongPage({ items: initial }: { items: YTuong[] }) {
  const [items, setItems] = useState(initial);
  const [tt, setTt] = useState<string>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<number>>(() => new Set(initial.filter((i) => i.trang_thai === 'Kẹt' || i.trang_thai === 'Đang làm').map((i) => i.id)));
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, YTuongChiTiet>>({});
  const [, start] = useTransition();

  const nhoms = useMemo(() => [...new Set(items.map((i) => i.nhom))], [items]);
  const visible = items.filter((i) => (tt === 'all' || i.trang_thai === tt) && (!q || `${i.ma} ${i.ten} ${i.mo_ta} ${i.ghi_chu} ${i.goc}`.toLowerCase().includes(q.toLowerCase())));
  const count = (f: (i: YTuong) => boolean) => items.filter(f).length;

  // cập nhật 1 ý tưởng ở cả danh sách + cache chi tiết
  const put = (y: YTuongChiTiet | null) => { if (!y) return; setItems((xs) => xs.map((i) => (i.id === y.id ? { ...i, ...y } : i))); setDetail((d) => ({ ...d, [y.id]: y })); };
  const load = (id: number) => { if (!detail[id]) ytGet(id).then(put); };
  const toggle = (id: number) => { setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else { n.add(id); load(id); } return n; }); };
  useEffect(() => { open.forEach(load); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const suaBuoc = (buocId: number, p: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => start(async () => put(await ytSuaBuoc(buocId, p)));
  const themBuoc = (id: number, text: string) => start(async () => put(await ytThemBuoc(id, text)));

  return (
    <div>
      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="Tìm mã, tên, mô tả, trò gốc…">
        <FilterChips value={tt} onChange={setTt}
          counts={Object.fromEntries([['all', items.length], ...Y_TUONG_TRANG_THAI.map((s) => [s, count((i) => i.trang_thai === s)])])}
          options={[{ value: 'all', label: 'Tất cả' }, ...Y_TUONG_TRANG_THAI.filter((s) => count((i) => i.trang_thai === s)).map((s) => ({ value: s, label: `${MARK[s] ?? ''} ${s}`.trim() }))]} />
        <span style={{ ...mono, marginLeft: 'auto' }}>Xong phải có kết quả · Kẹt phải ghi chờ gì · Đang chỉ khi đang làm · bấm ▸ để mở bước</span>
      </ListToolbar>

      {nhoms.map((nhom) => {
        const rows = visible.filter((i) => i.nhom === nhom);
        const all = items.filter((i) => i.nhom === nhom);
        const sub = `${all.length} ý tưởng · ⛔ ${all.filter((i) => i.trang_thai === 'Kẹt').length} · ▶ ${all.filter((i) => i.trang_thai === 'Đang làm').length} · ✓ ${all.filter((i) => i.trang_thai === 'Xong').length}`;
        return (
          <Panel key={nhom} title={nhom} subtitle={sub} style={{ marginBottom: 16 }}>
            {rows.length === 0 ? <EmptyState icon="💡" title={q || tt !== 'all' ? 'Không dòng nào khớp bộ lọc' : 'Chưa có ý tưởng'} compact /> : (
              <SimpleTable rows={rows} getRowKey={(r) => String(r.id)} rowStyle={(r) => tint(r.trang_thai)}
                renderExpanded={(r) => (open.has(r.id) ? <BuocTable y={detail[r.id]} onPatch={suaBuoc} onAdd={(t) => themBuoc(r.id, t)} /> : null)}
                columns={[
                  { key: 'x', header: '', width: 24, cell: (r) => <button type="button" onClick={() => toggle(r.id)} title={open.has(r.id) ? 'Thu bước' : 'Mở bước'} style={{ ...linkBtn, color: 'var(--fg-3)' }}>{open.has(r.id) ? '▾' : '▸'}</button> },
                  { key: 'ma', header: 'Mã', width: 44, cell: (r) => <span style={mono}>{r.ma}</span> },
                  { key: 'ten', header: 'Ý tưởng', cell: (r) => (
                    <div>
                      <button type="button" onClick={() => setDrawerId(r.id)} style={linkBtn} title="Mở chi tiết (mô tả, ghi chú, link, nhật ký)">{r.ten}</button>
                      {r.mo_ta && <div style={{ color: 'var(--fg-3)', fontSize: 11, marginTop: 2 }}>{r.mo_ta.length > 140 ? r.mo_ta.slice(0, 140) + '…' : r.mo_ta}</div>}
                    </div>) },
                  { key: 'uu', header: 'Ưu', width: 30, align: 'center', title: '1 làm trước · 2 kế · 3 để dành · 4 gần như bỏ', cell: (r) => r.uu_tien },
                  { key: 'tt', header: 'Trạng thái', width: 96, cell: (r) => <span>{MARK[r.trang_thai] ?? ''} {r.trang_thai}</span> },
                  { key: 'tien', header: 'Tiến độ', width: 58, align: 'center', title: 'bước Xong / tổng', cell: (r) => (r.tong ? `${r.xong}/${r.tong}` : '–') },
                  { key: 'buoc', header: 'Bước hiện tại', title: '⛔ bước kẹt → ▶ bước đang → ○ bước chưa đầu tiên', cell: (r) => <span style={{ color: r.buoc_hien_tai.startsWith('⛔') ? 'var(--neon-red, #ff6b6b)' : 'var(--fg-2)' }}>{r.buoc_hien_tai}</span> },
                  { key: 'gc', header: 'Ghi chú', width: 220, cell: (r) => <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{r.ghi_chu.length > 120 ? r.ghi_chu.slice(0, 120) + '…' : r.ghi_chu}</span> },
                  { key: 'cn', header: 'Cập nhật', width: 80, cell: (r) => <span style={mono}>{r.cap_nhat ?? ''}</span> },
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
function BuocTable({ y, onPatch, onAdd }: { y: YTuongChiTiet | undefined; onPatch: (buocId: number, p: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => void; onAdd: (text: string) => void }) {
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
          { key: 'tt', header: 'Trạng thái', width: 88, cell: (b) => (
            <select value={b.trang_thai} onChange={(e) => save(b, { trang_thai: e.target.value })} title="Chưa · Đang · Xong · Kẹt · Bỏ"
              style={{ background: 'transparent', color: 'var(--fg-1)', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 4px', font: 'inherit', fontSize: 12 }}>
              {BUOC_TRANG_THAI.map((s) => <option key={s} value={s}>{MARK[s]} {s}</option>)}
            </select>) },
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

// Ô chữ sửa tại chỗ: hiện chữ; bấm → input; Enter/blur lưu, Esc bỏ.
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

// ── drawer chi tiết: mô tả / ghi chú / link / trạng thái đặt tay / nhật ký ──────────────────
function ChiTietDrawer({ id, y, onLoad, onClose }: { id: number; y: YTuongChiTiet | null; onLoad: (y: YTuongChiTiet | null) => void; onClose: () => void }) {
  const [busy, start] = useTransition();
  useEffect(() => { if (!y) ytGet(id).then(onLoad); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = (p: Promise<YTuongChiTiet | null>) => start(async () => onLoad(await p));
  return (
    <Drawer onClose={onClose} width={640}>
      {!y ? <div style={{ padding: 16, ...mono }}>Đang tải…</div> : (
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div>
            <div style={mono}>{y.nhom} {y.ma} · ưu tiên {y.uu_tien} · {y.lan}</div>
            <h2 style={{ margin: '2px 0 0', fontSize: 18 }}>{y.ten}</h2>
            {y.goc && <div style={{ color: 'var(--fg-3)', fontSize: 12, marginTop: 2 }}>Trò gốc: {y.goc}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SelectField label="Trạng thái ý tưởng (Tạm dừng/Bỏ đặt tay; còn lại tự nhảy theo bước)" size="sm" value={y.trang_thai} disabled={busy}
              onChange={(e) => apply(ytSuaTrangThai(y.id, e.target.value))}>
              {Y_TUONG_TRANG_THAI.map((s) => <option key={s} value={s}>{MARK[s]} {s}</option>)}
            </SelectField>
            <TextField label="Link (web / App Store / repo)" size="sm" defaultValue={y.link} onBlur={(e) => { if (e.target.value !== y.link) apply(ytSuaTruong(y.id, { link: e.target.value })); }} />
          </div>
          <TextAreaField label="Mô tả (cơ chế · cách kiếm tiền · khác gì trò gốc)" size="sm" defaultValue={y.mo_ta} rows={4}
            onBlur={(e) => { if (e.target.value !== y.mo_ta) apply(ytSuaTruong(y.id, { mo_ta: e.target.value })); }} />
          <TextAreaField label="Ghi chú (lý do ưu tiên, rủi ro, quyết định kèm ngày)" size="sm" defaultValue={y.ghi_chu} rows={4}
            onBlur={(e) => { if (e.target.value !== y.ghi_chu) apply(ytSuaTruong(y.id, { ghi_chu: e.target.value })); }} />
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
