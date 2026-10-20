'use client';
// ĐẦU TAB TỔNG QUAN Social (anh 20/10/2026: "vào là nhìn thấy vấn đề, thấy cả hiện trạng"): khối SỰ CỐ (gom theo nguyên nhân, đỏ trước vàng sau)
// + khối HIỆN TRẠNG (mỗi nơi đăng × 4 ngày: ✓ link · ✗ lý do · ⏳ chờ). Số tính ở lib/social-suc-khoe.ts.
import type { StSucKhoe, StSucO } from '@/lib/social-suc-khoe';
import { wrapExternalUrl } from '@/lib/external-url';
import { Panel, Pill } from '@/components/ui';

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dm = (n: string) => `${n.slice(8, 10)}/${n.slice(5, 7)}`;
const nho = { fontSize: 11, color: 'var(--fg-3)' } as const;

function O({ o }: { o: StSucO }) {
  const st = { display: 'inline-block', minWidth: 26, textAlign: 'center' as const, padding: '1px 6px', borderRadius: 6, fontSize: 12, lineHeight: '18px' };
  if (o.tt === 'da') return o.url
    ? <a href={wrapExternalUrl(o.url)} target="_blank" rel="noreferrer" title="đã đăng — bấm mở bài" style={{ ...st, background: 'color-mix(in srgb, var(--ok) 16%, transparent)', color: 'var(--ok)', textDecoration: 'none' }}>✓</a>
    : <span title="đã đăng (sổ không có link)" style={{ ...st, background: 'color-mix(in srgb, var(--ok) 16%, transparent)', color: 'var(--ok)' }}>✓</span>;
  if (o.tt === 'hong') return <span title={o.loi} style={{ ...st, background: 'color-mix(in srgb, var(--bad) 14%, transparent)', color: 'var(--bad)', fontWeight: 600 }}>✗</span>;
  if (o.tt === 'cho') return <span title="có lượt dự kiến hôm nay, chưa tới giờ" style={{ ...st, border: '1px dashed var(--line)', color: 'var(--fg-2)' }}>⏳</span>;
  return <span title="không có bài" style={{ ...st, color: 'var(--fg-3)' }}>·</span>;
}

export function SucKhoeDang({ suc }: { suc: StSucKhoe }) {
  const homNay = suc.dong.flatMap((d) => d.o.filter((o) => o.ngay === suc.hom));
  const dem = (tt: StSucO['tt']) => homNay.filter((o) => o.tt === tt).length;
  const bad = suc.suCo.filter((x) => x.muc === 'bad').length;
  const sau7 = new Date(Date.parse(`${suc.hom}T00:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10);
  const o = { padding: '5px 8px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' as const, fontSize: 12 };
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(460px, 100%), 1fr))' }}>
      <Panel title={suc.suCo.length ? `🚨 Sự cố đang chặn đăng` : '✅ Không có sự cố'} subtitle={suc.suCo.length ? `${bad} chặn · ${suc.suCo.length - bad} cảnh báo` : 'mọi nơi đăng chạy đúng lịch'}>
        {suc.suCo.length ? <div style={{ display: 'grid', gap: 6 }}>{suc.suCo.map((x, i) => (
          <div key={i} style={{ display: 'grid', gap: 3, padding: '7px 9px', borderRadius: 6, background: 'var(--bg-2)', borderLeft: `3px solid ${x.muc === 'bad' ? 'var(--bad)' : 'var(--warn)'}` }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 13 }}>
              <b style={{ fontWeight: 600, color: x.muc === 'bad' ? 'var(--bad)' : undefined }}>{x.tieuDe}</b>
              {x.luc && <span style={nho}>lần cuối {new Date(Date.parse(x.luc) + 7 * 3600e3).toISOString().slice(11, 16)} {dm(new Date(Date.parse(x.luc) + 7 * 3600e3).toISOString())}</span>}
            </div>
            {x.chiTiet && <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{x.chiTiet}</span>}
            <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{x.kenh.map((k) => <Pill key={k} label={k} color="var(--fg-2)" uppercase={false} />)}</span>
          </div>))}</div>
          : <span style={nho}>Không có lỗi đăng, cảnh báo tài khoản hay kho sắp cạn.</span>}
      </Panel>
      <Panel title="📡 Hiện trạng đăng" subtitle={`hôm nay: ${dem('da')} đã đăng · ${dem('hong')} hỏng · ${dem('cho')} chờ giờ`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--fg-2)' }}>
              <th style={o}>Nơi đăng</th>
              {suc.ngay.map((n) => <th key={n} style={{ ...o, textAlign: 'center', fontWeight: n === suc.hom ? 700 : 500 }}>{n === suc.hom ? 'Hôm nay' : `${THU[new Date(`${n}T00:00:00Z`).getUTCDay()]} ${dm(n)}`}</th>)}
              <th style={o} title="ngày có bài thành công gần nhất">Đăng cuối</th><th style={o} title="lượt dự kiến cuối cùng trong lịch 90 ngày (luật nhịp an toàn)">Kho đủ tới</th>
            </tr></thead>
            <tbody>{suc.dong.map((d, i) => {
              const dauMay = i === 0 || suc.dong[i - 1]!.may !== d.may;
              return <tr key={`${d.may}|${d.nen}`} style={dauMay && i ? { borderTop: '2px solid var(--line)' } : undefined}>
                <td style={o} title={`${d.mayTen} · ${d.tk} · ${d.mayMac} ${d.gio}`}>{dauMay && <span style={{ ...nho, display: 'block' }}>{d.mayTen.split(' · ')[0]}</span>}{d.nenTen} <span style={nho}>{d.mayMac} {d.gio}</span></td>
                {d.o.map((x) => <td key={x.ngay} style={{ ...o, textAlign: 'center' }}><O o={x} /></td>)}
                <td style={o}>{d.cuoiOk ? dm(d.cuoiOk) : <span style={nho}>chưa có</span>}</td>
                <td style={{ ...o, color: d.khoDen && d.khoDen <= sau7 ? 'var(--bad)' : undefined, fontWeight: d.khoDen && d.khoDen <= sau7 ? 600 : undefined }}>{d.khoDen ? dm(d.khoDen) : <span style={nho} title="không có lượt nào trong lịch">—</span>}</td>
              </tr>; })}</tbody>
          </table>
        </div>
        <span style={nho}>✓ đã đăng (bấm mở bài) · ✗ hỏng (rê chuột xem lý do) · ⏳ còn lượt hôm nay · giờ GMT+7. Lịch 10 ngày + kho theo kiểu nội dung: mục Lịch đăng.</span>
      </Panel>
    </div>
  );
}
