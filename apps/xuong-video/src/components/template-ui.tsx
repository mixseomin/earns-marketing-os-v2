'use client';
// TEMPLATE trên studio (template.ts · template-db.ts): template là một phim — sửa kinh thánh / anchor / shot như thường, chỗ cần đổi gõ {{ô}}.
// Tổ chức cho dễ dùng (anh 14/10/2026): KHO TEMPLATE ở đầu trang (thẻ: dùng khi nào · số shot · Dùng / Sửa) → bấm Dùng là ra form điền
// chia nhóm (Sản phẩm mở sẵn) → Tạo phim 0đ. Sửa template = mở như phim; panel đầu tab 🎭 Phim giữ nhãn / gợi ý / giá trị mẫu của ô.
import { useCallback, useEffect, useState } from 'react';
import { Ngan } from './ngan';
import { O, Nut, Loi, Pill, mono } from './ui';
import { docTemplate, luuCauHinhTemplate, taoPhimTuTemplate } from '@/lib/actions';
import { giaTriMau, oThieu, theoNhom, nhomCuaO, NHOM_O, type OTemplateDs } from '@/lib/xuong-video/template';
import { tenPhanDoan, type CauHinhTemplate, type Phim } from '@/lib/xuong-video/kieu';
import type { ShotKhung } from '@/lib/xuong-video/template-db';

type DuLieu = { cfg: CauHinhTemplate | null; o: OTemplateDs[]; khung: ShotKhung[]; phimDung: { id: number; ten: string; luu_tru: boolean }[] };
const tenGon = (ten: string) => ten.replace(/^template\s*·\s*/i, '');

function useTemplate(phimId: number) {
  const [d, setD] = useState<DuLieu | null>(null);
  const [loi, setLoi] = useState('');
  const nap = useCallback(async () => { const r = await docTemplate(phimId); if (r.ok) setD(r.data); else setLoi(r.loi); }, [phimId]);
  useEffect(() => { void nap(); }, [nap]);
  return { d, loi, nap };
}

/** Màu theo nhịp: mở (hook/ưu đãi) · vấn đề · giải quyết · chứng minh · chốt — cùng một nhìn cho thẻ, form, panel. */
const MAU_LOAI: Record<string, string> = { hook: '#f472b6', uu_dai: '#f472b6', noi_dau: '#f87171', giai_phap: '#4ade80', demo: '#4ade80', tinh_nang: '#4ade80', so_sanh: '#4ade80', bang_chung: '#60a5fa', tran_an: '#60a5fa', cta: '#fbbf24', end_card: '#fbbf24' };
/** DẢI CẤU TRÚC của video: các khối liền nhau cùng loại shot gộp một chip (Hook 2.5s → Nỗi đau ×2 5s → … → CTA), rê chuột thấy chữ màn từng shot.
 *  chiTiet = mỗi khối kèm chữ màn ngay dưới (form điền) — anh 14/10/2026: "sao không thấy các phần cụ thể Hook, CTA, Pain". */
export function DaiKhung({ khung, chiTiet }: { khung: ShotKhung[]; chiTiet?: boolean }) {
  const khoi: { loai: string; ds: ShotKhung[] }[] = [];
  for (const k of khung) { const l = khoi[khoi.length - 1]; if (l && l.loai === k.loai) l.ds.push(k); else khoi.push({ loai: k.loai, ds: [k] }); }
  if (!khoi.length) return null;
  const tong = khung.reduce((a, k) => a + k.giay, 0);
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }} title={`${khung.length} shot · ${Math.round(tong)}s`}>
        {khoi.map((k, i) => <span key={i} style={{ flex: k.ds.reduce((a, x) => a + x.giay, 0) || 1, background: MAU_LOAI[k.loai] ?? '#64748b', borderRight: '1px solid var(--bg-1)' }} />)}
      </div>
      <div style={{ display: chiTiet ? 'grid' : 'flex', gap: chiTiet ? 4 : 3, flexWrap: 'wrap', fontSize: 11 }}>
        {khoi.map((k, i) => {
          const giay = Math.round(k.ds.reduce((a, x) => a + x.giay, 0) * 10) / 10; const mau = MAU_LOAI[k.loai] ?? '#64748b';
          return chiTiet ? (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6, alignItems: 'baseline' }}>
              <b style={{ color: mau }}>{tenPhanDoan(k.loai)}{k.ds.length > 1 ? ` ×${k.ds.length}` : ''} <span style={mono}>{giay}s</span></b>
              <span style={{ color: 'var(--fg-2)' }}>{k.ds.map((x) => x.chu.replace(/\n/g, ' / ')).filter(Boolean).join('  ·  ') || '—'}</span>
            </div>
          ) : (
            <span key={i} title={k.ds.map((x) => x.chu.replace(/\n/g, ' / ')).filter(Boolean).join('\n')} style={{ color: mau, whiteSpace: 'nowrap' }}>{i > 0 && <span style={{ color: 'var(--fg-4)' }}>→ </span>}{tenPhanDoan(k.loai)}{k.ds.length > 1 ? ` ×${k.ds.length}` : ''}</span>
          );
        })}
      </div>
    </div>
  );
}

/** Dải cấu trúc của một thẻ trong kho (tự nạp). */
function KhungThe({ id }: { id: number }) {
  const { d } = useTemplate(id);
  if (!d) return <span style={mono}>…</span>;
  return <><DaiKhung khung={d.khung} /><span style={mono}>🏆 {d.cfg?.mau_qc?.length ?? 0} mẫu QC thắng · 🎬 {d.phimDung.filter((p) => !p.luu_tru).length} phim đang dùng</span></>;
}

/** 🏆 MẪU QC THẮNG template học theo (video thật lưu R2, phát ngay) + 🎬 PHIM đang dùng template — anh 15/10/2026. */
function MauVaPhimDung({ d, onMoPhim }: { d: DuLieu; onMoPhim: (id: number) => void }) {
  const mau = d.cfg?.mau_qc ?? [];
  return (
    <div style={{ display: 'grid', gap: 8, margin: '4px 0 10px' }}>
      <b style={{ fontSize: 12 }}>🏆 Mẫu QC thắng <span style={mono}>— QC thật template này học theo (kho spy · nhân bản x · ngày chạy)</span></b>
      {!mau.length ? <div style={{ ...mono, color: 'var(--red)' }}>Chưa có mẫu — template phải có ít nhất một QC thắng kèm video (scripts/luu-mau-qc.mts).</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
          {mau.map((m) => (
            <div key={m.ma} style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
              {m.video ? <video src={m.video} poster={m.anh ?? undefined} controls preload="none" playsInline style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 6, background: '#000' }} />
                : m.anh ? <img src={m.anh} alt="" style={{ width: '100%', borderRadius: 6 }} /> : null}
              <span style={{ fontSize: 12 }}><b>{m.page}</b> <span style={mono}>x{m.x} · {m.ngay} ngày{m.giay ? ` · ${m.giay}s` : ''}</span></span>
              <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{m.mo_ta}</span>
              <a className="xv-lienket xv-mono" href={`https://href.li/?${m.link}`} target="_blank" rel="noreferrer">Thư viện QC #{m.ma}</a>
            </div>
          ))}
        </div>
      )}
      <b style={{ fontSize: 12 }}>🎬 Phim đang dùng template này <span style={mono}>({d.phimDung.length})</span></b>
      {!d.phimDung.length ? <span style={mono}>chưa có phim nào — bấm "Tạo phim từ template"</span> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {d.phimDung.map((p) => <button key={p.id} type="button" className="xv-lienket xv-mono" style={{ opacity: p.luu_tru ? 0.5 : 1, textDecoration: p.luu_tru ? 'line-through' : undefined }} onClick={() => onMoPhim(p.id)} title={p.luu_tru ? 'đã lưu trữ' : 'mở phim'}>#{p.id} {p.ten}</button>)}
        </div>
      )}
    </div>
  );
}

/** Kho template ở đầu trang: mỗi template một thẻ — dùng khi nào, số shot, nút Dùng (form điền) / Sửa (mở như phim). */
export function KhoTemplate({ ds: dsVao, onMo }: { ds: Phim[]; onMo: (id: number) => void }) {
  const [dung, setDung] = useState<Phim | null>(null);
  const ds = [...dsVao].sort((a, b) => a.id - b.id);   // thứ tự dựng (khung chính trước), không theo lần sửa gần nhất
  return (
    <div className="xv-panel">
      <h3>🧩 Template<small>chọn một khung → điền sản phẩm / nhân vật / câu chuyện → ra phim mới (0đ, chưa sinh gì)</small></h3>
      {ds.length === 0 ? <div style={mono}>Chưa có template. Mở một phim đạt › ⋯ › 🧩 Lưu thành template, rồi gõ {'{{ô}}'} vào chỗ cần đổi.</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
          {ds.map((p) => (
            <div key={p.id} className="xv-canh" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <b style={{ fontSize: 13 }}>{tenGon(p.ten)}</b>
              <div style={{ fontSize: 12, color: 'var(--fg-2)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={p.kinh_thanh?.template?.mo_ta ?? ''}>{p.kinh_thanh?.template?.mo_ta || p.mo_ta || '—'}</div>
              <KhungThe id={p.id} />
              <div style={mono}>{p.so_canh} shot · {Object.keys(p.kinh_thanh?.template?.o ?? {}).length} ô · #{p.id}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <Nut chinh onClick={() => setDung(p)}>Dùng</Nut>
                <Nut onClick={() => onMo(p.id)} title="Sửa template như sửa phim: shot, prompt, anchor, nhãn ô">Sửa</Nut>
              </div>
            </div>
          ))}
        </div>
      )}
      {dung && <TaoTuTemplate templateId={dung.id} tenTemplate={dung.ten} onClose={() => setDung(null)} onTao={(id) => { setDung(null); onMo(id); }} />}
    </div>
  );
}

/** Panel đầu tab 🎭 Phim của template: nhãn / gợi ý / giá trị mẫu của từng ô (theo nhóm) + nút tạo phim. */
export function TemplatePanel({ phim, onChanged, onMoPhim }: { phim: Phim; onChanged: () => Promise<void>; onMoPhim: (id: number) => void }) {
  const { d, loi, nap } = useTemplate(phim.id);
  const [o, setO] = useState<OTemplateDs[]>([]);
  const [moTa, setMoTa] = useState('');
  const [ban, setBan] = useState(false);
  const [loiLuu, setLoiLuu] = useState('');
  const [tao, setTao] = useState(false);
  useEffect(() => { if (d) { setO(d.o); setMoTa(d.cfg?.mo_ta ?? ''); } }, [d]);
  const sua = (k: string, x: Partial<OTemplateDs>) => setO((ds) => ds.map((v) => (v.k === k ? { ...v, ...x } : v)));
  const luu = async () => {
    setBan(true); setLoiLuu('');
    const cfg: CauHinhTemplate = { mo_ta: moTa, o: Object.fromEntries(o.map(({ k, dung: _d, ...v }) => [k, v])), thu_tu: o.map((v) => v.k) };
    const r = await luuCauHinhTemplate(phim.id, cfg);
    setBan(false);
    if (!r.ok) { setLoiLuu(r.loi); return; }
    await nap(); await onChanged();
  };
  const COT = '130px 1fr 1.3fr 1.6fr 120px';
  return (
    <div className="xv-panel">
      <h3>🧩 Template<small>sửa phim này như phim thường — chỗ nào đổi theo sản phẩm / góc / chân dung thì gõ <code>{'{{ten_o}}'}</code> (kinh thánh, anchor, brief, chữ màn, lời, prompt…)</small></h3>
      <Loi>{loi}</Loi>
      {d && <div style={{ margin: '4px 0 10px' }}><b style={{ fontSize: 12 }}>Cấu trúc video</b> <span style={mono}>— sửa shot ở tab Kịch bản / Storyboard</span><DaiKhung khung={d.khung} chiTiet /></div>}
      {d && <MauVaPhimDung d={d} onMoPhim={onMoPhim} />}
      <O label="Dùng khi nào (hiện trên thẻ ở kho template)"><textarea className="xv-in" rows={2} value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="UGC kể chuyện tình huống — hợp sản phẩm giải quyết một nỗi khó chịu hằng ngày…" /></O>
      {!d ? <span style={mono}>…</span> : o.length === 0 ? <div style={mono}>Chưa có ô nào — gõ {'{{san_pham}}'}, {'{{nhan_vat_ten}}'}… vào chữ của phim rồi mở lại tab này.</div> : (
        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
          <div style={{ ...mono, display: 'grid', gridTemplateColumns: COT, gap: 6 }}><span>Ô</span><span>Nhãn</span><span>Gợi ý cho người điền</span><span>Giá trị mẫu</span><span>Nhóm · dài</span></div>
          {theoNhom(o).map((g) => (
            <div key={g.key} style={{ display: 'grid', gap: 4 }}>
              <b style={{ fontSize: 12, marginTop: 6 }}>{g.ten}</b>
              {g.o.map((v) => (
                <div key={v.k} style={{ display: 'grid', gridTemplateColumns: COT, gap: 6, alignItems: 'start', opacity: v.dung ? 1 : 0.5 }}>
                  <span style={{ ...mono, paddingTop: 6, overflowWrap: 'anywhere' }} title={v.dung ? 'đang dùng trong chữ của template' : 'đã khai nhưng không còn chỗ nào dùng — không bắt điền'}>{`{{${v.k}}}`}{!v.dung && ' ·thừa'}</span>
                  <input className="xv-in" value={v.ten} onChange={(e) => sua(v.k, { ten: e.target.value })} />
                  <input className="xv-in" value={v.goi_y ?? ''} onChange={(e) => sua(v.k, { goi_y: e.target.value })} />
                  <textarea className="xv-in" rows={v.dai ? 3 : 1} value={v.mau ?? ''} onChange={(e) => sua(v.k, { mau: e.target.value })} />
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select className="xv-in" style={{ width: 84 }} value={nhomCuaO(v.k, v)} onChange={(e) => sua(v.k, { nhom: e.target.value })}>{NHOM_O.map((n) => <option key={n.key} value={n.key}>{n.ten.split(' ')[0]} {n.key.replace('_', ' ')}</option>)}</select>
                    <input type="checkbox" title="ô chữ dài (nhiều dòng)" checked={!!v.dai} onChange={(e) => sua(v.k, { dai: e.target.checked })} />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <Loi>{loiLuu}</Loi>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <Nut ban={ban} onClick={() => void luu()}>Lưu ô</Nut>
        <Nut chinh ly={!d?.o.length && 'template chưa có ô nào'} onClick={() => setTao(true)}>🧩 Tạo phim từ template</Nut>
      </div>
      {tao && <TaoTuTemplate templateId={phim.id} tenTemplate={phim.ten} onClose={() => setTao(false)} onTao={(id) => { setTao(false); onMoPhim(id); }} />}
    </div>
  );
}

/** Ngăn điền ô → phim mới: chia nhóm, nhóm đầu mở sẵn, nhóm còn ô trống tự mở; giá trị đầu = giá trị mẫu. */
function TaoTuTemplate({ templateId, tenTemplate, onClose, onTao }: { templateId: number; tenTemplate: string; onClose: () => void; onTao: (id: number) => void }) {
  const { d, loi: loiDoc } = useTemplate(templateId);
  const dung = (d?.o ?? []).filter((v) => v.dung);
  const [gt, setGt] = useState<Record<string, string> | null>(null);
  useEffect(() => { if (d && !gt) setGt(giaTriMau(d.o.filter((v) => v.dung))); }, [d, gt]);
  // tên phim mới tự theo sản phẩm (tới khi người sửa tay) — mặc định trùng tên template là lẫn ngay trong danh sách
  const [tenTay, setTen] = useState<string | null>(null);
  const ten = tenTay ?? `${(gt?.san_pham ?? '').trim() || 'Phim mới'} · ${tenGon(tenTemplate).replace(/\s*\(.*\)\s*$/, '')}`;
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  const g = gt ?? {};
  const thieu = oThieu(dung, g);
  const lam = async () => {
    setBan(true); setLoi('');
    const r = await taoPhimTuTemplate(templateId, ten, g);
    setBan(false);
    if (!r.ok) { setLoi(r.loi); return; }
    onTao(r.data.phimId);
  };
  return (
    <Ngan nho onClose={onClose} tieuDe={`🧩 ${tenGon(tenTemplate)}`} nut={<Nut chinh ban={ban} ly={(!ten.trim() && 'nhập tên phim') || (thieu.length > 0 && `chưa điền: ${thieu.map((x) => x.ten).join(', ')}`)} onClick={() => void lam()}>Tạo phim (0đ)</Nut>}>
      <div style={{ ...mono, marginBottom: 8 }}>Điền từ trên xuống — giá trị mẫu đã có sẵn, sửa chỗ cần đổi. Chép cả template rồi điền ô; shot không chứa ô nào giữ nguyên hình/clip, shot có ô về nháp để sinh lại.</div>
      <Loi>{loiDoc}</Loi>
      {d && <details open style={{ marginBottom: 8 }}><summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>🎬 Cấu trúc video <span style={mono}>· {d.khung.length} shot · {Math.round(d.khung.reduce((a, k) => a + k.giay, 0))}s — chữ màn mẫu, ô {'{{…}}'} sẽ thay bằng giá trị anh điền</span></summary><div style={{ marginTop: 6 }}><DaiKhung khung={d.khung} chiTiet /></div></details>}
      <O label="Tên phim mới"><input className="xv-in" value={ten} onChange={(e) => setTen(e.target.value)} /></O>
      {!d || !gt ? <span style={mono}>…</span> : theoNhom(dung).map((nh, i) => {
        const trong = nh.o.filter((v) => !(g[v.k] ?? '').trim()).length;
        return (
          <details key={nh.key} open={i === 0 || trong > 0} style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>{nh.ten} <span style={mono}>· {nh.o.length} ô</span>{trong > 0 && <> <Pill color="var(--amber)">{trong} trống</Pill></>}</summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
              {nh.o.map((v) => (
                <O key={v.k} label={v.ten} hint={v.goi_y}>
                  {v.dai || (g[v.k] ?? '').includes('\n')
                    ? <textarea className="xv-in" rows={3} value={g[v.k] ?? ''} onChange={(e) => setGt({ ...g, [v.k]: e.target.value })} />
                    : <input className="xv-in" value={g[v.k] ?? ''} onChange={(e) => setGt({ ...g, [v.k]: e.target.value })} />}
                </O>
              ))}
            </div>
          </details>
        );
      })}
      <Loi>{loi}</Loi>
    </Ngan>
  );
}
