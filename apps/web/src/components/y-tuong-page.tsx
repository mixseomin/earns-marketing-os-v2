'use client';
// /y-tuong — sổ ý tưởng & bước (gốc của Google Sheet "Projects IDEAS 2026" từ 20/09/2026).
// Một màn: lọc nhóm + trạng thái → bảng → bấm dòng mở Drawer (bước, trạng thái, kết quả, nhật ký). Ghi qua server actions.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Drawer, FilterChips, ListToolbar, Panel, SimpleTable, StatusPill, SelectField, TextField, TextAreaField, EmptyState, type StatusMeta } from '@/components/ui';
import { ytGet, ytSuaBuoc, ytSuaTrangThai, ytSuaTruong, ytThemBuoc } from '@/lib/actions/y-tuong';
import { Y_TUONG_TRANG_THAI, BUOC_TRANG_THAI, type YTuong, type YTuongChiTiet, type Buoc } from '@/lib/y-tuong-shared';

const META: Record<string, StatusMeta> = {
  'Ý tưởng': { icon: '○', label: 'Ý tưởng', color: 'var(--fg-3)' },
  'Sẵn sàng': { icon: '◔', label: 'Sẵn sàng', color: 'var(--fg-2)' },
  'Đang làm': { icon: '▶', label: 'Đang làm', color: 'var(--neon-cyan)' },
  'Kẹt': { icon: '⛔', label: 'Kẹt', color: 'var(--neon-red, #ff6b6b)' },
  'Tạm dừng': { icon: '⏸', label: 'Tạm dừng', color: 'var(--neon-amber)' },
  'Xong': { icon: '✓', label: 'Xong', color: 'var(--neon-lime)' },
  'Bỏ': { icon: '×', label: 'Bỏ', color: 'var(--fg-3)' },
  'Chưa': { icon: '○', label: 'Chưa', color: 'var(--fg-3)' },
  'Đang': { icon: '▶', label: 'Đang', color: 'var(--neon-cyan)' },
};
const meta = (s: string): StatusMeta => META[s] ?? { icon: '·', label: s, color: 'var(--fg-3)' };

export function YTuongPage({ items: initial }: { items: YTuong[] }) {
  const [items, setItems] = useState(initial);
  const [nhom, setNhom] = useState<string>('all');
  const [tt, setTt] = useState<string>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const nhoms = useMemo(() => [...new Set(items.map((i) => i.nhom))], [items]);
  const filtered = items.filter((i) => (nhom === 'all' || i.nhom === nhom) && (tt === 'all' || i.trang_thai === tt)
    && (!q || `${i.ma} ${i.ten} ${i.mo_ta} ${i.ghi_chu}`.toLowerCase().includes(q.toLowerCase())));
  const count = (f: (i: YTuong) => boolean) => items.filter(f).length;

  const refresh = (y: YTuongChiTiet | null) => { if (y) setItems((xs) => xs.map((i) => (i.id === y.id ? { ...i, ...y } : i))); };

  return (
    <div>
      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="Tìm mã, tên, mô tả…">
        <FilterChips value={nhom} onChange={setNhom} counts={Object.fromEntries([['all', items.length], ...nhoms.map((n) => [n, count((i) => i.nhom === n)])])}
          options={[{ value: 'all', label: 'Mọi nhóm' }, ...nhoms.map((n) => ({ value: n, label: n }))]} />
        <FilterChips value={tt} onChange={setTt} counts={Object.fromEntries([['all', items.length], ...Y_TUONG_TRANG_THAI.map((s) => [s, count((i) => i.trang_thai === s)])])}
          options={[{ value: 'all', label: 'Mọi trạng thái' }, ...Y_TUONG_TRANG_THAI.filter((s) => count((i) => i.trang_thai === s)).map((s) => ({ value: s, label: s }))]} />
      </ListToolbar>
      <Panel title="Ý tưởng" subtitle={`${filtered.length} dòng · Xong phải có kết quả · Kẹt phải ghi chờ gì · Đang chỉ khi đang làm`}>
        {filtered.length === 0 ? <EmptyState icon="💡" title="Không có ý tưởng khớp bộ lọc" /> : (
          <SimpleTable rows={filtered} getRowKey={(r) => String(r.id)} columns={[
            { key: 'ma', header: 'Mã', width: 56, cell: (r) => <button type="button" onClick={() => setOpenId(r.id)} style={linkBtn}>{r.nhom} {r.ma}</button> },
            { key: 'ten', header: 'Ý tưởng', cell: (r) => <button type="button" onClick={() => setOpenId(r.id)} style={{ ...linkBtn, textAlign: 'left' }}>{r.ten}</button> },
            { key: 'uu', header: 'Ưu', width: 36, align: 'center', cell: (r) => r.uu_tien },
            { key: 'tt', header: 'Trạng thái', width: 110, cell: (r) => <StatusPill meta={meta(r.trang_thai)} /> },
            { key: 'tien', header: 'Tiến độ', width: 64, align: 'center', cell: (r) => (r.tong ? `${r.xong}/${r.tong}` : '–') },
            { key: 'buoc', header: 'Bước hiện tại', cell: (r) => <span style={{ color: r.buoc_hien_tai.startsWith('⛔') ? 'var(--neon-red, #ff6b6b)' : 'var(--fg-2)' }}>{r.buoc_hien_tai}</span> },
            { key: 'cn', header: 'Cập nhật', width: 88, cell: (r) => <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--mono)' }}>{r.cap_nhat ?? ''}</span> },
          ]} />
        )}
      </Panel>
      {openId != null && <YTuongDrawer id={openId} onClose={() => setOpenId(null)} onChange={refresh} />}
    </div>
  );
}

const linkBtn: React.CSSProperties = { background: 'none', border: 0, padding: 0, color: 'var(--fg-1)', cursor: 'pointer', font: 'inherit' };

function YTuongDrawer({ id, onClose, onChange }: { id: number; onClose: () => void; onChange: (y: YTuongChiTiet | null) => void }) {
  const [y, setY] = useState<YTuongChiTiet | null>(null);
  const [moi, setMoi] = useState('');
  const [busy, start] = useTransition();
  useEffect(() => { ytGet(id).then(setY); }, [id]);
  const apply = (p: Promise<YTuongChiTiet | null>) => start(async () => { const r = await p; if (r) { setY(r); onChange(r); } });

  return (
    <Drawer onClose={onClose} width={760}>
      {!y ? <div style={{ padding: 16, color: 'var(--fg-3)' }}>Đang tải…</div> : (
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--fg-3)' }}>{y.nhom} {y.ma}</span>
            <h2 style={{ margin: 0, fontSize: 18 }}>{y.ten}</h2>
            <StatusPill meta={meta(y.trang_thai)} />
            <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>ưu tiên {y.uu_tien} · {y.lan}{y.goc ? ` · gốc: ${y.goc}` : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SelectField label="Trạng thái ý tưởng (đặt tay; Tạm dừng/Bỏ giữ nguyên, còn lại tự nhảy theo bước)" size="sm" value={y.trang_thai} disabled={busy}
              onChange={(e) => apply(ytSuaTrangThai(y.id, e.target.value))}>
              {Y_TUONG_TRANG_THAI.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectField>
            <TextField label="Link (web / App Store / repo)" size="sm" defaultValue={y.link} onBlur={(e) => { if (e.target.value !== y.link) apply(ytSuaTruong(y.id, { link: e.target.value })); }} />
          </div>
          <TextAreaField label="Mô tả" size="sm" defaultValue={y.mo_ta} rows={3} onBlur={(e) => { if (e.target.value !== y.mo_ta) apply(ytSuaTruong(y.id, { mo_ta: e.target.value })); }} />
          <TextAreaField label="Ghi chú (lý do ưu tiên, rủi ro, quyết định kèm ngày)" size="sm" defaultValue={y.ghi_chu} rows={3} onBlur={(e) => { if (e.target.value !== y.ghi_chu) apply(ytSuaTruong(y.id, { ghi_chu: e.target.value })); }} />

          <Panel title="Các bước" subtitle={`${y.buoc.filter((b) => b.trang_thai === 'Xong').length}/${y.buoc.length} xong`}>
            <div style={{ display: 'grid', gap: 8 }}>
              {y.buoc.map((b) => <BuocRow key={b.id} b={b} busy={busy} onPatch={(p) => apply(ytSuaBuoc(b.id, p))} />)}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <TextField label={`Bước #${y.buoc.length + 1}`} size="sm" value={moi} onChange={(e) => setMoi(e.target.value)} placeholder="Việc cụ thể, đủ để chat khác làm tiếp" style={{ minWidth: 420 }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && moi.trim()) { apply(ytThemBuoc(y.id, moi.trim())); setMoi(''); } }} />
                <button type="button" className="btn" disabled={!moi.trim() || busy} onClick={() => { apply(ytThemBuoc(y.id, moi.trim())); setMoi(''); }}>+ Thêm</button>
              </div>
            </div>
          </Panel>

          {y.nhat_ky.length > 0 && (
            <Panel title="Nhật ký" subtitle="mới nhất trước">
              <ul style={{ margin: 0, padding: '0 0 0 16px', color: 'var(--fg-2)', fontSize: 12, lineHeight: 1.7 }}>
                {y.nhat_ky.slice(0, 15).map((n, i) => <li key={i}><span style={{ fontFamily: 'var(--mono)', color: 'var(--fg-3)' }}>{String(n.ts).slice(0, 16).replace('T', ' ')}</span> · {n.noi_dung}</li>)}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </Drawer>
  );
}

function BuocRow({ b, busy, onPatch }: { b: Buoc; busy: boolean; onPatch: (p: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => void }) {
  const [tt, setTt] = useState<string>(b.trang_thai);
  const [kq, setKq] = useState(b.ket_qua);
  const [gc, setGc] = useState(b.ghi_chu);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setTt(b.trang_thai); setKq(b.ket_qua); setGc(b.ghi_chu); }, [b]);
  const save = (patch: { trang_thai?: string; ket_qua?: string; ghi_chu?: string }) => {
    const next = { trang_thai: patch.trang_thai ?? tt, ket_qua: patch.ket_qua ?? kq, ghi_chu: patch.ghi_chu ?? gc };
    if (next.trang_thai === 'Xong' && !next.ket_qua.trim()) { setErr('Xong phải có kết quả (link / số liệu)'); return; }
    if (next.trang_thai === 'Kẹt' && !next.ghi_chu.trim()) { setErr('Kẹt phải ghi chờ ai / chờ gì'); return; }
    setErr(null); onPatch(patch);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px', gap: 8, alignItems: 'start', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
      <span style={{ fontFamily: 'var(--mono)', color: 'var(--fg-3)', paddingTop: 6 }}>#{b.thu_tu}</span>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ color: 'var(--fg-1)' }}>{b.buoc}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <TextField label="Kết quả / link" size="sm" value={kq} onChange={(e) => setKq(e.target.value)} onBlur={() => { if (kq !== b.ket_qua) save({ ket_qua: kq }); }} />
          <TextField label={tt === 'Kẹt' ? 'Chờ ai / chờ gì' : 'Ghi chú'} size="sm" value={gc} onChange={(e) => setGc(e.target.value)} onBlur={() => { if (gc !== b.ghi_chu) save({ ghi_chu: gc }); }} />
        </div>
        {err && <div style={{ color: 'var(--neon-red, #ff6b6b)', fontSize: 12 }}>{err}</div>}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        <SelectField label="" size="sm" value={tt} disabled={busy} onChange={(e) => { setTt(e.target.value); save({ trang_thai: e.target.value }); }}>
          {BUOC_TRANG_THAI.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectField>
        {b.ngay_xong && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-3)', textAlign: 'right' }}>{b.ngay_xong}</span>}
      </div>
    </div>
  );
}
