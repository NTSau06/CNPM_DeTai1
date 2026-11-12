# Quảng Trị

Ứng dụng khám phá địa điểm Quảng Trị – Quảng Bình với bản đồ, thuyết minh đa ngôn ngữ và hỗ trợ PWA.

## 1. Yêu cầu môi trường (Khi chạy trên máy mới)

Trước khi chạy dự án, máy tính cần cài đặt sẵn:

1. **Node.js** (khuyến nghị bản LTS $\ge 18$; kiểm tra bằng `node -v` và `npm -v`).
2. **Python 3.12** (hoặc Python 3.11+; kiểm tra bằng `py -3.12 --version` hoặc `python --version`).
3. **SQL Server** (mặc định kết nối tới `localhost\SQLEXPRESS`; database `QuangTriDB` sẽ được hệ thống tự động tạo khi khởi động).
4. **ODBC Driver 18 for SQL Server** (thư viện kết nối SQL Server cho Python `pyodbc`).

> **Lưu ý:** Nếu SQL Server trên máy của bạn không dùng tên instance `localhost\SQLEXPRESS`, hãy đặt biến môi trường `SQLSERVER_CONNECTION_STRING` trong PowerShell trước khi chạy backend, ví dụ:
> ```powershell
> $env:SQLSERVER_CONNECTION_STRING = "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost;DATABASE=QuangTriDB;Trusted_Connection=yes;TrustServerCertificate=yes;"
> ```

---

## 2. Cài đặt lần đầu (Sau khi `git clone` từ GitHub về)

Mở **PowerShell** tại **thư mục gốc dự án (`CNPM_DeTai1`)** và chạy lần lượt các lệnh sau:

```powershell
# Bước 1: Cài đặt thư viện cho Frontend
npm ci --prefix clients\frontend

# Bước 2: Tạo môi trường ảo Python tại thư mục venvs\.venv
py -3.12 -m venv venvs\.venv
# (Nếu máy không nhận lệnh "py -3.12", hãy dùng: python -m venv venvs\.venv)

# Bước 3: Cài đặt thư viện cho Backend vào môi trường ảo
.\venvs\.venv\Scripts\python.exe -m pip install -r server\requirements.txt
```

---

## 3. Chạy ứng dụng Web (Backend + Frontend)

> **Quan trọng:** Không chỉ chạy riêng `npm run dev` bên trong `clients\frontend` khi chưa bật Backend, vì như vậy cổng `8000`–`8004` chưa mở và Vite sẽ báo lỗi `http proxy error ... ECONNREFUSED`. Hãy dùng một trong các cách dưới đây:

### Cách 1: Chạy đồng thời cả Backend và Frontend bằng 1 lệnh (Khuyên dùng)

Đứng tại **thư mục gốc dự án (`CNPM_DeTai1`)**, chạy:

```powershell
npm run dev
```

* Lệnh này tự động khởi chạy đủ 5 service Backend (`8000`–`8004`) và Frontend (`http://localhost:5173`).
* Để quét mã QR từ điện thoại khi chạy bản cục bộ, chỉ cần kết nối máy tính và điện thoại vào cùng mạng Wi-Fi; ứng dụng sẽ tự tạo mã QR trỏ tới địa chỉ IP LAN của máy tính.
* Để dừng toàn bộ frontend và các backend cục bộ, chạy từ thư mục gốc:
  ```powershell
  npm run stop:local
  ```
  Lệnh chỉ dừng tiến trình có câu lệnh khớp với service của dự án trên các cổng `5173` và `8000`–`8004`; tiến trình khác đang dùng các cổng này sẽ được giữ lại.

### Cách 2: Chạy Backend nền bằng venv và PID, chạy Frontend riêng (Windows)

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

PID được lưu trong `server\var\run\`, log trong `server\var\logs\`; dữ liệu SQL Server nằm ở `localhost\SQLEXPRESS` (database `QuangTriDB`). Không chạy đồng thời cách này với `npm run dev` ở thư mục gốc hoặc Docker Compose, vì các phương thức này cùng sử dụng các cổng backend.

### Cách 3: Chạy Backend bằng Docker Compose

Cần Docker Desktop và Docker Compose:

```powershell
docker compose -f server/compose.yml up --build
```

*(Nếu có file `.env` tùy chỉnh cấu hình, dùng `docker compose --env-file .env -f server/compose.yml up --build`).*

---

## 4. Kiến trúc Backend & Trang quản trị

Gateway/API docs ở `http://localhost:8000` và `http://localhost:8000/docs`.
Backend gồm API Gateway, POI Service, Tour Service, Narration Service và Analytics Service; mỗi service tách Presentation, Business/Application và Data Access. Tour Service kiểm tra điểm dừng qua POI Service; Narration Service lấy nội dung theo locale qua POI Service. Analytics Service lưu trạng thái online ẩn danh, lượt ghé và đánh giá của người dùng. Số lượt ghé, điểm đánh giá và mục đặt vé thử nghiệm hiển thị trong thông tin của từng địa điểm; trang quản trị tổng hợp thêm thống kê sử dụng, quản lý tài khoản và danh mục địa điểm. Xem [hướng dẫn backend](server/README.md) để chạy từng service riêng lẻ và chạy kiểm thử.

### Trang quản trị (`/admin`)

Trang admin ở đường dẫn `/admin` hiển thị tổng tài khoản người dùng, số tài khoản đang hoạt động, số người đang online, lượt ghé 30 ngày gần nhất, số địa điểm và thống kê vé. Trang được cập nhật định kỳ. Một tài khoản được tính đang hoạt động khi có ít nhất một phiên đăng nhập còn hiệu lực; đăng nhập trên nhiều thiết bị vẫn chỉ tính một tài khoản. Phiên hết hạn hoặc đã đăng xuất không được tính; khách chưa đăng nhập không được tính.

Admin có thể đặt giá vé VND theo địa điểm; để trống giá rồi lưu sẽ đóng bán. Dashboard hiển thị số vé đã đặt, số đơn, doanh thu mô phỏng và số vé theo điểm. Người dùng đăng nhập để đặt tối đa 10 vé mỗi lần và xem số vé đã đặt ở địa điểm đang chọn. Đây là luồng thử nghiệm, không có thanh toán online hoặc xác nhận vé thực tế. Giá mẫu mặc định nằm trong khoảng 70.000–150.000 VND và chỉ dùng để chạy thử; cần kiểm tra giá niêm yết với đơn vị quản lý trước khi sử dụng thực tế.

Có 2 cách cấp quyền tài khoản Admin:

* **Cách A (Biến môi trường):** Trước khi khởi động backend, cấu hình `ADMIN_EMAIL` và `ADMIN_PASSWORD` qua biến môi trường hoặc file `.env` cục bộ không đưa vào Git. Gateway sẽ tự tạo/cập nhật tài khoản quản trị theo cấu hình này khi khởi động.
* **Cách B (Cập nhật trực tiếp trong SQL Server):** Đăng ký tài khoản trên web trước, sau đó kiểm tra `id` trong bảng `users` (database `QuangTriDB`):
  ```powershell
  sqlcmd -S .\SQLEXPRESS -E -d QuangTriDB -Q "SELECT id, email, is_admin FROM users"
  ```
  Sau khi xác minh đúng tài khoản, cập nhật cờ `is_admin = 1` theo `id`, rồi đăng xuất và đăng nhập lại:
  ```powershell
  $adminId = "ID_DA_XAC_MINH"
  sqlcmd -S .\SQLEXPRESS -E -d QuangTriDB -Q "UPDATE users SET is_admin = 1 WHERE id = '$adminId'"
  ```

### Chỉ đường và tối ưu lộ trình

Thêm ít nhất hai điểm vào hành trình để hiện nút **Tối ưu lộ trình**. Ứng dụng sắp xếp các điểm theo khoảng cách đường bộ ngắn nhất, ưu tiên vị trí hiện tại nếu ứng dụng đã xác định được vị trí; nếu chưa có vị trí, điểm đầu tiên trong hành trình được giữ làm điểm xuất phát. Thứ tự mới được lưu vào hành trình và tuyến đường bộ hiển thị trên bản đồ. Cần có kết nối mạng để tính khoảng cách và tìm tuyến đường.

Để chỉ đường giữa hai địa danh bất kỳ, nhấn nút **Chỉ đường giữa hai địa danh** trên bản đồ, chọn điểm xuất phát và điểm đến rồi nhấn **Tìm đường**. Tuyến đường bộ sẽ hiển thị trên bản đồ; thao tác này không cần bật GPS. Nút **Chỉ đường đến điểm này** vẫn dùng để vẽ tuyến từ vị trí hiện tại đến địa điểm đang chọn.

### Ngoại tuyến và hướng dẫn ứng xử

- Trên web, mở **Ngoại tuyến** để tải gói cho từng địa điểm/ngôn ngữ. Gói gồm lời thuyết minh, nội dung câu chuyện và ảnh chi tiết trong bộ nhớ IndexedDB; có thể gỡ từng gói. Audio player phát MP3 đã có cho địa điểm/ngôn ngữ tương ứng; nếu chưa có bản thu, ứng dụng dùng TTS của trình duyệt. Các MP3 trong ứng dụng web được cache để phát khi ngoại tuyến.
- Trên mobile, có thể lưu lời thuyết minh của địa điểm/ngôn ngữ đang chọn vào thiết bị để phát bằng Expo Speech khi mất mạng.
- Tại Thành cổ Quảng Trị, ứng dụng hiển thị gợi ý ứng xử theo buổi sáng/chiều/tối theo giờ Việt Nam. Đây không phải lịch nghi lễ hay thông báo sự kiện; hãy xác nhận giờ mở cửa và hoạt động với đơn vị quản lý.

---

## 5. Chạy ứng dụng React Native (Mobile)

Nếu chạy lần đầu, cài dependency mobile một lần:

```powershell
npm ci --prefix clients\mobile
```

Chạy backend và Expo cùng lúc bằng một lệnh từ thư mục gốc:

```powershell
npm run mobile:dev
```

Lệnh mặc định dùng IP LAN của máy tính và mở API Gateway cho điện thoại thật. Kết nối điện thoại và máy tính cùng Wi-Fi, rồi quét mã QR bằng Expo Go. Mở địa chỉ `http://<IP-LAN>:8000/docs` trên điện thoại để kiểm tra kết nối API. Nếu Windows Firewall chặn, cho phép Node.js và Python trên mạng riêng đang dùng.

Nếu máy có nhiều card mạng, chạy `.\run-mobile.ps1 -LanAddress <IP-Wi-Fi>`. Để dùng Android Emulator, chạy `.\run-mobile.ps1 -Emulator` (API `http://10.0.2.2:8000/api/v1`) rồi nhấn `a`. Nếu backend đã chạy ở chế độ localhost, dừng bằng `npm run backend:stop` trước khi chạy mobile.

Nhấn `Ctrl+C` để dừng Expo và các backend do lệnh khởi tạo. Nếu biến `EXPO_PUBLIC_API_URL` đã được đặt, script giữ nguyên giá trị đó; bỏ biến cũ bằng `Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue` nếu muốn tự chọn IP LAN. Cấu hình EAS bằng biến repository `EAS_PROJECT_ID` và secret `EXPO_TOKEN` để bật native build trong GitHub Actions.

---

## 6. Tài liệu đồ án

- [PRD — Quảng Trị](docs/PRD_DoAn_QuangTri.docx) & [DFD hệ thống](docs/DFD_QuangTri.md): yêu cầu sản phẩm, kiến trúc, luồng dữ liệu, nghiệp vụ, API và CI/CD cho đủ ba phần của đồ án.
- `clients/frontend`: React.js PWA; `clients/mobile`: Expo/React Native; `server`: FastAPI ba lớp và các service giao tiếp qua HTTP.
- Trong thông tin mỗi địa điểm có số lượt ghé do app ghi nhận trong 30 ngày gần nhất, điểm đánh giá và mục đặt vé thử nghiệm. Lượt ghé chỉ được ghi nhận khi người dùng bật hướng dẫn GPS; backend kiểm tra khoảng cách 85 m, không lưu tọa độ và đếm tối đa một lượt cho mỗi thiết bị/điểm/ngày. Đây là số liệu ước tính, không phải tổng khách thực tế; GPS có thể bị giả mạo. Đánh giá không xác minh danh tính. Vé đặt trong luồng thử nghiệm chưa được thanh toán hoặc xác nhận sử dụng.
- Bộ đếm online hiển thị số client web/mobile gửi heartbeat gần nhất; mỗi trình duyệt hoặc cài đặt mobile được tính một lần. Backend chỉ lưu mã visitor đã băm và thời điểm hoạt động, không lưu IP.
- Trang `/admin` có tổng lượt ghé 30 ngày gần nhất, đánh giá, số địa điểm, thống kê vé và số client online; tab Tài khoản cho phép xóa tài khoản (cùng hành trình đã lưu), tab Địa điểm cho phép tạo/sửa/xóa nội dung. Không thể tự xóa tài khoản admin đang đăng nhập hoặc xóa địa điểm cuối cùng. Các thay đổi danh mục được lưu trong POI (SQL Server) và không bị ghi đè khi service khởi động lại.

---

## 7. CI/CD

- **Frontend CI/CD** ([`.github/workflows/frontend-ci-cd.yml`](.github/workflows/frontend-ci-cd.yml)):
  - Khi tạo/cập nhật pull request vào `main`: cài dependency bằng `npm ci`, kiểm tra TypeScript và build frontend.
  - Khi push lên `main`: thực hiện build cho GitHub Pages, tạo fallback cho client-side routing, lưu artifact và tự động deploy.
  - Để bật deploy lần đầu, vào **Settings → Pages** của repository và chọn **GitHub Actions** làm Build and deployment source.
- **Backend Services CI/CD** ([`.github/workflows/backend-ci-cd.yml`](.github/workflows/backend-ci-cd.yml)):
  - Khởi chạy SQL Server, chạy unit/API tests (`pytest`), kiểm thử tích hợp toàn stack qua Docker Compose (`smoke_api.py`) và đóng gói image lên GitHub Container Registry (GHCR).
- **React Native CI/CD** ([`.github/workflows/mobile-ci-cd.yml`](.github/workflows/mobile-ci-cd.yml)):
  - Kiểm tra tương thích Expo, kiểm tra kiểu TypeScript (`typecheck`), xuất bản web preview artifact và tùy chọn build native qua Expo EAS.
