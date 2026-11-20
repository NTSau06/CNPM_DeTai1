// Điều hướng người dùng tới cổng thanh toán sau khi tạo đơn vé.
import { startTicketPayment, type PaymentMethod } from './api'
import type { Language } from './types'

/**
 * Bắt đầu thanh toán cho một đơn đang chờ. Với VNPay trình duyệt rời khỏi ứng dụng;
 * với cổng mô phỏng thì chuyển tới trang nội bộ bằng hàm `navigate` của router.
 */
export async function redirectToPayment(
  orderId: string,
  method: PaymentMethod,
  language: Language,
  token: string,
  navigate: (to: string) => void,
): Promise<void> {
  const result = await startTicketPayment(orderId, method, language, token)
  if (result.external) window.location.assign(result.redirectUrl)
  else navigate(result.redirectUrl)
}
