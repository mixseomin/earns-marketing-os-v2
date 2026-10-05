// Panel "Kênh kéo khách" của tab Tài sản: mỗi sản phẩm một hàng — đang bán ở đâu (nối từ cây shop theo kenh_sp.khop)
// + mỗi kênh marketing đang tới khâu nào (chấm khâu, xong/tổng, link đích, cảnh báo, card board lo việc kế).
import { EntityRef, LaBang, Panel, Pill, oLa, type CotLa } from '@/components/ui';
import { extLinkProps } from '@/lib/external-url';
import { KHAU, type KenhO, type KenhSp } from '@/lib/tai-san/kenh';
import { TT_SP, type ShopNut } from '@/lib/tai-san/kieu';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };

function O({ k, o }: { k: string; o: KenhO | undefined }) {
  const khau = KHAU[k]!.khau;
  if (!o) return <span style={{ color: 'var(--fg-4)' }}>chưa làm</span>;
  const het = o.muc >= khau.length - 1;
  return (
    <div style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>
      <span title={khau.map((x, i) => `${i <= o.muc ? '●' : '○'} ${x}`).join('\n')} style={{ letterSpacing: 1, color: het ? 'var(--ok)' : 'var(--accent)' }}>
        {khau.slice(1).map((_, i) => (i < o.muc ? '●' : '○')).join('')}
      </span>{' '}
      <b style={{ fontWeight: 600 }}>{khau[o.muc]}</b>
      {o.tong != null && <span style={phu}> · {o.xong ?? 0}/{o.tong}</span>}
      {o.dich && <div style={{ fontSize: 11, ...phu, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ <a {...extLinkProps(o.dich)} style={{ color: 'inherit' }}>{o.dich.replace(/^https?:\/\//, '').replace(/\?.*$/, '')}</a></div>}
      {o.canhBao && <div style={{ fontSize: 11, color: 'var(--warn)' }}>⚠ {o.canhBao}</div>}
      {o.the && <div style={{ fontSize: 11 }}>
        <EntityRef kind="task" id={o.the.id} project={o.the.project ?? undefined} label={`#${o.the.id}`} title={o.the.ten} size="sm" />{' '}
        <span style={{ color: o.the.trangThai === 'completed' ? 'var(--ok)' : 'var(--fg-3)' }}>{o.the.trangThai}</span>
      </div>}
    </div>
  );
}

export function TaiSanKenh({ kenh, shops }: { kenh: KenhSp[]; shops: ShopNut[] }) {
  if (!kenh.length) return null;
  const ks = Object.keys(KHAU);
  const cot: CotLa[] = [{ h: 'Sản phẩm', rong: 200 }, { h: 'Đang bán ở', rong: 200 }, ...ks.map((k) => ({ h: KHAU[k]!.nhan, rong: 230 }))];
  return (
    <Panel title="📣 Kênh kéo khách theo sản phẩm" subtitle="máy của repo sản phẩm ghi (kenh_sp) · card board đọc trạng thái sống">
      <LaBang cot={cot}>
        <tbody>
          {kenh.map((s) => {
            const ban = s.khop ? shops.flatMap((sh) => sh.sp.filter((x) => x.ten.toLowerCase().includes(s.khop!.toLowerCase())).map((x) => ({ sh, x }))) : [];
            return (
              <tr key={s.sanPham} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ ...oLa(), whiteSpace: 'normal' }}><b style={{ fontWeight: 600 }}>{s.ten}</b></td>
                <td style={{ ...oLa(), whiteSpace: 'normal' }}>
                  {ban.length ? ban.map(({ sh, x }) => {
                    const t = TT_SP.find((y) => y.key === x.trangThai)!;
                    return <div key={x.khoa} style={{ fontSize: 11.5 }}>{sh.ten.split(' · ')[0]}{x.phu ? ` ${x.phu}` : ''}{' '}
                      <Pill label={t.chu} color={t.mau} size="xs" tone="soft" uppercase={false} mono={false} /></div>;
                  }) : <span style={{ color: 'var(--fg-4)' }}>chưa có trong cây shop</span>}
                </td>
                {ks.map((k) => <td key={k} style={oLa()}><O k={k} o={s.o[k]} /></td>)}
              </tr>
            );
          })}
        </tbody>
      </LaBang>
    </Panel>
  );
}
