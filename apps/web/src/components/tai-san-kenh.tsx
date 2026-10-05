'use client';
// Panel "Kênh kéo khách" của tab Tài sản — CÂY như Shop → sản phẩm: mỗi sản phẩm một nút gập (dòng tóm tắt: bán ở đâu,
// bao nhiêu kênh, bao nhiêu việc cần làm), mở ra mỗi KÊNH MỘT HÀNG. Kênh là hàng chứ không phải cột, nên thêm kênh nào
// bảng cũng chỉ dài ra, không nở ngang (anh chê bản cột 05/10/2026). Cảnh báo một dòng, đủ chữ ở tooltip.
// Mở/gập ghi ở URL ?kenh=a,b (giống ?shop=).
import { Cay, EntityRef, LaBang, NutCay, Panel, Pill, oLa, type CotLa } from '@/components/ui';
import { extLinkProps } from '@/lib/external-url';
import { useShallowParam } from '@/lib/url-shallow';
import { KHAU, TT_SP, type KenhSp, type TrangThaiSp } from '@/lib/tai-san/kieu';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const COT: CotLa[] = [{ h: 'Kênh', rong: 150 }, { h: 'Khâu', rong: 170 }, { h: 'Tiến độ', rong: 80, phai: true }, { h: 'Trỏ về', rong: 200 },
  { h: 'Cần làm', rong: 300 }, { h: 'Card', rong: 120 }];
export type BanO = { noi: string; trangThai: TrangThaiSp }[];

export function TaiSanKenh({ kenh, ban }: { kenh: KenhSp[]; ban: Record<string, BanO> }) {
  const [moUrl, datMo] = useShallowParam('kenh', '');
  const dangMo = new Set(moUrl.split(',').filter(Boolean));
  const doi = (k: string) => { const n = new Set(dangMo); if (n.has(k)) n.delete(k); else n.add(k); datMo([...n].join(',')); };
  if (!kenh.length) return null;
  return (
    <Panel title="📣 Kênh kéo khách theo sản phẩm" subtitle="bấm một sản phẩm để xem từng kênh">
      <Cay label="Sản phẩm và kênh">
        {kenh.map((s) => {
          const ks = Object.values(s.o);
          const viec = ks.flatMap((o) => (o.canhBao ? o.canhBao.split(' · ') : []));
          const noi = ban[s.sanPham] ?? [];
          return (
            <NutCay key={s.sanPham} mo={dangMo.has(s.sanPham)} onDoi={() => doi(s.sanPham)}
              ten={<b style={{ fontWeight: 600 }}>{s.ten}</b>}
              phu={`${noi.length ? noi.map((x) => `${x.noi} ${TT_SP.find((t) => t.key === x.trangThai)!.chu}`).join(' · ') : 'chưa lên sàn'}  —  ${ks.length} kênh`}
              phai={viec.length ? <Pill label={`⚠ ${viec.length} cần làm`} color="var(--warn)" size="xs" tone="soft" uppercase={false} mono={false} title={viec.join('\n')} /> : null}>
              <LaBang cot={COT}>
                <tbody>
                  {ks.map((o) => {
                    const k = KHAU[o.kenh] ?? { nhan: o.kenh, khau: [] };
                    const ds = o.canhBao ? o.canhBao.split(' · ') : [];
                    return (
                      <tr key={o.kenh} style={{ borderTop: '1px solid var(--line)' }}>
                        <td style={oLa()}>{k.nhan}</td>
                        <td style={oLa()} title={k.khau.map((x, i) => `${i <= o.muc ? '●' : '○'} ${x}`).join('\n')}>
                          <span style={{ color: o.muc >= k.khau.length - 1 ? 'var(--ok)' : 'var(--accent)', marginRight: 6 }}>
                            {k.khau.slice(1).map((_, i) => (i < o.muc ? '●' : '○')).join('')}</span>{k.khau[o.muc] ?? o.muc}
                        </td>
                        <td style={oLa(true)}>{o.tong != null ? `${o.xong ?? 0}/${o.tong}` : '—'}</td>
                        <td style={{ ...oLa(), ...phu }} title={o.dich ?? ''}>{o.dich
                          ? <a {...extLinkProps(o.dich)} style={{ color: 'inherit' }}>{o.dich.replace(/^https?:\/\//, '').replace(/[?#].*$/, '')}</a> : '—'}</td>
                        <td style={oLa()} title={ds.join('\n')}>{ds.length
                          ? <span style={{ color: 'var(--warn)' }}>{ds[0]}{ds.length > 1 && <span style={phu}> +{ds.length - 1}</span>}</span>
                          : <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
                        <td style={oLa()}>{o.the
                          ? <><EntityRef kind="task" id={o.the.id} project={o.the.project ?? undefined} label={`#${o.the.id}`} title={o.the.ten} size="sm" />{' '}
                            <span style={{ fontSize: 11, color: o.the.trangThai === 'completed' ? 'var(--ok)' : 'var(--fg-3)' }}>{o.the.trangThai}</span></>
                          : <span style={{ color: 'var(--fg-4)' }}>—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </LaBang>
            </NutCay>
          );
        })}
      </Cay>
    </Panel>
  );
}
