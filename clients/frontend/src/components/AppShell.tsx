// Bao bọc nội dung trang trong khung giao diện chung.
import type { ReactNode } from 'react'

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-shell">{children}</div>
}
