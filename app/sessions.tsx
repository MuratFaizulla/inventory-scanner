import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { acts } from '../constants/act'
import { roleLabel, useAccountUser } from '../constants/account'
import { Colors } from '../constants/colors'
import AssetsView from '../components/onec/AssetsView'
import MyAssetsView from '../components/onec/MyAssetsView'
import TypesView from '../components/onec/TypesView'
import SyncBanner from '../components/SyncBanner'
import InventoryTab from '../components/sessions/InventoryTab'
import LookupTab from '../components/sessions/LookupTab'
import type { Tab } from '../components/sessions/types'

// Разделы; «Синхронизация 1С» живёт в Настройках (шестерёнка).
// «Акты» — у администратора и у тех, кого он добавил в акт участником: роль
// тут не решает, решает, есть ли у человека акты (см. hasActs ниже).
const TABS: {
  key: Tab
  icon: keyof typeof Feather.glyphMap
  label: string
  roles?: string[]
}[] = [
  { key: 'inventory', icon: 'clipboard', label: 'Акты' },
  { key: 'types',     icon: 'grid',      label: 'Виды',  roles: ['admin'] },
  { key: 'my',        icon: 'package',   label: 'Моё' },
  { key: 'assets',    icon: 'archive',   label: 'ОС',    roles: ['admin'] },
  { key: 'lookup',    icon: 'search',    label: 'Поиск', roles: ['admin', 'lead'] },
]

// «чт, 3 июля» → «Чт, 3 июля»
const dateLabel = () => {
  const s = new Date().toLocaleDateString('ru-RU', {
    weekday: 'short', day: 'numeric', month: 'long',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

export default function SessionsScreen() {
  const [tab,         setTab]         = useState<Tab>('inventory')
  const user        = useAccountUser()
  const scannerName = user?.name ?? ''
  const role        = user?.role ?? ''
  const insets = useSafeAreaInsets()
  const router = useRouter()

  // Участник акта — сотрудник с любой ролью, которого админ позвал в акт.
  // Сервер отдаёт ему только его акты; без связи — сохранённый список.
  const [hasActs, setHasActs] = useState(false)
  useEffect(() => {
    if (!role || role === 'admin') return
    let alive = true
    acts.list()
      .then(list => { if (alive) setHasActs(list.length > 0) })
      .catch(() => { /* нет актов или нет связи — вкладки нет */ })
    return () => { alive = false }
  }, [role])

  // Не админ сначала попадает в «Моё оборудование»; позвали в акт — в «Акты»
  useEffect(() => {
    if (role && role !== 'admin') setTab(hasActs ? 'inventory' : 'my')
  }, [role, hasActs])

  const visibleTabs = TABS.filter(t => t.key === 'inventory'
    ? role === 'admin' || hasActs
    : !t.roles || t.roles.includes(role))

  return (
    <View style={styles.container}>

      {/* ── Плавающая шапка (в пару к нижнему доку) ── */}
      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerCard}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(scannerName)}</Text>
            </View>
          </View>
          <View style={{ flex: 1, marginHorizontal: 11 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {scannerName || '1С Интеграция'}
            </Text>
            <View style={styles.subRow}>
              {!!role && <View style={styles.roleDot} />}
              <Text style={styles.subText} numberOfLines={1}>
                {[role ? roleLabel(role) : null, dateLabel()]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
            <Feather name="settings" size={17} color={Colors.text2} />
          </TouchableOpacity>
        </View>
      </View>

      <SyncBanner />

      {/* ── Контент ── */}
      <View style={{ flex: 1 }}>
        {tab === 'inventory' && <InventoryTab scannerName={scannerName} canManage={role === 'admin'} />}
        {tab === 'lookup'    && <LookupTab />}
        {tab === 'my'        && <MyAssetsView />}
        {tab === 'assets'    && <AssetsView />}
        {tab === 'types'     && <TypesView />}
      </View>

      {/* ── Нижнее меню: плавающий док ── */}
      <View style={[styles.dockWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.dock}>
          {visibleTabs.map(({ key, icon, label }) => {
            const active = tab === key
            return (
              <TouchableOpacity
                key={key}
                style={styles.tabBtn}
                onPress={() => { setTab(key); Haptics.selectionAsync() }}
                activeOpacity={0.7}
              >
                <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                  <Feather
                    name={icon}
                    size={19}
                    color={active ? Colors.accent : Colors.text3}
                  />
                </View>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  /* Плавающая шапка */
  headerWrap: { paddingHorizontal: 12, paddingBottom: 6 },
  headerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg2,
    borderRadius: 22,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 10, paddingHorizontal: 12,
    boxShadow: '0 6px 12px rgba(0,0,0,0.3)',
    elevation: 10,
  },
  avatarRing: {
    padding: 2, borderRadius: 9999,
    borderWidth: 1.5, borderColor: 'rgba(56,189,248,0.55)',
  },
  avatar: {
    width: 35, height: 35, borderRadius: 9999,
    backgroundColor: 'rgba(56,189,248,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: Colors.accent },
  userName:   { fontSize: 15, fontWeight: '700', color: Colors.text1 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent2 },
  subText: { fontSize: 11, color: Colors.text3, flexShrink: 1 },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 9999,
    backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Плавающий док */
  dockWrap: { paddingHorizontal: 12, paddingTop: 6 },
  dock: {
    flexDirection: 'row',
    backgroundColor: Colors.bg2,
    borderRadius: 24,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 8, paddingHorizontal: 6,
    boxShadow: '0 8px 16px rgba(0,0,0,0.35)',
    elevation: 14,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3 },
  tabIconWrap: {
    paddingHorizontal: 16, paddingVertical: 5, borderRadius: 14,
  },
  tabIconWrapActive: { backgroundColor: 'rgba(56,189,248,0.15)' },
  tabLabel:       { fontSize: 10, color: Colors.text3, fontWeight: '600' },
  tabLabelActive: { color: Colors.accent, fontWeight: '700' },
})
