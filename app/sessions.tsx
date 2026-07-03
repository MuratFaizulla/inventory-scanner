import { Feather } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../constants/colors'
import AssetsView from './components/onec/AssetsView'
import MyAssetsView from './components/onec/MyAssetsView'
import TypesView from './components/onec/TypesView'
import InventoryTab from './components/sessions/InventoryTab'
import LookupTab from './components/sessions/LookupTab'
import type { Tab } from './components/sessions/types'

// Разделы; «Синхронизация 1С» живёт в Настройках (шестерёнка)
const TABS: {
  key: Tab
  icon: keyof typeof Feather.glyphMap
  label: string
  roles?: string[]
}[] = [
  { key: 'inventory', icon: 'clipboard', label: 'Акты',  roles: ['admin', 'lead'] },
  { key: 'lookup',    icon: 'search',    label: 'Поиск', roles: ['admin', 'lead'] },
  { key: 'my',        icon: 'package',   label: 'Моё' },
  { key: 'assets',    icon: 'archive',   label: 'ОС',    roles: ['admin'] },
  { key: 'types',     icon: 'grid',      label: 'Виды',  roles: ['admin'] },
]

const ROLE_LABELS: Record<string, string> = {
  admin:   'Администратор',
  lead:    'Руководство',
  curator: 'Куратор',
  user:    'Сотрудник',
}

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
  const [scannerName, setScannerName] = useState('')
  const [role,        setRole]        = useState('')
  const insets = useSafeAreaInsets()
  const router = useRouter()

  useFocusEffect(useCallback(() => {
    AsyncStorage.multiGet(['scannerName', 'authRole']).then(pairs => {
      setScannerName(pairs[0][1] || '')
      const r = pairs[1][1] || ''
      setRole(r)
      // Роли без сканерных вкладок сразу попадают в «Моё оборудование»
      if (r && r !== 'admin' && r !== 'lead') setTab('my')
    })
  }, []))

  const visibleTabs = TABS.filter(t => !t.roles || t.roles.includes(role))

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
              {scannerName || 'НИШ Инвентаризация'}
            </Text>
            <View style={styles.subRow}>
              {!!role && <View style={styles.roleDot} />}
              <Text style={styles.subText} numberOfLines={1}>
                {[ROLE_LABELS[role] ?? (role || null), dateLabel()]
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

      {/* ── Контент ── */}
      <View style={{ flex: 1 }}>
        {tab === 'inventory' && <InventoryTab scannerName={scannerName} />}
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
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
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
    shadowColor: '#000', shadowOpacity: 0.35,
    shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
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
