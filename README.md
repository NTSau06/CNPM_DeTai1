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
Số lượt ghé, điểm đánh giá và mục đặt vé thử nghiệm hiển thị trong thông tin
của từng địa điểm; trang quản trị tổng hợp thêm thống kê sử dụng. Xem
[hướng dẫn backend](server/README.md)
để chạy từng service không cần Docker và chạy kiểm thử.

### Trang quản trị

Trang admin ở đường dẫn `/admin` hiển thị tổng tài khoản người dùng, số tài khoản
đang hoạt động, lượt ghé 30 ngày gần nhất, số địa điểm và thống kê vé.
Trang được cập nhật định kỳ. Một tài khoản được tính đang hoạt động khi có ít
nhất một phiên đăng nhập còn hiệu lực; đăng nhập trên nhiều thiết bị vẫn chỉ
tính một tài khoản. Phiên hết hạn hoặc đã đăng xuất không được tính; khách chưa
đăng nhập không được tính. Đây là số liệu tài khoản có phiên đăng nhập, không
phải số người hiện diện được xác minh. Giao diện admin nằm trong `clients/frontend/src/admin/`; API dùng chung
và các endpoint quản trị nằm trong `clients/frontend/src/api.ts` và
`server/api_gateway/`. Admin có thể đặt giá vé VND theo địa điểm; để trống giá
rồi lưu sẽ đóng bán. Dashboard hiển thị số vé đã đặt, số đơn, doanh thu mô phỏng
và số vé theo điểm. Người dùng đăng nhập để đặt tối đa 10 vé mỗi lần và xem số
vé đã đặt ở địa điểm đang chọn. Đây là luồng thử nghiệm, không có thanh toán
online hoặc xác nhận vé thực tế. Giá mẫu mặc định nằm trong khoảng 70.000–150.000
VND và chỉ dùng để chạy thử; cần kiểm tra giá niêm yết với đơn vị quản lý trước
khi sử dụng thực tế.

Trước khi khởi động backend, cấu hình `ADMIN_EMAIL` và `ADMIN_PASSWORD` (mật khẩu
tối thiểu 12 ký tự) qua biến môi trường hoặc file `.env` cục bộ không đưa vào Git.
Tài khoản và phiên đăng nhập admin được lưu riêng trong `admin_accounts.sqlite`;
tài khoản người dùng và đơn vé vẫn nằm trong `accounts.sqlite`. Dữ liệu admin cũ
trùng email admin đang cấu hình được chuyển khỏi bảng người dùng khi gateway
khởi động, để không tính admin vào thống kê tài khoản người dùng. Gateway
tạo/cập nhật tài khoản quản trị theo cấu hình này khi khởi động. Với
Docker Compose, dùng cùng lệnh `docker compose -f server/compose.yml up --build`;
với script cục bộ, đặt hai biến trong PowerShell trước `npm run backend:start`.
Sau đó mở `http://localhost:5173/admin` và đăng nhập bằng tài khoản vừa cấu hình.
Không sử dụng mật khẩu mặc định hoặc chia sẻ file cấu hình chứa mật khẩu.

### Ngoại tuyến và hướng dẫn ứng xử

- Trên web, mở **Ngoại tuyến** để tải gói cho từng địa điểm/ngôn ngữ. Gói gồm lời thuyết minh, nội dung câu chuyện và ảnh chi tiết trong bộ nhớ IndexedDB; có thể gỡ từng gói. Audio player phát MP3 đã có cho địa điểm/ngôn ngữ tương ứng; nếu chưa có bản thu, ứng dụng dùng TTS của trình duyệt. Các MP3 trong ứng dụng web được cache để phát khi ngoại tuyến.
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
- Trong thông tin mỗi địa điểm trên web có số lượt ghé do app ghi nhận trong 30 ngày gần nhất, điểm đánh giá và mục đặt vé thử nghiệm. Lượt ghé chỉ được ghi nhận khi người dùng bật hướng dẫn GPS; backend kiểm tra khoảng cách 85 m, không lưu tọa độ và đếm tối đa một lượt cho mỗi thiết bị/điểm/ngày. Đây là số liệu ước tính, không phải tổng khách thực tế; GPS có thể bị giả mạo. Đánh giá không xác minh danh tính. Vé đặt trong luồng thử nghiệm chưa được thanh toán hoặc xác nhận sử dụng.

## CI/CD

Workflow `Frontend CI/CD` tại `.github/workflows/frontend-ci-cd.yml`:

- Khi tạo/cập nhật pull request vào `main`: cài dependency bằng `npm ci`, kiểm tra TypeScript và build frontend.
- Khi push lên `main`: thực hiện build cho GitHub Pages, tạo fallback cho client-side routing, lưu artifact và tự động deploy.
- Có thể chạy thủ công bằng GitHub Actions (`workflow_dispatch`).

Để bật deploy lần đầu, vào **Settings → Pages** của repository và chọn **GitHub Actions** làm Build and deployment source. Workflow sử dụng đường dẫn base theo tên repository, nên phù hợp với GitHub Pages dạng project site.
