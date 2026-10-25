# Quảng Trị

Ứng dụng khám phá địa điểm Quảng Trị – Quảng Bình với bản đồ, thuyết minh đa ngôn ngữ và hỗ trợ PWA.

## Chạy frontend

```powershell
cd clients\frontend
npm ci
npm run dev
```

Để quét mã QR từ điện thoại khi chạy bản cục bộ, hãy chạy `npm run dev` tại
thư mục gốc dự án và kết nối máy tính, điện thoại vào cùng mạng Wi-Fi. Ứng dụng
sẽ tạo mã QR trỏ tới địa chỉ mạng của máy tính.

## Chạy backend

Cần Docker Desktop và Docker Compose.

```powershell
docker compose -f server/compose.yml up --build
```

Gateway/API docs ở `http://localhost:8000` và `http://localhost:8000/docs`.
Backend gồm API Gateway, POI Service, Tour Service, Narration Service và
Analytics Service; mỗi service tách Presentation, Business/Application và Data Access. Tour Service
kiểm tra điểm dừng qua POI Service; Narration Service lấy nội dung theo locale
qua POI Service. Analytics Service lưu lượt ghé ẩn danh và đánh giá của người dùng.
Số lượt ghé và điểm đánh giá hiển thị trong thông tin của từng địa điểm; ứng dụng
không có chức năng quản trị hoặc số liệu bán vé. Xem [hướng dẫn backend](server/README.md)
để chạy từng service không cần Docker và chạy kiểm thử.

### Ngoại tuyến và hướng dẫn ứng xử

- Trên web, mở **Ngoại tuyến** để tải gói cho từng địa điểm/ngôn ngữ. Gói gồm lời thuyết minh, nội dung câu chuyện và ảnh chi tiết trong bộ nhớ IndexedDB; có thể gỡ từng gói. Giọng đọc là TTS của thiết bị/trình duyệt đã cài, không phải MP3 tải sẵn.
- Trên mobile, có thể lưu lời thuyết minh của địa điểm/ngôn ngữ đang chọn vào thiết bị để phát bằng Expo Speech khi mất mạng.
- Tại Thành cổ Quảng Trị, ứng dụng hiển thị gợi ý ứng xử theo buổi sáng/chiều/tối theo giờ Việt Nam. Đây không phải lịch nghi lễ hay thông báo sự kiện; hãy xác nhận giờ mở cửa và hoạt động với đơn vị quản lý.

### Chạy backend cục bộ bằng venv và PID (Windows)

Từ thư mục gốc dự án, tạo môi trường ảo và cài dependency một lần:

```powershell
py -3.12 -m venv venvs\.venv
.\venvs\.venv\Scripts\python.exe -m pip install -r server\requirements.txt
```

Khởi động các backend bằng venv; mỗi dịch vụ chạy nền và có PID riêng:

```powershell
npm run backend:start
```

Chạy frontend trong một terminal khác:

```powershell
npm --prefix clients\frontend run dev
```

Dừng các backend và xóa PID tương ứng:

```powershell
npm run backend:stop
```

PID được lưu trong `server\var\run\`, log trong `server\var\logs\`; dữ liệu
SQLite cục bộ nằm trong `server\var\`. Không chạy đồng thời cách này với
`npm run dev` (lệnh đó tự khởi chạy backend) hoặc Docker Compose, vì các phương
thức này cùng sử dụng các cổng backend.

## Chạy ứng dụng React Native

Nếu chạy lần đầu, cài dependency mobile một lần:

```powershell
npm ci --prefix clients\mobile
```

Chạy backend và Expo cùng lúc bằng một lệnh từ thư mục gốc:

```powershell
npm run mobile:dev
```

Khi Expo hiện menu, nhấn `a` để mở ứng dụng trên Android Emulator. Lệnh này
mặc định cấu hình API là `http://10.0.2.2:8000/api/v1` cho Android Emulator;
nhấn `Ctrl+C` để dừng Expo và các backend. Nếu biến `EXPO_PUBLIC_API_URL` đã
được đặt, script sẽ giữ nguyên giá trị đó. Cấu hình EAS bằng biến repository
`EAS_PROJECT_ID` và secret `EXPO_TOKEN` để bật native build trong GitHub Actions.

## Tài liệu đồ án

- [PRD — Quảng Trị](docs/PRD.md): yêu cầu sản phẩm, kiến trúc, luồng nghiệp vụ, API và CI/CD cho đủ ba phần của đồ án.
- [Bài thuyết minh](system-presentation-standalone.html): bài trình bày độc lập với ba phần, sơ đồ và đọc thuyết minh bằng bảy ngôn ngữ.
- `clients/frontend`: React.js PWA; `clients/mobile`: Expo/React Native; `server`: FastAPI ba lớp và các service giao tiếp qua HTTP.
- Trong thông tin mỗi địa điểm trên web/mobile có số lượt ghé do app ghi nhận trong 30 ngày gần nhất và điểm đánh giá. Lượt ghé chỉ được ghi nhận khi người dùng bật hướng dẫn GPS; backend kiểm tra khoảng cách 85 m, không lưu tọa độ và đếm tối đa một lượt cho mỗi thiết bị/điểm/ngày. Đây là số liệu ước tính, không phải tổng khách thực tế; GPS có thể bị giả mạo. Đánh giá không xác minh danh tính. Chưa có nguồn dữ liệu bán vé nên ứng dụng không hiển thị số vé.

## CI/CD

Workflow `Frontend CI/CD` tại `.github/workflows/frontend-ci-cd.yml`:

- Khi tạo/cập nhật pull request vào `main`: cài dependency bằng `npm ci`, kiểm tra TypeScript và build frontend.
- Khi push lên `main`: thực hiện build cho GitHub Pages, tạo fallback cho client-side routing, lưu artifact và tự động deploy.
- Có thể chạy thủ công bằng GitHub Actions (`workflow_dispatch`).

Để bật deploy lần đầu, vào **Settings → Pages** của repository và chọn **GitHub Actions** làm Build and deployment source. Workflow sử dụng đường dẫn base theo tên repository, nên phù hợp với GitHub Pages dạng project site.
