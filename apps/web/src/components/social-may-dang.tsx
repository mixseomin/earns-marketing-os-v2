'use client';
// ⚡ MÁY ĐĂNG THỜI GIAN THỰC — Social › Lịch đăng (anh 27/10/2026: "sửa lại page này để kiểm soát việc triển khai thời gian thực").
// Máy đăng chạy liên tục (iMac, lượt 10 phút) ghi về box3 sau mỗi lượt: từng máy × nền đang ở trạng thái nào và vì sao; đây đọc lại mỗi 30 giây.
// Điều khiển tại chỗ (admin): bật / tắt máy, cho một nền nghỉ tới hết ngày (dang-may › dangNghi đọc cờ, tuần chưa sinh của kế hoạch góc cũng tôn trọng).
import { useEffect, useState } from 'react';
import { Collapsible, SimpleTable, StatsStrip } from '@/components/ui';
import { SiteFavicon } from '@/components/ui/site-favicon';
import { pkCua } from '@/lib/ho-nen';
import { wrapExternalUrl } from '@/lib/external-url';

type Tt = { ma: string; may_ten: string; chay: boolean; nen: string; luc: string; may_mac: string; quyet: 'dang' | 'bo' | 'hong' | 'dung'; ly_do: string; slug: string | null; url: string | null; nghi_den: string | null; may_cua_nen: string | null; da_hom: number };
type Luot = { luc: string; may_mac: string; giay: number; so_dang: number; so_hong: number; so_bo: number; ghi: string };
type SuKien = { luc: string; ma: string; may_ten: string; nen: string; ok: boolean; slug: string | null; url: string | null; noi_dung: string };
type Kh = { may: string; ho: string; nen: string; format: string; dang: string | null; goc_ten: string | null; goc_id: string | null; dich: string | null; can_dung: boolean };
type Video = { slug: string; ma: string; may_ten: string; mau: string; xuat_luc: string; cham: string | null; diem: string | null; chan: string[] | null; video_url: string | null; anh1: string | null; title: string | null };
type Du = { hom: string; tt: Tt[]; luot: Luot[]; su_kien: SuKien[]; kh: Kh[]; video: Video[]; may: { ma: string; ten: string; chay: boolean }[]; luc: string };

const QUYET: Record<Tt['quyet'], [string, string]> = { dang: ['đã đăng', 'var(--ok, #16a34a)'], bo: ['chờ', 'var(--fg-3)'], hong: ['hỏng', 'var(--danger, #dc2626)'], dung: ['dừng', 'var(--warn, #d97706)'] };
const gioVn = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
const ngayGioVn = (iso: string) => new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const phutTruoc = (iso: string) => Math.round((Date.now() - Date.parse(iso)) / 60_000);
const nho = { fontSize: 12, color: 'var(--fg-2)' } as const;
const nut = { border: '1px solid var(--border)', borderRadius: 7, padding: '2px 8px', fontSize: 12, cursor: 'pointer', background: 'var(--bg-1)', color: 'inherit' } as const;
const Nen = ({ nen }: { nen: string }) => <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><SiteFavicon platformKey={pkCua(nen)} size={14} title={nen} /><code style={{ fontSize: 11 }}>{nen}</code></span>;

export function MayDang() {
  const [du, setDu] = useState<Du | null>(null), [loi, setLoi] = useState<string | null>(null), [ban, setBan] = useState(false);
  const tai = () => fetch('/api/social/may-dang', { cache: 'no-store' }).then((r) => r.json()).then((j) => (j.error ? setLoi(j.error) : (setDu(j), setLoi(null)))).catch((e: Error) => setLoi(e.message));
  useEffect(() => { void tai(); const id = setInterval(() => document.visibilityState === 'visible' && void tai(), 30_000); return () => clearInterval(id); }, []);
  const gui = async (b: object) => { setBan(true); try { const r = await fetch('/api/social/may-dang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json(); if (j.error) throw new Error(j.error); await tai(); } catch (e) { setLoi((e as Error).message); } finally { setBan(false); } };
  if (loi && !du) return <div style={{ color: 'var(--danger, #dc2626)', fontSize: 13 }}>Không đọc được máy đăng: {loi}</div>;
  if (!du) return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Đang đọc máy đăng…</div>;
  const luotCuoi = du.luot[0] ?? null, phut = luotCuoi ? phutTruoc(luotCuoi.luc) : null;
  const dangHom = du.su_kien.filter((x) => x.ok && x.luc.slice(0, 10) >= new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)).length;
  const hong24 = du.su_kien.filter((x) => !x.ok).length, nghi = du.tt.filter((x) => x.quyet === 'dung').length;
  const khCua = (ma: string, nen: string) => du.kh.find((k) => k.may === ma && k.nen === nen) ?? du.kh.find((k) => k.may === ma && k.ho === pkCua(nen).replace('twitter', 'x'));
  const duyet24 = du.video.filter((v) => v.cham === 'DUYET').length;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <StatsStrip minColWidth={140} cards={[
        { key: 'luot', label: 'Lượt gần nhất', value: luotCuoi ? gioVn(luotCuoi.luc) : '—', sub: luotCuoi ? `${phut} phút trước · ${luotCuoi.may_mac} · ${luotCuoi.giay}s${luotCuoi.ghi ? ` · ${luotCuoi.ghi.slice(0, 40)}` : ''}` : 'máy chưa ghi lượt nào', color: phut != null && phut > 25 ? 'var(--danger, #dc2626)' : undefined },
        { key: 'ke', label: 'Lượt kế', value: luotCuoi ? gioVn(new Date(Date.parse(luotCuoi.luc) + 10 * 60_000).toISOString()) : '—', sub: 'mỗi 10 phút · khung đăng 19:00 → 10:00' },
        { key: 'dang', label: 'Đăng hôm nay', value: dangHom, sub: `${du.kh.length} ô kế hoạch hôm nay` },
        { key: 'hong', label: 'Hỏng 24h', value: hong24, color: hong24 ? 'var(--danger, #dc2626)' : undefined, sub: `${nghi} kênh đang dừng / nghỉ` },
        { key: 'video', label: 'Video / ảnh 24h', value: du.video.length, sub: `${duyet24} DUYỆT` },
        { key: 'may', label: 'Máy bật', value: `${du.may.filter((m) => m.chay).length}/${du.may.length}`, sub: du.may.filter((m) => !m.chay).map((m) => m.ten).join(' · ') || 'tất cả đang chạy' },
      ]} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {du.may.map((m) => <button key={m.ma} type="button" disabled={ban} onClick={() => void gui({ ma: m.ma, chay: !m.chay })} style={{ ...nut, color: m.chay ? 'var(--ok, #16a34a)' : 'var(--fg-3)' }} title={m.chay ? 'đang chạy — bấm để tắt máy (dừng mọi nền)' : 'đang tắt — bấm để bật'}>{m.chay ? '● ' : '○ '}{m.ten}</button>)}
        {loi ? <span style={{ fontSize: 12, color: 'var(--danger, #dc2626)' }}>{loi}</span> : null}
        <span style={{ ...nho, marginLeft: 'auto' }}>cập nhật {gioVn(du.luc)} · tự đọc lại mỗi 30s</span>
      </div>
      <SimpleTable rows={du.tt} getRowKey={(t) => `${t.ma}|${t.nen}`} rowStyle={(t) => (t.chay ? {} : { opacity: .5 })} columns={[
        { key: 'may', header: 'Máy', cell: (t) => <span style={{ fontWeight: 600, fontSize: 12 }}>{t.may_ten}</span> },
        { key: 'nen', header: 'Nền', cell: (t) => <Nen nen={t.nen} /> },
        { key: 'tt', header: 'Lượt gần nhất', cell: (t) => { const [n, c] = QUYET[t.quyet] ?? ['?', 'inherit']; return <span><b style={{ color: c, fontSize: 12 }}>● {n}</b> <span style={{ ...nho, fontSize: 11 }}>{gioVn(t.luc)}{t.may_cua_nen && t.may_cua_nen !== t.may_mac ? ` · ${t.may_mac}` : ''}</span></span>; } },
        { key: 'ly', header: 'Vì sao / bài', cell: (t) => (t.quyet === 'dang' && t.url ? <a href={wrapExternalUrl(t.url)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>{t.slug} ↗</a> : <span style={{ fontSize: 12 }}>{t.ly_do}</span>) },
        { key: 'hom', header: 'Hôm nay', align: 'right', width: 70, cell: (t) => <span title="bài đã lên nền này hôm nay (giờ VN)">{t.da_hom}</span> },
        { key: 'kh', header: 'Ô kế hoạch hôm nay', cell: (t) => { const k = khCua(t.ma, t.nen); return k ? <span style={{ fontSize: 12 }}>{k.format}{k.can_dung ? ' ⚠' : ''} · <span style={nho}>{k.goc_ten}</span>{k.dich ? ' 🔗' : ''}</span> : <span style={nho}>—</span>; } },
        { key: 'nghi', header: 'Nghỉ', cell: (t) => (t.nghi_den ? <span style={{ fontSize: 12 }}>tới {t.nghi_den.slice(8, 10)}/{t.nghi_den.slice(5, 7)} <button type="button" disabled={ban} style={nut} onClick={() => void gui({ ma: t.ma, nen: t.nen, nghi_den: null })}>Bỏ nghỉ</button></span>
          : <span style={{ display: 'inline-flex', gap: 4 }}>{[1, 3, 7].map((n) => <button key={n} type="button" disabled={ban} style={nut} title={`nghỉ nền này ${n} ngày (máy không đăng, kế hoạch tuần chưa sinh bỏ qua)`} onClick={() => void gui({ ma: t.ma, nen: t.nen, nghi_den: new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10) })}>{n}n</button>)}</span>) }]} />
      <Collapsible title="Bài đã lên / hỏng 24 giờ" badge={du.su_kien.length} defaultOpen>
        <SimpleTable rows={du.su_kien} getRowKey={(x, i) => `${x.luc}|${i}`} columns={[
          { key: 'luc', header: 'Lúc', width: 90, cell: (x) => <span style={nho}>{ngayGioVn(x.luc)}</span> }, { key: 'may', header: 'Máy', cell: (x) => <span style={{ fontSize: 12 }}>{x.may_ten}</span> }, { key: 'nen', header: 'Nền', cell: (x) => <Nen nen={x.nen ?? ''} /> },
          { key: 'kq', header: 'Kết quả', cell: (x) => (x.ok ? <a href={x.url ? wrapExternalUrl(x.url) : '#'} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--ok, #16a34a)' }}>✓ {x.noi_dung.replace(/^Đã đăng /, '').slice(0, 90)} ↗</a> : <span style={{ fontSize: 12, color: 'var(--danger, #dc2626)' }}>✗ {x.noi_dung.replace(/^Đăng hỏng: /, '')}</span>) }]} />
      </Collapsible>
      <Collapsible title="Video / ảnh dựng 24 giờ" badge={du.video.length}>
        <SimpleTable rows={du.video} getRowKey={(v) => v.slug} columns={[
          { key: 'luc', header: 'Xuất', width: 90, cell: (v) => <span style={nho}>{ngayGioVn(v.xuat_luc)}</span> }, { key: 'may', header: 'Máy', cell: (v) => <span style={{ fontSize: 12 }}>{v.may_ten}</span> }, { key: 'mau', header: 'Mẫu', cell: (v) => <code style={{ fontSize: 11 }}>{v.mau}</code> },
          { key: 'slug', header: 'Bài', cell: (v) => <a href={wrapExternalUrl(v.video_url ?? v.anh1 ?? '#')} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>{v.slug} ↗</a> },
          { key: 'cham', header: 'Phòng Nội dung', cell: (v) => (v.cham ? <span style={{ fontSize: 12, color: v.cham === 'DUYET' ? 'var(--ok, #16a34a)' : 'var(--danger, #dc2626)' }}>{v.cham} {v.diem ?? ''}{v.chan?.length ? ` · ${v.chan[0]}` : ''}</span> : <span style={nho}>chờ chấm</span>) }]} />
      </Collapsible>
      <Collapsible title="Lịch sử lượt" badge={du.luot.length}>
        <SimpleTable rows={du.luot} getRowKey={(l) => l.luc} columns={[{ key: 'luc', header: 'Lúc', cell: (l) => <span style={nho}>{ngayGioVn(l.luc)}</span> }, { key: 'may', header: 'Máy', cell: (l) => l.may_mac }, { key: 'giay', header: 'Giây', align: 'right', cell: (l) => l.giay }, { key: 'd', header: 'Đăng', align: 'right', cell: (l) => l.so_dang }, { key: 'h', header: 'Hỏng', align: 'right', cell: (l) => <span style={{ color: l.so_hong ? 'var(--danger, #dc2626)' : undefined }}>{l.so_hong}</span> }, { key: 'b', header: 'Bỏ', align: 'right', cell: (l) => l.so_bo }, { key: 'g', header: 'Ghi', cell: (l) => <span style={nho}>{l.ghi}</span> }]} />
      </Collapsible>
    </div>);
}
