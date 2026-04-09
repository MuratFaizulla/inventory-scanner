import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../constants/colors'
import CollectionTab from './components/sessions/CollectionTab'
import InventoryTab from './components/sessions/InventoryTab'
import LookupTab from './components/sessions/LookupTab'
import type { Tab } from './components/sessions/types'

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'inventory',  icon: '📋', label: 'Инвентаризация' },
  { key: 'collection', icon: '📥', label: 'Сбор ОС' },
  { key: 'lookup',     icon: '🔍', label: 'Поиск ОС' },
]

export default function SessionsScreen() {
  const [tab,         setTab]         = useState<Tab>('inventory')
  const [scannerName, setScannerName] = useState('')
  const router = useRouter()

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('scannerName').then(n => setScannerName(n || ''))
  }, []))

  const handleLogout = async () => {
    await AsyncStorage.removeItem('scannerName')
    router.replace('/')
  }

  return (
    <View style={styles.container}>

      {/* ── Шапка ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>👋 {scannerName}</Text>
          <Text style={styles.headerSub}>НИШ Инвентаризация</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {/* ── Табы ── */}
      <View style={styles.tabRow}>
        {TABS.map(({ key, icon, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
            onPress={() => { setTab(key); Haptics.selectionAsync() }}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>{icon}</Text>
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Контент ── */}
      {tab === 'inventory'  && <InventoryTab  scannerName={scannerName} />}
      {tab === 'collection' && <CollectionTab scannerName={scannerName} />}
      {tab === 'lookup'     && <LookupTab />}

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.bg2,
  },
  greeting:   { fontSize: 15, fontWeight: '700', color: Colors.text1 },
  headerSub:  { fontSize: 12, color: Colors.text3, marginTop: 2 },
  logoutBtn:  { padding: 8 },
  logoutText: { fontSize: 13, color: Colors.text3 },

  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:   { borderBottomColor: Colors.accent },
  tabIcon:        { fontSize: 18, marginBottom: 2 },
  tabLabel:       { fontSize: 10, color: Colors.text3, fontWeight: '600' },
  tabLabelActive: { color: Colors.accent },
})
