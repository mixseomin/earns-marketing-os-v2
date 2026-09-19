'use client';

// PHỦ — nền tảng đã phủ tới đâu · nguồn traffic & campaign · phễu theo campaign · lander · adapter/postback
// đang sống không · nhập chi tay. Sống trên TRANG CHỦ (anh chốt 16/09/2026: gom về mos2.on.tc cho tập trung,
// /p/<id>/phu chỉ còn redirect); trang chủ cầm tab + số tổng + project, đây chỉ vẽ MỘT phần (`phan`).
// Sửa gì cũng qua Drawer (quy ước UI nhà), số liệu đổ vào từ /api/phu/ingest + /api/phu/postback, chỉ đọc bảng phu_*.

import { useEffect, useState, useTransition } from 'react';
import { Drawer, EmptyState, Pager, Panel, Pill, SearchInput, SelectField, TextAreaField, TextField, usePaged } from '@/components/ui';
import type { PhuCamp, PhuData, PhuLuat, PhuNguon, PhuNguonCamp, PhuPlatform, PhuZone } from '@/lib/phu-shared';
import type { PhuCampNhatKy } from '@/lib/phu';
import { PHU_NGUON_TRANG_THAI, PHU_PHAN_XET, PHU_TRANG_THAI, phanXet } from '@/lib/phu-shared';
const KHAC = '(khác)';
import { docPhuCampNhatKy, docPhuNguonCamp, docPhuZone, luuPhuCamp, luuPhuChi, luuPhuDoiLyDo, luuPhuNguon, luuPhuPlatform } from '@/lib/actions/phu';

const NHOM: Record<string, string> = { cam: 'Cam 18+', ai: 'AI companion', random: 'Random chat', text: 'Text/voice', community: 'Cộng đồng', other: 'Khác' };
const cell: React.CSSProperties = { padding: '7px 9px', fontSize: 12, borderBottom: '1px solid var(--line)', verticalAlign: 'top' };
const mh = 'm-hide';   // cột phụ, ẩn trên điện thoại (globals.css ≤768px)
const head: React.CSSProperties = { ...cell, color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const btn: React.CSSProperties = { padding: '4px 10px', fontSize: 11, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };
const usd = (v: number) => (v ? `$${v.toFixed(2)}` : '—');
const khi = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { hour12: false }).replace(/:\d\d( |$)/, ' ') : '—');
const cu = (iso: string | null, phut: number) => !iso || Date.now() - new Date(iso).getTime() > phut * 60_000;

export type PhuPhan = 'camp' | 'phu' | 'nguon' | 'hatang';

/** Cần chú ý — MỘT dòng mỏng dưới số tổng, chỉ thứ đòi hành động: adapter chết · lander ĐỘNG cũ (lander tĩnh
 *  không có soMuc thì không có "sinh lại" mà đo) · camp tới ngưỡng dừng/mở rộng · sid lạ đủ lớn (≥50 view / ≥5 click).
 *  Không có thì không chiếm một pixel nào. (16/09: bản Panel trước tốn diện tích + báo lander tĩnh + 3 view lạ.) */
export function PhuCanChuY({ data: d }: { data: PhuData }) {
  const khac = d.pheu.find((x) => x.sidPrefix === KHAC);
  const dong: React.ReactNode[] = [];
  for (const a of d.adapters) if (a.lastOk === false || (a.loai === 'cron' && cu(a.lastRun, 24 * 60))) dong.push(<span key={'a' + a.key} style={{ color: 'var(--danger)' }}>adapter {a.key}{a.lastNote ? `: ${a.lastNote.slice(0, 60)}` : ' lâu không chạy'}</span>);
  for (const l of d.landers) if (l.trangThai !== 'song' || (l.soMuc != null && cu(l.lastSinh, 20))) dong.push(<span key={'l' + l.host + l.path} style={{ color: 'var(--warn)' }}>lander {l.host}{l.path} {l.trangThai !== 'song' ? l.trangThai : `sinh lúc ${khi(l.lastSinh)}`}</span>);
  for (const c of d.camp) { const px = phanXet(c); if (px.ma === 'dung' || px.ma === 'mo_rong') dong.push(<span key={'c' + c.id} style={{ color: PHU_PHAN_XET[px.ma]?.color }}>{c.ten}: {PHU_PHAN_XET[px.ma]?.label} — {(c.keHoach || px.lyDo).slice(0, 80)}</span>); }
  if (khac && (khac.view >= 50 || khac.click >= 5)) dong.push(<span key="khac" style={{ color: 'var(--warn)' }}>{khac.soPrefix} sid lạ ({khac.view} view / {khac.click} click) chưa thuộc camp nào</span>);
  if (!dong.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', fontSize: 11.5, padding: '5px 10px', border: '1px solid var(--line)', borderLeft: '3px solid var(--warn)', borderRadius: 6, background: 'var(--bg-1)' }}>
      <b style={{ color: 'var(--fg-2)' }}>Cần chú ý</b>{dong}
    </div>
  );
}

export function PhuView({ data, projectId, host, phan: tab }: { data: PhuData; projectId: string; host: string; phan: PhuPhan }) {
  const [suaPl, setSuaPl] = useState<PhuPlatform | null>(null);
  const [suaNg, setSuaNg] = useState<PhuNguon | 'moi' | null>(null);
  const [suaCamp, setSuaCamp] = useState<PhuCamp | 'moi' | null>(null);
  // Camp đã kết thúc (TF khoá tài khoản 18/09: 5 dòng chết đứng giữa bảng) gấp xuống dưới, bấm mới hiện — YDNI.
  const [hienKetThuc, setHienKetThuc] = useState(false);
  const [nhapChi, setNhapChi] = useState(false);
  const [soiCamp, setSoiCamp] = useState<PhuCamp | null>(null);
  const [nhatKy, setNhatKy] = useState<PhuCamp | null>(null);
  const [xemLuat, setXemLuat] = useState<PhuCamp | null>(null);   // luật đang chịu — drawer TẠI CHỖ, không sang tab Luật (anh 19/09: mất tập trung)
  const d = data;
  const THU_TU: Record<string, number> = { chay: 0, tam_dung: 1, nhap: 2, ket_thuc: 3 };
  const campHien = [...d.camp].sort((a, b) => (THU_TU[a.trangThai] ?? 9) - (THU_TU[b.trangThai] ?? 9)).filter((c) => hienKetThuc || c.trangThai !== 'ket_thuc');
  const soKetThuc = d.camp.filter((c) => c.trangThai === 'ket_thuc').length;
  const dem = (tt: string) => d.platforms.filter((p) => p.trangThai === tt).length;
  const hom = new Date().toISOString().slice(0, 10);
  const pheuCua = (prefix: string) => d.pheu.find((x) => x.sidPrefix === prefix);
  const khac = d.pheu.find((x) => x.sidPrefix === KHAC);
  const organic = d.pheu.find((x) => x.sidPrefix === '');
  const pct = (a: number, b: number, so = 0) => (b ? `${((a / b) * 100).toFixed(so)}%` : '—');
  const so = (v: number) => <span style={{ color: v ? undefined : 'var(--fg-3)' }}>{v}</span>;   // 0 mờ: mắt chỉ dừng ở ô có số (anh 17/09)
  const cpc = (chi: number, click: number, tran: number) => click && chi ? <span style={{ color: chi / click > tran ? 'var(--danger)' : undefined }}>${(chi / click).toFixed(3)}</span> : '—';

  // YDNI: một phần một lượt — bảng campaign (chiến lược + phễu + phán xét trên cùng một dòng) là mặt chính,
  // nền tảng / nguồn / lander / adapter là tham chiếu phụ, trang chủ gắn badge số đếm + số đỏ để biết có.
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {d.loi && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{d.loi}</div>}

      {tab === 'camp' && <Panel title={`Campaign (${d.camp.length - soKetThuc})`} subtitle={`phễu ${d.days} ngày · phán xét theo cộng dồn`} style={{ marginBottom: 0 }}
        actions={<span style={{ display: 'flex', gap: 6 }}><button style={btn} onClick={() => setNhapChi(true)}>+ nhập chi</button><button style={btn} onClick={() => setSuaCamp('moi')}>+ campaign</button></span>}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={head}>Campaign</th><th style={head} className={mh}>$/ngày · hạn</th>
              <th style={head} title="click MẠNG đếm (ExoClick/Bidvertiser/TF) — camp nảy thẳng qua /x/ không có lander nên View/Click của mình = 0; % = hit /x/ ÷ click mạng (P2)">Click mạng</th><th style={head}>View</th><th style={head} className={mh}>Cổng</th><th style={head} title="click trên lander của mình">Click</th><th style={head} className={mh} title="hit ra offer (lander) hoặc hit qua /x/ (camp nảy thẳng)">Out</th><th style={head}>Signup</th><th style={head}>Về / chi</th><th style={head} title="chi ÷ click ra offer (click lander, hoặc out khi nảy thẳng); đỏ khi vượt trần tiêu chí">CPC</th>
              <th style={head} title="kết quả BỘ LUẬT (tab Luật) chấm trên số cộng dồn + 7 ngày; DỪNG = adapter pause qua API mạng">Phán xét</th><th style={head} className={mh}>Soi</th>
            </tr></thead>
            <tbody>
              {campHien.map((c) => {
                const px = phanXet(c);
                const f = pheuCua(c.sidPrefix);
                const t = c.tieuChi;
                const quaHan = c.ketThuc && hom > c.ketThuc.slice(0, 10);
                const toiXem = px.xemLai && px.xemLai <= hom;
                return (
                  <tr key={c.id} onClick={() => setSuaCamp(c)} style={{ cursor: 'pointer', opacity: c.trangThai === 'chay' ? 1 : 0.45 }} title="Sửa campaign">
                    <td style={cell}><b>{c.ten}</b>
                      <div style={{ ...mono, color: 'var(--fg-3)', fontSize: 10 }}>{c.sidPrefix} · {[c.target.device, c.target.geo, c.target.format, c.target.source, c.target.bid != null ? `bid $${c.target.bid}` : null].filter(Boolean).join(' · ')}</div>
                      {c.trangThai !== 'chay' && <Pill color={c.trangThai === 'tam_dung' ? 'var(--warn)' : 'var(--fg-3)'} label={c.trangThai} />}
                    </td>
                    <td style={{ ...cell, ...mono, fontSize: 11, whiteSpace: 'nowrap' }} className={mh}>{c.nganSachNgay == null ? '—' : usd(c.nganSachNgay)}<div style={{ color: quaHan ? 'var(--danger)' : 'var(--fg-3)', fontSize: 10 }}>{c.ketThuc ? `tới ${c.ketThuc.slice(5, 10)}` : 'không hạn'}{toiXem ? ' · tới nhịp' : ''}</div></td>
                    <td style={{ ...cell, ...mono }}>{c.tong.clickMang ? so(c.tong.clickMang) : '—'}<span style={{ color: c.tong.clickMang >= 300 && (f?.out ?? 0) / c.tong.clickMang < (Number(t.hit_tren_click) || 0) ? 'var(--danger)' : 'var(--fg-3)', fontSize: 10 }}> {c.tong.clickMang && f?.out ? pct(f.out, c.tong.clickMang) : ''}</span></td>
                    <td style={{ ...cell, ...mono }}>{so(f?.view ?? 0)}</td>
                    <td style={{ ...cell, ...mono }} className={mh}>{f?.view ? pct(f.gate, f.view) : '—'}</td>
                    <td style={{ ...cell, ...mono }}>{so(f?.click ?? 0)}<span style={{ color: f?.view && f.click / f.view < 0.05 ? 'var(--danger)' : 'var(--fg-3)', fontSize: 10 }}> {f?.view ? pct(f.click, f.view, 1) : ''}</span></td>
                    <td style={{ ...cell, ...mono }} className={mh}>{so(f?.out ?? 0)}</td>
                    <td style={{ ...cell, ...mono }}>{so(f?.signup ?? 0)}</td>
                    <td style={{ ...cell, ...mono, whiteSpace: 'nowrap' }}>{usd(f?.revenue ?? 0)} / {usd(f?.chi ?? 0)}</td>
                    <td style={{ ...cell, ...mono }}>{cpc(f?.chi ?? 0, f?.click || f?.out || 0, Number(c.tieuChi.gia_click_toi_da) || 0.03)}</td>
                    <td style={cell} title={c.luat ? `luật đang chịu (${c.luat.khop.length}): ${c.luat.khop.map((l) => l.ten).join(' · ')}` : undefined}>
                      <Pill color={PHU_PHAN_XET[px.ma]?.color ?? 'var(--fg-3)'} label={PHU_PHAN_XET[px.ma]?.label ?? px.ma} />
                      <div style={{ color: 'var(--fg-3)', fontSize: 10, marginTop: 3 }}>{px.lyDo}</div>
                      {c.trangThai === 'chay' && c.luat && <button style={{ ...btn, fontSize: 10, padding: '0 6px', marginTop: 2 }} onClick={(e) => { e.stopPropagation(); setXemLuat(c); }} title="luật đang chịu + luật đã chạm — xem tại chỗ">{c.luat.khop.length} luật ▸</button>}
                      {Object.keys(t).length ? null : <div style={{ color: 'var(--warn)', fontSize: 10 }}>chưa đặt tham số camp — dùng mặc định kệ pop</div>}
                    </td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }} className={mh}><button style={btn} onClick={(e) => { e.stopPropagation(); setNhatKy(c); }} title="Số theo ngày + mỗi lần đổi cài đặt (trước → sau)">nhật ký ▸</button> <button style={btn} onClick={(e) => { e.stopPropagation(); setSoiCamp(c); }} title="Xem theo srcid/zone để blacklist">srcid ▸</button></td>
                  </tr>
                );
              })}
              {soKetThuc > 0 && (
                <tr>
                  <td colSpan={13} style={{ ...cell, color: 'var(--fg-3)', fontSize: 11 }}>
                    <button style={{ ...btn, fontSize: 11 }} onClick={() => setHienKetThuc((v) => !v)}>{hienKetThuc ? 'ẩn' : 'hiện'} {soKetThuc} camp đã kết thúc</button>
                  </td>
                </tr>
              )}
              {khac && (
                <tr>
                  <td style={cell}><span style={{ color: 'var(--warn)' }}>(khác)</span><div style={{ color: 'var(--fg-3)', fontSize: 10 }}>{khac.soPrefix} sid_prefix không khớp camp nào — <button style={{ ...btn, padding: '0 6px', fontSize: 10 }} onClick={() => setSuaCamp('moi')}>đăng ký camp</button> hoặc mở camp → Nâng cao → Alias</div></td>
                  <td style={cell} className={mh}>—</td>
                  <td style={{ ...cell, ...mono }}>{so(khac.view)}</td><td style={{ ...cell, ...mono }} className={mh}>{pct(khac.gate, khac.view)}</td><td style={{ ...cell, ...mono }}>{so(khac.click)}</td><td style={{ ...cell, ...mono }} className={mh}>{so(khac.out)}</td><td style={{ ...cell, ...mono }}>{so(khac.signup)}</td>
                  <td style={{ ...cell, ...mono, whiteSpace: 'nowrap' }}>{usd(khac.revenue)} / {usd(khac.chi)}</td><td style={{ ...cell, ...mono }}>{cpc(khac.chi, khac.click, 0.03)}</td><td style={cell}>—</td><td style={cell} className={mh}>—</td>
                </tr>
              )}
              {organic && (
                <tr>
                  <td style={cell}><span style={{ color: 'var(--fg-3)' }}>(organic / không sid)</span></td><td style={cell} className={mh}>—</td>
                  <td style={{ ...cell, ...mono }}>{so(organic.view)}</td><td style={{ ...cell, ...mono }} className={mh}>{pct(organic.gate, organic.view)}</td><td style={{ ...cell, ...mono }}>{so(organic.click)}</td><td style={{ ...cell, ...mono }} className={mh}>{so(organic.out)}</td><td style={{ ...cell, ...mono }}>{so(organic.signup)}</td>
                  <td style={{ ...cell, ...mono, whiteSpace: 'nowrap' }}>{usd(organic.revenue)} / —</td><td style={cell}>—</td><td style={cell}>—</td><td style={cell} className={mh}>—</td>
                </tr>
              )}
            </tbody>
          </table>
          {!d.camp.length && <EmptyState icon="📉" title="Chưa có campaign" description="Adapter mạng QC tự khai camp (Bidvertiser: tên bv-*), hoặc + campaign." compact />}
        </div>
      </Panel>}

      {tab === 'phu' && <Panel title={`Nền tảng phủ (${d.platforms.length})`} subtitle={`${dem('da_cam')} đã cắm · ${dem('cho_duyet') + dem('da_dang_ky')} chờ duyệt · ${dem('chua')} chưa đăng ký · bấm dòng để sửa`} style={{ marginBottom: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Nền tảng</th><th style={head} className={mh}>Nhóm</th><th style={head} className={mh}>Chương trình</th><th style={head} className={mh}>Hoa hồng</th><th style={head}>Trạng thái</th><th style={head} className={mh}>Cửa ra</th><th style={head}>Bước kế</th><th style={head} className={mh}>Card</th></tr></thead>
            <tbody>
              {d.platforms.map((p) => {
                const tt = PHU_TRANG_THAI[p.trangThai] ?? { label: p.trangThai, color: 'var(--fg-3)' };
                return (
                  <tr key={p.id} onClick={() => setSuaPl(p)} style={{ cursor: 'pointer' }} title="Sửa">
                    <td style={cell}><b>{p.name}</b><div style={{ ...mono, color: 'var(--fg-3)', fontSize: 10 }}>{p.slug}</div></td>
                    <td style={cell} className={mh}>{NHOM[p.nhom] ?? p.nhom}</td>
                    <td style={{ ...cell, ...mono }} className={mh}>{p.chuongTrinh ?? '—'}</td>
                    <td style={cell} className={mh}>{p.hoaHong ?? '—'}</td>
                    <td style={cell}><Pill color={tt.color} label={tt.label} /></td>
                    <td style={{ ...cell, ...mono }} className={mh}>{p.cuaRa ? <a href={`https://${host}${p.cuaRa.startsWith('/') ? p.cuaRa : ''}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{p.cuaRa}</a> : '—'}</td>
                    <td style={{ ...cell, maxWidth: 320 }}>{p.buocKe ?? <span style={{ color: 'var(--fg-3)' }}>—</span>}</td>
                    <td style={{ ...cell, ...mono }} className={mh}>{p.cardId ? <a href={`/p/${projectId}/plays?task=${p.cardId}`} onClick={(e) => e.stopPropagation()}>#{p.cardId}{p.cardStatus ? ` · ${p.cardStatus}` : ''}</a> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!d.platforms.length && <EmptyState icon="🧩" title="Chưa có nền tảng" description="Nạp bằng scripts/phu/seed hoặc /api/phu/ingest." compact />}
        </div>
      </Panel>}

      {tab === 'nguon' && <Panel title={`Nguồn traffic (${d.nguon.length})`} subtitle="sid = <nguồn>_<camp>_<srcid> — URL mua traffic chỉ cần utm_source/utm_campaign/utm_term, lander tự ghép" style={{ marginBottom: 0 }}
        actions={<button style={btn} onClick={() => setSuaNg('moi')}>+ nguồn</button>}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Nguồn</th><th style={head}>Loại</th><th style={head}>Trạng thái</th><th style={head} className={mh}>Macro click</th><th style={head}>Nạp</th><th style={head}>Số dư</th><th style={head} className={mh}>Ghi chú</th></tr></thead>
            <tbody>
              {d.nguon.filter((g) => g.trangThai === 'hoat_dong' || g.trangThai === 'dang_mo' || g.trangThai === 'tam_dung').map((g) => {
                const tt = PHU_NGUON_TRANG_THAI[g.trangThai] ?? { label: g.trangThai, color: 'var(--fg-3)' };
                return (
                  <tr key={g.id} onClick={() => setSuaNg(g)} style={{ cursor: 'pointer' }} title="Sửa">
                    <td style={cell}><b>{g.name}</b><div style={{ ...mono, color: 'var(--fg-3)', fontSize: 10 }}>{g.key}</div></td>
                    <td style={cell}>{g.loai}</td>
                    <td style={cell}><Pill color={tt.color} label={tt.label} /></td>
                    <td style={{ ...cell, ...mono }} className={mh}>{g.macroClick ?? '—'}</td>
                    <td style={{ ...cell, ...mono }}>{usd(g.napUsd)}</td>
                    <td style={{ ...cell, ...mono }} title={g.soDuLuc ? `lúc ${g.soDuLuc.slice(0, 16).replace('T', ' ')}Z` : 'adapter chưa báo'}>{g.soDu == null ? '—' : usd(g.soDu)}</td>
                    <td style={{ ...cell, fontSize: 11, color: 'var(--fg-2)', maxWidth: 420 }} className={mh}>{g.ghiChu ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!d.nguon.length && <EmptyState icon="📡" title="Chưa có nguồn traffic" compact />}
          {d.nguon.some((g) => g.trangThai === 'du_kien' || g.trangThai === 'bo') && (
            <details style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-3)' }}>
              <summary style={{ cursor: 'pointer' }}>{d.nguon.filter((g) => g.trangThai === 'du_kien' || g.trangThai === 'bo').length} nguồn dự kiến / bỏ</summary>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {d.nguon.filter((g) => g.trangThai === 'du_kien' || g.trangThai === 'bo').map((g) => <button key={g.id} style={btn} onClick={() => setSuaNg(g)}>{g.name} · {PHU_NGUON_TRANG_THAI[g.trangThai]?.label ?? g.trangThai}</button>)}
              </div>
            </details>
          )}
        </div>
      </Panel>}

      {tab === 'hatang' && <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))' }}>
        <Panel title={`Lander (${d.landers.length})`} subtitle="subdomain riêng, noindex · lander động phải mới hơn 15 phút" style={{ marginBottom: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Lander</th><th style={head} className={mh}>Bán</th><th style={head}>Sinh lúc</th><th style={head} className={mh}>Mục</th></tr></thead>
            <tbody>
              {d.landers.map((l) => (
                <tr key={l.host + l.path}>
                  <td style={cell}><a href={`https://${l.host}${l.path}`} target="_blank" rel="noreferrer" style={mono}>{l.host}{l.path}</a><div style={{ color: 'var(--fg-3)', fontSize: 11 }}>{l.ten}</div></td>
                  <td style={cell} className={mh}>{l.dich ?? '—'}</td>
                  <td style={{ ...cell, ...mono, color: l.trangThai !== 'song' || cu(l.lastSinh, 20) ? 'var(--warn)' : 'var(--fg-2)' }}>{khi(l.lastSinh)}</td>
                  <td style={{ ...cell, ...mono }} className={mh}>{l.soMuc ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.landers.length && <EmptyState icon="🛬" title="Chưa có lander" compact />}
        </Panel>
        <Panel title={`Adapter (${d.adapters.length})`} subtitle="đỏ = lâu không chạy hoặc lần cuối lỗi · dòng postback kèm URL dán vào mạng" style={{ marginBottom: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Adapter</th><th style={head} className={mh}>Lịch</th><th style={head}>Chạy cuối</th><th style={head}>Ghi chú</th></tr></thead>
            <tbody>
              {d.adapters.map((a) => {
                const hong = a.lastOk === false || (a.loai === 'cron' && cu(a.lastRun, 24 * 60));
                return (
                  <tr key={a.key}>
                    <td style={cell}><b>{a.name}</b><div style={{ ...mono, color: 'var(--fg-3)', fontSize: 10 }}>{a.key} · {a.loai}</div></td>
                    <td style={{ ...cell, ...mono, fontSize: 11 }} className={mh}>{a.lich ?? '—'}</td>
                    <td style={{ ...cell, ...mono, color: hong ? 'var(--danger)' : 'var(--fg-2)' }}>{khi(a.lastRun)}</td>
                    <td style={{ ...cell, fontSize: 11, color: 'var(--fg-2)' }}>{a.lastNote ?? '—'}{a.loai === 'postback' && a.postbackToken && <div style={{ ...mono, fontSize: 10, wordBreak: 'break-all', color: 'var(--fg-3)', marginTop: 4 }}>https://mos2.on.tc/api/phu/postback/{a.postbackToken}?event=&lt;signup|lead|spend&gt;&amp;sid=&lt;macro sub id&gt;&amp;amount=&lt;payout&gt;&amp;id=&lt;txn id&gt; (mạng bỏ query string vẫn nhận được vì token nằm trên đường dẫn)</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!d.adapters.length && <EmptyState icon="🔌" title="Chưa adapter nào báo về" compact />}
        </Panel>
      </div>}

      {suaPl && <SuaPlatform p={suaPl} projectId={projectId} onClose={() => setSuaPl(null)} />}
      {suaNg && <SuaNguon g={suaNg === 'moi' ? null : suaNg} projectId={projectId} onClose={() => setSuaNg(null)} />}
      {suaCamp && <SuaCamp c={suaCamp === 'moi' ? null : suaCamp} nguon={d.nguon} projectId={projectId} onClose={() => setSuaCamp(null)} />}
      {nhapChi && <NhapChi camp={d.camp} projectId={projectId} onClose={() => setNhapChi(false)} />}
      {soiCamp && <SoiNguon c={soiCamp} projectId={projectId} days={d.days} onClose={() => setSoiCamp(null)} />}
      {xemLuat && xemLuat.luat && <LuatCampDrawer camp={xemLuat} luat={xemLuat.luat} onClose={() => setXemLuat(null)} />}
      {nhatKy && <NhatKyCamp c={nhatKy} projectId={projectId} onClose={() => setNhatKy(null)} />}
    </div>
  );
}

// Nhật ký camp: mỗi NGÀY một dòng số (view/click/out/signup/chi), xen dòng ĐỔI cài đặt (trước → sau) đúng ngày đó —
// đọc "đổi bid xong ngày sau ra sao" trên một bảng. Đổi do adapter/API không có lý do → ô "ghi lý do" tại chỗ.
const TRUONG: Record<string, string> = { tao: 'tạo', trang_thai: 'trạng thái', bid: 'bid', editorial: 'duyệt', ngan_sach_ngay: '$/ngày', lander: 'lander', target: 'nhắm', tieu_chi: 'tiêu chí', ket_thuc: 'hạn', ke_hoach: 'kế hoạch' };
function NhatKyCamp({ c, projectId, onClose }: { c: PhuCamp; projectId: string; onClose: () => void }) {
  const [nk, setNk] = useState<PhuCampNhatKy | null>(null);
  const [suaId, setSuaId] = useState<number | null>(null);
  const [lyDo, setLyDo] = useState('');
  useEffect(() => { docPhuCampNhatKy(projectId, c.sidPrefix, 30).then(setNk).catch(() => setNk({ ngay: [], doi: [] })); }, [projectId, c.sidPrefix]);
  const ngayCua = (ts: string) => new Date(ts).toISOString().slice(0, 10);
  const cac = new Set<string>([...(nk?.ngay.map((x) => x.ngay) ?? []), ...(nk?.doi.map((x) => ngayCua(x.ts)) ?? [])]);
  const hang = [...cac].sort().reverse();
  const luuLyDo = async (id: number) => { await luuPhuDoiLyDo(projectId, id, lyDo); setNk((k) => k && { ...k, doi: k.doi.map((x) => (x.id === id ? { ...x, lyDo } : x)) }); setSuaId(null); setLyDo(''); };
  return (
    <Drawer onClose={onClose} width={680}>
      <div style={{ padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>{c.ten} · nhật ký 30 ngày</h2>
        <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>Mỗi ngày một dòng số; dòng vàng = đổi cài đặt (trước → sau). Bấm "ghi lý do" để chú thích lần đổi chưa có lý do.</div>
        {nk === null ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Đang đọc…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>Ngày</th><th style={head}>Visit</th><th style={head}>View</th><th style={head}>Click</th><th style={head}>Out</th><th style={head}>Signup</th><th style={head}>Chi</th><th style={head}>$/click</th></tr></thead>
            <tbody>
              {hang.map((ng) => {
                const x = nk.ngay.find((r) => r.ngay === ng);
                const ds = nk.doi.filter((r) => ngayCua(r.ts) === ng);
                return [
                  x ? (
                    <tr key={ng}>
                      <td style={{ ...cell, ...mono }}>{ng.slice(5)}</td><td style={{ ...cell, ...mono }}>{x.visit || '—'}</td><td style={{ ...cell, ...mono }}>{x.view || '—'}</td>
                      <td style={{ ...cell, ...mono }}>{x.click}<span style={{ color: 'var(--fg-3)', fontSize: 10 }}> {x.view ? `${((x.click / x.view) * 100).toFixed(1)}%` : ''}</span></td>
                      <td style={{ ...cell, ...mono }}>{x.out}</td><td style={{ ...cell, ...mono }}>{x.signup}</td><td style={{ ...cell, ...mono }}>{usd(x.chi)}</td>
                      <td style={{ ...cell, ...mono, color: x.click && x.chi / x.click > (Number(c.tieuChi.gia_click_toi_da) || 0.03) ? 'var(--danger)' : undefined }}>{x.click && x.chi ? `$${(x.chi / x.click).toFixed(3)}` : '—'}</td>
                    </tr>
                  ) : <tr key={ng}><td style={{ ...cell, ...mono }}>{ng.slice(5)}</td><td style={cell} colSpan={7} /></tr>,
                  ...ds.map((r) => (
                    <tr key={'d' + r.id} style={{ background: 'color-mix(in srgb, var(--warn) 8%, transparent)' }}>
                      <td style={{ ...cell, ...mono, fontSize: 10, color: 'var(--fg-3)' }}>{new Date(r.ts).toISOString().slice(11, 16)}Z</td>
                      <td style={{ ...cell, fontSize: 11 }} colSpan={7}>
                        <b>{TRUONG[r.truong] ?? r.truong}</b>{r.cu != null && <span style={mono}> {r.cu}</span>}{r.cu != null && ' → '}<span style={{ ...mono, color: 'var(--fg-0)' }}>{r.moi}</span>
                        <span style={{ color: 'var(--fg-3)', fontSize: 10 }}> · {r.nguon}</span>
                        {suaId === r.id ? (
                          <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6 }}><input autoFocus value={lyDo} onChange={(e) => setLyDo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') luuLyDo(r.id); if (e.key === 'Escape') setSuaId(null); }} style={{ fontSize: 11, padding: '2px 6px', width: 260 }} placeholder="lý do đổi…" /><button style={{ ...btn, padding: '1px 8px' }} onClick={() => luuLyDo(r.id)}>lưu</button></span>
                        ) : r.lyDo ? <div style={{ color: 'var(--fg-2)', marginTop: 2 }}>{r.lyDo} <button style={{ ...btn, padding: '0 6px', fontSize: 10 }} onClick={() => { setSuaId(r.id); setLyDo(r.lyDo ?? ''); }}>sửa</button></div>
                          : <button style={{ ...btn, padding: '0 6px', fontSize: 10, marginLeft: 6, color: 'var(--warn)' }} onClick={() => { setSuaId(r.id); setLyDo(''); }}>ghi lý do</button>}
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        )}
        {nk && !hang.length && <EmptyState icon="📓" title="Chưa có gì" compact />}
      </div>
    </Drawer>
  );
}

// Drill-down: nguồn (srcid/zone) của một camp — cái cần để blacklist. Đọc khi mở, phân trang 50.
function SoiNguon({ c, projectId, days, onClose }: { c: PhuCamp; projectId: string; days: number; onClose: () => void }) {
  const [rows, setRows] = useState<PhuNguonCamp[] | null>(null);
  const [zones, setZones] = useState<PhuZone[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { docPhuNguonCamp(projectId, c.sidPrefix, days).then(setRows).catch(() => setRows([])); docPhuZone(projectId, c.sidPrefix).then(setZones).catch(() => setZones([])); }, [projectId, c.sidPrefix, days]);
  const loc = (rows ?? []).filter((r) => !q || r.nguon.includes(q));
  const pg = usePaged(loc, 50);
  const xau = (r: PhuNguonCamp) => r.view >= 50 && r.click === 0 && r.signup === 0;
  return (
    <Drawer onClose={onClose} width={620}>
      <div style={{ padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>{c.ten} · nguồn theo srcid · {days} ngày</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--fg-3)' }}>
          <SearchInput value={q} onChange={setQ} placeholder="lọc srcid…" />
          <span>{loc.length} nguồn · <span style={{ color: 'var(--danger)' }}>{loc.filter(xau).length} đáng blacklist</span> (≥50 view, 0 click, 0 signup)</span>
        </div>
        {rows === null ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>Đang đọc…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>srcid</th><th style={head}>View</th><th style={head}>Cổng</th><th style={head}>Click</th><th style={head}>Out</th><th style={head}>Signup</th><th style={head}>Về</th></tr></thead>
            <tbody>
              {pg.pageItems.map((r) => (
                <tr key={r.nguon} style={{ color: xau(r) ? 'var(--danger)' : undefined }}>
                  <td style={{ ...cell, ...mono, fontSize: 11 }}>{r.nguon || '(trống)'}</td>
                  <td style={{ ...cell, ...mono }}>{r.view}</td><td style={{ ...cell, ...mono }}>{r.gate}</td><td style={{ ...cell, ...mono }}>{r.click}</td>
                  <td style={{ ...cell, ...mono }}>{r.out}</td><td style={{ ...cell, ...mono }}>{r.signup}</td><td style={{ ...cell, ...mono }}>{usd(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={pg.page} pageCount={pg.pageCount} total={pg.total} pageSize={pg.pageSize} onPage={pg.setPage} />
        {zones.length > 0 && <>
          <h3 style={{ margin: '10px 0 0', fontSize: 13 }}>Zone (mạng) · {zones.length} · ba bộ đếm: click mạng → hit /x/ → bot · <span style={{ color: 'var(--danger)' }}>{zones.filter((z) => z.chan).length} chạm luật</span></h3>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>K1 ≥$1 · ≥20 click · 0 hit · P2 ≥300 click mà hit/click &lt; 70% · P3 ≥500 hit mà bot &gt; 30% — máy chặn zone qua API, ghi nhật ký camp</div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={head}>zone</th><th style={head}>Imp</th><th style={head}>Click</th><th style={head}>Chi</th><th style={head}>Hit /x/</th><th style={head}>Bot</th><th style={head}>hit/click</th><th style={head}>Luật</th></tr></thead>
            <tbody>
              {zones.map((z) => { const tong = z.hits + z.bots; const tl = z.clicks ? tong / z.clicks : null; return (
                <tr key={z.zoneId} style={{ color: z.chan ? 'var(--danger)' : undefined }}>
                  <td style={{ ...cell, ...mono, fontSize: 11 }}>{z.zoneId}{z.site ? <div style={{ color: 'var(--fg-3)', fontSize: 10 }}>{z.site}</div> : null}</td>
                  <td style={{ ...cell, ...mono }}>{z.impressions}</td><td style={{ ...cell, ...mono }}>{z.clicks}</td><td style={{ ...cell, ...mono }}>{usd(z.chi)}</td>
                  <td style={{ ...cell, ...mono }}>{z.hits}</td><td style={{ ...cell, ...mono }}>{z.bots}</td>
                  <td style={{ ...cell, ...mono }}>{tl == null ? '—' : `${(tl * 100).toFixed(0)}%`}</td>
                  <td style={{ ...cell, fontSize: 11 }} title={z.chan?.lyDo}>{z.chan ? `${z.chan.luat} · ${z.chan.trangThai === 'da_chan' ? 'ĐÃ CHẶN' : z.chan.trangThai === 'loi' ? 'lỗi chặn' : 'đề xuất'}` : ''}</td>
                </tr>); })}
            </tbody>
          </table></div>
        </>}
      </div>
    </Drawer>
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
  // Cấu hình = ô nhập tử tế, không JSON. target/tieu_chi vẫn là jsonb dưới DB (adapter mạng đọc/ghi), form chỉ
  // là mặt người: mọi khoá lạ trong target (bv_id, editorial…) giữ nguyên khi lưu.
  const t = (c?.target ?? {}) as Record<string, unknown>;
  const tc = c?.tieuChi ?? {};
  const str = (v: unknown) => (v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v));
  const [f, setF] = useState({
    nguonKey: c?.nguonKey ?? (nguon[0]?.key ?? ''), ten: c?.ten ?? '', sidPrefix: c?.sidPrefix ?? '', lander: c?.lander ?? '',
    geo: str(t.geo) || 'US', device: str(t.device).toLowerCase() || 'desktop', format: str(t.format).toLowerCase() || 'pop-under', source: str(t.source).toLowerCase() || 'porn',
    bid: str(t.bid), placement: str(t.placement), alias: str(t.alias),
    nganSachNgay: c?.nganSachNgay == null ? '5' : String(c.nganSachNgay), trangThai: c?.trangThai ?? 'nhap',
    ketThuc: c?.ketThuc ? c.ketThuc.slice(0, 10) : new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10), nhipNgay: String(c?.nhipNgay ?? 1),
    chiToiDa: tc.chi_toi_da == null ? '15' : String(tc.chi_toi_da), clickToiThieu: tc.click_toi_thieu == null ? '300' : String(tc.click_toi_thieu), signup1k: tc.signup_1k == null ? '10' : String(tc.signup_1k), giaClickToiDa: tc.gia_click_toi_da == null ? '0.03' : String(tc.gia_click_toi_da), thuChi: tc.thu_chi == null ? '' : String(tc.thu_chi), hitTrenClick: tc.hit_tren_click == null ? '' : String(tc.hit_tren_click),
    keHoach: c?.keHoach ?? '', ghiChu: c?.ghiChu ?? '', lyDo: '',
  });
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [loi, setLoi] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  const luu = () => start(async () => {
    try {
      const target = { ...t, geo: f.geo.trim(), device: f.device, format: f.format, source: f.source,
        bid: f.bid.trim() ? Number(f.bid) : undefined, placement: f.placement.trim() || undefined,
        alias: f.alias.split(',').map((x) => x.trim()).filter(Boolean) };
      if (!target.alias.length) delete (target as { alias?: unknown }).alias;
      const tieuChi = { chi_toi_da: Number(f.chiToiDa) || 0, click_toi_thieu: Number(f.clickToiThieu) || 0, signup_1k: Number(f.signup1k) || 0, gia_click_toi_da: Number(f.giaClickToiDa) || 0, thu_chi: Number(f.thuChi) || 0, hit_tren_click: Number(f.hitTrenClick) || 0 };
      await luuPhuCamp(projectId, { nguonKey: f.nguonKey, ten: f.ten, sidPrefix: f.sidPrefix, lander: f.lander, target: JSON.stringify(target), nganSachNgay: f.nganSachNgay,
        trangThai: f.trangThai, ghiChu: f.ghiChu, ketThuc: f.ketThuc, nhipNgay: f.nhipNgay, tieuChi: JSON.stringify(tieuChi), keHoach: f.keHoach, lyDo: f.lyDo });
      onClose();
    } catch (e) { setLoi(String((e as Error).message)); }
  });
  const hai: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 };
  const ba: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 };
  const nhom = (x: string) => <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>{x}</div>;
  return (
    <Khung tieuDe={c ? `Campaign · ${c.ten}` : 'Campaign mới'} onClose={onClose} pending={pending} dirty={dirty} onSave={luu}>
      {loi && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{loi}</div>}
      <div style={hai}>
        <SelectField label="Nguồn" value={f.nguonKey} onChange={set('nguonKey')}>
          {nguon.map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}
        </SelectField>
        <TextField label="sid_prefix" value={f.sidPrefix} onChange={set('sidPrefix')} mono disabled={!!c} hint="<nguồn>_<camp>, vd bidvertiser_pop-us-d" />
      </div>
      <TextField label="Tên" value={f.ten} onChange={set('ten')} />
      {nhom('Nhắm')}
      <div style={ba}>
        <TextField label="GEO" value={f.geo} onChange={set('geo')} mono hint="US · US,CA,UK" />
        <SelectField label="Thiết bị" value={f.device} onChange={set('device')}>
          {['desktop', 'mobile', 'cả hai'].map((x) => <option key={x} value={x}>{x}</option>)}
        </SelectField>
        <SelectField label="Định dạng" value={f.format} onChange={set('format')}>
          {['pop-under', 'direct', 'native', 'push', 'search', 'social', 'khác'].map((x) => <option key={x} value={x}>{x}</option>)}
        </SelectField>
      </div>
      <div style={ba}>
        <SelectField label="Loại traffic" value={f.source} onChange={set('source')}>
          {['porn', 'mainstream'].map((x) => <option key={x} value={x}>{x}</option>)}
        </SelectField>
        <TextField label="Bid (USD)" value={f.bid} onChange={set('bid')} mono hint="CPV/CPC" />
        <TextField label="Ngân sách/ngày (USD)" value={f.nganSachNgay} onChange={set('nganSachNgay')} mono />
      </div>
      <TextField label="Lander / đích" value={f.lander} onChange={set('lander')} mono hint="URL thật camp trỏ tới — adapter tự điền từ API mạng; trống = chưa biết, không đoán" />
      {nhom('Thử & phán xét')}
      <div style={ba}>
        <TextField label="Hạn thử" value={f.ketThuc} onChange={set('ketThuc')} mono hint="YYYY-MM-DD · quá ngày chưa đạt = DỪNG" />
        <TextField label="Nhịp xem lại (ngày)" value={f.nhipNgay} onChange={set('nhipNgay')} mono />
        <SelectField label="Trạng thái" value={f.trangThai} onChange={set('trangThai')}>
          {['nhap', 'chay', 'tam_dung', 'ket_thuc'].map((x) => <option key={x} value={x}>{x}</option>)}
        </SelectField>
      </div>
      <div style={ba}>
        <TextField label="$ thử tối đa" value={f.chiToiDa} onChange={set('chiToiDa')} mono hint="= tham số Trần tiền thử (luật T0 dừng khi chạm, M1 mở rộng ở nửa); trống = mặc định kệ pop" />
        <TextField label="Click tối thiểu" value={f.clickToiThieu} onChange={set('clickToiThieu')} mono hint="= Đủ mẫu D14; chưa đủ = CHỜ (luật dừng vẫn chạm được)" />
        <TextField label="Signup / 1k click" value={f.signup1k} onChange={set('signup1k')} mono hint="ghi nhớ mục tiêu — CHƯA có luật nào đọc (mở rộng đi theo thu/chi, luật M1)" />
      </div>
      <div style={hai}>
        <TextField label="Giá 1 click ra offer tối đa (USD)" value={f.giaClickToiDa} onChange={set('giaClickToiDa')} mono hint="= Trần CPC đang đặt (luật K3: vượt ×1,3 hai ngày liền → hạ bid; K3b → dừng); revshare cam ~$0,03" />
        <TextField label="Thu / chi tối thiểu" value={f.thuChi} onChange={set('thuChi')} mono hint="= ROAS mục tiêu (luật M1: chi ≥ nửa $ thử mà thu/chi đạt = đề xuất MỞ RỘNG); trống = mặc định 1,5" />
      </div>
      <TextField label="Hit /x/ ÷ click mạng tối thiểu (P2)" value={f.hitTrenClick} onChange={set('hitTrenClick')} mono hint="= CTR bấm ra sàn (luật P2: ≥300 click mạng mà tỉ lệ tới máy mình dưới sàn = DỪNG; 0 hit = P0 chỉ CẢNH BÁO, nghi đường đo); trống = mặc định 15%" />
      <TextAreaField label="Kế hoạch sau phán xét" value={f.keHoach} onChange={set('keHoach')} rows={2} hint="đạt → mở gì; không đạt → đổi gì" />
      {c && <TextField label="Lý do lần đổi này" value={f.lyDo} onChange={set('lyDo')} hint="vào nhật ký camp cùng với trước → sau của mọi ô đổi" />}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--fg-3)' }}>Nâng cao</summary>
        <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
          <TextField label="Alias sid (URL đời cũ)" value={f.alias} onChange={set('alias')} mono hint="phẩy cách; sid bắt đầu bằng alias cũng tính vào camp này" />
          <TextField label="Placement" value={f.placement} onChange={set('placement')} />
          <TextAreaField label="Ghi chú" value={f.ghiChu} onChange={set('ghiChu')} rows={2} />
          {Object.keys(t).filter((k) => !['geo', 'device', 'format', 'source', 'bid', 'placement', 'alias'].includes(k)).length > 0 && (
            <div style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>adapter ghi: {Object.entries(t).filter(([k]) => !['geo', 'device', 'format', 'source', 'bid', 'placement', 'alias'].includes(k)).map(([k, v]) => `${k}=${String(v)}`).join(' · ')}</div>
          )}
        </div>
      </details>
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

/* Luật đang chịu của MỘT camp — đọc tại chỗ: luật đã chạm (số thật đối chiếu ngưỡng) rồi toàn bộ luật khớp. Chữ do adfond
 * soạn (nhãn có dấu, tham số đã thay số); sửa luật vẫn ở tab Luật — đây chỉ là cửa nhìn. */
function LuatCampDrawer({ camp, luat, onClose }: { camp: PhuCamp; luat: PhuLuat; onClose: () => void }) {
  const px = PHU_PHAN_XET[luat.ma];
  const nho: React.CSSProperties = { fontSize: 11, color: 'var(--fg-3)' };
  return (
    <Drawer onClose={onClose} width={720}>
      <h3 style={{ margin: '0 0 2px', fontSize: 15 }}>{camp.ten}</h3>
      <div style={{ ...nho, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}><Pill color={px?.color ?? 'var(--fg-3)'} label={px?.label ?? luat.ma} /> <span>{luat.lyDo}</span></div>
      <div style={{ ...nho, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Đã chạm ({luat.cham.length})</div>
      {luat.cham.length === 0 ? <div style={{ ...nho, marginBottom: 12 }}>chưa luật nào chạm — số hiện tại chưa vượt ngưỡng nào</div> : (
        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          {luat.cham.map((k) => (
            <div key={k.ma} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ fontSize: 12 }}><b>{k.ten}</b> <span style={nho}>· {k.ma}</span> → <b>{k.ten_lam}{k.muc != null ? ` ×${k.muc}` : ''}</b> <Pill color={k.gac === 'nguoi' ? 'var(--warn)' : 'var(--fg-3)'} label={k.gac === 'nguoi' ? 'người quyết' : 'máy tự làm'} /></div>
              <div style={{ ...nho, marginTop: 2 }}>{k.doc.join(' · ')}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ ...nho, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Đang chịu ({luat.khop.length}) — ngưỡng đã thay tham số của camp này</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr><th style={head}>Luật</th><th style={head}>Phạm vi</th><th style={head}>Khi nào</th><th style={head}>Điều kiện</th><th style={head}>Làm</th><th style={head}>Gác</th><th style={head}>TS</th></tr></thead>
          <tbody>
            {luat.khop.map((l) => {
              const cham = luat.cham.some((k) => k.ma === l.ma);
              return (
                <tr key={l.ma} style={{ background: cham ? 'var(--bg-2)' : undefined }} title={`${l.ma} · ${l.vi_sao}`}>
                  <td style={cell}><b>{l.ten}</b><div style={{ ...nho, fontSize: 10 }}>{l.vi_sao}</div></td>
                  <td style={cell}>{l.pham_vi}</td>
                  <td style={cell}>{l.khi_nao}</td>
                  <td style={cell}>{l.dieu_kien}</td>
                  <td style={cell}>{l.lam}</td>
                  <td style={cell}><Pill color={l.gac === 'nguoi' ? 'var(--warn)' : 'var(--fg-3)'} label={l.gac_ten} /></td>
                  <td style={{ ...cell, ...mono }}>{l.trong_so}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ ...nho, marginTop: 10 }}>Sửa luật / tham số: tab Luật. Tiêu chí của camp này (bấm dòng camp) = tham số tầng camp đè lên kệ pop.</div>
    </Drawer>
  );
}
