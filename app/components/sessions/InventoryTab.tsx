import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import api from '../../../constants/api'
import { Colors } from '../../../constants/colors'
import type { InventorySession, InventorySessionDetail } from './types'
import { sessionStyles as s } from './sessionStyles'

export default function InventoryTab({ scannerName }: { scannerName: string }) {
  const [sessions, setSessions] = useState<InventorySessionDetail[]>([])
  const [loading,  setLoading]  = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res    = await api.get('/inventory')
      const active = (res.data as InventorySession[]).filter(x => x.status === 'IN_PROGRESS')
      const detailed = await Promise.all(
        active.map(session =>
          api.get(`/inventory/${session.id}`).then(r => {
            const items = r.data.items ?? []
            const locationName =
              typeof session.location === 'object' && session.location !== null
                ? session.location.name ?? null
                : (session.location as string | null) ?? null
            return {
              id: session.id, name: String(session.name || ''),
              status: session.status, startedAt: session.startedAt,
              location:  locationName,
              total:     items.length,
              found:     items.filter((i: { status: string }) => i.status === 'FOUND').length,
              notFound:  items.filter((i: { status: string }) => i.status === 'NOT_FOUND').length,
              misplaced: items.filter((i: { status: string }) => i.status === 'MISPLACED').length,
              pending:   items.filter((i: { status: string }) => i.status === 'PENDING').length,
            }
          })
        )
      )
      setSessions(detailed)
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить акты инвентаризации')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const progress = (session: InventorySessionDetail) => {
    const checked = session.found + session.notFound + session.misplaced
    return session.total > 0 ? Math.round(checked / session.total * 100) : 0
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })

  return (
    <FlatList
      data={sessions}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={!loading ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyText}>Нет активных актов</Text>
          <Text style={s.emptySub}>Создайте акт на веб-сайте</Text>
        </View>
      ) : null}
      renderItem={({ item }) => {
        const prog = progress(item)
        return (
          <View style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
              <View style={s.badge}>
                <Text style={s.badgeText}>В процессе</Text>
              </View>
            </View>
            {item.location ? <Text style={s.cardLocation}>📍 {item.location}</Text> : null}
            <View style={s.progressBar}>
              <View style={[s.progressFill, { flex: prog }]} />
              <View style={{ flex: 100 - prog }} />
            </View>
            <Text style={s.progressText}>{prog}% · {item.total} ОС</Text>
            <View style={s.statsRow}>
              <Text style={[s.stat, { color: Colors.accent2 }]}>✅ {item.found}</Text>
              <Text style={[s.stat, { color: Colors.danger }]}>❌ {item.notFound}</Text>
              <Text style={[s.stat, { color: Colors.warn }]}>⚠️ {item.misplaced}</Text>
              <Text style={[s.stat, { color: Colors.text3 }]}>⏳ {item.pending}</Text>
              <Text style={[s.stat, { color: Colors.text3, marginLeft: 'auto' }]}>
                {fmtDate(item.startedAt)}
              </Text>
            </View>
            <View style={s.btnRow}>
              <TouchableOpacity
                style={s.detailBtn}
                onPress={() => router.push({ pathname: '/session/[id]', params: { id: item.id, name: item.name } })}
              >
                <Text style={s.detailBtnText}>📋 Детали</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.scanBtn}
                onPress={() => router.push({ pathname: '/scan', params: { sessionId: item.id, sessionName: item.name } })}
              >
                <Text style={s.scanBtnText}>📷 Сканировать</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      }}
    />
  )
}
