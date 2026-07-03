// components/scan/ScanHeader.tsx

import { Feather } from '@expo/vector-icons'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'

interface Props {
  sessionName:   string
  scannerName:   string
  scannedCount:  number
  historyCount:  number
  onBack:        () => void
  onHistory:     () => void
  onStats:       () => void
}

export default function ScanHeader({
  sessionName, scannerName, scannedCount,
  historyCount, onBack, onHistory, onStats,
}: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
        <Feather name="arrow-left" size={19} color={Colors.text1} />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{sessionName}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {scannerName} · отсканировано: {scannedCount}
        </Text>
      </View>

      <View style={styles.btns}>
        <TouchableOpacity onPress={onStats} style={styles.btn}>
          <Feather name="bar-chart-2" size={15} color={Colors.text2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onHistory} style={styles.btn}>
          <Feather name="clock" size={14} color={Colors.text2} />
          <Text style={styles.btnText}>{historyCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text1 },
  sub:   { fontSize: 11, color: Colors.text3, marginTop: 2 },
  btns:  { flexDirection: 'row', gap: 6 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bg3, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  btnText: { fontSize: 13, color: Colors.text2 },
})
