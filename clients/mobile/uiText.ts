// Chuỗi giao diện của ứng dụng di động, đủ 7 ngôn ngữ.
// Thứ tự tham số của t(): vi, en, ja, fr, zh-CN, ko-KR, es. Dùng {tên} để chèn giá trị động.
export type Language = 'vi' | 'en' | 'ja' | 'fr' | 'zh-CN' | 'ko-KR' | 'es'
export type Category = 'landmark' | 'food' | 'craft' | 'rest'

type Entry = Record<Language, string>

const t = (vi: string, en: string, ja: string, fr: string, zh: string, ko: string, es: string): Entry => ({
  vi, en, ja, fr, 'zh-CN': zh, 'ko-KR': ko, es,
})

export const mobileText = {
  routeOffline: t('Cần kết nối mạng để thay đổi hành trình', 'Connect to the internet to change your itinerary', '旅程を変更するにはインターネットに接続してください', 'Connectez-vous pour modifier votre parcours', '请连接网络以修改行程', '여정을 변경하려면 인터넷에 연결하세요', 'Conéctate para modificar tu itinerario'),
  gpsLocating: t('Đang xác định vị trí…', 'Finding your location…', '現在地を取得中…', 'Localisation en cours…', '正在定位…', '현재 위치 확인 중…', 'Buscando tu ubicación…'),
  gpsDenied: t('Bạn đã từ chối quyền vị trí, chế độ hướng dẫn tự động đã tắt', 'Location permission denied; automatic guidance is off', '位置情報へのアクセスが拒否されたため、自動ガイドはオフになっています', 'Position refusée ; le guidage automatique est désactivé', '位置权限被拒绝，自动导览已关闭', '위치 권한이 거부되어 자동 안내가 꺼졌습니다', 'Permiso de ubicación denegado; guía automática desactivada'),
  voiceFallback: t('Thiết bị chưa có giọng {name}, đang đọc bằng tiếng Việt.', 'No {name} voice installed; reading in Vietnamese.', '{name}の音声がないため、ベトナム語で読み上げます。', 'Voix {name} absente ; lecture en vietnamien.', '未安装{name}语音，将使用越南语朗读。', '{name} 음성이 설치되어 있지 않아 베트남어로 읽습니다.', 'No hay voz de {name}; se leerá en vietnamita.'),
  voiceMissing: t('Thiết bị chưa có giọng đọc phù hợp. Hãy cài giọng đọc trong cài đặt hệ thống.', 'No suitable voice. Install a voice in system settings.', '対応する音声がありません。システム設定で音声をインストールしてください。', 'Aucune voix adaptée. Installez une voix dans les paramètres système.', '没有合适的语音。请在系统设置中安装语音。', '적합한 음성이 없습니다. 시스템 설정에서 음성을 설치하세요.', 'No hay voz compatible. Instala una en los ajustes del sistema.'),
  saveSuggestion: t('Lưu lịch trình này vào hành trình', 'Save this suggested itinerary', '提案された旅程を保存', 'Enregistrer ce parcours suggéré', '保存此推荐行程', '추천 일정 저장', 'Guardar este itinerario sugerido'),
  replaceRoute: t('Thay thế hành trình hiện tại', 'Replace current itinerary', '現在の旅程を置き換える', 'Remplacer le parcours actuel', '替换当前行程', '현재 여정 바꾸기', 'Reemplazar itinerario actual'),
  newRoute: t('Lưu thành hành trình mới', 'Save as a new itinerary', '新しい旅程として保存', 'Enregistrer un nouveau parcours', '另存为新行程', '새 여정으로 저장', 'Guardar como nuevo itinerario'),
  suggestionSaved: t('Đã lưu lịch trình.', 'Itinerary saved.', '旅程を保存しました。', 'Parcours enregistré.', '行程已保存。', '일정이 저장되었습니다.', 'Itinerario guardado.'),
  suggestionFailed: t('Không lưu được lịch trình. Vui lòng thử lại.', 'Could not save. Please retry.', '保存できませんでした。もう一度お試しください。', 'Enregistrement impossible. Réessayez.', '无法保存，请重试。', '저장하지 못했습니다. 다시 시도하세요.', 'No se pudo guardar. Inténtalo de nuevo.'),

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
  emailInvalid: t('Địa chỉ email không hợp lệ (ví dụ: ten@domain.com).', 'Enter a valid email address (for example: name@domain.com).', '有効なメールアドレスを入力してください（例: name@domain.com）。', 'Saisissez un e-mail valide (ex. : nom@domaine.com).', '请输入有效的电子邮箱（例如：name@domain.com）。', '올바른 이메일 주소를 입력하세요(예: name@domain.com).', 'Introduce un correo válido (ej.: nombre@dominio.com).'),
  emailTaken: t('Email này đã được sử dụng bởi tài khoản khác.', 'This email is already used by another account.', 'このメールアドレスは別のアカウントで使用されています。', 'Cet e-mail est déjà utilisé par un autre compte.', '该邮箱已被其他账户使用。', '이 이메일은 다른 계정에서 이미 사용 중입니다.', 'Este correo ya está en uso por otra cuenta.'),
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
  piPrivacy: t('Mỗi tài khoản có một đánh giá cho mỗi địa điểm và có thể sửa lại.', 'Each account has one rating per place and can edit it.', '1アカウントにつき1スポット1件の評価で、編集できます。', 'Un avis par compte et par lieu, modifiable.', '每个账户对每个地点一条评价，可修改。', '계정마다 장소별 평가 1건이며 수정할 수 있습니다.', 'Una valoración por cuenta y lugar; se puede editar.'),
  piVisitsError: t('Chưa tải được lượt ghé. Kiểm tra kết nối máy chủ.', 'Could not load visits. Check the server connection.', '訪問数を読み込めませんでした。サーバー接続を確認してください。', 'Impossible de charger les visites. Vérifiez la connexion au serveur.', '无法加载到访数据。请检查服务器连接。', '방문 수를 불러오지 못했습니다. 서버 연결을 확인하세요.', 'No se pudieron cargar las visitas. Revisa la conexión con el servidor.'),
  piRatingsError: t('Chưa tải được đánh giá. Kiểm tra kết nối máy chủ.', 'Could not load ratings. Check the server connection.', '評価を読み込めませんでした。サーバー接続を確認してください。', 'Impossible de charger les avis. Vérifiez la connexion au serveur.', '无法加载评价。请检查服务器连接。', '평가를 불러오지 못했습니다. 서버 연결을 확인하세요.', 'No se pudieron cargar las valoraciones. Revisa la conexión con el servidor.'),
  piThanks: t('Cảm ơn bạn đã đánh giá.', 'Thank you for your rating.', '評価ありがとうございました。', 'Merci pour votre avis.', '感谢您的评价。', '평가해 주셔서 감사합니다.', 'Gracias por tu valoración.'),
  piSendError: t('Không gửi được đánh giá.', 'Could not send your rating.', '評価を送信できませんでした。', 'Impossible d’envoyer votre avis.', '评价发送失败。', '평가를 보내지 못했습니다.', 'No se pudo enviar la valoración.'),
  piSignIn: t('Đăng nhập để đánh giá', 'Sign in to rate', 'ログインして評価', 'Connectez-vous pour noter', '登录后评价', '로그인 후 평가', 'Inicia sesión para valorar'),
  piEditing: t('Bạn đã đánh giá nơi này. Gửi lại để cập nhật.', 'You rated this place. Submit again to update.', '評価済みです。再送信で更新されます。', 'Déjà noté. Renvoyez pour mettre à jour.', '您已评价，再次提交即可更新。', '이미 평가했습니다. 다시 보내면 수정됩니다.', 'Ya lo valoraste. Envía de nuevo para actualizar.'),

  // Vé tham quan
  tkTitle: t('Vé tham quan', 'Admission tickets', '入場チケット', 'Billets d’entrée', '门票', '입장권', 'Entradas'),
  tkPrice: t('Giá {price}/vé', '{price} per ticket', '1枚 {price}', '{price} / billet', '每张 {price}', '1매 {price}', '{price} por entrada'),
  tkNotOnSale: t('Địa điểm chưa mở bán vé.', 'Tickets are not on sale here yet.', 'まだ販売されていません。', 'Billets pas encore en vente.', '暂未开售门票。', '아직 판매하지 않습니다.', 'Aún no hay entradas a la venta.'),
  tkBook: t('Đặt {n} vé · {total}', 'Book {n} · {total}', '{n}枚予約 · {total}', 'Réserver {n} · {total}', '预订{n}张 · {total}', '{n}매 예약 · {total}', 'Reservar {n} · {total}'),
  tkBooking: t('Đang đặt…', 'Booking…', '予約中…', 'Réservation…', '正在预订…', '예약 중…', 'Reservando…'),
  tkSignIn: t('Đăng nhập để đặt vé', 'Sign in to book tickets', 'ログインして予約', 'Connectez-vous pour réserver', '登录后预订', '로그인 후 예약', 'Inicia sesión para reservar'),
  tkSuccess: t('Đã đặt {n} vé, mã {code}.', 'Booked {n} tickets, code {code}.', '{n}枚予約しました。番号 {code}。', '{n} billet(s) réservé(s), code {code}.', '已预订{n}张，票号 {code}。', '{n}매 예약 완료, 번호 {code}.', '{n} entradas reservadas, código {code}.'),
  tkError: t('Không đặt được vé.', 'Could not book tickets.', '予約できませんでした。', 'Réservation impossible.', '无法预订。', '예약하지 못했습니다.', 'No se pudo reservar.'),
  tkNote: t('Giá minh họa để thử nghiệm, chưa thu tiền trực tuyến.', 'Sample prices for testing; no online payment.', 'テスト用の価格で、オンライン決済はありません。', 'Tarifs de test ; aucun paiement en ligne.', '测试用示例价格，不在线收费。', '테스트용 가격이며 온라인 결제는 없습니다.', 'Precios de prueba; sin pago en línea.'),
  tkMine: t('Vé đã đặt', 'My tickets', '予約したチケット', 'Mes billets', '已订门票', '예약한 입장권', 'Mis entradas'),
  tkNone: t('Bạn chưa đặt vé nào.', 'No tickets booked yet.', 'まだ予約はありません。', 'Aucun billet réservé.', '还没有预订门票。', '예약한 입장권이 없습니다.', 'Aún no has reservado entradas.'),
  tkCancel: t('Hủy vé', 'Cancel', 'キャンセル', 'Annuler', '取消', '취소', 'Cancelar'),
  tkCancelAsk: t('Hủy đơn {n} vé này?', 'Cancel this order of {n} tickets?', '{n}枚の予約をキャンセルしますか？', 'Annuler cette commande de {n} billet(s) ?', '取消这笔{n}张门票的订单？', '{n}매 예약을 취소할까요?', '¿Cancelar este pedido de {n} entradas?'),
  tkCancelled: t('Đã hủy', 'Cancelled', 'キャンセル済み', 'Annulé', '已取消', '취소됨', 'Cancelada'),
  tkCancelError: t('Không hủy được đơn vé.', 'Could not cancel the order.', 'キャンセルできませんでした。', 'Annulation impossible.', '无法取消订单。', '예약을 취소하지 못했습니다.', 'No se pudo cancelar.'),

  tkPendingNote: t('Đã tạo đơn {code} ({n} vé), đang chờ thanh toán. Hãy hoàn tất thanh toán trên web trong 15 phút.', 'Order {code} ({n} tickets) created and awaiting payment. Complete payment on the web within 15 minutes.', '注文 {code}（{n}枚）を作成しました。15分以内にWebで支払いを完了してください。', 'Commande {code} ({n} billets) créée, en attente de paiement. Payez sur le web sous 15 minutes.', '已创建订单 {code}（{n}张），待支付。请在15分钟内于网页完成支付。', '주문 {code}({n}매)이 생성되어 결제를 기다립니다. 15분 안에 웹에서 결제를 완료하세요.', 'Pedido {code} ({n} entradas) creado, pendiente de pago. Completa el pago en la web en 15 minutos.'),
  tkStatusPending: t('Chờ thanh toán', 'Awaiting payment', '支払い待ち', 'En attente de paiement', '待支付', '결제 대기', 'Pendiente de pago'),
  tkStatusPaid: t('Đã thanh toán', 'Paid', '支払い済み', 'Payé', '已支付', '결제 완료', 'Pagado'),
  tkStatusExpired: t('Hết hạn thanh toán', 'Payment expired', '支払い期限切れ', 'Paiement expiré', '支付已过期', '결제 기한 만료', 'Pago vencido'),

  // Tài khoản
  acTitle: t('Tài khoản của bạn', 'Your account', 'アカウント', 'Votre compte', '我的账户', '내 계정', 'Tu cuenta'),
  acProfile: t('Hồ sơ', 'Profile', 'プロフィール', 'Profil', '个人资料', '프로필', 'Perfil'),
  acPhone: t('Số điện thoại', 'Phone', '電話番号', 'Téléphone', '电话', '전화번호', 'Teléfono'),
  acAddress: t('Địa chỉ', 'Address', '住所', 'Adresse', '地址', '주소', 'Dirección'),
  acBirthDate: t('Ngày sinh (YYYY-MM-DD)', 'Birth date (YYYY-MM-DD)', '生年月日 (YYYY-MM-DD)', 'Date de naissance (AAAA-MM-JJ)', '出生日期 (YYYY-MM-DD)', '생년월일 (YYYY-MM-DD)', 'Fecha de nacimiento (AAAA-MM-DD)'),
  acSave: t('Lưu hồ sơ', 'Save profile', 'プロフィールを保存', 'Enregistrer', '保存资料', '프로필 저장', 'Guardar perfil'),
  acSaved: t('Đã lưu hồ sơ.', 'Profile saved.', '保存しました。', 'Profil enregistré.', '资料已保存。', '저장했습니다.', 'Perfil guardado.'),
  acSaveError: t('Không lưu được hồ sơ.', 'Could not save the profile.', '保存できませんでした。', 'Enregistrement impossible.', '无法保存资料。', '저장하지 못했습니다.', 'No se pudo guardar.'),
  acBirthInvalid: t('Ngày sinh phải có dạng YYYY-MM-DD.', 'Birth date must be YYYY-MM-DD.', '生年月日は YYYY-MM-DD 形式で入力してください。', 'Format attendu : AAAA-MM-JJ.', '出生日期格式应为 YYYY-MM-DD。', '생년월일은 YYYY-MM-DD 형식이어야 합니다.', 'Formato: AAAA-MM-DD.'),
  acPassword: t('Đổi mật khẩu', 'Change password', 'パスワード変更', 'Changer le mot de passe', '修改密码', '비밀번호 변경', 'Cambiar contraseña'),
  acCurrentPw: t('Mật khẩu hiện tại', 'Current password', '現在のパスワード', 'Mot de passe actuel', '当前密码', '현재 비밀번호', 'Contraseña actual'),
  acNewPw: t('Mật khẩu mới (ít nhất 8 ký tự)', 'New password (min. 8 characters)', '新しいパスワード（8文字以上）', 'Nouveau mot de passe (8 caractères min.)', '新密码（至少8位）', '새 비밀번호 (8자 이상)', 'Nueva contraseña (mín. 8)'),
  acPwChanged: t('Đã đổi mật khẩu.', 'Password changed.', 'パスワードを変更しました。', 'Mot de passe modifié.', '密码已修改。', '비밀번호를 변경했습니다.', 'Contraseña cambiada.'),
  acPwWrong: t('Mật khẩu hiện tại không đúng.', 'The current password is incorrect.', '現在のパスワードが違います。', 'Mot de passe actuel incorrect.', '当前密码不正确。', '현재 비밀번호가 올바르지 않습니다.', 'La contraseña actual es incorrecta.'),
  acPwError: t('Không đổi được mật khẩu.', 'Could not change the password.', '変更できませんでした。', 'Modification impossible.', '无法修改密码。', '비밀번호를 변경하지 못했습니다.', 'No se pudo cambiar.'),
  acDelete: t('Xóa tài khoản', 'Delete account', 'アカウントを削除', 'Supprimer le compte', '删除账户', '계정 삭제', 'Eliminar cuenta'),
  acDeleteHint: t('Xóa vĩnh viễn tài khoản, hành trình và vé đã đặt. Nhập mật khẩu hiện tại để xác nhận.', 'Permanently delete your account, itineraries and tickets. Enter your current password to confirm.', 'アカウント・旅程・チケットを完全に削除します。現在のパスワードを入力してください。', 'Supprime définitivement compte, parcours et billets. Saisissez votre mot de passe.', '将永久删除账户、行程和门票。请输入当前密码确认。', '계정, 여정, 입장권이 영구 삭제됩니다. 현재 비밀번호를 입력하세요.', 'Elimina para siempre cuenta, itinerarios y entradas. Introduce tu contraseña.'),
  acDeleteAsk: t('Xóa tài khoản? Thao tác không thể hoàn tác.', 'Delete your account? This cannot be undone.', 'アカウントを削除しますか？元に戻せません。', 'Supprimer le compte ? Action irréversible.', '删除账户？此操作无法撤销。', '계정을 삭제할까요? 되돌릴 수 없습니다.', '¿Eliminar la cuenta? No se puede deshacer.'),
  acDeleteError: t('Không xóa được tài khoản.', 'Could not delete the account.', '削除できませんでした。', 'Suppression impossible.', '无法删除账户。', '계정을 삭제하지 못했습니다.', 'No se pudo eliminar.'),
  acTooMany: t('Nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.', 'Too many failed attempts. Try again in a few minutes.', '失敗が多すぎます。数分後にお試しください。', 'Trop de tentatives. Réessayez dans quelques minutes.', '失败次数过多，请几分钟后再试。', '실패가 너무 많습니다. 몇 분 후 다시 시도하세요.', 'Demasiados intentos. Prueba en unos minutos.'),
  acLocked: t('Tài khoản đã bị quản trị viên khóa.', 'This account has been locked by an administrator.', '管理者によりロックされています。', 'Compte bloqué par un administrateur.', '账户已被管理员锁定。', '관리자가 계정을 잠갔습니다.', 'Cuenta bloqueada por un administrador.'),
  acClose: t('Đóng', 'Close', '閉じる', 'Fermer', '关闭', '닫기', 'Cerrar'),
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
