# DFD hệ thống “Khám phá & Thuyết minh du lịch Quảng Trị – Quảng Bình”

Nguồn: [PRD_DoAn_QuangTri.docx](file:///c:/Users/DELL/Desktop/CNPM_DeTai1/docs/PRD_DoAn_QuangTri.docx), đối chiếu với [api.py](file:///c:/Users/DELL/Desktop/CNPM_DeTai1/server/api_gateway/api.py).

**Ký hiệu:** hình chữ nhật = tác nhân ngoài · hình bo tròn = tiến trình · hình trụ = kho dữ liệu · mũi tên = luồng dữ liệu.

## 0. Tác nhân ngoài & kho dữ liệu

| Mã | Tên | Ghi chú |
|---|---|---|
| **DU** | Du khách (nội địa, quốc tế, ngoại tuyến) | Dùng Web PWA / Mobile |
| **QT** | Quản trị viên (`is_admin = 1`) | Dùng cổng `/admin` |
| **TB** | Thiết bị (GPS, TTS/Speech, bộ nhớ) | Cảm biến & dịch vụ của thiết bị |
| **D1** | Tài khoản & Phiên | `accounts.sqlite` (users, auth_sessions) |
| **D2** | Địa điểm & Bản địa hóa | `poi-service.sqlite` (places, 7 locale) |
| **D3** | Hành trình | `tour-service.sqlite` |
| **D4** | Lượt ghé – Đánh giá – Hiện diện | `analytics-service.sqlite` |
| **D5** | Kho ngoại tuyến trên thiết bị | IndexedDB / AsyncStorage (gói địa điểm, MP3, PMTiles, tour cache) |

---

## 1. DFD mức 0 – Sơ đồ ngữ cảnh

```mermaid
flowchart LR
    DU["Du khách"]
    QT["Quản trị viên"]
    TB["Thiết bị (GPS / TTS / bộ nhớ)"]
    SYS(("0. Hệ thống Quảng Trị<br/>Khám phá & Thuyết minh"))

    DU -->|"Thông tin đăng ký/đăng nhập, hồ sơ, từ khóa, ngôn ngữ, điểm dừng, đánh giá, yêu cầu tải gói"| SYS
    SYS -->|"Phiên đăng nhập, danh sách & chi tiết địa điểm, thuyết minh, gợi ý ứng xử, hành trình, thống kê điểm, gói ngoại tuyến"| DU
    QT -->|"Đăng nhập, lệnh quản lý tài khoản/địa điểm"| SYS
    SYS -->|"Dashboard, danh sách tài khoản, kết quả quản trị"| QT
    TB -->|"Tọa độ GPS, trạng thái mạng, dung lượng còn trống"| SYS
    SYS -->|"Văn bản cần đọc (TTS), lệnh phát MP3, dữ liệu ghi vào bộ nhớ"| TB
```

---

## 2. DFD mức 1 – Phân rã hệ thống thành 8 tiến trình

```mermaid
flowchart TB
    DU["Du khách"]
    QT["Quản trị viên"]
    TB["Thiết bị"]

    P1(("1.0 Xác thực &<br/>tài khoản"))
    P2(("2.0 Khám phá địa điểm<br/>& bản đồ"))
    P3(("3.0 Thuyết minh<br/>đa ngôn ngữ"))
    P4(("4.0 Gợi ý ứng xử<br/>văn hóa"))
    P5(("5.0 Lập & lưu<br/>hành trình"))
    P6(("6.0 Quản lý<br/>gói ngoại tuyến"))
    P7(("7.0 Thống kê ẩn danh<br/>& đánh giá"))
    P8(("8.0 Quản trị<br/>hệ thống"))

    D1[("D1 Tài khoản & Phiên")]
    D2[("D2 Địa điểm & Bản địa hóa")]
    D3[("D3 Hành trình")]
    D4[("D4 Lượt ghé - Đánh giá - Hiện diện")]
    D5[("D5 Kho ngoại tuyến thiết bị")]

    DU -->|"đăng ký, đăng nhập, hồ sơ, mật khẩu"| P1
    P1 -->|"token, thông tin người dùng"| DU
    P1 <-->|"tài khoản, phiên"| D1

    DU -->|"từ khóa, bộ lọc, chọn địa điểm"| P2
    P2 -->|"danh sách, chi tiết, bản đồ"| DU
    TB -->|"vị trí GPS"| P2
    D2 -->|"địa điểm"| P2

    DU -->|"chọn ngôn ngữ, bấm nghe"| P3
    P3 -->|"âm thanh / văn bản thuyết minh"| DU
    P3 -->|"văn bản TTS, lệnh phát"| TB
    TB -->|"GPS vào bán kính 85 m"| P3
    D2 -->|"nội dung theo locale"| P3
    D5 -->|"thuyết minh, MP3 đã tải"| P3

    D2 -->|"thông tin Thành cổ"| P4
    TB -->|"giờ hệ thống"| P4
    P4 -->|"thẻ gợi ý theo buổi"| DU

    DU -->|"điểm dừng, yêu cầu lưu/xóa"| P5
    P5 -->|"hành trình, quãng đường, thời lượng"| DU
    P5 <-->|"hành trình"| D3
    D2 -->|"tọa độ điểm dừng"| P5
    P5 -.->|"kiểm tra token"| P1

    DU -->|"chọn địa điểm/ngôn ngữ, tệp PMTiles"| P6
    P6 -->|"danh sách gói, kết quả"| DU
    D2 -->|"nội dung & ảnh"| P6
    TB -->|"dung lượng, trạng thái mạng"| P6
    P6 <-->|"gói ngoại tuyến"| D5

    DU -->|"đánh giá"| P7
    TB -->|"GPS, heartbeat"| P7
    P7 -->|"lượt ghé, điểm TB, số người online"| DU
    P7 <-->|"lượt ghé, đánh giá, hiện diện"| D4
    D2 -->|"tọa độ điểm"| P7

    QT -->|"lệnh quản trị"| P8
    P8 -->|"dashboard, danh sách, kết quả"| QT
    P8 <-->|"tài khoản"| D1
    P8 <-->|"địa điểm"| D2
    P8 -->|"xóa hành trình theo chủ sở hữu"| D3
    D4 -->|"số liệu tổng hợp"| P8
```

---

## 3. DFD mức 2 – Phân rã từng tiến trình

### 3.1 Tiến trình 1.0 – Xác thực & tài khoản

```mermaid
flowchart LR
    DU["Du khách"]
    D1[("D1 Tài khoản & Phiên")]

    P11(("1.1 Kiểm tra<br/>dữ liệu đăng ký"))
    P12(("1.2 Tạo tài khoản<br/>(băm scrypt)"))
    P13(("1.3 Xác thực<br/>đăng nhập"))
    P14(("1.4 Cấp phiên<br/>Bearer 30 ngày"))
    P15(("1.5 Xác thực phiên<br/>/ khôi phục"))
    P16(("1.6 Cập nhật<br/>hồ sơ"))
    P17(("1.7 Đổi mật khẩu"))
    P18(("1.8 Đăng xuất"))

    DU -->|"họ tên, email, SĐT, mật khẩu"| P11
    P11 -->|"lỗi 422"| DU
    P11 -->|"dữ liệu hợp lệ"| P12
    D1 -->|"email đã tồn tại?"| P12
    P12 -->|"user + salt + hash"| D1
    P12 -->|"user_id"| P14

    DU -->|"email, mật khẩu"| P13
    D1 -->|"salt, hash"| P13
    P13 -->|"sai thông tin 401"| DU
    P13 -->|"user_id"| P14

    P14 -->|"token băm SHA-256, hạn dùng"| D1
    P14 -->|"token, user"| DU

    DU -->|"Bearer token"| P15
    D1 -->|"phiên, user"| P15
    P15 -->|"user hiện tại / 401"| DU

    DU -->|"hồ sơ mới + token"| P16
    P15 -.->|"user_id"| P16
    P16 -->|"họ tên, SĐT, ngày sinh, giới tính, địa chỉ"| D1
    P16 -->|"hồ sơ đã lưu"| DU

    DU -->|"mật khẩu cũ, mật khẩu mới + token"| P17
    D1 -->|"salt, hash hiện tại"| P17
    P17 -->|"salt/hash mới, xóa phiên cũ"| D1
    P17 -->|"token mới / 403"| DU

    DU -->|"yêu cầu đăng xuất + token"| P18
    P18 -->|"xóa phiên"| D1
    P18 -->|"204"| DU
```

### 3.2 Tiến trình 2.0 – Khám phá địa điểm & bản đồ

```mermaid
flowchart LR
    DU["Du khách"]
    TB["Thiết bị (GPS)"]
    D2[("D2 Địa điểm & Bản địa hóa")]
    D5[("D5 Kho ngoại tuyến")]

    P21(("2.1 Liệt kê, tìm kiếm<br/>& lọc địa điểm"))
    P22(("2.2 Xem chi tiết<br/>địa điểm"))
    P23(("2.3 Hiển thị<br/>bản đồ"))
    P24(("2.4 Định vị &<br/>tính khoảng cách"))

    DU -->|"từ khóa, danh mục"| P21
    D2 -->|"danh sách địa điểm"| P21
    P21 -->|"danh sách đã lọc"| DU
    P21 -->|"danh sách đã lọc"| P23

    DU -->|"chọn địa điểm"| P22
    D2 -->|"chi tiết, câu chuyện"| P22
    D5 -->|"ảnh/nội dung đã tải"| P22
    P22 -->|"thông tin chi tiết"| DU

    D5 -->|"bản đồ PMTiles (nếu có)"| P23
    P23 -->|"bản đồ + điểm đánh dấu"| DU

    TB -->|"kinh độ, vĩ độ"| P24
    D2 -->|"tọa độ điểm"| P24
    P24 -->|"khoảng cách (m)"| DU
    P24 -->|"vị trí hiện tại"| P23
```

### 3.3 Tiến trình 3.0 – Thuyết minh đa ngôn ngữ

```mermaid
flowchart LR
    DU["Du khách"]
    TB["Thiết bị (GPS, TTS, loa)"]
    D2[("D2 Địa điểm & Bản địa hóa")]
    D5[("D5 Kho ngoại tuyến")]

    P31(("3.1 Chọn<br/>ngôn ngữ"))
    P32(("3.2 Lấy nội dung<br/>thuyết minh theo locale"))
    P33(("3.3 Chọn nguồn phát<br/>MP3 / TTS"))
    P34(("3.4 Phát<br/>thuyết minh"))
    P35(("3.5 Tự động phát<br/>khi vào 85 m"))

    DU -->|"mã ngôn ngữ"| P31
    P31 -->|"locale"| P32
    D2 -->|"title, story, narration"| P32
    D5 -->|"thuyết minh đã tải"| P32
    P32 -->|"văn bản + locale"| P33

    D5 -->|"MP3 đã cache"| P33
    P33 -->|"URL MP3 hoặc văn bản TTS"| P34
    DU -->|"bấm nghe / dừng"| P34
    P34 -->|"lệnh phát MP3, đọc TTS"| TB
    P34 -->|"trạng thái phát"| DU

    TB -->|"vị trí GPS"| P35
    D2 -->|"tọa độ điểm"| P35
    P35 -->|"yêu cầu phát điểm gần"| P32
```

### 3.4 Tiến trình 4.0 – Gợi ý ứng xử văn hóa

```mermaid
flowchart LR
    DU["Du khách"]
    TB["Thiết bị (đồng hồ)"]
    D2[("D2 Địa điểm")]

    P41(("4.1 Nhận diện<br/>Thành cổ Quảng Trị"))
    P42(("4.2 Xác định buổi<br/>theo giờ UTC+7"))
    P43(("4.3 Hiển thị gợi ý<br/>& lưu ý"))

    DU -->|"địa điểm đang xem"| P41
    D2 -->|"mã địa điểm"| P41
    P41 -->|"là Thành cổ?"| P43
    TB -->|"thời gian hiện tại"| P42
    P42 -->|"sáng / chiều / tối"| P43
    P43 -->|"thẻ gợi ý + ghi chú không phải lịch lễ"| DU
```

### 3.5 Tiến trình 5.0 – Lập & lưu hành trình

```mermaid
flowchart LR
    DU["Du khách"]
    D1[("D1 Tài khoản & Phiên")]
    D2[("D2 Địa điểm")]
    D3[("D3 Hành trình")]

    P51(("5.1 Xác thực<br/>chủ sở hữu"))
    P52(("5.2 Chọn / bỏ<br/>điểm dừng"))
    P53(("5.3 Kiểm tra điểm<br/>dừng hợp lệ"))
    P54(("5.4 Tính quãng đường<br/>& thời lượng"))
    P55(("5.5 Lưu<br/>hành trình"))
    P56(("5.6 Xem danh sách<br/>hành trình"))
    P57(("5.7 Xóa<br/>hành trình"))

    DU -->|"Bearer token"| P51
    D1 -->|"phiên"| P51
    P51 -->|"user_id / 401"| P52
    P51 -.->|"user_id"| P56
    P51 -.->|"user_id"| P57

    DU -->|"điểm dừng"| P52
    P52 -->|"danh sách placeIds"| P53
    D2 -->|"điểm tồn tại?"| P53
    P53 -->|"lỗi điểm lạ"| DU
    P53 -->|"placeIds hợp lệ"| P54
    D2 -->|"tọa độ, thời lượng"| P54
    P54 -->|"km, phút"| P55
    P55 -->|"tour + ownerId"| D3
    P55 -->|"hành trình đã lưu"| DU

    D3 -->|"tour của chủ sở hữu"| P56
    P56 -->|"danh sách hành trình"| DU

    DU -->|"mã tour"| P57
    P57 -->|"xóa tour theo owner"| D3
    P57 -->|"204"| DU
```

### 3.6 Tiến trình 6.0 – Quản lý gói ngoại tuyến

```mermaid
flowchart LR
    DU["Du khách"]
    TB["Thiết bị (bộ nhớ, mạng)"]
    D2[("D2 Địa điểm")]
    D5[("D5 Kho ngoại tuyến")]

    P61(("6.1 Chọn địa điểm<br/>& ngôn ngữ gói"))
    P62(("6.2 Tải nội dung<br/>& ảnh"))
    P63(("6.3 Kiểm tra<br/>dung lượng"))
    P64(("6.4 Lưu gói<br/>địa điểm"))
    P65(("6.5 Nhập bản đồ<br/>PMTiles"))
    P66(("6.6 Liệt kê / gỡ<br/>gói"))
    P67(("6.7 Cache App Shell<br/>& phục vụ offline"))

    DU -->|"địa điểm, ngôn ngữ"| P61
    P61 -->|"yêu cầu tải"| P62
    D2 -->|"văn bản, ảnh"| P62
    P62 -->|"kích thước gói"| P63
    TB -->|"quota, usage"| P63
    P63 -->|"không đủ chỗ"| DU
    P63 -->|"gói hợp lệ"| P64
    P64 -->|"OfflinePlacePack"| D5
    P64 -->|"thông báo sẵn sàng"| DU

    DU -->|"tệp .pmtiles"| P65
    P65 -->|"kiểm tra header & vector layers; lưu bản đồ"| D5
    P65 -->|"kết quả nhập"| DU

    D5 -->|"gói đã lưu"| P66
    DU -->|"yêu cầu gỡ"| P66
    P66 -->|"xóa gói"| D5
    P66 -->|"danh sách gói, dung lượng"| DU

    TB -->|"mất mạng"| P67
    D5 -->|"shell, MP3 cache"| P67
    P67 -->|"ứng dụng chạy offline"| DU
```

### 3.7 Tiến trình 7.0 – Thống kê ẩn danh & đánh giá

```mermaid
flowchart LR
    DU["Du khách"]
    TB["Thiết bị (GPS)"]
    D2[("D2 Địa điểm")]
    D4[("D4 Lượt ghé - Đánh giá - Hiện diện")]

    P71(("7.1 Ghi nhận<br/>heartbeat"))
    P72(("7.2 Đếm thiết bị<br/>online 5 phút"))
    P73(("7.3 Kiểm tra<br/>bán kính 85 m"))
    P74(("7.4 Băm visitor &<br/>chống trùng 1 lượt/ngày"))
    P75(("7.5 Ghi<br/>lượt ghé"))
    P76(("7.6 Lưu / sửa<br/>đánh giá"))
    P77(("7.7 Tổng hợp<br/>thống kê địa điểm"))

    TB -->|"visitorId"| P71
    P71 -->|"hash + last_seen"| D4
    D4 -->|"hiện diện trong 5 phút"| P72
    P72 -->|"số người online"| DU

    TB -->|"visitorId + tọa độ"| P73
    D2 -->|"tọa độ điểm"| P73
    P73 -->|"ngoài 85 m: lỗi 422"| DU
    P73 -->|"visitorId, placeId"| P74
    D4 -->|"lượt ghé đã có trong ngày"| P74
    P74 -->|"lượt ghé mới"| P75
    P75 -->|"place_id, visitor_hash, ngày"| D4

    DU -->|"1-5 sao, nhận xét, visitorId"| P76
    P76 -->|"đánh giá (1 / thiết bị / điểm)"| D4

    D4 -->|"visits 30 ngày, ratings"| P77
    P77 -->|"lượt ghé, điểm TB, nhận xét"| DU
```

### 3.8 Tiến trình 8.0 – Quản trị hệ thống

```mermaid
flowchart LR
    QT["Quản trị viên"]
    D1[("D1 Tài khoản & Phiên")]
    D2[("D2 Địa điểm")]
    D3[("D3 Hành trình")]
    D4[("D4 Thống kê")]

    P81(("8.1 Kiểm tra<br/>quyền admin"))
    P82(("8.2 Tổng hợp<br/>dashboard"))
    P83(("8.3 Liệt kê<br/>tài khoản"))
    P84(("8.4 Xóa tài khoản<br/>& hành trình"))
    P85(("8.5 Thêm<br/>địa điểm"))
    P86(("8.6 Sửa<br/>địa điểm"))
    P87(("8.7 Xóa<br/>địa điểm"))

    QT -->|"Bearer token"| P81
    D1 -->|"phiên, is_admin"| P81
    P81 -->|"403 nếu không phải admin"| QT
    P81 -.->|"admin hợp lệ"| P82
    P81 -.->|"admin hợp lệ"| P83
    P81 -.->|"admin hợp lệ"| P84
    P81 -.->|"admin hợp lệ"| P85
    P81 -.->|"admin hợp lệ"| P86
    P81 -.->|"admin hợp lệ"| P87

    D4 -->|"online, lượt ghé, đánh giá"| P82
    D2 -->|"số địa điểm"| P82
    P82 -->|"dashboard"| QT

    D1 -->|"danh sách user"| P83
    P83 -->|"danh sách tài khoản"| QT

    QT -->|"mã user cần xóa"| P84
    D1 -->|"kiểm tra tự xóa / admin cuối"| P84
    P84 -->|"xóa tour theo chủ sở hữu"| D3
    P84 -->|"xóa user + phiên"| D1
    P84 -->|"kết quả / lỗi 409, 422"| QT

    QT -->|"dữ liệu địa điểm mới"| P85
    P85 -->|"place + 7 bản dịch"| D2
    QT -->|"dữ liệu chỉnh sửa"| P86
    P86 -->|"cập nhật place"| D2
    QT -->|"mã địa điểm xóa"| P87
    D2 -->|"đếm số địa điểm còn lại"| P87
    P87 -->|"xóa place (không xóa cuối cùng)"| D2
    P85 -->|"kết quả"| QT
    P86 -->|"kết quả"| QT
    P87 -->|"kết quả"| QT
```

---

## 4. Vì sao dừng ở mức 2 (tiến trình nguyên tố)

Mỗi tiến trình mức 2 chỉ thực hiện **một** hành động nghiệp vụ, có đầu vào/đầu ra xác định, tương ứng một hàm hoặc một endpoint (ví dụ `AuthRepository.register`, `PlaceCatalog.list`, `TourPlanner.plan`, `_distance_meters`). Nếu phân rã tiếp sẽ chỉ còn các bước lập trình (truy vấn SQL, băm, so sánh chuỗi), không còn là luồng dữ liệu nghiệp vụ nữa.

### Từ điển tiến trình nguyên tố

| Mã | Tiến trình | Đầu vào | Đầu ra | Kho | Endpoint / thành phần |
|---|---|---|---|---|---|
| 1.1 | Kiểm tra dữ liệu đăng ký | họ tên, email, mật khẩu ≥ 8 ký tự | hợp lệ / 422 | – | `RegisterRequest` |
| 1.2 | Tạo tài khoản | dữ liệu hợp lệ | user | D1 | `POST /auth/register` |
| 1.3 | Xác thực đăng nhập | email, mật khẩu | user_id / 401 | D1 | `POST /auth/login` |
| 1.4 | Cấp phiên 30 ngày | user_id | token | D1 | `_create_session` |
| 1.5 | Xác thực phiên | Bearer token | user / 401 | D1 | `GET /auth/me` |
| 1.6 | Cập nhật hồ sơ | hồ sơ mới | hồ sơ đã lưu | D1 | `PUT /auth/me` |
| 1.7 | Đổi mật khẩu | mật khẩu cũ/mới | token mới / 403 | D1 | `POST /auth/change-password` |
| 1.8 | Đăng xuất | token | 204 | D1 | `POST /auth/logout` |
| 2.1 | Liệt kê, tìm kiếm, lọc | từ khóa, danh mục | danh sách | D2 | `GET /places` |
| 2.2 | Xem chi tiết | mã địa điểm | chi tiết | D2, D5 | `GET /places/{id}` |
| 2.3 | Hiển thị bản đồ | danh sách, PMTiles | bản đồ | D5 | `MapView` |
| 2.4 | Định vị, tính khoảng cách | GPS, tọa độ điểm | mét | D2 | Turf `distance` |
| 3.1 | Chọn ngôn ngữ | mã ngôn ngữ | locale | – | `setLanguage` |
| 3.2 | Lấy nội dung thuyết minh | placeId, locale | văn bản | D2, D5 | `GET /narrations/{id}` |
| 3.3 | Chọn nguồn phát | văn bản, MP3 | MP3 hoặc TTS | D5 | `speech.ts` |
| 3.4 | Phát thuyết minh | lệnh nghe/dừng | âm thanh | – | `AudioPlayer`, Expo Speech |
| 3.5 | Tự động phát khi vào 85 m | GPS, tọa độ | yêu cầu phát | D2 | `ExplorePage` |
| 4.1 | Nhận diện Thành cổ | mã địa điểm | cờ Thành cổ | D2 | `RitualGuidancePanel` |
| 4.2 | Xác định buổi | giờ UTC+7 | sáng/chiều/tối | – | `getVietnamHour` |
| 4.3 | Hiển thị gợi ý | cờ, buổi | thẻ gợi ý | – | `RitualGuidancePanel` |
| 5.1 | Xác thực chủ sở hữu | token | user_id | D1 | `authenticated_user` |
| 5.2 | Chọn / bỏ điểm dừng | thao tác chọn | placeIds | – | `setRoutePlace` |
| 5.3 | Kiểm tra điểm dừng | placeIds | hợp lệ / lỗi | D2 | `TourPlanner` → POI |
| 5.4 | Tính km và phút | tọa độ, thời lượng | km, phút | D2 | `TourPlanner` |
| 5.5 | Lưu hành trình | tour, ownerId | tour đã lưu | D3 | `POST /tours` |
| 5.6 | Xem danh sách | user_id | danh sách tour | D3 | `GET /tours` |
| 5.7 | Xóa hành trình | mã tour, user_id | 204 | D3 | `DELETE /tours/{id}` |
| 6.1 | Chọn địa điểm, ngôn ngữ gói | lựa chọn | yêu cầu tải | – | `SettingsPage` |
| 6.2 | Tải nội dung, ảnh | yêu cầu | blob + văn bản | D2 | `fetch` |
| 6.3 | Kiểm tra dung lượng | size, quota | đủ / không | – | `navigator.storage` |
| 6.4 | Lưu gói | gói hợp lệ | gói đã lưu | D5 | `saveOfflinePlacePack` |
| 6.5 | Nhập PMTiles | tệp .pmtiles | bản đồ offline | D5 | `importMap` |
| 6.6 | Liệt kê, gỡ gói | yêu cầu | danh sách | D5 | `deleteOfflinePlacePack` |
| 6.7 | Cache App Shell | mạng đứt | chạy offline | D5 | Workbox `sw.ts` |
| 7.1 | Ghi nhận heartbeat | visitorId | last_seen | D4 | `POST /analytics/presence` |
| 7.2 | Đếm online 5 phút | hiện diện | số online | D4 | `GET /analytics/presence` |
| 7.3 | Kiểm tra 85 m | tọa độ, điểm | hợp lệ / 422 | D2 | `_distance_meters` |
| 7.4 | Băm visitor, chống trùng | visitorId, placeId | lượt mới | D4 | analytics repository |
| 7.5 | Ghi lượt ghé | lượt mới | bản ghi | D4 | `POST /analytics/visits` |
| 7.6 | Lưu / sửa đánh giá | sao, nhận xét | tổng hợp | D4 | `POST /analytics/ratings` |
| 7.7 | Tổng hợp thống kê | placeId | lượt, điểm TB | D4 | `GET /places/{id}/analytics`, `/ratings` |
| 8.1 | Kiểm tra quyền admin | token | admin / 403 | D1 | `admin_user` |
| 8.2 | Tổng hợp dashboard | – | số liệu | D2, D4 | `GET /admin/overview` |
| 8.3 | Liệt kê tài khoản | – | danh sách | D1 | `GET /admin/users` |
| 8.4 | Xóa tài khoản + tour | user_id | kết quả | D1, D3 | `DELETE /admin/users/{id}` |
| 8.5 | Thêm địa điểm | place | kết quả | D2 | `POST /admin/places` |
| 8.6 | Sửa địa điểm | place | kết quả | D2 | `PUT /admin/places/{id}` |
| 8.7 | Xóa địa điểm | placeId | kết quả | D2 | `DELETE /admin/places/{id}` |

Tổng cộng **8 tiến trình mức 1** và **52 tiến trình nguyên tố mức 2**.

---

## 5. Kiểm tra cân bằng giữa các mức

| Tiến trình mức 1 | Luồng vào/ra ở mức 1 | Đã xuất hiện đủ ở mức 2 |
|---|---|---|
| 1.0 | đăng ký, đăng nhập, hồ sơ, mật khẩu ↔ token, user; D1 | ✔ 1.1 → 1.8 |
| 2.0 | từ khóa, chọn địa điểm, GPS, D2 ↔ danh sách, chi tiết, bản đồ | ✔ 2.1 → 2.4 |
| 3.0 | ngôn ngữ, bấm nghe, GPS, D2, D5 ↔ âm thanh, văn bản, lệnh TTS | ✔ 3.1 → 3.5 |
| 4.0 | D2, giờ hệ thống ↔ thẻ gợi ý | ✔ 4.1 → 4.3 |
| 5.0 | điểm dừng, D1 (kiểm tra token), D2, D3 ↔ hành trình | ✔ 5.1 → 5.7 |
| 6.0 | lựa chọn gói, PMTiles, D2, quota mạng/bộ nhớ, D5 ↔ danh sách gói | ✔ 6.1 → 6.7 |
| 7.0 | đánh giá, GPS, heartbeat, D2, D4 ↔ thống kê | ✔ 7.1 → 7.7 |
| 8.0 | lệnh quản trị, D1, D2, D3, D4 ↔ dashboard, kết quả | ✔ 8.1 → 8.7 |

> [!NOTE]
> Ở mức 1, tiến trình 5.0 và 8.0 chỉ vẽ nét đứt/mũi tên tới D1 để biểu diễn việc kiểm tra token. Ở mức 2, việc này được tách thành tiến trình riêng (5.1 và 8.1) nên các luồng vẫn cân bằng.

> [!IMPORTANT]
> Các kho D1–D4 là cơ sở dữ liệu SQLite riêng của từng service ở backend. D5 chỉ nằm trên thiết bị người dùng, không đồng bộ lên server.
