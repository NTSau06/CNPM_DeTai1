// Tải thống kê và hiển thị thông tin/biểu mẫu đánh giá của một địa điểm.
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  getPlaceAnalytics,
  getPlaceRatings,
  submitPlaceRating,
  type PlaceAnalytics,
  type PlaceRatingSummary,
} from './analytics'

export function PlaceInfoCard({ placeId, placeTitle }: { placeId: string; placeTitle: string }) {
  const [analytics, setAnalytics] = useState<PlaceAnalytics | null>(null)
  const [summary, setSummary] = useState<PlaceRatingSummary | null>(null)
  const [rating, setRating] = useState(5)
  const [review, setReview] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setAnalytics(null)
    setSummary(null)
    setMessage('')
    void getPlaceAnalytics(placeId)
      .then((result) => { if (active) setAnalytics(result) })
      .catch(() => { if (active) setMessage('Chưa tải được lượt ghé. Kiểm tra kết nối máy chủ.') })
    void getPlaceRatings(placeId)
      .then((result) => { if (active) setSummary(result) })
      .catch(() => { if (active) setMessage('Chưa tải được đánh giá. Kiểm tra kết nối máy chủ.') })
    return () => { active = false }
  }, [placeId])

  const sendRating = async () => {
    setBusy(true)
    setMessage('')
    try {
      const updated = await submitPlaceRating(placeId, rating, review)
      setSummary(updated)
      setReview('')
      setMessage('Cảm ơn bạn đã đánh giá.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không gửi được đánh giá.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>THÔNG TIN ĐỊA ĐIỂM</Text>
      <Text style={styles.heading}>{placeTitle}</Text>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Lượt ghé app · 30 ngày</Text>
          {analytics ? <Text style={styles.metricValue}>{analytics.visits.toLocaleString('vi-VN')}</Text> : <ActivityIndicator color="#28483A" />}
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Đánh giá</Text>
          <Text style={styles.metricValue}>{summary?.averageRating == null ? '—' : `${summary.averageRating.toFixed(1)} ★`}</Text>
          <Text style={styles.help}>{summary?.totalRatings ?? 0} lượt đánh giá</Text>
        </View>
      </View>
      <Text style={styles.help}>Lượt ghé chỉ tính người dùng bật GPS trong ứng dụng; tối đa một lượt/thiết bị/điểm/ngày, không phải tổng khách thực tế.</Text>
      {summary?.reviews.slice(0, 3).map((item) => <Text key={`${item.createdAt}-${item.review}`} style={styles.reviewLine}>{'★'.repeat(item.rating)} · {item.review}</Text>)}
      <Text style={styles.subheading}>Chia sẻ đánh giá</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`${value} sao`} accessibilityState={{ selected: value === rating }} key={value} onPress={() => setRating(value)}>
            <Text style={[styles.star, value <= rating && styles.starSelected]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput maxLength={500} onChangeText={setReview} placeholder="Nhận xét (không bắt buộc)" style={styles.input} value={review} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void sendRating()} style={styles.primaryButton}>
        <Text style={styles.primaryText}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</Text>
      </Pressable>
      <Text style={styles.help}>Mỗi mã thiết bị có thể cập nhật một đánh giá/địa điểm; đánh giá chưa xác minh danh tính.</Text>
      {message ? <Text accessibilityRole="alert" style={styles.feedback}>{message}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, backgroundColor: '#FFFDF7', borderRadius: 18, borderWidth: 1, borderColor: '#E3E0D5', gap: 10, marginVertical: 14 },
  kicker: { color: '#B96D4C', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#28483A', fontSize: 18, fontWeight: '800' },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 84, backgroundColor: '#F7F5EF', borderRadius: 12, padding: 11, justifyContent: 'center', gap: 4 },
  metricLabel: { color: '#7D897F', fontSize: 10, fontWeight: '700' },
  metricValue: { color: '#28483A', fontSize: 20, fontWeight: '800' },
  help: { color: '#7D897F', fontSize: 11, lineHeight: 16 },
  reviewLine: { color: '#506258', fontSize: 12, lineHeight: 18 },
  subheading: { color: '#28483A', fontSize: 14, fontWeight: '800', marginTop: 4 },
  stars: { flexDirection: 'row', gap: 9 },
  star: { color: '#CCD0C4', fontSize: 25 },
  starSelected: { color: '#B96D4C' },
  input: { minHeight: 72, textAlignVertical: 'top', padding: 12, borderRadius: 10, backgroundColor: '#F7F5EF', borderWidth: 1, borderColor: '#E3E0D5', color: '#24352D' },
  primaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#28483A', paddingHorizontal: 14 },
  primaryText: { color: '#FFFDF7', fontWeight: '800' },
  feedback: { color: '#8B4D3B', fontSize: 12, lineHeight: 17 },
})
