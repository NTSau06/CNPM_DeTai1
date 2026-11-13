// Chuỗi giao diện của ứng dụng di động, đủ 7 ngôn ngữ.
// Thứ tự tham số của t(): vi, en, ja, fr, zh-CN, ko-KR, es. Dùng {tên} để chèn giá trị động.
export type Language = 'vi' | 'en' | 'ja' | 'fr' | 'zh-CN' | 'ko-KR' | 'es'
export type Category = 'landmark' | 'food' | 'craft' | 'rest'

type Entry = Record<Language, string>

const t = (vi: string, en: string, ja: string, fr: string, zh: string, ko: string, es: string): Entry => ({
  vi, en, ja, fr, 'zh-CN': zh, 'ko-KR': ko, es,
})

export const mobileText = {
  // Đầu trang và khung chung
  brand: t('QUẢNG TRỊ', 'QUANG TRI', 'クアンチ', 'QUANG TRI', '广治', '꽝찌', 'QUANG TRI'),
  heroTitle: t('Quảng Trị', 'Quang Tri', 'クアンチ', 'Quang Tri', '广治', '꽝찌', 'Quang Tri'),
  region: t('QUẢNG TRỊ · QUẢNG BÌNH', 'QUANG TRI · QUANG BINH', 'クアンチ・クアンビン', 'QUANG TRI · QUANG BINH', '广治 · 广平', '꽝찌 · 꽝빈', 'QUANG TRI · QUANG BINH'),
  footer: t('MỘT CẨM NANG NHỎ CHO CHUYẾN ĐI CHẬM', 'A SMALL GUIDE TO SLOW TRAVEL', 'ゆっくり旅のための小さなガイド', 'UN PETIT GUIDE DU VOYAGE LENT', '慢旅行小指南', '느린 여행을 위한 작은 안내서', 'UNA PEQUEÑA GUÍA PARA VIAJAR SIN PRISA'),
  narrationLanguage: t('Ngôn ngữ thuyết minh', 'Narration language', '解説の言語', 'Langue de narration', '讲解语言', '해설 언어', 'Idioma de narración'),
  minutes: t('{n} phút', '{n} min', '{n}分', '{n} min', '{n} 分钟', '{n}분', '{n} min'),
  stopsDistance: t('{n} điểm dừng · {km} km', '{n} stops · {km} km', '{n}か所 · {km} km', '{n} étapes · {km} km', '{n} 个地点 · {km} 公里', '{n}곳 · {km} km', '{n} paradas · {km} km'),
  remove: t('Xóa', 'Remove', '削除', 'Supprimer', '删除', '삭제', 'Eliminar'),
  cancel: t('Hủy', 'Cancel', 'キャンセル', 'Annuler', '取消', '취소', 'Cancelar'),
  agree: t('Đồng ý', 'Agree', '同意する', 'Accepter', '同意', '동의', 'Aceptar'),

  // Hướng dẫn GPS và hành trình
  gpsTitle: t('Ghi nhận lượt ghé bằng GPS', 'Record visits with GPS', 'GPSで訪問を記録', 'Enregistrer les visites par GPS', '通过GPS记录到访', 'GPS로 방문 기록', 'Registrar visitas con GPS'),
  gpsBody: t(
    'Khi bật hướng dẫn, ứng dụng gửi vị trí gần điểm dừng để ghi nhận tối đa một lượt ghé ẩn danh cho mỗi thiết bị, mỗi điểm mỗi ngày.',
    'When guidance is on, the app sends your location near a stop to record at most one anonymous visit per device, stop and day.',
    'ガイドをオンにすると、スポット付近での位置情報が送信され、端末・スポット・日ごとに最大1回の匿名訪問として記録されます。',
    'Lorsque le guidage est actif, l’application envoie votre position près d’une étape afin d’enregistrer au plus une visite anonyme par appareil, étape et jour.',
    '开启导览后，应用会在您靠近地点时发送位置，每台设备每个地点每天最多记录一次匿名到访。',
    '안내를 켜면 장소 근처에서 위치가 전송되어 기기·장소·날짜별로 최대 1회의 익명 방문이 기록됩니다.',
    'Con la guía activada, la aplicación envía tu ubicación cerca de una parada para registrar como máximo una visita anónima por dispositivo, parada y día.',
  ),
  visitError: t('Không ghi nhận được lượt ghé. Kiểm tra kết nối máy chủ.', 'Could not record your visit. Check the server connection.', '訪問を記録できませんでした。サーバー接続を確認してください。', 'Visite non enregistrée. Vérifiez la connexion au serveur.', '未能记录到访。请检查服务器连接。', '방문을 기록하지 못했습니다. 서버 연결을 확인하세요.', 'No se pudo registrar la visita. Revisa la conexión con el servidor.'),
  walkUpdated: t('Đã cập nhật hành trình đã lưu.', 'Saved walk updated.', '保存したルートを更新しました。', 'Parcours enregistré mis à jour.', '已更新保存的行程。', '저장한 여정을 업데이트했습니다.', 'Ruta guardada actualizada.'),
  autoSaved: t('Đã tự lưu vào hành trình của bạn.', 'Automatically saved to your walk.', 'ルートに自動保存しました。', 'Enregistré automatiquement dans votre parcours.', '已自动保存到您的行程。', '여정에 자동 저장했습니다.', 'Guardado automáticamente en tu ruta.'),
  tourSaved: t('Đã tự lưu vào hành trình đã lưu.', 'Automatically saved to your saved walks.', '保存したルートに自動保存しました。', 'Enregistré automatiquement dans vos parcours.', '已自动保存到已保存的行程。', '저장한 여정에 자동 저장했습니다.', 'Guardado automáticamente en tus rutas guardadas.'),

  // Thuyết minh ngoại tuyến
  offlineTitle: t('Thuyết minh ngoại tuyến', 'Offline narration', 'オフライン解説', 'Narration hors ligne', '离线讲解', '오프라인 해설', 'Narración sin conexión'),
  offlineHint: t(
    'Lưu lời đọc để nghe khi mất mạng. Giọng đọc dùng TTS đã cài trên thiết bị, không phải tệp MP3.',
    'Save narration for offline listening. Speech uses a voice installed on your device, not an MP3 file.',
    '解説を保存すると通信がなくても聴けます。読み上げは端末にインストールされた音声で行われ、MP3ファイルではありません。',
    'Enregistrez la narration pour l’écouter hors ligne. La voix est celle installée sur l’appareil, pas un fichier MP3.',
    '保存讲解以便离线收听。语音使用设备上安装的TTS，并非MP3文件。',
    '해설을 저장하면 오프라인에서도 들을 수 있습니다. 음성은 기기에 설치된 TTS를 사용하며 MP3 파일이 아닙니다.',
    'Guarda la narración para escucharla sin conexión. Se usa una voz instalada en el dispositivo, no un archivo MP3.',
  ),
  offlineRemove: t('Gỡ gói ngoại tuyến', 'Remove offline package', 'オフラインパッケージを削除', 'Supprimer le paquet hors ligne', '删除离线包', '오프라인 패키지 삭제', 'Eliminar paquete sin conexión'),
  offlineSave: t('Lưu lời đọc ngoại tuyến', 'Save offline narration', 'オフライン用に解説を保存', 'Enregistrer la narration hors ligne', '保存离线讲解', '오프라인 해설 저장', 'Guardar narración sin conexión'),
  offlineRemoved: t('Đã gỡ lời thuyết minh ngoại tuyến.', 'Offline narration removed.', 'オフライン用の解説を削除しました。', 'Narration hors ligne supprimée.', '已删除离线讲解。', '오프라인 해설을 삭제했습니다.', 'Narración sin conexión eliminada.'),
  offlineSaved: t('Đã lưu lời thuyết minh để dùng ngoại tuyến.', 'Narration saved for offline use.', 'オフライン用に解説を保存しました。', 'Narration enregistrée pour une écoute hors ligne.', '讲解已保存，可离线使用。', '오프라인용 해설을 저장했습니다.', 'Narración guardada para usarla sin conexión.'),

  // Gợi ý ứng xử tại Thành cổ
  ritualTitle: t('Gợi ý ứng xử theo thời điểm', 'Respectful visit suggestions', '時間帯別の参拝マナー', 'Conseils de visite selon l’heure', '分时段参观礼仪', '시간대별 관람 예절', 'Sugerencias de visita según la hora'),
  ritualMorning: t('Buổi sáng: dành thời gian đọc thông tin tại di tích, đi nhẹ và giữ không gian yên tĩnh.', 'Morning: read the site information, walk quietly, and keep the space peaceful.', '朝：史跡の案内をゆっくり読み、静かに歩いて落ち着いた雰囲気を保ちましょう。', 'Matin : prenez le temps de lire les informations du site, marchez calmement et préservez le silence.', '上午：请花时间阅读遗址介绍，轻声慢行，保持环境安静。', '오전: 유적 안내문을 천천히 읽고 조용히 걸으며 차분한 분위기를 지켜 주세요.', 'Mañana: tómate tiempo para leer la información del sitio, camina en silencio y mantén la calma del lugar.'),
  ritualAfternoon: t('Buổi chiều: tham quan theo lối quy định, tránh làm ảnh hưởng người đang tưởng niệm.', 'Afternoon: follow marked paths and avoid disturbing people paying their respects.', '午後：指定の順路に沿って見学し、追悼している人の妨げにならないようにしましょう。', 'Après-midi : suivez les chemins balisés et ne dérangez pas les personnes qui se recueillent.', '下午：请沿规定路线参观，避免打扰正在悼念的人。', '오후: 지정된 관람로를 따르고 추모 중인 사람들을 방해하지 마세요.', 'Tarde: sigue los caminos señalizados y no molestes a quienes rinden homenaje.'),
  ritualEvening: t('Buổi tối: nếu di tích còn mở cửa, giữ thái độ trang nghiêm và làm theo hướng dẫn tại chỗ.', 'Evening: if the site is open, remain respectful and follow on-site guidance.', '夜：開場している場合は厳粛な態度を保ち、現地の案内に従いましょう。', 'Soir : si le site est ouvert, restez respectueux et suivez les consignes sur place.', '晚上：如遗址仍开放，请保持庄重并遵从现场指引。', '저녁: 유적지가 개방되어 있다면 엄숙한 태도를 유지하고 현장 안내를 따르세요.', 'Noche: si el sitio está abierto, mantén una actitud respetuosa y sigue las indicaciones del lugar.'),
  ritualNote: t('Đây là gợi ý chung, không phải lịch tổ chức nghi lễ. Hãy xác nhận giờ mở cửa và sự kiện với đơn vị quản lý.', 'General etiquette only, not a ceremony schedule. Confirm opening hours and events with the site operator.', '一般的なマナーの目安であり、式典の予定表ではありません。開場時間や行事は管理者にご確認ください。', 'Conseils généraux, pas un programme de cérémonies. Vérifiez les horaires et les événements auprès du gestionnaire du site.', '以上为一般礼仪建议，并非仪式日程。开放时间和活动请向管理单位确认。', '일반적인 예절 안내이며 의식 일정이 아닙니다. 개방 시간과 행사는 관리 기관에 확인하세요.', 'Solo es una guía de etiqueta general, no un calendario de ceremonias. Confirma horarios y eventos con el gestor del sitio.'),

  // Tài khoản
  account: t('Tài khoản', 'Account', 'アカウント', 'Compte', '账户', '계정', 'Cuenta'),
  signIn: t('Đăng nhập', 'Sign in', 'ログイン', 'Se connecter', '登录', '로그인', 'Iniciar sesión'),
  signOut: t('Đăng xuất', 'Sign out', 'ログアウト', 'Se déconnecter', '退出登录', '로그아웃', 'Cerrar sesión'),
  createAccount: t('Tạo tài khoản', 'Create account', 'アカウント作成', 'Créer un compte', '创建账户', '계정 만들기', 'Crear cuenta'),
  signInToAdd: t('Đăng nhập để thêm hành trình', 'Sign in to add a walk', 'ログインしてルートに追加', 'Connectez-vous pour ajouter un parcours', '登录以添加行程', '로그인하고 여정에 추가', 'Inicia sesión para añadir una ruta'),
  fullName: t('Họ và tên', 'Full name', '氏名', 'Nom complet', '姓名', '이름', 'Nombre completo'),
  passwordPh: t('Mật khẩu (ít nhất 8 ký tự)', 'Password (at least 8 characters)', 'パスワード（8文字以上）', 'Mot de passe (8 caractères minimum)', '密码（至少8个字符）', '비밀번호 (8자 이상)', 'Contraseña (mínimo 8 caracteres)'),
  confirmPassword: t('Xác nhận mật khẩu', 'Confirm password', 'パスワード（確認）', 'Confirmer le mot de passe', '确认密码', '비밀번호 확인', 'Confirmar contraseña'),
  processing: t('Đang xử lý…', 'Please wait…', '処理中…', 'Veuillez patienter…', '正在处理…', '처리 중…', 'Espera un momento…'),
  haveAccount: t('Đã có tài khoản? Đăng nhập', 'Already registered? Sign in', 'アカウントをお持ちの方はログイン', 'Déjà inscrit ? Connectez-vous', '已有账户？登录', '이미 계정이 있나요? 로그인', '¿Ya tienes cuenta? Inicia sesión'),
  noAccount: t('Chưa có tài khoản? Đăng ký', 'New here? Create an account', '初めての方はアカウント作成', 'Nouveau ? Créez un compte', '还没有账户？注册', '처음이신가요? 계정 만들기', '¿Eres nuevo? Crea una cuenta'),
  nameRequired: t('Vui lòng nhập họ và tên.', 'Enter your name.', '氏名を入力してください。', 'Saisissez votre nom.', '请输入姓名。', '이름을 입력하세요.', 'Introduce tu nombre.'),
  pwShort: t('Mật khẩu cần có ít nhất 8 ký tự.', 'Password must be at least 8 characters.', 'パスワードは8文字以上にしてください。', 'Le mot de passe doit contenir au moins 8 caractères.', '密码至少需要8个字符。', '비밀번호는 8자 이상이어야 합니다.', 'La contraseña debe tener al menos 8 caracteres.'),
  pwMismatch: t('Mật khẩu xác nhận chưa khớp.', 'Passwords do not match.', '確認用パスワードが一致しません。', 'Les mots de passe ne correspondent pas.', '两次输入的密码不一致。', '비밀번호 확인이 일치하지 않습니다.', 'Las contraseñas no coinciden.'),
  authFailed: t('Không đăng nhập được. Hãy kiểm tra email, mật khẩu và kết nối.', 'Could not sign in. Check your email, password and connection.', 'ログインできませんでした。メールアドレス、パスワード、接続を確認してください。', 'Connexion impossible. Vérifiez votre e-mail, votre mot de passe et votre connexion.', '无法登录。请检查邮箱、密码和网络连接。', '로그인하지 못했습니다. 이메일, 비밀번호, 연결을 확인하세요.', 'No se pudo iniciar sesión. Revisa el correo, la contraseña y la conexión.'),

  // Thẻ thông tin và đánh giá địa điểm
  piKicker: t('THÔNG TIN ĐỊA ĐIỂM', 'PLACE INFORMATION', 'スポット情報', 'INFORMATIONS SUR LE LIEU', '地点信息', '장소 정보', 'INFORMACIÓN DEL LUGAR'),
  piVisitsLabel: t('Lượt ghé app · 30 ngày', 'App visits · 30 days', 'アプリ訪問数・30日間', 'Visites via l’app · 30 jours', '应用到访 · 30天', '앱 방문 · 30일', 'Visitas en la app · 30 días'),
  piRating: t('Đánh giá', 'Rating', '評価', 'Note', '评分', '평점', 'Valoración'),
  piRatingCount: t('{n} lượt đánh giá', '{n} ratings', '評価{n}件', '{n} avis', '{n} 条评价', '평가 {n}건', '{n} valoraciones'),
  piVisitsNote: t(
    'Lượt ghé chỉ tính người dùng bật GPS trong ứng dụng; tối đa một lượt/thiết bị/điểm/ngày, không phải tổng khách thực tế.',
    'Visits only count app users with GPS on; at most one per device, place and day, not the real total number of visitors.',
    '訪問数はアプリでGPSをオンにした利用者のみを数え、端末・スポット・日ごとに最大1回です。実際の来訪者総数ではありません。',
    'Seuls les utilisateurs ayant activé le GPS sont comptés, au plus une visite par appareil, lieu et jour ; ce n’est pas le nombre réel de visiteurs.',
    '到访数仅统计在应用中开启GPS的用户，每台设备每个地点每天最多一次，并非实际游客总数。',
    '방문 수는 앱에서 GPS를 켠 사용자만 집계하며 기기·장소·날짜별 최대 1회입니다. 실제 방문객 총수가 아닙니다.',
    'Solo cuenta a quienes activan el GPS en la app, como máximo una visita por dispositivo, lugar y día; no es el total real de visitantes.',
  ),
  piShare: t('Chia sẻ đánh giá', 'Share your rating', '評価をシェア', 'Donnez votre avis', '分享评价', '평가 남기기', 'Comparte tu valoración'),
  piStars: t('{n} sao', '{n} stars', '星{n}つ', '{n} étoiles', '{n} 星', '별 {n}개', '{n} estrellas'),
  piReviewPh: t('Nhận xét (không bắt buộc)', 'Review (optional)', 'レビュー（任意）', 'Commentaire (facultatif)', '评论（可选）', '리뷰 (선택)', 'Reseña (opcional)'),
  piSending: t('Đang gửi…', 'Sending…', '送信中…', 'Envoi…', '正在发送…', '보내는 중…', 'Enviando…'),
  piSubmit: t('Gửi đánh giá', 'Submit rating', '評価を送信', 'Envoyer l’avis', '提交评价', '평가 보내기', 'Enviar valoración'),
  piPrivacy: t('Mỗi mã thiết bị có thể cập nhật một đánh giá/địa điểm; đánh giá chưa xác minh danh tính.', 'Each device ID can update one rating per place; ratings are not identity-verified.', '端末IDごとに1スポットにつき1件の評価を更新できます。評価は本人確認されていません。', 'Chaque identifiant d’appareil peut mettre à jour un avis par lieu ; les avis ne sont pas vérifiés.', '每个设备ID对每个地点可更新一条评价；评价未经身份验证。', '기기 ID마다 장소별로 평가 1건을 수정할 수 있으며, 평가는 본인 인증되지 않습니다.', 'Cada ID de dispositivo puede actualizar una valoración por lugar; no se verifica la identidad.'),
  piVisitsError: t('Chưa tải được lượt ghé. Kiểm tra kết nối máy chủ.', 'Could not load visits. Check the server connection.', '訪問数を読み込めませんでした。サーバー接続を確認してください。', 'Impossible de charger les visites. Vérifiez la connexion au serveur.', '无法加载到访数据。请检查服务器连接。', '방문 수를 불러오지 못했습니다. 서버 연결을 확인하세요.', 'No se pudieron cargar las visitas. Revisa la conexión con el servidor.'),
  piRatingsError: t('Chưa tải được đánh giá. Kiểm tra kết nối máy chủ.', 'Could not load ratings. Check the server connection.', '評価を読み込めませんでした。サーバー接続を確認してください。', 'Impossible de charger les avis. Vérifiez la connexion au serveur.', '无法加载评价。请检查服务器连接。', '평가를 불러오지 못했습니다. 서버 연결을 확인하세요.', 'No se pudieron cargar las valoraciones. Revisa la conexión con el servidor.'),
  piThanks: t('Cảm ơn bạn đã đánh giá.', 'Thank you for your rating.', '評価ありがとうございました。', 'Merci pour votre avis.', '感谢您的评价。', '평가해 주셔서 감사합니다.', 'Gracias por tu valoración.'),
  piSendError: t('Không gửi được đánh giá.', 'Could not send your rating.', '評価を送信できませんでした。', 'Impossible d’envoyer votre avis.', '评价发送失败。', '평가를 보내지 못했습니다.', 'No se pudo enviar la valoración.'),
} satisfies Record<string, Entry>

export type MobileTextKey = keyof typeof mobileText

/** Lấy chuỗi giao diện theo ngôn ngữ, thay {tên} bằng giá trị trong vars; thiếu bản dịch thì dùng tiếng Việt. */
export function mt(language: Language, key: MobileTextKey, vars?: Record<string, string | number>): string {
  const template = mobileText[key][language] || mobileText[key].vi
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

export const categoryLabels: Record<Language, Record<Category, string>> = {
  vi: { landmark: 'Di sản', food: 'Ẩm thực', craft: 'Đời sống bản địa', rest: 'Góc nghỉ chân' },
  en: { landmark: 'Heritage', food: 'Food', craft: 'Local life', rest: 'Slow moments' },
  ja: { landmark: '歴史', food: '食文化', craft: '地域の暮らし', rest: 'ひと休み' },
  fr: { landmark: 'Patrimoine', food: 'Cuisine', craft: 'Vie locale', rest: 'Pause douce' },
  'zh-CN': { landmark: '文化遗产', food: '美食', craft: '当地生活', rest: '休憩之处' },
  'ko-KR': { landmark: '문화유산', food: '음식', craft: '현지 생활', rest: '휴식 장소' },
  es: { landmark: 'Patrimonio', food: 'Gastronomía', craft: 'Vida local', rest: 'Pausa' },
}

const locales: Record<Language, string> = {
  vi: 'vi-VN', en: 'en-US', ja: 'ja-JP', fr: 'fr-FR', 'zh-CN': 'zh-CN', 'ko-KR': 'ko-KR', es: 'es-ES',
}

/** Mã locale BCP 47 dùng để định dạng số theo ngôn ngữ đang chọn. */
export const localeOf = (language: Language) => locales[language]
