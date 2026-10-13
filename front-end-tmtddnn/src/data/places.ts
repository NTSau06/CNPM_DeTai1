import type { Category, Language, Place } from '../types'

export const languages: { code: Language; label: string; native: string; speech: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', native: 'VI', speech: 'vi-VN' },
  { code: 'en', label: 'English', native: 'EN', speech: 'en-US' },
  { code: 'ja', label: '日本語', native: '日本', speech: 'ja-JP' },
  { code: 'fr', label: 'Français', native: 'FR', speech: 'fr-FR' },
]

export const categoryKeys: Category[] = ['landmark', 'food', 'craft', 'rest']

export const categoryLabels: Record<Language, Record<Category, string>> = {
  vi: { landmark: 'Di sản', food: 'Ẩm thực', craft: 'Đời sống bản địa', rest: 'Góc nghỉ chân' },
  en: { landmark: 'Heritage', food: 'Food', craft: 'Local life', rest: 'Slow moments' },
  ja: { landmark: '歴史', food: '食文化', craft: '地域の暮らし', rest: 'ひと休み' },
  fr: { landmark: 'Patrimoine', food: 'Cuisine', craft: 'Vie locale', rest: 'Pause douce' },
}

export const places: Place[] = [
  {
    id: 'phong-nha-cave',
    category: 'landmark',
    coordinates: [106.283, 17.59],
    duration: 6,
    image: 'cave',
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
    id: 'truong-son-cemetery',
    category: 'landmark',
    coordinates: [106.97, 16.89],
    duration: 5,
    image: 'house',
    copy: {
      vi: {
        title: 'Nghĩa trang Liệt sĩ Trường Sơn',
        subtitle: 'Nơi tưởng niệm những người đã ngã xuống',
        narration: 'Nghĩa trang Liệt sĩ Trường Sơn là nơi yên nghỉ của nhiều người đã hy sinh trên tuyến đường Trường Sơn trong chiến tranh. Những hàng mộ giữa không gian núi rừng gợi nhắc về sự mất mát và lòng biết ơn. Hãy giữ trật tự và sự trang nghiêm khi viếng thăm.',
      },
      en: {
        title: 'Truong Son Martyrs’ Cemetery',
        subtitle: 'A memorial to those who lost their lives',
        narration: 'Truong Son Martyrs’ Cemetery is the resting place of many people who died along the Truong Son route during the war. Rows of graves in a mountain setting invite reflection on loss and remembrance. Please keep a respectful, quiet manner during your visit.',
      },
      ja: {
        title: 'チュオンソン烈士墓地',
        subtitle: '命を捧げた人々を追悼する場所',
        narration: 'チュオンソン烈士墓地には、戦争中にチュオンソンの道で命を落とした多くの人々が眠っています。山々に囲まれた墓地を歩きながら、失われた命と追悼の意味に思いを寄せてみましょう。静かに敬意をもってお参りください。',
      },
      fr: {
        title: 'Cimetière des martyrs de Truong Son',
        subtitle: 'Un lieu de mémoire pour ceux qui ont péri',
        narration: 'Le cimetière des martyrs de Truong Son est le lieu de repos de nombreuses personnes mortes sur la piste de Truong Son pendant la guerre. Les rangées de tombes dans ce cadre montagneux invitent au recueillement. Merci de respecter le calme et le caractère mémoriel du lieu.',
      },
    },
  },
  {
    id: 'cua-tung-beach',
    category: 'rest',
    coordinates: [107.095, 17.055],
    duration: 4,
    image: 'river',
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
    image: 'river',
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
    image: 'river',
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

export const findPlace = (id: string) => places.find((place) => place.id === id)

export const localizedTitle = (place: Place, language: Language) =>
  place.copy[language]?.title ?? place.copy.vi.title
