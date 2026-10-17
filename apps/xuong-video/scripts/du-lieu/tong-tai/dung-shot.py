# Sinh 22 SHOT tập 1 "Nữ Thừa Kế Bí Mật" → shot.json (nap.mts nạp vào xv_canh). Toạ độ cm trên 3 bộ set (dung-bo-set.py): x phải, y sâu, z lên;
# huong 0 = nhìn về −y (phía trước phòng), 90 = nhìn +x, 180 = nhìn +y, −90 = nhìn −x. Biểu cảm theo bộ từ qc-cam-xuc.ts › BIEU_CAM.
# Kỹ thuật theo mã thư viện dien-anh.ts; chuyển động máy theo ngữ pháp nhịp kịch (ngu-phap-may.ts — sốc / sỉ nhục / quyền lực / hé lộ / phán quyết / móc). Đường video: 'veo' (ảnh → video, kie Veo 3.1 Lite) / 'h3' (3D → video, chuyển động theo bộ set).
import json, os

HA, THAN, VIV, TRAN = 'Lâm Hạ', 'Lục Thần', 'Vivian', 'Luật sư Trần'
VP, SANH, PH = 'Văn phòng mở tầng 38', 'Sảnh thang máy', 'Phòng họp HĐQT'
# bề ngoài (sổ người — SO_NGUOI): khai ở lần xuất hiện đầu của ngày, shot sau tự nối
# SỔ TRANG PHỤC: trang_phuc / trang / vet ghi TÊN biến thể chuẩn hoá (phim.json › nhan_vat[].bien_the — mô tả, ảnh, dấu 3D), không tả chữ tự do
AO_HA_SANG = {'trang_phuc': 'Sơ mi trắng', 'do_deo': 'jade bangle on the left wrist; white staff ID badge on a dark blue lanyard'}
AO_THAN = {'trang_phuc': 'Com-lê đen ba mảnh', 'do_deo': 'thin pale-green jade bead bracelet hidden under the left shirt cuff'}
AO_VIV = {'trang_phuc': 'Đầm đỏ đô công sở'}
AO_TRAN = {'trang_phuc': 'Com-lê navy luật sư'}
HOP, DT = 'Thùng đồ cá nhân', 'Điện thoại của Hạ'
LY_RONG = lambda **k: vt('Ly cà phê', [312, 622, 105], 0, cam=VIV, trang='empty', **k)   # Vivian cầm ly rỗng suốt cảnh 1–2 (hất xong ở 1.1)

def vt(ten, tam, huong, den=None, huong_den=None, **k):
    d = {'ten': ten, 'tam': tam, 'huong': huong}
    if den: d['den'] = den
    if huong_den is not None: d['huong_den'] = huong_den
    d.update(k); return d

def bc(nv, dau, cuoi, **k): return {'nv': nv, 'dau': dau, 'cuoi': cuoi, **k}

S = []
def shot(ma, canh, phat, video, kt, dd, hd, thoai, bieu, may, nv, chu_man='', prompt_anh='', prompt_video=''):
    S.append({'ma': ma, 'canh': canh, 'phat_s': phat, 'thoi_luong_s': 8 if video == 'veo' else max(5, round(phat)), 'duong_video': video,
              'ky_thuat': kt, 'dan_dung': {**dd, 'ma': ma}, 'hanh_dong': hd, 'thoai': [{'nhan_vat': a, 'dien_xuat': b, 'loi': c} for a, b, c in thoai],
              'bieu_cam': bieu, 'may_3d': may, 'nhan_vat': nv, 'chu_man': chu_man, 'prompt_anh': prompt_anh, 'prompt_video': prompt_video})

C1, C2, C3, C4, C5 = 'Cà phê và hồ sơ', 'Tổng tài đuổi việc', 'Thang máy', 'Phòng họp 3 giờ', 'Sếp mới'

# ── CẢNH 1 · Văn phòng mở 09:00 (0–18 s) ──
shot('1.1', C1, 3, 'veo', {'vai': 'thiet_lap', 'co_canh': 'ws', 'goc': 'ngang', 'chuyen_dong': 'zoom_gat', 'ong_kinh': 'chuan', 'anh_sang': 'cua_so', 'am_thanh': ['nen_phong', 'vut']},
     { 'dien': "Anticipation: Vivian plants herself in Hạ's path, cup raised. Action: a sharp flick of the wrist, coffee arcs onto Hạ's chest. Reaction: Hạ freezes, breath caught, eyes drop to the stain.",'bo_cuc': 'Wide in the aisle of the open-plan office, then a crash zoom onto the two women at the splash: Vivian screen-left, Lâm Hạ screen-right, rows of desks and coworkers behind', 'mo': 'Hạ walking down the aisle, Vivian blocking her path holding a full coffee cup', 'ket': 'coffee splashed across the chest of Hạ’s white blouse', 'huong': 'they face each other across the frame', 'muc_dich': 'HOOK: bất công ngay giây đầu'},
     'Vivian chặn đường, hất cả ly cà phê vào ngực áo Hạ', [(VIV, 'lạnh, rít qua kẽ răng', 'Dọn sạch đi. Rồi cút.')],
     [bc(VIV, 'khinh_bi', 'khinh_bi'), bc(HA, 'binh_thuong', 'soc')],
     {'dat': [120, 590, 150], 'nhin': [300, 590, 140], 'ong_kinh': 40, 'khung': [VIV, HA],
      'vi_tri': [vt(HA, [300, 540, 0], 180, **AO_HA_SANG, trang_phuc_den='Sơ mi trắng dính cà phê'), vt(VIV, [300, 640, 0], 0, **AO_VIV, dien=['cam_truoc', 'hat@0.25-0.45']), vt('Ly cà phê', [312, 622, 105], 0, cam=VIV, trang_den='empty')]},
     [HA, VIV, VP, 'Ly cà phê'], chu_man='09:05 · Tầng 38 · Lục thị')
shot('1.2', C1, 3, 'veo', {'vai': 'chi_tiet', 'co_canh': 'insert', 'goc': 'cao', 'chuyen_dong': 'cam_tay', 'ong_kinh': 'macro', 'anh_sang': 'cua_so', 'am_thanh': ['rung']},
     { 'dien': "Anticipation: stillness, the stain still spreading. Action: Hạ's hand slowly clenches into a fist at her side. Reaction: a slow controlled exhale.", 'huong': 'Hạ looks down at her own chest.','bo_cuc': 'Insert from Hạ’s eye-line down onto the coffee stain on the white blouse, her clenched hand at frame bottom', 'mo': 'stain still spreading', 'ket': 'Hạ’s hand clenched into a fist', 'muc_dich': 'người xem thấy rõ cái nhục'},
     'Vết cà phê loang trên áo trắng, tay Hạ siết chặt thành nắm đấm', [], [bc(HA, 'soc', 'nhan_nhin', cam=['vui', 'cuoi_lon']), bc(VIV, 'khinh_bi', 'khinh_bi')],
     {'dat': [300, 560, 150], 'nhin': [300, 548, 110], 'ong_kinh': 85, 'khung': [HA], 'qua_truc': True, 'vi_tri': [vt(HA, [300, 540, 0], 180), vt(VIV, [300, 640, 0], 0), LY_RONG(an=True)]},
     [HA, VIV, VP, 'Ly cà phê'])
shot('1.3', C1, 4, 'veo', {'vai': 'nguoi_thu_ba', 'co_canh': 'ots', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chan_dung', 'anh_sang': 'cua_so', 'am_thanh': ['nen_phong']},
     { 'dien': "Anticipation: Vivian lifts the empty folder high. Action: she turns it to the room like evidence. Reaction: a smug glance around for the coworkers' reaction.",'bo_cuc': 'Over Hạ’s shoulder (soft, screen-right foreground) onto Vivian holding up an empty black leather folder, an empty coffee cup in her other hand', 'mo': 'Vivian raises the empty Harrington folder for the room to see', 'ket': 'Vivian’s smug look around the room', 'huong': 'Vivian looks screen-right at Hạ', 'muc_dich': 'vu oan công khai'},
     'Vivian giơ tập hồ sơ rỗng lên cho cả phòng thấy', [(VIV, 'giơ tập hồ sơ rỗng, giọng to cho cả phòng nghe', 'Hồ sơ Harrington đâu? Ngày đầu đi làm đã làm mất tài liệu mật?')],
     [bc(VIV, 'khinh_bi', 'dac_y'), bc(HA, 'nhan_nhin', 'nhan_nhin', cam=['vui'])],
     {'dat': [285, 470, 155], 'nhin': [300, 640, 150], 'ong_kinh': 85, 'khung': [VIV],
      'vi_tri': [vt(HA, [300, 540, 0], 180), vt(VIV, [300, 640, 0], 0, dien=['gio_cao@0-0.3']), vt('Hồ sơ Harrington', [300, 625, 150], 0, cam=VIV), LY_RONG()]},
     [HA, VIV, VP, 'Hồ sơ Harrington', 'Ly cà phê'])
shot('1.4', C1, 3, 'veo', {'vai': 'phan_ung', 'co_canh': 'ots', 'goc': 'ngang', 'chuyen_dong': 'vong', 'ong_kinh': 'chan_dung', 'anh_sang': 'cua_so', 'am_thanh': ['nen_phong']},
     { 'dien': 'Anticipation: Hạ lifts her eyes slowly. Action: she answers in a level voice, unblinking. Reaction: holds the gaze, chin steady.','bo_cuc': 'Clean single on Hạ from the aisle side, the coffee stain on her white blouse, the window light behind her', 'mo': 'Hạ looking straight off screen-left, calm', 'ket': 'Hạ holds the gaze', 'huong': 'Hạ looks screen-left at Vivian', 'muc_dich': 'Hạ không cãi — chỉ nói sự thật'},
     'Hạ bình thản nhìn thẳng người đối diện', [(HA, 'bình thản, nhìn thẳng', 'Sáng nay chính chị nhận từ tay tôi.')],
     [bc(HA, 'nhan_nhin', 'nhan_nhin', cam=['vui', 'cuoi_lon']), bc(VIV, 'dac_y', 'gian')],
     {'dat': [190, 680, 158], 'nhin': [300, 540, 150], 'ong_kinh': 85, 'khung': [HA], 'vi_tri': [vt(HA, [300, 540, 0], 180), vt(VIV, [300, 640, 0], 0), vt('Hồ sơ Harrington', [300, 625, 150], 0, cam=VIV, an=True), LY_RONG(an=True)]},
     [HA, VIV, VP, 'Hồ sơ Harrington', 'Ly cà phê'])
shot('1.5', C1, 6, 'h3', {'vai': 'tong_the', 'co_canh': 'ws', 'goc': 'cao', 'chuyen_dong': 'tinh', 'ong_kinh': 'rong', 'anh_sang': 'cua_so', 'am_thanh': ['nen_phong', 'foley']},
     { 'dien': 'Anticipation: Vivian dangles the papers over the floor. Action: she lets them fall; Hạ kneels on one knee and gathers them sheet by sheet. Reaction: coworkers lean in, phones up.', 'huong': 'Vivian looks down at Hạ; Hạ looks at the papers on the floor.','bo_cuc': 'High wide: Vivian throws the papers to the marble floor, Hạ kneels on one knee picking them up, coworkers at the window and the nearest desks watching and filming on phones', 'mo': 'Vivian holding the folder above the floor', 'ket': 'Hạ on one knee gathering papers', 'muc_dich': 'đáy của sự nhục — khán giả nóng mặt'},
     'Vivian ném xấp giấy xuống sàn đá; Hạ quỳ một gối nhặt từng tờ; đồng nghiệp xì xào, giơ điện thoại quay', [(VIV, 'khinh khỉnh', 'Nhặt lên.')],
     [bc(VIV, 'gian', 'dac_y'), bc(HA, 'nhan_nhin', 'nhan_nhin', cam=['vui', 'cuoi_lon', 'buon'])],
     {'dat': [40, 650, 260], 'nhin': [300, 590, 40], 'ong_kinh': 28, 'khung': [HA, VIV],
      'vi_tri': [vt(HA, [300, 540, 0], 180, dien=['mc_quy_xuong@0.3-1']), vt(VIV, [300, 640, 0], 0, dien=['gio_cao', 'hat@0.1-0.3']), vt('Hồ sơ Harrington', [300, 625, 150], 0, den=[310, 585, 0]), LY_RONG()]},
     [HA, VIV, VP, 'Hồ sơ Harrington', 'Ly cà phê'])

# ── CẢNH 2 · liền sau (18–36 s) ──
shot('2.1', C2, 5, 'h3', {'vai': 'thiet_lap', 'co_canh': 'ws', 'goc': 'thap', 'chuyen_dong': 'dan_truoc', 'ong_kinh': 'rong', 'anh_sang': 'cua_so', 'am_thanh': ['im_lang', 'foley']},
     { 'dien': 'Anticipation: the glass door swings open, the room goes silent. Action: Lục Thần strides out toward the group, unhurried. Reaction: everyone straightens; heads turn to follow him.','bo_cuc': 'Low angle from between the desks: the glass door of the CEO office opens at the back, Lục Thần walks out toward camera, the office falls silent', 'mo': 'glass door closed, Thần visible behind the glass', 'ket': 'Thần standing a few steps from Hạ and Vivian', 'huong': 'Thần walks toward camera', 'muc_dich': 'quyền lực bước vào'},
     'Cửa kính phòng tổng giám đốc mở, Lục Thần bước ra, cả phòng im bặt', [(THAN, 'không cao giọng', 'Chuyện gì?')],
     [bc(THAN, 'lanh_lung', 'lanh_lung', cam=['vui', 'cuoi_lon']), bc(HA, 'nhan_nhin', 'nhan_nhin'), bc(VIV, 'dac_y', 'dac_y')],
     {'tay': True, 'dat': [230, 250, 140], 'nhin': [200, 800, 140], 'ong_kinh': 24, 'khung': [THAN, HA, VIV],   # tổng thể cảnh 2: máy thấp sau lưng Hạ + Vivian, Thần từ cửa kính bước tới
     
      'vi_tri': [vt(THAN, [80, 1020, 0], 0, den=[230, 760, 0], **AO_THAN, dien=['mc_sai_buoc']), vt(HA, [300, 560, 0], 180, nam=False), vt(VIV, [300, 640, 0], 0, huong_den=-150), LY_RONG(an=True)]},
     [THAN, HA, VIV, VP, 'Ly cà phê'])
shot('2.2', C2, 4, 'veo', {'vai': 'chu_quan', 'co_canh': 'mcu', 'goc': 'ngang', 'chuyen_dong': 'tinh', 'ong_kinh': 'chan_dung', 'anh_sang': 'cua_so', 'am_thanh': ['nen_phong']},
     { 'dien': "Anticipation: Vivian's sneer drops. Action: she turns to Thần with a sweet smile and a soft voice. Reaction: a quick sidelong glance back at Hạ.",'bo_cuc': 'Vivian MCU from Thần’s side, her face switching to a sweet smile', 'mo': 'Vivian turns from Hạ to Thần', 'ket': 'Vivian smiling up at Thần', 'huong': 'Vivian looks screen-left up at Thần', 'muc_dich': 'hai mặt của Vivian'},
     'Vivian đổi giọng ngọt ngào với Lục Thần', [(VIV, 'đổi giọng ngọt ngào', 'Thư ký mới làm mất hồ sơ Harrington, thưa tổng giám đốc.')],
     [bc(VIV, 'dac_y', 'vui')],
     {'dat': [200, 700, 160], 'nhin': [300, 640, 150], 'ong_kinh': 70, 'khung': [VIV], 'vi_tri': [vt(VIV, [300, 640, 0], 0, huong_den=-150), vt(THAN, [230, 760, 0], 0), vt(HA, [300, 560, 0], 180), LY_RONG(an=True)]},
     [VIV, VP, 'Ly cà phê'])   # cận Vivian: Thần / Hạ ngoài khung — không làm ảnh tham chiếu
shot('2.3', C2, 5, 'veo', {'vai': 'phan_ung', 'co_canh': 'cu', 'goc': 'thap', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chan_dung', 'anh_sang': 'cua_so', 'am_thanh': ['nen_phong', 'tim_dap']},
     { 'dien': 'Anticipation: Thần looks down at Hạ, expressionless. Action: he delivers the line flatly. Reaction: he is already turning away before she can answer.','bo_cuc': 'Low close-up on Lục Thần looking down at Hạ, cold; he turns away at the end', 'mo': 'Thần staring down at Hạ', 'ket': 'Thần already turning away', 'huong': 'Thần looks down screen-right', 'muc_dich': 'phán quyết lạnh lùng'},
     'Lục Thần nhìn Hạ từ trên xuống, ánh mắt lạnh, rồi quay đi', [(THAN, 'dứt khoát, quay đi ngay', 'Cô bị đuổi việc.')],
     [bc(THAN, 'lanh_lung', 'lanh_lung', cam=['vui', 'cuoi_lon'])],
     {'dat': [230, 690, 120], 'nhin': [230, 760, 172], 'ong_kinh': 85, 'khung': [THAN], 'vi_tri': [vt(THAN, [230, 760, 0], 30, huong_den=180), vt(HA, [300, 560, 0], 180), vt(VIV, [300, 640, 0], -150), LY_RONG(an=True)]},
     [THAN, VP, 'Ly cà phê'])   # cận Thần: Hạ / Vivian ngoài khung
shot('2.4', C2, 4, 'veo', {'vai': 'chi_tiet', 'co_canh': 'insert', 'goc': 'cao', 'chuyen_dong': 'doi_net', 'ong_kinh': 'chan_dung', 'anh_sang': 'cua_so', 'am_thanh': ['ding']},
     { 'dien': "Anticipation: the phone lights up in Hạ's hand. Action: she reads the message; focus racks from the phone to her face. Reaction: the faintest smirk at the corner of her mouth.", 'huong': 'Hạ looks down at the phone, then up and off screen-left.','bo_cuc': 'Insert on the phone screen in Hạ’s hand lighting up with a message, her face soft behind it, then focus racks to her face', 'mo': 'phone screen lights up', 'ket': 'Hạ’s subtle smirk', 'muc_dich': 'khán giả biết thân phận trước nhân vật', 'motif': 'tin nhắn luật sư — gieo cho cảnh 4'},
     'Điện thoại trong tay Hạ sáng: tin nhắn của luật sư Trần; Hạ khẽ nhếch môi', [],
     [bc(HA, 'nhan_nhin', 'nhech_moi', lat=True)],
     # 2.4: trung cận từ ngực (điện thoại trong tay) lên mặt — cận riêng món 15 cm trước thân thì máy dí vào áo
     {'tay': True, 'qua_truc': True, 'dat': [360, 610, 165], 'nhin': [313, 583, 115], 'ong_kinh': 65, 'khung': [DT, HA],   # điện thoại đo từ khung 3D lần trước (điểm ảnh + máy cũ); đổi nét điện thoại → mặt (lia lên thì khung mở nhìn xuống sàn)   # khung MỞ = cận điện thoại trong tay Hạ (rồi lia lên mặt); cú chèn được khác phía trục
      'vi_tri': [vt(HA, [300, 560, 0], 180, dien=['cam_dien_thoai']), vt(DT, [300, 548, 110], 180, cam=HA), vt(THAN, [230, 760, 0], 180), vt(VIV, [300, 640, 0], -150), LY_RONG(an=True)]},
     [HA, VP, DT, 'Ly cà phê'], chu_man='Cô Hạ, họp HĐQT lúc 3 giờ. — Luật sư Trần')

# ── CẢNH 3 · Sảnh thang máy (36–58 s) ──
shot('3.1', C3, 6, 'h3', {'vai': 'tong_the', 'co_canh': 'ws', 'goc': 'ngang', 'chuyen_dong': 'tinh', 'ong_kinh': 'rong', 'anh_sang': 'vien', 'am_thanh': ['nen_phong', 'foley']},
     { 'dien': "Anticipation: Hạ waits at the elevator hugging the box. Action: Vivian strides in and snatches the badge off Hạ's neck. Reaction: Hạ turns slowly to face her, box still in her arms.", 'huong': 'Vivian walks screen-left toward Hạ; Hạ turns screen-right to face her.','bo_cuc': 'Wide lobby: Hạ holding a cardboard box of belongings waits at the left elevator; Vivian strides in from the right and snatches the staff badge off her neck', 'mo': 'Hạ alone at the elevator', 'ket': 'Vivian holding the snatched badge, Hạ turned to face her', 'muc_dich': 'nhục lần cuối'},
     'Hạ ôm thùng đồ chờ thang máy; Vivian bước tới giật phắt thẻ nhân viên trên cổ cô', [],
     [bc(VIV, 'dac_y', 'khinh_bi'), bc(HA, 'nhan_nhin', 'nhan_nhin', cam=['vui', 'buon'])],
     {'dat': [180, 40, 160], 'nhin': [-60, 400, 140], 'ong_kinh': 30, 'khung': [HA, VIV], 'nhay': 'Hạ thu dọn đồ rồi ra sảnh (thời gian trôi ngoài khung)',
      'vi_tri': [vt(HA, [-100, 380, 0], 180, huong_den=90, trang_phuc='Sơ mi trắng dính cà phê', do_deo='jade bangle on the left wrist; white staff ID badge on a dark blue lanyard', do_deo_den='jade bangle on the left wrist', dien=['om_thung']), vt(VIV, [260, 150, 0], -60, den=[0, 365, 0], huong_den=-90, **AO_VIV, dien=['mc_sai_buoc@0-0.55', 'giat@0.55-0.8']), vt('Thẻ nhân viên', [-100, 368, 140], 180, den=[10, 360, 120]), vt(HOP, [-100, 362, 95], 180, cam=HA)]},
     [HA, VIV, SANH, 'Thẻ nhân viên', HOP])
shot('3.2', C3, 5, 'veo', {'vai': 'nguoi_thu_ba', 'co_canh': 'ots', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chan_dung', 'anh_sang': 'vien', 'am_thanh': ['nen_phong']},
     { 'dien': "Anticipation: Vivian holds the lanyard up between two fingers. Action: she swings it in front of Hạ's face. Reaction: leans in with a sneer.",'bo_cuc': 'Over Hạ’s shoulder (box edge in foreground) onto Vivian dangling the badge', 'mo': 'Vivian dangling the lanyard', 'ket': 'Vivian leaning in, sneering', 'huong': 'Vivian looks screen-left at Hạ', 'muc_dich': 'Vivian tưởng mình thắng'},
     'Vivian lắc lắc tấm thẻ trước mặt Hạ', [(VIV, 'cười khẩy', 'Thẻ của công ty. Loại như cô, đừng mơ bước vào toà nhà này lần nữa.')],
     [bc(VIV, 'khinh_bi', 'dac_y'), bc(HA, 'nhan_nhin', 'nhan_nhin')],
     {'dat': [-170, 340, 155], 'nhin': [0, 365, 152], 'ong_kinh': 70, 'khung': [VIV], 'vi_tri': [vt(HA, [-100, 380, 0], 90, dien=['om_thung']), vt(VIV, [0, 365, 0], -90, dien=['dua_truoc_mat']), vt('Thẻ nhân viên', [10, 360, 120], -90, cam=VIV), vt(HOP, [-95, 365, 95], 90, cam=HA)]},
     [HA, VIV, SANH, 'Thẻ nhân viên', HOP])
shot('3.3', C3, 6, 'veo', {'vai': 'phan_ung', 'co_canh': 'cu', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chan_dung', 'anh_sang': 'vien', 'am_thanh': ['im_lang']},
     { 'dien': "Anticipation: a long silence, Hạ's face still. Action: she speaks quietly, looking straight at Vivian. Reaction: a faint smile that does not reach her eyes.",'bo_cuc': 'Reverse close-up on Hạ over Vivian’s shoulder; long silence before she speaks', 'mo': 'Hạ looking straight at Vivian', 'ket': 'Hạ’s faint smile', 'huong': 'Hạ looks screen-right at Vivian', 'muc_dich': 'lời hứa trả đòn'},
     'Hạ nhìn thẳng Vivian, khẽ nhếch môi', [(HA, 'nhìn thẳng, mỉm cười nhẹ', 'Chị nói đúng. Lần sau, tôi sẽ không đi cửa này.')],
     [bc(HA, 'nhan_nhin', 'nhech_moi'), bc(VIV, 'dac_y', 'dac_y')],
     {'dat': [60, 330, 158], 'nhin': [-100, 380, 152], 'ong_kinh': 85, 'khung': [HA], 'vi_tri': [vt(HA, [-100, 380, 0], 90, dien=['om_thung']), vt(VIV, [0, 365, 0], -90, dien=['cam_truoc']), vt('Thẻ nhân viên', [10, 360, 120], -90, cam=VIV), vt(HOP, [-95, 365, 95], 90, cam=HA, an=True)]},
     [HA, VIV, SANH, HOP])
shot('3.4', C3, 5, 'veo', {'vai': 'tam_trang', 'co_canh': 'ms', 'goc': 'thap', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chuan', 'anh_sang': 'vien', 'am_thanh': ['ding', 'foley']},
     { 'dien': "Anticipation: Hạ steps backward into the elevator. Action: the steel doors slide shut between them. Reaction: Vivian's smile falters as her reflection appears in the steel.", 'huong': 'Hạ backs away from camera into the elevator; Vivian stays facing her.','bo_cuc': 'Hạ steps into the elevator; the steel doors slide shut between her and Vivian', 'mo': 'Hạ stepping back into the elevator', 'ket': 'doors closed, Vivian’s reflection in the steel', 'muc_dich': 'khép một chương'},
     'Hạ lùi vào thang máy, cửa thép khép lại giữa hai người', [],
     [bc(HA, 'nhech_moi', 'quyet_tam'), bc(VIV, 'dac_y', 'ngo_vuc')],
     {'dat': [60, 230, 160], 'nhin': [-100, 440, 150], 'ong_kinh': 45, 'khung': [HA, VIV], 'vi_tri': [vt(HA, [-100, 380, 0], 90, den=[-100, 470, 0], huong_den=0, dien=['om_thung']), vt(VIV, [0, 365, 0], -90, dien=['cam_truoc']), vt('Thẻ nhân viên', [10, 360, 120], -90, cam=VIV, an=True), vt(HOP, [-95, 365, 95], 90, cam=HA, het=True)]},
     [HA, VIV, SANH, 'Thẻ nhân viên', HOP])

# ── CẢNH 4 · Phòng họp HĐQT 15:00 (58–79 s) — thời gian nhảy, Hạ đã thay vest trắng ──
AO_HA_CHIEU = {'trang_phuc': 'Vest trắng', 'trang': '', 'do_deo': 'jade bangle on the left wrist'}
shot('4.1', C4, 5, 'veo', {'vai': 'thiet_lap', 'co_canh': 'ws', 'goc': 'cao', 'chuyen_dong': 'truot_ngang', 'ong_kinh': 'rong', 'anh_sang': 'tuong_phan', 'am_thanh': ['nen_phong']},
     { 'dien': 'Anticipation: Thần gestures toward the screen. Action: he presents confidently to the seated board. Reaction: board members nod; Vivian sips with a satisfied look.', 'huong': 'Thần faces the table, gesturing screen-left toward the screen.','bo_cuc': 'Wide boardroom: Lục Thần standing at the head of the table presenting in front of the screen, board members seated along both sides, Vivian standing beside him holding a coffee cup', 'mo': 'Thần mid-presentation', 'ket': 'board members nodding', 'muc_dich': 'Thần tưởng mọi thứ trong tay'},
     'Lục Thần thuyết trình trước HĐQT, Vivian đứng cạnh cầm ly cà phê đắc ý', [(THAN, 'tự tin', 'Với khoản vốn của Quỹ Harrington, Lục thị sẽ…')],
     [bc(THAN, 'tu_tin', 'tu_tin'), bc(VIV, 'dac_y', 'dac_y')],
     {'dat': [0, 60, 280], 'nhin': [0, 620, 100], 'ong_kinh': 30, 'khung': [THAN], 'nhay': '3 giờ chiều cùng ngày — họp HĐQT',
      'vi_tri': [vt(THAN, [0, 740, 0], 0, **AO_THAN, dien=['thuyet_trinh']), vt(VIV, [110, 745, 0], -20, **AO_VIV, dien=['cam_truoc']), vt('Ly cà phê', [122, 728, 105], 0, cam=VIV)]},
     [THAN, VIV, PH, 'Ly cà phê'])
shot('4.2', C4, 5, 'h3', {'vai': 'hanh_dong', 'co_canh': 'ws', 'goc': 'thap', 'chuyen_dong': 'dan_truoc', 'ong_kinh': 'rong', 'anh_sang': 'tuong_phan', 'am_thanh': ['dap', 'foley']},
     { 'dien': 'Anticipation: the double doors swing open. Action: Hạ strides in, chin up, the lawyer a step behind. Reaction: board members turn in their chairs.','bo_cuc': 'Low angle: the tall double doors flung wide open, Lâm Hạ strides in through the doorway in a white power suit, Lawyer Trần a step behind her', 'mo': 'doors already flung open, Hạ in the doorway mid-stride, Trần a step behind', 'ket': 'Hạ standing at the end of the table', 'huong': 'Hạ walks screen-right toward the table', 'muc_dich': 'đảo ngược hình ảnh: từ trắng bị bẩn → trắng quyền lực'},
     'Cửa đôi mở, Hạ bước vào — vest trắng, tóc buông; luật sư Trần theo sau', [],
     [bc(HA, 'quyet_tam', 'quyet_tam', lat=True, cam=['buon', 'nhuc_nha']), bc(TRAN, 'binh_thuong', 'tu_tin')],
     {'tay': True, 'dat': [-250, 100, 55], 'nhin': [-470, 160, 125], 'ong_kinh': 28, 'khung': [HA, TRAN], 'qua_truc': True, 'them': ['Cửa đôi mở'],   # máy thấp trong phòng nhìn thẳng ô cửa: cửa mở giữa khung, Hạ đi về phía máy (mặt thấy)
      # Trần "sau một bước" lệch NGANG ~50 cm khỏi trục máy — đứng nối đuôi dọc trục thì khung 3D chỉ còn một dáng người, AI vẽ mất Trần (kiem-ai-3d.ts › chongNguoi)
      'vi_tri': [vt(HA, [-470, 160, 0], 90, den=[-200, 200, 0], **AO_HA_CHIEU, nhay='họp HĐQT 3 giờ chiều — đã thay vest trắng', dien=['mc_sai_buoc']), vt(TRAN, [-490, 215, 0], 90, den=[-270, 150, 0], **AO_TRAN, dien=['mc_di_bo'])]},
     [HA, TRAN, PH])
shot('4.3', C4, 4, 'veo', {'vai': 'nguoi_thu_ba', 'co_canh': 'two', 'goc': 'ngang', 'chuyen_dong': 'dolly_zoom', 'ong_kinh': 'chuan', 'anh_sang': 'tuong_phan', 'am_thanh': ['nen_phong']},
     { 'dien': 'Anticipation: Lawyer Trần raises an open hand toward Hạ. Action: he announces her name formally. Reaction: Hạ stands composed while the room murmurs.', 'huong': 'Trần gestures screen-left toward Hạ; both face the table.','bo_cuc': 'Two-shot: Lawyer Trần presents Hạ to the board; Hạ calm beside him', 'mo': 'Trần raising a hand toward Hạ', 'ket': 'board members turning in their chairs', 'muc_dich': 'thân phận lộ ra'},
     'Luật sư Trần giới thiệu Hạ với cả phòng', [(TRAN, 'trang trọng', 'Xin giới thiệu: cô Lâm Hạ, người thừa kế Quỹ Harrington.')],
     [bc(TRAN, 'tu_tin', 'tu_tin'), bc(HA, 'quyet_tam', 'lanh_lung')],
     {'dat': [-235, 30, 150], 'nhin': [-235, 175, 150], 'ong_kinh': 45, 'khung': [HA, TRAN],   # cùng hướng máy chủ cảnh (về phía màn) — HĐQT phía sau họ
      'vi_tri': [vt(HA, [-200, 200, 0], 90, huong_den=160), vt(TRAN, [-270, 150, 0], 90, dien=['gioi_thieu@0-0.3'])]},
     [HA, TRAN, PH])
shot('4.4', C4, 3, 'veo', {'vai': 'chi_tiet', 'co_canh': 'insert', 'goc': 'thap', 'chuyen_dong': 'speed_ramp', 'ong_kinh': 'macro', 'anh_sang': 'tuong_phan', 'am_thanh': ['vo_kinh']},
     { 'dien': "Anticipation: the white cup tumbles in slow motion a hand's width above the carpet, coffee curling out of it. Action: it hits and shatters. Reaction: shards and coffee spray across the dark carpet.", 'huong': 'The cup falls straight down.','bo_cuc': 'Low slow-motion insert at carpet level: the white coffee cup tumbling just above the dark grey carpet, the hem of Vivian’s burgundy dress soft behind', 'mo': 'cup tumbling just above the carpet, coffee spilling out', 'ket': 'porcelain shards and coffee across the carpet', 'muc_dich': 'cú đánh mặt bằng hình'},
     'Ly cà phê trên tay Vivian rơi xuống sàn, vỡ tung', [], [bc(VIV, 'soc', 'soc', cam=['vui', 'dac_y'])],
     {'dat': [60, 690, 10], 'nhin': [124, 708, 10], 'ong_kinh': 100, 'khung': ['Ly cà phê'],   # cầu nối hướng máy giữa #16 (về màn) và #18 (trước mặt Hạ)
      'vi_tri': [vt(VIV, [110, 745, 0], -20, dien=['cam_truoc']), vt('Ly cà phê', [124, 712, 25], 0, den=[125, 705, 0], trang_den='shattered on the floor')]},
     [VIV, PH, 'Ly cà phê'])
shot('4.5', C4, 5, 'veo', {'vai': 'hanh_dong', 'co_canh': 'mcu', 'goc': 'thap', 'chuyen_dong': 'zoom_cham', 'ong_kinh': 'chan_dung', 'anh_sang': 'tuong_phan', 'am_thanh': ['im_lang']},
     { 'dien': 'Anticipation: Hạ looks down the table at Thần. Action: she states the withdrawal word by word. Reaction: unblinking, she waits.','bo_cuc': 'Low medium close-up on Hạ delivering the line, the board soft behind her', 'mo': 'Hạ looking down the table at Thần', 'ket': 'Hạ unblinking', 'huong': 'Hạ looks screen-right toward Thần', 'muc_dich': 'phán quyết — ngược lại cảnh 2'},
     'Hạ tuyên bố rút vốn, từng chữ', [(HA, 'bình thản, từng chữ', 'Quỹ Harrington rút toàn bộ vốn khỏi Lục thị. Hiệu lực từ bây giờ.')],
     [bc(HA, 'lanh_lung', 'lanh_lung', cam=['vui', 'cuoi_lon'])],
     {'dat': [-260, 330, 120], 'nhin': [-200, 200, 160], 'ong_kinh': 70, 'khung': [HA], 'vi_tri': [vt(HA, [-200, 200, 0], 160), vt(THAN, [0, 740, 0], 0, an=True), vt(TRAN, [-270, 150, 0], 90, an=True)]},
     [HA, PH])   # trung cận Hạ: Thần cuối bàn ngoài khung

# ── CẢNH 5 · liền sau (79–89 s) ──
shot('5.1', C5, 4, 'h3', {'vai': 'phan_ung', 'co_canh': 'ms', 'goc': 'ngang', 'chuyen_dong': 'tinh', 'ong_kinh': 'chuan', 'anh_sang': 'tuong_phan', 'am_thanh': ['tim_dap']},
     { 'dien': "Anticipation: Thần's pen stops mid-air. Action: he drops it, strides to the table corner and slams both palms onto the wood. Reaction: he leans in, breathing hard, staring at Hạ.", 'huong': 'Thần moves screen-left to the table corner and looks screen-left at Hạ.','bo_cuc': 'Lục Thần drops his pen and strides to the corner of the table, both palms slamming onto the tabletop', 'mo': 'Thần at the head of the table, pen in hand', 'ket': 'Thần leaning on the table corner, hands flat on the wood', 'muc_dich': 'lần đầu mất thế chủ động'},
     'Lục Thần buông bút, bước tới góc bàn, hai tay chống mạnh xuống mặt bàn', [(THAN, 'lần đầu mất bình tĩnh', 'Cô… rốt cuộc là ai?')],
     [bc(THAN, 'soc', 'gian', lat=True)],
     {'dat': [-100, 470, 160], 'nhin': [-35, 720, 150], 'ong_kinh': 45, 'khung': [THAN], 'vi_tri': [vt(THAN, [0, 740, 0], 0, den=[-70, 705, 0], huong_den=-90, dien=['mc_di_bo@0-0.5', 'mc_chong_ghe@0.5-1'])]},
     [THAN, PH])
shot('5.2', C5, 6, 'veo', {'vai': 'tong_the', 'co_canh': 'two', 'goc': 'ngang', 'chuyen_dong': 'dolly_zoom', 'ong_kinh': 'chuan', 'anh_sang': 'tuong_phan', 'chuyen_canh': 'mo_cheo', 'am_thanh': ['im_lang', 'cot_ket']},
     { 'dien': 'Anticipation: Hạ walks to the corner and stops close. Action: she leans in to his eye level and says the line softly. Reaction: she straightens and turns away.','bo_cuc': 'Profile two-shot at the table corner: Hạ (screen-left) leans in to Thần’s eye level; the jade bangle on her wrist catches the light', 'mo': 'Hạ arriving at the corner', 'ket': 'Hạ straightening up, turning away from Thần', 'huong': 'Hạ looks screen-right into Thần’s eyes', 'muc_dich': 'cliffhanger', 'motif': 'vòng tay ngọc — ký ức cô bé năm xưa (tập sau)'},
     'Hạ cúi xuống ngang tầm mắt anh, vòng tay ngọc loé sáng', [(HA, 'khẽ, chắc nịch', 'Sếp mới của anh.')],
     [bc(HA, 'lanh_lung', 'nhech_moi'), bc(THAN, 'gian', 'soc')],
     {'dat': [-60, 480, 160], 'nhin': [-118, 702, 150], 'ong_kinh': 35, 'khung': [HA, THAN],   # phía nam chéo về phía Thần: thấy mặt Hạ đang nói (máy sau lưng Hạ → gáy), giữa hai dãy ghế
        # chéo từ phía Hạ — thẳng trục y thì Ghế 4T chắn tiền cảnh
      'vi_tri': [vt(HA, [-170, 640, 0], 90, den=[-165, 700, 0], **AO_HA_CHIEU, nhay='đi tới góc bàn trong lúc Thần đứng dậy (ngoài khung #19)', dien=['cui_nguoi@0.6-0.9']), vt(THAN, [-70, 705, 0], -90, dien=['chong_ban'])]},
     [HA, THAN, PH])
shot('5.3', C5, 3, 'veo', {'vai': 'phan_ung', 'co_canh': 'cu', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chan_dung', 'anh_sang': 'tuong_phan', 'luat': ['giu_phan_ung', 'khoang_lang'], 'am_thanh': ['im_lang']},
     { 'dien': "Anticipation: Thần stays frozen, palms still on the table. Action: his jaw tightens; his eyes follow Hạ off screen-left. Reaction: the cold mask cracks — a long, stunned breath.", 'huong': 'Thần looks screen-left after Hạ.','bo_cuc': 'Slow push into a close-up of Lục Thần still leaning on the table corner, the boardroom soft and silent behind him', 'mo': 'Thần frozen, leaning on his palms', 'ket': 'Thần staring after Hạ, stunned', 'muc_dich': 'giữ phản ứng — khán giả nếm cú đảo thế'},
     'Lục Thần đứng chết lặng, hai tay vẫn chống trên bàn, mắt dõi theo Hạ', [],
     [bc(THAN, 'soc', 'ngo_vuc')],
     {'tay': True, 'dat': [-175, 640, 145], 'nhin': [-100, 702, 138], 'ong_kinh': 65, 'khung': [THAN],   # Thần chúi chống bàn: đầu lệch về −x, thấp hơn đứng   # từ chỗ Hạ vừa đứng nhìn về Thần — nhìn theo +y thì màn trình chiếu lấp khung
      'vi_tri': [vt(THAN, [-70, 705, 0], -90, dien=['chong_ban']), vt(HA, [-165, 700, 0], 90, an=True)]},
     [THAN, PH])
shot('5.4', C5, 3, 'veo', {'vai': 'chi_tiet', 'co_canh': 'insert', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'macro', 'anh_sang': 'tuong_phan', 'luat': ['chenh_thong_tin', 'motif'], 'am_thanh': ['im_lang', 'cot_ket']},
     { 'dien': "Anticipation: Thần's left hand flat on the walnut table, the shirt cuff riding up. Action: the camera pushes in on the wrist as a thin jade bead bracelet slides into view beside the steel watch. Reaction: hold on the green jade — cut to black.", 'huong': 'Static hand; the camera pushes down onto the wrist.','bo_cuc': 'Insert at wrist height on Lục Thần’s left hand pressed flat on the dark walnut table, forearm upright: the shirt cuff pulled back reveals a thin pale-green jade bead bracelet around the wrist', 'mo': 'Thần’s hand flat on the table, cuff covering the wrist', 'ket': 'the jade bead bracelet in full view — cut to black', 'muc_dich': 'móc: khán giả thấy hai người cùng một chất ngọc, nhân vật chưa biết', 'motif': 'ngọc — vòng tay của Hạ (5.2) ↔ chuỗi hạt của Thần (tập sau)'},
     'Cận cổ tay Thần trên mặt bàn: tay áo xô lên, lộ chuỗi hạt ngọc cùng màu với vòng tay của Hạ; cắt đen', [],
     [bc(THAN, 'ngo_vuc', 'ngo_vuc')],
     {'tay': True, 'dat': [-200, 640, 92], 'nhin': [-145, 680, 86], 'ong_kinh': 85, 'khung': ['Chuỗi hạt ngọc', THAN],   # ngang tầm cổ tay, chéo từ phía trước-trái: cẳng tay chống bàn đứng dọc khung, bàn tay áp mặt gỗ
      'vi_tri': [vt(THAN, [-70, 705, 0], -90, dien=['chong_ban']), vt('Chuỗi hạt ngọc', [-145, 680, 86], -90, cam=THAN, deo='cotay_t')]},   # ĐEO ở cổ tay trái (khớp rig) — không khai deo thì máy nhét vào lòng bàn tay phải
     [THAN, PH, 'Chuỗi hạt ngọc'])

# MÁY TỰ ĐẶT (17/10/2026 — khung 3D đầu tiên: máy gõ tay nằm trong người phụ, dí sát mặt, cắt mất nhân vật): giữ HƯỚNG máy đã khai (phía quanh
# chủ thể, trục đã chấm đạt) rồi bỏ dat / nhin / ong_kinh — may-shot.ts › mayShot tính khoảng cách / cao / ống kính theo cỡ cảnh của thẻ shot.
import math
for s_ in S:
    m = s_['may_3d']
    if 'dat' not in m or m.get('tay'): continue   # 'tay': máy ĐẶT TAY (giữ dat / nhin / ong_kinh, bộ giải Blender không dời) — shot bộ giải làm hỏng
    ten = m.get('khung') or [v['ten'] for v in m['vi_tri'] if not v.get('an')][:2]
    ds = [v['tam'] for v in m['vi_tri'] if v['ten'] in ten] or [m['nhin']]
    cx = sum(p[0] for p in ds) / len(ds); cy = sum(p[1] for p in ds) / len(ds)
    m['phia'] = round(math.degrees(math.atan2(m['dat'][0] - cx, -(m['dat'][1] - cy))), 1)
    for k in ('dat', 'nhin', 'ong_kinh'): m.pop(k)
t = 0.0
for s_ in S: s_['bat_dau'] = t; t += s_['phat_s']
json.dump(S, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shot.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', len(S), 'shot ·', round(t, 1), 's · h3:', [x['ma'] for x in S if x['duong_video'] == 'h3'])
