// components/scan/ScanHeader.tsx

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{sessionName}</Text>
        <Text style={styles.sub}>👤 {scannerName} · ✅ {scannedCount}</Text>
      </View>

      <View style={styles.btns}>
        <TouchableOpacity onPress={onStats} style={styles.btn}>
          <Text style={styles.btnText}>🏢</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onHistory} style={styles.btn}>
          <Text style={styles.btnText}>🕐 {historyCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 24, color: Colors.accent },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text1 },
  sub:   { fontSize: 11, color: Colors.text3, marginTop: 2 },
  btns:  { flexDirection: 'row', gap: 6 },
  btn:   { backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnText: { fontSize: 13, color: Colors.text2 },
})