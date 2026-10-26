// Nội dung bài viết và ảnh minh họa chi tiết cho các trang địa điểm.
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
      { heading: 'Dòng sông và dấu vết thời gian', body: 'Động Phong Nha thuộc vùng núi đá vôi Phong Nha – Kẻ Bàng. Nước mưa thấm qua đá trong thời gian dài, góp phần tạo nên hang, sông ngầm và nhiều dạng thạch nhũ. Khi thuyền đi từ ngoài trời vào lòng hang, bạn có thể để ý sự thay đổi của ánh sáng, nhiệt độ và âm thanh. Hãy quan sát từ thuyền thay vì chạm vào vách đá; những cấu trúc tự nhiên này rất dễ bị ảnh hưởng và hình thành chậm hơn nhiều so với một chuyến tham quan.' },
      { heading: 'Lắng nghe không gian', body: 'Thay vì chỉ tập trung chụp ảnh, hãy dành một lúc nhìn mặt nước và lắng nghe tiếng mái chèo, tiếng nước vang trong hang. Ánh sáng yếu khiến mắt cần thời gian thích nghi; hãy làm theo hướng dẫn của người lái thuyền và giữ đồ dùng chắc chắn. Điều kiện nước, lộ trình và thời gian tham quan có thể thay đổi theo thời tiết hoặc quy định vận hành, vì vậy hãy kiểm tra thông tin tại bến trước khi khởi hành.' },
      { heading: 'Gợi ý khi tham quan', body: 'Nên chuẩn bị áo khoác nhẹ vì trong hang thường mát hơn bên ngoài. Giữ gìn cảnh quan, không chạm hoặc lấy các cấu trúc tự nhiên và tuân theo hướng dẫn an toàn tại bến thuyền.' },
    ],
    image: { src: new URL('../../image/1707127136.jpg', import.meta.url).href, alt: 'Khung cảnh bên trong động Phong Nha', caption: 'Không gian hang động Phong Nha' },
  },
  'thien-duong-cave': {
    sections: [
      { heading: 'Con đường giữa rừng', body: 'Động Thiên Đường nằm trong vùng núi đá vôi và rừng thuộc khu vực Phong Nha – Kẻ Bàng. Lối đi xuyên qua tán cây đưa du khách từ không gian rừng xanh đến cửa hang.' },
      { heading: 'Những vòm đá kỳ vĩ', body: 'Bên trong hang là những vòm đá rộng cùng các lớp thạch nhũ với hình dáng đa dạng, được hình thành qua thời gian dài. Hệ thống lối đi giúp bạn quan sát hang động mà không bước lên nền đá tự nhiên.' },
      { heading: 'Quan sát những hình khối tự nhiên', body: 'Hãy để ý sự khác nhau giữa cột đá, rèm thạch nhũ và những vòm hang rộng. Các hình dáng ấy được tạo nên qua quá trình địa chất kéo dài, không phải vật trang trí nhân tạo. Mỗi người có thể liên tưởng chúng đến những hình ảnh khác nhau; điều quan trọng là quan sát mà không chạm vào bề mặt. Lối đi được bố trí để khách có thể ngắm cảnh mà hạn chế tác động lên nền hang và cấu trúc đá.' },
      { heading: 'Chuẩn bị cho quãng tham quan', body: 'Chuyến đi có thể gồm thời gian di chuyển ngoài trời và đi bộ trong hang. Hãy mang giày dễ đi, chia sức hợp lý và chú ý bậc thang, nhất là khi ánh sáng thay đổi. Có thể dừng ở những điểm được phép để ngắm vòm hang, nhưng tránh chắn lối hoặc tự ý rời tuyến. Giờ hoạt động và điều kiện tham quan thay đổi theo quy định tại chỗ; hãy kiểm tra thông tin mới nhất trước khi đến.' },
      { heading: 'Gợi ý khi tham quan', body: 'Hãy mang giày dễ đi, dành đủ thời gian cho chặng đường tham quan và đi theo lối quy định. Không chạm vào thạch nhũ, đồng thời tuân thủ hướng dẫn của khu du lịch.' },
    ],
    image: { src: new URL('../../image/Grotte_Thien_Duong.jpg', import.meta.url).href, alt: 'Các khối thạch nhũ trong động Thiên Đường', caption: 'Thạch nhũ trong động Thiên Đường' },
  },
  'nhat-le-beach': {
    sections: [
      { heading: 'Bãi biển bên thành phố', body: 'Bãi biển Nhật Lệ nằm gần trung tâm Đồng Hới, nơi sông Nhật Lệ gặp biển. Bờ cát rộng và không gian thoáng đãng khiến nơi đây phù hợp cho một buổi dạo biển hoặc ngắm cảnh.' },
      { heading: 'Nhịp sống ven biển', body: 'Buổi sáng và chiều muộn, bãi biển thường gắn với các hoạt động đi bộ, vui chơi và sinh hoạt của người dân địa phương. Thời tiết và sắc nước thay đổi theo từng thời điểm trong ngày.' },
      { heading: 'Nơi dòng sông gặp biển', body: 'Nhật Lệ gắn với cảnh quan cửa sông và bờ biển gần trung tâm Đồng Hới. Hãy quan sát đường chân trời, mặt nước và sự đổi màu theo ánh sáng trong ngày. Bãi biển cũng là không gian sinh hoạt chung, nơi người dân đi dạo, vui chơi và làm việc. Khi chụp ảnh, hãy tôn trọng sự riêng tư của người khác và giữ lối đi thông thoáng.' },
      { heading: 'Một buổi ghé biển an toàn', body: 'Trước khi xuống nước, hãy xem cờ cảnh báo và biển báo tại bãi; sóng và dòng chảy có thể thay đổi nhanh. Chỉ bơi ở khu vực được phép, không bơi một mình và để trẻ nhỏ trong tầm quan sát. Nếu chỉ đi dạo, tránh nắng gắt, mang nước uống và thu gom rác khi rời bãi. Điều kiện tắm biển và dịch vụ có thể thay đổi theo ngày, nên ưu tiên hướng dẫn tại chỗ.' },
      { heading: 'Gợi ý khi tham quan', body: 'Kiểm tra cờ và biển báo an toàn trước khi xuống nước, chỉ bơi ở khu vực được cho phép. Giữ vệ sinh bãi biển và chú ý nắng nóng khi đi vào buổi trưa.' },
    ],
    image: { src: new URL('../../image/bien_nhat_le.jfif', import.meta.url).href, alt: 'Bờ biển Nhật Lệ ở Đồng Hới', caption: 'Bờ biển Nhật Lệ' },
  },
  'dong-hoi-market': {
    sections: [
      { heading: 'Một góc sinh hoạt địa phương', body: 'Chợ Đồng Hới là nơi người dân trao đổi thực phẩm và các mặt hàng thường ngày. Dạo quanh chợ giúp bạn quan sát nhịp sinh hoạt thường nhật của thành phố.' },
      { heading: 'Khám phá sản vật', body: 'Các quầy hàng thường bày bán hải sản, nông sản và những món ăn quen thuộc của địa phương. Hãy dành thời gian nhìn ngắm, hỏi người bán về sản phẩm và cách chế biến.' },
      { heading: 'Nhịp điệu của khu chợ', body: 'Hãy đi chậm qua các lối và quan sát cách hàng hóa được bày theo loại, màu sắc và mùa vụ. Chợ là nơi làm việc của nhiều người, vì vậy không chạm vào sản phẩm khi chưa hỏi, tránh đứng chắn lối và giữ đồ dùng cá nhân cẩn thận. Nếu muốn tìm hiểu một nguyên liệu hoặc món ăn, bạn có thể hỏi người bán một cách lịch sự.' },
      { heading: 'Thưởng thức có trách nhiệm', body: 'Hãy hỏi giá và khẩu phần trước khi gọi món, đặc biệt với hải sản tính theo cân. Nếu có dị ứng thực phẩm hoặc chế độ ăn riêng, trao đổi rõ với người bán. Xin phép trước khi chụp ảnh người khác, bỏ rác đúng chỗ và tôn trọng không gian buôn bán. Giờ đông khách và mặt hàng có thể thay đổi từng ngày; hãy xem đây là dịp quan sát đời sống thường nhật hơn là một danh sách món ăn cố định.' },
      { heading: 'Gợi ý khi tham quan', body: 'Nên đi vào buổi sáng để cảm nhận không khí chợ nhộn nhịp. Hỏi giá trước khi mua, xin phép trước khi chụp ảnh người bán và giữ lối đi thông thoáng.' },
    ],
    image: { src: new URL('../../image/images.jfif', import.meta.url).href, alt: 'Khung cảnh khu chợ Đồng Hới', caption: 'Không khí chợ địa phương ở Đồng Hới' },
  },
  'bao-ninh-village': {
    sections: [
      { heading: 'Làng biển bên kia sông', body: 'Bảo Ninh nằm bên kia sông Nhật Lệ, gắn với cảnh quan cửa sông và đời sống ven biển. Từ khu vực này có thể cảm nhận một góc nhìn khác về thành phố Đồng Hới.' },
      { heading: 'Đời sống làng chài', body: 'Nhịp sinh hoạt nơi đây gắn với biển, thuyền bè và công việc của cư dân địa phương. Quan sát khung cảnh ven bờ giúp chuyến đi thêm gần gũi với đời sống bản địa.' },
      { heading: 'Góc nhìn từ bên kia sông', body: 'Từ Bảo Ninh, cảnh quan Đồng Hới hiện ra qua dòng Nhật Lệ và vùng cửa biển. Hãy để ý sự thay đổi của ánh sáng trên mặt nước, đường bờ và hoạt động ven sông. Những chi tiết đời thường ấy cho thấy mối liên hệ giữa cộng đồng với biển và sông, nhưng công việc cụ thể có thể thay đổi theo mùa.' },
      { heading: 'Tôn trọng đời sống địa phương', body: 'Làng biển là nơi người dân sinh sống và làm việc. Nếu muốn tìm hiểu nghề cá hoặc chụp ảnh thuyền bè, hãy hỏi ý kiến trước, không tự ý lên thuyền hay bước vào khu vực riêng. Chú ý an toàn gần bến và mép nước, đồng thời mang rác theo mình. Một chuyến ghé thăm lịch sự giúp bạn tận hưởng cảnh quan mà không làm ảnh hưởng sinh hoạt của cộng đồng.' },
      { heading: 'Gợi ý khi tham quan', body: 'Tôn trọng không gian sinh hoạt và công việc của người dân. Nếu muốn chụp ảnh hoặc tìm hiểu hoạt động đánh bắt, hãy hỏi ý kiến trước và chú ý an toàn ở khu vực bến thuyền.' },
    ],
    image: { src: new URL('../../image/bao_ninh_beach.jfif', import.meta.url).href, alt: 'Cảnh quan ven biển Bảo Ninh', caption: 'Cảnh quan vùng biển Bảo Ninh' },
  },
  'vinh-moc-tunnels': {
    sections: [
      { heading: 'Di tích dưới lòng đất', body: 'Địa đạo Vịnh Mốc là một công trình lịch sử nằm gần bờ biển Vĩnh Linh. Hệ thống đường hầm gắn với cuộc sống và sự kiên cường của người dân địa phương trong những năm chiến tranh.' },
      { heading: 'Tìm hiểu cấu trúc địa đạo', body: 'Các lối đi và không gian bên trong cho thấy cách cộng đồng tổ chức sinh hoạt dưới lòng đất để tránh bom đạn. Tham quan di tích là dịp tìm hiểu lịch sử qua chính không gian còn được bảo tồn.' },
      { heading: 'Quan sát không gian sinh hoạt', body: 'Khi đi qua các nhánh hầm, hãy chú ý cách lối đi nối những không gian khác nhau và hình dung việc tổ chức đời sống trong điều kiện khó khăn. Hãy kết hợp quan sát với nội dung thuyết minh chính thức tại di tích, không suy diễn từ một chi tiết riêng lẻ. Đi chậm để chú ý nền và độ cao của hầm; không cần chạm vào hiện vật hay vách để cảm nhận không gian.' },
      { heading: 'Tham quan với sự tôn trọng', body: 'Dành thời gian đọc bảng thông tin và nghe hướng dẫn để hiểu bối cảnh lịch sử. Một số đoạn có thể thấp, hẹp hoặc thiếu sáng; người có hạn chế vận động nên tìm hiểu điều kiện tiếp cận trước chuyến đi. Giữ yên tĩnh, không làm hư hại di tích và đi theo tuyến quy định. Nếu có hoạt động tưởng niệm hoặc đoàn tham quan, hãy nhường lối và tuân theo chỉ dẫn của nhân viên.' },
      { heading: 'Gợi ý khi tham quan', body: 'Một số đoạn hầm thấp hoặc hẹp; di chuyển chậm và chú ý bậc đi. Tôn trọng các khu vực trưng bày, không làm hư hại di tích và theo hướng dẫn của nhân viên.' },
    ],
    image: { src: new URL('../../image/dia_dao_vinh_moc.jfif', import.meta.url).href, alt: 'Lối vào khu di tích địa đạo Vịnh Mốc', caption: 'Di tích địa đạo Vịnh Mốc' },
  },
  'hien-luong-bridge': {
    sections: [
      { heading: 'Dòng sông và giới tuyến', body: 'Cầu Hiền Lương bắc qua sông Bến Hải, địa danh gắn với giới tuyến quân sự tạm thời sau Hiệp định Genève năm 1954. Cây cầu và dòng sông lưu giữ ký ức về một giai đoạn đất nước bị chia cắt.' },
      { heading: 'Biểu tượng của ngày đoàn tụ', body: 'Trong những năm chia cắt, nơi đây trở thành biểu tượng cho nỗi mong chờ sum họp. Ngày nay, quần thể di tích giúp người tham quan tìm hiểu những câu chuyện lịch sử gắn với hai bờ sông.' },
      { heading: 'Dòng sông trong bối cảnh lịch sử', body: 'Cầu Hiền Lương bắc qua sông Bến Hải, gắn với giới tuyến quân sự tạm thời sau Hiệp định Genève năm 1954. Khi đứng bên bờ, hãy quan sát dòng sông và các hạng mục di tích như một không gian lịch sử thống nhất. Đọc bảng giới thiệu tại chỗ để hiểu vai trò của từng phần và bối cảnh của giai đoạn đất nước bị chia cắt.' },
      { heading: 'Ký ức và giá trị của hòa bình', body: 'Những câu chuyện gắn với cây cầu nhắc người tham quan về các gia đình từng sống xa cách và mong ngày đoàn tụ. Hãy lắng nghe thuyết minh với thái độ cởi mở, đồng thời tôn trọng những người đến tưởng niệm. Giữ giọng nói vừa phải, không làm hư hại hiện vật và chú ý an toàn khi đi gần bờ sông. Thông tin tại khu di tích là nguồn tốt nhất để tìm hiểu sâu hơn.' },
      { heading: 'Gợi ý khi tham quan', body: 'Dành thời gian đọc thông tin tại các điểm trưng bày để hiểu bối cảnh lịch sử. Giữ gìn không gian di tích và cẩn trọng khi đi gần bờ sông.' },
    ],
    image: { src: new URL('../../image/cau_hien_luong.jfif', import.meta.url).href, alt: 'Cầu Hiền Lương bắc qua sông Bến Hải', caption: 'Cầu Hiền Lương và sông Bến Hải' },
  },
  'quang-tri-citadel': {
    sections: [
      { heading: 'Dấu tích giữa lòng thành phố', body: 'Thành cổ Quảng Trị là di tích lịch sử nằm giữa trung tâm thành phố Quảng Trị. Những dấu tích còn lại gợi nhắc về các biến động của vùng đất này qua nhiều giai đoạn.' },
      { heading: 'Không gian tưởng niệm', body: 'Di tích đặc biệt gắn với những trận chiến khốc liệt năm 1972. Không gian tưởng niệm trong thành nhắc người tham quan về những mất mát của chiến tranh và giá trị của hòa bình.' },
      { heading: 'Tìm hiểu di tích qua dấu tích', body: 'Thành cổ Quảng Trị gắn với những biến cố lịch sử, đặc biệt là các trận chiến năm 1972. Hãy kết hợp quan sát khuôn viên với thông tin tại bảng giới thiệu và tư liệu chính thức để hiểu bối cảnh; tránh suy diễn lịch sử từ một chi tiết riêng lẻ. Những dấu tích còn lại nằm trong một không gian tưởng niệm rộng hơn, nhắc đến mất mát mà chiến tranh để lại cho nhiều gia đình và cộng đồng.' },
      { heading: 'Một khoảng lặng tưởng niệm', body: 'Nhiều người đến đây để tưởng nhớ người đã khuất hoặc tìm hiểu lịch sử. Hãy giữ thái độ trang nghiêm, nhường lối khi có hoạt động tưởng niệm và tránh gây ồn. Có thể đi chậm quanh khuôn viên, đọc thông tin và dành thời gian suy ngẫm về giá trị của hòa bình. Giờ mở cửa và hoạt động tại di tích có thể thay đổi, vì vậy nên kiểm tra hướng dẫn của đơn vị quản lý trước khi đến.' },
      { heading: 'Gợi ý khi tham quan', body: 'Đây là địa điểm tưởng niệm; hãy giữ thái độ trang nghiêm, ăn mặc phù hợp và tuân thủ hướng dẫn tại khu di tích. Nếu chụp ảnh, tránh làm ảnh hưởng đến người đang tưởng niệm.' },
    ],
    image: { src: new URL('../../image/thanh_co_quang_tri.jfif', import.meta.url).href, alt: 'Di tích Thành cổ Quảng Trị', caption: 'Không gian Thành cổ Quảng Trị' },
  },
  'cua-tung-beach': {
    sections: [
      { heading: 'Bờ biển phía bắc Quảng Trị', body: 'Cửa Tùng là bãi biển ở phía bắc tỉnh Quảng Trị, nơi có thể dừng chân ngắm biển và quan sát nhịp sống ven bờ. Không gian biển thay đổi theo thời tiết và mùa trong năm.' },
      { heading: 'Một khoảng nghỉ bên biển', body: 'Bãi biển phù hợp cho những hoạt động thư giãn nhẹ nhàng như đi dạo, ngắm sóng và tận hưởng không khí biển. Đây cũng là nơi để cảm nhận vẻ đẹp tự nhiên của vùng duyên hải.' },
      { heading: 'Quan sát biển theo từng thời điểm', body: 'Cửa Tùng có thể mang sắc thái khác nhau khi ánh sáng, gió và sóng thay đổi. Hãy dành thời gian đi dạo, ngắm đường chân trời và lắng nghe tiếng sóng mà không cần vội vã. Bãi biển cũng là một phần của môi trường tự nhiên và không gian sinh hoạt địa phương; tránh làm phiền người khác và không lấy sinh vật hay vật liệu tự nhiên làm kỷ niệm.' },
      { heading: 'Chuẩn bị trước khi xuống nước', body: 'Xem cờ cảnh báo và biển báo tại chỗ; chỉ bơi trong khu vực được phép và không ra xa bờ khi sóng lớn. Trẻ nhỏ cần luôn có người lớn quan sát. Nếu chỉ đi dạo, chú ý nắng nóng và cát nóng, mang nước uống và thu gom rác. Tình trạng bãi tắm có thể thay đổi theo mùa và thời tiết, nên làm theo hướng dẫn hiện hành tại địa phương.' },
      { heading: 'Gợi ý khi tham quan', body: 'Chú ý biển báo, tình hình sóng và hướng dẫn an toàn tại bãi. Chỉ xuống nước ở khu vực an toàn, đồng thời thu gom rác trước khi rời đi.' },
    ],
    image: { src: new URL('../../image/bien_cua_tung.jfif', import.meta.url).href, alt: 'Bãi biển Cửa Tùng, Quảng Trị', caption: 'Bờ biển Cửa Tùng' },
  },
  'nuoc-mooc-spring': {
    sections: [
      { heading: 'Dòng suối giữa rừng xanh', body: 'Suối nước Moọc nằm trong cảnh quan núi đá vôi và rừng của khu vực Phong Nha. Dòng nước trong cùng không gian rợp bóng cây tạo nên điểm dừng chân thư giãn giữa thiên nhiên.' },
      { heading: 'Trải nghiệm thiên nhiên', body: 'Du khách có thể đi theo các lối tham quan để ngắm dòng suối và cảnh quan rừng xung quanh. Màu nước và ánh sáng thay đổi theo thời tiết, tạo nên vẻ riêng cho từng thời điểm.' },
      { heading: 'Suối trong cảnh quan rừng', body: 'Suối nước Moọc nằm giữa địa hình đá vôi và rừng của vùng Phong Nha. Hãy quan sát màu nước, tán cây và ánh sáng từ lối tham quan; cảnh sắc có thể khác nhau theo thời tiết. Nước nhìn trong không có nghĩa mọi khu vực đều an toàn để bơi, vì dòng chảy và mực nước có thể thay đổi.' },
      { heading: 'Giữ gìn môi trường tự nhiên', body: 'Đi theo lối được đánh dấu, không bẻ cây, hái hoa, cho động vật ăn hoặc để lại thức ăn và bao bì. Nếu tham gia hoạt động dưới nước, sử dụng áo phao và tuân theo chỉ dẫn của nhân viên. Đường có thể ẩm trơn nên cần giày phù hợp, đặc biệt khi đi cùng trẻ nhỏ. Kiểm tra tình trạng hoạt động và quy định an toàn trước khi khởi hành.' },
      { heading: 'Gợi ý khi tham quan', body: 'Đi theo đường được đánh dấu, chú ý bề mặt trơn trượt và làm theo hướng dẫn an toàn. Không xả rác hoặc làm ảnh hưởng đến môi trường tự nhiên.' },
    ],
    image: { src: new URL('../../image/suoi_nuoc_moc.jfif', import.meta.url).href, alt: 'Dòng suối nước Moọc giữa rừng', caption: 'Suối nước Moọc' },
  },
  'da-nhay-beach': {
    sections: [
      { heading: 'Bờ biển với những khối đá', body: 'Bãi Đá Nhảy nằm trên bờ biển Quảng Bình, nổi bật với những khối đá có hình dáng đa dạng dọc theo bờ. Cảnh quan được tạo nên bởi sự tương tác lâu dài giữa đá, sóng và thủy triều.' },
      { heading: 'Cảnh sắc đổi thay theo thủy triều', body: 'Mực nước và sóng biển làm thay đổi những khoảng bờ có thể đi lại, vì vậy mỗi lần ghé thăm có thể mang đến một góc nhìn khác. Đây là địa điểm phù hợp để ngắm cảnh và chụp ảnh.' },
      { heading: 'Những hình khối do biển tạo nên', body: 'Đá, sóng và thủy triều cùng tạo nên đường nét riêng của Bãi Đá Nhảy. Khi mực nước thay đổi, một số khoảng đá có thể lộ ra hoặc bị sóng phủ kín. Hãy quan sát từ vị trí vững chắc trên bờ; bề mặt ướt có thể rất trơn và các cạnh đá có thể sắc.' },
      { heading: 'Chụp ảnh an toàn', body: 'Không đứng sát mép sóng hoặc leo lên mỏm đá để chụp ảnh; sóng bất ngờ có thể khiến bạn mất thăng bằng. Trẻ nhỏ cần có người lớn đi cùng. Xem dự báo thời tiết, chú ý biển báo và rời khỏi bãi đá nếu biển động. Không di chuyển đá, khắc chữ hoặc lấy sinh vật làm kỷ niệm; hãy thu gom rác để giữ cảnh quan sạch.' },
      { heading: 'Gợi ý khi tham quan', body: 'Đá ven biển có thể trơn và sắc cạnh; hãy đi giày phù hợp, quan sát sóng và tránh các khu vực nguy hiểm. Không leo lên đá khi điều kiện thời tiết hoặc thủy triều không an toàn.' },
    ],
    image: { src: new URL('../../image/bai_da_nhay.jfif', import.meta.url).href, alt: 'Các khối đá ven biển tại Bãi Đá Nhảy', caption: 'Những khối đá ven biển Bãi Đá Nhảy' },
  },
  'dark-cave': {
    sections: [
      { heading: 'Hang động trong Vườn quốc gia', body: 'Hang Tối nằm trong Vườn quốc gia Phong Nha – Kẻ Bàng, cạnh dòng sông Chày. Hang giữ nét tự nhiên, không lắp hệ thống đèn chiếu sáng bên trong.' },
      { heading: 'Trải nghiệm trên sông và trong hang', body: 'Các hoạt động tại khu du lịch có thể gồm chèo kayak, zipline và khám phá hang. Dịch vụ, điều kiện tham gia và giờ hoạt động có thể thay đổi theo mùa.' },
      { heading: 'Khám phá hang trong điều kiện tự nhiên', body: 'Hang Tối không có hệ thống chiếu sáng nhân tạo như nhiều hang du lịch khác. Đặc điểm này giữ không gian gần với tự nhiên nhưng cũng đòi hỏi khách tham quan đi theo hướng dẫn, sử dụng trang bị được cung cấp và không tự ý tách khỏi nhóm. Nếu không thoải mái với bóng tối, nước hoặc hoạt động thể lực, hãy trao đổi với nhân viên trước khi đăng ký.' },
      { heading: 'An toàn trên sông Chày', body: 'Các hoạt động ngoài trời và điều kiện vận hành có thể thay đổi. Trước khi tham gia chèo thuyền, zipline hoặc khám phá hang, hãy hỏi về yêu cầu sức khỏe, giới hạn tham gia và trang bị bảo hộ. Mặc áo phao đúng cách, kiểm tra khóa cài và làm theo hiệu lệnh. Thời tiết và mực nước có thể ảnh hưởng đến lịch hoạt động; không cố tham gia nếu điều kiện không an toàn.' },
      { heading: 'Gợi ý khi tham quan', body: 'Kiểm tra thông tin hoạt động trước chuyến đi, sử dụng đầy đủ áo phao và thiết bị bảo hộ, làm theo hướng dẫn của nhân viên và không tự ý rời tuyến tham quan.' },
    ],
    image: { src: new URL('../../image/1707127136.jpg', import.meta.url).href, alt: 'Không gian hang động tại khu vực Phong Nha', caption: 'Hang động trong khu vực Phong Nha' },
  },
  'tien-son-cave': {
    sections: [
      { heading: 'Hang khô gần động Phong Nha', body: 'Động Tiên Sơn nằm gần động Phong Nha và thuộc quần thể hang động của khu vực. Đây là hang khô, có các vòm đá và thạch nhũ được hình thành qua thời gian dài.' },
      { heading: 'Một hành trình tham quan khác', body: 'Khác với tuyến thuyền trên sông ngầm ở động Phong Nha, hành trình tại Tiên Sơn chủ yếu đi bộ qua các lối và bậc tham quan trong hang.' },
      { heading: 'Hang khô trong quần thể Phong Nha', body: 'Động Tiên Sơn nằm gần động Phong Nha nhưng mang đến trải nghiệm khác: thay vì đi thuyền trên sông ngầm, khách chủ yếu đi bộ qua các không gian khô và bậc tham quan. Sự khác biệt giúp bạn hình dung sự đa dạng của hang động trong cùng một vùng địa hình. Hãy đọc thông tin tại chỗ để hiểu thêm về cấu trúc và tuyến tham quan.' },
      { heading: 'Đi bộ và bảo tồn', body: 'Mang giày có độ bám tốt, đi chậm ở bậc thang và những đoạn đường ẩm. Giữ khoảng cách với nhóm phía trước, dùng tay vịn nếu có và không chạm vào thạch nhũ. Các cấu trúc đá hình thành trong thời gian dài và rất dễ bị ảnh hưởng. Người có hạn chế vận động hoặc không thoải mái với không gian kín nên tìm hiểu điều kiện tuyến trước khi đến.' },
      { heading: 'Gợi ý khi tham quan', body: 'Mang giày phù hợp, chú ý bậc và mặt đường ẩm, đi theo lối quy định và không chạm vào thạch nhũ để góp phần bảo tồn hang.' },
    ],
    image: { src: new URL('../../image/Grotte_Thien_Duong.jpg', import.meta.url).href, alt: 'Thạch nhũ trong một hang động ở Phong Nha', caption: 'Cảnh quan hang động Phong Nha' },
  },
  'ozo-park': {
    sections: [
      { heading: 'Không gian sinh thái Phong Nha', body: 'Công viên Ozo là điểm vui chơi sinh thái nằm giữa cảnh quan rừng của khu vực Phong Nha – Kẻ Bàng. Nơi đây kết hợp hoạt động ngoài trời với trải nghiệm thiên nhiên.' },
      { heading: 'Dành thời gian giữa thiên nhiên', body: 'Du khách có thể tản bộ, ngắm cảnh và tham gia các hoạt động được tổ chức trong khuôn viên. Loại hình dịch vụ có thể thay đổi theo mùa và điều kiện vận hành.' },
      { heading: 'Khám phá theo nhịp của khu rừng', body: 'Hãy bắt đầu bằng một quãng đi bộ thong thả, quan sát tán cây và lắng nghe âm thanh tự nhiên. Nếu muốn tham gia hoạt động ngoài trời, chọn trải nghiệm phù hợp với thể lực và đọc kỹ hướng dẫn trước khi bắt đầu. Trời mưa có thể làm đường trơn hoặc ảnh hưởng lịch hoạt động; hỏi nhân viên về tuyến đang mở và tránh khu vực hạn chế.' },
      { heading: 'Du lịch sinh thái có trách nhiệm', body: 'Giữ âm lượng vừa phải, bỏ rác đúng nơi và không bẻ cây, khắc lên thân cây hay cho động vật ăn. Xin phép trước khi chụp ảnh người khác. Dịch vụ trong khu sinh thái có thể thay đổi theo mùa, lượng khách và điều kiện an toàn, nên kiểm tra tình trạng hoạt động trước khi khởi hành.' },
      { heading: 'Gợi ý khi tham quan', body: 'Kiểm tra giờ mở cửa và tình trạng hoạt động trước khi đến. Tuân thủ hướng dẫn an toàn, đi đúng khu vực cho phép và giữ gìn cảnh quan rừng.' },
    ],
    image: { src: new URL('../../image/suoi_nuoc_moc.jfif', import.meta.url).href, alt: 'Cảnh quan rừng xanh tại khu vực Phong Nha', caption: 'Thiên nhiên xanh vùng Phong Nha' },
  },
}
