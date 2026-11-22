# Kiểm tra hồi quy

Các script kiểm tra GPS, hành trình ngoại tuyến, cache địa điểm, hành trình gợi ý và dự phòng giọng đọc.
Chúng sử dụng dependency của frontend và dữ liệu mô phỏng, không cần chạy backend.

Cài dependency nếu chưa có, từ thư mục gốc đồ án:

```powershell
npm ci --prefix clients/frontend
```

Chạy từng kiểm tra:

```powershell
node scripts/regression/gps-guide.cjs
node scripts/regression/offline-tours.cjs
node scripts/regression/place-cache.cjs
node scripts/regression/suggested-tours.cjs
node scripts/regression/voice-fallback.cjs
```

Kết quả kiểm tra khi chuyển từ `.task-artifacts`:

- `place-cache.cjs` và `voice-fallback.cjs`: đạt.
- `gps-guide.cjs`: bộ mô phỏng thiếu `useCallback`.
- `offline-tours.cjs`: lỗi đọc `id` từ giá trị `null`.
- `suggested-tours.cjs`: giá trị kiểm tra nhận `undefined` thay vì `'a'`.

Nội dung kiểm tra được giữ nguyên; chỉ cập nhật đường dẫn import giữa hai script hành trình.
Ba lỗi trên cần được rà soát riêng trước khi đưa các script này vào CI.
