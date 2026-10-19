# Visit Quảng Trị

Ứng dụng khám phá địa điểm Quảng Trị – Quảng Bình với bản đồ, thuyết minh đa ngôn ngữ và hỗ trợ PWA.

## Chạy frontend

```powershell
cd front-end-tmtddnn
npm ci
npm run dev
```

## CI/CD

Workflow `Frontend CI/CD` tại `.github/workflows/frontend-ci-cd.yml`:

- Khi tạo/cập nhật pull request vào `main`: cài dependency bằng `npm ci`, kiểm tra TypeScript và build frontend.
- Khi push lên `main`: thực hiện build cho GitHub Pages, tạo fallback cho client-side routing, lưu artifact và tự động deploy.
- Có thể chạy thủ công bằng GitHub Actions (`workflow_dispatch`).

Để bật deploy lần đầu, vào **Settings → Pages** của repository và chọn **GitHub Actions** làm Build and deployment source. Workflow sử dụng đường dẫn base theo tên repository, nên phù hợp với GitHub Pages dạng project site.
