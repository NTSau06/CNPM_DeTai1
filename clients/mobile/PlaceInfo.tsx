// Tải thống kê và hiển thị thông tin/biểu mẫu đánh giá của một địa điểm.
import { useEffect, useRef, useState } from 'react'
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
import { localeOf, mt, type Language } from './uiText'

export function PlaceInfoCard({ language, placeId, placeTitle }: { language: Language; placeId: string; placeTitle: string }) {
  const languageRef = useRef(language)
  languageRef.current = language
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
      .catch(() => { if (active) setMessage(mt(languageRef.current, 'piVisitsError')) })
    void getPlaceRatings(placeId)
      .then((result) => { if (active) setSummary(result) })
      .catch(() => { if (active) setMessage(mt(languageRef.current, 'piRatingsError')) })
    return () => { active = false }
  }, [placeId])

  const sendRating = async () => {
    setBusy(true)
    setMessage('')
    try {
      const updated = await submitPlaceRating(placeId, rating, review)
      setSummary(updated)
      setReview('')
      setMessage(mt(language, 'piThanks'))
    } catch (error) {
      setMessage(language === 'vi' && error instanceof Error ? error.message : mt(language, 'piSendError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{mt(language, 'piKicker')}</Text>
      <Text style={styles.heading}>{placeTitle}</Text>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{mt(language, 'piVisitsLabel')}</Text>
          {analytics ? <Text style={styles.metricValue}>{analytics.visits.toLocaleString(localeOf(language))}</Text> : <ActivityIndicator color="#28483A" />}
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{mt(language, 'piRating')}</Text>
          <Text style={styles.metricValue}>{summary?.averageRating == null ? '—' : `${summary.averageRating.toFixed(1)} ★`}</Text>
          <Text style={styles.help}>{mt(language, 'piRatingCount', { n: summary?.totalRatings ?? 0 })}</Text>
        </View>
      </View>
      <Text style={styles.help}>{mt(language, 'piVisitsNote')}</Text>
      {summary?.reviews.slice(0, 3).map((item) => <Text key={`${item.createdAt}-${item.review}`} style={styles.reviewLine}>{'★'.repeat(item.rating)} · {item.review}</Text>)}
      <Text style={styles.subheading}>{mt(language, 'piShare')}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable accessibilityRole="button" accessibilityLabel={mt(language, 'piStars', { n: value })} accessibilityState={{ selected: value === rating }} key={value} onPress={() => setRating(value)}>
            <Text style={[styles.star, value <= rating && styles.starSelected]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput maxLength={500} onChangeText={setReview} placeholder={mt(language, 'piReviewPh')} style={styles.input} value={review} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void sendRating()} style={styles.primaryButton}>
        <Text style={styles.primaryText}>{mt(language, busy ? 'piSending' : 'piSubmit')}</Text>
      </Pressable>
      <Text style={styles.help}>{mt(language, 'piPrivacy')}</Text>
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
