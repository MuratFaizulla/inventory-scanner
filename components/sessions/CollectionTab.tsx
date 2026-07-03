import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import api from '../../constants/api'
import { Colors } from '../../constants/colors'
import type { CollectionSession } from './types'
import { sessionStyles as s } from './sessionStyles'

export default function CollectionTab({ scannerName }: { scannerName: string }) {
  const [sessions, setSessions] = useState<CollectionSession[]>([])
  const [loading,  setLoading]  = useState(true)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/collection')
      setSessions((res.data as CollectionSession[]).filter(x => x.status === 'OPEN'))
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить сессии сбора ОС')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const fmtDeadline = (d: string | null) => {
    if (!d) return null
    const date = new Date(d)
    const overdue = date < new Date()
    const label = date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    return { label, overdue }
  }

  return (
    <FlatList
      data={sessions}
      keyExtractor={item => String(item.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={!loading ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📥</Text>
          <Text style={s.emptyText}>Нет открытых сессий сбора</Text>
          <Text style={s.emptySub}>Создайте сессию на веб-сайте</Text>
        </View>
      ) : null}
      renderItem={({ item }) => {
        const dl = fmtDeadline(item.deadline)
        return (
          <View style={[s.card, { borderColor: '#2d6a45' }]}>
            <View style={s.cardTop}>
              <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
              <View style={[s.badge, { backgroundColor: '#052e16' }]}>
                <Text style={[s.badgeText, { color: '#4ade80' }]}>🟢 Открыта</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              {item.assetType && <Text style={s.cardMeta}>📦 {item.assetType}</Text>}
              {dl && (
                <Text style={[s.cardMeta, dl.overdue && { color: Colors.danger }]}>
                  {dl.overdue ? '⚠️' : '📅'} {dl.label}
                </Text>
              )}
              <Text style={s.cardMeta}>📋 {item._count.items} ОС</Text>
              {item.createdBy && <Text style={s.cardMeta}>👤 {item.createdBy}</Text>}
            </View>
            <View style={s.btnRow}>
              <TouchableOpacity
                style={s.detailBtn}
                onPress={() => router.push({
                  pathname: '/collection/detail/[id]',
                  params: { id: item.id, sessionName: item.name },
                })}
              >
                <Text style={s.detailBtnText}>📋 Детали</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.scanBtn}
                onPress={() => router.push({
                  pathname: '/collection/[id]',
                  params: { id: item.id, sessionName: item.name },
                })}
              >
                <Text style={s.scanBtnText}>📷 Принимать ОС</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      }}
    />
  )
}
