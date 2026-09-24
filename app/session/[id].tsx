// app/session/[id].tsx

import { useIsFocused } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAct } from '../../constants/act'
import { Colors } from '../../constants/colors'
import { goBack } from '../../constants/nav'
import { confirmDialog, notify } from '../../constants/dialog'
import { errorText } from '../../constants/errorText'

import RelocateModal from '../../components/RelocateModal'
import SyncBanner from '../../components/SyncBanner'
import SessionHeader from '../../components/session/SessionHeader'
import SessionItemCard from '../../components/session/SessionItemCard'
import SessionTabs from '../../components/session/SessionTabs'

import { tabOf, type Item, type SessionDetail, type TabType } from '../../components/session/types'

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  // ── Данные: акт обновляется сам каждые 5 сек, пока экран виден ────────────────
  const isFocused = useIsFocused()
  const { act, view, error, refresh } = useAct(Number(id), { live: isFocused })
  const [activeTab, setActiveTab] = useState<TabType | null>(null)

  const session = useMemo<SessionDetail | null>(() => {
    if (!view) return null
    const { act: a, items, counts } = view
    return {
      id:        a.id,
      name:      a.title,
      status:    a.status.toUpperCase(),
      location:  a.locationFilter || 'Вся школа',
      found:     counts.found,
      notFound:  counts.not_found,
      misplaced: counts.misplaced + counts.surplus,
      pending:   counts.pending,
      total:     counts.total,
      items,
    }
  }, [view])

  // Вкладку выбираем сами только при первом показе акта
  useEffect(() => {
    if (!session || activeTab) return
    setActiveTab(session.misplaced ? 'MISPLACED' : session.notFound ? 'NOT_FOUND' : 'FOUND')
  }, [session, activeTab])

  // ── Перемещение: позиция, открытая в модалке ─────────────────────────────────
  const [relocateItem, setRelocateItem] = useState<Item | null>(null)

  // ── Cancel ────────────────────────────────────────────────────────────────────
  const [cancelling, setCancelling] = useState<number | null>(null)

  // ── Cancel scan ───────────────────────────────────────────────────────────────
  const handleCancelScan = async (item: Item) => {
    const ok = await confirmDialog(
      'Отменить сканирование?',
      `"${item.name ?? item.invNumber ?? 'ОС'}" вернётся в статус "Не проверен"`,
      'Да, отменить',
      { cancelText: 'Нет', destructive: true },
    )
    if (!ok) return
    setCancelling(item.id)
    try {
      await act.cancel(item.id)
    } catch (e: unknown) {
      notify('Не удалось отменить скан', errorText(e))
    } finally {
      setCancelling(null)
    }
  }

  // ── Список для активной вкладки ───────────────────────────────────────────────
  const filteredItems = (session?.items.filter(i => tabOf(i.status) === activeTab) ?? [])
    .sort((a, b) => {
      if (!a.scannedAt && !b.scannedAt) return 0
      if (!a.scannedAt) return 1
      if (!b.scannedAt) return -1
      return new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
    })

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (!session) return (
    <View style={styles.center}>
      {error ? (
        <>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Назад</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator color={Colors.accent} size="large" />
      )}
    </View>
  )

  // ── Main ──────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      <SessionHeader
        session={session}
        onBack={() => goBack(router)}
        onRefresh={() => { void refresh() }}
      />

      <SyncBanner />

      <SessionTabs
        session={session}
        activeTab={activeTab ?? 'FOUND'}
        onChange={setActiveTab}
      />

      <FlatList
        data={filteredItems}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'FOUND'     ? '✅' :
               activeTab === 'NOT_FOUND' ? '❌' :
               activeTab === 'MISPLACED' ? '⚠️' : '⏳'}
            </Text>
            <Text style={styles.emptyText}>Нет записей</Text>
          </View>
        }
        renderItem={({ item }) => (
          <SessionItemCard
            item={item}
            cancelling={cancelling}
            onRelocate={setRelocateItem}
            onCancel={handleCancelScan}
          />
        )}
      />

      <RelocateModal act={act} item={relocateItem} onClose={() => setRelocateItem(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  empty:     { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, color: Colors.text3 },
  errorText: { fontSize: 14, color: Colors.text2, textAlign: 'center', paddingHorizontal: 32, marginBottom: 16 },
  backBtn:     { backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: Colors.text1, fontWeight: '600' },
})
