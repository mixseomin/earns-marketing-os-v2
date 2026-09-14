'use client';

// PHỦ — một màn: nền tảng đã phủ tới đâu · nguồn traffic & campaign · phễu theo campaign · lander ·
// adapter/postback đang sống không · nhập chi tay. Sửa gì cũng qua Drawer (quy ước UI nhà), số liệu
// đổ vào từ /api/phu/ingest + /api/phu/postback, trang chỉ đọc bảng phu_*.

import { useState, useTransition } from 'react';
import { Drawer, EmptyState, Pill, Section, SelectField, StatsStrip, TextAreaField, TextField } from '@/components/ui';
import type { PhuCamp, PhuData, PhuNguon, PhuPlatform } from '@/lib/phu';
import { PHU_NGUON_TRANG_THAI, PHU_TRANG_THAI } from '@/lib/phu';
import { luuPhuCamp, luuPhuChi, luuPhuNguon, luuPhuPlatform } from '@/lib/actions/phu';

const NHOM: Record<string, string> = { cam: 'Cam 18+', ai: 'AI companion', random: 'Random chat', text: 'Text/voice', community: 'Cộng đồng', other: 'Khác' };
const cell: React.CSSProperties = { padding: '7px 9px', fontSize: 12, borderBottom: '1px solid var(--line)', verticalAlign: 'top' };
const head: React.CSSProperties = { ...cell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const btn: React.CSSProperties = { padding: '4px 10px', fontSize: 11, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };
const usd = (v: number) => (v ? `$${v.toFixed(2)}` : '—');
const khi = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { hour12: false }).replace(/:\d\d( |$)/, ' ') : '—');
const cu = (iso: string | null, phut: number) => !iso || Date.now() - new Date(iso).getTime() > phut * 60_000;

export function PhuView({ data, projectId, host }: { data: PhuData; projectId: string; host: string }) {
  const [suaPl, setSuaPl] = useState<PhuPlatform | null>(null);
  const [suaNg, setSuaNg] = useState<PhuNguon | 'moi' | null>(null);
  const [suaCamp, setSuaCamp] = useState<PhuCamp | 'moi' | null>(null);
  const [nhapChi, setNhapChi] = useState(false);
  const d = data;
  const dem = (tt: string) => d.platforms.filter((p) => p.trangThai === tt).length;
  const roi = d.tong.chi > 0 ? ((d.tong.revenue - d.tong.chi) / d.tong.chi) * 100 : null;

  return (
    <div style={{ padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18 }}>Phủ affiliate & traffic mua</h1>
          <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Một màn: nền tảng → nguồn/campaign → phễu theo sid → lander → adapter. Cửa sổ {d.days} ngày.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 30, 90].map((n) => (
            <a key={n} href={`?days=${n}`} style={{ ...btn, textDecoration: 'none', ...(n === d.days ? { borderColor: 'var(--fg-2)', color: 'var(--fg-1)' } : { color: 'var(--fg-3)' }) }}>{n} ngày</a>
          ))}
        </div>
      </div>
      {d.loi && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{d.loi}</div>}

      <StatsStrip minColWidth={130} cards={[
        { key: 'cam', label: 'Đã cắm', value: dem('da_cam'), color: 'var(--ok)', sub: `${dem('duyet')} duyệt chưa cắm` },
        { key: 'cho', label: 'Chờ duyệt', value: dem('cho_duyet') + dem('da_dang_ky'), color: 'var(--neon-violet, #a78bfa)', sub: `${dem('chua')} chưa đăng ký` },
        { key: 'khong', label: 'Không có aff', value: dem('khong_co') + dem('bo'), color: 'var(--fg-3)' },
        { key: 'nguon', label: 'Nguồn hoạt động', value: d.nguon.filter((x) => x.trangThai === 'hoat_dong').length, sub: `${d.nguon.length} nguồn · ${d.camp.filter((c) => c.trangThai === 'chay').length} camp chạy` },
        { key: 'click', label: 'Click → out', value: `${d.tong.click} → ${d.tong.out}`, sub: `${d.days} ngày` },
        { key: 'signup', label: 'Signup', value: d.tong.signup, color: 'var(--neon-cyan, #67e8f9)' },
        { key: 'rev', label: 'Doanh thu', value: usd(d.tong.revenue), color: 'var(--ok)', sub: `chi ${usd(d.tong.chi)}` },
        { key: 'roi', label: 'ROI', value: roi === null ? '—' : `${roi.toFixed(0)}%`, color: roi === null ? 'var(--fg-3)' : roi >= 0 ? 'var(--ok)' : 'var(--danger)' },
      ]} />

      <Section title={`Nền tảng (${d.platforms.length})`} subtitle="Trạng thái affiliate từng nền tảng trên site, cửa ra đang cắm, bước kế và ai làm. Bấm dòng để sửa.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Nền tảng</th><th style={head}>Nhóm</th><th style={head}>Chương trình</th><th style={head}>Hoa hồng</th><th style={head}>Trạng thái</th><th style={head}>Cửa ra</th><th style={head}>Bước kế</th><th style={head}>Card</th></tr></thead>
            <tbody>
              {d.platforms.map((p) => {
                const tt = PHU_TRANG_THAI[p.trangThai] ?? { label: p.trangThai, color: 'var(--fg-3)' };
                return (
                  <tr key={p.id} onClick={() => setSuaPl(p)} style={{ cursor: 'pointer' }} title="Sửa">
                    <td style={cell}><b>{p.name}</b><div style={{ ...mono, color: 'var(--fg-3)', fontSize: 10 }}>{p.slug}</div></td>
                    <td style={cell}>{NHOM[p.nhom] ?? p.nhom}</td>
                    <td style={{ ...cell, ...mono }}>{p.chuongTrinh ?? '—'}</td>
                    <td style={cell}>{p.hoaHong ?? '—'}</td>
                    <td style={cell}><Pill color={tt.color} label={tt.label} /></td>
                    <td style={{ ...cell, ...mono }}>{p.cuaRa ? <a href={`https://${host}${p.cuaRa.startsWith('/') ? p.cuaRa : ''}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{p.cuaRa}</a> : '—'}</td>
                    <td style={{ ...cell, maxWidth: 320 }}>{p.buocKe ?? <span style={{ color: 'var(--fg-3)' }}>—</span>}</td>
                    <td style={{ ...cell, ...mono }}>{p.cardId ? <a href={`/p/${projectId}/plays?task=${p.cardId}`} onClick={(e) => e.stopPropagation()}>#{p.cardId}{p.cardStatus ? ` · ${p.cardStatus}` : ''}</a> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!d.platforms.length && <EmptyState icon="🧩" title="Chưa có nền tảng" description="Nạp bằng scripts/phu/seed hoặc /api/phu/ingest." compact />}
        </div>
      </Section>

      <Section title={`Nguồn traffic (${d.nguon.length}) & campaign (${d.camp.length})`}
        subtitle="Mỗi nguồn có token postback riêng: dán URL mẫu vào mạng affiliate (CrakRevenue/AWEmpire/Stripcash) để signup/sale đổ về đúng nguồn. sid = <nguồn>_<camp>_<zone>_<clickid>."
        headerRight={<span style={{ display: 'flex', gap: 6 }}><button style={btn} onClick={() => setSuaNg('moi')}>+ nguồn</button><button style={btn} onClick={() => setSuaCamp('moi')}>+ campaign</button></span>}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Nguồn</th><th style={head}>Loại</th><th style={head}>Trạng thái</th><th style={head}>Nạp</th><th style={head}>Macro click</th><th style={head}>Postback URL (mạng aff gọi về)</th></tr></thead>
            <tbody>
              {d.nguon.map((g) => {
                const tt = PHU_NGUON_TRANG_THAI[g.trangThai] ?? { label: g.trangThai, color: 'var(--fg-3)' };
                const pb = g.postbackToken ? `https://mos2.on.tc/api/phu/postback?k=${g.postbackToken}&mang=<mạng>&event=<signup|lead|spend>&sid=<macro sub id>&amount=<payout>&id=<txn id>` : '—';
                return (
                  <tr key={g.id} onClick={() => setSuaNg(g)} style={{ cursor: 'pointer' }}>
                    <td style={cell}><b>{g.name}</b><div style={{ ...mono, color: 'var(--fg-3)', fontSize: 10 }}>{g.key}</div></td>
                    <td style={cell}>{g.loai}</td>
                    <td style={cell}><Pill color={tt.color} label={tt.label} /></td>
                    <td style={{ ...cell, ...mono }}>{usd(g.napUsd)}</td>
                    <td style={{ ...cell, ...mono }}>{g.macroClick ?? '—'}</td>
                    <td style={{ ...cell, ...mono, fontSize: 10, wordBreak: 'break-all', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>{pb}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!d.nguon.length && <EmptyState icon="📡" title="Chưa có nguồn traffic" description="Thêm nguồn khi anh chốt mạng QC — token postback sinh tự động." compact />}
        </div>
        {d.camp.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={head}>Campaign</th><th style={head}>sid_prefix</th><th style={head}>Nguồn</th><th style={head}>Lander</th><th style={head}>Target</th><th style={head}>$/ngày</th><th style={head}>Trạng thái</th></tr></thead>
              <tbody>
                {d.camp.map((c) => (
                  <tr key={c.id} onClick={() => setSuaCamp(c)} style={{ cursor: 'pointer' }}>
                    <td style={cell}><b>{c.ten}</b></td>
                    <td style={{ ...cell, ...mono }}>{c.sidPrefix}</td>
                    <td style={{ ...cell, ...mono }}>{c.nguonKey}</td>
                    <td style={{ ...cell, ...mono, fontSize: 10 }}>{c.lander ?? '—'}</td>
                    <td style={{ ...cell, ...mono, fontSize: 10 }}>{Object.keys(c.target).length ? JSON.stringify(c.target) : '—'}</td>
                    <td style={{ ...cell, ...mono }}>{c.nganSachNgay == null ? '—' : usd(c.nganSachNgay)}</td>
                    <td style={cell}><Pill color={c.trangThai === 'chay' ? 'var(--ok)' : c.trangThai === 'tam_dung' ? 'var(--warn)' : 'var(--fg-3)'} label={c.trangThai} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Phễu theo campaign · ${d.days} ngày`} subtitle="click = beacon /px trên trang · out = cú bấm qua cửa ra hoặc link thẳng · signup/lead/spend = postback hoặc API mạng. Dòng (organic) = click không mang sid."
        headerRight={<button style={btn} onClick={() => setNhapChi(true)}>+ nhập chi</button>}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>sid_prefix</th><th style={head}>Click</th><th style={head}>Out</th><th style={head}>Signup</th><th style={head}>Lead</th><th style={head}>Spend (lượt)</th><th style={head}>Doanh thu</th><th style={head}>Chi</th><th style={head}>EPC</th><th style={head}>ROI</th></tr></thead>
            <tbody>
              {d.pheu.map((r) => {
                const epc = r.out ? r.revenue / r.out : 0;
                const ro = r.chi ? ((r.revenue - r.chi) / r.chi) * 100 : null;
                return (
                  <tr key={r.sidPrefix || '(organic)'}>
                    <td style={{ ...cell, ...mono }}>{r.sidPrefix || <span style={{ color: 'var(--fg-3)' }}>(organic / không sid)</span>}</td>
                    <td style={{ ...cell, ...mono }}>{r.click}</td><td style={{ ...cell, ...mono }}>{r.out}</td>
                    <td style={{ ...cell, ...mono }}>{r.signup}</td><td style={{ ...cell, ...mono }}>{r.lead}</td><td style={{ ...cell, ...mono }}>{r.spendCount}</td>
                    <td style={{ ...cell, ...mono, color: 'var(--ok)' }}>{usd(r.revenue)}</td><td style={{ ...cell, ...mono }}>{usd(r.chi)}</td>
                    <td style={{ ...cell, ...mono }}>{epc ? `$${epc.toFixed(3)}` : '—'}</td>
                    <td style={{ ...cell, ...mono, color: ro === null ? 'var(--fg-3)' : ro >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{ro === null ? '—' : `${ro.toFixed(0)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!d.pheu.length && <EmptyState icon="📉" title="Chưa có sự kiện nào trong cửa sổ" description="Adapter log-box2 kéo click/out mỗi 15 phút; postback mạng đổ signup/sale." compact />}
        </div>
      </Section>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <Section title={`Lander (${d.landers.length})`} subtitle="Trang cho traffic mua — subdomain riêng, noindex. Lần sinh gần nhất phải mới hơn 15 phút với lander động.">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Lander</th><th style={head}>Bán</th><th style={head}>Sinh lúc</th><th style={head}>Mục</th></tr></thead>
            <tbody>
              {d.landers.map((l) => (
                <tr key={l.host + l.path}>
                  <td style={cell}><a href={`https://${l.host}${l.path}`} target="_blank" rel="noreferrer" style={mono}>{l.host}{l.path}</a><div style={{ color: 'var(--fg-3)', fontSize: 11 }}>{l.ten}</div></td>
                  <td style={cell}>{l.dich ?? '—'}</td>
                  <td style={{ ...cell, ...mono, color: l.trangThai !== 'song' || cu(l.lastSinh, 20) ? 'var(--warn)' : 'var(--fg-2)' }}>{khi(l.lastSinh)}</td>
                  <td style={{ ...cell, ...mono }}>{l.soMuc ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.landers.length && <EmptyState icon="🛬" title="Chưa có lander" compact />}
        </Section>
        <Section title={`Adapter (${d.adapters.length})`} subtitle="Mọi đường số liệu đổ vào trang này. Đỏ = lâu không chạy hoặc lần cuối lỗi.">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Adapter</th><th style={head}>Lịch</th><th style={head}>Chạy cuối</th><th style={head}>Ghi chú</th></tr></thead>
            <tbody>
              {d.adapters.map((a) => {
                const hong = a.lastOk === false || (a.loai === 'cron' && cu(a.lastRun, 24 * 60));
                return (
                  <tr key={a.key}>
                    <td style={cell}><b>{a.name}</b><div style={{ ...mono, color: 'var(--fg-3)', fontSize: 10 }}>{a.key} · {a.loai}</div></td>
                    <td style={{ ...cell, ...mono, fontSize: 11 }}>{a.lich ?? '—'}</td>
                    <td style={{ ...cell, ...mono, color: hong ? 'var(--danger)' : 'var(--ok)' }}>{khi(a.lastRun)}</td>
                    <td style={{ ...cell, fontSize: 11, color: 'var(--fg-2)' }}>{a.lastNote ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!d.adapters.length && <EmptyState icon="🔌" title="Chưa adapter nào báo về" compact />}
        </Section>
      </div>

      {suaPl && <SuaPlatform p={suaPl} projectId={projectId} onClose={() => setSuaPl(null)} />}
      {suaNg && <SuaNguon g={suaNg === 'moi' ? null : suaNg} projectId={projectId} onClose={() => setSuaNg(null)} />}
      {suaCamp && <SuaCamp c={suaCamp === 'moi' ? null : suaCamp} nguon={d.nguon} projectId={projectId} onClose={() => setSuaCamp(null)} />}
      {nhapChi && <NhapChi camp={d.camp} projectId={projectId} onClose={() => setNhapChi(false)} />}
    </div>
  );
}

function Khung({ tieuDe, onClose, onSave, pending, dirty, children }: { tieuDe: string; onClose: () => void; onSave: () => void; pending: boolean; dirty: boolean; children: React.ReactNode }) {
  return (
    <Drawer onClose={onClose} width={520} dirty={dirty}>
      <div style={{ padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>{tieuDe}</h2>
        {children}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <button style={btn} onClick={onClose} disabled={pending}>Đóng</button>
          <button style={{ ...btn, borderColor: 'var(--ok)', color: 'var(--ok)' }} onClick={onSave} disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu'}</button>
        </div>
      </div>
    </Drawer>
  );
}

function SuaPlatform({ p, projectId, onClose }: { p: PhuPlatform; projectId: string; onClose: () => void }) {
  const [f, setF] = useState({ trangThai: p.trangThai, chuongTrinh: p.chuongTrinh ?? '', hoaHong: p.hoaHong ?? '', linkMau: p.linkMau ?? '', cuaRa: p.cuaRa ?? '', buocKe: p.buocKe ?? '', ghiChu: p.ghiChu ?? '', cardId: p.cardId ? String(p.cardId) : '', accountId: p.accountId ? String(p.accountId) : '' });
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  return (
    <Khung tieuDe={`${p.name} · ${NHOM[p.nhom] ?? p.nhom}`} onClose={onClose} pending={pending} dirty={dirty} onSave={() => start(async () => { await luuPhuPlatform(projectId, p.id, f); onClose(); })}>
      <SelectField label="Trạng thái" value={f.trangThai} onChange={set('trangThai')}>
        {Object.entries(PHU_TRANG_THAI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </SelectField>
      <TextField label="Chương trình / mạng" value={f.chuongTrinh} onChange={set('chuongTrinh')} hint="chaturbate · awempire · crakrevenue · stripcash · bongacash · tapfiliate · rewardful" />
      <TextField label="Hoa hồng" value={f.hoaHong} onChange={set('hoaHong')} />
      <TextField label="Mẫu link" value={f.linkMau} onChange={set('linkMau')} mono hint="{SUBID} ở chỗ sub id" />
      <TextField label="Cửa ra trên site" value={f.cuaRa} onChange={set('cuaRa')} mono hint="/go/<slug>/ · /r/ · hoặc link thẳng" />
      <TextAreaField label="Bước kế (ai làm)" value={f.buocKe} onChange={set('buocKe')} rows={2} />
      <TextAreaField label="Ghi chú" value={f.ghiChu} onChange={set('ghiChu')} rows={3} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <TextField label="Card (human_tasks id)" value={f.cardId} onChange={set('cardId')} mono />
        <TextField label="Vault account id" value={f.accountId} onChange={set('accountId')} mono />
      </div>
    </Khung>
  );
}

function SuaNguon({ g, projectId, onClose }: { g: PhuNguon | null; projectId: string; onClose: () => void }) {
  const [f, setF] = useState({ key: g?.key ?? '', name: g?.name ?? '', loai: g?.loai ?? 'pop', trangThai: g?.trangThai ?? 'du_kien', macroClick: g?.macroClick ?? '', macroChi: g?.macroChi ?? '', accountId: g?.accountId ? String(g.accountId) : '', napUsd: g ? String(g.napUsd) : '0', ghiChu: g?.ghiChu ?? '' });
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  return (
    <Khung tieuDe={g ? `Nguồn · ${g.name}` : 'Nguồn traffic mới'} onClose={onClose} pending={pending} dirty={dirty} onSave={() => start(async () => { await luuPhuNguon(projectId, { ...f, id: g?.id }); onClose(); })}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <TextField label="Key" value={f.key} onChange={set('key')} mono disabled={!!g} hint="exoclick · trafficjunky · bidvertiser · bing" />
        <TextField label="Tên" value={f.name} onChange={set('name')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <SelectField label="Loại" value={f.loai} onChange={set('loai')}>
          {['pop', 'native', 'search', 'push', 'social', 'khac'].map((x) => <option key={x} value={x}>{x}</option>)}
        </SelectField>
        <SelectField label="Trạng thái" value={f.trangThai} onChange={set('trangThai')}>
          {Object.entries(PHU_NGUON_TRANG_THAI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </SelectField>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <TextField label="Macro click id" value={f.macroClick} onChange={set('macroClick')} mono hint="vd {click_id} — dán vào ?s=<nguồn>_<camp>_<zone>_{click_id}" />
        <TextField label="Macro chi phí" value={f.macroChi} onChange={set('macroChi')} mono />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <TextField label="Đã nạp (USD)" value={f.napUsd} onChange={set('napUsd')} mono />
        <TextField label="Vault account id" value={f.accountId} onChange={set('accountId')} mono />
      </div>
      <TextAreaField label="Ghi chú" value={f.ghiChu} onChange={set('ghiChu')} rows={3} />
    </Khung>
  );
}

function SuaCamp({ c, nguon, projectId, onClose }: { c: PhuCamp | null; nguon: PhuNguon[]; projectId: string; onClose: () => void }) {
  const [f, setF] = useState({ nguonKey: c?.nguonKey ?? (nguon[0]?.key ?? ''), ten: c?.ten ?? '', sidPrefix: c?.sidPrefix ?? '', lander: c?.lander ?? '', target: c ? JSON.stringify(c.target) : '{"geo":"US,CA,UK,AU","device":"desktop","placement":"cam"}', nganSachNgay: c?.nganSachNgay == null ? '' : String(c.nganSachNgay), trangThai: c?.trangThai ?? 'nhap', ghiChu: c?.ghiChu ?? '' });
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [loi, setLoi] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  return (
    <Khung tieuDe={c ? `Campaign · ${c.ten}` : 'Campaign mới'} onClose={onClose} pending={pending} dirty={dirty}
      onSave={() => start(async () => { try { await luuPhuCamp(projectId, f); onClose(); } catch (e) { setLoi(String((e as Error).message)); } })}>
      {loi && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{loi}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <SelectField label="Nguồn" value={f.nguonKey} onChange={set('nguonKey')}>
          {nguon.map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}
        </SelectField>
        <TextField label="sid_prefix" value={f.sidPrefix} onChange={set('sidPrefix')} mono disabled={!!c} hint="<nguồn>_<camp>, vd exo_c1" />
      </div>
      <TextField label="Tên" value={f.ten} onChange={set('ten')} />
      <TextField label="Lander" value={f.lander} onChange={set('lander')} mono hint="https://live.chatwhenbored.com/?s=exo_c1_{zone}_{click_id}" />
      <TextAreaField label="Target (JSON)" value={f.target} onChange={set('target')} rows={3} mono />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <TextField label="Ngân sách/ngày (USD)" value={f.nganSachNgay} onChange={set('nganSachNgay')} mono />
        <SelectField label="Trạng thái" value={f.trangThai} onChange={set('trangThai')}>
          {['nhap', 'chay', 'tam_dung', 'ket_thuc'].map((x) => <option key={x} value={x}>{x}</option>)}
        </SelectField>
      </div>
      <TextAreaField label="Ghi chú" value={f.ghiChu} onChange={set('ghiChu')} rows={2} />
    </Khung>
  );
}

function NhapChi({ camp, projectId, onClose }: { camp: PhuCamp[]; projectId: string; onClose: () => void }) {
  const [f, setF] = useState({ ngay: new Date().toISOString().slice(0, 10), sidPrefix: camp[0]?.sidPrefix ?? '', chiUsd: '', clicks: '', impressions: '' });
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  return (
    <Khung tieuDe="Nhập chi phí QC theo ngày" onClose={onClose} pending={pending} dirty={dirty} onSave={() => start(async () => { await luuPhuChi(projectId, f); onClose(); })}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <TextField label="Ngày" value={f.ngay} onChange={set('ngay')} mono />
        {camp.length ? (
          <SelectField label="Campaign (sid_prefix)" value={f.sidPrefix} onChange={set('sidPrefix')}>
            {camp.map((c) => <option key={c.sidPrefix} value={c.sidPrefix}>{c.sidPrefix} · {c.ten}</option>)}
          </SelectField>
        ) : <TextField label="sid_prefix" value={f.sidPrefix} onChange={set('sidPrefix')} mono />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <TextField label="Chi (USD)" value={f.chiUsd} onChange={set('chiUsd')} mono />
        <TextField label="Clicks" value={f.clicks} onChange={set('clicks')} mono />
        <TextField label="Impressions" value={f.impressions} onChange={set('impressions')} mono />
      </div>
    </Khung>
  );
}
