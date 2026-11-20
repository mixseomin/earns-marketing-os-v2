'use client';
// PHẦN DÙNG CHUNG của nhóm widget Agents (M1–M6, mos2.on.tc/home): giờ VN, tiền, chấm trạng thái, tên người (bấm → ngăn hồ sơ),
// nút bật / tắt, ô sửa lịch / mô hình, báo lỗi ngay dưới chỗ vừa bấm. Mọi lệnh đi lenhAgent → cty chạy đúng server action của bảng nhân sự.
// tra-repo-ok: ghép primitive nhà (AnchoredPopover, Segmented, useShallowParam) cho widget Agents, không phải khối mã mới
import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AnchoredPopover, Segmented } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import { lenhAgent } from '@/lib/actions/cty-agents';
import type { LenhAgent, Lich, TT } from '@/lib/cty-agents-kieu';

/** giờ VN (GMT+7): "14:05" hôm nay, "14:05 19/11" ngày khác — tính theo giờ VN, không theo múi máy xem */
export function gioVN(iso: string | null | undefined, homNay = new Date().toISOString()): string {
  if (!iso) return '—';
  const vn = (s: string) => new Date(Date.parse(s) + 7 * 3600_000).toISOString();
  const a = vn(iso), b = vn(homNay);
  return a.slice(0, 10) === b.slice(0, 10) ? a.slice(11, 16) : `${a.slice(11, 16)} ${a.slice(8, 10)}/${a.slice(5, 7)}`;
}
export const tien = (x: number | null | undefined) => (x == null ? '?' : `$${x.toFixed(x >= 100 ? 0 : x >= 1 ? 2 : x === 0 ? 0 : 3).replace('.', ',')}`);
export const soGon = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

export const MAU_TT: Record<TT['kieu'] | 'ket', string> = { lam: '#4ade80', ranh: '#60a5fa', tat: 'var(--fg-4, #555)', chua: 'var(--fg-4, #555)', ket: '#f87171' };
export const CHU_TT: Record<TT['kieu'], string> = { lam: 'đang làm', ranh: 'rảnh', tat: 'tắt', chua: 'chưa có dòng' };
export function ChamTT({ kieu, ket, title }: { kieu: TT['kieu']; ket?: boolean; title?: string }) {
  return <i className="ag-cham" style={{ background: MAU_TT[ket ? 'ket' : kieu] }} title={title ?? (ket ? 'kẹt' : CHU_TT[kieu])} aria-label={ket ? 'kẹt' : CHU_TT[kieu]} />;
}
/** trạng thái một dòng: "đang làm · <việc> · 12′" / "rảnh · xong 14:05" / "tắt"; kẹt thì thêm lý do đỏ */
export function ChuTT({ t }: { t: TT }) {
  return <span className="ag-tt">
    {t.kieu === 'lam' ? <><b className="ag-lam">làm</b> <span title={t.viec}>{t.viec}</span>{t.phut != null && <small> · {t.phut}′</small>}</>
      : t.kieu === 'ranh' ? <>rảnh{t.xong && <small> · xong {gioVN(t.xong)}</small>}</>
      : <span className="ag-mo">{CHU_TT[t.kieu]}</span>}
    {t.ket.length > 0 && <span className="ag-ket" title={t.ket.join(' · ')}> · kẹt: {t.ket[0]}</span>}
  </span>;
}

/** tên người — bấm mở ngăn hồ sơ agent ngay trên trang (tham số ?ag=, F5 / gửi link giữ nguyên) */
export function TenAgent({ id, ten, phu }: { id: string; ten: string; phu?: ReactNode }) {
  const [, datAg] = useShallowParam('ag', '');
  return <button type="button" className="ag-ten" onClick={() => datAg(id)} title={`Mở hồ sơ ${ten}`}>{ten}{phu}</button>;
}

/** khối tự đọc dữ liệu phía trình duyệt (ngăn hồ sơ) khai hàm đọc lại ở đây — lệnh xong thì gọi, ngoài router.refresh() cho phần máy chủ vẽ */
export const SauLenh = createContext<(() => void) | null>(null);
/** một lệnh ghi: gửi → báo lỗi đủ câu ngay dưới chỗ bấm → làm mới số trên trang */
export function useLenh() {
  const router = useRouter(); const [dang, chuyen] = useTransition(); const [loi, setLoi] = useState(''); const sau = useContext(SauLenh);
  const chay = (l: LenhAgent, xong?: () => void) => chuyen(async () => {
    setLoi(''); const r = await lenhAgent(l);
    if (!r.ok) { setLoi(r.loi ?? 'cty từ chối lệnh mà không nói lý do'); return; }
    xong?.(); sau?.(); router.refresh();
  });
  return { dang, loi, chay, boLoi: () => setLoi('') };
}
export const BaoLoi = ({ loi, onBo }: { loi: string; onBo?: () => void }) =>
  loi ? <div className="ag-loi" role="alert">{loi}{onBo && <button type="button" onClick={onBo} aria-label="Đóng báo lỗi">✕</button>}</div> : null;

/** nút bật / tắt (một chấm + chữ) — khoa = không cho tắt, kèm lý do */
export function NutBat({ bat, lenh, admin, khoa, nhan, hoi }: { bat: boolean; lenh: LenhAgent; admin: boolean; khoa?: string | null; nhan?: string; hoi?: string }) {
  const { dang, loi, chay, boLoi } = useLenh(); const [xac, setXac] = useState(false);
  const bam = () => { if (bat && hoi && !xac) { setXac(true); return; } setXac(false); chay(lenh); };
  const tat = !admin || dang || (bat && !!khoa);
  return <span className="ag-bat">
    <button type="button" className={`ag-nut-bat${bat ? ' on' : ''}`} disabled={tat} onClick={bam}
      title={!admin ? 'Chỉ admin bật / tắt được' : bat && khoa ? `Không tắt được: ${khoa}` : bat ? 'Đang bật — bấm để tắt' : 'Đang tắt — bấm để bật'}>
      <i />{dang ? '…' : nhan ?? (bat ? 'bật' : 'tắt')}
    </button>
    {xac && <span className="ag-xac">{hoi} <button type="button" onClick={bam}>Tắt</button> <button type="button" onClick={() => setXac(false)}>Thôi</button></span>}
    <BaoLoi loi={loi} onBo={boLoi} />
  </span>;
}

/** ô sửa lịch: chữ lịch → bấm (admin) mở ô nhỏ: "mỗi N phút" hoặc "giờ cố định" */
export function SuaLich({ muc, lich, chu, admin, apSau, cho, loiAp, chiMoi, khongThu = true }: {
  muc: string; lich: Lich | null; chu: string; admin: boolean; apSau?: string; cho?: boolean; loiAp?: string | null; chiMoi?: boolean; khongThu?: boolean;
}) {
  const nut = useRef<HTMLButtonElement | null>(null); const [mo, setMo] = useState(false);
  const [kieu, setKieu] = useState<'moi' | 'luc'>(lich?.kieu ?? 'moi');
  const [phut, setPhut] = useState(String(lich?.kieu === 'moi' ? lich.phut : 15)); const [gio, setGio] = useState(lich?.kieu === 'luc' ? lich.gio.join(', ') : '08:00');
  const { dang, loi, chay, boLoi } = useLenh();
  const luu = () => {
    const l: Lich = kieu === 'moi' ? { kieu: 'moi', phut: Number(phut) } : { kieu: 'luc', gio: gio.split(/[,\s]+/).filter(Boolean), thu: [] };
    chay({ lenh: 'lich', muc, lich: l }, () => setMo(false));
  };
  if (!admin || !lich) return <span className="ag-lich" title={cho ? 'đã đổi, chờ máy áp' : undefined}>{chu || '—'}{cho && <small> · chờ áp</small>}</span>;
  return <>
    <button ref={nut} type="button" className={`ag-lich ag-lich-nut${loiAp ? ' xau' : ''}`} onClick={() => setMo((m) => !m)} title={loiAp ? `Áp lịch lỗi: ${loiAp}` : `Đổi lịch${apSau ? ` · ${apSau}` : ''}`}>
      {chu || '—'}{cho && <small> · chờ áp</small>}{loiAp && <small> · áp lỗi</small>}
    </button>
    <AnchoredPopover anchorRef={nut} open={mo} onClose={() => { setMo(false); boLoi(); }}>
      <div className="hm-loc-pop ag-sua">
        {!chiMoi && <Segmented size="xs" value={kieu} onChange={(v) => setKieu(v)} options={[{ value: 'moi', label: 'Mỗi N phút' }, { value: 'luc', label: 'Giờ cố định' }]} />}
        {kieu === 'moi'
          ? <label>Mỗi <input type="number" min={1} max={1440} value={phut} onChange={(e) => setPhut(e.target.value)} /> phút</label>
          : <label>Giờ (VN) <input value={gio} onChange={(e) => setGio(e.target.value)} placeholder="08:00, 20:00" /></label>}
        {khongThu && kieu === 'luc' && <small className="ag-mo">mỗi ngày</small>}
        <div className="ag-sua-nut"><button type="button" className="hm-chip on" disabled={dang} onClick={luu}>{dang ? 'Đang lưu…' : 'Lưu'}</button>
          <button type="button" className="hm-chip" onClick={() => setMo(false)}>Huỷ</button></div>
        {apSau && <small className="ag-mo">{apSau}</small>}
        <BaoLoi loi={loi} onBo={boLoi} />
      </div>
    </AnchoredPopover>
  </>;
}

/** ô đổi mô hình của một người (đè dòng model của SOUL; bỏ trống = về SOUL) */
export function SuaModel({ id, model, soul, admin }: { id: string; model: string; soul: string; admin: boolean }) {
  const nut = useRef<HTMLButtonElement | null>(null); const [mo, setMo] = useState(false); const [v, setV] = useState(model);
  const { dang, loi, chay, boLoi } = useLenh();
  const ten = model.replace(/^[a-z]+:/, '').replace(/\bqua:\w+/g, '').trim() || 'không';
  if (!admin) return <span className="ag-model" title={model}>{ten}</span>;
  return <>
    <button ref={nut} type="button" className="ag-model ag-lich-nut" title={`${model}${soul && soul !== model ? `\nSOUL: ${soul}` : ''}\nBấm để đổi`} onClick={() => setMo((m) => !m)}>{ten}</button>
    <AnchoredPopover anchorRef={nut} open={mo} onClose={() => { setMo(false); boLoi(); }}>
      <div className="hm-loc-pop ag-sua">
        <label>Mô hình <input value={v} onChange={(e) => setV(e.target.value)} placeholder={soul} /></label>
        <small className="ag-mo">bỏ trống = về dòng trong SOUL ({soul || 'không'})</small>
        <div className="ag-sua-nut"><button type="button" className="hm-chip on" disabled={dang} onClick={() => chay({ lenh: 'model', id, model: v.trim() }, () => setMo(false))}>{dang ? 'Đang lưu…' : 'Lưu'}</button>
          <button type="button" className="hm-chip" onClick={() => setMo(false)}>Huỷ</button></div>
        <BaoLoi loi={loi} onBo={boLoi} />
      </div>
    </AnchoredPopover>
  </>;
}

/** ô widget báo lỗi đọc cty (máy chủ vẽ) */
export const LoiCty = ({ loi }: { loi: string }) => <div className="ag-loi" role="alert">Không đọc được số liệu cty: {loi}</div>;
