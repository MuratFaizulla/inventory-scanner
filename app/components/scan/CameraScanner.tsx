// components/scan/CameraScanner.tsx

import { CameraView } from 'expo-camera'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../../constants/colors'

interface Props {
  submitting:       boolean
  onBarcodeScanned: (data: string) => void
  onManual:         () => void
}

export default function CameraScanner({ submitting, onBarcodeScanned, onManual }: Props) {
  return (
    <View style={styles.wrap}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={submitting ? undefined : ({ data }) => onBarcodeScanned(data)}
        barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'qr'] }}
      />

      <View style={styles.overlay}>
        {submitting ? (
          <View style={styles.scanningBox}>
            <Text style={styles.scanningText}>⏳ Отправляем...</Text>
          </View>
        ) : (
          <>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.TL]} />
              <View style={[styles.corner, styles.TR]} />
              <View style={[styles.corner, styles.BL]} />
              <View style={[styles.corner, styles.BR]} />
            </View>
            <Text style={styles.hint}>Наведите на штрих-код</Text>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.manualBtn} onPress={onManual}>
        <Text style={styles.manualText}>⌨️ Ввести вручную</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:    { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame:   { width: 240, height: 240, position: 'relative' },
  corner:  { position: 'absolute', width: 28, height: 28, borderColor: Colors.accent2, borderWidth: 3 },
  TL: { top: 0, left: 0,  borderRightWidth: 0,  borderBottomWidth: 0 },
  TR: { top: 0, right: 0, borderLeftWidth: 0,   borderBottomWidth: 0 },
  BL: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0 },
  BR: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0 },
  hint:         { marginTop: 24, color: '#ffffffcc', fontSize: 14, fontWeight: '500' },
  scanningBox:  { backgroundColor: '#000000aa', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 20 },
  scanningText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  manualBtn: {
    position: 'absolute', bottom: 32, alignSelf: 'center',
    backgroundColor: '#00000099', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 12,
    borderWidth: 1, borderColor: '#ffffff33',
  },
  manualText: { color: '#fff', fontSize: 14, fontWeight: '600' },
})