// Tạo cấu hình Expo động và nạp EAS project ID khi được thiết lập.
import type { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Quảng Trị',
  slug: config.slug ?? 'quang-tri',
  extra: {
    ...config.extra,
    ...(process.env.EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
      : {}),
  },
})
