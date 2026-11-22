// Đường dẫn tới trang thanh toán VietQR của một đơn vé.
export function paymentPath(orderId: string): string {
  return `/payment/${encodeURIComponent(orderId)}`
}
