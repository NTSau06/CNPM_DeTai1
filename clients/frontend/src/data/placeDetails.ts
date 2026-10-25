import type { PlaceDetailImage, PlaceDetailSection } from '../types'

export interface PlaceDetails {
  sections: PlaceDetailSection[]
  image: PlaceDetailImage
}

export const placeDetails: Record<string, PlaceDetails> = {
  'phong-nha-cave': {
    sections: [
      { heading: 'Hành trình trên sông Son', body: 'Chuyến tham quan bắt đầu từ bến thuyền, xuôi theo dòng sông Son giữa khung cảnh núi đá vôi và những xóm làng ven sông. Quãng đường trên mặt nước là dịp để cảm nhận nhịp sống yên bình của vùng Phong Nha.' },
      { heading: 'Khám phá lòng hang', body: 'Thuyền đưa du khách vào cửa động, nơi dòng nước ngầm và những khối thạch nhũ tạo nên không gian mát lành, tĩnh lặng. Hãy quan sát các hình khối tự nhiên và đi theo lối tham quan được hướng dẫn.' },
      { heading: 'Gợi ý khi tham quan', body: 'Nên chuẩn bị áo khoác nhẹ vì trong hang thường mát hơn bên ngoài. Giữ gìn cảnh quan, không chạm hoặc lấy các cấu trúc tự nhiên và tuân theo hướng dẫn an toàn tại bến thuyền.' },
    ],
    image: { src: new URL('../../image/1707127136.jpg', import.meta.url).href, alt: 'Khung cảnh bên trong động Phong Nha', caption: 'Không gian hang động Phong Nha' },
  },
  'thien-duong-cave': {
    sections: [
      { heading: 'Con đường giữa rừng', body: 'Động Thiên Đường nằm trong vùng núi đá vôi và rừng thuộc khu vực Phong Nha – Kẻ Bàng. Lối đi xuyên qua tán cây đưa du khách từ không gian rừng xanh đến cửa hang.' },
      { heading: 'Những vòm đá kỳ vĩ', body: 'Bên trong hang là những vòm đá rộng cùng các lớp thạch nhũ với hình dáng đa dạng, được hình thành qua thời gian dài. Hệ thống lối đi giúp bạn quan sát hang động mà không bước lên nền đá tự nhiên.' },
      { heading: 'Gợi ý khi tham quan', body: 'Hãy mang giày dễ đi, dành đủ thời gian cho chặng đường tham quan và đi theo lối quy định. Không chạm vào thạch nhũ, đồng thời tuân thủ hướng dẫn của khu du lịch.' },
    ],
    image: { src: new URL('../../image/Grotte_Thien_Duong.jpg', import.meta.url).href, alt: 'Các khối thạch nhũ trong động Thiên Đường', caption: 'Thạch nhũ trong động Thiên Đường' },
  },
  'nhat-le-beach': {
    sections: [
      { heading: 'Bãi biển bên thành phố', body: 'Bãi biển Nhật Lệ nằm gần trung tâm Đồng Hới, nơi sông Nhật Lệ gặp biển. Bờ cát rộng và không gian thoáng đãng khiến nơi đây phù hợp cho một buổi dạo biển hoặc ngắm cảnh.' },
      { heading: 'Nhịp sống ven biển', body: 'Buổi sáng và chiều muộn, bãi biển thường gắn với các hoạt động đi bộ, vui chơi và sinh hoạt của người dân địa phương. Thời tiết và sắc nước thay đổi theo từng thời điểm trong ngày.' },
      { heading: 'Gợi ý khi tham quan', body: 'Kiểm tra cờ và biển báo an toàn trước khi xuống nước, chỉ bơi ở khu vực được cho phép. Giữ vệ sinh bãi biển và chú ý nắng nóng khi đi vào buổi trưa.' },
    ],
    image: { src: new URL('../../image/bien_nhat_le.jfif', import.meta.url).href, alt: 'Bờ biển Nhật Lệ ở Đồng Hới', caption: 'Bờ biển Nhật Lệ' },
  },
  'dong-hoi-market': {
    sections: [
      { heading: 'Một góc sinh hoạt địa phương', body: 'Chợ Đồng Hới là nơi người dân trao đổi thực phẩm và các mặt hàng thường ngày. Dạo quanh chợ giúp bạn quan sát nhịp sinh hoạt thường nhật của thành phố.' },
      { heading: 'Khám phá sản vật', body: 'Các quầy hàng thường bày bán hải sản, nông sản và những món ăn quen thuộc của địa phương. Hãy dành thời gian nhìn ngắm, hỏi người bán về sản phẩm và cách chế biến.' },
      { heading: 'Gợi ý khi tham quan', body: 'Nên đi vào buổi sáng để cảm nhận không khí chợ nhộn nhịp. Hỏi giá trước khi mua, xin phép trước khi chụp ảnh người bán và giữ lối đi thông thoáng.' },
    ],
    image: { src: new URL('../../image/images.jfif', import.meta.url).href, alt: 'Khung cảnh khu chợ Đồng Hới', caption: 'Không khí chợ địa phương ở Đồng Hới' },
  },
  'bao-ninh-village': {
    sections: [
      { heading: 'Làng biển bên kia sông', body: 'Bảo Ninh nằm bên kia sông Nhật Lệ, gắn với cảnh quan cửa sông và đời sống ven biển. Từ khu vực này có thể cảm nhận một góc nhìn khác về thành phố Đồng Hới.' },
      { heading: 'Đời sống làng chài', body: 'Nhịp sinh hoạt nơi đây gắn với biển, thuyền bè và công việc của cư dân địa phương. Quan sát khung cảnh ven bờ giúp chuyến đi thêm gần gũi với đời sống bản địa.' },
      { heading: 'Gợi ý khi tham quan', body: 'Tôn trọng không gian sinh hoạt và công việc của người dân. Nếu muốn chụp ảnh hoặc tìm hiểu hoạt động đánh bắt, hãy hỏi ý kiến trước và chú ý an toàn ở khu vực bến thuyền.' },
    ],
    image: { src: new URL('../../image/bao_ninh_beach.jfif', import.meta.url).href, alt: 'Cảnh quan ven biển Bảo Ninh', caption: 'Cảnh quan vùng biển Bảo Ninh' },
  },
  'vinh-moc-tunnels': {
    sections: [
      { heading: 'Di tích dưới lòng đất', body: 'Địa đạo Vịnh Mốc là một công trình lịch sử nằm gần bờ biển Vĩnh Linh. Hệ thống đường hầm gắn với cuộc sống và sự kiên cường của người dân địa phương trong những năm chiến tranh.' },
      { heading: 'Tìm hiểu cấu trúc địa đạo', body: 'Các lối đi và không gian bên trong cho thấy cách cộng đồng tổ chức sinh hoạt dưới lòng đất để tránh bom đạn. Tham quan di tích là dịp tìm hiểu lịch sử qua chính không gian còn được bảo tồn.' },
      { heading: 'Gợi ý khi tham quan', body: 'Một số đoạn hầm thấp hoặc hẹp; di chuyển chậm và chú ý bậc đi. Tôn trọng các khu vực trưng bày, không làm hư hại di tích và theo hướng dẫn của nhân viên.' },
    ],
    image: { src: new URL('../../image/dia_dao_vinh_moc.jfif', import.meta.url).href, alt: 'Lối vào khu di tích địa đạo Vịnh Mốc', caption: 'Di tích địa đạo Vịnh Mốc' },
  },
  'hien-luong-bridge': {
    sections: [
      { heading: 'Dòng sông và giới tuyến', body: 'Cầu Hiền Lương bắc qua sông Bến Hải, địa danh gắn với giới tuyến quân sự tạm thời sau Hiệp định Genève năm 1954. Cây cầu và dòng sông lưu giữ ký ức về một giai đoạn đất nước bị chia cắt.' },
      { heading: 'Biểu tượng của ngày đoàn tụ', body: 'Trong những năm chia cắt, nơi đây trở thành biểu tượng cho nỗi mong chờ sum họp. Ngày nay, quần thể di tích giúp người tham quan tìm hiểu những câu chuyện lịch sử gắn với hai bờ sông.' },
      { heading: 'Gợi ý khi tham quan', body: 'Dành thời gian đọc thông tin tại các điểm trưng bày để hiểu bối cảnh lịch sử. Giữ gìn không gian di tích và cẩn trọng khi đi gần bờ sông.' },
    ],
    image: { src: new URL('../../image/cau_hien_luong.jfif', import.meta.url).href, alt: 'Cầu Hiền Lương bắc qua sông Bến Hải', caption: 'Cầu Hiền Lương và sông Bến Hải' },
  },
  'quang-tri-citadel': {
    sections: [
      { heading: 'Dấu tích giữa lòng thành phố', body: 'Thành cổ Quảng Trị là di tích lịch sử nằm giữa trung tâm thành phố Quảng Trị. Những dấu tích còn lại gợi nhắc về các biến động của vùng đất này qua nhiều giai đoạn.' },
      { heading: 'Không gian tưởng niệm', body: 'Di tích đặc biệt gắn với những trận chiến khốc liệt năm 1972. Không gian tưởng niệm trong thành nhắc người tham quan về những mất mát của chiến tranh và giá trị của hòa bình.' },
      { heading: 'Gợi ý khi tham quan', body: 'Đây là địa điểm tưởng niệm; hãy giữ thái độ trang nghiêm, ăn mặc phù hợp và tuân thủ hướng dẫn tại khu di tích. Nếu chụp ảnh, tránh làm ảnh hưởng đến người đang tưởng niệm.' },
    ],
    image: { src: new URL('../../image/thanh_co_quang_tri.jfif', import.meta.url).href, alt: 'Di tích Thành cổ Quảng Trị', caption: 'Không gian Thành cổ Quảng Trị' },
  },
  'cua-tung-beach': {
    sections: [
      { heading: 'Bờ biển phía bắc Quảng Trị', body: 'Cửa Tùng là bãi biển ở phía bắc tỉnh Quảng Trị, nơi có thể dừng chân ngắm biển và quan sát nhịp sống ven bờ. Không gian biển thay đổi theo thời tiết và mùa trong năm.' },
      { heading: 'Một khoảng nghỉ bên biển', body: 'Bãi biển phù hợp cho những hoạt động thư giãn nhẹ nhàng như đi dạo, ngắm sóng và tận hưởng không khí biển. Đây cũng là nơi để cảm nhận vẻ đẹp tự nhiên của vùng duyên hải.' },
      { heading: 'Gợi ý khi tham quan', body: 'Chú ý biển báo, tình hình sóng và hướng dẫn an toàn tại bãi. Chỉ xuống nước ở khu vực an toàn, đồng thời thu gom rác trước khi rời đi.' },
    ],
    image: { src: new URL('../../image/bien_cua_tung.jfif', import.meta.url).href, alt: 'Bãi biển Cửa Tùng, Quảng Trị', caption: 'Bờ biển Cửa Tùng' },
  },
  'nuoc-mooc-spring': {
    sections: [
      { heading: 'Dòng suối giữa rừng xanh', body: 'Suối nước Moọc nằm trong cảnh quan núi đá vôi và rừng của khu vực Phong Nha. Dòng nước trong cùng không gian rợp bóng cây tạo nên điểm dừng chân thư giãn giữa thiên nhiên.' },
      { heading: 'Trải nghiệm thiên nhiên', body: 'Du khách có thể đi theo các lối tham quan để ngắm dòng suối và cảnh quan rừng xung quanh. Màu nước và ánh sáng thay đổi theo thời tiết, tạo nên vẻ riêng cho từng thời điểm.' },
      { heading: 'Gợi ý khi tham quan', body: 'Đi theo đường được đánh dấu, chú ý bề mặt trơn trượt và làm theo hướng dẫn an toàn. Không xả rác hoặc làm ảnh hưởng đến môi trường tự nhiên.' },
    ],
    image: { src: new URL('../../image/suoi_nuoc_moc.jfif', import.meta.url).href, alt: 'Dòng suối nước Moọc giữa rừng', caption: 'Suối nước Moọc' },
  },
  'da-nhay-beach': {
    sections: [
      { heading: 'Bờ biển với những khối đá', body: 'Bãi Đá Nhảy nằm trên bờ biển Quảng Bình, nổi bật với những khối đá có hình dáng đa dạng dọc theo bờ. Cảnh quan được tạo nên bởi sự tương tác lâu dài giữa đá, sóng và thủy triều.' },
      { heading: 'Cảnh sắc đổi thay theo thủy triều', body: 'Mực nước và sóng biển làm thay đổi những khoảng bờ có thể đi lại, vì vậy mỗi lần ghé thăm có thể mang đến một góc nhìn khác. Đây là địa điểm phù hợp để ngắm cảnh và chụp ảnh.' },
      { heading: 'Gợi ý khi tham quan', body: 'Đá ven biển có thể trơn và sắc cạnh; hãy đi giày phù hợp, quan sát sóng và tránh các khu vực nguy hiểm. Không leo lên đá khi điều kiện thời tiết hoặc thủy triều không an toàn.' },
    ],
    image: { src: new URL('../../image/bai_da_nhay.jfif', import.meta.url).href, alt: 'Các khối đá ven biển tại Bãi Đá Nhảy', caption: 'Những khối đá ven biển Bãi Đá Nhảy' },
  },
  'dark-cave': {
    sections: [
      { heading: 'Hang động trong Vườn quốc gia', body: 'Hang Tối nằm trong Vườn quốc gia Phong Nha – Kẻ Bàng, cạnh dòng sông Chày. Hang giữ nét tự nhiên, không lắp hệ thống đèn chiếu sáng bên trong.' },
      { heading: 'Trải nghiệm trên sông và trong hang', body: 'Các hoạt động tại khu du lịch có thể gồm chèo kayak, zipline và khám phá hang. Dịch vụ, điều kiện tham gia và giờ hoạt động có thể thay đổi theo mùa.' },
      { heading: 'Gợi ý khi tham quan', body: 'Kiểm tra thông tin hoạt động trước chuyến đi, sử dụng đầy đủ áo phao và thiết bị bảo hộ, làm theo hướng dẫn của nhân viên và không tự ý rời tuyến tham quan.' },
    ],
    image: { src: new URL('../../image/1707127136.jpg', import.meta.url).href, alt: 'Không gian hang động tại khu vực Phong Nha', caption: 'Hang động trong khu vực Phong Nha' },
  },
  'tien-son-cave': {
    sections: [
      { heading: 'Hang khô gần động Phong Nha', body: 'Động Tiên Sơn nằm gần động Phong Nha và thuộc quần thể hang động của khu vực. Đây là hang khô, có các vòm đá và thạch nhũ được hình thành qua thời gian dài.' },
      { heading: 'Một hành trình tham quan khác', body: 'Khác với tuyến thuyền trên sông ngầm ở động Phong Nha, hành trình tại Tiên Sơn chủ yếu đi bộ qua các lối và bậc tham quan trong hang.' },
      { heading: 'Gợi ý khi tham quan', body: 'Mang giày phù hợp, chú ý bậc và mặt đường ẩm, đi theo lối quy định và không chạm vào thạch nhũ để góp phần bảo tồn hang.' },
    ],
    image: { src: new URL('../../image/Grotte_Thien_Duong.jpg', import.meta.url).href, alt: 'Thạch nhũ trong một hang động ở Phong Nha', caption: 'Cảnh quan hang động Phong Nha' },
  },
  'ozo-park': {
    sections: [
      { heading: 'Không gian sinh thái Phong Nha', body: 'Công viên Ozo là điểm vui chơi sinh thái nằm giữa cảnh quan rừng của khu vực Phong Nha – Kẻ Bàng. Nơi đây kết hợp hoạt động ngoài trời với trải nghiệm thiên nhiên.' },
      { heading: 'Dành thời gian giữa thiên nhiên', body: 'Du khách có thể tản bộ, ngắm cảnh và tham gia các hoạt động được tổ chức trong khuôn viên. Loại hình dịch vụ có thể thay đổi theo mùa và điều kiện vận hành.' },
      { heading: 'Gợi ý khi tham quan', body: 'Kiểm tra giờ mở cửa và tình trạng hoạt động trước khi đến. Tuân thủ hướng dẫn an toàn, đi đúng khu vực cho phép và giữ gìn cảnh quan rừng.' },
    ],
    image: { src: new URL('../../image/suoi_nuoc_moc.jfif', import.meta.url).href, alt: 'Cảnh quan rừng xanh tại khu vực Phong Nha', caption: 'Thiên nhiên xanh vùng Phong Nha' },
  },
}
