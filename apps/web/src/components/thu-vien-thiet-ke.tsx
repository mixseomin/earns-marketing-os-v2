'use client';
// Thư viện › Thiết kế: lưới thẻ (ảnh bìa = ảnh minh hoạ đầu) · lọc theo thẻ (MultiSelect có tìm — thẻ là danh sách động) + ô tìm ·
// bấm thẻ → ngăn kéo: đủ ảnh minh hoạ, mô tả, cách dùng lại, giấy phép, nguồn, bản cất trên Drive. Lọc ghi URL (?tvt thẻ · ?tvq tìm).
import { useMemo, useState } from 'react';
import { Drawer, EmptyState, MultiSelect, Pill, SearchInput } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import { LA_THIET_KE, type MucThuVien } from '@/lib/thu-vien';

const phu: React.CSSProperties = { color: 'var(--fg-3)', fontSize: 12 };
const tenNhanh = (k: string) => { const l = LA_THIET_KE.find((x) => x.key === k); return l ? `${l.icon} ${l.ten}` : k; };

export function ThuVienThietKe({ muc, tieuDe }: { muc: MucThuVien[]; tieuDe: string }) {
  const [tvt, setTvt] = useShallowParam('tvt', '');
  const [q, setQ] = useShallowParam('tvq', '');
  const [mo, setMo] = useState<MucThuVien | null>(null);
  const theChon = tvt ? tvt.split(',') : [];
  const dsThe = useMemo(() => {
    const m = new Map<string, number>(); for (const x of muc) for (const t of x.the) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, label: value, count }));
  }, [muc]);
  const loc = muc.filter((x) => (!theChon.length || theChon.every((t) => x.the.includes(t)))
    && (!q || `${x.ten} ${x.mo_ta} ${x.the.join(' ')} ${x.tac_gia ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{tieuDe}</h2>
        <span style={phu}>{loc.length}/{muc.length} mẫu</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          <SearchInput value={q} onChange={setQ} placeholder="Tìm mẫu…" />
          <MultiSelect<string> label="🏷 Thẻ" options={dsThe} selected={theChon} onChange={(v) => setTvt(v.join(','))} popupWidth={260} compact />
        </span>
      </div>
      {loc.length
        ? <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}>
            {loc.map((x) => (
              <button key={x.id} type="button" onClick={() => setMo(x)} title="bấm để xem đủ ảnh minh hoạ + cách dùng"
                style={{ all: 'unset', cursor: 'pointer', display: 'grid', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-1)' }}>
                {x.anh[0]
                  ? <img src={x.anh[0]} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', background: 'var(--bg-2)' }} />
                  : <div style={{ aspectRatio: '16 / 9', background: 'var(--bg-2)' }} />}
                <div style={{ padding: '10px 12px', display: 'grid', gap: 6 }}>
                  <b style={{ fontSize: 13.5, lineHeight: 1.35 }}>{x.ten}</b>
                  <span style={{ ...phu, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.mo_ta}</span>
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {x.nhanh.map((n) => <Pill key={n} label={tenNhanh(n)} color="var(--accent)" size="xs" tone="soft" uppercase={false} mono={false} />)}
                    {x.anh.length > 1 && <span style={phu}>🖼 {x.anh.length} ảnh</span>}
                  </span>
                </div>
              </button>
            ))}
          </div>
        : <EmptyState icon="📭" title={muc.length ? 'Không mẫu nào khớp bộ lọc' : 'Nhánh này chưa có mẫu'}
            description={muc.length ? 'Bỏ bớt thẻ hoặc đổi chữ tìm.' : 'Lưu mẫu mới: một dòng bảng thu_vien (ảnh lên R2 bằng `kho phat`, bản gốc lên Drive bằng `kho cat`).'} compact />}
      {mo && <ChiTiet x={mo} onClose={() => setMo(null)} />}
    </div>
  );
}

function ChiTiet({ x, onClose }: { x: MucThuVien; onClose: () => void }) {
  const [anh, setAnh] = useState(0);
  const dong = (nhan: string, v: React.ReactNode) => v ? <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, fontSize: 12.5 }}><span style={{ color: 'var(--fg-3)' }}>{nhan}</span><span>{v}</span></div> : null;
  return (
    <Drawer onClose={onClose} width={900}>
      <div style={{ display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, lineHeight: 1.3 }}>{x.ten}</h2>
        {x.anh.length > 0 && <div style={{ display: 'grid', gap: 8 }}>
          <img src={x.anh[anh]} alt={`minh hoạ ${anh + 1}`} style={{ width: '100%', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)' }} />
          {x.anh.length > 1 && <div role="listbox" aria-label="Ảnh minh hoạ" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {x.anh.map((u, i) => (
              <button key={u} type="button" onClick={() => setAnh(i)} aria-selected={i === anh} title={`ảnh ${i + 1}`}
                style={{ all: 'unset', cursor: 'pointer', flex: '0 0 96px', borderRadius: 4, overflow: 'hidden', outline: i === anh ? '2px solid var(--accent)' : '1px solid var(--line)' }}>
                <img src={u} alt="" loading="lazy" style={{ width: 96, aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>}
        </div>}
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{x.mo_ta}</p>
        {x.cach_dung && <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', fontSize: 13, lineHeight: 1.6 }}>
          <b>🔧 Cách dùng lại</b><div style={{ marginTop: 4 }}>{x.cach_dung}</div></div>}
        <div style={{ display: 'grid', gap: 6 }}>
          {dong('Nguồn', x.nguon_url && <a href={`https://href.li/?${x.nguon_url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{x.nguon_url} ↗</a>)}
          {dong('Tác giả', x.tac_gia)}
          {dong('Giấy phép', x.giay_phep)}
          {dong('Bản cất', x.ban_luu && <code title="Drive htuan82 · lấy về: kho lay">{x.ban_luu}</code>)}
          {dong('Nhánh', x.nhanh.map(tenNhanh).join(' · '))}
          {dong('Thẻ', x.the.join(' · '))}
        </div>
      </div>
    </Drawer>
  );
}
