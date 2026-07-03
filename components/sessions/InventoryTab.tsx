import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  FlatList, Modal, RefreshControl, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import { Colors } from '../../constants/colors'
import { confirmDialog, notify } from '../../constants/dialog'
import {
  listSessions, RawSession, sessionAction,
} from '../../constants/sessionsApi'
import CreateSessionModal from './CreateSessionModal'
import { sessionStyles as s } from './sessionStyles'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:       { label: 'Черновик',   color: Colors.text2,   bg: Colors.bg3 },
  in_progress: { label: 'В процессе', color: Colors.accent2, bg: 'rgba(74,222,128,0.12)' },
  paused:      { label: 'Пауза',      color: Colors.warn,    bg: 'rgba(250,204,21,0.12)' },
  completed:   { label: 'Завершён',   color: Colors.accent,  bg: 'rgba(56,189,248,0.12)' },
  cancelled:   { label: 'Отменён',    color: Colors.text3,   bg: Colors.bg3 },
}

export default function InventoryTab({ scannerName }: { scannerName: string }) {
  const [sessions,   setSessions]   = useState<RawSession[]>([])
  const [loading,    setLoading]    = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [acting,     setActing]     = useState<number | null>(null)
  const [menuFor,    setMenuFor]    = useState<RawSession | null>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSessions(await listSessions())
    } catch {
      notify('Ошибка', 'Не удалось загрузить акты инвентаризации')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const doAction = async (
    session: RawSession,
    action: 'start' | 'pause' | 'resume' | 'complete' | 'cancel',
  ) => {
    setActing(session.id)
    try {
      await sessionAction(session.id, action)
      await load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      notify('Ошибка', err.response?.data?.message ?? 'Не удалось выполнить действие')
    } finally {
      setActing(null)
    }
  }

  const confirmAction = async (
    session: RawSession,
    action: 'complete' | 'cancel',
  ) => {
    const texts = {
      complete: { title: 'Завершить акт?', msg: 'Непроверенные ОС получат статус «Не найдено»' },
      cancel:   { title: 'Отменить акт?',  msg: 'Акт будет закрыт без результатов' },
    }
    const ok = await confirmDialog(
      texts[action].title, texts[action].msg, 'Да',
      { cancelText: 'Нет', destructive: true },
    )
    if (ok) await doAction(session, action)
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : ''

  const renderItem = ({ item }: { item: RawSession }) => {
    const meta = STATUS_META[item.status] ?? STATUS_META.draft
    const total = item.total ?? 0
    const scanned = item.scanned ?? 0
    const prog = total > 0 ? Math.round((scanned / total) * 100) : 0
    const busy = acting === item.id
    const active = item.status === 'in_progress'

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.cardName} numberOfLines={2}>{item.title}</Text>
          <View style={[s.badge, { backgroundColor: meta.bg }]}>
            <Text style={[s.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {!!item.locationFilter && (
          <Text style={s.cardLocation}>📍 {item.locationFilter}</Text>
        )}
        {(!!item.mol || !!item.employee) && (
          <Text style={s.cardLocation}>
            👤 {[item.mol, item.employee].filter(Boolean).join(' · ')}
          </Text>
        )}

        {total > 0 && (
          <>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { flex: prog }]} />
              <View style={{ flex: 100 - prog }} />
            </View>
            <Text style={s.progressText}>
              {prog}% · {scanned} из {total} ОС · {fmtDate(item.startedAt ?? item.createdAt)}
            </Text>
          </>
        )}

        {/* Действия по статусу */}
        <View style={s.btnRow}>
          {item.status === 'draft' && (
            <>
              <TouchableOpacity
                style={[s.scanBtn, busy && { opacity: 0.5 }]}
                disabled={busy}
                onPress={() => doAction(item, 'start')}
              >
                <Text style={s.scanBtnText}>▶ Запустить</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.detailBtn}
                disabled={busy}
                onPress={() => confirmAction(item, 'cancel')}
              >
                <Text style={s.detailBtnText}>✕ Отменить</Text>
              </TouchableOpacity>
            </>
          )}

          {active && (
            <>
              <TouchableOpacity
                style={s.detailBtn}
                onPress={() => router.push({
                  pathname: '/session/[id]',
                  params: { id: item.id, name: item.title },
                })}
              >
                <Text style={s.detailBtnText}>📋 Детали</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.scanBtn}
                onPress={() => router.push({
                  pathname: '/scan',
                  params: { sessionId: item.id, sessionName: item.title },
                })}
              >
                <Text style={s.scanBtnText}>📷 Сканировать</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.moreBtn}
                disabled={busy}
                onPress={() => setMenuFor(item)}
              >
                <Feather name="more-vertical" size={16} color={Colors.text2} />
              </TouchableOpacity>
            </>
          )}

          {item.status === 'paused' && (
            <>
              <TouchableOpacity
                style={[s.scanBtn, busy && { opacity: 0.5 }]}
                disabled={busy}
                onPress={() => doAction(item, 'resume')}
              >
                <Text style={s.scanBtnText}>▶ Возобновить</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.detailBtn}
                onPress={() => router.push({
                  pathname: '/session/[id]',
                  params: { id: item.id, name: item.title },
                })}
              >
                <Text style={s.detailBtnText}>📋 Детали</Text>
              </TouchableOpacity>
            </>
          )}

          {(item.status === 'completed' || item.status === 'cancelled') && (
            <TouchableOpacity
              style={s.detailBtn}
              onPress={() => router.push({
                pathname: '/session/[id]',
                params: { id: item.id, name: item.title },
              })}
            >
              <Text style={s.detailBtnText}>📋 Детали</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Создать акт */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setCreateOpen(true)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={15} color={Colors.accent2} />
          <Text style={styles.createText}>Создать акт</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={item => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.accent} />
        }
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10 }}
        ListEmptyComponent={!loading ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyText}>Нет актов инвентаризации</Text>
            <Text style={s.emptySub}>Нажмите «Создать акт», чтобы начать</Text>
          </View>
        ) : null}
        renderItem={renderItem}
      />

      <CreateSessionModal
        visible={createOpen}
        scannerName={scannerName}
        onClose={() => setCreateOpen(false)}
        onCreated={async (session) => {
          setCreateOpen(false)
          await load()
          const run = await confirmDialog(
            'Акт создан', `«${session.title}»\nЗапустить сейчас?`,
            'Запустить', { cancelText: 'Позже' },
          )
          if (run) await doAction(session, 'start')
        }}
      />

      {/* Меню «⋮» — действия с активным актом */}
      <Modal
        visible={!!menuFor}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuFor(null)}
        >
          <View style={styles.menuCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.menuTitle} numberOfLines={2}>{menuFor?.title}</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { const it = menuFor!; setMenuFor(null); doAction(it, 'pause') }}
            >
              <Feather name="pause-circle" size={17} color={Colors.warn} />
              <Text style={styles.menuItemText}>Пауза</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { const it = menuFor!; setMenuFor(null); confirmAction(it, 'complete') }}
            >
              <Feather name="check-circle" size={17} color={Colors.accent2} />
              <Text style={styles.menuItemText}>Завершить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { const it = menuFor!; setMenuFor(null); confirmAction(it, 'cancel') }}
            >
              <Feather name="x-circle" size={17} color={Colors.danger} />
              <Text style={[styles.menuItemText, { color: Colors.danger }]}>Отменить акт</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuClose} onPress={() => setMenuFor(null)}>
              <Text style={styles.menuCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingTop: 12 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0c4a2a', borderWidth: 1, borderColor: '#166534',
    borderRadius: 12, padding: 12,
  },
  createText: { color: Colors.accent2, fontWeight: '700', fontSize: 14 },

  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(2,6,23,0.8)',
    justifyContent: 'center', padding: 24,
  },
  menuCard: {
    backgroundColor: Colors.bg2, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  menuTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.text1,
    marginBottom: 12, textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg3, borderRadius: 12,
    padding: 13, marginBottom: 8,
  },
  menuItemText: { fontSize: 14, fontWeight: '600', color: Colors.text1 },
  menuClose: { alignItems: 'center', padding: 10, marginTop: 2 },
  menuCloseText: { fontSize: 13, color: Colors.text3, fontWeight: '600' },
})
