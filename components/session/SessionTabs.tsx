// components/session/SessionTabs.tsx

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../constants/colors'
import type { SessionDetail, TabType } from './types'

interface Props {
  session:   SessionDetail
  activeTab: TabType
  onChange:  (tab: TabType) => void
}

const TABS: { key: TabType; label: string; color: string; countKey: keyof SessionDetail }[] = [
  { key: 'FOUND',     label: 'Найдено',     color: Colors.accent2, countKey: 'found'     },
  { key: 'NOT_FOUND', label: 'Не найдено',  color: Colors.danger,  countKey: 'notFound'  },
  { key: 'MISPLACED', label: 'Не на месте', color: Colors.warn,    countKey: 'misplaced' },
  { key: 'PENDING',   label: 'Осталось',    color: Colors.text2,   countKey: 'pending'   },
]

export default function SessionTabs({ session, activeTab, onChange }: Props) {
  return (
    <View style={styles.tabs}>
      {TABS.map(t => {
        const isActive = activeTab === t.key
        const count    = session[t.countKey] as number
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, isActive && { borderBottomColor: t.color }]}
            onPress={() => onChange(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabCount, { color: isActive ? t.color : Colors.text3 }]}>
              {count}
            </Text>
            <Text style={[styles.tabText, { color: isActive ? t.color : Colors.text3 }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabCount: { fontSize: 16, fontWeight: '700' },
  tabText:  { fontSize: 9, fontWeight: '600', marginTop: 1 },
})
