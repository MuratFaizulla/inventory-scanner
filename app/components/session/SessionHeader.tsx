// components/session/SessionHeader.tsx

import { Feather } from '@expo/vector-icons'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import type { SessionDetail } from './types'

interface Props {
  session:   SessionDetail
  onBack:    () => void
  onRefresh: () => void
}

export default function SessionHeader({ session, onBack, onRefresh }: Props) {
  const insets = useSafeAreaInsets()
  const checked = session.found + session.notFound + session.misplaced
  const progress = session.total > 0 ? Math.round((checked / session.total) * 100) : 0

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Feather name="arrow-left" size={19} color={Colors.text1} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{session.name}</Text>
          <View style={styles.subRow}>
            <Feather name="map-pin" size={10} color={Colors.text3} />
            <Text style={styles.sub} numberOfLines={1}>{session.location}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
          <Feather name="refresh-cw" size={16} color={Colors.text2} />
        </TouchableOpacity>
      </View>

      {/* Прогресс (счётчики по статусам — во вкладках ниже) */}
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { flex: progress }]} />
          <View style={{ flex: 100 - progress }} />
        </View>
        <Text style={styles.progressText}>
          {progress}% · {checked} из {session.total}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingBottom: 8,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center',
  },
  title:  { fontSize: 15, fontWeight: '700', color: Colors.text1 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sub:    { fontSize: 11, color: Colors.text3, flexShrink: 1 },

  progressRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  progressBar: {
    flex: 1, flexDirection: 'row', height: 6,
    backgroundColor: Colors.bg3, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { backgroundColor: Colors.accent2, borderRadius: 3 },
  progressText: { fontSize: 11, color: Colors.text3, fontVariant: ['tabular-nums'] },
})
