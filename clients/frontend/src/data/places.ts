import type { Category, Language, Place } from '../types'
import { placeDetails } from './placeDetails'

export const languages: { code: Language; label: string; native: string; speech: string; flag: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', native: 'VI', speech: 'vi-VN', flag: '🇻🇳' },
  { code: 'en', label: 'English', native: 'EN', speech: 'en-US', flag: '🇬🇧' },
  { code: 'ja', label: '日本語', native: '日本', speech: 'ja-JP', flag: '🇯🇵' },
  { code: 'fr', label: 'Français', native: 'FR', speech: 'fr-FR', flag: '🇫🇷' },
  { code: 'zh-CN', label: '中文（简体）', native: '中文', speech: 'zh-CN', flag: '🇨🇳' },
  { code: 'ko-KR', label: '한국어', native: '한국', speech: 'ko-KR', flag: '🇰🇷' },
  { code: 'es', label: 'Español', native: 'ES', speech: 'es-ES', flag: '🇪🇸' },
]

export const categoryKeys: Category[] = ['landmark', 'food', 'craft', 'rest']

export const categoryLabels: Record<Language, Record<Category, string>> = {
  vi: { landmark: 'Di sản', food: 'Ẩm thực', craft: 'Đời sống bản địa', rest: 'Góc nghỉ chân' },
  en: { landmark: 'Heritage', food: 'Food', craft: 'Local life', rest: 'Slow moments' },
  ja: { landmark: '歴史', food: '食文化', craft: '地域の暮らし', rest: 'ひと休み' },
  fr: { landmark: 'Patrimoine', food: 'Cuisine', craft: 'Vie locale', rest: 'Pause douce' },
  'zh-CN': { landmark: '文化遗产', food: '美食', craft: '当地生活', rest: '休憩之处' },
  'ko-KR': { landmark: '문화유산', food: '음식', craft: '현지 생활', rest: '휴식 장소' },
  es: { landmark: 'Patrimonio', food: 'Gastronomía', craft: 'Vida local', rest: 'Pausa' },
}

type ExistingLanguage = 'vi' | 'en' | 'ja' | 'fr'
type AddedLanguage = 'zh-CN' | 'ko-KR' | 'es'
type BasePlace = Omit<Place, 'copy' | 'detailSections' | 'detailImage'> & { copy: Record<ExistingLanguage, Place['copy'][Language]> }

const basePlaces: BasePlace[] = [
  {
    id: 'phong-nha-cave',
    category: 'landmark',
    coordinates: [106.283, 17.59],
    duration: 6,
    image: 'phong-nha',
    copy: {
      vi: {
        title: 'Động Phong Nha',
        subtitle: 'Theo dòng sông Son vào lòng núi',
        narration: 'Từ bến thuyền, hành trình đến động Phong Nha bắt đầu trên dòng sông Son, giữa những dãy núi đá vôi xanh thẫm. Bên trong hang, sông ngầm và những khối thạch nhũ được bồi đắp qua thời gian tạo nên một không gian mát lành, tĩnh lặng. Hãy theo lối tham quan và giữ gìn cảnh quan tự nhiên.',
      },
      en: {
        title: 'Phong Nha Cave',
        subtitle: 'A river journey into the mountains',
        narration: 'From the boat landing, the journey to Phong Nha Cave follows the Son River beneath green limestone peaks. Inside, an underground river and formations shaped over time create a cool, quiet world. Stay on the visitor route and help protect this natural landscape.',
      },
      ja: {
        title: 'フォンニャ洞窟',
        subtitle: 'ソン川から山の奥へ',
        narration: '船着き場からソン川を進み、緑の石灰岩の山々に囲まれたフォンニャ洞窟へ向かいます。洞窟の中には地下河川が流れ、長い時間をかけて生まれた鍾乳石が静かな景色をつくっています。見学路を歩き、自然を大切にしましょう。',
      },
      fr: {
        title: 'Grotte de Phong Nha',
        subtitle: 'Une rivière qui pénètre dans la montagne',
        narration: 'Depuis l’embarcadère, on remonte la rivière Son au pied de montagnes karstiques verdoyantes pour rejoindre la grotte de Phong Nha. Une rivière souterraine et des formations façonnées au fil du temps composent un monde frais et paisible. Restez sur le parcours de visite et protégez ce paysage naturel.',
      },
    },
  },
  {
    id: 'thien-duong-cave',
    category: 'landmark',
    coordinates: [106.1456, 17.5331],
    duration: 6,
    image: 'cave',
    copy: {
      vi: {
        title: 'Động Thiên Đường',
        subtitle: 'Những lớp đá kể chuyện hàng triệu năm',
        narration: 'Động Thiên Đường mở ra một không gian rộng lớn với những vòm đá và rèm thạch nhũ nhiều hình dáng. Lối đi gỗ giúp bạn quan sát hang động mà không bước lên nền đá tự nhiên. Hãy đi chậm, để ý ánh sáng và âm thanh của núi rừng quanh mình.',
      },
      en: {
        title: 'Paradise Cave',
        subtitle: 'Stone formations shaped over deep time',
        narration: 'Paradise Cave opens into vast chambers filled with stone arches and curtains of stalactites. A raised walkway lets visitors explore without stepping on the cave floor. Take your time, and notice the changing light and sounds of the surrounding forest.',
      },
      ja: {
        title: 'ティエンズオン洞窟',
        subtitle: '長い年月がつくった石の景色',
        narration: 'ティエンズオン洞窟には、石のアーチやカーテンのような鍾乳石が広がる大きな空間があります。木道を利用すれば、洞窟の床を傷つけずに見学できます。ゆっくり歩き、光の変化や森の音にも耳を傾けてみましょう。',
      },
      fr: {
        title: 'Grotte du Paradis',
        subtitle: 'Des formations façonnées au fil du temps',
        narration: 'La grotte du Paradis dévoile de vastes salles, des arches de pierre et des draperies de stalactites. Une passerelle surélevée permet de la visiter sans marcher sur le sol naturel. Prenez votre temps et observez les jeux de lumière et les sons de la forêt alentour.',
      },
    },
  },
  {
    id: 'dark-cave',
    category: 'landmark',
    coordinates: [106.2541677, 17.5737841],
    duration: 4,
    image: 'phong-nha',
    copy: {
      vi: {
        title: 'Hang Tối – Sông Chày',
        subtitle: 'Khám phá hang động và trải nghiệm trên sông',
        narration: 'Hang Tối nằm trong Vườn quốc gia Phong Nha – Kẻ Bàng, nổi bật với dòng sông Chày xanh và các hoạt động khám phá hang, chèo kayak, zipline. Khu vực hang không có đèn chiếu sáng nhân tạo nên giữ được vẻ tự nhiên. Hãy sử dụng thiết bị bảo hộ và tuân theo hướng dẫn của nhân viên.',
      },
      en: {
        title: 'Dark Cave and Chay River',
        subtitle: 'Cave exploration and river adventures',
        narration: 'Dark Cave lies in Phong Nha–Ke Bang National Park, beside the green Chay River. Visitors can explore the cave and enjoy activities such as kayaking and ziplining. The cave has no artificial lighting, preserving its natural character. Wear the provided safety equipment and follow staff instructions.',
      },
      ja: {
        title: 'ダークケーブとチャイ川',
        subtitle: '洞窟探検と川のアクティビティ',
        narration: 'ダークケーブはフォンニャ＝ケバン国立公園内にあり、緑色のチャイ川に面しています。洞窟探検やカヤック、ジップラインなどを楽しめます。洞窟内に人工照明はなく、自然の姿が保たれています。安全装備を着用し、スタッフの案内に従ってください。',
      },
      fr: {
        title: 'Grotte Sombre et rivière Chay',
        subtitle: 'Exploration de grotte et activités sur la rivière',
        narration: 'La Grotte Sombre se trouve dans le parc national de Phong Nha–Ke Bang, près des eaux vertes de la rivière Chay. On peut explorer la grotte, faire du kayak ou de la tyrolienne. Sans éclairage artificiel, elle conserve son caractère naturel. Portez les équipements de sécurité et suivez les consignes du personnel.',
      },
    },
  },
  {
    id: 'tien-son-cave',
    category: 'landmark',
    coordinates: [106.282071, 17.5802528],
    duration: 4,
    image: 'cave',
    copy: {
      vi: {
        title: 'Động Tiên Sơn',
        subtitle: 'Thế giới thạch nhũ trên cao nguyên đá vôi',
        narration: 'Động Tiên Sơn nằm trong quần thể Phong Nha, gần động Phong Nha. Đây là hang khô với những vòm đá và thạch nhũ nhiều hình dáng, tạo nên hành trình tham quan khác biệt với dòng sông ngầm ở động Phong Nha. Hãy đi theo lối tham quan và không chạm vào cấu trúc đá.',
      },
      en: {
        title: 'Tien Son Cave',
        subtitle: 'Stalactites above the Phong Nha landscape',
        narration: 'Tien Son Cave is part of the Phong Nha area, near Phong Nha Cave. This dry cave features stone chambers and varied stalactite formations, offering a different visit from the underground river in Phong Nha Cave. Stay on the visitor path and do not touch the formations.',
      },
      ja: {
        title: 'ティエンソン洞窟',
        subtitle: '石灰岩の山に広がる鍾乳石の世界',
        narration: 'ティエンソン洞窟はフォンニャ地域にあり、フォンニャ洞窟の近くに位置する乾燥洞窟です。さまざまな鍾乳石と広い洞室があり、地下河川のあるフォンニャ洞窟とは異なる見学を楽しめます。見学路を歩き、岩の形成物には触れないでください。',
      },
      fr: {
        title: 'Grotte de Tien Son',
        subtitle: 'Des stalactites au cœur du massif calcaire',
        narration: 'La grotte de Tien Son se trouve dans la région de Phong Nha, près de la grotte de Phong Nha. Cette grotte sèche présente de grandes salles et des stalactites variées, pour une visite différente de la rivière souterraine de Phong Nha. Restez sur le parcours et ne touchez pas aux formations.',
      },
    },
  },
  {
    id: 'ozo-park',
    category: 'rest',
    coordinates: [106.2748613, 17.5249336],
    duration: 5,
    image: 'spring',
    copy: {
      vi: {
        title: 'Công viên Ozo',
        subtitle: 'Vui chơi giữa rừng xanh Phong Nha',
        narration: 'Công viên Ozo là điểm du lịch sinh thái trong khu vực Phong Nha – Kẻ Bàng, với cảnh quan rừng và các hoạt động ngoài trời. Du khách có thể dành thời gian đi bộ, ngắm thiên nhiên và trải nghiệm trò chơi theo khu vực được phép. Hãy kiểm tra tình trạng hoạt động, tuân thủ quy định an toàn và bảo vệ môi trường.',
      },
      en: {
        title: 'Ozo Park',
        subtitle: 'Outdoor activities in the forests of Phong Nha',
        narration: 'Ozo Park is an eco-tourism destination in the Phong Nha–Ke Bang area, surrounded by forest and outdoor activities. Visitors can walk, enjoy the natural scenery and use activities in designated areas. Check current operating conditions, follow safety rules and help protect the environment.',
      },
      ja: {
        title: 'オゾ・パーク',
        subtitle: 'フォンニャの森で楽しむアウトドア',
        narration: 'オゾ・パークはフォンニャ＝ケバン地域にあるエコツーリズム施設で、森の景観とアウトドア体験を楽しめます。散策や自然観察、指定エリアでのアクティビティができます。営業状況を確認し、安全規則を守って自然環境を大切にしてください。',
      },
      fr: {
        title: 'Parc Ozo',
        subtitle: 'Activités de plein air dans les forêts de Phong Nha',
        narration: 'Le parc Ozo est un site d’écotourisme de la région de Phong Nha–Ke Bang, entouré de forêt et proposant des activités de plein air. Les visiteurs peuvent se promener, profiter du paysage et pratiquer les activités dans les zones autorisées. Vérifiez les conditions d’ouverture, respectez les consignes de sécurité et protégez l’environnement.',
      },
    },
  },
  {
    id: 'nhat-le-beach',
    category: 'rest',
    coordinates: [106.631, 17.49],
    duration: 4,
    image: 'river',
    copy: {
      vi: {
        title: 'Biển Nhật Lệ',
        subtitle: 'Một nhịp thở chậm bên cửa biển',
        narration: 'Bãi biển Nhật Lệ nằm gần nơi dòng sông cùng tên gặp biển. Buổi sớm, bờ cát còn thoáng và nhịp sinh hoạt của thành phố biển vừa bắt đầu. Hãy chọn nơi an toàn để xuống nước, để ý cờ cảnh báo và mang rác theo khi rời bãi biển.',
      },
      en: {
        title: 'Nhat Le Beach',
        subtitle: 'A slower moment by the sea',
        narration: 'Nhat Le Beach lies near the meeting point of the river and the sea. In the morning, the shore is quiet as the coastal city begins its day. Swim only in safe areas, follow beach warnings, and take your rubbish with you.',
      },
      ja: {
        title: 'ニャットレ海岸',
        subtitle: '海辺でひと息、ゆっくりと',
        narration: 'ニャットレ海岸は、同じ名の川が海へ注ぐ場所の近くにあります。朝の浜辺は静かで、海辺の町が一日を始めるところです。遊泳は安全な区域に限り、注意表示を確認し、ごみは持ち帰りましょう。',
      },
      fr: {
        title: 'Plage de Nhat Le',
        subtitle: 'Une pause au bord de la mer',
        narration: 'La plage de Nhat Le se trouve près de l’embouchure de la rivière du même nom. Le matin, le rivage est calme tandis que la ville côtière s’éveille. Baignez-vous uniquement dans les zones sûres, respectez les panneaux et emportez vos déchets.',
      },
    },
  },
  {
    id: 'dong-hoi-market',
    category: 'food',
    coordinates: [106.622, 17.466],
    duration: 4,
    image: 'market',
    copy: {
      vi: {
        title: 'Chợ Đồng Hới',
        subtitle: 'Thử vị Quảng Bình qua món ăn địa phương',
        narration: 'Chợ Đồng Hới là nơi dễ bắt gặp nhịp sống thường ngày bên sông Nhật Lệ. Hãy hỏi thăm các quầy địa phương về cháo canh, bánh bột lọc hay hải sản theo mùa. Mỗi hàng quán có cách nêm nếm riêng; cứ thong thả chọn món và hỏi giá trước khi gọi.',
      },
      en: {
        title: 'Dong Hoi Market',
        subtitle: 'Taste local food from Quang Binh',
        narration: 'Dong Hoi Market offers a glimpse of everyday life by the Nhat Le River. Ask local vendors about chao canh noodle soup, tapioca dumplings, or seafood in season. Each stall has its own style, so take your time and check the price before ordering.',
      },
      ja: {
        title: 'ドンホイ市場',
        subtitle: 'クアンビンの地元の味を訪ねて',
        narration: 'ドンホイ市場では、ニャットレ川のそばで営まれる日々の暮らしに触れられます。地元の店で、チャオカインやタピオカ餃子、旬の魚介について尋ねてみましょう。店ごとに味付けが異なるので、ゆっくり選び、注文前に値段を確認しましょう。',
      },
      fr: {
        title: 'Marché de Dong Hoi',
        subtitle: 'À la découverte des saveurs locales',
        narration: 'Le marché de Dong Hoi donne un aperçu de la vie quotidienne près de la rivière Nhat Le. Demandez aux vendeurs de goûter le chao canh, les raviolis de tapioca ou les fruits de mer de saison. Chaque échoppe a sa recette : prenez le temps de choisir et demandez le prix avant de commander.',
      },
    },
  },
  {
    id: 'bao-ninh-village',
    category: 'craft',
    coordinates: [106.638, 17.473],
    duration: 5,
    image: 'pottery',
    copy: {
      vi: {
        title: 'Làng biển Bảo Ninh',
        subtitle: 'Nếp sống miền biển bên cửa sông',
        narration: 'Qua cầu Nhật Lệ là đến Bảo Ninh, vùng đất gắn với biển và nghề đánh bắt ven bờ. Quan sát thuyền bè, lưới cá và nhịp chuẩn bị cho mỗi chuyến ra khơi từ một khoảng cách tôn trọng. Nếu muốn trò chuyện hay chụp ảnh, hãy hỏi người dân trước.',
      },
      en: {
        title: 'Bao Ninh Fishing Village',
        subtitle: 'Coastal life beside the river mouth',
        narration: 'Across Nhat Le Bridge lies Bao Ninh, a coastal area connected with the sea and nearshore fishing. From a respectful distance, watch the boats, nets, and preparations for a day at sea. Ask residents before starting a conversation or taking photographs.',
      },
      ja: {
        title: 'バオニン漁村',
        subtitle: '川の河口に息づく海辺の暮らし',
        narration: 'ニャットレ橋を渡ると、海と沿岸漁業に結びついたバオニンの地域があります。船や網、出漁の準備を、少し離れた場所から見守ってみましょう。住民と話したり写真を撮ったりする前に、ひと声かけてください。',
      },
      fr: {
        title: 'Village de pêcheurs de Bao Ninh',
        subtitle: 'La vie côtière près de l’embouchure',
        narration: 'Au-delà du pont Nhat Le se trouve Bao Ninh, un territoire tourné vers la mer et la pêche côtière. Observez les bateaux, les filets et les préparatifs depuis une distance respectueuse. Demandez aux habitants avant d’engager la conversation ou de prendre une photo.',
      },
    },
  },
  {
    id: 'vinh-moc-tunnels',
    category: 'landmark',
    coordinates: [107.029, 17.078],
    duration: 6,
    image: 'house',
    copy: {
      vi: {
        title: 'Địa đạo Vịnh Mốc',
        subtitle: 'Không gian sống dưới lòng đất',
        narration: 'Trong những năm chiến tranh, người dân Vịnh Mốc đào hệ thống địa đạo để trú ẩn và duy trì cuộc sống. Các lối hầm, căn phòng và giếng nước cho thấy sự bền bỉ của cộng đồng trong hoàn cảnh khắc nghiệt. Hãy đi theo hướng dẫn tại điểm tham quan và lưu ý các đoạn hầm thấp, hẹp.',
      },
      en: {
        title: 'Vinh Moc Tunnels',
        subtitle: 'A community shelter beneath the ground',
        narration: 'During the war, residents of Vinh Moc built an underground tunnel system for shelter and daily life. Its passages, rooms, and wells tell of a community enduring difficult conditions. Follow local guidance and take care in the low, narrow sections.',
      },
      ja: {
        title: 'ヴィンモック地下道',
        subtitle: '地中に築かれた暮らしの場',
        narration: '戦時中、ヴィンモックの住民は避難し生活を続けるため、地下道を掘りました。通路や部屋、井戸から、厳しい状況を生き抜いた人々の姿が伝わります。現地の案内に従い、低く狭い場所では足元に注意してください。',
      },
      fr: {
        title: 'Tunnels de Vinh Moc',
        subtitle: 'Un abri communautaire sous terre',
        narration: 'Pendant la guerre, les habitants de Vinh Moc ont creusé un réseau souterrain pour se mettre à l’abri et poursuivre leur vie quotidienne. Les passages, les pièces et les puits témoignent de la résilience de la communauté. Suivez les consignes sur place et soyez prudent dans les sections basses et étroites.',
      },
    },
  },
  {
    id: 'hien-luong-bridge',
    category: 'landmark',
    coordinates: [107.106, 17.01],
    duration: 4,
    image: 'bridge',
    copy: {
      vi: {
        title: 'Cầu Hiền Lương – sông Bến Hải',
        subtitle: 'Dòng sông lưu dấu một thời chia cắt',
        narration: 'Cầu Hiền Lương bắc qua sông Bến Hải, nơi từng gắn với giới tuyến quân sự tạm thời sau Hiệp định Genève năm 1954. Trong giai đoạn đất nước bị chia cắt, cây cầu trở thành biểu tượng của nỗi mong chờ ngày sum họp. Đứng bên bờ sông, bạn có thể cảm nhận rõ hơn lớp ký ức lịch sử của vùng đất này.',
      },
      en: {
        title: 'Hien Luong Bridge',
        subtitle: 'A river marked by a divided past',
        narration: 'Hien Luong Bridge crosses the Ben Hai River, once associated with the temporary military demarcation following the 1954 Geneva Accords. During the years of division, the bridge became a symbol of hope for reunion. Pause by the river to reflect on the region’s history.',
      },
      ja: {
        title: 'ヒエンルオン橋',
        subtitle: '分断の記憶を伝える川',
        narration: 'ヒエンルオン橋はベンハイ川に架かり、1954年のジュネーブ協定後には一時的な軍事境界線と結びついた場所でした。国が分断されていた時代、この橋は再会への願いを象徴しました。川辺で、この土地に刻まれた歴史に思いを巡らせてみましょう。',
      },
      fr: {
        title: 'Pont de Hien Luong',
        subtitle: 'Une rivière marquée par la division',
        narration: 'Le pont de Hien Luong enjambe la rivière Ben Hai, associée à la ligne militaire provisoire établie après les accords de Genève de 1954. Durant la division du pays, le pont est devenu un symbole d’espoir de retrouvailles. Arrêtez-vous près de la rivière pour réfléchir à l’histoire de la région.',
      },
    },
  },
  {
    id: 'quang-tri-citadel',
    category: 'landmark',
    coordinates: [107.193, 16.75],
    duration: 5,
    image: 'assembly',
    copy: {
      vi: {
        title: 'Thành cổ Quảng Trị',
        subtitle: 'Dấu tích thành xưa giữa lòng thành phố',
        narration: 'Thành cổ Quảng Trị là di tích lịch sử gắn với nhiều biến động của đất nước, đặc biệt là những trận chiến khốc liệt năm 1972. Ngày nay, không gian tưởng niệm trong thành nhắc mỗi người về những mất mát của chiến tranh và giá trị của hòa bình. Hãy giữ sự trang nghiêm khi tham quan.',
      },
      en: {
        title: 'Quang Tri Ancient Citadel',
        subtitle: 'A historic citadel in the heart of the city',
        narration: 'Quang Tri Ancient Citadel bears witness to turbulent chapters in the country’s history, especially the fierce battles of 1972. Today, its memorial grounds invite visitors to remember the human cost of war and the value of peace. Please be respectful during your visit.',
      },
      ja: {
        title: 'クアンチ古城',
        subtitle: '町の中心に残る歴史の城塞',
        narration: 'クアンチ古城は、国の歴史を揺るがした出来事、なかでも1972年の激しい戦闘を今に伝えています。現在の追悼の場は、戦争の犠牲と平和の大切さを静かに語りかけます。見学の際は、敬意をもってお過ごしください。',
      },
      fr: {
        title: 'Citadelle de Quang Tri',
        subtitle: 'Une citadelle historique au cœur de la ville',
        narration: 'La citadelle de Quang Tri témoigne des périodes troublées de l’histoire du pays, notamment des combats acharnés de 1972. Aujourd’hui, son espace mémoriel invite à se souvenir des vies perdues et de la valeur de la paix. Merci de respecter le caractère solennel du lieu.',
      },
    },
  },
  {
    id: 'cua-tung-beach',
    category: 'rest',
    coordinates: [107.095, 17.055],
    duration: 4,
    image: 'cua-tung-beach',
    copy: {
      vi: {
        title: 'Bãi biển Cửa Tùng',
        subtitle: 'Khoảng lặng bên bờ biển Quảng Trị',
        narration: 'Cửa Tùng là bãi biển ở phía bắc Quảng Trị, nơi có thể dừng chân ngắm biển và nhịp sống ven bờ. Hãy chú ý biển báo, chỉ xuống nước ở khu vực an toàn và giữ gìn bãi biển sạch đẹp.',
      },
      en: {
        title: 'Cua Tung Beach',
        subtitle: 'A quiet pause on the Quang Tri coast',
        narration: 'Cua Tung is a beach on the northern coast of Quang Tri, a place to pause by the sea and observe life along the shore. Follow local safety signs, swim only in designated safe areas, and help keep the beach clean.',
      },
      ja: {
        title: 'クアトゥン海岸',
        subtitle: 'クアンチの海辺でひと休み',
        narration: 'クアトゥンはクアンチ北部の海岸です。海を眺めながら、岸辺の日常に目を向けてみましょう。現地の安全表示を確認し、安全な区域でのみ遊泳し、海岸をきれいに保ちましょう。',
      },
      fr: {
        title: 'Plage de Cua Tung',
        subtitle: 'Une pause sur la côte de Quang Tri',
        narration: 'Cua Tung est une plage au nord de Quang Tri, où l’on peut s’arrêter pour contempler la mer et la vie du littoral. Respectez les consignes de sécurité, baignez-vous uniquement dans les zones sûres et veillez à garder la plage propre.',
      },
    },
  },
  {
    id: 'nuoc-mooc-spring',
    category: 'rest',
    coordinates: [106.235, 17.56],
    duration: 5,
    image: 'spring',
    copy: {
      vi: {
        title: 'Suối nước Moọc',
        subtitle: 'Dòng suối xanh giữa rừng Phong Nha',
        narration: 'Suối nước Moọc nằm giữa cảnh quan núi đá vôi và rừng xanh của khu vực Phong Nha. Dòng nước trong cùng không gian rợp bóng cây là điểm dừng chân để thư giãn giữa thiên nhiên. Hãy đi theo lối tham quan và tuân thủ hướng dẫn an toàn tại khu du lịch.',
      },
      en: {
        title: 'Nuoc Mooc Spring',
        subtitle: 'A clear stream in the forests of Phong Nha',
        narration: 'Nuoc Mooc Spring lies among the limestone hills and forests of the Phong Nha area. Its clear water and shaded surroundings offer a peaceful break in nature. Stay on visitor paths and follow safety guidance at the site.',
      },
      ja: {
        title: 'ヌオックモック泉',
        subtitle: 'フォンニャの森を流れる清流',
        narration: 'ヌオックモック泉は、フォンニャ地域の石灰岩の山々と森に囲まれています。澄んだ水と木陰の中で、自然に親しみながらひと休みできます。見学路を歩き、施設の安全案内に従ってください。',
      },
      fr: {
        title: 'Source de Nuoc Mooc',
        subtitle: 'Un ruisseau clair dans les forêts de Phong Nha',
        narration: 'La source de Nuoc Mooc se trouve au milieu des collines karstiques et des forêts de la région de Phong Nha. Son eau claire et ses berges ombragées offrent une pause au calme. Restez sur les sentiers et suivez les consignes de sécurité du site.',
      },
    },
  },
  {
    id: 'da-nhay-beach',
    category: 'rest',
    coordinates: [106.53, 17.65],
    duration: 4,
    image: 'da-nhay',
    copy: {
      vi: {
        title: 'Bãi Đá Nhảy',
        subtitle: 'Những khối đá bên bờ biển Quảng Bình',
        narration: 'Bãi Đá Nhảy gây ấn tượng với những khối đá có hình dáng khác nhau nằm dọc bờ biển Quảng Bình. Cảnh quan thay đổi theo thủy triều và sóng biển. Hãy cẩn thận khi đi trên đá, tránh khu vực trơn trượt và làm theo hướng dẫn an toàn tại bãi biển.',
      },
      en: {
        title: 'Da Nhay Beach',
        subtitle: 'Rock formations along the Quang Binh coast',
        narration: 'Da Nhay Beach is known for its varied rock formations along the Quang Binh coast. The shoreline changes with the tides and waves. Take care on the rocks, avoid slippery areas, and follow local beach safety guidance.',
      },
      ja: {
        title: 'ダー・ニャイ海岸',
        subtitle: 'クアンビンの海辺に並ぶ岩々',
        narration: 'ダー・ニャイ海岸には、クアンビンの海沿いにさまざまな形の岩が並んでいます。潮や波によって海岸の景色も変化します。岩場では足元に注意し、滑りやすい場所を避けて現地の安全案内に従ってください。',
      },
      fr: {
        title: 'Plage de Da Nhay',
        subtitle: 'Des rochers le long de la côte de Quang Binh',
        narration: 'La plage de Da Nhay est connue pour ses formations rocheuses variées sur le littoral de Quang Binh. Le paysage évolue avec les marées et les vagues. Soyez prudent sur les rochers, évitez les zones glissantes et suivez les consignes de sécurité locales.',
      },
    },
  },
]

const additionalCopies: Record<string, Record<AddedLanguage, Place['copy'][Language]>> = {
  'phong-nha-cave': {
    'zh-CN': {
      title: '峰牙洞',
      subtitle: '沿着山孙河走进群山深处',
      narration: '从码头出发，乘船沿着山孙河前往峰牙洞，两岸是苍翠的石灰岩山。洞内有地下河和历经漫长岁月形成的钟乳石，环境清凉而宁静。请沿指定路线参观，共同保护自然景观。',
    },
    'ko-KR': {
      title: '퐁냐 동굴',
      subtitle: '손강을 따라 산속으로',
      narration: '선착장에서 손강을 따라 푸른 석회암 산 사이로 들어가면 퐁냐 동굴에 도착합니다. 동굴 안에는 지하강과 오랜 세월에 걸쳐 형성된 종유석이 있어 시원하고 고요한 풍경을 만날 수 있습니다. 지정된 관람로를 이용하고 자연을 보호해 주세요.',
    },
    es: {
      title: 'Cueva de Phong Nha',
      subtitle: 'Un viaje por el río Son hacia la montaña',
      narration: 'Desde el embarcadero, el recorrido hacia la cueva de Phong Nha sigue el río Son entre montañas de piedra caliza. En el interior, un río subterráneo y formaciones rocosas modeladas durante mucho tiempo crean un ambiente fresco y silencioso. Siga el recorrido indicado y ayude a proteger el entorno natural.',
    },
  },
  'thien-duong-cave': {
    'zh-CN': {
      title: '天堂洞',
      subtitle: '记录亿万年时光的岩层',
      narration: '天堂洞展现出宽阔的洞厅、石拱和形态各异的钟乳石帘。木栈道让游客可以观赏洞穴，同时避免踩踏天然地面。请放慢脚步，留意光线变化和周围森林的声音。',
    },
    'ko-KR': {
      title: '티엔드엉 동굴',
      subtitle: '오랜 세월이 빚어낸 바위 풍경',
      narration: '티엔드엉 동굴에는 넓은 공간과 바위 아치, 다양한 모양의 종유석이 펼쳐집니다. 나무 산책로를 이용하면 자연 그대로의 동굴 바닥을 밟지 않고 둘러볼 수 있습니다. 천천히 걸으며 빛의 변화와 숲의 소리에 귀 기울여 보세요.',
    },
    es: {
      title: 'Cueva del Paraíso',
      subtitle: 'Formaciones de piedra creadas a lo largo del tiempo',
      narration: 'La cueva del Paraíso se abre en amplias salas con arcos de piedra y cortinas de estalactitas. La pasarela de madera permite recorrerla sin pisar el suelo natural. Camine despacio y observe la luz y los sonidos del bosque que la rodea.',
    },
  },
  'nhat-le-beach': {
    'zh-CN': {
      title: '日丽海滩',
      subtitle: '在河海交汇处放慢脚步',
      narration: '日丽海滩靠近日丽河入海口。清晨，沙滩较为宁静，海滨城市的一天刚刚开始。请只在安全区域下水，留意警示旗，并在离开时带走垃圾。',
    },
    'ko-KR': {
      title: '녓레 해변',
      subtitle: '바닷가에서 잠시 쉬어 가기',
      narration: '녓레 해변은 같은 이름의 강이 바다와 만나는 곳 가까이에 있습니다. 아침이면 해변은 한적하고 해안 도시의 하루가 막 시작됩니다. 안전한 구역에서만 물에 들어가고 안내 깃발을 확인하며 쓰레기는 가져가 주세요.',
    },
    es: {
      title: 'Playa de Nhat Le',
      subtitle: 'Una pausa tranquila junto al mar',
      narration: 'La playa de Nhat Le está cerca de la desembocadura del río del mismo nombre. Por la mañana, la orilla está tranquila mientras despierta la ciudad costera. Báñese solo en zonas seguras, preste atención a las señales y llévese la basura.',
    },
  },
  'dong-hoi-market': {
    'zh-CN': {
      title: '同海市场',
      subtitle: '品尝广平当地风味',
      narration: '同海市场展现了日丽河畔的日常生活。可以向当地摊主了解当地面汤、木薯粉饼或时令海鲜。每家店都有自己的做法，请慢慢挑选，并在点餐前询问价格。',
    },
    'ko-KR': {
      title: '동허이 시장',
      subtitle: '꽝빈의 현지 음식을 맛보다',
      narration: '동허이 시장에서는 녓레강 주변의 일상을 엿볼 수 있습니다. 현지 상인에게 짜오까인 국수, 타피오카 만두, 제철 해산물을 물어보세요. 가게마다 맛이 다르니 천천히 둘러보고 주문 전에 가격을 확인해 주세요.',
    },
    es: {
      title: 'Mercado de Dong Hoi',
      subtitle: 'Sabores locales de Quang Binh',
      narration: 'El mercado de Dong Hoi ofrece una mirada a la vida cotidiana junto al río Nhat Le. Pregunte por la sopa de fideos chao canh, las empanadillas de tapioca o el marisco de temporada. Cada puesto tiene su estilo: tómese su tiempo y consulte el precio antes de pedir.',
    },
  },
  'bao-ninh-village': {
    'zh-CN': {
      title: '宝宁渔村',
      subtitle: '河口旁的海滨生活',
      narration: '穿过日丽桥便来到宝宁，这里与海洋和近海捕鱼息息相关。请保持适当距离，观察渔船、渔网和出海前的准备工作。如想与居民交谈或拍照，请先征得同意。',
    },
    'ko-KR': {
      title: '바오닌 어촌',
      subtitle: '강어귀 곁의 해안 생활',
      narration: '녓레 다리를 건너면 바다와 연안 어업으로 이어진 바오닌 지역에 도착합니다. 배와 그물, 출항 준비 모습을 적당한 거리를 두고 살펴보세요. 주민과 대화하거나 사진을 찍기 전에는 먼저 허락을 구해 주세요.',
    },
    es: {
      title: 'Aldea pesquera de Bao Ninh',
      subtitle: 'Vida costera junto a la desembocadura',
      narration: 'Al otro lado del puente Nhat Le se encuentra Bao Ninh, una zona ligada al mar y a la pesca costera. Observe los barcos, las redes y los preparativos para salir al mar desde una distancia respetuosa. Pida permiso antes de conversar con los residentes o tomar fotografías.',
    },
  },
  'vinh-moc-tunnels': {
    'zh-CN': {
      title: '永木地道',
      subtitle: '地下的生活空间',
      narration: '战争期间，永木居民修建了地道系统，用于躲避战火并维持日常生活。通道、房间和水井展现了人们在艰难环境中的坚韧。请遵循现场指引，并注意低矮狭窄的路段。',
    },
    'ko-KR': {
      title: '빈목 터널',
      subtitle: '땅속에 마련한 생활 공간',
      narration: '전쟁 중 빈목 주민들은 피난과 생활을 위해 지하 터널을 만들었습니다. 통로와 방, 우물은 어려운 상황을 견뎌 낸 공동체의 모습을 보여 줍니다. 현장 안내를 따르고 낮고 좁은 구간에서는 주의해 주세요.',
    },
    es: {
      title: 'Túneles de Vinh Moc',
      subtitle: 'Un espacio de vida bajo tierra',
      narration: 'Durante la guerra, los habitantes de Vinh Moc construyeron una red de túneles para refugiarse y continuar su vida cotidiana. Los pasadizos, las habitaciones y los pozos muestran la resistencia de la comunidad en circunstancias difíciles. Siga las indicaciones del lugar y tenga cuidado en los tramos bajos y estrechos.',
    },
  },
  'hien-luong-bridge': {
    'zh-CN': {
      title: '贤良桥与滨海河',
      subtitle: '见证分裂岁月的河流',
      narration: '贤良桥横跨滨海河。1954年日内瓦协议后，这里曾与临时军事分界线相关。在国家分裂的岁月里，这座桥成为人们期盼团聚的象征。您可以在河畔停留，感受这片土地承载的历史记忆。',
    },
    'ko-KR': {
      title: '히엔르엉 다리와 벤하이강',
      subtitle: '분단의 역사를 간직한 강',
      narration: '히엔르엉 다리는 벤하이강을 가로지릅니다. 이곳은 1954년 제네바 협정 이후 임시 군사 경계선과 관련된 장소였습니다. 분단의 시기 다리는 재회를 바라는 희망의 상징이 되었습니다. 강가에 잠시 머물며 이 지역의 역사를 되새겨 보세요.',
    },
    es: {
      title: 'Puente de Hien Luong y río Ben Hai',
      subtitle: 'Un río marcado por la división',
      narration: 'El puente de Hien Luong cruza el río Ben Hai, asociado a la línea militar provisional establecida tras los Acuerdos de Ginebra de 1954. Durante la división del país, el puente simbolizó la esperanza de reunificación. Deténgase junto al río y reflexione sobre la historia de la región.',
    },
  },
  'quang-tri-citadel': {
    'zh-CN': {
      title: '广治古城',
      subtitle: '城市中心的古城遗迹',
      narration: '广治古城见证了越南历史上的动荡时期，尤其是1972年的激烈战事。如今，城内的纪念空间提醒人们铭记战争带来的牺牲与和平的珍贵。参观时请保持肃穆。',
    },
    'ko-KR': {
      title: '꽝찌 고성',
      subtitle: '도시 한가운데 남은 옛 성터',
      narration: '꽝찌 고성은 베트남 역사의 격동기를 간직한 유적이며, 특히 1972년의 치열한 전투와 관련이 있습니다. 오늘날 성 안의 추모 공간은 전쟁의 희생과 평화의 소중함을 일깨워 줍니다. 방문 중에는 경건한 태도를 지켜 주세요.',
    },
    es: {
      title: 'Ciudadela antigua de Quang Tri',
      subtitle: 'Una ciudadela histórica en el centro de la ciudad',
      narration: 'La ciudadela antigua de Quang Tri fue testigo de etapas turbulentas de la historia del país, en especial de los intensos combates de 1972. Hoy, su espacio conmemorativo invita a recordar las pérdidas de la guerra y el valor de la paz. Mantenga una actitud respetuosa durante la visita.',
    },
  },
  'cua-tung-beach': {
    'zh-CN': {
      title: '炉门海滩',
      subtitle: '广治海岸的一处宁静角落',
      narration: '炉门海滩位于广治北部，适合停下脚步欣赏海景与沿岸生活。请留意安全标识，只在指定安全区域游泳，并帮助保持海滩整洁。',
    },
    'ko-KR': {
      title: '끄어뚱 해변',
      subtitle: '꽝찌 해안의 조용한 쉼터',
      narration: '끄어뚱은 꽝찌 북부에 있는 해변으로, 바다와 해안의 일상을 바라보며 쉬어 갈 수 있습니다. 현지 안전 표지판을 확인하고 안전 구역에서만 수영하며 해변을 깨끗하게 이용해 주세요.',
    },
    es: {
      title: 'Playa de Cua Tung',
      subtitle: 'Una pausa tranquila en la costa de Quang Tri',
      narration: 'Cua Tung es una playa al norte de Quang Tri, un lugar para contemplar el mar y la vida costera. Respete las señales de seguridad, báñese solo en las zonas autorizadas y ayude a mantener limpia la playa.',
    },
  },
  'nuoc-mooc-spring': {
    'zh-CN': {
      title: '莫瀑溪',
      subtitle: '峰牙森林中的清澈溪流',
      narration: '莫瀑溪位于峰牙地区的石灰岩山与森林之间。清澈的溪水和荫凉的环境为游客提供了一处亲近自然、放松休息的地方。请沿参观路线行走，并遵守景区安全指引。',
    },
    'ko-KR': {
      title: '느억묵 샘',
      subtitle: '퐁냐 숲속의 맑은 물줄기',
      narration: '느억묵 샘은 퐁냐 지역의 석회암 언덕과 숲 사이에 자리합니다. 맑은 물과 나무 그늘이 어우러져 자연 속에서 편히 쉬어 갈 수 있습니다. 관람로를 이용하고 현장의 안전 안내를 따라 주세요.',
    },
    es: {
      title: 'Manantial de Nuoc Mooc',
      subtitle: 'Un arroyo claro en los bosques de Phong Nha',
      narration: 'El manantial de Nuoc Mooc se encuentra entre las colinas de piedra caliza y los bosques de Phong Nha. Sus aguas claras y sus zonas de sombra ofrecen un descanso tranquilo en la naturaleza. Siga los senderos y las indicaciones de seguridad del lugar.',
    },
  },
  'da-nhay-beach': {
    'zh-CN': {
      title: '跳石海滩',
      subtitle: '广平海岸边的奇石景观',
      narration: '跳石海滩以广平海岸上形态各异的岩石而闻名。潮汐和海浪会不断改变海岸景色。请小心行走，避开湿滑区域，并遵循海滩的安全指引。',
    },
    'ko-KR': {
      title: '다냐이 해변',
      subtitle: '꽝빈 해안의 바위 풍경',
      narration: '다냐이 해변은 꽝빈 해안을 따라 다양한 모양으로 놓인 바위로 유명합니다. 해안 풍경은 조수와 파도에 따라 달라집니다. 바위 위에서는 조심하고 미끄러운 곳을 피하며 현지 안전 안내를 따라 주세요.',
    },
    es: {
      title: 'Playa de Da Nhay',
      subtitle: 'Formaciones rocosas en la costa de Quang Binh',
      narration: 'La playa de Da Nhay destaca por sus formaciones rocosas de distintas formas a lo largo de la costa de Quang Binh. El paisaje cambia con las mareas y las olas. Camine con cuidado, evite las zonas resbaladizas y siga las indicaciones de seguridad.',
    },
  },
  'dark-cave': {
    'zh-CN': {
      title: '黑暗洞穴与柴河',
      subtitle: '探索洞穴，体验河上活动',
      narration: '黑暗洞穴位于峰牙—己榜国家公园内，毗邻碧绿的柴河。游客可以探索洞穴、划皮艇或体验滑索。洞内没有人工照明，保留了自然原貌。请穿戴安全装备并听从工作人员指引。',
    },
    'ko-KR': {
      title: '다크 동굴과 짜이강',
      subtitle: '동굴 탐험과 강에서 즐기는 모험',
      narration: '다크 동굴은 퐁냐케방 국립공원 안의 푸른 짜이강 옆에 있습니다. 동굴 탐험, 카약, 짚라인 등을 즐길 수 있습니다. 동굴에는 인공조명이 없어 자연 그대로의 모습을 간직하고 있습니다. 안전 장비를 착용하고 직원의 안내를 따라 주세요.',
    },
    es: {
      title: 'Cueva Oscura y río Chay',
      subtitle: 'Exploración de cuevas y aventuras en el río',
      narration: 'La Cueva Oscura está en el Parque Nacional Phong Nha–Ke Bang, junto al río Chay. Se puede explorar la cueva, navegar en kayak y hacer tirolesa. No tiene iluminación artificial y conserva su carácter natural. Use el equipo de seguridad y siga las indicaciones del personal.',
    },
  },
  'tien-son-cave': {
    'zh-CN': {
      title: '仙山洞',
      subtitle: '石灰岩山中的钟乳石世界',
      narration: '仙山洞位于峰牙地区，靠近峰牙洞，是一座干洞。洞内有宽阔的洞厅和形态各异的钟乳石，与峰牙洞的地下河景观不同。请沿参观路线行走，不要触摸岩石。',
    },
    'ko-KR': {
      title: '띠엔선 동굴',
      subtitle: '석회암 산속 종유석의 세계',
      narration: '띠엔선 동굴은 퐁냐 동굴 근처의 퐁냐 지역에 있는 건식 동굴입니다. 넓은 동굴 공간과 다양한 종유석을 볼 수 있어 지하강이 흐르는 퐁냐 동굴과는 또 다른 경험을 선사합니다. 지정된 관람로를 이용하고 암석을 만지지 마세요.',
    },
    es: {
      title: 'Cueva de Tien Son',
      subtitle: 'Un mundo de estalactitas en la montaña caliza',
      narration: 'La cueva de Tien Son está en la región de Phong Nha, cerca de la cueva de Phong Nha. Es una cueva seca con amplias salas y estalactitas variadas, distinta del río subterráneo de Phong Nha. Siga el recorrido indicado y no toque las formaciones.',
    },
  },
  'ozo-park': {
    'zh-CN': {
      title: 'Ozo生态公园',
      subtitle: '在峰牙森林中体验户外活动',
      narration: 'Ozo生态公园位于峰牙—己榜地区，四周是森林景观，并提供户外活动。游客可以散步、欣赏自然，并在指定区域参加活动。请提前确认开放情况，遵守安全规定并保护环境。',
    },
    'ko-KR': {
      title: '오조 공원',
      subtitle: '퐁냐 숲속에서 즐기는 야외 활동',
      narration: '오조 공원은 퐁냐케방 지역의 생태 관광지로 숲과 야외 활동을 즐길 수 있습니다. 산책과 자연 감상, 지정 구역에서의 체험 활동이 가능합니다. 운영 여부를 미리 확인하고 안전 수칙을 지키며 자연을 보호해 주세요.',
    },
    es: {
      title: 'Parque Ozo',
      subtitle: 'Actividades al aire libre en los bosques de Phong Nha',
      narration: 'El parque Ozo es un destino de ecoturismo en la región de Phong Nha–Ke Bang, rodeado de bosques y actividades al aire libre. Se puede pasear, disfrutar del paisaje y participar en actividades en las zonas autorizadas. Compruebe el horario, respete las normas de seguridad y cuide el entorno.',
    },
  },
}

export const places: Place[] = basePlaces.map((place) => {
  const addedCopy = additionalCopies[place.id]
  if (!addedCopy) throw new Error(`Missing added-language content for place "${place.id}".`)
  const details = placeDetails[place.id]
  if (!details) throw new Error(`Missing detail content for place "${place.id}".`)

  return { ...place, copy: { ...place.copy, ...addedCopy }, detailSections: details.sections, detailImage: details.image }
})

export const findPlace = (id: string) => places.find((place) => place.id === id)

export const localizedTitle = (place: Place, language: Language) =>
  place.copy[language]?.title ?? place.copy.vi.title
