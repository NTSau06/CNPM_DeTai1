// Thẻ đặt vé tham quan cho địa điểm đang chọn trên ứng dụng di động.
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { ApiError, createTicketOrder, fetchTicketPrices, formatVnd, type TicketOrder } from './src/api'
import { localeOf, mt, type Language } from './uiText'

export function TicketCard({
  language,
  placeId,
  authToken,
  onRequestSignIn,
  onBooked,
}: {
  language: Language
  placeId: string
  authToken: string | null
  onRequestSignIn: () => void
  onBooked?: (order: TicketOrder) => void
}) {
  const [price, setPrice] = useState<number | null | undefined>(undefined)
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    setPrice(undefined)
    setQuantity(1)
    setMessage('')
    void fetchTicketPrices()
      .then((items) => {
        if (active) setPrice(items.find((item) => item.placeId === placeId)?.priceVnd ?? null)
      })
      .catch(() => { if (active) setPrice(null) })
    return () => { active = false }
  }, [placeId])

  const locale = localeOf(language)
  const onSale = typeof price === 'number' && price > 0

  const book = async () => {
    if (!authToken) {
      onRequestSignIn()
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const order = await createTicketOrder(placeId, quantity, authToken)
      // Đơn mới ở trạng thái chờ thanh toán; thanh toán hiện thực hiện trên bản web.
      setMessage(mt(language, order.status === 'pending' ? 'tkPendingNote' : 'tkSuccess', { n: order.quantity, code: order.ticketCode ?? order.id }))
      onBooked?.(order)
    } catch (error) {
      setMessage(language === 'vi' && error instanceof ApiError && error.status > 0
        ? error.message
        : mt(language, 'tkError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{mt(language, 'tkTitle')}</Text>
      {price === undefined ? (
        <ActivityIndicator color="#28483A" />
      ) : !onSale ? (
        <Text style={styles.help}>{mt(language, 'tkNotOnSale')}</Text>
      ) : (
        <>
          <Text style={styles.price}>{mt(language, 'tkPrice', { price: formatVnd(price, locale) })}</Text>
          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel="-"
              accessibilityRole="button"
              disabled={quantity <= 1}
              onPress={() => setQuantity((value) => Math.max(1, value - 1))}
              style={[styles.stepButton, quantity <= 1 && styles.disabled]}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.quantity}>{quantity}</Text>
            <Pressable
              accessibilityLabel="+"
              accessibilityRole="button"
              disabled={quantity >= 10}
              onPress={() => setQuantity((value) => Math.min(10, value + 1))}
              style={[styles.stepButton, quantity >= 10 && styles.disabled]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void book()}
            style={[styles.primaryButton, busy && styles.disabled]}
          >
            <Text style={styles.primaryText}>
              {!authToken
                ? mt(language, 'tkSignIn')
                : busy
                  ? mt(language, 'tkBooking')
                  : mt(language, 'tkBook', { n: quantity, total: formatVnd(price * quantity, locale) })}
            </Text>
          </Pressable>
          <Text style={styles.help}>{mt(language, 'tkNote')}</Text>
        </>
      )}
      {message ? <Text accessibilityRole="alert" style={styles.feedback}>{message}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, backgroundColor: '#FFFDF7', borderRadius: 18, borderWidth: 1, borderColor: '#E3E0D5', gap: 10, marginVertical: 7 },
  title: { color: '#28483A', fontSize: 17, fontWeight: '800' },
  price: { color: '#506258', fontSize: 13, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF0E7' },
  stepText: { color: '#28483A', fontSize: 20, fontWeight: '800' },
  quantity: { minWidth: 24, textAlign: 'center', color: '#24352D', fontSize: 18, fontWeight: '800' },
  primaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#28483A', paddingHorizontal: 14 },
  primaryText: { color: '#FFFDF7', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  help: { color: '#7D897F', fontSize: 11, lineHeight: 16 },
  feedback: { color: '#8B4D3B', fontSize: 12, lineHeight: 17 },
})
