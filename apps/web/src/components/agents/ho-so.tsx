'use client';
// NGĂN HỒ SƠ MỘT AGENT trên /home (?ag=<mã>): mọi widget Agents gắn <NganAgent/>, useChuNgan chọn đúng MỘT bản vẽ ngăn.
// Dữ liệu cty /api/agents?phan=ho-so (đọc khi mở): trạng thái · tự làm · mô hình · ca · việc tự làm + việc máy · 40 lần chạy · 30 phiên.
// Đây là chỗ chứa CHI TIẾT mà ô widget nhỏ không hiện (anh 20/11/2026 "màn hình đã bé lại mà show hết ra thì xem được à").
import { useEffect, useState, useTransition } from 'react';
import { DataTable, Drawer, Segmented, StatsStrip, type DataColumn } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import { useChuNgan } from '@/lib/home/chu-ngan';
import { hoSoAgent } from '@/lib/actions/cty-agents';
import type { HoSo, LanChay, PhienDoi, ViecMay } from '@/lib/cty-agents-kieu';
import { BaoLoi, ChamTT, ChuTT, NutBat, SauLenh, SuaLich, SuaModel, gioVN, soGon, tien, useLenh } from './chung';

const KET: Record<string, string> = { DA_SUA: 'đã sửa', KHONG_SUA: 'không sửa', CAN_ANH: 'cần anh' };

export function NganAgent() {
  const chu = useChuNgan('agent'); const [ag, datAg] = useShallowParam('ag', '');
  const [hs, setHs] = useState<HoSo | null>(null); const [admin, setAdmin] = useState(false); const [loi, setLoi] = useState(''); const [dang, chuyen] = useTransition();
  const [tab, setTab] = useState<'viec' | 'lan' | 'phien'>('viec'); const [lan, setLan] = useState(0);
  useEffect(() => {
    if (!chu || !ag) { setHs(null); return; }
    chuyen(async () => { const r = await hoSoAgent(ag); if (r.ok) { setHs(r.du); setAdmin(r.admin); setLoi(''); } else { setHs(null); setLoi(r.loi); } });
  }, [chu, ag, lan]);
  if (!chu || !ag) return null;
  const a = hs?.agent;
  return (
    // ngan-moi-ok: hồ sơ agent cty — đã tra, MOS2 chưa có ngăn nào cho nhân sự cty (dữ liệu cổng /api/agents, không nhúng trang cty)
    <Drawer onClose={() => datAg('')} width={760}>
      {!a ? <div className="ag-mo">{dang ? 'Đang đọc hồ sơ…' : null}<BaoLoi loi={loi} /></div> : <SauLenh.Provider value={() => setLan((n) => n + 1)}><div className="ag-hs">
        <header className="ag-hs-dau">
          <ChamTT kieu={a.tt.kieu} ket={a.tt.ket.length > 0} />
          <div><h2>{a.ten}</h2><small className="ag-mo">{a.chucDanh} · {a.phongTen}{a.baoCaoCho ? ` · báo cáo cho ${a.baoCaoCho}` : ''}</small></div>
          <span className="hm-thanh-gian" />
          {dang && <small className="ag-mo">đang làm mới…</small>}
        </header>
        <div className="ag-hs-tt"><ChuTT t={a.tt} />{a.tt.vua?.ket && <small className="ag-mo" title={a.tt.vua.ket}> · vừa: {a.tt.vua.ket.slice(0, 120)}</small>}</div>
        <StatsStrip minColWidth={120} cards={[
          { key: 'model', label: 'Mô hình', value: <SuaModel id={a.id} model={a.model} soul={a.modelSoul} admin={admin} /> },
          { key: 'tu', label: 'Tự làm', value: a.nhip.coNut ? <NutBat bat={a.nhip.bat} admin={admin} lenh={a.nhip.muc.startsWith('nguoi:') ? { lenh: 'may', muc: a.nhip.muc, bat: !a.nhip.bat } : { lenh: 'nhip', id: a.id, bat: !a.nhip.bat }} /> : '—', sub: a.nhip.tanSuat },
          { key: 'chi', label: 'Chi tháng', value: tien(a.chi), sub: a.tran ? `trần ${tien(a.tran)}` : undefined },
          { key: 'vm', label: 'Việc máy', value: `${a.nhip.soChay}/${a.nhip.soViecMay}`, sub: 'đang chạy' },
        ]} />
        {a.nhip.box && <SuaCa id={a.id} ca={a.nhip.ca ?? ''} diemDanh={a.nhip.diemDanh ?? ''} admin={admin} kiem={a.nhip.kiemMoi ?? 1} />}
        <Segmented size="sm" value={tab} onChange={setTab} options={[
          { value: 'viec', label: `Việc (${hs!.viecTuLam.length + hs!.viecMay.length})` }, { value: 'lan', label: `Lần chạy (${hs!.lan.length})` }, { value: 'phien', label: `Phiên CLI (${hs!.phien.length})` }]} />
        {tab === 'viec' && <ViecCua hs={hs!} admin={admin} />}
        {tab === 'lan' && <LanCua ds={hs!.lan} />}
        {tab === 'phien' && (hs!.logsLoi ? <BaoLoi loi={hs!.logsLoi} /> : <PhienCua ds={hs!.phien} />)}
      </div></SauLenh.Provider>}
    </Drawer>
  );
}

function SuaCa({ id, ca, diemDanh, admin, kiem }: { id: string; ca: string; diemDanh: string; admin: boolean; kiem: number }) {
  const [c, setC] = useState(ca), [d, setD] = useState(diemDanh); const { dang, loi, chay, boLoi } = useLenh();
  return <div className="ag-hs-ca">
    <span className="ag-mo">Máy kiểm</span> <SuaLich muc={`nhip:${id}`} lich={{ kieu: 'moi', phut: kiem }} chu={`mỗi ${kiem} phút`} admin={admin} chiMoi apSau="áp từ nhịp kế tiếp" />
    <label>Ca <input value={c} disabled={!admin} onChange={(e) => setC(e.target.value)} placeholder="08:00-22:00" /></label>
    <label>Điểm danh <input value={d} disabled={!admin} onChange={(e) => setD(e.target.value)} placeholder="08:30" /></label>
    {admin && (c !== ca || d !== diemDanh) && <button type="button" className="hm-chip on" disabled={dang} onClick={() => chay({ lenh: 'ca', id, ca: c, diem_danh: d })}>{dang ? 'Đang lưu…' : 'Lưu ca'}</button>}
    <BaoLoi loi={loi} onBo={boLoi} />
  </div>;
}

function ViecCua({ hs, admin }: { hs: HoSo; admin: boolean }) {
  const cot: DataColumn<ViecMay>[] = [
    { key: 'viec', header: 'Việc máy', align: 'left', cell: (v) => <span className="ag-viec"><NutBat bat={v.bat} admin={admin} khoa={v.khoa} nhan="" lenh={{ lenh: 'may', muc: `viec:${v.id}`, bat: !v.bat }} /><span title={v.ma}>{v.ten}</span></span>, sortValue: (v) => v.ten },
    { key: 'may', header: 'Máy', align: 'left', width: 70, cell: (v) => <span className="ag-mo">{v.may}</span> },
    { key: 'lich', header: 'Lịch', align: 'left', width: 130, cell: (v) => (v.lichLien ? <span className="ag-mo">chạy liền</span> : <SuaLich muc={`may:${v.id}`} lich={v.lichMo} chu={v.lich} admin={admin} apSau={v.apSau} cho={v.choAp} loiAp={v.loiAp} khongThu={false} />) },
    { key: 'cuoi', header: 'Lần cuối', align: 'left', width: 90, cell: (v) => <span className="ag-mo">{gioVN(v.cuoi)}</span>, sortValue: (v) => v.cuoi ?? '' },
    { key: 'ket', header: 'Kết quả', align: 'left', width: 110, cell: (v) => (v.hong ? <span className="ag-ket">{v.ket}</span> : !v.bat ? <span className="ag-mo">tắt</span> : v.ket === 'success' ? 'xong' : v.ket || '—') },
  ];
  return <div className="ag-hs-phan">
    {hs.viecTuLam.length > 0 && <ul className="ag-ds">{hs.viecTuLam.map((v) => <li key={v.ma}><b>{v.ten}</b> <span className="ag-mo">· {v.lich}</span></li>)}</ul>}
    {hs.viecMay.length ? <DataTable rows={hs.viecMay} columns={cot} getRowKey={(v) => v.id} persistKey="ag-hs-viec" minWidth={0} locTuDong={false} timNgoai giuCot fixedLayout />
      : !hs.viecTuLam.length && <div className="ag-mo ag-trong">Người này chưa có việc tự làm nào (heartbeat: {hs.heartbeat}).</div>}
  </div>;
}

function LanCua({ ds }: { ds: LanChay[] }) {
  const cot: DataColumn<LanChay>[] = [
    { key: 'tu', header: 'Bắt đầu', align: 'left', width: 90, cell: (x) => <span className="ag-mo">{gioVN(x.tu ?? x.xong)}</span> },
    { key: 'viec', header: 'Việc', align: 'left', cell: (x) => <span className="ag-mot-dong" title={x.viec}>{x.viec}</span> },
    { key: 'ket', header: 'Kết', align: 'left', width: 90, cell: (x) => (x.dang ? <b className="ag-lam">đang chạy</b> : x.giao ? <span className="ag-mo">được giao</span> : x.mat ? <span className="ag-ket">mất dấu</span> : x.ma ? <span className="ag-ket">lỗi {x.ma}</span> : 'xong') },
    { key: 'dai', header: 'Dài', align: 'left', width: 70, cell: (x) => <span className="ag-mo">{x.dai || '—'}</span> },
    { key: 'tom', header: 'Tóm tắt', align: 'left', cell: (x) => <span className="ag-mot-dong ag-mo" title={x.tom}>{x.tom}</span> },
  ];
  return ds.length ? <DataTable rows={ds} columns={cot} getRowKey={(x, i) => `${x.tu ?? ''}${x.xong ?? ''}${i}`} persistKey="ag-hs-lan" minWidth={0} locTuDong={false} timNgoai giuCot fixedLayout pageSize={40} />
    : <div className="ag-mo ag-trong">Chưa có lần chạy nào trong nhật ký nhịp.</div>;
}

function PhienCua({ ds }: { ds: PhienDoi[] }) {
  const cot: DataColumn<PhienDoi>[] = [
    { key: 'luc', header: 'Lúc', align: 'left', width: 90, cell: (p) => <span className="ag-mo">{gioVN(p.batDau)}</span>, sortValue: (p) => p.batDau ?? '' },
    { key: 'viec', header: 'Việc', align: 'left', cell: (p) => <span className="ag-mot-dong" title={p.viec}>{p.viec}</span> },
    { key: 'ket', header: 'Kết', align: 'left', width: 80, cell: (p) => <span className="ag-mo">{p.ket ? KET[p.ket] ?? p.ket : '—'}</span> },
    { key: 'tok', header: 'Token vào / ra', width: 110, cell: (p) => <span className="ag-mo">{soGon(p.vao)} / {soGon(p.ra)}</span> },
    { key: 'usd', header: 'Chi', width: 64, cell: (p) => tien(p.usd), sortValue: (p) => p.usd ?? -1, total: (rs) => <b>{tien(rs.reduce((t, p) => t + (p.usd ?? 0), 0))}</b> },
  ];
  return ds.length ? <DataTable rows={ds} columns={cot} getRowKey={(p) => p.id} persistKey="ag-hs-phien" minWidth={0} locTuDong={false} timNgoai giuCot fixedLayout />
    : <div className="ag-mo ag-trong">Người này chưa có phiên Claude Code nào.</div>;
}
