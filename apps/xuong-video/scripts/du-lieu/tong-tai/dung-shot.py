# Sinh 22 SHOT tập 1 "Nữ Thừa Kế Bí Mật" → shot.json (nap.mts nạp vào xv_canh). Toạ độ cm trên 3 bộ set (dung-bo-set.py): x phải, y sâu, z lên;
# huong 0 = nhìn về −y (phía trước phòng), 90 = nhìn +x, 180 = nhìn +y, −90 = nhìn −x. Biểu cảm theo bộ từ qc-cam-xuc.ts › BIEU_CAM.
# Kỹ thuật theo mã thư viện dien-anh.ts; chuyển động máy theo ngữ pháp nhịp kịch (ngu-phap-may.ts — sốc / sỉ nhục / quyền lực / hé lộ / phán quyết / móc). Đường video: 'veo' (ảnh → video, kie Veo 3.1 Lite) / 'h3' (3D → video, chuyển động theo bộ set).
import json, os

HA, THAN, VIV, TRAN = 'Lâm Hạ', 'Lục Thần', 'Vivian', 'Luật sư Trần'
VP, SANH, PH = 'Văn phòng mở tầng 38', 'Sảnh thang máy', 'Phòng họp HĐQT'
# bề ngoài (sổ người — SO_NGUOI): khai ở lần xuất hiện đầu của ngày, shot sau tự nối
# SỔ TRANG PHỤC: trang_phuc / trang / vet ghi TÊN biến thể chuẩn hoá (phim.json › nhan_vat[].bien_the — mô tả, ảnh, dấu 3D), không tả chữ tự do
AO_HA_SANG = {'trang_phuc': 'Sơ mi trắng', 'do_deo': 'jade bangle on the left wrist; white staff ID badge on a dark blue lanyard'}
AO_THAN = {'trang_phuc': 'Com-lê đen ba mảnh', 'do_deo': 'steel wristwatch on the left wrist; thin pale-green jade bead bracelet hidden under the left shirt cuff'}
AO_VIV = {'trang_phuc': 'Đầm đỏ đô công sở', 'trang_diem': 'bold red lipstick', 'do_deo': 'small gold stud earrings'}
AO_TRAN = {'trang_phuc': 'Com-lê navy luật sư', 'do_deo': 'carrying a brown leather briefcase'}
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
     { 'dien': "Anticipation: Vivian plants herself in Hạ's path, {Ly cà phê} raised. Action: a sharp flick of the wrist, coffee arcs onto Hạ's chest. Reaction: Hạ freezes, breath caught, eyes drop to the stain.",'bo_cuc': 'Wide in the aisle of the open-plan office, then a crash zoom onto the two women at the splash: Vivian screen-left, Lâm Hạ screen-right, rows of desks and coworkers behind', 'mo': 'Hạ walking down the aisle, Vivian blocking her path holding a full {Ly cà phê}', 'ket': 'coffee splashed across the chest of Hạ’s white blouse', 'huong': 'they face each other across the frame', 'muc_dich': 'HOOK: bất công ngay giây đầu'},
     'Vivian chặn đường, hất cả ly cà phê vào ngực áo Hạ', [(VIV, 'lạnh, rít qua kẽ răng', 'Dọn sạch đi. Rồi cút.')],
     [bc(VIV, 'khinh_bi', 'khinh_bi'), bc(HA, 'binh_thuong', 'soc')],
     {'dat': [120, 590, 150], 'nhin': [300, 590, 140], 'ong_kinh': 40, 'khung': [VIV, HA],
      'vi_tri': [vt(HA, [300, 540, 0], 180, **AO_HA_SANG, trang_phuc_den='Sơ mi trắng dính cà phê'), vt(VIV, [300, 640, 0], 0, **AO_VIV, dien=['cam_truoc', 'hat@0.25-0.45']), vt('Ly cà phê', [312, 622, 105], 0, cam=VIV, trang_den='empty')]},
     [HA, VIV, VP, 'Ly cà phê'], chu_man='09:05 · Tầng 38 · Lục thị')
shot('1.2', C1, 3, 'veo', {'vai': 'chi_tiet', 'co_canh': 'insert', 'goc': 'cao', 'chuyen_dong': 'cam_tay', 'ong_kinh': 'macro', 'anh_sang': 'cua_so', 'am_thanh': ['tim_dap']},
     { 'dien': "Anticipation: stillness, the stain still spreading. Action: Hạ's hand slowly clenches into a fist at her side. Reaction: a slow controlled exhale.", 'huong': 'Hạ looks down at her own chest.','bo_cuc': 'Insert from Hạ’s eye-line down onto the coffee stain on the white blouse, her clenched hand at frame bottom', 'mo': 'stain still spreading', 'ket': 'Hạ’s hand clenched into a fist', 'muc_dich': 'người xem thấy rõ cái nhục'},
     'Vết cà phê loang trên áo trắng, tay Hạ siết chặt thành nắm đấm', [], [bc(HA, 'soc', 'nhan_nhin', cam=['vui', 'cuoi_lon']), bc(VIV, 'khinh_bi', 'khinh_bi')],
     {'dat': [300, 560, 150], 'nhin': [300, 548, 110], 'ong_kinh': 85, 'khung': [HA], 'qua_truc': True, 'vi_tri': [vt(HA, [300, 540, 0], 180), vt(VIV, [300, 640, 0], 0), LY_RONG(an=True)]},
     [HA, VIV, VP, 'Ly cà phê'])
shot('1.3', C1, 4, 'veo', {'vai': 'nguoi_thu_ba', 'co_canh': 'ots', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chan_dung', 'anh_sang': 'cua_so', 'am_thanh': ['nen_phong']},
     { 'dien': "Anticipation: Vivian lifts the empty {Hồ sơ Harrington} high. Action: she turns it to the room like evidence. Reaction: a smug glance around for the coworkers' reaction.",'bo_cuc': 'Over Hạ’s shoulder (soft, screen-right foreground) onto Vivian holding up the empty {Hồ sơ Harrington}, the empty {Ly cà phê} in her other hand', 'mo': 'Vivian raises the empty {Hồ sơ Harrington} for the room to see', 'ket': 'Vivian’s smug look around the room', 'huong': 'Vivian looks screen-right at Hạ', 'muc_dich': 'vu oan công khai'},
     'Vivian giơ tập hồ sơ rỗng lên cho cả phòng thấy', [(VIV, 'giơ tập hồ sơ rỗng, giọng to cho cả phòng nghe', 'Hồ sơ Harrington đâu? Ngày đầu đi làm đã làm mất tài liệu mật?')],
     [bc(VIV, 'khinh_bi', 'dac_y'), bc(HA, 'nhan_nhin', 'nhan_nhin', cam=['vui'])],
     {'tay': True, 'dat': [268, 448, 158], 'nhin': [306, 640, 168], 'ong_kinh': 50, 'khung': [VIV, 'Hồ sơ Harrington'],
      'vi_tri': [vt(HA, [300, 540, 0], 180), vt(VIV, [300, 640, 0], 0, dien=['gio_cao']), vt('Hồ sơ Harrington', [300, 625, 150], 0, cam=VIV), LY_RONG()]},   # giơ HẲN từ khung mở — '@0-0.3' thì khung mở tay còn buông (#3 keyframe)
     [HA, VIV, VP, 'Hồ sơ Harrington', 'Ly cà phê'])
shot('1.4', C1, 3, 'veo', {'vai': 'phan_ung', 'co_canh': 'ots', 'goc': 'ngang', 'chuyen_dong': 'vong', 'ong_kinh': 'chan_dung', 'anh_sang': 'cua_so', 'am_thanh': ['nen_phong']},
     { 'dien': 'Anticipation: Hạ lifts her eyes slowly. Action: she answers in a level voice, unblinking. Reaction: holds the gaze, chin steady.','bo_cuc': 'Clean single on Hạ from the aisle side, the coffee stain on her white blouse, the window light behind her', 'mo': 'Hạ looking straight off screen-left, calm', 'ket': 'Hạ holds the gaze', 'huong': 'Hạ looks screen-left at Vivian', 'muc_dich': 'Hạ không cãi — chỉ nói sự thật'},
     'Hạ bình thản nhìn thẳng người đối diện', [(HA, 'bình thản, nhìn thẳng', 'Sáng nay chính chị nhận từ tay tôi.')],
     [bc(HA, 'nhan_nhin', 'nhan_nhin', cam=['vui', 'cuoi_lon']), bc(VIV, 'dac_y', 'gian')],
     {'dat': [190, 680, 158], 'nhin': [300, 540, 150], 'ong_kinh': 85, 'khung': [HA], 'vi_tri': [vt(HA, [300, 540, 0], 180), vt(VIV, [300, 640, 0], 0), vt('Hồ sơ Harrington', [300, 625, 150], 0, cam=VIV, an=True), LY_RONG(an=True)]},
     [HA, VIV, VP, 'Hồ sơ Harrington', 'Ly cà phê'])
shot('1.5', C1, 6, 'h3', {'vai': 'tong_the', 'co_canh': 'ws', 'goc': 'cao', 'chuyen_dong': 'tinh', 'ong_kinh': 'rong', 'anh_sang': 'cua_so', 'am_thanh': ['nen_phong', 'foley']},
     { 'dien': 'Anticipation: Vivian dangles the papers over the floor. Action: she lets them fall; Hạ kneels on one knee and gathers them sheet by sheet. Reaction: coworkers lean in, phones up.', 'huong': 'Vivian looks down at Hạ; Hạ looks at the papers on the floor.','bo_cuc': 'High wide: Vivian throws the papers to the marble floor, Hạ kneels on one knee picking them up, coworkers at the window and the nearest desks watching and filming on phones', 'mo': 'Vivian holding the {Hồ sơ Harrington} above the floor', 'ket': 'Hạ on one knee gathering papers', 'muc_dich': 'đáy của sự nhục — khán giả nóng mặt'},
     'Vivian ném xấp giấy xuống sàn đá; Hạ quỳ một gối nhặt từng tờ; đồng nghiệp xì xào, giơ điện thoại quay', [(VIV, 'khinh khỉnh', 'Nhặt lên.')],
     [bc(VIV, 'gian', 'dac_y'), bc(HA, 'nhan_nhin', 'nhan_nhin', cam=['vui', 'cuoi_lon', 'buon'])],
     {'dat': [40, 650, 260], 'nhin': [300, 590, 40], 'ong_kinh': 28, 'khung': [HA, VIV],
      'vi_tri': [vt(HA, [300, 540, 0], 180, dien=['mc_quy_xuong@0.3-1']), vt(VIV, [300, 640, 0], 0, dien=['gio_cao', 'hat@0.1-0.3']), vt('Hồ sơ Harrington', [300, 625, 150], 0, den=[310, 585, 0], cam=VIV), LY_RONG()]},   # Vivian CẦM hồ sơ rồi ném xuống (cam + den) — đặt cố định giữa không trung thì tay giơ cao xuyên vào hồ sơ
     [HA, VIV, VP, 'Hồ sơ Harrington', 'Ly cà phê'])

# ── CẢNH 2 · liền sau (18–36 s) ──
shot('2.1', C2, 5, 'h3', {'vai': 'thiet_lap', 'co_canh': 'ws', 'goc': 'thap', 'chuyen_dong': 'dan_truoc', 'ong_kinh': 'rong', 'anh_sang': 'cua_so', 'am_thanh': ['im_lang', 'foley']},
     { 'dien': 'Anticipation: the {Cửa phòng TGĐ} swings open, the room goes silent. Action: Lục Thần strides out toward the group, unhurried. Reaction: everyone straightens; heads turn to follow him.','bo_cuc': 'Low angle from between the desks: the {Cửa phòng TGĐ} opens at the back, Lục Thần walks out toward camera, the office falls silent', 'mo': '{Cửa phòng TGĐ} closed, Thần visible behind the glass', 'ket': 'Thần standing a few steps from Hạ and Vivian', 'huong': 'Thần walks toward camera', 'muc_dich': 'quyền lực bước vào'},
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
# 2.3b GÀI chuỗi hạt ngọc (anh 18/10/2026: Lục Thần xuất hiện quá ít, cú trả #22 rơi vào khoảng trống — bộ chấm chamDauTu): soi gương cú trả cuối tập
# #9 CHUYỂN CHỦ THỂ (anh 18/10/2026, kiểu HBO): máy rời chuỗi hạt trên cổ tay Thần, dừng trên Hạ đang cúi nhìn điện thoại — không cắt = hai người có dây nối.
# Cắt SAU khi máy dừng (luật khong_cat_giua_may): #10 vào cận điện thoại + phản ứng của Hạ. Máy kết: duong-may.ts › 'chuyen' (chuyen_toi = Hạ).
shot('2.3b', C2, 5, 'veo', {'vai': 'chi_tiet', 'co_canh': 'insert', 'goc': 'ngang', 'chuyen_dong': 'chuyen_chu_the', 'ong_kinh': 'macro', 'anh_sang': 'cua_so', 'luat': ['motif'], 'am_thanh': ['nen_phong']},
     { 'dien': "Anticipation: Thần turns on his heel. Action: his left shirt cuff rides up for a beat, the {Chuỗi hạt ngọc} catching the window light. Reaction: the cuff slides back over it as he walks away; the camera lets him go, drifts off his wrist and settles on Hạ in the background, eyes down on the {Điện thoại của Hạ} in her hand.", 'huong': 'Thần turns away screen-left; Hạ looks down at the phone in her hand.','bo_cuc': 'Insert on Lục Thần’s left wrist as he turns away: the shirt cuff riding up, the {Chuỗi hạt ngọc} beside the steel watch', 'mo': 'Thần’s cuff riding up over the {Chuỗi hạt ngọc}', 'ket': 'the camera has drifted off Thần and settled on Hạ, eyes down on the {Điện thoại của Hạ} in her hand', 'muc_dich': 'gài chuỗi hạt ngọc — trả ở cú cuối'},
     'Thần quay đi, tay áo xô lên một nhịp lộ chuỗi hạt ngọc rồi phủ lại; máy rời cổ tay anh, dừng trên Hạ đang cúi nhìn điện thoại', [],
     [bc(THAN, 'lanh_lung', 'lanh_lung'), bc(HA, 'nhan_nhin', 'nhan_nhin')],
     {'tay': True, 'dat': [165, 795, 85], 'nhin': [198, 756, 79], 'ong_kinh': 100, 'khung': ['Chuỗi hạt ngọc', THAN], 'chuyen_toi': HA,   # chéo trước-trái cổ tay, nhắm chuỗi hạt theo toạ độ ĐO (198, 756, 79): nền sau cổ tay là phòng — máy sau cổ tay thì thân lấp 90%
      'vi_tri': [vt(THAN, [230, 760, 0], 180, trang_phuc='Com-lê đen ba mảnh', do_deo='steel wristwatch and a thin pale-green jade bead bracelet on the left wrist, shirt cuff riding up as he turns so the bracelet shows', nhay='cận chèn: tay áo xô lên một nhịp khi quay đi'), vt('Chuỗi hạt ngọc', [208, 762, 86], 0, cam=THAN, deo='cotay_t'), vt(HA, [300, 560, 0], 180, dien=['cam_dien_thoai']), vt(DT, [300, 548, 110], 180, cam=HA), vt(VIV, [300, 640, 0], -150), LY_RONG(an=True)]},
     [THAN, HA, VP, 'Chuỗi hạt ngọc', DT])
shot('2.4', C2, 4, 'veo', {'vai': 'chi_tiet', 'co_canh': 'insert', 'goc': 'cao', 'chuyen_dong': 'doi_net', 'ong_kinh': 'chan_dung', 'anh_sang': 'cua_so', 'am_thanh': ['ding']},
     { 'dien': "Anticipation: the {Điện thoại của Hạ} lights up in Hạ's hand. Action: she reads the message; focus racks from the {Điện thoại của Hạ} to her face. Reaction: the faintest smirk at the corner of her mouth.", 'huong': 'Hạ looks down at the {Điện thoại của Hạ}, then up and off screen-left.','bo_cuc': 'Insert on the screen of the {Điện thoại của Hạ} in Hạ’s hand lighting up with a message, her face soft behind it, then focus racks to her face', 'mo': 'the {Điện thoại của Hạ} screen lights up', 'ket': 'Hạ’s subtle smirk', 'muc_dich': 'khán giả biết thân phận trước nhân vật', 'motif': 'tin nhắn luật sư — gieo cho cảnh 4'},
     'Điện thoại trong tay Hạ sáng: tin nhắn của luật sư Trần; Hạ khẽ nhếch môi', [],
     [bc(HA, 'nhan_nhin', 'nhech_moi', lat=True)],
     # 2.4: trung cận từ ngực (điện thoại trong tay) lên mặt — cận riêng món 15 cm trước thân thì máy dí vào áo
     {'tay': True, 'qua_truc': True, 'dat': [360, 610, 165], 'nhin': [313, 583, 115], 'ong_kinh': 65, 'khung': [DT, HA],   # điện thoại đo từ khung 3D lần trước (điểm ảnh + máy cũ); đổi nét điện thoại → mặt (lia lên thì khung mở nhìn xuống sàn)   # khung MỞ = cận điện thoại trong tay Hạ (rồi lia lên mặt); cú chèn được khác phía trục
      'vi_tri': [vt(HA, [300, 560, 0], 180, dien=['cam_dien_thoai']), vt(DT, [300, 548, 110], 180, cam=HA), vt(THAN, [230, 760, 0], 180), vt('Chuỗi hạt ngọc', [208, 762, 86], 0, cam=THAN, deo='cotay_t', an=True), vt(VIV, [300, 640, 0], -150), LY_RONG(an=True)]},
     [HA, VP, DT, 'Ly cà phê'], chu_man='Quỹ Harrington của cô: họp HĐQT 3 giờ. — LS Trần')   # khán giả biết Hạ nắm quỹ, Thần không biết (hồi hộp kiểu Hitchcock — người xem ảo 18/10: chỉ đoán Hạ 'có chuyện')

# ── CẢNH 3 · Sảnh thang máy (36–58 s) ──
shot('3.1', C3, 6, 'h3', {'vai': 'tong_the', 'co_canh': 'ws', 'goc': 'ngang', 'chuyen_dong': 'tinh', 'ong_kinh': 'rong', 'anh_sang': 'vien', 'am_thanh': ['nen_phong', 'foley']},
     { 'dien': "Anticipation: Hạ waits at the {Thang máy 1} hugging the {Thùng đồ cá nhân}. Action: Vivian strides in and snatches the {Thẻ nhân viên} off Hạ's neck. Reaction: Hạ turns slowly to face her, the {Thùng đồ cá nhân} still in her arms.", 'huong': 'Vivian walks screen-left toward Hạ; Hạ turns screen-right to face her.','bo_cuc': 'Wide lobby: Hạ holding the {Thùng đồ cá nhân} waits at the {Thang máy 1}; Vivian strides in from the right and snatches the {Thẻ nhân viên} off her neck', 'mo': 'Hạ alone at the elevator', 'ket': 'Vivian holding the snatched {Thẻ nhân viên}, Hạ turned to face her', 'muc_dich': 'nhục lần cuối'},
     'Hạ ôm thùng đồ chờ thang máy; Vivian bước tới giật phắt thẻ nhân viên trên cổ cô', [],
     [bc(VIV, 'dac_y', 'khinh_bi'), bc(HA, 'nhan_nhin', 'nhan_nhin', cam=['vui', 'buon'])],
     {'dat': [180, 40, 160], 'nhin': [-60, 400, 140], 'ong_kinh': 30, 'khung': [HA, VIV], 'nhay': 'Hạ thu dọn đồ rồi ra sảnh (thời gian trôi ngoài khung)',
      'vi_tri': [vt(HA, [-100, 380, 0], 180, huong_den=90, trang_phuc='Sơ mi trắng dính cà phê', do_deo='jade bangle on the left wrist; white staff ID badge on a dark blue lanyard', do_deo_den='jade bangle on the left wrist', dien=['om_thung']), vt(VIV, [260, 150, 0], -60, den=[0, 365, 0], huong_den=-90, **AO_VIV, dien=['mc_sai_buoc@0-0.55', 'giat@0.55-0.8']), vt('Thẻ nhân viên', [-100, 368, 140], 180, den=[10, 360, 120]), vt(HOP, [-100, 362, 95], 180, cam=HA)]},
     [HA, VIV, SANH, 'Thẻ nhân viên', HOP])
# 3.1b THẦN TỰ TAY HẠ NHỤC HẠ (phim ngắn 打脸: người bị vả mặt phải là người đã làm nhục nhân vật chính trên màn) + gài chuỗi hạt lần hai (lướt)
# #12 CHUYỂN CHỦ THỂ: Thần sải bước qua rồi ra khỏi khung, máy không đi theo anh mà dừng trên Hạ ôm thùng đồ — sức nặng câu nói rơi vào người bị nói.
shot('3.1b', C3, 4, 'veo', {'vai': 'hanh_dong', 'co_canh': 'ms', 'goc': 'ngang', 'chuyen_dong': 'chuyen_chu_the', 'ong_kinh': 'chuan', 'anh_sang': 'vien', 'am_thanh': ['nen_phong', 'foley']},
     { 'dien': "Anticipation: the {Thang máy 2} doors part. Action: Lục Thần strides out past Hạ without a glance and speaks to Vivian. Reaction: Vivian bows, smug; Hạ's grip tightens on the {Thùng đồ cá nhân}.", 'huong': 'Thần walks toward camera, drifting screen-right; Hạ and Vivian stay facing each other.','bo_cuc': 'Medium shot: Lục Thần striding out of the {Thang máy 2} toward camera, Vivian at screen-left holding the {Thẻ nhân viên}, Hạ with the {Thùng đồ cá nhân} at the left edge', 'mo': 'Thần mid-stride out of the {Thang máy 2}', 'ket': 'Thần has walked out of frame screen-right; the camera has drifted off him and settled on Hạ, gripping the {Thùng đồ cá nhân}', 'muc_dich': 'Thần tự tay hạ nhục Hạ — gài cho cú vả mặt'},
     'Lục Thần bước ra từ thang máy, lướt qua Hạ không thèm nhìn, ra lệnh cho Vivian', [(THAN, 'không dừng bước, không nhìn Hạ', 'Người ngoài thì đừng đứng chắn thang máy.')],
     [bc(THAN, 'lanh_lung', 'khinh_bi'), bc(VIV, 'khinh_bi', 'khinh_bi'), bc(HA, 'nhan_nhin', 'nhan_nhin', cam=['vui'])],
     {'tay': True, 'dat': [230, 180, 160], 'nhin': [20, 420, 150], 'ong_kinh': 24, 'khung': [THAN, HA], 'chuyen_toi': HA,   # trước mặt Thần (đang nói), cùng hướng máy chủ cảnh 3 (~130°); nhắm lệch trái cho Hạ vào hẳn khung (chỉ một vệt mép thì AI bỏ Hạ — lượt 1)
      'vi_tri': [vt(THAN, [100, 400, 0], 20, den=[310, 310, 0], **AO_THAN, dien=['mc_sai_buoc'], nhay='bước ra từ thang máy — thời gian trôi sau cảnh 2, không nối dáng quay đi ở #9'), vt('Chuỗi hạt ngọc', [100, 400, 90], 0, cam=THAN, deo='cotay_t'), vt(VIV, [0, 365, 0], -90, dien=['cam_truoc']), vt('Thẻ nhân viên', [10, 360, 120], -90, cam=VIV), vt(HA, [-100, 380, 0], 90, dien=['om_thung']), vt(HOP, [-95, 365, 95], 90, cam=HA)]},
     [THAN, HA, VIV, SANH, 'Thẻ nhân viên', HOP, 'Chuỗi hạt ngọc'])
shot('3.2', C3, 5, 'veo', {'vai': 'nguoi_thu_ba', 'co_canh': 'ots', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chan_dung', 'anh_sang': 'vien', 'am_thanh': ['nen_phong']},
     { 'dien': "Anticipation: Vivian holds the {Thẻ nhân viên} up between two fingers. Action: she swings it in front of Hạ's face. Reaction: leans in with a sneer.",'bo_cuc': 'Over Hạ’s right shoulder onto Vivian dangling the {Thẻ nhân viên} in front of Hạ’s face', 'mo': 'Vivian dangling the {Thẻ nhân viên}', 'ket': 'Vivian leaning in, sneering', 'huong': 'Vivian looks screen-left at Hạ', 'muc_dich': 'Vivian tưởng mình thắng'},
     'Vivian lắc lắc tấm thẻ trước mặt Hạ', [(VIV, 'cười khẩy', 'Thẻ của công ty. Loại như cô, đừng mơ bước vào toà nhà này lần nữa.')],
     [bc(VIV, 'khinh_bi', 'dac_y'), bc(HA, 'nhan_nhin', 'nhan_nhin')],
     {'tay': True, 'dat': [-150, 320, 165], 'nhin': [-35, 380, 148], 'ong_kinh': 40, 'khung': [VIV, 'Thẻ nhân viên'],   # sau vai Hạ (mép trái), Vivian ngực trở lên + thẻ trước mặt — máy cũ sát quá, khung toàn tường đen, mất mặt Vivian (#11)
      'vi_tri': [vt(HA, [-100, 380, 0], 90, dien=['om_thung']), vt(VIV, [5, 365, 0], -90, dien=['lac_treo']), vt('Thẻ nhân viên', [10, 360, 120], -90, cam=VIV, treo=4), vt(HOP, [-95, 365, 95], 90, cam=HA)]},   # Vivian chìa tay ngang vai (lac_treo), thẻ TREO 4 cm dưới ngón (12 cm: người MPFB tay ngang vai thì thẻ rơi xuống xuyên vào thùng Hạ ôm, bị thùng che) (dung-set › gan_tay treo) — giơ thẳng lên thì thẻ rủ dọc cánh tay, bị tay che; qua vai PHẢI Hạ, máy lệch ngang + cao hơn đầu: tia tới thẻ lướt cạnh đầu Hạ, thấy MẶT thẻ (thẻ quay về Hạ) — máy sát sau đầu thì đầu che thẻ, máy ngang thì thấy cạnh thẻ (#11); dí trước mặt Hạ ở nửa sau — dí từ khung mở thì đầu Hạ che thẻ (#11)
     [HA, VIV, SANH, 'Thẻ nhân viên', HOP])
shot('3.3', C3, 6, 'veo', {'vai': 'phan_ung', 'co_canh': 'cu', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chan_dung', 'anh_sang': 'vien', 'am_thanh': ['im_lang']},
     { 'dien': "Anticipation: a long silence, Hạ's face still. Action: she speaks quietly, eyes never leaving her. Reaction: a faint smile that does not reach her eyes.",'bo_cuc': 'Reverse close-up on Hạ over Vivian’s shoulder, the {Thùng đồ cá nhân} still hugged against her chest; long silence before she speaks', 'mo': 'Hạ looking straight at Vivian', 'ket': 'Hạ’s faint smile', 'huong': 'Hạ looks screen-right at Vivian', 'muc_dich': 'lời hứa trả đòn'},
     'Hạ nhìn thẳng Vivian, khẽ nhếch môi', [(HA, 'nhìn thẳng, mỉm cười nhẹ', 'Chị nói đúng. Lần sau, tôi sẽ không đi cửa này.')],
     [bc(HA, 'nhan_nhin', 'nhech_moi'), bc(VIV, 'dac_y', 'dac_y')],
     {'tay': True, 'dat': [85, 290, 160], 'nhin': [-100, 382, 152], 'ong_kinh': 50, 'khung': [HA], 'vi_tri': [vt(HA, [-100, 380, 0], 90, dien=['om_thung']), vt(VIV, [0, 365, 0], -90, dien=['cam_truoc']), vt('Thẻ nhân viên', [10, 360, 120], -90, cam=VIV), vt(HOP, [-95, 365, 95], 90, cam=HA)]},   # thùng Hạ vẫn ôm (nối #13) — ẩn mà dáng ôm thùng vẫn dựng thùng thì cổng báo đồ chắn tiền cảnh không ai nhắc; QUA VAI VIVIAN đúng chữ bố cục — máy cũ 85 mm lệch, Vivian ngoài khung mà chữ gọi tên → AI bịa Vivian áo be (#12)
     [HA, VIV, SANH, HOP])
shot('3.4', C3, 5, 'veo', {'vai': 'tam_trang', 'co_canh': 'ms', 'goc': 'thap', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chuan', 'anh_sang': 'vien', 'am_thanh': ['ding', 'foley']},
     { 'dien': "Anticipation: Hạ steps backward into the elevator. Action: the {Thang máy 1} slides shut between them. Reaction: Vivian's smile falters as her reflection appears in the steel.", 'huong': 'Hạ backs away from camera into the elevator; Vivian stays facing her.','bo_cuc': 'Hạ steps into the elevator; the {Thang máy 1} slides shut between her and Vivian', 'mo': 'Hạ stepping back into the elevator', 'ket': 'doors closed, Vivian’s reflection in the steel', 'muc_dich': 'khép một chương'},
     'Hạ lùi vào thang máy, cửa thép khép lại giữa hai người', [],
     [bc(HA, 'nhech_moi', 'quyet_tam'), bc(VIV, 'dac_y', 'ngo_vuc')],
     {'tay': True, 'dat': [-50, 150, 160], 'nhin': [-50, 420, 150], 'ong_kinh': 35, 'khung': [HA, VIV], 'vi_tri': [vt(HA, [-100, 380, 0], 90, den=[-100, 470, 0], huong_den=0, dien=['om_thung']), vt(VIV, [0, 365, 0], -90, dien=['khoanh_tay']), vt('Thẻ nhân viên', [10, 360, 120], -90, cam=VIV, an=True), vt(HOP, [-95, 365, 95], 90, cam=HA, het=True)]},   # Vivian khoanh tay: dáng cầm trước ngực vươn chạm thùng của Hạ → AI vẽ thành cảnh trao thùng (18/10)   # máy đặt tay: bộ giải dời ra hướng 68° (lệch hướng chủ ~125°); máy dọc đường nối hai người thì Vivian (gần máy) che Hạ 81–100% — máy vuông góc đường nối, Hạ trái, Vivian phải
     [HA, VIV, SANH, 'Thẻ nhân viên', HOP])

# ── CẢNH 4 · Phòng họp HĐQT 15:00 (58–79 s) — thời gian nhảy, Hạ đã thay vest trắng ──
AO_HA_CHIEU = {'trang_phuc': 'Vest trắng', 'trang': '', 'do_deo': 'jade bangle on the left wrist'}
shot('4.1', C4, 5, 'veo', {'vai': 'thiet_lap', 'co_canh': 'ws', 'goc': 'cao', 'chuyen_dong': 'truot_ngang', 'ong_kinh': 'rong', 'anh_sang': 'tuong_phan', 'am_thanh': ['nen_phong']},
     { 'dien': 'Anticipation: Thần gestures toward the {Màn trình chiếu}. Action: he presents confidently to the seated board. Reaction: board members nod; Vivian sips with a satisfied look.', 'huong': 'Thần faces the table, gesturing screen-left toward the {Màn trình chiếu}.','bo_cuc': 'Wide boardroom: Lục Thần standing at the head of the table presenting in front of the {Màn trình chiếu}, board members seated along both sides, Vivian standing beside him holding the {Ly cà phê}', 'mo': 'Thần mid-presentation', 'ket': 'board members nodding', 'muc_dich': 'Thần tưởng mọi thứ trong tay'},
     'Lục Thần thuyết trình trước HĐQT, Vivian đứng cạnh cầm ly cà phê đắc ý', [(THAN, 'tự tin', 'Với khoản vốn của Quỹ Harrington, Lục thị sẽ…')],
     [bc(THAN, 'tu_tin', 'tu_tin'), bc(VIV, 'dac_y', 'dac_y')],
     {'dat': [0, 60, 280], 'nhin': [0, 620, 100], 'ong_kinh': 30, 'khung': [THAN], 'nhay': '3 giờ chiều cùng ngày — họp HĐQT',
      'vi_tri': [vt(THAN, [0, 740, 0], 0, **AO_THAN, dien=['thuyet_trinh']), vt(VIV, [110, 745, 0], -20, **AO_VIV, dien=['cam_truoc']), vt('Ly cà phê', [122, 728, 105], 0, cam=VIV)]},
     [THAN, VIV, PH, 'Ly cà phê'])
# #17 VƯỢT TIỀN CẢNH (anh 18/10/2026): máy ngồi sau vai Thành viên HĐQT 2T, nhìn chéo về cửa, trượt ngang 30 % khoảng cách — vai ông lướt qua khung
# trái → phải, Hạ lộ ra như cả phòng vừa ngẩng lên thấy cô. Chéo vì Hạ đi từ cửa tới (-200, 200) (chỗ #18 nối): nhìn dọc đường cô đi thì lúc kết cô sát máy
# ra khỏi khung (lần dựng 1); nhìn chéo thì chỗ vào + chỗ dừng cùng nằm trong khung dọc 24 mm. Lần dựng 2 (máy y 380) vai HĐQT 1T che Hạ lúc kết → lùi máy
# tới y 420; lần 3 lưng ghế cao + người ngồi 1T vẫn che thân Hạ → máy cao 1,7 m nhìn xuống ~10°: đường nhìn đi TRÊN đầu người ngồi. Khuất giữa cú trượt là chủ ý.
shot('4.2', C4, 5, 'h3', {'vai': 'hanh_dong', 'co_canh': 'ws', 'goc': 'ngang', 'chuyen_dong': 'vuot_tien_canh', 'ong_kinh': 'rong', 'anh_sang': 'tuong_phan', 'am_thanh': ['dap', 'foley']},
     { 'dien': 'Anticipation: Hạ holds for a beat in the open doorway. Action: she strides in toward the camera, chin up, the lawyer a step behind. Reaction: her eyes lock on the far end of the table.','bo_cuc': 'From the boardroom table: a seated board member’s shoulder soft and out of focus in the near foreground at screen-left, the {Cửa đôi mở} beyond, Lâm Hạ striding in through the doorway in a white power suit, Lawyer Trần a step behind her; the camera slides sideways so the shoulder sweeps across the frame', 'mo': 'a seated board member’s shoulder blurred in the near foreground screen-left; the {Cửa đôi mở} beyond, Hạ in the doorway mid-stride, Trần a step behind', 'ket': 'Hạ standing at the end of the table', 'huong': 'Hạ walks toward the camera, drifting screen-left toward the table', 'muc_dich': 'đảo ngược hình ảnh: từ trắng bị bẩn → trắng quyền lực'},
     'Cửa đôi mở, Hạ bước vào — vest trắng, tóc buông; luật sư Trần theo sau', [],
     [bc(HA, 'quyet_tam', 'quyet_tam', lat=True, cam=['buon', 'nhuc_nha']), bc(TRAN, 'binh_thuong', 'tu_tin')],
     {'tay': True, 'dat': [-80, 420, 170], 'nhin': [-310, 200, 115], 'ong_kinh': 24, 'khung': [HA, TRAN], 'qua_truc': True, 'them': ['Cửa đôi mở'],   # sau vai HĐQT 1T, nhìn thẳng ô cửa (máy lệch nhìn cánh theo cạnh thì AI vẽ hành lang trơn — #15)   # máy thấp CHÍNH GIỮA ô cửa, ống rộng: thấy mặt trong hai cánh mở hai bên — máy lệch cũ nhìn cánh cửa theo cạnh, AI vẽ hành lang trơn (#15)
      # Trần "sau một bước" lệch NGANG ~50 cm khỏi trục máy — đứng nối đuôi dọc trục thì khung 3D chỉ còn một dáng người, AI vẽ mất Trần (kiem-ai-3d.ts › chongNguoi)
      'vi_tri': [vt(HA, [-470, 160, 0], 90, den=[-200, 200, 0], **AO_HA_CHIEU, nhay='họp HĐQT 3 giờ chiều — đã thay vest trắng', dien=['mc_sai_buoc']), vt(TRAN, [-485, 188, 0], 90, den=[-270, 150, 0], **AO_TRAN, dien=['mc_di_bo'])]},
     [HA, TRAN, PH])
shot('4.3', C4, 4, 'veo', {'vai': 'nguoi_thu_ba', 'co_canh': 'two', 'goc': 'ngang', 'chuyen_dong': 'dolly_zoom', 'ong_kinh': 'chuan', 'anh_sang': 'tuong_phan', 'am_thanh': ['nen_phong']},
     { 'dien': 'Anticipation: Lawyer Trần raises an open hand toward Hạ. Action: he announces her name formally. Reaction: Hạ stands composed while the room murmurs.', 'huong': 'Trần gestures screen-left toward Hạ; both face the table.','bo_cuc': 'Two-shot: Lawyer Trần presents Hạ to the board; Hạ calm beside him', 'mo': 'Trần raising a hand toward Hạ', 'ket': 'board members turning in their chairs', 'muc_dich': 'thân phận lộ ra'},
     'Luật sư Trần giới thiệu Hạ với cả phòng', [(TRAN, 'trang trọng', 'Xin giới thiệu: cô Lâm Hạ, người thừa kế Quỹ Harrington.')],
     [bc(TRAN, 'tu_tin', 'tu_tin'), bc(HA, 'quyet_tam', 'lanh_lung')],
     {'dat': [-235, 30, 150], 'nhin': [-235, 175, 150], 'ong_kinh': 45, 'khung': [HA, TRAN],   # cùng hướng máy chủ cảnh (về phía màn) — HĐQT phía sau họ
      'vi_tri': [vt(HA, [-200, 200, 0], 90, huong_den=160), vt(TRAN, [-270, 150, 0], 90, dien=['gioi_thieu@0-0.3'])]},
     [HA, TRAN, PH])
shot('4.4', C4, 3, 'veo', {'vai': 'chi_tiet', 'co_canh': 'insert', 'goc': 'thap', 'chuyen_dong': 'speed_ramp', 'ong_kinh': 'macro', 'anh_sang': 'tuong_phan', 'am_thanh': ['vo_kinh']},
     { 'dien': "Anticipation: the {Ly cà phê} tumbles in slow motion a hand's width above the carpet, coffee curling out of it. Action: it hits and shatters. Reaction: shards and coffee spray across the dark carpet.", 'huong': 'The {Ly cà phê} falls straight down.','bo_cuc': 'Low slow-motion insert at carpet level: the {Ly cà phê} tumbling just above the dark grey carpet', 'mo': 'the {Ly cà phê} tumbling just above the carpet, coffee spilling out', 'ket': 'porcelain shards and coffee across the carpet', 'muc_dich': 'cú đánh mặt bằng hình'},
     'Ly cà phê trên tay Vivian rơi xuống sàn, vỡ tung', [], [bc(VIV, 'soc', 'soc', cam=['vui', 'dac_y'])],
     {'dat': [60, 690, 10], 'nhin': [124, 708, 10], 'ong_kinh': 100, 'khung': ['Ly cà phê'],   # cầu nối hướng máy giữa #16 (về màn) và #18 (trước mặt Hạ)
      'vi_tri': [vt(VIV, [110, 745, 0], -20, dien=['cam_truoc']), vt('Ly cà phê', [124, 712, 25], 40, nghieng=70, nghieng_den=95, den=[125, 705, 0], trang_den='shattered on the floor', tran='black coffee')]},   # ly LẬT giữa không trung (kiem-ai-3d › datLat) + cà phê đổ ra (dung-set.py › tran_); xoay 40° (máy sát thảm nhìn ngược lên: 0° thấy cạnh, ±80° thấy đáy)
     [VIV, PH, 'Ly cà phê'])
shot('4.5', C4, 5, 'veo', {'vai': 'hanh_dong', 'co_canh': 'mcu', 'goc': 'thap', 'chuyen_dong': 'zoom_cham', 'ong_kinh': 'chan_dung', 'anh_sang': 'tuong_phan', 'am_thanh': ['im_lang']},
     { 'dien': 'Anticipation: Hạ looks down the table at Thần. Action: she states the withdrawal word by word. Reaction: unblinking, she waits.','bo_cuc': 'Low medium close-up on Hạ delivering the line, the board soft behind her', 'mo': 'Hạ looking down the table at Thần', 'ket': 'Hạ unblinking', 'huong': 'Hạ looks screen-left toward Thần', 'muc_dich': 'phán quyết — ngược lại cảnh 2'},
     'Hạ tuyên bố rút vốn, từng chữ', [(HA, 'bình thản, từng chữ', 'Quỹ Harrington rút toàn bộ vốn khỏi Lục thị. Hiệu lực từ bây giờ.')],
     [bc(HA, 'lanh_lung', 'lanh_lung', cam=['vui', 'cuoi_lon'])],
     {'dat': [-260, 330, 120], 'nhin': [-200, 200, 160], 'ong_kinh': 70, 'khung': [HA], 'vi_tri': [vt(HA, [-200, 200, 0], 160), vt(THAN, [0, 740, 0], 0, an=True), vt(TRAN, [-270, 150, 0], 90, an=True)]},
     [HA, PH])   # trung cận Hạ: Thần cuối bàn ngoài khung

# 4.6 PHẢN ỨNG người bị vả mặt qua mắt Hạ (chủ quan — Hạ vừa nói xong, nhìn Vivian sụp đổ). Luật liền mạch / chamDauTu: cú lật phải có shot phản ứng
# của chính người bị lật — anh thêm trên studio 18/10/2026
shot('4.6', C4, 3, 'veo', {'vai': 'phan_ung', 'co_canh': 'cu', 'goc': 'ngang', 'chuyen_dong': 'zoom_gat', 'ong_kinh': 'chan_dung', 'anh_sang': 'tuong_phan', 'am_thanh': ['im_lang']},
     { 'dien': "Anticipation: Vivian's smug smile is still on her face. Action: it freezes, then cracks as Hạ's words land. Reaction: her eyes go wide on Hạ, her empty hand still curled in front of her chest.", 'huong': 'Vivian looks almost straight into the lens — at Hạ.','bo_cuc': 'Close-up on Vivian from Hạ’s point of view, the boardroom soft behind her, her empty curled hand at the bottom edge', 'mo': 'Vivian’s smug smile frozen', 'ket': 'Vivian’s eyes wide, the smile gone', 'muc_dich': 'phản ứng của người bị vả mặt'},
     'Cận mặt Vivian: nụ cười đắc ý đông cứng rồi vỡ ra, mắt mở to nhìn Hạ, bàn tay trống vẫn khum trước ngực', [],
     [bc(VIV, 'dac_y', 'soc')],
     {'tay': True, 'qua_truc': True, 'dat': [36, 615, 150], 'nhin': [110, 745, 133], 'ong_kinh': 85, 'khung': [VIV],   # POV Hạ thật: máy trên đường Vivian→Hạ cách 1,5 m, tầm mắt Hạ — Vivian nhìn gần thẳng ống kính (qua_truc: góc riêng, không kéo hướng máy chủ của cảnh)
      'vi_tri': [vt(VIV, [110, 745, 0], -30, dien=['cam_truoc']), vt(HA, [-200, 200, 0], 160, an=True), vt(THAN, [0, 740, 0], 0, an=True)]},
     [VIV, PH])

# ── CẢNH 5 · liền sau (79–89 s) ──
shot('5.1', C5, 4, 'h3', {'vai': 'phan_ung', 'co_canh': 'ms', 'goc': 'ngang', 'chuyen_dong': 'tinh', 'ong_kinh': 'chuan', 'anh_sang': 'tuong_phan', 'am_thanh': ['tim_dap']},
     { 'dien': "Anticipation: the {Bút ký} stops mid-air in Thần's hand. Action: he drops it, strides to the table corner and slams both palms onto the wood. Reaction: he leans in, breathing hard, staring at Hạ.", 'huong': 'Thần moves screen-left to the table corner and looks screen-left at Hạ.','bo_cuc': 'Lục Thần drops the {Bút ký} and strides to the corner of the table, both palms slamming onto the tabletop', 'mo': 'Thần at the head of the table, the {Bút ký} in hand', 'ket': 'Thần leaning on the table corner, hands flat on the wood', 'muc_dich': 'lần đầu mất thế chủ động'},
     'Lục Thần buông bút, bước tới góc bàn, hai tay chống mạnh xuống mặt bàn', [(THAN, 'lần đầu mất bình tĩnh', 'Cô… rốt cuộc là ai?')],
     [bc(THAN, 'soc', 'gian', lat=True)],
     {'dat': [-100, 470, 160], 'nhin': [-35, 720, 150], 'ong_kinh': 45, 'khung': [THAN], 'vi_tri': [vt(THAN, [0, 740, 0], 0, den=[-40, 715, 0], huong_den=0, dien=['mc_di_bo@0-0.5', 'mc_chong_ghe@0.5-1']), vt('Bút ký', [8, 728, 110], 0, cam=THAN, den=[10, 690, 76])]},   # 'pen in hand' ở khung mở — 3D phải có cây bút trong tay (kiem-ai-3d › thieuVat3d)   # đầu bàn sát góc trái, mặt dọc bàn: hai tay chống đúng mặt gỗ (kiem-ai-3d.ts › tuaHong)
     [THAN, PH])
# #23 CUNG (arc): máy vòng nửa quanh hai người lúc Hạ cúi xuống nói — quyền lực đổi chiều ngay trong một khung (cần keyframe kết: phía bên kia).
shot('5.2', C5, 6, 'veo', {'vai': 'tong_the', 'co_canh': 'two', 'goc': 'ngang', 'chuyen_dong': 'cung', 'ong_kinh': 'chuan', 'anh_sang': 'tuong_phan', 'chuyen_canh': 'mo_cheo', 'am_thanh': ['im_lang', 'cot_ket']},
     { 'dien': 'Anticipation: Hạ walks to the corner and stops close. Action: she leans in to his eye level and says the line softly. Reaction: she straightens and turns away.','bo_cuc': 'Profile two-shot at the table corner: Hạ (screen-left) leans in to Thần’s eye level; the jade bangle on her wrist catches the light', 'mo': 'Hạ arriving at the corner', 'ket': 'Hạ straightening up, turning away from Thần', 'huong': 'Hạ looks screen-right into Thần’s eyes', 'muc_dich': 'cliffhanger', 'motif': 'vòng tay ngọc — ký ức cô bé năm xưa (tập sau)'},
     'Hạ cúi xuống ngang tầm mắt anh, vòng tay ngọc loé sáng', [(HA, 'khẽ, chắc nịch', 'Sếp mới của anh.')],
     [bc(HA, 'lanh_lung', 'nhech_moi'), bc(THAN, 'gian', 'soc')],
     {'dat': [-60, 480, 160], 'nhin': [-70, 705, 150], 'ong_kinh': 35, 'khung': [HA, THAN],   # phía nam chéo về phía Thần: thấy mặt Hạ đang nói (máy sau lưng Hạ → gáy), giữa hai dãy ghế
        # chéo từ phía Hạ — thẳng trục y thì Ghế 4T chắn tiền cảnh
      'vi_tri': [vt(HA, [-170, 640, 0], 90, den=[-100, 700, 0], **AO_HA_CHIEU, nhay='đi tới góc bàn trong lúc Thần đứng dậy (ngoài khung #19)', dien=['cui_nguoi@0.6-0.9']), vt(THAN, [-40, 715, 0], 0, dien=['chong_ban'])]},
     [HA, THAN, PH])
shot('5.3', C5, 3, 'veo', {'vai': 'phan_ung', 'co_canh': 'cu', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'chan_dung', 'anh_sang': 'tuong_phan', 'luat': ['giu_phan_ung', 'khoang_lang'], 'am_thanh': ['im_lang']},
     { 'dien': "Anticipation: Thần stays frozen, palms still on the table. Action: his jaw tightens; his eyes follow Hạ off screen-left. Reaction: the cold mask cracks — a long, stunned breath.", 'huong': 'Thần looks screen-left after Hạ.','bo_cuc': 'Slow push into a close-up of Lục Thần still leaning on the table corner, the boardroom soft and silent behind him', 'mo': 'Thần frozen, leaning on his palms', 'ket': 'Thần staring after Hạ, stunned', 'muc_dich': 'giữ phản ứng — khán giả nếm cú đảo thế'},
     'Lục Thần đứng chết lặng, hai tay vẫn chống trên bàn, mắt dõi theo Hạ', [],
     [bc(THAN, 'soc', 'ngo_vuc')],
     {'tay': True, 'dat': [-135, 630, 140], 'nhin': [-40, 690, 135], 'ong_kinh': 65, 'khung': [THAN],   # Thần chúi chống bàn: đầu lệch về −x, thấp hơn đứng   # từ chỗ Hạ vừa đứng nhìn về Thần — nhìn theo +y thì màn trình chiếu lấp khung
      'vi_tri': [vt(THAN, [-40, 715, 0], 0, dien=['chong_ban']), vt(HA, [-100, 700, 0], 90, an=True)]},
     [THAN, PH])
shot('5.4', C5, 3, 'veo', {'vai': 'chi_tiet', 'co_canh': 'insert', 'goc': 'ngang', 'chuyen_dong': 'day_vao', 'ong_kinh': 'macro', 'anh_sang': 'tuong_phan', 'luat': ['chenh_thong_tin', 'motif'], 'am_thanh': ['im_lang', 'cot_ket']},
     { 'dien': "Anticipation: Thần's left hand flat on the walnut table, the shirt cuff riding up. Action: the camera pushes in on the wrist as the {Chuỗi hạt ngọc} slides into view beside the steel watch. Reaction: hold on the green jade — cut to black.", 'huong': 'Static hand; the camera pushes down onto the wrist.','bo_cuc': 'Insert at wrist height on Lục Thần’s left hand pressed flat on the dark walnut table, forearm upright: the shirt cuff pulled back reveals the {Chuỗi hạt ngọc} around the wrist', 'mo': 'Thần’s left hand flat on the table, the shirt cuff just pulled back off the wrist', 'ket': 'the {Chuỗi hạt ngọc} in full view — cut to black', 'muc_dich': 'móc: khán giả thấy hai người cùng một chất ngọc, nhân vật chưa biết', 'motif': 'ngọc — vòng tay của Hạ (5.2) ↔ chuỗi hạt của Thần (tập sau)'},
     'Cận cổ tay Thần trên mặt bàn: tay áo xô lên, lộ chuỗi hạt ngọc cùng màu với vòng tay của Hạ; cắt đen', [],
     [bc(THAN, 'ngo_vuc', 'ngo_vuc')],
     {'tay': True, 'dat': [-60, 580, 96], 'nhin': [-15, 650, 89], 'ong_kinh': 85, 'khung': ['Chuỗi hạt ngọc', THAN],   # sát mặt bàn từ phía tây nam (cùng phía máy #21), nhắm chuỗi hạt theo toạ độ ĐO (khung_xam.kiem[].tam −15, 650, 91)
      'vi_tri': [vt(THAN, [-40, 715, 0], 0, dien=['chong_ban'], trang_phuc='Com-lê đen ba mảnh', do_deo='steel wristwatch and a thin pale-green jade bead bracelet on the left wrist, shirt cuff pulled back so the bracelet shows', nhay='cận chèn: tay áo đã xô lên lộ chuỗi hạt (giữa #21 và #22)'), vt('Chuỗi hạt ngọc', [-15, 650, 91], 0, cam=THAN, deo='cotay_t')]},   # sổ người: chuỗi hạt LỘ ở shot này (khung 3D thấy nó)   # ĐEO ở cổ tay trái (khớp rig) — không khai deo thì máy nhét vào lòng bàn tay phải
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
